import { randomInt, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { constantEqual } from './payments/policy.ts';
import { couponDigest, couponIdentity } from './couponIdentity.ts';
export const couponBrowserCookie='moyo-coupon-browser';
export async function createCouponChallenge(c:PoolClient,email:string,browser:string){
 const id=randomUUID(),code=String(randomInt(1000000)).padStart(6,'0');
 await c.query("DELETE FROM shop_coupon_challenges WHERE expires_at<NOW()-INTERVAL '1 day'");
 await c.query("INSERT INTO shop_coupon_challenges(id,email,identity,browser_hash,code_hash,expires_at) VALUES($1,$2,$3,$4,$5,NOW()+INTERVAL '10 minutes')",[id,email,couponIdentity(email),couponDigest('browser:'+browser),couponDigest(`code:${id}:${email}:${code}`)]);
 return {id,code};
}
export async function consumeCouponChallenge(c:PoolClient,input:{id:string;email:string;browser:string;code:string}){
 const row=(await c.query('SELECT * FROM shop_coupon_challenges WHERE id=$1 FOR UPDATE',[input.id])).rows[0];
 if(!row||row.email!==input.email||row.browser_hash!==couponDigest('browser:'+input.browser)||row.consumed_at||row.attempts>=5||new Date(row.expires_at).getTime()<=Date.now())return false;
 const valid=/^\d{6}$/.test(input.code)&&constantEqual(row.code_hash,couponDigest(`code:${input.id}:${input.email}:${input.code}`));
 // Return a result so failed attempts commit; throwing here would roll back the attempt budget.
 await c.query('UPDATE shop_coupon_challenges SET attempts=attempts+1,consumed_at=CASE WHEN $2 THEN NOW() ELSE NULL END WHERE id=$1',[input.id,valid]);
 return valid;
}
