export const displayCurrencies = ['NGN','USD','GBP','EUR','CAD','AUD','GHS','KES','ZAR','AED','INR','CNY','JPY','CHF','NZD','SGD','XOF'] as const;
export type DisplayCurrency = typeof displayCurrencies[number];
export function isDisplayCurrency(value: unknown): value is DisplayCurrency {
  return typeof value === 'string' && (displayCurrencies as readonly string[]).includes(value);
}
const countryCurrencies: Record<string, DisplayCurrency> = {
  NG:'NGN',US:'USD',GB:'GBP',CA:'CAD',AU:'AUD',GH:'GHS',KE:'KES',ZA:'ZAR',AE:'AED',IN:'INR',CN:'CNY',JP:'JPY',CH:'CHF',LI:'CHF',NZ:'NZD',SG:'SGD',
  AT:'EUR',BE:'EUR',HR:'EUR',CY:'EUR',EE:'EUR',FI:'EUR',FR:'EUR',DE:'EUR',GR:'EUR',IE:'EUR',IT:'EUR',LV:'EUR',LT:'EUR',LU:'EUR',MT:'EUR',NL:'EUR',PT:'EUR',SK:'EUR',SI:'EUR',ES:'EUR',BG:'EUR',
  BJ:'XOF',BF:'XOF',CI:'XOF',GW:'XOF',ML:'XOF',NE:'XOF',SN:'XOF',TG:'XOF',
};
export function currencyForCountry(country: unknown): DisplayCurrency {
  if (typeof country !== 'string' || !/^[A-Z]{2}$/.test(country)) return 'NGN';
  return countryCurrencies[country] || 'USD';
}
export function nairaAmount(value: string | number): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
  const text = value.trim().replace(/^(?:NGN|₦)\s*/i, '');
  if (!/^(?:\d+|[1-9]\d{0,2}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(text)) return null;
  const amount = Number(text.replaceAll(',', ''));
  return Number.isFinite(amount) && amount <= Number.MAX_SAFE_INTEGER / 100 ? amount : null;
}
export function validateDisplayRates(input: unknown, now = Date.now()) {
  if (!input || typeof input !== 'object') throw Error('Invalid exchange rates');
  const data = input as Record<string, unknown>;
  const asOf = Number(data.time_last_update_unix) * 1000;
  if (data.result !== 'success' || data.base_code !== 'NGN' || !Number.isFinite(asOf) || asOf > now + 300000 || now - asOf > 3 * 86400000) throw Error('Exchange rates unavailable or stale');
  const raw = data.rates as Record<string, unknown> | undefined;
  if (!raw || raw.NGN !== 1) throw Error('Invalid base rate');
  const rates: Partial<Record<DisplayCurrency, number>> = { NGN: 1 };
  for (const code of displayCurrencies) {
    const rate = raw[code];
    if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0 && rate < 1000000) rates[code] = rate;
  }
  return { rates, asOf };
}
export function displayPrice(value: string | number, currency: DisplayCurrency, rates: Partial<Record<DisplayCurrency, number>>) {
  const amount = nairaAmount(value), rate = currency === 'NGN' ? 1 : rates[currency];
  if (amount === null) return { text: String(value), converted: false };
  const converted = currency !== 'NGN' && typeof rate === 'number' && Number.isFinite(rate) && rate > 0;
  const code = converted ? currency : 'NGN';
  return { text: new Intl.NumberFormat('en-NG', { style: 'currency', currency: code, currencyDisplay: code === 'NGN' ? 'symbol' : 'code', maximumFractionDigits: code === 'JPY' ? 0 : 2 }).format(amount * (converted ? rate! : 1)), converted };
}

// Geographic selling-price tier, independent of the selected display currency.
const premiumCountries = new Set('US AL AD AT BY BE BA BG HR CY CZ DK EE FI FR DE GR HU IS IE IT XK LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SE CH TR UA GB VA AX FO GG GI IM JE SJ'.split(' '));
export function regionalMultiplier(country: unknown): 1 | 2 {
  return typeof country === 'string' && premiumCountries.has(country) ? 2 : 1;
}
export function regionalAmount(value: string | number, multiplier: 1 | 2) {
  const amount = nairaAmount(value);
  return amount === null ? value : amount * multiplier;
}

// Keep NGN prices unchanged. USD/EUR round the base selling price up to 10,
// then apply the geographic tier. Paystack receives its exact NGN equivalent.
export function checkoutQuote(baseMinor: number, multiplier: 1 | 2, currency: string, rates: Partial<Record<DisplayCurrency, number>>) {
  if (!Number.isSafeInteger(baseMinor) || baseMinor <= 0) throw Error('Invalid price');
  let amountMinor = baseMinor * multiplier;
  let dollars: number | null = null, roundedAmount: number | null = null;
  const roundedCurrency = isRoundedCurrency(currency) ? currency : null;
  if (roundedCurrency) {
    const rate = rates[roundedCurrency];
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) throw Error('Rounded pricing unavailable');
    roundedAmount = Math.ceil((baseMinor / 100 * rate - 1e-9) / 10) * 10 * multiplier;
    dollars = currency === 'USD' ? roundedAmount : null;
    amountMinor = Math.ceil(roundedAmount / rate * 100);
  }
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || (roundedAmount !== null && !Number.isSafeInteger(roundedAmount))) throw Error('Invalid price');
  return { amountMinor, dollars, roundedAmount, roundedCurrency };
}

export function isRoundedCurrency(currency: string): currency is 'USD' | 'EUR' { return currency === 'USD' || currency === 'EUR'; }
