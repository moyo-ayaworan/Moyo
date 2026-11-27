import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {NextRequest,NextResponse} from 'next/server.js';
import {randomUUID} from 'node:crypto';
import {couponIdentity,couponEmailToken,verifiedCouponEmail,couponDigest,couponEmailCookie} from '../lib/couponIdentity.ts';
import {createCouponChallenge,consumeCouponChallenge} from '../lib/couponVerification.ts';
import {applyCoupon,couponCanFulfill,couponDiscount} from '../lib/coupons.ts';
import {parseCouponLimits} from '../lib/couponAdmin.ts';
import {shippingDetailsMatch} from '../lib/shipping.ts';
import * as policy from '../lib/payments/policy.ts';
import * as checkout from '../lib/checkoutInput.ts';
import * as sections from '../lib/productSections.ts';
import * as currencies from '../lib/regionalPricing.ts';
import * as identity from '../lib/couponIdentity.ts';
process.env.GALLERY_SESSION_SECRET='coupon-security-test-only';
const base={id:randomUUID(),code:'SAFE10',kind:'percent',value:10,section:null,product_id:null,minimum_kobo:0,max_uses:10,per_email_limit:1,starts_at:'2020-01-01',ends_at:null,active:true,max_discount_kobo:20000,budget_kobo:50000,max_quantity:2,limits_reviewed:true};
function client(coupon=base,usage={total:0,customer:0,discount:'0'}){return {query:async(sql,args)=>{if(sql.includes('FROM shop_coupons')){assert.match(sql,/FOR UPDATE/);return {rows:[coupon]};}assert.match(sql,/shop_coupon_identity/);return {rows:[usage]};}};}
const purchase={code:'SAFE10',productId:1,email:'Buyer.Name+offer@gmail.com',section:'photography',amount:100000,quantity:1,mode:'test'};
test('coupon identities collapse Gmail aliases while preserving distinct non-Gmail addresses',()=>{
 assert.equal(couponIdentity(' Buyer.Name+offer@googlemail.com '),'buyername@gmail.com');
 assert.equal(couponIdentity('buyername@gmail.com'),'buyername@gmail.com');
 assert.notEqual(couponIdentity('buyer+offer@example.test'),couponIdentity('buyer@example.test'));
 assert.notEqual(couponIdentity('first.last@workspace.example'),couponIdentity('firstlast@workspace.example'));
});
test('verified coupon cookies are signed, expire and bind the exact recipient',()=>{
 const now=Date.now(),token=couponEmailToken('buyer@gmail.com',now);
 assert.equal(verifiedCouponEmail(token,'BUYER@gmail.com',now),true);
 for(const email of ['other@gmail.com','buyer+tag@gmail.com'])assert.equal(verifiedCouponEmail(token,email,now),false);
 assert.equal(verifiedCouponEmail(token+'0','buyer@gmail.com',now),false);
 assert.equal(verifiedCouponEmail(token,'buyer@gmail.com',now+7200001),false);
 assert.equal(verifiedCouponEmail(undefined,'buyer@gmail.com',now),false);
 assert.notEqual(couponDigest('code:test'),couponDigest('session:test'));
});
test('email codes bind browser and email, are single use, and commit five failed attempts',async()=>{
 const rows=new Map();let row;
 const c={query:async(sql,args)=>{
  if(sql.startsWith('INSERT')){row={id:args[0],email:args[1],identity:args[2],browser_hash:args[3],code_hash:args[4],attempts:0,expires_at:new Date(Date.now()+600000),consumed_at:null};rows.set(row.id,row);}
  if(sql.startsWith('SELECT'))return {rows:rows.has(args[0])?[rows.get(args[0])]:[]};
  if(sql.startsWith('UPDATE')){row.attempts++;if(args[1])row.consumed_at=new Date();}return {rows:[]};
 }};
 let challenge=await createCouponChallenge(c,'buyer@example.test','browser-a');assert.match(challenge.code,/^\d{6}$/);assert.notEqual(row.code_hash,challenge.code);
 const value={id:challenge.id,email:'buyer@example.test',browser:'browser-a',code:challenge.code};
 assert.equal(await consumeCouponChallenge(c,{...value,browser:'browser-b'}),false);
 assert.equal(await consumeCouponChallenge(c,{...value,email:'other@example.test'}),false);
 assert.equal(await consumeCouponChallenge(c,value),true);assert.equal(await consumeCouponChallenge(c,value),false);
 challenge=await createCouponChallenge(c,'buyer@example.test','browser-a');
 const wrong=challenge.code==='000000'?'111111':'000000';
 for(let i=0;i<5;i++)assert.equal(await consumeCouponChallenge(c,{...value,id:challenge.id,code:wrong}),false);
 assert.equal(row.attempts,5);assert.equal(await consumeCouponChallenge(c,{...value,id:challenge.id,code:challenge.code}),false);
 row.expires_at=new Date(0);assert.equal(await consumeCouponChallenge(c,{...value,id:challenge.id,code:challenge.code}),false);
});
test('final charge minimum rejects subminimum and invalid totals, and includes the exact boundary',()=>{
 for(const amount of [0,1,4999,NaN,Infinity,5000.5,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>policy.payableAmount(amount));
 assert.equal(policy.payableAmount(5000),5000);assert.equal(policy.payableAmount(6000),6000);
});
test('coupons require explicit monetary and quantity limits; discounts are capped and budgets count holds',async()=>{
 assert.deepEqual(parseCouponLimits({maxDiscount:'100',budget:'200',maxQuantity:2}),{maxDiscount:10000,budget:20000,maxQuantity:2});
 for(const patch of [{maxDiscount:''},{budget:'1'},{maxQuantity:0},{maxQuantity:10001},{maxQuantity:'2'}])assert.throws(()=>parseCouponLimits({maxDiscount:'100',budget:'200',maxQuantity:2,...patch}));
 assert.equal(couponDiscount({...base,value:99},100000),20000);
 await assert.rejects(applyCoupon(client({...base,limits_reviewed:false}),purchase),/unavailable/);
 await assert.rejects(applyCoupon(client(),{...purchase,quantity:3}),/unavailable/);
 await assert.rejects(applyCoupon(client(base,{total:1,customer:0,discount:'45000'}),purchase),/unavailable/);
 assert.equal((await applyCoupon(client(base,{total:1,customer:0,discount:'40000'}),purchase)).discount,10000);
 await assert.rejects(applyCoupon(client(base,{total:1,customer:1,discount:'10000'}),purchase),/unavailable/);
});
test('late payments go to review, on-time delayed webhooks retain eligibility, emergency stop honors only earlier payments',async()=>{
 const now=Date.now(),deadline=new Date(now-60000),order={reference:'original',email:purchase.email,mode:'test',coupon_id:base.id,coupon_reserved_until:deadline,discount_kobo:10000};
 assert.equal(await couponCanFulfill(client(),order,new Date(now)),false);
 assert.equal(await couponCanFulfill(client({...base,active:false}),order,new Date(now-120000)),true);
 assert.equal(await couponCanFulfill(client({...base,ends_at:new Date(now-180000)}),order,new Date(now-120000)),false);
 assert.equal(await couponCanFulfill(client({...base,stopped_at:new Date(now-180000)}),order,new Date(now-120000)),false);
 assert.equal(await couponCanFulfill(client({...base,stopped_at:new Date(now-90000)}),order,new Date(now-120000)),true);
 assert.equal(await couponCanFulfill(client(base,{total:0,customer:0,discount:'45000'}),order,new Date(now-120000)),false);
});
function load(file,mocks){const compiled={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:compiled,exports:compiled.exports,require:n=>{if(!(n in mocks))throw Error(n);return mocks[n];},Date,Number,Buffer,URL,encodeURIComponent,process:{env:{NODE_ENV:'test'}}});return compiled.exports;}
test('unverified email cannot query coupon allowance or create a discounted order',async()=>{
 for(const file of ['app/api/shop/coupon/route.ts','app/api/paystack/initialize/route.ts']){
  let touched=false;
  const mocks={'@/lib/couponIdentity':identity,'node:crypto':{randomUUID},'next/server':{NextRequest,NextResponse},'@/lib/checkoutInput':checkout,'@/lib/pricingSnapshot':{},'@/lib/regionalPricing':currencies,'@/lib/productSections':sections,'@/lib/inventory':{},'@/lib/shipping':{},'@/lib/exchangeRates':{},'@/lib/coupons':{},'@/lib/rateLimit':{rateLimit:async()=>null},'@/lib/purchaseAccess':{},'@/lib/paystack':{paystackSecret:()=> 'sk_test_synthetic'},'@/lib/payments/policy':policy,'@/lib/db':{transaction:()=>{touched=true;throw Error('Must verify first');}},'@/lib/payments/server':{requestBody:r=>r.json(),requirePaymentOrigin:()=>{},privateHeaders:{},payments:{createDigital:()=>{touched=true;throw Error('Must verify first');}}}};
  const route=load(file,mocks);
  for(const email of ['buyer@example.test','unused@example.test']){
   const response=await route.POST(new NextRequest('https://shop.test/api',{method:'POST',body:JSON.stringify({productId:1,email,couponCode:'SAFE10'})}));
   assert.equal(response.status,403);assert.equal((await response.json()).verificationRequired,true);assert.equal(touched,false);
  }
 }
});
test('physical retries compare JSONB delivery fields without depending on key order',()=>{
 assert.equal(shippingDetailsMatch({name:'Buyer',pickup:true,country:'NG'},{country:'NG',pickup:true,name:'Buyer'}),true);
 assert.equal(shippingDetailsMatch({name:'Buyer'},{name:'Other'}),false);
 assert.equal(shippingDetailsMatch({name:'Buyer'},{name:'Buyer',pickup:true}),false);
});
test('provider initialization rejects older subminimum orders and expired coupon links before provider calls',async()=>{
 const {PaymentStore}=await import('../lib/payments/store.ts');
 for(const patch of [{amount_kobo:4999},{amount_kobo:10000,coupon_id:base.id,coupon_reserved_until:new Date(0)}]){
  let providerCalls=0;const order={reference:'original',kind:'digital',status:'pending',amount_kobo:10000,delivery_url:'private',...patch};
  const server=load('lib/payments/server.ts',{'next/server':{},'../db':{transaction:work=>work({query:async sql=>({rows:sql.startsWith('SELECT *')?[order]:[]})})},'../paystack':{paystackRequest:()=>{providerCalls++;throw Error('Must reject before provider');}},'../privateMedia':{parseAuthenticatedAsset:()=>true},'./store':{PaymentStore},'./policy':policy});
  await assert.rejects(server.initializeOrder(order,'/return'));assert.equal(providerCalls,0);
 }
});
test('email verification endpoint sends no code to the browser and issues only an HttpOnly recipient-bound session',async()=>{
 let sent=0;const id=randomUUID(),code='123456';
 const route=load('app/api/shop/coupon/verify/route.ts',{'node:crypto':{randomBytes:()=>Buffer.alloc(32,1)},'next/server':{NextRequest,NextResponse},'@/lib/couponIdentity':identity,'@/lib/couponVerification':{couponBrowserCookie:'moyo-coupon-browser',createCouponChallenge:async()=>({id,code}),consumeCouponChallenge:async(c,input)=>input.id===id&&input.email==='buyer@example.test'&&input.browser===Buffer.alloc(32,1).toString('hex')&&input.code===code},'@/lib/rateLimit':{rateLimit:async()=>null,rateLimitIdentity:async value=>{assert.match(value,/^[a-f0-9]{64}$/);return null;}},'@/lib/db':{transaction:fn=>fn({})},'@/lib/payments/policy':policy,'@/lib/newsletter/mail':{newsletterTransport:()=>({from:'studio@example.test',mail:{sendMail:async m=>{sent++;assert.equal(m.to.address,'buyer@example.test');assert.match(m.text,/123456/);return {accepted:['buyer@example.test'],rejected:[]};}}})},'@/lib/payments/server':{requirePaymentOrigin:()=>{},requestBody:r=>r.json(),privateHeaders:{'Cache-Control':'private, no-store'},paymentFailure:e=>NextResponse.json({error:e.message},{status:e.status||503})}});
 const request=(body,cookie='')=>new NextRequest('https://shop.test/api/shop/coupon/verify',{method:'POST',headers:{cookie},body:JSON.stringify(body)});
 const response=await route.POST(request({action:'send',email:'buyer@example.test'}));assert.equal(response.status,200);assert.equal(sent,1);assert.deepEqual(await response.json(),{sent:true,challengeId:id});assert.match(response.headers.get('set-cookie'),/HttpOnly/);
 const browser=response.cookies.get('moyo-coupon-browser').value;
 const verified=await route.POST(request({action:'verify',email:'buyer@example.test',challengeId:id,code},'moyo-coupon-browser='+browser));assert.equal(verified.status,200);assert.match(verified.headers.get('set-cookie'),/HttpOnly/);assert.equal(verifiedCouponEmail(verified.cookies.get(couponEmailCookie).value,'buyer@example.test'),true);assert.equal(verified.headers.get('cache-control'),'private, no-store');
});
test('verified preview recovers a matching existing checkout with its exact saved amount instead of allocating another coupon',async()=>{
 const pricing=await import('../lib/pricingSnapshot.ts');let cookies=0;
 const email='buyer@example.test',reference='moyo-1-'+randomUUID();
 const route=load('app/api/shop/coupon/route.ts',{'next/server':{NextRequest,NextResponse},'@/lib/couponIdentity':identity,'@/lib/inventory':{},'@/lib/shipping':{physicalSubtotal:(u,q)=>u*q},'@/lib/checkoutInput':checkout,'@/lib/payments/policy':policy,'@/lib/productSections':sections,'@/lib/regionalPricing':currencies,'@/lib/pricingSnapshot':pricing,'@/lib/exchangeRates':{},'@/lib/coupons':{applyCoupon:()=>assert.fail('Existing checkout must not reserve again')},'@/lib/rateLimit':{rateLimit:async()=>null},'@/lib/paystack':{paystackSecret:()=> 'sk_test_synthetic'},'@/lib/purchaseAccess':{setPurchaseCookie:(response,value)=>{assert.equal(value,reference);cookies++;}},'@/lib/payments/server':{requirePaymentOrigin:()=>{},requestBody:r=>r.json(),privateHeaders:{},paymentFailure:e=>NextResponse.json({error:e.message},{status:e.status||503})},'@/lib/db':{transaction:fn=>fn({query:async(sql,args)=>{if(sql.startsWith('SELECT price'))return {rows:[{price:'10000',product_kind:'digital'}]};assert.match(sql,/o.email=\$1/);assert.equal(args[0],email);return {rows:[{reference,quantity:1,amount_kobo:'900000',checkout_url:'https://checkout.paystack.com/original'}]};}})}});
 const response=await route.POST(new NextRequest('https://shop.test/api/shop/coupon',{method:'POST',headers:{cookie:couponEmailCookie+'='+couponEmailToken(email)},body:JSON.stringify({productId:1,email,couponCode:'SAFE10',section:'photography'})}));
 assert.equal(response.status,200);const result=await response.json();assert.equal(result.activeCheckout,true);assert.equal(result.amount,900000);assert.equal(result.reference,reference);assert.equal(cookies,1);assert.equal(result.email,undefined);
});
