import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  serverExternalPackages: ['pdfkit'],
  outputFileTracingIncludes: {
    '/api/galleries/documents': ['./public/fonts/*.ttf', './public/brand/moyo-logo-red.png'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  async redirects() {
    return [
      ...['/', '/art/:path*', '/photography/:path*', '/admin/:path*', '/stillbounds/:path*', '/mofolio/:path*', '/client/:path*', '/collector/:path*', '/payments/:path*', '/newsletter/:path*', '/privacy', '/terms', '/robots.txt', '/sitemap.xml'].map(source => ({
        source,
        has: [{ type: 'host' as const, value: 'moyo-roan.vercel.app' }],
        destination: `https://moyoayaworan.com${source}`,
        permanent: false,
      })),
      { source: '/mofolio', destination: '/stillbounds', permanent: true },
      { source: '/mofolio/account', destination: '/stillbounds/account', permanent: true },
      { source: '/mofolio/terms', destination: '/stillbounds/terms', permanent: true },
      { source: '/mofolio/privacy', destination: '/stillbounds/privacy', permanent: true },
      { source: '/mofolio/review/:id', destination: '/stillbounds/review/:id', permanent: true },
    ];
  },
  async headers() {
    const contentSecurityPolicy = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "script-src 'self' 'unsafe-inline'",
      "script-src-attr 'none'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://res.cloudinary.com https://images.unsplash.com",
      "media-src 'self' blob: https://res.cloudinary.com",
      "font-src 'self' data:",
      "connect-src 'self' https://api.cloudinary.com https://res.cloudinary.com",
    ].join('; ');
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
      ...['/art/shop/payment', '/photography/shop/payment', '/payments/:path*', '/collector/:path*', '/client/:path*', '/stillbounds/account', '/stillbounds/review/:path*', '/mofolio/account', '/mofolio/review/:path*', '/newsletter/preferences'].map(source => ({ source, headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }, { key: 'Cache-Control', value: 'private, no-store' }, { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }] })),
      {
        source: '/:all*(svg|jpg|jpeg|png|webp|avif|gif|ico)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
