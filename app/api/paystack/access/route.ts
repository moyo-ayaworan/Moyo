import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rateLimit';
import { purchaseSigningKey, setPurchaseCookie } from '@/lib/purchaseAccess';
import { PaymentError, validAccessProof, validReference } from '@/lib/payments/policy';
import { payments, requestBody, requirePaymentOrigin, paymentFailure, privateHeaders } from '@/lib/payments/server';
export async function POST(req: NextRequest) {
  try {
    requirePaymentOrigin(req);
    const limited = await rateLimit(req, 'purchase-recovery-access', 10, 900); if (limited) return limited;
    const body = await requestBody(req), reference = String(body.reference || ''), token = String(body.token || '');
    if (!validReference(reference)) throw new PaymentError('Invalid recovery link.', 403);
    const order = await payments.order(reference);
    if (!order || order.kind !== 'digital' || order.status !== 'paid' || !validAccessProof(reference, order.email, token, purchaseSigningKey())) throw new PaymentError('Recovery link has expired or is unavailable. Request another email.', 403);
    const response = NextResponse.json({ success: true }, { headers: privateHeaders });
    setPurchaseCookie(response, reference); return response;
  } catch (error) { return paymentFailure(error); }
}
