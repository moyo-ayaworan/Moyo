import { checkLowStock } from '@/lib/shopOperations';
import { deliverShopMail } from '@/lib/shopMail';
import { after,NextRequest,NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { query,transaction } from '@/lib/db';
import { readJsonRequest } from '@/lib/requestBody';
import { publicProductImage } from '@/lib/productStory';
import { PaymentError,priceToKobo } from '@/lib/payments/policy';
import { isProductSection } from '@/lib/productSections';
const headers={'Cache-Control':'private, no-store'};
export async function GET(req:NextRequest){const denied=await requireAdmin(req);if(denied)return denied;const result=await query(`SELECT p.id,p.title,p.section,p.is_active,i.stock_on_hand,i.low_stock_threshold,COALESCE(SUM(r.quantity) FILTER(WHERE r.state='held' AND r.expires_at>NOW()),0)::int reserved FROM digital_products p JOIN shop_inventory i ON i.product_id=p.id LEFT JOIN shop_stock_reservations r ON r.product_id=p.id WHERE p.product_kind='physical' GROUP BY p.id,i.product_id ORDER BY p.created_at DESC LIMIT 200`);return NextResponse.json({products:result.rows},{headers});}
export async function POST(req:NextRequest){const denied=await requireAdmin(req,true);if(denied)return denied;const parsed=await readJsonRequest(req,4096);if(parsed.response)return parsed.response;
 try{const b=parsed.body;if(!['publish','threshold'].includes(b.action)&&(typeof b.stock!=='number'||!Number.isSafeInteger(b.stock)||b.stock<0||b.stock>1000000))throw new PaymentError('Stock must be a whole number from 0 to 1,000,000.',400);
 const result=await transaction(async c=>{
 if(b.action==='threshold'){if(!Number.isSafeInteger(b.productId)||(b.threshold!==null&&(!Number.isSafeInteger(b.threshold)||b.threshold<0||b.threshold>1000000)))throw new PaymentError('Enter a valid alert threshold, or leave it blank to disable.',400);const r=await c.query('UPDATE shop_inventory SET low_alerted=CASE WHEN low_stock_threshold IS DISTINCT FROM $2 THEN FALSE ELSE low_alerted END,low_stock_threshold=$2 WHERE product_id=$1 RETURNING product_id',[b.productId,b.threshold]);if(!r.rowCount)throw new PaymentError('Inventory not found.',404);await checkLowStock(c,b.productId);return {id:b.productId};}

 if(b.action==='publish'){if(!Number.isSafeInteger(b.productId)||typeof b.isActive!=='boolean')throw new PaymentError('Choose a valid product.',400);const p=(await c.query("SELECT image FROM digital_products WHERE id=$1 AND product_kind='physical' FOR UPDATE",[b.productId])).rows[0];if(!p)throw new PaymentError('Product not found.',404);if(b.isActive){if(!publicProductImage(p.image))throw new PaymentError('Add a public cover image in the product editor before publishing.',400);if(!(await c.query('SELECT 1 FROM shop_shipping_regions WHERE active=TRUE LIMIT 1')).rows.length)throw new PaymentError('Configure shipping or pickup before publishing.',400);}await c.query('UPDATE digital_products SET is_active=$2,updated_at=NOW() WHERE id=$1',[b.productId,b.isActive]);return {id:b.productId};}
 if(b.action==='create'){if(typeof b.title!=='string'||!b.title.trim()||b.title.length>200||!isProductSection(b.section))throw new PaymentError('Enter a title and shop.',400);priceToKobo(String(b.price));const p=(await c.query(`INSERT INTO digital_products(title,price,details,image,section,product_kind,is_active) VALUES($1,$2,'','',$3,'physical',FALSE) RETURNING id`,[b.title.trim(),String(b.price),b.section])).rows[0];await c.query('INSERT INTO shop_inventory(product_id,stock_on_hand) VALUES($1,$2)',[p.id,b.stock]);return p;}
 if(b.action!=='adjust'||!Number.isSafeInteger(b.productId))throw new PaymentError('Choose a valid inventory action.',400);
 const stock=(await c.query('SELECT product_id FROM shop_inventory WHERE product_id=$1 FOR UPDATE',[b.productId])).rows[0];if(!stock)throw new PaymentError('Inventory not found.',404);
 const held=(await c.query(`SELECT COALESCE(SUM(quantity),0)::int total FROM shop_stock_reservations WHERE product_id=$1 AND state='held' AND expires_at>NOW()`,[b.productId])).rows[0].total;if(b.stock<held)throw new PaymentError('Stock cannot be lower than active reservations.',409);
 await c.query('UPDATE shop_inventory SET stock_on_hand=$2,updated_at=NOW() WHERE product_id=$1',[b.productId,b.stock]);await checkLowStock(c,b.productId);return {id:b.productId};
 });after(()=>deliverShopMail());return NextResponse.json({product:result},{headers});}catch(e){return NextResponse.json({error:e instanceof PaymentError?e.message:'Could not save inventory.'},{status:e instanceof PaymentError?e.status:503,headers});}}
