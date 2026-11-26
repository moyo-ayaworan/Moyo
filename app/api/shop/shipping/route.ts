import { NextResponse } from 'next/server';
import { shippingRates } from '@/lib/shippingAdmin';
export async function GET(){try{return NextResponse.json({rates:await shippingRates()},{headers:{'Cache-Control':'no-store'}});}catch{return NextResponse.json({error:'Delivery options are temporarily unavailable.'},{status:503});}}
