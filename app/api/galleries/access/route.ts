import { readJsonRequest } from '@/lib/requestBody';
import { normalizeImagePosition } from '@/lib/imagePosition';
import { normalizeGalleryPresentation } from '@/lib/galleryPresentation';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { signedGallerySoundtrack } from '@/lib/privateMedia';
import { rateLimit } from '@/lib/rateLimit';
import { createGalleryCookie, galleryCookieAge, galleryCookieName } from '@/lib/galleryAccess';

import { galleryPreviewUrl } from '@/lib/galleryPreview';

function toStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, 'gallery-access', 20, 900);
  if (limited) return limited;
  const jsonRequest = await readJsonRequest(req, 2000);
  if (jsonRequest.response) return jsonRequest.response;
  const body = jsonRequest.body;
  const accessCode = String(body?.accessCode || '').trim();

  if (!accessCode || accessCode.length > 64) {
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
            hero_position,
            presentation,
            soundtrack_url,
            soundtrack_title,
            is_locked,
            EXISTS(SELECT 1 FROM gallery_documents d WHERE d.gallery_id=galleries.id AND d.document_type='invoice' AND d.currency='NGN') AS has_invoice
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
  const previews = allImages.map((_, index) => galleryPreviewUrl(gallery.id, index));
  const finishedPreviews = finishedImages.map((_, index) => galleryPreviewUrl(gallery.id, index, 'finished'));
  const previewFor = (source: string) => {
    const index = allImages.indexOf(source);
    return index >= 0 ? previews[index] : finishedPreviews[finishedImages.indexOf(source)] || '';
  };

  const response = NextResponse.json({
    gallery: {
      id: gallery.id,
      client_name: gallery.client_name,
      slug: gallery.slug,
      images: previews,
      approved_images: approvedImages.map(previewFor).filter(Boolean),
      finished_images: finishedPreviews,
      payment_verified: gallery.payment_verified || false,
      payment_url: gallery.has_invoice ? `/payments/gallery?gallery=${gallery.id}` : gallery.payment_url || '',
      review_rating: gallery.review_rating || null,
      review_text: gallery.review_text || '',
      review_submitted_at: gallery.review_submitted_at || null,
      hero_position: normalizeImagePosition(gallery.hero_position),
      presentation: gallery.presentation ? (() => {
        const settings = normalizeGalleryPresentation(gallery.presentation);
        // Resolve gallery-owned covers to the same session-protected previews.
        const source = [...allImages, ...finishedImages].includes(settings.coverImage) ? settings.coverImage : allImages[0] || finishedImages[0] || '';
        return { ...settings, coverImage: source ? previewFor(source) : '' };
      })() : null,
      soundtrack_url: signedGallerySoundtrack(gallery.soundtrack_url || ''),
      soundtrack_title: gallery.soundtrack_title || '',
      gallery_design: gallery.gallery_design || 'editorial',
      is_locked: gallery.is_locked,
      image_count: allImages.length,
      finished_count: finishedPreviews.length,
      upload_count: allImages.length,
    },
  }, { headers: { 'Cache-Control': 'private, no-store' } });
  response.cookies.set(galleryCookieName(gallery.id), createGalleryCookie(gallery.id, accessCode), {
    httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production',
    path: '/api', maxAge: galleryCookieAge,
  });
  return response;
}
