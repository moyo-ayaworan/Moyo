import type { PoolClient } from 'pg';
import { PaymentError } from './payments/policy.ts';
import { normalizeCouponCode } from './checkoutInput.ts';
export type Coupon = {id:string;code:string;kind:'percent'|'fixed';value:number|string;section:'art'|'photography'|null;product_id:number|null;minimum_kobo:string|number;max_uses:number|null;per_email_limit:number;starts_at:Date|string;ends_at:Date|string|null;active:boolean};
export function couponDiscount(coupon:Coupon,amount:number){
 if(!Number.isSafeInteger(amount)||amount<=0)throw new PaymentError('Invalid product price.',400);
 const discount=coupon.kind==='percent'?Number(BigInt(amount)*BigInt(coupon.value)/BigInt(100)):Number(coupon.value);
 // Paid checkout must stay positive. Free gifts need a separate fulfilment flow.
 if(!Number.isSafeInteger(discount)||discount<=0||discount>=amount)throw new PaymentError('This coupon cannot be applied to this purchase.',400);
 return discount;
}
export async function applyCoupon(c:PoolClient,input:{code:string;productId:number;section:string;email:string;amount:number;mode:string},lock=true){
 const code=normalizeCouponCode(input.code);
 const coupon=(await c.query<Coupon>(`SELECT * FROM shop_coupons WHERE code=$1 ${lock?'FOR UPDATE':''}`,[code])).rows[0];
 const now=Date.now();
 if(!coupon||!coupon.active||new Date(coupon.starts_at).getTime()>now||(coupon.ends_at&&new Date(coupon.ends_at).getTime()<=now)||(coupon.section&&coupon.section!==input.section)||(coupon.product_id&&coupon.product_id!==input.productId)||Number(coupon.minimum_kobo)>input.amount)throw new PaymentError('This coupon is unavailable for this purchase.',400);
 const uses=(await c.query(`SELECT COUNT(*)::int total,COUNT(*) FILTER(WHERE LOWER(email)=$2)::int customer FROM payment_orders WHERE coupon_id=$1 AND mode=$3 AND (status IN ('paid','refunded','disputed','review') OR (status IN ('pending','failed') AND coupon_reserved_until>NOW()))`,[coupon.id,input.email.toLowerCase(),input.mode])).rows[0];
 if((coupon.max_uses!==null&&uses.total>=coupon.max_uses)||uses.customer>=coupon.per_email_limit)throw new PaymentError('This coupon has reached its usage limit.',409);
 const discount=couponDiscount(coupon,input.amount);
 return {coupon,discount,amount:input.amount-discount};
}
export async function couponCanFulfill(c:PoolClient,order:{reference:string;coupon_id?:string|null;email:string;mode:string;coupon_reserved_until?:Date|string|null}){
 if(!order.coupon_id)return true;
 const coupon=(await c.query<Coupon>('SELECT * FROM shop_coupons WHERE id=$1 FOR UPDATE',[order.coupon_id])).rows[0];
 if(!coupon)return false;
 if(order.coupon_reserved_until&&new Date(order.coupon_reserved_until).getTime()>Date.now())return true;
 // Late payments compete for remaining capacity under the same coupon lock.
 const used=(await c.query(`SELECT COUNT(*)::int total,COUNT(*) FILTER(WHERE LOWER(email)=LOWER($2))::int customer FROM payment_orders WHERE coupon_id=$1 AND mode=$3 AND reference<>$4 AND (status IN ('paid','refunded','disputed','review') OR (status IN ('pending','failed') AND coupon_reserved_until>NOW()))`,[coupon.id,order.email,order.mode,order.reference])).rows[0];
 return (coupon.max_uses===null||used.total<coupon.max_uses)&&used.customer<coupon.per_email_limit;
}
