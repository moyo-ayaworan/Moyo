import { orderFilters,updateFulfillment } from '@/lib/shopOperations';
import { deliverShopMail } from '@/lib/shopMail';
import { PaymentError } from '@/lib/payments/policy';
import { after,NextRequest,NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { query,transaction } from '@/lib/db';
import { readJsonRequest } from '@/lib/requestBody';
import { validReference } from '@/lib/payments/policy';
const headers={'Cache-Control':'private, no-store'};
export async function GET(req:NextRequest){const denied=await requireAdmin(req);if(denied)return denied;try{const f=orderFilters(req.nextUrl.searchParams);const result=await query(`SELECT reference,title,email,status,fulfillment_kind,quantity,amount_kobo,shipping_kobo,shipping_details,fulfillment_status,tracking_number,created_at FROM payment_orders WHERE kind='digital' AND mode='live' AND ($6='all' OR fulfillment_kind=$6) AND ($1='' OR email ILIKE $2 ESCAPE '\\' OR title ILIKE $2 ESCAPE '\\' OR reference ILIKE $2 ESCAPE '\\') AND ($3='' OR status=$3) AND ($4='' OR fulfillment_status=$4) ORDER BY created_at DESC,reference LIMIT 51 OFFSET $5`,[f.search,f.pattern,f.payment,f.fulfillment,f.page*50,f.kind]);return NextResponse.json({orders:result.rows.slice(0,50),hasMore:result.rows.length>50,page:f.page},{headers});}catch(e){return NextResponse.json({error:e instanceof PaymentError?e.message:'Could not load orders.'},{status:e instanceof PaymentError?e.status:503,headers});}}
export async function PATCH(req:NextRequest){const denied=await requireAdmin(req,true);if(denied)return denied;const parsed=await readJsonRequest(req,2048);if(parsed.response)return parsed.response;const b=parsed.body;
 if(typeof b.reference!=='string'||!validReference(b.reference)||!['unfulfilled','processing','ready_for_pickup','shipped','collected','cancelled'].includes(b.status)||typeof b.tracking!=='string'||b.tracking.length>200)return NextResponse.json({error:'Invalid fulfilment details.'},{status:400,headers});
 try{const changed=await transaction(c=>updateFulfillment(c,b.reference,b.status,b.tracking.trim()));if(changed)after(()=>deliverShopMail());return NextResponse.json({success:true,notificationQueued:changed&&['processing','ready_for_pickup','shipped','collected'].includes(b.status)},{headers});}catch(e){return NextResponse.json({error:e instanceof PaymentError?e.message:'Could not update order.'},{status:e instanceof PaymentError?e.status:503,headers});}}
