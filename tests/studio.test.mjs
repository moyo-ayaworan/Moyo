import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
function load(file, mocks = {}, env = {}) {
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
    process: { env: { ADMIN_SESSION_SECRET: "test-only-signing-key", ...env } },
    console: { error() {}, info() {} },
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
  const db = {
    studioQuery: query,
    studioTransaction: async (fn) => fn({ query }),
  };
  const engagement = load("lib/studio/engagement.ts", {
    "./db": db,
    "./protocol": protocol,
    "./security": { privateHeaders: { "Cache-Control": "private, no-store" } },
  });
  return load("lib/studio/service.ts", {
    "./engagement": engagement,
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

function engagement(query, transaction = async (fn) => fn({ query })) {
  return load("lib/studio/engagement.ts", {
    "./db": { studioQuery: query, studioTransaction: transaction },
    "./protocol": protocol,
    "./security": { privateHeaders: { "Cache-Control": "private, no-store" } },
  });
}

test("review email input rejects recipient lists, header injection and display names", () => {
  const api = engagement(async () => ({ rows: [] }));
  assert.equal(api.reviewEmail(" Client@Example.com "), "client@example.com");
  for (const email of [
    "a@example.com,b@example.com",
    "Name <a@example.com>",
    "a@example.com\r\nBcc:b@example.com",
    "a@localhost",
    null,
  ])
    assert.throws(
      () => api.reviewEmail(email),
      (error) => error.status === 400,
    );
});

test("failed email verification commits the global attempt budget without activating a subscription", async () => {
  const calls = [];
  let commits = 0;
  const query = async (sql, args) => {
    calls.push({ sql, args });
    if (sql.includes("code_attempts=code_attempts+1"))
      return { rows: [{ id: spreadId, code_hash: protocol.hash("654321") }] };
    return { rows: [{ id: bookId }] };
  };
  const api = engagement(query, async (fn) => {
    const value = await fn({ query });
    commits++;
    return value;
  });
  await assert.rejects(
    api.confirmReviewEmails(bookId, "viewer-hash", {
      email: "client@example.com",
      code: "123456",
    }),
    (error) => error.status === 400,
  );
  assert.equal(commits, 1);
  assert.ok(
    calls.some(
      (call) =>
        call.sql.includes("code_attempts<6") &&
        call.sql.includes("code_expires_at>NOW()"),
    ),
  );
  assert.ok(!calls.some((call) => call.sql.includes("verified_at=NOW()")));
  assert.ok(
    !calls.some((call) => call.sql.includes("UPDATE stillbounds_viewers")),
  );
});

test("email confirmation binds only the matched subscription to the current version-specific viewer", async () => {
  const calls = [];
  const api = engagement(async (sql, args) => {
    calls.push({ sql, args });
    if (sql.includes("code_attempts=code_attempts+1"))
      return { rows: [{ id: spreadId, code_hash: protocol.hash("123456") }] };
    return { rows: [{ id: bookId }] };
  });
  await api.confirmReviewEmails(bookId, "viewer-hash", {
    email: "client@example.com",
    code: "123456",
  });
  const binding = calls.find((call) =>
    call.sql.includes("UPDATE stillbounds_viewers"),
  );
  assert.equal(
    JSON.stringify(binding.args),
    JSON.stringify([bookId, "viewer-hash", spreadId]),
  );
  assert.ok(binding.sql.includes("token_hash=$2 AND version_id=$1"));
});

test("reply actors come from authorization and replies cannot cross review boundaries", async () => {
  let writes = 0;
  const wrong = engagement(async (sql) => {
    if (sql.includes("SELECT id FROM stillbounds_comments"))
      return { rows: [] };
    if (sql.includes("INSERT INTO stillbounds_replies")) writes++;
    return { rows: [{ id: bookId }] };
  });
  await assert.rejects(
    wrong.addReply(bookId, spreadId, "client", {
      text: "Hello",
      actor: "photographer",
    }),
    (error) => error.status === 404,
  );
  assert.equal(writes, 0);
  let inserted;
  const allowed = engagement(async (sql, args) => {
    if (sql.includes("COUNT(*)")) return { rows: [{ count: 0 }] };
    if (sql.includes("INSERT INTO stillbounds_replies")) inserted = args;
    return { rows: [{ id: bookId }] };
  });
  await allowed.addReply(bookId, spreadId, "client", {
    text: " Clarify crop ",
    actor: "photographer",
  });
  assert.equal(inserted[2], "client");
  assert.equal(inserted[3], "Clarify crop");
});

test("approval receipts are immutable, fingerprint previews and do not duplicate on retry", async () => {
  let decision = "pending";
  const receipts = [];
  const outbox = [];
  const api = engagement(async (sql, args) => {
    if (sql.includes("SELECT *,NOW()"))
      return {
        rows: [
          {
            id: bookId,
            decision,
            title: "Our book",
            book_id: spreadId,
            version: 2,
            spread_ids: [spreadId],
            watermark: true,
            recorded_at: new Date("2026-11-25T12:00:00Z"),
          },
        ],
      };
    if (sql.includes("SELECT index,width,height,jpeg"))
      return {
        rows: [
          {
            index: 0,
            width: 600,
            height: 800,
            jpeg: Buffer.from("fixed preview"),
          },
        ],
      };
    if (sql.includes("COUNT(*)")) return { rows: [{ count: 1 }] };
    if (sql.includes("INSERT INTO stillbounds_approval_receipts"))
      receipts.push({
        id: args[0],
        date: args[2],
        snapshot: JSON.parse(args[3]),
      });
    if (sql.includes("UPDATE stillbounds_versions SET decision"))
      decision = args[1];
    if (sql.includes("INSERT INTO stillbounds_review_outbox"))
      outbox.push(args);
    return { rows: [] };
  });
  await api.saveDecision(bookId, "approved");
  const original = JSON.stringify(receipts[0]);
  assert.equal(receipts.length, 1);
  assert.equal(outbox.length, 2);
  assert.match(receipts[0].snapshot.previewDigest, /^[a-f0-9]{64}$/);
  assert.equal(receipts[0].snapshot.unresolvedComments, 1);
  await api.saveDecision(bookId, "approved");
  assert.equal(receipts.length, 1);
  assert.equal(outbox.length, 2);
  await api.saveDecision(bookId, "changes");
  assert.equal(JSON.stringify(receipts[0]), original);
  const text = api.receiptText({
    id: receipts[0].id,
    approvedAt: receipts[0].date,
    snapshot: receipts[0].snapshot,
  });
  assert.match(text, /2026-11-25T12:00:00.000Z/);
  assert.match(text, /does not certify the identity/);
});

test("reminders are deduplicated and exclude approved, expired, withdrawn and unconfirmed reviews", async () => {
  let sql;
  await engagement(async (value) => {
    sql = value;
    return { rows: [] };
  }).queueReviewReminders();
  for (const guard of [
    "s.verified_at IS NOT NULL",
    "s.reminders=TRUE",
    "v.state='published'",
    "v.decision!='approved'",
    "24 hours",
    "15 minutes",
    "next_attempt_at",
    "2 hours",
    "ON CONFLICT(id) DO NOTHING",
  ])
    assert.ok(sql.includes(guard));
});

function mailWorker({
  jobs,
  version,
  send = async () => ({ accepted: ["recipient"], rejected: [] }),
  ownerEmail = "owner@example.com",
}) {
  const writes = [];
  const sent = [];
  let lock = Promise.resolve();
  const query = async (sql, args) => {
    writes.push({ sql, args });
    if (
      sql.includes("FROM stillbounds_review_outbox") &&
      sql.includes("FOR UPDATE SKIP LOCKED")
    ) {
      const job = jobs.find((job) => !job.claimed && !job.finished);
      return { rows: job ? [job] : [] };
    }
    if (sql.includes("SET lease=$2")) {
      jobs.find((job) => job.id === args[0]).claimed = true;
      return { rows: [] };
    }
    if (sql.includes("FROM stillbounds_versions v LEFT JOIN"))
      return { rows: version ? [version] : [] };
    if (sql.includes("FROM stillbounds_auth_user"))
      return { rows: ownerEmail ? [{ email: ownerEmail }] : [] };
    if (
      sql.includes("SET discarded=TRUE") ||
      sql.includes("SET sent_at=NOW()")
    ) {
      jobs.find((job) => job.id === args[0]).finished = true;
      return { rows: [] };
    }
    if (sql.includes("COUNT(*)"))
      return { rows: [{ count: jobs.filter((job) => !job.finished).length }] };
    return { rows: [] };
  };
  const transaction = (fn) => {
    const result = lock.then(() => fn({ query }));
    lock = result.catch(() => {});
    return result;
  };
  const api = load(
    "lib/studio/mail.ts",
    {
      "./db": { studioQuery: query, studioTransaction: transaction },
      "../newsletter/mail": {
        newsletterTransport: () => ({
          from: "studio@example.com",
          mail: {
            sendMail: async (value) => {
              sent.push(value);
              return send(value);
            },
          },
        }),
      },
      "./protocol": protocol,
      "./engagement": engagement(async () => ({ rows: [] })),
    },
    { STILLBOUNDS_AUTH_URL: "https://site.example" },
  );
  return { api, writes, sent };
}
const reviewMailVersion = () => ({
  id: bookId,
  title: "Client book",
  version: 2,
  owner_id: "account:owner",
  notify_owner: true,
  state: "published",
  decision: "pending",
  expires_at: new Date(Date.now() + 86400000),
  email: "client@example.com",
  verified_at: new Date(),
  reminders: true,
  encrypted_code: protocol.encryptCode(protocol.secret()),
  encrypted_manage: protocol.encryptCode(protocol.secret()),
});
const reviewMailJob = (kind, subscriber_id = null) => ({
  id: "job-" + kind,
  version_id: bookId,
  kind,
  subscriber_id,
  payload: {},
  attempts: 0,
});

test("queued reminders recheck approval and subscription state immediately before delivery", async () => {
  for (const change of [
    { decision: "approved" },
    { verified_at: null },
    { reminders: false },
    { expires_at: new Date(Date.now() + 1000) },
  ]) {
    const worker = mailWorker({
      jobs: [reviewMailJob("reminder", spreadId)],
      version: { ...reviewMailVersion(), ...change },
    });
    const result = await worker.api.deliverReviewMail();
    assert.equal(worker.sent.length, 0);
    assert.equal(result.deferred, 0);
    assert.ok(
      worker.writes.some((call) => call.sql.includes("SET discarded=TRUE")),
    );
  }
});

test("parallel review workers claim a queued notification only once and use the verified owner address", async () => {
  const worker = mailWorker({
    jobs: [reviewMailJob("owner_comment")],
    version: reviewMailVersion(),
  });
  await Promise.all([
    worker.api.deliverReviewMail(),
    worker.api.deliverReviewMail(),
  ]);
  assert.equal(worker.sent.length, 1);
  assert.equal(worker.sent[0].to.address, "owner@example.com");
  assert.match(worker.sent[0].text, /stillbounds\/account#reviews/);
});

test("SMTP failures retain the job with retry backoff and do not claim delivery", async () => {
  const worker = mailWorker({
    jobs: [reviewMailJob("owner_changes")],
    version: reviewMailVersion(),
    send: async () => {
      throw Error("SMTP unavailable");
    },
  });
  const result = await worker.api.deliverReviewMail({ limit: 1 });
  assert.equal(result.delivered, 0);
  assert.ok(result.deferred > 0);
  assert.ok(
    worker.writes.some((call) => call.sql.includes("next_attempt_at=NOW()")),
  );
  assert.ok(
    !worker.writes.some((call) => call.sql.includes("SET sent_at=NOW()")),
  );
});
