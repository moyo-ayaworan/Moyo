import { connection } from 'next/server';
import type { Metadata } from 'next';
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: 'no-referrer' };
export default async function PaymentLayout({ children }: { children: React.ReactNode }) { await connection(); return <>{children}</>; }
