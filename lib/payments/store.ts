import { reserveStock, commitStock, stockQuantity } from '../inventory.ts';
import { shippingQuote, physicalSubtotal } from '../shipping.ts';
import { applyCoupon, couponCanFulfill } from '../coupons.ts';
import { normalizeCouponCode } from '../checkoutInput.ts';
import { pricingSnapshot } from '../pricingSnapshot.ts';
import { exchangeRates } from '../exchangeRates.ts';
import { regionalMultiplier, isRoundedCurrency, type DisplayCurrency } from '../regionalPricing.ts';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { PaymentError, isPaymentEmail, paymentMatches, priceToKobo, type PaymentMode, type PaymentOrder } from './policy.ts';
import { paymentSummary, roundMoney, type PaymentFields, type DocumentPayment, type BillingDetails } from '../documentPayments.ts';

export type Transaction = <T>(work: (client: PoolClient) => Promise<T>) => Promise<T>;
type Invoice = PaymentFields & { id: number; gallery_id: number; document_type: string; currency: string; client_email: string; title: string; billing_details: BillingDetails | null; payments: DocumentPayment[] };
export class PaymentStore {
  transact: Transaction;
  constructor(transact: Transaction) { this.transact = transact; }
  async order(reference: string) { return this.transact(async c => (await c.query<PaymentOrder>('SELECT * FROM payment_orders WHERE reference=$1', [reference])).rows[0] || null); }
  async createDigital(productId: number, email: string, mode: PaymentMode, requestKey: string, section: 'photography' | 'art' = 'photography', country = '', displayCurrency: DisplayCurrency = 'NGN', expectedAmount?: number, couponCode = '', physical?:{quantity?:number;shippingRateId?:unknown;shippingDetails?:unknown}) {
    return this.transact(async c => {
      couponCode=normalizeCouponCode(couponCode);
      // Serialize retries of one browser action, including after a lost HTTP response.
      await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['payment:' + requestKey]);
      const existing = (await c.query<PaymentOrder>('SELECT * FROM payment_orders WHERE request_key=$1', [requestKey])).rows[0];
      if (existing) {
        if(existing.fulfillment_kind!=='physical'&&physical)throw new PaymentError('Digital checkout does not accept quantity or shipping fields.',400);
        if (existing.kind !== 'digital' || existing.target_id !== productId || existing.email !== email || existing.mode !== mode || existing.shop_section !== section || (existing.coupon_code || '') !== couponCode) throw new PaymentError('Checkout request belongs to different purchase details.');
        if (!['pending', 'failed', 'paid'].includes(existing.status)) throw new PaymentError('This payment needs studio review.');
        if((existing.fulfillment_kind==='physical')&&(!physical||existing.quantity!==physical.quantity||JSON.stringify(existing.shipping_details)!==JSON.stringify((await shippingQuote(c,physical.shippingRateId,physical.shippingDetails)).details)))throw new PaymentError('Checkout request belongs to different delivery details.',409);
        if(existing.fulfillment_kind==='physical'){const held=(await c.query('SELECT state,expires_at FROM shop_stock_reservations WHERE id=$1',[existing.stock_reservation_id])).rows[0];if(existing.status!=='paid'&&(!held||held.state!=='held'||new Date(held.expires_at).getTime()<=Date.now()))throw new PaymentError('The stock reservation expired. Check the original payment before starting again.',409,'checkout_expired',existing.reference);}
        if(existing.coupon_id&&existing.status!=='paid'&&(!existing.coupon_reserved_until||new Date(existing.coupon_reserved_until).getTime()<=Date.now()))throw new PaymentError('The coupon reservation expired. Check the original payment before starting again.',409,'checkout_expired',existing.reference);
        return { ...existing, retry: true };
      }
      const product = (await c.query('SELECT id,title,price,product_url,section,product_kind FROM digital_products WHERE id=$1 AND section=$2 AND is_active=TRUE FOR SHARE', [productId, section])).rows[0];
      const isPhysical=product?.product_kind==='physical';
      if(!isPhysical&&physical)throw new PaymentError('Digital checkout does not accept quantity or shipping fields.',400);
      const quantity=isPhysical?stockQuantity(physical?.quantity):1;
      const shipping=isPhysical?await shippingQuote(c,physical?.shippingRateId,physical?.shippingDetails):null;
      if (!product||(!isPhysical&&!product.product_url)) throw new PaymentError('This product is not available for checkout.', 404);
      if (isRoundedCurrency(displayCurrency) && !Number.isSafeInteger(expectedAmount)) throw new PaymentError('Refresh this page to get a valid price quote.', 400);
      let rates: Partial<Record<DisplayCurrency, number>> = { NGN: 1 }, asOf: number | null = null;
      if (displayCurrency !== 'NGN') {
        try { const current = await exchangeRates(); rates = current.rates; asOf = current.asOf; }
        catch { if (isRoundedCurrency(displayCurrency)) throw new PaymentError('Currency pricing is temporarily unavailable. Refresh before checkout.', 503); }
      }
      let pricing;
      try { pricing = pricingSnapshot(priceToKobo(product.price), country, displayCurrency, rates, asOf); }
      catch { throw new PaymentError('Currency pricing is temporarily unavailable. Refresh before checkout.', 503); }
      const subtotal=physicalSubtotal(pricing.amountMinor,quantity);
      const applied=couponCode?await applyCoupon(c,{code:couponCode,productId,section,email,amount:subtotal,mode}):null;
      const amount = (applied?.amount ?? subtotal)+(shipping?.fee||0);
      if(!Number.isSafeInteger(amount))throw new PaymentError('Purchase total is too large.',400);
      if (typeof expectedAmount === 'number' && amount !== expectedAmount) throw new PaymentError('The price quote changed. Refresh this page before paying.', 409);
      const order = (await c.query<PaymentOrder>(`INSERT INTO payment_orders(reference,mode,kind,target_id,email,amount_kobo,currency,title,delivery_url,metadata,request_key,shop_section,pricing)
        VALUES($1,$2,'digital',$3,$4,$5,'NGN',$6,$7,$8::jsonb,$9,$10,$11::jsonb) RETURNING *`,
      [`moyo-${productId}-${randomUUID()}`, mode, productId, email, amount, product.title, product.product_url, JSON.stringify({ product_id: productId, payment_kind: 'digital', product_section: section, pricing_multiplier: regionalMultiplier(country), display_currency: displayCurrency, ...(isPhysical?{product_kind:'physical',quantity}:{}), ...(applied?{coupon_code:applied.coupon.code,discount_kobo:applied.discount,subtotal_kobo:subtotal}:{}), usd_price: displayCurrency === 'USD' ? pricing.sellingAmount : null }), requestKey, section, JSON.stringify(pricing)])).rows[0];
      if(isPhysical){const reservation=await reserveStock(c,productId,quantity);await c.query(`UPDATE payment_orders SET fulfillment_kind='physical',quantity=$2,stock_reservation_id=$3,shipping_kobo=$4,shipping_details=$5::jsonb,subtotal_kobo=$6 WHERE reference=$1`,[order.reference,quantity,reservation.id,shipping!.fee,JSON.stringify(shipping!.details),subtotal]);}
      if(applied){
        const saved=(await c.query<PaymentOrder>(`UPDATE payment_orders SET coupon_id=$2,coupon_code=$3,discount_kobo=$4,subtotal_kobo=$5,coupon_reserved_until=NOW()+INTERVAL '30 minutes' WHERE reference=$1 RETURNING *`,[order.reference,applied.coupon.id,applied.coupon.code,applied.discount,subtotal])).rows[0];
        return saved;
      }
      return isPhysical?(await c.query<PaymentOrder>('SELECT * FROM payment_orders WHERE reference=$1',[order.reference])).rows[0]:order;
    });
  }
  async invoiceForToken(c: PoolClient, id: number, token: string, lock = false) {
    const row = (await c.query<Invoice>(`SELECT d.* FROM gallery_documents d WHERE d.id=$1 AND d.document_type='invoice' AND (
      EXISTS(SELECT 1 FROM bookings b WHERE b.gallery_id=d.gallery_id AND b.manage_token=$2 AND b.portal_expires_at>NOW() AND b.portal_revoked_at IS NULL AND b.status <> 'cancelled') OR
      EXISTS(SELECT 1 FROM art_inquiries a WHERE a.gallery_id=d.gallery_id AND a.manage_token=$2 AND a.portal_expires_at>NOW() AND a.portal_revoked_at IS NULL AND a.status <> 'closed')) ${lock ? 'FOR UPDATE OF d' : ''}`, [id, token])).rows[0];
    if (!row) throw new PaymentError('Invoice not found for this client link.', 404);
    return row;
  }
  async createInvoice(id: number, token: string | { galleryId: number }, purpose: 'deposit' | 'balance', mode: PaymentMode) {
    return this.transact(async c => {
      const doc = typeof token === 'string' ? await this.invoiceForToken(c, id, token, true) : (await c.query<Invoice>("SELECT * FROM gallery_documents WHERE id=$1 AND gallery_id=$2 AND document_type='invoice' FOR UPDATE", [id, token.galleryId])).rows[0];
      if (!doc) throw new PaymentError('Invoice not found for this gallery.', 404);
      if (!isPaymentEmail(doc.client_email)) throw new PaymentError('This invoice needs a valid client email. Contact the studio.', 400);
      if (doc.currency !== 'NGN') throw new PaymentError('Online payment requires an invoice in NGN. Contact the studio.', 400);
      const summary = paymentSummary(doc);
      if (summary.balance <= 0) throw new PaymentError('This invoice is already paid.');
      const blocked = (await c.query("SELECT reference FROM payment_orders WHERE document_id=$1 AND status IN ('review','refunded','disputed') LIMIT 1", [id])).rows[0];
      if (blocked) throw new PaymentError('This invoice needs studio review before another payment.');
      const pending = (await c.query<PaymentOrder>("SELECT * FROM payment_orders WHERE document_id=$1 AND mode=$2 AND status='pending' LIMIT 1", [id, mode])).rows[0];
      if (pending) {
        if (!pending.checkout_url) throw new PaymentError('Checkout is being prepared. Please try again shortly.');
        return pending; // Resume the same provider session; never create two payable balance sessions.
      }
      const amount = purpose === 'deposit' ? roundMoney(summary.deposit - summary.paid) : summary.balance;
      if (amount <= 0 || amount > summary.balance) throw new PaymentError('The deposit is already paid. Choose the remaining balance.', 400);
      return (await c.query<PaymentOrder>(`INSERT INTO payment_orders(reference,mode,kind,target_id,document_id,email,amount_kobo,currency,title,metadata)
        VALUES($1,$2,'invoice',$3,$3,$4,$5,'NGN',$6,$7::jsonb) RETURNING *`,
      [`inv-${id}-${randomUUID()}`, mode, id, doc.client_email.toLowerCase(), priceToKobo(String(amount)), doc.title, JSON.stringify({ invoice_id: id, payment_kind: 'invoice' })])).rows[0];
    });
  }
  async saveCheckout(reference: string, url: string) {
    return this.transact(c => c.query("UPDATE payment_orders SET checkout_url=$2,updated_at=NOW() WHERE reference=$1 AND status='pending'", [reference, url]));
  }
  async fail(reference: string) { await this.transact(c => c.query("UPDATE payment_orders SET status='failed',updated_at=NOW() WHERE reference=$1 AND status='pending'", [reference])); }
  async fulfill(reference: string, payment: unknown) {
    return this.transact(async c => {
      const order = (await c.query<PaymentOrder>('SELECT * FROM payment_orders WHERE reference=$1 FOR UPDATE', [reference])).rows[0];
      if (!order) throw new PaymentError('Payment reference not found.', 404);
      if (!paymentMatches(payment, order)) throw new PaymentError('Payment has not been verified for this purchase.');
      if (['refunded', 'disputed', 'review'].includes(order.status)) throw new PaymentError('This payment needs studio review.');
      if (order.status === 'paid') return order;
      const p = payment as { id: number | string; paid_at?: unknown };
      const paidAt = typeof p.paid_at === 'string' && Number.isFinite(Date.parse(p.paid_at)) ? new Date(p.paid_at) : new Date();
      let status = await couponCanFulfill(c,order) ? 'paid' : 'review';
      if(order.fulfillment_kind==='physical'&&status==='paid'){try{await commitStock(c,order.stock_reservation_id!);}catch(e){if(e instanceof PaymentError)status='review';else throw e;}}
      if (order.kind === 'invoice') {
        const doc = (await c.query<Invoice>('SELECT * FROM gallery_documents WHERE id=$1 FOR UPDATE', [order.document_id])).rows[0];
        const amount = Number(order.amount_kobo) / 100;
        const summary = paymentSummary(doc);
        if (doc.currency !== order.currency || amount > summary.balance) status = 'review';
        else {
          const totalPaid = roundMoney(summary.paid + amount), balance = roundMoney(summary.total - totalPaid);
          const entry: DocumentPayment = { id: order.reference, amount, receivedAt: paidAt.toISOString().slice(0, 10), reference: order.reference,
            recordedAt: new Date().toISOString(), totalPaid, balance, bookingConfirmed: Boolean(doc.billing_details?.sessionDate && totalPaid >= (summary.deposit || summary.total)) };
          await c.query(`UPDATE gallery_documents SET payments=payments || $2::jsonb,paid_at=CASE WHEN $3::numeric=0 THEN NOW() ELSE NULL END,updated_at=NOW() WHERE id=$1`, [doc.id, JSON.stringify([entry]), balance]);
          if (entry.bookingConfirmed) await c.query("UPDATE bookings SET status='confirmed' WHERE gallery_id=$1 AND status='pending'", [doc.gallery_id]);
          if (totalPaid >= (summary.deposit || summary.total)) await c.query("UPDATE art_inquiries SET status='deposit-paid' WHERE gallery_id=$1 AND status IN ('received','consultation','quoted','reserved')", [doc.gallery_id]);
          // Downloads unlock only at full settlement, never at the deposit threshold.
          if (balance === 0) await c.query(`UPDATE galleries SET payment_verified=TRUE WHERE id=$1 AND NOT EXISTS (SELECT 1 FROM gallery_documents d WHERE d.gallery_id=$1 AND d.document_type='invoice' AND d.paid_at IS NULL AND d.amount>0) AND NOT EXISTS (SELECT 1 FROM payment_orders o JOIN gallery_documents d ON d.id=o.document_id WHERE d.gallery_id=$1 AND o.status IN ('review','refunded','disputed'))`, [doc.gallery_id]);
        }
      }
      const saved = (await c.query<PaymentOrder>('UPDATE payment_orders SET status=$2,provider_id=$3,paid_at=$4,updated_at=NOW() WHERE reference=$1 RETURNING *', [reference, status, String(p.id), paidAt])).rows[0];
      await c.query("INSERT INTO payment_events(event_key,reference,event_type,amount_kobo) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING", ['paid:' + reference, reference, status, order.amount_kobo]);
      await c.query('INSERT INTO payment_notifications(reference) VALUES($1) ON CONFLICT DO NOTHING', [reference]);
      return saved;
    });
  }
  async review(reference: string, reason: string) {
    return this.transact(async c => {
      const order = (await c.query<PaymentOrder>('SELECT * FROM payment_orders WHERE reference=$1 FOR UPDATE', [reference])).rows[0];
      if (!order || ['refunded','disputed','review'].includes(order.status)) return order;
      const saved = (await c.query<PaymentOrder>("UPDATE payment_orders SET status='review',updated_at=NOW() WHERE reference=$1 RETURNING *", [reference])).rows[0];
      await c.query('INSERT INTO payment_events(event_key,reference,event_type) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', ['review:' + reference, reference, reason]);
      if (order.document_id) await c.query('UPDATE galleries SET payment_verified=FALSE WHERE id=(SELECT gallery_id FROM gallery_documents WHERE id=$1)', [order.document_id]);
      await c.query('INSERT INTO payment_notifications(reference) VALUES($1) ON CONFLICT(reference) DO UPDATE SET sent_at=NULL,claimed_at=NULL', [reference]);
      return saved;
    });
  }
  async revoke(reference: string, eventType: 'refund.processed' | 'charge.dispute.create', eventId: string, mode: PaymentMode, currency: string, refundMinor?: number) {
    return this.transact(async c => {
      const order = (await c.query<PaymentOrder>('SELECT * FROM payment_orders WHERE reference=$1 FOR UPDATE', [reference])).rows[0];
      if (!order || mode !== order.mode || currency !== order.currency) return;
      const eventKey = `${eventType}:${reference}:${eventId}`;
      const inserted = await c.query('INSERT INTO payment_events(event_key,reference,event_type,amount_kobo) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING event_key', [eventKey, reference, eventType, refundMinor || null]);
      if (!inserted.rowCount) return;
      // Any refund or dispute blocks delivery; a later success notification cannot restore it.
      const status = eventType === 'refund.processed' ? 'refunded' : 'disputed';
      await c.query('UPDATE payment_orders SET status=$2,updated_at=NOW() WHERE reference=$1', [reference, status]);
      if (order.kind === 'invoice') {
        const doc = (await c.query<Invoice>('SELECT * FROM gallery_documents WHERE id=$1 FOR UPDATE', [order.document_id])).rows[0];
        await c.query('UPDATE galleries SET payment_verified=FALSE WHERE id=$1', [doc.gallery_id]);
        if (eventType === 'refund.processed' && Number.isSafeInteger(refundMinor) && refundMinor! > 0) {
          const refunded = (await c.query<{ total: string }>("SELECT COALESCE(SUM(amount_kobo),0) AS total FROM payment_events WHERE reference=$1 AND event_type='refund.processed'", [reference])).rows[0];
          const credited = doc.payments.some(entry => entry.reference === reference && entry.amount > 0);
          if (credited && Number(refunded.total) <= Number(order.amount_kobo)) {
            const amount = -refundMinor! / 100, summary = paymentSummary(doc);
            const totalPaid = roundMoney(summary.paid + amount), balance = roundMoney(summary.total - totalPaid);
            const entry: DocumentPayment = { id: eventKey, amount, receivedAt: new Date().toISOString().slice(0, 10), reference: `Refund: ${reference}`, recordedAt: new Date().toISOString(), totalPaid, balance, bookingConfirmed: false, kind: 'refund' };
            await c.query('UPDATE gallery_documents SET payments=payments || $2::jsonb,paid_at=NULL,updated_at=NOW() WHERE id=$1', [doc.id, JSON.stringify([entry])]);
          }
        }
      }
      await c.query('INSERT INTO payment_notifications(reference) VALUES($1) ON CONFLICT(reference) DO UPDATE SET sent_at=NULL,claimed_at=NULL', [reference]);
    });
  }
}
