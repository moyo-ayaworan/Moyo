'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { getBookingFinance } from '@/lib/bookingFinance';

type Inquiry = { id: number; inquiry_type: string; name: string; email: string; details: Record<string, string>; status: string; client_notes: string; artwork_title?: string; artwork_image?: string; artwork_price?: number; availability_status?: string };
type Document = { id: number; document_type: string; title: string; amount: number; currency: string; due_date: string; paid_at?: string | null; billing_details?: { depositAmount?: number; agreementScope?: string } | null; payments?: Array<{ id: string; amount: number; receivedAt: string; balance: number }>; created_at: string };
const stages = ['received', 'consultation', 'quoted', 'reserved', 'deposit-paid', 'in-progress', 'ready', 'delivered'];

export default function CollectorPortal() {
  const params = useParams<{ token: string }>();
  const [inquiry, setInquiry] = useState<Inquiry | null>(null); const [documents, setDocuments] = useState<Document[]>([]); const [error, setError] = useState('');
  useEffect(() => { fetch(`/api/art-inquiries/portal/${params.token}`, { cache: 'no-store' }).then(async response => { const data = await response.json(); if (!response.ok) throw Error(data.error); setInquiry(data.inquiry); setDocuments(data.documents || []); }).catch(error => setError(error.message || 'Could not load collector record.')); }, [params.token]);
  const finance = useMemo(() => inquiry ? getBookingFinance({ service: 'art', estimated_total: Number(inquiry.artwork_price || 0) }, documents) : null, [inquiry, documents]);
  return <main className="min-h-screen bg-background text-foreground"><Navbar /><div className="container mx-auto max-w-6xl px-6 pb-24 pt-36 md:px-12 md:pt-48">
    {error && <p role="alert" className="border border-red-400/30 p-6 text-red-300">{error}</p>}
    {!inquiry && !error && <p>Loading collector record…</p>}
    {inquiry && <div className="space-y-8">
      <header className="border-b border-foreground/15 pb-8"><p className="text-xs uppercase tracking-[0.3em] text-accent">Private collector portal · ART-{inquiry.id}</p><h1 className="mt-4 font-heading text-4xl italic md:text-6xl">{inquiry.artwork_title || (inquiry.inquiry_type === 'commission' ? 'Custom artwork commission' : 'Art inquiry')}</h1><p className="mt-3 text-foreground/55">For {inquiry.name} · {inquiry.email}</p></header>
      <section className="grid gap-3 sm:grid-cols-4 md:grid-cols-8">{stages.map((stage, index) => { const active = index <= Math.max(0, stages.indexOf(inquiry.status)); return <div key={stage} className={`border p-3 ${active ? 'border-accent/45 text-accent' : 'border-foreground/10 text-foreground/30'}`}><p className="text-[9px] uppercase tracking-wider">{stage.replace('-', ' ')}</p></div>; })}</section>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <section className="space-y-5 border border-foreground/15 p-5"><h2 className="font-heading text-2xl italic">Creative brief</h2>{Object.entries(inquiry.details).filter(([, value]) => value).map(([key, value]) => <div key={key}><p className="text-[10px] uppercase tracking-wider text-foreground/40">{key}</p><p className="mt-1 whitespace-pre-wrap text-sm text-foreground/70">{value}</p></div>)}{inquiry.client_notes && <div className="border-t border-foreground/10 pt-4"><p className="text-[10px] uppercase tracking-wider text-accent">Studio update</p><p className="mt-2 whitespace-pre-wrap">{inquiry.client_notes}</p></div>}</section>
        <section className="space-y-5 border border-foreground/15 p-5"><h2 className="font-heading text-2xl italic">Financials & documents</h2>{finance?.hasInvoice ? <div className="grid grid-cols-2 gap-3">{([['Total', finance.invoiceTotal], ['Deposit', finance.depositRequired], ['Paid', finance.paid], ['Balance', finance.balance]] as const).map(([label, value]) => <div key={label} className="border border-foreground/10 p-3"><p className="text-[10px] uppercase tracking-wider text-foreground/40">{label}</p><p className="mt-2">{finance.currency === 'NGN' ? '₦' : `${finance.currency} `}{value.toLocaleString()}</p></div>)}</div> : <p className="text-sm text-foreground/55">The studio has not issued a quote or invoice yet.</p>}
          <div className="space-y-2">{documents.flatMap(document => [{ key: `${document.id}-document`, label: document.document_type, kind: document.document_type === 'invoice' ? 'invoice' : '', paymentId: '' }, ...(document.billing_details?.agreementScope ? [{ key: `${document.id}-agreement`, label: 'agreement', kind: 'agreement', paymentId: '' }] : []), ...(document.payments?.map(payment => ({ key: `${document.id}-${payment.id}`, label: `receipt · ${payment.receivedAt}`, kind: 'receipt', paymentId: payment.id })) || [])].map(item => <a key={item.key} target="_blank" rel="noreferrer" href={`/api/galleries/documents?id=${document.id}&format=pdf&kind=${item.kind}&paymentId=${item.paymentId}&token=${params.token}`} className="flex justify-between border border-foreground/10 px-4 py-3 text-sm uppercase tracking-wider hover:border-accent"><span>{item.label}</span><span>Open</span></a>))}</div>
          {inquiry.status === 'delivered' && finance?.fullyPaid && <a href={`/api/art-inquiries/certificate?token=${params.token}`} className="flex justify-between border border-accent/40 px-4 py-3 text-sm uppercase tracking-wider text-accent"><span>Certificate of authenticity</span><span>Download</span></a>}
        </section>
      </div>
      <p className="text-xs text-foreground/45">Packing, insurance, customs, framing, installation, authenticity documentation and delivery are confirmed by the studio before fulfilment.</p>
    </div>}
  </div><Footer /></main>;
}
