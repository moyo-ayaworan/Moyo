import { NextResponse } from 'next/server';

// Enforce the limit while reading; Content-Length can be absent or inaccurate.
export async function readJsonRequest(request: Request, limit: number): Promise<{
  body: Awaited<ReturnType<Request['json']>>;
  response?: NextResponse;
}> {
  const reject = (status: number, error: string) => ({ body: null, response: NextResponse.json({ error }, { status }) });
  if (Number(request.headers.get('content-length') || 0) > limit) return reject(413, 'Request too large.');
  const reader = request.body?.getReader();
  if (!reader) return reject(400, 'A JSON object is required.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel().catch(() => undefined);
        return reject(413, 'Request too large.');
      }
      chunks.push(value);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!body || typeof body !== 'object' || Array.isArray(body)) return reject(400, 'A JSON object is required.');
    return { body };
  } catch { return reject(400, 'Invalid JSON request.'); }
  finally { reader.releaseLock(); }
}
