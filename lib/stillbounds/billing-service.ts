import {pricingSnapshot,savedCheckoutQuote} from '../pricingSnapshot.ts';
import {exchangeRates} from '../exchangeRates.ts';
import {regionalMultiplier,isRoundedCurrency,type DisplayCurrency} from '../regionalPricing.ts';
import {createHash,randomUUID} from 'node:crypto';
import {billingConfig,isCreatorAccount,checkoutAddress,validWebhook,validSignedWebhook,STILLBOUNDS_PRICE_MINOR,STILLBOUNDS_CURRENCY,STILLBOUNDS_DEVICE_LIMIT,type Order} from './billing-policy.ts';
import {DAY,publicKeyHash,signLicense,type LicenseClaims} from './license-proof.ts';
import {BillingError,licensingStore,type LicensingStore} from './billing-store.ts';
export type BillingUser={id:string;email:string;emailVerified:boolean};
export type PaystackCall=(path:string,body?:object)=>Promise<Record<string,unknown>>;
export function paystackTransport(secret:string):PaystackCall{return async(path,body)=>{const result=await fetch('https://api.paystack.co'+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${secret}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});const bytes=await result.text();if(bytes.length>131072)throw new BillingError('PAYMENT_SERVICE',502,'Payment service is temporarily unavailable.');let data;try{data=JSON.parse(bytes);}catch{throw new BillingError('PAYMENT_SERVICE',502,'Payment service is temporarily unavailable.');}if(!result.ok||data?.status!==true||!data.data||typeof data.data!=='object')throw new BillingError('PAYMENT_SERVICE',502,'Payment service is temporarily unavailable.');return data.data;};}
const referencePattern=/^sb-(test|live)-[a-f0-9-]{36}$/;
export class BillingService {
 readonly config:ReturnType<typeof billingConfig>;readonly store:LicensingStore;readonly provider:PaystackCall;constructor(config:ReturnType<typeof billingConfig>,store:LicensingStore,provider:PaystackCall=paystackTransport(config.secret)){this.config=config;this.store=store;this.provider=provider;}
 offer(country=''){return {enabled:this.config.enabled,environment:this.config.mode,price:{amount:30000*regionalMultiplier(country),amountMinor:STILLBOUNDS_PRICE_MINOR*regionalMultiplier(country),currency:STILLBOUNDS_CURRENCY,model:'one-time'},trialDays:30,deviceLimit:STILLBOUNDS_DEVICE_LIMIT,checkoutAvailable:this.config.enabled&&this.config.checkoutEnabled};}
 requireEnabled(){if(!this.config.enabled)throw new BillingError('NOT_CONFIGURED',503,'Activation is not available yet. Your existing books are safe.');}
 async status(user:BillingUser,country=''){this.requireEnabled();const {account,devices}=await this.store.status(this.config.mode,user.id),now=Date.now();return {...this.offer(country),userId:user.id,access:account?.blocked?'blocked':isCreatorAccount(user,this.config.creatorUserId)?'creator':account?.paid?'paid':account?.trial_ends_at&&account.trial_ends_at.getTime()>now?'trial':account?.trial_started_at?'expired':'trial_available',trialStartedAt:account?.trial_started_at?.getTime()??null,trialEndsAt:account?.trial_ends_at?.getTime()??null,devices:devices.map(d=>({id:d.activation_id,name:d.device_name,deviceId:d.device_id,activatedAt:d.activated_at.getTime(),lastSeenAt:d.last_seen_at.getTime()}))};}
 async activate(user:BillingUser,id:string,signature:string,country=''){this.requireEnabled();const now=Date.now(),{account,device}=await this.store.activate(this.config.mode,user.id,id,signature,now,isCreatorAccount(user,this.config.creatorUserId));const entitled=account.paid||isCreatorAccount(user,this.config.creatorUserId);const offlineUntil=entitled?now+90*DAY:account.trial_ends_at!.getTime();const claims:LicenseClaims={v:1,issuer:this.config.issuer,audience:'stillbounds-desktop',environment:this.config.mode,userId:user.id,activationId:device.activation_id,deviceId:device.device_id,deviceKey:device.device_key,kind:entitled?'paid':'trial',issuedAt:now,offlineUntil,graceUntil:entitled?offlineUntil+7*DAY:offlineUntil};return {certificate:signLicense(claims,this.config.privateKey),status:await this.status(user,country)};}
 private resumeCheckout(order:Order,expectedAmount:number,resumeReference?:string,resumeAmount?:number){
  if(order.amount!==expectedAmount&&!(resumeReference===order.reference&&resumeAmount===order.amount))
   return {confirmationRequired:true,resumeQuote:savedCheckoutQuote(order.reference,order.amount),reference:order.reference,environment:this.config.mode};
  if(!order.checkoutUrl)throw new BillingError('CHECKOUT_PENDING',409,'Your saved checkout is still being prepared. Please retry or contact support with the original payment reference.');
  return {checkoutUrl:checkoutAddress(order.checkoutUrl),reference:order.reference,environment:this.config.mode,amount:order.amount/100,currency:order.currency};
 }
 async checkout(user:BillingUser,country='',displayCurrency:DisplayCurrency='NGN',expectedAmount?:number,resumeReference?:string,resumeAmount?:number){
  this.requireEnabled();
  if(!this.config.checkoutEnabled)throw new BillingError('CHECKOUT_UNAVAILABLE',503,'Payments are not available yet. Your free trial does not require a card.');
  const status=await this.status(user);
  if(status.access==='paid'||status.access==='creator')throw new BillingError('ALREADY_PAID',409,'You already own Stillbounds. Activate your laptop instead.');
  if(status.access==='blocked')throw new BillingError('PAYMENT_REVIEW',403,'Please contact support about this purchase. Do not pay again.');
  // Resolve existing payments before fetching today's FX rate. Never mint a second payable reference.
  const pending=await this.store.pendingOrder?.(this.config.mode,user.id);
  if(pending)return this.resumeCheckout(pending,expectedAmount??this.offer(country).price.amountMinor,resumeReference,resumeAmount);
  if(isRoundedCurrency(displayCurrency)&&!Number.isSafeInteger(expectedAmount))throw new BillingError('QUOTE_REQUIRED',400,'Refresh this page to get a valid price quote.');
  let rates:Partial<Record<DisplayCurrency,number>>={NGN:1},asOf:number|null=null;
  if(displayCurrency!=='NGN'){
   try{const current=await exchangeRates();rates=current.rates;asOf=current.asOf;}
   catch{if(isRoundedCurrency(displayCurrency))throw new BillingError('PRICING_UNAVAILABLE',503,'Currency pricing is temporarily unavailable. Refresh before checkout.');}
  }
  let pricing;
  try{pricing=pricingSnapshot(STILLBOUNDS_PRICE_MINOR,country,displayCurrency,rates,asOf);}
  catch{throw new BillingError('PRICING_UNAVAILABLE',503,'Currency pricing is temporarily unavailable. Refresh before checkout.');}
  if(typeof expectedAmount==='number'&&pricing.amountMinor!==expectedAmount)throw new BillingError('QUOTE_CHANGED',409,'The price quote changed. Refresh this page before paying.');
  const order:Order={reference:`sb-${this.config.mode}-${randomUUID()}`,mode:this.config.mode,userId:user.id,email:user.email,amount:pricing.amountMinor,currency:STILLBOUNDS_CURRENCY,status:'pending',pricing};
  const reserved=await this.store.createOrder(order);
  if(reserved?.reused)return this.resumeCheckout(reserved,pricing.amountMinor,resumeReference,resumeAmount);
  try{
   const initialized=await this.provider('/transaction/initialize',{email:user.email,amount:order.amount,currency:order.currency,reference:order.reference,callback_url:`${this.config.origin}/mofolio/account?purchase_reference=${order.reference}`,metadata:{product:'stillbounds-perpetual-v1',user_id:user.id}});
   if(initialized.reference!==order.reference)throw Error('Payment reference mismatch.');
   const url=checkoutAddress(initialized.authorization_url);
   if(this.store.saveCheckout)await this.store.saveCheckout(this.config.mode,order.reference,url);
   return {checkoutUrl:url,reference:order.reference,environment:this.config.mode,amount:order.amount/100,currency:order.currency};
  }catch(error){await this.store.failOrder(this.config.mode,order.reference);throw error;}
 }
 async verify(user:BillingUser,reference:string,country=''){this.requireEnabled();if(!referencePattern.test(reference))throw new BillingError('INVALID_REFERENCE',400,'Invalid payment reference.');const order=await this.store.order(this.config.mode,reference,user.id);if(!order)throw new BillingError('ORDER_NOT_FOUND',404,'This payment belongs to a different account or was not found.');if(!this.config.checkoutEnabled)throw new BillingError('CHECKOUT_UNAVAILABLE',503,'Payment verification is temporarily unavailable.');const payment=await this.provider('/transaction/verify/'+encodeURIComponent(reference));await this.store.fulfill(this.config.mode,reference,payment);return this.status(user,country);}
 async webhook(raw:string,signature:string,modernSignature=''){const valid=modernSignature?validSignedWebhook(raw,modernSignature,[this.config.webhookSecret]):!this.config.webhookSecret&&validWebhook(raw,signature,this.config.secret);if(!valid)throw new BillingError('INVALID_SIGNATURE',401,'Invalid payment signature.');let event;try{event=JSON.parse(raw);}catch{throw new BillingError('INVALID_BODY',400,'Invalid payment event.');}if(!event||typeof event.event!=='string'||!event.data||typeof event.data!=='object')throw new BillingError('INVALID_BODY',400,'Invalid payment event.');const data=event.data as Record<string,unknown>;if(event.event==='charge.success'){const reference=String(data.reference||'');if(!referencePattern.test(reference))return;const order=await this.store.order(this.config.mode,reference);if(!order||['refunded','disputed'].includes(order.status))return;if(!this.config.checkoutEnabled)throw new BillingError('CHECKOUT_UNAVAILABLE',503,'Payment verification is temporarily unavailable.');const payment=await this.provider('/transaction/verify/'+encodeURIComponent(reference));await this.store.fulfill(this.config.mode,reference,payment);}else if(['refund.processed','charge.dispute.create'].includes(event.event)){const transaction=data.transaction as {reference?:unknown}|undefined;const reference=String(data.transaction_reference||transaction?.reference||'');if(!referencePattern.test(reference))return;const details=data.transaction as {domain?:unknown;currency?:unknown}|undefined;if((data.domain||details?.domain)!==this.config.mode||(data.currency||details?.currency)!==STILLBOUNDS_CURRENCY)throw new BillingError('INVALID_EVENT',400,'Payment event does not match this environment.');await this.store.revoke(this.config.mode,reference,event.event==='refund.processed'&&(data.refund_reference||data.id)?'refunded':'disputed',createHash('sha256').update(JSON.stringify([event.event,reference,data.refund_reference||data.id||'unidentified'])).digest('hex'),event.event,typeof data.amount==='number'?data.amount:typeof data.amount==='string'&&/^\d+$/.test(data.amount)?Number(data.amount):undefined);}}
}
export function billingService(){return new BillingService(billingConfig(),licensingStore());}
export function validateDevice(input:Record<string,unknown>){const deviceId=input.deviceId,name=input.name,publicKey=input.publicKey;if(typeof deviceId!=='string'||!/^[a-f0-9]{64}$/.test(deviceId)||typeof name!=='string'||!name.trim()||name.length>80||/[\x00-\x1f\x7f]/.test(name)||typeof publicKey!=='string'||publicKey.length>300||!/^-----BEGIN PUBLIC KEY-----[\s\S]+-----END PUBLIC KEY-----\s*$/.test(publicKey))throw new BillingError('INVALID_DEVICE',400,'Enter a valid laptop activation.');try{publicKeyHash(publicKey);}catch{throw new BillingError('INVALID_DEVICE',400,'Invalid laptop activation key.');}return {deviceId,name:name.trim(),publicKey};}
