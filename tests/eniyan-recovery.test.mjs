import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';
const dependency = createRequire(import.meta.url);
function load(mocks, env = { SMTP_USER: 'sender@example.test', SMTP_PASS: 'test' }) {
  const compiled = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/bookingRecovery.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    module: compiled, exports: compiled.exports, require: name => name in mocks ? mocks[name] : dependency(name), process: { env }, Date, URL, console: { error() {} },
  });
  return compiled.exports;
}
function harness({ failMail = false, found = true, admit = true } = {}) {
  const state = { claimed: false, sent: false, discarded: false, attempts: 0, admitted: false, lease: '', mail: [], admissionCalls: 0, sql: [], failMail, found };
  const job = () => ({ id: 'durable-job', booking_reference: 92, email: 'visitor@example.test', admitted_at: state.admitted ? 'time' : null });
  async function query(sql, values) {
    state.sql.push(sql);
    if (sql.startsWith('DELETE')) return { rows: [] };
    if (sql.startsWith('SELECT id,booking_reference')) {
      assert.match(sql, /FOR UPDATE SKIP LOCKED/); assert.match(sql, /POWER/);
      return { rows: !state.claimed && !state.sent && !state.discarded ? [job()] : [] };
    }
    if (sql.startsWith('SELECT id,email')) return { rows: state.found ? [{ id: 92, email: 'visitor@example.test', manage_token: 'private-token' }] : [] };
    if (sql.startsWith('WITH budget')) {
      state.admissionCalls++; assert.match(sql, /UPDATE booking_recovery_outbox SET admitted_at/);
      state.admitted = admit; return { rows: admit ? [{ id: 'durable-job' }] : [] };
    }
    if (sql.includes('SET claimed_at')) { state.claimed = true; state.lease = values[1]; state.attempts++; }
    if (sql.includes('SET sent_at') && values[1] === state.lease) state.sent = true;
    if (sql.includes('SET discarded=TRUE') && values[1] === state.lease) state.discarded = true;
    return { rows: [] };
  }
  let transactionTail = Promise.resolve();
  const worker = load({
    './db': { query, transaction: work => {
      const result = transactionTail.then(() => work({ query })); transactionTail = result.catch(() => {}); return result;
    } },
    './bookingOrigin': { bookingOrigin: () => 'https://studio.example.test' },
    nodemailer: { default: { createTransport: () => ({ sendMail: async value => {
      state.mail.push(value); if (state.failMail) throw Error('SMTP unavailable'); return { accepted: ['visitor@example.test'], rejected: [] };
    } }) } },
  });
  return { worker, state };
}
test('recovery SMTP failure retains a durable admitted job and retry does not spend recipient quota again', async () => {
  const { worker, state } = harness({ failMail: true });
  const failed = await worker.deliverBookingRecovery();
  assert.equal(failed.deferred, 1);
  assert.equal(state.sent, false); assert.equal(state.admitted, true); assert.equal(state.attempts, 1);
  state.claimed = false; state.failMail = false; // Next eligible maintenance pass after backoff.
  await worker.deliverBookingRecovery();
  assert.equal(state.sent, true); assert.equal(state.admissionCalls, 1); assert.equal(state.mail.length, 2);
  assert.equal(state.mail[0].messageId, state.mail[1].messageId);
  assert.match(state.mail[1].text, /https:\/\/studio.example.test\/client\/booking\/private-token/);
  assert.equal(state.mail[1].to.address, 'visitor@example.test');
});
test('parallel recovery workers cannot send the same leased job concurrently', async () => {
  const { worker, state } = harness();
  await Promise.all([worker.deliverBookingRecovery(), worker.deliverBookingRecovery()]);
  assert.equal(state.sent, true); assert.equal(state.mail.length, 1); assert.equal(state.attempts, 1);
});
test('unmatched or recipient-limited recovery jobs never send email', async () => {
  for (const options of [{ found: false }, { admit: false }]) {
    const { worker, state } = harness(options); await worker.deliverBookingRecovery();
    assert.equal(state.discarded, true); assert.equal(state.mail.length, 0);
    if (options.found === false) assert.equal(state.admissionCalls, 0);
  }
});
test('missing SMTP configuration leaves unsent jobs in the queue and still prunes expired operational data', async () => {
  const sql = [];
  const worker = load({ './bookingOrigin': {}, './db': { query: async value => { sql.push(value); return { rows: [] }; }, transaction: () => assert.fail('must not claim without SMTP') }, nodemailer: {} }, {});
  await worker.deliverBookingRecovery();
  assert.equal(sql.length, 2); assert.match(sql[0], /^DELETE FROM booking_recovery_outbox/);
  assert.match(sql[1], /COUNT/);
});
test('recovery enqueue is idempotent within an hourly bucket and never persists a portal token', async () => {
  const calls = [];
  const worker = load({ './bookingOrigin': {}, './db': { query: async (...args) => { calls.push(args); } }, nodemailer: {} }, {});
  await worker.enqueueBookingRecovery(92, 'visitor@example.test'); await worker.enqueueBookingRecovery(92, 'visitor@example.test');
  assert.equal(calls[0][1][0], calls[1][1][0]); assert.match(calls[0][0], /ON CONFLICT\(id\) DO NOTHING/);
  assert.doesNotMatch(calls[0][0], /manage_token/);
});
