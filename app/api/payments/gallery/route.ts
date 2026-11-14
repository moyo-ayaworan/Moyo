import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { hasGalleryCookie } from '@/lib/galleryAccess';
import { rateLimit } from '@/lib/rateLimit';
import { paystackSecret } from '@/lib/paystack';
import { PaymentError, paymentMode } from '@/lib/payments/policy';
import { payments, requestBody, requirePaymentOrigin, initializeOrder, paymentFailure, privateHeaders } from '@/lib/payments/server';
async function galleryAccess(req: NextRequest, id: unknown) {
  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0 || id > 2147483647) throw new PaymentError('Invalid gallery.', 400);
  const gallery = (await query('SELECT id,access_code,is_locked FROM galleries WHERE id=$1', [id])).rows[0];
  if (!gallery || gallery.is_locked || !hasGalleryCookie(req, id, gallery.access_code)) throw new PaymentError('Open your private gallery with its access code first.', 403);
  return gallery;
}
export async function GET(req: NextRequest) {
  try {
    const limited = await rateLimit(req, 'gallery-invoices', 30, 900); if (limited) return limited;
    const gallery = await galleryAccess(req, Number(req.nextUrl.searchParams.get('gallery')));
    const { rows } = await query("SELECT id,document_type,title,amount,currency,paid_at,billing_details,payments FROM gallery_documents WHERE gallery_id=$1 AND document_type='invoice' AND currency='NGN' ORDER BY created_at DESC", [gallery.id]);
    return NextResponse.json({ invoices: rows.map(doc => ({ ...doc, billing_details: { depositAmount: Number(doc.billing_details?.depositAmount || 0) }, payments: doc.payments?.map((p: { amount: number }) => ({ amount: p.amount })) })) }, { headers: privateHeaders });
  } catch (error) { return paymentFailure(error); }
}
export async function POST(req: NextRequest) {
  try {
    requirePaymentOrigin(req);
    const limited = await rateLimit(req, 'gallery-payment', 10, 900); if (limited) return limited;
    const body = await requestBody(req), gallery = await galleryAccess(req, body.galleryId);
    const id = body.invoiceId;
    if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0 || id > 2147483647 || !['deposit','balance'].includes(String(body.purpose))) throw new PaymentError('Choose a valid invoice and payment.', 400);
    const order = await payments.createInvoice(id, { galleryId: gallery.id }, body.purpose as 'deposit' | 'balance', paymentMode(paystackSecret()));
    const checkoutUrl = await initializeOrder(order, `/payments/invoice?reference=${encodeURIComponent(order.reference)}&invoice=${id}`);
    const response = NextResponse.json({ checkoutUrl, reference: order.reference, amount: Number(order.amount_kobo) / 100, currency: order.currency }, { headers: privateHeaders });
    response.cookies.set(`moyo-invoice-${id}`, `gallery:${gallery.id}`, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/api/payments/invoice', maxAge: 86400 });
    return response;
  } catch (error) { return paymentFailure(error); }
}
