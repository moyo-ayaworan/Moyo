import ProductPage, { productMetadata } from '@/components/shop/ProductPage';
type Context={params:Promise<{product:string}>};
export const dynamic='force-dynamic';
export async function generateMetadata({params}:Context){return productMetadata('art',(await params).product);}
export default async function Page({params}:Context){return <ProductPage section="art" segment={(await params).product}/>;}
