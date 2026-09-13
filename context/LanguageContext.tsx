'use client';

import React, { createContext, useContext, useSyncExternalStore, ReactNode, useEffect } from 'react';
import { getStorageItem, setStorageItem } from '@/lib/browserStorage';

export type LanguageCode = 'EN' | 'FR' | 'ES' | 'DE' | 'PT' | 'AR' | 'ZH' | 'YO' | 'IG' | 'HA';
const LANGUAGE_CODES: LanguageCode[] = ['EN', 'FR', 'ES', 'DE', 'PT', 'AR', 'ZH', 'YO', 'IG', 'HA'];

let fallbackLanguage: LanguageCode = 'EN';

function getLanguage(): LanguageCode {
    const saved = getStorageItem('local', 'moyo_lang');
    return LANGUAGE_CODES.includes(saved as LanguageCode) ? saved as LanguageCode : fallbackLanguage;
}

function subscribeToLanguage(onChange: () => void) {
    window.addEventListener('storage', onChange);
    window.addEventListener('moyo-language-change', onChange);
    return () => {
        window.removeEventListener('storage', onChange);
        window.removeEventListener('moyo-language-change', onChange);
    };
}

interface LanguageContextType {
    language: LanguageCode;
    setLanguage: (lang: LanguageCode) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
    const language = useSyncExternalStore(subscribeToLanguage, getLanguage, (): LanguageCode => 'EN');

    useEffect(() => {
        document.documentElement.dir = language === 'AR' ? 'rtl' : 'ltr';
        document.documentElement.lang = language.toLowerCase();
    }, [language]);

    const handleSetLanguage = (lang: LanguageCode) => {
        fallbackLanguage = lang;
        setStorageItem('local', 'moyo_lang', lang);
        window.dispatchEvent(new Event('moyo-language-change'));
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
}
