// Isolated PostgreSQL and Paystack TEST integration check. Never grants a live licence.
import {readFile} from 'node:fs/promises';
import {randomUUID,randomBytes,generateKeyPairSync} from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';
import {LicensingStore} from '../lib/stillbounds/billing-store.ts';
import {BillingService,paystackTransport} from '../lib/stillbounds/billing-service.ts';
import {billingConfig} from '../lib/stillbounds/billing-policy.ts';
import {DAY,signActivation} from '../lib/stillbounds/license-proof.ts';
try{process.loadEnvFile('.env.local');}catch{}
try{process.loadEnvFile('.env.development.local');}catch{}
const raw=process.env.DATABASE_URL;if(!raw)throw Error('Database not configured.');
const key=process.env.STILLBOUNDS_PAYSTACK_SECRET_KEY;if(!key?.startsWith('sk_test_'))throw Error('A Paystack test secret key is required.');
const url=new URL(raw);if(url.searchParams.has('sslmode'))url.searchParams.set('sslmode','verify-full');url.searchParams.delete('uselibpqcompat');
const pool=new pg.Pool({connectionString:url.href,ssl:{rejectUnauthorized:true},max:5,connectionTimeoutMillis:15000});
const schema='sb_test_'+randomBytes(8).toString('hex');let created=false;
const keyPair=()=>{const k=generateKeyPairSync('ed25519');return {privateKey:k.privateKey.export({type:'pkcs8',format:'pem'}),publicKey:k.publicKey.export({type:'spki',format:'pem'})};};
try{
 const client=await pool.connect();try{await client.query(`CREATE SCHEMA "${schema}"`);created=true;await client.query(`SET search_path TO "${schema}"`);await client.query(await readFile(new URL('../lib/stillbounds/billing-schema.sql',import.meta.url),'utf8'));}finally{client.release();}
 const store=new LicensingStore(pool,schema),now=Date.now(),user='test-user-'+randomUUID();
 async function activate(uid,deviceId,k=keyPair(),when=now){const challenge=await store.challenge('test',uid,{deviceId,name:'Integration test laptop',publicKey:k.publicKey},when);return {result:await store.activate('test',uid,challenge.id,signActivation(challenge.message,k.privateKey),when),challenge,k};}
 const first=await activate(user,'a'.repeat(64));assert.equal(first.result.account.trial_ends_at.getTime()-first.result.account.trial_started_at.getTime(),30*DAY);
 await assert.rejects(store.activate('test',user,first.challenge.id,signActivation(first.challenge.message,first.k.privateKey),now),e=>e.code==='CHALLENGE_EXPIRED');
 const again=await activate(user,'a'.repeat(64),first.k,now+DAY);assert.equal(again.result.account.trial_ends_at.getTime(),first.result.account.trial_ends_at.getTime());
 await activate(user,'b'.repeat(64));await assert.rejects(activate(user,'c'.repeat(64)),e=>e.code==='DEVICE_LIMIT');
 await assert.rejects(activate('another-test-user','a'.repeat(64)),e=>e.code==='TRIAL_ALREADY_USED');
 await store.deactivate('test',user,first.result.device.activation_id);await activate(user,'c'.repeat(64));
 await assert.rejects(activate(user,'c'.repeat(64),keyPair(),now+31*DAY),e=>e.code==='PAYMENT_REQUIRED');
 const owner=await pool.query('SELECT id,email,"emailVerified" FROM public.stillbounds_auth_user WHERE lower(email)=lower($1)',['ijabikenm@gmail.com']);assert(owner.rows[0]?.emailVerified,'Creator account must be verified.');
 const signing=keyPair(),config=billingConfig({STILLBOUNDS_LICENSING_ENABLED:'true',STILLBOUNDS_CHECKOUT_ENABLED:'true',STILLBOUNDS_BILLING_MODE:'test',STILLBOUNDS_PAYSTACK_SECRET_KEY:key,STILLBOUNDS_LICENSE_PRIVATE_KEY:signing.privateKey});
 const service=new BillingService(config,store,paystackTransport(key));
 const checkout=await service.checkout({id:user,email:owner.rows[0].email,emailVerified:true});assert(checkout.checkoutUrl.startsWith('https://checkout.paystack.com/'));assert.equal((await store.order('test',checkout.reference,user)).amount,3000000);
 await assert.rejects(service.verify({id:'another-test-user',email:owner.rows[0].email,emailVerified:true},checkout.reference),e=>e.code==='ORDER_NOT_FOUND');
 // Confirm that an uncompleted real test checkout cannot unlock the app.
 let pendingRejected=false;try{await service.verify({id:user,email:owner.rows[0].email,emailVerified:true},checkout.reference);}catch(e){pendingRejected=['PAYMENT_NOT_VERIFIED','PAYMENT_SERVICE'].includes(e.code);}assert(pendingRejected);assert.equal((await store.status('test',user)).account.paid,false);
 console.log(JSON.stringify({testKeyAccepted:true,realTestCheckoutInitialized:true,amountNGN:30000,unpaidCheckoutDoesNotUnlock:true,trialDays:30,trialReinstallResetPrevented:true,trialAccountSwitchPrevented:true,twoDeviceLimit:true,activationReplayRejected:true,liveLicenceGranted:false,testSchemaWillBeRemoved:true},null,2));
}finally{if(created)await pool.query(`DROP SCHEMA "${schema}" CASCADE`);await pool.end();}
