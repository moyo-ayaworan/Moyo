import { PaymentError, paymentMode } from './payments/policy.ts';
export { priceToKobo } from './payments/policy.ts';

export function paystackSecret() {
  const secret = process.env.PAYSTACK_SECRET_KEY || '';
  const mode = paymentMode(secret);
  if (process.env.VERCEL_ENV === 'production' && mode !== 'live') throw new PaymentError('Live payment credentials are required.', 503);
  return secret;
}
export class PaymentReferenceMissing extends PaymentError {}
export async function paystackRequest(path: string, body?: object, secret = paystackSecret()) {
  const response = await fetch(`https://api.paystack.co${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${secret}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000),
  });
  const result = await response.json().catch(() => null);
  if (path.startsWith('/transaction/verify/') && [400, 404].includes(response.status) && result?.message === 'Transaction reference not found') throw new PaymentReferenceMissing('Payment reference not found.', 404);
  if (!response.ok || result?.status !== true || !result.data || typeof result.data !== 'object') throw new PaymentError('Payment service is temporarily unavailable. Please retry.', 502);
  return result.data as Record<string, unknown>;
}
export async function verifyPaystackTransaction(reference: string) {
  return paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`);
}
export function paymentOrigin() {
  const origin = new URL(process.env.PAYMENT_ORIGIN || process.env.STILLBOUNDS_BILLING_ORIGIN || 'https://moyo-roan.vercel.app');
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new PaymentError('Invalid payment origin.', 503);
  return origin.origin;
}
