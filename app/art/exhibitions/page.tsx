'use client';

import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Exhibitions from '@/components/Exhibitions';
import { motion } from 'framer-motion';
import { useLanguage } from '@/context/LanguageContext';
import { useTranslate } from '@/lib/translations';
import GlareHover from '@/components/GlareHover';
import SeoImage from '@/components/SeoImage';

export default function ArtExhibitionsPage() {
    const { language } = useLanguage();
    const { t } = useTranslate(language);

    return (
        <main className="bg-background min-h-screen">
            <Navbar />
            <div className="pt-36 md:pt-52 container mx-auto px-6 md:px-12 pb-32">
                <motion.header
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-24 space-y-4 text-center max-w-2xl mx-auto"
                >
                    <span className="text-accent text-[10px] tracking-[0.5em] uppercase">{t('artExhibitionsPage.venerations')}</span>
                    <h1 className="text-4xl md:text-5xl font-heading text-white">{t('artExhibitionsPage.title')}</h1>
                    <p className="text-white/40 font-body tracking-widest uppercase text-[10px] pt-4">
                        {t('artExhibitionsPage.presentations')}
                    </p>
                </motion.header>

                <Exhibitions />

                {/* Catalog Section */}
                <div className="mt-40 border-t border-white/5 pt-32 grid md:grid-cols-2 gap-24 items-center">
                    <div className="space-y-8">
                        <span className="text-accent text-[10px] tracking-[0.5em] uppercase">{t('artExhibitionsPage.publications')}</span>
                        <h2 className="text-3xl font-heading text-white italic leading-tight">{t('artExhibitionsPage.catalogTitle')}</h2>
                        <p className="text-white/40 text-sm leading-relaxed max-w-md">
                            {t('artExhibitionsPage.catalogDescription')}
                        </p>
                        <button className="text-[10px] tracking-[0.4em] uppercase text-white border-b border-accent pb-2 hover:text-accent transition-colors">
                            {t('artExhibitionsPage.exploreArchive')}
                        </button>
                    </div>

                    <GlareHover
                        width="100%"
                        height="auto"
                        background="#111"
                        borderRadius="2px"
                        borderColor="rgba(255,255,255,0.08)"
                        glareOpacity={0.2}
                        glareAngle={-30}
                        glareSize={180}
                        transitionDuration={760}
                        className="group"
                    >
                        <div className="relative aspect-square overflow-hidden bg-neutral-900">
                            <div className="absolute inset-0 z-10 bg-black/40 transition-colors group-hover:bg-black/20" />
                            <SeoImage
                                src="/image-placeholder.svg"
                                alt="Moyo Ayaworan fine art exhibition catalogue preview"
                                fill
                                sizes="(min-width: 768px) 50vw, 100vw"
                                className="object-cover transition-transform duration-[3s] group-hover:scale-105"
                            />
                        </div>
                    </GlareHover>
                </div>
            </div>
            <Footer />
        </main>
    );
}
