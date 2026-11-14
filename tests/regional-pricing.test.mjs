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
