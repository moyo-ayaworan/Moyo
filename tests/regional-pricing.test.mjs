import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as pricing from '../lib/regionalPricing.ts';
test('regional defaults cover Nigeria and common visitor countries without affecting charging currency',()=>{
 for(const [country,currency] of [['NG','NGN'],['US','USD'],['GB','GBP'],['DE','EUR'],['CA','CAD'],['GH','GHS'],['KE','KES'],['ZA','ZAR'],['SN','XOF'],['BR','USD'],['','NGN']])assert.equal(pricing.currencyForCountry(country),currency);
 assert.equal(pricing.currencyForCountry('ng'),'NGN');assert(!pricing.isDisplayCurrency('BTC'));
});
test('display conversions preserve decimal amounts and fall back to NGN when rates are missing',()=>{
 assert.equal(pricing.nairaAmount('₦20,000.50'),20000.5);
 for(const value of ['$20','-20','20,00','Infinity','NGN 1e5'])assert.equal(pricing.nairaAmount(value),null);
 assert.equal(pricing.displayPrice('₦20,000','USD',{USD:0.00065}).text,'USD\u00a013.00');
 assert.equal(pricing.displayPrice('20000','GBP',{}).converted,false);
 assert.match(pricing.displayPrice('20000','GBP',{}).text,/20,000/);
 assert.equal(pricing.displayPrice('Price on request','USD',{USD:0.001}).text,'Price on request');
});
test('stale, malformed and unsafe exchange rate values cannot become display estimates',()=>{
 const now=Date.now(),data={result:'success',base_code:'NGN',time_last_update_unix:Math.floor(now/1000),rates:{NGN:1,USD:0.00065,GBP:-1,EUR:Infinity,CAD:'0.1'}};
 const valid=pricing.validateDisplayRates(data,now);assert.equal(valid.rates.USD,0.00065);assert.equal(valid.rates.GBP,undefined);assert.equal(valid.rates.EUR,undefined);assert.equal(valid.rates.CAD,undefined);
 for(const patch of [{base_code:'USD'},{result:'error'},{time_last_update_unix:0},{time_last_update_unix:(now+86400000)/1000},{rates:{NGN:2}}])assert.throws(()=>pricing.validateDisplayRates({...data,...patch},now));
});
function route(fetch){
 const compiled={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/regional-pricing/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:compiled,exports:compiled.exports,require:n=>n==='next/server'?{NextResponse:{json:(body,options)=>({body,...options})}}:pricing,fetch,AbortSignal});
 return compiled.exports;
}
test('geolocation responses cannot be publicly cached and provider failure leaves checkout amounts in NGN',async()=>{
 const req={headers:new Headers({'x-vercel-ip-country':'GB'})};
 const failure=await route(async()=>{throw Error('offline');}).GET(req);
 assert.equal(failure.body.currency,'GBP');assert.equal(failure.body.rates.NGN,1);assert.equal(failure.body.asOf,null);assert.equal(failure.headers['Cache-Control'],'private, no-store');
 const success=await route(async(url,options)=>{
  assert.equal(url,'https://open.er-api.com/v6/latest/NGN');assert.equal(options.next.revalidate,86400);
  return {ok:true,json:async()=>({result:'success',base_code:'NGN',time_last_update_unix:Math.floor(Date.now()/1000),rates:{NGN:1,GBP:0.0005}})};
 }).GET(req);
 assert.equal(success.body.rates.GBP,0.0005);assert.equal(success.body.currency,'GBP');
});
test('selling-price tiers double Europe and USA independently of display currency',()=>{
 for(const country of ['US','GB','FR','DE','CH','NO','UA','RS'])assert.equal(pricing.regionalMultiplier(country),2);
 for(const country of ['NG','GH','ZA','CA','AU','BR','IN','AE','','XX'])assert.equal(pricing.regionalMultiplier(country),1);
 assert.equal(pricing.regionalAmount('₦20,000',2),40000);
 assert.equal(pricing.regionalAmount(30000,2),60000);
 assert.equal(pricing.regionalAmount(30000,1),30000);
});
test('digital checkout snapshots the server regional price and preserves existing orders',async()=>{
 const {PaymentStore}=await import('../lib/payments/store.ts');
 for(const [country,expected] of [['US',4000000],['DE',4000000],['NG',2000000],['CA',2000000]]){
  let inserted;
  const store=new PaymentStore(async work=>work({query:async(sql,args)=>{
   if(sql.includes('FROM digital_products'))return {rows:[{id:1,title:'Pack',price:'20000',product_url:'private-file',section:'photography'}]};
   if(sql.includes('INSERT INTO payment_orders')){inserted=args;return {rows:[{amount_kobo:args[4]}]};}
   return {rows:[]};
  }}));
  const order=await store.createDigital(1,'buyer@example.test','test','test-request','photography',country);
  assert.equal(order.amount_kobo,expected);assert.equal(JSON.parse(inserted[7]).pricing_multiplier,expected/2000000);
 }
});
test('Stillbounds offer and actual Paystack initialization use the same regional amount',async()=>{
 const {BillingService}=await import('../lib/stillbounds/billing-service.ts');
 for(const [country,amount] of [['US',6000000],['FR',6000000],['NG',3000000],['AU',3000000]]){
  let charged;
  const service=new BillingService({enabled:true,checkoutEnabled:true,mode:'test',origin:'https://example.test',creatorUserId:''},{status:async()=>({account:null,devices:[]}),createOrder:async()=>null,saveCheckout:async()=>{},failOrder:async()=>{}},async(path,body)=>{charged=body;return {reference:body.reference,authorization_url:'https://checkout.paystack.com/test'};});
  assert.equal(service.offer(country).price.amountMinor,amount);
  assert.equal((await service.status({id:'buyer',email:'buyer@example.test',emailVerified:true},country)).price.amountMinor,amount);
  await service.checkout({id:'buyer',email:'buyer@example.test',emailVerified:true},country);
  assert.equal(charged.amount,amount);assert.equal(charged.currency,'NGN');
 }
});
test('account prices convert the server regional amount without doubling it again',async()=>{
 const React=await import('react'),{renderToStaticMarkup}=await import('react-dom/server'),jsx=await import('react/jsx-runtime');
 const state={currency:'USD',rates:{NGN:1,USD:0.001},multiplier:2,loaded:true,failed:false};
 const compiled={exports:{}};
 const code=ts.transpileModule(fs.readFileSync('components/RegionalPricing.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(code,{module:compiled,exports:compiled.exports,require:name=>{
  if(name==='react')return {...React,useContext:()=>state};
  if(name==='react/jsx-runtime')return jsx;
  if(name==='next/navigation')return {usePathname:()=>'/stillbounds/account'};
  if(name==='@/lib/browserStorage')return {};
  return pricing;
 }});
 const Price=compiled.exports.RegionalPrice;
 assert.match(renderToStaticMarkup(React.createElement(Price,{value:60000,adjusted:true})),/60\.00/);
 assert.match(renderToStaticMarkup(React.createElement(Price,{value:30000})),/60\.00/);
});
