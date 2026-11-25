import {createHash,randomUUID} from 'node:crypto';
import {query,transaction} from '../db';
import {newsletterOrigin,newsletterTransport} from './mail';
import {isPaymentEmail} from '../payments/policy';
type CampaignInput={requestKey:string;listType:string;subject:string;text:string;html:string};
export async function enqueueNewsletterCampaign(input:CampaignInput){
 if(!/^[a-f0-9-]{36}$/i.test(input.requestKey)||!['all','photography','art'].includes(input.listType)||!input.subject||input.subject.length>200||input.text.length>100000||input.html.length>200000)throw Error('Invalid campaign.');
 const hash=createHash('sha256').update(JSON.stringify([input.listType,input.subject,input.text,input.html])).digest('hex');
 return transaction(async client=>{
  await client.query('SELECT pg_advisory_xact_lock(178931,5)');
  const previous=(await client.query('SELECT id,body_hash FROM newsletter_campaigns WHERE request_key=$1',[input.requestKey])).rows[0];
  if(previous){if(previous.body_hash!==hash)throw Error('This campaign key was already used for different content.');const count=(await client.query('SELECT COUNT(*)::int AS total FROM newsletter_deliveries WHERE campaign_id=$1',[previous.id])).rows[0];return {campaignId:previous.id,queuedCount:count.total,sentCount:0,failedCount:0};}
  const recipients=(await client.query("SELECT id,email FROM newsletter_subscribers WHERE status='active' AND ($1='all' OR list_type=$1) ORDER BY id",[input.listType])).rows;
  const groups=new Map<string,number[]>();for(const row of recipients){const email=String(row.email).toLowerCase();if(isPaymentEmail(email))groups.set(email,[...(groups.get(email)||[]),Number(row.id)]);}
  if(!groups.size)return {campaignId:null,queuedCount:0,sentCount:0,failedCount:0};
  const id=randomUUID();await client.query('INSERT INTO newsletter_campaigns(id,request_key,body_hash,subject,body_text,body_html) VALUES($1,$2,$3,$4,$5,$6)',[id,input.requestKey,hash,input.subject,input.text,input.html]);
  for(const [email,ids] of groups)await client.query('INSERT INTO newsletter_deliveries(campaign_id,email,subscription_ids) VALUES($1,$2,$3)',[id,email,ids]);
  return {campaignId:id,queuedCount:groups.size,sentCount:0,failedCount:0};
 });
}
export async function deliverNewsletterCampaigns(options:{limit?:number;deadline?:number}={}){
 const summary={delivered:0,deferred:0};const config=newsletterTransport();if(!config)return summary;
 const deadline=options.deadline??Date.now()+20000;
 for(let i=0;i<(options.limit??10)&&Date.now()<deadline;i++){
  const job=await transaction(async client=>{
   const row=(await client.query(`SELECT d.*,c.subject,c.body_text,c.body_html FROM newsletter_deliveries d JOIN newsletter_campaigns c ON c.id=d.campaign_id
    WHERE d.sent_at IS NULL AND d.discarded=FALSE AND d.failed_at IS NULL AND (d.claimed_at IS NULL OR d.claimed_at<NOW()-(LEAST(360,POWER(2,LEAST(d.attempts,8)))*INTERVAL '1 minute'))
    ORDER BY d.created_at FOR UPDATE OF d SKIP LOCKED LIMIT 1`)).rows[0];if(!row)return null;
   const lease=randomUUID();await client.query('UPDATE newsletter_deliveries SET claimed_at=NOW(),lease=$3,attempts=attempts+1 WHERE campaign_id=$1 AND email=$2',[row.campaign_id,row.email,lease]);return {...row,lease};
  });if(!job)break;
  try{
   const subscriptions=(await query("SELECT id,list_type,unsubscribe_token FROM newsletter_subscribers WHERE id=ANY($1::int[]) AND LOWER(email)=$2 AND status='active'",[job.subscription_ids,job.email])).rows.filter(row=>['photography','art'].includes(row.list_type)&&/^[a-f0-9]{64}$/.test(row.unsubscribe_token));
   if(!subscriptions.length){await query('UPDATE newsletter_deliveries SET discarded=TRUE,lease=NULL WHERE campaign_id=$1 AND email=$2 AND lease=$3',[job.campaign_id,job.email,job.lease]);continue;}
   const links=subscriptions.map(row=>({list:row.list_type,url:newsletterOrigin()+'/newsletter/preferences#unsubscribe='+row.unsubscribe_token}));
   const footer=links.map(link=>`Unsubscribe from ${link.list}: ${link.url}`).join('\n');
   const htmlFooter='<p>'+links.map(link=>`<a href="${link.url}">Unsubscribe from ${link.list}</a>`).join('<br>')+'</p>';
   const html=/<\/body>/i.test(job.body_html)?job.body_html.replace(/<\/body>/i,htmlFooter+'</body>'):job.body_html+htmlFooter;
   const result=await config.mail.sendMail({from:config.from,replyTo:process.env.SMTP_REPLY_TO||process.env.CONTACT_EMAIL||'moyoayaworan@gmail.com',to:{address:job.email,name:''},subject:job.subject,text:job.body_text+'\n\n'+footer,html,
    messageId:`<campaign-${job.campaign_id}-${createHash('sha256').update(job.email).digest('hex').slice(0,20)}@${new URL(newsletterOrigin()).hostname}>`,headers:{'List-Unsubscribe':links.map(link=>`<${link.url}>`).join(', ')}});
   if(!result.accepted?.length||result.rejected?.length)throw Error('Mail not accepted.');
   await transaction(async client=>{await client.query('UPDATE newsletter_deliveries SET sent_at=NOW(),lease=NULL WHERE campaign_id=$1 AND email=$2 AND lease=$3',[job.campaign_id,job.email,job.lease]);await client.query("UPDATE newsletter_subscribers SET last_emailed_at=NOW() WHERE id=ANY($1::int[]) AND status='active'",[subscriptions.map(row=>row.id)]);});summary.delivered++;
  }catch{await query('UPDATE newsletter_deliveries SET lease=NULL,failed_at=CASE WHEN attempts>=8 THEN NOW() ELSE NULL END WHERE campaign_id=$1 AND email=$2 AND lease=$3',[job.campaign_id,job.email,job.lease]);summary.deferred++;}
 }
 return summary;
}
