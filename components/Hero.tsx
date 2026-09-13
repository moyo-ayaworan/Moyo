'use client';

import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { useTranslate } from '@/lib/translations';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useSiteSettings } from '@/lib/useSiteSettings';
import { getStorageItem, setStorageItem } from '@/lib/browserStorage';
import SeoImage from '@/components/SeoImage';

// Exported Masked Line inside Hero so we don't need another file optionally,
// or we can import from MaskedText
import { MaskedLine } from '@/components/ui/MaskedText';

const ThreeAtmosphere = dynamic(() => import('@/components/ThreeAtmosphere'), { ssr: false });

const subscribeToHydration = () => () => {};

interface HeroProps {
    profileType: 'photography' | 'art';
}

export default function Hero({ profileType }: HeroProps) {
    const { language } = useLanguage();
    const { t, translateText } = useTranslate(language);
    const settings = useSiteSettings();
    const [cmsHero, setCmsHero] = useState<{ heroText: string; heroImage: string } | null>(null);
    const [showDecorativeEffects, setShowDecorativeEffects] = useState(false);

    const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);
    const isInitialLoad = hydrated && !getStorageItem('session', 'moreli_intro_played');
    useEffect(() => {
        setStorageItem('session', 'moreli_intro_played', 'true');
    }, []);

    useEffect(() => {
        fetch('/api/content')
            .then((res) => res.json())
            .then((data) => setCmsHero(data.content?.homepage))
            .catch(() => null);
    }, []);

    useEffect(() => {
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const timeout = window.setTimeout(() => setShowDecorativeEffects(!reducedMotion), reducedMotion ? 0 : 550);

        return () => window.clearTimeout(timeout);
    }, []);

    const defaultHeadline = profileType === 'photography' ? t('hero.photography') : t('hero.art');
    const headline = cmsHero?.heroText ? translateText(cmsHero.heroText) : defaultHeadline;

    const heroImage = profileType === 'art'
        ? settings.art.heroImage
        : cmsHero?.heroImage || '/KNG_1564_11.jpg.jpeg';

    const subtext = profileType === 'photography'
        ? translateText(settings.photography.heroSubtext || t('hero.photographySub'))
        : t('hero.artSub');

    const cta = profileType === 'photography'
        ? translateText(settings.photography.heroCta || t('hero.ctaPhotography'))
        : t('hero.ctaArt');

    const link = profileType === 'photography' ? "/photography/bookings" : "/art/works";
    const accent = profileType === 'photography' ? "intentional" : "identity";

    const parts = headline.split(',').map((part: string, i: number, arr: string[]) =>
        part + (i < arr.length - 1 ? ',' : '')
    );
    const shouldStackHeadline = parts.length > 1;

    // Timing parameters according to Moreli animation analysis
    const isFirst = isInitialLoad === true;
    const durationText = isFirst ? 0.7 : 0.5;
    const delayTextStart = isFirst ? 0.35 : 0.1;
    const staggerText = isFirst ? 0.08 : 0.05;

    return (
        <section className="relative min-h-[100svh] w-full overflow-hidden flex items-center justify-center px-5 pb-10 pt-32 sm:px-6 sm:pt-36 md:pt-40 lg:pt-44 prose-none">
            {/* Background Image: No parallax, only relax scale */}
            <div className="absolute inset-0 z-0 bg-background overflow-hidden">
                <motion.div
                    initial={isFirst ? { opacity: 0, scale: 1.035 } : { opacity: 0, scale: 1 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{
                        duration: isFirst ? 1.0 : 0.8,
                        ease: [0.22, 1, 0.36, 1] // Moreli exact easing
                    }}
                    className="relative h-full w-full bg-neutral-900"
                    style={{ willChange: 'transform, opacity' }}
                >
                    <SeoImage
                        src={heroImage || '/KNG_1564_11.jpg.jpeg'}
                        alt={`Moyo Ayaworan ${profileType === 'photography' ? 'photography' : 'fine art'} hero image`}
                        fill
                        sizes="100vw"
                        preload
                        className="object-cover"
                    />
                </motion.div>
                {showDecorativeEffects && (
                    <ThreeAtmosphere
                        preset={profileType}
                        className="z-10 opacity-80 mix-blend-screen"
                    />
                )}
                <div className="absolute inset-0 bg-background/70 z-20" />
                <div className="absolute inset-0 z-20 bg-radial-[at_50%_52%] from-background/62 via-background/42 to-background/82" />
            </div>

            {/* Content */}
            <div className="relative z-30 mt-8 w-full max-w-5xl min-w-0 text-center md:mt-12">
                <div className="space-y-6 md:space-y-8">

                    <div className="overflow-hidden">
                        <motion.p
                            initial={isFirst ? { y: "110%", opacity: 0 } : { y: 0, opacity: 1 }}
                            animate={{ y: "0%", opacity: 1 }}
                            transition={{ duration: durationText, delay: delayTextStart - 0.1, ease: [0.22, 1, 0.36, 1] }}
                            className="text-[9px] uppercase tracking-[0.22em] text-accent sm:text-[10px] sm:tracking-[0.34em] md:text-xs md:tracking-[0.5em]"
                        >
                            {profileType === 'photography' ? t('common.photography') : t('common.fineArt')}
                        </motion.p>
                    </div>

                    <h2 className="text-[clamp(2rem,4.45vw,3.75rem)] font-heading text-foreground leading-[1.08] font-light [overflow-wrap:anywhere]">
                        {parts.map((p: string, i: number) => (
                            <MaskedLine
                                key={i}
                                delay={delayTextStart + i * staggerText}
                                duration={durationText}
                            >
                                <span className={shouldStackHeadline ? 'block max-w-full' : 'inline-block max-w-full text-wrap'}>{p}</span>
                            </MaskedLine>
                        ))}
                    </h2>

                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.8, delay: delayTextStart + parts.length * staggerText + 0.2 }}
                        className="flex flex-col items-center gap-7 pt-2 md:gap-10 md:pt-4"
                    >
                        <p className="mx-auto max-w-xl text-sm leading-relaxed tracking-wide text-foreground/50 [overflow-wrap:anywhere] md:text-lg">
                            {subtext}
                        </p>

                        <Link
                            href={link}
                            className="group relative inline-flex max-w-full items-center justify-center gap-3 px-6 py-4 bg-foreground text-center text-background text-[10px] tracking-[0.18em] uppercase font-medium hover:bg-accent transition-colors duration-500 [overflow-wrap:anywhere] sm:gap-4 sm:px-10 sm:text-xs sm:tracking-[0.3em]"
                        >
                            {cta}
                            <span className="transition-transform duration-500 group-hover:translate-x-2">→</span>
                        </Link>
                    </motion.div>
                </div>
            </div>

            {/* Profile specific detail */}
            <div className="absolute bottom-12 right-12 hidden lg:block overflow-hidden">
                <motion.div
                    initial={{ x: "100%", opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 1, duration: 1.5, ease: "circOut" }}
                    className="flex items-center gap-4"
                >
                    <div className="h-[1px] w-24 bg-foreground/20" />
                    <span className="text-[10px] uppercase tracking-[0.28em] text-foreground/40 italic xl:tracking-[0.4em]">
                        {translateText('Exploring')} {translateText(accent)}
                    </span>
                </motion.div>
            </div>
        </section>
    );
}
