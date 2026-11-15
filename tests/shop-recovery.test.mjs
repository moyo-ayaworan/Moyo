import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { PaymentStore } from '../lib/payments/store.ts';
import * as policy from '../lib/payments/policy.ts';
function load(file, mocks) {
 const compiled={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:compiled,exports:compiled.exports,require:name=>{if(!(name in mocks))throw Error(name);return mocks[name];},process:{env:{}},URL,Date,Buffer,AbortSignal});
 return compiled.exports;
}
const order={reference:'moyo-1-00000000-0000-4000-8000-000000000000',kind:'digital',target_id:1,email:'buyer@example.test',mode:'test',shop_section:'photography',status:'pending',amount_kobo:100,currency:'NGN',delivery_url:'private',metadata:{},checkout_url:null};
test('same-key retry recovers pending, failed and paid orders without another insert; rejects other buyers',async()=>{
 for(const status of ['pending','failed','paid']){
  const store=new PaymentStore(async work=>work({query:async sql=>{assert(!sql.includes('INSERT'));return {rows:sql.includes('WHERE request_key')?[{...order,status}]:[]};}}));
  const saved=await store.createDigital(1,order.email,'test','key');assert.equal(saved.retry,true);assert.equal(saved.status,status);
  await assert.rejects(store.createDigital(1,'other@example.test','test','key'));
 }
});
test('initialization failure preserves order and retry uses the same provider reference; concurrent retries reuse saved URL',async()=>{
 let current={...order},tail=Promise.resolve(),calls=0,fail=true;
 const transact=work=>{const next=tail.then(()=>work({query:async(sql,params)=>{
  if(sql.startsWith('SELECT *'))return {rows:[{...current}]};
  if(sql.startsWith('UPDATE'))current={...current,checkout_url:params[1],status:'pending'};
  return {rows:[]};
 }}));tail=next.catch(()=>{});return next;};
 const server=load('lib/payments/server.ts',{
  'next/server':{},'../db':{transaction:transact},'../paystack':{paymentOrigin:()=> 'https://studio.example.test',paystackRequest:async(path,body)=>{calls++;assert.equal(body.reference,order.reference);if(fail)throw Error('timeout');return {reference:order.reference,authorization_url:'https://checkout.paystack.com/fixture'};}},
  '../privateMedia':{parseAuthenticatedAsset:()=>true},'./store':{PaymentStore},'./policy':policy,
 });
 await assert.rejects(server.initializeOrder(order,'/return'),/timeout/);assert.equal(current.status,'pending');
 fail=false;
 const urls=await Promise.all([server.initializeOrder(order,'/return'),server.initializeOrder(order,'/return')]);
 assert.deepEqual(Array.from(urls),['https://checkout.paystack.com/fixture','https://checkout.paystack.com/fixture']);assert.equal(calls,2);
});
test('maintenance keeps old unresolved payments, separates paid audits, drains larger batches and reports backlog',async()=>{
 const sqls=[],verified=[],response={json:(body,options={})=>({body,...options})};let notificationOptions;
 const route=load('app/api/payments/maintenance/route.ts',{
  'node:crypto':{timingSafeEqual:()=>false},'next/server':{NextResponse:response},'@/lib/auth':{requireAdmin:()=>null},
  '@/lib/db':{query:async sql=>{sqls.push(sql);return {rows:sql.includes('payment_notifications')?[{pending:4}]:sql.includes("('pending','failed')")?[{...order,status:'failed'}]:[{...order,reference:'paid',status:'paid'}]};}},
  '@/lib/payments/server':{verifyOrder:async o=>{verified.push(o.status);},payments:{transact:async work=>work({query:async()=>({rows:[]})})},privateHeaders:{}},
  '@/lib/payments/notifications':{deliverPaymentNotifications:async options=>{notificationOptions=options;}},
  '@/lib/bookingRecovery':{deliverBookingRecovery:async()=>{}},
 });
 const result=await route.GET({headers:new Headers()});assert.equal(result.body.checked,2);assert.equal(result.body.pendingNotifications,4);
 assert.deepEqual(verified,['failed','paid']);assert(!sqls.some(sql=>sql.includes('7 days')));assert.equal(notificationOptions.limit,100);
});
