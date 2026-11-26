import { validateCheckoutInput, normalizeCouponCode } from '@/lib/checkoutInput';
import { savedCheckoutQuote } from '@/lib/pricingSnapshot';
import { isDisplayCurrency } from '@/lib/regionalPricing';
import { isProductSection, productShopPath } from '@/lib/productSections';
import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rateLimit';
import { setPurchaseCookie } from '@/lib/purchaseAccess';
import { paystackSecret, PaymentReferenceMissing } from '@/lib/paystack';
import { PaymentError, isPaymentEmail, paymentMode, validReference } from '@/lib/payments/policy';
import { payments, requestBody, requirePaymentOrigin, initializeOrder, paymentFailure, privateHeaders, verifyOrder } from '@/lib/payments/server';
export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
  try {
    requirePaymentOrigin(req);
    const body=await requestBody(req);validateCheckoutInput(body);
    const limited = await rateLimit(req, 'checkout-initialize', 10, 900); if (limited) return limited;
    const mode = paymentMode(paystackSecret());
    const productId = body.productId, email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (typeof productId !== 'number' || !Number.isSafeInteger(productId) || productId <= 0 || productId > 2147483647 || !isPaymentEmail(email)) throw new PaymentError('Enter a valid product and email address.', 400);
    const section = body.section ?? 'photography';
    if (!isProductSection(section)) throw new PaymentError('Choose a valid product collection.', 400);
    const displayCurrency = body.displayCurrency ?? 'NGN';
    if (!isDisplayCurrency(displayCurrency)) throw new PaymentError('Choose a valid currency.', 400);
    const key = body.requestKey || randomUUID();
    if (typeof key !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(key)) throw new PaymentError('Invalid checkout request.', 400);
    const order = await payments.createDigital(productId, email, mode, key, section, req.headers.get('x-vercel-ip-country') || '', displayCurrency, typeof body.expectedAmount === 'number' ? body.expectedAmount : undefined, normalizeCouponCode(body.couponCode), ('quantity' in body||'shippingRateId' in body||'shippingDetails' in body)?{quantity:body.quantity as number,shippingRateId:body.shippingRateId,shippingDetails:body.shippingDetails}:undefined);
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
    if (order.retry && typeof body.expectedAmount === 'number' && body.expectedAmount !== Number(order.amount_kobo) &&
      !(body.resumeReference === order.reference && body.resumeAmount === Number(order.amount_kobo))) {
      const response = NextResponse.json({ confirmationRequired: true, resumeQuote: savedCheckoutQuote(order.reference, Number(order.amount_kobo)), paymentPath }, { headers: privateHeaders });
      setPurchaseCookie(response, order.reference);
      return response;
    }
    let checkoutUrl: string;
    try { checkoutUrl = await initializeOrder(order, `${productShopPath(order.shop_section || 'photography')}/payment?reference=${encodeURIComponent(order.reference)}`); }
    catch (error) {
      const failure = await paymentFailure(error);
      const response = NextResponse.json({ error: 'Checkout could not be resumed yet. Retry with the same email, or check the original payment. If this continues, contact the studio with the reference.', reference: order.reference, paymentPath }, { status: failure.status, headers: privateHeaders });
      setPurchaseCookie(response, order.reference);
      return response;
    }
    const response = NextResponse.json({ checkoutUrl, reference: order.reference, amount: Number(order.amount_kobo) / 100, currency: order.currency }, { headers: privateHeaders });
    setPurchaseCookie(response, order.reference);
    return response;
  } catch (error) { if(error instanceof PaymentError&&error.code==='checkout_expired'&&error.reference&&validReference(error.reference)){const response=NextResponse.json({error:error.message,restartRequired:true,paymentPath:`/photography/shop/payment?reference=${encodeURIComponent(error.reference)}`},{status:409,headers:privateHeaders});setPurchaseCookie(response,error.reference);return response;}return paymentFailure(error); }
}
