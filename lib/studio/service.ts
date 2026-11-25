import { randomBytes, randomUUID } from "node:crypto";
import sharp from "sharp";
import { type NextRequest, NextResponse } from "next/server";
import { studioQuery, studioTransaction } from "./db";
import {
  admin,
  device,
  viewer,
  limited,
  sameOrigin,
  privateHeaders,
  studioOrigin,
} from "./security";
import {
  assertStudio,
  hash,
  secret,
  uuid,
  OWNER,
  draftInput,
  bodyJSON,
  boundedBody,
  MAX_UPLOAD,
  commentPin,
  MAX_VERSION,
  MAX_WORKSPACE,
  encryptCode,
  decryptCode,
} from "./protocol";

const json = (value: unknown, status = 200) =>
  NextResponse.json(value, { status, headers: privateHeaders });
async function cleanup() {
  await studioQuery(`DELETE FROM stillbounds_versions WHERE expires_at<=NOW()`);
  await studioQuery(`DELETE FROM stillbounds_pairings WHERE expires_at<=NOW()`);
  await studioQuery(`DELETE FROM stillbounds_viewers WHERE expires_at<=NOW()`);
  await studioQuery(
    `DELETE FROM stillbounds_limits WHERE since<NOW()-INTERVAL '1 day'`,
  );
}
async function reviewRecords(
  ids: string[],
  origin: string,
  owner = false,
  workspace = OWNER,
) {
  if (!ids.length) return [];
  const [versions, media, comments] = await Promise.all([
    studioQuery(
      `SELECT id,book_id,title,version,expires_at,state,watermark,decision,encrypted_code,spread_metadata
       FROM stillbounds_versions WHERE id=ANY($1::uuid[]) AND owner_id=$2`,
      [ids, workspace],
    ),
    studioQuery(
      `SELECT m.version_id,m.index,m.width,m.height,v.spread_ids->>m.index AS id
       FROM stillbounds_media m JOIN stillbounds_versions v ON v.id=m.version_id
       WHERE m.version_id=ANY($1::uuid[]) ORDER BY m.index`,
      [ids],
    ),
    studioQuery(
      `SELECT version_id,id,spread_id AS "spreadId",text,created_at AS "createdAt",resolved,pin
       FROM stillbounds_comments WHERE version_id=ANY($1::uuid[]) ORDER BY created_at,id`,
      [ids],
    ),
  ]);
  return ids.flatMap((id) => {
    const v = versions.rows.find((row) => row.id === id);
    if (!v) return [];
    return [
      {
        id: v.id,
        bookId: v.book_id,
        title: v.title,
        version: v.version,
        expiresAt: new Date(v.expires_at).getTime(),
        revoked: v.state === "revoked",
        state: v.state,
        watermark: v.watermark,
        decision: v.decision,
        spreads:
          v.state === "revoked"
            ? v.spread_metadata
            : media.rows
                .filter((m) => m.version_id === id)
                .map((m) => ({
                  id: m.id,
                  file: `spread-${m.index + 1}.jpg`,
                  width: m.width,
                  height: m.height,
                })),
        comments: comments.rows
          .filter((c) => c.version_id === id)
          .map((c) => ({
            id: c.id,
            spreadId: c.spreadId,
            text: c.text,
            createdAt: new Date(c.createdAt).toISOString(),
            resolved: c.resolved,
            pin: c.pin ?? null,
          })),
        ...(owner
          ? {
              url: `${origin}/stillbounds/review/${id}${v.encrypted_code && v.state === "published" ? "#access=" + decryptCode(v.encrypted_code) : ""}`,
            }
          : {}),
      },
    ];
  });
}
export async function reviewRecord(
  id: string,
  origin: string,
  owner = false,
  workspace = OWNER,
) {
  const records = await reviewRecords([id], origin, owner, workspace);
  assertStudio(records.length, "Review not found.", 404);
  return records[0];
}
async function ownerVersion(id: string, workspace = OWNER) {
  const { rows } = await studioQuery(
    "SELECT * FROM stillbounds_versions WHERE id=$1 AND owner_id=$2 AND expires_at>NOW()",
    [id, workspace],
  );
  assertStudio(rows.length, "Review not found.", 404);
  return rows[0];
}

export async function studioRequest(
  request: NextRequest,
  path: string[],
  accountOwner?: string,
) {
  let workspace = accountOwner ?? OWNER;
  const method = request.method,
    origin = studioOrigin(request);
  assertStudio(path.length > 0 && path.length <= 6, "Route not found.", 404);
  if (path[0] === "device" && path.length === 1 && method === "POST") {
    const input = await bodyJSON(request);
    assertStudio(input.client === "mofolio-desktop", "Unsupported device.");
    await limited(request, "studio-pair", 5, 600);
    await cleanup();
    const code = secret(),
      userCode = randomBytes(5).toString("hex").toUpperCase();
    await studioQuery(
      `INSERT INTO stillbounds_pairings(code_hash,user_code,expires_at) VALUES($1,$2,NOW()+INTERVAL '5 minutes')`,
      [hash(code), userCode],
    );
    return json({
      deviceCode: code,
      userCode,
      verificationUrl: `${origin}/stillbounds/account?review_code=${userCode}`,
      expiresIn: 300,
      interval: 5,
    });
  }
  if (path[0] === "token" && path.length === 1 && method === "POST") {
    const input = await bodyJSON(request);
    assertStudio(
      typeof input.deviceCode === "string" &&
        /^[A-Za-z0-9_-]{43}$/.test(input.deviceCode),
      "Invalid device code.",
    );
    await limited(request, "studio-poll", 180, 600);
    const token = secret();
    return studioTransaction(async (db) => {
      const { rows } = await db.query(
        "SELECT * FROM stillbounds_pairings WHERE code_hash=$1 AND expires_at>NOW() FOR UPDATE",
        [hash(input.deviceCode)],
      );
      assertStudio(
        rows.length && !rows[0].consumed,
        "Pairing expired or already completed.",
        401,
      );
      const pairing = rows[0];
      assertStudio(
        !pairing.last_poll ||
          Date.now() - new Date(pairing.last_poll).getTime() >= 4000,
        "Please wait before polling again.",
        429,
      );
      await db.query(
        "UPDATE stillbounds_pairings SET last_poll=NOW() WHERE code_hash=$1",
        [hash(input.deviceCode)],
      );
      if (!pairing.approved) return json({ status: "pending" });
      await db.query(
        `INSERT INTO stillbounds_devices(id,owner_id,token_hash,label,expires_at) VALUES($1,$2,$3,'Stillbounds desktop',NOW()+INTERVAL '30 days')`,
        [randomUUID(), pairing.owner_id ?? OWNER, hash(token)],
      );
      await db.query(
        "UPDATE stillbounds_pairings SET consumed=TRUE WHERE code_hash=$1",
        [hash(input.deviceCode)],
      );
      return json({ status: "approved", accessToken: token });
    });
  }
  if (path[0] === "owner") {
    await admin(request, method !== "GET");
    if (path.length === 1 && method === "GET") {
      await cleanup();
      const devices = await studioQuery(
        `SELECT id,label,created_at,expires_at,revoked FROM stillbounds_devices WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 100`,
        [workspace],
      );
      const versions = await studioQuery(
        `SELECT id,title,version,state,decision,expires_at,created_at FROM stillbounds_versions WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 100`,
        [workspace],
      );
      const usage = await studioQuery(
        `SELECT COALESCE(SUM(octet_length(jpeg)),0) AS bytes FROM stillbounds_media`,
      );
      return json({
        devices: devices.rows,
        versions: versions.rows,
        bytes: Number(usage.rows[0].bytes),
        quota: MAX_WORKSPACE,
      });
    }
    if (path[1] === "approve" && path.length === 2 && method === "POST") {
      await limited(request, "studio-approve", 15, 600);
      const input = await bodyJSON(request);
      assertStudio(
        typeof input.userCode === "string" &&
          /^[A-F0-9]{10}$/.test(input.userCode),
        "Enter the ten-character code shown in your app.",
      );
      assertStudio(
        input.confirm === true,
        "Confirm that you started this connection on your own Mac.",
      );
      const { rows } = await studioQuery(
        `UPDATE stillbounds_pairings SET approved=TRUE WHERE user_code=$1 AND expires_at>NOW() AND consumed=FALSE AND approved=FALSE RETURNING user_code`,
        [input.userCode],
      );
      assertStudio(
        rows.length,
        "Code expired, already approved, or not found.",
        404,
      );
      return json({ ok: true });
    }
    if (path[1] === "devices" && path.length === 3 && method === "DELETE") {
      assertStudio(uuid.test(path[2]), "Invalid device.");
      const { rows } = await studioQuery(
        "UPDATE stillbounds_devices SET revoked=TRUE WHERE id=$1 AND owner_id=$2 RETURNING id",
        [path[2], workspace],
      );
      assertStudio(rows.length, "Device not found.", 404);
      return json({ ok: true });
    }
    if (path[1] === "versions" && path.length === 3 && method === "GET") {
      assertStudio(uuid.test(path[2]), "Invalid review.");
      return json(await reviewRecord(path[2], origin, true, workspace));
    }
    if (path[1] === "versions" && path.length === 3 && method === "DELETE") {
      assertStudio(uuid.test(path[2]), "Invalid review.");
      await revoke(path[2], workspace);
      return json({ ok: true });
    }
    assertStudio(false, "Route not found.", 404);
  }
  if (path[0] === "reviews") {
    assertStudio(uuid.test(path[1] || ""), "Invalid review.");
    const id = path[1];
    if (path[2] === "unlock" && path.length === 3 && method === "POST") {
      sameOrigin(request);
      await limited(request, `studio-unlock-${id}`, 12, 600);
      const input = await bodyJSON(request);
      assertStudio(
        typeof input.code === "string" &&
          /^[A-Za-z0-9_-]{43}$/.test(input.code),
        "Review unavailable or access code incorrect.",
        401,
      );
      const { rows } = await studioQuery(
        `SELECT id,state,expires_at FROM stillbounds_versions WHERE id=$1 AND code_hash=$2`,
        [id, hash(input.code)],
      );
      assertStudio(
        rows.length,
        "Review unavailable or access code incorrect.",
        401,
      );
      assertStudio(
        rows[0].state === "published",
        "This review link has been withdrawn. Ask your photographer for a new link.",
        410,
      );
      assertStudio(
        new Date(rows[0].expires_at).getTime() > Date.now(),
        "This review link has expired. Ask your photographer to share a new review.",
        410,
      );
      const token = secret();
      await studioQuery(
        `INSERT INTO stillbounds_viewers(token_hash,version_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '8 hours')`,
        [hash(token), id],
      );
      const response = json({ ok: true });
      response.cookies.set(`sb-review-${id}`, token, {
        httpOnly: true,
        secure: studioOrigin(request).startsWith("https:"),
        sameSite: "strict",
        path: `/api/mofolio/studio/reviews/${id}`,
        maxAge: 28800,
      });
      return response;
    }
    const version = await viewer(request, id);
    if (path.length === 2 && method === "GET")
      return json(await reviewRecord(id, origin, false, version.owner_id));
    // A live viewer may inspect only earlier published versions of this book
    // in this workspace. Never expose codes, drafts, revoked or expired media.
    if (path[2] === "history" && method === "GET") {
      const { rows } = await studioQuery(
        `SELECT id FROM stillbounds_versions WHERE owner_id=$1 AND book_id=$2
         AND version<$3 AND state='published' AND expires_at>NOW()
         ORDER BY version DESC LIMIT 100`,
        [version.owner_id, version.book_id, version.version],
      );
      if (path.length === 3) {
        const records = await reviewRecords(
          rows.map((row) => row.id),
          origin,
          false,
          version.owner_id,
        );
        return json(
          records.filter(
            (record) =>
              record.state === "published" && record.expiresAt > Date.now(),
          ),
        );
      }
      assertStudio(
        path.length === 6 && path[4] === "media" && /^\d{1,3}$/.test(path[5]),
        "Route not found.",
        404,
      );
      assertStudio(
        rows.some((row) => row.id === path[3]),
        "This earlier version is unavailable.",
        410,
      );
      const media = await studioQuery(
        `SELECT m.jpeg FROM stillbounds_media m JOIN stillbounds_versions v ON v.id=m.version_id
         WHERE m.version_id=$1 AND m.index=$2 AND v.owner_id=$3 AND v.book_id=$4
         AND v.version<$5 AND v.state='published' AND v.expires_at>NOW()`,
        [
          path[3],
          Number(path[5]),
          version.owner_id,
          version.book_id,
          version.version,
        ],
      );
      assertStudio(
        media.rows.length,
        "This earlier preview is unavailable.",
        410,
      );
      return new Response(new Uint8Array(media.rows[0].jpeg), {
        headers: { ...privateHeaders, "Content-Type": "image/jpeg" },
      });
    }
    if (path[2] === "media" && path.length === 4 && method === "GET") {
      assertStudio(/^\d{1,3}$/.test(path[3]), "Invalid spread.");
      const { rows } = await studioQuery(
        "SELECT jpeg FROM stillbounds_media WHERE version_id=$1 AND index=$2",
        [id, Number(path[3])],
      );
      assertStudio(rows.length, "Spread not found.", 404);
      return new Response(new Uint8Array(rows[0].jpeg), {
        headers: {
          ...privateHeaders,
          "Content-Type": "image/jpeg",
          "Content-Disposition": 'inline; filename="review-preview.jpg"',
        },
      });
    }
    if (method === "POST") {
      sameOrigin(request);
      await limited(request, `studio-feedback-${id}`, 30, 600);
      const input = await bodyJSON(request);
      if (path[2] === "comments" && path.length === 3) {
        assertStudio(
          typeof input.spreadId === "string" &&
            version.spread_ids.includes(input.spreadId),
          "Choose a spread in this version.",
        );
        assertStudio(
          typeof input.text === "string" &&
            input.text.trim().length > 0 &&
            input.text.length <= 2000,
          "Comments must contain 1–2,000 characters.",
        );
        const pin = commentPin(input.pin);
        await studioTransaction(async (db) => {
          const { rows } = await db.query(
            `SELECT id FROM stillbounds_versions WHERE id=$1 AND state='published' AND expires_at>NOW() FOR UPDATE`,
            [id],
          );
          assertStudio(rows.length, "Review unavailable.", 410);
          const count = await db.query(
            "SELECT COUNT(*) AS count FROM stillbounds_comments WHERE version_id=$1",
            [id],
          );
          assertStudio(
            Number(count.rows[0].count) < 2000,
            "This review has reached its comment limit.",
            409,
          );
          await db.query(
            "INSERT INTO stillbounds_comments(id,version_id,spread_id,text,pin) VALUES($1,$2,$3,$4,$5)",
            [
              randomUUID(),
              id,
              input.spreadId,
              input.text.trim(),
              pin === null ? null : JSON.stringify(pin),
            ],
          );
        });
        return json({ ok: true });
      }
      if (path[2] === "decision" && path.length === 3) {
        assertStudio(
          ["changes", "approved"].includes(input.decision),
          "Choose approval or changes.",
        );
        assertStudio(
          input.confirm === true,
          "Confirm your decision for this fixed version.",
        );
        const { rows } = await studioQuery(
          `UPDATE stillbounds_versions SET decision=$2 WHERE id=$1 AND state='published' AND expires_at>NOW() RETURNING id`,
          [id, input.decision],
        );
        assertStudio(rows.length, "Review unavailable.", 410);
        return json({ ok: true });
      }
    }
    assertStudio(false, "Route not found.", 404);
  }
  assertStudio(path[0] === "versions", "Route not found.", 404);
  if (!accountOwner) workspace = (await device(request)).ownerId;
  const personal = workspace.startsWith("account:");
  if (path.length === 1 && method === "GET") {
    await cleanup();
    const { rows } = await studioQuery(
      `SELECT id FROM stillbounds_versions WHERE owner_id=$1 AND ($2::boolean OR state!='draft') ORDER BY created_at DESC LIMIT 100`,
      [workspace, !!accountOwner],
    );
    const versions = await reviewRecords(
      rows.map((row) => row.id),
      origin,
      true,
      workspace,
    );
    // The existing desktop transport caps responses at 2 MiB. Fail explicitly rather than return malformed/truncated data.
    assertStudio(
      Buffer.byteLength(JSON.stringify(versions)) < 1900000,
      "Review history is too large. Revoke old reviews before refreshing.",
      413,
    );
    return json(versions);
  }
  if (path.length === 1 && method === "POST") {
    await limited(request, "studio-create", 20, 3600);
    const input = draftInput(await bodyJSON(request));
    await cleanup();
    return studioTransaction(async (db) => {
      await db.query(
        "SELECT id FROM stillbounds_workspace WHERE id=$1 FOR UPDATE",
        [workspace],
      );
      const count = await db.query(
        `SELECT COUNT(*) AS count FROM stillbounds_versions WHERE owner_id=$1 AND state!='revoked'`,
        [workspace],
      );
      assertStudio(
        Number(count.rows[0].count) < (personal ? 10 : 100),
        "Revoke or let older reviews expire before creating more.",
        409,
      );
      const latest = await db.query(
        `INSERT INTO stillbounds_book_versions(owner_id,book_id,latest) VALUES($1,$2,1) ON CONFLICT(owner_id,book_id) DO UPDATE SET latest=stillbounds_book_versions.latest+1 RETURNING latest AS version`,
        [workspace, input.bookId],
      );
      const id = randomUUID();
      await db.query(
        `INSERT INTO stillbounds_versions(id,owner_id,book_id,title,version,spread_ids,watermark,retention_days,expires_at)
       VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8,NOW()+INTERVAL '1 day')`,
        [
          id,
          workspace,
          input.bookId,
          input.title,
          latest.rows[0].version,
          JSON.stringify(input.spreadIds),
          input.watermark,
          input.retentionDays,
        ],
      );
      return json({ id });
    });
  }
  const id = path[1];
  assertStudio(uuid.test(id || ""), "Invalid review.");
  const version = await ownerVersion(id, workspace);
  if (path.length === 2 && method === "GET")
    return json(await reviewRecord(id, origin, true, workspace));
  if (path.length === 2 && method === "DELETE") {
    if (accountOwner) {
      const removed = await studioQuery(
        "DELETE FROM stillbounds_versions WHERE id=$1 AND owner_id=$2 RETURNING id",
        [id, workspace],
      );
      assertStudio(removed.rows.length, "Review not found.", 404);
    } else await revoke(id, workspace);
    return json({ ok: true });
  }
  if (path[2] === "media" && path.length === 4 && method === "POST") {
    assertStudio(
      version.state === "draft",
      "Published previews cannot be changed.",
      409,
    );
    assertStudio(
      /^\d{1,3}$/.test(path[3]) && Number(path[3]) < version.spread_ids.length,
      "Invalid spread index.",
    );
    assertStudio(
      request.headers.get("content-type")?.split(";")[0] === "image/jpeg",
      "Upload a flattened JPEG.",
    );
    await limited(request, "studio-media-" + workspace, 600, 3600);
    const data = await boundedBody(request, MAX_UPLOAD);
    let jpeg: Buffer, width: number, height: number;
    try {
      const image = sharp(data, {
          limitInputPixels: 1600 * 1600,
          failOn: "warning",
        }),
        metadata = await image.metadata();
      assertStudio(
        metadata.format === "jpeg" &&
          metadata.width &&
          metadata.height &&
          metadata.width <= 1600 &&
          metadata.height <= 1600 &&
          (metadata.pages || 1) === 1,
        "Preview must be a JPEG no larger than 1600 × 1600.",
      );
      width = metadata.width;
      height = metadata.height;
      jpeg = await image.jpeg({ quality: 80 }).toBuffer();
    } catch {
      assertStudio(false, "Invalid JPEG or preview dimensions.");
    }
    await studioTransaction(async (db) => {
      await db.query(
        "SELECT id FROM stillbounds_workspace WHERE id=$1 FOR UPDATE",
        [workspace],
      );
      const current = await db.query(
        `SELECT id FROM stillbounds_versions WHERE id=$1 AND owner_id=$2 AND state='draft' AND expires_at>NOW() FOR UPDATE`,
        [id, workspace],
      );
      assertStudio(current.rows.length, "Draft unavailable.", 409);
      await db.query("SELECT pg_advisory_xact_lock(178931, 53)");
      const total = await db.query(
        `SELECT COALESCE(SUM(octet_length(jpeg)),0) AS bytes,
        COALESCE(SUM(octet_length(jpeg)) FILTER(WHERE version_id=$1),0) AS version_bytes,
        COALESCE(SUM(octet_length(jpeg)) FILTER(WHERE version_id=$1 AND index=$2),0) AS previous FROM stillbounds_media`,
        [id, Number(path[3])],
      );
      const usage = total.rows[0];
      if (personal) {
        const owned = await db.query(
          `SELECT COALESCE(SUM(octet_length(m.jpeg)),0) AS bytes FROM stillbounds_media m JOIN stillbounds_versions v ON v.id=m.version_id WHERE v.owner_id=$1`,
          [workspace],
        );
        assertStudio(
          Number(owned.rows[0].bytes) - Number(usage.previous) + jpeg.length <=
            50 * 1024 * 1024,
          "Your 50 MiB review storage limit is reached. Delete older reviews to free space.",
          413,
        );
      }
      assertStudio(
        Number(usage.bytes) - Number(usage.previous) + jpeg.length <=
          MAX_WORKSPACE &&
          Number(usage.version_bytes) - Number(usage.previous) + jpeg.length <=
            MAX_VERSION,
        "Review storage limit reached. Revoke older reviews.",
        413,
      );
      await db.query(
        `INSERT INTO stillbounds_media(version_id,index,width,height,jpeg) VALUES($1,$2,$3,$4,$5)
       ON CONFLICT(version_id,index) DO UPDATE SET width=$3,height=$4,jpeg=$5`,
        [id, Number(path[3]), width, height, jpeg],
      );
    });
    return json({ ok: true });
  }
  if (path[2] === "publish" && path.length === 3 && method === "POST") {
    await studioTransaction(async (db) => {
      const { rows } = await db.query(
        `SELECT * FROM stillbounds_versions WHERE id=$1 AND owner_id=$2 AND expires_at>NOW() FOR UPDATE`,
        [id, workspace],
      );
      assertStudio(rows.length, "Draft unavailable.", 404);
      const current = rows[0];
      if (current.state === "published") return;
      assertStudio(current.state === "draft", "Review revoked.", 409);
      const media = await db.query(
        "SELECT index,width,height FROM stillbounds_media WHERE version_id=$1 ORDER BY index",
        [id],
      );
      assertStudio(
        media.rows.length === current.spread_ids.length,
        "Upload every spread before publishing.",
        409,
      );
      const manifest = media.rows.map((m) => ({
        id: current.spread_ids[m.index],
        file: "spread-" + (m.index + 1) + ".jpg",
        width: m.width,
        height: m.height,
      }));
      const code = secret();
      await db.query(
        `UPDATE stillbounds_versions SET state='published',expires_at=NOW()+(retention_days*INTERVAL '1 day'),code_hash=$2,encrypted_code=$3,spread_metadata=$4::jsonb WHERE id=$1`,
        [id, hash(code), encryptCode(code), JSON.stringify(manifest)],
      );
    });
    return json(await reviewRecord(id, origin, true, workspace));
  }
  if (
    path[2] === "comments" &&
    path[4] === "resolve" &&
    path.length === 5 &&
    method === "POST"
  ) {
    assertStudio(uuid.test(path[3]), "Invalid comment.");
    const { rows } = await studioQuery(
      `UPDATE stillbounds_comments SET resolved=TRUE WHERE id=$1 AND version_id=$2 RETURNING id`,
      [path[3], id],
    );
    assertStudio(rows.length, "Comment not found in this version.", 404);
    return json({ ok: true });
  }
  assertStudio(false, "Route not found.", 404);
}
async function revoke(id: string, workspace = OWNER) {
  await studioTransaction(async (db) => {
    const { rows } = await db.query(
      `UPDATE stillbounds_versions SET state='revoked',encrypted_code=NULL,code_hash=NULL WHERE id=$1 AND owner_id=$2 RETURNING id`,
      [id, workspace],
    );
    assertStudio(rows.length, "Review not found.", 404);
    await db.query("DELETE FROM stillbounds_media WHERE version_id=$1", [id]);
    await db.query("DELETE FROM stillbounds_viewers WHERE version_id=$1", [id]);
  });
}
export async function cleanupStudio() {
  await cleanup();
}
