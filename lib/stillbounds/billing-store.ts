import {Pool,type PoolClient} from 'pg';
import {randomBytes,randomUUID} from 'node:crypto';
import {DAY,activationMessage,publicKeyHash,verifyActivation} from './license-proof.ts';
import {paymentMatchesOrder,type BillingMode,type Order,STILLBOUNDS_DEVICE_LIMIT} from './billing-policy.ts';
export class BillingError extends Error { code:string;status:number;constructor(code:string,status:number,message:string){super(message);this.code=code;this.status=status;} }
export type AccountRow={mode:BillingMode;user_id:string;trial_started_at:Date|null;trial_ends_at:Date|null;paid:boolean;blocked:boolean};
export type DeviceRow={mode:BillingMode;user_id:string;device_id:string;activation_id:string;device_name:string;public_key:string;device_key:string;active:boolean;activated_at:Date;last_seen_at:Date};
export type ChallengeRow={id:string;mode:BillingMode;user_id:string;device_id:string;device_name:string;public_key:string;device_key:string;nonce:string;expires_at:Date;consumed_at:Date|null};
type OrderRow={reference:string;mode:BillingMode;user_id:string;email:string;amount:string;currency:string;status:string;provider_id:string|null;checkout_url?:string|null};
const orderFromRow=(r:OrderRow):Order=>({reference:r.reference,mode:r.mode,userId:r.user_id,email:r.email,amount:Number(r.amount),currency:r.currency,status:r.status,providerId:r.provider_id??undefined,checkoutUrl:r.checkout_url??undefined});
export class LicensingStore {
 private pool:Pool;private schema?:string;constructor(pool:Pool,schema?:string){this.pool=pool;this.schema=schema;if(schema&&!/^[a-z][a-z0-9_]{0,62}$/.test(schema))throw Error('Invalid database namespace.');}
 async transaction<T>(work:(client:PoolClient)=>Promise<T>){const c=await this.pool.connect();try{await c.query('BEGIN');if(this.schema)await c.query(`SET LOCAL search_path TO "${this.schema}"`);const result=await work(c);await c.query('COMMIT');return result;}catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}}
 async status(mode:BillingMode,userId:string){return this.transaction(async c=>{const {rows}=await c.query<AccountRow>('SELECT * FROM stillbounds_license_accounts WHERE mode=$1 AND user_id=$2',[mode,userId]);const devices=await c.query<DeviceRow>('SELECT * FROM stillbounds_license_devices WHERE mode=$1 AND user_id=$2 AND active=TRUE ORDER BY activated_at',[mode,userId]);return {account:rows[0]??null,devices:devices.rows};});}
 async challenge(mode:BillingMode,userId:string,input:{deviceId:string;name:string;publicKey:string},now=Date.now()){
  const row={id:randomUUID(),environment:mode,userId,deviceId:input.deviceId,deviceKey:publicKeyHash(input.publicKey),nonce:randomBytes(32).toString('hex')};
  await this.transaction(c=>c.query('INSERT INTO stillbounds_license_challenges(id,mode,user_id,device_id,device_name,public_key,device_key,nonce,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[row.id,mode,userId,input.deviceId,input.name,input.publicKey,row.deviceKey,row.nonce,new Date(now+5*60000)]));
  return {...row,message:activationMessage(row),expiresAt:now+5*60000};
 }
 async activate(mode:BillingMode,userId:string,challengeId:string,signature:string,now=Date.now(),creator=false){
  return this.transaction(async c=>{
   const challenge=(await c.query<ChallengeRow>('SELECT * FROM stillbounds_license_challenges WHERE id=$1 AND mode=$2 AND user_id=$3 FOR UPDATE',[challengeId,mode,userId])).rows[0];
   if(!challenge||challenge.consumed_at||challenge.expires_at.getTime()<=now)throw new BillingError('CHALLENGE_EXPIRED',409,'Activation expired. Please try again.');
   if(!verifyActivation(activationMessage({id:challenge.id,nonce:challenge.nonce,userId,deviceId:challenge.device_id,deviceKey:challenge.device_key,environment:mode}),signature,challenge.public_key))throw new BillingError('INVALID_DEVICE_PROOF',403,'This laptop could not prove its activation key.');
   await c.query('INSERT INTO stillbounds_license_accounts(mode,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[mode,userId]);
   let account=(await c.query<AccountRow>('SELECT * FROM stillbounds_license_accounts WHERE mode=$1 AND user_id=$2 FOR UPDATE',[mode,userId])).rows[0];
   if(account.blocked)throw new BillingError('PAYMENT_REVIEW',403,'Please contact support about this purchase. Do not pay again.');
   if(!account.paid&&!creator){
    await c.query('INSERT INTO stillbounds_license_trials(mode,device_id,user_id,started_at) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[mode,challenge.device_id,userId,new Date(now)]);
    const owner=(await c.query<{user_id:string}>('SELECT user_id FROM stillbounds_license_trials WHERE mode=$1 AND device_id=$2',[mode,challenge.device_id])).rows[0];
    if(owner.user_id!==userId)throw new BillingError('TRIAL_ALREADY_USED',403,'The free trial has already been used on this laptop. Sign in with the original account or purchase Stillbounds.');
    if(!account.trial_started_at){account=(await c.query<AccountRow>('UPDATE stillbounds_license_accounts SET trial_started_at=$3,trial_ends_at=$4 WHERE mode=$1 AND user_id=$2 RETURNING *',[mode,userId,new Date(now),new Date(now+30*DAY)])).rows[0];}
    if(!account.trial_ends_at||account.trial_ends_at.getTime()<=now)throw new BillingError('PAYMENT_REQUIRED',402,'Your free month has ended. Purchase Stillbounds to continue creating and exporting books.');
   }
   const devices=(await c.query<DeviceRow>('SELECT * FROM stillbounds_license_devices WHERE mode=$1 AND user_id=$2 AND active=TRUE',[mode,userId])).rows;
   const existing=devices.find(d=>d.device_id===challenge.device_id);
   if(existing&&existing.device_key!==challenge.device_key)throw new BillingError('DEVICE_RESET_REQUIRED',409,'Deactivate this laptop in your account, then activate it again.');
   if(!existing&&devices.length>=STILLBOUNDS_DEVICE_LIMIT)throw new BillingError('DEVICE_LIMIT',409,'Both laptop slots are in use. Deactivate an old laptop to activate this one.');
   const activationId=existing?.activation_id??randomUUID();
   const device=(await c.query<DeviceRow>(`INSERT INTO stillbounds_license_devices(mode,user_id,device_id,activation_id,device_name,public_key,device_key,active,activated_at,last_seen_at) VALUES($1,$2,$3,$4,$5,$6,$7,TRUE,$8,$8) ON CONFLICT(mode,user_id,device_id) DO UPDATE SET activation_id=EXCLUDED.activation_id,device_name=EXCLUDED.device_name,public_key=EXCLUDED.public_key,device_key=EXCLUDED.device_key,active=TRUE,last_seen_at=EXCLUDED.last_seen_at RETURNING *`,[mode,userId,challenge.device_id,activationId,challenge.device_name,challenge.public_key,challenge.device_key,new Date(now)])).rows[0];
   await c.query('UPDATE stillbounds_license_challenges SET consumed_at=$2 WHERE id=$1',[challenge.id,new Date(now)]);
   return {account,device};
  });
 }
 async deactivate(mode:BillingMode,userId:string,activationId:string){return this.transaction(async c=>{await c.query('SELECT user_id FROM stillbounds_license_accounts WHERE mode=$1 AND user_id=$2 FOR UPDATE',[mode,userId]);const result=await c.query('UPDATE stillbounds_license_devices SET active=FALSE WHERE mode=$1 AND user_id=$2 AND activation_id=$3 AND active=TRUE RETURNING activation_id',[mode,userId,activationId]);if(!result.rowCount)throw new BillingError('DEVICE_NOT_FOUND',404,'This activation was not found on your account.');});}
 async createOrder(order:Order){return this.transaction(async c=>{
   await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',['stillbounds-checkout:'+order.mode+':'+order.userId]);
   await c.query('INSERT INTO stillbounds_license_accounts(mode,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[order.mode,order.userId]);
   const account=(await c.query<AccountRow>('SELECT * FROM stillbounds_license_accounts WHERE mode=$1 AND user_id=$2 FOR UPDATE',[order.mode,order.userId])).rows[0];
   if(account.paid||account.blocked)throw new BillingError('PAYMENT_REVIEW',409,'Check your existing purchase before paying again.');
   const pending=(await c.query<OrderRow>("SELECT * FROM stillbounds_license_orders WHERE mode=$1 AND user_id=$2 AND status='pending' ORDER BY created_at DESC LIMIT 1",[order.mode,order.userId])).rows[0];
   if(pending){if(!pending.checkout_url)throw new BillingError('CHECKOUT_PENDING',409,'Checkout is being prepared. Please try again shortly.');return {...orderFromRow(pending),reused:true};}
   await c.query('INSERT INTO stillbounds_license_orders(reference,mode,user_id,email,amount,currency) VALUES($1,$2,$3,$4,$5,$6)',[order.reference,order.mode,order.userId,order.email,order.amount,order.currency]);return order;
  });}
 async saveCheckout(mode:BillingMode,reference:string,url:string){await this.transaction(c=>c.query("UPDATE stillbounds_license_orders SET checkout_url=$3 WHERE mode=$1 AND reference=$2 AND status='pending'",[mode,reference,url]));}
 async order(mode:BillingMode,reference:string,userId?:string){return this.transaction(async c=>{const r=(await c.query<OrderRow>('SELECT * FROM stillbounds_license_orders WHERE mode=$1 AND reference=$2'+(userId?' AND user_id=$3':''),userId?[mode,reference,userId]:[mode,reference])).rows[0];return r?orderFromRow(r):null;});}
 async fulfill(mode:BillingMode,reference:string,payment:unknown){return this.transaction(async c=>{const row=(await c.query<OrderRow>('SELECT * FROM stillbounds_license_orders WHERE mode=$1 AND reference=$2 FOR UPDATE',[mode,reference])).rows[0];if(!row)throw new BillingError('ORDER_NOT_FOUND',404,'Payment reference not found.');const order=orderFromRow(row);if(!paymentMatchesOrder(payment,order))throw new BillingError('PAYMENT_NOT_VERIFIED',409,'Payment has not been verified for this purchase.');if(['refunded','disputed'].includes(row.status))throw new BillingError('PAYMENT_REVIEW',403,'This payment needs support review.');await c.query('INSERT INTO stillbounds_license_accounts(mode,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[mode,row.user_id]);await c.query('SELECT user_id FROM stillbounds_license_accounts WHERE mode=$1 AND user_id=$2 FOR UPDATE',[mode,row.user_id]);const id=String((payment as {id:unknown}).id);await c.query("UPDATE stillbounds_license_orders SET status='paid',provider_id=$2,paid_at=COALESCE(paid_at,NOW()) WHERE reference=$1",[reference,id]);await c.query('INSERT INTO stillbounds_license_accounts(mode,user_id,paid) VALUES($1,$2,TRUE) ON CONFLICT(mode,user_id) DO UPDATE SET paid=TRUE',[mode,row.user_id]);return {paid:true};});}
 async failOrder(mode:BillingMode,reference:string){await this.transaction(c=>c.query("UPDATE stillbounds_license_orders SET status='failed' WHERE mode=$1 AND reference=$2 AND status='pending'",[mode,reference]));}
 async revoke(mode:BillingMode,reference:string,status:'refunded'|'disputed',eventHash:string,eventType:string,refundAmount?:number){return this.transaction(async c=>{
  const row=(await c.query<OrderRow>('SELECT * FROM stillbounds_license_orders WHERE mode=$1 AND reference=$2 FOR UPDATE',[mode,reference])).rows[0];if(!row)return;
  await c.query('INSERT INTO stillbounds_license_accounts(mode,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[mode,row.user_id]);
  await c.query('SELECT user_id FROM stillbounds_license_accounts WHERE mode=$1 AND user_id=$2 FOR UPDATE',[mode,row.user_id]);
  // An authenticated refund with an unknown amount cannot safely retain entitlement.
  if(status==='refunded'&&(!Number.isSafeInteger(refundAmount)||(refundAmount??0)<=0))status='disputed';
  const inserted=await c.query('INSERT INTO stillbounds_license_events(event_hash,mode,event_type,reference,amount) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING event_hash',[eventHash,mode,eventType,reference,refundAmount??null]);if(!inserted.rowCount)return;
  // Partial refunds retain the licence until cumulative processed refunds reach the purchase total.
  if(status==='refunded'){
   const sum=(await c.query<{amount:string}>("SELECT COALESCE(SUM(amount),0) AS amount FROM stillbounds_license_events WHERE mode=$1 AND reference=$2 AND event_type='refund.processed'",[mode,reference])).rows[0];
   if(!Number.isSafeInteger(refundAmount)||(refundAmount??0)<=0||Number(sum.amount)<Number(row.amount))return;
  }
  await c.query('UPDATE stillbounds_license_orders SET status=$2 WHERE reference=$1',[reference,status]);
  const other=(await c.query<{count:string}>("SELECT COUNT(*) AS count FROM stillbounds_license_orders WHERE mode=$1 AND user_id=$2 AND status='paid'",[mode,row.user_id])).rows[0];
  await c.query('UPDATE stillbounds_license_accounts SET paid=$3,blocked=blocked OR $4 WHERE mode=$1 AND user_id=$2',[mode,row.user_id,Number(other.count)>0,status==='disputed'&&Number(other.count)===0]);
 });}
}
let store:LicensingStore|undefined;
export function licensingStore(){if(store)return store;const raw=process.env.DATABASE_URL;if(!raw)throw Error('Licensing database is not configured.');const url=new URL(raw);if(url.searchParams.has('sslmode'))url.searchParams.set('sslmode','verify-full');url.searchParams.delete('uselibpqcompat');return store=new LicensingStore(new Pool({connectionString:url.toString(),ssl:{rejectUnauthorized:true},max:4}));}
