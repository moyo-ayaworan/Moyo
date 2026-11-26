'use client';

import dynamic from 'next/dynamic';
import {isPrivatePage} from '@/lib/privatePaths';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ProfileProvider } from '@/context/ProfileContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { ThemeProvider } from '@/components/ThemeProvider';
import { RegionalPricingProvider } from '@/components/RegionalPricing';
import ClickSpark from '@/components/ClickSpark';
import AnalyticsTracker from '@/components/AnalyticsTracker';

const SessionTracker = dynamic(() => import('@/components/SessionTracker'), { ssr: false });
const SocialLinks = dynamic(() => import('@/components/SocialLinks'), { ssr: false });
const EniyanChat = dynamic(() => import('@/components/EniyanChat'), { ssr: false });

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  useEffect(()=>{
    // Enter private pages as a fresh document so their stricter CSP takes effect.
    if(isPrivatePage(pathname)&&!document.querySelector<HTMLScriptElement>('script[nonce]')?.nonce)
      window.location.replace(window.location.href);
  },[pathname]);
  const privateWorkspace = pathname === '/admin' || pathname.startsWith('/admin/');
  const productPage = pathname === '/stillbounds' || pathname.startsWith('/stillbounds/') || privateWorkspace;
  const purchasePage = /\/shop\/(?:products\/|payment)/.test(pathname);
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
      {!productPage && !purchasePage && <SocialLinks />}
      <EniyanChat hidden={productPage || purchasePage} />
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
          <AnalyticsTracker />
          {!productPage && <SessionTracker />}
          {enablePointerEffects && !privateWorkspace ? (
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
          <RegionalPricingProvider>{page}</RegionalPricingProvider>
        </ProfileProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
