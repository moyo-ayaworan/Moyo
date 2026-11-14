import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { paystackRequest, paystackSecret, paymentOrigin } from '@/lib/paystack';
import { billingService } from '@/lib/stillbounds/billing-service';
import { paymentMode } from '@/lib/payments/policy';
import { requirePaymentOrigin, paymentFailure, privateHeaders } from '@/lib/payments/server';
export const runtime = 'nodejs';
const events = ['charge.success', 'refund.processed', 'charge.dispute.create'];
async function state() {
  const environment = paymentMode(paystackSecret());
  const url = `${paymentOrigin()}/api/paystack/webhook`;
  const data = await paystackRequest('/integration/webhooks/endpoints');
  const endpoints = Array.isArray(data) ? data : [];
  const endpoint = endpoints.find((item: { webhook_url?: string }) => item.webhook_url === url);
  return { environment, url, endpoint };
}
export async function GET(req: NextRequest) {
  const unauthorized = requireAdmin(req); if (unauthorized) return unauthorized;
  try {
    const result = await state();
    return NextResponse.json({ environment: result.environment, webhookUrl: result.url, webhookEnabled: !!result.endpoint?.enabled,
      signingSecretConfigured: !!process.env.PAYSTACK_WEBHOOK_SECRET, stillbounds: billingService().offer() }, { headers: privateHeaders });
  } catch (error) { return paymentFailure(error); }
}
export async function POST(req: NextRequest) {
  const unauthorized = requireAdmin(req); if (unauthorized) return unauthorized;
  try {
    requirePaymentOrigin(req);
    const result = await state();
    if (!process.env.PAYSTACK_WEBHOOK_SECRET) return NextResponse.json({ error: 'Save PAYSTACK_WEBHOOK_SECRET in Production and redeploy before configuring the endpoint.' }, { status: 503, headers: privateHeaders });
    let endpoint = result.endpoint;
    if (!endpoint) endpoint = await paystackRequest('/integration/webhooks/endpoints', { name: 'Moyo payment verification', url: result.url, events });
    else {
      const response = await fetch(`https://api.paystack.co/integration/webhooks/endpoints/${encodeURIComponent(endpoint.webhook_url_code)}`, { method: 'PATCH', headers: { Authorization: `Bearer ${paystackSecret()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: true, events }), redirect: 'error', signal: AbortSignal.timeout(15000), cache: 'no-store' });
      if (!response.ok) return NextResponse.json({ error: 'Could not configure webhook events. Check Paystack dashboard.' }, { status: 502, headers: privateHeaders });
    }
    const ping = await paystackRequest(`/integration/webhooks/endpoints/${encodeURIComponent(endpoint.webhook_url_code)}/ping`, {});
    return NextResponse.json({ webhookUrl: result.url, signedPingAccepted: ping.ok === true, httpStatus: ping.http_status }, { headers: privateHeaders });
  } catch (error) { return paymentFailure(error); }
}
