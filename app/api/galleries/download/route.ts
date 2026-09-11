import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

function getDownloadUrl(req: NextRequest, url: string) {
  const parsed = new URL(url, req.nextUrl.origin);

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Unsupported download protocol.');
  }

  return parsed;
}

function getFileNameFromUrl(url: URL, fallback: string) {
  try {
    const lastSegment = url.pathname.split('/').filter(Boolean).pop() || fallback;
    const cleanSegment = decodeURIComponent(lastSegment.split('?')[0] || fallback);
    return cleanSegment.includes('.') ? cleanSegment : `${cleanSegment}.jpg`;
  } catch {
    return fallback;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const accessCode = String(searchParams.get('accessCode') || '').trim();
  const galleryId = Number(searchParams.get('galleryId'));
  const fileUrl = String(searchParams.get('file') || '').trim();

  if (!accessCode || !Number.isFinite(galleryId) || !fileUrl) {
    return NextResponse.json({ error: 'Missing download details.' }, { status: 400 });
  }

  const { rows } = await query(
    `SELECT finished_images, payment_verified, is_locked
     FROM galleries
     WHERE id = $1 AND UPPER(access_code) = UPPER($2)
     LIMIT 1`,
    [galleryId, accessCode]
  );

  const gallery = rows[0];
  if (!gallery) {
    return NextResponse.json({ error: 'Invalid gallery access.' }, { status: 404 });
  }

  if (gallery.is_locked) {
    return NextResponse.json({ error: 'This gallery is currently locked.' }, { status: 403 });
  }

  const finishedImages = Array.isArray(gallery.finished_images) ? gallery.finished_images : [];
  if (!gallery.payment_verified || !finishedImages.includes(fileUrl)) {
    return NextResponse.json({ error: 'This download is not available.' }, { status: 403 });
  }

  let downloadUrl: URL;
  try {
    downloadUrl = getDownloadUrl(req, fileUrl);
  } catch {
    return NextResponse.json({ error: 'This download URL is not supported.' }, { status: 400 });
  }

  let fileResponse: Response;
  try {
    fileResponse = await fetch(downloadUrl, { signal: AbortSignal.timeout(30_000) });
  } catch {
    return NextResponse.json({ error: 'Unable to prepare this download. Please try again.' }, { status: 502 });
  }
  if (!fileResponse.ok || !fileResponse.body) {
    return NextResponse.json({ error: 'Unable to prepare this download.' }, { status: 502 });
  }

  const fileName = getFileNameFromUrl(downloadUrl, `moyo-finished-work-${galleryId}.jpg`);

  return new NextResponse(fileResponse.body, {
    headers: {
      'Content-Type': fileResponse.headers.get('content-type') || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(fileName).replace(/['()*]/g, (char) => '%' + char.charCodeAt(0).toString(16))}`,
      'Cache-Control': 'private, no-store',
    },
  });
}
