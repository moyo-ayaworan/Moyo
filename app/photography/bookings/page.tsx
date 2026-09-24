'use client';

import React, { useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { motion } from 'framer-motion';
import { useLanguage } from '@/context/LanguageContext';
import { useTranslate } from '@/lib/translations';
import { useProfile } from '@/context/ProfileContext';
import BookingForm from '@/components/BookingForm';
import BookingAccess from '@/components/BookingAccess';

export default function BookingsPage() {
    const { language } = useLanguage();
    const { t } = useTranslate(language);
    const { setProfile } = useProfile();

    useEffect(() => {
        setProfile('photography');
    }, [setProfile]);

    return (
        <main className="bg-background min-h-screen">
            <Navbar />
            <div className="pt-32 md:pt-44 container mx-auto px-6 md:px-12 pb-28">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-12"
                >
                    <div className="mx-auto max-w-2xl space-y-4 text-center">
                        <span className="text-accent text-[10px] tracking-[0.5em] uppercase">{t('bookingsPage.privateBooking')}</span>
                        <h1 className="text-3xl md:text-4xl font-heading text-foreground">{t('bookingsPage.captureVision')}</h1>
                        <p className="text-foreground/50 font-body">
                            {t('bookingsPage.inquiryDescription')}
                        </p>
                    </div>

                    <BookingForm embedded />

                    <div className="mx-auto max-w-3xl pt-4">
                        <BookingAccess />
                    </div>
                </motion.div>
            </div>
            <Footer />
        </main>
    );
}
