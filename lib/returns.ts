import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { PaymentError } from './payments/policy.ts';
import { checkLowStock } from './shopOperations.ts';
export type ShopReturn={id:string;order_reference:string;quantity:number;reason:string;status:string;restocked_quantity:number;refund_kobo:string|number;refund_state:string;refund_reference:string;provider_refund_id:string|null};
export async function createReturn(c:PoolClient,input:{id:string;reference:string;quantity:number;amount:number;reason:string}){
 const order=(await c.query("SELECT * FROM payment_orders WHERE reference=$1 AND fulfillment_kind='physical' AND mode='live' FOR UPDATE",[input.reference])).rows[0];
 if(!order||!order.paid_at||!['paid','refunded'].includes(order.status))throw new PaymentError('Choose a verified physical purchase.',409);
 const existing=(await c.query<ShopReturn>('SELECT * FROM shop_returns WHERE id=$1',[input.id])).rows[0];if(existing){if(existing.order_reference!==input.reference||existing.quantity!==input.quantity||Number(existing.refund_kobo)!==input.amount||existing.reason!==input.reason)throw new PaymentError('This return request belongs to different details.',409);return existing;}
 const used=(await c.query(`SELECT COALESCE(SUM(quantity),0)::int total FROM shop_returns WHERE order_reference=$1 AND status<>'rejected'`,[input.reference])).rows[0].total;
 if(input.quantity+used>order.quantity||input.amount>Number(order.amount_kobo))throw new PaymentError('Return quantity or refund exceeds the purchase.',400);
 return (await c.query<ShopReturn>(`INSERT INTO shop_returns(id,order_reference,quantity,reason,refund_kobo,refund_reference) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[input.id,input.reference,input.quantity,input.reason,input.amount,`moyo-refund-${input.id}`])).rows[0];
}
export async function returnAction(c:PoolClient,id:string,action:string,quantity?:number){
 const base=(await c.query<ShopReturn>('SELECT * FROM shop_returns WHERE id=$1',[id])).rows[0];if(!base)throw new PaymentError('Return not found.',404);
 const order=(await c.query('SELECT * FROM payment_orders WHERE reference=$1 FOR UPDATE',[base.order_reference])).rows[0];
 const r=(await c.query<ShopReturn>('SELECT * FROM shop_returns WHERE id=$1 FOR UPDATE',[id])).rows[0];
 if(action==='restock'){
  if(r.status!=='received'&&r.status!=='closed')throw new PaymentError('Record receipt of returned goods before restocking.',409);
  if(!Number.isSafeInteger(quantity)||Number(quantity)<0||Number(quantity)>r.quantity||Number(quantity)<r.restocked_quantity)throw new PaymentError('Enter the cumulative number of returned units being restocked.',400);
  const delta=Number(quantity)-r.restocked_quantity;if(!delta)return;
  const reservation=(await c.query("SELECT quantity,state FROM shop_stock_reservations WHERE id=$1",[order.stock_reservation_id])).rows[0];if(reservation?.state!=='committed')throw new PaymentError('This purchase never deducted stock. Review it before restocking.',409);
  const stock=await c.query('UPDATE shop_inventory SET stock_on_hand=stock_on_hand+$2,updated_at=NOW() WHERE product_id=$1 AND stock_on_hand+$2<=1000000 RETURNING product_id',[order.target_id,delta]);if(!stock.rowCount)throw new PaymentError('Stock could not be restored.',409);
  await c.query('UPDATE shop_returns SET restocked_quantity=$2,updated_at=NOW() WHERE id=$1',[id,quantity]);await checkLowStock(c,order.target_id);return;
 }
 const allowed:Record<string,string[]>={approved:['requested'],rejected:['requested','approved'],received:['approved'],closed:['received']};
 if(r.status===action)return;
 if(!allowed[action]?.includes(r.status)||(action==='rejected'&&r.refund_state!=='none'))throw new PaymentError('This return cannot move to that status.',409);
 await c.query('UPDATE shop_returns SET status=$2,updated_at=NOW() WHERE id=$1',[id,action]);
}
export async function claimRefund(c:PoolClient,id:string,confirmation:string,amount:number){
 const base=(await c.query<ShopReturn>('SELECT * FROM shop_returns WHERE id=$1',[id])).rows[0];if(!base)throw new PaymentError('Return not found.',404);
 const order=(await c.query('SELECT * FROM payment_orders WHERE reference=$1 FOR UPDATE',[base.order_reference])).rows[0];
 const r=(await c.query<ShopReturn>('SELECT * FROM shop_returns WHERE id=$1 FOR UPDATE',[id])).rows[0];
 if(confirmation!==order.reference||amount!==Number(r.refund_kobo)||!['approved','received','closed'].includes(r.status)||!order.paid_at||!['paid','refunded'].includes(order.status))throw new PaymentError('Confirm the order reference and exact approved refund amount.',400);
 if(r.refund_state==='processed')return {order,request:r,send:false};
 if(r.refund_state==='pending'||r.refund_state==='needs-attention')return {order,request:r,send:false};
 if(r.refund_state==='submitting')throw new PaymentError('This refund is already being submitted. Check its status.',409);
 const amounts=(await c.query(`SELECT (SELECT COALESCE(SUM(refund_kobo),0) FROM shop_returns WHERE order_reference=$1 AND id<>$2 AND refund_state<>'none' AND refund_state<>'failed') + (SELECT COALESCE(SUM(e.amount_kobo),0) FROM payment_events e WHERE e.reference=$1 AND e.event_type='refund.processed' AND NOT EXISTS(SELECT 1 FROM shop_returns x WHERE x.order_reference=$1 AND e.event_key='refund.processed:'||$1||':'||x.provider_refund_id)) AS total`,[order.reference,id])).rows[0];
 if(Number(amounts.total)+amount>Number(order.amount_kobo))throw new PaymentError('Refunds exceed the remaining purchase amount. Reconcile existing refunds first.',409);
 await c.query("UPDATE shop_returns SET refund_state='submitting',updated_at=NOW() WHERE id=$1",[id]);return {order,request:r,send:true};
}
export const newReturnId=()=>randomUUID();
