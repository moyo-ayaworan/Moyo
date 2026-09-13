import { uploadPublicId } from '@/lib/uploadIdentity';

type UploadResponse = { secure_url?: string; url?: string; urls?: string[]; error?: string | { message?: string } };

export async function fileFingerprint(file: Blob) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function uploadWithProgress(url: string, body: FormData, headers: Record<string, string>, onProgress: (percent: number) => void, timeout = 600_000) {
  return new Promise<UploadResponse>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.timeout = timeout;
    Object.entries(headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(Math.min(100, Math.round(event.loaded / event.total * 100)));
    };
    xhr.onerror = () => reject(new Error('Connection lost. Retry this file; it will reuse the same upload.'));
    xhr.ontimeout = () => reject(new Error('Upload timed out. Retry this file on a stable connection.'));
    xhr.onabort = () => reject(new Error('Upload cancelled.'));
    xhr.onload = () => {
      let data: UploadResponse;
      try { data = JSON.parse(xhr.responseText); }
      catch { reject(new Error(`Upload returned an invalid response (${xhr.status}).`)); return; }
      if (xhr.status < 200 || xhr.status >= 300) {
        const message = typeof data.error === 'string' ? data.error : data.error?.message;
        reject(new Error(message || `Upload failed (${xhr.status}).`));
        return;
      }
      resolve(data);
    };
    xhr.send(body);
  });
}

export async function uploadAdminFile(file: File, adminKey: string, hash: string, onProgress: (percent: number) => void) {
  const signatureResponse = await fetch('/api/upload/signature', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
    body: JSON.stringify({ hash, filename: file.name, mimeType: file.type }),
    signal: AbortSignal.timeout(15_000),
  });
  const signature = await signatureResponse.json();
  if (!signatureResponse.ok) throw new Error(signature.error || 'Unable to authorize this upload. Sign in and try again.');
  const form = new FormData();
  form.append('file', file);
  let result: UploadResponse;
  if (signature.directUpload) {
    if (!signature.cloudName || !signature.apiKey || !signature.signature || signature.public_id !== uploadPublicId(hash, file.name, file.type)) {
      throw new Error('Upload authorization was incomplete. Please retry.');
    }
    for (const key of ['folder', 'timestamp', 'public_id', 'overwrite', 'signature']) form.append(key, String(signature[key]));
    form.append('api_key', signature.apiKey);
    // A failed direct request may already have reached Cloudinary. Never start a second transport automatically.
    result = await uploadWithProgress(`https://api.cloudinary.com/v1_1/${signature.cloudName}/auto/upload`, form, {}, onProgress);
  } else {
    result = await uploadWithProgress('/api/upload', form, { 'x-admin-key': adminKey }, onProgress, 120_000);
  }
  const url = result.secure_url || result.urls?.[0] || result.url;
  if (!url) throw new Error('The upload returned no file URL. Please retry.');
  return url;
}
