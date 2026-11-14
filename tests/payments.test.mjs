import test from 'node:test';
import { productShopPath, isProductSection } from '../lib/productSections.ts';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { priceToKobo, isPaymentEmail, paymentMatches, checkoutAddress, paymentMode, validReference, accessProof, validAccessProof } from '../lib/payments/policy.ts';
const order = { reference: `moyo-1-${randomUUID()}`, mode: 'live', kind: 'digital', target_id: 1, email: 'buyer@example.test', amount_kobo: '2000000', currency: 'NGN', status: 'pending', metadata: { product_id: 1, payment_kind: 'digital' }, title: 'MELATONE' };
const payment = { reference: order.reference, status: 'success', domain: 'live', amount: 2000000, currency: 'NGN', id: 123, customer: { email: order.email }, metadata: order.metadata };
test('prices preserve exact kobo and reject foreign currency, signs, mixed digits, bad grouping and overflow', () => {
  for (const [price, minor] of [['₦20,000', 2000000], ['NGN 15000.05', 1500005], ['0.01', 1], ['20000', 2000000]]) assert.equal(priceToKobo(price), minor);
  for (const value of ['$20', 'USD 20', '-20000', '+20000', '20,00', '20.001', '20e3', '20 / 30', '', '0', 'NaN', '9007199254740991', '20.000', '₦₦20', '100 NGN', '20000 discount 50']) assert.throws(() => priceToKobo(value), value);
});
test('fulfilment binds the exact amount, currency, buyer, mode, reference, metadata and provider ID', () => {
  assert(paymentMatches(payment, order));
  assert(paymentMatches({ ...payment, metadata: JSON.stringify(payment.metadata), customer: { email: 'BUYER@example.test' } }, order));
  for (const patch of [{ amount: 20000 }, { amount: '2000000' }, { currency: 'USD' }, { status: 'pending' }, { domain: 'test' }, { reference: 'other' }, { customer: { email: 'attacker@example.test' } }, { metadata: { product_id: 2, payment_kind: 'digital' } }, { metadata: { product_id: 1 } }, { id: 0 }, { id: -1 }, { id: '0' }]) assert.equal(paymentMatches({ ...payment, ...patch }, order), false, JSON.stringify(patch));
  assert.equal(paymentMatches(payment, { ...order, provider_id: '456' }), false);
});
test('checkout redirects cannot send customers outside the HTTPS Paystack checkout', () => {
  assert.equal(checkoutAddress('https://checkout.paystack.com/abc123'), 'https://checkout.paystack.com/abc123');
  for (const value of ['http://checkout.paystack.com/abc', 'https://checkout.paystack.com.evil.test/abc', 'https://evil.test/abc', 'https://checkout.paystack.com@evil.test/abc', 'https://checkout.paystack.com/abc?redirect=evil', 'https://checkout.paystack.com/abc#x', 'javascript:alert(1)']) assert.throws(() => checkoutAddress(value));
  assert(validReference(order.reference)); assert(!validReference(order.reference.replace('moyo-1-', 'moyo-1/')));
});
test('recovery proof expires and cannot transfer access to another order or email', () => {
  const now = Date.now(), expiry = now + 86400000, secret = 'fixture-only';
  const token = `${expiry}.${accessProof(order.reference, order.email, expiry, secret)}`;
  assert(validAccessProof(order.reference, order.email, token, secret, now));
  assert(!validAccessProof(order.reference, 'attacker@example.test', token, secret, now));
  assert(!validAccessProof('other', order.email, token, secret, now));
  assert(!validAccessProof(order.reference, order.email, token, secret, expiry));
  assert(!validAccessProof(order.reference, order.email, token, 'wrong', now));
});
test('test and live configuration cannot silently cross environments', () => {
  assert.equal(paymentMode('sk_live_fixture'), 'live'); assert.equal(paymentMode('sk_test_fixture'), 'test'); assert.throws(() => paymentMode('whsec_fixture')); assert.throws(() => paymentMode(undefined));
});

test('photography and fine-art purchases have separate shop and return routes', () => {
  assert.equal(productShopPath('photography'), '/photography/shop');
  assert.equal(productShopPath('art'), '/art/shop');
  assert(isProductSection('photography')); assert(isProductSection('art')); assert(!isProductSection('all'));
});

test('receipt addresses reject comments, display names and extra recipients', () => {
  assert(isPaymentEmail('buyer+shop@example.test'));
  for (const email of ['buyer@example.test,evil@example.test', 'buyer,evil@example.test', 'Buyer <buyer@example.test>', 'buyer(comment)@example.test', 'buyer@example.test\r\nBcc:evil@example.test', 'a..b@example.test']) assert(!isPaymentEmail(email));
});
