import { normalizeCouponCode } from './checkoutInput.ts';
import { PaymentError, priceToKobo } from './payments/policy.ts';
export function parseCouponLimits(input:Record<string,unknown>){
 const maxDiscount=priceToKobo(String(input.maxDiscount??'')),budget=priceToKobo(String(input.budget??''));
 const maxQuantity=input.maxQuantity;
 if(typeof maxQuantity!=='number'||!Number.isSafeInteger(maxQuantity)||maxQuantity<1||maxQuantity>10000)throw new PaymentError('Set a maximum quantity from 1 to 10,000.',400);
 if(budget<maxDiscount)throw new PaymentError('The total discount budget must cover the maximum discount per order.',400);
 return {maxDiscount,budget,maxQuantity};
}
export function parseCoupon(input:Record<string,unknown>){
 const code=normalizeCouponCode(input.code);if(!code)throw new PaymentError('A coupon code is required.',400);
 const kind=input.kind;if(kind!=='percent'&&kind!=='fixed')throw new PaymentError('Choose a percentage or fixed discount.',400);
 let value:number;
 if(kind==='percent'){if(typeof input.value!=='number'||!Number.isInteger(input.value)||input.value<1||input.value>99)throw new PaymentError('Use a percentage from 1 to 99.',400);value=input.value;}
 else value=priceToKobo(String(input.value));
 const minimum=input.minimum===undefined||input.minimum===''||/^0(?:\.0{1,2})?$/.test(String(input.minimum))?0:priceToKobo(String(input.minimum));
 const section=input.section===''||input.section===undefined?null:input.section;
 if(section!==null&&section!=='art'&&section!=='photography')throw new PaymentError('Choose a valid shop.',400);
 const optionalInt=(v:unknown,label:string)=>{if(v===null||v===undefined||v==='')return null;if(typeof v!=='number'||!Number.isSafeInteger(v)||v<=0||v>2147483647)throw new PaymentError(`Enter a valid ${label}.`,400);return v;};
 const productId=optionalInt(input.productId,'product ID'),maxUses=optionalInt(input.maxUses,'usage limit'),perEmailLimit=optionalInt(input.perEmailLimit,'per-email limit')??1;
 const date=(v:unknown,fallback:string|null)=>{if(v===''||v===undefined||v===null)return fallback;if(typeof v!=='string'||!Number.isFinite(Date.parse(v)))throw new PaymentError('Enter valid start and end dates.',400);return new Date(v).toISOString();};
 const startsAt=date(input.startsAt,new Date().toISOString())!,endsAt=date(input.endsAt,null);
 if(endsAt&&Date.parse(endsAt)<=Date.parse(startsAt))throw new PaymentError('Expiry must be after the start date.',400);
 return {code,kind,value,minimum,section,productId,maxUses,perEmailLimit,startsAt,endsAt,...parseCouponLimits(input)};
}
