'use client';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { productShopPath, type ProductSection } from '@/lib/productSections';
import s from './shop.module.css';
export default function ProductPageError({section,reset}:{section:ProductSection;reset:()=>void}) {
 return <main className={s.page}><Navbar/><div className={s.productContainer}><section className={s.empty} role="alert"><h1 className="font-heading text-4xl">A moment, please.</h1><p>We couldn’t load this product right now. Try again, or return to the collection.</p><button onClick={reset} className="mr-6">Try again</button><Link href={productShopPath(section)}>Back to the shop</Link></section></div><Footer/></main>;
}
