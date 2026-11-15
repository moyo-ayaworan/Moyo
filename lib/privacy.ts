import { ENIYAN_ROUTES } from './eniyanNavigation';

const publicPaths = new Set([
  ...Object.keys(ENIYAN_ROUTES), '/privacy', '/terms', '/stillbounds',
  '/stillbounds/privacy', '/stillbounds/terms', '/mofolio', '/mofolio/privacy', '/mofolio/terms',
]);

// Never collect arbitrary paths: bearer credentials can be embedded in portal URLs.
export function publicTrackingPath(value: unknown): string | null {
  return typeof value === 'string' && publicPaths.has(value) ? value : null;
}

function normalizePrivacyText(text: string) {
  let decoded = text.normalize('NFKC').replace(/[\u200B-\u200F\u2060\uFEFF]/g, '');
  // Decode bounded layers: copied links can be escaped inside another URL.
  for (let i = 0; i < 3; i++) {
    try { const next = decodeURIComponent(decoded); if (next === decoded) break; decoded = next; } catch { break; }
  }
  decoded = decoded.normalize('NFKC').replace(/[\u200B-\u200F\u2060\uFEFF]/g, '');
  return decoded;
}

export function containsPrivateDetails(text: string): boolean {
  const decoded = normalizePrivacyText(text);
  return /\b(?:password|passcode|access\s*code|api\s*key|secret|card\s*(?:number|details)|cvv|otp)\s*(?::|=|is\b)\s*\S+/i.test(decoded)
    || /\b[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)+\b/i.test(decoded)
    || /\b(?:phone|mobile|telephone|whatsapp)(?:\s+number)?\s*(?::|=|is\b)\s*\+?[\d(][\d\s().-]{5,}/i.test(decoded)
    || /\b(?:my\s+)?(?:password|passcode|access\s*code|api\s*key|otp)\s+["']?[a-z0-9_-]{4,}/i.test(decoded)
    || /(?:^|[^\w])(?:\+\d[\d\s().-]{8,}\d|0[789]\d(?:[\s.-]?\d){8})\b/.test(decoded)
    || /\b(?:\d[ -]?){13,19}\b/.test(decoded)
    || /\/(?:client\/booking|collector|(?:stillbounds|mofolio)\/review)\/[^\s]+/i.test(decoded)
    || /\/api\/(?:bookings\/portal|art-inquiries\/portal|(?:stillbounds|mofolio)\/reviews)\/[^\s]+/i.test(decoded)
    || /(?:\bbearer\s+[a-z0-9._~-]{16,}|-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----)/i.test(decoded)
    || /(?:[?#&](?:access|token|proof|code)=)\S+/i.test(decoded)
    || /\b(?:sk_(?:live|test)_|whsec_)[a-z0-9_-]+/i.test(decoded);
}

// Catch labelled identity/address disclosures without guessing names from ordinary
// service requests. No pattern filter can recognize all personal information.
export function containsPersonalContext(text: string): boolean {
  const value = normalizePrivacyText(text);
  return containsPrivateDetails(text)
    || /\b(?:my (?:full )?name is|my (?:home |postal |billing )?address is|i live at|je m['’]appelle|mon adresse|me llamo|mi direcci[oó]n|mein name ist|meine adresse|meu nome [ée]|meu endere[cç]o)\s*[:=]?\s*\S+/i.test(value)
    || /(?:我的(?:姓名|名字|地址)是|我住在|اسمي\s|عنواني\s)/.test(value)
    || /\b\d{1,6}\s+(?:[a-z][a-z.'-]*\s+){1,5}(?:street|road|avenue|lane|close|crescent|boulevard|drive)\b/i.test(value);
}
