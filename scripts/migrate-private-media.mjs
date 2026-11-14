import nextEnv from '@next/env';
import pg from 'pg';
import cloudinaryPackage from 'cloudinary';

nextEnv.loadEnvConfig(process.cwd());
const apply = process.argv.includes('--apply');
const { Pool } = pg;
const cloudinary = cloudinaryPackage.v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function publicAsset(source) {
  let url;
  try { url = new URL(source); } catch { return null; }
  if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' || url.pathname.split('/')[1] !== process.env.CLOUDINARY_CLOUD_NAME) return null;
  const match = /^\/(?:[^/]+)\/(image|video|raw)\/upload\/(?:v\d+\/)?(.+)\.([a-z0-9]+)$/i.exec(url.pathname);
  return match ? { resourceType: match[1], publicId: decodeURIComponent(match[2] + (match[1] === 'raw' ? `.${match[3]}` : '')) } : null;
}

if (!process.env.DATABASE_URL || !process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  throw new Error('Database and Cloudinary credentials are required.');
}

const databaseUrl = new URL(process.env.DATABASE_URL);
databaseUrl.searchParams.set('sslmode', 'verify-full');
databaseUrl.searchParams.delete('uselibpqcompat');
const pool = new Pool({ connectionString: databaseUrl.toString(), ssl: { rejectUnauthorized: true } });
try {
  const [galleries, products, publicReferences] = await Promise.all([
    pool.query('SELECT id, finished_images FROM galleries'),
    pool.query('SELECT id, product_url FROM digital_products'),
    pool.query(`SELECT image AS url FROM artworks UNION ALL
      SELECT unnest(images) FROM galleries UNION ALL
      SELECT image FROM digital_products UNION ALL
      SELECT homepage_hero_image FROM content UNION ALL
      SELECT about_image FROM content UNION ALL
      SELECT cover_image_url FROM photography_categories UNION ALL
      SELECT image_url FROM photography_category_images`),
  ]);
  const inPublicUse = new Set(publicReferences.rows.map((row) => row.url).filter(Boolean));
  const targets = new Set([
    ...galleries.rows.flatMap((row) => row.finished_images || []),
    ...products.rows.map((row) => row.product_url).filter(Boolean),
  ]);
  const label = (source) => [
    ...galleries.rows.filter((row) => (row.finished_images || []).includes(source)).map((row) => `gallery #${row.id}`),
    ...products.rows.filter((row) => row.product_url === source).map((row) => `product #${row.id}`),
  ].join(', ');
  let migrated = 0;
  let needsAttention = 0;
  for (const source of targets) {
    if (source.includes('/authenticated/')) continue;
    const asset = publicAsset(source);
    if (!asset || inPublicUse.has(source)) {
      console.log(`Requires manual reupload: ${label(source)}`);
      needsAttention++;
      continue;
    }
    if (!apply) {
      console.log(`Would migrate: ${label(source)}`);
      continue;
    }
    let result;
    try {
      result = await cloudinary.uploader.rename(asset.publicId, asset.publicId, {
        resource_type: asset.resourceType,
        type: 'upload',
        to_type: 'authenticated',
        overwrite: false,
        invalidate: true,
      });
    } catch (error) {
      if (error?.http_code !== 404) throw new Error(`Cloudinary migration failed for ${label(source)} (${error?.http_code || 'unknown'}).`);
      // A previous run can stop after Cloudinary moved the file but before the DB update.
      try {
        result = await cloudinary.api.resource(asset.publicId, { resource_type: asset.resourceType, type: 'authenticated' });
      } catch {
        throw new Error(`Cloudinary could not locate ${label(source)} under either delivery type.`);
      }
    }
    if (!result?.secure_url?.includes('/authenticated/')) throw new Error('Cloudinary did not return an authenticated URL.');
    await pool.query('UPDATE galleries SET finished_images = array_replace(finished_images, $1, $2) WHERE $1 = ANY(finished_images)', [source, result.secure_url]);
    await pool.query('UPDATE digital_products SET product_url = $2, updated_at = NOW() WHERE product_url = $1', [source, result.secure_url]);
    migrated++;
    console.log(`Migrated: ${label(source)}`);
  }
  console.log(apply ? `Migrated ${migrated} assets. ${needsAttention} need manual reupload.` : `Dry run complete. ${needsAttention} need manual reupload. Pass --apply to migrate eligible assets.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Migration failed.');
  process.exitCode = 1;
} finally {
  await pool.end();
}
