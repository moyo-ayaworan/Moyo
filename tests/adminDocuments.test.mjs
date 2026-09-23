import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function client(fetch) {
  const compiledModule = { exports: {} };
  let keys = 0;
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/adminDocuments.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module: compiledModule, exports: compiledModule.exports, fetch, AbortController, setTimeout, clearTimeout, crypto: { randomUUID: () => `key-${++keys}` } });
  return compiledModule.exports;
}
const response = (status, data) => ({ status, ok: status >= 200 && status < 300, json: async () => data });

test('invoice workspace loads only clients and documents, not unrelated admin services', async () => {
  const urls = [];
  const api = client(async (url, options) => {
    urls.push(url); assert.equal(options.cache, 'no-store');
    if (url === '/api/galleries') return response(200, { galleries: [{ id: 1 }] });
    if (url === '/api/galleries/documents') return response(200, { documents: [{ id: 3 }] });
    throw Error('Unrelated service is offline');
  });
  const data = await api.loadInvoiceWorkspace({});
  assert.equal(data.galleries[0].id, 1); assert.equal(data.documents[0].id, 3);
  assert.equal(urls.length, 2);
});

test('failed invoice loading reports the failure instead of pretending there are no clients', async () => {
  const api = client(async () => response(401, { error: 'Unauthorized' }));
  await assert.rejects(api.loadInvoiceWorkspace({}), /session expired/);
});

test('a lost document-save response retries the exact original payload and key', async () => {
  const bodies = [];
  const api = client(async (_url, options) => {
    bodies.push(options.body);
    if (bodies.length === 1) throw Error('Connection lost after INSERT');
    return response(200, { document: { id: 42 } });
  });
  const session = api.createDocumentSaveSession();
  await assert.rejects(session.save({ title: 'Original invoice' }, {}), /Retry same document/);
  assert.equal(session.uncertain, true);
  assert.equal((await session.save({ title: 'Must not replace original' }, {})).id, 42);
  assert.equal(bodies[0], bodies[1]); assert.equal(session.uncertain, false);
  await session.save({ title: 'New invoice' }, {});
  assert.notEqual(JSON.parse(bodies[2]).creationKey, JSON.parse(bodies[0]).creationKey);
});

test('double-clicking document save sends only one request', async () => {
  let complete; let count = 0;
  const api = client(() => { count++; return new Promise(resolve => { complete = resolve; }); });
  const session = api.createDocumentSaveSession();
  const first = session.save({ title: 'Invoice' }, {});
  await assert.rejects(session.save({ title: 'Invoice' }, {}), /already being saved/);
  complete(response(200, { document: { id: 1 } })); await first;
  assert.equal(count, 1);
});

test('an expired session during an uncertain retry does not discard the original document key', async () => {
  const bodies = [];
  const api = client(async (_url, options) => {
    bodies.push(options.body);
    if (bodies.length === 1) throw Error('Lost response');
    if (bodies.length === 2) return response(401, {});
    return response(200, { document: { id: 42 } });
  });
  const session = api.createDocumentSaveSession();
  await assert.rejects(session.save({}, {}));
  await assert.rejects(session.save({}, {}), /session expired/);
  assert.equal(session.uncertain, true);
  await session.save({}, {});
  assert.equal(new Set(bodies).size, 1);
});

test('validation failures allow corrections while failed-server and malformed replies keep safe retry state', async () => {
  for (const status of [400, 401, 409]) {
    const session = client(async () => response(status, { error: 'Correct these fields' })).createDocumentSaveSession();
    await assert.rejects(session.save({}, {}), status === 401 ? /session expired/ : /Correct these fields/);
    assert.equal(session.uncertain, false);
  }
  for (const result of [response(500, {}), response(200, {}), { ok: true, status: 200, json: async () => { throw Error('Invalid JSON'); } }]) {
    const session = client(async () => result).createDocumentSaveSession();
    await assert.rejects(session.save({}, {}), /Retry same document/);
    assert.equal(session.uncertain, true);
  }
});

test('an emailed invoice does not imply that its later receipt was emailed', () => {
  const { documentSentAt } = client();
  assert.equal(documentSentAt({ sent_at: 'invoice-date' }), 'invoice-date');
  assert.equal(documentSentAt({ paid_at: 'paid-date', sent_at: 'invoice-date' }), undefined);
  assert.equal(documentSentAt({ paid_at: 'paid-date', sent_at: 'invoice-date', receipt_sent_at: 'receipt-date' }), 'receipt-date');
});
