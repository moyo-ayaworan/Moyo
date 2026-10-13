import type { Metadata } from 'next';
import MofolioLegalPage from '@/components/mofolio/MofolioLegalPage';
import { privacySections } from '@/lib/stillboundsLegal';
export const metadata: Metadata = { title: 'Stillbounds — Privacy policy', description: "How the Stillbounds website and beta-access list handle your information, and the choices you can make.", alternates: {canonical: '/mofolio/privacy'} };
export default function Page() { return <MofolioLegalPage title="Privacy policy" introduction="How the Stillbounds website and beta-access list handle your information, and the choices you can make." sections={privacySections} />; }
