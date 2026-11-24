import { NextRequest, NextResponse } from 'next/server';
import { createFeedback } from '@/lib/stillboundsFeedback';
import { limited, privateHeaders, sameOrigin } from '@/lib/studio/security';
import { boundedBody, assertStudio, StudioError } from '@/lib/studio/protocol';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  try {
    if (request.headers.has('origin')) sameOrigin(request);
    else assertStudio(!request.headers.get('sec-fetch-site') || request.headers.get('sec-fetch-site') === 'none','Request origin rejected.',403);
    assertStudio(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() === 'application/json','Use JSON for feedback.',415);
    await limited(request,'stillbounds-app-feedback',10,3600);
    let input: unknown;
    try { input = JSON.parse((await boundedBody(request,64*1024)).toString('utf8')); }
    catch (e) { if (e instanceof StudioError) throw e; throw new StudioError('Invalid JSON.'); }
    return NextResponse.json(await createFeedback(input),{status:201,headers:privateHeaders});
  } catch (e) {
    return NextResponse.json({error:e instanceof StudioError ? e.message : 'Feedback is temporarily unavailable.'},
      {status:e instanceof StudioError ? e.status : 503,headers:privateHeaders});
  }
}
