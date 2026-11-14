import { after, NextRequest, NextResponse } from 'next/server';
import { paystackSecret, verifyPaystackTransaction } from '@/lib/paystack';
import { validSignedWebhook, validWebhook } from '@/lib/stillbounds/billing-policy';
import { billingService } from '@/lib/stillbounds/billing-service';
import { payments, boundedText, paymentFailure, privateHeaders } from '@/lib/payments/server';
import { PaymentError, validReference } from '@/lib/payments/policy';
import { deliverPaymentNotifications } from '@/lib/payments/notifications';
export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
  try {
    const raw = await boundedText(req), secret = paystackSecret();
    const signingSecret = process.env.PAYSTACK_WEBHOOK_SECRET || '';
    const modern = req.headers.get('paystack-signature') || '', legacy = req.headers.get('x-paystack-signature') || '';
    const valid = modern ? validSignedWebhook(raw, modern, [signingSecret]) : !signingSecret && validWebhook(raw, legacy, secret);
    if (!valid) throw new PaymentError('Invalid payment signature.', 401);
    let event;
    try { event = JSON.parse(raw); if (!event || typeof event.event !== 'string' || !event.data || typeof event.data !== 'object' || Array.isArray(event.data)) throw Error(); }
    catch { throw new PaymentError('Invalid payment event.', 400); }
    const data = event.data;
    const reference = String(event.event === 'charge.success' ? data.reference || '' : data.transaction_reference || data.transaction?.reference || '');
    if (/^sb-(live|test)-/.test(reference)) {
      await billingService().webhook(raw, legacy, modern);
    } else if (validReference(reference)) {
      const order = await payments.order(reference);
      if (order && event.event === 'charge.success') {
        // Do not acknowledge transient provider/database failure: Paystack must retry.
        const payment = await verifyPaystackTransaction(reference);
        // A late success cannot revive a refund or dispute.
        if (!['refunded','disputed','review'].includes(order.status)) await payments.fulfill(reference, payment);
      } else if (order && ['refund.processed','charge.dispute.create'].includes(event.event)) {
        const mode = data.domain || data.transaction?.domain;
        const currency = data.currency || data.transaction?.currency;
        if (!['live','test'].includes(mode) || currency !== order.currency) throw new PaymentError('Payment event environment or currency mismatch.', 400);
        const eventId = String(data.refund_reference || data.id || 'unidentified');
        const rawAmount = data.amount;
        const amount = typeof rawAmount === 'number' ? rawAmount : typeof rawAmount === 'string' && /^\d+$/.test(rawAmount) ? Number(rawAmount) : undefined;
        await payments.revoke(reference, event.event, eventId, mode, currency, eventId === 'unidentified' ? undefined : amount);
      }
    }
    after(() => deliverPaymentNotifications());
    return NextResponse.json({ received: true }, { headers: privateHeaders });
  } catch (error) { return paymentFailure(error); }
}
