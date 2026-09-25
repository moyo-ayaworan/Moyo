'use client';

import { useState } from 'react';

type Form = { inquiryType: 'commission' | 'artwork' | 'private-viewing'; artworkId: string; name: string; email: string; phone: string; subject: string; size: string; medium: string; budget: string; deadline: string; destination: string; framing: string; story: string; references: string };
const empty: Form = { inquiryType: 'commission', artworkId: '', name: '', email: '', phone: '', subject: '', size: '', medium: '', budget: '', deadline: '', destination: '', framing: '', story: '', references: '' };

export default function ArtInquiryForm() {
  const [form, setForm] = useState<Form>(() => {
    if (typeof window === 'undefined') return empty;
    const params = new URLSearchParams(window.location.search);
    const artworkId = params.get('artworkId') || '';
    return { ...empty, inquiryType: params.get('type') === 'private-viewing' ? 'private-viewing' : artworkId ? 'artwork' : 'commission', artworkId, subject: params.get('title') || '' };
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const update = (key: keyof Form, value: string) => setForm(current => ({ ...current, [key]: value }));
  const field = 'mt-2 min-h-12 w-full border border-foreground/15 bg-transparent px-4 py-3 text-foreground outline-none transition focus:border-accent';
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (status === 'loading') return; setStatus('loading'); setMessage('');
    const response = await fetch('/api/art-inquiries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inquiryType: form.inquiryType, artworkId: form.artworkId || null, name: form.name, email: form.email, phone: form.phone, details: { artwork: form.subject, size: form.size, medium: form.medium, budget: form.budget, deadline: form.deadline, destination: form.destination, framing: form.framing, story: form.story, references: form.references } }) }).catch(() => null);
    const data = await response?.json().catch(() => ({}));
    if (!response?.ok) { setStatus('error'); setMessage(data?.error || 'Could not send the inquiry. Please try again.'); return; }
    setStatus('success'); setMessage(`Inquiry ART-${data.inquiry.id} saved. ${data.emailSent ? 'Your private tracking link has been emailed to you.' : 'Please contact the studio with this reference if the email does not arrive.'}`); setForm(empty);
  }
  return <form onSubmit={submit} className="space-y-6 text-left">
    <div className="grid gap-5 md:grid-cols-2">
      <label className="text-xs text-foreground/65">Inquiry type<select value={form.inquiryType} onChange={e => update('inquiryType', e.target.value)} className={field}><option value="commission">Custom commission</option><option value="artwork">Available artwork / print</option><option value="private-viewing">Private viewing</option></select></label>
      <label className="text-xs text-foreground/65">Artwork or subject<input value={form.subject} onChange={e => update('subject', e.target.value)} placeholder="Work title, portrait, story, or space" className={field} /></label>
      <label className="text-xs text-foreground/65">Full name<input required maxLength={120} value={form.name} onChange={e => update('name', e.target.value)} className={field} /></label>
      <label className="text-xs text-foreground/65">Email<input required type="email" maxLength={254} value={form.email} onChange={e => update('email', e.target.value)} className={field} /></label>
      <label className="text-xs text-foreground/65">Phone<input type="tel" maxLength={40} value={form.phone} onChange={e => update('phone', e.target.value)} className={field} /></label>
      <label className="text-xs text-foreground/65">Preferred size<input value={form.size} onChange={e => update('size', e.target.value)} placeholder="e.g. 24 × 36 in" className={field} /></label>
      <label className="text-xs text-foreground/65">Medium / finish<input value={form.medium} onChange={e => update('medium', e.target.value)} placeholder="Canvas, fine-art print, artist recommendation" className={field} /></label>
      <label className="text-xs text-foreground/65">Budget range<input value={form.budget} onChange={e => update('budget', e.target.value)} placeholder="Currency and range" className={field} /></label>
      <label className="text-xs text-foreground/65">Preferred deadline<input type="date" value={form.deadline} onChange={e => update('deadline', e.target.value)} className={field} /></label>
      <label className="text-xs text-foreground/65">Delivery destination<input value={form.destination} onChange={e => update('destination', e.target.value)} placeholder="City and country for shipping quote" className={field} /></label>
      <label className="text-xs text-foreground/65">Framing preference<select value={form.framing} onChange={e => update('framing', e.target.value)} className={field}><option value="">Studio recommendation</option><option>Unframed</option><option>Framed</option><option>Installation required</option></select></label>
      <label className="text-xs text-foreground/65">Reference links<input value={form.references} onChange={e => update('references', e.target.value)} placeholder="Mood board or reference URL" className={field} /></label>
    </div>
    <label className="block text-xs text-foreground/65">Story, space, or creative brief<textarea required minLength={10} maxLength={1000} rows={5} value={form.story} onChange={e => update('story', e.target.value)} className={field} /></label>
    <p className="text-xs leading-relaxed text-foreground/50">Shipping, insurance, customs, framing, installation and commission timelines are confirmed by the studio. No payment is taken by this form.</p>
    <button disabled={status === 'loading'} className="min-h-14 w-full bg-foreground px-6 py-4 text-xs font-semibold uppercase tracking-[0.24em] text-background transition hover:bg-accent disabled:opacity-50">{status === 'loading' ? 'Saving inquiry…' : 'Submit art inquiry'}</button>
    {message && <p role={status === 'error' ? 'alert' : 'status'} className={status === 'error' ? 'text-sm text-red-400' : 'text-sm text-green-400'}>{message}</p>}
  </form>;
}
