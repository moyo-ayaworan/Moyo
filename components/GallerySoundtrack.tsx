'use client';

import { useEffect, useRef, useState } from 'react';

export default function GallerySoundtrack({ src, title }: { src: string; title: string }) {
  const [failed, setFailed] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    let waitingForInteraction = true;
    const stopRetrying = () => {
      waitingForInteraction = false;
      document.removeEventListener('click', onInteraction);
      document.removeEventListener('keydown', onInteraction);
    };
    const tryPlay = () => {
      if (waitingForInteraction) void audio.play().then(stopRetrying).catch(() => {
        // Keep the player usable when the browser blocks audible autoplay.
      });
    };
    function onInteraction(event: Event) {
      // Using the player is an explicit choice; never override a pause or mute.
      if (event.target instanceof Node && containerRef.current?.contains(event.target)) {
        stopRetrying();
        return;
      }
      tryPlay();
    }
    document.addEventListener('click', onInteraction);
    document.addEventListener('keydown', onInteraction);
    audio.addEventListener('play', stopRetrying);
    audio.addEventListener('error', stopRetrying);
    tryPlay();
    return () => {
      stopRetrying();
      audio.removeEventListener('play', stopRetrying);
      audio.removeEventListener('error', stopRetrying);
      audio.pause();
    };
  }, [src]);
  return (
    <aside ref={containerRef} className="mx-auto flex w-full max-w-7xl flex-col gap-3 border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Gallery soundtrack">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[0.25em] text-accent">Gallery soundtrack</p>
        <p className="mt-1 break-words text-sm text-white/70">{title}</p>
        <p className="mt-1 text-xs text-white/50">Pause or mute the music anytime.</p>
      </div>
      {failed ? <p role="status" className="text-xs text-white/60">Soundtrack unavailable. You can continue exploring the gallery.</p> : (
        <audio ref={audioRef} src={src} autoPlay controls loop preload="auto" aria-label={`Soundtrack: ${title}`} onError={() => setFailed(true)} className="h-10 w-full sm:w-72 sm:shrink-0" />
      )}
    </aside>
  );
}
