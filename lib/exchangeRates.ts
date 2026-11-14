import { validateDisplayRates } from './regionalPricing.ts';
export async function exchangeRates() {
  const response = await fetch('https://open.er-api.com/v6/latest/NGN', {
    next: { revalidate: 86400 }, redirect: 'error', signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw Error('Rates unavailable');
  return validateDisplayRates(await response.json());
}
