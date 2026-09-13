'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { setStorageItem } from '@/lib/browserStorage';
import {
  ArrowRight,
  CalendarCheck,
  Camera,
  Compass,
  Loader2,
  LockKeyhole,
  Mail,
  MessageCircle,
  Minimize2,
  Palette,
  RotateCcw,
  Send,
  Images,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { usePathname } from 'next/navigation';
import { LanguageCode, useLanguage } from '@/context/LanguageContext';

type ChatRole = 'assistant' | 'user';

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
};

const DISMISS_KEY = 'eniyan-chat-dismissed-at';

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

const ROUTE_LABELS: Record<string, string> = {
  '/': 'Home',
  '/photography': 'Photography',
  '/photography/portfolio': 'Photography portfolio',
  '/photography/bookings': 'Book photography',
  '/photography/client-gallery': 'Client gallery',
  '/photography/about': 'Photography about',
  '/photography/newsletter': 'Photography newsletter',
  '/art': 'Fine art',
  '/art/works': 'Artworks',
  '/art/shop': 'Art shop',
  '/art/commissions': 'Art commissions',
  '/art/exhibitions': 'Exhibitions',
  '/art/about': 'Art about',
  '/art/newsletter': 'Art newsletter',
};

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
    subtitle: 'Human site guide',
    placeholder: 'Ask Eniyan...',
    thinking: 'Thinking',
    greeting: "Mo ki o. I'm Eniyan, your guide around Ijabiken Moyo's world. Tell me what you want to do and I'll help you find the right page or next step.",
    starterPrompts: ['Help me choose a service', 'Book a photography session', 'Commission an artwork', 'Find my client gallery'],
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
    subtitle: 'Guide humain du site',
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
    subtitle: 'Guia humano del sitio',
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
    subtitle: 'Menschlicher Website-Guide',
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
    subtitle: 'Guia humano do site',
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
    subtitle: 'دليل إنساني للموقع',
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
    subtitle: '人性化网站向导',
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
    subtitle: 'Olutoju oju opo',
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
    subtitle: 'Nduzi mmadu maka saịtị',
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
    subtitle: 'Jagoran yanar gizo',
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

function getPageContext() {
  if (typeof window === 'undefined') return null;

  const title = document.title;
  const path = window.location.pathname;
  // Send public page identity only; never scrape client details or chat text.
  const visibleText = '';

  return { title, path, visibleText };
}

function getMessageLinks(content: string) {
  const paths = content.match(/\/(?:photography|art)(?:\/[a-z-]+)?|\/(?=\s|$|[.,])/g) || [];
  return Array.from(new Set(paths)).filter((path) => ROUTE_LABELS[path]);
}

function EniyanSign({
  compact = false,
  neutral = false,
  light = false,
}: {
  compact?: boolean;
  neutral?: boolean;
  light?: boolean;
}) {
  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full border shadow-lg shadow-black/20 ${
        compact ? 'size-9' : 'size-14'
      } ${
        neutral && light
          ? 'border-black/10 bg-black/[0.035] text-black/70'
          : neutral
          ? 'border-white/15 bg-white/[0.035] text-white/72'
          : light
            ? 'border-black/10 bg-white text-black/70'
            : 'border-accent/24 bg-white/[0.045] text-accent'
      }`}
      aria-hidden="true"
    >
      <span
        className={`absolute left-1/2 top-2 h-[calc(100%-1rem)] w-px -translate-x-1/2 ${
          neutral && light || !neutral && light ? 'bg-black/18' : neutral ? 'bg-white/18' : 'bg-accent/24'
        }`}
      />
      <span
        className={`absolute top-1/2 -translate-y-1/2 rounded-full ${compact ? 'size-1.5' : 'size-2'} ${
          neutral && light || !neutral && light ? 'bg-black/45' : neutral ? 'bg-white/55' : 'bg-accent'
        }`}
      />
      <span
        className={`relative font-heading italic leading-none ${compact ? 'text-base' : 'text-2xl'} ${
          neutral && light || !neutral && light ? 'text-black/70' : neutral ? 'text-white/75' : 'text-accent'
        }`}
      >
        E
      </span>
    </span>
  );
}

export default function EniyanChat() {
  const { language } = useLanguage();
  const pathname = usePathname();
  const { resolvedTheme, theme } = useTheme();
  const copy = ENIYAN_COPY[language] || ENIYAN_COPY.EN;
  const isLight = (resolvedTheme || theme) === 'light';
  const [isOpen, setIsOpen] = useState(false);
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

  const recentMessages = useMemo(() => messages.slice(-8), [messages]);
  const currentRouteLabel = ROUTE_LABELS[pathname || '/'] || 'Current page';

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isSending]);

  useEffect(() => {
    setMessages((current) => {
      if (current.length !== 1 || current[0]?.id !== 'welcome') return current;
      return [{ ...current[0], content: copy.greeting }];
    });
  }, [copy.greeting]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    const userMessage: ChatMessage = { id: createId(), role: 'user', content: trimmed };
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInput('');
    setError('');
    setIsSending(true);
    setIsOpen(true);

    try {
      const response = await fetch('/api/eniyan', {
        method: 'POST',
        signal: AbortSignal.timeout(20_000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.filter((message) => message.id !== 'welcome').slice(-10).map(({ role, content }) => ({ role, content })),
          page: { ...(getPageContext() || {}), language },
        }),
      });

      const data = (await response.json()) as { reply?: string; error?: string };

      if (!response.ok || !data.reply) {
        throw new Error(data.error || 'Eniyan is unavailable right now.');
      }

      setMessages((current) => [
        ...current,
        { id: createId(), role: 'assistant', content: data.reply || 'I can help you find the right page.' },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Eniyan is unavailable right now.';
      setError(message);
    } finally {
      setIsSending(false);
    }
  }

  function closeChat() {
    setStorageItem('local', DISMISS_KEY, String(Date.now()));
    setIsOpen(false);
  }

  function resetChat() {
    if (isSending) return;
    setMessages([{ id: 'welcome', role: 'assistant', content: copy.greeting }]);
    setInput('');
    setError('');
  }

  if (pathname.startsWith('/admin') || pathname.startsWith('/client/')) return null;

  return (
    <div className="fixed inset-x-2 bottom-2 z-[120] flex max-w-[calc(100vw-1rem)] flex-col items-stretch gap-3 pb-[env(safe-area-inset-bottom)] sm:inset-x-auto sm:bottom-4 sm:right-4 sm:max-w-[calc(100vw-2rem)] sm:items-end md:bottom-6 md:right-6">
      <AnimatePresence>
        {isOpen && (
          <motion.section
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.98 }}
            transition={{ duration: 0.32, ease: [0.19, 1, 0.22, 1] }}
            className={`relative flex h-[min(720px,calc(100dvh-5rem))] max-h-[calc(100dvh-5rem)] w-full min-w-0 max-w-full flex-col overflow-hidden rounded-[8px] border shadow-2xl backdrop-blur-xl sm:h-[min(720px,calc(100dvh-6.5rem))] sm:w-[min(560px,calc(100vw-2rem))] lg:w-[min(920px,calc(100vw-2rem))] ${
              isLight
                ? 'border-black/10 bg-[#fbfaf7]/98 text-[#141414] shadow-black/12'
                : 'border-white/10 bg-[#0f0f0f]/98 text-white shadow-black/45'
            }`}
            aria-label="Eniyan AI chat assistant"
          >
            <header className={`min-w-0 shrink-0 border-b px-3 py-3 sm:px-5 sm:py-4 ${isLight ? 'border-black/10' : 'border-white/10'}`}>
              <div className="flex min-w-0 items-start justify-between gap-2 sm:gap-4">
                <div className="flex min-w-0 flex-1 gap-3">
                  <span className="hidden shrink-0 min-[380px]:inline-flex">
                    <EniyanSign compact neutral light={isLight} />
                  </span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <h2 className={`min-w-0 font-heading text-2xl italic leading-none [overflow-wrap:anywhere] ${isLight ? 'text-[#141414]' : 'text-white'}`}>
                        {copy.title}
                      </h2>
                      <span className={`max-w-full border px-2 py-1 text-[8px] uppercase tracking-[0.16em] [overflow-wrap:anywhere] ${
                        isLight ? 'border-black/10 bg-black/[0.035] text-black/45' : 'border-white/10 bg-white/[0.045] text-white/45'
                      }`}>
                        {copy.eyebrow}
                      </span>
                    </div>
                    <p className={`line-clamp-2 max-w-xl text-xs leading-relaxed ${isLight ? 'text-black/52' : 'text-white/52'}`}>
                      {copy.subtitle}. You are on {currentRouteLabel}.
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
                  <button
                    type="button"
                    onClick={resetChat}
                    className={`grid size-9 place-items-center rounded-[8px] transition sm:size-9 ${
                      isLight ? 'text-black/45 hover:bg-black/5 hover:text-black' : 'text-white/50 hover:bg-white/8 hover:text-white'
                    }`}
                    aria-label="Reset Eniyan chat"
                  >
                    <RotateCcw className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className={`grid size-9 place-items-center rounded-[8px] transition sm:size-9 ${
                      isLight ? 'text-black/45 hover:bg-black/5 hover:text-black' : 'text-white/50 hover:bg-white/8 hover:text-white'
                    }`}
                    aria-label="Minimize Eniyan"
                  >
                    <Minimize2 className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={closeChat}
                    className={`grid size-9 place-items-center rounded-[8px] transition sm:size-9 ${
                      isLight ? 'text-black/45 hover:bg-black/5 hover:text-black' : 'text-white/50 hover:bg-white/8 hover:text-white'
                    }`}
                    aria-label="Close Eniyan"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </header>

            <div className="grid min-h-0 min-w-0 flex-1 lg:grid-cols-[minmax(0,1fr)_280px]">
              <section className="flex min-h-0 min-w-0 flex-col">
                <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-3 py-4 sm:space-y-5 sm:px-5 sm:py-5">
                  {recentMessages.map((message) => {
                    const links = message.role === 'assistant' ? getMessageLinks(message.content) : [];

                    return (
                      <div
                        key={message.id}
                        className={`flex min-w-0 gap-2 sm:gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        {message.role === 'assistant' && (
                          <span className="hidden shrink-0 sm:inline-flex">
                            <EniyanSign compact neutral light={isLight} />
                          </span>
                        )}
                        <div className={`flex min-w-0 max-w-full flex-col sm:max-w-[86%] ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                          <p
                            className={`max-w-full whitespace-pre-wrap rounded-[8px] px-3 py-2.5 text-sm leading-relaxed [overflow-wrap:anywhere] sm:px-4 sm:py-3 ${
                              message.role === 'user'
                                ? isLight
                                  ? 'bg-[#181818] text-white'
                                  : 'bg-white text-[#111111]'
                                : isLight
                                  ? 'border border-black/8 bg-black/[0.035] text-black/72'
                                  : 'border border-white/10 bg-white/[0.045] text-white/78'
                            }`}
                          >
                            {message.content}
                          </p>
                          {links.length > 0 && (
                            <div className="mt-2 flex max-w-full flex-wrap gap-2">
                              {links.map((path) => (
                                <a
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
                                </a>
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
                        <EniyanSign compact neutral light={isLight} />
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
                  {error && <p className="text-xs leading-relaxed text-red-500">{error}</p>}
                </div>

                <div className={`shrink-0 border-t px-3 py-3 sm:px-5 sm:py-4 ${isLight ? 'border-black/10' : 'border-white/10'}`}>
                  <div className="mb-3 flex max-w-full gap-2 overflow-x-auto overscroll-x-contain pb-1 [-webkit-overflow-scrolling:touch]">
                    {copy.starterPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => sendMessage(prompt)}
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
                      value={input}
                      rows={1}
                      onChange={(event) => setInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          sendMessage(input);
                        }
                      }}
                      placeholder={copy.placeholder}
                      className={`max-h-24 min-h-11 min-w-0 flex-1 resize-none bg-transparent px-2 py-3 text-sm outline-none transition ${
                        isLight
                          ? 'text-black placeholder:text-black/30'
                          : 'text-white placeholder:text-white/30'
                      }`}
                    />
                    <button
                      type="submit"
                      disabled={!input.trim() || isSending}
                      className={`grid size-11 shrink-0 place-items-center rounded-[8px] transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        isLight
                          ? 'bg-black text-white hover:bg-accent hover:text-black'
                          : 'bg-white text-black hover:bg-accent'
                      }`}
                      aria-label="Send message"
                    >
                      <Send className="size-4" aria-hidden="true" />
                    </button>
                  </form>
                </div>
              </section>

              <aside className={`hidden border-l p-4 lg:block ${isLight ? 'border-black/10 bg-black/[0.025]' : 'border-white/10 bg-white/[0.025]'}`}>
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
                      <a
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
                                ? 'border-black/10 bg-[#111111] text-white'
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
                        </a>
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
        onClick={() => setIsOpen((current) => !current)}
        className={`group ml-auto flex h-12 w-fit max-w-full items-center gap-3 rounded-full border px-3 shadow-xl shadow-black/20 backdrop-blur-xl transition ${
          isLight
            ? 'border-black/10 bg-white/80 text-black/70 hover:border-black/18 hover:bg-white hover:text-black'
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
            <EniyanSign compact neutral light={isLight} />
            <span className="hidden pr-1 text-[10px] font-semibold uppercase tracking-[0.18em] sm:inline">Ask Eniyan</span>
          </>
        )}
      </button>
    </div>
  );
}
