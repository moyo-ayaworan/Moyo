import Navbar from '@/components/Navbar';
import s from './shop.module.css';
export default function ProductPageLoading(){return <main className={s.page}><Navbar/><div className={s.productContainer} role="status" aria-label="Loading product"><div className={s.productHero}><div className={`${s.cover} motion-safe:animate-pulse`} aria-hidden="true"/><div className={s.productInformation}><p className={s.eyebrow}>From the studio</p><p className="mt-7 font-heading text-4xl">Loading your next creative tool…</p></div></div></div></main>;}
