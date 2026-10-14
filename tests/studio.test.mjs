import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
function load(file, mocks = {}) {
  const m = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  vm.runInNewContext(source, {
    module: m,
    exports: m.exports,
    require: (n) => (n in mocks ? mocks[n] : require(n)),
    process: { env: { ADMIN_SESSION_SECRET: "test-only-signing-key" } },
    Buffer,
    Date,
    URL,
    Request,
    Uint8Array,
    Set,
    Number,
    JSON,
  });
  return m.exports;
}
const protocol = load("lib/studio/protocol.ts");
const bookId = "00000000-0000-4000-8000-000000000001",
  spreadId = "00000000-0000-4000-8000-000000000002";
const draft = {
  bookId,
  title: "Client book",
  spreadIds: [spreadId],
  watermark: true,
  retentionDays: 7,
};
test("studio rejects invalid, duplicate and excessive spreads and retention", () => {
  assert.equal(protocol.draftInput(draft).bookId, bookId);
  for (const input of [
    null,
    { ...draft, spreadIds: [] },
    { ...draft, spreadIds: [spreadId, spreadId] },
    { ...draft, spreadIds: Array(102).fill(spreadId) },
    { ...draft, retentionDays: 31 },
    { ...draft, watermark: "true" },
    { ...draft, bookId: "path/../" },
  ])
    assert.throws(() => protocol.draftInput(input));
});
test("review codes are random, authenticated encryption hides them and rejects tampering", () => {
  const a = protocol.secret(),
    b = protocol.secret();
  assert.notEqual(a, b);
  assert.equal(a.length, 43);
  const encrypted = protocol.encryptCode(a);
  assert.ok(!encrypted.includes(a));
  assert.equal(protocol.decryptCode(encrypted), a);
  const corrupted = Buffer.from(encrypted, "base64url");
  corrupted[35] ^= 1;
  assert.throws(() => protocol.decryptCode(corrupted.toString("base64url")));
});
test("bounded streaming bodies reject oversized uploads without trusting Content-Length", async () => {
  await assert.rejects(
    protocol.boundedBody(
      new Request("https://site.example", { method: "POST", body: "abcdef" }),
      3,
    ),
    (e) => e.status === 413,
  );
  assert.equal(
    (
      await protocol.boundedBody(
        new Request("https://site.example", { method: "POST", body: "abc" }),
        3,
      )
    ).toString(),
    "abc",
  );
  for (const value of ["null", "[]", '"text"', "{broken"])
    await assert.rejects(
      protocol.bodyJSON(
        new Request("https://site.example", { method: "POST", body: value }),
      ),
      (e) => e.status === 400,
    );
});
function security(
  query = async () => {
    throw Error("Must not query database");
  },
  isAdmin = false,
) {
  return load("lib/studio/security.ts", {
    "./db": { studioQuery: query },
    "./protocol": protocol,
    "@/lib/auth": { requireAdmin: () => (isAdmin ? null : { status: 401 }) },
  });
}
test("owner mutations require an authenticated admin and same-origin browser request", () => {
  assert.throws(
    () => security().admin(new Request("https://site.example"), true),
    (e) => e.status === 401,
  );
  assert.throws(
    () =>
      security(undefined, true).admin(
        new Request("https://site.example", {
          headers: { origin: "https://attacker.example" },
        }),
        true,
      ),
    (e) => e.status === 403,
  );
  assert.doesNotThrow(() =>
    security(undefined, true).admin(
      new Request("https://site.example", {
        headers: {
          origin: "https://site.example",
          "sec-fetch-site": "same-origin",
        },
      }),
      true,
    ),
  );
});
test("desktop bearer tokens are separate from admin cookies and scoped to Moyo and live devices", async () => {
  await assert.rejects(
    security().device(
      new Request("https://site.example", {
        headers: { authorization: "Bearer test-key" },
      }),
    ),
    (e) => e.status === 401,
  );
  let seen;
  const secure = security(async (sql, args) => {
    seen = { sql, args };
    return { rows: [{ id: bookId }] };
  });
  const token = protocol.secret();
  assert.equal(
    await secure.device(
      new Request("https://site.example", {
        headers: { authorization: "Bearer " + token },
      }),
    ),
    bookId,
  );
  assert.equal(seen.args[0], protocol.hash(token));
  assert.equal(seen.args[1], "moyo");
  assert.ok(
    seen.sql.includes("revoked=FALSE") && seen.sql.includes("expires_at>NOW()"),
  );
  assert.ok(!seen.sql.includes(token));
  await assert.rejects(
    security(async () => ({ rows: [] })).device(
      new Request("https://site.example", {
        headers: { authorization: "Bearer " + token },
      }),
    ),
    (e) => e.status === 401,
  );
});
test("viewer sessions are version-specific and recheck published state, expiry and token hash", async () => {
  const token = protocol.secret();
  let seen;
  const request = {
    cookies: {
      get: (name) =>
        name === "sb-review-" + bookId ? { value: token } : undefined,
    },
  };
  const secure = security(async (sql, args) => {
    seen = { sql, args };
    return { rows: [{ id: bookId }] };
  });
  assert.equal((await secure.viewer(request, bookId)).id, bookId);
  assert.equal(seen.args[0], bookId);
  assert.equal(seen.args[1], protocol.hash(token));
  assert.ok(
    seen.sql.includes("v.state='published'") &&
      seen.sql.includes("v.expires_at>NOW()"),
  );
  await assert.rejects(
    secure.viewer(request, spreadId),
    (e) => e.status === 401,
  );
});

test("studio uses the browser-facing Host rather than an internal standalone URL", () => {
  const secure = security(undefined, true);
  const req = new Request("http://localhost:3218/api/test", {
    headers: { Host: "127.0.0.1:3218", Origin: "http://127.0.0.1:3218" },
  });
  assert.equal(secure.studioOrigin(req), "http://127.0.0.1:3218");
  assert.doesNotThrow(() => secure.sameOrigin(req));
  assert.equal(
    secure.studioOrigin(
      new Request("http://localhost/api/test", {
        headers: { Host: "moyo-roan.vercel.app", "x-forwarded-proto": "https" },
      }),
    ),
    "https://moyo-roan.vercel.app",
  );
});
