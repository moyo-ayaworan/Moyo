import { commerceSchema, shippingSchema } from '../../lib/commerceSchema.ts';
// Synthetic data only. Refuse any database outside this runner's loopback host.
import assert from 'node:assert/strict';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import {checkLowStock,updateFulfillment} from '../../lib/shopOperations.ts';
import {createReturn,returnAction,claimRefund} from '../../lib/returns.ts';
import { PaymentStore } from '../../lib/payments/store.ts';
import { paymentSchema } from '../../lib/payments/schema.ts';
import { writeFile } from 'node:fs/promises';
import { boundedBody } from '../../lib/studio/protocol.ts';
const url = new URL(process.env.LOAD_DATABASE_URL);
assert(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && url.pathname === '/moyo_load', 'Load tests require the disposable local moyo_load database');
const pool = new pg.Pool({ connectionString: url.href, max: 4, connectionTimeoutMillis: 10000, statement_timeout: 15000 });
async function tx(work) { const c = await pool.connect(); try { await c.query('BEGIN'); const r = await work(c); await c.query('COMMIT'); return r; } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); } }
const times = [];
const timed = async work => { const start = performance.now(); const value = await work(); times.push(performance.now() - start); return value; };
try {
  await pool.query(`CREATE TABLE gallery_documents(id SERIAL PRIMARY KEY);
    CREATE TABLE digital_products(id SERIAL PRIMARY KEY,title TEXT,price TEXT,product_url TEXT,is_active BOOLEAN DEFAULT TRUE);
    CREATE TABLE digital_orders(reference TEXT,product_id INTEGER,customer_email TEXT,amount_kobo BIGINT,currency TEXT,status TEXT,provider_reference TEXT,paid_at TIMESTAMPTZ,created_at TIMESTAMPTZ DEFAULT NOW());`);
  await pool.query(paymentSchema);
  await pool.query(commerceSchema);await pool.query(shippingSchema);
  await pool.query("INSERT INTO digital_products(title,price,product_url) SELECT 'Synthetic product '||n,'₦20,000','https://example.test/private' FROM generate_series(1,1000) n");
  const store = new PaymentStore(tx), key = randomUUID();
  const start = performance.now();
  const retryResults = await Promise.all(Array.from({ length: 40 }, () => timed(() => store.createDigital(1, 'synthetic@example.test', 'test', key))));
  assert.equal(new Set(retryResults.map(r => r.reference)).size, 1);
  await Promise.all(Array.from({ length: 120 }, (_, i) => timed(() => store.createDigital(i + 2, `fixture-${i}@example.test`, 'test', randomUUID()))));
  await Promise.all(Array.from({ length: 200 }, () => timed(() => pool.query('SELECT id,title,price FROM digital_products WHERE section=$1 AND is_active=TRUE ORDER BY id LIMIT 24', ['photography']))));
  const count = (await pool.query('SELECT COUNT(*)::int AS n FROM payment_orders')).rows[0].n;
  assert.equal(count, 121);
  // Different buyers compete for a single coupon slot under independent pool transactions.
  const couponId=randomUUID();await pool.query("INSERT INTO shop_coupons(id,code,kind,value,max_uses,max_discount_kobo,budget_kobo,max_quantity,limits_reviewed) VALUES($1,'CONCURRENCY10','percent',10,1,200000,200000,1,TRUE)",[couponId]);
  const couponAttempts=await Promise.allSettled(Array.from({length:20},(_,i)=>store.createDigital(1,`coupon-${i}@example.test`,'test',randomUUID(),'photography','NG','NGN',1800000,'CONCURRENCY10')));
  assert.equal(couponAttempts.filter(r=>r.status==='fulfilled').length,1);
  // Discount budgets and mailbox aliases serialize under independent connections.
  await pool.query("INSERT INTO shop_coupons(id,code,kind,value,max_discount_kobo,budget_kobo,max_quantity,limits_reviewed) VALUES($1,'BUDGET10','percent',10,200000,400000,1,TRUE)",[randomUUID()]);
  const budgetAttempts=await Promise.allSettled(Array.from({length:20},(_,i)=>store.createDigital(1,`budget-${i}@example.test`,'test',randomUUID(),'photography','NG','NGN',1800000,'BUDGET10')));
  assert.equal(budgetAttempts.filter(r=>r.status==='fulfilled').length,2);
  assert.equal(Number((await pool.query("SELECT SUM(discount_kobo) total FROM payment_orders WHERE coupon_code='BUDGET10'")).rows[0].total),400000);
  await pool.query("INSERT INTO shop_coupons(id,code,kind,value,max_discount_kobo,budget_kobo,max_quantity,limits_reviewed) VALUES($1,'ALIAS10','percent',10,200000,4000000,1,TRUE)",[randomUUID()]);
  const aliases=await Promise.allSettled(Array.from({length:12},(_,i)=>store.createDigital(1,`s.y.n.t.h.e.t.i.c+${i}@${i%2?'gmail.com':'googlemail.com'}`,'test',randomUUID(),'photography','NG','NGN',1800000,'ALIAS10')));
  assert.equal(aliases.filter(r=>r.status==='fulfilled').length,1);
  const shippingId=randomUUID();await pool.query("INSERT INTO shop_shipping_regions(id,label,country,fee_kobo,pickup) VALUES($1,'Synthetic pickup','NG',0,TRUE)",[shippingId]);
  const physical=(await pool.query("INSERT INTO digital_products(title,price,product_url,product_kind) VALUES('One remaining physical item','20000','','physical') RETURNING id")).rows[0].id;
  await pool.query('INSERT INTO shop_inventory(product_id,stock_on_hand) VALUES($1,1)',[physical]);
  const stockAttempts=await Promise.allSettled(Array.from({length:20},(_,i)=>store.createDigital(physical,`stock-${i}@example.test`,'test',randomUUID(),'photography','NG','NGN',2000000,'',{quantity:1,shippingRateId:shippingId,shippingDetails:{name:'Synthetic customer',phone:'+2348000000000'}})));
  const winners=stockAttempts.filter(r=>r.status==='fulfilled');assert.equal(winners.length,1);
  const paid=winners[0].value;
  const evidencePayment={status:'success',reference:paid.reference,domain:'test',amount:Number(paid.amount_kobo),currency:'NGN',customer:{email:paid.email},metadata:paid.metadata,id:90001};
  await Promise.all(Array.from({length:12},()=>store.fulfill(paid.reference,evidencePayment)));
  assert.equal((await pool.query('SELECT stock_on_hand FROM shop_inventory WHERE product_id=$1',[physical])).rows[0].stock_on_hand,0);

  // Operations races use synthetic purchases; no provider or SMTP calls are made.
  await pool.query("UPDATE payment_orders SET mode='live' WHERE reference=$1",[paid.reference]);
  await pool.query('UPDATE shop_inventory SET low_stock_threshold=0 WHERE product_id=$1',[physical]);
  await Promise.all(Array.from({length:12},()=>tx(c=>checkLowStock(c,physical))));
  assert.equal((await pool.query("SELECT COUNT(*)::int n FROM shop_notifications WHERE kind='low_stock'")).rows[0].n,1);
  await Promise.all(Array.from({length:12},()=>tx(c=>updateFulfillment(c,paid.reference,'ready_for_pickup',''))));
  assert.equal((await pool.query("SELECT COUNT(*)::int n FROM shop_notifications WHERE kind='fulfillment'")).rows[0].n,1);
  const returnId=randomUUID();
  await tx(c=>createReturn(c,{id:returnId,reference:paid.reference,quantity:1,amount:2000000,reason:'Synthetic test return'}));
  await assert.rejects(tx(c=>returnAction(c,returnId,'restock',1)),/receipt/);
  await tx(c=>returnAction(c,returnId,'approved'));await tx(c=>returnAction(c,returnId,'received'));
  await Promise.all(Array.from({length:12},()=>tx(c=>returnAction(c,returnId,'restock',1))));
  assert.equal((await pool.query('SELECT stock_on_hand FROM shop_inventory WHERE product_id=$1',[physical])).rows[0].stock_on_hand,1);
  const claims=await Promise.allSettled(Array.from({length:12},()=>tx(c=>claimRefund(c,returnId,paid.reference,2000000))));
  assert.equal(claims.filter(r=>r.status==='fulfilled'&&r.value.send).length,1);

  await Promise.all(Array.from({ length: 24 }, () => timed(async () => {
    const body = await boundedBody(new Request('http://localhost/upload-fixture', { method: 'POST', body: Buffer.alloc(1024 * 1024) }), 4 * 1024 * 1024);
    assert.equal(body.length, 1024 * 1024);
  })));
  await assert.rejects(boundedBody(new Request('http://localhost/upload-fixture', { method: 'POST', body: Buffer.alloc(4 * 1024 * 1024 + 1) }), 4 * 1024 * 1024), error => error.status === 413);
  const plan = await pool.query("EXPLAIN (FORMAT JSON) SELECT id,title FROM digital_products WHERE section='photography' AND is_active=TRUE ORDER BY id LIMIT 24");
  times.sort((a,b) => a-b);
  const evidence = { syntheticOnly: true, productionTraffic: false, databaseHost: 'loopback', operations: times.length, poolLimit: 4, uniqueOrders: count, duplicateAttempts: 40, duplicateOrders: 1, couponAttempts:20,couponWinners:1,budgetAttempts:20,budgetWinners:2,aliasAttempts:12,aliasWinners:1,stockAttempts:20,stockWinners:1,repeatedSettlements:12,stockAlertRaces:12,fulfillmentRaces:12,restockRaces:12,refundClaimRaces:12,refundSubmissions:0,elapsedMs: Math.round(performance.now()-start), p50Ms: Math.round(times[Math.floor(times.length*.5)]), p95Ms: Math.round(times[Math.floor(times.length*.95)]), p99Ms: Math.round(times[Math.floor(times.length*.99)]), catalogPlan: plan.rows[0]['QUERY PLAN'][0].Plan['Node Type'] };
  console.log(JSON.stringify(evidence));
  if (process.env.LOAD_REPORT_PATH) await writeFile(process.env.LOAD_REPORT_PATH, JSON.stringify(evidence, null, 2));
} finally { await pool.end(); }
