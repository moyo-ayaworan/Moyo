import { readJsonRequest } from '@/lib/requestBody';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rateLimit';
import { query } from '@/lib/db';

function normalizeReviewText(value: unknown) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, 'gallery-access', 20, 900);
  if (limited) return limited;
  if (Number(req.headers.get('content-length') || 0) > 100_000) return NextResponse.json({ error: 'Request too large.' }, { status: 413 });
  const jsonRequest = await readJsonRequest(req, 8000);
  if (jsonRequest.response) return jsonRequest.response;
  const body = jsonRequest.body;
  const accessCode = String(body?.accessCode || '').trim();
  const galleryId = Number(body?.galleryId);
  const rating = Number(body?.rating);
  const reviewText = normalizeReviewText(body?.reviewText);

  if (!accessCode || accessCode.length > 128 || !Number.isSafeInteger(galleryId) || galleryId < 1 || galleryId > 2147483647) {
    return NextResponse.json({ error: 'Access code and gallery id are required.' }, { status: 400 });
  }

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Please choose a rating from 1 to 5.' }, { status: 400 });
  }

  if (reviewText.length < 10) {
    return NextResponse.json({ error: 'Please write a short review before submitting.' }, { status: 400 });
  }

  if (reviewText.length > 1000) {
    return NextResponse.json({ error: 'Please keep your review under 1000 characters.' }, { status: 400 });
  }

  const { rows } = await query(
    `SELECT id,
            access_code,
            finished_images,
            payment_verified,
            is_locked
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

  if (!gallery.payment_verified || !Array.isArray(gallery.finished_images) || gallery.finished_images.length === 0) {
    return NextResponse.json(
      { error: 'Reviews open after finished work is delivered and payment is verified.' },
      { status: 403 }
    );
  }

  const updated = await query(
    `UPDATE galleries
     SET review_rating = $1,
         review_text = $2,
         review_submitted_at = NOW()
     WHERE id = $3
     RETURNING review_rating, review_text, review_submitted_at`,
    [rating, reviewText, galleryId]
  );

  return NextResponse.json({
    message: 'Review submitted.',
    review_rating: updated.rows[0]?.review_rating,
    review_text: updated.rows[0]?.review_text || '',
    review_submitted_at: updated.rows[0]?.review_submitted_at,
  });
}
