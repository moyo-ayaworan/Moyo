import { NextRequest } from 'next/server';
import { adminRequestOriginAllowed, ADMIN_COOKIE, hasAdminSession } from '@/lib/auth';
import { readJsonRequest } from '@/lib/requestBody';
import { rateLimit } from '@/lib/rateLimit';
import { analyticsPath, excludedAnalytics } from '@/lib/analyticsPolicy';
import { recordAnalytics } from '@/lib/analytics';
export async function POST(req: NextRequest) {
  if (!adminRequestOriginAllowed(req,true)) return new Response(null,{status:403});
  if (excludedAnalytics(req.headers) || hasAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) return new Response(null,{status:204});
  const parsed=await readJsonRequest(req,1024); if(parsed.response)return parsed.response;
  const path=analyticsPath(parsed.body.path), id=parsed.body.id;
  if(!path || typeof id!=='string' || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id))return new Response(null,{status:400});
  try { const limited=await rateLimit(req,'analytics',120,60); if(limited)return limited;
    await recordAnalytics(req,'pageview',path,{id,referrer:parsed.body.referrer}); return new Response(null,{status:204});
  } catch { return new Response(null,{status:503}); }
}
