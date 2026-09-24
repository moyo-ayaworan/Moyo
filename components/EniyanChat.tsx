'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import EniyanBooking from '@/components/EniyanBooking';
import BookingAccess from '@/components/BookingAccess';
import { useEniyanBooking } from '@/lib/useEniyanBooking';
import { wantsEniyanBooking } from '@/lib/bookingRequest';
import { ENIYAN_ROUTES as ROUTE_LABELS, ENIYAN_MESSAGE_LIMIT, getEniyanLinks } from '@/lib/eniyanNavigation';
import {
  ArrowRight,
  CalendarCheck,
  Camera,
  Compass,
  Loader2,
  LockKeyhole,
  Mail,
  MessageCircle,
  Palette,
  RotateCcw,
  Search,
  Send,
  Images,
  X,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { usePathname } from 'next/navigation';
import { LanguageCode, useLanguage } from '@/context/LanguageContext';

type ChatRole = 'assistant' | 'user';

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  mode?: 'ai' | 'guided';
};

const FEATURE_CARDS = [
  {
    id: 'portfolio',
    href: '/photography/portfolio',
    icon: Camera,
  },
  {
    id: 'bookings',
    href: '/photography/bookings',
    icon: CalendarCheck,
  },
  {
    id: 'artArchive',
    href: '/art/works',
    icon: Images,
  },
  {
    id: 'commissions',
    href: '/art/commissions',
    icon: Palette,
  },
  {
    id: 'clientGallery',
    href: '/photography/client-gallery',
    icon: LockKeyhole,
  },
  {
    id: 'newsletters',
    href: '/photography/newsletter',
    icon: Mail,
  },
] as const;

const ENIYAN_COPY: Record<LanguageCode, {
  eyebrow: string;
  title: string;
  subtitle: string;
  placeholder: string;
  thinking: string;
  greeting: string;
  starterPrompts: string[];
  features: Partial<Record<(typeof FEATURE_CARDS)[number]['id'], { label: string; title: string; action: string }>>;
}> = {
  EN: {
    eyebrow: 'Site companion',
    title: 'Eniyan',
    subtitle: 'AI studio guide',
    placeholder: 'Ask Eniyan...',
    thinking: 'Thinking',
    greeting: "Mo ki o. I'm Eniyan, your guide around Ijabiken Moyo's world. Tell me what you want to do and I'll help you find the right page or next step.",
    starterPrompts: ['Help me choose a service', 'Book a photography session', 'Track my booking status', 'Commission an artwork', 'Find my client gallery'],
    features: {
      portfolio: { label: 'See', title: 'Photography work', action: 'Explore' },
      bookings: { label: 'Book', title: 'Start a session', action: 'Inquire' },
      artArchive: { label: 'View', title: 'Art archive', action: 'Open' },
      commissions: { label: 'Create', title: 'Custom artwork', action: 'Commission' },
      clientGallery: { label: 'Access', title: 'Client gallery', action: 'Open' },
      newsletters: { label: 'Follow', title: 'Studio updates', action: 'Join' },
    },
  },
  FR: {
    eyebrow: 'Compagnon du site',
    title: 'Eniyan',
    subtitle: 'Guide IA du studio',
    placeholder: 'Demandez a Eniyan...',
    thinking: 'Reflexion',
    greeting: "Bonjour. Je suis Eniyan, votre guide sur le site d'Ijabiken Moyo. Dites-moi ce que vous voulez faire.",
    starterPrompts: ['Reserver une seance photo', 'Voir les travaux recents', 'Voir les expositions'],
    features: {
      portfolio: { label: 'Guide', title: 'Voir le travail', action: 'Explorer' },
      bookings: { label: 'Reserver', title: 'Demarrer', action: 'Reserver' },
      artArchive: { label: 'Archive', title: 'Voir art', action: 'Visiter' },
    },
  },
  ES: {
    eyebrow: 'Guia del sitio',
    title: 'Eniyan',
    subtitle: 'Guía de IA del estudio',
    placeholder: 'Pregunta a Eniyan...',
    thinking: 'Pensando',
    greeting: 'Hola. Soy Eniyan, tu guia en el sitio de Ijabiken Moyo. Dime que quieres hacer.',
    starterPrompts: ['Reservar una sesion', 'Ver trabajos recientes', 'Ver exposiciones'],
    features: {
      portfolio: { label: 'Guia', title: 'Ver obras', action: 'Explorar' },
      bookings: { label: 'Reserva', title: 'Iniciar sesion', action: 'Reservar' },
      artArchive: { label: 'Archivo', title: 'Ver arte', action: 'Visitar' },
    },
  },
  DE: {
    eyebrow: 'Website-Begleiter',
    title: 'Eniyan',
    subtitle: 'KI-Studioguide',
    placeholder: 'Frag Eniyan...',
    thinking: 'Denke nach',
    greeting: 'Hallo. Ich bin Eniyan, dein Guide auf der Website von Ijabiken Moyo. Sag mir, was du tun moechtest.',
    starterPrompts: ['Fotosession buchen', 'Aktuelle Arbeiten sehen', 'Ausstellungen sehen'],
    features: {
      portfolio: { label: 'Guide', title: 'Arbeiten sehen', action: 'Entdecken' },
      bookings: { label: 'Buchen', title: 'Session starten', action: 'Buchen' },
      artArchive: { label: 'Archiv', title: 'Kunst ansehen', action: 'Besuchen' },
    },
  },
  PT: {
    eyebrow: 'Guia do site',
    title: 'Eniyan',
    subtitle: 'Guia de IA do estúdio',
    placeholder: 'Pergunte ao Eniyan...',
    thinking: 'Pensando',
    greeting: 'Ola. Sou Eniyan, seu guia no site de Ijabiken Moyo. Diga-me o que quer fazer.',
    starterPrompts: ['Marcar uma sessao', 'Ver trabalhos recentes', 'Ver exposicoes'],
    features: {
      portfolio: { label: 'Guia', title: 'Ver trabalhos', action: 'Explorar' },
      bookings: { label: 'Marcar', title: 'Iniciar sessao', action: 'Marcar' },
      artArchive: { label: 'Arquivo', title: 'Ver arte', action: 'Visitar' },
    },
  },
  AR: {
    eyebrow: 'دليل الموقع',
    title: 'Eniyan',
    subtitle: 'دليل الاستوديو بالذكاء الاصطناعي',
    placeholder: 'اسأل Eniyan...',
    thinking: 'يفكر',
    greeting: 'مرحبا. أنا Eniyan، دليلك في موقع Ijabiken Moyo. أخبرني بما تريد فعله.',
    starterPrompts: ['حجز جلسة تصوير', 'أين أرى الأعمال الحديثة؟', 'اعرض المعارض'],
    features: {
      portfolio: { label: 'دليل', title: 'شاهد الأعمال', action: 'استكشف' },
      bookings: { label: 'حجز', title: 'ابدأ جلسة', action: 'احجز' },
      artArchive: { label: 'أرشيف', title: 'شاهد الفن', action: 'زيارة' },
    },
  },
  ZH: {
    eyebrow: '网站向导',
    title: 'Eniyan',
    subtitle: 'AI 工作室向导',
    placeholder: '问 Eniyan...',
    thinking: '思考中',
    greeting: '你好。我是 Eniyan，是你浏览 Ijabiken Moyo 网站的向导。告诉我你想做什么。',
    starterPrompts: ['预约摄影', '查看近期作品', '查看展览'],
    features: {
      portfolio: { label: '向导', title: '查看作品', action: '探索' },
      bookings: { label: '预约', title: '开始拍摄', action: '预约' },
      artArchive: { label: '档案', title: '查看艺术', action: '访问' },
    },
  },
  YO: {
    eyebrow: 'Oluranlowo oju opo',
    title: 'Eniyan',
    subtitle: 'Olùrànlọ́wọ́ AI',
    placeholder: 'Beere lowo Eniyan...',
    thinking: 'N ronu',
    greeting: 'Mo ki o. Emi ni Eniyan, olutoju re lori oju opo Ijabiken Moyo. So ohun ti o fe se fun mi.',
    starterPrompts: ['Mo fe book igba foto', 'Nibo ni mo ti ri ise tuntun?', 'Fi exhibition han mi'],
    features: {
      portfolio: { label: 'Itosona', title: 'Wo ise', action: 'Sewo' },
      bookings: { label: 'Book', title: 'Bere igba foto', action: 'Book' },
      artArchive: { label: 'Akojo', title: 'Wo art', action: 'Wo' },
    },
  },
  IG: {
    eyebrow: 'Nduzi saịtị',
    title: 'Eniyan',
    subtitle: 'Nduzi AI',
    placeholder: 'Juo Eniyan...',
    thinking: 'Na-eche',
    greeting: 'Ndewo. A bu m Eniyan, onye ndu gi na webusaiti Ijabiken Moyo. Gwa m ihe ichoro ime.',
    starterPrompts: ['Book oge foto', 'Ebee ka m ga-ahụ ọrụ ọhụrụ?', 'Gosi m ngosi nka'],
    features: {
      portfolio: { label: 'Nduzi', title: 'Lee ọrụ', action: 'Chọpụta' },
      bookings: { label: 'Book', title: 'Malite foto', action: 'Book' },
      artArchive: { label: 'Nchịkọta', title: 'Lee art', action: 'Gaa' },
    },
  },
  HA: {
    eyebrow: 'Jagoran shafi',
    title: 'Eniyan',
    subtitle: 'Jagoran AI',
    placeholder: 'Tambayi Eniyan...',
    thinking: 'Tunani',
    greeting: 'Sannu. Ni ne Eniyan, jagoranka a shafin Ijabiken Moyo. Fadi abin da kake son yi.',
    starterPrompts: ['Yi booking na hoto', 'Ina zan ga sabbin ayyuka?', 'Nuna min nune-nune'],
    features: {
      portfolio: { label: 'Jagora', title: 'Duba aiki', action: 'Bincika' },
      bookings: { label: 'Booking', title: 'Fara zama', action: 'Book' },
      artArchive: { label: 'Tarihi', title: 'Duba art', action: 'Ziyarci' },
    },
  },
};

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function EniyanSign({ compact = false }: { compact?: boolean }) {
  return <span aria-hidden="true" style={{ width: compact ? 36 : 56, height: compact ? 36 : 56, backgroundImage: 'url("/eniyan-sign.svg?v=2")' }} className="block shrink-0 bg-contain bg-center bg-no-repeat" />;
}

export default function EniyanChat() {
  const { language } = useLanguage();
  const pathname = usePathname();
  const { resolvedTheme, theme } = useTheme();
  const copy = ENIYAN_COPY[language] || ENIYAN_COPY.EN;
  const isLight = (resolvedTheme || theme) === 'light';
  const reducedMotion = useReducedMotion();
  const booking = useEniyanBooking();
  const [failedMessage, setFailedMessage] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [viewport, setViewport] = useState<{ height: number; inset: number } | null>(null);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: copy.greeting,
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const pendingRef = useRef<AbortController | null>(null);
  useEffect(() => () => pendingRef.current?.abort(), []);
  useEffect(() => { if (isOpen) inputRef.current?.focus(); }, [isOpen]);
  useEffect(() => {
    const visual = window.visualViewport;
    if (!isOpen || !visual) return;
    const update = () => setViewport({ height: visual.height, inset: Math.max(0, window.innerHeight - visual.height - visual.offsetTop) });
    update();
    visual.addEventListener('resize', update);
    visual.addEventListener('scroll', update);
    return () => { visual.removeEventListener('resize', update); visual.removeEventListener('scroll', update); };
  }, [isOpen]);
  const currentRouteLabel = ROUTE_LABELS[pathname || '/'] || 'Current page';
  const shortViewport = Boolean(viewport && viewport.height < 500);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: reducedMotion ? 'instant' : 'smooth' });
  }, [messages, isSending, reducedMotion]);

  useEffect(() => {
    setMessages((current) => {
      if (current.length !== 1 || current[0]?.id !== 'welcome') return current;
      return [{ ...current[0], content: copy.greeting }];
    });
  }, [copy.greeting]);

  async function sendMessage(text: string, retry = false) {
    const trimmed = text.trim();
    if (!trimmed || pendingRef.current) return;
    if (trimmed.length > ENIYAN_MESSAGE_LIMIT) { setError(`Please keep messages under ${ENIYAN_MESSAGE_LIMIT} characters.`); return; }
    if (wantsEniyanBooking(trimmed)) {
      setInput(''); setError(''); setFailedMessage(null); setIsOpen(true); booking.start();
      return;
    }
    if (/\b(track|status|find|recover|lost)\b.{0,45}\b(booking|appointment|session|link)\b|\b(booking|appointment)\b.{0,30}\b(status|link)\b/i.test(trimmed)) {
      setInput(''); setError(''); setFailedMessage(null); setIsOpen(true); setTrackingOpen(true);
      setMessages(current => [...current, { id: createId(), role: 'user', content: trimmed }, { id: createId(), role: 'assistant', mode: 'guided', content: 'I can help you safely recover your private booking-status link. Enter the booking reference and the same email used to book; I’ll send the link there.' }]);
      return;
    }

    const userMessage: ChatMessage = { id: createId(), role: 'user', content: trimmed };
    const nextMessages = retry ? messages : [...messages, userMessage];
    const controller = new AbortController();
    pendingRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 20_000);

    setMessages(nextMessages);
    setInput('');
    setError('');
    setFailedMessage(null);
    setIsSending(true);
    setIsOpen(true);

    try {
      const response = await fetch('/api/eniyan', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.filter((message) => message.id !== 'welcome').slice(-10).map(({ role, content }) => ({ role, content })),
          page: { path: pathname, language },
        }),
      });

      const data = (await response.json()) as { reply?: string; error?: string; mode?: 'ai' | 'guided' };

      if (!response.ok || typeof data.reply !== 'string' || !data.reply.trim()) {
        throw new Error(data.error || 'Eniyan is unavailable right now.');
      }

      const reply = data.reply;
      setMessages((current) => [
        ...current,
        { id: createId(), role: 'assistant', content: reply, mode: data.mode },
      ]);
    } catch (err) {
      const message = controller.signal.aborted ? 'The request timed out. Please try again.' : err instanceof Error ? err.message : 'Eniyan is unavailable right now.';
      setError(message);
      setFailedMessage(trimmed);
    } finally {
      window.clearTimeout(timeout);
      pendingRef.current = null;
      setIsSending(false);
    }
  }

  function closeChat() {
    setIsOpen(false);
    requestAnimationFrame(() => launcherRef.current?.focus());
  }

  function resetChat() {
    if (isSending || booking.locked) return;
    booking.cancel();
    setTrackingOpen(false);
    setMessages([{ id: 'welcome', role: 'assistant', content: copy.greeting }]);
    setInput('');
    setError('');
    setFailedMessage(null);
    inputRef.current?.focus();
  }

  if (pathname.startsWith('/admin') || pathname.startsWith('/client/')) return null;

  return (
    <div style={isOpen && viewport?.inset ? { bottom: viewport.inset + 8 } : undefined} className="fixed inset-x-2 bottom-2 z-[120] flex max-w-[calc(100vw-1rem)] flex-col items-stretch gap-3 pb-[env(safe-area-inset-bottom)] sm:inset-x-auto sm:bottom-4 sm:right-4 sm:max-w-[calc(100vw-2rem)] sm:items-end md:bottom-6 md:right-6">
      <AnimatePresence>
        {isOpen && (
          <motion.section
            initial={reducedMotion ? false : { opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.98 }}
            transition={{ duration: reducedMotion ? 0 : 0.22, ease: [0.19, 1, 0.22, 1] }}
            style={viewport ? { maxHeight: Math.max(160, viewport.height - (shortViewport ? 24 : 100)) } : undefined}
            className={`relative flex h-[min(720px,calc(100dvh-5rem))] max-h-[calc(100dvh-5rem)] w-full min-w-0 max-w-full flex-col overflow-hidden rounded-[8px] border shadow-2xl backdrop-blur-xl sm:h-[min(720px,calc(100dvh-6.5rem))] sm:w-[min(560px,calc(100vw-2rem))] lg:w-[min(920px,calc(100vw-2rem))] ${
              isLight
                ? 'border-black/10 bg-[#fbfaf7]/98 text-[#141414] shadow-black/12'
                : 'border-white/10 bg-[#0f0f0f]/98 text-white shadow-black/45'
            }`}
            id="eniyan-chat-panel"
            role="dialog"
            aria-labelledby="eniyan-title"
            dir={language === 'AR' ? 'rtl' : 'ltr'}
            onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); closeChat(); } }}
          >
            <header className={`min-w-0 shrink-0 border-b px-3 py-3 sm:px-5 sm:py-4 ${isLight ? 'border-black/10' : 'border-white/10'}`}>
              <div className="flex min-w-0 items-start justify-between gap-2 sm:gap-4">
                <div className="flex min-w-0 flex-1 gap-3">
                  <span className="hidden shrink-0 min-[380px]:inline-flex">
                    <EniyanSign compact />
                  </span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <h2 id="eniyan-title" className={`min-w-0 font-heading text-2xl italic leading-none [overflow-wrap:anywhere] ${isLight ? 'text-[#141414]' : 'text-white'}`}>
                        {copy.title}
                      </h2>
                      <span className={`max-w-full border px-2 py-1 text-[8px] uppercase tracking-[0.16em] [overflow-wrap:anywhere] ${
                        isLight ? 'border-black/10 bg-black/[0.035] text-black/45' : 'border-white/10 bg-white/[0.045] text-white/45'
                      }`}>
                        {copy.eyebrow}
                      </span>
                    </div>
                    <p className={`${shortViewport ? 'hidden' : 'line-clamp-2'} max-w-xl text-xs leading-relaxed ${isLight ? 'text-black/52' : 'text-white/52'}`}>
                      {copy.subtitle}. You are on {currentRouteLabel}.
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
                  <button
                    type="button"
                    onClick={resetChat}
                    disabled={isSending || booking.locked}
                    className={`grid size-11 place-items-center rounded-[8px] transition disabled:opacity-40 ${
                      isLight ? 'text-black/45 hover:bg-black/5 hover:text-black' : 'text-white/50 hover:bg-white/8 hover:text-white'
                    }`}
                    aria-label="Reset Eniyan chat"
                  >
                    <RotateCcw className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={closeChat}
                    className={`grid size-11 place-items-center rounded-[8px] transition disabled:opacity-40 ${
                      isLight ? 'text-black/45 hover:bg-black/5 hover:text-black' : 'text-white/50 hover:bg-white/8 hover:text-white'
                    }`}
                    aria-label="Close Eniyan"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </header>

            <div className="grid min-h-0 min-w-0 flex-1 grid-rows-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_280px]">
              <section className="flex min-h-0 min-w-0 flex-col">
                {booking.active ? <EniyanBooking flow={booking} isLight={isLight} /> : trackingOpen ? <section className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                  <button type="button" onClick={() => setTrackingOpen(false)} className="mb-4 min-h-11 rounded-lg border border-current/25 px-3 py-2 text-xs">Back to Eniyan</button>
                  <BookingAccess compact isLight={isLight} />
                  <p className="mt-4 text-[11px] leading-relaxed opacity-60">For your privacy, Eniyan never displays booking details in chat and only sends access to the email attached to the booking.</p>
                </section> : <>
                <div ref={scrollRef} role="log" aria-label="Conversation with Eniyan" aria-live="polite" aria-relevant="additions" className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-3 py-4 sm:space-y-5 sm:px-5 sm:py-5">
                  {messages.map((message) => {
                    const links = message.role === 'assistant' ? getEniyanLinks(message.content) : [];

                    return (
                      <div
                        key={message.id}
                        className={`flex min-w-0 gap-2 sm:gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        {message.role === 'assistant' && (
                          <span className="hidden shrink-0 sm:inline-flex">
                            <EniyanSign compact />
                          </span>
                        )}
                        <div className={`flex min-w-0 max-w-full flex-col sm:max-w-[86%] ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                          <p
                            className={`max-w-full whitespace-pre-wrap rounded-[8px] px-3 py-2.5 text-sm leading-relaxed [overflow-wrap:anywhere] sm:px-4 sm:py-3 ${
                              message.role === 'user'
                                ? isLight
                                  ? 'bg-[#181818] text-[#ffffff]'
                                  : 'bg-white text-[#111111]'
                                : isLight
                                  ? 'border border-black/8 bg-black/[0.035] text-black/72'
                                  : 'border border-white/10 bg-white/[0.045] text-white/78'
                            }`}
                          >
                            {message.content}
                          </p>
                          {message.mode === 'guided' && <span className="mt-1 text-[10px] opacity-65">Site guide · automatic reply</span>}
                          {links.length > 0 && (
                            <div className="mt-2 flex max-w-full flex-wrap gap-2">
                              {links.map((path) => (
                                <Link
                                  onClick={closeChat}
                                  key={path}
                                  href={path}
                                  className={`inline-flex items-center gap-1.5 rounded-[8px] border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] transition ${
                                    isLight
                                      ? 'border-black/10 bg-white/70 text-black/62 hover:border-black/22 hover:text-black'
                                      : 'border-white/10 bg-white/[0.045] text-white/62 hover:border-white/22 hover:text-white'
                                  }`}
                                >
                                  {ROUTE_LABELS[path]}
                                  <ArrowRight className="size-3" aria-hidden="true" />
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {isSending && (
                    <div className="flex justify-start gap-3">
                      <span className="hidden shrink-0 sm:inline-flex">
                        <EniyanSign compact />
                      </span>
                      <div
                        className={`flex items-center gap-2 rounded-[8px] border px-4 py-3 text-sm ${
                          isLight ? 'border-black/8 bg-black/[0.035] text-black/55' : 'border-white/10 bg-white/[0.045] text-white/55'
                        }`}
                      >
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                        {copy.thinking}
                      </div>
                    </div>
                  )}
                  {error && <div role="alert" className="space-y-2 text-xs leading-relaxed text-red-500"><p>{error}</p>{failedMessage && <button type="button" onClick={() => sendMessage(failedMessage, true)} disabled={isSending} className="min-h-11 rounded border border-current px-3 font-semibold">Retry message</button>}</div>}
                </div>

                <div className={`shrink-0 border-t px-3 py-3 sm:px-5 sm:py-4 ${isLight ? 'border-black/10' : 'border-white/10'}`}>
                  <div className="mb-2 flex flex-wrap gap-2">
                    <button type="button" disabled={isSending} onClick={() => { setInput(''); setTrackingOpen(false); booking.start(); }} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-current/25 px-3 text-xs font-semibold disabled:opacity-40"><CalendarCheck className="size-4" aria-hidden="true" />Book a session</button>
                    <button type="button" disabled={isSending} onClick={() => { setInput(''); setTrackingOpen(true); }} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-current/25 px-3 text-xs font-semibold disabled:opacity-40"><Search className="size-4" aria-hidden="true" />Track my booking</button>
                  </div>
                  <div className={`${shortViewport ? 'hidden' : 'flex'} mb-3 max-w-full gap-2 overflow-x-auto overscroll-x-contain pb-1 [-webkit-overflow-scrolling:touch]`}>
                    {copy.starterPrompts.map((prompt, index) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => index === (language === 'EN' ? 1 : 0) ? booking.start() : sendMessage(prompt)}
                        disabled={isSending}
                        className={`max-w-[72vw] shrink-0 rounded-[8px] border px-3 py-2 text-left text-[10px] uppercase tracking-[0.12em] [overflow-wrap:anywhere] transition sm:max-w-none ${
                          isLight ? 'border-black/10 bg-white/45 text-black/52 hover:bg-white/75 hover:text-black' : 'border-white/10 bg-white/[0.035] text-white/55 hover:bg-white/[0.07] hover:text-white'
                        }`}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>

                  <form
                    className={`flex min-w-0 items-end gap-2 rounded-[8px] border p-2 ${
                      isLight ? 'border-black/10 bg-white/60' : 'border-white/10 bg-white/[0.035]'
                    }`}
                    onSubmit={(event) => {
                      event.preventDefault();
                      sendMessage(input);
                    }}
                  >
                    <label className="sr-only" htmlFor="eniyan-message">
                      Message Eniyan
                    </label>
                    <textarea
                      id="eniyan-message"
                      ref={inputRef}
                      maxLength={ENIYAN_MESSAGE_LIMIT}
                      aria-describedby="eniyan-privacy"
                      value={input}
                      rows={1}
                      onChange={(event) => setInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                          event.preventDefault();
                          sendMessage(input);
                        }
                      }}
                      placeholder={copy.placeholder}
                      className={`max-h-24 min-h-11 min-w-0 flex-1 resize-none bg-transparent px-2 py-3 text-base outline-none transition sm:text-sm ${
                        isLight
                          ? 'text-black placeholder:text-black/30'
                          : 'text-white placeholder:text-white/30'
                      }`}
                    />
                    <button
                      type="submit"
                      aria-busy={isSending}
                      disabled={!input.trim() || isSending}
                      className={`grid size-11 shrink-0 place-items-center rounded-[8px] transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        isLight
                          ? 'bg-black text-[#ffffff] hover:bg-accent'
                          : 'bg-white text-black hover:bg-accent'
                      }`}
                      aria-label="Send message"
                    >
                      <Send className="size-4" aria-hidden="true" />
                    </button>
                  </form>
                  <p id="eniyan-privacy" className="mt-2 text-[10px] leading-relaxed opacity-60">{shortViewport ? 'AI guide · Messages may be processed by Google Gemini. Keep private details out of chat.' : 'AI-assisted guidance. Messages may be processed by Google Gemini. Never share access codes, passwords or payment details. Confirm quotes and bookings with the studio.'}</p>
                </div>
                </>}
              </section>

              <aside className={`hidden min-h-0 overflow-y-auto overscroll-contain border-l p-4 lg:block ${isLight ? 'border-black/10 bg-black/[0.025]' : 'border-white/10 bg-white/[0.025]'}`}>
                <div className="mb-4 flex items-center gap-2">
                  <Compass className={`size-4 ${isLight ? 'text-black/45' : 'text-white/45'}`} aria-hidden="true" />
                  <p className={`text-[10px] uppercase tracking-[0.24em] ${isLight ? 'text-black/45' : 'text-white/45'}`}>
                    Navigation
                  </p>
                </div>
                <div className="space-y-2">
                  {FEATURE_CARDS.map((card) => {
                    const Icon = card.icon;
                    const cardCopy = copy.features[card.id] || ENIYAN_COPY.EN.features[card.id];
                    if (!cardCopy) return null;
                    return (
                      <Link
                        onClick={closeChat}
                        key={card.href}
                        href={card.href}
                        className={`group flex items-center gap-3 rounded-[8px] border p-3 transition ${
                            isLight
                              ? 'border-black/10 bg-white/50 hover:bg-white/85'
                              : 'border-white/10 bg-white/[0.035] hover:bg-white/[0.07]'
                          }`}
                        >
                          <span
                            className={`grid size-10 shrink-0 place-items-center rounded-[8px] border ${
                              isLight
                                ? 'border-black/10 bg-[#111111] text-[#ffffff]'
                                : 'border-white/10 bg-white/[0.045] text-white/70'
                            }`}
                          >
                            <Icon className="size-4" aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className={`block text-[8px] font-semibold uppercase tracking-[0.2em] ${isLight ? 'text-black/38' : 'text-white/38'}`}>
                              {cardCopy.label}
                            </span>
                            <span className={`mt-1 block truncate text-sm font-semibold ${isLight ? 'text-black/82' : 'text-white/84'}`}>
                              {cardCopy.title}
                            </span>
                          </span>
                          <ArrowRight className={`size-4 shrink-0 transition group-hover:translate-x-1 ${isLight ? 'text-black/35' : 'text-white/35'}`} aria-hidden="true" />
                        </Link>
                      );
                    })}
                </div>

                <div className={`mt-4 rounded-[8px] border p-4 ${isLight ? 'border-black/10 text-black/48' : 'border-white/10 text-white/48'}`}>
                  <MessageCircle className="mb-3 size-4" aria-hidden="true" />
                  <p className="text-xs leading-relaxed">
                    Studio guide for photography, fine art, bookings, galleries, and commissions.
                  </p>
                </div>
              </aside>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <button
        type="button"
        ref={launcherRef}
        onClick={() => isOpen ? closeChat() : setIsOpen(true)}
        aria-expanded={isOpen}
        aria-controls="eniyan-chat-panel"
        className={`${isOpen && shortViewport ? 'hidden' : 'flex'} group ml-auto h-12 w-fit max-w-full items-center gap-3 rounded-full border px-3 shadow-xl shadow-black/20 backdrop-blur-xl transition ${
          isLight
            ? 'border-black/10 bg-white/80 text-black/70 hover:border-black/18 hover:bg-[#ffffff] hover:text-black'
            : 'border-white/10 bg-[#171717]/86 text-white/68 hover:border-white/18 hover:bg-[#1f1f1f]/90 hover:text-white/86'
        }`}
        aria-label={isOpen ? 'Hide Eniyan chat' : 'Open Eniyan chat'}
      >
        {isOpen ? (
          <>
            <X className="size-5" aria-hidden="true" />
            <span className="hidden pr-1 text-[10px] font-semibold uppercase tracking-[0.18em] sm:inline">Close</span>
          </>
        ) : (
          <>
            <EniyanSign compact />
            <span className="pr-1 text-[10px] font-semibold uppercase tracking-[0.16em]">Ask Eniyan</span>
          </>
        )}
      </button>
    </div>
  );
}
