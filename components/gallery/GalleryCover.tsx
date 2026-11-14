'use client';

import GalleryMedia from '@/components/GalleryMedia';
import { galleryPresentationStyle, type GalleryPresentation } from '@/lib/galleryPresentation';
import './galleryPresentation.css';

export default function GalleryCover({ settings, image, clientName, preview = false, onEnter }: {
  settings: GalleryPresentation; image: string; clientName: string; preview?: boolean; onEnter?: () => void;
}) {
  return (
    <section style={galleryPresentationStyle(settings)} className={`gallery-cover gallery-cover--${settings.coverLayout} ${preview ? 'gallery-cover--preview' : ''}`} aria-label="Collection cover">
      <div className="gallery-cover__image">
        {image ? <GalleryMedia src={image} alt={`${clientName} collection cover`} loading={preview ? 'lazy' : 'eager'} fetchPriority={preview ? 'auto' : 'high'} previewWidth={preview ? 600 : 1600} sizes={preview ? '400px' : '(min-width: 768px) 60vw, 100vw'} className="gallery-cover__photo" /> : <div className="gallery-cover__placeholder">Your collection</div>}
      </div>
      <div className="gallery-cover__copy">
        <p className="gallery-cover__studio">{settings.subtitle || 'Ijabiken Moyo / A private collection'}</p>
        <div className="gallery-cover__heading">
          {settings.date && <p className="gallery-cover__date">{new Date(`${settings.date}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}</p>}
          <h1>{settings.title || clientName}</h1>
        </div>
        <button type="button" onClick={onEnter} tabIndex={preview ? -1 : 0} className="gallery-cover__enter">View gallery <span aria-hidden="true">↗</span></button>
      </div>
    </section>
  );
}
