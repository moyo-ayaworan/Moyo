'use client';

import { useState } from 'react';
import { fileFingerprint, uploadAdminFile } from '@/lib/adminUpload';

const audioTypes = /\.(mp3|wav|m4a|ogg|aac|flac)$/i;

export default function GallerySoundtrackEditor({ url, title, preview, disabled, onSave }: {
  url: string;
  title: string;
  preview: string;
  disabled: boolean;
  onSave: (url: string, title: string) => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [trackTitle, setTrackTitle] = useState(title);
  const [notice, setNotice] = useState('');

  async function upload(file: File) {
    setError('');
    setNotice('');
    if (!audioTypes.test(file.name) || (file.type && !/^(audio\/|video\/mp4$|application\/ogg$)/.test(file.type))) {
      setError('Choose an MP3, WAV, M4A, OGG, AAC, or FLAC audio file.');
      return;
    }
    if (file.size === 0 || file.size > 30 * 1024 * 1024) {
      setError('Choose an audio file under 30 MB.');
      return;
    }
    setBusy(true);
    setProgress(0);
    try {
      const uploaded = await uploadAdminFile(file, await fileFingerprint(file), setProgress, true);
      const nextTitle = (trackTitle.trim() || file.name.replace(/\.[^.]+$/, '')).slice(0, 160);
      if (!await onSave(uploaded, nextTitle)) throw new Error('The track uploaded but could not be saved. Please retry.');
      setTrackTitle(nextTitle);
      setNotice('Soundtrack saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to upload soundtrack.');
    } finally {
      setBusy(false);
    }
  }

  async function save(nextUrl: string, nextTitle: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (!await onSave(nextUrl, nextTitle)) throw new Error('Unable to save soundtrack.');
      if (!nextUrl) setTrackTitle('');
      setNotice(nextUrl ? 'Title saved.' : 'Soundtrack removed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save soundtrack.');
    } finally { setBusy(false); }
  }

  return (
    <section className="space-y-3 border border-white/10 bg-black/20 p-3" aria-label="Gallery soundtrack settings">
      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/70">Gallery soundtrack · optional</p>
      <p className="text-xs text-white/40">Choose a track for this gallery. Music starts automatically when the browser allows it, or after the visitor interacts with the gallery. Visitors can pause or mute it anytime. Upload music you own or have permission to use.</p>
      <label className="block text-xs text-white/60">
        Track title
        <input value={trackTitle} maxLength={160} disabled={busy || disabled} onChange={event => setTrackTitle(event.target.value)} placeholder="Song title — artist" className="mt-2 block w-full border border-white/15 bg-black/30 p-3 text-white" />
      </label>
      <label className="block text-xs text-white/60">
        {url ? 'Replace track' : 'Upload track'} · up to 30 MB
        <input type="file" accept=".mp3,.wav,.m4a,.ogg,.aac,.flac" disabled={busy || disabled} className="mt-2 block w-full text-xs file:mr-3 file:border file:border-white/20 file:bg-white/10 file:p-2 file:text-white disabled:opacity-50" onChange={event => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void upload(file);
        }} />
      </label>
      {busy && <p role="status" className="text-xs text-accent">{progress < 100 ? `Uploading soundtrack… ${progress}%` : 'Saving soundtrack…'}</p>}
      {preview && <audio key={preview} controls preload="none" src={preview} aria-label="Preview gallery soundtrack" className="h-10 w-full" />}
      {url && <div className="flex flex-wrap gap-4 text-xs">
        <button type="button" disabled={busy || disabled || trackTitle === title} onClick={() => void save(url, trackTitle.trim())} className="text-accent disabled:opacity-40">Save title</button>
        <button type="button" disabled={busy || disabled} onClick={() => void save('', '')} className="text-red-200 disabled:opacity-40">Remove soundtrack</button>
      </div>}
      {error && <p role="alert" className="text-xs text-red-200">{error}</p>}
      {notice && <p role="status" className="text-xs text-accent">{notice}</p>}
    </section>
  );
}
