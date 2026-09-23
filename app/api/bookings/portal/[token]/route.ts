import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function GET(_req: NextRequest, context: RouteContext) {
  const { token } = await context.params;
  const cleanToken = typeof token === 'string' ? token.trim() : '';
  if (!cleanToken || cleanToken.length < 12) {
    return NextResponse.json({ error: 'Invalid booking link.' }, { status: 400 });
  }

  const { rows } = await query(
    `SELECT id, name, email, phone, service, message, booking_date::text, booking_time, scheduled_at::text,
            timezone, status, client_notes, gallery_id, confirmation_sent_at::text, reminder_24h_sent_at::text,
            reminder_day_sent_at::text, created_at::text
     FROM bookings
     WHERE manage_token = $1
     LIMIT 1`,
    [cleanToken]
  );

  if (!rows[0]) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
  const booking = rows[0];
  const galleryId = Number(booking.gallery_id || 0);
  const [galleryResult, documentResult] = galleryId
    ? await Promise.all([
        query(
          `SELECT id, slug, access_code, client_name, payment_verified, payment_url,
                  array_length(images, 1) AS image_count,
                  array_length(approved_images, 1) AS approved_count,
                  array_length(finished_images, 1) AS finished_count,
                  review_submitted_at::text
           FROM galleries
           WHERE id = $1`,
          [galleryId]
        ),
        query(
          `SELECT id, document_type, title, amount, currency, due_date, sent_at::text, paid_at::text, created_at::text
           FROM gallery_documents
           WHERE gallery_id = $1
           ORDER BY created_at DESC`,
          [galleryId]
        ),
      ])
    : [{ rows: [] }, { rows: [] }];

  return NextResponse.json({
    booking,
    gallery: galleryResult.rows[0] || null,
    documents: documentResult.rows,
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}
