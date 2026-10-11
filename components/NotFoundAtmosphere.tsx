'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import styles from '@/app/not-found.module.css';

export default function NotFoundAtmosphere({ children }: { children: ReactNode }) {
  const layer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = layer.current;
    const page = element?.parentElement;
    if (!element || !page) return;

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const pause = page.querySelector<HTMLInputElement>('input[type="checkbox"]');
    let bounds = page.getBoundingClientRect();
    let frame = 0;
    let x = 0;
    let y = 0;

    const reset = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      element.style.setProperty('--pointer-x', '0deg');
      element.style.setProperty('--pointer-y', '0deg');
    };
    const measure = () => { bounds = page.getBoundingClientRect(); };
    const move = (event: PointerEvent) => {
      if (motion.matches || !pointer.matches || pause?.checked || event.pointerType !== 'mouse') return;
      x = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1));
      y = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1));
      if (frame) return;
      frame = requestAnimationFrame(() => {
        element.style.setProperty('--pointer-x', `${x * 3}deg`);
        element.style.setProperty('--pointer-y', `${-y * 2}deg`);
        frame = 0;
      });
    };

    page.addEventListener('pointerenter', measure);
    page.addEventListener('pointermove', move);
    page.addEventListener('pointerleave', reset);
    window.addEventListener('resize', measure);
    motion.addEventListener('change', reset);
    pointer.addEventListener('change', reset);
    pause?.addEventListener('change', reset);
    return () => {
      reset();
      page.removeEventListener('pointerenter', measure);
      page.removeEventListener('pointermove', move);
      page.removeEventListener('pointerleave', reset);
      window.removeEventListener('resize', measure);
      motion.removeEventListener('change', reset);
      pointer.removeEventListener('change', reset);
      pause?.removeEventListener('change', reset);
    };
  }, []);

  return <div ref={layer} className={styles.artwork} aria-hidden="true">{children}</div>;
}
