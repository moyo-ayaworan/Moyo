import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { isPaymentEmail, PaymentError } from './payments/policy.ts';
export function couponIdentity(email:string){
 const normalized=email.trim().toLowerCase();
 const [local,domain]=normalized.split('@');
 // Only Gmail's documented aliases are collapsed; other providers may treat them as different mailboxes.
 return domain==='gmail.com'||domain==='googlemail.com'?`${local.split('+')[0].replaceAll('.','')}@gmail.com`:normalized;
}
export const couponEmailCookie='moyo-coupon-email';
export const couponEmailAge=2*60*60;
function key(){const value=process.env.GALLERY_SESSION_SECRET||process.env.PAYSTACK_SECRET_KEY||'';if(!value)throw new PaymentError('Coupon verification is temporarily unavailable.',503);return value;}
export function couponDigest(value:string){return createHmac('sha256',key()).update(`coupon-verification:v1:${value}`).digest('hex');}
export function couponEmailToken(email:string,now=Date.now()){
 if(!isPaymentEmail(email))throw new PaymentError('Enter a valid email address.',400);
 const payload=Buffer.from(JSON.stringify({email:email.trim().toLowerCase(),expires:now+couponEmailAge*1000,nonce:randomBytes(16).toString('hex')})).toString('base64url');
 return `${payload}.${couponDigest('session:'+payload)}`;
}
export function verifiedCouponEmail(value:string|undefined,email:string,now=Date.now()){
 if(!value||value.length>1200||!isPaymentEmail(email))return false;
 try{const [payload,signature,...extra]=value.split('.');if(extra.length||!signature||!/^[a-f0-9]{64}$/.test(signature))return false;
 const expected=couponDigest('session:'+payload);if(!timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))return false;
 const body=JSON.parse(Buffer.from(payload,'base64url').toString());return body.email===email.trim().toLowerCase()&&Number.isSafeInteger(body.expires)&&body.expires>now&&body.expires<=now+couponEmailAge*1000;
 }catch{return false;}
}
