import { NextRequest,NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { query } from '@/lib/db';
import { readJsonRequest } from '@/lib/requestBody';
import { matchingShippingRules } from '@/lib/shopOperations';
export async function POST(req:NextRequest){const denied=await requireAdmin(req,true);if(denied)return denied;const parsed=await readJsonRequest(req,1024);if(parsed.response)return parsed.response;const {country,region}=parsed.body;
 if(typeof country!=='string'||!/^[A-Za-z]{2}$/.test(country)||typeof region!=='string'||region.length>100)return NextResponse.json({error:'Enter a country code and optional region.'},{status:400});
 const rates=(await query('SELECT id,label,country,region,fee_kobo,pickup,active FROM shop_shipping_regions WHERE active=TRUE AND country=$1',[country.toUpperCase()])).rows;
 return NextResponse.json({rates:matchingShippingRules(rates,country,region)},{headers:{'Cache-Control':'private, no-store'}});}
