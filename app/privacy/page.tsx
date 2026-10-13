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
          <p>Stillbounds has a <Link href="/mofolio/privacy" className="underline">separate product Privacy Policy</Link> covering its website and beta-access requests.</p>
          <p>
            This website receives information submitted through booking, contact, newsletter and private gallery forms. Outside the Stillbounds product pages, it also sends the visited path, browser user agent and visit timestamp to the studio’s session-notification service. Hosting services may process request and security logs.
          </p>
          <p>
            Submitted details are used to respond to enquiries, manage client galleries, process studio communication, and maintain requested subscriptions.
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
