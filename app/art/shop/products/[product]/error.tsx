'use client';
import ProductPageError from '@/components/shop/ProductPageError';
export default function ErrorPage({reset}:{reset:()=>void}){return <ProductPageError section="art" reset={reset}/>;}
