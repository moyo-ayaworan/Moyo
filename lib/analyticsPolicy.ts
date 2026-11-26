import { publicTrackingPath } from './privacy';
export function analyticsPath(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 240 || /[?#%\\]/.test(value)) return null;
  if (publicTrackingPath(value)) return value;
  return /^\/(photography|art)\/shop\/products\/[a-z0-9-]+$/.test(value) || /^\/art\/exhibitions\/[a-z0-9-]+$/.test(value) ? value : null;
}
export function referrerHost(value: unknown) {
  try { const u = new URL(typeof value === 'string' ? value : ''); return /^https?:$/.test(u.protocol) ? u.hostname.slice(0, 120) : ''; } catch { return ''; }
}
export function analyticsDevice(ua: string) { return /ipad|tablet/i.test(ua) ? 'Tablet' : /mobile|iphone|android/i.test(ua) ? 'Mobile' : 'Desktop'; }
export function excludedAnalytics(headers: Headers) { return headers.get('dnt') === '1' || headers.get('sec-gpc') === '1' || /bot|crawl|spider|headless|preview|facebookexternalhit|whatsapp/i.test(headers.get('user-agent') || '') || headers.has('next-router-prefetch') || headers.get('purpose') === 'prefetch'; }
