import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { requireAdmin } from '@/lib/auth';
import { rateLimit } from '@/lib/rateLimit';
import { applyStudioMailEnvironment } from '@/lib/studioMail';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
const email = 'moyoayaworan@gmail.com';
function settings() { const env = { ...process.env }; return applyStudioMailEnvironment(env) ? env : null; }
export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request); if (denied) return denied;
  return NextResponse.json({ newSenderConfigured: Boolean(settings()), sender: email, replyTo: email }, { headers });
}
export async function POST(request: NextRequest) {
  const denied = await requireAdmin(request, true); if (denied) return denied;
  const env = settings();
  if (!env) return NextResponse.json({ error: 'The new Gmail app password is not configured.' }, { status: 409, headers });
  const limited = await rateLimit(request, 'studio-email-test', 2, 300); if (limited) return limited;
  const mail = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true,
    auth: { user: email, pass: env.EMAIL_PASS }, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000 });
  try {
    await mail.verify();
    const result = await mail.sendMail({ from: { name: 'Moyo Ayaworan', address: email }, to: email, replyTo: email,
      subject: 'Moyo website email setup test',
      text: `This is the test email you requested for the Moyo website and Stillbounds.\n\nThe website is sending this message from ${email}. Replies go to the same address.\n\nSent at ${new Date().toLocaleString('en-GB', { timeZone: 'Africa/Lagos' })} (Africa/Lagos).` });
    if (!result.accepted?.some(address => String(address).toLowerCase() === email) || result.rejected?.length)
      throw Error('SMTP did not accept the fixed recipient.');
    return NextResponse.json({ sent: true, smtpAuthenticationVerified: true, acceptedBySMTP: true,
      sender: email, recipient: email, replyTo: email, messageId: result.messageId }, { headers });
  } catch { return NextResponse.json({ error: 'The Gmail connection or test delivery could not be confirmed.' }, { status: 503, headers }); }
  finally { mail.close(); }
}
