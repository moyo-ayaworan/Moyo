import { cache } from 'react';
import { query } from './db';
import { publicStoreProduct, type StoreProduct } from './productStory';
import type { ProductSection } from './productSections';

export const publicProductFields='id,title,price,details,image,section,storefront,(product_url <> \'\') AS has_delivery_file';
export const getStoreProduct=cache(async(section:ProductSection,id:number):Promise<StoreProduct|null>=>{
  const row=(await query(`SELECT ${publicProductFields} FROM digital_products WHERE id=$1 AND section=$2 AND is_active=TRUE`,[id,section])).rows[0];
  return row?publicStoreProduct(row):null;
});
export async function getRelatedProducts(section:ProductSection,id:number):Promise<StoreProduct[]> {
  return (await query(`SELECT ${publicProductFields} FROM digital_products WHERE section=$1 AND id<>$2 AND is_active=TRUE ORDER BY display_order,created_at DESC LIMIT 3`,[section,id])).rows.map(publicStoreProduct);
}
export async function storeContact() {return (await query('SELECT email FROM contact WHERE id=1')).rows[0]?.email||'ijabikenm@gmail.com';}
export const storeCheckoutEnabled=()=>Boolean(process.env.PAYSTACK_SECRET_KEY&&(process.env.VERCEL_ENV!=='production'||process.env.PAYSTACK_WEBHOOK_SECRET));
