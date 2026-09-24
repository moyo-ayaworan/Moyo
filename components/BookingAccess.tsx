'use client';

import { FormEvent, useState } from 'react';
import { Loader2, Mail, Search } from 'lucide-react';

export default function BookingAccess({ compact = false, isLight = false }: { compact?: boolean; isLight?: boolean }) {
  const [reference, setReference] = useState('');
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [notice, setNotice] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (state === 'sending') return;
    setState('sending');
    setNotice('');
    try {
      const response = await fetch('/api/bookings/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference, email }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Could not send the tracking link.');
      setState('done');
      setNotice(data.message);
    } catch (error) {
      setState('error');
      setNotice(error instanceof Error ? error.message : 'Could not send the tracking link.');
    }
  }

  const field = `min-h-11 w-full rounded-lg border bg-transparent px-3 py-2 text-base outline-none focus:ring-2 focus:ring-accent ${isLight ? 'border-black/15 text-black' : 'border-foreground/15 text-foreground'}`;

  return <form onSubmit={submit} className={`space-y-3 ${compact ? '' : 'border border-foreground/10 bg-foreground/[0.025] p-5 sm:p-6'}`}>
    <div className="space-y-1">
      <p className="flex items-center gap-2 text-sm font-semibold"><Search size={15} className="text-accent" /> Track an existing booking</p>
      <p className="text-xs leading-relaxed opacity-60">Enter the reference from your confirmation email. Eniyan will send the private status link back to the booked email address.</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-xs">Booking reference<input className={`${field} mt-1`} inputMode="numeric" maxLength={13} placeholder="#123" required value={reference} onChange={event => setReference(event.target.value)} /></label>
      <label className="text-xs">Booking email<input className={`${field} mt-1`} type="email" autoComplete="email" maxLength={254} placeholder="you@example.com" required value={email} onChange={event => setEmail(event.target.value)} /></label>
    </div>
    <button type="submit" aria-busy={state === 'sending'} disabled={state === 'sending'} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
      {state === 'sending' ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
      {state === 'sending' ? 'Sending secure link…' : 'Send my tracking link'}
    </button>
    {notice && <p role="status" className={`text-xs leading-relaxed ${state === 'error' ? 'text-red-500' : 'opacity-70'}`}>{notice}</p>}
  </form>;
}
