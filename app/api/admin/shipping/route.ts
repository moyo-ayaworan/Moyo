import { randomUUID } from 'node:crypto';
import { NextRequest,NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { query } from '@/lib/db';
import { readJsonRequest } from '@/lib/requestBody';
import { parseShippingRate } from '@/lib/shipping';
import { PaymentError } from '@/lib/payments/policy';
const headers={'Cache-Control':'private, no-store'};
export async function GET(req:NextRequest){const denied=await requireAdmin(req);if(denied)return denied;return NextResponse.json({rates:(await query('SELECT * FROM shop_shipping_regions ORDER BY created_at DESC LIMIT 200')).rows},{headers});}
export async function POST(req:NextRequest){const denied=await requireAdmin(req,true);if(denied)return denied;const parsed=await readJsonRequest(req,2048);if(parsed.response)return parsed.response;
 try{const v=parseShippingRate(parsed.body);const id=parsed.body.id;if(id!==undefined&&(typeof id!=='string'||!/^[a-f0-9-]{36}$/i.test(id)))throw new PaymentError('Invalid shipping rule.',400);
 const values=[id||randomUUID(),v.label,v.country,v.region,v.feeKobo,v.pickup,v.active];
 const result=id?await query('UPDATE shop_shipping_regions SET label=$2,country=$3,region=$4,fee_kobo=$5,pickup=$6,active=$7 WHERE id=$1 RETURNING *',values):await query('INSERT INTO shop_shipping_regions(id,label,country,region,fee_kobo,pickup,active) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',values);
 return NextResponse.json({rate:result.rows[0]},{status:result.rowCount?200:404,headers});}catch(e){return NextResponse.json({error:e instanceof PaymentError?e.message:'Could not save shipping rule.'},{status:e instanceof PaymentError?e.status:503,headers});}}
