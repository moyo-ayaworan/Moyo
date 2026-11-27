import type { PoolClient } from 'pg';
import { PaymentError } from './payments/policy.ts';
import { normalizeCouponCode } from './checkoutInput.ts';
import { couponIdentity } from './couponIdentity.ts';
export type Coupon = {id:string;code:string;kind:'percent'|'fixed';value:number|string;section:'art'|'photography'|null;product_id:number|null;minimum_kobo:string|number;max_uses:number|null;per_email_limit:number;starts_at:Date|string;ends_at:Date|string|null;active:boolean;max_discount_kobo?:string|number|null;budget_kobo?:string|number|null;max_quantity?:number|null;limits_reviewed?:boolean;stopped_at?:Date|string|null};
export function couponDiscount(coupon:Pick<Coupon,'kind'|'value'|'max_discount_kobo'>,amount:number){
 if(!Number.isSafeInteger(amount)||amount<=0)throw new PaymentError('Invalid product price.',400);
 let discount=coupon.kind==='percent'?Number(BigInt(amount)*BigInt(coupon.value)/BigInt(100)):Number(coupon.value);
 if(coupon.max_discount_kobo!=null)discount=Math.min(discount,Number(coupon.max_discount_kobo));
 if(!Number.isSafeInteger(discount)||discount<=0||discount>=amount)throw new PaymentError('This coupon cannot be applied to this purchase.',400);
 return discount;
}
const counted="(status IN ('paid','refunded','disputed','review') OR (status IN ('pending','failed') AND coupon_reserved_until>NOW()))";
async function usage(c:PoolClient,id:string,email:string,mode:string,exclude=''){
 return (await c.query(`SELECT COUNT(*)::int total,COUNT(*) FILTER(WHERE shop_coupon_identity(email)=$2)::int customer,COALESCE(SUM(discount_kobo),0)::text discount FROM payment_orders WHERE coupon_id=$1 AND mode=$3 AND reference<>$4 AND ${counted}`,[id,couponIdentity(email),mode,exclude])).rows[0];
}
export async function applyCoupon(c:PoolClient,input:{code:string;productId:number;section:string;email:string;amount:number;mode:string;quantity?:number},lock=true){
 const code=normalizeCouponCode(input.code);
 const coupon=(await c.query<Coupon>(`SELECT * FROM shop_coupons WHERE code=$1 ${lock?'FOR UPDATE':''}`,[code])).rows[0];
 const now=Date.now(),quantity=input.quantity??1;
 if(!coupon||!coupon.active||coupon.stopped_at||coupon.limits_reviewed!==true||coupon.max_discount_kobo==null||coupon.budget_kobo==null||coupon.max_quantity==null||new Date(coupon.starts_at).getTime()>now||(coupon.ends_at&&new Date(coupon.ends_at).getTime()<=now)||(coupon.section&&coupon.section!==input.section)||(coupon.product_id&&coupon.product_id!==input.productId)||Number(coupon.minimum_kobo)>input.amount||!Number.isSafeInteger(quantity)||quantity<1||(coupon.max_quantity!=null&&quantity>coupon.max_quantity))throw new PaymentError('This coupon is unavailable for this purchase.',400);
 const uses=await usage(c,coupon.id,input.email,input.mode);
 const discount=couponDiscount(coupon,input.amount);
 if((coupon.max_uses!==null&&uses.total>=coupon.max_uses)||uses.customer>=coupon.per_email_limit||(coupon.budget_kobo!=null&&BigInt(uses.discount||0)+BigInt(discount)>BigInt(coupon.budget_kobo)))throw new PaymentError('This coupon is unavailable for this purchase.',409);
 return {coupon,discount,amount:input.amount-discount};
}
export async function couponCanFulfill(c:PoolClient,order:{reference:string;coupon_id?:string|null;email:string;mode:string;coupon_reserved_until?:Date|string|null;discount_kobo?:number|string},paidAt:Date=new Date()){
 if(!order.coupon_id)return true;
 const coupon=(await c.query<Coupon>('SELECT * FROM shop_coupons WHERE id=$1 FOR UPDATE',[order.coupon_id])).rows[0];
 if(!coupon||!order.coupon_reserved_until)return false;
 const paid=paidAt.getTime(),deadline=Math.min(new Date(order.coupon_reserved_until).getTime(),coupon.ends_at?new Date(coupon.ends_at).getTime():Infinity);
 // Provider-verified payment time preserves on-time payments with delayed webhooks, never late discounts.
 if(!Number.isFinite(paid)||!Number.isFinite(deadline)||paid>deadline||paid>Date.now()+300000||(coupon.stopped_at&&paid>=new Date(coupon.stopped_at).getTime()))return false;
 const used=await usage(c,coupon.id,order.email,order.mode,order.reference);
 return (coupon.max_uses===null||used.total<coupon.max_uses)&&used.customer<coupon.per_email_limit&&(coupon.budget_kobo==null||BigInt(used.discount||0)+BigInt(order.discount_kobo||0)<=BigInt(coupon.budget_kobo));
}
