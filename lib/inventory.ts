import { checkLowStock } from './shopOperations.ts';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { PaymentError } from './payments/policy.ts';
export function stockQuantity(value:unknown){if(typeof value!=='number'||!Number.isSafeInteger(value)||value<1||value>10000)throw new PaymentError('Quantity must be a whole number from 1 to 10,000.',400);return value;}
export async function reserveStock(c:PoolClient,productId:number,quantity:number,reservationId=randomUUID()){
 quantity=stockQuantity(quantity);
 const stock=(await c.query('SELECT stock_on_hand FROM shop_inventory WHERE product_id=$1 FOR UPDATE',[productId])).rows[0];
 if(!stock)throw new PaymentError('This product has no inventory.',404);
 const existing=(await c.query('SELECT * FROM shop_stock_reservations WHERE id=$1',[reservationId])).rows[0];
 if(existing){if(existing.product_id!==productId||existing.quantity!==quantity||existing.state!=='held'||new Date(existing.expires_at).getTime()<=Date.now())throw new PaymentError('Stock reservation cannot be reused.',409);return existing;}
 const held=(await c.query(`SELECT COALESCE(SUM(quantity),0)::int total FROM shop_stock_reservations WHERE product_id=$1 AND state='held' AND expires_at>NOW()`,[productId])).rows[0].total;
 if(quantity>stock.stock_on_hand-held)throw new PaymentError('Not enough stock is available.',409);
 return (await c.query(`INSERT INTO shop_stock_reservations(id,product_id,quantity,expires_at) VALUES($1,$2,$3,NOW()+INTERVAL '30 minutes') RETURNING *`,[reservationId,productId,quantity])).rows[0];
}
export async function commitStock(c:PoolClient,id:string){
 const reservation=(await c.query('SELECT * FROM shop_stock_reservations WHERE id=$1',[id])).rows[0];if(!reservation)throw new PaymentError('Reservation not found.',404);
 await c.query('SELECT product_id FROM shop_inventory WHERE product_id=$1 FOR UPDATE',[reservation.product_id]);
 const current=(await c.query('SELECT * FROM shop_stock_reservations WHERE id=$1 FOR UPDATE',[id])).rows[0];
 if(current.state==='committed')return;
 if(current.state!=='held'||new Date(current.expires_at).getTime()<=Date.now())throw new PaymentError('Reservation expired; payment needs review.',409);
 const updated=await c.query('UPDATE shop_inventory SET stock_on_hand=stock_on_hand-$2,updated_at=NOW() WHERE product_id=$1 AND stock_on_hand>=$2 RETURNING product_id',[current.product_id,current.quantity]);
 if(!updated.rowCount)throw new PaymentError('Stock needs review.',409);
 await c.query("UPDATE shop_stock_reservations SET state='committed' WHERE id=$1",[id]);
 await checkLowStock(c,current.product_id);
}
