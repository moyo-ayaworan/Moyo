import { NextRequest, NextResponse } from 'next/server';
import { hasPurchaseAccess } from '@/lib/purchaseAccess';
import { temporaryOriginalUrl } from '@/lib/privateMedia';
import { rateLimit } from '@/lib/rateLimit';
import { payments, verifyOrder, paymentFailure, privateHeaders } from '@/lib/payments/server';
import { PaymentError } from '@/lib/payments/policy';
export const runtime = 'nodejs';
export async function GET(req: NextRequest) {
  try {
    const limited = await rateLimit(req, 'product-download', 20, 900); if (limited) return limited;
    const reference = req.nextUrl.searchParams.get('reference') || '';
    if (!hasPurchaseAccess(req, reference)) throw new PaymentError('This download is not available.', 403);
    const order = await payments.order(reference);
    if (!order || order.kind !== 'digital' || order.fulfillment_kind==='physical' || order.status !== 'paid') throw new PaymentError('This download is not available.', 403);
    const verified = await verifyOrder(order, true);
    if (verified.status !== 'paid') throw new PaymentError('This payment needs studio review before download.', 403);
    const protectedUrl = temporaryOriginalUrl(order.delivery_url || '');
    if (!protectedUrl) throw new PaymentError('This delivery file needs private storage.', 503);
    const file = await fetch(protectedUrl, { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(30000) });
    if (!file.ok || !file.body) throw new PaymentError('Unable to prepare download.', 502);
    const extension = new URL(order.delivery_url!).pathname.split('/').pop()?.split('.').pop()?.replace(/[^a-z0-9]/gi, '') || 'zip';
    const filename = `${order.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'moyo-product'}.${extension}`;
    return new NextResponse(file.body, { headers: { ...privateHeaders, 'Content-Type': file.headers.get('content-type') || 'application/octet-stream', 'Content-Disposition': `attachment; filename="${filename}"` } });
  } catch (error) { return paymentFailure(error); }
}
