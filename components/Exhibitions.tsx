'use client';

import { motion } from 'framer-motion';
import { useLanguage } from '@/context/LanguageContext';
import { useTranslate } from '@/lib/translations';
import GlareHover from '@/components/GlareHover';

const events = [
    { year: '2023', title: 'Inspiring Minds', venue: 'Embassy of Spain · Thought Pyramid', city: 'Abuja' },
    { year: '2023', title: 'GELEDE COMES', venue: 'Yaba Art Museum', city: 'Lagos' },
    { year: '2023', title: 'Visual Energy', venue: 'Shodex Art Gallery', city: 'Lagos' },
    { year: '2023', title: 'TotalEnergies Open House Exhibition', venue: 'TotalEnergies', city: 'Lagos' },
    { year: '2023', title: 'FIX IT', venue: 'Thought Pyramid · Life in My City Art Festival', city: 'Lagos' },
    { year: '2023', title: 'Life Art and Nature', venue: 'Shodex Art Gallery', city: 'Lagos' },
    { year: '2022', title: 'TotalEnergies Open House Exhibition', venue: 'TotalEnergies', city: 'Lagos' },
    { year: '2022', title: 'Group Exhibition', venue: 'Disrupt Art · Christie · NFT Media Labs · Schiff Insurance · Cincinnati Museum', city: 'International collaboration' },
];

export default function Exhibitions() {
    const { language } = useLanguage();
    const { t, translateText } = useTranslate(language);

    return (
        <section id="exhibitions" className="bg-background py-24 md:py-32 lg:py-40">
            <div className="container mx-auto px-6 md:px-12">
                <div className="flex flex-col gap-12 md:flex-row md:gap-20">
                    {/* Header */}
                    <div className="md:w-1/3 space-y-6">
                        <span className="block text-accent text-[10px] uppercase tracking-[0.32em] md:tracking-[0.5em]">{t('exhibitions.timeline')}</span>
                        <h2 className="text-3xl font-heading font-light text-foreground md:text-4xl">
                            {/* Splitting for style if possible, or just rendering */}
                            <span className="italic">{t('exhibitions.selectedExhibitions')}</span>
                        </h2>
                        <p className="text-foreground/40 text-sm max-w-xs font-body tracking-wide leading-relaxed">
                            {t('exhibitions.chronology')}
                        </p>
                    </div>

                    {/* List */}
                    <div className="md:w-2/3 space-y-px bg-foreground/5 border border-foreground/5">
                        {events.map((event, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0 }}
                                whileInView={{ opacity: 1 }}
                                transition={{ duration: 0.8, delay: index * 0.1 }}
                                className="group relative border-b border-foreground/5 transition-all duration-500 last:border-0"
                            >
                                <GlareHover
                                    width="100%"
                                    height="auto"
                                    background="transparent"
                                    borderRadius="0"
                                    borderColor="transparent"
                                    glareOpacity={0.16}
                                    glareAngle={-30}
                                    glareSize={160}
                                    transitionDuration={720}
                                    contentClassName="flex items-center justify-between p-6 md:p-10"
                                >
                                    <div className="flex items-baseline gap-5 md:gap-12">
                                        <span className="text-sm font-heading text-foreground/20 transition-colors duration-500 group-hover:text-accent">
                                            {event.year}
                                        </span>
                                        <div className="space-y-1">
                                            <h3 className="text-xl font-heading text-foreground transition-all duration-500 group-hover:italic md:text-2xl">
                                                {translateText(event.title)}
                                            </h3>
                                            <p className="text-[10px] uppercase tracking-widest text-foreground/30">
                                                {translateText(event.venue)} — {translateText(event.city)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="hidden opacity-0 transition-opacity duration-500 group-hover:opacity-100 md:block">
                                        <span className="border-b border-foreground pb-1 text-[10px] font-medium uppercase tracking-[0.3em] text-foreground">
                                            {t('exhibitions.details')}
                                        </span>
                                    </div>
                                </GlareHover>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
