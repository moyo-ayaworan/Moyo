'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { AnimatePresence, motion } from 'framer-motion';
import { useProfile } from '@/context/ProfileContext';
import { useLanguage } from '@/context/LanguageContext';
import { useTranslate } from '@/lib/translations';
import GlareHover from '@/components/GlareHover';
import { FiX } from 'react-icons/fi';
import { createImageAlt } from '@/lib/imageSeo';

type Artwork = {
    id: number;
    title: string;
    image: string;
    category: string;
    year?: string;
    medium?: string;
    dimensions?: string;
    description?: string;
    is_featured?: boolean;
    is_available?: boolean;
    availability_status?: string;
};

function isSvgImage(src: string) {
    return /\.svg(?:\?.*)?$/i.test(src);
}

export default function WorksPage() {
    const { setProfile } = useProfile();
    const { language } = useLanguage();
    const { t, translateText } = useTranslate(language);
    const [works, setWorks] = useState<Artwork[]>([]);
    const [selectedWork, setSelectedWork] = useState<Artwork | null>(null);
    const archiveGridClass = works.length <= 2
        ? 'mx-auto grid max-w-[920px] grid-cols-1 gap-14'
        : 'grid grid-cols-1 gap-x-8 gap-y-16 md:grid-cols-2 xl:grid-cols-3';

    useEffect(() => {
        setProfile('art');
        fetch('/api/artworks')
            .then(res => res.json())
            .then((data: { artworks?: Artwork[] }) => setWorks(data.artworks || []))
            .catch(err => console.error('Failed to fetch works', err));
    }, [setProfile]);

    useEffect(() => {
        if (!selectedWork) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setSelectedWork(null);
        };

        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = '';
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [selectedWork]);

    const getArtworkData = (work: Artwork) => [
        { label: 'Title', value: work.title },
        { label: 'Archive No.', value: `MW-${String(work.id).padStart(4, '0')}` },
        { label: 'Classification', value: work.category },
        { label: 'Year', value: work.year },
        { label: 'Medium', value: work.medium },
        { label: 'Dimensions', value: work.dimensions },
        { label: 'Edition / Print', value: work.is_available ? 'Print option available by artist discretion' : '' },
        { label: 'Collector status', value: work.availability_status ? work.availability_status.replace('-', ' ') : 'Archive' },
    ].filter((item) => item.value);

    return (
        <main className="bg-background min-h-screen">
            <Navbar />

            <div className="container mx-auto px-5 pb-24 pt-32 sm:px-6 md:px-12 md:pb-32 md:pt-48">
                <header className="mx-auto mb-16 max-w-3xl space-y-5 text-center md:mb-24">
                    <span className="text-accent text-[10px] tracking-[0.5em] uppercase">{t('artPage.collection')}</span>
                    <h1 className="text-4xl md:text-6xl font-heading text-white italic">{t('artPage.selectedWorks')}</h1>
                    <p className="mx-auto max-w-xl text-sm leading-relaxed text-white/40 md:text-base">
                        {t('worksPage.archiveDescription')}
                    </p>
                </header>

                <div className={archiveGridClass}>
                    {works.map((work, index) => (
                        <motion.div
                            key={work.id}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, delay: index * 0.1 }}
                            viewport={{ once: true }}
                            className={`group min-w-0 ${works.length > 2 && (work.is_featured || index === 0) ? 'md:col-span-2 xl:col-span-2' : ''}`}
                        >
                            <GlareHover
                                width="100%"
                                height="auto"
                                background="transparent"
                                borderRadius="2px"
                                borderColor="transparent"
                                glareOpacity={0.2}
                                glareAngle={-30}
                                glareSize={180}
                                transitionDuration={760}
                            >
                                <figure className="min-w-0 overflow-hidden border border-white/12 bg-black/15 transition-colors duration-300 group-hover:border-white/22">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedWork(work)}
                                        className="relative flex min-h-[54svh] w-full cursor-zoom-in items-center justify-center overflow-hidden border-b border-white/10 bg-[#050505] p-3 text-left sm:p-5 md:min-h-[64svh]"
                                        aria-label={`Open full data for ${translateText(work.title)}`}
                                    >
                                        <Image
                                            src={work.image}
                                            alt={translateText(createImageAlt(work.title, work.medium, work.category, 'artwork by Moyo Ayaworan'))}
                                            fill
                                            sizes={works.length <= 2 ? '(min-width: 768px) 920px, 100vw' : '(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw'}
                                            unoptimized={isSvgImage(work.image)}
                                            className="object-contain p-3 transition duration-700 group-hover:scale-[1.015] sm:p-5"
                                            loading={index === 0 ? 'eager' : 'lazy'}
                                            fetchPriority={index === 0 ? 'high' : 'auto'}
                                        />
                                        <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/[0.035]" />
                                        <span className="pointer-events-none absolute bottom-4 right-4 border border-white/10 bg-black/60 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-white/50 opacity-0 backdrop-blur-md transition-opacity duration-300 group-hover:opacity-100">
                                            View Data
                                        </span>
                                    </button>

                                    <figcaption
                                        className="flex min-w-0 flex-col gap-3 px-4 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6"
                                    >
                                        <div className="min-w-0 space-y-2">
                                            <h3 className="font-heading text-2xl italic leading-tight text-white transition-colors duration-300 group-hover:text-accent md:text-3xl">
                                                {translateText(work.title)}
                                            </h3>
                                            {(work.medium || work.dimensions || work.description) && (
                                                <div className="max-w-2xl space-y-2">
                                                    {(work.medium || work.dimensions) && (
                                                        <p className="text-xs leading-relaxed text-white/45">
                                                            {[work.medium, work.dimensions].filter(Boolean).map((value) => translateText(value || '')).join(' / ')}
                                                        </p>
                                                    )}
                                                    {work.description && (
                                                        <p className="text-sm leading-relaxed text-white/50">
                                                            {translateText(work.description)}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div className="shrink-0 space-y-1 text-left sm:text-right">
                                            <p className="text-[10px] uppercase tracking-[0.28em] text-white/38">
                                                {translateText(work.category)}
                                            </p>
                                            {work.year && (
                                                <p className="text-[10px] uppercase tracking-[0.28em] text-white/28">
                                                    {translateText(work.year)}
                                                </p>
                                            )}
                                            <p className="text-[10px] uppercase tracking-[0.28em] text-accent/70">{translateText((work.availability_status || 'archive').replace('-', ' '))}</p>
                                        </div>
                                    </figcaption>
                                </figure>
                            </GlareHover>
                        </motion.div>
                    ))}
                </div>

                {!works.length && (
                    <div className="mx-auto max-w-xl border border-white/10 px-6 py-20 text-center text-[10px] uppercase tracking-[0.28em] text-white/35">
                        Archive works will appear here.
                    </div>
                )}
            </div>

            <AnimatePresence>
                {selectedWork && (
                    <motion.div
                        className="fixed inset-0 z-[220] flex items-center justify-center bg-black/88 px-4 py-5 backdrop-blur-md sm:px-6"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        role="dialog"
                        aria-modal="true"
                        aria-label={`Full data for ${translateText(selectedWork.title)}`}
                    >
                        <button
                            type="button"
                            onClick={() => setSelectedWork(null)}
                            className="absolute inset-0 cursor-default"
                            aria-label="Close artwork data"
                        />

                        <motion.div
                            initial={{ opacity: 0, y: 24, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 24, scale: 0.98 }}
                            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                            className="relative grid max-h-[92vh] w-full max-w-7xl overflow-hidden border border-white/10 bg-background shadow-2xl lg:grid-cols-[minmax(0,1fr)_380px]"
                        >
                            <button
                                type="button"
                                onClick={() => setSelectedWork(null)}
                                className="absolute right-3 top-3 z-20 flex h-11 w-11 items-center justify-center border border-white/15 bg-black/60 text-white/70 backdrop-blur-md transition-colors hover:border-accent hover:text-accent"
                                aria-label="Close artwork data"
                            >
                                <FiX />
                            </button>

                            <div className="flex max-h-[58vh] items-center justify-center bg-black p-3 sm:p-6 lg:max-h-[92vh]">
                                <Image
                                    src={selectedWork.image}
                                    alt={translateText(createImageAlt(selectedWork.title, selectedWork.medium, selectedWork.category, 'artwork by Moyo Ayaworan'))}
                                    width={1800}
                                    height={1400}
                                    sizes="(min-width: 1024px) 65vw, 100vw"
                                    unoptimized={isSvgImage(selectedWork.image)}
                                    className="max-h-[54vh] w-auto max-w-full object-contain lg:max-h-[84vh]"
                                    loading="eager"
                                    fetchPriority="high"
                                />
                            </div>

                            <aside className="flex min-w-0 flex-col gap-7 overflow-y-auto p-5 sm:p-8">
                                <div className="space-y-3">
                                    <p className="text-[10px] uppercase tracking-[0.34em] text-accent">
                                        Artwork Data
                                    </p>
                                    <h2 className="font-heading text-3xl italic leading-tight text-white [overflow-wrap:anywhere] sm:text-4xl">
                                        {translateText(selectedWork.title)}
                                    </h2>
                                </div>

                                <dl className="divide-y divide-white/10 border-y border-white/10">
                                    {getArtworkData(selectedWork).map((item) => (
                                        <div key={item.label} className="grid gap-2 py-4 sm:grid-cols-[120px_1fr]">
                                            <dt className="text-[10px] uppercase tracking-[0.22em] text-white/30">
                                                {item.label}
                                            </dt>
                                            <dd className="text-sm leading-relaxed text-white/68 [overflow-wrap:anywhere]">
                                                {translateText(String(item.value))}
                                            </dd>
                                        </div>
                                    ))}
                                </dl>

                                {selectedWork.description && (
                                    <div className="space-y-3">
                                        <p className="text-[10px] uppercase tracking-[0.28em] text-white/30">
                                            Archive Note
                                        </p>
                                        <p className="text-sm leading-relaxed text-white/58 [overflow-wrap:anywhere]">
                                            {translateText(selectedWork.description)}
                                        </p>
                                    </div>
                                )}

                                <p className="mt-auto border-t border-white/10 pt-5 text-[10px] uppercase tracking-[0.24em] text-white/25">
                                    Tap outside or press Escape to close
                                </p>
                            </aside>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <Footer />
        </main>
    );
}
