import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { ensureAnalytics } from '@/lib/analytics';
import { query } from '@/lib/db';
export async function GET(req:NextRequest){
 const expected=process.env.CRON_SECRET?`Bearer ${process.env.CRON_SECRET}`:'',actual=req.headers.get('authorization') || '';
 const cron=!!expected && Buffer.byteLength(expected)===Buffer.byteLength(actual) && timingSafeEqual(Buffer.from(expected),Buffer.from(actual));
 if(!cron){const denied=await requireAdmin(req,true);if(denied)return denied;}
 const headers={'Cache-Control':'private, no-store'};
 try{await ensureAnalytics();await query(`DELETE FROM site_analytics WHERE happened_at < NOW() - INTERVAL '90 days'`);return NextResponse.json({success:true},{headers});}
 catch{return NextResponse.json({error:'Analytics cleanup needs retry.'},{status:503,headers});}
}
