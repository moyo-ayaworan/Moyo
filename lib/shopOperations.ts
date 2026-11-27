import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { PaymentError } from './payments/policy.ts';
export async function enqueueShopNotice(c:PoolClient,kind:'fulfillment'|'low_stock',key:string,payload:object,reference?:string){await c.query(`INSERT INTO shop_notifications(id,event_key,order_reference,kind,payload) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(event_key) DO NOTHING`,[randomUUID(),key,reference||null,kind,JSON.stringify(payload)]);}
export async function checkLowStock(c:PoolClient,productId:number){
 const i=(await c.query('SELECT i.*,p.title FROM shop_inventory i JOIN digital_products p ON p.id=i.product_id WHERE i.product_id=$1 FOR UPDATE OF i',[productId])).rows[0];
 if(!i||i.low_stock_threshold===null||i.low_stock_threshold===undefined)return;
 if(i.stock_on_hand>i.low_stock_threshold){await c.query('UPDATE shop_inventory SET low_alerted=FALSE WHERE product_id=$1',[productId]);return;}
 if(i.low_alerted)return;
 await enqueueShopNotice(c,'low_stock',`stock:${productId}:${randomUUID()}`,{productId,title:i.title,stock:i.stock_on_hand,threshold:i.low_stock_threshold});
 await c.query('UPDATE shop_inventory SET low_alerted=TRUE WHERE product_id=$1',[productId]);
}
export async function updateFulfillment(c:PoolClient,reference:string,status:string,tracking:string){
 const order=(await c.query("SELECT * FROM payment_orders WHERE reference=$1 AND fulfillment_kind='physical' FOR UPDATE",[reference])).rows[0];
 if(!order||order.status!=='paid')throw new PaymentError('Only a verified paid physical order can be updated.',409);
 if(['ready_for_pickup','collected'].includes(status)&&!order.shipping_details?.pickup)throw new PaymentError('This order is for delivery, not pickup.',400);
 if(status==='shipped'&&order.shipping_details?.pickup)throw new PaymentError('Use pickup status for this order.',400);
 if(order.fulfillment_status===status&&order.tracking_number===tracking)return false;
 const version=Number(order.fulfillment_version||0)+1;
 await c.query('UPDATE payment_orders SET fulfillment_status=$2,tracking_number=$3,fulfillment_version=$4,updated_at=NOW() WHERE reference=$1',[reference,status,tracking,version]);
 if(['processing','ready_for_pickup','shipped','collected'].includes(status))await enqueueShopNotice(c,'fulfillment',`fulfillment:${reference}:${version}`,{version,status,tracking},reference);
 return true;
}
export function matchingShippingRules<T extends {country:string;region:string;active?:boolean;pickup:boolean}>(rates:T[],country:string,region:string){
 const countryCode=country.trim().toUpperCase(),state=region.trim().toLowerCase();const inCountry=rates.filter(r=>r.active!==false&&r.country===countryCode);
 const specific=inCountry.filter(r=>!r.pickup&&r.region.trim().toLowerCase()===state&&r.region.trim()!=='');
 return [...(specific.length?specific:inCountry.filter(r=>!r.pickup&&!r.region.trim())),...inCountry.filter(r=>r.pickup)];
}
export function orderFilters(params:URLSearchParams){
 const kind=params.get('kind')||'physical';
 const search=(params.get('search')||'').trim(),payment=params.get('payment')||'',fulfillment=params.get('fulfillment')||'',page=Number(params.get('page')||0);
 if(!['all','physical','digital'].includes(kind)||search.length>150||!['','pending','paid','failed','review','refunded','disputed'].includes(payment)||!['','unfulfilled','processing','ready_for_pickup','shipped','collected','cancelled'].includes(fulfillment)||!Number.isSafeInteger(page)||page<0||page>10000)throw new PaymentError('Choose valid order filters.',400);
 // Treat search text literally, including LIKE wildcards.
 const pattern='%'+search.replace(/[\\%_]/g,'\\$&')+'%';return {search,pattern,payment,fulfillment,page,kind};
}
