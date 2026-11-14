import type { Metadata } from 'next';
import Account from './Account';
export const metadata: Metadata = { title: 'Your Stillbounds account', robots: { index: false, follow: false }, referrer: 'no-referrer' };
export default function Page() { return <Account />; }
