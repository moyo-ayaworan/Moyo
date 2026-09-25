'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { CalendarDays, CheckCircle2, Clock, CreditCard, Download, FileText, ImageIcon, Mail, RefreshCw } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { getBookingFinance } from '@/lib/bookingFinance';
import { getBookingPackage } from '@/lib/bookingRates';

type Booking = {
  id: number;
  name: string;
  email: string;
  phone: string;
  service: string;
  package_id: string;
  booking_options: Record<string, string | number | boolean>;
  base_price: number;
  estimated_total: number;
  quote_required: boolean;
  message: string;
  booking_date: string;
  booking_time: string;
  scheduled_at: string;
  timezone: string;
  status: string;
  client_notes: string;
  gallery_id: number | null;
  confirmation_sent_at: string | null;
  reminder_24h_sent_at: string | null;
  reminder_day_sent_at: string | null;
  created_at: string;
};

type PortalDocument = {
  id: number;
  document_type: 'invoice' | 'contract';
  title: string;
  amount: string | number;
  currency: string;
  due_date: string;
  sent_at: string | null;
  paid_at: string | null;
  billing_details?: { agreementScope?: string; depositAmount?: number } | null;
  payments?: Array<{ id: string; amount: number; receivedAt: string; balance: number }>;
  created_at: string;
};

type PortalGallery = {
  id: number;
  slug: string;
  access_code: string;
  client_name: string;
  payment_verified: boolean;
  payment_url: string;
  image_count: number | null;
  approved_count: number | null;
  finished_count: number | null;
  review_submitted_at: string | null;
};

const statusLabels: Record<string, string> = {
  pending: 'Request received',
  confirmed: 'Booking confirmed',
  'contract-sent': 'Contract sent',
  invoiced: 'Invoice sent',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function formatWhen(value: string) {
  if (!value) return 'Date pending';
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Africa/Lagos',
  }).format(new Date(value));
}

export default function ClientBookingPortalPage() {
  const params = useParams<{ token: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [documents, setDocuments] = useState<PortalDocument[]>([]);
  const [gallery, setGallery] = useState<PortalGallery | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const finance = useMemo(() => booking ? getBookingFinance(booking, documents) : null, [booking, documents]);

  const timeline = useMemo(() => {
    const status = booking?.status || 'pending';
    return [
      { id: 'pending', label: 'Request', icon: Mail, active: true },
      { id: 'confirmed', label: 'Confirmed', icon: CalendarDays, active: ['confirmed', 'contract-sent', 'invoiced', 'completed'].includes(status) },
      { id: 'contract-sent', label: 'Contract', icon: FileText, active: ['contract-sent', 'invoiced', 'completed'].includes(status) },
      { id: 'invoiced', label: 'Invoice', icon: Clock, active: ['invoiced', 'completed'].includes(status) },
      { id: 'completed', label: 'Gallery', icon: ImageIcon, active: status === 'completed' },
    ];
  }, [booking?.status]);

  const loadBooking = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/bookings/portal/${params.token}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.booking) {
        setError(typeof data.error === 'string' ? data.error : 'Booking not found.');
        setBooking(null);
        setDocuments([]);
        setGallery(null);
      } else {
        setBooking(data.booking);
        setDocuments(Array.isArray(data.documents) ? data.documents : []);
        setGallery(data.gallery || null);
      }
    } catch {
      setError('Unable to load this booking right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (params.token) void loadBooking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.token]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navbar />
      <section className="container mx-auto px-6 pb-24 pt-32 md:px-12 md:pt-48">
        <div className="mx-auto max-w-5xl space-y-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0 space-y-3">
              <p className="text-[10px] uppercase tracking-[0.4em] text-accent">Client Portal</p>
              <h1 className="font-heading text-4xl italic text-white md:text-5xl">Booking Status</h1>
              <p className="max-w-2xl text-sm leading-relaxed text-white/45">
                Your booking, contract, invoice, reminders, and delivery status live here as the studio moves your project forward.
              </p>
            </div>
            <button
              type="button"
              onClick={loadBooking}
              className="inline-flex items-center gap-2 border border-white/10 px-4 py-3 text-[10px] uppercase tracking-[0.2em] text-white/60 transition-colors hover:border-accent hover:text-accent"
            >
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>

          {loading && <div className="border border-white/10 bg-white/[0.03] p-8 text-sm text-white/45">Loading booking...</div>}
          {error && <div className="border border-red-400/30 bg-red-500/10 p-8 text-sm text-red-200">{error}</div>}

          {booking && (
            <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
              <aside className="space-y-5 border border-white/10 bg-white/[0.03] p-5 md:p-6">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">Current stage</p>
                  <h2 className="mt-2 font-heading text-3xl italic text-accent">
                    {statusLabels[booking.status] || booking.status}
                  </h2>
                </div>
                <div className="space-y-3 text-sm text-white/60">
                  <p className="flex gap-3"><CalendarDays className="mt-0.5 shrink-0 text-accent" size={16} /> {formatWhen(booking.scheduled_at)}</p>
                  <p className="flex gap-3"><Clock className="mt-0.5 shrink-0 text-accent" size={16} /> Studio time, Lagos</p>
                  <p className="flex gap-3"><Mail className="mt-0.5 shrink-0 text-accent" size={16} /> {booking.email}</p>
                </div>
                <div className="grid gap-3 border-t border-white/10 pt-5">
                  <div className="border border-white/10 bg-black/20 p-3">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-white/35">Payment</p>
                    <p className={`mt-2 text-sm ${gallery?.payment_verified ? 'text-green-300' : 'text-white/60'}`}>
                      {gallery?.payment_verified ? 'Verified' : gallery?.payment_url ? 'Payment link ready' : 'Pending studio confirmation'}
                    </p>
                  </div>
                  {gallery?.payment_url && !gallery.payment_verified && (
                    <a href={gallery.payment_url} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 border border-accent/45 px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-accent transition-colors hover:bg-accent hover:text-black">
                      <CreditCard size={14} />
                      Pay Booking
                    </a>
                  )}
                </div>
                {booking.client_notes && (
                  <div className="border-t border-white/10 pt-5">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">Studio note</p>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-white/65">{booking.client_notes}</p>
                  </div>
                )}
              </aside>

              <section className="space-y-6 border border-white/10 bg-black/20 p-5 md:p-6">
                <div className="grid gap-3 sm:grid-cols-5">
                  {timeline.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.id} className={`min-h-28 border p-3 ${item.active ? 'border-accent/45 bg-accent/[0.06] text-white' : 'border-white/10 text-white/30'}`}>
                        <Icon size={17} className={item.active ? 'text-accent' : 'text-white/25'} />
                        <p className="mt-5 text-[10px] uppercase tracking-[0.18em]">{item.label}</p>
                        {item.active && <CheckCircle2 size={14} className="mt-3 text-accent" />}
                      </div>
                    );
                  })}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="border border-white/10 bg-white/[0.025] p-4">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-white/35">Package & estimate</p>
                    <p className="mt-2 text-white">{getBookingPackage(booking.package_id)?.label || booking.package_id || booking.service}</p>
                    <p className="mt-1 text-sm text-accent">{finance && finance.sessionValue > 0 ? `${finance.currency === 'NGN' ? '₦' : `${finance.currency} `}${finance.sessionValue.toLocaleString('en-NG')}` : 'Price not recorded'}{booking.quote_required ? ' + final quote' : ''}</p>
                    {booking.quote_required && <p className="mt-2 text-xs leading-relaxed text-white/45">Variable travel or custom additions are confirmed by the studio before payment.</p>}
                  </div>
                  <div className="border border-white/10 bg-white/[0.025] p-4">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-white/35">Client</p>
                    <p className="mt-2 text-white">{booking.name}</p>
                  </div>
                </div>

                {finance?.hasInvoice && <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {([['Invoiced', finance.invoiceTotal], ['Deposit', finance.depositRequired], ['Paid', finance.paid], ['Balance', finance.balance]] as const).map(([label, value]) => <div key={label} className="border border-white/10 bg-white/[0.025] p-4"><p className="text-[10px] uppercase tracking-[0.2em] text-white/35">{label}</p><p className={`mt-2 text-sm ${label === 'Paid' && value > 0 ? 'text-green-300' : label === 'Balance' && value > 0 ? 'text-accent' : 'text-white'}`}>{finance.currency === 'NGN' ? '₦' : `${finance.currency} `}{value.toLocaleString('en-NG')}</p></div>)}
                </div>}

                <div className="border border-white/10 bg-white/[0.025] p-4">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-white/35">Project brief</p>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-white/60">{booking.message || 'No brief added yet.'}</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="border border-white/10 bg-white/[0.025] p-4">
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-accent" />
                      <p className="text-[10px] uppercase tracking-[0.22em] text-white/35">Contracts, Invoices & Receipts</p>
                    </div>
                    <div className="mt-4 space-y-2">
                      {documents.length > 0 ? documents.flatMap(document => [
                        { ...document, key: `${document.id}-invoice`, kind: document.document_type === 'invoice' ? 'invoice' : '', paymentId: '', label: document.document_type },
                        ...(document.billing_details?.agreementScope ? [{ ...document, key: `${document.id}-agreement`, kind: 'agreement', paymentId: '', label: 'Agreement', title: `Agreement for Moyo-${document.id}` }] : []),
                        ...(document.payments?.map(payment => ({ ...document, key: `${document.id}-${payment.id}`, kind: 'receipt', paymentId: payment.id, label: `Receipt · ${payment.receivedAt} · ${document.currency} ${Number(payment.amount).toLocaleString()}`, title: `Payment receipt for Moyo-${document.id}` })) || []),
                        ...(!document.payments?.length && document.paid_at ? [{ ...document, key: `${document.id}-receipt`, kind: 'receipt', paymentId: 'legacy', label: 'Receipt · Paid' }] : []),
                      ]).map((document) => (
                        <a
                          key={document.key}
                          href={`/api/galleries/documents?id=${document.id}&format=pdf&kind=${document.kind}&paymentId=${document.paymentId}&token=${params.token}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex min-w-0 items-center justify-between gap-3 border border-white/10 bg-black/20 px-3 py-3 text-sm text-white/70 transition-colors hover:border-accent hover:text-accent"
                        >
                          <span className="min-w-0">
                            <span className="block truncate">{document.title}</span>
                            <span className="mt-1 block text-[10px] uppercase tracking-[0.16em] text-white/35">{document.label}</span>
                          </span>
                          <Download size={15} className="shrink-0" />
                        </a>
                      )) : (
                        <p className="text-sm leading-relaxed text-white/40">Your contract and invoice will appear here after the studio prepares them.</p>
                      )}
                    </div>
                  </div>

                  <div className="border border-white/10 bg-white/[0.025] p-4">
                    <div className="flex items-center gap-2">
                      <ImageIcon size={16} className="text-accent" />
                      <p className="text-[10px] uppercase tracking-[0.22em] text-white/35">Gallery</p>
                    </div>
                    {gallery ? (
                      <div className="mt-4 space-y-3 text-sm text-white/60">
                        <p>Access code: <span className="font-semibold tracking-[0.16em] text-white">{gallery.access_code}</span></p>
                        <p>{gallery.finished_count || 0} finished files ready</p>
                        <Link href={`/photography/client-gallery?code=${gallery.access_code}`} className="inline-flex items-center justify-center border border-accent/45 px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-accent transition-colors hover:bg-accent hover:text-black">
                          Open Gallery
                        </Link>
                      </div>
                    ) : (
                      <p className="mt-4 text-sm leading-relaxed text-white/40">Your private gallery will appear here after the studio creates it.</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link href={gallery ? `/photography/client-gallery?code=${gallery.access_code}` : '/photography/client-gallery'} className="border border-accent/45 px-4 py-3 text-[10px] uppercase tracking-[0.2em] text-accent transition-colors hover:bg-accent hover:text-black">
                    Open Gallery Access
                  </Link>
                  <Link href="/photography/bookings" className="border border-white/10 px-4 py-3 text-[10px] uppercase tracking-[0.2em] text-white/55 transition-colors hover:border-white hover:text-white">
                    Request Another Date
                  </Link>
                </div>
              </section>
            </div>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
}
