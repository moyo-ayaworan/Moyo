import { cache } from 'react';
import { query } from './db';
import { publicStoreProduct, type StoreProduct } from './productStory';
import type { ProductSection } from './productSections';

export const publicProductFields='id,title,price,details,image,section,product_kind,storefront,(product_url <> \'\') AS has_delivery_file, (SELECT GREATEST(0,i.stock_on_hand-COALESCE((SELECT SUM(r.quantity) FROM shop_stock_reservations r WHERE r.product_id=i.product_id AND r.state=\'held\' AND r.expires_at>NOW()),0)) FROM shop_inventory i WHERE i.product_id=digital_products.id) AS stock_available';
export const getStoreProduct=cache(async(section:ProductSection,id:number):Promise<StoreProduct|null>=>{
  const row=(await query(`SELECT ${publicProductFields} FROM digital_products WHERE id=$1 AND section=$2 AND is_active=TRUE`,[id,section])).rows[0];
  return row?publicStoreProduct(row):null;
});
export async function getRelatedProducts(section:ProductSection,id:number):Promise<StoreProduct[]> {
  return (await query(`SELECT ${publicProductFields} FROM digital_products WHERE section=$1 AND id<>$2 AND is_active=TRUE ORDER BY display_order,created_at DESC LIMIT 3`,[section,id])).rows.map(publicStoreProduct);
}
export async function storeContact() {return (await query('SELECT email FROM contact WHERE id=1')).rows[0]?.email||'moyoayaworan@gmail.com';}
export const storeCheckoutEnabled=()=>Boolean(process.env.PAYSTACK_SECRET_KEY&&(process.env.VERCEL_ENV!=='production'||process.env.PAYSTACK_WEBHOOK_SECRET));
