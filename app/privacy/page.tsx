import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navbar />
      <section className="container mx-auto max-w-3xl px-6 pb-24 pt-36 md:px-12 md:pt-52">
        <p className="text-[10px] uppercase tracking-[0.35em] text-accent">Privacy</p>
        <h1 className="mt-5 font-heading text-4xl italic md:text-5xl">Privacy</h1>
        <div className="mt-10 space-y-6 text-sm leading-relaxed text-foreground/55">
          <p>Stillbounds has a <Link href="/stillbounds/privacy" className="underline">separate product Privacy Policy</Link> covering its website and beta-access requests.</p>
          <p>
            This website receives information submitted through booking, contact, newsletter and private gallery forms. Outside the Stillbounds product pages and private pages, it also sends the public page path to the studio’s visit-notification service. Studio visit emails include the server-recorded time, approximate network-derived city/region/country when available, and inferred device category, browser and operating system. These estimates may be inaccurate, particularly with VPNs or proxies; they do not identify a person or provide GPS location. Visit notifications respect Do Not Track and Global Privacy Control. Full IP addresses, coordinates and raw browser identifiers are not included in these emails. Hosting services may process request and security logs.
          </p>
          <p>Public pages also record page views, approximate country, device category, referring domain, and Stillbounds download requests for first-party analytics. No analytics cookies, full IP addresses, raw browser identifiers, query strings or private page paths are stored. A daily rotating hash estimates visitors, so visits across days or devices can count again. Do Not Track and Global Privacy Control requests are respected. Traffic records are kept for up to 90 days; verified shop transactions are reported from payment records. Download requests do not confirm completed downloads or installations.</p>
          <p>
            Physical orders also collect recipient contact and delivery details, your chosen shipping rule and fulfilment status. These are used to prepare and deliver your order and are retained with transaction records. Coupon usage is associated with the checkout email to enforce limits; delivery addresses are not sent to the analytics service. Submitted details are used to respond to enquiries, manage client galleries, process studio communication, and maintain requested subscriptions.
          </p>
          <p>
            General messages to Eniyan may be processed by Google Gemini. Do not share passwords, gallery access codes or payment details in chat.
            Eniyan’s separate guided booking fields are sent directly to the studio booking system, not to Gemini. Your booking details are submitted only after you review them and confirm the request.
          </p>
        </div>
      </section>
      <Footer />
    </main>
  );
}
