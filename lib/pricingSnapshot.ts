import { checkoutQuote, regionalMultiplier, type DisplayCurrency } from './regionalPricing.ts';

export type PricingSnapshot = {
  version: 2; baseAmountMinor: number; country: string | null; multiplier: 1 | 2;
  displayCurrency: DisplayCurrency; sellingAmount: number | null; exchangeRate: number | null;
  rateAsOf: number | null; quotedAt: number; amountMinor: number; currency: 'NGN';
};
export function pricingSnapshot(baseAmountMinor: number, country: string, displayCurrency: DisplayCurrency,
  rates: Partial<Record<DisplayCurrency, number>>, rateAsOf: number | null, now = Date.now()): PricingSnapshot {
  const multiplier = regionalMultiplier(country), quote = checkoutQuote(baseAmountMinor, multiplier, displayCurrency, rates);
  const rate = displayCurrency === 'NGN' ? 1 : rates[displayCurrency] ?? null;
  return { version: 2, baseAmountMinor, country: /^[A-Z]{2}$/.test(country) ? country : null, multiplier,
    displayCurrency, sellingAmount: quote.roundedAmount ?? (rate ? baseAmountMinor / 100 * multiplier * rate : null),
    exchangeRate: rate, rateAsOf: displayCurrency === 'NGN' ? null : rateAsOf, quotedAt: now,
    amountMinor: quote.amountMinor, currency: 'NGN' };
}
export type SavedCheckoutQuote = { reference: string; amountMinor: number; currency: 'NGN' };
export function savedCheckoutQuote(reference: string, amountMinor: number): SavedCheckoutQuote {
  return { reference, amountMinor, currency: 'NGN' };
}
export function parseSavedCheckoutQuote(input: unknown): SavedCheckoutQuote | null {
  if (!input || typeof input !== 'object') return null;
  const q = input as Record<string, unknown>;
  return typeof q.reference === 'string' && /^[a-z0-9-]{5,100}$/.test(q.reference) &&
    typeof q.amountMinor === 'number' && Number.isSafeInteger(q.amountMinor) && q.amountMinor > 0 && q.currency === 'NGN'
    ? savedCheckoutQuote(q.reference, q.amountMinor) : null;
}
