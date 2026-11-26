import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { analyticsReport } from '@/lib/analytics';
export async function GET(req:NextRequest) {
 const denied=await requireAdmin(req);if(denied)return denied;
 const period=req.nextUrl.searchParams.get('days') || '30';
 const days=period==='today'?1:period==='week'?(new Date().getUTCDay()+6)%7+1:period==='month'?new Date().getUTCDate():Number(period);
 if(!['today','week','month','7','30','90'].includes(period))return NextResponse.json({error:'Choose today, this week, this month, or 7, 30 or 90 days.'},{status:400});
 try{return NextResponse.json(await analyticsReport(days,period),{headers:{'Cache-Control':'private, no-store'}});}
 catch{return NextResponse.json({error:'Analytics are temporarily unavailable. Please retry.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
