import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { NextRequest } from 'next/server';

export const galleryCookieAge = 60 * 60 * 4;
export const galleryCookieName = (id: number) => `moyo-gallery-${id}`;

function key() {
  return process.env.GALLERY_SESSION_SECRET || '';
}

function signature(id: number, accessCode: string, payload: string) {
  return createHmac('sha256', key()).update(`${id}:${accessCode.toUpperCase()}:${payload}`).digest('hex');
}

export function createGalleryCookie(id: number, accessCode: string) {
  if (!key()) throw new Error('Gallery sessions are not configured.');
  const payload = `${Date.now() + galleryCookieAge * 1000}.${randomBytes(12).toString('hex')}`;
  return `${payload}.${signature(id, accessCode, payload)}`;
}

export function hasGalleryCookie(req: NextRequest, id: number, accessCode: string) {
  if (!key()) return false;
  const value = req.cookies.get(galleryCookieName(id))?.value || '';
  const match = /^(\d{13})\.([a-f0-9]{24})\.([a-f0-9]{64})$/.exec(value);
  if (!match || Number(match[1]) <= Date.now()) return false;
  const expected = Buffer.from(signature(id, accessCode, `${match[1]}.${match[2]}`));
  return timingSafeEqual(expected, Buffer.from(match[3]));
}
