import { after,NextRequest,NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { query,transaction } from '@/lib/db';
import { readJsonRequest } from '@/lib/requestBody';
import { createReturn,returnAction } from '@/lib/returns';
import { processReturnRefund } from '@/lib/refunds';
import { PaymentError,priceToKobo,validReference } from '@/lib/payments/policy';
import { deliverPaymentNotifications } from '@/lib/payments/notifications';
const headers={'Cache-Control':'private, no-store'};
export async function GET(req:NextRequest){const denied=await requireAdmin(req);if(denied)return denied;return NextResponse.json({returns:(await query(`SELECT r.*,o.title,o.email,o.status AS payment_status FROM shop_returns r JOIN payment_orders o ON o.reference=r.order_reference ORDER BY r.created_at DESC LIMIT 200`)).rows},{headers});}
export async function POST(req:NextRequest){const denied=await requireAdmin(req,true);if(denied)return denied;const parsed=await readJsonRequest(req,4096);if(parsed.response)return parsed.response;const b=parsed.body;
 try{
 if(typeof b.id!=='string'||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(b.id))throw new PaymentError('Invalid return request.',400);
 if(b.action==='create'){if(typeof b.reference!=='string'||!validReference(b.reference)||typeof b.quantity!=='number'||!Number.isSafeInteger(b.quantity)||b.quantity<1||b.quantity>10000||typeof b.reason!=='string'||!b.reason.trim()||b.reason.length>1000)throw new PaymentError('Enter an order, quantity and reason.',400);const result=await transaction(c=>createReturn(c,{id:b.id,reference:b.reference,quantity:b.quantity,reason:b.reason.trim(),amount:priceToKobo(String(b.amount))}));return NextResponse.json({return:result},{headers});}
 if(b.action==='refund'){if(typeof b.confirmReference!=='string'||b.confirmed!==true)throw new PaymentError('Confirm the order and refund amount.',400);const state=await processReturnRefund(b.id,b.confirmReference,priceToKobo(String(b.amount)));after(()=>deliverPaymentNotifications());return NextResponse.json({state},{headers});}
 if(b.action==='reconcile'){return NextResponse.json({state:await processReturnRefund(b.id)},{headers});}
 if(!['approved','rejected','received','closed','restock'].includes(b.action))throw new PaymentError('Choose a valid return action.',400);
 await transaction(c=>returnAction(c,b.id,b.action,b.quantity));return NextResponse.json({success:true},{headers});
 }catch(e){return NextResponse.json({error:e instanceof PaymentError?e.message:'Return operation could not be completed. Check the original request before retrying.'},{status:e instanceof PaymentError?e.status:503,headers});}}
