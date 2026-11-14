'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
export default function InvoicePaymentReturn() {
  const [status, setStatus] = useState('checking'), [error, setError] = useState(''), [portal, setPortal] = useState('');
  useEffect(() => {
    let stopped = false, timer: ReturnType<typeof setTimeout>; let attempts = 0;
    const check = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const response = await fetch(`/api/payments/invoice?invoice=${encodeURIComponent(params.get('invoice') || '')}&reference=${encodeURIComponent(params.get('reference') || '')}`, { cache: 'no-store' });
        const result = await response.json(); if (!response.ok) throw Error(result.error || 'Could not check payment.');
        if (stopped) return; setStatus(result.status); if (result.portalUrl) setPortal(result.portalUrl);
        if (result.status === 'pending' && ++attempts < 6) timer = setTimeout(check, 4000);
      } catch (error) { if (!stopped) { setStatus('error'); setError(error instanceof Error ? error.message : 'Could not check payment.'); } }
    }; void check(); return () => { stopped = true; clearTimeout(timer); };
  }, []);
  return <main className="flex min-h-screen items-center justify-center bg-background px-6 py-24 text-foreground"><section className="w-full max-w-xl space-y-6 border border-foreground/20 p-8 md:p-12">
    <p className="text-xs uppercase tracking-widest text-accent">Secure invoice payment</p>
    <h1 className="font-heading text-4xl italic">{status === 'paid' ? 'Payment received' : status === 'checking' ? 'Confirming your payment' : status === 'pending' || status === 'failed' ? 'Payment not yet confirmed' : 'Payment needs review'}</h1>
    <p className="text-sm leading-relaxed text-foreground/65">{status === 'paid' ? 'Your payment has been verified and recorded on the invoice. The updated balance and receipt are in your private portal.' : error || (status === 'pending' || status === 'failed' ? 'Please refresh to check again. If you were charged, do not make another payment; contact the studio with your payment reference.' : status === 'checking' ? 'Please keep this page open while we verify the transaction.' : 'Contact the studio before making another payment. Downloads remain protected while this is reviewed.')}</p>
    {portal && <Link className="inline-flex min-h-12 items-center border border-accent px-5 text-sm text-accent" href={portal}>Return to your private portal</Link>}
    <button onClick={() => window.location.reload()} className="block text-sm underline underline-offset-4">Check again</button>
    <Link href="/contact" className="block text-sm text-foreground/60 underline">Contact the studio</Link>
  </section></main>;
}
