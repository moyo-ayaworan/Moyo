'use client';
import { createContext, useContext, useEffect, useId, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getStorageItem, setStorageItem } from '@/lib/browserStorage';
import { displayCurrencies, displayPrice, isDisplayCurrency, regionalAmount, type DisplayCurrency } from '@/lib/regionalPricing';

type Pricing = { failed: boolean; multiplier: 1 | 2; currency: DisplayCurrency; rates: Partial<Record<DisplayCurrency, number>>; asOf: number | null; loaded: boolean };
const initial: Pricing = { failed: false, multiplier: 1, currency: 'NGN', rates: { NGN: 1 }, asOf: null, loaded: false };
const PricingContext = createContext<Pricing & { choose: (currency: DisplayCurrency) => void }>({ ...initial, choose: () => {} });
const preferenceKey = 'moyo-display-currency';
export function RegionalPricingProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const enabled = pathname === '/photography' || pathname === '/art' || /^\/(?:stillbounds|mofolio)(?:\/|$)/.test(pathname) || /^(?:\/photography|\/art)\/shop(?:\/|$)/.test(pathname);
  const [pricing, setPricing] = useState(initial);
  const preference = useRef<DisplayCurrency | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const stored = getStorageItem('local', preferenceKey);
    preference.current = isDisplayCurrency(stored) ? stored : null;
    const controller = new AbortController();
    fetch('/api/regional-pricing', { cache: 'no-store', signal: controller.signal }).then(async response => {
      if (!response.ok) throw Error('Pricing unavailable');
      const data = await response.json();
      if (controller.signal.aborted) return;
      const rates: Pricing['rates'] = { NGN: 1 };
      for (const code of displayCurrencies) if (typeof data.rates?.[code] === 'number' && Number.isFinite(data.rates[code]) && data.rates[code] > 0) rates[code] = data.rates[code];
      setPricing({ failed: false, multiplier: data.multiplier === 2 ? 2 : 1, currency: preference.current || (isDisplayCurrency(data.currency) ? data.currency : 'NGN'), rates, asOf: typeof data.asOf === 'number' ? data.asOf : null, loaded: true });
    }).catch(() => { if (!controller.signal.aborted) setPricing({ ...initial, currency: preference.current || 'NGN', loaded: false, failed: true }); });
    return () => controller.abort();
  }, [enabled]);
  const choose = (currency: DisplayCurrency) => {
    preference.current = currency;
    setStorageItem('local', preferenceKey, currency);
    setPricing(current => ({ ...current, currency }));
  };
  return <PricingContext.Provider value={{ ...pricing, choose }}>{children}</PricingContext.Provider>;
}
export function RegionalPrice({ value }: { value: string | number }) {
  const { currency, rates, multiplier, loaded, failed } = useContext(PricingContext);
  const price = displayPrice(regionalAmount(value, multiplier), currency, rates);
  if (!loaded) return <span>{failed ? 'Price unavailable' : 'Checking price…'}</span>;
  return <span>{price.converted ? '≈ ' : ''}{price.text}</span>;
}
export function CurrencySelector() {
  const { currency, rates, asOf, loaded, failed, choose } = useContext(PricingContext);
  const id = useId();
  return <div className="my-5 grid min-w-0 gap-2 text-xs text-foreground/65">
    <label htmlFor={id} className="flex flex-wrap items-center gap-3">Display currency
      <select id={id} value={currency} onChange={event => { if (isDisplayCurrency(event.target.value)) choose(event.target.value); }} className="min-h-11 max-w-full border border-foreground/25 bg-background px-3 text-sm text-foreground">
        {displayCurrencies.map(code => <option key={code} value={code}>{code}</option>)}
      </select>
    </label>
    {failed && <p role="status">Pricing could not be loaded. Refresh this page before starting checkout.</p>}
    <p>Checkout is charged in NGN. Converted prices are estimates; your bank sets the final exchange rate and any fees.</p>
    {loaded && currency !== 'NGN' && !rates[currency] && <p role="status">Conversion unavailable for {currency}. Prices are shown in NGN.</p>}
    {asOf !== null && <p className="text-[10px]">Rates updated {new Date(asOf).toISOString().slice(0,10)} · <a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer" className="underline underline-offset-2">Rates by ExchangeRate-API</a></p>}
  </div>;
}

export function RegionalCharge({ value }: { value: string | number }) {
  const { multiplier, loaded } = useContext(PricingContext);
  if (!loaded) return <span>the confirmed checkout price</span>;
  return <span>{displayPrice(regionalAmount(value, multiplier), 'NGN', {}).text}</span>;
}

export function useRegionalPricingReady() { return useContext(PricingContext).loaded; }
