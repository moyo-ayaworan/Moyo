import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { listFeedback, updateFeedback } from '@/lib/stillboundsFeedback';
import { bodyJSON, StudioError } from '@/lib/studio/protocol';
import { privateHeaders } from '@/lib/studio/security';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const denied = requireAdmin(request); if (denied) { Object.entries(privateHeaders).forEach(([k,v]) => denied.headers.set(k,v)); return denied; }
  try { return NextResponse.json(await listFeedback(request.nextUrl.searchParams.get('status') || 'all',Number(request.nextUrl.searchParams.get('page') || 0)),{headers:privateHeaders}); }
  catch(e) { return failure(e); }
}
export async function PATCH(request: NextRequest) {
  const denied = requireAdmin(request,true); if (denied) { Object.entries(privateHeaders).forEach(([k,v]) => denied.headers.set(k,v)); return denied; }
  try { return NextResponse.json(await updateFeedback(await bodyJSON(request)),{headers:privateHeaders}); }
  catch(e) { return failure(e); }
}
function failure(e: unknown) { return NextResponse.json({error:e instanceof StudioError ? e.message : 'Feedback is temporarily unavailable.'},{status:e instanceof StudioError ? e.status : 503,headers:privateHeaders}); }
