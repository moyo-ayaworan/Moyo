import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';

const requireDependency = createRequire(import.meta.url);

function load(file, mocks = {}, globals = {}) {
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const compiledModule = { exports: {} };
  vm.runInNewContext(source, {
    module: compiledModule, exports: compiledModule.exports,
    require: (name) => name in mocks ? mocks[name] : requireDependency(name),
    process: { cwd: () => process.cwd(), env: { DATABASE_URL: 'postgres://localhost/test', ADMIN_KEY: 'test-key', SMTP_USER: 'test@example.test', SMTP_PASS: 'test' } },
    console: { error() {} }, URL, Date, Buffer, AbortSignal, ...globals,
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

const knowledge = load('lib/eniyanKnowledge.ts');
test('Eniyan rejects malformed messages and prioritizes client gallery access', async () => {
  const route = load('app/api/eniyan/route.ts', { 'next/server': next, '@/lib/eniyanKnowledge': knowledge });
  for (const body of [null, { messages: [null, 7, {}] }, { messages: [{ role: 'assistant', content: 'hello' }] }]) {
    assert.equal((await route.POST(request(body))).status, 400);
  }
  const result = await route.POST(request({ messages: [{ role: 'user', content: 'download my portrait gallery' }] }));
  assert.equal(result.body.mode, 'guided');
  assert.ok(result.body.reply.includes('/photography/client-gallery'));
});

test('Eniyan falls back after a provider failure and excludes private page text', async () => {
  let payload;
  const route = load('app/api/eniyan/route.ts', { 'next/server': next, '@/lib/eniyanKnowledge': knowledge }, {
    process: { env: { GEMINI_API_KEY: 'test' } },
    fetch: async (_url, options) => { payload = JSON.parse(options.body); throw Error('timeout'); },
  });
  const result = await route.POST(request({ messages: [{ role: 'user', content: 'gallery' }], page: { path: '/photography/client-gallery', visibleText: 'PRIVATE CLIENT CONTENT' } }));
  assert.equal(result.body.mode, 'guided');
  assert.ok(!JSON.stringify(payload).includes('PRIVATE CLIENT CONTENT'));
});

const invoiceBody = { galleryId: 1, documentType: 'invoice', clientEmail: 'client@example.test', currency: 'NGN', items: [{ description: 'Portrait session', quantity: 1, unitPrice: 100 }] };
function documentRoute(query, sendMail = async () => ({ accepted: ['client@example.test'], messageId: 'test-id' })) {
  return load('app/api/galleries/documents/route.ts', {
    path: { default: requireDependency('node:path') },
    'next/server': next, '@/lib/auth': { requireAdmin: () => null }, '@/lib/db': { query },
    nodemailer: { default: { createTransport: () => ({ sendMail }) } },
  });
}
test('invoices reject incomplete items, invalid discounts and excessive taxes before saving', async () => {
  const route = documentRoute(async () => { throw Error('must not query'); });
  for (const override of [
    { items: [...invoiceBody.items, { description: '', quantity: 1, unitPrice: 100 }] },
    { items: [{ description: 'Bad price', quantity: 1, unitPrice: -1 }] },
    { discountType: 'percent', discountValue: 101 }, { taxRate: 101 },
    { items: Array.from({ length: 21 }, () => invoiceBody.items[0]) },
  ]) assert.equal((await route.POST(request({ ...invoiceBody, ...override }))).status, 400);
});

test('invoice totals round line amounts, discounts and taxes consistently', async () => {
  let stored;
  const route = documentRoute(async (sql, params) => {
    if (sql.startsWith('SELECT')) return { rows: [{ client_name: 'Client' }] };
    stored = params;
    return { rows: [{ id: 1 }] };
  });
  const result = await route.POST(request({ ...invoiceBody, items: [{ description: 'Service', quantity: 3, unitPrice: 0.1 }], taxRate: 7.5 }));
  assert.equal(result.status, 200);
  assert.equal(stored[4], 0.32);
});

const savedInvoice = {
  id: 1, gallery_id: 1, document_type: 'invoice', title: 'Portrait collection', client_name: 'Client',
  client_email: 'client@example.test', currency: 'NGN', amount: 2000, created_at: '2026-09-12',
  line_items: JSON.stringify({ kind: 'calculated-invoice', items: Array.from({ length: 20 }, (_, index) => ({ description: `Service number ${index + 1}`, quantity: 1, unitPrice: 100 })) }),
  terms: 'Long terms with full delivery details. '.repeat(60) + 'FINAL TERMS MUST REMAIN',
};
test('invoice email includes every item and full terms in a paginated PDF', async () => {
  let email;
  let markedSent = false;
  const route = documentRoute(async (sql) => {
    if (sql.includes('UPDATE')) markedSent = true;
    return { rows: [savedInvoice] };
  }, async (message) => { email = message; return { accepted: ['client@example.test'], messageId: 'test-id' }; });
  const result = await route.PUT(request({ id: 1, action: 'send' }));
  assert.equal(result.status, 200);
  assert.equal(markedSent, true);
  assert.equal(email.to, savedInvoice.client_email);
  assert.ok(email.html.includes('Service number 20'));
  const pdf = email.attachments.find((item) => item.contentType === 'application/pdf').content.toString();
  assert.ok(pdf.startsWith('%PDF-1.4'));
  assert.ok(pdf.includes('Service number 20'));
  assert.ok(pdf.includes('FINAL TERMS MUST REMAIN'));
  assert.ok(Number(pdf.match(/\/Count (\d+)/)[1]) > 1);
});

test('rejected email recipients never mark an invoice as sent', async () => {
  let markedSent = false;
  const route = documentRoute(async (sql) => { if (sql.includes('UPDATE')) markedSent = true; return { rows: [savedInvoice] }; }, async () => ({ accepted: [], rejected: ['client@example.test'] }));
  assert.equal((await route.PUT(request({ id: 1, action: 'send' }))).status, 502);
  assert.equal(markedSent, false);
});

test('gallery access hides finished files until payment is verified', async () => {
  const route = load('app/api/galleries/access/route.ts', {
    'next/server': next, '@/lib/db': { query: async () => ({ rows: [{ id: 1, images: ['proof.jpg'], finished_images: ['original.jpg'], payment_verified: false }] }) },
  });
  const result = await route.POST(request({ accessCode: 'test' }));
  assert.equal(result.body.gallery.finished_count, 1);
  assert.equal(result.body.gallery.finished_images.length, 0);
});


const uploadIdentity = load('lib/uploadIdentity.ts');
test('upload identity follows content rather than a renamed filename', () => {
  const hash = 'a'.repeat(64);
  assert.equal(uploadIdentity.uploadPublicId(hash, 'first.jpg', 'image/jpeg'), uploadIdentity.uploadPublicId(hash, 'renamed.jpg', 'image/jpeg'));
  assert.notEqual(uploadIdentity.uploadPublicId(hash, 'first.jpg', 'image/jpeg'), uploadIdentity.uploadPublicId('b'.repeat(64), 'first.jpg', 'image/jpeg'));
  assert.ok(uploadIdentity.uploadPublicId(hash, 'product.zip', 'application/zip').endsWith('.zip'));
  assert.throws(() => uploadIdentity.uploadPublicId('../bad', 'file.jpg', 'image/jpeg'));
});

test('upload progress reports bytes transferred and preserves provider errors without fallback', async () => {
  const percentages = [];
  const requests = [];
  let responseStatus = 200;
  class XHR {
    upload = {};
    open(_method, url) { this.url = url; }
    setRequestHeader() {}
    send() {
      requests.push(this.url);
      this.upload.onprogress({ lengthComputable: true, loaded: 25, total: 100 });
      this.upload.onprogress({ lengthComputable: true, loaded: 75, total: 100 });
      this.status = responseStatus;
      this.responseText = JSON.stringify(responseStatus === 200 ? { secure_url: 'https://example.test/file.jpg' } : { error: { message: 'File exceeds account limit' } });
      this.onload();
    }
  }
  const upload = load('lib/adminUpload.ts', { '@/lib/uploadIdentity': uploadIdentity }, {
    XMLHttpRequest: XHR, FormData,
    fetch: async (_url, options) => {
      const body = JSON.parse(options.body);
      return { ok: true, json: async () => ({ directUpload: true, cloudName: 'test', apiKey: 'key', signature: 'signed', folder: 'moyo-admin', timestamp: 1, overwrite: false, public_id: uploadIdentity.uploadPublicId(body.hash, body.filename, body.mimeType) }) };
    },
  });
  const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' });
  assert.equal(await upload.uploadAdminFile(file, 'test', 'a'.repeat(64), (percent) => percentages.push(percent)), 'https://example.test/file.jpg');
  assert.deepEqual(percentages, [25, 75]);
  responseStatus = 400;
  await assert.rejects(upload.uploadAdminFile(file, 'test', 'a'.repeat(64), () => {}), /File exceeds account limit/);
  assert.equal(requests.length, 2);
  assert.ok(requests.every((url) => url.startsWith('https://api.cloudinary.com/')));
});

test('server retries of identical file bytes reuse one Cloudinary asset', async () => {
  const assets = new Map();
  const optionsSeen = [];
  const route = load('app/api/upload/route.ts', {
    'next/server': next, '@/lib/auth': { requireAdmin: () => null }, '@/lib/uploadIdentity': uploadIdentity,
    path: { default: requireDependency('node:path') },
    cloudinary: { v2: { config() {}, uploader: { upload_stream(options, callback) {
      optionsSeen.push(options);
      return { on() {}, destroy() {}, end() {
        const url = assets.get(options.public_id) || `https://example.test/${options.public_id}.jpg`;
        assets.set(options.public_id, url);
        callback(null, { secure_url: url });
      } };
    } } } },
  }, { process: { env: { CLOUDINARY_CLOUD_NAME: 'test', CLOUDINARY_API_KEY: 'key', CLOUDINARY_API_SECRET: 'secret' } }, File, setTimeout, clearTimeout, console: { log() {}, error() {}, warn() {} } });
  const send = async (name) => {
    const form = new FormData(); form.append('file', new File(['same image bytes'], name, { type: 'image/jpeg' }));
    return route.POST({ headers: new Headers(), formData: async () => form });
  };
  const [first, retry] = await Promise.all([send('first.jpg'), send('renamed.jpg')]);
  assert.equal(first.body.url, retry.body.url);
  assert.equal(assets.size, 1);
  assert.ok(optionsSeen.every((options) => options.overwrite === false));
});

test('upload signature rejects invalid identities and signs a non-overwriting public id', async () => {
  let signed;
  const route = load('app/api/upload/signature/route.ts', {
    'next/server': next, '@/lib/auth': { requireAdmin: () => null }, '@/lib/uploadIdentity': uploadIdentity,
    cloudinary: { v2: { utils: { api_sign_request: (params) => { signed = params; return 'signed'; } } } },
  }, { process: { env: { CLOUDINARY_CLOUD_NAME: 'test', CLOUDINARY_API_KEY: 'key', CLOUDINARY_API_SECRET: 'secret' } } });
  assert.equal((await route.POST(request({ hash: 'invalid' }))).status, 400);
  assert.equal((await route.POST(request({ hash: 'a'.repeat(64), filename: 'photo.jpg', mimeType: 'image/jpeg' }))).status, 200);
  assert.equal(signed.overwrite, false);
  assert.equal(signed.public_id, `asset-${'a'.repeat(64)}`);
});

test('repeated artwork and product creation requests carry stable database deduplication keys', async () => {
  for (const [file, body] of [
    ['app/api/artworks/route.ts', { title: 'Portrait', category: 'Portraits', image: 'https://example.test/asset.jpg', price: 100 }],
    ['app/api/digital-products/route.ts', { title: 'Print', image: 'https://example.test/asset.jpg', price: '100', productUrl: 'https://example.test/print.zip' }],
  ]) {
    const keys = [];
    const route = load(file, {
      'next/server': next, '@/lib/auth': { requireAdmin: () => null },
      '@/lib/db': { query: async (sql, values) => {
        assert.ok(sql.includes('ON CONFLICT (creation_key)'));
        keys.push(values.at(-1));
        return { rows: [{ id: 1 }] };
      } },
    });
    assert.equal((await route.POST(request(body))).status, 200);
    assert.equal((await route.POST(request(body))).status, 200);
    assert.match(keys[0], /^[a-f0-9]{64}$/);
    assert.equal(keys[0], keys[1]);
  }
});
