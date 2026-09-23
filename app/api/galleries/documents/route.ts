import { NextRequest, NextResponse } from 'next/server';
import { existsSync } from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { buildDocumentPdf } from '@/lib/documentPdf';
import nodemailer from 'nodemailer';
import { requireAdmin } from '@/lib/auth';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

type GalleryDocument = {
  id: number;
  gallery_id: number;
  document_type: string;
  title: string;
  client_email: string;
  amount: string | number;
  currency: string;
  due_date: string;
  line_items: string;
  terms: string;
  sent_at: string | null;
  paid_at?: string | null;
  created_at: string;
  client_name?: string;
  access_code?: string;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

type CalculatedInvoiceItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

type CalculatedInvoice = {
  structured: boolean;
  items: CalculatedInvoiceItem[];
  subtotal: number;
  discountType: 'fixed' | 'percent';
  discountValue: number;
  discount: number;
  taxableSubtotal: number;
  taxRate: number;
  tax: number;
  total: number;
};

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const LOGO_PATH = path.join(process.cwd(), 'public', 'brand', 'moyo-logo-red.png');

function normalize(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function sanitizeFilename(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'document';
}

function normalizeId(value: unknown) {
  const id = typeof value === 'number' ? String(value) : normalize(value);
  return /^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id)) && Number(id) <= 2147483647 ? id : '';
}

function normalizeType(value: unknown) {
  return normalize(value).toLowerCase() === 'contract' ? 'contract' : 'invoice';
}

function normalizeCurrency(value: unknown) {
  const currency = normalize(value).toUpperCase();
  return currency || 'NGN';
}

function parseAmount(value: unknown) {
  if (value === '' || value === null || value === undefined) return 0;
  if (typeof value !== 'string' && typeof value !== 'number') return NaN;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : NaN;
}

function isValidDateInput(value: string) {
  if (!value) return true;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMoney(amount: string | number, currency: string) {
  const numeric = Number(amount || 0);
  if (!Number.isFinite(numeric) || numeric < 0) return '';
  return `${currency || 'NGN'} ${numeric.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function formatMoneyWithZero(amount: string | number, currency: string) {
  const numeric = Number(amount || 0);
  if (!Number.isFinite(numeric)) return `${currency || 'NGN'} 0`;
  return `${currency || 'NGN'} ${numeric.toLocaleString(undefined, {
    minimumFractionDigits: Number.isInteger(numeric) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function normalizeInvoiceItems(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const description = truncate(normalize(record.description), 220);
      const parsedQuantity = parseAmount(record.quantity);
      const parsedUnitPrice = parseAmount(record.unitPrice);
      const quantity = Number.isFinite(parsedQuantity) ? Math.max(0, parsedQuantity) : 0;
      const unitPrice = Number.isFinite(parsedUnitPrice) ? Math.max(0, parsedUnitPrice) : 0;
      if (!description && quantity <= 0 && unitPrice <= 0) return null;
      return { description, quantity, unitPrice };
    })
    .filter(Boolean)
    .slice(0, 20) as Array<{ description: string; quantity: number; unitPrice: number }>;
}

function calculateInvoiceDetails(options: {
  items: Array<{ description: string; quantity: number; unitPrice: number }>;
  discountType?: unknown;
  discountValue?: unknown;
  taxRate?: unknown;
}) {
  const items = options.items.map((item) => ({
    ...item,
    total: Math.round((item.quantity * item.unitPrice + Number.EPSILON) * 100) / 100,
  }));
  const subtotal = Math.round(items.reduce((sum, item) => sum + item.total, 0) * 100) / 100;
  const discountType: 'fixed' | 'percent' = normalize(options.discountType) === 'percent' ? 'percent' : 'fixed';
  const parsedDiscount = parseAmount(options.discountValue);
  const rawDiscount = Number.isFinite(parsedDiscount) ? Math.max(0, parsedDiscount) : 0;
  const discountUnrounded =
    discountType === 'percent'
      ? Math.min(subtotal, subtotal * Math.min(rawDiscount, 100) / 100)
      : Math.min(subtotal, rawDiscount);
  const discount = Math.round(discountUnrounded * 100) / 100;
  const taxableSubtotal = Math.round(Math.max(0, subtotal - discount) * 100) / 100;
  const parsedTaxRate = parseAmount(options.taxRate);
  const taxRate = Number.isFinite(parsedTaxRate) ? Math.max(0, parsedTaxRate) : 0;
  const tax = Math.round(taxableSubtotal * taxRate) / 100;
  const total = Math.round((taxableSubtotal + tax) * 100) / 100;

  return {
    structured: true,
    items,
    subtotal,
    discountType,
    discountValue: rawDiscount,
    discount,
    taxableSubtotal,
    taxRate,
    tax,
    total,
  };
}

function encodeInvoiceDetails(details: CalculatedInvoice) {
  return JSON.stringify({
    version: 1,
    kind: 'calculated-invoice',
    items: details.items.map(({ description, quantity, unitPrice }) => ({ description, quantity, unitPrice })),
    discountType: details.discountType,
    discountValue: details.discountValue,
    taxRate: details.taxRate,
  });
}

function getCalculatedInvoice(doc: GalleryDocument): CalculatedInvoice | null {
  try {
    const parsed = JSON.parse(doc.line_items || '');
    if (!parsed || parsed.kind !== 'calculated-invoice') return null;
    const items = normalizeInvoiceItems(parsed.items);
    if (!items.length) return null;
    return calculateInvoiceDetails({
      items,
      discountType: parsed.discountType,
      discountValue: parsed.discountValue,
      taxRate: parsed.taxRate,
    });
  } catch {
    return null;
  }
}

function documentText(doc: GalleryDocument) {
  const label = doc.document_type === 'contract' ? 'Contract' : doc.paid_at ? 'Receipt' : 'Invoice';
  const calculation = getCalculatedInvoice(doc);
  const amount = formatMoney(calculation?.total ?? doc.amount, doc.currency);
  const itemText = calculation
    ? [
        ...calculation.items.map((item) =>
          `${item.description} | Qty ${item.quantity} | Unit ${formatMoneyWithZero(item.unitPrice, doc.currency)} | Total ${formatMoneyWithZero(item.total, doc.currency)}`
        ),
        `Subtotal: ${formatMoneyWithZero(calculation.subtotal, doc.currency)}`,
        `Discount: -${formatMoneyWithZero(calculation.discount, doc.currency)}`,
        `Tax${calculation.taxRate ? ` (${calculation.taxRate}%)` : ''}: ${formatMoneyWithZero(calculation.tax, doc.currency)}`,
        `Total: ${formatMoneyWithZero(calculation.total, doc.currency)}`,
      ].join('\n')
    : doc.line_items || (doc.document_type === 'contract' ? 'Agreement details to be confirmed by both parties.' : 'Photography services.');
  return [
    'MOYO AYAWORAN',
    label,
    '',
    doc.title,
    `Client: ${doc.client_name || 'Client'}`,
    `Email: ${doc.client_email}`,
    doc.document_type === 'invoice' && amount ? `${doc.paid_at ? 'Total paid' : 'Amount'}: ${amount}` : '',
    doc.document_type === 'invoice' && !doc.paid_at && doc.due_date ? `Due date: ${doc.due_date}` : '',
    '',
    itemText,
    '',
    doc.paid_at ? `PAID: ${new Date(doc.paid_at).toLocaleDateString('en-GB', { timeZone: 'Africa/Lagos' })} / Balance: ${formatMoneyWithZero(0, doc.currency)}` : '',
    'Thank you for creating with Moyo Ayaworan.',
    'Ijabiken Moyosoreoluwa',
    'Creative Director, MOYO AYAWORAN',
    doc.terms || 'Contract terms, usage rights, payment, and delivery notes to be confirmed.',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

function getDocumentLines(doc: GalleryDocument) {
  const calculation = getCalculatedInvoice(doc);
  if (calculation) return calculation.items.map((item) => item.description).filter(Boolean);

  const fallback =
    doc.document_type === 'contract'
      ? 'Photography service agreement and creative usage terms.'
      : 'Photography services';

  return (doc.line_items || fallback)
    .replace(/\\n/g, '\n')
    .replace(/\s+[-•]\s+/g, '\n')
    .split(/\n+/)
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean);
}

function getLogoAttachment() {
  if (!existsSync(LOGO_PATH)) return null;
  return {
    filename: 'moyo-logo-red.png',
    path: LOGO_PATH,
    cid: 'moyo-logo',
  };
}

function emailHtml(doc: GalleryDocument) {
  const calculation = doc.document_type === 'invoice' ? getCalculatedInvoice(doc) : null;
  const isContract = doc.document_type === 'contract';
  const amount = formatMoney(calculation?.total ?? doc.amount, doc.currency);
  const label = doc.document_type === 'contract' ? 'Contract' : doc.paid_at ? 'Receipt' : 'Invoice';
  const detailLabel = doc.document_type === 'contract' ? 'Agreement' : 'Service';
  const emailItems = calculation
    ? calculation.items
    : getDocumentLines(doc).map((item, index) => ({
        description: item,
        quantity: index === 0 ? 1 : 0,
        unitPrice: index === 0 ? Number(doc.amount || 0) : 0,
        total: index === 0 ? Number(doc.amount || 0) : 0,
      }));
  const contractScope = `<p style="margin:0;color:#eeeae5;font-size:13px;line-height:1.7;white-space:pre-wrap;overflow-wrap:anywhere;">${escapeHtml(doc.line_items)}</p>`;
  const itemRows = emailItems
    .map(
      (item, index) => `
        <tr>
          <td width="40%" style="padding:14px 12px 14px 0;border-top:1px solid #303135;color:#eeeae5;font-size:13px;line-height:1.45;font-weight:${index === 0 ? '700' : '400'};word-break:break-word;">${escapeHtml(item.description)}</td>
          <td width="10%" style="padding:14px 8px;border-top:1px solid #303135;color:#a5a5ab;font-size:12px;line-height:1.45;text-align:center;">${calculation ? `Qty ${item.quantity}` : index === 0 ? detailLabel : 'Item'}</td>
          <td width="25%" style="padding:14px 8px;border-top:1px solid #303135;color:#a5a5ab;font-size:12px;text-align:right;word-break:break-word;">${calculation ? escapeHtml(formatMoneyWithZero(item.unitPrice, doc.currency)) : '—'}</td>
          <td width="25%" style="padding:14px 0 14px 12px;border-top:1px solid #303135;color:${item.total > 0 ? '#e06673' : '#a5a5ab'};font-size:13px;line-height:1.45;font-weight:${item.total > 0 ? '700' : '400'};text-align:right;overflow-wrap:anywhere;word-break:break-word;">${item.total > 0 ? escapeHtml(formatMoneyWithZero(item.total, doc.currency)) : '-'}</td>
        </tr>
      `
    )
    .join('');
  const summaryRows = calculation
    ? `
      <tr>
        <td colspan="3" align="right" style="padding:14px 12px 0 0;color:#a5a5ab;font-size:12px;line-height:1.5;">Subtotal</td>
        <td align="right" style="padding:14px 0 0 12px;color:#eeeae5;font-size:12px;line-height:1.5;overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(formatMoneyWithZero(calculation.subtotal, doc.currency))}</td>
      </tr>
      <tr>
        <td colspan="3" align="right" style="padding:8px 12px 0 0;color:#a5a5ab;font-size:12px;line-height:1.5;">Discount</td>
        <td align="right" style="padding:8px 0 0 12px;color:#eeeae5;font-size:12px;line-height:1.5;overflow-wrap:anywhere;word-break:break-word;">-${escapeHtml(formatMoneyWithZero(calculation.discount, doc.currency))}</td>
      </tr>
      <tr>
        <td colspan="3" align="right" style="padding:8px 12px 0 0;color:#a5a5ab;font-size:12px;line-height:1.5;">Tax${calculation.taxRate ? ` (${calculation.taxRate}%)` : ''}</td>
        <td align="right" style="padding:8px 0 0 12px;color:#eeeae5;font-size:12px;line-height:1.5;overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(formatMoneyWithZero(calculation.tax, doc.currency))}</td>
      </tr>
    `
    : '';
  return `
    <head><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"></head>
    <body style="margin:0;padding:0;background:#0b0c0e;color:#eeeae5;font-family:Arial,Helvetica,sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;background:#0b0c0e;">
        <tr>
          <td align="center" style="padding:24px 12px;">
            <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;border-collapse:collapse;background:#151618;border:1px solid #303135;border-top:3px solid #920110;">
              <tr>
                <td style="padding:34px 24px 28px;background:#151618;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;">
                    <tr>
                      <td valign="middle" style="padding:0 0 38px;">
                        <img src="cid:moyo-logo" width="82" alt="Moyo" style="display:block;width:82px;height:auto;border:0;outline:none;text-decoration:none;" />
                      </td>
                      <td valign="middle" align="right" style="padding:0 0 38px;">
                        <h1 style="margin:0;color:#eeeae5;font-size:32px;font-weight:300;line-height:1.2;letter-spacing:5px;text-transform:uppercase;">${escapeHtml(label)}</h1>
                        <p style="margin:8px 0 0;color:#a5a5ab;font-size:12px;line-height:1.5;">Moyo-${doc.id}</p>
                      </td>
                    </tr>
                  </table>

                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;">
                    <tr>
                      <td valign="top" width="52%" style="padding:0 20px 34px 0;">
                        <h2 style="margin:0 0 10px;color:#eeeae5;font-size:17px;line-height:1.3;">${escapeHtml(doc.client_name || 'Client Name')}</h2>
                        <p style="margin:0;color:#a5a5ab;font-size:13px;line-height:1.65;">${escapeHtml(doc.title)}<br/>${escapeHtml(doc.client_email)}</p>
                      </td>
                      <td valign="top" width="48%" align="right" style="padding:0 0 34px 20px;color:#a5a5ab;font-size:13px;line-height:1.65;">
                        <strong style="color:#eeeae5;">MOYO AYAWORAN</strong><br/>
                        Photography & Fine Art<br/>
                        ijabikenm@gmail.com
                      </td>
                    </tr>
                  </table>

                  ${isContract ? `<h3 style="color:#a5a5ab;font-size:12px;">SCOPE OF WORK</h3>${contractScope}` : `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;table-layout:fixed;">
                    <thead>
                      <tr>
                        <th width="40%" align="left" style="padding:0 12px 12px 0;color:#a5a5ab;font-size:10px;line-height:1.3;letter-spacing:2px;text-transform:uppercase;">Description</th>
                        <th width="10%" align="center" style="padding:0 8px 12px;color:#a5a5ab;font-size:10px;line-height:1.3;letter-spacing:2px;text-transform:uppercase;">Qty</th>
                        <th width="25%" align="right" style="padding:0 8px 12px;color:#a5a5ab;font-size:10px;letter-spacing:2px;text-transform:uppercase;">Rate</th>
                        <th width="25%" align="right" style="padding:0 0 12px 12px;color:#a5a5ab;font-size:10px;line-height:1.3;letter-spacing:2px;text-transform:uppercase;">Amount</th>
                      </tr>
                    </thead>
                    <tbody>${itemRows}${summaryRows}</tbody>
                  </table>`}
                </td>
              </tr>

              <tr>
                <td style="padding:28px 24px 34px;background:#151618;">
                  ${isContract ? '' : `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;border-top:1px solid #303135;border-bottom:1px solid #303135;">
                    <tr>
                      <td valign="top" width="39%" style="padding:18px 12px 18px 0;">
                        <p style="margin:0 0 10px;color:#a5a5ab;font-size:10px;line-height:1.3;letter-spacing:2px;text-transform:uppercase;">Payment info</p>
                        <p style="margin:0;color:#eeeae5;font-size:12px;line-height:1.6;">Bank transfer / studio confirmation<br/>Reference: Moyo-${doc.id}</p>
                      </td>
                      <td valign="top" width="25%" style="padding:18px 12px;">
                        <p style="margin:0 0 10px;color:#a5a5ab;font-size:10px;line-height:1.3;letter-spacing:2px;text-transform:uppercase;">${doc.paid_at ? 'Paid on' : 'Due by'}</p>
                        <p style="margin:0;color:#eeeae5;font-size:14px;line-height:1.4;">${escapeHtml(doc.paid_at ? new Date(doc.paid_at).toLocaleDateString('en-GB', { timeZone: 'Africa/Lagos' }) : doc.due_date || 'On receipt')}</p>
                      </td>
                      <td valign="top" width="36%" align="right" style="padding:18px 0 18px 12px;">
                        <p style="margin:0 0 10px;color:#a5a5ab;font-size:10px;line-height:1.3;letter-spacing:2px;text-transform:uppercase;">${doc.paid_at ? 'Total paid' : 'Total due'}</p>
                        <p style="margin:0;color:#e06673;font-size:20px;line-height:1.25;font-weight:700;">${escapeHtml(amount || 'To be confirmed')}</p>
                      </td>
                    </tr>
                  </table>`}
                  ${doc.paid_at && doc.document_type === 'invoice' ? `<div style="margin-top:24px;text-align:right;"><span style="display:inline-block;border:3px solid #920110;padding:10px 24px;color:#e06673;font-size:30px;font-weight:bold;letter-spacing:5px;">PAID</span><p style="color:#a5a5ab;font-size:12px;">Payment confirmed ${escapeHtml(new Date(doc.paid_at).toLocaleDateString('en-GB', { timeZone: 'Africa/Lagos' }))}<br/>Balance: ${escapeHtml(formatMoneyWithZero(0, doc.currency))}</p></div>` : ''}
                  ${doc.terms ? `<div style="margin:22px 0 0;padding:16px 0 0;border-top:1px solid #303135;"><p style="margin:0 0 8px;color:#a5a5ab;font-size:10px;line-height:1.3;letter-spacing:2px;text-transform:uppercase;">${label === 'Invoice' ? 'Contract / Terms' : 'Terms'}</p><p style="margin:0;color:#a5a5ab;font-size:12px;line-height:1.7;white-space:pre-line;">${escapeHtml(doc.terms)}</p></div>` : ''}
                  <p style="margin:26px 0 0;color:#eeeae5;font-size:13px;line-height:1.6;">Thank you for creating with Moyo Ayaworan.<br/><br/>Ijabiken Moyosoreoluwa<br/>Creative Director, MOYO AYAWORAN<br/><br/>A PDF copy is attached.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  `;
}

async function getDocument(id: string) {
  const { rows } = await query(
    `SELECT d.*, g.client_name, g.access_code
     FROM gallery_documents d
     JOIN galleries g ON g.id = d.gallery_id
     WHERE d.id = $1`,
    [id]
  );
  return rows[0] as GalleryDocument | undefined;
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

function parseGeminiDraft(text: string) {
  const cleaned = text
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    if (!cleaned) return null;
    return {
      title: 'Photography Invoice Draft',
      lineItems: cleaned,
      terms: 'Payment is due according to the agreed schedule. Final delivery follows studio confirmation.',
    };
  }
  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    return {
      title: normalize(parsed.title),
      lineItems: normalize(parsed.lineItems),
      terms: normalize(parsed.terms),
    };
  } catch {
    const title = cleaned.match(/"title"\s*:\s*"([^"]+)"/)?.[1] || '';
    const lineItems = cleaned.match(/"lineItems"\s*:\s*"([\s\S]*?)"\s*,\s*"terms"/)?.[1] || '';
    const terms = cleaned.match(/"terms"\s*:\s*"([\s\S]*?)"\s*\}/)?.[1] || '';
    if (!title && !lineItems && !terms) return null;
    return {
      title: title.replace(/\\n/g, '\n'),
      lineItems: lineItems.replace(/\\n/g, '\n'),
      terms: terms.replace(/\\n/g, '\n'),
    };
  }
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  const format = req.nextUrl.searchParams.get('format');
  const token = req.nextUrl.searchParams.get('token') || '';
  if (id && format === 'pdf') {
    if (!token) {
      const unauthorized = requireAdmin(req);
      if (unauthorized) return unauthorized;
    }
    if (!normalizeId(id)) return NextResponse.json({ error: 'Invalid document id.' }, { status: 400 });
    let doc: GalleryDocument | undefined;
    if (token) {
      const { rows } = await query(
        `SELECT d.*, g.client_name
         FROM gallery_documents d
         JOIN galleries g ON g.id = d.gallery_id
         WHERE d.id = $2 AND EXISTS (
           SELECT 1 FROM bookings b WHERE b.manage_token = $1 AND b.gallery_id = d.gallery_id
         )
         LIMIT 1`,
        [token, id]
      );
      if (!rows[0]) return NextResponse.json({ error: 'Document not available for this booking.' }, { status: 403 });
      doc = rows[0] as GalleryDocument;
    } else {
      doc = await getDocument(id);
    }
    if (!doc) return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
    const pdf = await buildDocumentPdf(doc, getCalculatedInvoice(doc));
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `attachment; filename="${sanitizeFilename(`${doc.paid_at ? 'receipt' : doc.document_type}-${doc.id}-${doc.title}`)}.pdf"`,
      },
    });
  }

  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  const galleryId = req.nextUrl.searchParams.get('galleryId');
  if (galleryId && !normalizeId(galleryId)) return NextResponse.json({ error: 'Invalid gallery id.' }, { status: 400 });
  const params = galleryId ? [galleryId] : [];
  const where = galleryId ? 'WHERE d.gallery_id = $1' : '';
  const { rows } = await query(
    `SELECT d.*, g.client_name
     FROM gallery_documents d
     JOIN galleries g ON g.id = d.gallery_id
     ${where}
     ORDER BY d.created_at DESC`,
    params
  );
  return NextResponse.json({ documents: rows }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(req: NextRequest) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Invalid document request.' }, { status: 400 });
    const action = normalize(body.action);
    const creationKey = normalize(body.creationKey);
    if (creationKey && !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(creationKey)) {
      return NextResponse.json({ error: 'Invalid document request key.' }, { status: 400 });
    }
    if (action && action !== 'generate') return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
    if (body.documentType && !['invoice', 'contract'].includes(body.documentType)) return NextResponse.json({ error: 'Invalid document type.' }, { status: 400 });
    const galleryId = Number(body.galleryId);
    const documentType = normalizeType(body.documentType);
    const title =
      normalize(body.title) ||
      (documentType === 'contract' ? 'Photography Contract' : 'Photography Invoice');
    const clientEmail = normalize(body.clientEmail).toLowerCase();
    const amount = parseAmount(body.amount);
    const currency = normalizeCurrency(body.currency);
    const dueDate = normalize(body.dueDate);
    const lineItems = normalize(body.lineItems);
    const terms = normalize(body.terms);
    if (title.length > 140 || ((documentType === 'contract' || action === 'generate') && lineItems.length > 3000) || terms.length > 3000) {
      return NextResponse.json({ error: 'Use at most 140 characters for the title and 3000 each for scope and terms. Nothing has been saved.' }, { status: 400 });
    }
    if (documentType === 'contract' && action !== 'generate' && (!lineItems || !terms)) {
      return NextResponse.json({ error: 'Add the contract scope and terms before saving.' }, { status: 400 });
    }
    const rawItems = body.items || body.invoiceItems;
    if (documentType === 'invoice' && action !== 'generate') {
      if (!Array.isArray(rawItems) || rawItems.length === 0 || rawItems.length > 20 || rawItems.some((item) =>
        !item || typeof item !== 'object' || !normalize(item.description) ||
        normalize(item.description).length > 220 || !['string', 'number'].includes(typeof item.quantity) ||
        !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0 ||
        !['string', 'number'].includes(typeof item.unitPrice) || String(item.unitPrice).trim() === '' ||
        !Number.isFinite(Number(item.unitPrice)) || Number(item.unitPrice) < 0
      )) return NextResponse.json({ error: 'Use 1–20 complete invoice items with a description, positive quantity, and valid price.' }, { status: 400 });
      const discount = parseAmount(body.discountValue);
      const tax = parseAmount(body.taxRate);
      if (!Number.isFinite(discount) || discount < 0 || (body.discountType === 'percent' && discount > 100) ||
          !Number.isFinite(tax) || tax < 0 || tax > 100) {
        return NextResponse.json({ error: 'Enter a valid discount and a tax rate between 0 and 100%.' }, { status: 400 });
      }
    }
    const invoiceItems = normalizeInvoiceItems(rawItems);
    const invoiceDetails = documentType === 'invoice'
      ? calculateInvoiceDetails({
          items: invoiceItems,
          discountType: body.discountType,
          discountValue: body.discountValue,
          taxRate: body.taxRate,
        })
      : null;
    const storedAmount = invoiceDetails ? invoiceDetails.total : amount;
    const storedLineItems = invoiceDetails ? encodeInvoiceDetails(invoiceDetails) : lineItems;

    if (!normalizeId(body.galleryId)) {
      return NextResponse.json({ error: 'Choose a gallery.' }, { status: 400 });
    }
    if (!Number.isFinite(storedAmount) || storedAmount < 0 || storedAmount > Number.MAX_SAFE_INTEGER / 100) {
      return NextResponse.json({ error: 'Enter a valid amount.' }, { status: 400 });
    }
    if (documentType === 'invoice' && action !== 'generate') {
      if (invoiceDetails && (!Number.isFinite(invoiceDetails.subtotal) || invoiceDetails.subtotal > Number.MAX_SAFE_INTEGER / 100 ||
          (invoiceDetails.discountType === 'fixed' && invoiceDetails.discountValue > invoiceDetails.subtotal))) {
        return NextResponse.json({ error: 'Invoice amounts are too large, or the discount exceeds the subtotal.' }, { status: 400 });
      }
      if (!invoiceItems.some((item) => item.description && item.quantity > 0 && item.unitPrice > 0)) {
        return NextResponse.json({ error: 'Add at least one invoice item with a price above zero.' }, { status: 400 });
      }
    }
    if (!/^[A-Z]{3,5}$/.test(currency)) {
      return NextResponse.json({ error: 'Enter a valid currency code.' }, { status: 400 });
    }
    if (!isValidDateInput(dueDate)) {
      return NextResponse.json({ error: 'Enter a valid due date.' }, { status: 400 });
    }

    const { rows: galleryRows } = await query('SELECT client_name FROM galleries WHERE id = $1', [galleryId]);
    const gallery = galleryRows[0];
    if (!gallery) return NextResponse.json({ error: 'Gallery not found.' }, { status: 404 });

    if (action === 'generate') {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY is not configured.' }, { status: 500 });

      const brief = [lineItems, terms].filter(Boolean).join('\n\n') || 'A clean photography service document.';
      const prompt = [
        `Create a concise ${documentType} draft for Ijabiken Moyo.`,
        `Client name: ${gallery.client_name}`,
        storedAmount > 0 ? `Amount: ${currency} ${storedAmount}` : '',
        dueDate ? `Due date: ${dueDate}` : '',
        'Use a professional, simple photography-studio tone.',
        'Return only valid JSON with keys: title, lineItems, terms.',
        'lineItems must not be empty. Write 2 to 4 short plain-text service lines based on the brief.',
        'terms must not be empty. Write concise payment, delivery, and usage terms in plain text.',
        '',
        'Brief:',
        brief,
      ]
        .filter(Boolean)
        .join('\n');

      const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
        method: 'POST',
        signal: AbortSignal.timeout(20_000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.35,
            maxOutputTokens: 520,
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                title: { type: 'STRING' },
                lineItems: { type: 'STRING' },
                terms: { type: 'STRING' },
              },
              required: ['title', 'lineItems', 'terms'],
            },
          },
        }),
      });
      const data = (await response.json()) as GeminiResponse;
      if (!response.ok) return NextResponse.json({ error: 'Gemini could not generate this document.' }, { status: 502 });

      const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim() || '';
      const draft = parseGeminiDraft(text);
      if (!draft) return NextResponse.json({ error: 'Gemini returned an unusable draft.' }, { status: 502 });
      if (draft.title.length > 140 || draft.lineItems.length > 3000 || draft.terms.length > 3000) {
        return NextResponse.json({ error: 'The generated draft is too long. Please shorten the brief and try again.' }, { status: 502 });
      }
      return NextResponse.json({
        draft: {
          title: truncate(draft.title || title, 140),
          lineItems: truncate(draft.lineItems || lineItems || 'Photography services.', 3000),
          terms: truncate(draft.terms || terms || 'Payment is due according to the agreed schedule.', 3000),
        },
      });
    }

    if (!clientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
      return NextResponse.json({ error: 'Enter a valid client email.' }, { status: 400 });
    }

    const values = [galleryId, documentType, title, clientEmail, storedAmount, currency, dueDate, storedLineItems, terms];
    const requestHash = creationKey ? createHash('sha256').update(JSON.stringify(values)).digest('hex') : null;
    const { rows } = await query(
      `INSERT INTO gallery_documents (
        gallery_id, document_type, title, client_email, amount, currency, due_date, line_items, terms, creation_key, request_hash
      )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (creation_key) DO UPDATE SET creation_key = EXCLUDED.creation_key
       WHERE gallery_documents.request_hash = EXCLUDED.request_hash
       RETURNING *`,
      [...values, creationKey || null, requestHash]
    );
    if (!rows[0]) return NextResponse.json({ error: 'This save key belongs to different document details. Nothing was changed.' }, { status: 409 });
    return NextResponse.json({ document: rows[0] }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('[gallery documents] POST error', error);
    return NextResponse.json({ error: 'Unable to save this document.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Invalid document request.' }, { status: 400 });
    const id = normalizeId(body.id);
    const action = normalize(body.action);
    if (!id) return NextResponse.json({ error: 'Missing document id.' }, { status: 400 });

    if (action === 'markPaid') {
      const doc = await getDocument(id);
      if (!doc) return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
      if (doc.document_type !== 'invoice' || !Number.isFinite(Number(doc.amount)) || Number(doc.amount) <= 0) return NextResponse.json({ error: 'Only invoices with a positive total can be marked paid.' }, { status: 400 });
      const { rows } = await query(
        `UPDATE gallery_documents SET paid_at = COALESCE(paid_at, NOW()), updated_at = NOW() WHERE id = $1 RETURNING *`, [id]
      );
      return NextResponse.json({ document: rows[0] });
    }

    if (action === 'send') {
      const doc = await getDocument(id);
      if (!doc) return NextResponse.json({ error: 'Document not found.' }, { status: 404 });

      const config = getTransportConfig();
      if (!config) return NextResponse.json({ error: 'Email is not configured.' }, { status: 500 });

      const transporter = nodemailer.createTransport(
        config.host
          ? { connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 30_000, host: config.host, port: config.port, secure: config.secure, auth: { user: config.user, pass: config.pass } }
          : { connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 30_000, service: 'gmail', auth: { user: config.user, pass: config.pass } }
      );

      const label = doc.document_type === 'contract' ? 'Contract' : doc.paid_at ? 'Receipt' : 'Invoice';
      const logoAttachment = getLogoAttachment();
      const delivery = await transporter.sendMail({
        from: config.from,
        replyTo: process.env.SMTP_REPLY_TO || config.user,
        to: doc.client_email,
        subject: `${label}: ${doc.title}`,
        text: documentText(doc),
        html: emailHtml(doc),
        attachments: [
          ...(logoAttachment ? [logoAttachment] : []),
          {
            filename: `${sanitizeFilename(`${doc.paid_at ? 'receipt' : doc.document_type}-${doc.id}-${doc.title}`)}.pdf`,
            content: await buildDocumentPdf(doc, getCalculatedInvoice(doc)),
            contentType: 'application/pdf',
          },
        ],
      });

      if (!delivery.accepted?.length || delivery.rejected?.length) {
        return NextResponse.json({ error: 'The mail server did not accept the recipient. The document has not been marked sent.' }, { status: 502 });
      }

      const { rows } = await query(
        `UPDATE gallery_documents
         SET sent_at = CASE WHEN $2::boolean THEN sent_at ELSE NOW() END,
             receipt_sent_at = CASE WHEN $2::boolean THEN NOW() ELSE receipt_sent_at END,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [id, Boolean(doc.paid_at)]
      );
      return NextResponse.json({ document: rows[0], message: 'Document accepted by the mail server.', messageId: delivery.messageId });
    }

    return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
  } catch (error) {
    console.error('[gallery documents] PUT error', error);
    return NextResponse.json({ error: 'Unable to update this document.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  try {
    const id = normalizeId(req.nextUrl.searchParams.get('id'));
    if (!id) return NextResponse.json({ error: 'Missing document id.' }, { status: 400 });
    const { rows } = await query('DELETE FROM gallery_documents WHERE id = $1 RETURNING id', [id]);
    if (!rows[0]) return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[gallery documents] DELETE error', error);
    return NextResponse.json({ error: 'Unable to delete this document.' }, { status: 500 });
  }
}
