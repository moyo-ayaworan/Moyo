import { after, NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyGallerySettlement, paymentFailure } from '@/lib/payments/server';
import nodemailer from 'nodemailer';
import { parseAuthenticatedAsset, temporaryOriginalUrl } from '@/lib/privateMedia';
import { rateLimit } from '@/lib/rateLimit';
import { hasGalleryCookie } from '@/lib/galleryAccess';

async function notifyDownload(clientName: string, galleryId: number, fileName: string) {
  const user = process.env.SMTP_USER || process.env.EMAIL_SERVER_USER || process.env.EMAIL_USER || process.env.MAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_SERVER_PASSWORD || process.env.EMAIL_PASS || process.env.MAIL_PASS || process.env.SMTP_PASSWORD;
  if (!user || !pass) return;
  const host = process.env.SMTP_HOST || process.env.EMAIL_SERVER_HOST || process.env.EMAIL_HOST || process.env.MAIL_HOST;
  const port = Number(process.env.SMTP_PORT || process.env.EMAIL_SERVER_PORT || process.env.EMAIL_PORT || process.env.MAIL_PORT || 587);
  const from = process.env.SMTP_FROM || process.env.MAIL_FROM || process.env.EMAIL_FROM || user;
  const to = process.env.CONTACT_EMAIL || 'ijabikenm@gmail.com';
  const transporter = nodemailer.createTransport(host
    ? { host, port, secure: (process.env.SMTP_SECURE || process.env.EMAIL_SECURE || process.env.MAIL_SECURE)?.toLowerCase() === 'true' || port === 465, auth: { user, pass }, connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 10000 }
    : { service: 'gmail', auth: { user, pass }, connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 10000 });
  await transporter.sendMail({
    from, to,
    subject: `Gallery download requested: ${clientName}`,
    text: `${clientName} requested a finished image download from gallery #${galleryId}.\nFile: ${fileName}\nTime: ${new Date().toISOString()}`,
  });
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
  const limited = await rateLimit(req, 'gallery-download', 30, 900);
  if (limited) return limited;
  const { searchParams } = new URL(req.url);
  const galleryId = Number(searchParams.get('galleryId'));
  const imageIndex = Number(searchParams.get('index'));

  if (!Number.isInteger(galleryId) || galleryId <= 0 || !searchParams.has('index') || !Number.isInteger(imageIndex) || imageIndex < 0) {
    return NextResponse.json({ error: 'Missing download details.' }, { status: 400 });
  }

  const { rows } = await query(
    `SELECT access_code, client_name, finished_images, payment_verified, is_locked
     FROM galleries
     WHERE id = $1
     LIMIT 1`,
    [galleryId]
  );

  const gallery = rows[0];
  if (!gallery) {
    return NextResponse.json({ error: 'Invalid gallery access.' }, { status: 404 });
  }

  if (!hasGalleryCookie(req, galleryId, gallery.access_code)) {
    return NextResponse.json({ error: 'Invalid gallery access.' }, { status: 403 });
  }

  if (gallery.is_locked) {
    return NextResponse.json({ error: 'This gallery is currently locked.' }, { status: 403 });
  }

  const finishedImages = (Array.isArray(gallery.finished_images) ? gallery.finished_images : [])
    .filter((url: string) => parseAuthenticatedAsset(url)?.resourceType === 'image');
  const fileUrl = finishedImages[imageIndex];
  if (!gallery.payment_verified || !fileUrl) {
    return NextResponse.json({ error: 'This download is not available.' }, { status: 403 });
  }

  try {
    if (!await verifyGallerySettlement(galleryId)) return NextResponse.json({ error: 'This gallery payment needs studio review.' }, { status: 403 });
  } catch (error) { return paymentFailure(error); }

  const originalUrl = temporaryOriginalUrl(fileUrl);
  if (!originalUrl) return NextResponse.json({ error: 'This download is not available.' }, { status: 403 });
  const downloadUrl = new URL(originalUrl);

  let fileResponse: Response;
  try {
    fileResponse = await fetch(downloadUrl, { signal: AbortSignal.timeout(30_000) });
  } catch {
    return NextResponse.json({ error: 'Unable to prepare this download. Please try again.' }, { status: 502 });
  }
  if (!fileResponse.ok || !fileResponse.body) {
    return NextResponse.json({ error: 'Unable to prepare this download.' }, { status: 502 });
  }

  const fileName = getFileNameFromUrl(new URL(fileUrl), `moyo-finished-work-${galleryId}.jpg`);

  // SMTP must not hold an already authorized file response open.
  after(async () => {
    try { await notifyDownload(gallery.client_name, galleryId, fileName); }
    catch { console.error('[gallery-download] Notification delivery failed.'); }
  });

  return new NextResponse(fileResponse.body, {
    headers: {
      'Content-Type': fileResponse.headers.get('content-type') || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(fileName).replace(/['()*]/g, (char) => '%' + char.charCodeAt(0).toString(16))}`,
      'Cache-Control': 'private, no-store',
    },
  });
}
