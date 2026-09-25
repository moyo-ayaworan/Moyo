'use client';

import { motion } from 'framer-motion';
import { useLanguage } from '@/context/LanguageContext';
import { useTranslate } from '@/lib/translations';
import { useEffect, useState } from 'react';
import GlareHover from '@/components/GlareHover';
import { useSiteSettings } from '@/lib/useSiteSettings';
import SeoImage from '@/components/SeoImage';
import Link from 'next/link';
interface AboutSectionProps {
    profileType: 'photography' | 'art';
}

export default function AboutSection({ profileType }: AboutSectionProps) {
    const { language } = useLanguage();
    const { t } = useTranslate(language);
    const settings = useSiteSettings();
    const [cmsAbout, setCmsAbout] = useState<{ text: string; image: string } | null>(null);

    useEffect(() => {
        fetch('/api/content')
            .then((res) => res.json())
            .then((data) => setCmsAbout(data.content?.about))
            .catch(() => null);
    }, []);

    const headline = profileType === 'photography'
        ? t('about.photography.headline')
        : t('about.art.headline');

    const bioParagraphs = [
        t(`about.${profileType}.text1`),
        t(`about.${profileType}.text2`),
        t(`about.${profileType}.text3`),
    ];
    const aboutImage = profileType === 'art'
        ? settings.art.aboutImage
        : cmsAbout?.image || '/profile-portrait.jpg';

    return (
        <section id="about" className="relative overflow-hidden border-t border-foreground/5 bg-background py-24 text-foreground md:py-32 lg:py-40">
            <div className="container mx-auto grid items-center gap-14 px-6 md:grid-cols-2 md:px-12 lg:gap-24">
                {/* Visual Element */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 1.5, ease: 'easeOut' }}
                    className="mx-auto w-full max-w-sm md:max-w-none"
                >
                    <GlareHover
                        width="100%"
                        height="auto"
                        background="var(--color-surface)"
                        borderRadius="2px"
                        borderColor="rgba(255,255,255,0.08)"
                        glareOpacity={0.2}
                        glareAngle={-30}
                        glareSize={180}
                        transitionDuration={760}
                    >
                        <div className="relative aspect-4/5 overflow-hidden">
                            <div className="absolute inset-0 z-10 bg-black/10" />
                            <SeoImage
                                src={aboutImage || '/profile-portrait.jpg'}
                                alt={`Moyo Ayaworan ${profileType === 'photography' ? 'photographer' : 'visual artist'} portrait`}
                                fill
                                sizes="(min-width: 768px) 50vw, 100vw"
                                className="object-cover"
                            />
                        </div>
                    </GlareHover>
                </motion.div>

                {/* Text Content */}
                <motion.div
                    initial={{ opacity: 0, y: 50 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1, delay: 0.3 }}
                    className="space-y-8 md:space-y-12"
                >
                    <div className="space-y-4">
                        <span className="text-accent text-[10px] tracking-[0.28em] uppercase md:tracking-[0.4em]">{t('common.practice')}</span>
                        <h2 className="text-3xl font-heading leading-tight md:text-4xl">
                            {headline}
                        </h2>
                    </div>

                    <div className="max-w-lg space-y-6 md:space-y-8">
                        {bioParagraphs.map((paragraph) => (
                            <p key={paragraph} className="text-base leading-relaxed tracking-wide text-foreground/50 md:text-lg">
                                {paragraph}
                            </p>
                        ))}
                    </div>

                    <div className="flex items-center justify-between border-t border-foreground/10 pt-8">
                        <div className="space-y-1">
                            <p className="text-[10px] tracking-widest text-foreground/30 uppercase">Ijabiken Moyo</p>
                            <Link href={profileType === 'photography' ? '/photography/about' : '/art/about'} className="inline-block text-[10px] tracking-widest text-accent uppercase underline underline-offset-8 hover:text-foreground transition-colors">
                                {t('common.readFullBio')}
                            </Link>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
