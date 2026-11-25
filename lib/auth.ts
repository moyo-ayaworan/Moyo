import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { adminSessionActive } from './adminSessions';

export const ADMIN_COOKIE = 'moyo-admin-session';
export const ADMIN_SESSION_SECONDS = 60 * 60 * 4;

function signingKey() {
  return process.env.ADMIN_SESSION_SECRET || '';
}

export function adminPasswordMatches(candidate: string | null) {
  const expected = process.env.ADMIN_KEY;
  if (!expected || !candidate) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createAdminSession() {
  if (!signingKey()) throw new Error('Admin session signing is not configured.');
  const expires = Date.now() + ADMIN_SESSION_SECONDS * 1000;
  const payload = `${expires}.${randomBytes(16).toString('hex')}`;
  const signature = createHmac('sha256', signingKey()).update(payload).digest('hex');
  return `${payload}.${signature}`;
}

export function hasAdminSession(value: string | undefined) {
  const key = signingKey();
  if (!key || !value || value.length > 200) return false;
  const match = /^(\d{13})\.([a-f0-9]{32})\.([a-f0-9]{64})$/.exec(value);
  if (!match || Number(match[1]) <= Date.now()) return false;
  const payload = `${match[1]}.${match[2]}`;
  const expected = Buffer.from(createHmac('sha256', key).update(payload).digest('hex'));
  return timingSafeEqual(expected, Buffer.from(match[3]));
}

// SameSite cookies also travel between sibling subdomains. Bind authenticated
// browser requests to this exact origin before accepting administrative changes.
export function adminRequestOriginAllowed(req: Request, requireOrigin = !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
  const site = req.headers.get('sec-fetch-site');
  if (site && !['same-origin', 'none'].includes(site)) return false;
  const origin = req.headers.get('origin');
  if (!requireOrigin && !origin) return true;
  try {
    const fallback = new URL(req.url);
    const host = req.headers.get('host') || fallback.host;
    const protocol = req.headers.get('x-forwarded-proto') === 'https' ? 'https:' : fallback.protocol;
    const website = new URL(`${protocol}//${host}`);
    if (website.username || website.password || website.host !== host.toLowerCase()) return false;
    return origin === website.origin;
  } catch { return false; }
}

export async function requireAdmin(req: NextRequest, requireOrigin?: boolean) {
  if (!signingKey()) return NextResponse.json({ error: 'Admin access is not configured.' }, { status: 503 });
  if (!hasAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!adminRequestOriginAllowed(req, requireOrigin)) return NextResponse.json({ error: 'Request origin rejected.' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  try {
    if (!await adminSessionActive(req.cookies.get(ADMIN_COOKIE)!.value)) return NextResponse.json({ error: 'Sign in again.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'Admin access is temporarily unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
  return null;
}
