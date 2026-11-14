// Regression verification for the repaired audit finding: no database writes, provider requests, or real money.
import assert from 'node:assert/strict';
import {PaymentStore} from '../lib/payments/store.ts';
import {BillingService} from '../lib/stillbounds/billing-service.ts';
import {checkoutQuote} from '../lib/regionalPricing.ts';
const previous={NGN:1,USD:0.0007},current={NGN:1,USD:0.000739};
const oldShop=checkoutQuote(2000000,1,'USD',previous),newShop=checkoutQuote(2000000,1,'USD',current);
const pending={reference:'moyo-1-00000000-0000-4000-8000-000000000000',kind:'digital',target_id:1,email:'buyer@example.test',mode:'test',shop_section:'photography',status:'pending',amount_kobo:oldShop.amountMinor,checkout_url:'https://checkout.paystack.com/original'};
const store=new PaymentStore(async work=>work({query:async sql=>({rows:sql.includes('WHERE request_key')?[pending]:[]})}));
const saved=await store.createDigital(1,pending.email,'test','same-key','photography','NG','USD',newShop.amountMinor);assert.equal(saved.reference,pending.reference);assert.equal(saved.amount_kobo,oldShop.amountMinor);
const nativeFetch=globalThis.fetch;
globalThis.fetch=async()=>({ok:true,json:async()=>({result:'success',base_code:'NGN',time_last_update_unix:Math.floor(Date.now()/1000),rates:current})});
try{
 const service=new BillingService({enabled:true,checkoutEnabled:true,mode:'test',origin:'https://fixture.test',creatorUserId:''},{status:async()=>({account:null,devices:[]}),createOrder:async()=>({reused:true,amount:checkoutQuote(3000000,1,'USD',previous).amountMinor,reference:'sb-test-original',checkoutUrl:'https://checkout.paystack.com/original'})},async()=>{throw Error('No provider call should occur');});
 const user={id:'buyer',email:'buyer@example.test',emailVerified:true},fresh=checkoutQuote(3000000,1,'USD',current).amountMinor;
 const result=await service.checkout(user,'NG','USD',fresh);assert.equal(result.confirmationRequired,true);
 const resumed=await service.checkout(user,'NG','USD',fresh,result.resumeQuote.reference,result.resumeQuote.amountMinor);assert.equal(resumed.checkoutUrl,'https://checkout.paystack.com/original');
}finally{globalThis.fetch=nativeFetch;}
console.log(JSON.stringify({fixed:true,shopSavedOrderPreserved:true,stillboundsSavedQuoteConfirmedAndResumed:true,noDatabaseOrProviderWrites:true}));
