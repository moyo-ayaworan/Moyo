'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import InvoicePayment from '@/components/InvoicePayment';
type Invoice = { id: number; title: string; document_type: string; currency: string; amount: string; paid_at: string | null; billing_details: { depositAmount: number }; payments: Array<{ amount: number }> };
export default function GalleryPayments() {
  const [invoices, setInvoices] = useState<Invoice[]>([]), [gallery, setGallery] = useState(0), [loading, setLoading] = useState(true), [error, setError] = useState('');
  useEffect(() => { let stopped = false; const id = Number(new URLSearchParams(window.location.search).get('gallery'));
    fetch(`/api/payments/gallery?gallery=${id}`, { cache: 'no-store' }).then(async response => { const data = await response.json(); if (!response.ok) throw Error(data.error || 'Could not load invoices.'); if (!stopped) { setGallery(id); setInvoices(data.invoices); } }).catch(error => { if (!stopped) setError(error.message); }).finally(() => { if (!stopped) setLoading(false); });
    return () => { stopped = true; };
  }, []);
  return <main className="min-h-screen bg-background px-6 py-24 text-foreground"><section className="mx-auto max-w-2xl space-y-6"><p className="text-xs uppercase tracking-widest text-accent">Private gallery</p><h1 className="font-heading text-4xl italic">Your invoices</h1><p className="text-sm text-foreground/60">Choose the deposit or full balance shown on your invoice. Final gallery downloads unlock after full settlement.</p>{loading && <p>Loading invoices…</p>}{error && <p role="alert" className="text-red-300">{error}</p>}{invoices.map(invoice => <div key={invoice.id} className="space-y-3"><h2>{invoice.title}</h2>{invoice.paid_at ? <p className="text-sm text-green-300">Paid in full</p> : <InvoicePayment invoice={invoice} galleryId={gallery} />}</div>)}{!loading && !error && !invoices.length && <p>The studio has not issued an NGN invoice for this gallery yet.</p>}<Link href="/photography/client-gallery" className="inline-block text-sm text-accent underline">Return to gallery access</Link></section></main>;
}
