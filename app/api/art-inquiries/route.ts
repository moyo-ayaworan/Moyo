import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export const runtime = 'nodejs';
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'ijabikenm@gmail.com';
const statuses = new Set(['received', 'consultation', 'quoted', 'reserved', 'deposit-paid', 'in-progress', 'ready', 'delivered', 'closed']);
const types = new Set(['commission', 'artwork', 'private-viewing']);
const clean = (value: unknown, max = 3000) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const emailOkay = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

function transportConfig() {
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const from = process.env.SMTP_FROM || process.env.EMAIL_FROM || user;
  return user && pass && from ? { user, pass, host, port, from } : null;
}

async function sendReceived(inquiry: Record<string, unknown>, origin: string) {
  const config = transportConfig();
  if (!config) return false;
  const transporter = nodemailer.createTransport(config.host ? { host: config.host, port: config.port, secure: config.port === 465, auth: { user: config.user, pass: config.pass } } : { service: 'gmail', auth: { user: config.user, pass: config.pass } });
  const portal = `${origin}/collector/${inquiry.manage_token}`;
  const details = inquiry.details as Record<string, unknown>;
  await transporter.sendMail({ from: config.from, to: CONTACT_EMAIL, replyTo: String(inquiry.email), subject: `New art ${inquiry.inquiry_type} inquiry · ${inquiry.name}`, text: `Reference: ART-${inquiry.id}\nCollector: ${inquiry.name}\nEmail: ${inquiry.email}\nPhone: ${inquiry.phone || 'Not provided'}\nDetails: ${JSON.stringify(details, null, 2)}\nPortal: ${portal}` });
  const result = await transporter.sendMail({ from: config.from, to: String(inquiry.email), replyTo: CONTACT_EMAIL, subject: `Art inquiry ART-${inquiry.id} received`, text: `Hi ${inquiry.name}, your art inquiry has been received. Track its progress and documents privately here: ${portal}\n\nReference: ART-${inquiry.id}. Pricing, availability, shipping and timelines require studio confirmation.` });
  return Boolean(result.accepted?.length) && !result.rejected?.length;
}

export async function GET(req: NextRequest) {
  const unauthorized = requireAdmin(req); if (unauthorized) return unauthorized;
  const { rows } = await query(`SELECT i.*, a.title AS artwork_title FROM art_inquiries i LEFT JOIN artworks a ON a.id=i.artwork_id ORDER BY i.created_at DESC`);
  return NextResponse.json({ inquiries: rows }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Inquiry details are required.' }, { status: 400 });
  const inquiryType = clean(body.inquiryType, 30);
  const name = clean(body.name, 120); const email = clean(body.email, 254).toLowerCase(); const phone = clean(body.phone, 40);
  const artworkId = body.artworkId ? Number(body.artworkId) : null;
  const source = body.details && typeof body.details === 'object' && !Array.isArray(body.details) ? body.details as Record<string, unknown> : {};
  const details = Object.fromEntries(Object.entries(source).slice(0, 20).map(([key, value]) => [key.slice(0, 50), clean(value, 1000)]));
  if (!types.has(inquiryType) || !name || !emailOkay(email) || (artworkId !== null && (!Number.isInteger(artworkId) || artworkId <= 0))) return NextResponse.json({ error: 'Enter a valid name, email, and inquiry type.' }, { status: 400 });
  if (!Object.values(details).some(Boolean)) return NextResponse.json({ error: 'Tell the studio what you are looking for.' }, { status: 400 });
  const { rows } = await query(`INSERT INTO art_inquiries (inquiry_type, artwork_id, name, email, phone, details, manage_token) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7) RETURNING *`, [inquiryType, artworkId, name, email, phone, JSON.stringify(details), crypto.randomBytes(18).toString('hex')]);
  let emailSent = false; try { emailSent = await sendReceived(rows[0], req.nextUrl.origin); } catch (error) { console.error('[art inquiries] confirmation email failed', error); }
  return NextResponse.json({ inquiry: { id: rows[0].id, status: rows[0].status, manage_token: rows[0].manage_token }, emailSent }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } });
}

export async function PUT(req: NextRequest) {
  const unauthorized = requireAdmin(req); if (unauthorized) return unauthorized;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const id = Number(body?.id); const status = clean(body?.status, 30); const galleryId = body?.galleryId ? Number(body.galleryId) : null;
  if (!Number.isInteger(id) || !statuses.has(status) || (galleryId !== null && !Number.isInteger(galleryId))) return NextResponse.json({ error: 'Valid inquiry, stage, and gallery are required.' }, { status: 400 });
  const { rows } = await query(`UPDATE art_inquiries SET status=$1, gallery_id=$2, client_notes=$3, internal_notes=$4, updated_at=NOW() WHERE id=$5 RETURNING *`, [status, galleryId, clean(body?.clientNotes, 2000), clean(body?.internalNotes, 2000), id]);
  if (!rows[0]) return NextResponse.json({ error: 'Inquiry not found.' }, { status: 404 });
  return NextResponse.json({ inquiry: rows[0] });
}
