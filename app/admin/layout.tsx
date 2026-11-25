import { connection } from 'next/server';
import { createPageMetadata } from '@/lib/seo';

export const metadata = createPageMetadata({
    title: 'Admin',
    description: 'Private administration area for Ijabiken Moyo.',
    path: '/admin',
    noIndex: true,
});

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    await connection();
    return <>{children}</>;
}
