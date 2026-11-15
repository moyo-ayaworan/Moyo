import { readJsonRequest } from '@/lib/requestBody';
import { after, NextRequest, NextResponse } from 'next/server';
import { rateLimit, rateLimitIdentity } from '@/lib/rateLimit';
import { enqueueBookingRecovery, deliverBookingRecovery } from '@/lib/bookingRecovery';

export const runtime = 'nodejs';
export const maxDuration = 60;

const GENERIC_MESSAGE = 'If those details match a booking, a private tracking link will be sent to that email address. Check your inbox and spam folder.';

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(req: NextRequest) {
  if (req.headers.get('sec-fetch-site') === 'cross-site') return NextResponse.json({ error: 'Open recovery from the studio website.' }, { status: 403 });
  const limited = await rateLimit(req, 'booking-recovery', 5, 3600);
  if (limited) return limited;
  const jsonRequest = await readJsonRequest(req, 2000);
  if (jsonRequest.response) return jsonRequest.response;
  const body = jsonRequest.body as Record<string, unknown> | null;
  const reference = clean(body?.reference).replace(/^#/, '');
  const email = clean(body?.email).toLowerCase();

  if (!/^\d{1,12}$/.test(reference) || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Enter a valid booking reference and email address.' }, { status: 400 });
  }

  try {
    const queueLimited = await rateLimitIdentity('site', 'booking-recovery-enqueue', 500, 86400);
    if (queueLimited) return queueLimited;
    // Persist before acknowledging. Lookup and SMTP stay out of the response path.
    await enqueueBookingRecovery(Number(reference), email);
  } catch {
    return NextResponse.json({ error: 'Recovery is temporarily unavailable. Please try again.' }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } });
  }
  after(() => deliverBookingRecovery());

  return NextResponse.json({ message: GENERIC_MESSAGE }, { headers: { 'Cache-Control': 'private, no-store' } });
}
