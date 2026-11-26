import type { Metadata, Viewport } from 'next';
import { defaultDescription, defaultOgImage, siteName, siteUrl } from '@/lib/seo';
import './globals.css';
import { JsonLd, createRootJsonLd } from '@/lib/schema';
import AppChrome from '@/components/AppChrome';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: siteName,
  title: {
    default: `${siteName} | Photography & Fine Art`,
    template: `%s | ${siteName}`,
  },
  description: defaultDescription,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: `${siteName} | Photography & Fine Art`,
    description: defaultDescription,
    url: '/',
    siteName,
    images: [
      {
        url: defaultOgImage,
        width: 1200,
        height: 630,
        alt: siteName,
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${siteName} | Photography & Fine Art`,
    description: defaultDescription,
    images: [defaultOgImage],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#050505',
  colorScheme: 'dark light',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <body
        className="font-body antialiased bg-background text-foreground selection:bg-accent selection:text-background"
      >
        <JsonLd data={createRootJsonLd()} />
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
