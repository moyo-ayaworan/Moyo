import type { PricingSnapshot } from '../pricingSnapshot.ts';
import { createHmac, timingSafeEqual } from 'node:crypto';

export type PaymentMode = 'live' | 'test';
export type PaymentOrder = {
  reference: string; mode: PaymentMode; kind: 'digital' | 'invoice'; target_id: number;
  email: string; amount_kobo: string | number; currency: string; status: string;
  shop_section?: 'photography' | 'art';
  metadata: Record<string, unknown>; provider_id?: string | null; title: string; delivery_url?: string;
  pricing?: PricingSnapshot | null;
  retry?: boolean;
  checkout_url?: string | null; document_id?: number | null; paid_at?: Date | null;
};
export class PaymentError extends Error {
  status: number;
  constructor(message: string, status = 409) { super(message); this.status = status; }
}
// Never extract digits from a foreign-currency or malformed price.
export function priceToKobo(value: string) {
  if (typeof value !== 'string' || value.length > 60) throw new PaymentError('Enter a valid NGN price.', 400);
  const text = value.trim().replace(/^(?:NGN\s*|₦\s*)/i, '');
  if (!/^(?:\d+|[1-9]\d{0,2}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(text)) throw new PaymentError('Enter a valid NGN price.', 400);
  const [whole, fraction = ''] = text.replaceAll(',', '').split('.');
  const minor = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, '0'));
  if (minor <= BigInt(0) || minor > BigInt(Number.MAX_SAFE_INTEGER)) throw new PaymentError('Enter a valid NGN price.', 400);
  return Number(minor);
}
export function paymentMode(secret: string | undefined): PaymentMode {
  if (secret?.startsWith('sk_live_')) return 'live';
  if (secret?.startsWith('sk_test_')) return 'test';
  throw new PaymentError('Secure checkout is not configured.', 503);
}
export function isPaymentEmail(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 254 || /[\s,;:<>()"\\]/.test(value)) return false;
  const pieces = value.split('@'); if (pieces.length !== 2) return false;
  const [local, domain] = pieces;
  return local.length > 0 && local.length <= 64 && !local.startsWith('.') && !local.endsWith('.') && !local.includes('..') &&
    /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local) && domain.includes('.') &&
    domain.split('.').every(label => label.length > 0 && label.length <= 63 && /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(label));
}
export function providerId(value: unknown) {
  return (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) ||
    (typeof value === 'string' && /^[1-9]\d{0,29}$/.test(value)) ? String(value) : null;
}
export function paymentMatches(payment: unknown, order: PaymentOrder) {
  if (!payment || typeof payment !== 'object') return false;
  const p = payment as Record<string, unknown>;
  let metadata = p.metadata;
  try { if (typeof metadata === 'string') metadata = JSON.parse(metadata); } catch { return false; }
  const m = metadata as Record<string, unknown> | null;
  const customer = p.customer as { email?: unknown } | undefined;
  return p.status === 'success' && p.reference === order.reference && p.domain === order.mode &&
    Number.isSafeInteger(p.amount) && p.amount === Number(order.amount_kobo) && p.currency === order.currency &&
    typeof customer?.email === 'string' && customer.email.trim().toLowerCase() === order.email.toLowerCase() &&
    !!providerId(p.id) && (!order.provider_id || order.provider_id === String(p.id)) &&
    !!m && typeof m === 'object' && Object.entries(order.metadata).every(([key, value]) => m[key] === value);
}
export function checkoutAddress(value: unknown) {
  if (typeof value !== 'string' || value.length > 1000) throw new PaymentError('Invalid checkout address.', 502);
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'checkout.paystack.com' || url.username || url.password || url.port ||
    url.search || url.hash || !/^\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)) throw new PaymentError('Invalid checkout address.', 502);
  return url.href;
}
export const validReference = (value: string) => /^(?:moyo-\d{1,12}|inv-\d{1,12})-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
export const validPortalToken = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{36,64}$/.test(value);
export function constantEqual(a: string, b: string) { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); }
export function accessProof(reference: string, email: string, expiry: number, secret: string) {
  return createHmac('sha256', secret).update(`purchase-recovery:v1:${reference}:${email.toLowerCase()}:${expiry}`).digest('hex');
}
export function validAccessProof(reference: string, email: string, token: string, secret: string, now = Date.now()) {
  const match = /^(\d{13})\.([a-f0-9]{64})$/.exec(token);
  return !!secret && !!match && Number(match[1]) > now && Number(match[1]) <= now + 31 * 86400000 &&
    constantEqual(match[2], accessProof(reference, email, Number(match[1]), secret));
}
