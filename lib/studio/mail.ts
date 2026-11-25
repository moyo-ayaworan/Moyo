import { randomUUID } from "node:crypto";
import { newsletterTransport } from "../newsletter/mail";
import { studioQuery, studioTransaction } from "./db";
import { decryptCode } from "./protocol";
import {
  manageLink,
  receiptText,
  reviewEmail,
  type Receipt,
} from "./engagement";

export function reviewMailOrigin() {
  const url = new URL(
    process.env.STILLBOUNDS_AUTH_URL ||
      process.env.PAYMENT_ORIGIN ||
      "https://moyoayaworan.com",
  );
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw Error("Review email origin is not configured.");
  return url.origin;
}
type Job = {
  id: string;
  version_id: string;
  kind: string;
  subscriber_id: string | null;
  payload: { encryptedCode?: string; codeHash?: string; receiptId?: string };
  lease: string;
  attempts: number;
};
export async function deliverReviewMail(
  options: { limit?: number; deadline?: number } = {},
) {
  const summary = { delivered: 0, deferred: 0 };
  const deadline = options.deadline ?? Date.now() + 20000;
  let transport: ReturnType<typeof newsletterTransport>;
  let origin: string;
  try {
    transport = newsletterTransport();
    origin = reviewMailOrigin();
  } catch {
    try {
      const pending = await studioQuery(
        "SELECT COUNT(*)::int AS count FROM stillbounds_review_outbox WHERE sent_at IS NULL AND discarded=FALSE AND next_attempt_at<=NOW() AND (lease_until IS NULL OR lease_until<NOW())",
      );
      return { delivered: 0, deferred: Number(pending.rows[0]?.count || 0) };
    } catch {
      return { delivered: 0, deferred: 1 };
    }
  }
  try {
    for (
      let i = 0;
      i < (options.limit ?? 3) && Date.now() < deadline - 1000;
      i++
    ) {
      const job = await studioTransaction(async (db) => {
        const candidate =
          await db.query(`SELECT id,version_id,kind,subscriber_id,payload,attempts FROM stillbounds_review_outbox
          WHERE sent_at IS NULL AND discarded=FALSE AND next_attempt_at<=NOW() AND attempts<12
          AND (lease_until IS NULL OR lease_until<NOW()) ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED`);
        if (!candidate.rows.length) return null;
        const lease = randomUUID();
        await db.query(
          `UPDATE stillbounds_review_outbox SET lease=$2,lease_until=NOW()+INTERVAL '90 seconds',attempts=attempts+1 WHERE id=$1`,
          [candidate.rows[0].id, lease],
        );
        return { ...candidate.rows[0], lease } as Job;
      });
      if (!job) break;
      try {
        // Recheck current state after claiming: approval, revocation and unsubscribe
        // cancel queued reminders instead of sending stale messages.
        const current = await studioQuery(
          `SELECT v.*,s.email,s.verified_at,s.reminders,s.code_hash,s.code_expires_at,s.encrypted_manage
          FROM stillbounds_versions v LEFT JOIN stillbounds_review_subscribers s ON s.id=$2 AND s.version_id=v.id
          WHERE v.id=$1 AND v.state='published' AND v.expires_at>NOW()`,
          [job.version_id, job.subscriber_id],
        );
        const version = current.rows[0];
        const validVerification =
          version &&
          job.kind === "verify" &&
          version.code_hash === job.payload.codeHash &&
          new Date(version.code_expires_at).getTime() > Date.now();
        const client = job.subscriber_id !== null;
        const reminder = job.kind === "reminder";
        if (
          !version ||
          (client &&
            !validVerification &&
            (!version.verified_at || job.kind === "verify")) ||
          (reminder &&
            (!version.reminders ||
              version.decision === "approved" ||
              new Date(version.expires_at).getTime() <=
                Date.now() + 2 * 60 * 60 * 1000)) ||
          (!client && !version.notify_owner)
        ) {
          await studioQuery(
            "UPDATE stillbounds_review_outbox SET discarded=TRUE,lease=NULL,lease_until=NULL,payload='{}'::jsonb WHERE id=$1 AND lease=$2",
            [job.id, job.lease],
          );
          continue;
        }
        let recipient = version.email;
        if (!client) {
          if (version.owner_id === "moyo")
            recipient = process.env.CONTACT_EMAIL || "moyoayaworan@gmail.com";
          else {
            const owner = await studioQuery(
              'SELECT email FROM stillbounds_auth_user WHERE id=$1 AND "emailVerified"=TRUE',
              [String(version.owner_id).replace(/^account:/, "")],
            );
            recipient = owner.rows[0]?.email;
          }
          if (!recipient) {
            await studioQuery(
              "UPDATE stillbounds_review_outbox SET discarded=TRUE,lease=NULL,lease_until=NULL WHERE id=$1 AND lease=$2",
              [job.id, job.lease],
            );
            continue;
          }
        }
        recipient = reviewEmail(recipient);
        const title = String(version.title)
          .replace(/[\r\n]/g, " ")
          .slice(0, 100);
        const label = `${title} — version ${version.version}`;
        let subject = "Stillbounds review update";
        let text = "";
        let receipt: Receipt | undefined;
        if (job.payload.receiptId) {
          const record = await studioQuery(
            "SELECT id,approved_at,snapshot FROM stillbounds_approval_receipts WHERE id=$1 AND version_id=$2",
            [job.payload.receiptId, version.id],
          );
          if (!record.rows.length) throw Error("Receipt unavailable");
          receipt = {
            id: record.rows[0].id,
            approvedAt: new Date(record.rows[0].approved_at).toISOString(),
            snapshot: record.rows[0].snapshot,
          };
        }
        const privateLink = `${origin}/stillbounds/review/${version.id}${version.encrypted_code ? `#access=${decryptCode(version.encrypted_code)}` : ""}`;
        if (job.kind === "verify") {
          subject = "Confirm your Stillbounds review emails";
          text = `You requested emails for ${label}.\n\nConfirmation code: ${decryptCode(job.payload.encryptedCode!)}\n\nEnter this code in the review tab where you requested it. The code expires 15 minutes after the request.\n\nIf you did not request this, ignore this email. No review updates or reminders will be sent until you confirm.`;
        } else if (reminder) {
          subject = `Your book review expires soon — ${title}`;
          text = `${label} is awaiting your decision. Its private link expires at ${new Date(version.expires_at).toISOString()}.\n\nReview your book: ${privateLink}\n\nThis is the only expiry reminder for this subscription. Approval stops pending reminders.`;
        } else if (job.kind === "client_reply") {
          subject = `Your photographer replied — ${title}`;
          text = `Your photographer added a reply to feedback on ${label}.\n\nRead the conversation: ${privateLink}`;
        } else if (job.kind === "client_receipt") {
          subject = `Your book approval receipt — ${title}`;
          text = `An authorized reviewer approved ${label}. A dated receipt is attached. Save it before the review expires.\n\n${receipt ? receiptText(receipt) : ""}`;
        } else {
          const action =
            job.kind === "owner_approved"
              ? "was approved"
              : job.kind === "owner_changes"
                ? "has changes requested"
                : "has new client feedback";
          subject = `Book review ${action} — ${title}`;
          text = `${label} ${action}.\n\nOpen your review dashboard: ${origin}${version.owner_id === "moyo" ? "/admin/stillbounds" : "/stillbounds/account#reviews"}${receipt ? `\n\n${receiptText(receipt)}` : ""}`;
        }
        if (client && job.kind !== "verify")
          text += `\n\nKeep your review link private.\nStop review emails: ${manageLink(origin, version.id, version.encrypted_manage)}`;
        const result = await transport.mail.sendMail({
          from: transport.from,
          replyTo: process.env.SMTP_REPLY_TO || transport.from,
          to: { address: recipient, name: "" },
          subject,
          text,
          messageId: `<stillbounds-${job.id.replace(/[^a-zA-Z0-9-]/g, "-")}@${new URL(origin).hostname}>`,
          ...(receipt
            ? {
                attachments: [
                  {
                    filename: `stillbounds-approval-${receipt.id}.txt`,
                    content: receiptText(receipt),
                    contentType: "text/plain; charset=utf-8",
                  },
                ],
              }
            : {}),
        });
        if (!result.accepted?.length || result.rejected?.length)
          throw Error("Mail not accepted");
        await studioQuery(
          `UPDATE stillbounds_review_outbox SET sent_at=NOW(),lease=NULL,lease_until=NULL,payload='{}'::jsonb WHERE id=$1 AND lease=$2`,
          [job.id, job.lease],
        );
        if (reminder)
          await studioQuery(
            `INSERT INTO stillbounds_review_events(id,version_id,kind,actor) VALUES($1,$2,'reminder_sent','system')`,
            [randomUUID(), version.id],
          );
        summary.delivered++;
      } catch {
        await studioQuery(
          `UPDATE stillbounds_review_outbox SET lease=NULL,lease_until=NULL,next_attempt_at=NOW()+(LEAST(60,POWER(2,LEAST(attempts,6)))*INTERVAL '1 minute') WHERE id=$1 AND lease=$2`,
          [job.id, job.lease],
        );
        summary.deferred++;
        console.error("[studio/mail] Delivery deferred; durable job retained");
      }
    }
    const pending = await studioQuery(
      `SELECT COUNT(*)::int AS count FROM stillbounds_review_outbox WHERE sent_at IS NULL AND discarded=FALSE AND next_attempt_at<=NOW() AND (lease_until IS NULL OR lease_until<NOW())`,
    );
    if (Number(pending.rows[0]?.count || 0) > 0 && summary.deferred === 0)
      summary.deferred = Number(pending.rows[0].count);
  } catch {
    summary.deferred++;
    console.error("[studio/mail] Worker deferred; durable jobs retained");
  }
  return summary;
}
