import { randomBytes, randomUUID } from 'node:crypto';
import QRCode from 'qrcode';
import { query, transaction } from './db';
import { createAdminSession } from './auth';
import { adminTokenHash } from './adminSessions';
import { newMfaSeed,newRecoveryCodes,openMfa,recoveryHash,sealMfa,totp,validMfaCounter } from './adminMfa';
export const ADMIN_CHALLENGE_COOKIE='moyo-admin-challenge';
const secret=()=>process.env.ADMIN_SESSION_SECRET||'';
export async function beginAdminLogin(){
  const enrolled=(await query('SELECT id FROM admin_mfa WHERE id=1')).rows.length>0;
  const token=randomBytes(32).toString('hex'),seed=enrolled?null:newMfaSeed();
  await query('DELETE FROM admin_login_challenges WHERE expires_at<NOW()');
  await query(`INSERT INTO admin_login_challenges(token_hash,secret_encrypted,expires_at) VALUES($1,$2,NOW()+INTERVAL '5 minutes')`,[adminTokenHash(token),seed?sealMfa(seed,secret()):null]);
  return {token,step:enrolled?'verify':'enroll',...seed?{manualKey:seed,qrCode:await QRCode.toDataURL(totp(seed).toString(),{width:240,margin:2,errorCorrectionLevel:'M'})}:{}};
}
export async function finishAdminLogin(challenge:string,code:string){
  if(!/^[a-f0-9]{64}$/.test(challenge)||code.length>100)return null;
  return transaction(async client=>{
    await client.query('SELECT pg_advisory_xact_lock(178931,4)');
    const pending=(await client.query('SELECT * FROM admin_login_challenges WHERE token_hash=$1 AND expires_at>NOW() AND attempts<5 FOR UPDATE',[adminTokenHash(challenge)])).rows[0];
    if(!pending)return null;
    await client.query('UPDATE admin_login_challenges SET attempts=attempts+1 WHERE token_hash=$1',[adminTokenHash(challenge)]);
    const mfa=(await client.query('SELECT * FROM admin_mfa WHERE id=1 FOR UPDATE')).rows[0];
    let recoveryCodes:string[]|undefined;
    if(mfa){
      const counter=validMfaCounter(openMfa(mfa.secret_encrypted,secret()),code,Number(mfa.last_counter));
      if(counter!==null)await client.query('UPDATE admin_mfa SET last_counter=$1 WHERE id=1',[counter]);
      else {
        if(!/^[a-f0-9]{32}$/i.test(code.replace(/[\s-]/g,'')))return null;
        const removed=await client.query('UPDATE admin_mfa SET recovery_hashes=array_remove(recovery_hashes,$1) WHERE id=1 AND $1=ANY(recovery_hashes) RETURNING id',[recoveryHash(code,secret())]);
        if(!removed.rows.length)return null;
      }
    }else{
      if(!pending.secret_encrypted)return null;
      const counter=validMfaCounter(openMfa(pending.secret_encrypted,secret()),code,-1);if(counter===null)return null;
      recoveryCodes=newRecoveryCodes();
      await client.query('INSERT INTO admin_mfa(id,secret_encrypted,last_counter,recovery_hashes) VALUES(1,$1,$2,$3)',[pending.secret_encrypted,counter,recoveryCodes.map(code=>recoveryHash(code,secret()))]);
    }
    const token=createAdminSession(),expires=Number(token.split('.')[0]);
    await client.query('INSERT INTO admin_sessions(id,token_hash,expires_at) VALUES($1,$2,$3)',[randomUUID(),adminTokenHash(token),new Date(expires)]);
    await client.query('DELETE FROM admin_login_challenges WHERE token_hash=$1',[adminTokenHash(challenge)]);
    await client.query('DELETE FROM admin_sessions WHERE expires_at<NOW()');
    return {token,recoveryCodes};
  });
}

export async function adminChallengeActive(token:string){
 if(!/^[a-f0-9]{64}$/.test(token))return false;
 return (await query('SELECT token_hash FROM admin_login_challenges WHERE token_hash=$1 AND expires_at>NOW() AND attempts<5',[adminTokenHash(token)])).rows.length>0;
}
