import type { Metadata } from 'next';
import MofolioPage from '@/components/mofolio/MofolioPage';

export const metadata: Metadata = {
  title: 'Stillbounds — Photobook design for your Mac',
  description: 'Arrange your photographs into thoughtful books. Edit layouts, typography and photo effects locally on your Intel or Apple Silicon Mac. Download for Apple Silicon or Intel.',
  alternates: { canonical: '/stillbounds' },
  openGraph: { title: 'Stillbounds — Give your photographs a place to live.', description: 'Photobook design, on your Mac. Download for Apple Silicon or Intel.', url: '/stillbounds', images: [{url:'/mofolio/app-graduation-editor.webp',width:1500,height:1000,alt:'The Stillbounds photobook editor'}] },
  twitter: {card:'summary_large_image',images:['/mofolio/app-graduation-editor.webp']},
};

export default function Page() { return <MofolioPage />; }
