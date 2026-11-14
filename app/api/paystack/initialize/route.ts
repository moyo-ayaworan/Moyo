import { isProductSection, productShopPath } from '@/lib/productSections';
import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rateLimit';
import { setPurchaseCookie } from '@/lib/purchaseAccess';
import { paystackSecret, PaymentReferenceMissing } from '@/lib/paystack';
import { PaymentError, isPaymentEmail, paymentMode } from '@/lib/payments/policy';
import { payments, requestBody, requirePaymentOrigin, initializeOrder, paymentFailure, privateHeaders, verifyOrder } from '@/lib/payments/server';
export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
  try {
    requirePaymentOrigin(req);
    const limited = await rateLimit(req, 'checkout-initialize', 10, 900); if (limited) return limited;
    const mode = paymentMode(paystackSecret()), body = await requestBody(req);
    const productId = body.productId, email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (typeof productId !== 'number' || !Number.isSafeInteger(productId) || productId <= 0 || productId > 2147483647 || !isPaymentEmail(email)) throw new PaymentError('Enter a valid product and email address.', 400);
    const section = body.section ?? 'photography';
    if (!isProductSection(section)) throw new PaymentError('Choose a valid product collection.', 400);
    const key = body.requestKey || randomUUID();
    if (typeof key !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(key)) throw new PaymentError('Invalid checkout request.', 400);
    const order = await payments.createDigital(productId, email, mode, key, section, req.headers.get('x-vercel-ip-country') || '');
    // Reconcile retries before attempting to initialize the same reference again.
    let current = order;
    if (order.retry) {
      try { current = await verifyOrder(order); }
      catch (error) { if (!(error instanceof PaymentReferenceMissing) || order.status === 'paid') throw error; }
    }
    const paymentPath = `${productShopPath(order.shop_section || 'photography')}/payment?reference=${encodeURIComponent(order.reference)}`;
    if (current.status === 'paid') {
      const response = NextResponse.json({ paymentPath }, { headers: privateHeaders });
      setPurchaseCookie(response, order.reference);
      return response;
    }
    let checkoutUrl: string;
    try { checkoutUrl = await initializeOrder(order, `${productShopPath(order.shop_section || 'photography')}/payment?reference=${encodeURIComponent(order.reference)}`); }
    catch (error) {
      const failure = paymentFailure(error);
      const response = NextResponse.json({ error: 'Checkout could not be resumed yet. Retry with the same email, or check the original payment. If this continues, contact the studio with the reference.', reference: order.reference, paymentPath }, { status: failure.status, headers: privateHeaders });
      setPurchaseCookie(response, order.reference);
      return response;
    }
    const response = NextResponse.json({ checkoutUrl, reference: order.reference, amount: Number(order.amount_kobo) / 100, currency: order.currency }, { headers: privateHeaders });
    setPurchaseCookie(response, order.reference);
    return response;
  } catch (error) { return paymentFailure(error); }
}
