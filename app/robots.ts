import { MetadataRoute } from 'next';

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
            ],
        },
        sitemap: 'https://ijabikenmoyo.com/sitemap.xml',
    };
}
