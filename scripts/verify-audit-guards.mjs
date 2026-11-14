import {LicensingStore} from '../lib/stillbounds/billing-store.ts';
// Exercises actual route/notification code using a disposable database namespace.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import pg from 'pg';
import ts from 'typescript';
import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());
const dependency=createRequire(import.meta.url), schema='audit_guards_'+randomBytes(8).toString('hex');
const databaseUrl=new URL(process.env.DATABASE_URL);databaseUrl.searchParams.set('sslmode','verify-full');databaseUrl.searchParams.delete('uselibpqcompat');
const pool=new pg.Pool({connectionString:databaseUrl.href,ssl:{rejectUnauthorized:true},max:3});
async function transaction(work){const c=await pool.connect();try{await c.query('BEGIN');await c.query(`SET LOCAL search_path TO "${schema}"`);const result=await work(c);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
function load(file,mocks){const compiledModule={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:compiledModule,exports:compiledModule.exports,require:name=>name in mocks?mocks[name]:dependency(name),Buffer,URL,console,process:{env:{SMTP_USER:'test@example.test',SMTP_PASS:'not-a-real-secret'}}});return compiledModule.exports;}
let created=false;
try{
 await pool.query(`CREATE SCHEMA "${schema}"`);created=true;
 await transaction(async c=>{
  await c.query('CREATE TABLE galleries(id INTEGER PRIMARY KEY)');
  await c.query('CREATE TABLE gallery_documents(id INTEGER PRIMARY KEY,gallery_id INTEGER REFERENCES galleries(id) ON DELETE CASCADE,paid_at TIMESTAMPTZ)');
  await c.query('INSERT INTO galleries VALUES(1),(2)');await c.query('INSERT INTO gallery_documents VALUES(1,1,NOW())');
  await c.query('CREATE TABLE payment_orders(reference TEXT PRIMARY KEY,status TEXT,email TEXT,title TEXT,kind TEXT,shop_section TEXT,amount_kobo BIGINT)');
  await c.query('CREATE TABLE payment_notifications(reference TEXT PRIMARY KEY,created_at TIMESTAMPTZ DEFAULT NOW(),sent_at TIMESTAMPTZ,claimed_at TIMESTAMPTZ,attempts INTEGER DEFAULT 0)');
  await c.query("INSERT INTO payment_orders VALUES('audit-reference','paid','buyer@example.test','MELATONE','digital','photography',2000000)");
  await c.query("INSERT INTO payment_notifications(reference) VALUES('audit-reference')");
  await c.query("CREATE TABLE newsletter_subscribers(id SERIAL PRIMARY KEY,email TEXT,list_type TEXT,status TEXT,unsubscribe_token TEXT UNIQUE,subscribed_at TIMESTAMPTZ DEFAULT NOW(),unsubscribed_at TIMESTAMPTZ,last_emailed_at TIMESTAMPTZ,UNIQUE(email,list_type))");
  await c.query(load('lib/newsletter/schema.ts',{}).newsletterSchema);
 });
 const route=load('app/api/galleries/route.ts',{'@/lib/db':{transaction},'@/lib/auth':{requireAdmin:()=>null},'@/lib/imagePosition':{},'@/lib/galleryPresentation':{},'@/lib/mediaUrl':{},'@/lib/privateMedia':{}});
 assert.equal((await route.DELETE(new Request('https://example.test/api/galleries?id=1'))).status,409);
 assert.equal((await route.DELETE(new Request('https://example.test/api/galleries?id=2'))).status,200);
 assert.equal((await transaction(c=>c.query('SELECT COUNT(*)::int AS n FROM gallery_documents'))).rows[0].n,1);
 const messages=[];
 const notifications=load('lib/payments/notifications.ts',{
  '../db':{transaction},'../productSections':{productShopPath:()=>'/photography/shop'},'../paystack':{paymentOrigin:()=> 'https://example.test'},'../purchaseAccess':{purchaseSigningKey:()=> 'isolated-test-signing-key'},'./policy':{isPaymentEmail:()=>true,accessProof:()=> 'test-proof'},
  nodemailer:{default:{createTransport:()=>({sendMail:async message=>{
   messages.push(message);
   if(messages.length===1)await transaction(async c=>{await c.query("UPDATE payment_orders SET status='review' WHERE reference='audit-reference'");await c.query("UPDATE payment_notifications SET sent_at=NULL,claimed_at=NULL WHERE reference='audit-reference'");});
   return {accepted:['recipient'],rejected:[]};
  }})}},
 });
 await notifications.deliverPaymentNotifications();assert.equal(messages.length,3);assert.match(messages[2].subject,/needs review/);
 assert((await transaction(c=>c.query('SELECT sent_at FROM payment_notifications'))).rows[0].sent_at);
 const newsletterMail=[];
 const policy=load('lib/payments/policy.ts',{});
 const newsletter=load('lib/newsletter/server.ts',{
  '../db':{transaction,query:(sql,params)=>transaction(c=>c.query(sql,params))},'../payments/policy':policy,
  nodemailer:{default:{createTransport:()=>({sendMail:async message=>{newsletterMail.push(message);return {accepted:['recipient'],rejected:[]};}})}},
 });
 await newsletter.requestNewsletterConfirmation('subscriber@example.test','photography');
 assert.equal(newsletterMail.length,1);
 let subscription=(await transaction(c=>c.query("SELECT * FROM newsletter_subscribers WHERE email='subscriber@example.test'"))).rows[0];
 assert.equal(subscription.status,'pending');
 const confirmToken=new URLSearchParams(new URL(newsletterMail[0].text.match(/https:\/\/[^\s]+/)[0]).hash.slice(1)).get('confirm');
 assert.notEqual(subscription.confirmation_hash,confirmToken);
 await newsletter.requestNewsletterConfirmation('subscriber@example.test','photography');assert.equal(newsletterMail.length,1);
 assert.equal((await newsletter.sendNewsletterCampaign({listType:'all',subject:'Test',text:'Test',html:'<p>Test</p>'})).sentCount,0);
 assert.equal(await newsletter.changeNewsletterPreference('confirm',confirmToken),true);
 assert.equal(await newsletter.changeNewsletterPreference('confirm',confirmToken),false);
 assert.equal((await newsletter.sendNewsletterCampaign({listType:'all',subject:'Test',text:'Test',html:'<p>Test</p>'})).sentCount,1);
 const campaign=newsletterMail.at(-1);assert.equal(campaign.to.address,'subscriber@example.test');assert(!campaign.bcc);assert.match(campaign.text,/#unsubscribe=/);assert.match(campaign.html,/Unsubscribe from photography/);
 const unsubscribeToken=new URLSearchParams(new URL(campaign.text.match(/https:\/\/[^\s]+/)[0]).hash.slice(1)).get('unsubscribe');
 assert.equal(await newsletter.changeNewsletterPreference('unsubscribe','f'.repeat(64)),false);
 assert.equal(await newsletter.changeNewsletterPreference('unsubscribe',unsubscribeToken),true);
 await transaction(c=>c.query("UPDATE newsletter_subscribers SET confirmation_requested_at=NOW()-INTERVAL '2 hours'"));
 await newsletter.requestNewsletterConfirmation('subscriber@example.test','photography');
 subscription=(await transaction(c=>c.query("SELECT * FROM newsletter_subscribers WHERE email='subscriber@example.test'"))).rows[0];assert.equal(subscription.status,'unsubscribed');
 const nextToken=new URLSearchParams(new URL(newsletterMail.at(-1).text.match(/https:\/\/[^\s]+/)[0]).hash.slice(1)).get('confirm');
 // Withdrawing again invalidates a pending reactivation link.
 assert.equal(await newsletter.changeNewsletterPreference('unsubscribe',unsubscribeToken),true);
 assert.equal(await newsletter.changeNewsletterPreference('confirm',nextToken),false);
 assert.equal((await newsletter.sendNewsletterCampaign({listType:'all',subject:'Test',text:'Test',html:'<p>Test</p>'})).sentCount,0);
 await transaction(c=>c.query("UPDATE newsletter_subscribers SET confirmation_requested_at=NOW()-INTERVAL '2 hours'"));
 await newsletter.requestNewsletterConfirmation('subscriber@example.test','photography');
 const expiredToken=new URLSearchParams(new URL(newsletterMail.at(-1).text.match(/https:\/\/[^\s]+/)[0]).hash.slice(1)).get('confirm');
 await transaction(c=>c.query("UPDATE newsletter_subscribers SET confirmation_expires_at=NOW()-INTERVAL '1 second'"));assert.equal(await newsletter.changeNewsletterPreference('confirm',expiredToken),false);
 const photoToken=randomBytes(32).toString('hex'),artToken=randomBytes(32).toString('hex'),otherToken=randomBytes(32).toString('hex');
 await transaction(async c=>{await c.query("INSERT INTO newsletter_subscribers(email,list_type,status,unsubscribe_token) VALUES('both@example.test','photography','active',$1),('both@example.test','art','active',$2),('other@example.test','art','active',$3)",[photoToken,artToken,otherToken]);});
 const beforeCampaign=newsletterMail.length;
 const campaignResult=await newsletter.sendNewsletterCampaign({listType:'all',subject:'Test',text:'Test',html:'<p>Test</p>'});assert.equal(campaignResult.sentCount,2);
 const personal=newsletterMail.slice(beforeCampaign),both=personal.find(m=>m.to.address==='both@example.test'),other=personal.find(m=>m.to.address==='other@example.test');
 assert(both.text.includes(photoToken)&&both.text.includes(artToken));assert(!both.text.includes(otherToken));assert(other.text.includes(otherToken)&&!other.text.includes(photoToken));
 await newsletter.changeNewsletterPreference('unsubscribe',photoToken);
 const lists=(await transaction(c=>c.query("SELECT list_type,status FROM newsletter_subscribers WHERE email='both@example.test'"))).rows;
 assert.equal(lists.find(r=>r.list_type==='photography').status,'unsubscribed');assert.equal(lists.find(r=>r.list_type==='art').status,'active');
 await transaction(c=>c.query(fs.readFileSync('lib/stillbounds/billing-schema.sql','utf8')));
 const licensing=new LicensingStore(pool,schema);
 const reference='sb-test-22222222-2222-4222-8222-222222222222',userId='isolated-refund-account',email='licence@example.test';
 await licensing.createOrder({reference,mode:'test',userId,email,amount:3000000,currency:'NGN',status:'pending'});
 await licensing.fulfill('test',reference,{id:9910001,reference,domain:'test',status:'success',amount:3000000,currency:'NGN',customer:{email},metadata:{product:'stillbounds-perpetual-v1',user_id:userId}});
 await licensing.revoke('test',reference,'refunded','partial-refund-fixture','refund.processed',1000000);
 assert.equal((await licensing.status('test',userId)).account.paid,true);
 await licensing.revoke('test',reference,'refunded','missing-amount-fixture','refund.processed');
 const quarantined=(await licensing.status('test',userId)).account;assert.equal(quarantined.paid,false);assert.equal(quarantined.blocked,true);
 assert.equal((await licensing.order('test',reference)).status,'disputed');
 console.log('PASS licensing PostgreSQL: valid partial refund preserves access; ambiguous processed refund blocks further entitlement pending support review.');
 console.log('PASS newsletter PostgreSQL: pending opt-in, recipient resend cooldown, hashed single-use confirmation, recipient-specific unsubscribe, withdrawal invalidates reactivation, no campaign mail to pending/withdrawn addresses. All email captured.');
 console.log('PASS actual PostgreSQL: gallery deletion retains financial documents; stale paid-receipt delivery cannot suppress a queued review alert. All email captured; disposable schema only.');
}finally{if(created)await pool.query(`DROP SCHEMA "${schema}" CASCADE`);await pool.end();}
