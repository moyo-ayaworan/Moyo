import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { BOOKING_TIMES, isCalendarDate, parseBookingDate } from '@/lib/bookingDates';
import { bookingDetailsError } from '@/lib/bookingRequest';

export const runtime = 'nodejs';

const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'ijabikenm@gmail.com';
const STUDIO_TIMEZONE = 'Africa/Lagos';
const SLOT_TIMES = new Set(BOOKING_TIMES);

type BookingRow = {
  id: number;
  name: string;
  email: string;
  phone: string;
  service: string;
  message: string;
  booking_date: string;
  booking_time: string;
  scheduled_at: string;
  timezone: string;
  status: string;
  manage_token: string;
  client_notes: string;
  internal_notes: string;
  gallery_id: number | null;
  confirmation_sent_at: string | null;
  reminder_24h_sent_at: string | null;
  reminder_day_sent_at: string | null;
  created_at: string;
  request_hash?: string;
};

function normalize(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createManageToken() {
  return crypto.randomBytes(18).toString('hex');
}

function formatBookingDate(date: string, time: string) {
  const scheduledAt = parseBookingDate(date, time);
  if (!scheduledAt) return `${date} at ${time} WAT`;
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: STUDIO_TIMEZONE,
  }).format(scheduledAt);
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

async function sendBookingEmails(booking: BookingRow, origin: string) {
  const config = getTransportConfig();
  if (!config) {
    console.error('[bookings] Missing email transport configuration');
    return false;
  }

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

  const when = formatBookingDate(booking.booking_date, booking.booking_time);
  const portalUrl = `${origin}/client/booking/${booking.manage_token}`;
  const studioHtml = `
    <h2>New booking request</h2>
    <p><strong>Name:</strong> ${escapeHtml(booking.name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(booking.email)}</p>
    <p><strong>Phone:</strong> ${escapeHtml(booking.phone || 'Not provided')}</p>
    <p><strong>Service:</strong> ${escapeHtml(booking.service)}</p>
    <p><strong>Date:</strong> ${escapeHtml(when)} (${STUDIO_TIMEZONE})</p>
    <p><strong>Client portal:</strong> <a href="${escapeHtml(portalUrl)}">${escapeHtml(portalUrl)}</a></p>
    <p><strong>Message:</strong><br>${escapeHtml(booking.message || 'No message added.').replace(/\n/g, '<br />')}</p>
  `;
  const clientHtml = `
    <h2>Your booking request is in</h2>
    <p>Hi ${escapeHtml(booking.name)},</p>
    <p><strong>Booking reference: #${booking.id}</strong></p>
    <p>Your requested session time is <strong>${escapeHtml(when)}</strong> (${STUDIO_TIMEZONE}).</p>
    <p>The studio has received your details and will confirm the final brief, location, and next steps.</p>
    <p>You can view your booking status here: <a href="${escapeHtml(portalUrl)}">${escapeHtml(portalUrl)}</a></p>
    <p>Service: ${escapeHtml(booking.service)}</p>
  `;

  await transporter.sendMail({
    from: config.from,
    to: CONTACT_EMAIL,
    replyTo: booking.email,
    subject: `New booking request: ${booking.name} - ${when}`,
    html: studioHtml,
    text: `New booking request\nName: ${booking.name}\nEmail: ${booking.email}\nPhone: ${booking.phone || 'Not provided'}\nService: ${booking.service}\nDate: ${when}\nClient portal: ${portalUrl}\nMessage: ${booking.message || 'No message added.'}`,
  });

  const clientDelivery = await transporter.sendMail({
    from: config.from,
    to: booking.email,
    replyTo: CONTACT_EMAIL,
    subject: `Booking #${booking.id} received - ${when}`,
    html: clientHtml,
    text: `Hi ${booking.name}, booking reference #${booking.id}. Your request for ${when} (${STUDIO_TIMEZONE}) has been received. View your booking status here: ${portalUrl}`,
  });

  return !clientDelivery.rejected?.length && Boolean(clientDelivery.accepted?.length);
}

async function sendTrackingEmail(booking: BookingRow, origin: string) {
  const config = getTransportConfig();
  if (!config) throw new Error('Email transport is not configured.');
  const transporter = nodemailer.createTransport(config.host
    ? { host: config.host, port: config.port, secure: config.secure, auth: { user: config.user, pass: config.pass } }
    : { service: 'gmail', auth: { user: config.user, pass: config.pass } });
  const portalUrl = `${origin}/client/booking/${booking.manage_token}`;
  const when = formatBookingDate(booking.booking_date, booking.booking_time);
  const delivery = await transporter.sendMail({
    from: config.from,
    to: booking.email,
    replyTo: CONTACT_EMAIL,
    subject: `Your booking tracking details - #${booking.id}`,
    html: `<h2>Your private booking portal</h2><p>Hi ${escapeHtml(booking.name)},</p><p><strong>Booking reference: #${booking.id}</strong></p><p>Requested session: ${escapeHtml(when)} (${STUDIO_TIMEZONE}).</p><p><a href="${escapeHtml(portalUrl)}">Open and track your booking</a></p><p>Keep this link private. You can also give reference #${booking.id} and your booking email to Ẹnìyàn to have the link sent again.</p>`,
    text: `Hi ${booking.name}, your booking reference is #${booking.id}. Track your booking here: ${portalUrl}\n\nRequested session: ${when} (${STUDIO_TIMEZONE}). Keep this link private.`,
  });
  return !delivery.rejected?.length && Boolean(delivery.accepted?.length);
}

export async function GET(req: NextRequest) {
  const view = req.nextUrl.searchParams.get('view');

  if (view === 'admin') {
    try {
      const unauthorized = requireAdmin(req);
      if (unauthorized) return unauthorized;
      const { rows } = await query(
        `SELECT id, name, email, phone, service, message, booking_date::text, booking_time, scheduled_at::text, timezone, status,
                manage_token, client_notes, internal_notes, gallery_id, confirmation_sent_at::text, reminder_24h_sent_at::text, reminder_day_sent_at::text, created_at::text, updated_at::text
         FROM bookings
         ORDER BY scheduled_at DESC
         LIMIT 100`
      );
      return NextResponse.json({ bookings: rows });
    } catch (error) {
      console.error('[bookings] Failed to load admin bookings:', error);
      return NextResponse.json({ error: 'Failed to load bookings.' }, { status: 500 });
    }
  }

  const start = req.nextUrl.searchParams.get('start') || '';
  const end = req.nextUrl.searchParams.get('end') || '';
  if (!isCalendarDate(start) || !isCalendarDate(end) || start > end) {
    return NextResponse.json({ error: 'Valid start and end dates are required.' }, { status: 400 });
  }

  try {
    const { rows } = await query(
      `SELECT booking_date::text AS booking_date, booking_time
       FROM bookings
       WHERE status <> 'cancelled'
         AND booking_date BETWEEN $1::date AND $2::date
       ORDER BY booking_date, booking_time`,
      [start, end]
    );

    const booked = rows.reduce<Record<string, string[]>>((acc, row: { booking_date: string; booking_time: string }) => {
      acc[row.booking_date] = [...(acc[row.booking_date] || []), row.booking_time];
      return acc;
    }, {});

    return NextResponse.json({ booked, slots: Array.from(SLOT_TIMES) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('[bookings] Failed to load availability:', error);
    return NextResponse.json({ error: 'Could not load availability. Please try again.' }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  let creationKey = '';
  let requestHash = '';
  let fromEniyan = false;
  const savedResponse = (booking: BookingRow, emailSent: boolean, replayed = false) => NextResponse.json({
    booking: fromEniyan ? { id: booking.id, status: booking.status, booking_date: booking.booking_date, booking_time: booking.booking_time } : booking,
    emailSent, replayed, message: 'Booking request received. Final arrangements require studio confirmation.',
  }, { status: replayed ? 200 : 201, headers: { 'Cache-Control': 'private, no-store' } });
  const findPrevious = async () => {
    if (!creationKey) return null;
    const { rows } = await query('SELECT id, status, booking_date::text, booking_time, confirmation_sent_at::text, request_hash FROM bookings WHERE creation_key=$1', [creationKey]);
    const previous = rows[0] as BookingRow | undefined;
    if (!previous) return null;
    if (previous.request_hash !== requestHash) return NextResponse.json({ error: 'This request key belongs to different booking details.', code: 'request_key_conflict' }, { status: 409 });
    return savedResponse(previous, Boolean(previous.confirmation_sent_at), true);
  };
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'A booking object is required.' }, { status: 400 });
    }
    const name = normalize(body.name);
    const email = normalize(body.email).toLowerCase();
    const phone = normalize(body.phone);
    const service = normalize(body.service);
    const message = normalize(body.message);
    const bookingDate = normalize(body.bookingDate);
    const bookingTime = normalize(body.bookingTime);
    fromEniyan = body.source === 'eniyan';
    creationKey = normalize(body.bookingRequestId);
    if ((creationKey && !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(creationKey)) || (fromEniyan && (!creationKey || body.confirmed !== true))) {
      return NextResponse.json({ error: 'Review your details and confirm the booking request first.' }, { status: 400 });
    }
    const clientNotes = '';
    const internalNotes = '';
    const scheduledAt = parseBookingDate(bookingDate, bookingTime);

    if (!name || !email || !service || !bookingDate || !bookingTime) {
      return NextResponse.json({ error: 'Name, email, service, date, and time are required.' }, { status: 400 });
    }
    const detailsError = bookingDetailsError({ name, email, phone, service, message, bookingDate, bookingTime }, fromEniyan);
    if (detailsError) return NextResponse.json({ error: detailsError }, { status: 400 });
    if (creationKey) {
      requestHash = crypto.createHash('sha256').update(JSON.stringify({ name, email, phone, service, message, bookingDate, bookingTime })).digest('hex');
      const previous = await findPrevious();
      if (previous) return previous;
    }
    if (!scheduledAt) {
      return NextResponse.json({ error: 'Choose a valid booking slot.' }, { status: 400 });
    }
    if (scheduledAt.getTime() <= Date.now()) {
      return NextResponse.json({ error: 'Choose a future booking slot.' }, { status: 400 });
    }

    const { rows } = await query(
      `INSERT INTO bookings (name, email, phone, service, message, booking_date, booking_time, scheduled_at, timezone, manage_token, client_notes, internal_notes, creation_key, request_hash)
       VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id, name, email, phone, service, message, booking_date::text, booking_time, scheduled_at::text, timezone, status,
                 manage_token, client_notes, internal_notes, gallery_id, confirmation_sent_at::text, reminder_24h_sent_at::text, reminder_day_sent_at::text, created_at::text`,
      [name, email, phone, service, message, bookingDate, bookingTime, scheduledAt.toISOString(), STUDIO_TIMEZONE, createManageToken(), clientNotes, internalNotes, creationKey || null, requestHash || null]
    );

    const booking = rows[0] as BookingRow;
    let emailSent = false;
    try {
      emailSent = await sendBookingEmails(booking, req.nextUrl.origin);
      if (emailSent) {
        await query('UPDATE bookings SET confirmation_sent_at = NOW(), updated_at = NOW() WHERE id = $1', [booking.id]);
      }
    } catch (error) {
      console.error('[bookings] Booking saved but confirmation email failed:', error);
    }

    return savedResponse(booking, emailSent);
  } catch (error: unknown) {
    if (typeof error === 'object' && error && 'code' in error && error.code === '23505') {
      // Concurrent retries may collide on the slot before the request-key index.
      // Only the matching unguessable key + payload may recover the saved result.
      try {
        const previous = await findPrevious();
        if (previous) return previous;
      } catch { /* Return an uncertain outcome; keep the same request key on retry. */
        return NextResponse.json({ error: 'Could not verify the booking result. Retry the same request.' }, { status: 503 });
      }
      return NextResponse.json({ error: 'That time has just been booked. Please choose another slot.', code: 'slot_taken' }, { status: 409 });
    }
    console.error('[bookings] Failed to create booking:', error);
    return NextResponse.json({ error: 'Failed to create booking.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json() as Record<string, unknown>;
    const id = Number(body.id);
    if (body.action === 'sendTracking') {
      if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Missing booking id.' }, { status: 400 });
      const { rows } = await query(
        `SELECT id, name, email, phone, service, message, booking_date::text, booking_time, scheduled_at::text, timezone, status,
                manage_token, client_notes, internal_notes, gallery_id, confirmation_sent_at::text, reminder_24h_sent_at::text, reminder_day_sent_at::text, created_at::text
         FROM bookings WHERE id = $1 LIMIT 1`,
        [id]
      );
      const booking = rows[0] as BookingRow | undefined;
      if (!booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
      const delivered = await sendTrackingEmail(booking, req.nextUrl.origin);
      if (!delivered) return NextResponse.json({ error: 'The tracking email was rejected by the mail provider.' }, { status: 502 });
      const updated = await query(
        `UPDATE bookings SET confirmation_sent_at = NOW(), updated_at = NOW() WHERE id = $1
         RETURNING id, name, email, phone, service, message, booking_date::text, booking_time, scheduled_at::text, timezone, status,
                   manage_token, client_notes, internal_notes, gallery_id, confirmation_sent_at::text, reminder_24h_sent_at::text, reminder_day_sent_at::text, created_at::text, updated_at::text`,
        [id]
      );
      return NextResponse.json({ booking: updated.rows[0], message: `Tracking details sent to ${booking.email}.` });
    }
    const status = normalize(body.status).toLowerCase();
    const clientNotes = normalize(body.clientNotes).slice(0, 2000);
    const internalNotes = normalize(body.internalNotes).slice(0, 2000);
    const galleryId = body.galleryId === null || body.galleryId === undefined || body.galleryId === ''
      ? null
      : Number(body.galleryId);
    const allowedStatuses = new Set(['pending', 'confirmed', 'contract-sent', 'invoiced', 'completed', 'cancelled']);

    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Missing booking id.' }, { status: 400 });
    if (!allowedStatuses.has(status)) return NextResponse.json({ error: 'Choose a valid booking status.' }, { status: 400 });
    if (galleryId !== null && (!Number.isInteger(galleryId) || galleryId <= 0)) {
      return NextResponse.json({ error: 'Choose a valid gallery.' }, { status: 400 });
    }

    const { rows } = await query(
      `UPDATE bookings
       SET status = $1,
           client_notes = $2,
           internal_notes = $3,
           gallery_id = $4,
           updated_at = NOW()
       WHERE id = $5
       RETURNING id, name, email, phone, service, message, booking_date::text, booking_time, scheduled_at::text, timezone, status,
                 manage_token, client_notes, internal_notes, gallery_id, confirmation_sent_at::text, reminder_24h_sent_at::text, reminder_day_sent_at::text, created_at::text, updated_at::text`,
      [status, clientNotes, internalNotes, galleryId, id]
    );

    if (!rows[0]) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    return NextResponse.json({ booking: rows[0] });
  } catch (error) {
    console.error('[bookings] Failed to update booking:', error);
    return NextResponse.json({ error: 'Failed to update booking.' }, { status: 500 });
  }
}
