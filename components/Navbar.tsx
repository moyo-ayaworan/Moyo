'use client';

import { useState, useEffect, useSyncExternalStore } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useProfile } from '@/context/ProfileContext';
import { useLanguage } from '@/context/LanguageContext';
import { useTranslate } from '@/lib/translations';
import LanguageSwitcher from './LanguageSwitcher';
import ThemeToggle from './ThemeToggle';
import { motion, AnimatePresence } from 'framer-motion';
import { socialLinks } from '@/lib/socialLinks';
import { getStorageItem, setStorageItem } from '@/lib/browserStorage';

const subscribeToHydration = () => () => {};

export default function Navbar() {
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);
    const isInitialLoad = hydrated && !getStorageItem('session', 'moreli_nav_played');
    useEffect(() => {
        setStorageItem('session', 'moreli_nav_played', 'true');
    }, []);
    const { profile, setProfile } = useProfile(); // We need setProfile for the mobile switcher
    const { language } = useLanguage();
    const { t, translateText } = useTranslate(language);
    const pathname = usePathname();
    const router = useRouter();

    const handleProfileSelect = (choice: 'photography' | 'art') => {
        setProfile(choice);
        setMobileMenuOpen(false);
        router.push(choice === 'photography' ? '/photography' : '/art');
    };

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 50);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Close mobile menu on route change
    useEffect(() => {
        const timeout = window.setTimeout(() => setMobileMenuOpen(false), 0);
        return () => window.clearTimeout(timeout);
    }, [pathname]);

    // Lock body scroll when menu is open
    useEffect(() => {
        if (!mobileMenuOpen) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const desktop = window.matchMedia('(min-width: 1280px)');
        const closeOnDesktop = () => { if (desktop.matches) setMobileMenuOpen(false); };
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setMobileMenuOpen(false);
        };
        desktop.addEventListener('change', closeOnDesktop);
        window.addEventListener('keydown', closeOnEscape);
        return () => {
            document.body.style.overflow = previousOverflow;
            desktop.removeEventListener('change', closeOnDesktop);
            window.removeEventListener('keydown', closeOnEscape);
        };
    }, [mobileMenuOpen]);

    const photographyLinks = [
        { name: t('common.photography'), href: '/photography' },
        { name: translateText('Portfolio'), href: '/photography/portfolio' },
        { name: t('common.bookings'), href: '/photography/bookings' },
        { name: t('common.clientGallery'), href: '/photography/client-gallery' },
        { name: t('common.about'), href: '/photography/about' },
    ];

    const artLinks = [
        { name: t('common.fineArt'), href: '/art' },
        { name: t('common.works'), href: '/art/works' },
        { name: translateText('Shop'), href: '/art/shop' },
        { name: t('common.commissions'), href: '/art/commissions' },
        { name: t('common.exhibitions'), href: '/art/exhibitions' },
        { name: t('common.about'), href: '/art/about' },
    ];

    const links = profile === 'art' ? artLinks : photographyLinks;

    return (
        <>
            <nav
                className={cn(
                    'fixed left-0 right-0 top-0 z-[80] flex min-h-14 items-center justify-between gap-3 border-b px-4 backdrop-blur-xl transition-all duration-700 ease-in-out sm:min-h-16 sm:px-5 md:min-h-18 md:px-7 xl:gap-7 xl:px-10',
                    scrolled ? 'border-foreground/10 bg-background/85 shadow-[0_18px_60px_rgba(0,0,0,0.08)]' : 'border-transparent bg-background/20'
                )}
            >
                {/* Brand */}
                <motion.div
                    initial={isInitialLoad ? { opacity: 0 } : false}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4, delay: isInitialLoad ? 0.6 : 0, ease: "easeOut" }}
                    className="shrink-0"
                >
                    <Link href="/" className="group z-50 relative">
                        <Image
                            src="/brand/moyo-logo.png"
                            alt="Ijabiken Moyo"
                            width={160}
                            height={160}
                            loading="eager"
                            fetchPriority="low"
                            className="theme-logo h-8 w-8 object-contain transition-opacity duration-300 group-hover:opacity-80 sm:h-9 sm:w-9 md:h-10 md:w-10 lg:h-11 lg:w-11"
                        />
                    </Link>
                </motion.div>

                {/* Profile Toggle In Mini Mode (Desktop) */}
                <motion.div
                    initial={isInitialLoad ? { opacity: 0 } : false}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: isInitialLoad ? 0.9 : 0, ease: "easeOut" }}
                    className="entry-selector-frost relative z-10 hidden items-center gap-1 rounded-full px-1.5 py-1 xl:flex"
                >
                    <Link
                        href="/photography"
                        className={cn(
                            "relative whitespace-nowrap rounded-full px-3.5 py-1.5 text-[9px] uppercase tracking-[0.16em] transition-colors duration-500",
                            profile === 'photography' ? "text-background" : "text-foreground/40 hover:text-foreground"
                        )}
                    >
                        {t('common.photography')}
                        {profile === 'photography' && (
                            <motion.div layoutId="navToggleKnob" className="absolute inset-0 bg-foreground rounded-full -z-10" transition={{ type: 'spring', stiffness: 400, damping: 35 }} />
                        )}
                    </Link>
                    <Link
                        href="/art"
                        className={cn(
                            "relative whitespace-nowrap rounded-full px-3.5 py-1.5 text-[9px] uppercase tracking-[0.16em] transition-colors duration-500",
                            profile === 'art' ? "text-background" : "text-foreground/40 hover:text-foreground"
                        )}
                    >
                        {t('common.fineArt')}
                        {profile === 'art' && (
                            <motion.div layoutId="navToggleKnob" className="absolute inset-0 bg-foreground rounded-full -z-10" transition={{ type: 'spring', stiffness: 400, damping: 35 }} />
                        )}
                    </Link>
                </motion.div>

                {/* Desktop Nav Links */}
                <motion.div
                    initial={isInitialLoad ? { opacity: 0 } : false}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: isInitialLoad ? 1.0 : 0, staggerChildren: 0.1, ease: "easeOut" }}
                    className="relative z-10 ml-auto hidden min-w-0 items-center gap-4 xl:flex xl:gap-6"
                >
                    <div className="flex min-w-0 items-center gap-3 text-[8px] font-body tracking-[0.14em] text-foreground/60 xl:gap-5 xl:text-[9px] xl:tracking-[0.18em]">
                        {links.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={cn(
                                    "whitespace-nowrap hover:text-foreground transition-colors duration-300 uppercase",
                                    pathname === link.href && "text-foreground font-medium"
                                )}
                            >
                                {link.name}
                            </Link>
                        ))}
                    </div>

                    <div className="h-8 w-px shrink-0 bg-foreground/10" />

                    <div className="flex items-center gap-2 xl:gap-2.5">
                        <ThemeToggle className="h-11 w-11 rounded-md border-foreground/10 [&_svg]:h-4 [&_svg]:w-4" />
                        <LanguageSwitcher className="h-11 rounded-md border-foreground/10 px-3 text-[9px] xl:px-4" />
                        {profile === 'photography' ? (
                            <Link
                                href="/photography/bookings"
                                className="inline-flex h-11 shrink-0 items-center justify-center rounded-md border border-foreground bg-foreground px-5 text-[9px] font-semibold uppercase tracking-[0.18em] text-background transition-all duration-300 hover:border-accent hover:bg-accent hover:text-background xl:px-6"
                            >
                                {t('common.bookNow')}
                            </Link>
                        ) : (
                            <Link
                                href="/art/newsletter"
                                className="inline-flex h-11 shrink-0 items-center justify-center rounded-md border border-foreground/20 px-5 text-[9px] font-semibold uppercase tracking-[0.18em] text-foreground transition-all duration-300 hover:border-accent hover:text-accent xl:px-6"
                            >
                                {t('common.newsletter')}
                            </Link>
                        )}
                    </div>
                </motion.div>

                <div className="relative z-10 ml-auto flex items-center gap-1 sm:gap-2 xl:hidden">
                    <ThemeToggle className="h-10 w-10 sm:h-11 sm:w-11 [&_svg]:h-4 [&_svg]:w-4" />
                    <LanguageSwitcher className="h-10 px-2.5 text-[9px] sm:h-11 sm:px-3" />

                    {/* Mobile Menu Toggle */}
                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        type="button"
                        className="group relative z-[90] flex h-10 w-10 flex-col items-end justify-center gap-1.5 rounded-md border border-transparent transition-colors duration-300 hover:border-foreground/10 hover:bg-white/10 focus:outline-none sm:h-11 sm:w-11"
                        aria-label={mobileMenuOpen ? t('ui.closeMenu') : t('ui.openMenu')}
                        aria-expanded={mobileMenuOpen}
                        aria-controls="mobile-navigation"
                    >
                        <motion.div
                            animate={mobileMenuOpen ? { rotate: 45, y: 6 } : { rotate: 0, y: 0 }}
                            className="h-[1px] w-7 bg-foreground transition-colors duration-300 group-hover:bg-accent sm:w-8"
                        />
                        <motion.div
                            animate={mobileMenuOpen ? { opacity: 0 } : { opacity: 1 }}
                            className="h-[1px] w-5 self-end bg-foreground transition-colors duration-300 group-hover:bg-accent"
                        />
                        <motion.div
                            animate={mobileMenuOpen ? { rotate: -45, y: -6, width: 32 } : { rotate: 0, y: 0, width: 20 }}
                            className="h-[1px] w-5 self-end bg-foreground transition-colors duration-300 group-hover:bg-accent"
                        />
                    </button>
                </div>
            </nav>

            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <motion.div
                        id="mobile-navigation"
                        initial={{ opacity: 0, y: '-100%' }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: '-100%' }}
                        transition={{ duration: 0.5, ease: [0.19, 1, 0.22, 1] }}
                        className="fixed inset-0 z-[70] overflow-y-auto bg-black/95 backdrop-blur-3xl xl:hidden"
                    >
                        <div className="flex min-h-dvh flex-col items-center justify-center space-y-10 px-5 py-24 sm:px-8">

                            {/* Profile Switcher Mobile */}
                            <div className="entry-selector-frost mb-4 flex max-w-full flex-wrap items-center justify-center gap-1 rounded-full px-2 py-1">
                                <button
                                    onClick={() => handleProfileSelect('photography')}
                                    aria-pressed={profile === 'photography'}
                                    className={cn(
                                        "px-4 py-2 rounded-full text-[10px] tracking-widest uppercase transition-all duration-500 sm:px-6 sm:text-xs",
                                        profile === 'photography' ? "bg-foreground text-background" : "text-foreground/40"
                                    )}
                                >
                                    {t('common.photography')}
                                </button>
                                <button
                                    onClick={() => handleProfileSelect('art')}
                                    aria-pressed={profile === 'art'}
                                    className={cn(
                                        "px-4 py-2 rounded-full text-[10px] tracking-widest uppercase transition-all duration-500 sm:px-6 sm:text-xs",
                                        profile === 'art' ? "bg-foreground text-background" : "text-foreground/40"
                                    )}
                                >
                                    {t('common.fineArt')}
                                </button>
                            </div>

                            {/* Links */}
                            <div className="flex flex-col items-center space-y-6">
                                {links.map((link, i) => (
                                    <motion.div
                                        key={link.href}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.2 + (i * 0.1) }}
                                    >
                                        <Link
                                            href={link.href}
                                            className="text-center font-heading text-2xl text-foreground hover:text-accent transition-colors sm:text-3xl"
                                            onClick={() => setMobileMenuOpen(false)}
                                        >
                                            {link.name}
                                        </Link>
                                    </motion.div>
                                ))}
                            </div>

                            <div className="w-12 h-px bg-foreground/10" />

                            <div className="flex flex-col items-center gap-8">
                                <div className="flex items-center gap-4">
                                    <ThemeToggle />
                                </div>

                                <div className="flex gap-8 text-foreground/40">
                                    {socialLinks.map((link) => (
                                        <a
                                            key={link.name}
                                            href={link.href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            aria-label={link.name}
                                            className="hover:text-foreground transition-colors text-xs tracking-widest uppercase"
                                        >
                                            {link.icon}
                                        </a>
                                    ))}
                                </div>
                            </div>

                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
