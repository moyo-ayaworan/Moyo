import { NextRequest, NextResponse } from 'next/server';
import { currencyForCountry, validateDisplayRates } from '@/lib/regionalPricing';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  // Country changes presentation only; payment amounts remain server-owned NGN.
  const country = req.headers.get('x-vercel-ip-country') || '';
  const currency = currencyForCountry(country);
  try {
    const response = await fetch('https://open.er-api.com/v6/latest/NGN', {
      next: { revalidate: 86400 }, redirect: 'error', signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw Error('Rates unavailable');
    const data = validateDisplayRates(await response.json());
    return NextResponse.json({ currency, ...data }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ currency, rates: { NGN: 1 }, asOf: null }, { headers: { 'Cache-Control': 'private, no-store' } });
  }
}
