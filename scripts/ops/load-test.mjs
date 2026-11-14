// Synthetic data only. Refuse any database outside this runner's loopback host.
import assert from 'node:assert/strict';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
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
  await pool.query("INSERT INTO digital_products(title,price,product_url) SELECT 'Synthetic product '||n,'₦20,000','https://example.test/private' FROM generate_series(1,1000) n");
  const store = new PaymentStore(tx), key = randomUUID();
  const start = performance.now();
  const retryResults = await Promise.all(Array.from({ length: 40 }, () => timed(() => store.createDigital(1, 'synthetic@example.test', 'test', key))));
  assert.equal(new Set(retryResults.map(r => r.reference)).size, 1);
  await Promise.all(Array.from({ length: 120 }, (_, i) => timed(() => store.createDigital(i + 2, `fixture-${i}@example.test`, 'test', randomUUID()))));
  await Promise.all(Array.from({ length: 200 }, () => timed(() => pool.query('SELECT id,title,price FROM digital_products WHERE section=$1 AND is_active=TRUE ORDER BY id LIMIT 24', ['photography']))));
  const count = (await pool.query('SELECT COUNT(*)::int AS n FROM payment_orders')).rows[0].n;
  assert.equal(count, 121);
  await Promise.all(Array.from({ length: 24 }, () => timed(async () => {
    const body = await boundedBody(new Request('http://localhost/upload-fixture', { method: 'POST', body: Buffer.alloc(1024 * 1024) }), 4 * 1024 * 1024);
    assert.equal(body.length, 1024 * 1024);
  })));
  await assert.rejects(boundedBody(new Request('http://localhost/upload-fixture', { method: 'POST', body: Buffer.alloc(4 * 1024 * 1024 + 1) }), 4 * 1024 * 1024), error => error.status === 413);
  const plan = await pool.query("EXPLAIN (FORMAT JSON) SELECT id,title FROM digital_products WHERE section='photography' AND is_active=TRUE ORDER BY id LIMIT 24");
  times.sort((a,b) => a-b);
  const evidence = { syntheticOnly: true, productionTraffic: false, databaseHost: 'loopback', operations: times.length, poolLimit: 4, uniqueOrders: count, duplicateAttempts: 40, duplicateOrders: 1, elapsedMs: Math.round(performance.now()-start), p50Ms: Math.round(times[Math.floor(times.length*.5)]), p95Ms: Math.round(times[Math.floor(times.length*.95)]), p99Ms: Math.round(times[Math.floor(times.length*.99)]), catalogPlan: plan.rows[0]['QUERY PLAN'][0].Plan['Node Type'] };
  console.log(JSON.stringify(evidence));
  if (process.env.LOAD_REPORT_PATH) await writeFile(process.env.LOAD_REPORT_PATH, JSON.stringify(evidence, null, 2));
} finally { await pool.end(); }
