import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { query } from '@/lib/db';
import { hasGalleryCookie } from '@/lib/galleryAccess';
import { signedGalleryPreview } from '@/lib/privateMedia';

export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'same-origin' };

export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams;
  const id = Number(params.get('galleryId'));
  const index = Number(params.get('index'));
  const collection = params.get('collection');
  if (!Number.isSafeInteger(id) || id < 1 || !params.has('index') || !Number.isSafeInteger(index) || index < 0 || !['proofs', 'finished'].includes(collection || '')) {
    return NextResponse.json({ error: 'Invalid preview.' }, { status: 400, headers });
  }
  const { rows } = await query('SELECT access_code, is_locked, images, finished_images FROM galleries WHERE id=$1', [id]);
  const gallery = rows[0];
  if (!gallery || gallery.is_locked || !hasGalleryCookie(req, id, gallery.access_code)) {
    return NextResponse.json({ error: 'This preview is unavailable. Reopen your gallery with its access code.' }, { status: 403, headers });
  }
  const source = (collection === 'proofs' ? gallery.images : gallery.finished_images)?.[index];
  let upstream = typeof source === 'string' ? signedGalleryPreview(source) : null;
  // Legacy public uploads are transformed on the server; never reveal their URL.
  if (!upstream && typeof source === 'string') {
    try {
      const url = new URL(source);
      if (url.protocol === 'https:' && url.hostname === 'res.cloudinary.com' && url.pathname.split('/')[1] === process.env.CLOUDINARY_CLOUD_NAME && /^\/[^/]+\/image\/upload\/(?:v\d+\/)?[^?]+$/i.test(url.pathname)) {
        url.search = '';
        url.pathname = url.pathname.replace('/image/upload/', '/image/upload/c_limit,w_1200,h_1200,q_75,f_jpg/');
        upstream = url.toString();
      }
    } catch { /* Unsupported sources fail closed. */ }
  }
  if (!upstream) return NextResponse.json({ error: 'Preview unavailable. Ask the studio to reupload this image privately.' }, { status: 404, headers });
  try {
    const response = await fetch(upstream, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15_000) });
    if (!response.ok || !response.body) throw new Error('Provider unavailable');
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    const reader = response.body.getReader();
    while (true) {
      const { done, value: chunk } = await reader.read();
      if (done) break;
      bytes += chunk.byteLength;
      if (bytes > 12 * 1024 * 1024) { await reader.cancel(); throw new Error('Preview too large'); }
      chunks.push(chunk);
    }
    const preview = await sharp(Buffer.concat(chunks), { limitInputPixels: 40_000_000 }).rotate().resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true }).toBuffer({ resolveWithObject: true });
    const { width, height } = preview.info;
    const fontSize = Math.max(12, Math.round(width / 34));
    const watermark = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="proof" width="${width / 2}" height="${height / 3}" patternUnits="userSpaceOnUse"><text x="12" y="${height / 6}" font-family="sans-serif" font-size="${fontSize}" fill="white" fill-opacity="0.48" stroke="black" stroke-opacity="0.35" stroke-width="0.6" transform="rotate(-20 12 ${height / 6})">MOYO · PROOF · #${id}</text></pattern></defs><rect width="100%" height="100%" fill="url(#proof)"/></svg>`);
    const image = await sharp(preview.data).composite([{ input: watermark }]).jpeg({ quality: 72 }).toBuffer();
    return new NextResponse(new Uint8Array(image), { headers: { ...headers, 'Content-Type': 'image/jpeg' } });
  } catch {
    return NextResponse.json({ error: 'Unable to prepare this preview.' }, { status: 502, headers });
  }
}
