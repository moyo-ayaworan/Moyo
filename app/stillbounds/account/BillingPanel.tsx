'use client';
import { RegionalPrice, RegionalCharge, CurrencySelector, useCheckoutPricing } from '@/components/RegionalPricing';
import ResumeCheckout from '@/components/ResumeCheckout';
import { parseSavedCheckoutQuote, type SavedCheckoutQuote } from '@/lib/pricingSnapshot';
import { useCallback, useEffect, useState } from 'react';
import styles from './account.module.css';
type Access = { price: { amount: number; currency: string }; enabled: boolean; environment: 'test' | 'live'; access: string; trialEndsAt: number | null; checkoutAvailable: boolean; devices: { id: string; name: string; activatedAt: number; lastSeenAt: number }[] };
async function billing(action: string, body?: object) {
  const r = await fetch('/api/stillbounds/billing/' + action, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  const d = await r.json();
  if (!r.ok) throw Error(d.error || 'Your licence could not be checked.');
  return d;
}
export default function BillingPanel() {
  const [access, setAccess] = useState<Access | null>(null), [message, setMessage] = useState(''), [busy, setBusy] = useState(true);
  const [resumeQuote, setResumeQuote] = useState<SavedCheckoutQuote | null>(null);
  const pricing = useCheckoutPricing(access?.price.amount || 0, true);
  const refresh = useCallback(async () => { setAccess(await billing('status')); setMessage(''); }, []);
  useEffect(() => {
    const reference = new URLSearchParams(location.search).get('purchase_reference');
    const result = reference && /^sb-(test|live)-[a-f0-9-]{36}$/.test(reference) ? billing('verify', { reference }) : billing('status');
    result.then(data => { setAccess(data); if (reference) setMessage('Payment verified. Return to Stillbounds and choose Check access.'); }).catch(e => setMessage(e.message)).finally(() => setBusy(false));
  }, []);
  async function run(fn: () => Promise<void>) { setBusy(true); setMessage(''); try { await fn(); } catch (e) { setMessage(e instanceof Error ? e.message : 'Please try again.'); } finally { setBusy(false); } }
  async function checkout(saved?: SavedCheckoutQuote) {
    const result = await billing('checkout', { displayCurrency: pricing.currency, expectedAmount: pricing.quote?.amountMinor, resumeReference: saved?.reference, resumeAmount: saved?.amountMinor });
    if (result.confirmationRequired) {
      const quote = parseSavedCheckoutQuote(result.resumeQuote);
      if (!quote) throw Error('The saved checkout could not be verified. Please contact support.');
      setResumeQuote(quote); return;
    }
    const url = new URL(result.checkoutUrl);
    if (url.protocol !== 'https:' || url.hostname !== 'checkout.paystack.com' || url.username || url.password || url.port || url.search || url.hash || !/^\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)) throw Error('Invalid checkout address.');
    location.assign(url.href);
  }
  return <section aria-labelledby="licence-heading"><h2 id="licence-heading">Your licence &amp; laptops</h2>{access ? <>
    <p>{access.environment === 'test' ? 'Test mode · no real purchase. ' : ''}{access.access === 'creator' ? 'Creator access · no purchase required.' : access.access === 'paid' ? 'One-time purchase active.' : access.access === 'trial' ? `Free trial ends ${new Date(access.trialEndsAt!).toLocaleDateString()}.` : access.access === 'expired' ? 'Your free trial has ended. Existing books remain available to view.' : access.access === 'blocked' ? 'Please contact support about your licence. Do not pay again.' : 'Your 30-day free trial starts when you first activate the app.'}</p>
    <CurrencySelector/><p><RegionalPrice value={access.price.amount} adjusted/> once after your trial. No automatic charge. Up to two activated laptops.</p>
    {!['paid', 'creator', 'blocked'].includes(access.access) && (resumeQuote ? <ResumeCheckout quote={resumeQuote} busy={busy} onResume={() => void run(() => checkout(resumeQuote))}/> : <button disabled={busy || !access.checkoutAvailable || !pricing.ready} onClick={() => void run(() => checkout())}>{access.checkoutAvailable ? <>Buy Stillbounds · <RegionalPrice value={access.price.amount} adjusted/></> : 'Checkout is not open yet'}</button>)}
    <p>Paystack will charge <RegionalCharge value={access.price.amount} adjusted/> NGN for the current offer. Your bank may apply conversion fees.</p>
    <p>Activation sends a hashed device identifier, public activation key and laptop name. Registration does not upload photographs, face analysis or book files.</p>
    <ul>{access.devices.map(d => <li key={d.id}>{d.name} <button className={styles.secondary} disabled={busy} onClick={() => void run(async () => { setAccess(await billing('deactivate', { activationId: d.id })); setMessage('Laptop deactivated. An offline laptop may retain access until its signed activation expires or it reconnects.'); })}>Deactivate laptop</button></li>)}</ul>
    <p>{access.devices.length} of 2 laptop slots in use. A paid offline activation lasts up to 90 days, with a seven-day service-outage grace period. Refreshing activation does not charge you again.</p>
  </> : <p>Preparing your access details…</p>}
    <button className={styles.secondary} disabled={busy} onClick={() => void run(refresh)}>Check licence status</button><p role="status" aria-live="polite">{message}</p>
  </section>;
}
