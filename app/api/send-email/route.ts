import { readJsonRequest } from '@/lib/requestBody';

import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { rateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';

const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'moyoayaworan@gmail.com';

function normalizeString(value: unknown) {
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

export async function POST(req: Request) {
    try {
        const limited = await rateLimit(req, 'contact-email', 5, 3600);
        if (limited) return limited;
        if (Number(req.headers.get('content-length') || 0) > 10_000) return NextResponse.json({ error: 'Message is too long.' }, { status: 413 });
        const jsonRequest = await readJsonRequest(req, 10000);
        if (jsonRequest.response) return jsonRequest.response;
        const body = jsonRequest.body;
        const name = normalizeString(body.name);
        const email = normalizeString(body.email).toLowerCase();
        const service = normalizeString(body.service);
        const message = normalizeString(body.message);
        const type = normalizeString(body.type);
        const emailUser = process.env.EMAIL_USER;
        const emailPass = process.env.EMAIL_PASS;

        if (!name || !email || !message || name.length > 120 || email.length > 254 || service.length > 120 || type.length > 80 || message.length > 5000) {
            return NextResponse.json({ error: 'Name, email, and message are required.' }, { status: 400 });
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
        }

        if (!emailUser || !emailPass) {
            console.error('[send-email] Missing EMAIL_USER or EMAIL_PASS env vars');
            return NextResponse.json({ error: 'Email is not configured.' }, { status: 500 });
        }

        // Create a transporter using SMTP
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: emailUser,
                pass: emailPass,
            },
        });

        const mailOptions = {
            from: emailUser,
            to: CONTACT_EMAIL,
            replyTo: email,
            subject: `New Booking Inquiry: ${type || 'General'} - ${name}`,
            text: `
                Name: ${name}
                Email: ${email}
                Service/Type: ${service || 'Not specified'}
                Message: ${message}
            `,
            html: `
                <h3>New Booking Inquiry</h3>
                <p><strong>Name:</strong> ${escapeHtml(name)}</p>
                <p><strong>Email:</strong> ${escapeHtml(email)}</p>
                <p><strong>Service:</strong> ${escapeHtml(service || 'Not specified')}</p>
                <p><strong>Message:</strong> ${escapeHtml(message).replace(/\n/g, '<br />')}</p>
            `,
        };

        console.log('[send-email] sending inquiry');
        await transporter.sendMail(mailOptions);
        console.log('[send-email] inquiry sent');

        return NextResponse.json({ message: 'Email sent successfully' }, { status: 200 });
    } catch {
        console.error('[send-email] Email delivery failed.');
        return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }
}
