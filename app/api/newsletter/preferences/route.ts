import { NextRequest, NextResponse } from 'next/server';
import { readJsonRequest } from '@/lib/requestBody';
import { rateLimit } from '@/lib/rateLimit';
import { changeNewsletterPreference, validNewsletterToken } from '@/lib/newsletter/server';
const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'};
export async function POST(request: NextRequest) {
  if(request.headers.get('origin')!==new URL(request.url).origin) return NextResponse.json({error:'Open this link on the website.'},{status:403,headers});
  try {
    const limited=await rateLimit(request,'newsletter-preferences',20,900);if(limited)return limited;
    const parsed=await readJsonRequest(request,1000);if(parsed.response)return parsed.response;
    const {action,token}=parsed.body;
    if(!['confirm','unsubscribe'].includes(action)||!validNewsletterToken(token))return NextResponse.json({error:'Invalid preference link.'},{status:400,headers});
    const changed=await changeNewsletterPreference(action,token);
    return NextResponse.json(changed?{message:action==='confirm'?'Your subscription is confirmed.':'You have been unsubscribed from this list.'}:{error:'This link is invalid or has expired. Request a fresh confirmation link from the newsletter page.'},{status:changed?200:400,headers});
  }catch{return NextResponse.json({error:'We could not update your preference. Please try again.'},{status:503,headers});}
}
