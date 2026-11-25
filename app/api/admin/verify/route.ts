import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE, ADMIN_SESSION_SECONDS, adminPasswordMatches, adminRequestOriginAllowed, requireAdmin } from '@/lib/auth';
import { ADMIN_CHALLENGE_COOKIE, adminChallengeActive, beginAdminLogin, finishAdminLogin } from '@/lib/adminLogin';
import { rateLimit, rateLimitIdentity } from '@/lib/rateLimit';
import { readJsonRequest } from '@/lib/requestBody';
const headers={'Cache-Control':'private, no-store'};
export async function GET(req:NextRequest){return await requireAdmin(req)||NextResponse.json({success:true},{headers});}
export async function POST(req:NextRequest){
 if(!adminRequestOriginAllowed(req,true))return NextResponse.json({error:'Request origin rejected.'},{status:403,headers});
 try{
  const parsed=await readJsonRequest(req,2048);if(parsed.response)return parsed.response;
  const code=typeof parsed.body.code==='string'?parsed.body.code.trim():'';
  if(code){
   const limited=await rateLimit(req,'admin-mfa',10,900);if(limited)return limited;
   if(!await adminChallengeActive(req.cookies.get(ADMIN_CHALLENGE_COOKIE)?.value||''))return NextResponse.json({error:'Sign in again to continue.'},{status:401,headers});
   const globalLimit=await rateLimitIdentity('admin','admin-mfa-global',20,300);if(globalLimit)return globalLimit;
   const result=await finishAdminLogin(req.cookies.get(ADMIN_CHALLENGE_COOKIE)?.value||'',code);
   if(!result)return NextResponse.json({error:'Code not accepted. Use a fresh authenticator code or an unused recovery code. Sign in again if this attempt expired.'},{status:401,headers});
   const response=NextResponse.json({success:true,...result.recoveryCodes?{recoveryCodes:result.recoveryCodes}:{}},{headers});
   response.cookies.set(ADMIN_COOKIE,result.token,{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',path:'/',maxAge:ADMIN_SESSION_SECONDS});
   response.cookies.set(ADMIN_CHALLENGE_COOKIE,'',{httpOnly:true,path:'/',maxAge:0});response.cookies.set('moyo-admin-key','',{httpOnly:true,path:'/',maxAge:0});return response;
  }
  const limited=await rateLimit(req,'admin-login',8,900);if(limited)return limited;
  if(!adminPasswordMatches(req.headers.get('x-admin-key')))return NextResponse.json({error:'Invalid admin password.'},{status:401,headers});
  const {token,...challenge}=await beginAdminLogin();const response=NextResponse.json(challenge,{status:202,headers});
  response.cookies.set(ADMIN_CHALLENGE_COOKIE,token,{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',path:'/',maxAge:300});return response;
 }catch{return NextResponse.json({error:'Admin sign-in is temporarily unavailable.'},{status:503,headers});}
}
