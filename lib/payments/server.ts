import { NextRequest, NextResponse } from 'next/server';
import { transaction } from '../db';
import { paystackRequest, paystackSecret, paymentOrigin, verifyPaystackTransaction } from '../paystack';
import { parseAuthenticatedAsset } from '../privateMedia';
import { PaymentStore } from './store';
import { PaymentError, checkoutAddress, paymentMode, type PaymentOrder } from './policy';

export const payments = new PaymentStore(transaction);
export const privateHeaders = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' };
export async function boundedText(req: Request, limit = 65536) {
  const reader = req.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = []; let size = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length;
    if (size > limit) { await reader.cancel(); throw new PaymentError('Request is too large.', 413); } chunks.push(value); }
  return Buffer.concat(chunks).toString('utf8');
}
export async function requestBody(req: Request) {
  try { const body = JSON.parse(await boundedText(req, 8192)); if (!body || typeof body !== 'object' || Array.isArray(body)) throw Error(); return body as Record<string, unknown>; }
  catch (error) { if (error instanceof PaymentError) throw error; throw new PaymentError('Invalid payment request.', 400); }
}
export function requirePaymentOrigin(req: NextRequest) {
  const origin = req.headers.get('origin');
  if (origin !== paymentOrigin()) throw new PaymentError('Open checkout from the website.', 403);
}
export async function paymentFailure(error: unknown) {
  if (!(error instanceof PaymentError) || error.status >= 500) {
    try { const { recordOperationalFailure } = await import('../operations'); await recordOperationalFailure('payment_error'); }
    catch { console.error(JSON.stringify({ event: 'payment_error' })); }
  }
  // Never return provider payloads, database errors or secrets to the browser.
  return NextResponse.json({ error: error instanceof PaymentError ? error.message : 'Unable to process payment. Please retry or contact the studio.' }, { status: error instanceof PaymentError ? error.status : 503, headers: privateHeaders });
}
export async function initializeOrder(order: PaymentOrder, callback: string) {
  // Serialize initialization, including requests that arrive after a browser timeout.
  // A retry always uses the original provider reference, never a second payable order.
  return payments.transact(async c => {
    await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['initialize:' + order.reference]);
    const current = (await c.query<PaymentOrder>('SELECT * FROM payment_orders WHERE reference=$1', [order.reference])).rows[0];
    if (!current || !['pending', 'failed'].includes(current.status)) throw new PaymentError('Check the original payment before paying again.');
    if (current.checkout_url) return checkoutAddress(current.checkout_url);
    if (process.env.VERCEL_ENV === 'production' && !process.env.PAYSTACK_WEBHOOK_SECRET) throw new PaymentError('Payments are awaiting webhook configuration. Please contact the studio.', 503);
    if (current.kind === 'digital' && !parseAuthenticatedAsset(current.delivery_url || '')) throw new PaymentError('This delivery file needs private storage.', 503);
    const result = await paystackRequest('/transaction/initialize', {
      email: current.email, amount: Number(current.amount_kobo), currency: current.currency, reference: current.reference,
      callback_url: `${paymentOrigin()}${callback}`, metadata: current.metadata,
    });
    if (result.reference !== current.reference) throw new PaymentError('Payment reference mismatch.', 502);
    const url = checkoutAddress(result.authorization_url);
    await c.query("UPDATE payment_orders SET checkout_url=$2,status='pending',updated_at=NOW() WHERE reference=$1 AND status IN ('pending','failed')", [current.reference, url]);
    return url;
  });
}

export async function verifyOrder(order: PaymentOrder, recheckPaid = false) {
  if (order.mode !== paymentMode(paystackSecret())) throw new PaymentError('This checkout belongs to another payment environment.', 409);
  if (['refunded','disputed','review'].includes(order.status)) return order;
  if (order.status === 'paid' && !recheckPaid) return order;
  const payment = await verifyPaystackTransaction(order.reference);
  if (payment.status !== 'success') {
    if (order.status === 'paid') return (await payments.review(order.reference, 'provider-status-changed')) || order;
    return order;
  }
  return payments.fulfill(order.reference, payment);
}

export async function verifyGallerySettlement(galleryId: number) {
  const outstanding = await payments.transact(async c => (await c.query(`SELECT id FROM gallery_documents d WHERE d.gallery_id=$1 AND d.document_type='invoice' AND d.amount >
    CASE WHEN jsonb_array_length(d.payments)>0 THEN (SELECT COALESCE(SUM((p->>'amount')::numeric),0) FROM jsonb_array_elements(d.payments) p)
    WHEN d.paid_at IS NOT NULL THEN d.amount ELSE 0 END LIMIT 1`, [galleryId])).rows[0]);
  if (outstanding) return false;
  const orders = await payments.transact(async c => (await c.query<PaymentOrder>(`SELECT o.* FROM payment_orders o JOIN gallery_documents d ON d.id=o.document_id
    WHERE d.gallery_id=$1 AND o.status IN ('paid','review','refunded','disputed') ORDER BY o.created_at LIMIT 21`, [galleryId])).rows);
  if (orders.length > 20 || orders.some(order => order.status !== 'paid')) return false;
  for (const order of orders) if ((await verifyOrder(order, true)).status !== 'paid') return false;
  return true;
}
