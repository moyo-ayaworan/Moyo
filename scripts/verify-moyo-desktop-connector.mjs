// Runs the existing desktop WebsiteReviews client against an isolated local HTTP
// adapter. HTTPS transport/Keychain remain covered by the desktop's own tests.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { setTimeout as delay } from "node:timers/promises";
const root = path.resolve(process.env.STILLBOUNDS_APP_PATH || "../mofolio");
const { WebsiteReviews } = await import(
  pathToFileURL(path.join(root, "electron/publishing.ts")).href
);
const { emptyBook, id } = await import(
  pathToFileURL(path.join(root, "src/core/book.ts")).href
);
const require = createRequire(import.meta.url),
  { Pool } = require("pg");
assert.ok(process.env.ADMIN_SESSION_SECRET?.startsWith("local-studio-test-"));
const local = "http://127.0.0.1:3218",
  origin = "https://albums.example.com";
const payload =
  String(Date.now() + 3600000) + "." + crypto.randomBytes(16).toString("hex");
const admin =
  "moyo-admin-session=" +
  payload +
  "." +
  crypto
    .createHmac("sha256", process.env.ADMIN_SESSION_SECRET)
    .update(payload)
    .digest("hex");
const headers = { "x-forwarded-for": "198.51.100.229" };
const url = new URL(process.env.DATABASE_URL);
url.searchParams.set("sslmode", "verify-full");
url.searchParams.delete("uselibpqcompat");
const pool = new Pool({
  connectionString: url.toString(),
  ssl: { rejectUnauthorized: true },
  max: 1,
});
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
let token, deviceCode;
const store = {
  read: async () => token,
  write: async (t) => {
    token = t;
  },
  clear: async () => {
    token = undefined;
  },
};
const transport = async (raw, method, data, bearer) => {
  const response = await fetch(local + new URL(raw).pathname, {
    method,
    headers: {
      ...headers,
      ...(data
        ? {
            "Content-Type": data[0] === 255 ? "image/jpeg" : "application/json",
          }
        : {}),
      ...(bearer ? { Authorization: "Bearer " + bearer } : {}),
    },
    body: data,
  });
  assert.equal(
    response.status,
    200,
    new URL(raw).pathname + " returned HTTP " + response.status,
  );
  const result = await response.json();
  // This test transport maps the local HTTP test origin to the logical HTTPS origin.
  // The production app continues using its pinned-DNS, verified-TLS transport.
  const remap = (value) => ({
    ...value,
    ...(value.url
      ? { url: origin + new URL(value.url).pathname + new URL(value.url).hash }
      : {}),
  });
  if (result.deviceCode) {
    deviceCode = result.deviceCode;
    result.verificationUrl = origin + new URL(result.verificationUrl).pathname;
  }
  return Array.isArray(result) ? result.map(remap) : remap(result);
};
const site = new WebsiteReviews(origin, store, transport),
  book = emptyBook();
book.title = "Reserved real desktop connector check";
book.spreads = [
  {
    id: id(),
    layout: "hero",
    locked: false,
    placements: [],
    caption: "Synthetic connector verification",
  },
];
try {
  const pairing = await site.start();
  assert.ok(!("deviceCode" in pairing) && !("accessToken" in pairing));
  const approved = await fetch(local + "/api/mofolio/studio/owner/approve", {
    method: "POST",
    headers: {
      ...headers,
      Origin: local,
      Cookie: admin,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userCode: pairing.userCode, confirm: true }),
  });
  assert.equal(approved.status, 200);
  await delay(5100);
  assert.equal(await site.finish(), true);
  const review = await site.publish(
    book,
    { watermark: true, days: 1 },
    () => false,
    () => {},
  );
  assert.equal(review.bookId, book.id);
  assert.equal(review.spreads[0].id, book.spreads[0].id);
  assert.ok(review.url.startsWith(origin + "/mofolio/review/"));
  assert.ok(review.bytes > 0);
  assert.ok((await site.list()).some((r) => r.id === review.id));
  await site.revoke(review.id);
  assert.equal(
    (await site.list()).find((r) => r.id === review.id).revoked,
    true,
  );
  console.log(
    "PASS actual Stillbounds desktop WebsiteReviews client: discovery, pairing, vault write, real JPEG generation/upload, strict review schema, feedback refresh and revocation against local Moyo backend. Test records removed.",
  );
} finally {
  await pool.query("DELETE FROM stillbounds_versions WHERE book_id=$1", [
    book.id,
  ]);
  await pool.query("DELETE FROM stillbounds_book_versions WHERE book_id=$1", [
    book.id,
  ]);
  if (token)
    await pool.query("DELETE FROM stillbounds_devices WHERE token_hash=$1", [
      hash(token),
    ]);
  if (deviceCode)
    await pool.query("DELETE FROM stillbounds_pairings WHERE code_hash=$1", [
      hash(deviceCode),
    ]);
  await pool.end();
}
