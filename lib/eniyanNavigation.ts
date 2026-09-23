export const ENIYAN_ROUTES: Record<string, string> = {
  '/': 'Home',
  '/photography': 'Photography',
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
};

export function getEniyanLinks(content: string) {
  // Match whole internal paths, never a prefix of an unknown route or external URL.
  const matches = content.matchAll(/(?:^|[\s(])((?:\/[a-zA-Z0-9_-]+)*\/?)(?=[\s),.!;:]|\?(?:\s|$)|$)/g);
  return Array.from(new Set(Array.from(matches, match => match[1]).filter(path => path in ENIYAN_ROUTES)));
}

export const ENIYAN_MESSAGE_LIMIT = 1600;
