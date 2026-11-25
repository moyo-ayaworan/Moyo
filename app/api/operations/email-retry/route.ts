import {timingSafeEqual} from 'node:crypto';
import {deliverPaymentNotifications} from '@/lib/payments/notifications';
import {deliverBookingRecovery} from '@/lib/bookingRecovery';
import {deliverNewsletterCampaigns} from '@/lib/newsletter/queue';
import {rateLimitIdentity} from '@/lib/rateLimit';
export const runtime='nodejs';export const maxDuration=60;
export async function POST(request:Request){
 const expected=process.env.OPERATIONS_MONITOR_SECRET?'Bearer '+process.env.OPERATIONS_MONITOR_SECRET:'',actual=request.headers.get('authorization')||'';
 const headers={'Cache-Control':'private, no-store'};
 if(!expected||Buffer.byteLength(expected)!==Buffer.byteLength(actual)||!timingSafeEqual(Buffer.from(expected),Buffer.from(actual)))return Response.json({error:'Unauthorized'},{status:401,headers});
 const limited=await rateLimitIdentity('email-worker','email-worker',2,300);if(limited)return limited;
 try{
  const deadline=Date.now()+35000;
  await deliverPaymentNotifications({limit:5,deadline:Date.now()+10000});
  const booking=await deliverBookingRecovery({limit:3,deadline:Math.min(deadline,Date.now()+12000)});
  const campaign=await deliverNewsletterCampaigns({limit:5,deadline});
  const deferred=(booking?.deferred||0)+campaign.deferred;
  return Response.json({bookingDelivered:booking?.delivered||0,campaignDelivered:campaign.delivered,deferred},{status:deferred?503:200,headers});
 }catch{return Response.json({error:'Email retry needs attention.'},{status:503,headers});}
}
