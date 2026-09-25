import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCloudinaryPreviewUrl } from '@/lib/mediaUrl';

function toStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const accessCode = String(body?.accessCode || '').trim();

  if (!accessCode) {
    return NextResponse.json({ error: 'Access code is required' }, { status: 400 });
  }

  const { rows } = await query(
    `SELECT id,
            client_name,
            slug,
            images,
            approved_images,
            finished_images,
            payment_verified,
            payment_url,
            review_rating,
            review_text,
            review_submitted_at,
            gallery_design,
            is_locked
     FROM galleries
     WHERE UPPER(access_code) = UPPER($1)
     ORDER BY created_at DESC
     LIMIT 1`,
    [accessCode]
  );

  const gallery = rows[0];
  if (!gallery) {
    return NextResponse.json({ error: 'Invalid access code' }, { status: 404 });
  }

  if (gallery.is_locked) {
    return NextResponse.json({ error: 'This gallery is currently locked' }, { status: 403 });
  }

  const allImages = toStringArray(gallery.images);
  const approvedImages = toStringArray(gallery.approved_images);
  const finishedImages = toStringArray(gallery.finished_images);

  return NextResponse.json({
    gallery: {
      id: gallery.id,
      client_name: gallery.client_name,
      slug: gallery.slug,
      images: allImages,
      approved_images: approvedImages,
      finished_images: gallery.payment_verified
        ? finishedImages
        : finishedImages.map((image) => getCloudinaryPreviewUrl(image, { width: 1600, crop: 'limit', quality: 80 })),
      payment_verified: gallery.payment_verified || false,
      payment_url: gallery.payment_url || '',
      review_rating: gallery.review_rating || null,
      review_text: gallery.review_text || '',
      review_submitted_at: gallery.review_submitted_at || null,
      gallery_design: gallery.gallery_design || 'editorial',
      is_locked: gallery.is_locked,
      image_count: allImages.length,
      finished_count: finishedImages.length,
      upload_count: allImages.length,
    },
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}
