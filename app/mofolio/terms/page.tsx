import type { Metadata } from 'next';
import MofolioLegalPage from '@/components/mofolio/MofolioLegalPage';
import { termsSections } from '@/lib/stillboundsLegal';
export const metadata: Metadata = { title: 'Stillbounds — Terms of use', description: "The conditions for joining the Stillbounds beta and using a beta release. Your photographs remain yours.", alternates: {canonical: '/mofolio/terms'} };
export default function Page() { return <MofolioLegalPage title="Terms of use" introduction="The conditions for joining the Stillbounds beta and using a beta release. Your photographs remain yours." sections={termsSections} />; }
