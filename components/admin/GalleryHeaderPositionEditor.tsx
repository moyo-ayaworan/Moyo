'use client';

import { useRef, useState, type PointerEvent } from 'react';
import GalleryMedia from '@/components/GalleryMedia';
import { dragImagePosition, normalizeImagePosition, type ImagePosition } from '@/lib/imagePosition';

type Drag = { pointer: number; start: ImagePosition; client: ImagePosition; overflow: ImagePosition };

export default function GalleryHeaderPositionEditor({ image, value, disabled, onSave }: {
  image: string; value?: ImagePosition | null; disabled: boolean; onSave: (position: ImagePosition) => Promise<boolean>;
}) {
  const [position, setPosition] = useState(() => normalizeImagePosition(value));
  const [phone, setPhone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const drag = useRef<Drag | null>(null);
  const saved = normalizeImagePosition(value);
  const changed = position.x !== saved.x || position.y !== saved.y;
  const locked = disabled || saving;

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (locked || event.button !== 0) return;
    const image = event.currentTarget.querySelector('img, video') as HTMLImageElement | HTMLVideoElement | null;
    if (!image) return;
    const width = image instanceof HTMLImageElement ? image.naturalWidth : image.videoWidth;
    const height = image instanceof HTMLImageElement ? image.naturalHeight : image.videoHeight;
    if (!width || !height) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const scale = Math.max(rect.width / width, rect.height / height);
    drag.current = { pointer: event.pointerId, start: position, client: { x: event.clientX, y: event.clientY }, overflow: { x: width * scale - rect.width, y: height * scale - rect.height } };
    event.currentTarget.setPointerCapture(event.pointerId);
    setMessage('');
  }
  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId || locked) return;
    setPosition(dragImagePosition(current.start, { x: event.clientX - current.client.x, y: event.clientY - current.client.y }, current.overflow));
  }
  function endDrag() { drag.current = null; }

  async function save() {
    setSaving(true); setMessage(''); setError(false);
    try {
      if (!await onSave(position)) throw new Error('Could not save the image position. Please retry.');
      setMessage('Header image position saved.');
    } catch (err) { setError(true); setMessage(err instanceof Error ? err.message : 'Could not save position.'); }
    finally { setSaving(false); }
  }

  if (!image) return <p className="text-xs text-white/40">Upload photographs to reposition the gallery header.</p>;
  return (
    <details className="border border-white/10 bg-black/20" open>
      <summary className="cursor-pointer p-4 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/70">Reposition gallery header</summary>
      <div className="space-y-4 px-4 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="max-w-xl text-xs leading-relaxed text-white/50">Drag the photograph to frame your subjects, or use the sliders. This adjusts the header inside the gallery.</p><div className="flex gap-2" role="group" aria-label="Header preview device"><button type="button" aria-pressed={!phone} onClick={() => setPhone(false)} className={`min-h-10 px-3 text-xs ${!phone ? 'bg-white/10 text-white' : 'text-white/40'}`}>Desktop</button><button type="button" aria-pressed={phone} onClick={() => setPhone(true)} className={`min-h-10 px-3 text-xs ${phone ? 'bg-white/10 text-white' : 'text-white/40'}`}>Phone</button></div></div>
        <div className={`relative mx-auto w-full touch-none select-none overflow-hidden border border-white/10 bg-black ${phone ? 'aspect-[4/5] max-w-[280px]' : 'aspect-[2.4/1]'} ${locked ? 'opacity-60' : 'cursor-grab active:cursor-grabbing'}`} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag}>
          <div className="pointer-events-none absolute inset-0" style={{ '--header-position': `${position.x}% ${position.y}%` } as React.CSSProperties}>
            <GalleryMedia src={image} alt="Gallery header crop preview" previewWidth={1200} className="h-full w-full object-cover [object-position:var(--header-position)]" />
          </div>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          <p className="pointer-events-none absolute bottom-5 left-5 font-heading text-xl italic text-white">Your gallery header</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">{(['x', 'y'] as const).map(axis => <label key={axis} className="text-xs text-white/60">{axis === 'x' ? 'Horizontal position' : 'Vertical position'} · {position[axis]}%<input type="range" min="0" max="100" value={position[axis]} disabled={locked} onChange={event => { setPosition(current => ({ ...current, [axis]: Number(event.target.value) })); setMessage(''); }} className="mt-3 block w-full" /></label>)}</div>
        <div className="flex flex-wrap items-center gap-4">
          <button type="button" disabled={locked || !changed} onClick={() => void save()} className="min-h-11 bg-white px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-black disabled:opacity-40">{saving ? 'Saving…' : 'Save header position'}</button>
          <button type="button" disabled={locked} onClick={() => { setPosition({ x: 50, y: 50 }); setMessage(''); }} className="min-h-11 text-xs text-white/50">Centre image</button>
          {changed && <button type="button" disabled={locked} onClick={() => { setPosition(saved); setMessage(''); }} className="min-h-11 text-xs text-white/50">Discard changes</button>}
        </div>
        {message && <p role={error ? 'alert' : 'status'} className={`text-xs ${error ? 'text-red-200' : 'text-green-200'}`}>{message}</p>}
      </div>
    </details>
  );
}
