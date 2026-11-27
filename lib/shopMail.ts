import { transaction,query } from './db';
import { newsletterTransport } from './newsletter/mail';
import { isPaymentEmail,accessProof } from './payments/policy';
import { purchaseSigningKey } from './purchaseAccess';
import { paymentOrigin } from './paystack';
import { productShopPath } from './productSections';
type Notice={id:string;order_reference:string|null;kind:string;payload:Record<string,unknown>;attempts:number};
export async function deliverShopMail(options:{limit?:number;deadline?:number}={}){
 let delivered=0,deferred=0,discarded=0;let config:ReturnType<typeof newsletterTransport>;
 try{config=newsletterTransport();}catch{return {delivered,deferred:1,discarded};}
 const deadline=options.deadline??Date.now()+25000;
 for(let i=0;i<(options.limit??10)&&Date.now()<deadline;i++){
  const n=await transaction(async c=>{const row=(await c.query<Notice>(`SELECT * FROM shop_notifications WHERE sent_at IS NULL AND discarded=FALSE AND next_attempt_at<=NOW() AND (claimed_at IS NULL OR claimed_at<NOW()-INTERVAL '5 minutes') ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED`)).rows[0];if(row)await c.query('UPDATE shop_notifications SET claimed_at=NOW(),attempts=attempts+1 WHERE id=$1',[row.id]);return row;});
  if(!n)break;
  try{
   let to='',subject='',text='';const studio=process.env.CONTACT_EMAIL||'moyoayaworan@gmail.com';let obsolete=false;
   if(n.kind==='low_stock'){
    const row=(await query('SELECT stock_on_hand,low_stock_threshold FROM shop_inventory WHERE product_id=$1',[n.payload.productId])).rows[0];obsolete=!row||row.low_stock_threshold===null||row.stock_on_hand>row.low_stock_threshold;
    to=studio;subject=`Low stock · ${String(n.payload.title)}`;text=`Product #${n.payload.productId}: ${n.payload.title}\nStock on hand: ${row?.stock_on_hand??0}\nAlert threshold: ${row?.low_stock_threshold??0}\nReview inventory: ${paymentOrigin()}/admin/shop-tools`;
   }else{
    const order=(await query('SELECT * FROM payment_orders WHERE reference=$1',[n.order_reference])).rows[0];obsolete=!order||order.status!=='paid'||Number(order.fulfillment_version)!==Number(n.payload.version);
    if(order){to=order.email;const expiry=Date.now()+30*86400000,token=`${expiry}.${accessProof(order.reference,order.email,expiry,purchaseSigningKey())}`;
     const status=String(n.payload.status),label=status==='processing'?'Your order is being prepared':status==='shipped'?'Your order has shipped':'Your pickup order is ready';
     // "collected" is a completed pickup, not a ready-for-pickup notification.
     subject=`${status==='collected'?'Your order was collected':label} · ${order.title}`;
     text=`${order.title}\nOrder: ${order.reference}\nStatus: ${status}\n${n.payload.tracking?'Tracking / delivery reference: '+String(n.payload.tracking)+'\n':''}View your order:\n${paymentOrigin()}${productShopPath(order.shop_section||'photography')}/payment?reference=${encodeURIComponent(order.reference)}#access=${token}`;
    }
   }
   if(obsolete){await query('UPDATE shop_notifications SET discarded=TRUE,claimed_at=NULL WHERE id=$1',[n.id]);discarded++;continue;}
   if(!isPaymentEmail(to))throw Error('Invalid recipient');
   const result=await config.mail.sendMail({from:config.from,to:{address:to,name:''},replyTo:studio,subject,text,messageId:`<shop-${n.id}@${new URL(paymentOrigin()).hostname}>`});
   if(!result.accepted?.length||result.rejected?.length)throw Error('Delivery deferred');
   await query('UPDATE shop_notifications SET sent_at=NOW(),claimed_at=NULL WHERE id=$1',[n.id]);delivered++;
  }catch{await query(`UPDATE shop_notifications SET claimed_at=NULL,next_attempt_at=NOW()+(LEAST(360,POWER(2,LEAST(attempts,8)))*INTERVAL '1 minute') WHERE id=$1`,[n.id]);deferred++;}
 }
 return {delivered,deferred,discarded};
}
