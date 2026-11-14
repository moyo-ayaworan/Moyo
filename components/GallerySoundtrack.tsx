'use client';

import { useState } from 'react';

export default function GallerySoundtrack({ src, title }: { src: string; title: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <aside className="mx-auto flex w-full max-w-7xl flex-col gap-3 border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Gallery soundtrack">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[0.25em] text-accent">Play soundtrack</p>
        <p className="mt-1 break-words text-sm text-white/70">{title}</p>
      </div>
      {failed ? <p role="status" className="text-xs text-white/60">Soundtrack unavailable. You can continue exploring the gallery.</p> : (
        <audio src={src} controls loop preload="none" aria-label={`Play ${title}`} onError={() => setFailed(true)} className="h-10 w-full sm:w-72 sm:shrink-0" />
      )}
    </aside>
  );
}
