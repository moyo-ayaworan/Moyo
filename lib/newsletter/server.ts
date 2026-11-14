import { createHash, randomBytes } from 'node:crypto';
import nodemailer from 'nodemailer';
import { query, transaction } from '../db';
import { isPaymentEmail } from '../payments/policy';

export const newsletterLists = new Set(['photography', 'art']);
export const validNewsletterToken = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
function origin() {
  const url = new URL(process.env.PAYMENT_ORIGIN || process.env.STILLBOUNDS_BILLING_ORIGIN || 'https://moyo-roan.vercel.app');
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw Error('Newsletter origin is not configured.');
  return url.origin;
}
function transport() {
  const user = process.env.SMTP_USER || process.env.EMAIL_SERVER_USER || process.env.EMAIL_USER || process.env.MAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_SERVER_PASSWORD || process.env.EMAIL_PASS || process.env.MAIL_PASS || process.env.SMTP_PASSWORD;
  const host = process.env.SMTP_HOST || process.env.EMAIL_SERVER_HOST || process.env.EMAIL_HOST || process.env.MAIL_HOST;
  const port = Number(process.env.SMTP_PORT || process.env.EMAIL_SERVER_PORT || process.env.EMAIL_PORT || process.env.MAIL_PORT || 587);
  const secureValue = process.env.SMTP_SECURE || process.env.EMAIL_SECURE || process.env.MAIL_SECURE;
  const from = process.env.SMTP_FROM || process.env.MAIL_FROM || process.env.EMAIL_FROM || user;
  if (!user || !pass || !from) throw Error('Newsletter email is not configured.');
  return { from, mail: nodemailer.createTransport({
    ...(host ? {host,port,secure:secureValue ? secureValue.toLowerCase()==='true' : port===465} : {service:'gmail'}),
    auth:{user,pass},connectionTimeout:5000,greetingTimeout:5000,socketTimeout:10000,
  }) };
}
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
  const result = await config.mail.sendMail({from:config.from,to:{address:email,name:''},subject:`Confirm your ${list} newsletter subscription`,
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
type Recipient = {id:number;email:string;list_type:string;unsubscribe_token:string};
export async function sendNewsletterCampaign(input: {listType:string;subject:string;text:string;html:string}) {
  if (input.listType!=='all' && !newsletterLists.has(input.listType)) throw Error('Invalid newsletter list.');
  const config=transport();
  const recipients=(await query(`SELECT id,email,list_type,unsubscribe_token FROM newsletter_subscribers
    WHERE status='active' AND ($1='all' OR list_type=$1) ORDER BY subscribed_at DESC`,[input.listType])).rows as Recipient[];
  const groups=new Map<string,Recipient[]>();
  for(const recipient of recipients) {
    if(!isPaymentEmail(recipient.email)||!validNewsletterToken(recipient.unsubscribe_token)||!newsletterLists.has(recipient.list_type)) continue;
    const key=recipient.email.toLowerCase();groups.set(key,[...(groups.get(key)||[]),recipient]);
  }
  if(!groups.size) return {sentCount:0,failedCount:0};
  let sentCount=0,failedCount=0;
  const deliveries=Array.from(groups);let cursor=0;
  async function worker() {
   while(cursor<deliveries.length) {
    const [email,subscriptions]=deliveries[cursor++];
    try {
    // Recheck withdrawals while a longer campaign is being delivered.
    const active=(await query("SELECT id FROM newsletter_subscribers WHERE id=ANY($1::int[]) AND status='active'",[subscriptions.map(s=>s.id)])).rows;
    const current=subscriptions.filter(s=>active.some(row=>row.id===s.id));if(!current.length)continue;
    const links=current.map(s=>({list:s.list_type,url:`${origin()}/newsletter/preferences#unsubscribe=${s.unsubscribe_token}`}));
    const footer=links.map(link=>`Unsubscribe from ${link.list}: ${link.url}`).join('\n');
    const htmlFooter='<p style="font-size:12px;line-height:1.6">'+links.map(link=>`<a href="${link.url}">Unsubscribe from ${link.list}</a>`).join('<br>')+'</p>';
    const html=/<\/body>/i.test(input.html)?input.html.replace(/<\/body>/i,htmlFooter+'</body>'):input.html+htmlFooter;
      const result=await config.mail.sendMail({from:config.from,to:{address:email,name:''},subject:input.subject,text:input.text+'\n\n'+footer,html,
        headers:{'List-Unsubscribe':links.map(link=>`<${link.url}>`).join(', ')}});
      if(!result.accepted?.length||result.rejected?.length)throw Error('Mail not accepted');
      await query("UPDATE newsletter_subscribers SET last_emailed_at=NOW() WHERE id=ANY($1::int[]) AND status='active'",[current.map(s=>s.id)]);sentCount++;
    } catch { failedCount++; }
   }
  }
  await Promise.all(Array.from({length:Math.min(3,deliveries.length)},()=>worker()));
  return {sentCount,failedCount};
}
