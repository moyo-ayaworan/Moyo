export const ENIYAN_ROUTES: Record<string, string> = {
  '/': 'Home',
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
  const matches = content.matchAll(/(?:^|[\s(])((?:\/[a-zA-Z0-9_-]+)*\/?)(?=[\s),.!;:]|\?(?:\s|$)|$)/g);
  return Array.from(new Set(Array.from(matches, match => match[1]).filter(path => Object.hasOwn(ENIYAN_LINK_ROUTES, path))));
}

export const ENIYAN_MESSAGE_LIMIT = 1600;
