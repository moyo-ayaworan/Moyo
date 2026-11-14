'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLanguage } from '@/context/LanguageContext';
import { useTranslate } from '@/lib/translations';
import GlareHover from '@/components/GlareHover';
import { useSiteSettings } from '@/lib/useSiteSettings';

interface NewsletterFormProps {
    profileType: 'photography' | 'art';
}

export default function NewsletterForm({ profileType }: NewsletterFormProps) {
    const { language } = useLanguage();
    const { t, translateText } = useTranslate(language);
    const settings = useSiteSettings();
    const [email, setEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [showToast, setShowToast] = useState(false);
    const [confirmationMessage, setConfirmationMessage] = useState('');

    const title = profileType === 'photography'
        ? translateText(settings.newsletter.photographyTitle || t('newsletter.photography.title'))
        : t('newsletter.art.title');

    const description = profileType === 'photography'
        ? translateText(settings.newsletter.photographyDescription || t('newsletter.photography.description'))
        : t('newsletter.art.description');

    const buttonText = profileType === 'photography'
        ? translateText(settings.newsletter.photographyButton || t('newsletter.photography.button'))
        : t('newsletter.art.button');

    useEffect(() => {
        if (!showToast) return;
        const timer = window.setTimeout(() => setShowToast(false), 3200);
        return () => window.clearTimeout(timer);
    }, [showToast]);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError('');
        setShowToast(false);
        setIsSubmitting(true);

        try {
            const res = await fetch('/api/newsletter/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, listType: profileType }),
            });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || t('newsletter.subscribeError'));
            }

            setConfirmationMessage(data.message || 'Check your inbox to confirm your subscription.');
            setEmail('');
            setShowToast(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : t('newsletter.subscribeError'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
            className="w-full max-w-xl space-y-9 px-6 text-center md:space-y-12 md:px-0"
        >
            <div className="min-w-0 space-y-4">
                <span className="text-accent text-[10px] uppercase tracking-[0.22em] [overflow-wrap:anywhere] md:tracking-[0.5em]">
                    {translateText(settings.newsletter.eyebrow || t('newsletter.title'))}
                </span>
                <h2 className="text-3xl font-heading text-foreground [overflow-wrap:anywhere] md:text-4xl">{title}</h2>
                <p className="leading-relaxed tracking-wide text-foreground/40 [overflow-wrap:anywhere]">
                    {description}
                </p>
            </div>

            <GlareHover
                width="100%"
                height="auto"
                background="transparent"
                borderRadius="2px"
                borderColor="rgba(255,255,255,0.08)"
                glareOpacity={0.14}
                glareAngle={-30}
                glareSize={170}
                transitionDuration={760}
                className="mx-auto max-w-md"
                contentClassName="px-4 py-6"
            >
                <form onSubmit={handleSubmit} className="relative group">
                    <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder={t('newsletter.placeholder')}
                        className="w-full border-b border-foreground/20 bg-transparent py-4 text-center text-[10px] font-medium tracking-[0.12em] text-foreground transition-colors placeholder:text-foreground/20 focus:border-accent focus:outline-none sm:tracking-[0.3em]"
                        required
                    />
                    {error && (
                        <p className="mt-4 text-[10px] text-red-400 tracking-widest uppercase">
                            {error}
                        </p>
                    )}
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="mt-10 w-full bg-foreground px-4 py-5 text-[10px] font-bold uppercase tracking-[0.18em] text-background transition-colors duration-500 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60 sm:mt-12 sm:tracking-[0.5em]"
                    >
                        {isSubmitting ? t('ui.subscribing') : buttonText}
                    </button>
                </form>
            </GlareHover>

            <p className="text-[10px] uppercase tracking-widest text-foreground/20">
                {t('newsletter.privacy')}
            </p>

            <AnimatePresence>
                {showToast && (
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 16 }}
                        role="status"
                        aria-live="polite"
                        className="fixed bottom-6 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 border border-accent/40 bg-background/95 px-5 py-4 text-center text-[10px] font-bold uppercase tracking-[0.28em] text-accent shadow-2xl backdrop-blur-md md:left-auto md:right-6 md:translate-x-0"
                    >
                        {confirmationMessage}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
