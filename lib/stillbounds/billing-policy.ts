import {createHmac,timingSafeEqual,createPublicKey,createPrivateKey} from 'node:crypto';
export const STILLBOUNDS_PRICE_MINOR=3000000;
export const STILLBOUNDS_CURRENCY='NGN';
export const STILLBOUNDS_TRIAL_DAYS=30;
export const STILLBOUNDS_DEVICE_LIMIT=2;
export type BillingMode='test'|'live';
export type Order={reference:string;mode:BillingMode;userId:string;email:string;amount:number;currency:string;status:string;providerId?:string;checkoutUrl?:string;reused?:boolean};
export function paymentMatchesOrder(payment:unknown,order:Order){
 if(!payment||typeof payment!=='object')return false;const p=payment as Record<string,unknown>;
 const customer=p.customer as {email?:unknown}|undefined;
 let metadata=p.metadata;try{if(typeof metadata==='string')metadata=JSON.parse(metadata);}catch{return false;}
 const m=metadata as {product?:unknown;user_id?:unknown}|undefined;
 return p.status==='success'&&p.domain===order.mode&&p.reference===order.reference&&Number.isSafeInteger(p.amount)&&p.amount===order.amount&&p.currency===order.currency&&typeof customer?.email==='string'&&customer.email.toLowerCase()===order.email.toLowerCase()&&m?.product==='stillbounds-perpetual-v1'&&m.user_id===order.userId&&((typeof p.id==='number'&&Number.isSafeInteger(p.id)&&p.id>0)||(typeof p.id==='string'&&/^\d{1,30}$/.test(p.id)));
}
export function validWebhook(raw:string,signature:string,secret:string){if(!secret||!/^[a-f0-9]{128}$/.test(signature))return false;const expected=createHmac('sha512',secret).update(raw).digest('hex');return timingSafeEqual(Buffer.from(expected),Buffer.from(signature));}
export function checkoutAddress(value:unknown){if(typeof value!=='string'||value.length>1000)throw Error('Invalid checkout address.');const url=new URL(value);if(url.protocol!=='https:'||url.hostname!=='checkout.paystack.com'||url.username||url.password||url.port||!/^\/[A-Za-z0-9_-]+\/?$/.test(url.pathname))throw Error('Invalid checkout address.');return url.href;}
export function billingConfig(env:NodeJS.ProcessEnv=process.env){
 const mode:BillingMode=env.STILLBOUNDS_BILLING_MODE==='live'?'live':'test';
 const origin=new URL(env.STILLBOUNDS_BILLING_ORIGIN||env.STILLBOUNDS_AUTH_URL||'https://moyo-roan.vercel.app').origin;
 // Keep desktop certificate identity stable when the website changes domains.
 const issuer=new URL(env.STILLBOUNDS_LICENSE_ISSUER||origin).origin;
 const privateKey=(env.STILLBOUNDS_LICENSE_PRIVATE_KEY||'').replace(/\\n/g,'\n');
 let publicKey='';if(privateKey){const key=createPrivateKey(privateKey);if(key.asymmetricKeyType!=='ed25519')throw Error('Invalid licence signing configuration.');publicKey=createPublicKey(key).export({type:'spki',format:'pem'}).toString();}
 const secret=env.STILLBOUNDS_PAYSTACK_SECRET_KEY||env.PAYSTACK_SECRET_KEY||'';
 const webhookSecret=env.STILLBOUNDS_PAYSTACK_WEBHOOK_SECRET||(secret===env.PAYSTACK_SECRET_KEY?env.PAYSTACK_WEBHOOK_SECRET:'')||'';
 const checkoutEnabled=(env.VERCEL_ENV!=='production'||!!webhookSecret)&&env.STILLBOUNDS_CHECKOUT_ENABLED==='true'&&secret.startsWith(mode==='live'?'sk_live_':'sk_test_')&&!!privateKey;
 return {mode,origin,issuer,privateKey,publicKey,secret,webhookSecret,checkoutEnabled,creatorUserId:env.STILLBOUNDS_CREATOR_USER_ID?.trim()||'',enabled:env.STILLBOUNDS_LICENSING_ENABLED==='true'&&!!privateKey};
}

// Configure only on the server after verifying the creator account identity.
export function isCreatorAccount(user:{id:string;emailVerified:boolean},creatorUserId:string){return user.emailVerified===true&&creatorUserId.length>0&&user.id===creatorUserId;}

export function validSignedWebhook(raw:string,header:string,secrets:string[],now=Math.floor(Date.now()/1000)){
 if(!header||header.length>4096)return false;
 const parts=header.split(',').map(s=>s.trim()),times=parts.filter(s=>s.startsWith('t='));
 if(times.length!==1||!/^t=\d{1,12}$/.test(times[0]))return false;
 const stamp=times[0].slice(2);if(Math.abs(now-Number(stamp))>300)return false;
 return parts.filter(s=>s.startsWith('v1=')).some(part=>{const m=/^v1=(whk_[A-Za-z0-9]+):([a-f0-9]{128})$/.exec(part);if(!m)return false;return secrets.filter(s=>s.startsWith('whsec_')).some(secret=>timingSafeEqual(Buffer.from(createHmac('sha512',secret).update(stamp+'.'+raw).digest('hex')),Buffer.from(m[2])));});
}
