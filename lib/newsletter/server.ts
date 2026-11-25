import { createHash, randomBytes } from 'node:crypto';
import { query, transaction } from '../db';
import { isPaymentEmail } from '../payments/policy';

export const newsletterLists = new Set(['photography', 'art']);
export const validNewsletterToken = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
import {newsletterOrigin as origin,newsletterTransport as transport} from './mail';
import {enqueueNewsletterCampaign} from './queue';
export async function requestNewsletterConfirmation(email: string, list: string) {
  if (!isPaymentEmail(email) || !newsletterLists.has(list)) throw Error('Invalid subscription.');
  const config = transport(), token = randomBytes(32).toString('hex'), hash = tokenHash(token);
  const reserved = await transaction(async client => {
    await client.query(`INSERT INTO newsletter_subscribers(email,list_type,status,unsubscribe_token)
      VALUES($1,$2,'pending',$3) ON CONFLICT(email,list_type) DO NOTHING`, [email,list,randomBytes(32).toString('hex')]);
    const row = (await client.query<{id:number;status:string;confirmation_requested_at:Date|null}>(
      'SELECT id,status,confirmation_requested_at FROM newsletter_subscribers WHERE email=$1 AND list_type=$2 FOR UPDATE', [email,list])).rows[0];
    if (row.status==='active' || (row.confirmation_requested_at && row.confirmation_requested_at.getTime()>Date.now()-3600000)) return null;
    await client.query(`UPDATE newsletter_subscribers SET confirmation_hash=$2,confirmation_expires_at=NOW()+INTERVAL '24 hours',confirmation_requested_at=NOW() WHERE id=$1`,[row.id,hash]);
    return row.id;
  });
  if (reserved===null) return;
  // A fragment keeps this bearer token out of HTTP access logs and referrers.
  const link = `${origin()}/newsletter/preferences#confirm=${token}`;
  const result = await config.mail.sendMail({from:config.from,replyTo:process.env.SMTP_REPLY_TO || process.env.CONTACT_EMAIL || 'moyoayaworan@gmail.com',to:{address:email,name:''},subject:`Confirm your ${list} newsletter subscription`,
    messageId:`<newsletter-confirm-${hash}@${new URL(origin()).hostname}>`,
    text:`Confirm that you want ${list} updates from Ijabiken Moyo:\n${link}\n\nThis link expires in 24 hours. Open it and press Confirm subscription. If you did not request this, ignore this email; your subscription will not be activated.`,
  });
  if (!result.accepted?.length || result.rejected?.length) throw Error('Confirmation email was not accepted.');
}
export async function changeNewsletterPreference(action: 'confirm'|'unsubscribe', token: string) {
  if (!validNewsletterToken(token)) return false;
  if (action==='confirm') {
    const result = await query(`UPDATE newsletter_subscribers SET status='active',confirmed_at=NOW(),subscribed_at=NOW(),unsubscribed_at=NULL,
      confirmation_hash=NULL,confirmation_expires_at=NULL WHERE confirmation_hash=$1 AND confirmation_expires_at>NOW() RETURNING id`,[tokenHash(token)]);
    return result.rows.length>0;
  }
  const result = await query(`UPDATE newsletter_subscribers SET status='unsubscribed',unsubscribed_at=COALESCE(unsubscribed_at,NOW()),
    confirmation_hash=NULL,confirmation_expires_at=NULL WHERE unsubscribe_token=$1 RETURNING id`,[token]);
  return result.rows.length>0;
}
export const sendNewsletterCampaign=enqueueNewsletterCampaign;
