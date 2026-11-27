import { setPurchaseCookie } from '@/lib/purchaseAccess';
import { couponEmailCookie,verifiedCouponEmail } from '@/lib/couponIdentity';
import { stockQuantity } from '@/lib/inventory';
import { shippingQuote, physicalSubtotal,shippingDetailsMatch } from '@/lib/shipping';
import { NextRequest,NextResponse } from 'next/server';
import { requirePaymentOrigin,requestBody,paymentFailure,privateHeaders } from '@/lib/payments/server';
import { normalizeCouponCode,validateCheckoutInput } from '@/lib/checkoutInput';
import { PaymentError,checkoutAddress,payableAmount,isPaymentEmail,priceToKobo,paymentMode } from '@/lib/payments/policy';
import { isProductSection } from '@/lib/productSections';
import { isDisplayCurrency } from '@/lib/regionalPricing';
import { pricingSnapshot } from '@/lib/pricingSnapshot';
import { exchangeRates } from '@/lib/exchangeRates';
import { transaction } from '@/lib/db';
import { applyCoupon } from '@/lib/coupons';
import { rateLimit } from '@/lib/rateLimit';
import { paystackSecret } from '@/lib/paystack';
export async function POST(req:NextRequest){try{
 requirePaymentOrigin(req);const body=await requestBody(req);validateCheckoutInput(body);
 const limited=await rateLimit(req,'coupon-preview',15,900);if(limited)return limited;
 const productId=body.productId,email=typeof body.email==='string'?body.email.trim().toLowerCase():'',section=body.section??'photography',currency=body.displayCurrency??'NGN',code=normalizeCouponCode(body.couponCode);
 if(!Number.isSafeInteger(productId)||Number(productId)<=0||!isPaymentEmail(email)||!isProductSection(section)||!isDisplayCurrency(currency)||!code)throw new PaymentError('Enter your email and a valid coupon.',400);
 if(!verifiedCouponEmail(req.cookies.get(couponEmailCookie)?.value,email))return NextResponse.json({error:'Verify your email to use a coupon.',verificationRequired:true},{status:403,headers:privateHeaders});
 const mode=paymentMode(paystackSecret());
 const current=currency==='NGN'?{rates:{NGN:1},asOf:null}:await exchangeRates();
 const result=await transaction(async c=>{const p=(await c.query(`SELECT price,product_kind FROM digital_products WHERE id=$1 AND section=$2 AND is_active=TRUE`,[productId,section])).rows[0];if(!p)throw new PaymentError('This product is unavailable.',404);
 const quote=pricingSnapshot(priceToKobo(p.price),req.headers.get('x-vercel-ip-country')||'',currency,current.rates,current.asOf);
 const physical=p.product_kind==='physical';if(!physical&&('quantity' in body||'shippingRateId' in body||'shippingDetails' in body))throw new PaymentError('Digital checkout does not accept quantity or shipping fields.',400);
 const quantity=physical?stockQuantity(body.quantity):1,shipping=physical?await shippingQuote(c,body.shippingRateId,body.shippingDetails):null;
 const subtotal=physicalSubtotal(quote.amountMinor,quantity);
 const existing=(await c.query("SELECT o.* FROM payment_orders o JOIN shop_coupons c ON c.id=o.coupon_id WHERE o.email=$1 AND o.mode=$2 AND o.coupon_code=$3 AND o.target_id=$4 AND o.shop_section=$5 AND o.status IN ('pending','failed') AND o.coupon_reserved_until>NOW() AND c.stopped_at IS NULL AND (c.ends_at IS NULL OR c.ends_at>NOW()) ORDER BY o.created_at DESC LIMIT 1",[email,mode,code,productId,section])).rows[0];
 if(existing&&existing.quantity===quantity&&(!physical||shippingDetailsMatch(existing.shipping_details,shipping?.details))){
  // Email ownership permits recovery of the original reference without consuming another redemption.
  payableAmount(Number(existing.amount_kobo));
  return {activeCheckout:true,amount:Number(existing.amount_kobo),reference:existing.reference,paymentPath:`/${section}/shop/payment?reference=${encodeURIComponent(existing.reference)}`,checkoutUrl:existing.checkout_url?checkoutAddress(existing.checkout_url):null};
 }
 const applied=await applyCoupon(c,{code,productId:Number(productId),email,section,amount:subtotal,mode,quantity});
 return {code:applied.coupon.code,subtotal,shipping:shipping?.fee||0,discount:applied.discount,amount:payableAmount(applied.amount+(shipping?.fee||0)),currency:'NGN'};});
 const response=NextResponse.json(result,{headers:privateHeaders});if('activeCheckout' in result)setPurchaseCookie(response,result.reference);return response;
 }catch(e){return paymentFailure(e);}}
