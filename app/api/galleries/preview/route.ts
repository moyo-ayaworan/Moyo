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
  const { rows } = await query('SELECT access_code, is_locked, payment_verified, images, finished_images FROM galleries WHERE id=$1', [id]);
  const gallery = rows[0];
  if (!gallery || gallery.is_locked || !hasGalleryCookie(req, id, gallery.access_code)) {
    return NextResponse.json({ error: 'This preview is unavailable. Reopen your gallery with its access code.' }, { status: 403, headers });
  }
  if (collection === 'finished' && !gallery.payment_verified) {
    return NextResponse.json({ error: 'Finished work is available after payment is verified.' }, { status: 403, headers });
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
    if (collection === 'finished') {
      const image = await sharp(preview.data).jpeg({ quality: 72 }).toBuffer();
      return new NextResponse(new Uint8Array(image), { headers: { ...headers, 'Content-Type': 'image/jpeg' } });
    }
    const { width, height } = preview.info;
    // Paths keep the watermark readable on hosts without installed fonts.
    const glyphs: Record<string, string[]> = {
      M: ['10001','11011','10101','10101','10001','10001','10001'],
      O: ['01110','10001','10001','10001','10001','10001','01110'],
      Y: ['10001','10001','01010','00100','00100','00100','00100'],
      P: ['11110','10001','10001','11110','10000','10000','10000'],
      R: ['11110','10001','10001','11110','10100','10010','10001'],
      F: ['11111','10000','10000','11110','10000','10000','10000'],
    };
    const paths = ['MOYO', 'PROOF'].flatMap((line, lineIndex) => [...line].flatMap((letter, i) => glyphs[letter].flatMap((row, y) => [...row].flatMap((pixel, x) => pixel === '1' ? [`M${i * 6 + x + (lineIndex === 0 ? 3 : 0)} ${y + lineIndex * 10}h1v1h-1z`] : [])))).join('');
    // Fill the centre of portrait and landscape previews with a large diagonal mark.
    const scale = Math.min(width * 0.94 / 33.1, height * 0.70 / 25.9);
    const watermark = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><g transform="translate(${width / 2} ${height / 2}) rotate(-20) scale(${scale}) translate(-14.5 -8.5)"><path d="${paths}" fill="white" fill-opacity="0.48" stroke="black" stroke-opacity="0.35" stroke-width="0.06"/></g></svg>`);
    const image = await sharp(preview.data).composite([{ input: watermark }]).jpeg({ quality: 72 }).toBuffer();
    return new NextResponse(new Uint8Array(image), { headers: { ...headers, 'Content-Type': 'image/jpeg' } });
  } catch {
    return NextResponse.json({ error: 'Unable to prepare this preview.' }, { status: 502, headers });
  }
}
