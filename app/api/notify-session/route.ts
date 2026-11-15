import { readJsonRequest } from '@/lib/requestBody';

import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { publicTrackingPath } from '@/lib/privacy';
import { rateLimit } from '@/lib/rateLimit';

const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'ijabikenm@gmail.com';

export async function POST(req: Request) {
  if (process.env.VERCEL_ENV !== 'production') return new Response(null, { status: 204 });
  try {
    const limited = await rateLimit(req, 'session-email', 3, 3600);
    if (limited) return limited;
    if (Number(req.headers.get('content-length') || 0) > 2000) return NextResponse.json({ error: 'Invalid payload' }, { status: 413 });
    const jsonRequest = await readJsonRequest(req, 2000);
    if (jsonRequest.response) return jsonRequest.response;
    const { userAgent, timestamp, path } = jsonRequest.body;

    const safePath = publicTrackingPath(path);
    if (!safePath) return new Response(null, { status: 204 });

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.error('[notify-session] Missing EMAIL_USER or EMAIL_PASS env vars');
      return NextResponse.json({ error: 'Email not configured' }, { status: 500 });
    }

    if (!Number.isFinite(Number(timestamp)) || typeof path !== 'string' || path.length > 300 || typeof userAgent !== 'string' || userAgent.length > 500) {
      console.warn('[notify-session] Invalid payload');
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: CONTACT_EMAIL,
      subject: `New Active Session Detected`,
      text: `
        A new user session has been active.
        Time: ${new Date(timestamp).toLocaleString()}
        Path: ${safePath}
        User Agent: ${userAgent}
      `,
    };

    console.log('[notify-session] sending mail', { to: mailOptions.to, subject: mailOptions.subject, path: safePath });
    const info = await transporter.sendMail(mailOptions);
    console.log('[notify-session] mail sent', { messageId: info.messageId, response: info.response });

    return NextResponse.json({ message: 'Session logged' }, { status: 200 });
  } catch (error) {
    console.error('[notify-session] Error logging session:', error);
    return NextResponse.json({ error: 'Failed to log session' }, { status: 500 });
  }
}
