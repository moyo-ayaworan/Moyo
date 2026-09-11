import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';

const requireDependency = createRequire(import.meta.url);

function load(file, mocks = {}) {
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const compiledModule = { exports: {} };
  vm.runInNewContext(source, {
    module: compiledModule, exports: compiledModule.exports,
    require: (name) => name in mocks ? mocks[name] : requireDependency(name),
    process: { env: { DATABASE_URL: 'postgres://localhost/test', ADMIN_KEY: 'test-key', SMTP_USER: 'test@example.test', SMTP_PASS: 'test' } },
    console: { error() {} }, URL, Date,
  });
  return compiledModule.exports;
}

const next = { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) } };
const dates = load('lib/bookingDates.ts');
const request = (body) => ({ json: async () => body, nextUrl: new URL('https://example.test/api/bookings') });

test('booking dates reject rollover dates and preserve Lagos studio time', () => {
  assert.equal(dates.isCalendarDate('2026-02-30'), false);
  assert.equal(dates.isCalendarDate('2025-02-29'), false);
  assert.equal(dates.isCalendarDate('2024-02-29'), true);
  assert.equal(dates.parseBookingDate('2026-09-12', '10:00'), null);
  assert.equal(dates.parseBookingDate('2026-09-12', '09:00').toISOString(), '2026-09-12T08:00:00.000Z');
});

test('saved bookings succeed even when confirmation delivery fails', async () => {
  let insertParams;
  const routes = load('app/api/bookings/route.ts', {
    'next/server': next,
    '@/lib/bookingDates': dates,
    '@/lib/auth': { requireAdmin: () => null },
    '@/lib/db': { query: async (_sql, params) => { insertParams = params; return { rows: [{ id: 1 }] }; } },
    nodemailer: { default: { createTransport: () => { throw Error('mail unavailable'); } } },
    crypto: { default: { randomBytes: () => ({ toString: () => 'test-token' }) } },
  });
  const response = await routes.POST(request({ name: 'Client', email: 'client@example.test', service: 'portrait', bookingDate: '2099-09-12', bookingTime: '09:00', internalNotes: 'injected', clientNotes: 'injected' }));
  assert.equal(response.status, 201);
  assert.equal(response.body.emailSent, false);
  assert.equal(insertParams[10], '');
  assert.equal(insertParams[11], '');
  assert.equal((await routes.POST(request(null))).status, 400);
});

test('invalid availability dates are rejected before querying the database', async () => {
  const routes = load('app/api/bookings/route.ts', {
    'next/server': next, '@/lib/bookingDates': dates,
    '@/lib/auth': { requireAdmin: () => null },
    '@/lib/db': { query: async () => { throw Error('must not query'); } },
  });
  for (const range of ['start=2026-02-30&end=2026-03-01', 'start=2026-04-01&end=2026-03-01']) {
    assert.equal((await routes.GET({ nextUrl: new URL(`https://example.test/?${range}`) })).status, 400);
  }
});

test('orders cannot be read without admin authentication', async () => {
  const routes = load('app/api/orders/route.ts', {
    'next/server': next,
    '@/lib/auth': { requireAdmin: () => ({ status: 401 }) },
    '@/lib/db': { query: () => { throw Error('must not query'); } },
  });
  assert.equal((await routes.GET({})).status, 401);
});

test('database initialization is shared and retries after failure', async () => {
  let calls = 0;
  let release;
  const first = new Promise((resolve) => { release = resolve; });
  const db = load('lib/db.ts', { pg: { Pool: class {
    async query(sql) {
      calls++;
      if (calls === 1) { await first; throw Error('temporary failure'); }
      return { rows: [], sql };
    }
  } } });
  const a = db.query('SELECT 1');
  const b = db.query('SELECT 2');
  assert.equal(calls, 1);
  const results = Promise.allSettled([a, b]);
  release();
  assert.ok((await results).every((result) => result.status === 'rejected'));
  assert.equal((await db.query('SELECT 3')).sql, 'SELECT 3');
});
