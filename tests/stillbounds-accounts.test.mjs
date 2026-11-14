import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { getMigrations } from 'better-auth/db/migration';
import { createStillboundsAuth } from '../lib/stillboundsAuth.ts';

test('verified website accounts approve only their claimed desktop and can revoke its session', async () => {
  const db = new DatabaseSync(':memory:');
  const sent = [];
  const origin = 'http://localhost:3099';
  const auth = createStillboundsAuth({ origin, key: 'isolated-test-secret-with-at-least-32-characters', database: db, email: async (to, subject, link) => { sent.push({ to, subject, link }); } });
  const migration = await getMigrations(auth.options);
  assert(migration.toBeCreated.every(t => t.table.startsWith('stillbounds_auth_')));
  await migration.runMigrations();
  let clientIp = '192.0.2.1';
  const call = async (path, body, cookie, token) => {
    const response = await auth.handler(new Request(origin + '/api/stillbounds/auth' + path, {
      method: body ? 'POST' : 'GET', headers: { Origin: origin, 'x-forwarded-for': clientIp, ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined,
    }));
    const text = await response.text(); let data; try { data = JSON.parse(text); } catch { data = text; }
    return { status: response.status, data, cookie: response.headers.getSetCookie().map(v => v.split(';')[0]).join('; ') };
  };
  async function signup(email) {
    clientIp = email.startsWith('alice') ? '192.0.2.1' : '192.0.2.2';
    const result = await call('/sign-up/email', { name: email.split('@')[0], email, password: 'A safe testing password 763!', callbackURL: origin + '/mofolio/account' });
    assert.equal(result.status, 200, JSON.stringify(result.data));
    assert.equal((await call('/sign-in/email', {email, password: 'A safe testing password 763!'})).status, 403);
    const link = new URL(sent.find(v => v.to === email).link);
    const verified = await call(link.pathname.replace('/api/stillbounds/auth', '') + link.search);
    assert.equal(verified.status, 302);
    const signed = await call('/sign-in/email', {email, password: 'A safe testing password 763!'});
    assert.equal(signed.status, 200); return signed.cookie;
  }
  try {
    const alice = await signup('alice@example.test'), bob = await signup('bob@example.test');
    const initial = await call('/device/code', {client_id: 'stillbounds-desktop'});
    assert.equal(initial.status, 200, JSON.stringify(initial.data));
    const {device_code, user_code} = initial.data;
    const tokenBody = {client_id:'stillbounds-desktop', device_code, grant_type:'urn:ietf:params:oauth:grant-type:device_code'};
    const pending = await call('/device/token', tokenBody);
    assert.equal(pending.data.error, 'authorization_pending');
    assert.equal((await call('/device/approve', {userCode:user_code})).status, 401);
    assert.equal((await call('/device?user_code=' + user_code, undefined, alice)).status, 200);
    assert.notEqual((await call('/device/approve', {userCode: user_code}, bob)).status, 200);
    assert.equal((await call('/device/approve', {userCode: user_code}, alice)).status, 200);
    await new Promise(resolve => setTimeout(resolve, 5100));
    const approved = await call('/device/token', tokenBody);
    assert.equal(approved.status, 200, JSON.stringify(approved.data));
    const token = approved.data.access_token;
    const session = await call('/get-session', undefined, undefined, token);
    assert.equal(session.data.user.email, 'alice@example.test');
    assert.notEqual((await call('/device/token', tokenBody)).status, 200);
    assert.equal((await call('/sign-out', {}, undefined, token)).status, 200);
    assert.equal((await call('/get-session', undefined, undefined, token)).data, null);
    assert.notEqual((await call('/device/code', {client_id:'unknown-client'})).status, 200);
    const denied = await call('/device/code', {client_id:'stillbounds-desktop'});
    assert.equal((await call('/device?user_code=' + denied.data.user_code, undefined, alice)).status, 200);
    assert.equal((await call('/device/deny', {userCode:denied.data.user_code}, alice)).status, 200);
    assert.equal((await call('/device/token', {...tokenBody, device_code:denied.data.device_code})).data.error, 'access_denied');
    const csrf = await auth.handler(new Request(origin+'/api/stillbounds/auth/sign-out', {method:'POST',headers:{Origin:'https://attacker.example',Cookie:alice,'Content-Type':'application/json'},body:'{}'}));
    assert.equal(csrf.status, 403);
  } finally { db.close(); }
});
