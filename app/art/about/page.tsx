'use client';

import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { motion } from 'framer-motion';
import { useLanguage } from '@/context/LanguageContext';
import { useTranslate } from '@/lib/translations';
import GlareHover from '@/components/GlareHover';
import SeoImage from '@/components/SeoImage';
import Link from 'next/link';
import { exhibitionRecords, professionalEngagements, workshopRecords } from '@/lib/artArchive';

export default function ArtAboutPage() {
    const { language } = useLanguage();
    const { t, translateText } = useTranslate(language);
    const bioParagraphs = [
        'Ijabiken Moyosoreoluwa, known as Moyo Ayaworan, is a Nigerian visual artist and photographer based in Lagos. His practice centres on contemporary portraiture and the raw emotional conditions carried by the human figure.',
        'Working across photography, painting and digital media, he uses moody, dramatic colour to give each image emotional depth. The movement between camera and studio practice allows observation, composition and material experimentation to inform one another.',
        'He studied General Art at Yaba College of Technology, graduating with an Upper Credit Ordinary National Diploma in 2022. His professional development includes work with Yaba Art Museum and participation in exhibitions, installations and collaborative workshops across Lagos and Abuja.',
    ];

    return (
        <main className="bg-background min-h-screen">
            <Navbar />
            <div className="container mx-auto px-6 pb-24 pt-36 md:px-12 md:pb-32 md:pt-52">
                <div className="grid gap-14 lg:grid-cols-12 lg:gap-20">
                    <div className="space-y-10 lg:col-span-7 lg:space-y-16">
                        <header className="space-y-6">
                            <span className="text-accent text-[10px] uppercase tracking-[0.32em] md:tracking-[0.5em]">{t('profilePage.biography')}</span>
                            <h1 className="text-4xl font-heading italic text-white md:text-5xl">{t('profilePage.artist')}</h1>
                        </header>

                        <motion.div
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 1 }}
                            transition={{ duration: 1.5 }}
                            className="max-w-2xl space-y-8 text-base leading-relaxed text-white/60 md:space-y-12 md:text-xl"
                        >
                            {bioParagraphs.map((paragraph) => (
                                <p key={paragraph}>{translateText(paragraph)}</p>
                            ))}
                        </motion.div>

                        <div className="grid grid-cols-1 gap-10 border-t border-white/5 pt-10 sm:grid-cols-3 md:gap-16 md:pt-12">
                            <div className="space-y-4">
                                <span className="text-[10px] tracking-[0.4em] uppercase text-accent">{t('profilePage.focus')}</span>
                                <p className="text-[10px] tracking-widest text-white/40 uppercase leading-relaxed whitespace-pre-line">{t('profilePage.focusItems')}</p>
                            </div>
                            <div className="space-y-4">
                                <span className="text-[10px] tracking-[0.4em] uppercase text-accent">{t('profilePage.mediums')}</span>
                                <p className="text-[10px] tracking-widest text-white/40 uppercase leading-relaxed whitespace-pre-line">{t('profilePage.mediumsItems')}</p>
                            </div>
                            <div className="space-y-4">
                                <span className="text-[10px] tracking-[0.4em] uppercase text-accent">{t('profilePage.base')}</span>
                                <p className="text-[10px] tracking-widest text-white/40 uppercase leading-relaxed whitespace-pre-line">{t('profilePage.baseItems')}</p>
                            </div>
                        </div>

                        <div className="grid gap-8 border-t border-white/10 pt-10 md:grid-cols-2">
                            <div><p className="text-[10px] uppercase tracking-[0.35em] text-accent">Education</p><p className="mt-4 text-sm leading-relaxed text-white/55">2020–2022 · Ordinary National Diploma in General Art, Upper Credit<br />Yaba College of Technology, Lagos</p></div>
                            <div><p className="text-[10px] uppercase tracking-[0.35em] text-accent">Professional engagement</p><p className="mt-4 text-sm leading-relaxed text-white/55">2020 · Intern, Yaba Art Museum<br />2023 · Installation teams, Yaba Art Museum and Yusuf Grillo Museum</p></div>
                        </div>

                        <section className="space-y-10 border-t border-white/10 pt-12">
                            <div><p className="text-[10px] uppercase tracking-[0.35em] text-accent">Selected exhibitions</p><div className="mt-5 divide-y divide-white/10 border-y border-white/10">{exhibitionRecords.map((item) => <Link key={item.slug} href={`/art/exhibitions/${item.slug}`} className="group grid gap-2 py-5 sm:grid-cols-[70px_1fr] sm:gap-5"><span className="text-xs text-white/30">{item.year}</span><span><strong className="font-heading text-lg font-normal text-white transition-colors group-hover:text-accent">{item.title}</strong><span className="mt-1 block text-xs leading-relaxed text-white/40">{item.venue} · {item.city}</span></span></Link>)}</div></div>
                            <div><p className="text-[10px] uppercase tracking-[0.35em] text-accent">Workshops and collaborations</p><div className="mt-5 space-y-6">{workshopRecords.map((item) => <div key={item.title}><h3 className="font-heading text-lg text-white">{item.year} · {item.title}</h3><p className="mt-2 text-sm leading-relaxed text-white/45">{item.detail}</p></div>)}</div></div>
                            <div><p className="text-[10px] uppercase tracking-[0.35em] text-accent">Museum and installation experience</p><div className="mt-5 space-y-6">{professionalEngagements.map((item) => <div key={item.title}><h3 className="font-heading text-lg text-white">{item.year} · {item.title}</h3><p className="mt-2 text-sm leading-relaxed text-white/45">{item.detail}</p></div>)}</div></div>
                            <div><p className="text-[10px] uppercase tracking-[0.35em] text-accent">Languages</p><p className="mt-4 text-sm leading-relaxed text-white/55">Yoruba and English</p></div>
                        </section>
                    </div>

                    <div className="space-y-8 lg:col-span-5 lg:space-y-12">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 2, ease: "easeOut" }}
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
                                <div className="relative aspect-[3/4] overflow-hidden bg-neutral-900">
                                    <SeoImage
                                        src="/profile-portrait.jpg"
                                        alt="Moyo Ayaworan visual artist portrait"
                                        fill
                                        sizes="(min-width: 1024px) 42vw, 100vw"
                                        preload
                                        className="object-cover"
                                    />
                                </div>
                            </GlareHover>
                        </motion.div>
                        <div className="space-y-2">
                            <p className="text-[10px] tracking-[0.5em] uppercase text-white/20">{t('profilePage.studioPortrait')}</p>
                        </div>
                    </div>
                </div>
            </div>
            <Footer />
        </main>
    );
}
