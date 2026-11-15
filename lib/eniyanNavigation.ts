export const ENIYAN_ROUTES: Record<string, string> = {
  '/': 'Home',
  '/privacy': 'Privacy',
  '/terms': 'Terms',
  '/photography': 'Photography',
  '/photography/shop': 'Photography digital shop',
  '/photography/portfolio': 'Photography portfolio',
  '/photography/bookings': 'Book photography',
  '/photography/client-gallery': 'Client gallery',
  '/photography/about': 'Photography about',
  '/photography/newsletter': 'Photography newsletter',
  '/art': 'Fine art',
  '/art/works': 'Artworks',
  '/art/shop': 'Art shop',
  '/art/commissions': 'Art commissions',
  '/art/exhibitions': 'Exhibitions',
  '/art/about': 'Art about',
  '/art/newsletter': 'Art newsletter',
  '/stillbounds': 'Stillbounds for Mac',
  '/stillbounds/privacy': 'Stillbounds privacy',
  '/stillbounds/terms': 'Stillbounds terms',
};

// Useful destinations may be private screens. Keep them separate from public
// page context and analytics so their contents/identities are never collected.
export const ENIYAN_LINK_ROUTES: Record<string, string> = {
  ...ENIYAN_ROUTES,
  '/stillbounds/account': 'Stillbounds account and activation',
  '/photography/shop/payment': 'Recover a photography digital purchase',
  '/art/shop/payment': 'Recover a fine-art digital purchase',
};

export function getEniyanLinks(content: string) {
  // Match whole internal paths, never a prefix of an unknown route or external URL.
  const matches = content.matchAll(/(?:^|[\s(])((?:\/[a-zA-Z0-9_-]+)*\/?)(?=[\s),.!;:。！？、，；：]|\?(?:\s|$)|$)/g);
  return Array.from(new Set(Array.from(matches, match => match[1]).filter(path => Object.hasOwn(ENIYAN_LINK_ROUTES, path))));
}

export const ENIYAN_MESSAGE_LIMIT = 1600;

// Reduce public detail pages to their collection; never forward arbitrary slugs,
// query strings, account screens or bearer-link paths to the AI provider.
export function getEniyanPublicRoute(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (Object.hasOwn(ENIYAN_ROUTES, value)) return value;
  const product = /^\/(photography|art)\/shop\/products\/[a-z0-9-]{1,160}$/.exec(value);
  if (product) return `/${product[1]}/shop`;
  if (/^\/art\/exhibitions\/[a-z0-9-]{1,160}$/.test(value)) return '/art/exhibitions';
  return null;
}

export function isSafeEniyanReply(content: string) {
  content = content.normalize('NFKC').replace(/[\u200B-\u200F\u2060\uFEFF]/g, '');
  // Navigation is supplied by the interface. Generated external URLs and private
  // endpoints must not become instructions for customers to follow.
  if (/(?:https?:\/\/|www\.|javascript:|data:text\/html|(?:^|\s)\/\/)/i.test(content)) return false;
  const paths = content.matchAll(/(?:^|[\s(])((?:\/[a-zA-Z0-9_-]+)+\/?)(?=[\s),.!;:。！？、，；：]|[?#]|$)/g);
  for (const match of paths) {
    if (!Object.hasOwn(ENIYAN_LINK_ROUTES, match[1])) return false;
    const rest = content.slice((match.index || 0) + match[0].length);
    if (/^[?#]/.test(rest)) return false;
  }
  return !/\b(?:I|we)(?:['’]ve| have)?\s+(?:successfully\s+)?(?:booked|confirmed your booking|sent (?:you )?(?:the |an? )?(?:email|receipt|invoice|link)|refunded|activated your|verified your payment|charged your)\b/i.test(content);
}

// Recovery needs an explicit booking subject; a lost product/gallery link is
// never sufficient evidence to open the private booking form.
export function wantsEniyanTracking(text: string) {
  if (/\b(download|melatone|presets?|luts?|gallery|stillbounds|mofolio|artwork|commission)\b/i.test(text)) return false;
  return /\b(track|status|find|recover|lost)\b.{0,45}\b(booking|appointment|session)\b|\b(booking|appointment|session)\b.{0,30}\b(status|link|reference)\b/i.test(text);
}

export function prepareEniyanTurn<T extends { id: string; role: string }>(messages: T[], message: T, failedId?: string) {
  const history = failedId ? messages.filter(item => item.id !== failedId) : messages;
  return [...history, message];
}
