import { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: [
                '/admin',
                '/admin/',
                '/api/admin/',
                '/api/mofolio/studio/',
                '/mofolio/review/',
                '/api/upload/',
                '/photography/client-gallery',
                '/private/',
                '/payments/',
                '/art/shop/payment',
                '/photography/shop/payment',
                '/client/',
                '/collector/',
            ],
        },
        sitemap: `${siteUrl}/sitemap.xml`,
    };
}
