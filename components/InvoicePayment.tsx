'use client';
import { useState } from 'react';
import { paymentSummary } from '@/lib/documentPayments';

type Invoice = { id: number; document_type: string; currency: string; amount: string | number; paid_at?: string | null; billing_details?: { depositAmount?: number } | null; payments?: Array<{ amount: number }> | null };
export default function InvoicePayment({ invoice, token, galleryId }: { invoice: Invoice; token?: string; galleryId?: number }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  if (invoice.document_type !== 'invoice' || invoice.currency !== 'NGN') return null;
  const summary = paymentSummary({ ...invoice, billing_details: invoice.billing_details ? { depositAmount: invoice.billing_details.depositAmount || 0, sessionDate: '', agreementScope: '', agreementTerms: '' } : null,
    payments: invoice.payments?.map((p, i) => ({ ...p, id: String(i), reference: '', receivedAt: '', recordedAt: '', totalPaid: 0, balance: 0, bookingConfirmed: false })) });
  if (summary.balance <= 0) return null;
  const start = async (purpose: 'deposit' | 'balance') => {
    setBusy(true); setError('');
    try {
      const response = await fetch(galleryId ? '/api/payments/gallery' : '/api/payments/invoice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoiceId: invoice.id, token, galleryId, purpose }) });
      const result = await response.json();
      if (!response.ok || !result.checkoutUrl) throw Error(result.error || 'Could not open payment.');
      const url = new URL(result.checkoutUrl); if (url.origin !== 'https://checkout.paystack.com') throw Error('Invalid checkout address.');
      window.location.assign(url.href);
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not open payment.'); setBusy(false); }
  };
  return <div className="space-y-3 border border-accent/30 p-4">
    <p className="text-xs text-foreground/65">Invoice Moyo-{invoice.id} · Balance ₦{summary.balance.toLocaleString('en-NG')}</p>
    <div className="flex flex-wrap gap-3">
      {summary.deposit > summary.paid && <button disabled={busy} onClick={() => start('deposit')} className="min-h-12 border border-accent px-4 py-3 text-xs text-accent disabled:opacity-50">Pay deposit · ₦{(summary.deposit - summary.paid).toLocaleString('en-NG')}</button>}
      <button disabled={busy} onClick={() => start('balance')} className="min-h-12 bg-foreground px-4 py-3 text-xs text-background disabled:opacity-50">{busy ? 'Opening checkout…' : `Pay ${summary.paid ? 'balance' : 'in full'} · ₦${summary.balance.toLocaleString('en-NG')}`}</button>
    </div>
    <p className="text-xs text-foreground/45">Pay securely with the methods available on Paystack. An unfinished checkout resumes the same payment session.</p>
    {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
  </div>;
}
