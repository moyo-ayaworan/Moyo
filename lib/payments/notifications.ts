import { productShopPath } from '../productSections';
import nodemailer from 'nodemailer';
import { transaction } from '../db';
import { paymentOrigin } from '../paystack';
import { purchaseSigningKey } from '../purchaseAccess';
import { accessProof, isPaymentEmail, type PaymentOrder } from './policy';

function transport() {
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
  const host = process.env.SMTP_HOST;
  const from = process.env.SMTP_FROM || process.env.EMAIL_FROM || user;
  if (!user || !pass || !from) return null;
  const port = Number(process.env.SMTP_PORT || 587);
  return { from, mail: nodemailer.createTransport({ ...(host ? { host, port, secure: process.env.SMTP_SECURE === 'true' || port === 465 } : { service: 'gmail' }),
    auth: { user, pass }, connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 10000 }) };
}
// Match the order/notification lock order used by refund and dispute processing.
// A check in a standalone UPDATE can observe an older MVCC snapshot while waiting.
async function finishNotification(order: PaymentOrder, delivered: boolean) {
  await transaction(async client => {
    const current = (await client.query<{ status: string }>('SELECT status FROM payment_orders WHERE reference=$1 FOR UPDATE', [order.reference])).rows[0];
    if (current?.status !== order.status) return;
    await client.query(delivered
      ? 'UPDATE payment_notifications SET sent_at=NOW(),claimed_at=NULL WHERE reference=$1'
      : 'UPDATE payment_notifications SET claimed_at=NOW() WHERE reference=$1', [order.reference]);
  });
}
export async function deliverPaymentNotifications(options: { limit?: number; deadline?: number } = {}) {
  const config = transport(); if (!config) return;
  try {
    const deadline = options.deadline ?? Date.now() + 40000;
    for (let i = 0; i < (options.limit ?? 10) && Date.now() < deadline; i++) {
      const order = await transaction(async c => {
        const row = (await c.query<PaymentOrder>(`SELECT o.* FROM payment_notifications n JOIN payment_orders o ON o.reference=n.reference
          WHERE n.sent_at IS NULL AND (n.claimed_at IS NULL OR n.claimed_at < NOW() - (LEAST(360, POWER(2, LEAST(n.attempts, 8))) * INTERVAL '1 minute'))
          ORDER BY n.claimed_at NULLS FIRST, n.created_at LIMIT 1 FOR UPDATE OF n SKIP LOCKED`)).rows[0];
        if (row) await c.query('UPDATE payment_notifications SET claimed_at=NOW(),attempts=attempts+1 WHERE reference=$1', [row.reference]);
        return row;
      });
      if (!order) return;
      try {
        if (!isPaymentEmail(order.email)) throw Error('Invalid recipient');
        const money = `NGN ${(Number(order.amount_kobo) / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
        let text = `${order.title}\nPayment reference: ${order.reference}\nAmount: ${money}\nStatus: ${order.status}\n`;
        if (order.status === 'paid' && order.kind === 'digital') {
          const expiry = Date.now() + 30 * 86400000;
          const token = `${expiry}.${accessProof(order.reference, order.email, expiry, purchaseSigningKey())}`;
          text += `\nYour protected download (link valid for 30 days):\n${paymentOrigin()}${productShopPath(order.shop_section || 'photography')}/payment?reference=${encodeURIComponent(order.reference)}#access=${token}\n`;
        } else if (order.status === 'paid') text += '\nYour invoice and payment receipt are available in your private client portal. A deposit does not unlock final gallery downloads.\n';
        else text += '\nThe studio will review this payment. Please do not pay again until the studio confirms the next step.\n';
        const studio = process.env.CONTACT_EMAIL || 'moyoayaworan@gmail.com';
        // SMTP failure never rolls back a verified payment. The durable outbox retries it.
        const result = await config.mail.sendMail({ from: config.from, to: { address: order.email, name: '' }, replyTo: { address: studio, name: '' },
          subject: `${order.status === 'paid' ? 'Payment receipt' : 'Payment update'} · ${order.title}`,
          messageId: `<${order.reference}.${order.status}@${new URL(paymentOrigin()).hostname}>`, text });
        if (!result.accepted?.length || result.rejected?.length) throw Error('Mail not accepted');
        if (order.status !== 'paid') {
          const alert = await config.mail.sendMail({ from: config.from, to: studio, subject: `Payment needs review · ${order.reference}`, text: `${text}\nCustomer: ${order.email}\nReview in the admin payment ledger.` });
          if (!alert.accepted?.length || alert.rejected?.length) throw Error('Alert not accepted');
        }
        await finishNotification(order, true);
      } catch { await finishNotification(order, false); }
    }
  } catch { console.error('[payments] Notification delivery deferred; outbox retained.'); }
}
