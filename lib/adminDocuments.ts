export function documentSentAt(document: { paid_at?: string | null; sent_at?: string | null; receipt_sent_at?: string | null }) {
  return document.paid_at ? document.receipt_sent_at : document.sent_at;
}

// One session per editor. A lost response must reuse the original payload/key,
// not create another invoice or contract. No client details are persisted locally.
export function createDocumentSaveSession() {
  let body: string | null = null;
  let pending = false;
  let uncertain = false;
  return {
    get uncertain() { return uncertain; },
    async save<T>(payload: object, headers: Record<string, string>): Promise<T> {
      if (pending) throw new Error('This document is already being saved.');
      pending = true;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30_000);
      try {
        body ||= JSON.stringify({ ...payload, creationKey: crypto.randomUUID() });
        const response = await fetch('/api/galleries/documents', {
          method: 'POST', headers, credentials: 'same-origin', body, signal: controller.signal,
        });
        const data = await response.json();
        if (response.status === 401 && uncertain) {
          throw new Error('Your admin session expired. Sign in again, then use “Retry same document” to recover the original save.');
        }
        if (!response.ok && response.status >= 400 && response.status < 500 && ![408, 429].includes(response.status)) {
          body = null; uncertain = false;
          throw new Error(response.status === 401 ? 'Your admin session expired. Sign in again, then retry; your draft is still here.' : data.error || 'Check the document details and try again.');
        }
        if (!response.ok || !Number.isInteger(data.document?.id) || data.document.id <= 0) throw new Error('Unverified save');
        body = null; uncertain = false;
        return data.document as T;
      } catch (error) {
        if (body) {
          uncertain = true;
          if (error instanceof Error && error.message.startsWith('Your admin session expired')) throw error;
          throw new Error('The save result could not be verified. Your draft is preserved. Click “Retry same document” to recover it safely without creating a duplicate.');
        }
        throw error;
      } finally { clearTimeout(timer); pending = false; }
    },
  };
}

export async function loadInvoiceWorkspace<TGallery, TDocument>(headers: Record<string, string>) {
  const read = async <T>(url: string, key: string): Promise<T[]> => {
    const response = await fetch(url, { headers, credentials: 'same-origin', cache: 'no-store' });
    const data = await response.json();
    if (!response.ok || !Array.isArray(data[key])) throw new Error(response.status === 401 ? 'Your admin session expired. Sign in again to load your clients and documents.' : data.error || 'Could not load clients and documents. Please retry.');
    return data[key];
  };
  const [galleries, documents] = await Promise.all([read<TGallery>('/api/galleries', 'galleries'), read<TDocument>('/api/galleries/documents', 'documents')]);
  return { galleries, documents };
}
