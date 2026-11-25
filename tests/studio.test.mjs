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
    Response,
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
test("owner mutations require an authenticated admin and same-origin browser request", async () => {
  await assert.rejects(
    () => security().admin(new Request("https://site.example"), true),
    (e) => e.status === 401,
  );
  await assert.rejects(
    () =>
      security(undefined, true).admin(
        new Request("https://site.example", {
          headers: { origin: "https://attacker.example" },
        }),
        true,
      ),
    (e) => e.status === 403,
  );
  await assert.doesNotReject(() =>
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
test("desktop bearer tokens are separate from admin cookies and scoped to their owning workspace and live devices", async () => {
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
    return {
      rows: [
        {
          id: bookId,
          owner_id: "moyo",
          state: "published",
          expires_at: new Date(Date.now() + 60000),
        },
      ],
    };
  });
  const token = protocol.secret();
  const identity = await secure.device(
    new Request("https://site.example", {
      headers: { authorization: "Bearer " + token },
    }),
  );
  assert.equal(identity.id, bookId);
  assert.equal(identity.ownerId, "moyo");
  assert.equal(seen.args[0], protocol.hash(token));
  assert.equal(seen.args.length, 1);
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
    return {
      rows: [
        {
          id: bookId,
          owner_id: "moyo",
          state: "published",
          expires_at: new Date(Date.now() + 60000),
        },
      ],
    };
  });
  assert.equal((await secure.viewer(request, bookId)).id, bookId);
  assert.equal(seen.args[0], bookId);
  assert.equal(seen.args[1], protocol.hash(token));
  assert.ok(seen.sql.includes("s.expires_at>NOW()"));
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

test("pins preserve normalized positions and reject malformed coordinates", () => {
  assert.equal(protocol.commentPin(undefined), null);
  assert.equal(protocol.commentPin(null), null);
  for (const pin of [
    { x: 0, y: 1 },
    { x: 0.25, y: 0.75 },
  ])
    assert.equal(JSON.stringify(protocol.commentPin(pin)), JSON.stringify(pin));
  for (const pin of [
    [],
    "point",
    {},
    { x: -0.1, y: 0 },
    { x: 1.01, y: 0 },
    { x: 0, y: NaN },
    { x: Infinity, y: 1 },
    { x: "0", y: 1 },
  ])
    assert.throws(
      () => protocol.commentPin(pin),
      (error) => error.status === 400,
    );
});

test("known viewer sessions distinguish withdrawn and expired versions without exposing unauthenticated reviews", async () => {
  const request = { cookies: { get: () => ({ value: protocol.secret() }) } };
  for (const [state, expires_at, message] of [
    ["revoked", new Date(Date.now() + 60000), /withdrawn/],
    ["published", new Date(Date.now() - 60000), /expired/],
  ]) {
    await assert.rejects(
      security(async () => ({ rows: [{ state, expires_at }] })).viewer(
        request,
        bookId,
      ),
      (error) => error.status === 410 && message.test(error.message),
    );
  }
  await assert.rejects(
    security(async () => ({ rows: [] })).viewer(request, bookId),
    (error) => error.status === 401,
  );
});

function service(query, version = {}) {
  return load("lib/studio/service.ts", {
    "./db": {
      studioQuery: query,
      studioTransaction: async (fn) => fn({ query }),
    },
    "./protocol": protocol,
    "./security": {
      studioOrigin: () => "https://site.example",
      privateHeaders: { "Cache-Control": "private, no-store" },
      viewer: async () => ({
        id: bookId,
        book_id: spreadId,
        owner_id: "account:test",
        version: 3,
        spread_ids: [spreadId],
        ...version,
      }),
      sameOrigin: () => {},
      limited: async () => {},
    },
  });
}

test("history media rejects versions outside the authorized book history and rechecks live state", async () => {
  const target = "00000000-0000-4000-8000-000000000003";
  let queries = [];
  const api = service(async (sql, args) => {
    queries.push({ sql, args });
    if (sql.includes("SELECT id FROM")) return { rows: [{ id: target }] };
    return { rows: [{ jpeg: Buffer.from("preview") }] };
  });
  const response = await api.studioRequest(
    new Request("https://site.example", { method: "GET" }),
    ["reviews", bookId, "history", target, "media", "0"],
  );
  assert.equal(await response.text(), "preview");
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  for (const { sql, args } of queries) {
    assert.ok(
      sql.includes("owner_id=$") &&
        sql.includes("book_id=$") &&
        sql.includes("version<"),
    );
    assert.ok(
      sql.includes("state='published'") && sql.includes("expires_at>NOW()"),
    );
    assert.ok(args.includes("account:test"));
  }
  queries = [];
  await assert.rejects(
    api.studioRequest(new Request("https://site.example"), [
      "reviews",
      bookId,
      "history",
      spreadId,
      "media",
      "0",
    ]),
    (error) => error.status === 410,
  );
  assert.equal(queries.length, 1);
});

test("comments store a validated pin and keep legacy unpinned comments working", async () => {
  let inserted;
  const api = service(async (sql, args) => {
    if (sql.includes("INSERT INTO stillbounds_comments")) {
      inserted = args;
      return { rows: [] };
    }
    if (sql.includes("COUNT(*)")) return { rows: [{ count: 0 }] };
    return { rows: [{ id: bookId }] };
  });
  const send = (pin) =>
    api.studioRequest(
      new Request("https://site.example", {
        method: "POST",
        body: JSON.stringify({ spreadId, text: "  Adjust crop  ", pin }),
      }),
      ["reviews", bookId, "comments"],
    );
  await send({ x: 0.2, y: 0.8 });
  assert.equal(inserted[3], "Adjust crop");
  assert.equal(inserted[4], '{"x":0.2,"y":0.8}');
  await send(undefined);
  assert.equal(inserted[4], null);
  await assert.rejects(send({ x: 2, y: 0 }), (error) => error.status === 400);
});
