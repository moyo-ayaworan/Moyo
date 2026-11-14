import { readJsonRequest } from '@/lib/requestBody';
import { requestNewsletterConfirmation, newsletterLists } from '@/lib/newsletter/server';
import { isPaymentEmail } from '@/lib/payments/policy';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rateLimit';

const validLists = newsletterLists;

function normalizeEmail(email: unknown) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function isValidEmail(email: string) {
  return isPaymentEmail(email);
}

export async function POST(req: NextRequest) {
  try {
    const limited = await rateLimit(req, 'newsletter-subscribe', 10, 3600);
    if (limited) return limited;
    const jsonRequest = await readJsonRequest(req, 2000);
    if (jsonRequest.response) return jsonRequest.response;
    const body = jsonRequest.body;
    const email = normalizeEmail(body.email);
    const listType = typeof body.listType === 'string' ? body.listType : body.profileType;

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
    }

    if (!validLists.has(listType)) {
      return NextResponse.json({ error: 'Invalid newsletter list.' }, { status: 400 });
    }

    await requestNewsletterConfirmation(email, listType);
    return NextResponse.json({ message: 'Check your inbox for a confirmation link. If this address is already subscribed or recently requested a link, no further email is sent.' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    console.error('[newsletter.subscribe] Confirmation delivery unavailable.');
    return NextResponse.json({ error: 'Unable to subscribe right now.' }, { status: 500 });
  }
}
