import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export const runtime = 'nodejs';

const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'ijabikenm@gmail.com';
const STUDIO_TIMEZONE = 'Africa/Lagos';

type ReminderKind = '24h' | 'day';

type BookingReminder = {
  id: number;
  name: string;
  email: string;
  phone: string;
  service: string;
  booking_date: string;
  booking_time: string;
  scheduled_at: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getTransportConfig() {
  const user = process.env.SMTP_USER || process.env.EMAIL_SERVER_USER || process.env.EMAIL_USER || process.env.MAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_SERVER_PASSWORD || process.env.EMAIL_PASS || process.env.MAIL_PASS || process.env.SMTP_PASSWORD;
  const host = process.env.SMTP_HOST || process.env.EMAIL_SERVER_HOST || process.env.EMAIL_HOST || process.env.MAIL_HOST;
  const port = Number(process.env.SMTP_PORT || process.env.EMAIL_SERVER_PORT || process.env.EMAIL_PORT || process.env.MAIL_PORT || 587);
  const secureValue = process.env.SMTP_SECURE || process.env.EMAIL_SECURE || process.env.MAIL_SECURE;
  const secure = secureValue ? secureValue.toLowerCase() === 'true' : port === 465;
  const from = process.env.SMTP_FROM || process.env.MAIL_FROM || process.env.EMAIL_FROM || user;
  if (!user || !pass || !from) return null;
  return { user, pass, host, port, secure, from };
}

function formatWhen(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: STUDIO_TIMEZONE,
  }).format(new Date(value));
}

async function sendReminder(booking: BookingReminder, kind: ReminderKind) {
  const config = getTransportConfig();
  if (!config) throw new Error('Email transport is not configured.');

  const transporter = nodemailer.createTransport(
    config.host
      ? {
          host: config.host,
          port: config.port,
          secure: config.secure,
          auth: { user: config.user, pass: config.pass },
        }
      : {
          service: 'gmail',
          auth: { user: config.user, pass: config.pass },
        }
  );

  const when = formatWhen(booking.scheduled_at);
  const intro = kind === '24h' ? 'Your session is tomorrow' : 'Your session is today';
  const subject = `${intro} - ${when}`;

  await transporter.sendMail({
    from: config.from,
    to: booking.email,
    replyTo: CONTACT_EMAIL,
    subject,
    html: `
      <h2>${escapeHtml(intro)}</h2>
      <p>Hi ${escapeHtml(booking.name)},</p>
      <p>This is a reminder for your ${escapeHtml(booking.service)} booking on <strong>${escapeHtml(when)}</strong> (${STUDIO_TIMEZONE}).</p>
      <p>Reply to this email if anything about the session needs to change.</p>
    `,
    text: `Hi ${booking.name}, this is a reminder for your ${booking.service} booking on ${when} (${STUDIO_TIMEZONE}). Reply to this email if anything needs to change.`,
  });

  await transporter.sendMail({
    from: config.from,
    to: CONTACT_EMAIL,
    replyTo: booking.email,
    subject: `Studio reminder: ${booking.name} - ${when}`,
    html: `
      <h2>${escapeHtml(intro)}</h2>
      <p><strong>Client:</strong> ${escapeHtml(booking.name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(booking.email)}</p>
      <p><strong>Phone:</strong> ${escapeHtml(booking.phone || 'Not provided')}</p>
      <p><strong>Service:</strong> ${escapeHtml(booking.service)}</p>
      <p><strong>Time:</strong> ${escapeHtml(when)} (${STUDIO_TIMEZONE})</p>
    `,
    text: `Studio reminder\nClient: ${booking.name}\nEmail: ${booking.email}\nPhone: ${booking.phone || 'Not provided'}\nService: ${booking.service}\nTime: ${when}`,
  });
}

function authorize(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get('authorization') === `Bearer ${cronSecret}`) return null;
  return requireAdmin(req);
}

export async function GET(req: NextRequest) {
  const unauthorized = authorize(req);
  if (unauthorized) return unauthorized;

  const { rows: tomorrowRows } = await query(
    `SELECT id, name, email, phone, service, booking_date::text, booking_time, scheduled_at::text
     FROM bookings
     WHERE status IN ('pending', 'confirmed')
       AND reminder_24h_sent_at IS NULL
       AND (scheduled_at AT TIME ZONE 'Africa/Lagos')::date = (NOW() AT TIME ZONE 'Africa/Lagos')::date + 1`
  );

  const { rows: todayRows } = await query(
    `SELECT id, name, email, phone, service, booking_date::text, booking_time, scheduled_at::text
     FROM bookings
     WHERE status IN ('pending', 'confirmed')
       AND reminder_day_sent_at IS NULL
       AND scheduled_at > NOW()
       AND (scheduled_at AT TIME ZONE 'Africa/Lagos')::date = (NOW() AT TIME ZONE 'Africa/Lagos')::date`
  );

  let sent24h = 0;
  let sentDay = 0;

  for (const booking of tomorrowRows as BookingReminder[]) {
    await sendReminder(booking, '24h');
    await query('UPDATE bookings SET reminder_24h_sent_at = NOW(), updated_at = NOW() WHERE id = $1', [booking.id]);
    sent24h += 1;
  }

  for (const booking of todayRows as BookingReminder[]) {
    await sendReminder(booking, 'day');
    await query('UPDATE bookings SET reminder_day_sent_at = NOW(), updated_at = NOW() WHERE id = $1', [booking.id]);
    sentDay += 1;
  }

  return NextResponse.json({ ok: true, sent24h, sentDay });
}
