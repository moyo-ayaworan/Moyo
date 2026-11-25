import { after, NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { hasGalleryCookie } from '@/lib/galleryAccess';
import { rateLimit } from '@/lib/rateLimit';
import { paystackSecret } from '@/lib/paystack';
import { PaymentError, paymentMode, validPortalToken, validReference } from '@/lib/payments/policy';
import { payments, requestBody, requirePaymentOrigin, initializeOrder, verifyOrder, paymentFailure, privateHeaders } from '@/lib/payments/server';
import { deliverPaymentNotifications } from '@/lib/payments/notifications';
export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
  try {
    requirePaymentOrigin(req);
    const limited = await rateLimit(req, 'invoice-payment', 15, 900); if (limited) return limited;
    const body = await requestBody(req), id = body.invoiceId, token = body.token;
    if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0 || id > 2147483647 || !validPortalToken(token)) throw new PaymentError('Invalid invoice or client link.', 400);
    if (body.action === 'verify') {
      const reference = String(body.reference || '');
      if (!validReference(reference)) throw new PaymentError('Invalid payment reference.', 400);
      await payments.transact(c => payments.invoiceForToken(c, id, token));
      const order = await payments.order(reference);
      if (!order || order.kind !== 'invoice' || order.document_id !== id) throw new PaymentError('Payment does not belong to this invoice.', 403);
      const saved = await verifyOrder(order);
      after(() => deliverPaymentNotifications());
      return NextResponse.json({ paid: saved.status === 'paid', status: saved.status }, { headers: privateHeaders });
    }
    if (!['deposit','balance'].includes(String(body.purpose))) throw new PaymentError('Choose deposit or remaining balance.', 400);
    const order = await payments.createInvoice(id, token, body.purpose as 'deposit' | 'balance', paymentMode(paystackSecret()));
    const checkoutUrl = await initializeOrder(order, `/payments/invoice?reference=${encodeURIComponent(order.reference)}&invoice=${id}`);
    // The portal token stays in a scoped HttpOnly cookie, never in the provider callback URL.
    const response = NextResponse.json({ checkoutUrl, reference: order.reference, amount: Number(order.amount_kobo) / 100, currency: order.currency }, { headers: privateHeaders });
    response.cookies.set(`moyo-invoice-${id}`, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/api/payments/invoice', maxAge: 86400 });
    return response;
  } catch (error) { return paymentFailure(error); }
}
export async function GET(req: NextRequest) {
  // Provider returns with reference only; possession of a reference never authorizes an invoice.
  const id = Number(req.nextUrl.searchParams.get('invoice'));
  const token = req.cookies.get(`moyo-invoice-${id}`)?.value;
  const reference = req.nextUrl.searchParams.get('reference');
  try {
    const limited = await rateLimit(req, 'invoice-return', 30, 900); if (limited) return limited;
    if (!Number.isSafeInteger(id) || id <= 0 || !token || !reference || !validReference(reference)) throw new PaymentError('Reopen your private client portal to check this payment.', 403);
    const galleryMatch = /^gallery:([1-9]\d*)$/.exec(token);
    let galleryCode = '';
    if (galleryMatch) {
      const gallery = (await query('SELECT id,access_code,is_locked FROM galleries WHERE id=$1', [Number(galleryMatch[1])])).rows[0];
      if (!gallery || gallery.is_locked || !hasGalleryCookie(req, gallery.id, gallery.access_code)) throw new PaymentError('Reopen your private gallery to check this payment.', 403);
      const doc = (await query('SELECT id FROM gallery_documents WHERE id=$1 AND gallery_id=$2', [id, gallery.id])).rows[0];
      if (!doc) throw new PaymentError('Invoice not found for this gallery.', 403);
      galleryCode = gallery.access_code;
    } else {
      if (!validPortalToken(token)) throw new PaymentError('Invalid client link.', 403);
      await payments.transact(c => payments.invoiceForToken(c, id, token));
    }
    const order = await payments.order(reference);
    if (!order || order.kind !== 'invoice' || order.document_id !== id) throw new PaymentError('Payment not found for this invoice.', 403);
    const saved = await verifyOrder(order);
    after(() => deliverPaymentNotifications());
    const booking = (await query('SELECT 1 FROM bookings WHERE manage_token=$1 AND portal_expires_at>NOW() AND portal_revoked_at IS NULL', [token])).rows[0];
    const portalUrl = galleryCode ? `/photography/client-gallery?code=${encodeURIComponent(galleryCode)}` : booking ? `/client/booking/${token}` : `/collector/${token}`;
    return NextResponse.json({ paid: saved.status === 'paid', status: saved.status, invoiceId: id, portalUrl }, { headers: privateHeaders });
  } catch (error) { return paymentFailure(error); }
}
