'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { useTranslate } from '@/lib/translations';
import { socialLinks } from '@/lib/socialLinks';
import { useSiteSettings } from '@/lib/useSiteSettings';
import { FaBehance, FaInstagram, FaLink, FaXTwitter, FaYoutube } from 'react-icons/fa6';

type Social = { id?: number; platform: string; url: string; icon?: string };

const iconMap: Record<string, ReactNode> = {
    instagram: <FaInstagram size={18} />,
    behance: <FaBehance size={18} />,
    x: <FaXTwitter size={18} />,
    twitter: <FaXTwitter size={18} />,
    youtube: <FaYoutube size={18} />,
};

export default function Footer() {
    const { language } = useLanguage();
    const { t, translateText } = useTranslate(language);
    const settings = useSiteSettings();
    const [contact, setContact] = useState({ email: 'moyoayaworan@gmail.com', phone: '+2348148192201' });
    const [socials, setSocials] = useState<Social[]>(
        socialLinks.map((link) => ({ platform: link.name, url: link.href }))
    );

    useEffect(() => {
        fetch('/api/contact')
            .then((res) => res.json())
            .then((data) =>
                setContact({
                    email: data.contact?.email || 'moyoayaworan@gmail.com',
                    phone: data.contact?.phone || '+2348148192201',
                })
            )
            .catch(() => null);

        fetch('/api/socials')
            .then((res) => res.json())
            .then((data) => {
                if (Array.isArray(data.socials) && data.socials.length) setSocials(data.socials);
            })
            .catch(() => null);
    }, []);

    return (
        <footer className="border-t border-foreground/5 bg-background py-16 font-body md:py-24">
            <div className="container mx-auto px-6 md:px-12">
                <div className="mb-16 flex flex-col items-center justify-between gap-14 text-center md:mb-24 md:flex-row md:items-start md:gap-16 md:text-left">
                    <div className="flex min-w-0 w-full max-w-[240px] flex-col items-center gap-5 md:w-[260px] md:items-start md:gap-6">
                        <Link href="/" className="-mb-3 -mt-4 inline-flex h-16 w-16 items-center justify-center overflow-visible md:-mb-4 md:-mt-5 md:h-[76px] md:w-[76px]">
                            <Image
                                src="/brand/moyo-logo.png"
                                alt="Ijabiken Moyo"
                                width={160}
                                height={160}
                                className="theme-logo h-full w-full object-contain transition-opacity duration-300 hover:opacity-80"
                            />
                        </Link>
                        <p className="max-w-[220px] whitespace-pre-line text-xs uppercase leading-relaxed tracking-[0.18em] text-foreground/30 [overflow-wrap:anywhere] sm:tracking-widest">
                            {translateText(settings.footer.tagline || t('footer.tagline'))}
                        </p>
                    </div>

                    <div className="grid min-w-0 w-full grid-cols-1 gap-10 sm:grid-cols-2 md:w-auto md:grid-cols-3 md:gap-16 lg:gap-24">
                        <div className="space-y-6">
                            <span className="text-[10px] tracking-[0.22em] uppercase text-foreground/20 block font-medium sm:tracking-[0.3em]">{t('common.studio')}</span>
                            <ul className="space-y-4 text-[10px] tracking-widest uppercase text-foreground/60">
                                <li><Link href="/" className="hover:text-accent transition-colors">{t('common.about')}</Link></li>
                                <li><Link href="/photography" className="hover:text-accent transition-colors">{t('common.photography')}</Link></li>
                                <li><Link href="/art" className="hover:text-accent transition-colors">{t('common.fineArt')}</Link></li>
                            </ul>
                        </div>

                        <div className="space-y-6">
                            <span className="text-[10px] tracking-[0.22em] uppercase text-foreground/20 block font-medium sm:tracking-[0.3em]">{t('common.follow')}</span>
                            <div className="flex flex-wrap justify-center gap-4 md:justify-start">
                                {socials.map((link) => (
                                    <a
                                        key={`${link.platform}-${link.url}`}
                                        href={link.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        aria-label={translateText(link.platform)}
                                        className="text-foreground/60 hover:text-accent transition-colors"
                                    >
                                        {iconMap[(link.icon || link.platform || '').toLowerCase()] || <FaLink size={16} />}
                                    </a>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-6">
                            <span className="text-[10px] tracking-[0.22em] uppercase text-foreground/20 block font-medium sm:tracking-[0.3em]">{t('common.contact')}</span>
                            <p className="text-[10px] tracking-[0.18em] uppercase text-foreground/60 leading-relaxed [overflow-wrap:anywhere] sm:tracking-widest">
                                {contact.email} <br />
                                {contact.phone}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col items-center justify-between gap-6 border-t border-foreground/5 pt-10 md:flex-row md:gap-8 md:pt-12">
                    <p className="text-center text-[9px] uppercase tracking-[0.24em] text-foreground/20 md:text-left md:tracking-[0.4em]">
                        © 2026 IJABIKEN MOYO. {t('footer.rights')}
                    </p>
                    <div className="flex flex-wrap justify-center gap-6 text-[9px] uppercase tracking-[0.2em] text-foreground/20 md:gap-8 md:tracking-[0.4em]">
                        <Link href="/privacy" className="hover:text-foreground transition-colors">{translateText(settings.footer.privacyLabel || t('footer.privacy'))}</Link>
                        <Link href="/terms" className="hover:text-foreground transition-colors">{translateText(settings.footer.termsLabel || t('footer.terms'))}</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
