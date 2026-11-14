import { createPageMetadata } from '@/lib/seo';
export const metadata = createPageMetadata({ title: 'Photography Digital Shop', description: 'Photography presets, LUTs and digital tools by Ijabiken Moyo. Secure payments and protected downloads.', path: '/photography/shop' });
export default function PhotographyShopLayout({ children }: { children: React.ReactNode }) { return <>{children}</>; }
