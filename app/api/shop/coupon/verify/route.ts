import { randomBytes } from 'node:crypto';
import { NextRequest,NextResponse } from 'next/server';
import { requirePaymentOrigin,requestBody,paymentFailure,privateHeaders } from '@/lib/payments/server';
import { isPaymentEmail,PaymentError } from '@/lib/payments/policy';
import { couponDigest,couponIdentity,couponEmailCookie,couponEmailAge,couponEmailToken } from '@/lib/couponIdentity';
import { couponBrowserCookie,createCouponChallenge,consumeCouponChallenge } from '@/lib/couponVerification';
import { rateLimit,rateLimitIdentity } from '@/lib/rateLimit';
import { transaction } from '@/lib/db';
import { newsletterTransport } from '@/lib/newsletter/mail';
export async function POST(req:NextRequest){try{
 requirePaymentOrigin(req);const b=await requestBody(req),email=typeof b.email==='string'?b.email.trim().toLowerCase():'';
 if(!isPaymentEmail(email)||!['send','verify'].includes(String(b.action)))throw new PaymentError('Enter a valid email address.',400);
 const limited=await rateLimit(req,'coupon-email-'+b.action,b.action==='send'?5:30,900);if(limited)return limited;
 const identity=couponDigest('recipient:'+couponIdentity(email));
 const recipient=await rateLimitIdentity(identity,'coupon-email-'+b.action,b.action==='send'?3:10,b.action==='send'?3600:900);if(recipient)return recipient;
 const existing=req.cookies.get(couponBrowserCookie)?.value;
 if(b.action==='send'){
  const browser=existing&&/^[a-f0-9]{64}$/.test(existing)?existing:randomBytes(32).toString('hex');
  const {id,code}=await transaction(c=>createCouponChallenge(c,email,browser));
  const config=newsletterTransport();
  const delivered=await config.mail.sendMail({from:config.from,to:{address:email,name:''},subject:'Your Moyo coupon verification code',text:`Your verification code is ${code}. It expires in 10 minutes and works once.\n\nUse it only in the Moyo checkout where you requested it. If you did not request this code, ignore this message.`});
  if(!delivered.accepted?.length||delivered.rejected?.length)throw new PaymentError('The verification email could not be sent. Please try later.',503);
  const response=NextResponse.json({sent:true,challengeId:id},{headers:privateHeaders});
  response.cookies.set(couponBrowserCookie,browser,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/api',maxAge:86400});return response;
 }
 if(typeof b.challengeId!=='string'||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(b.challengeId)||typeof b.code!=='string'||b.code.length>20||!existing)throw new PaymentError('This code is invalid or expired. Request another code.',400);
 const challengeId=b.challengeId,code=b.code.trim();
 const valid=await transaction(c=>consumeCouponChallenge(c,{id:challengeId,email,browser:existing,code}));
 if(!valid)throw new PaymentError('This code is invalid or expired. Request another code.',400);
 const response=NextResponse.json({verified:true},{headers:privateHeaders});response.cookies.set(couponEmailCookie,couponEmailToken(email),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/api',maxAge:couponEmailAge});return response;
 }catch(e){return paymentFailure(e);}}
