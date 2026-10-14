// Explicit integration check against a LOCAL test server. Uses only synthetic review/device records;
// cleanup targets the generated book/device/pairing IDs, never existing clients or general-user data.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { setTimeout as delay } from "node:timers/promises";
const require = createRequire(import.meta.url);
const sharp = require("sharp"),
  { Pool } = require("pg");
const origin = process.env.STUDIO_TEST_ORIGIN || "http://127.0.0.1:3218";
assert.equal(
  new URL(origin).hostname,
  "127.0.0.1",
  "Use an isolated local test server.",
);
assert.ok(
  process.env.DATABASE_URL,
  "Provide only the test database connection in the process environment.",
);
const signing = process.env.ADMIN_SESSION_SECRET;
assert.ok(
  signing?.startsWith("local-studio-test-"),
  "Use a local-only synthetic admin signing key.",
);
const hash = (s) => crypto.createHash("sha256").update(s).digest("hex");
const payload =
  String(Date.now() + 3600000) + "." + crypto.randomBytes(16).toString("hex");
const admin =
  "moyo-admin-session=" +
  payload +
  "." +
  crypto.createHmac("sha256", signing).update(payload).digest("hex");
const url = new URL(process.env.DATABASE_URL);
url.searchParams.set("sslmode", "verify-full");
url.searchParams.delete("uselibpqcompat");
const pool = new Pool({
  connectionString: url.toString(),
  ssl: { rejectUnauthorized: true },
  max: 1,
});
const bookId = crypto.randomUUID(),
  spreads = [crypto.randomUUID(), crypto.randomUUID()];
let deviceHash, pairHash;
let assertions = 0;
async function request(path, method = "GET", body, auth = {}, status = 200) {
  const response = await fetch(origin + "/api/mofolio/studio" + path, {
    method,
    headers: {
      "x-forwarded-for": "198.51.100.228",
      ...auth,
      ...(body
        ? {
            "Content-Type": Buffer.isBuffer(body)
              ? "image/jpeg"
              : "application/json",
          }
        : {}),
    },
    body: body
      ? Buffer.isBuffer(body)
        ? body
        : JSON.stringify(body)
      : undefined,
  });
  assert.equal(
    response.status,
    status,
    path +
      " " +
      method +
      " expected HTTP " +
      status +
      "; received " +
      response.status,
  );
  assertions++;
  const data = response.headers.get("content-type")?.startsWith("image/")
    ? Buffer.from(await response.arrayBuffer())
    : await response.json();
  return { data, response };
}
try {
  const manifest = await fetch(origin + "/.well-known/mofolio-review.json");
  assert.deepEqual(await manifest.json(), {
    protocol: "mofolio-review-v1",
    apiBase: "/api/mofolio/studio",
  });
  await request("/owner", "GET", undefined, {}, 401);
  await request(
    "/versions",
    "GET",
    undefined,
    { Authorization: "Bearer test-key" },
    401,
  );
  const { data: pair } = await request("/device", "POST", {
    client: "mofolio-desktop",
  });
  pairHash = hash(pair.deviceCode);
  assert.equal(pair.verificationUrl, origin + "/admin/stillbounds");
  assert.equal(pair.expiresIn, 300);
  assert.equal(
    (await request("/token", "POST", { deviceCode: pair.deviceCode })).data
      .status,
    "pending",
  );
  await request(
    "/owner/approve",
    "POST",
    { userCode: pair.userCode, confirm: true },
    { Cookie: admin, Origin: "https://wrong.example" },
    403,
  );
  await request(
    "/owner/approve",
    "POST",
    { userCode: pair.userCode, confirm: true },
    { Origin: origin },
    401,
  );
  await request(
    "/owner/approve",
    "POST",
    { userCode: pair.userCode, confirm: false },
    { Cookie: admin, Origin: origin },
    400,
  );
  await request(
    "/owner/approve",
    "POST",
    { userCode: pair.userCode, confirm: true },
    { Cookie: admin, Origin: origin },
  );
  await delay(5100);
  const { data: approval } = await request("/token", "POST", {
    deviceCode: pair.deviceCode,
  });
  assert.equal(approval.status, "approved");
  deviceHash = hash(approval.accessToken);
  await request("/token", "POST", { deviceCode: pair.deviceCode }, {}, 401);
  const device = { Authorization: "Bearer " + approval.accessToken };
  await request(
    "/versions",
    "POST",
    {
      bookId,
      title: "Invalid",
      spreadIds: [],
      watermark: true,
      retentionDays: 7,
    },
    device,
    400,
  );
  const input = {
    bookId,
    title: "Reserved Moyo Studio verification",
    spreadIds: spreads,
    watermark: true,
    retentionDays: 7,
  };
  const { data: draft } = await request("/versions", "POST", input, device);
  const id = draft.id;
  await request("/reviews/" + id, "GET", undefined, {}, 401);
  await request("/reviews/" + id + "/media/0", "GET", undefined, {}, 401);
  await request("/versions/" + id + "/publish", "POST", {}, device, 409);
  await request(
    "/versions/" + id + "/media/2",
    "POST",
    Buffer.from("bad"),
    device,
    400,
  );
  await request(
    "/versions/" + id + "/media/0",
    "POST",
    Buffer.from("bad"),
    device,
    400,
  );
  const tooLarge = await sharp({
    create: { width: 1601, height: 10, channels: 3, background: "#333333" },
  })
    .jpeg()
    .toBuffer();
  await request("/versions/" + id + "/media/0", "POST", tooLarge, device, 400);
  const jpeg = await sharp({
    create: { width: 800, height: 400, channels: 3, background: "#333333" },
  })
    .withMetadata()
    .jpeg()
    .toBuffer();
  await request("/versions/" + id + "/media/0", "POST", jpeg, device);
  await request("/versions/" + id + "/media/1", "POST", jpeg, device);
  const { data: review } = await request(
    "/versions/" + id + "/publish",
    "POST",
    {},
    device,
  );
  assert.equal(review.spreads[0].id, spreads[0]);
  assert.equal(review.spreads[1].id, spreads[1]);
  assert.equal(review.bookId, bookId);
  assert.ok(
    !("codeHash" in review) &&
      !("salt" in review) &&
      !("encrypted_code" in review),
  );
  const code = new URLSearchParams(new URL(review.url).hash.slice(1)).get(
    "access",
  );
  assert.equal(code.length, 43);
  await request("/versions/" + id + "/media/0", "POST", jpeg, device, 409);
  await request(
    "/reviews/" + id + "/unlock",
    "POST",
    { code: "wrong" },
    { Origin: origin },
    401,
  );
  const { response: unlocked } = await request(
    "/reviews/" + id + "/unlock",
    "POST",
    { code },
    { Origin: origin },
  );
  const setCookie = unlocked.headers.get("set-cookie");
  assert.ok(
    setCookie.includes("HttpOnly") &&
      setCookie.includes("SameSite=strict") &&
      setCookie.includes("Path=/api/mofolio/studio/reviews/" + id),
  );
  const client = { Cookie: setCookie.split(";")[0], Origin: origin };
  const { data: visible } = await request(
    "/reviews/" + id,
    "GET",
    undefined,
    client,
  );
  assert.ok(!JSON.stringify(visible).includes(code) && !("url" in visible));
  const { data: preview } = await request(
    "/reviews/" + id + "/media/0",
    "GET",
    undefined,
    client,
  );
  const metadata = await sharp(preview).metadata();
  assert.equal(metadata.width, 800);
  assert.equal(metadata.height, 400);
  assert.equal(metadata.exif, undefined);
  await request(
    "/reviews/" + id + "/comments",
    "POST",
    { spreadId: crypto.randomUUID(), text: "Wrong version" },
    client,
    400,
  );
  await request(
    "/reviews/" + id + "/comments",
    "POST",
    { spreadId: spreads[0], text: "Please adjust this crop." },
    client,
  );
  await request(
    "/reviews/" + id + "/decision",
    "POST",
    { decision: "approved", confirm: true },
    client,
  );
  const listed = (
    await request("/versions", "GET", undefined, device)
  ).data.find((v) => v.id === id);
  assert.equal(listed.decision, "approved");
  assert.equal(listed.comments[0].text, "Please adjust this crop.");
  await request(
    "/versions/" + id + "/comments/" + listed.comments[0].id + "/resolve",
    "POST",
    {},
    device,
  );
  assert.equal(
    (await request("/reviews/" + id, "GET", undefined, client)).data.comments[0]
      .resolved,
    true,
  );
  const other = (await request("/versions", "POST", input, device)).data.id;
  await request("/reviews/" + other, "GET", undefined, client, 401);
  await request("/versions/" + id, "DELETE", undefined, device);
  await request("/reviews/" + id, "GET", undefined, client, 401);
  await request("/reviews/" + id + "/media/0", "GET", undefined, client, 401);
  assert.equal(
    Number(
      (
        await pool.query(
          "SELECT COUNT(*) AS count FROM stillbounds_media WHERE version_id=$1",
          [id],
        )
      ).rows[0].count,
    ),
    0,
  );
  // Expire the unfinished second draft, then exercise lazy retention cleanup.
  await pool.query(
    "UPDATE stillbounds_versions SET expires_at=NOW()-INTERVAL '1 second' WHERE id=$1",
    [other],
  );
  const owner = (await request("/owner", "GET", undefined, { Cookie: admin }))
    .data;
  assert.ok(!owner.versions.some((v) => v.id === other));
  const ownDevice = (
    await pool.query("SELECT id FROM stillbounds_devices WHERE token_hash=$1", [
      deviceHash,
    ])
  ).rows[0].id;
  await request("/owner/devices/" + ownDevice, "DELETE", undefined, {
    Cookie: admin,
    Origin: origin,
  });
  await request("/versions", "GET", undefined, device, 401);
  console.log(
    "PASS Moyo Studio integration: " +
      assertions +
      " HTTP assertions; pairing, single-use tokens, admin/CSRF isolation, private JPEGs, immutable publishing, version-scoped feedback, decisions, revocation and expiry. Synthetic records cleaned; no emails sent.",
  );
} finally {
  await pool.query("DELETE FROM stillbounds_versions WHERE book_id=$1", [
    bookId,
  ]);
  await pool.query("DELETE FROM stillbounds_book_versions WHERE book_id=$1", [
    bookId,
  ]);
  if (deviceHash)
    await pool.query("DELETE FROM stillbounds_devices WHERE token_hash=$1", [
      deviceHash,
    ]);
  if (pairHash)
    await pool.query("DELETE FROM stillbounds_pairings WHERE code_hash=$1", [
      pairHash,
    ]);
  await pool.end();
}
