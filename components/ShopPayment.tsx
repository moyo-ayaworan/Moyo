'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { productShopPath, type ProductSection } from '@/lib/productSections';
import Footer from '@/components/Footer';
export default function ShopPayment({ section }: { section: ProductSection }) {
  const [physical,setPhysical]=useState(false),[fulfillment,setFulfillment]=useState(''),[tracking,setTracking]=useState('');
  const [state, setState] = useState('checking'), [downloadUrl, setDownloadUrl] = useState(''), [error, setError] = useState('');
  const [email, setEmail] = useState(''), [recoveryMessage, setRecoveryMessage] = useState(''), [sending, setSending] = useState(false);
  useEffect(() => {
    let stopped = false, timer: ReturnType<typeof setTimeout>; let attempts = 0;
    const reference = new URLSearchParams(window.location.search).get('reference') || '';
    const access = new URLSearchParams(window.location.hash.slice(1)).get('access');
    if (access) window.history.replaceState(null, '', window.location.pathname + window.location.search);
    const check = async () => {
      try {
        const response = await fetch(`/api/paystack/verify?reference=${encodeURIComponent(reference)}`, { cache: 'no-store' });
        const result = await response.json(); if (!response.ok) throw Error(result.error || 'Could not verify payment.');
        if (stopped) return;
        if (result.shopSection && result.shopSection !== section && ['art','photography'].includes(result.shopSection)) { window.location.replace(`${productShopPath(result.shopSection)}/payment?reference=${encodeURIComponent(reference)}`); return; }
        setPhysical(result.fulfillmentKind==='physical');setFulfillment(result.fulfillmentStatus||'');setTracking(result.trackingNumber||'');
        setState(result.paid ? 'paid' : result.status || 'pending'); if (result.downloadUrl) setDownloadUrl(result.downloadUrl);
        if (result.status === 'pending' && ++attempts < 6) timer = setTimeout(check, 4000);
      } catch (error) { if (!stopped) { setState('error'); setError(error instanceof Error ? error.message : 'Could not verify payment.'); } }
    };
    const start = async () => {
      if (access) {
        const response = await fetch('/api/paystack/access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reference, token: access }) });
        const result = await response.json(); if (!response.ok) { if (!stopped) { setState('error'); setError(result.error || 'Recovery link expired.'); } return; }
      }
      if (!stopped) await check();
    };
    void start().catch(() => { if (!stopped) { setState('error'); setError('Could not connect. Please retry.'); } });
    return () => { stopped = true; clearTimeout(timer); };
  }, [section]);
  const recover = async (event: React.FormEvent) => {
    event.preventDefault(); setSending(true); setRecoveryMessage('');
    try { const response = await fetch('/api/paystack/recover', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }); const result = await response.json(); setRecoveryMessage(result.message || result.error || 'Please try again.'); }
    catch { setRecoveryMessage('Could not send the request. Please try again.'); } finally { setSending(false); }
  };
  return <main className="min-h-screen bg-background text-foreground"><Navbar /><section className="container mx-auto flex min-h-[75vh] max-w-2xl items-center px-6 pb-24 pt-36 text-center md:px-12"><div className="w-full space-y-6 border border-foreground/15 p-8 md:p-14">
    <p className="text-[10px] uppercase tracking-[0.4em] text-accent">{physical?'Physical order':section === 'photography' ? 'Photography digital delivery' : 'Fine art digital delivery'}</p>
    <h1 className="font-heading text-4xl italic">{state === 'paid' ? (physical?'Your order is confirmed':'Your purchase is ready') : state === 'checking' ? 'Confirming payment' : state === 'pending' || state === 'failed' ? 'Payment not yet confirmed' : 'Payment needs attention'}</h1>
    <p className="text-sm leading-relaxed text-foreground/55">{state === 'paid' ? physical?'Payment verified. The studio will prepare your order and confirm delivery or pickup details by email.':'Payment verified. Download your file below. A recovery link will also be emailed to the address used at checkout.' : state === 'checking' ? 'Please keep this page open while we confirm the transaction with Paystack.' : error || 'If you were charged, do not pay again. Check again shortly or contact the studio with your payment reference.'}</p>
    {physical&&state==='paid'&&<dl className="space-y-3 border-y border-foreground/15 py-4 text-sm"><div><dt className="text-foreground/50">Order status</dt><dd>{fulfillment.replaceAll('_',' ')}</dd></div>{tracking&&<div><dt className="text-foreground/50">Tracking / delivery reference</dt><dd>{tracking}</dd></div>}</dl>}
    {downloadUrl && state === 'paid' && <a href={downloadUrl} className="inline-flex min-h-12 items-center bg-foreground px-7 py-4 text-xs uppercase tracking-widest text-background">Download purchase</a>}
    {state !== 'paid' && state !== 'checking' && <button onClick={() => window.location.reload()} className="block w-full text-sm underline">Check again</button>}
    <form onSubmit={recover} className="space-y-3 border-t border-foreground/15 pt-6 text-left"><label htmlFor="recovery-email" className="block text-sm">Recover a paid purchase</label><input id="recovery-email" type="email" required maxLength={254} autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email used at checkout" className="min-h-12 w-full border border-foreground/25 bg-transparent px-4" /><button disabled={sending} className="min-h-12 border border-foreground/30 px-5 text-sm disabled:opacity-50">{sending ? 'Sending…' : 'Email my purchase link'}</button>{recoveryMessage && <p role="status" className="text-sm text-foreground/65">{recoveryMessage}</p>}</form>
    <Link href={productShopPath(section)} className="block text-xs underline underline-offset-4">Return to the shop</Link>
  </div></section><Footer /></main>;
}
