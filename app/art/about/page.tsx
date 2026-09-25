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
import { awardRecords, exhibitionRecords, professionalEngagements, workshopRecords } from '@/lib/artArchive';

export default function ArtAboutPage() {
    const { language } = useLanguage();
    const { t, translateText } = useTranslate(language);
    const bioParagraphs = [
        'Ijabiken Moyosoreoluwa is a multidisciplinary Nigerian artist whose practice explores emotion, identity and the silent battles carried within the human figure. He works through painting, photography and digital media to examine the space between vulnerability and strength, private experience and shared humanity.',
        'Guided early by the mentorship of a secondary-school fine arts teacher, he developed an artistic voice grounded in close observation and emotional honesty. Moody palettes, cinematic light and atmospheric contrast are not simply stylistic choices; they are tools for making internal states visible.',
        'He earned an Upper Credit Ordinary National Diploma in General Art from Yaba College of Technology in 2022 and has since completed a Higher National Diploma in Painting with Upper Credit. His work with Yaba Art Museum and participation in exhibitions, installations and collaborative workshops continue to expand his technical and curatorial experience.',
        'His work has been presented in Nigeria and internationally, including a group exhibition associated with the Cincinnati Museum in Ohio and The Currency Lab in Freiburg, Germany. In 2024, he was selected as one of the Life In My City Art Festival Top 100 artists.',
        'Based in Lagos, he draws from the energy of the city and the cultural histories that surround him. His studio practice creates a dialogue between an inner world and a broader human narrative, allowing personal and collective stories to converge across materials and forms.',
    ];
    const statementParagraphs = [
        'My work explores the inner landscape: the deep, cerebral realms of emotion, identity and the silent battles we wage within ourselves. Inspired by the inner wars I fight, I use dramatic, cinematic lighting and moody colours to evoke the tension, resilience and raw vulnerability that define the human experience.',
        'Each piece I create—whether through photography, acrylic, oil on canvas or digital painting—serves as an intimate reflection of these struggles. My portraits are more than representations; they are personal narratives that invite viewers to confront their own inner conflicts and emotions.',
        'By merging traditional and digital techniques, I aim to bridge the tangible and the abstract. Bold contrasts and atmospheric tones are deliberate tools for expressing the complexity of our inner worlds, where light and shadow, strength and fragility coexist.',
        'Each piece is an extension of myself: a glimpse into a space that is both private and universal. I share these inner wars openly, trusting that their echoes will resonate with others and invite a pause for reflection, connection and introspection.',
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
                            <div><p className="text-[10px] uppercase tracking-[0.35em] text-accent">Education</p><p className="mt-4 text-sm leading-relaxed text-white/55">2020–2022 · Ordinary National Diploma in General Art, Upper Credit<br />Higher National Diploma in Painting · Upper Credit<br />Yaba College of Technology, Lagos</p></div>
                            <div><p className="text-[10px] uppercase tracking-[0.35em] text-accent">Professional engagement</p><p className="mt-4 text-sm leading-relaxed text-white/55">2020 · Intern, Yaba Art Museum<br />2023 · Installation teams, Yaba Art Museum and Yusuf Grillo Museum</p></div>
                        </div>

                        <section className="border-t border-white/10 pt-12"><p className="text-[10px] uppercase tracking-[0.4em] text-accent">Artist statement</p><h2 className="mt-5 font-heading text-3xl italic text-white">The inner landscape</h2><div className="mt-8 max-w-2xl space-y-7 text-base leading-relaxed text-white/55">{statementParagraphs.map((paragraph) => <p key={paragraph}>{translateText(paragraph)}</p>)}</div></section>

                        <section className="space-y-10 border-t border-white/10 pt-12">
                            <div><p className="text-[10px] uppercase tracking-[0.35em] text-accent">Awards and recognition</p><div className="mt-5 space-y-6">{awardRecords.map((item) => <div key={item.title}><h3 className="font-heading text-lg text-white">{item.year} · {item.title}</h3><p className="mt-2 text-sm leading-relaxed text-white/45">{item.detail}</p></div>)}</div></div>
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
