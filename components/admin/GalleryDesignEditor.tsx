'use client';

import { useState } from 'react';
import GalleryCover from '@/components/gallery/GalleryCover';
import GalleryMedia from '@/components/GalleryMedia';
import { defaultGalleryPresentation, normalizeGalleryPresentation, type GalleryPresentation } from '@/lib/galleryPresentation';
import { isImageUrl } from '@/lib/mediaUrl';

export default function GalleryDesignEditor({ value, images, previews, clientName, disabled, onSave }: {
  value?: GalleryPresentation | null; images: string[]; previews?: string[]; clientName: string;
  disabled: boolean;
  onSave: (settings: GalleryPresentation | null) => Promise<boolean>;
}) {
  const initial = () => normalizeGalleryPresentation(value || defaultGalleryPresentation);
  const [draft, setDraft] = useState(initial);
  const [device, setDevice] = useState<'desktop' | 'phone'>('desktop');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const imageChoices = images.map((src, index) => ({ src, preview: previews?.[index] || src, index })).filter(item => isImageUrl(item.src));
  const cover = imageChoices.find(item => item.src === draft.coverImage) || imageChoices[0];
  const patch = (change: Partial<GalleryPresentation>) => { setDraft(current => ({ ...current, ...change })); setMessage(''); };
  const changed = JSON.stringify(draft) !== JSON.stringify(initial());
  const locked = disabled || saving;
  const inputClass = 'mt-2 block w-full border border-white/15 bg-black/30 p-3 text-sm text-white disabled:opacity-40';

  async function save(settings: GalleryPresentation | null) {
    setSaving(true); setMessage(''); setFailed(false);
    try {
      if (!await onSave(settings)) throw new Error('Could not save the design. Your draft is still here.');
      if (!settings) setDraft(normalizeGalleryPresentation(defaultGalleryPresentation));
      setMessage(settings ? 'Cover saved. Clients will see it when they next open this gallery.' : 'Opening cover removed.');
    } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : 'Could not save design.'); }
    finally { setSaving(false); }
  }

  function choices<K extends keyof GalleryPresentation>(label: string, key: K, options: { value: GalleryPresentation[K]; label: string }[]) {
    return <fieldset><legend className="mb-2 text-[10px] uppercase tracking-[0.18em] text-white/50">{label}</legend><div className="flex flex-wrap gap-2">{options.map(option => <button key={String(option.value)} type="button" disabled={locked} aria-pressed={draft[key] === option.value} onClick={() => patch({ [key]: option.value })} className={`min-h-10 border px-3 py-2 text-xs transition-colors disabled:opacity-40 ${draft[key] === option.value ? 'border-white/70 bg-white/10 text-white' : 'border-white/10 text-white/50 hover:border-white/40'}`}>{option.label}</button>)}</div></fieldset>;
  }

  return (
    <details className="border border-white/10 bg-black/20" open>
      <summary className="cursor-pointer p-4 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/70">Opening cover</summary>
      <div className="space-y-6 px-4 pb-4">
        <p className="max-w-2xl text-xs leading-relaxed text-white/45">Add a personal opening before the existing gallery. Choose a photograph, title, and cover composition.</p>
        <div className="grid gap-6 xl:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.2fr)]">
          <div className="min-w-0 space-y-6">
              <label className="block text-xs text-white/60">Collection title<input className={inputClass} value={draft.title} placeholder={clientName} disabled={locked} maxLength={160} onChange={e => patch({ title: e.target.value })} /></label>
              <label className="block text-xs text-white/60">Studio name or introduction<input className={inputClass} value={draft.subtitle} disabled={locked} maxLength={160} onChange={e => patch({ subtitle: e.target.value })} /></label>
              <label className="block text-xs text-white/60">Collection date · optional<input type="date" className={inputClass} value={draft.date} disabled={locked} onChange={e => patch({ date: e.target.value })} /></label>
              {choices('Cover composition', 'coverLayout', [{ value: 'center', label: 'Centred' }, { value: 'left', label: 'Left aligned' }, { value: 'split', label: 'Split' }, { value: 'frame', label: 'Framed' }])}
              <fieldset disabled={locked}><legend className="mb-3 text-[10px] uppercase tracking-[0.18em] text-white/50">Cover photograph</legend><div className="grid max-h-56 grid-cols-4 gap-2 overflow-y-auto">{imageChoices.map(item => <button key={`${item.src}-${item.index}`} type="button" aria-label={`Use photograph ${item.index + 1} as cover`} aria-pressed={cover?.src === item.src} onClick={() => patch({ coverImage: item.src })} className={`aspect-square overflow-hidden border-2 ${cover?.src === item.src ? 'border-white' : 'border-transparent opacity-55 hover:opacity-100'}`}><GalleryMedia src={item.preview} alt={`Cover option ${item.index + 1}`} className="h-full w-full object-cover" previewWidth={160} /></button>)}</div>{!imageChoices.length && <p className="text-xs text-white/40">Upload photographs to choose a cover.</p>}</fieldset>
              <fieldset disabled={locked} className="space-y-3"><legend className="mb-2 text-[10px] uppercase tracking-[0.18em] text-white/50">Image focus</legend>{(['focalX', 'focalY'] as const).map(axis => <label key={axis} className="block text-xs text-white/60">{axis === 'focalX' ? 'Horizontal' : 'Vertical'} · {draft[axis]}%<input type="range" min="0" max="100" value={draft[axis]} onChange={e => patch({ [axis]: Number(e.target.value) })} className="mt-2 block w-full" /></label>)}</fieldset>
          </div>
          <div className="min-w-0 space-y-3 xl:sticky xl:top-6 xl:self-start">
            <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-[10px] uppercase tracking-[0.18em] text-white/40">Cover preview</p><div className="flex gap-1" role="group" aria-label="Preview device">{(['desktop', 'phone'] as const).map(size => <button type="button" key={size} aria-pressed={device === size} onClick={() => setDevice(size)} className={`min-h-9 px-3 text-xs capitalize ${device === size ? 'bg-white/10 text-white' : 'text-white/40'}`}>{size}</button>)}</div></div>
            <div className={`mx-auto w-full overflow-hidden border border-white/15 ${device === 'phone' ? 'gallery-preview-phone max-w-[280px] rounded-2xl' : ''}`}>
              <GalleryCover settings={draft} image={cover?.preview || ''} clientName={clientName} preview />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 border-t border-white/10 pt-4">
          <button type="button" disabled={locked || Boolean(value) && !changed} onClick={() => void save(draft)} className="min-h-11 bg-white px-5 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-black disabled:opacity-40">{saving ? 'Saving…' : 'Save opening cover'}</button>
          {changed && <button type="button" disabled={locked} onClick={() => { setDraft(initial()); setMessage(''); }} className="min-h-11 text-xs text-white/50">Discard changes</button>}
          {value && <button type="button" disabled={locked} onClick={() => void save(null)} className="min-h-11 text-xs text-white/50">Remove opening cover</button>}
          {changed && <span className="text-xs text-white/40">Unsaved preview</span>}
        </div>
        {message && <p role={failed ? 'alert' : 'status'} className={`text-xs ${failed ? 'text-red-200' : 'text-green-200'}`}>{message}</p>}
      </div>
    </details>
  );
}
