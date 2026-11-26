import { NextRequest,NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { query } from '@/lib/db';
import { readJsonRequest } from '@/lib/requestBody';
import { validReference } from '@/lib/payments/policy';
const headers={'Cache-Control':'private, no-store'};
export async function GET(req:NextRequest){const denied=await requireAdmin(req);if(denied)return denied;return NextResponse.json({orders:(await query(`SELECT reference,title,email,status,quantity,amount_kobo,shipping_kobo,shipping_details,fulfillment_status,tracking_number,created_at FROM payment_orders WHERE fulfillment_kind='physical' AND mode='live' ORDER BY created_at DESC LIMIT 200`)).rows},{headers});}
export async function PATCH(req:NextRequest){const denied=await requireAdmin(req,true);if(denied)return denied;const parsed=await readJsonRequest(req,2048);if(parsed.response)return parsed.response;const b=parsed.body;
 if(typeof b.reference!=='string'||!validReference(b.reference)||!['unfulfilled','processing','shipped','collected','cancelled'].includes(b.status)||typeof b.tracking!=='string'||b.tracking.length>200)return NextResponse.json({error:'Invalid fulfilment details.'},{status:400,headers});
 const result=await query(`UPDATE payment_orders SET fulfillment_status=$2,tracking_number=$3,updated_at=NOW() WHERE reference=$1 AND fulfillment_kind='physical' AND status='paid' RETURNING reference`,[b.reference,b.status,b.tracking.trim()]);return NextResponse.json({success:!!result.rowCount},{status:result.rowCount?200:409,headers});}
