'use client';

import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { motion } from 'framer-motion';
import { useLanguage } from '@/context/LanguageContext';
import { useTranslate } from '@/lib/translations';
import GlareHover from '@/components/GlareHover';
import SeoImage from '@/components/SeoImage';

export default function PhotographyAboutPage() {
    const { language } = useLanguage();
    const { t, translateText } = useTranslate(language);
    const bioParagraphs = [
        'Moyo Ayaworan is a Lagos-based photographer creating portraits, weddings, family stories, editorial images and commissioned work. His approach begins with people: helping them feel at ease, noticing the moments between poses and preserving images that remain meaningful beyond the occasion.',
        'His OND in General Art and HND in Painting, both awarded with Upper Credit at Yaba College of Technology, give him a strong command of composition, cinematic light and colour. This fine-art foundation shapes the visual character of his photography while allowing each subject and story to remain central.',
        'Museum, exhibition and installation experience strengthened his collaborative, detail-led way of working. Whether planning a portrait or documenting a celebration, he balances careful preparation with the freedom to recognise honest, unrepeatable moments.',
        'His art practice continues to inform the atmosphere and emotional depth of his images. International exhibition experience and recognition as a LIMCAF Top 100 artist in 2024 form part of that background, but the photography practice remains focused on giving every client a thoughtful and beautiful experience.',
    ];

    return (
        <main className="bg-background min-h-screen">
            <Navbar />
            <div className="container mx-auto px-6 pb-24 pt-36 md:px-12 md:pb-32 md:pt-52">
                <div className="grid gap-14 lg:grid-cols-12 lg:gap-20">
                    <div className="space-y-8 lg:col-span-6 lg:space-y-12">
                        <motion.div
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ duration: 1.5 }}
                        >
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
                            >
                                <div className="relative aspect-[4/5] overflow-hidden bg-neutral-900">
                                    <SeoImage
                                        src="/profile-portrait.jpg"
                                        alt="Moyo Ayaworan photographer portrait"
                                        fill
                                        sizes="(min-width: 1024px) 50vw, 100vw"
                                        preload
                                        className="object-cover"
                                    />
                                </div>
                            </GlareHover>
                        </motion.div>
                        <div className="flex justify-between gap-6 text-[10px] uppercase tracking-[0.24em] text-white/20 md:tracking-[0.4em]">
                            <p>{t('profilePage.inProcess')}</p>
                            <p>{t('profilePage.location')}</p>
                        </div>
                    </div>

                    <div className="space-y-10 lg:col-span-6 lg:space-y-16">
                        <header className="space-y-6">
                            <span className="text-accent text-[10px] uppercase tracking-[0.32em] md:tracking-[0.5em]">{t('profilePage.philosophy')}</span>
                            <h1 className="text-4xl font-heading text-white md:text-5xl">{t('profilePage.lens')}</h1>
                        </header>

                        <div className="space-y-8 text-base leading-relaxed text-white/50 md:space-y-12 md:text-xl">
                            {bioParagraphs.slice(0, 2).map((paragraph) => (
                                <p key={paragraph}>{translateText(paragraph)}</p>
                            ))}
                            <div className="h-px w-20 bg-accent/50" />
                            <p>{bioParagraphs[2]}</p>
                        </div>

                        <div className="space-y-8">
                            <span className="text-[10px] uppercase tracking-[0.32em] text-accent md:tracking-[0.5em]">Selected experience</span>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
                                {['LIMCAF Top 100 · 2024', 'The Currency Lab · Freiburg', 'Yaba Art Museum', 'Centre for Contemporary Art Lagos', 'Thought Pyramid', 'Cincinnati Museum collaboration'].map((client) => (
                                    <span key={client} className="text-[10px] tracking-[0.3em] uppercase text-white/30 border-l border-white/5 pl-4">
                                        {client}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <Footer />
        </main>
    );
}
