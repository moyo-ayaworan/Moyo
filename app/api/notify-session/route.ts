import { readJsonRequest } from '@/lib/requestBody';
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { publicTrackingPath } from '@/lib/privacy';
import { excludedAnalytics } from '@/lib/analyticsPolicy';
import { visitContext } from '@/lib/visitContext';
import { rateLimit } from '@/lib/rateLimit';

const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'moyoayaworan@gmail.com';
export async function POST(req: Request) {
 if(process.env.VERCEL_ENV!=='production')return new Response(null,{status:204});
 const privateHeaders={'Cache-Control':'private, no-store'};
 try{
  if(excludedAnalytics(req.headers))return new Response(null,{status:204,headers:privateHeaders});
  const jsonRequest=await readJsonRequest(req,2000);if(jsonRequest.response)return jsonRequest.response;
  const safePath=publicTrackingPath(jsonRequest.body.path);
  if(!safePath||/^\/(?:stillbounds|mofolio)(?:\/|$)/.test(safePath))return new Response(null,{status:204,headers:privateHeaders});
  // Bind browser-generated visit emails to this origin, rather than trusting posted visitor metadata.
  if(req.headers.get('origin')!==new URL(req.url).origin||req.headers.get('sec-fetch-site')==='cross-site')return new Response(null,{status:403,headers:privateHeaders});
  const limited=await rateLimit(req,'session-email',3,3600);if(limited)return limited;
  if(!process.env.EMAIL_USER||!process.env.EMAIL_PASS)return NextResponse.json({error:'Email not configured'},{status:503,headers:privateHeaders});
  const context=visitContext(req.headers);
  const time=new Date().toLocaleString('en-GB',{timeZone:'Africa/Lagos',dateStyle:'medium',timeStyle:'long'});
  const transporter=nodemailer.createTransport({service:'gmail',auth:{user:process.env.EMAIL_USER,pass:process.env.EMAIL_PASS},connectionTimeout:5000,greetingTimeout:5000,socketTimeout:10000});
  const info=await transporter.sendMail({from:process.env.EMAIL_USER,to:CONTACT_EMAIL,subject:'New Active Session Detected',text:[
   'A new visit was detected on a public page.',`Time (Africa/Lagos): ${time}`,`Page: ${safePath}`,
   `Approximate location: ${context.location}`,`Device category: ${context.device}`,`Browser: ${context.browser}`,`Operating system: ${context.os}`,
   '', 'Location is estimated from the network and may reflect a VPN or proxy. Device details are inferred from browser headers and can be inaccurate. Exact location, device model and visitor identity are not verified.',
  ].join('\n')});
  if(!info.accepted?.length||info.rejected?.length)throw Error('Delivery rejected');
  return NextResponse.json({message:'Session logged'},{headers:privateHeaders});
 }catch{console.error('[notify-session] Session alert delivery failed');return NextResponse.json({error:'Failed to log session'},{status:503,headers:privateHeaders});}
}
