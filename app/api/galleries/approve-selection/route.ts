import { readJsonRequest } from '@/lib/requestBody';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rateLimit';
import { galleryPreviewUrl } from '@/lib/galleryPreview';
import { query } from '@/lib/db';

function uniqueStrings(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0))
  );
}

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, 'gallery-access', 20, 900);
  if (limited) return limited;
  if (Number(req.headers.get('content-length') || 0) > 100_000) return NextResponse.json({ error: 'Request too large.' }, { status: 413 });
  const jsonRequest = await readJsonRequest(req, 100000);
  if (jsonRequest.response) return jsonRequest.response;
  const body = jsonRequest.body;
  const accessCode = String(body?.accessCode || '').trim();
  const galleryId = Number(body?.galleryId);
  const selectedImages = uniqueStrings(body?.images);

  if (!accessCode || accessCode.length > 128 || !Number.isSafeInteger(galleryId) || galleryId < 1 || galleryId > 2147483647) {
    return NextResponse.json({ error: 'Access code and gallery id are required.' }, { status: 400 });
  }

  if (selectedImages.length === 0) {
    return NextResponse.json({ error: 'Select at least one image to approve.' }, { status: 400 });
  }

  const { rows } = await query(
    `SELECT id, images, is_locked
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

  const sources = (gallery.images || []) as string[];
  const references = new Map(sources.map((source, index) => [galleryPreviewUrl(galleryId, index), source]));
  const galleryImages = new Set(references.keys());
  const invalidImages = selectedImages.filter((image) => !galleryImages.has(image));

  if (invalidImages.length > 0) {
    return NextResponse.json({ error: 'Selection contains images outside this gallery.' }, { status: 400 });
  }

  await query(
    `UPDATE galleries
     SET approved_images = $1::text[]
     WHERE id = $2
     RETURNING approved_images`,
    [selectedImages.map(image => references.get(image)), galleryId]
  );

  return NextResponse.json({
    message: 'Selection approved.',
    approved_images: selectedImages,
    approved_count: selectedImages.length,
  });
}
