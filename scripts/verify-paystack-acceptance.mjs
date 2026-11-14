// Real Paystack SANDBOX transactions; all application writes are confined to a disposable schema.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, generateKeyPairSync } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import pg from 'pg';
import { PaymentStore } from '../lib/payments/store.ts';
import { paymentSchema } from '../lib/payments/schema.ts';
import * as policy from '../lib/payments/policy.ts';
import * as sections from '../lib/productSections.ts';
import { LicensingStore } from '../lib/stillbounds/billing-store.ts';
import { BillingService } from '../lib/stillbounds/billing-service.ts';
import { billingConfig } from '../lib/stillbounds/billing-policy.ts';
import { publicKeyHash, signActivation, verifyLicense } from '../lib/stillbounds/license-proof.ts';
process.loadEnvFile('.env.local');
process.loadEnvFile('.env.development.local');
const secret = process.env.STILLBOUNDS_PAYSTACK_SECRET_KEY;
assert(secret?.startsWith('sk_test_'), 'A sandbox key is mandatory; live keys are never accepted.');
const dbUrl = new URL(process.env.DATABASE_URL); dbUrl.searchParams.set('sslmode','verify-full'); dbUrl.searchParams.delete('uselibpqcompat');
const pool = new pg.Pool({connectionString:dbUrl.href,ssl:{rejectUnauthorized:true},max:4,connectionTimeoutMillis:15000});
const schema = 'paystack_accept_' + randomBytes(8).toString('hex'); let created = false;
const records = [], ownerEmail = 'ijabikenm@gmail.com', token = randomBytes(18).toString('hex');
async function tx(work) { const c = await pool.connect(); try { await c.query('BEGIN'); await c.query(`SET LOCAL search_path TO "${schema}"`); const result = await work(c); await c.query('COMMIT'); return result; } catch (error) { await c.query('ROLLBACK'); throw error; } finally { c.release(); } }
async function provider(path, body) {
  assert(secret.startsWith('sk_test_'));
  const response = await fetch('https://api.paystack.co'+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${secret}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(20000)});
  const result = await response.json();
  if (!response.ok || result.status !== true) throw Error(`Sandbox provider failed: HTTP ${response.status}`);
  return result.data;
}
async function settle(kind, reference, amount, metadata) {
  const result = await provider('/charge',{email:ownerEmail,amount,currency:'NGN',reference,metadata,card:{number:'4084084084084081',cvv:'408',expiry_month:'11',expiry_year:'28'}});
  assert.equal(result.status,'success','Published no-validation sandbox card must complete successfully.');
  const payment = await provider('/transaction/verify/'+encodeURIComponent(reference));
  assert.equal(payment.domain,'test'); assert.equal(payment.reference,reference); assert.equal(payment.status,'success'); assert.equal(payment.amount,amount);
  records.push({kind,reference,domain:'test',amountMinor:amount}); return payment;
}
const keyPair = () => { const pair=generateKeyPairSync('ed25519'); return {privateKey:pair.privateKey.export({type:'pkcs8',format:'pem'}),publicKey:pair.publicKey.export({type:'spki',format:'pem'})}; };
try {
  await pool.query(`CREATE SCHEMA "${schema}"`); created=true;
  await tx(async c => {
    await c.query(`CREATE TABLE galleries(id SERIAL PRIMARY KEY,payment_verified BOOLEAN DEFAULT FALSE);
      CREATE TABLE gallery_documents(id SERIAL PRIMARY KEY,gallery_id INTEGER,document_type TEXT DEFAULT 'invoice',title TEXT DEFAULT 'Sandbox invoice',client_email TEXT,amount NUMERIC DEFAULT 100000,currency TEXT DEFAULT 'NGN',billing_details JSONB DEFAULT '{"depositAmount":30000,"sessionDate":"2026-12-01"}',payments JSONB NOT NULL DEFAULT '[]',paid_at TIMESTAMPTZ,updated_at TIMESTAMPTZ DEFAULT NOW());
      CREATE TABLE bookings(id SERIAL PRIMARY KEY,gallery_id INTEGER,manage_token TEXT,status TEXT DEFAULT 'invoiced');
      CREATE TABLE art_inquiries(id SERIAL PRIMARY KEY,gallery_id INTEGER,manage_token TEXT,status TEXT DEFAULT 'quoted');
      CREATE TABLE digital_products(id SERIAL PRIMARY KEY,title TEXT,price TEXT,product_url TEXT,is_active BOOLEAN DEFAULT TRUE);
      CREATE TABLE digital_orders(reference TEXT,product_id INTEGER,customer_email TEXT,amount_kobo BIGINT,currency TEXT,status TEXT,provider_reference TEXT,paid_at TIMESTAMPTZ,created_at TIMESTAMPTZ DEFAULT NOW());`);
    await c.query(paymentSchema);
    await c.query(await readFile(new URL('../lib/stillbounds/billing-schema.sql',import.meta.url),'utf8'));
    const asset=(await c.query('SELECT product_url FROM public.digital_products WHERE id=1')).rows[0]?.product_url; assert(asset);
    await c.query("INSERT INTO digital_products(title,price,product_url) VALUES('Sandbox MELATONE','₦20,000',$1)",[asset]);
    await c.query('INSERT INTO galleries DEFAULT VALUES');
    await c.query('INSERT INTO gallery_documents(gallery_id,client_email) VALUES(1,$1)',[ownerEmail]);
    await c.query('INSERT INTO bookings(gallery_id,manage_token) VALUES(1,$1)',[token]);
  });
  const store = new PaymentStore(tx);
  const digital = await store.createDigital(1,ownerEmail,'test',randomUUID(),'photography');
  const digitalPayment = await settle('digital',digital.reference,Number(digital.amount_kobo),digital.metadata);
  await store.fulfill(digital.reference,digitalPayment); await store.fulfill(digital.reference,digitalPayment);
  assert.equal((await store.order(digital.reference)).status,'paid');
  assert.equal((await tx(c=>c.query('SELECT COUNT(*)::int AS n FROM payment_events WHERE reference=$1',[digital.reference]))).rows[0].n,1);
  // Read the real private asset only after the genuine sandbox transaction is verified in the isolated ledger.
  const {temporaryOriginalUrl} = await import('../lib/privateMedia.ts');
  const delivery = await fetch(temporaryOriginalUrl(digital.delivery_url),{headers:{Range:'bytes=0-0'},redirect:'error',signal:AbortSignal.timeout(20000)});
  assert(delivery.ok); await delivery.body?.cancel();
  console.log('Sandbox shop payment independently verified; private delivery works.');
  const deposit = await store.createInvoice(1,token,'deposit','test');
  await store.fulfill(deposit.reference,await settle('deposit',deposit.reference,Number(deposit.amount_kobo),deposit.metadata));
  assert.equal((await tx(c=>c.query('SELECT payment_verified FROM galleries WHERE id=1'))).rows[0].payment_verified,false);
  const balance = await store.createInvoice(1,token,'balance','test');
  await store.fulfill(balance.reference,await settle('balance',balance.reference,Number(balance.amount_kobo),balance.metadata));
  assert.equal((await tx(c=>c.query('SELECT payment_verified FROM galleries WHERE id=1'))).rows[0].payment_verified,true);
  console.log('Sandbox deposit and balance verified; delivery unlocked only after full settlement.');
  // Exercise the actual notification implementation with captured mail, never emailing fixture recovery links.
  const recoveryKey = randomBytes(32).toString('hex'), captured = [];
  const mocks = {
    '../productSections':sections,
    nodemailer:{createTransport:()=>({sendMail:async mail=>{captured.push(mail);return {accepted:[ownerEmail],rejected:[]};}})},
    '../db':{transaction:tx,query:(sql,params)=>tx(c=>c.query(sql,params))},
    '../paystack':{paymentOrigin:()=> 'https://sandbox.example.test'},
    '../purchaseAccess':{purchaseSigningKey:()=>recoveryKey},
    './policy':policy,
  };
  const compiled=ts.transpileModule(await readFile(new URL('../lib/payments/notifications.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  const compiledModule={exports:{}};
  vm.runInNewContext(compiled,{module:compiledModule,exports:compiledModule.exports,require:name=>{if(!(name in mocks))throw Error('Unexpected notification dependency');return mocks[name];},process:{env:{SMTP_USER:'fixture@example.test',SMTP_PASS:'fixture'}},console,URL,Date,Buffer});
  await compiledModule.exports.deliverPaymentNotifications(); await compiledModule.exports.deliverPaymentNotifications();
  assert.equal(captured.length,3);
  const receipt=captured.find(mail=>mail.text.includes(digital.reference));assert(receipt);assert.equal(receipt.to.address,ownerEmail);assert(receipt.text.includes('NGN 20,000.00'));
  const recoveryUrl=new URL(receipt.text.match(/https:\/\/sandbox\.example\.test\/[^\s]+/)[0]);
  assert.equal(recoveryUrl.pathname,'/photography/shop/payment');
  const proof=new URLSearchParams(recoveryUrl.hash.slice(1)).get('access');assert(policy.validAccessProof(digital.reference,ownerEmail,proof,recoveryKey));
  assert.equal((await tx(c=>c.query('SELECT COUNT(*)::int AS n FROM payment_notifications WHERE sent_at IS NULL'))).rows[0].n,0);
  console.log('Receipt outbox, customer binding, correct return page and recovery proof verified with captured mail.');
  const licensing=new LicensingStore(pool,schema), user={id:'sandbox-'+randomUUID(),email:ownerEmail,emailVerified:true};
  const order={reference:'sb-test-'+randomUUID(),mode:'test',userId:user.id,email:ownerEmail,amount:3000000,currency:'NGN',status:'pending'};
  await licensing.createOrder(order);
  const appPayment=await settle('stillbounds',order.reference,order.amount,{product:'stillbounds-perpetual-v1',user_id:user.id});
  await licensing.fulfill('test',order.reference,appPayment);
  const signing=keyPair(),device=keyPair();
  const service=new BillingService(billingConfig({STILLBOUNDS_BILLING_MODE:'test',STILLBOUNDS_LICENSING_ENABLED:'true',STILLBOUNDS_CHECKOUT_ENABLED:'true',STILLBOUNDS_PAYSTACK_SECRET_KEY:secret,STILLBOUNDS_LICENSE_PRIVATE_KEY:signing.privateKey,STILLBOUNDS_BILLING_ORIGIN:'https://sandbox.example.test'}),licensing,provider);
  const challenge=await licensing.challenge('test',user.id,{deviceId:'a'.repeat(64),name:'Sandbox acceptance device',publicKey:device.publicKey});
  const activated=await service.activate(user,challenge.id,signActivation(challenge.message,device.privateKey));
  const expected={issuer:'https://sandbox.example.test',environment:'test',deviceId:'a'.repeat(64),deviceKey:publicKeyHash(device.publicKey)};
  const claims=verifyLicense(activated.certificate,signing.publicKey,expected);assert.equal(claims?.kind,'paid');
  assert.equal(verifyLicense(activated.certificate,signing.publicKey,{...expected,environment:'live'}),null);
  console.log('Genuine sandbox Stillbounds purchase produced a device-bound test licence; live environment rejects it.');
  const evidence={completedAt:new Date().toISOString(),sandboxOnly:true,realMoneyCharged:false,applicationWritesIsolated:true,providerTransactions:records,shopVerified:true,privateDeliveryWorks:true,duplicateCreditPrevented:true,depositAndBalanceVerified:true,receiptMessagesCaptured:captured.length,recoveryProofVerified:true,stillboundsPaidActivationVerified:true,testLicenceRejectedAsLive:true,realMailboxDeliveryNotTested:true};
  await writeFile('output/paystack-acceptance-verification.json',JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify({...evidence,providerTransactions:records.length},null,2));
} finally {if(created)await pool.query(`DROP SCHEMA "${schema}" CASCADE`);await pool.end();}
