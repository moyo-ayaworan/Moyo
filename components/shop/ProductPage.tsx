import { createPageMetadata } from '@/lib/seo';
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { getStoreProduct, getRelatedProducts, storeContact, storeCheckoutEnabled } from '@/lib/productStorefront';
import { productIdFromPath, productPath } from '@/lib/productStory';
import type { ProductSection } from '@/lib/productSections';
import ProductDetail from './ProductDetail';
export async function productMetadata(section:ProductSection,segment:string):Promise<Metadata> {
  const id=productIdFromPath(segment),product=id?await getStoreProduct(section,id):null;
  if(!product)return {title:'Product not found',robots:{index:false,follow:false}};
  return createPageMetadata({title:product.title,description:product.storefront.tagline||product.details||`${product.title} — a digital product from Ijabiken Moyo.`,path:productPath(section,product),image:product.image});
}
export default async function ProductPage({section,segment}:{section:ProductSection;segment:string}) {
  const id=productIdFromPath(segment);if(!id)notFound();
  const product=await getStoreProduct(section,id);if(!product)notFound();
  const path=productPath(section,product);if(segment!==path.split('/').at(-1))permanentRedirect(path);
  const [related,email]=await Promise.all([getRelatedProducts(section,id),storeContact()]);
  return <ProductDetail product={product} related={related} email={email} checkoutEnabled={storeCheckoutEnabled()}/>;
}
