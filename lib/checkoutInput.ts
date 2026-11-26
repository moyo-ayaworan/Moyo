import { stockQuantity } from './inventory.ts';
import { PaymentError, validReference } from './payments/policy.ts';
export function normalizeCouponCode(value:unknown):string {
 if(value===undefined||value==='')return '';
 if(typeof value!=='string')throw new PaymentError('Enter a valid coupon code.',400);
 const code=value.trim().toUpperCase();
 if(!/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(code))throw new PaymentError('Enter a valid coupon code.',400);
 return code;
}
// A single digital licence has no client-selected quantity or price.
export function validateCheckoutInput(body:Record<string,unknown>){
 const allowed=new Set(['productId','email','section','requestKey','displayCurrency','expectedAmount','resumeReference','resumeAmount','couponCode','quantity','shippingRateId','shippingDetails']);
 if('quantity' in body)stockQuantity(body.quantity);
 if(Object.keys(body).some(key=>!allowed.has(key)))throw new PaymentError('Checkout contains unsupported fields. Quantity and price must not be supplied.',400);
 for(const key of ['expectedAmount','resumeAmount'])if(body[key]!==undefined&&(!Number.isSafeInteger(body[key])||Number(body[key])<=0))throw new PaymentError('Invalid checkout quote.',400);
 if(body.resumeReference!==undefined&&(typeof body.resumeReference!=='string'||!validReference(body.resumeReference)||body.resumeAmount===undefined))throw new PaymentError('Invalid saved checkout.',400);
 if(body.resumeAmount!==undefined&&body.resumeReference===undefined)throw new PaymentError('Invalid saved checkout.',400);
 normalizeCouponCode(body.couponCode);
}
