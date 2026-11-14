'use client';

import { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { fileFingerprint, uploadAdminFile } from '@/lib/adminUpload';
import { publicProductImage } from '@/lib/productStory';

type Assets = { image: string; productUrl: string };
type Props = Assets & {
  onChange: (update: (current: Assets) => Assets) => void;
  onBusyChange: (busy: boolean) => void;
};
const field = 'w-full min-w-0 border border-white/15 bg-white/5 px-3 py-3 text-sm text-white outline-none focus:border-accent';

export default function ProductAssetsEditor({ image, productUrl, onChange, onBusyChange }: Props) {
  const pending = useRef(false);
  const [uploading, setUploading] = useState<keyof Assets | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  async function upload(file: File | undefined, key: keyof Assets) {
    if (!file || pending.current) return;
    if (key === 'image' && (!/^image\/(jpeg|png|webp|avif|gif)$/.test(file.type) || file.size > 15 * 1024 * 1024)) {
      setError('Choose a JPG, PNG, WebP, AVIF or GIF image smaller than 15 MB.');
      return;
    }
    pending.current = true;
    setUploading(key); setProgress(0); setError(''); onBusyChange(true);
    try {
      const url = await uploadAdminFile(file, await fileFingerprint(file), setProgress, key === 'productUrl');
      if (key === 'image' && !publicProductImage(url)) throw Error('The upload did not return a public thumbnail.');
      onChange(current => ({ ...current, [key]: url }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Upload failed. Please retry.');
    } finally {
      pending.current = false; setUploading(null); onBusyChange(false);
    }
  }

  return <fieldset disabled={uploading !== null} className="grid min-w-0 gap-5 border-t border-white/10 pt-4">
    {(['image', 'productUrl'] as const).map(key => {
      const thumbnail = key === 'image', value = thumbnail ? image : productUrl;
      return <section key={key} className="grid min-w-0 gap-3">
        <div><h4 className="text-sm text-white">{thumbnail ? 'Product thumbnail' : 'Protected delivery file'}</h4><p className="mt-1 text-xs text-white/45">{value ? (thumbnail ? 'Thumbnail attached' : 'Delivery file attached') : (thumbnail ? 'No thumbnail — the shop uses a placeholder' : 'No delivery file attached')}</p></div>
        <div className="flex flex-wrap gap-2">
          <label className="relative inline-flex min-h-11 cursor-pointer items-center gap-2 border border-accent bg-accent px-4 py-2 text-xs text-white">
            <Upload size={14}/>{uploading === key ? `Uploading ${progress}%` : `${value ? 'Replace' : 'Upload'} ${thumbnail ? 'thumbnail' : 'delivery file'}`}
            <input type="file" aria-label={`${value ? 'Replace' : 'Upload'} ${thumbnail ? 'thumbnail' : 'delivery file'}`} accept={thumbnail ? 'image/jpeg,image/png,image/webp,image/avif,image/gif' : undefined} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" onChange={event => { void upload(event.target.files?.[0], key); event.currentTarget.value = ''; }}/>
          </label>
          {value && <button type="button" className="inline-flex min-h-11 items-center gap-2 border border-white/20 px-3 py-2 text-xs text-white/70" onClick={() => onChange(current => ({ ...current, [key]: '' }))}><X size={14}/>Remove {thumbnail ? 'thumbnail' : 'delivery file'}</button>}
        </div>
        <p className="text-xs leading-relaxed text-white/45">{thumbnail ? 'Choose a new image, then save with Update product. This public image appears in the shop and on the product page.' : 'Choose a new file, then save with Update product to replace the current delivery file. Uploads stay private; you do not need to remove the old file first.'}</p>
        {!thumbnail && <p className="text-xs leading-relaxed text-white/45">Removing the delivery file disables new checkout and can affect existing download links.</p>}
        <details className="text-xs text-white/45"><summary className="cursor-pointer">Advanced: {thumbnail ? 'image' : 'delivery file'} URL</summary><label className="mt-3 grid min-w-0 gap-2">{thumbnail ? 'Public image URL' : 'Private delivery file URL'}<input className={field} value={value} onChange={event => onChange(current => ({ ...current, [key]: event.target.value }))}/></label></details>
      </section>;
    })}
    {uploading && <p role="status" className="text-xs text-white/65">Uploading… {progress}%. Wait before saving.</p>}
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
  </fieldset>;
}
