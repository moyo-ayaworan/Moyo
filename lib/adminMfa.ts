import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import * as OTPAuth from 'otpauth';
function key(secret: string) { if (!secret) throw Error('Admin security is not configured.'); return createHmac('sha256', secret).update('moyo-admin-mfa-encryption-v1').digest(); }
export function sealMfa(value: string, secret: string) {
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(secret),iv);
  const data=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
  return [iv,cipher.getAuthTag(),data].map(v=>v.toString('base64url')).join('.');
}
export function openMfa(value: string, secret: string) {
  const parts=value.split('.');if(parts.length!==3)throw Error('Invalid protected MFA configuration.');
  const [iv,tag,data]=parts.map(v=>Buffer.from(v,'base64url'));if(iv.length!==12||tag.length!==16)throw Error('Invalid protected MFA configuration.');
  const cipher=createDecipheriv('aes-256-gcm',key(secret),iv);cipher.setAuthTag(tag);return Buffer.concat([cipher.update(data),cipher.final()]).toString('utf8');
}
export function totp(seed: string) { return new OTPAuth.TOTP({issuer:'Moyo Studio',label:'Admin',algorithm:'SHA1',digits:6,period:30,secret:OTPAuth.Secret.fromBase32(seed)}); }
export function newMfaSeed() { return new OTPAuth.Secret({size:20}).base32; }
export function validMfaCounter(seed: string, token: string, last: number, now=Date.now()) {
  if(!/^\d{6}$/.test(token))return null;
  const delta=totp(seed).validate({token,timestamp:now,window:1});if(delta===null)return null;
  const counter=Math.floor(now/30000)+delta;return counter>last?counter:null;
}
export const recoveryHash=(value:string,secret:string)=>createHmac('sha256',key(secret)).update('recovery:'+value.toLowerCase().replace(/[\s-]/g,'')).digest('hex');
export function newRecoveryCodes(){return Array.from({length:8},()=>randomBytes(16).toString('hex').toUpperCase().match(/.{4}/g)!.join('-'));}
