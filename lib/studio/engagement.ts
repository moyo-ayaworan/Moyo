import { createHash, randomInt, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { studioQuery, studioTransaction } from "./db";
import {
  assertStudio,
  decryptCode,
  encryptCode,
  hash,
  secret,
  uuid,
} from "./protocol";
import { privateHeaders } from "./security";

type DB = Pick<PoolClient, "query">;
export type Receipt = {
  id: string;
  approvedAt: string;
  snapshot: {
    title: string;
    version: number;
    bookId: string;
    previewDigest: string;
    surfaces: number;
    watermark: boolean;
    unresolvedComments: number;
  };
};
export function receiptText(receipt: Receipt) {
  const value = receipt.snapshot;
  return `STILLBOUNDS — BOOK APPROVAL RECEIPT\n\nReceipt: ${receipt.id}\nBook: ${value.title.replace(/\s+/g, " ")}\nBook ID: ${value.bookId}\nVersion: ${value.version}\nApproved at (UTC): ${new Date(receipt.approvedAt).toISOString()}\nReview surfaces: ${value.surfaces}\nWatermarked preview: ${value.watermark ? "Yes" : "No"}\nUnresolved comments at approval: ${value.unresolvedComments}\nPreview fingerprint (SHA-256): ${value.previewDigest}\n\nAn authorized holder of the private review link approved this fixed preview. This records link-based approval; it does not certify the identity of a signer or confirm print, payment, or delivery arrangements. Later decisions do not alter this historical receipt.\n\nSave this copy. Online copies remain available only while this review is retained.\n`;
}
export async function receiptDownload(versionId: string, receiptId: string) {
  assertStudio(uuid.test(receiptId || ""), "Invalid receipt.");
  const { rows } = await studioQuery(
    "SELECT id,approved_at,snapshot FROM stillbounds_approval_receipts WHERE id=$1 AND version_id=$2",
    [receiptId, versionId],
  );
  assertStudio(rows.length, "Receipt not found in this review.", 404);
  const receipt = {
    id: rows[0].id,
    approvedAt: new Date(rows[0].approved_at).toISOString(),
    snapshot: rows[0].snapshot,
  };
  return new Response(receiptText(receipt), {
    headers: {
      ...privateHeaders,
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="stillbounds-approval-${receiptId}.txt"`,
    },
  });
}
export async function reviewEvent(
  db: DB,
  versionId: string,
  kind: string,
  actor: "client" | "photographer" | "system",
) {
  const id = randomUUID();
  await db.query(
    "INSERT INTO stillbounds_review_events(id,version_id,kind,actor) VALUES($1,$2,$3,$4)",
    [id, versionId, kind, actor],
  );
  if (kind !== "opened" && kind !== "reminder_sent")
    await db.query(
      "UPDATE stillbounds_versions SET last_feedback_at=NOW() WHERE id=$1",
      [versionId],
    );
  return id;
}
export async function queueOwner(
  db: DB,
  versionId: string,
  eventId: string,
  kind: string,
  payload: object = {},
) {
  await db.query(
    `INSERT INTO stillbounds_review_outbox(id,version_id,kind,payload)
    SELECT $1,id,$3,$4::jsonb FROM stillbounds_versions WHERE id=$2 AND notify_owner=TRUE
    ON CONFLICT(id) DO NOTHING`,
    [hash(`owner:${eventId}`), versionId, kind, JSON.stringify(payload)],
  );
}
export async function queueClients(
  db: DB,
  versionId: string,
  eventId: string,
  kind: string,
  payload: object = {},
) {
  await db.query(
    `INSERT INTO stillbounds_review_outbox(id,version_id,kind,subscriber_id,payload)
    SELECT $1||':'||id::text,version_id,$3,id,$4::jsonb FROM stillbounds_review_subscribers
    WHERE version_id=$2 AND verified_at IS NOT NULL ON CONFLICT(id) DO NOTHING`,
    [hash(`client:${eventId}`), versionId, kind, JSON.stringify(payload)],
  );
}
export async function recordReviewOpen(versionId: string, tokenHash: string) {
  // Repeated refreshes and background fetches are one open per session per 30 minutes.
  await studioQuery(
    `WITH opened AS (
    UPDATE stillbounds_viewers SET last_opened_at=NOW() WHERE token_hash=$2 AND version_id=$1
    AND (last_opened_at IS NULL OR last_opened_at<NOW()-INTERVAL '30 minutes') RETURNING version_id
  ), touched AS (
    UPDATE stillbounds_versions SET first_opened_at=COALESCE(first_opened_at,NOW()),last_opened_at=NOW(),open_count=open_count+1
    WHERE id IN(SELECT version_id FROM opened) RETURNING id
  ) INSERT INTO stillbounds_review_events(id,version_id,kind,actor) SELECT $3,id,'opened','client' FROM touched`,
    [versionId, tokenHash, randomUUID()],
  );
}
export async function saveDecision(
  versionId: string,
  decision: "approved" | "changes",
) {
  return studioTransaction(async (db) => {
    const { rows } = await db.query(
      `SELECT *,NOW() AS recorded_at FROM stillbounds_versions WHERE id=$1 AND state='published' AND expires_at>NOW() FOR UPDATE`,
      [versionId],
    );
    assertStudio(rows.length, "Review unavailable.", 410);
    const version = rows[0];
    // Repeated requests for the same decision do not create receipts or email again.
    if (version.decision === decision) return;
    let receipt: Receipt | undefined;
    if (decision === "approved") {
      const media = await db.query(
        "SELECT index,width,height,jpeg FROM stillbounds_media WHERE version_id=$1 ORDER BY index",
        [versionId],
      );
      assertStudio(
        media.rows.length === version.spread_ids.length &&
          media.rows.length > 0,
        "Every preview must be available before approval.",
        409,
      );
      const digest = createHash("sha256");
      for (const page of media.rows) {
        digest.update(`${page.index}:${page.width}:${page.height}:`);
        digest.update(page.jpeg);
      }
      const comments = await db.query(
        "SELECT COUNT(*)::int AS count FROM stillbounds_comments WHERE version_id=$1 AND resolved=FALSE",
        [versionId],
      );
      receipt = {
        id: randomUUID(),
        approvedAt: new Date(version.recorded_at).toISOString(),
        snapshot: {
          title: version.title,
          version: version.version,
          bookId: version.book_id,
          surfaces: media.rows.length,
          previewDigest: digest.digest("hex"),
          watermark: version.watermark,
          unresolvedComments: Number(comments.rows[0].count),
        },
      };
      await db.query(
        "INSERT INTO stillbounds_approval_receipts(id,version_id,approved_at,snapshot) VALUES($1,$2,$3,$4::jsonb)",
        [
          receipt.id,
          versionId,
          receipt.approvedAt,
          JSON.stringify(receipt.snapshot),
        ],
      );
    }
    await db.query("UPDATE stillbounds_versions SET decision=$2 WHERE id=$1", [
      versionId,
      decision,
    ]);
    if (decision === "approved")
      await db.query(
        "UPDATE stillbounds_review_outbox SET discarded=TRUE,payload='{}'::jsonb WHERE version_id=$1 AND kind='reminder' AND sent_at IS NULL",
        [versionId],
      );
    const event = await reviewEvent(db, versionId, decision, "client");
    await queueOwner(
      db,
      versionId,
      event,
      `owner_${decision}`,
      receipt ? { receiptId: receipt.id } : {},
    );
    if (receipt)
      await queueClients(db, versionId, event, "client_receipt", {
        receiptId: receipt.id,
      });
  });
}
export async function addReply(
  versionId: string,
  commentId: string,
  actor: "client" | "photographer",
  input: Record<string, unknown>,
) {
  assertStudio(uuid.test(commentId || ""), "Invalid comment.");
  assertStudio(
    typeof input.text === "string" &&
      input.text.trim().length > 0 &&
      input.text.length <= 2000,
    "Replies must contain 1–2,000 characters.",
  );
  const text = input.text.trim();
  return studioTransaction(async (db) => {
    const current = await db.query(
      `SELECT id FROM stillbounds_versions WHERE id=$1 AND state='published' AND expires_at>NOW() FOR UPDATE`,
      [versionId],
    );
    assertStudio(current.rows.length, "Review unavailable.", 410);
    const comment = await db.query(
      "SELECT id FROM stillbounds_comments WHERE id=$1 AND version_id=$2",
      [commentId, versionId],
    );
    assertStudio(comment.rows.length, "Comment not found in this review.", 404);
    const count = await db.query(
      "SELECT COUNT(*)::int AS count FROM stillbounds_replies WHERE comment_id=$1",
      [commentId],
    );
    assertStudio(
      Number(count.rows[0].count) < 50,
      "This thread has reached its reply limit. Start a new comment.",
      409,
    );
    await db.query(
      "INSERT INTO stillbounds_replies(id,comment_id,actor,text) VALUES($1,$2,$3,$4)",
      [randomUUID(), commentId, actor, text],
    );
    const event = await reviewEvent(db, versionId, "reply", actor);
    if (actor === "photographer")
      await queueClients(db, versionId, event, "client_reply");
    else await queueOwner(db, versionId, event, "owner_comment");
  });
}
export function reviewEmail(value: unknown) {
  assertStudio(
    typeof value === "string" &&
      value.length <= 254 &&
      /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?)+$/i.test(
        value.trim(),
      ),
    "Enter a valid email address.",
  );
  return value.trim().toLowerCase();
}
export async function requestReviewEmails(
  versionId: string,
  input: Record<string, unknown>,
) {
  const email = reviewEmail(input.email);
  assertStudio(
    input.consent === true && typeof input.reminders === "boolean",
    "Confirm that you want review emails.",
  );
  await studioTransaction(async (db) => {
    const current = await db.query(
      `SELECT id FROM stillbounds_versions WHERE id=$1 AND state='published' AND expires_at>NOW() FOR UPDATE`,
      [versionId],
    );
    assertStudio(current.rows.length, "Review unavailable.", 410);
    const budget = await db.query(
      `INSERT INTO stillbounds_limits(key,hits,since) VALUES($1,1,NOW()) ON CONFLICT(key) DO UPDATE SET
      hits=CASE WHEN stillbounds_limits.since<NOW()-INTERVAL '1 day' THEN 1 ELSE stillbounds_limits.hits+1 END,
      since=CASE WHEN stillbounds_limits.since<NOW()-INTERVAL '1 day' THEN NOW() ELSE stillbounds_limits.since END RETURNING hits`,
      [hash(`review-email:${email}`)],
    );
    assertStudio(
      Number(budget.rows[0].hits) <= 3,
      "A confirmation email was recently requested for this address. Please try again tomorrow.",
      429,
    );
    const count = await db.query(
      "SELECT COUNT(*)::int AS count FROM stillbounds_review_subscribers WHERE version_id=$1",
      [versionId],
    );
    const existing = await db.query(
      "SELECT id FROM stillbounds_review_subscribers WHERE version_id=$1 AND email=$2",
      [versionId, email],
    );
    assertStudio(
      existing.rows.length || Number(count.rows[0].count) < 20,
      "This review has reached its email subscriber limit.",
      409,
    );
    const code = String(randomInt(100000, 1000000)),
      manage = secret();
    const subscriber = await db.query(
      `INSERT INTO stillbounds_review_subscribers(id,version_id,email,pending_reminders,code_hash,code_expires_at,manage_hash,encrypted_manage)
      VALUES($1,$2,$3,$4,$5,NOW()+INTERVAL '15 minutes',$6,$7)
      ON CONFLICT(version_id,email) DO UPDATE SET code_hash=$5,code_expires_at=NOW()+INTERVAL '15 minutes',pending_reminders=$4,code_attempts=0 RETURNING id`,
      [
        randomUUID(),
        versionId,
        email,
        input.reminders,
        hash(code),
        hash(manage),
        encryptCode(manage),
      ],
    );
    await db.query(
      "INSERT INTO stillbounds_review_outbox(id,version_id,kind,subscriber_id,payload) VALUES($1,$2,'verify',$3,$4::jsonb)",
      [
        hash(`verify:${subscriber.rows[0].id}:${hash(code)}`),
        versionId,
        subscriber.rows[0].id,
        JSON.stringify({
          encryptedCode: encryptCode(code),
          codeHash: hash(code),
        }),
      ],
    );
  });
}
export async function confirmReviewEmails(
  versionId: string,
  tokenHash: string,
  input: Record<string, unknown>,
) {
  const email = reviewEmail(input.email);
  assertStudio(
    typeof input.code === "string" && /^\d{6}$/.test(input.code),
    "Enter the six-digit code from your email.",
  );
  const code = input.code;
  const confirmed = await studioTransaction(async (db) => {
    const current = await db.query(
      `SELECT id FROM stillbounds_versions WHERE id=$1 AND state='published' AND expires_at>NOW() FOR UPDATE`,
      [versionId],
    );
    assertStudio(current.rows.length, "Review unavailable.", 410);
    // Commit failed attempts too, so changing IP or browser cannot reset the budget.
    const attempt = await db.query(
      `UPDATE stillbounds_review_subscribers SET code_attempts=code_attempts+1
      WHERE version_id=$1 AND email=$2 AND code_expires_at>NOW() AND code_attempts<6 RETURNING id,code_hash`,
      [versionId, email],
    );
    if (!attempt.rows.length || attempt.rows[0].code_hash !== hash(code))
      return false;
    await db.query(
      `UPDATE stillbounds_review_subscribers SET verified_at=NOW(),reminders=pending_reminders,code_hash=NULL,code_expires_at=NULL WHERE id=$1`,
      [attempt.rows[0].id],
    );
    await db.query(
      "UPDATE stillbounds_viewers SET subscriber_id=$3 WHERE token_hash=$2 AND version_id=$1",
      [versionId, tokenHash, attempt.rows[0].id],
    );
    await db.query(reminderSQL, [versionId, attempt.rows[0].id]);
    return true;
  });
  assertStudio(
    confirmed,
    "That code is incorrect, expired, or has had too many attempts. Request another confirmation email.",
  );
}
export async function emailPreferences(versionId: string, tokenHash: string) {
  const { rows } = await studioQuery(
    `SELECT s.email,s.reminders FROM stillbounds_review_subscribers s JOIN stillbounds_viewers v ON v.subscriber_id=s.id
    WHERE v.version_id=$1 AND v.token_hash=$2 AND s.version_id=$1 AND s.verified_at IS NOT NULL`,
    [versionId, tokenHash],
  );
  return rows[0] ?? null;
}
export async function stopReviewEmails(versionId: string, token: unknown) {
  assertStudio(
    typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token),
    "Invalid email preference link.",
  );
  await studioQuery(
    "DELETE FROM stillbounds_review_subscribers WHERE version_id=$1 AND manage_hash=$2",
    [versionId, hash(token)],
  );
}
const reminderSQL = `INSERT INTO stillbounds_review_outbox(id,version_id,kind,subscriber_id,next_attempt_at)
    SELECT 'reminder:'||s.id::text,v.id,'reminder',s.id,GREATEST(NOW()+INTERVAL '15 minutes',v.expires_at-INTERVAL '24 hours')
    FROM stillbounds_review_subscribers s JOIN stillbounds_versions v ON v.id=s.version_id
    WHERE s.verified_at IS NOT NULL AND s.reminders=TRUE AND v.state='published' AND v.decision!='approved'
    AND v.expires_at>NOW()+INTERVAL '2 hours' AND ($1::uuid IS NULL OR v.id=$1) AND ($2::uuid IS NULL OR s.id=$2)
    ON CONFLICT(id) DO NOTHING`;
export async function queueReviewReminders() {
  // Schedule once at confirmation; the daily sweep also repairs missing schedules.
  // Late opt-ins get a short delay instead of missing the next daily sweep.
  await studioQuery(reminderSQL, [null, null]);
}
export function manageLink(
  origin: string,
  versionId: string,
  encrypted: string,
) {
  return `${origin}/stillbounds/review/email-preferences#review=${versionId}&token=${decryptCode(encrypted)}`;
}
