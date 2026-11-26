import { after, NextRequest, NextResponse } from 'next/server';
import { hasPurchaseAccess } from '@/lib/purchaseAccess';
import { rateLimit } from '@/lib/rateLimit';
import { PaymentError, validReference } from '@/lib/payments/policy';
import { payments, verifyOrder, paymentFailure, privateHeaders } from '@/lib/payments/server';
import { deliverPaymentNotifications } from '@/lib/payments/notifications';
export const runtime = 'nodejs';
export async function GET(req: NextRequest) {
  try {
    const limited = await rateLimit(req, 'checkout-verify', 30, 900); if (limited) return limited;
    const reference = req.nextUrl.searchParams.get('reference') || '';
    if (!validReference(reference) || !hasPurchaseAccess(req, reference)) throw new PaymentError('Purchase access expired or belongs to another browser. Request a recovery email below.', 403);
    const order = await payments.order(reference);
    if (!order || order.kind !== 'digital') throw new PaymentError('Order not found.', 404);
    const saved = await verifyOrder(order), paid = saved.status === 'paid';
    after(() => deliverPaymentNotifications());
    return NextResponse.json({ paid, status: saved.status, shopSection: saved.shop_section || 'photography', fulfillmentKind:saved.fulfillment_kind||'digital',fulfillmentStatus:saved.fulfillment_status||'unfulfilled',trackingNumber:saved.tracking_number||'',downloadUrl: paid&&saved.fulfillment_kind!=='physical' ? `/api/digital-products/download?reference=${encodeURIComponent(reference)}` : null }, { headers: privateHeaders });
  } catch (error) { return paymentFailure(error); }
}
