import type { CSSProperties } from 'react';

export type GalleryPresentation = {
  coverImage: string;
  title: string;
  subtitle: string;
  date: string;
  coverLayout: 'center' | 'left' | 'split' | 'frame';
  focalX: number;
  focalY: number;
};

export const defaultGalleryPresentation: GalleryPresentation = {
  coverImage: '', title: '', subtitle: 'Ijabiken Moyo / A private collection', date: '',
  coverLayout: 'split', focalX: 50, focalY: 50,
};

export function normalizeGalleryPresentation(value: unknown): GalleryPresentation {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const choice = <T extends string>(key: string, options: readonly T[], fallback: T): T => options.includes(input[key] as T) ? input[key] as T : fallback;
  const string = (key: string, max: number) => typeof input[key] === 'string' ? (input[key] as string).trim().slice(0, max) : '';
  const focal = (key: string) => typeof input[key] === 'number' && Number.isFinite(input[key]) ? Math.min(100, Math.max(0, input[key] as number)) : 50;
  const date = string('date', 10);
  return {
    coverImage: string('coverImage', 2048), title: string('title', 160), subtitle: string('subtitle', 160),
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) ? date : '',
    coverLayout: choice('coverLayout', ['center', 'left', 'split', 'frame'], 'split'),
    focalX: focal('focalX'), focalY: focal('focalY'),
  };
}

export function galleryPresentationStyle(settings: GalleryPresentation): CSSProperties {
  return {
    '--gallery-bg': '#0c0c0c', '--gallery-ink': '#f5f1e9', '--gallery-accent': '#920110',
    '--gallery-radius': '0px',
    '--gallery-focal': `${settings.focalX}% ${settings.focalY}%`,
  } as CSSProperties;
}
