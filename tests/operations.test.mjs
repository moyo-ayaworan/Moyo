import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { timingSafeEqual } from 'node:crypto';

function load(file, mocks, env = {}) {
  const compiled = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module: compiled, exports: compiled.exports, require: name => mocks[name], process: { env }, Buffer, Date, Response, console: { info() {}, error() {} } });
  return compiled.exports;
}

test('health endpoint fails closed without its secret and rejects wrong credentials before database access', async () => {
  let queries = 0;
  const mocks = { 'node:crypto': { timingSafeEqual }, '@/lib/db': { query: async () => { queries++; return { rows: [] }; } } };
  for (const env of [{}, { OPERATIONS_MONITOR_SECRET: 'valid-secret' }]) {
    const route = load('app/api/operations/health/route.ts', mocks, env);
    const result = await route.GET(new Request('https://example.test/api/operations/health', { headers: { Authorization: 'Bearer wrong-secret' } }));
    assert.equal(result.status, 401);
  }
  assert.equal(queries, 0);
});

test('authorized health checks expose no database details and record heartbeat only on POST', async () => {
  const statements = [];
  const route = load('app/api/operations/health/route.ts', { 'node:crypto': { timingSafeEqual }, '@/lib/db': { query: async sql => { statements.push(sql); return { rows: [] }; } } }, { OPERATIONS_MONITOR_SECRET: 'fixture' });
  const request = method => new Request('https://example.test/api/operations/health', { method, headers: { Authorization: 'Bearer fixture' } });
  assert.deepEqual(await (await route.GET(request('GET'))).json(), { healthy: true });
  assert.equal(statements.length, 1);
  assert.equal((await route.POST(request('POST'))).status, 200);
  assert(statements.at(-1).includes('external-monitor'));
});

test('Stillbounds reconciliation uses only configured mode and reuses validated fulfilment for successful payments', async () => {
  const fulfilled = [], checks = [];
  const route = load('lib/stillbounds/recovery.ts', {
    '../db': { query: async (sql, params) => {
      if (sql.startsWith('SELECT')) { assert.equal(params[0], 'test'); return { rows: [{ reference: 'success' }, { reference: 'abandoned' }, { reference: 'unavailable' }] }; }
      checks.push(params[0]); return { rows: [] };
    } },
    './billing-service': { billingService: () => ({ config: { enabled: true, checkoutEnabled: true, mode: 'test' }, provider: async path => { if (path.endsWith('unavailable')) throw Error('outage'); return { status: path.endsWith('success') ? 'success' : 'abandoned' }; }, store: { fulfill: async (mode, reference) => { fulfilled.push([mode, reference]); } } }) },
  });
  const result = await route.recoverStillboundsPayments(Date.now() + 10000);
  assert.equal(result.checked, 2); assert.equal(result.failed, 1);
  assert.deepEqual(fulfilled, [['test', 'success']]);
  assert.deepEqual(checks, ['success', 'abandoned', 'unavailable']);
});

function maintenance(query, verifyOrder = async () => {}) {
  const compiled = { exports: {} };
  const mocks = {
    'node:crypto': { timingSafeEqual: () => false },
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, ...options }) } },
    '@/lib/auth': { requireAdmin: () => null },
    '@/lib/db': { query },
    '@/lib/payments/server': { verifyOrder, payments: { transact: async work => work({ query: async () => ({ rows: [] }) }) }, privateHeaders: {} },
    '@/lib/payments/notifications': { deliverPaymentNotifications: async () => {} },
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/payments/maintenance/route.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module: compiled, exports: compiled.exports, require: name => mocks[name], process: { env: {} }, Buffer, Date, console: { info() {}, error() {} } });
  return compiled.exports.GET({ headers: new Headers() });
}

test('partial provider failure returns 503 and records an unhealthy completion for the independent monitor', async () => {
  let heartbeat;
  const result = await maintenance(async (sql, params) => {
    if (sql.includes('operations_runs')) heartbeat = params;
    return { rows: sql.includes("('pending','failed')") ? [{ reference: 'fixture' }] : [] };
  }, async () => { throw Error('Provider unavailable'); });
  assert.equal(result.status, 503);
  assert.equal(result.body.failed, 1);
  assert.equal(heartbeat[0], 1);
});

test('database failure cannot produce a fresh successful maintenance heartbeat', async () => {
  let heartbeat = false;
  const result = await maintenance(async sql => {
    if (sql.includes('operations_runs')) heartbeat = true;
    throw Error('Database unavailable');
  });
  assert.equal(result.status, 503);
  assert.equal(heartbeat, false);
});
