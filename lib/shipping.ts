import type { PoolClient } from 'pg';
import { PaymentError } from './payments/policy.ts';
export function parseShippingRate(b:Record<string,unknown>){
 const label=typeof b.label==='string'?b.label.trim():'',country=typeof b.country==='string'?b.country.trim().toUpperCase():'',region=typeof b.region==='string'?b.region.trim():'';
 if(!label||label.length>120||!/^[A-Z]{2}$/.test(country)||region.length>100||typeof b.pickup!=='boolean'||typeof b.active!=='boolean'||!Number.isSafeInteger(b.feeKobo)||Number(b.feeKobo)<0)throw new PaymentError('Enter a label, two-letter country code and non-negative shipping fee.',400);
 return {label,country,region,feeKobo:Number(b.feeKobo),pickup:b.pickup,active:b.active};
}
export function physicalSubtotal(unit:number,quantity:number){const amount=unit*quantity;if(!Number.isSafeInteger(amount)||amount<=0)throw new PaymentError('Invalid purchase total.',400);return amount;}
export async function shippingQuote(c:PoolClient,id:unknown,details:unknown){
 if(typeof id!=='string'||!/^[a-f0-9-]{36}$/i.test(id)||!details||typeof details!=='object'||Array.isArray(details))throw new PaymentError('Choose shipping and enter your delivery details.',400);
 const rate=(await c.query('SELECT * FROM shop_shipping_regions WHERE id=$1 AND active=TRUE FOR SHARE',[id])).rows[0];if(!rate)throw new PaymentError('This shipping option is unavailable.',400);
 const b=details as Record<string,unknown>,text=(key:string,max:number,required=true)=>{const v=b[key];if(v===undefined&&!required)return '';if(typeof v!=='string'||v.trim().length>max||(required&&!v.trim()))throw new PaymentError('Complete the delivery details.',400);return v.trim();};
 const name=text('name',120),phone=text('phone',30);if(!/^[+0-9() -]{7,30}$/.test(phone)||phone.replace(/\D/g,'').length<7)throw new PaymentError('Enter a valid contact phone number.',400);
 const address=rate.pickup?{}:{line1:text('line1',200),line2:text('line2',200,false),city:text('city',100),region:text('region',100),country:text('country',2).toUpperCase(),postalCode:text('postalCode',30,false)};
 if(!rate.pickup&&(address.country!==rate.country||(rate.region&&address.region?.toLowerCase()!==rate.region.toLowerCase())))throw new PaymentError('Choose a shipping option matching your country and region.',400);
 if(!rate.pickup&&!rate.region&&address.region){const specific=await c.query("SELECT id FROM shop_shipping_regions WHERE active=TRUE AND pickup=FALSE AND country=$1 AND LOWER(region)=LOWER($2) AND region<>'' LIMIT 1",[rate.country,address.region]);if(specific.rows.length)throw new PaymentError('Choose the shipping rule specifically configured for your state or region.',400);}
 return {fee:Number(rate.fee_kobo),details:{name,phone,...address,shippingRateId:rate.id,shippingLabel:rate.label,pickup:rate.pickup,country:rate.country}};
}
// JSONB does not preserve object-key order; compare snapshotted delivery fields by key.
export function shippingDetailsMatch(a:unknown,b:unknown){
 if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)||Array.isArray(b))return false;
 const left=a as Record<string,unknown>,right=b as Record<string,unknown>,keys=Object.keys(left);
 return keys.length===Object.keys(right).length&&keys.every(key=>Object.hasOwn(right,key)&&left[key]===right[key]);
}
