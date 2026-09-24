'use client';

import { useRef, useState } from 'react';
import { paymentSummary, receiptLabel, type PaymentFields, type DocumentPayment } from '@/lib/documentPayments';

export type ManagedDocument = PaymentFields & {
  id: number; gallery_id: number; document_type: 'invoice' | 'contract'; title: string;
  client_email: string; currency: string; due_date: string; line_items: string; terms: string;
  sent_at: string | null; receipt_sent_at?: string | null; created_at: string;
  viewKind?: 'invoice' | 'receipt' | 'agreement'; paymentId?: string;
};
type Client = { id: number; client_name: string };
const button = 'rounded border border-white/20 px-3 py-2 text-xs text-white/85 hover:bg-white/10 disabled:opacity-40';
const input = 'w-full min-w-0 rounded border border-white/20 bg-[#202124] px-3 py-3 text-sm text-white';
const money = (n: number, currency: string) => `${currency} ${n.toLocaleString('en-GB', { maximumFractionDigits: 2 })}`;

function RecordPayment({ doc, headers, pendingRequests, onUpdated, onClose }: { doc: ManagedDocument; headers: Record<string, string>; pendingRequests: Map<number, string>; onUpdated: (doc: ManagedDocument) => void; onClose: () => void }) {
  const summary = paymentSummary(doc);
  const previous = pendingRequests.get(doc.id);
  const [initial] = useState(() => previous ? JSON.parse(previous) as { amount: string; receivedAt: string; reference: string } : null);
  const [amount, setAmount] = useState(initial?.amount || String(Math.min(summary.balance, Math.max(0, summary.deposit - summary.paid) || summary.balance)));
  const [receivedAt, setReceivedAt] = useState(initial?.receivedAt || new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' }));
  const [reference, setReference] = useState(initial?.reference || '');
  const [confirmed, setConfirmed] = useState(Boolean(initial));
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(Boolean(initial));
  const [error, setError] = useState('');
  const request = useRef<string | null>(previous || null);
  const saving = useRef(false);
  const save = async () => {
    if (saving.current || !confirmed) return;
    saving.current = true; setBusy(true); setError('');
    request.current ||= JSON.stringify({ id: doc.id, action: 'recordPayment', paymentKey: crypto.randomUUID(), amount, receivedAt, reference });
    pendingRequests.set(doc.id, request.current);
    try {
      const response = await fetch('/api/galleries/documents', { method: 'PUT', headers, body: request.current, signal: AbortSignal.timeout(30_000) });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 400 || response.status === 409) { request.current = null; pendingRequests.delete(doc.id); setUncertain(false); }
        else setUncertain(true);
        throw new Error(result.error || 'Payment could not be confirmed. Retry the same payment.');
      }
      if (!result.document?.id) throw new Error('No confirmation received. Retry the same payment.');
      pendingRequests.delete(doc.id);
      onUpdated(result.document); onClose();
    } catch (err) {
      if (request.current) setUncertain(true);
      setError(err instanceof Error ? err.message : 'No confirmation received. Retry the same payment.');
    } finally { saving.current = false; setBusy(false); }
  };
  return <div className="mt-4 space-y-4 rounded-lg border border-white/20 bg-black/20 p-4">
    <h5 className="font-semibold text-white">Record payment received</h5>
    <p className="text-sm text-white/60">Remaining balance: {money(summary.balance, doc.currency)}. Saving creates a receipt; it does not charge the client or email them.</p>
    <fieldset disabled={busy || uncertain} className="grid gap-3 sm:grid-cols-2 disabled:opacity-60">
      <label className="space-y-1 text-xs text-white/75">Amount received ({doc.currency})<input className={input} type="number" min="0.01" max={summary.balance} step="0.01" value={amount} onChange={e => setAmount(e.target.value)} /></label>
      <label className="space-y-1 text-xs text-white/75">Payment received on<input className={input} type="date" max={new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' })} value={receivedAt} onChange={e => setReceivedAt(e.target.value)} /></label>
      <label className="space-y-1 text-xs text-white/75 sm:col-span-2">Transfer reference / note · optional<input className={input} maxLength={140} value={reference} onChange={e => setReference(e.target.value)} /></label>
      <label className="flex items-start gap-3 text-sm text-white/85 sm:col-span-2"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-1" />I have verified this money was received. This is not just a payment promise.</label>
    </fieldset>
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    {uncertain && <p className="text-sm text-amber-200">Keep this page open. Retry the same payment to check its saved receipt without recording it twice.</p>}
    <div className="flex gap-3"><button type="button" className={button} aria-busy={busy} disabled={busy || !confirmed} onClick={save}>{busy ? 'Saving…' : uncertain ? 'Retry same payment' : 'Confirm received & create receipt'}</button><button type="button" className={button} disabled={busy || uncertain} onClick={onClose}>Cancel</button></div>
  </div>;
}

export default function DocumentManager({ gallery, galleries = [], documents, actions, headers, onSend, onDownload, onDelete, onUpdated, onNew, children }: {
  gallery?: Client; galleries?: Client[]; documents: ManagedDocument[]; actions: Record<string, boolean>; headers: Record<string, string>;
  onSend: (doc: ManagedDocument) => void; onDownload: (doc: ManagedDocument) => void; onDelete: (doc: ManagedDocument) => void;
  onUpdated: (doc: ManagedDocument) => void; onNew: () => void; children: React.ReactNode;
}) {
  const [tab, setTab] = useState<'invoices' | 'receipts'>('invoices');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState(false);
  const [recording, setRecording] = useState<number | null>(null);
  // Keep uncertain requests when tabs, filters, or another invoice temporarily unmount the form.
  const [pendingRequests] = useState(() => new Map<number, string>());
  const editor = useRef<HTMLDetailsElement>(null);
  const [previousCount, setPreviousCount] = useState(documents.length);
  if (documents.length !== previousCount) {
    setPreviousCount(documents.length);
    if (documents.length > previousCount) { setEditing(false); setSearch(''); setFilter('all'); }
  }
  const clientName = (doc: ManagedDocument) => gallery?.client_name || galleries.find(item => item.id === doc.gallery_id)?.client_name || doc.client_email;
  const invoices = documents.filter(doc => doc.document_type === 'invoice');
  const receipts = invoices.flatMap(doc => doc.payments?.length ? doc.payments.map(payment => ({ doc, payment })) : doc.paid_at ? [{ doc, payment: { id: 'legacy', amount: Number(doc.amount), receivedAt: doc.paid_at.slice(0, 10), balance: 0 } as DocumentPayment }] : []);
  const matches = (doc: ManagedDocument) => `${clientName(doc)} ${doc.title} ${doc.client_email} Moyo-${doc.id}`.toLowerCase().includes(search.toLowerCase());
  const visible = invoices.filter(doc => matches(doc) && (filter === 'all' || (filter === 'paid' ? paymentSummary(doc).balance === 0 : filter === 'partial' ? paymentSummary(doc).paid > 0 && paymentSummary(doc).balance > 0 : paymentSummary(doc).paid === 0)));
  const controls = (doc: ManagedDocument) => <div className="mt-4 flex flex-wrap gap-2"><button type="button" className={button} aria-busy={Boolean(actions[`send-${doc.id}`])} disabled={Boolean(actions[`send-${doc.id}`])} onClick={() => onSend(doc)}>{actions[`send-${doc.id}`] ? 'Sending…' : `Email ${doc.viewKind || 'contract'}`}</button><button type="button" className={button} aria-busy={Boolean(actions[`download-${doc.id}`])} disabled={Boolean(actions[`download-${doc.id}`])} onClick={() => onDownload(doc)}>{actions[`download-${doc.id}`] ? 'Downloading…' : `Download ${doc.viewKind || 'contract'}`}</button></div>;
  return <section className="min-w-0 space-y-5 rounded-lg border border-white/15 bg-[#101113] p-4 sm:p-6" aria-label="Invoices and receipts">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h3 className="font-heading text-2xl text-white">Invoices & receipts</h3><p className="mt-2 text-sm text-white/60">One invoice, every payment, a receipt for each payment received.</p></div><button type="button" className="rounded bg-[#920110] px-5 py-3 text-sm font-semibold text-white" onClick={() => { onNew(); setTab('invoices'); setEditing(true); requestAnimationFrame(() => editor.current?.scrollIntoView({ behavior: 'smooth' })); }}>+ New invoice</button></div>
    <div className="grid grid-cols-2 gap-2" aria-label="Document categories">{(['invoices', 'receipts'] as const).map(value => <button type="button" key={value} aria-pressed={tab === value} onClick={() => setTab(value)} className={`rounded px-4 py-3 text-sm capitalize ${tab === value ? 'bg-[#920110] text-white' : 'bg-white/5 text-white/70'}`}>{value} · {value === 'invoices' ? invoices.length : receipts.length}</button>)}</div>
    <input className={input} aria-label="Search documents" placeholder="Search client, title, or invoice number…" value={search} onChange={e => setSearch(e.target.value)} />
    {tab === 'invoices' ? <>
      <div className="flex flex-wrap gap-2">{[['all', 'All'], ['unpaid', 'Unpaid'], ['partial', 'Part paid'], ['paid', 'Paid']].map(([value, label]) => <button type="button" key={value} className={`${button} ${filter === value ? 'bg-white/15' : ''}`} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
      {visible.map(doc => { const s = paymentSummary(doc); return <article key={doc.id} className="rounded-lg border border-white/15 bg-[#191a1d] p-4">
        <div className="flex flex-wrap justify-between gap-3"><div><h4 className="font-semibold text-white">{clientName(doc)}</h4><p className="mt-1 text-sm text-white/65">Moyo-{doc.id} · {doc.title}</p></div><span className="text-sm text-white/85">{s.balance === 0 ? 'Paid' : s.paid > 0 ? 'Part paid' : 'Unpaid'} · {doc.sent_at ? 'Invoice emailed' : 'Not emailed'}</span></div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">{[['Invoice total', s.total], ['Received', s.paid], ['Balance due', s.balance]].map(([label, value]) => <div key={String(label)}><dt className="text-white/50">{label}</dt><dd className="mt-1 text-white">{money(Number(value), doc.currency)}</dd></div>)}</dl>
        <p className="mt-3 text-xs text-white/65">{s.deposit ? `Booking deposit: ${money(s.deposit, doc.currency)}. ` : ''}{doc.billing_details?.sessionDate ? `Agreed session: ${doc.billing_details.sessionDate}. ` : ''}{s.confirmed ? 'Booking confirmed.' : 'Booking awaits required payment and an agreed session date.'}</p>
        {controls({ ...doc, viewKind: 'invoice' })}
        <div className="mt-2 flex flex-wrap gap-2">{s.balance > 0 && <button type="button" className={button} onClick={() => setRecording(doc.id)}>Record payment</button>}{doc.billing_details?.agreementScope && <button type="button" className={button} onClick={() => onDownload({ ...doc, viewKind: 'agreement' })}>Download agreement</button>}{s.paid === 0 && <button type="button" className={`${button} text-red-300`} disabled={Boolean(actions[`delete-${doc.id}`])} onClick={() => onDelete(doc)}>Delete</button>}</div>
        {recording === doc.id && <RecordPayment key={doc.id} doc={doc} headers={headers} pendingRequests={pendingRequests} onUpdated={updated => { onUpdated(updated); setTab('receipts'); }} onClose={() => setRecording(null)} />}
      </article>; })}
      {!visible.length && <p className="py-6 text-center text-sm text-white/60">No invoices match. Create an invoice to get started.</p>}
      {documents.some(doc => doc.document_type === 'contract') && <details className="rounded border border-white/15 p-4"><summary className="text-sm text-white/80">Existing standalone agreements</summary>{documents.filter(doc => doc.document_type === 'contract' && matches(doc)).map(doc => <article key={doc.id} className="mt-4 border-t border-white/10 pt-3 text-sm text-white"><p>{clientName(doc)} · {doc.title}</p>{controls(doc)}</article>)}</details>}
    </> : <>
      <p className="text-sm text-white/60">Receipts appear only after you record money received against an invoice.</p>
      {receipts.filter(({ doc }) => matches(doc)).map(({ doc, payment }) => <article key={`${doc.id}-${payment.id}`} className="rounded-lg border border-white/15 bg-[#191a1d] p-4"><div className="flex flex-wrap justify-between gap-3"><h4 className="font-semibold text-white">{clientName(doc)}</h4><span className="text-sm text-white">{money(payment.amount, doc.currency)}</span></div><p className="mt-2 text-sm text-white/60">Moyo-{doc.id} / R-{payment.id.slice(0, 8)} · {payment.receivedAt} · {payment.id === 'legacy' ? 'Balance settled' : receiptLabel(doc, payment)}</p><p className="mt-2 text-xs text-white/65">Balance after this payment: {money(payment.balance, doc.currency)}{payment.bookingConfirmed ? ' · Booking confirmed' : ''}</p>{controls({ ...doc, viewKind: 'receipt', paymentId: payment.id })}</article>)}
      {!receipts.length && <p className="py-6 text-center text-sm text-white/60">No payments recorded yet. Open an invoice and choose Record payment.</p>}
    </>}
    <details ref={editor} open={editing} onToggle={event => setEditing(event.currentTarget.open)} className="border-t border-white/15 pt-5"><summary className="text-sm font-medium text-white">Create invoice · optional booking deposit & agreement</summary><div className="mt-5">{children}</div></details>
  </section>;
}
