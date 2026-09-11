'use client';

import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { motion } from 'framer-motion';
import { useLanguage } from '@/context/LanguageContext';
import { useTranslate } from '@/lib/translations';
import GlareHover from '@/components/GlareHover';
import SeoImage from '@/components/SeoImage';

export default function ArtCommissionsPage() {
    const { language } = useLanguage();
    const { t } = useTranslate(language);
    const steps = [
        { step: "01", title: t('commissionsPage.step1Title'), desc: t('commissionsPage.step1Description') },
        { step: "02", title: t('commissionsPage.step2Title'), desc: t('commissionsPage.step2Description') },
        { step: "03", title: t('commissionsPage.step3Title'), desc: t('commissionsPage.step3Description') },
        { step: "04", title: t('commissionsPage.step4Title'), desc: t('commissionsPage.step4Description') },
    ];

    return (
        <main className="bg-background min-h-screen">
            <Navbar />
            <div className="pt-36 md:pt-52 container mx-auto px-6 md:px-12 pb-32">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-4xl mx-auto space-y-24"
                >
                    <header className="space-y-6 text-center">
                        <span className="text-accent text-[10px] tracking-[0.5em] uppercase">{t('commissionsPage.bespoke')}</span>
                        <h1 className="text-4xl md:text-5xl font-heading text-white font-light italic">{t('commissionsPage.title')}</h1>
                        <p className="text-white/50 font-body text-lg max-w-2xl mx-auto tracking-wide">
                            {t('commissionsPage.description')}
                        </p>
                    </header>

                    <div className="grid md:grid-cols-2 gap-20 items-center">
                        <div className="space-y-8">
                            <div className="space-y-4">
                                <h3 className="text-2xl font-heading text-white">{t('commissionsPage.processTitle')}</h3>
                                <p className="text-white/40 text-sm leading-relaxed">
                                    {t('commissionsPage.processDescription')}
                                </p>
                            </div>

                            <ul className="space-y-6">
                                {steps.map((item) => (
                                    <li key={item.step} className="flex gap-6 border-b border-white/5 pb-6 last:border-0">
                                        <span className="text-accent text-xs font-heading">{item.step}</span>
                                        <div className="space-y-1">
                                            <p className="text-white text-xs tracking-widest uppercase font-medium">{item.title}</p>
                                            <p className="text-white/30 text-[10px] tracking-wide">{item.desc}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
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
                            <div className="relative aspect-[3/4] overflow-hidden bg-neutral-900">
                                <SeoImage
                                    src="/image-placeholder.svg"
                                    alt="Moyo Ayaworan commissioned fine art process preview"
                                    fill
                                    sizes="(min-width: 768px) 50vw, 100vw"
                                    className="object-cover grayscale transition-all duration-1000 group-hover:grayscale-0"
                                />
                                <div className="absolute inset-0 bg-black/20" />
                            </div>
                        </GlareHover>
                    </div>

                    <GlareHover
                        width="100%"
                        height="auto"
                        background="var(--glass-bg)"
                        borderRadius="2px"
                        borderColor="var(--glass-border)"
                        glareOpacity={0.16}
                        glareAngle={-30}
                        glareSize={170}
                        transitionDuration={780}
                        className="glass"
                        contentClassName="p-12 text-center space-y-12 md:p-20"
                    >
                        <h2 className="text-3xl font-heading text-white italic">{t('commissionsPage.startConversation')}</h2>
                        <button className="bg-white text-black px-12 py-5 text-[10px] tracking-[0.5em] uppercase font-bold hover:bg-accent transition-colors">
                            {t('commissionsPage.inquireNow')}
                        </button>
                    </GlareHover>
                </motion.div>
            </div>
            <Footer />
        </main>
    );
}
