import { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/seo';

export default function sitemap(): MetadataRoute.Sitemap {
    const routes = [
        { path: '/', changeFrequency: 'monthly', priority: 1 },
        { path: '/stillbounds', changeFrequency: 'monthly', priority: 0.8 },
        { path: '/stillbounds/terms', changeFrequency: 'yearly', priority: 0.3 },
        { path: '/stillbounds/privacy', changeFrequency: 'yearly', priority: 0.3 },
        { path: '/photography', changeFrequency: 'weekly', priority: 0.9 },
        { path: '/photography/shop', changeFrequency: 'monthly', priority: 0.7 },
        { path: '/photography/about', changeFrequency: 'monthly', priority: 0.7 },
        { path: '/photography/bookings', changeFrequency: 'monthly', priority: 0.8 },
        { path: '/photography/newsletter', changeFrequency: 'monthly', priority: 0.5 },
        { path: '/photography/portfolio', changeFrequency: 'weekly', priority: 0.8 },
        { path: '/art', changeFrequency: 'monthly', priority: 0.9 },
        { path: '/art/about', changeFrequency: 'monthly', priority: 0.7 },
        { path: '/art/commissions', changeFrequency: 'monthly', priority: 0.8 },
        { path: '/art/exhibitions', changeFrequency: 'monthly', priority: 0.7 },
        { path: '/art/newsletter', changeFrequency: 'monthly', priority: 0.5 },
        { path: '/art/shop', changeFrequency: 'monthly', priority: 0.6 },
        { path: '/art/works', changeFrequency: 'weekly', priority: 0.8 },
    ] satisfies Array<{
        path: string;
        changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
        priority: number;
    }>;

    return routes.map((route) => ({
        url: route.path === '/' ? siteUrl : `${siteUrl}${route.path}`,
        changeFrequency: route.changeFrequency,
        priority: route.priority,
    }));
}
