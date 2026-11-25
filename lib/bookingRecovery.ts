import { createHash, randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
import { query, transaction } from './db';
import { bookingOrigin } from './bookingOrigin';

export async function enqueueBookingRecovery(reference: number, email: string) {
  // The same recipient/reference creates one job per hour, across all IPs.
  const id = createHash('sha256').update(`${reference}:${email}:${Math.floor(Date.now() / 3600000)}`).digest('hex');
  await query(`INSERT INTO booking_recovery_outbox(id,booking_reference,email) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING`, [id, reference, email]);
}

function transport() {
  const user = process.env.SMTP_USER || process.env.EMAIL_SERVER_USER || process.env.EMAIL_USER || process.env.MAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_SERVER_PASSWORD || process.env.EMAIL_PASS || process.env.MAIL_PASS || process.env.SMTP_PASSWORD;
  const host = process.env.SMTP_HOST || process.env.EMAIL_SERVER_HOST || process.env.EMAIL_HOST || process.env.MAIL_HOST;
  const port = Number(process.env.SMTP_PORT || process.env.EMAIL_SERVER_PORT || process.env.EMAIL_PORT || process.env.MAIL_PORT || 587);
  const secure = (process.env.SMTP_SECURE || process.env.EMAIL_SECURE || process.env.MAIL_SECURE || String(port === 465)) === 'true';
  const from = process.env.SMTP_FROM || process.env.MAIL_FROM || process.env.EMAIL_FROM || user;
  if (!user || !pass || !from) return null;
  return { from, mail: nodemailer.createTransport({ ...(host ? { host, port, secure } : { service: 'gmail' }), auth: { user, pass }, connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 10000 }) };
}

type Job = { id: string; booking_reference: number; email: string; admitted_at: string | null; lease: string };
export async function deliverBookingRecovery(options: { limit?: number; deadline?: number } = {}) {
  const summary = { delivered: 0, deferred: 0 };
  const deadline = options.deadline ?? Date.now() + 25000;
  try {
    const config = transport();
    // Queue addresses are temporary operational data, not a permanent transcript.
    await query("DELETE FROM booking_recovery_outbox WHERE created_at<NOW()-INTERVAL '3 days'");
    if (!config) {
      const pending = await query("SELECT COUNT(*)::int AS pending FROM booking_recovery_outbox WHERE sent_at IS NULL AND discarded=FALSE AND created_at>NOW()-INTERVAL '2 days'");
      if (Number(pending.rows[0]?.pending || 0)) summary.deferred++;
      return summary;
    }
    for (let i = 0; i < (options.limit ?? 3) && Date.now() < deadline; i++) {
      const job = await transaction(async client => {
        const candidate = (await client.query<Job>(`SELECT id,booking_reference,email,admitted_at FROM booking_recovery_outbox
          WHERE sent_at IS NULL AND discarded=FALSE AND created_at>NOW()-INTERVAL '2 days'
            AND (claimed_at IS NULL OR claimed_at<NOW()-(LEAST(60,POWER(2,LEAST(attempts,6)))*INTERVAL '1 minute'))
          ORDER BY claimed_at NULLS FIRST,created_at LIMIT 1 FOR UPDATE SKIP LOCKED`)).rows[0];
        if (!candidate) return null;
        const lease = randomUUID();
        await client.query('UPDATE booking_recovery_outbox SET claimed_at=NOW(),lease=$2,attempts=attempts+1 WHERE id=$1', [candidate.id, lease]);
        return { ...candidate, lease };
      });
      if (!job) return summary;
      try {
        const booking = (await query(`SELECT id,email,manage_token FROM bookings WHERE id=$1 AND LOWER(email)=$2 LIMIT 1`, [job.booking_reference, job.email])).rows[0];
        if (!booking) {
          await query('UPDATE booking_recovery_outbox SET discarded=TRUE,lease=NULL WHERE id=$1 AND lease=$2', [job.id, job.lease]);
          continue;
        }
        if (!job.admitted_at) {
          const recipientKey = createHash('sha256').update(`booking-recovery-recipient:${String(booking.email).toLowerCase()}`).digest('hex');
          // Counter admission and job state commit together. A worker crash cannot
          // consume the recipient budget without leaving a retryable admitted job.
          const admitted = await query(`WITH budget AS (
            INSERT INTO request_rate_limits(rate_key,hits,window_start) VALUES($3,1,NOW())
            ON CONFLICT(rate_key) DO UPDATE SET
              hits=CASE WHEN request_rate_limits.window_start<NOW()-INTERVAL '1 hour' THEN 1 ELSE request_rate_limits.hits+1 END,
              window_start=CASE WHEN request_rate_limits.window_start<NOW()-INTERVAL '1 hour' THEN NOW() ELSE request_rate_limits.window_start END
            RETURNING hits
          ) UPDATE booking_recovery_outbox SET admitted_at=NOW() FROM budget
            WHERE id=$1 AND lease=$2 AND budget.hits<=1 RETURNING id`, [job.id, job.lease, recipientKey]);
          if (!admitted.rows.length) {
            await query('UPDATE booking_recovery_outbox SET discarded=TRUE,lease=NULL WHERE id=$1 AND lease=$2', [job.id, job.lease]);
            continue;
          }
        }
        const result = await config.mail.sendMail({ from: config.from, replyTo: process.env.SMTP_REPLY_TO || process.env.CONTACT_EMAIL || 'moyoayaworan@gmail.com', to: { address: booking.email, name: '' },
          subject: `Your booking tracking link - #${booking.id}`, messageId: `<booking-recovery-${job.id}@${new URL(bookingOrigin()).hostname}>`,
          text: `Use this private link to track booking #${booking.id}: ${bookingOrigin()}/client/booking/${booking.manage_token}\n\nDo not share this link. If you did not request this email, you can ignore it.` });
        if (!result.accepted?.length || result.rejected?.length) throw Error('Mail not accepted');
        await query('UPDATE booking_recovery_outbox SET sent_at=NOW(),lease=NULL WHERE id=$1 AND lease=$2', [job.id, job.lease]);
        summary.delivered++;
      } catch {
        // Retain the claim timestamp for backoff and the admitted flag for safe retry.
        summary.deferred++;
        console.error('[bookings/recovery] Delivery deferred; durable job retained');
      }
    }
  } catch { summary.deferred++; console.error('[bookings/recovery] Worker deferred; durable jobs retained'); }
  return summary;
}
