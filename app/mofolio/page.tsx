import type { Metadata } from 'next';
import MofolioPage from '@/components/mofolio/MofolioPage';

export const metadata: Metadata = {
  title: 'Stillbounds — Photobook design for your Mac',
  description: 'Arrange your photographs into thoughtful books. Edit layouts, typography and photo effects locally on your Apple Silicon Mac. Request beta access.',
  alternates: { canonical: '/mofolio' },
  openGraph: { title: 'Stillbounds — Give your photographs a place to live.', description: 'Photobook design, on your Mac. Request beta access.', url: '/mofolio', images: [{url:'/mofolio/editor.webp',width:1600,height:990,alt:'The Stillbounds photobook editor'}] },
  twitter: {card:'summary_large_image',images:['/mofolio/editor.webp']},
};

export default function Page() { return <MofolioPage />; }
