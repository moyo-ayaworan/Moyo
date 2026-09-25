'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { motion } from 'framer-motion';
import { useProfile } from '@/context/ProfileContext';
import { useLanguage } from '@/context/LanguageContext';
import { useTranslate } from '@/lib/translations';
import GalleryMedia from '@/components/GalleryMedia';
import GlareHover from '@/components/GlareHover';
import { Check, ChevronLeft, ChevronRight, Maximize2, X, Heart, ArrowDown, Mail, LockKeyhole } from 'lucide-react';

type ClientGallery = {
    id: number;
    client_name: string;
    slug: string;
    images: string[];
    approved_images: string[];
    finished_images: string[];
    payment_verified: boolean;
    payment_url: string;
    review_rating: number | null;
    review_text: string;
    review_submitted_at: string | null;
    is_locked: boolean;
    image_count: number;
    finished_count: number;
    gallery_design: 'editorial' | 'classic' | 'proofing';
};

export default function ClientGalleryPage() {
    const [selectionOnly, setSelectionOnly] = useState(false);
    const [lightboxCollection, setLightboxCollection] = useState<'proofs' | 'finished'>('proofs');
    const lightboxRef = useRef<HTMLDivElement>(null);
    const returnFocusRef = useRef<HTMLElement | null>(null);
    const [accessCode, setAccessCode] = useState('');
    const [gallery, setGallery] = useState<ClientGallery | null>(null);
    const [selectedImages, setSelectedImages] = useState<string[]>([]);
    const [isApproving, setIsApproving] = useState(false);
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);
    const [reviewRating, setReviewRating] = useState(5);
    const [reviewText, setReviewText] = useState('');
    const [reviewMessage, setReviewMessage] = useState('');
    const [reviewError, setReviewError] = useState('');
    const [approvalMessage, setApprovalMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null);
    const { setProfile } = useProfile();
    const { language } = useLanguage();
    const { t, translateText } = useTranslate(language);
    const selectedImageSet = useMemo(() => new Set(selectedImages), [selectedImages]);
    const hasReadUrlAccessCode = useRef(false);
    const approvedSelectionKey = useMemo(
        () => [...(gallery?.approved_images || [])].sort().join('\n'),
        [gallery?.approved_images]
    );
    const selectedSelectionKey = useMemo(
        () => [...selectedImages].sort().join('\n'),
        [selectedImages]
    );
    const hasSelectionChanges = selectedSelectionKey !== approvedSelectionKey;
    const lightboxImages = useMemo(() => lightboxCollection === 'finished' ? (gallery?.finished_images || []) : (gallery?.images || []), [gallery, lightboxCollection]);
    const activeImage = activeImageIndex !== null ? lightboxImages[activeImageIndex] : null;
    const visibleImages = (gallery?.images || []).map((image, index) => ({ image, index })).filter(({ image }) => !selectionOnly || selectedImageSet.has(image));
    const galleryDesign = gallery?.gallery_design || 'editorial';

    const getFinishedDownloadUrl = (image: string) =>
        `/api/galleries/download?galleryId=${gallery?.id || ''}&accessCode=${encodeURIComponent(accessCode.trim())}&file=${encodeURIComponent(image)}`;

    const openGallery = useCallback(async (code: string) => {
        setError('');
        setGallery(null);
        setActiveImageIndex(null);
        setSelectionOnly(false);
        setSelectedImages([]);
        setReviewRating(5);
        setReviewText('');
        setReviewMessage('');
        setReviewError('');
        setApprovalMessage('');

        if (!code) {
            setError(t('clientGallery.accessCodeRequired'));
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetch('/api/galleries/access', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accessCode: code }),
            });
            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                setError(data.error || t('clientGallery.openError'));
                return;
            }

            setGallery(data.gallery);
            setSelectedImages(data.gallery?.approved_images || []);
            setReviewRating(data.gallery?.review_rating || 5);
            setReviewText(data.gallery?.review_text || '');
            setReviewMessage('');
            setReviewError('');
        } catch {
            setError(t('clientGallery.openRetryError'));
        } finally {
            setIsLoading(false);
        }
    }, [t]);

    useEffect(() => {
        setProfile('photography');
    }, [setProfile]);

    useEffect(() => {
        if (hasReadUrlAccessCode.current) return;
        hasReadUrlAccessCode.current = true;

        const params = new URLSearchParams(window.location.search);
        const code = (params.get('code') || params.get('accessCode') || '').trim();
        if (!code) return;

        setAccessCode(code);
        window.history.replaceState(null, '', window.location.pathname);
        void openGallery(code);
    }, [openGallery]);

    const handleAccessSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const code = accessCode.trim();
        await openGallery(code);
    };

    const resetGallery = () => {
        setGallery(null);
        setActiveImageIndex(null);
        setAccessCode('');
        setError('');
        setSelectedImages([]);
        setReviewRating(5);
        setReviewText('');
        setReviewMessage('');
        setReviewError('');
        setApprovalMessage('');
        window.history.replaceState(null, '', window.location.pathname);
    };

    const toggleImageSelection = (image: string) => {
        if (isApproving) return;
        setApprovalMessage('');
        setSelectedImages((current) => {
            const next = new Set(current);
            if (next.has(image)) {
                next.delete(image);
            } else {
                next.add(image);
            }
            return Array.from(next);
        });
    };

    const openLightbox = (index: number, collection: 'proofs' | 'finished' = 'proofs') => {
        returnFocusRef.current = document.activeElement as HTMLElement;
        setLightboxCollection(collection);
        setActiveImageIndex(index);
    };

    const closeLightbox = useCallback(() => {
        setActiveImageIndex(null);
        returnFocusRef.current?.focus();
    }, []);

    const showPreviousImage = useCallback(() => {
        if (!lightboxImages.length) return;
        setActiveImageIndex((current) => {
            const index = current ?? 0;
            return (index - 1 + lightboxImages.length) % lightboxImages.length;
        });
    }, [lightboxImages]);

    const showNextImage = useCallback(() => {
        if (!lightboxImages.length) return;
        setActiveImageIndex((current) => {
            const index = current ?? 0;
            return (index + 1) % lightboxImages.length;
        });
    }, [lightboxImages]);

    useEffect(() => {
        if (activeImageIndex === null) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Tab') {
                const controls = lightboxRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], video[controls]');
                if (controls?.length) {
                    const first = controls[0];
                    const last = controls[controls.length - 1];
                    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
                    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
                }
            }
            if (event.key === 'Escape') closeLightbox();
            if (event.key === 'ArrowLeft') showPreviousImage();
            if (event.key === 'ArrowRight') showNextImage();
        };

        const previousOverflow = document.body.style.overflow;
        lightboxRef.current?.querySelector<HTMLElement>('button')?.focus();
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [activeImageIndex, closeLightbox, showNextImage, showPreviousImage]);

    useEffect(() => {
        if (!hasSelectionChanges) return;
        const warnBeforeLeaving = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
        window.addEventListener('beforeunload', warnBeforeLeaving);
        return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
    }, [hasSelectionChanges]);

    const approveSelection = async () => {
        if (!gallery || selectedImages.length === 0 || !hasSelectionChanges) return;

        setIsApproving(true);
        setError('');
        setApprovalMessage('');

        try {
            const res = await fetch('/api/galleries/approve-selection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accessCode: accessCode.trim(),
                    galleryId: gallery.id,
                    images: selectedImages,
                }),
            });
            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                setError(data.error || t('clientGallery.approveError'));
                return;
            }

            setSelectedImages(data.approved_images || selectedImages);
            setGallery((current) =>
                current ? { ...current, approved_images: data.approved_images || selectedImages } : current
            );
            setApprovalMessage(
                t('clientGallery.approvedMessage')
                    .replace('{count}', data.approved_count.toString())
                    .replace('{unit}', data.approved_count === 1 ? t('ui.imageSingular') : t('ui.images'))
            );
        } catch {
            setError(t('clientGallery.approveRetryError'));
        } finally {
            setIsApproving(false);
        }
    };

    const submitReview = async () => {
        if (!gallery || isSubmittingReview) return;

        setIsSubmittingReview(true);
        setReviewError('');
        setReviewMessage('');

        try {
            const res = await fetch('/api/galleries/review', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accessCode: accessCode.trim(),
                    galleryId: gallery.id,
                    rating: reviewRating,
                    reviewText,
                }),
            });
            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                setReviewError(data.error || t('clientGallery.reviewError'));
                return;
            }

            setGallery((current) =>
                current
                    ? {
                        ...current,
                        review_rating: data.review_rating,
                        review_text: data.review_text || reviewText.trim(),
                        review_submitted_at: data.review_submitted_at,
                    }
                    : current
            );
            setReviewText(data.review_text || reviewText.trim());
            setReviewMessage(t('clientGallery.reviewThanks'));
        } catch {
            setReviewError(t('clientGallery.reviewRetryError'));
        } finally {
            setIsSubmittingReview(false);
        }
    };

    return (
        <main className="bg-background min-h-screen flex flex-col">
            <Navbar />

            <div className="flex-grow pt-36 md:pt-52 container mx-auto px-6 md:px-12 pb-32">
                {!gallery ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mx-auto max-w-md"
                    >
                        <GlareHover
                            width="100%"
                            height="auto"
                            background="rgba(255,255,255,0.05)"
                            borderRadius="2px"
                            borderColor="rgba(255,255,255,0.08)"
                            glareOpacity={0.16}
                            glareAngle={-30}
                            glareSize={170}
                            transitionDuration={780}
                            contentClassName="space-y-8 p-12 py-20 text-center backdrop-blur-sm"
                        >
                            <div className="space-y-4">
                                <span className="text-accent text-[10px] tracking-[0.5em] uppercase">{t('clientGallery.privateAccess')}</span>
                                <h1 className="text-3xl font-heading text-white">{t('clientGallery.clientPortfolio')}</h1>
                                <p className="text-white/40 text-xs font-body tracking-wider leading-relaxed">
                                    {t('clientGallery.enterAccessCodeText')}
                                </p>
                            </div>

                            <form onSubmit={handleAccessSubmit} className="space-y-6">
                                <input
                                    aria-label="Gallery access code"
                                    type="password"
                                    autoComplete="one-time-code"
                                    autoCapitalize="characters"
                                    aria-invalid={Boolean(error)}
                                    placeholder={t('clientGallery.accessCodePlaceholder')}
                                    value={accessCode}
                                    onChange={(event) => {
                                        setAccessCode(event.target.value);
                                        setError('');
                                    }}
                                    className="w-full bg-white/5 border border-white/10 rounded-sm py-4 text-center text-white text-[10px] tracking-[0.5em] focus:outline-none focus:border-accent transition-colors placeholder:text-white/20"
                                />
                                {error && (
                                    <p className="text-red-300 text-xs leading-relaxed">
                                        {error}
                                    </p>
                                )}
                                <button
                                    type="submit"
                                    aria-busy={isLoading}
                                    disabled={isLoading}
                                    className="w-full bg-white text-black text-[10px] tracking-[0.4em] uppercase py-4 font-bold hover:bg-accent transition-colors duration-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? t('ui.checking') : t('clientGallery.enterGallery')}
                                </button>
                            </form>

                            <a href="mailto:ijabikenm@gmail.com?subject=Client%20gallery%20access" className="inline-flex items-center gap-2 text-[10px] text-white/60 tracking-widest uppercase hover:text-accent transition-colors">
                                <Mail className="h-3 w-3" /> {t('clientGallery.lostCode')}
                            </a>
                        </GlareHover>
                    </motion.div>
                ) : (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12 md:space-y-16">
                        <section className={`collection-hero relative grid items-end overflow-hidden border border-white/10 bg-black ${galleryDesign === 'editorial' ? 'min-h-[420px] -mx-6 md:-mx-12' : 'mx-auto min-h-[320px] w-full max-w-7xl'}`}>
                            {gallery.images[0] && (
                                <div className="col-start-1 row-start-1 min-w-0 overflow-hidden">
                                    <GalleryMedia
                                        src={gallery.images[0]}
                                        alt={`${gallery.client_name} ${t('clientGallery.galleryImageAlt')} 1`}
                                        className={`${galleryDesign === 'editorial' ? 'h-[56svh] min-h-[420px] md:h-[68svh]' : 'h-[38svh] min-h-[320px] md:h-[48svh]'} w-full object-cover opacity-70`}
                                        previewWidth={1600}
                                        loading="eager"
                                        fetchPriority="high"
                                    />
                                </div>
                            )}
                            <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,.85), rgba(0,0,0,.05) 85%)' }} />
                            <div className="relative col-start-1 row-start-1 min-w-0 px-6 py-8 md:px-12 md:py-12">
                                <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-end md:justify-between">
                                    <div className="max-w-3xl space-y-4">
                                        <span className="text-accent text-[10px] tracking-[0.5em] uppercase">
                                            Ijabiken Moyo / A private collection
                                        </span>
                                        <h1 className="text-4xl font-heading text-white italic md:text-6xl">
                                            {gallery.client_name}
                                        </h1>
                                        <p className="text-sm leading-relaxed text-white/55 md:max-w-xl">
                                            {gallery.image_count} {gallery.image_count === 1 ? t('ui.imageSingular') : t('ui.images')} {t('clientGallery.privateGalleryCountText')}
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-px border border-white/10 bg-white/10 text-center md:min-w-[340px]">
                                        <div className="bg-background/80 px-5 py-4 backdrop-blur-md">
                                            <p className="text-2xl font-heading italic text-white">{selectedImages.length}</p>
                                            <p className="mt-1 text-[9px] uppercase tracking-[0.24em] text-white/35">{t('ui.selected')}</p>
                                        </div>
                                        <div className="bg-background/80 px-5 py-4 backdrop-blur-md">
                                            <p className="text-2xl font-heading italic text-white">{gallery.image_count}</p>
                                            <p className="mt-1 text-[9px] uppercase tracking-[0.24em] text-white/35">{t('ui.images')}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {gallery.images.length > 0 ? (
                            <>
                                <section className="flex flex-col gap-6 border-b border-white/15 pb-8 sm:flex-row sm:items-end sm:justify-between">
                                    <div className="space-y-3">
                                        <p className="text-[10px] uppercase tracking-[0.3em] text-accent">01 / The selection</p>
                                        <h2 className="font-heading text-3xl italic text-white">A story only you can tell.</h2>
                                        <p className="max-w-lg text-sm leading-relaxed text-white/60">Take your time. Open a photograph to see the full frame, mark your favourites, then send your selection to the studio.</p>
                                    </div>
                                    {gallery.finished_count > 0 && <a href="#finished-collection" className="inline-flex items-center gap-2 text-xs text-accent">View finished collection <ArrowDown className="h-4 w-4" /></a>}
                                </section>
                                <div className="flex flex-wrap items-center justify-between gap-4">
                                    <div className="flex gap-2" aria-label="Filter photographs">
                                        <button type="button" aria-pressed={!selectionOnly} onClick={() => setSelectionOnly(false)} className={`border px-4 py-3 text-xs ${!selectionOnly ? 'border-accent text-accent' : 'border-white/20 text-white/60'}`}>All photographs ({gallery.images.length})</button>
                                        <button type="button" aria-pressed={selectionOnly} onClick={() => setSelectionOnly(true)} className={`inline-flex items-center gap-2 border px-4 py-3 text-xs ${selectionOnly ? 'border-accent text-accent' : 'border-white/20 text-white/60'}`}><Heart className="h-3 w-3" /> Your selection ({selectedImages.length})</button>
                                    </div>
                                    <p className="text-xs text-white/50" role="status">{hasSelectionChanges ? 'Selection has unsent changes' : gallery.approved_images.length ? 'Selection received by the studio' : 'Your collection, your favourites'}</p>
                                </div>
                                {selectionOnly && visibleImages.length === 0 && <p className="py-12 text-center text-sm text-white/60">No favourites yet. Choose All photographs to start your selection.</p>}
                                <div className={galleryDesign === 'editorial' ? 'columns-1 gap-4 sm:columns-2 lg:columns-3 2xl:columns-4' : galleryDesign === 'proofing' ? 'grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5' : 'grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3'}>
                                    {visibleImages.map(({ image, index }) => {
                                        const isSelected = selectedImageSet.has(image);

                                        return (
                                            <figure
                                                key={`${image}-${index}`}
                                                className={`group relative break-inside-avoid overflow-hidden border bg-background transition-colors duration-500 ${galleryDesign === 'editorial' ? 'mb-4 border-white/10 hover:border-white/25' : 'border-white/15 hover:border-accent/60'}`}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => openLightbox(index)}
                                                    className={`relative block w-full cursor-zoom-in overflow-hidden bg-[#050505] `}
                                                    aria-label={`${t('ui.preview')} ${gallery.client_name} ${index + 1}`}
                                                >
                                                    <GalleryMedia
                                                        src={image}
                                                        alt={`${gallery.client_name} ${t('clientGallery.galleryImageAlt')} ${index + 1}`}
                                                        className={`${galleryDesign === 'editorial' ? 'h-auto' : galleryDesign === 'proofing' ? 'aspect-square object-cover' : 'aspect-[4/5] object-cover'} w-full transition duration-700 group-hover:scale-[1.025]`}
                                                        previewWidth={900}
                                                        loading={index < 3 ? 'eager' : 'lazy'}
                                                        fetchPriority={index === 0 ? 'high' : 'auto'}
                                                    />
                                                    <div className="pointer-events-none absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/15" />
                                                    <span className="pointer-events-none absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center border border-white/15 bg-black/45 text-white/70 opacity-0 backdrop-blur-md transition-opacity duration-300 group-hover:opacity-100">
                                                        <Maximize2 className="h-4 w-4" />
                                                    </span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleImageSelection(image)}
                                                    aria-pressed={isSelected}
                                                    aria-label={isSelected ? t('ui.removeImage') : t('ui.selectImage')}
                                                    className={`collection-select absolute left-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full border transition-all ${
                                                        isSelected
                                                            ? 'border-white bg-white text-black shadow-[0_0_18px_rgba(255,255,255,0.22)]'
                                                            : 'border-white/65 bg-black/20 hover:border-white hover:bg-white/10'
                                                    }`}
                                                >
                                                    <Check className={`h-4 w-4 ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleImageSelection(image)}
                                                    aria-pressed={isSelected}
                                                    className={`absolute bottom-12 left-3 z-20 inline-flex items-center gap-2 border px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.18em] backdrop-blur-md transition-all ${isSelected ? 'border-white bg-white text-black' : 'border-white/50 bg-black/60 text-white hover:border-white'}`}
                                                >
                                                    <Heart className={`h-3 w-3 ${isSelected ? 'fill-current' : ''}`} />
                                                    {isSelected ? 'Selected' : 'Select'}
                                                </button>
                                                <figcaption className="flex items-center justify-between gap-4 border-t border-white/10 px-4 py-3">
                                                    <span className="text-[10px] uppercase tracking-[0.24em] text-white/35">
                                                        {String(index + 1).padStart(2, '0')}
                                                    </span>
                                                    {isSelected && (
                                                        <span className="text-[9px] uppercase tracking-[0.22em] text-accent">
                                                            {t('ui.selected')}
                                                        </span>
                                                    )}
                                                </figcaption>
                                            </figure>
                                        );
                                    })}
                                </div>

                                <div className="mx-auto max-w-3xl border border-white/10 bg-background/88 p-3 shadow-2xl backdrop-blur-xl">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="min-w-0 px-2">
                                            <p className="text-[10px] uppercase tracking-[0.24em] text-white/35">
                                                {t('clientGallery.selectionStatus')
                                                    .replace('{count}', selectedImages.length.toString())
                                                    .replace('{total}', gallery.image_count.toString())}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={approveSelection}
                                            disabled={selectedImages.length === 0 || isApproving || !hasSelectionChanges}
                                            className="bg-white px-5 py-4 text-[10px] font-bold uppercase tracking-[0.28em] text-black transition-colors duration-500 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {isApproving ? t('ui.approving') : t('clientGallery.approveSelection')}
                                        </button>
                                    </div>
                                    {error && <p className="text-red-300 text-xs leading-relaxed">{error}</p>}
                                    {approvalMessage && <p role="status" className="text-accent text-xs leading-relaxed">{approvalMessage}</p>}
                                </div>
                            </>
                        ) : (
                            <GlareHover width="100%" height="auto" background="rgba(255,255,255,0.05)" borderRadius="2px" borderColor="rgba(255,255,255,0.1)" glareOpacity={0.16} className="max-w-xl mx-auto" contentClassName="text-center p-10 space-y-3">
                                <h2 className="text-2xl font-heading text-white italic">{t('clientGallery.noImagesTitle')}</h2>
                                <p className="text-white/40 text-sm leading-relaxed">
                                    {t('clientGallery.noImagesDescription')}
                                </p>
                            </GlareHover>
                        )}

                        {gallery.finished_count > 0 && (
                            <section id="finished-collection" className="scroll-mt-28">
                            <p className="mb-6 text-center text-[10px] uppercase tracking-[0.3em] text-accent">02 / Yours to keep</p>
                            <GlareHover width="100%" height="auto" background="rgba(255,255,255,0.03)" borderRadius="2px" borderColor="rgba(255,255,255,0.1)" glareOpacity={0.12} className="mx-auto w-full" contentClassName="p-5 text-center space-y-8 sm:p-8 md:p-10">
                                <div className="space-y-2">
                                    <h2 className="text-2xl font-heading text-white italic">{t('clientGallery.finishedWorkTitle')}</h2>
                                    <p className="text-white/45 text-sm leading-relaxed">
                                        {gallery.payment_verified
                                            ? t('clientGallery.finishedWorkReady')
                                            : t('clientGallery.paymentRequired')}
                                    </p>
                                </div>

                                {gallery.finished_images.length > 0 ? (
                                    <div className="space-y-8">
                                        {!gallery.payment_verified && (
                                            <div className="flex flex-col items-center justify-between gap-5 border border-accent/25 bg-accent/[0.04] p-5 text-left sm:flex-row sm:p-6">
                                                <div className="flex items-start gap-4">
                                                    <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-accent/30 text-accent"><LockKeyhole className="h-4 w-4" /></span>
                                                    <div><p className="text-sm font-medium text-white">Your finished gallery is ready to enjoy.</p><p className="mt-1 max-w-xl text-xs leading-relaxed text-white/45">View every photograph at full-screen preview size. Original-file downloads unlock automatically after the studio confirms full payment.</p></div>
                                                </div>
                                                {gallery.payment_url && <a href={gallery.payment_url} target="_blank" rel="noreferrer" className="w-full shrink-0 bg-white px-5 py-3 text-center text-[10px] font-bold uppercase tracking-[0.28em] text-black transition-colors hover:bg-accent sm:w-auto">{t('clientGallery.payOnline')}</a>}
                                            </div>
                                        )}
                                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                            {gallery.finished_images.map((image, index) => (
                                                <div
                                                    key={`${image}-${index}`}
                                                    className="group relative aspect-[4/5] overflow-hidden border border-white/10 bg-black transition-colors hover:border-white/25"
                                                >
                                                    <button type="button" onClick={() => openLightbox(index, 'finished')} className="h-full w-full cursor-zoom-in" aria-label={`Preview finished photograph ${index + 1}`}>
                                                    <GalleryMedia
                                                        src={image}
                                                        alt={`${gallery.client_name} ${t('clientGallery.finishedWorkTitle')} ${index + 1}`}
                                                        className="pointer-events-none h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                                                        previewWidth={720}
                                                        loading={index < 3 ? 'eager' : 'lazy'}
                                                        fetchPriority={index === 0 ? 'high' : 'auto'}
                                                    />
                                                    </button>
                                                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/0" />
                                                    <span className="image-overlay-chip absolute left-3 top-3 rounded-full border px-3 py-1 text-[9px] uppercase tracking-[0.18em] backdrop-blur-sm">
                                                        {t('clientGallery.finishedWorkTitle')} {index + 1}
                                                    </span>
                                                    {gallery.payment_verified ? <a
                                                        href={getFinishedDownloadUrl(image)}
                                                        className="absolute bottom-3 left-3 right-3 z-10 border border-white/25 bg-white px-3 py-3 text-center text-[10px] font-bold uppercase tracking-[0.24em] text-black transition-colors hover:border-accent hover:bg-accent"
                                                    >
                                                        {t('clientGallery.downloadFinishedWork')}
                                                    </a> : <span className="absolute bottom-3 left-3 right-3 z-10 inline-flex items-center justify-center gap-2 border border-white/20 bg-black/55 px-3 py-3 text-center text-[9px] font-semibold uppercase tracking-[0.2em] text-white/65 backdrop-blur-md"><LockKeyhole className="h-3 w-3" /> Download unlocks after payment</span>}
                                                </div>
                                            ))}
                                        </div>

                                        <div className={`${gallery.payment_verified ? '' : 'hidden'} border-t border-white/10 pt-8 text-left`}>
                                            {gallery.review_submitted_at ? (
                                                <div className="space-y-4 text-center">
                                                    <p className="text-[10px] uppercase tracking-[0.35em] text-accent">
                                                        {t('clientGallery.reviewReceived')}
                                                    </p>
                                                    <div className="flex justify-center gap-1 text-lg text-accent" aria-label={`${gallery.review_rating || 5} ${t('clientGallery.reviewStars')}`}>
                                                        {Array.from({ length: 5 }).map((_, index) => (
                                                            <span key={index} className={index < (gallery.review_rating || 0) ? 'opacity-100' : 'opacity-25'}>
                                                                &#9733;
                                                            </span>
                                                        ))}
                                                    </div>
                                                    <p className="mx-auto max-w-xl text-sm leading-relaxed text-white/55">
                                                        &quot;{translateText(gallery.review_text)}&quot;
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="space-y-5">
                                                    <div className="space-y-2 text-center">
                                                        <p className="text-[10px] uppercase tracking-[0.35em] text-accent">
                                                            {t('clientGallery.reviewPromptTitle')}
                                                        </p>
                                                        <p className="text-sm leading-relaxed text-white/45">
                                                            {t('clientGallery.reviewPromptDescription')}
                                                        </p>
                                                    </div>
                                                    <div className="flex justify-center gap-2" aria-label={t('clientGallery.rateTransaction')}>
                                                        {Array.from({ length: 5 }).map((_, index) => {
                                                            const value = index + 1;
                                                            const isActive = value <= reviewRating;
                                                            return (
                                                                <button
                                                                    key={value}
                                                                    type="button"
                                                                    onClick={() => setReviewRating(value)}
                                                                    className={`text-2xl leading-none transition-colors ${
                                                                        isActive ? 'text-accent' : 'text-white/25 hover:text-white/60'
                                                                    }`}
                                                                    aria-label={`${value} ${t('clientGallery.reviewStars')}`}
                                                                >
                                                                    &#9733;
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                    <textarea
                                                        value={reviewText}
                                                        onChange={(event) => {
                                                            setReviewText(event.target.value);
                                                            setReviewError('');
                                                        }}
                                                        maxLength={1000}
                                                        rows={4}
                                                        placeholder={t('clientGallery.reviewPlaceholder')}
                                                        className="w-full resize-none border border-white/10 bg-white/[0.04] px-4 py-4 text-sm leading-relaxed text-white outline-none transition-colors placeholder:text-white/25 focus:border-accent"
                                                    />
                                                    {reviewError && (
                                                        <p className="text-center text-xs leading-relaxed text-red-300">
                                                            {reviewError}
                                                        </p>
                                                    )}
                                                    <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
                                                        <span className="text-[10px] uppercase tracking-[0.2em] text-white/30">
                                                            {reviewText.length}/1000
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={submitReview}
                                                            disabled={isSubmittingReview || reviewText.trim().length < 10}
                                                            className="w-full bg-white px-6 py-4 text-[10px] font-bold uppercase tracking-[0.35em] text-black transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                                                        >
                                                            {isSubmittingReview ? t('clientGallery.submittingReview') : t('clientGallery.submitReview')}
                                                        </button>
                                                    </div>
                                                    {reviewMessage && (
                                                        <p className="text-center text-xs leading-relaxed text-accent">
                                                            {reviewMessage}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {gallery.payment_url && (
                                            <a
                                                href={gallery.payment_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex w-full justify-center bg-white px-5 py-4 text-[10px] font-bold uppercase tracking-[0.35em] text-black transition-colors hover:bg-accent sm:w-auto"
                                            >
                                                {t('clientGallery.payOnline')}
                                            </a>
                                        )}
                                        <p className="text-[10px] uppercase tracking-[0.24em] text-white/30">
                                            {t('clientGallery.paymentVerificationNote')}
                                        </p>
                                    </div>
                                )}
                            </GlareHover>
                            </section>
                        )}

                        <div className="flex flex-col items-center gap-8 py-12 border-t border-white/5">
                            <button
                                onClick={resetGallery}
                                className="px-12 py-4 border border-white/20 text-[10px] tracking-[0.4em] uppercase text-white hover:border-accent hover:text-accent transition-colors duration-500"
                            >
                                {t('ui.useAnotherCode')}
                            </button>
                        </div>
                    </motion.div>
                )}
            </div>

            {activeImage && activeImageIndex !== null && gallery && (
                <div ref={lightboxRef} role="dialog" aria-modal="true" aria-label={`${gallery.client_name} photograph viewer`} className="client-gallery-viewer fixed inset-0 z-[240] flex items-center justify-center bg-black/94 px-3 py-5 backdrop-blur-md sm:px-6">
                    <button
                        type="button"
                        onClick={closeLightbox}
                        className="absolute inset-0 cursor-default"
                        aria-label={translateText('Close')}
                    />

                    <div className="relative z-10 flex h-full w-full max-w-7xl flex-col">
                        <div className="mb-3 flex items-center justify-between gap-4 text-white">
                            <div className="min-w-0">
                                <p className="text-[10px] uppercase tracking-[0.28em] text-white/35">
                                    {String(activeImageIndex + 1).padStart(2, '0')} / {String(lightboxImages.length).padStart(2, '0')}
                                </p>
                                <h2 className="mt-1 truncate font-heading text-2xl italic text-white">
                                    {gallery.client_name}
                                </h2>
                            </div>
                            <button
                                type="button"
                                onClick={closeLightbox}
                                className="flex h-11 w-11 shrink-0 items-center justify-center border border-white/15 bg-white/5 text-white/70 transition-colors hover:border-accent hover:text-accent"
                                aria-label={translateText('Close')}
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="relative min-h-0 flex-1 overflow-hidden border border-white/10 bg-black">
                            <GalleryMedia
                                key={activeImage}
                                src={activeImage}
                                controls
                                sizes="100vw"
                                alt={`${gallery.client_name} ${t('clientGallery.galleryImageAlt')} ${activeImageIndex + 1}`}
                                className="h-full w-full object-contain"
                                previewWidth={1800}
                                loading="eager"
                                fetchPriority="high"
                            />
                            <button
                                type="button"
                                onClick={showPreviousImage}
                                className="absolute left-3 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center border border-white/15 bg-black/50 text-white/70 backdrop-blur-md transition-colors hover:border-accent hover:text-accent"
                                aria-label={translateText('Previous image')}
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </button>
                            <button
                                type="button"
                                onClick={showNextImage}
                                className="absolute right-3 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center border border-white/15 bg-black/50 text-white/70 backdrop-blur-md transition-colors hover:border-accent hover:text-accent"
                                aria-label={translateText('Next image')}
                            >
                                <ChevronRight className="h-5 w-5" />
                            </button>
                            {lightboxCollection === 'proofs' ? <button
                                type="button"
                                onClick={() => toggleImageSelection(activeImage)}
                                disabled={isApproving}
                                className={`absolute bottom-3 left-3 right-3 flex items-center justify-center gap-3 border px-5 py-4 text-[10px] font-bold uppercase tracking-[0.28em] transition-colors sm:left-auto sm:right-3 sm:w-auto ${
                                    selectedImageSet.has(activeImage)
                                        ? 'border-white bg-white text-black hover:bg-accent'
                                        : 'border-white/20 bg-black/60 text-white hover:border-accent hover:text-accent'
                                }`}
                            >
                                <Check className="h-4 w-4" />
                                {selectedImageSet.has(activeImage) ? t('ui.selected') : t('ui.selectImage')}
                            </button> : gallery.payment_verified ? <a href={getFinishedDownloadUrl(activeImage)} className="absolute bottom-3 right-3 bg-white px-5 py-4 text-xs text-black">Download original</a> : <span className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-2 border border-white/20 bg-black/60 px-5 py-3 text-[10px] uppercase tracking-[0.22em] text-white/70 backdrop-blur-md"><LockKeyhole className="h-3.5 w-3.5" /> Viewing preview · download locked</span>}
                        </div>
                    </div>
                </div>
            )}

            <Footer />
        </main>
    );
}
