import { NextRequest, NextResponse, after } from 'next/server';
import { recordAnalytics } from '@/lib/analytics';
import { ADMIN_COOKIE, hasAdminSession } from '@/lib/auth';
export async function GET(req:NextRequest,{params}:{params:Promise<{arch:string}>}) {
 const {arch}=await params;if(!['arm64','x64'].includes(arch))return new Response(null,{status:404});
 if(req.method==='GET'&&!hasAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) after(async()=>{try{await recordAnalytics(req,'download','/stillbounds',{detail:arch,referrer:req.headers.get('referer') || ''});}catch{console.error('[analytics] Download metric unavailable.');}});
 return NextResponse.redirect(`https://stillbounds-downloads.mofolio.workers.dev/stillbounds/downloads/${arch}`,{status:302,headers:{'Cache-Control':'no-store'}});
}
