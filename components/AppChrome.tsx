'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { ProfileProvider } from '@/context/ProfileContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { ThemeProvider } from '@/components/ThemeProvider';
import ClickSpark from '@/components/ClickSpark';

const SessionTracker = dynamic(() => import('@/components/SessionTracker'), { ssr: false });
const SocialLinks = dynamic(() => import('@/components/SocialLinks'), { ssr: false });
const EniyanChat = dynamic(() => import('@/components/EniyanChat'), { ssr: false });

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const [enablePointerEffects, setEnablePointerEffects] = useState(false);

  useEffect(() => {
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const update = () => {
      setEnablePointerEffects(finePointer.matches && !reducedMotion.matches);
    };

    update();
    finePointer.addEventListener('change', update);
    reducedMotion.addEventListener('change', update);

    return () => {
      finePointer.removeEventListener('change', update);
      reducedMotion.removeEventListener('change', update);
    };
  }, []);

  const page = (
    <>
      {children}
      <SocialLinks />
      <EniyanChat />
    </>
  );

  return (
    <ThemeProvider
      attribute="data-theme"
      defaultTheme="dark"
      enableSystem={false}
      storageKey="moyo-theme"
      disableTransitionOnChange
    >
      <LanguageProvider>
        <ProfileProvider>
          <SessionTracker />
          {enablePointerEffects ? (
            <>
              <ClickSpark
                sparkColor="#920110"
                sparkSize={12}
                sparkRadius={22}
                sparkCount={8}
                duration={460}
                extraScale={1.1}
              >
                {null}
              </ClickSpark>
            </>
          ) : null}
          {page}
        </ProfileProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
