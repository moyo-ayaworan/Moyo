import type { Metadata } from 'next';

function normalizeSiteUrl(value: string | undefined) {
  const fallback = 'https://moyoayaworan.com';
  if (!value) return fallback;

  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;

  try {
    const url = new URL(withProtocol);
    return url.origin;
  } catch {
    return fallback;
  }
}

export const siteUrl = normalizeSiteUrl(
  process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL
);
export const siteName = 'Ijabiken Moyo';
export const defaultDescription =
  'Visual storytelling across photography and fine art. Two practices. One vision.';
export const defaultOgImage = '/api/share?path=%2F&title=Photography%20%26%20Fine%20Art';

type PageMetadataOptions = {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
  image?: string;
};

export function createPageMetadata({
  title,
  description,
  path,
  noIndex = false,
  image,
}: PageMetadataOptions): Metadata {
  const canonicalPath = path || '/';
  const shareImage = image || `/api/share?${new URLSearchParams({path:canonicalPath,title,description}).toString()}`;
  const fullTitle = title.includes(siteName) ? title : `${title} | ${siteName}`;

  return {
    title: { absolute: fullTitle },
    description,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      title: fullTitle,
      description,
      url: canonicalPath,
      siteName,
      images: [
        {
          url: shareImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      locale: 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [shareImage],
    },
    robots: noIndex
      ? {
          index: false,
          follow: false,
          googleBot: {
            index: false,
            follow: false,
          },
        }
      : {
          index: true,
          follow: true,
        },
  };
}
