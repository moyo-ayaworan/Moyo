import {createHash,createPrivateKey,createPublicKey,sign,verify} from 'node:crypto';
export const DAY = 86400000;
export type LicenseClaims={v:1;issuer:string;audience:'stillbounds-desktop';environment:'test'|'live';userId:string;activationId:string;deviceId:string;deviceKey:string;kind:'trial'|'paid';issuedAt:number;offlineUntil:number;graceUntil:number};
export function publicKeyHash(key:string){const parsed=createPublicKey(key);if(parsed.asymmetricKeyType!=='ed25519')throw Error('Ed25519 device key required.');return createHash('sha256').update(parsed.export({type:'spki',format:'der'})).digest('hex');}
export function activationMessage(challenge:{id:string;nonce:string;userId:string;deviceId:string;deviceKey:string;environment:string}){return ['stillbounds-activation-v1',challenge.environment,challenge.userId,challenge.deviceId,challenge.deviceKey,challenge.id,challenge.nonce].join('\n');}
export function signActivation(message:string,key:string){return sign(null,Buffer.from(message),createPrivateKey(key)).toString('base64url');}
export function verifyActivation(message:string,signature:string,key:string){try{return /^[A-Za-z0-9_-]{86}$/.test(signature)&&verify(null,Buffer.from(message),createPublicKey(key),Buffer.from(signature,'base64url'));}catch{return false;}}
export function signLicense(claims:LicenseClaims,privateKey:string){const key=createPrivateKey(privateKey);if(key.asymmetricKeyType!=='ed25519')throw Error('Ed25519 licence signing key required.');const payload=Buffer.from(JSON.stringify(claims)).toString('base64url');return payload+'.'+sign(null,Buffer.from(payload),key).toString('base64url');}
export function verifyLicense(certificate:string,publicKey:string,expected:{issuer:string;environment:string;deviceId:string;deviceKey:string},now=Date.now()):LicenseClaims|null{
 try{
  if(typeof certificate!=='string'||certificate.length>8192)return null;
  const parts=certificate.split('.');if(parts.length!==2||!/^[A-Za-z0-9_-]+$/.test(parts[0])||!/^[A-Za-z0-9_-]{86}$/.test(parts[1]))return null;
  const key=createPublicKey(publicKey);if(key.asymmetricKeyType!=='ed25519'||!verify(null,Buffer.from(parts[0]),key,Buffer.from(parts[1],'base64url')))return null;
  const c=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8')) as LicenseClaims;
  if(c.v!==1||c.audience!=='stillbounds-desktop'||c.issuer!==expected.issuer||c.environment!==expected.environment||c.deviceId!==expected.deviceId||c.deviceKey!==expected.deviceKey||!['trial','paid'].includes(c.kind))return null;
  if(typeof c.userId!=='string'||!c.userId||c.userId.length>200||!/^\w[\w-]{10,100}$/.test(c.activationId)||!Array.of(c.issuedAt,c.offlineUntil,c.graceUntil).every(Number.isSafeInteger))return null;
  if(c.issuedAt>now+300000||c.offlineUntil<=c.issuedAt||c.graceUntil<c.offlineUntil||c.graceUntil>c.offlineUntil+7*DAY)return null;
  if(c.kind==='trial'&&(c.offlineUntil>c.issuedAt+30*DAY+1000||c.graceUntil!==c.offlineUntil))return null;
  if(c.kind==='paid'&&c.offlineUntil>c.issuedAt+90*DAY+1000)return null;
  if(now>=c.graceUntil)return null;
  return c;
 }catch{return null;}
}
