'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { FiCheckCircle, FiMail, FiRefreshCw, FiSend, FiXCircle } from 'react-icons/fi';

type ListType = 'all' | 'photography' | 'art';

type Subscriber = {
  id: number;
  email: string;
  list_type: 'photography' | 'art';
  subscribed_at: string;
  last_emailed_at: string | null;
};

type Count = { list_type: 'photography' | 'art'; count: number };
type Notice = { text: string; type: 'success' | 'error' } | null;

const label = 'text-[10px] uppercase tracking-widest text-white/40';
const inputClass = 'w-full bg-white/5 border border-white/10 px-4 py-3 text-white focus:border-accent outline-none transition-colors';
const panelClass = 'bg-surface/30 border border-white/5 p-6 md:p-8 backdrop-blur-sm';
const editorButtonClass = 'border border-white/10 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-white/60 transition-colors hover:border-accent hover:text-accent';

function formatDate(value: string | null) {
  if (!value) return 'Never';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function audienceButtonClass(isActive: boolean) {
  return 'border px-3 py-4 ' + (isActive ? 'border-accent text-accent' : 'border-white/10 text-white/50');
}

export default function NewsletterAdminPage() {
  const [adminKey, setAdminKey] = useState('');
  const [isAuthed, setIsAuthed] = useState(true);
  const [authChecking, setAuthChecking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [listType, setListType] = useState<ListType>('all');
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [counts, setCounts] = useState<Count[]>([]);
  const [notice, setNotice] = useState<Notice>(null);
  const [campaign, setCampaign] = useState({ subject: '', previewText: '', body: '', bodyHtml: '' });
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const headers = useMemo(
    () => ({
      'Content-Type': 'application/json',
    }),
    []
  );

  const totals = useMemo(() => {
    const photography = counts.find((count) => count.list_type === 'photography')?.count || 0;
    const art = counts.find((count) => count.list_type === 'art')?.count || 0;
    return { photography, art, all: photography + art };
  }, [counts]);

  const loadSubscribers = useCallback(async (nextListType: ListType, clearNotice = true, response?: Response, signal?: AbortSignal) => {
    try {
      const res = response ?? await fetch('/api/newsletter/admin?listType=' + nextListType, { headers });
      const data = await res.json();
      if (signal?.aborted) return;
      if (clearNotice) setNotice(null);
      if (!res.ok) throw new Error(data.error || 'Unable to load subscribers.');
      setSubscribers(data.subscribers || []);
      setCounts(data.counts || []);
    } catch (error) {
      if (signal?.aborted) return;
      setNotice({ text: error instanceof Error ? error.message : 'Unable to load subscribers.', type: 'error' });
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [headers]);

  const selectList = (next: ListType) => {
    if (next === listType) return;
    setLoading(true);
    setListType(next);
  };

  const verifyAdminKey = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submittedKey = adminKey.trim();
    setNotice(null);

    if (!submittedKey) {
      setNotice({ text: 'Enter the admin password.', type: 'error' });
      return;
    }

    setAuthChecking(true);
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': submittedKey,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid admin password.');
      setAdminKey('');
      setIsAuthed(true);
      setNotice({ text: 'Newsletter admin unlocked.', type: 'success' });
    } catch (error) {
      setIsAuthed(false);
      setNotice({ text: error instanceof Error ? error.message : 'Invalid admin password.', type: 'error' });
    } finally {
      setAuthChecking(false);
    }
  };

  useEffect(() => {
    if (!isAuthed) return;
    const controller = new AbortController();
    fetch('/api/newsletter/admin?listType=' + listType, { headers, signal: controller.signal })
      .then(response => { if (!controller.signal.aborted) void loadSubscribers(listType, true, response, controller.signal); })
      .catch(() => { if (!controller.signal.aborted) { setNotice({ text: 'Unable to load subscribers.', type: 'error' }); setLoading(false); } });
    return () => controller.abort();
  }, [isAuthed, listType, loadSubscribers, headers]);

  const syncEditorContent = () => {
    const editor = editorRef.current;
    if (!editor) return;
    setCampaign((prev) => ({
      ...prev,
      body: editor.innerText.trim(),
      bodyHtml: editor.innerHTML.trim(),
    }));
  };

  const runEditorCommand = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    syncEditorContent();
  };

  const addEditorLink = () => {
    const url = window.prompt('Enter link URL');
    if (!url) return;
    try {
      const parsed = new URL(url);
      if (!['https:', 'http:', 'mailto:'].includes(parsed.protocol)) return;
      runEditorCommand('createLink', parsed.href);
    } catch { /* Ignore malformed links. */ }
  };

  const sendCampaign = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = editorRef.current?.innerText.trim() || campaign.body.trim();
    const bodyHtml = editorRef.current?.innerHTML.trim() || campaign.bodyHtml.trim();

    if (!body) {
      setNotice({ text: 'Newsletter body is required.', type: 'error' });
      return;
    }

    setSending(true);
    setNotice(null);

    try {
      const res = await fetch('/api/newsletter/admin', {
        method: 'POST',
        headers,
        body: JSON.stringify({ listType, subject: campaign.subject, previewText: campaign.previewText, body, bodyHtml }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to send newsletter.');
      setNotice({ text: 'Newsletter sent to ' + data.sentCount + ' subscriber' + (data.sentCount === 1 ? '' : 's') + '.', type: 'success' });
      setCampaign({ subject: '', previewText: '', body: '', bodyHtml: '' });
      if (editorRef.current) editorRef.current.innerHTML = '';
      await loadSubscribers(listType, false);
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : 'Unable to send newsletter.', type: 'error' });
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navbar />
      <section className="container mx-auto px-6 pb-24 pt-36 md:pt-52 md:px-12">
        <div className="mb-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-4">
            <span className="text-accent text-[10px] uppercase tracking-[0.5em]">Newsletter Admin</span>
            <h1 className="text-4xl font-heading italic text-white md:text-5xl">Send updates</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-white/40">
              View active subscribers and send email campaigns to photography, fine art, or both lists.
            </p>
          </div>
          <Link href="/admin" className="text-[10px] uppercase tracking-[0.35em] text-white/50 hover:text-accent">
            Back to admin
          </Link>
        </div>

        {!isAuthed ? (
          <form onSubmit={verifyAdminKey} className={panelClass + ' mx-auto max-w-md space-y-6'}>
            <div className="space-y-2 text-center">
              <FiMail className="mx-auto text-2xl text-accent" />
              <h2 className="text-3xl font-heading italic text-white">Unlock newsletter tools</h2>
              <p className="text-sm text-white/45">Enter the admin password before viewing subscribers or sending campaigns.</p>
            </div>
            <input
              type="password"
              className={inputClass}
              placeholder="Admin password"
              value={adminKey}
              onChange={(event) => setAdminKey(event.target.value)}
              required
            />
            <button
              type="submit"
              disabled={authChecking}
              className="w-full bg-accent py-4 text-[10px] font-bold uppercase tracking-[0.4em] text-black transition-colors hover:bg-white disabled:opacity-50"
            >
              {authChecking ? 'Checking...' : 'Unlock'}
            </button>
          </form>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div className={panelClass}>
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <p className={label}>Audience</p>
                  <h2 className="mt-2 text-3xl font-heading italic text-white">Subscribers</h2>
                </div>
                <button
                  type="button"
                  onClick={() => { setLoading(true); void loadSubscribers(listType); }}
                  disabled={loading}
                  className="inline-flex items-center gap-2 border border-white/10 px-3 py-2 text-[10px] uppercase tracking-[0.25em] text-white/60 hover:text-white disabled:opacity-50"
                >
                  <FiRefreshCw className={loading ? 'animate-spin' : ''} /> Refresh
                </button>
              </div>

              <div className="mb-6 grid grid-cols-3 gap-3 text-center text-xs">
                <button type="button" onClick={() => selectList('all')} className={audienceButtonClass(listType === 'all')}>
                  <span className="block text-xl text-white">{totals.all}</span>
                  All
                </button>
                <button type="button" onClick={() => selectList('photography')} className={audienceButtonClass(listType === 'photography')}>
                  <span className="block text-xl text-white">{totals.photography}</span>
                  Photo
                </button>
                <button type="button" onClick={() => selectList('art')} className={audienceButtonClass(listType === 'art')}>
                  <span className="block text-xl text-white">{totals.art}</span>
                  Art
                </button>
              </div>

              <div className="max-h-[520px] space-y-3 overflow-y-auto pr-2">
                {subscribers.map((subscriber) => (
                  <div key={subscriber.id} className="border border-white/10 bg-white/[0.03] p-4 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-white">{subscriber.email}</p>
                      <span className="text-[10px] uppercase tracking-widest text-accent">{subscriber.list_type}</span>
                    </div>
                    <p className="mt-2 text-xs text-white/35">
                      Joined {formatDate(subscriber.subscribed_at)} - Last emailed {formatDate(subscriber.last_emailed_at)}
                    </p>
                  </div>
                ))}
                {!loading && subscribers.length === 0 && <p className="py-8 text-center text-sm text-white/35">No active subscribers for this list.</p>}
              </div>
            </div>

            <form onSubmit={sendCampaign} className={panelClass + ' space-y-5'}>
              <div className="space-y-2">
                <p className={label}>Campaign</p>
                <h2 className="text-3xl font-heading italic text-white">Compose email</h2>
                <p className="text-sm text-white/40">
                  This sends to the selected audience using BCC, so subscriber emails stay private.
                </p>
              </div>

              <div className="space-y-2">
                <label className={label}>Sending to</label>
                <select className={inputClass} value={listType} onChange={(event) => selectList(event.target.value as ListType)}>
                  <option value="all">All subscribers ({totals.all})</option>
                  <option value="photography">Photography ({totals.photography})</option>
                  <option value="art">Fine art ({totals.art})</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className={label}>Subject</label>
                <input
                  className={inputClass}
                  value={campaign.subject}
                  onChange={(event) => setCampaign((prev) => ({ ...prev, subject: event.target.value }))}
                  placeholder="New work, upcoming sessions, exhibition notes..."
                  required
                />
              </div>

              <div className="space-y-2">
                <label className={label}>Preview text</label>
                <input
                  className={inputClass}
                  value={campaign.previewText}
                  onChange={(event) => setCampaign((prev) => ({ ...prev, previewText: event.target.value }))}
                  placeholder="Short inbox preview, optional"
                />
              </div>

              <div className="space-y-2">
                <label className={label}>Message</label>
                <div className="overflow-hidden border border-white/10 bg-white/5">
                  <div className="flex flex-wrap gap-2 border-b border-white/10 bg-black/20 p-2">
                    <button type="button" onClick={() => runEditorCommand('formatBlock', 'h2')} className={editorButtonClass}>Heading</button>
                    <button type="button" onClick={() => runEditorCommand('formatBlock', 'p')} className={editorButtonClass}>Text</button>
                    <button type="button" onClick={() => runEditorCommand('bold')} className={editorButtonClass}>Bold</button>
                    <button type="button" onClick={() => runEditorCommand('italic')} className={editorButtonClass}>Italic</button>
                    <button type="button" onClick={() => runEditorCommand('underline')} className={editorButtonClass}>Underline</button>
                    <button type="button" onClick={() => runEditorCommand('insertUnorderedList')} className={editorButtonClass}>Bullets</button>
                    <button type="button" onClick={() => runEditorCommand('insertOrderedList')} className={editorButtonClass}>Numbers</button>
                    <button type="button" onClick={addEditorLink} className={editorButtonClass}>Link</button>
                    <button type="button" onClick={() => runEditorCommand('removeFormat')} className={editorButtonClass}>Clear</button>
                  </div>
                  <div className="relative">
                    {!campaign.body && (
                      <p className="pointer-events-none absolute left-4 top-4 text-sm text-white/25">
                        Write and format the newsletter body here.
                      </p>
                    )}
                    <div
                      ref={editorRef}
                      contentEditable
                      suppressContentEditableWarning
                      role="textbox"
                      aria-multiline="true"
                      aria-label="Newsletter message"
                      onPaste={event => {
                        event.preventDefault();
                        runEditorCommand('insertText', event.clipboardData.getData('text/plain'));
                      }}
                      onDrop={event => event.preventDefault()}
                      onInput={syncEditorContent}
                      onBlur={syncEditorContent}
                      className="min-h-[280px] px-4 py-4 text-sm leading-relaxed text-white outline-none [&_a]:text-accent [&_a]:underline [&_h2]:mb-4 [&_h2]:font-heading [&_h2]:text-3xl [&_h2]:font-normal [&_h2]:italic [&_li]:ml-5 [&_ol]:list-decimal [&_p]:mb-4 [&_ul]:list-disc"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={sending || subscribers.length === 0}
                className="inline-flex w-full items-center justify-center gap-3 bg-accent py-4 text-[10px] font-bold uppercase tracking-[0.4em] text-black transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FiSend /> {sending ? 'Sending...' : 'Send to ' + subscribers.length}
              </button>
            </form>
          </div>
        )}
      </section>
      {notice && (
        <div className="fixed right-4 top-24 z-50 w-[calc(100vw-2rem)] max-w-sm md:right-8">
          <div
            role="status"
            aria-live="polite"
            className={
              'flex items-start gap-3 border p-4 shadow-2xl backdrop-blur-md ' +
              (notice.type === 'success'
                ? 'border-green-500/25 bg-green-500/15 text-green-300'
                : 'border-red-500/25 bg-red-500/15 text-red-300')
            }
          >
            <span className="mt-0.5 shrink-0">
              {notice.type === 'success' ? <FiCheckCircle /> : <FiXCircle />}
            </span>
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.35em]">
                {notice.type === 'success' ? 'Success' : 'Error'}
              </p>
              <p className="text-sm leading-relaxed text-white">{notice.text}</p>
            </div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="ml-auto text-lg leading-none text-white/40 transition-colors hover:text-white"
              aria-label="Dismiss notification"
            >
              x
            </button>
          </div>
        </div>
      )}
      <Footer />
    </main>
  );
}
