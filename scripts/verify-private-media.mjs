import nextEnv from '@next/env';
import pg from 'pg';
import cloudinaryPackage from 'cloudinary';

nextEnv.loadEnvConfig(process.cwd());
const cloudinary = cloudinaryPackage.v2;
cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET });
const databaseUrl = new URL(process.env.DATABASE_URL);
databaseUrl.searchParams.set('sslmode', 'verify-full');
databaseUrl.searchParams.delete('uselibpqcompat');
const pool = new pg.Pool({ connectionString: databaseUrl.toString(), ssl: { rejectUnauthorized: true } });

function assetFromUrl(value) {
  const match = /^\/(?:[^/]+)\/(image|video|raw)\/authenticated\/(?:s--[^/]+--\/)?(?:v\d+\/)?(.+)\.([a-z0-9]+)$/i.exec(new URL(value).pathname);
  if (!match) return null;
  return { resourceType: match[1], publicId: decodeURIComponent(match[2] + (match[1] === 'raw' ? `.${match[3]}` : '')), format: match[3] };
}

async function check(source, label) {
  const asset = assetFromUrl(source);
  if (!asset) throw new Error(`${label}: URL is not authenticated.`);
  let cloudinaryRecord = false;
  try { cloudinaryRecord = Boolean((await cloudinary.api.resource(asset.publicId, { resource_type: asset.resourceType, type: 'authenticated' })).public_id); }
  catch (error) { console.log(`${label}: metadata=${error?.error?.http_code || error?.http_code || 'unknown'} ${error?.error?.message || error?.message || ''}`); }
  const unsignedOriginal = source.replace(/\/s--[^/]+--\//, '/');
  const original = await fetch(unsignedOriginal, { method: 'HEAD', signal: AbortSignal.timeout(15_000) }).catch(() => null);
  const oldPublic = unsignedOriginal.replace('/authenticated/', '/upload/');
  const oldResponse = await fetch(oldPublic, { method: 'HEAD', signal: AbortSignal.timeout(15_000) }).catch(() => null);
  const preview = asset.resourceType === 'raw' ? null : cloudinary.url(asset.publicId, { secure: true, type: 'authenticated', resource_type: asset.resourceType, sign_url: true, format: asset.format, width: 1200, crop: 'limit', quality: 75 });
  const previewResponse = preview ? await fetch(preview, { method: 'HEAD', signal: AbortSignal.timeout(15_000) }).catch(() => null) : null;
  const signed = cloudinary.utils.private_download_url(asset.publicId, asset.resourceType === 'raw' ? '' : asset.format, { resource_type: asset.resourceType, type: 'authenticated', expires_at: Math.floor(Date.now() / 1000) + 60, attachment: true });
  const signedResponse = await fetch(signed, { method: 'HEAD', signal: AbortSignal.timeout(15_000) }).catch(() => null);
  console.log(`${label}: type=${asset.resourceType} record=${cloudinaryRecord} unsigned-original=${original?.status ?? 'network-error'} old-public=${oldResponse?.status ?? 'network-error'} preview=${previewResponse?.status ?? 'n/a'} signed-original=${signedResponse?.status ?? 'network-error'}`);
  if (!cloudinaryRecord || original?.ok || oldResponse?.ok || (previewResponse && !previewResponse.ok) || !signedResponse?.ok) process.exitCode = 1;
}

try {
  const galleries = await pool.query('SELECT finished_images FROM galleries WHERE cardinality(finished_images)>0 ORDER BY id DESC LIMIT 1');
  const products = await pool.query("SELECT product_url FROM digital_products WHERE product_url <> '' LIMIT 1");
  if (galleries.rows[0]?.finished_images?.[0]) await check(galleries.rows[0].finished_images[0], 'gallery');
  if (products.rows[0]?.product_url) await check(products.rows[0].product_url, 'product');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Media verification failed.');
  process.exitCode = 1;
} finally {
  await pool.end();
}
