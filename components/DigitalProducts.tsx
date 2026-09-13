'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/context/LanguageContext';
import { useTranslate } from '@/lib/translations';
import GlareHover from '@/components/GlareHover';
import { useSiteSettings } from '@/lib/useSiteSettings';
import SeoImage from '@/components/SeoImage';

type DigitalProduct = {
    id: number;
    title: string;
    price: string;
    details: string;
    image: string;
    product_url?: string;
    is_active?: boolean;
};

const fallbackProducts: DigitalProduct[] = [
    { id: 1, title: 'Editorial Presets Vol. 1', price: '$45.00', details: '10 Lightroom Presets', image: '/image-placeholder.svg', is_active: true },
    { id: 2, title: 'Darkroom Masterclass', price: '$120.00', details: 'Video Course (3 Hours)', image: '/image-placeholder.svg', is_active: true },
    { id: 3, title: 'Fine Art Texture Pack', price: '$30.00', details: '50 High-Res Overlays', image: '/image-placeholder.svg', is_active: true }
];

export default function DigitalProducts() {
    const { language } = useLanguage();
    const { t, translateText } = useTranslate(language);
    const settings = useSiteSettings();
    const [products, setProducts] = useState<DigitalProduct[]>(fallbackProducts);

    useEffect(() => {
        fetch('/api/digital-products')
            .then((res) => res.json())
            .then((data: { products?: DigitalProduct[] }) => {
                const activeProducts = (data.products || []).filter((product) => product.is_active !== false);
                if (activeProducts.length) setProducts(activeProducts);
            })
            .catch(() => null);
    }, []);

    return (
        <section id="digital-shop" className="border-t border-white/5 bg-background py-24 md:py-32 lg:py-40">
            <div className="container mx-auto px-6 md:px-12">
                <header className="mb-14 flex min-w-0 flex-col items-start justify-between gap-8 md:mb-24 md:flex-row md:items-end">
                    <div className="min-w-0 space-y-4">
                        <span className="text-accent text-[10px] uppercase tracking-[0.22em] [overflow-wrap:anywhere] md:tracking-[0.5em]">
                            {translateText(settings.digitalProducts.eyebrow || t('shop.creativeToolkit'))}
                        </span>
                        <h2 className="text-3xl font-heading italic text-white [overflow-wrap:anywhere] sm:text-4xl md:text-5xl">
                            {translateText(settings.digitalProducts.title || t('shop.digitalShop'))}
                        </h2>
                    </div>
                    <p className="max-w-xs border-l border-white/10 pb-2 pl-4 text-[10px] uppercase tracking-[0.16em] text-white/40 [overflow-wrap:anywhere] sm:pl-6 md:max-w-[220px] md:tracking-[0.24em]">
                        {translateText(settings.digitalProducts.description || t('shop.description'))}
                    </p>
                </header>

                <div className="grid min-w-0 grid-cols-1 gap-10 sm:grid-cols-2 md:grid-cols-3 md:gap-12">
                    {products.map((product, index) => (
                        <motion.div
                            key={product.id}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, delay: index * 0.1 }}
                            className="group min-w-0 cursor-pointer space-y-6 md:space-y-8"
                        >
                            <GlareHover
                                width="100%"
                                height="auto"
                                background="transparent"
                                borderRadius="2px"
                                borderColor="rgba(255,255,255,0.08)"
                                glareOpacity={0.2}
                                glareAngle={-30}
                                glareSize={180}
                                transitionDuration={760}
                            >
                                <div className="relative aspect-[4/5] overflow-hidden bg-neutral-900">
                                    <SeoImage
                                        src={product.image}
                                        alt={`${translateText(product.title)} - ${translateText(product.details)}`}
                                        fill
                                        sizes="(min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw"
                                        className="object-cover grayscale transition-all duration-1000 group-hover:scale-105 group-hover:grayscale-0"
                                    />
                                    <a
                                        href={product.product_url || '#digital-shop'}
                                        target={product.product_url ? '_blank' : undefined}
                                        rel={product.product_url ? 'noreferrer' : undefined}
                                        className="absolute inset-x-0 bottom-0 z-20 block translate-y-0 bg-white py-5 text-center transition-transform duration-500 md:translate-y-full md:group-hover:translate-y-0"
                                        aria-disabled={!product.product_url}
                                    >
                                        <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-black md:tracking-[0.4em]">{t('shop.purchaseNow')}</span>
                                    </a>
                                </div>

                                <div className="flex min-w-0 flex-col gap-3 border-t border-white/10 px-4 py-6 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                                    <div className="min-w-0 space-y-1">
                                        <h3 className="text-xl font-heading text-white transition-colors [overflow-wrap:anywhere] group-hover:text-accent">{translateText(product.title)}</h3>
                                        <span className="block font-body text-[10px] uppercase tracking-[0.18em] text-white/30 [overflow-wrap:anywhere] sm:tracking-widest">{translateText(product.details)}</span>
                                    </div>
                                    <span className="shrink-0 font-body text-[10px] uppercase tracking-widest text-accent sm:pr-2">{product.price}</span>
                                </div>
                            </GlareHover>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
