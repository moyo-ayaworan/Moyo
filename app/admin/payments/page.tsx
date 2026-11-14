'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
type Order = { reference: string; kind: string; email: string; amount_kobo: string | number; currency: string; mode: string; status: string; title: string; created_at: string };
export default function PaymentAdmin() {
  const [orders, setOrders] = useState<Order[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(true), [pending, setPending] = useState(0);
  const load = async (response?: Response) => {
    try { const fetched = response ?? await fetch('/api/payments/admin', { cache: 'no-store' }); const result = await fetched.json(); setError(''); if (!fetched.ok) throw Error(fetched.status === 401 ? 'Sign in at /admin, then return here.' : result.error || 'Could not load payments.'); setOrders(result.orders); setPending(result.pendingNotifications); }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not load payments.'); } finally { setBusy(false); }
  };
  useEffect(() => { const controller = new AbortController(); fetch('/api/payments/admin', { cache: 'no-store', signal: controller.signal }).then(response => { if (!controller.signal.aborted) void load(response); }).catch(() => { if (!controller.signal.aborted) { setError('Could not load payments.'); setBusy(false); } }); return () => controller.abort(); }, []);
  return <main className="min-h-screen bg-background px-6 py-16 text-foreground md:px-12"><div className="mx-auto max-w-6xl space-y-6">
    <Link href="/admin" className="text-sm text-accent underline">Back to admin</Link>
    <h1 className="font-heading text-4xl italic">Payments</h1>
    <p className="max-w-3xl text-sm leading-relaxed text-foreground/60">Verified purchases, invoice deposits and balances, and Stillbounds licences. Pending payments never unlock delivery. Refunds and disputes require review; issue refunds through your Paystack dashboard.</p>
    <button disabled={busy} onClick={() => { setBusy(true); setError(''); void load(); }} className="min-h-12 border border-foreground/30 px-5 disabled:opacity-50">{busy ? 'Loading…' : 'Refresh payments'}</button>
    <p className="text-sm text-foreground/55">{pending} receipt or payment notification{pending === 1 ? '' : 's'} waiting for delivery.</p>
    {error && <p role="alert" className="border border-red-400/30 p-4 text-red-300">{error}</p>}
    <div className="space-y-3">{orders.map(order => <article key={order.reference} className={`grid gap-3 border p-5 md:grid-cols-[1fr_auto] ${['review','refunded','disputed'].includes(order.status) ? 'border-red-400/40' : 'border-foreground/15'}`}>
      <div className="min-w-0 space-y-2"><h2 className="text-lg">{order.title}</h2><p className="text-sm text-foreground/60">{order.email} · {order.kind} · {order.mode}</p><p className="break-all font-mono text-xs text-foreground/45">{order.reference}</p><p className="text-xs text-foreground/45">{new Date(order.created_at).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })}</p></div>
      <div className="space-y-2 md:text-right"><p>{order.currency} {(Number(order.amount_kobo) / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</p><p className={`text-xs uppercase tracking-wider ${order.status === 'paid' ? 'text-green-300' : order.status === 'pending' ? 'text-accent' : 'text-red-300'}`}>{order.status}</p></div>
    </article>)}{!orders.length && !error && !busy && <p>No payment attempts yet.</p>}</div>
  </div></main>;
}
