import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(_req: NextRequest, context: { params: Promise<{ token: string }> }) {
  const token = (await context.params).token?.trim();
  if (!token || token.length < 24) return NextResponse.json({ error: 'Invalid collector link.' }, { status: 400 });
  const { rows } = await query(`SELECT i.id, i.inquiry_type, i.name, i.email, i.phone, i.details, i.status, i.gallery_id, i.client_notes, i.created_at::text, a.title AS artwork_title, a.image AS artwork_image, a.price AS artwork_price, a.availability_status FROM art_inquiries i LEFT JOIN artworks a ON a.id=i.artwork_id WHERE i.manage_token=$1 LIMIT 1`, [token]);
  if (!rows[0]) return NextResponse.json({ error: 'Collector record not found.' }, { status: 404 });
  const inquiry = rows[0];
  const documents = inquiry.gallery_id ? (await query(`SELECT id, document_type, title, amount, currency, due_date, sent_at::text, paid_at::text, billing_details, payments, created_at::text FROM gallery_documents WHERE gallery_id=$1 ORDER BY created_at DESC`, [inquiry.gallery_id])).rows : [];
  return NextResponse.json({ inquiry, documents }, { headers: { 'Cache-Control': 'private, no-store' } });
}
