import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import { getMigrations } from 'better-auth/db/migration';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { createStillboundsAuth } from '../lib/stillboundsAuth.ts';
const desktopRoot = process.env.STILLBOUNDS_DESKTOP_ROOT;
if (!desktopRoot) throw Error('Set STILLBOUNDS_DESKTOP_ROOT to the native Stillbounds source directory. Run this script through tsx.');
const { DesktopAccount } = await import(pathToFileURL(path.join(desktopRoot, 'electron/account.ts')).href);
const origin = 'https://stillbounds.example.com', messages = [];
const db = new DatabaseSync(':memory:');
const auth = createStillboundsAuth({origin,key:'isolated-native-website-test-secret-123456789',database:db,email:async(to,subject,link)=>{messages.push({to,subject,link});}});
await (await getMigrations(auth.options)).runMigrations();
async function call(route,body,cookie,token){
  const res=await auth.handler(new Request(origin+'/api/stillbounds/auth'+route,{method:body?'POST':'GET',headers:{Origin:origin,'x-forwarded-for':'192.0.2.11',...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined}));
  let data;try{data=await res.json();}catch{data=null;}
  return {status:res.status,data,cookie:res.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ')};
}
let credential;
const store={read:async()=>credential,write:async value=>{credential=value;},clear:async()=>{credential=undefined;}};
const transport=async(_origin,route,body,token)=>call(route,body,undefined,token);
try{
  const signup=await call('/sign-up/email',{email:'photographer@example.test',password:'Test-only strong password 123!',name:'Test photographer',callbackURL:origin+'/mofolio/account'});
  assert.equal(signup.status,200);
  const verify=new URL(messages[0].link);
  const verification=await call(verify.pathname.replace('/api/stillbounds/auth','')+verify.search);
  assert.equal(verification.status,302);
  const account=new DesktopAccount(origin,store,transport);
  const request=await account.start();
  assert.equal((await call('/device?user_code='+request.userCode,undefined,verification.cookie)).status,200);
  assert.equal((await call('/device/approve',{userCode:request.userCode},verification.cookie)).status,200);
  await new Promise(resolve=>setTimeout(resolve,5100));
  const result=await account.finish();assert.equal(result.pending,false);assert.equal(result.user.email,'photographer@example.test');assert(!('token' in result));
  const reopened=new DesktopAccount(origin,store,transport);
  assert.equal((await reopened.status()).user.email,'photographer@example.test');
  await call('/revoke-other-sessions',{},verification.cookie);
  assert.equal((await reopened.status()).user,null);assert.equal(credential,undefined);
  console.log('PASS actual website registration, captured email verification, browser approval, native account session, restart and website revocation. No emails sent; isolated database.');
}finally{db.close();}
