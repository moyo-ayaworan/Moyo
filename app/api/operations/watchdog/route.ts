import { timingSafeEqual } from 'node:crypto';
import nodemailer from 'nodemailer';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import type { NextRequest } from 'next/server';
export const runtime = 'nodejs';
export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : '';
  const actual = request.headers.get('authorization') || '';
  const headers = { 'Cache-Control': 'private, no-store' };
  const cron = !!expected && Buffer.byteLength(expected) === Buffer.byteLength(actual) && timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
  if (!cron) { const unauthorized = await requireAdmin(request, true); if (unauthorized) return unauthorized; }
  try {
    const { rows } = await query("SELECT 1 FROM operations_runs WHERE name='external-monitor' AND completed_at > NOW()-INTERVAL '26 hours' AND failed=0");
    if (rows.length) return Response.json({ healthy: true }, { headers });
    const user = process.env.SMTP_USER || process.env.EMAIL_USER;
    const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
    if (!user || !pass) throw Error('Alert unavailable');
    const mail = nodemailer.createTransport({ service: 'gmail', auth: { user, pass }, connectionTimeout: 5000, socketTimeout: 10000 });
    const result = await mail.sendMail({ from: user, to: process.env.CONTACT_EMAIL || 'moyoayaworan@gmail.com', subject: 'Moyo operations: independent monitor is overdue', text: 'No successful independent monitoring run has been recorded in 26 hours. Check the private moyo-operations repository Actions runs, backup releases and GitHub scheduling. No customer information is included.' });
    if (!result.accepted?.length || result.rejected?.length) throw Error('Alert not accepted');
    return Response.json({ healthy: false, alerted: true }, { status: 503, headers });
  } catch { console.error(JSON.stringify({ event: 'operations_watchdog_failed' })); return Response.json({ healthy: false }, { status: 503, headers }); }
}
