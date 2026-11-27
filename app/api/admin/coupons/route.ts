import { randomUUID } from 'node:crypto';
import { NextRequest,NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { query,transaction } from '@/lib/db';
import { readJsonRequest } from '@/lib/requestBody';
import { parseCoupon } from '@/lib/couponAdmin';
import { PaymentError } from '@/lib/payments/policy';
const headers={'Cache-Control':'private, no-store'};
export async function GET(req:NextRequest){const denied=await requireAdmin(req);if(denied)return denied;
 const result=await query(`SELECT c.*,COUNT(o.reference) FILTER(WHERE o.mode='live' AND o.status IN ('paid','refunded','disputed','review'))::int used,COUNT(o.reference) FILTER(WHERE o.mode='live' AND o.status IN ('pending','failed') AND o.coupon_reserved_until>NOW())::int reserved FROM shop_coupons c LEFT JOIN payment_orders o ON o.coupon_id=c.id GROUP BY c.id ORDER BY c.created_at DESC LIMIT 200`);const products=await query("SELECT id,title,section,product_kind,is_active FROM digital_products WHERE section IN ('art','photography') ORDER BY title,id");
 return NextResponse.json({coupons:result.rows,products:products.rows},{headers});}
export async function POST(req:NextRequest){const denied=await requireAdmin(req,true);if(denied)return denied;
 const parsed=await readJsonRequest(req,4096);if(parsed.response)return parsed.response;
 try{const value=parseCoupon(parsed.body);const coupon=await transaction(async c=>{
  if(value.productId){const p=(await c.query('SELECT section FROM digital_products WHERE id=$1',[value.productId])).rows[0];if(!p||(value.section&&p.section!==value.section))throw new PaymentError('Choose a product in the selected shop.',400);}
  return (await c.query(`INSERT INTO shop_coupons(id,code,kind,value,section,product_id,minimum_kobo,max_uses,per_email_limit,starts_at,ends_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(code) DO NOTHING RETURNING *`,[randomUUID(),value.code,value.kind,value.value,value.section,value.productId,value.minimum,value.maxUses,value.perEmailLimit,value.startsAt,value.endsAt])).rows[0];
 });if(!coupon)throw new PaymentError('That coupon code already exists. Choose another.',409);return NextResponse.json({coupon},{headers});}
 catch(e){return NextResponse.json({error:e instanceof PaymentError?e.message:'Could not create coupon.'},{status:e instanceof PaymentError?e.status:503,headers});}}
export async function PATCH(req:NextRequest){const denied=await requireAdmin(req,true);if(denied)return denied;const parsed=await readJsonRequest(req,1024);if(parsed.response)return parsed.response;
 const {id,active}=parsed.body;if(typeof id!=='string'||!/^[a-f0-9-]{36}$/i.test(id)||typeof active!=='boolean')return NextResponse.json({error:'Choose a valid coupon and status.'},{status:400,headers});
 const result=await query('UPDATE shop_coupons SET active=$2 WHERE id=$1 RETURNING id',[id,active]);return NextResponse.json({success:!!result.rowCount},{status:result.rowCount?200:404,headers});}
