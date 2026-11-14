import { ENIYAN_ROUTES } from './eniyanNavigation';

const publicPaths = new Set([
  ...Object.keys(ENIYAN_ROUTES), '/privacy', '/terms', '/stillbounds',
  '/stillbounds/privacy', '/stillbounds/terms', '/mofolio', '/mofolio/privacy', '/mofolio/terms',
]);

// Never collect arbitrary paths: bearer credentials can be embedded in portal URLs.
export function publicTrackingPath(value: unknown): string | null {
  return typeof value === 'string' && publicPaths.has(value) ? value : null;
}

export function containsPrivateDetails(text: string): boolean {
  let decoded = text;
  try { decoded = decodeURIComponent(text); } catch { /* Check the original if malformed. */ }
  return /\b(?:password|passcode|access\s*code|api\s*key|secret|card\s*(?:number|details)|cvv|otp)\s*(?::|=|is\b)\s*\S+/i.test(decoded)
    || /\b(?:\d[ -]?){13,19}\b/.test(decoded)
    || /\/(?:client\/booking|collector|(?:stillbounds|mofolio)\/review)\/[^\s]+/i.test(decoded)
    || /(?:[?#&](?:access|token|proof|code)=)\S+/i.test(decoded)
    || /\b(?:sk_(?:live|test)_|whsec_)[a-z0-9_-]+/i.test(decoded);
}
