import type { Metadata } from 'next';
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: 'no-referrer' };
import ShopPayment from '@/components/ShopPayment';
export default function PhotographyPaymentPage() { return <ShopPayment section="photography" />; }
