import { query } from './db';
export async function shippingRates(){return (await query(`SELECT id,label,country,region,fee_kobo,pickup FROM shop_shipping_regions WHERE active=TRUE ORDER BY country,region,label`)).rows;}
