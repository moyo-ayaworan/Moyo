import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SeoImage from '@/components/SeoImage';
import { exhibitionRecords, getExhibition } from '@/lib/artArchive';

type PageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return exhibitionRecords.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const exhibition = getExhibition((await params).slug);
  if (!exhibition) return {};
  return { title: `${exhibition.title} | Moyo Ayaworan`, description: `${exhibition.context} ${exhibition.venue}, ${exhibition.city}.` };
}

export default async function ExhibitionDetailPage({ params }: PageProps) {
  const exhibition = getExhibition((await params).slug);
  if (!exhibition) notFound();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navbar />
      <article className="container mx-auto px-6 pb-28 pt-36 md:px-12 md:pb-36 md:pt-52">
        <Link href="/art/exhibitions" className="text-[10px] uppercase tracking-[0.35em] text-foreground/45 transition-colors hover:text-accent">← All exhibitions</Link>
        <header className="mt-12 max-w-4xl border-b border-foreground/10 pb-14 md:pb-20">
          <p className="text-[10px] uppercase tracking-[0.5em] text-accent">{exhibition.year} · Exhibition archive</p>
          <h1 className="mt-6 font-heading text-4xl italic md:text-6xl">{exhibition.title}</h1>
          <p className="mt-7 text-sm uppercase tracking-[0.2em] text-foreground/45">{exhibition.venue} · {exhibition.city}</p>
          <p className="mt-8 max-w-2xl text-base leading-relaxed text-foreground/60 md:text-lg">{exhibition.context}</p>
        </header>

        <section className="pt-14 md:pt-20">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-[10px] uppercase tracking-[0.4em] text-accent">Documentation</p><h2 className="mt-4 font-heading text-3xl italic">Image references</h2></div><p className="max-w-md text-sm leading-relaxed text-foreground/40">Installation views, event photographs, catalogues and press references can be added to this archive.</p></div>
          {exhibition.references.length ? (
            <div className="mt-12 grid gap-6 md:grid-cols-2">{exhibition.references.map((reference) => <figure key={reference.src}><div className="relative aspect-[4/3] overflow-hidden bg-surface"><SeoImage src={reference.src} alt={reference.alt} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" /></div>{reference.caption && <figcaption className="mt-3 text-xs text-foreground/40">{reference.caption}</figcaption>}</figure>)}</div>
          ) : (
            <div className="mt-12 border border-foreground/10 bg-surface/20 px-6 py-16 text-center md:px-12"><p className="font-heading text-2xl italic text-foreground/65">Documentation archive coming soon</p><p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-foreground/35">This exhibition page is ready for photographs, installation views, catalogues and other reference material.</p></div>
          )}
        </section>
      </article>
      <Footer />
    </main>
  );
}
