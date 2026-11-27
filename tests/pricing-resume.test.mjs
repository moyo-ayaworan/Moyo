import * as checkoutInput from '../lib/checkoutInput.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {randomUUID} from 'node:crypto';
import {PaymentStore} from '../lib/payments/store.ts';
import {BillingService} from '../lib/stillbounds/billing-service.ts';
import * as snapshot from '../lib/pricingSnapshot.ts';
import * as pricing from '../lib/regionalPricing.ts';
import * as sections from '../lib/productSections.ts';
import * as policy from '../lib/payments/policy.ts';
const reference='moyo-1-00000000-0000-4000-8000-000000000000';
const old={reference,kind:'digital',target_id:1,email:'buyer@example.test',mode:'test',shop_section:'photography',status:'pending',amount_kobo:2857143,metadata:{product_id:1},pricing:{version:1},retry:true};
const user={id:'buyer',email:'buyer@example.test',emailVerified:true};
const config={enabled:true,checkoutEnabled:true,mode:'test',origin:'https://fixture.test',creatorUserId:''};
function loadInitialize(order){
 let initialized=0,body;
 const mocks={
  '@/lib/couponIdentity':{couponEmailCookie:'moyo-coupon-email',verifiedCouponEmail:()=>true},'@/lib/checkoutInput':checkoutInput,
  '@/lib/pricingSnapshot':snapshot,'@/lib/regionalPricing':pricing,'@/lib/productSections':sections,'node:crypto':{randomUUID},
  'next/server':{NextResponse:{json:(body,options)=>({body,options})}},'@/lib/rateLimit':{rateLimit:async()=>null},'@/lib/purchaseAccess':{setPurchaseCookie:()=>{}},
  '@/lib/paystack':{paystackSecret:()=> 'sk_test_fixture',PaymentReferenceMissing:class extends Error{}},'@/lib/payments/policy':policy,
  '@/lib/payments/server':{payments:{createDigital:async()=>order},requestBody:async()=>body,requirePaymentOrigin:()=>{},verifyOrder:async()=>order,initializeOrder:async()=>{initialized++;return 'https://checkout.paystack.com/original';},privateHeaders:{'Cache-Control':'private, no-store'},paymentFailure:error=>({body:{error:error.message},options:{status:error.status||503}})},
 };
 const compiledModule={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/paystack/initialize/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:compiledModule,exports:compiledModule.exports,require:name=>{if(!(name in mocks))throw Error(name);return mocks[name];}});
 return {call:async extra=>{body={productId:1,email:user.email,section:'photography',requestKey:'00000000-0000-4000-8000-000000000000',displayCurrency:'USD',expectedAmount:2706360,...extra};return compiledModule.exports.POST({headers:new Headers()});},initialized:()=>initialized};
}
test('shop requests explicit confirmation for a saved price and resumes only its original reference',async()=>{
 const route=loadInitialize({...old});
 const offered=await route.call();
 assert.equal(offered.body.confirmationRequired,true);assert.equal(offered.body.resumeQuote.amountMinor,old.amount_kobo);
 assert.equal(offered.body.checkoutUrl,undefined);assert.equal(route.initialized(),0);
 const wrong=await route.call({resumeReference:reference,resumeAmount:1});assert.equal(wrong.body.confirmationRequired,true);
 const other=await route.call({resumeReference:'another-reference',resumeAmount:old.amount_kobo});assert.equal(other.options.status,400);
 const resumed=await route.call({resumeReference:reference,resumeAmount:old.amount_kobo});
 assert.equal(resumed.body.checkoutUrl,'https://checkout.paystack.com/original');assert.equal(resumed.body.reference,reference);assert.equal(resumed.body.amount,old.amount_kobo/100);assert.equal(route.initialized(),1);
});
test('already-paid shop retries recover the receipt even if the current quote changed',async()=>{
 const route=loadInitialize({...old,status:'paid'}),response=await route.call();
 assert.match(response.body.paymentPath,/reference=moyo-1-/);assert.equal(response.body.confirmationRequired,undefined);assert.equal(route.initialized(),0);
});
test('shop storage returns the immutable saved order rather than blocking on new rates or creating a second order',async()=>{
 const store=new PaymentStore(async work=>work({query:async sql=>{assert(!sql.includes('INSERT'));return {rows:sql.includes('WHERE request_key')?[old]:[]};}}));
 const saved=await store.createDigital(1,user.email,'test','old-key','photography','US','EUR',1);
 assert.equal(saved.reference,reference);assert.equal(saved.amount_kobo,old.amount_kobo);assert.deepEqual(saved.pricing,old.pricing);
 await assert.rejects(store.createDigital(1,'another@example.test','test','old-key','photography','NG','NGN'),/different purchase/);
});
test('Stillbounds resumes a changed or legacy quote only after confirmation, without needing current FX',async()=>{
 const pending={reference:'sb-test-'+randomUUID(),mode:'test',userId:user.id,email:user.email,amount:4285715,currency:'NGN',status:'pending',checkoutUrl:'https://checkout.paystack.com/original',pricing:null};
 const service=new BillingService(config,{status:async()=>({account:null,devices:[]}),pendingOrder:async(mode,id)=>{assert.equal(mode,'test');assert.equal(id,user.id);return pending;},createOrder:async()=>{throw Error('Must not create another order');}},async()=>{throw Error('Must not initialize another provider checkout');});
 const nativeFetch=globalThis.fetch;let fetches=0;globalThis.fetch=async()=>{fetches++;throw Error('FX offline');};
 try {
  const offered=await service.checkout(user,'NG','USD',4059540);
  assert.equal(offered.confirmationRequired,true);assert.equal(offered.resumeQuote.amountMinor,pending.amount);assert.equal(offered.checkoutUrl,undefined);
  assert.equal((await service.checkout(user,'NG','USD',4059540,pending.reference,1)).confirmationRequired,true);
  const resumed=await service.checkout(user,'NG','USD',4059540,pending.reference,pending.amount);
  assert.equal(resumed.checkoutUrl,pending.checkoutUrl);assert.equal(resumed.reference,pending.reference);assert.equal(resumed.amount,pending.amount/100);assert.equal(fetches,0);
 }finally{globalThis.fetch=nativeFetch;}
});
test('a concurrent Stillbounds reservation returns the saved-price confirmation without a second provider call',async()=>{
 const pending={reference:'sb-test-'+randomUUID(),amount:3100000,currency:'NGN',checkoutUrl:'https://checkout.paystack.com/original',reused:true};
 let reservations=0;
 const service=new BillingService(config,{status:async()=>({account:null,devices:[]}),pendingOrder:async()=>null,createOrder:async()=>{reservations++;return pending;}},async()=>{throw Error('Unexpected provider initialization');});
 const result=await service.checkout(user,'NG','NGN',3000000);assert.equal(result.confirmationRequired,true);assert.equal(result.resumeQuote.reference,pending.reference);assert.equal(reservations,1);
});
test('new EUR shop and Stillbounds orders persist a complete server pricing snapshot',async()=>{
 const rates={NGN:1,USD:0.000739,EUR:0.000678},asOf=Math.floor(Date.now()/1000)*1000;
 const nativeFetch=globalThis.fetch;globalThis.fetch=async()=>({ok:true,json:async()=>({result:'success',base_code:'NGN',time_last_update_unix:asOf/1000,rates})});
 try{
  const expected=pricing.checkoutQuote(2000000,2,'EUR',rates);let inserted;
  const store=new PaymentStore(async work=>work({query:async(sql,args)=>{
   if(sql.includes('FROM digital_products'))return {rows:[{price:'20000',title:'Pack',product_url:'private',id:1}]};
   if(sql.includes('INSERT INTO payment_orders')){inserted=JSON.parse(args[10]);return {rows:[{reference,pricing:inserted,amount_kobo:args[4]}]};}
   return {rows:[]};
  }}));
  const shop=await store.createDigital(1,user.email,'test','new-key','photography','FR','EUR',expected.amountMinor);
  assert.equal(shop.pricing.displayCurrency,'EUR');assert.equal(shop.pricing.exchangeRate,rates.EUR);assert.equal(shop.pricing.rateAsOf,asOf);assert.equal(shop.pricing.sellingAmount,40);assert.equal(shop.pricing.baseAmountMinor,2000000);assert.equal(shop.pricing.multiplier,2);assert.equal(shop.pricing.country,'FR');assert.equal(shop.pricing.amountMinor,expected.amountMinor);assert.equal(shop.pricing.version,2);
  let reserved;
  const service=new BillingService(config,{status:async()=>({account:null,devices:[]}),createOrder:async order=>{reserved=order;},saveCheckout:async()=>{},failOrder:async()=>{}},async(path,body)=>({reference:body.reference,authorization_url:'https://checkout.paystack.com/new'}));
  await service.checkout(user,'FR','EUR',pricing.checkoutQuote(3000000,2,'EUR',rates).amountMinor);
  await assert.rejects(service.checkout(user,'FR','EUR',1),/quote changed/);
  await assert.rejects(store.createDigital(1,user.email,'test','new-key','photography','FR','EUR',1),/quote changed/);
  assert.equal(reserved.pricing.sellingAmount,60);assert.equal(reserved.pricing.rateAsOf,asOf);assert.equal(reserved.pricing.currency,'NGN');assert.equal(reserved.pricing.exchangeRate,rates.EUR);assert.equal(reserved.pricing.baseAmountMinor,3000000);
 }finally{globalThis.fetch=nativeFetch;}
});

test('same-price Stillbounds retries reuse the saved session without an extra confirmation or provider call',async()=>{
 const pending={reference:'sb-test-'+randomUUID(),amount:3000000,currency:'NGN',checkoutUrl:'https://checkout.paystack.com/original'};
 const service=new BillingService(config,{status:async()=>({account:null,devices:[]}),pendingOrder:async()=>pending},async()=>{throw Error('Unexpected provider initialization');});
 const response=await service.checkout(user,'NG','NGN',3000000);
 assert.equal(response.checkoutUrl,pending.checkoutUrl);assert.equal(response.confirmationRequired,undefined);
});
test('saved-quote UI requires a click and validates server response fields before showing a resumable amount',async()=>{
 for(const value of [null,{}, {reference,currency:'USD',amountMinor:100},{reference,currency:'NGN',amountMinor:-1},{reference:'<script>',currency:'NGN',amountMinor:1}])assert.equal(snapshot.parseSavedCheckoutQuote(value),null);
 const parsed=snapshot.parseSavedCheckoutQuote({reference,currency:'NGN',amountMinor:1234500});assert.equal(parsed.amountMinor,1234500);
 const React=await import('react'),jsx=await import('react/jsx-runtime'),{renderToStaticMarkup}=await import('react-dom/server');
 const compiled={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/ResumeCheckout.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{module:compiled,exports:compiled.exports,require:name=>{assert.equal(name,'react/jsx-runtime');return jsx;}});
 let clicks=0;const element=compiled.exports.default({quote:parsed,busy:false,onResume:()=>clicks++});
 const html=renderToStaticMarkup(React.createElement(compiled.exports.default,{quote:parsed,busy:false,onResume:()=>clicks++}));
 assert.equal(clicks,0);assert.match(html,/12,345/);assert.match(html,/type="button"/);assert.match(html,/Resume saved checkout/);
 const button=element.props.children.find(child=>child?.type==='button');button.props.onClick();assert.equal(clicks,1);
});
