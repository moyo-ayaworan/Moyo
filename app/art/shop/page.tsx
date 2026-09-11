'use client';

import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { motion } from 'framer-motion';
import { useLanguage } from '@/context/LanguageContext';
import { useTranslate } from '@/lib/translations';
import GlareHover from '@/components/GlareHover';
import SeoImage from '@/components/SeoImage';

const items = [
    { id: 1, title: "Presence (Limited Edition)", details: "Hand Finished Print", image: "/image-placeholder.svg" },
    { id: 2, title: "The Quiet Archive", details: "Monograph", image: "/image-placeholder.svg" },
    { id: 3, title: "Identity Fragment III", details: "Original Work", image: "/image-placeholder.svg" },
    { id: 4, title: "Memory Study #4", details: "Framed Edition", image: "/image-placeholder.svg" },
];

type ShopItem = {
    id: number;
    title: string;
    details: string;
    image: string;
};

export default function ArtShopPage() {
    const { language } = useLanguage();
    const { translateText } = useTranslate(language);
    const shopItems: ShopItem[] = items;

    return (
        <main className="bg-background min-h-screen">
            <Navbar />
            <div className="pt-36 md:pt-52 container mx-auto px-6 md:px-12 pb-32">
                <header className="mb-24 flex flex-col md:flex-row justify-between items-end gap-8">
                    <div className="space-y-4">
                        <span className="text-accent text-[10px] tracking-[0.5em] uppercase">{translateText('Viewing Room')}</span>
                        <h1 className="text-4xl md:text-5xl font-heading text-white italic leading-tight">{translateText('Selected Editions')}</h1>
                    </div>
                    <p className="text-white/40 text-[10px] tracking-[0.3em] uppercase max-w-[200px] border-l border-white/10 pl-6 pb-2">
                        {translateText('A quiet index of editioned and archival works.')}
                    </p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {shopItems.map((item, index) => (
                        <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, delay: index * 0.1 }}
                            className="group space-y-6"
                        >
                            <GlareHover
                                width="100%"
                                height="auto"
                                background="transparent"
                                borderRadius="2px"
                                borderColor="rgba(255,255,255,0.08)"
                                glareOpacity={0.2}
                                glareAngle={-30}
                                glareSize={180}
                                transitionDuration={760}
                            >
                                <div className="relative aspect-[4/5] overflow-hidden bg-neutral-900">
                                    <SeoImage
                                        src={item.image}
                                        alt={`${translateText(item.title)} - ${translateText(item.details)}`}
                                        fill
                                        sizes="(min-width: 1024px) 25vw, (min-width: 768px) 50vw, 100vw"
                                        className="object-cover transition-transform duration-1000 group-hover:scale-105"
                                    />
                                </div>

                                <div className="space-y-1 px-4 py-5">
                                    <div className="flex items-baseline justify-between gap-3">
                                        <h3 className="text-sm font-heading text-white transition-colors group-hover:text-accent">{translateText(item.title)}</h3>
                                    </div>
                                    <p className="font-body text-[10px] uppercase tracking-[0.2em] text-white/20">{translateText(item.details)}</p>
                                </div>
                            </GlareHover>
                        </motion.div>
                    ))}
                </div>

                <div className="mt-40 text-center py-20 border-t border-white/5">
                    <p className="text-white/20 text-xs tracking-[0.4em] uppercase">{translateText('Private viewing by request')}</p>
                </div>
            </div>
            <Footer />
        </main>
    );
}
