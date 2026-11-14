import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
import { constantEqual, validReference } from './payments/policy';

export const purchaseCookieName = (reference: string) => `moyo-purchase-${reference}`;
export const purchaseCookieAge = 60 * 60 * 24;
export function purchaseSigningKey() { return process.env.GALLERY_SESSION_SECRET || process.env.PAYSTACK_SECRET_KEY || ''; }
function signature(reference: string, expires: number) {
  return createHmac('sha256', purchaseSigningKey()).update(`purchase:v2:${reference}:${expires}`).digest('hex');
}
export function purchaseCookieValue(reference: string) {
  if (!purchaseSigningKey()) throw Error('Purchase access is not configured.');
  const expires = Date.now() + purchaseCookieAge * 1000;
  return `${expires}.${signature(reference, expires)}`;
}
export function hasPurchaseAccess(req: NextRequest, reference: string) {
  if (!purchaseSigningKey() || !validReference(reference)) return false;
  const actual = req.cookies.get(purchaseCookieName(reference))?.value || '';
  const match = /^(\d{13})\.([a-f0-9]{64})$/.exec(actual);
  return !!match && Number(match[1]) > Date.now() && constantEqual(match[2], signature(reference, Number(match[1])));
}
export function setPurchaseCookie(response: import('next/server').NextResponse, reference: string) {
  response.cookies.set(purchaseCookieName(reference), purchaseCookieValue(reference), {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/api', maxAge: purchaseCookieAge,
  });
}
