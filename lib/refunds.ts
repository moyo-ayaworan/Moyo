import { transaction,query } from './db';
import { paystackRequest,paystackSecret } from './paystack';
import { paymentMode,PaymentError } from './payments/policy';
import { payments } from './payments/server';
import { claimRefund,type ShopReturn } from './returns';
async function storeRefund(r:ShopReturn,result:Record<string,unknown>,order:{reference:string;mode:string;currency:string;provider_id?:string|null}){
 const transactionId=typeof result.transaction==='object'&&result.transaction?String((result.transaction as Record<string,unknown>).id):String(result.transaction);
 const transactionReference=typeof result.transaction==='object'&&result.transaction?String((result.transaction as Record<string,unknown>).reference||''):'';
 if(result.reference!==r.refund_reference||result.domain!==order.mode||result.currency!==order.currency||Number(result.amount)!==Number(r.refund_kobo)||((!order.provider_id||transactionId!==String(order.provider_id))&&transactionReference!==order.reference)||!/^\d+$/.test(String(result.id)))throw new PaymentError('Refund response does not match this purchase. Reconcile it in Paystack.',502);
 const status=String(result.status),state=['processed','failed','needs-attention'].includes(status)?status:'pending';
 if(state==='processed')await payments.revoke(order.reference,'refund.processed',String(result.id),order.mode as 'live'|'test',order.currency,Number(r.refund_kobo));
 await query('UPDATE shop_returns SET provider_refund_id=$2,refund_state=$3,updated_at=NOW() WHERE id=$1',[r.id,String(result.id),state]);
 return state;
}
export async function processReturnRefund(id:string,confirmation?:string,amount?:number){
 const r=(await query('SELECT * FROM shop_returns WHERE id=$1',[id])).rows[0] as ShopReturn|undefined;if(!r)throw new PaymentError('Return not found.',404);
 const order=await payments.order(r.order_reference);if(!order||order.mode!==paymentMode(paystackSecret()))throw new PaymentError('Refund belongs to another payment environment.',409);
 if(confirmation!==undefined&&(confirmation!==order.reference||amount!==Number(r.refund_kobo)))throw new PaymentError('Confirm the exact order reference and refund amount.',400);
 // Always reconcile the same provider reference before retrying a previous submission.
 if(r.refund_state!=='none'){
  const found=await paystackRequest(`/refund?reference=${encodeURIComponent(r.refund_reference)}`) as unknown;
  if(!Array.isArray(found))throw new PaymentError('Refund reconciliation is unavailable.',502);
  const existing=found.find((item:Record<string,unknown>)=>item.reference===r.refund_reference);
  if(existing)return storeRefund(r,existing,order);
  if(confirmation===undefined)return r.refund_state;
 }
 if(confirmation===undefined)return r.refund_state;
 const claimed=await transaction(c=>claimRefund(c,id,confirmation,amount!));
 if(!claimed.send)return claimed.request.refund_state;
 try{
  const result=await paystackRequest('/refund',{transaction:order.reference,reference:r.refund_reference,amount:Number(r.refund_kobo),currency:order.currency,merchant_note:`Return ${r.id}: ${r.reason}`});
  return await storeRefund(r,result,order);
 }catch(error){await query("UPDATE shop_returns SET refund_state=CASE WHEN refund_state='submitting' THEN 'unknown' ELSE refund_state END,updated_at=NOW() WHERE id=$1",[id]);throw error;}
}

// Reconciliation only reads existing provider refunds; it never initiates one.
export async function reconcileShopRefunds(deadline=Date.now()+20000){
 const rows=(await query("SELECT id FROM shop_returns WHERE refund_state IN ('pending','unknown','submitting') AND updated_at<NOW()-INTERVAL '5 minutes' ORDER BY updated_at LIMIT 20")).rows;
 let checked=0,failed=0;
 for(const row of rows){if(Date.now()>=deadline)break;try{await processReturnRefund(row.id);checked++;}catch{failed++;}}
 return {checked,failed};
}
