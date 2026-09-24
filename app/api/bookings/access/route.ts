import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

const GENERIC_MESSAGE = 'If those details match a booking, the private tracking link has been sent to that email address.';

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function transportConfig() {
  const user = process.env.SMTP_USER || process.env.EMAIL_SERVER_USER || process.env.EMAIL_USER || process.env.MAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_SERVER_PASSWORD || process.env.EMAIL_PASS || process.env.MAIL_PASS || process.env.SMTP_PASSWORD;
  const host = process.env.SMTP_HOST || process.env.EMAIL_SERVER_HOST || process.env.EMAIL_HOST || process.env.MAIL_HOST;
  const port = Number(process.env.SMTP_PORT || process.env.EMAIL_SERVER_PORT || process.env.EMAIL_PORT || process.env.MAIL_PORT || 587);
  const secureValue = process.env.SMTP_SECURE || process.env.EMAIL_SECURE || process.env.MAIL_SECURE;
  const from = process.env.SMTP_FROM || process.env.MAIL_FROM || process.env.EMAIL_FROM || user;
  if (!user || !pass || !from) return null;
  return { user, pass, host, port, secure: secureValue ? secureValue.toLowerCase() === 'true' : port === 465, from };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const reference = clean(body?.reference).replace(/^#/, '');
  const email = clean(body?.email).toLowerCase();

  if (!/^\d{1,12}$/.test(reference) || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Enter a valid booking reference and email address.' }, { status: 400 });
  }

  try {
    const { rows } = await query(
      `SELECT id, name, email, manage_token
       FROM bookings
       WHERE id = $1 AND LOWER(email) = $2
       LIMIT 1`,
      [Number(reference), email]
    );
    const booking = rows[0] as { id: number; name: string; email: string; manage_token: string } | undefined;
    const config = transportConfig();

    if (booking && config) {
      const transporter = nodemailer.createTransport(config.host
        ? { host: config.host, port: config.port, secure: config.secure, auth: { user: config.user, pass: config.pass } }
        : { service: 'gmail', auth: { user: config.user, pass: config.pass } });
      const portalUrl = `${req.nextUrl.origin}/client/booking/${booking.manage_token}`;
      await transporter.sendMail({
        from: config.from,
        to: booking.email,
        subject: `Your booking tracking link - #${booking.id}`,
        text: `Hi ${booking.name}, use this private link to track booking #${booking.id}: ${portalUrl}\n\nDo not share this link.`,
        html: `<p>Hi ${booking.name.replace(/[<>&"']/g, '')},</p><p>Use this private link to track booking <strong>#${booking.id}</strong>:</p><p><a href="${portalUrl}">Open booking status</a></p><p>Do not share this link.</p>`,
      });
    }
  } catch (error) {
    // The response stays deliberately generic so this endpoint cannot be used
    // to discover whether a client or booking exists.
    console.error('[bookings/access] Unable to send tracking link:', error);
  }

  return NextResponse.json({ message: GENERIC_MESSAGE }, { headers: { 'Cache-Control': 'private, no-store' } });
}
