import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { randomUUID } from 'node:crypto';
import { NextRequest,NextResponse } from 'next/server.js';
import * as input from '../lib/checkoutInput.ts';
import * as policy from '../lib/payments/policy.ts';
import * as pricing from '../lib/regionalPricing.ts';
import * as sections from '../lib/productSections.ts';
import * as snapshot from '../lib/pricingSnapshot.ts';
import { applyCoupon, couponDiscount } from '../lib/coupons.ts';
import { parseCoupon } from '../lib/couponAdmin.ts';
import { stockQuantity } from '../lib/inventory.ts';
function routeFixture(){let created=0,initialized=0;const mocks={
 '@/lib/checkoutInput':input,'@/lib/pricingSnapshot':snapshot,'@/lib/regionalPricing':pricing,'@/lib/productSections':sections,'node:crypto':{randomUUID},'next/server':{NextRequest,NextResponse},'@/lib/rateLimit':{rateLimit:async()=>null},'@/lib/purchaseAccess':{setPurchaseCookie:()=>{}},'@/lib/paystack':{paystackSecret:()=> 'sk_test_fixture',PaymentReferenceMissing:class extends Error{}},'@/lib/payments/policy':policy,
 '@/lib/payments/server':{requestBody:req=>req.json(),requirePaymentOrigin:req=>{if(req.headers.get('origin')!=='https://shop.test')throw new policy.PaymentError('Wrong origin',403);},payments:{createDigital:async()=>{created++;return {reference:'moyo-1-'+randomUUID(),shop_section:'photography',amount_kobo:10000};}},initializeOrder:async()=>{initialized++;return 'https://checkout.paystack.com/fixture';},privateHeaders:{'Cache-Control':'private, no-store'},paymentFailure:e=>NextResponse.json({error:e.message},{status:e.status||503})}
 };const compiled={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/paystack/initialize/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:compiled,exports:compiled.exports,require:name=>{if(!(name in mocks))throw Error(name);return mocks[name];}});
 return {post:body=>compiled.exports.POST(new NextRequest('https://shop.test/api/paystack/initialize',{method:'POST',headers:{origin:'https://shop.test','Content-Type':'application/json'},body:JSON.stringify(body)})),counts:()=>({created,initialized})};}
const valid={productId:1,email:'buyer@example.test',section:'photography',requestKey:randomUUID(),displayCurrency:'NGN',expectedAmount:10000};
test('checkout API rejects negative, zero, fractional, nonnumeric and oversized quantities before order creation',async()=>{const r=routeFixture();for(const quantity of [-5,0,1.5,'1',null,10001,9007199254740992]){const response=await r.post({...valid,quantity});assert.equal(response.status,400,String(quantity));}assert.equal(r.counts().created,0);assert.equal(r.counts().initialized,0);});
test('checkout API rejects forged prices, discounts, currencies and totals instead of trusting them',async()=>{const r=routeFixture();for(const patch of [{price:1},{amount:1},{discount:99999},{shippingFee:0},{currency:'USD'},{subtotal:-1},{quantity:-5},{expectedAmount:-1},{expectedAmount:'10000'},{expectedAmount:1.1},{couponCode:{code:'SAVE10'}},{couponCode:'A'},{displayCurrency:'FAKE'},{productId:'1'}])assert.equal((await r.post({...valid,...patch})).status,400,JSON.stringify(patch));assert.equal(r.counts().created,0);});
test('valid checkout still initializes once with a saved server order',async()=>{const r=routeFixture();assert.equal((await r.post(valid)).status,200);assert.equal(r.counts().created,1);assert.equal(r.counts().initialized,1);});
test('coupons normalize codes, calculate integer kobo and cannot erase or reverse a charge',()=>{assert.equal(input.normalizeCouponCode(' studio10 '),'STUDIO10');assert.equal(couponDiscount({kind:'percent',value:10},10005),1000);assert.equal(couponDiscount({kind:'fixed',value:'25000'},100000),25000);for(const coupon of [{kind:'percent',value:100},{kind:'fixed',value:10000}])assert.throws(()=>couponDiscount(coupon,10000));assert.throws(()=>couponDiscount({kind:'fixed',value:1},-1));});
test('coupon administration validates dates, limits, percentages and minimum spend',()=>{const base={code:'STUDIO10',kind:'percent',value:10,perEmailLimit:1,minimum:'0'};assert.equal(parseCoupon(base).minimum,0);for(const patch of [{value:0},{value:100},{value:1.5},{maxUses:0},{perEmailLimit:-1},{productId:'1'},{startsAt:'2030-01-02',endsAt:'2030-01-01'},{section:'other'}])assert.throws(()=>parseCoupon({...base,...patch}));for(const v of [-1,0,1.1,'1'])assert.throws(()=>stockQuantity(v));});
test('new shop administration endpoints deny anonymous access before touching data',async()=>{
 const paths=[['coupons','GET'],['coupons','POST'],['coupons','PATCH'],['inventory','POST'],['shipping','POST'],['physical-orders','PATCH'],['returns','POST'],['shipping/preview','POST'],['shop-mail','POST'],['coupon-analytics','GET'],['returns','GET'],['shop-mail','GET']];
 for(const [name,method] of paths){let touched=false;const mocks={
 'node:crypto':{randomUUID},'next/server':{NextRequest,NextResponse},'@/lib/auth':{requireAdmin:async()=>NextResponse.json({error:'Unauthorized'},{status:401})},'@/lib/db':{query:()=>{touched=true;throw Error('Database must not be reached');},transaction:()=>{touched=true;throw Error('Database must not be reached');}},'@/lib/requestBody':{readJsonRequest:()=>{touched=true;throw Error('Body must not be read');}},'@/lib/payments/policy':policy,'@/lib/productSections':sections,'@/lib/productStory':{},'@/lib/couponAdmin':{},'@/lib/shipping':{},'@/lib/shopOperations':{},'@/lib/shopMail':{},'@/lib/returns':{},'@/lib/refunds':{},'@/lib/payments/notifications':{}
 };const compiled={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(`app/api/admin/${name}/route.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:compiled,exports:compiled.exports,require:n=>{if(!(n in mocks))throw Error(n);return mocks[n];}});
 const response=await compiled.exports[method](new NextRequest(`https://shop.test/api/admin/${name}`,{method,headers:{'Content-Type':'application/json'},...(method==='GET'?{}:{body:'{}'})}));assert.equal(response.status,401,name);assert.equal(touched,false,name);
 }
});
test('physical purchases cannot use the digital download API even when paid',async()=>{
 let verified=false,delivered=false;const mocks={
 'next/server':{NextRequest,NextResponse},'@/lib/purchaseAccess':{hasPurchaseAccess:()=>true},'@/lib/privateMedia':{temporaryOriginalUrl:()=>{delivered=true;return 'https://example.test/private';}},'@/lib/rateLimit':{rateLimit:async()=>null},'@/lib/payments/policy':policy,
 '@/lib/payments/server':{payments:{order:async()=>({kind:'digital',fulfillment_kind:'physical',status:'paid'})},verifyOrder:async()=>{verified=true;},privateHeaders:{},paymentFailure:e=>NextResponse.json({error:e.message},{status:e.status||503})}
 };const compiled={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/digital-products/download/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:compiled,exports:compiled.exports,require:n=>{if(!(n in mocks))throw Error(n);return mocks[n];}});const r=await compiled.exports.GET(new NextRequest('https://shop.test/api/digital-products/download?reference=test'));assert.equal(r.status,403);assert.equal(verified,false);assert.equal(delivered,false);
});

test('coupon eligibility accepts general offers and rejects another product or shop under the coupon lock',async()=>{
 const base={id:randomUUID(),code:'STUDIO10',kind:'percent',value:10,section:null,product_id:null,minimum_kobo:0,max_uses:null,per_email_limit:1,starts_at:'2020-01-01',ends_at:null,active:true};
 const purchase={code:'STUDIO10',productId:7,section:'art',email:'buyer@example.test',amount:10000,mode:'live'};
 for(const restriction of [{},{product_id:7},{section:'art'},{product_id:8},{section:'photography'}]){
  let usageRead=false;
  const client={query:async(sql)=>{if(sql.includes('FROM shop_coupons')){assert.match(sql,/FOR UPDATE/);return {rows:[{...base,...restriction}]};}usageRead=true;return {rows:[{total:0,customer:0}]};}};
  if(restriction.product_id===8||restriction.section==='photography'){await assert.rejects(()=>applyCoupon(client,purchase),/unavailable/);assert.equal(usageRead,false);}
  else assert.equal((await applyCoupon(client,purchase)).amount,9000);
 }
});
test('coupon product picker returns digital and physical catalog names only to admins',async()=>{
 const products=[{id:7,title:'Studio book',section:'art',product_kind:'physical',is_active:true},{id:8,title:'Photo collection',section:'photography',product_kind:'digital',is_active:false}];
 const mocks={'next/server':{NextRequest,NextResponse},'node:crypto':{randomUUID},'@/lib/auth':{requireAdmin:async()=>null},'@/lib/db':{query:async sql=>({rows:sql.includes('FROM shop_coupons')?[]:products})},'@/lib/requestBody':{},'@/lib/couponAdmin':{},'@/lib/payments/policy':policy};
 const compiled={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/admin/coupons/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:compiled,exports:compiled.exports,require:n=>mocks[n]});
 const response=await compiled.exports.GET(new NextRequest('https://shop.test/api/admin/coupons'));
 assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/private, no-store/);assert.deepEqual((await response.json()).products,products);
});
