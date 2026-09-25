'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Mail } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useLanguage } from '@/context/LanguageContext';
import { useTranslate } from '@/lib/translations';
import SeoImage from '@/components/SeoImage';

type ShopItem = {
    id: number;
    title: string;
    image: string;
    price?: string;
    details?: string;
    medium?: string;
    dimensions?: string;
    description?: string;
};

type Collection = {
    artworks: ShopItem[];
    products: ShopItem[];
    email: string;
};

export default function ArtShopPage() {
    const { language } = useLanguage();
    const { translateText } = useTranslate(language);
    const [collection, setCollection] = useState<Collection | null>(null);
    const [error, setError] = useState(false);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        fetch('/api/shop', { signal: controller.signal, cache: 'no-store' })
            .then(async (response) => {
                if (!response.ok) throw new Error('Collection unavailable');
                const data: Collection = await response.json();
                if (!Array.isArray(data.artworks) || !Array.isArray(data.products)) throw new Error('Invalid collection');
                if (!controller.signal.aborted) setCollection(data);
            })
            .catch(() => {
                if (!controller.signal.aborted) setError(true);
            });
        return () => controller.abort();
    }, [attempt]);

    useEffect(() => {
        if (collection && window.location.hash) {
            document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: 'start' });
        }
    }, [collection]);

    const inquiryUrl = (item?: ShopItem) => item ? `/art/commissions?artworkId=${item.id}&title=${encodeURIComponent(item.title)}` : '/art/commissions?type=private-viewing';

    const sections = collection ? [
        { title: 'Available prints', kind: 'Print', items: collection.artworks, note: 'Print sizes, pricing, and delivery are confirmed personally by the studio.' },
        { title: 'Digital tools', kind: 'Digital product', items: collection.products, note: 'Creative tools from the studio. Inquire to confirm payment and digital delivery.' },
    ].filter((section) => section.items.length > 0) : [];

    return (
        <main className="min-h-screen bg-background">
            <Navbar />
            <div className="container mx-auto px-6 pb-24 pt-36 md:px-12 md:pb-32 md:pt-52">
                <header className="mb-14 flex flex-col gap-8 border-b border-foreground/15 pb-10 md:mb-20 md:flex-row md:items-end md:justify-between">
                    <div className="space-y-4">
                        <p className="text-[10px] uppercase tracking-[0.4em] text-accent">{translateText('From the studio')}</p>
                        <h1 className="font-heading text-4xl italic leading-tight text-foreground md:text-6xl">{translateText('The Studio Shop')}</h1>
                    </div>
                    <p className="max-w-sm text-sm leading-relaxed text-foreground/65">
                        {translateText('Available prints and digital tools. Choose a piece and contact the studio to arrange your order.')}
                    </p>
                </header>

                {!collection && !error && (
                    <p role="status" className="py-20 text-center text-sm text-foreground/65">{translateText('Loading the collection…')}</p>
                )}

                {error && (
                    <div role="alert" className="border border-foreground/15 px-6 py-16 text-center">
                        <p className="text-sm text-foreground/75">{translateText('The collection could not be loaded. Please try again or contact the studio.')}</p>
                        <button type="button" onClick={() => { setError(false); setAttempt((value) => value + 1); }} className="mt-6 min-h-11 border border-foreground/30 px-6 py-3 text-xs text-foreground transition-colors hover:bg-foreground/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
                            {translateText('Try again')}
                        </button>
                    </div>
                )}

                {collection && sections.length === 0 && (
                    <div className="border border-foreground/15 px-6 py-16 text-center">
                        <h2 className="font-heading text-3xl italic text-foreground">{translateText('Between collections')}</h2>
                        <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-foreground/65">{translateText('There are no items available to order right now. Explore the archive or contact the studio about future releases.')}</p>
                        <Link href="/art/works" className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm text-foreground underline underline-offset-4">{translateText('Explore the archive')} <ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link>
                    </div>
                )}

                <div className="space-y-20">
                    {sections.map((section) => (
                        <section key={section.kind} aria-label={translateText(section.title)}>
                            <div className="mb-8 space-y-3">
                                <h2 className="font-heading text-3xl italic text-foreground">{translateText(section.title)}</h2>
                                <p className="max-w-xl text-sm leading-relaxed text-foreground/65">{translateText(section.note)}</p>
                            </div>
                            <div className={`grid gap-8 ${section.items.length === 1 ? 'max-w-4xl' : 'md:grid-cols-2 xl:grid-cols-3'}`}>
                                {section.items.map((item) => (
                                    <article id={`${section.kind === 'Print' ? 'print' : 'product'}-${item.id}`} key={item.id} className={`min-w-0 scroll-mt-28 overflow-hidden border border-foreground/15 ${section.items.length === 1 ? 'md:grid md:grid-cols-2' : 'flex flex-col'}`}>
                                        <div className="relative aspect-[4/5] min-w-0 overflow-hidden bg-foreground/5">
                                            <SeoImage src={item.image} alt={item.title} fill unoptimized={/\.svg(?:\?.*)?$/i.test(item.image)} sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw" className="object-contain p-4" />
                                        </div>
                                        <div className="flex min-w-0 flex-1 flex-col items-start p-6 sm:p-8">
                                            <p className="text-[10px] uppercase tracking-[0.22em] text-foreground/60">{translateText(section.kind)}</p>
                                            <h3 className="mt-3 break-words font-heading text-3xl italic leading-tight text-foreground">{item.title}</h3>
                                            <p className="mt-4 text-lg text-foreground">{item.price || translateText('Price on request')}</p>
                                            {(item.details || item.medium || item.dimensions) && <p className="mt-4 text-sm leading-relaxed text-foreground/70">{translateText(item.details || [item.medium, item.dimensions].filter(Boolean).join(' / '))}</p>}
                                            {item.description && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-foreground/65">{translateText(item.description)}</p>}
                                            <div className="mt-auto w-full pt-8">
                                                <Link href={inquiryUrl(item)} aria-label={`${translateText('Inquire to order')}: ${item.title}`} className="inline-flex min-h-12 w-full items-center justify-between gap-3 border border-foreground bg-foreground px-5 py-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-background transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
                                                    {translateText('Inquire to order')} <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                                                </Link>
                                                <p className="mt-3 text-xs leading-relaxed text-foreground/60">{translateText('Creates a private collector request. The studio will confirm availability, payment and delivery.')}</p>
                                            </div>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>

                <section className="mt-20 border-t border-foreground/15 pt-10 md:mt-28" aria-label={translateText('Contact the studio')}>
                    <h2 className="font-heading text-3xl italic text-foreground">{translateText('Something in mind?')}</h2>
                    <p className="mt-4 max-w-xl text-sm leading-relaxed text-foreground/65">{translateText('For print requests, private viewings, or questions about an order, speak with the studio.')}</p>
                    <Link href={inquiryUrl()} className="mt-5 inline-flex min-h-11 max-w-full items-center gap-3 text-sm text-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"><Mail className="h-4 w-4 shrink-0" aria-hidden="true" /><span>Start a private collector inquiry</span></Link>
                </section>
            </div>
            <Footer />
        </main>
    );
}
