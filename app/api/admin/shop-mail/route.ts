import { after,NextRequest,NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { query } from '@/lib/db';
import { deliverShopMail } from '@/lib/shopMail';
export async function GET(req:NextRequest){const denied=await requireAdmin(req);if(denied)return denied;const row=(await query(`SELECT COUNT(*) FILTER(WHERE sent_at IS NULL AND discarded=FALSE)::int pending,COUNT(*) FILTER(WHERE sent_at IS NULL AND discarded=FALSE AND attempts>0)::int deferred FROM shop_notifications`)).rows[0];return NextResponse.json(row,{headers:{'Cache-Control':'private, no-store'}});}
export async function POST(req:NextRequest){const denied=await requireAdmin(req,true);if(denied)return denied;after(()=>deliverShopMail({limit:20}));return NextResponse.json({queued:true},{headers:{'Cache-Control':'private, no-store'}});}
