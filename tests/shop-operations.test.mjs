import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {matchingShippingRules,orderFilters,checkLowStock,updateFulfillment} from '../lib/shopOperations.ts';
import {claimRefund,returnAction} from '../lib/returns.ts';
test('shipping previews prefer regional delivery, preserve pickup and exclude other countries or disabled rules',()=>{
 const rates=[{country:'NG',region:'',pickup:false},{country:'NG',region:'Lagos',pickup:false},{country:'NG',region:'Abuja',pickup:true},{country:'GB',region:'',pickup:false},{country:'NG',region:'Lagos',pickup:false,active:false}];
 assert.deepEqual(matchingShippingRules(rates,' ng ',' LAGOS '),[rates[1],rates[2]]);assert.deepEqual(matchingShippingRules(rates,'NG','Kano'),[rates[0],rates[2]]);assert.deepEqual(matchingShippingRules(rates,'US',''),[]);
});
test('order filters escape wildcards and reject invalid pagination or status',()=>{
 assert.equal(orderFilters(new URLSearchParams({search:'a%_\\'})).pattern,'%a\\%\\_\\\\%');for(const p of [{page:'-1'},{page:'1.5'},{payment:'unknown'},{kind:'invoice'},{fulfillment:'fake'}])assert.throws(()=>orderFilters(new URLSearchParams(p)));
});
test('stock alerts are latched until replenishment and disabled thresholds never notify',async()=>{
 const item={product_id:1,title:'Edition',stock_on_hand:2,low_stock_threshold:2,low_alerted:false};let queued=0;
 const c={query:async sql=>{if(sql.startsWith('SELECT'))return {rows:[item]};if(sql.startsWith('INSERT'))queued++;if(sql.includes('low_alerted=TRUE'))item.low_alerted=true;if(sql.includes('low_alerted=FALSE'))item.low_alerted=false;return {rows:[]};}};
 await checkLowStock(c,1);await checkLowStock(c,1);assert.equal(queued,1);item.stock_on_hand=3;await checkLowStock(c,1);item.stock_on_hand=1;await checkLowStock(c,1);assert.equal(queued,2);item.low_stock_threshold=null;await checkLowStock(c,1);assert.equal(queued,2);
});
test('fulfilment enforces pickup/delivery and unchanged saves do not queue emails',async()=>{
 const order={status:'paid',shipping_details:{pickup:true},fulfillment_status:'processing',tracking_number:'',fulfillment_version:1};let writes=0;
 const c={query:async sql=>sql.startsWith('SELECT')?{rows:[order]}:(writes++,{rows:[]})};
 assert.equal(await updateFulfillment(c,'order','processing',''),false);assert.equal(writes,0);await assert.rejects(updateFulfillment(c,'order','shipped',''),/pickup status/);assert.equal(await updateFulfillment(c,'order','ready_for_pickup',''),true);assert.equal(writes,2);order.status='refunded';await assert.rejects(updateFulfillment(c,'order','processing',''),/verified paid/);
});
function returnFixture({state='none',total=0,status='approved',restocked=0}={}){
 const r={id:randomUUID(),order_reference:'order',quantity:2,restocked_quantity:restocked,status,refund_kobo:600,refund_state:state};let stock=0,updates=0;
 const order={reference:'order',paid_at:new Date(),status:'paid',amount_kobo:1000,target_id:1,stock_reservation_id:'hold'};
 return {r,c:{query:async(sql,args)=>{if(sql.includes('FROM shop_returns WHERE id='))return {rows:[r]};if(sql.includes('FROM payment_orders'))return {rows:[order]};if(sql.includes(' AS total'))return {rows:[{total}]};if(sql.includes('FROM shop_stock_reservations'))return {rows:[{state:'committed'}]};if(sql.startsWith('UPDATE shop_inventory SET stock_on_hand')){stock+=args[1];return {rowCount:1,rows:[{product_id:1}]};}if(sql.includes('SET restocked_quantity'))r.restocked_quantity=args[1];if(sql.includes('SET refund_state'))updates++;return {rows:[]};}},counts:()=>({stock,updates})};
}
test('refund approval requires exact confirmation, serializes submissions and caps aggregate refunds',async()=>{
 let f=returnFixture();await assert.rejects(claimRefund(f.c,f.r.id,'wrong',600),/Confirm/);await assert.rejects(claimRefund(f.c,f.r.id,'order',1),/Confirm/);assert.equal(f.counts().updates,0);
 f=returnFixture({total:500});await assert.rejects(claimRefund(f.c,f.r.id,'order',600),/remaining purchase/);
 for(const state of ['pending','processed','needs-attention']){f=returnFixture({state});assert.equal((await claimRefund(f.c,f.r.id,'order',600)).send,false);assert.equal(f.counts().updates,0);}
 f=returnFixture({state:'submitting'});await assert.rejects(claimRefund(f.c,f.r.id,'order',600),/already being submitted/);
 f=returnFixture();assert.equal((await claimRefund(f.c,f.r.id,'order',600)).send,true);assert.equal(f.counts().updates,1);
});
test('stock receipt and cumulative restocking are independent of refund approval and idempotent',async()=>{
 let f=returnFixture();await assert.rejects(returnAction(f.c,f.r.id,'restock',1),/receipt/);assert.equal(f.counts().stock,0);
 f=returnFixture({status:'received'});await returnAction(f.c,f.r.id,'restock',1);await returnAction(f.c,f.r.id,'restock',1);assert.equal(f.counts().stock,1);await returnAction(f.c,f.r.id,'restock',2);assert.equal(f.counts().stock,2);await assert.rejects(returnAction(f.c,f.r.id,'restock',1),/cumulative/);await assert.rejects(returnAction(f.c,f.r.id,'restock',3),/cumulative/);assert.equal(f.counts().updates,0);
});
function refundService({state='none',provider=[],throwPost=false}={}){
 const r={id:randomUUID(),order_reference:'order',refund_reference:'moyo-refund-test',refund_kobo:600,refund_state:state,reason:'Return'};let posts=0,revocations=0;const queries=[];
 const mocks={'./db':{query:async(sql,args)=>{queries.push([sql,args]);return {rows:[r]};},transaction:async fn=>fn({})},'./paystack':{paystackSecret:()=> 'sk_live_mock',paystackRequest:async(path)=>{if(path.startsWith('/refund?'))return provider;posts++;if(throwPost)throw Error('timeout');return {reference:'moyo-refund-test',domain:'live',currency:'NGN',amount:600,transaction:{id:1,reference:'order'},id:123,status:'pending'};}},'./payments/policy':{paymentMode:()=> 'live',PaymentError:class extends Error{}},'./payments/server':{payments:{order:async()=>({reference:'order',mode:'live',currency:'NGN',provider_id:'1'}),revoke:async()=>{revocations++;}}},'./returns':{claimRefund:async()=>({send:true,request:r})}};
 const compiled={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/refunds.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:compiled,exports:compiled.exports,require:n=>mocks[n],Date,encodeURIComponent});return {service:compiled.exports,id:r.id,counts:()=>({posts,revocations}),queries};
}
test('read-only refund reconciliation cannot initiate payments, and repeated provider references reconcile existing refunds',async()=>{
 let f=refundService();assert.equal(await f.service.processReturnRefund(f.id),'none');assert.equal(f.counts().posts,0);
 f=refundService({state:'unknown',provider:[{reference:'moyo-refund-test',domain:'live',currency:'NGN',amount:600,transaction:1,id:123,status:'processed'}]});assert.equal(await f.service.processReturnRefund(f.id,'order',600),'processed');assert.deepEqual(f.counts(),{posts:0,revocations:1});
 f=refundService({throwPost:true});await assert.rejects(f.service.processReturnRefund(f.id,'order',600),/timeout/);assert.equal(f.counts().posts,1);assert.ok(f.queries.some(([sql])=>sql.includes("THEN 'unknown'")));
});
function mailFixture({stale=false,fail=false}={}){
 const notice={id:randomUUID(),kind:'fulfillment',order_reference:'order',payload:{version:2,status:'ready_for_pickup'},attempts:0};let available=true,discarded=false,retried=false;const sent=[];
 const query=async sql=>{if(sql.startsWith('SELECT * FROM shop_notifications')){if(!available)return {rows:[]};available=false;return {rows:[notice]};}if(sql.startsWith('SELECT * FROM payment_orders'))return {rows:[{reference:'order',email:'buyer@example.test',status:'paid',fulfillment_version:stale?3:2,title:'Edition',shop_section:'art'}]};if(sql.includes('discarded=TRUE'))discarded=true;if(sql.includes('next_attempt_at=NOW()'))retried=true;return {rows:[]};};
 const mocks={'./db':{query,transaction:fn=>fn({query})},'./newsletter/mail':{newsletterTransport:()=>({from:'studio@example.test',mail:{sendMail:async message=>{sent.push(message);if(fail)throw Error('SMTP unavailable');return {accepted:['buyer@example.test'],rejected:[]};}}})},'./payments/policy':{isPaymentEmail:email=>email==='buyer@example.test',accessProof:()=> 'mock-proof'},'./purchaseAccess':{purchaseSigningKey:()=> 'mock-key'},'./paystack':{paymentOrigin:()=> 'https://shop.test'},'./productSections':{productShopPath:()=> '/art/shop'}};
 const compiled={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/shopMail.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:compiled,exports:compiled.exports,require:n=>mocks[n],Date,URL,encodeURIComponent,process:{env:{CONTACT_EMAIL:'studio@example.test'}}});return {deliver:compiled.exports.deliverShopMail,sent,states:()=>({discarded,retried})};
}
test('customer pickup updates carry a protected order link and stale updates are suppressed',async()=>{
 let f=mailFixture();assert.equal((await f.deliver()).delivered,1);assert.match(f.sent[0].subject,/pickup order is ready/);assert.match(f.sent[0].text,/https:\/\/shop.test\/art\/shop\/payment\?reference=order#access=/);assert.equal(f.sent[0].to.address,'buyer@example.test');
 f=mailFixture({stale:true});assert.equal((await f.deliver()).discarded,1);assert.equal(f.sent.length,0);assert.equal(f.states().discarded,true);
});
test('SMTP failures retain queued updates for retry without marking them sent',async()=>{const f=mailFixture({fail:true});assert.equal((await f.deliver()).deferred,1);assert.equal(f.states().retried,true);});
test('refund reconciliation rejects mismatched provider evidence before revoking a purchase',async()=>{
 for(const patch of [{amount:1},{domain:'test'},{currency:'USD'},{transaction:99}]){const f=refundService({state:'unknown',provider:[{reference:'moyo-refund-test',domain:'live',currency:'NGN',amount:600,transaction:1,id:123,status:'processed',...patch}]});await assert.rejects(f.service.processReturnRefund(f.id),/does not match/);assert.deepEqual(f.counts(),{posts:0,revocations:0});}
});
