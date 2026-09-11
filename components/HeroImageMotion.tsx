'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { isVideoMedia } from '@/components/GalleryMedia';
import { getCloudinaryPreviewUrl, getImagePreviewSrcSet } from '@/lib/mediaUrl';

type CatalogImage = {
    image_url?: string;
};

type CatalogCategory = {
    cover_image_url?: string;
    images?: CatalogImage[];
};

type MotionSlot = {
    minWidth: number;
    maxWidth?: number;
    frame: string;
    drift: { x: number[]; y: number[]; rotate: number[] };
    delay: number;
    opacity: number;
};

const slots = [
    {
        minWidth: 0,
        frame: 'left-[-18%] top-[16%] h-[30svh] w-[74vw] max-w-[360px] sm:left-[4%] sm:top-[17%] sm:h-[34svh] sm:w-[34vw] sm:max-w-[390px]',
        drift: { x: [-8, 8, -6], y: [5, -7, 5], rotate: [-1.2, 0.8, -1.2] },
        delay: 0,
        opacity: 0.26,
    },
    {
        minWidth: 0,
        maxWidth: 639,
        frame: 'right-[-22%] bottom-[12%] h-[27svh] w-[76vw] max-w-[360px]',
        drift: { x: [7, -8, 7], y: [-5, 7, -5], rotate: [1, -0.8, 1] },
        delay: 1.1,
        opacity: 0.22,
    },
    {
        minWidth: 640,
        frame: 'right-[15%] bottom-[9%] h-[30svh] w-[30vw] max-w-[360px]',
        drift: { x: [10, -14, 10], y: [9, -7, 9], rotate: [-1.2, 1.5, -1.2] },
        delay: 1.7,
        opacity: 0.3,
    },
    {
        minWidth: 768,
        frame: 'right-[7%] top-[18%] h-[28svh] w-[26vw] max-w-[310px]',
        drift: { x: [12, -10, 12], y: [-8, 8, -6], rotate: [1.6, -1.2, 1.6] },
        delay: 2.2,
        opacity: 0.32,
    },
    {
        minWidth: 1024,
        frame: 'left-[9%] bottom-[12%] h-[27svh] w-[24vw] max-w-[300px]',
        drift: { x: [-8, 12, -8], y: [-6, 9, -6], rotate: [1.4, -1, 1.4] },
        delay: 2.8,
        opacity: 0.3,
    },
    {
        minWidth: 1280,
        frame: 'left-1/2 top-[9%] h-[22svh] w-[24vw] max-w-[270px]',
        drift: { x: [-18, 18, -18], y: [-5, 7, -5], rotate: [0.8, -1.2, 0.8] },
        delay: 3.4,
        opacity: 0.24,
    },
] satisfies MotionSlot[];

function uniqueImages(categories: CatalogCategory[]) {
    const seen = new Set<string>();
    const images: string[] = [];

    categories.forEach((category) => {
        const categoryImages = [
            category.cover_image_url,
            ...(category.images || []).map((image) => image.image_url),
        ];

        categoryImages.forEach((url) => {
            if (!url || seen.has(url) || isVideoMedia(url)) return;
            seen.add(url);
            images.push(url);
        });
    });

    return images;
}

export default function HeroImageMotion() {
    const [images, setImages] = useState<string[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [viewportWidth, setViewportWidth] = useState(1280);
    const reduceMotion = useReducedMotion();

    useEffect(() => {
        const updateViewportWidth = () => setViewportWidth(window.innerWidth);

        updateViewportWidth();
        window.addEventListener('resize', updateViewportWidth);

        return () => window.removeEventListener('resize', updateViewportWidth);
    }, []);

    useEffect(() => {
        let isMounted = true;

        fetch('/api/photography-catalog')
            .then((res) => res.json())
            .then((data) => {
                if (!isMounted) return;
                setImages(uniqueImages(data.categories || []));
            })
            .catch(() => null);

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        if (reduceMotion || images.length <= 1) return;

        const timer = window.setInterval(() => {
            setActiveIndex((current) => (current + 1) % images.length);
        }, 3600);

        return () => window.clearInterval(timer);
    }, [images.length, reduceMotion]);

    const activeSlots = useMemo(() => {
        const width = viewportWidth || 1280;
        return slots.filter((slot) => width >= slot.minWidth && (!slot.maxWidth || width <= slot.maxWidth));
    }, [viewportWidth]);

    const activeImages = useMemo(() => {
        if (!images.length) return [];
        return activeSlots.map((_, index) => images[(activeIndex + index) % images.length]);
    }, [activeIndex, activeSlots, images]);

    if (!activeImages.length) return null;

    return (
        <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden="true">
            <div className="absolute inset-0 bg-radial-[at_50%_48%] from-transparent via-black/25 to-black/75" />
            {activeSlots.map((slot, index) => {
                const src = activeImages[index];
                if (!src) return null;

                return (
                    <motion.div
                        key={index}
                        className={`absolute ${slot.frame}`}
                        animate={reduceMotion ? undefined : slot.drift}
                        transition={{
                            duration: 14 + index * 1.4,
                            delay: slot.delay,
                            repeat: Infinity,
                            ease: 'easeInOut',
                        }}
                    >
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={`${src}-${activeIndex}-${index}`}
                                initial={{ opacity: 0, scale: 1.08, y: 24, filter: 'blur(10px) grayscale(1)' }}
                                animate={{ opacity: slot.opacity, scale: 1, y: 0, filter: 'blur(0px) grayscale(0.25)' }}
                                exit={{ opacity: 0, scale: 0.96, y: -20, filter: 'blur(10px) grayscale(1)' }}
                                transition={{ duration: reduceMotion ? 0 : 1.25, ease: [0.22, 1, 0.36, 1] }}
                                className="h-full w-full overflow-hidden border border-white/10 bg-black shadow-[0_35px_90px_rgba(0,0,0,0.55)]"
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={getCloudinaryPreviewUrl(src, { width: 640 })}
                                    srcSet={getImagePreviewSrcSet(src, [320, 640, 960])}
                                    sizes="(min-width: 1280px) 24vw, (min-width: 768px) 30vw, 76vw"
                                    alt=""
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                    decoding="async"
                                    draggable={false}
                                />
                                <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/45" />
                            </motion.div>
                        </AnimatePresence>
                    </motion.div>
                );
            })}
        </div>
    );
}
