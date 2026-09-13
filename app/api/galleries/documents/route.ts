import { NextRequest, NextResponse } from 'next/server';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { inflateSync } from 'zlib';
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
const BRAND_RED_RGB = '0.572 0.004 0.063';
const LOGO_PATH = path.join(process.cwd(), 'public', 'brand', 'moyo-logo-red.png');
const PDF_LOGO_BACKGROUND = { r: 21, g: 22, b: 24 };
let cachedPdfLogo: { width: number; height: number; hex: string } | null | undefined;

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
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return normalize(value);
}

function normalizeType(value: unknown) {
  return normalize(value).toLowerCase() === 'contract' ? 'contract' : 'invoice';
}

function normalizeCurrency(value: unknown) {
  const currency = normalize(value).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5);
  return currency || 'NGN';
}

function parseAmount(value: unknown) {
  if (value === '' || value === null || value === undefined) return 0;
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
  const label = doc.document_type === 'contract' ? 'Contract' : 'Invoice';
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
    'Ijabiken Moyo',
    label,
    '',
    doc.title,
    `Client: ${doc.client_name || 'Client'}`,
    `Email: ${doc.client_email}`,
    amount ? `Amount: ${amount}` : '',
    doc.due_date ? `Due date: ${doc.due_date}` : '',
    '',
    itemText,
    '',
    doc.terms || 'Contract terms, usage rights, payment, and delivery notes to be confirmed.',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

function wrapText(text: string, max = 82) {
  return text.split('\n').flatMap((line) => {
    if (!line) return [''];
    const words = line.split(/\s+/);
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      if (word.length > max) {
        if (current) {
          lines.push(current);
          current = '';
        }
        for (let index = 0; index < word.length; index += max) {
          lines.push(word.slice(index, index + max));
        }
        continue;
      }
      if (`${current} ${word}`.trim().length > max) {
        if (current) lines.push(current);
        current = word;
      } else {
        current = `${current} ${word}`.trim();
      }
    }
    if (current) lines.push(current);
    return lines;
  });
}

function pdfEscape(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function pdfSafe(value: string) {
  return value
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/×/g, 'x')
    .replace(/₦/g, 'NGN ')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '');
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

function paethPredictor(left: number, up: number, upperLeft: number) {
  const estimate = left + up - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) return left;
  if (upDistance <= upperLeftDistance) return up;
  return upperLeft;
}

function getPdfLogo() {
  if (cachedPdfLogo !== undefined) return cachedPdfLogo;
  cachedPdfLogo = null;
  if (!existsSync(LOGO_PATH)) return cachedPdfLogo;

  try {
    const source = readFileSync(LOGO_PATH);
    let offset = 8;
    let width = 0;
    let height = 0;
    const chunks: Buffer[] = [];
    while (offset < source.length) {
      const length = source.readUInt32BE(offset);
      const type = source.toString('ascii', offset + 4, offset + 8);
      const data = source.subarray(offset + 8, offset + 8 + length);
      if (type === 'IHDR') {
        width = data.readUInt32BE(0);
        height = data.readUInt32BE(4);
      }
      if (type === 'IDAT') chunks.push(data);
      if (type === 'IEND') break;
      offset += length + 12;
    }
    if (!width || !height || chunks.length === 0) return cachedPdfLogo;

    const inflated = inflateSync(Buffer.concat(chunks));
    const stride = width * 4;
    const rows: Buffer[] = [];
    let index = 0;
    let previous = Buffer.alloc(stride);
    for (let y = 0; y < height; y += 1) {
      const filter = inflated[index];
      index += 1;
      const row = Buffer.alloc(stride);
      for (let x = 0; x < stride; x += 1) {
        const left = x >= 4 ? row[x - 4] : 0;
        const up = previous[x];
        const upperLeft = x >= 4 ? previous[x - 4] : 0;
        let value = inflated[index];
        index += 1;
        if (filter === 1) value = (value + left) & 255;
        if (filter === 2) value = (value + up) & 255;
        if (filter === 3) value = (value + Math.floor((left + up) / 2)) & 255;
        if (filter === 4) value = (value + paethPredictor(left, up, upperLeft)) & 255;
        row[x] = value;
      }
      rows.push(row);
      previous = row;
    }

    const outputWidth = 140;
    const outputHeight = Math.max(1, Math.round((height / width) * outputWidth));
    const rgb = Buffer.alloc(outputWidth * outputHeight * 3);
    for (let y = 0; y < outputHeight; y += 1) {
      const sourceY = Math.min(height - 1, Math.floor((y / outputHeight) * height));
      const row = rows[sourceY];
      for (let x = 0; x < outputWidth; x += 1) {
        const sourceX = Math.min(width - 1, Math.floor((x / outputWidth) * width));
        const sourceIndex = sourceX * 4;
        const alpha = row[sourceIndex + 3] / 255;
        const targetIndex = (y * outputWidth + x) * 3;
        rgb[targetIndex] = Math.round(row[sourceIndex] * alpha + PDF_LOGO_BACKGROUND.r * (1 - alpha));
        rgb[targetIndex + 1] = Math.round(row[sourceIndex + 1] * alpha + PDF_LOGO_BACKGROUND.g * (1 - alpha));
        rgb[targetIndex + 2] = Math.round(row[sourceIndex + 2] * alpha + PDF_LOGO_BACKGROUND.b * (1 - alpha));
      }
    }
    cachedPdfLogo = { width: outputWidth, height: outputHeight, hex: rgb.toString('hex').toUpperCase() };
  } catch {
    cachedPdfLogo = null;
  }
  return cachedPdfLogo;
}

function buildPdf(doc: GalleryDocument) {
  const calculation = getCalculatedInvoice(doc);
  const label = doc.document_type === 'contract' ? 'CONTRACT' : 'INVOICE';
  const logo = getPdfLogo();
  const pages: string[][] = [];
  let commands: string[] = [];
  let y = 0;
  const text = (value: string, x: number, at: number, size = 10, bold = false, color = '0.93 0.92 0.90') => {
    commands.push(`BT ${color} rg /${bold ? 'F2' : 'F1'} ${size} Tf ${x} ${at} Td (${pdfEscape(pdfSafe(value))}) Tj ET`);
  };
  const newPage = () => {
    commands = [];
    pages.push(commands);
    commands.push('0.0824 0.0863 0.0941 rg 0 0 612 792 re f');
    commands.push(`${BRAND_RED_RGB} rg 48 740 516 3 re f`);
    if (logo) commands.push('q', `65 0 0 ${Math.round(logo.height / logo.width * 65)} 48 752 cm`, '/Logo Do', 'Q');
    else text('MOYO', 48, 758, 16, true, BRAND_RED_RGB);
    text(label, 355, 763, 26);
    text(`MOYO-${doc.id}`, 355, 749, 8);
    text('Ijabiken Moyo / Photography & Fine Art', 48, 35, 8);
    text(`Page ${pages.length}`, 510, 35, 8);
    y = 712;
  };
  const write = (value: string, options: { bold?: boolean; size?: number; color?: string; width?: number } = {}) => {
    for (const line of wrapText(pdfSafe(value), options.width || 78)) {
      if (y < 65) newPage();
      text(line, 48, y, options.size || 10, options.bold, options.color);
      y -= (options.size || 10) + 5;
    }
  };
  newPage();
  write(doc.title, { size: 18, bold: true, width: 44 });
  y -= 8;
  write(`Prepared for ${doc.client_name || 'Client'}`, { bold: true });
  write(doc.client_email);
  write(`Issued: ${new Date(doc.created_at || Date.now()).toLocaleDateString('en-GB')}    Due: ${doc.due_date || 'On receipt'}`);
  y -= 18;
  write(label === 'INVOICE' ? 'SERVICES' : 'SCOPE OF WORK', { bold: true, color: '0.88 0.40 0.45' });
  if (calculation) {
    const tableHeader = () => {
      text('ITEM', 48, y, 8);
      text('QTY', 320, y, 8);
      text('RATE', 365, y, 8);
      text('AMOUNT', 465, y, 8);
      y -= 10;
      commands.push(`0.20 0.20 0.22 RG 0.5 w 48 ${y} m 564 ${y} l S`);
      y -= 18;
    };
    tableHeader();
    calculation.items.forEach((item) => {
      const description = wrapText(pdfSafe(item.description), 42);
      const rate = wrapText(pdfSafe(formatMoneyWithZero(item.unitPrice, doc.currency)), 17);
      const total = wrapText(pdfSafe(formatMoneyWithZero(item.total, doc.currency)), 17);
      const quantity = wrapText(String(item.quantity), 7);
      const rowLines = Math.max(description.length, rate.length, total.length, quantity.length);
      if (y - Math.min(rowLines, 35) * 15 < 75) { newPage(); tableHeader(); }
      for (let line = 0; line < rowLines; line += 1) {
        if (y < 75) { newPage(); tableHeader(); }
        if (description[line]) text(description[line], 48, y, 10);
        if (quantity[line]) text(quantity[line], 320, y, 9);
        if (rate[line]) text(rate[line], 365, y, 9);
        if (total[line]) text(total[line], 465, y, 9);
        y -= 15;
      }
      y -= 8;
      commands.push(`0.20 0.20 0.22 RG 0.5 w 48 ${y} m 564 ${y} l S`);
      y -= 18;
    });
    y -= 16;
    write(`Subtotal: ${formatMoneyWithZero(calculation.subtotal, doc.currency)}`);
    write(`Discount: -${formatMoneyWithZero(calculation.discount, doc.currency)}`);
    write(`Tax (${calculation.taxRate}%): ${formatMoneyWithZero(calculation.tax, doc.currency)}`);
  } else {
    write(doc.line_items || 'Photography services as agreed with the studio.');
  }
  y -= 12;
  if (label === 'INVOICE') {
    write(`TOTAL DUE: ${formatMoneyWithZero(calculation?.total ?? doc.amount, doc.currency)}`, { bold: true, size: 14, color: '0.88 0.40 0.45', width: 55 });
    write(`Payment: bank transfer / studio confirmation. Reference: Moyo-${doc.id}`);
    y -= 14;
  }
  if (doc.terms) {
    write('TERMS', { bold: true, color: '0.88 0.40 0.45' });
    write(doc.terms);
    y -= 14;
  }
  write('Thank you for creating with Moyo.', { bold: true });
  write('ijabikenm@gmail.com / +2348148192201');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>', '',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
  ];
  if (logo) objects.push(`<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /ASCIIHexDecode /Length ${logo.hex.length + 1} >>\nstream\n${logo.hex}>\nendstream`);
  const pageIds: number[] = [];
  for (const page of pages) {
    const pageId = objects.length + 1;
    pageIds.push(pageId);
    const content = page.join('\n');
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> ${logo ? '/XObject << /Logo 5 0 R >>' : ''} >> /Contents ${pageId + 1} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`);
  }
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, '0')} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf);
}

function emailHtml(doc: GalleryDocument) {
  const calculation = getCalculatedInvoice(doc);
  const amount = formatMoney(calculation?.total ?? doc.amount, doc.currency);
  const label = doc.document_type === 'contract' ? 'Contract' : 'Invoice';
  const detailLabel = doc.document_type === 'contract' ? 'Agreement' : 'Service';
  const emailItems = calculation
    ? calculation.items
    : getDocumentLines(doc).map((item, index) => ({
        description: item,
        quantity: index === 0 ? 1 : 0,
        unitPrice: index === 0 ? Number(doc.amount || 0) : 0,
        total: index === 0 ? Number(doc.amount || 0) : 0,
      }));
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
                        <strong style="color:#eeeae5;">Ijabiken Moyo</strong><br/>
                        Photography & Fine Art<br/>
                        ijabikenm@gmail.com
                      </td>
                    </tr>
                  </table>

                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;table-layout:fixed;">
                    <thead>
                      <tr>
                        <th width="40%" align="left" style="padding:0 12px 12px 0;color:#a5a5ab;font-size:10px;line-height:1.3;letter-spacing:2px;text-transform:uppercase;">Description</th>
                        <th width="10%" align="center" style="padding:0 8px 12px;color:#a5a5ab;font-size:10px;line-height:1.3;letter-spacing:2px;text-transform:uppercase;">Qty</th>
                        <th width="25%" align="right" style="padding:0 8px 12px;color:#a5a5ab;font-size:10px;letter-spacing:2px;text-transform:uppercase;">Rate</th>
                        <th width="25%" align="right" style="padding:0 0 12px 12px;color:#a5a5ab;font-size:10px;line-height:1.3;letter-spacing:2px;text-transform:uppercase;">Amount</th>
                      </tr>
                    </thead>
                    <tbody>${itemRows}${summaryRows}</tbody>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding:28px 24px 34px;background:#151618;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;border-top:1px solid #303135;border-bottom:1px solid #303135;">
                    <tr>
                      <td valign="top" width="39%" style="padding:18px 12px 18px 0;">
                        <p style="margin:0 0 10px;color:#a5a5ab;font-size:10px;line-height:1.3;letter-spacing:2px;text-transform:uppercase;">Payment info</p>
                        <p style="margin:0;color:#eeeae5;font-size:12px;line-height:1.6;">Bank transfer / studio confirmation<br/>Reference: Moyo-${doc.id}</p>
                      </td>
                      <td valign="top" width="25%" style="padding:18px 12px;">
                        <p style="margin:0 0 10px;color:#a5a5ab;font-size:10px;line-height:1.3;letter-spacing:2px;text-transform:uppercase;">Due by</p>
                        <p style="margin:0;color:#eeeae5;font-size:14px;line-height:1.4;">${escapeHtml(doc.due_date || 'On receipt')}</p>
                      </td>
                      <td valign="top" width="36%" align="right" style="padding:18px 0 18px 12px;">
                        <p style="margin:0 0 10px;color:#a5a5ab;font-size:10px;line-height:1.3;letter-spacing:2px;text-transform:uppercase;">Total due</p>
                        <p style="margin:0;color:#e06673;font-size:20px;line-height:1.25;font-weight:700;">${escapeHtml(amount || 'To be confirmed')}</p>
                      </td>
                    </tr>
                  </table>
                  ${doc.terms ? `<div style="margin:22px 0 0;padding:16px 0 0;border-top:1px solid #303135;"><p style="margin:0 0 8px;color:#a5a5ab;font-size:10px;line-height:1.3;letter-spacing:2px;text-transform:uppercase;">${label === 'Invoice' ? 'Contract / Terms' : 'Terms'}</p><p style="margin:0;color:#a5a5ab;font-size:12px;line-height:1.7;white-space:pre-line;">${escapeHtml(doc.terms)}</p></div>` : ''}
                  <p style="margin:26px 0 0;color:#eeeae5;font-size:13px;line-height:1.6;">Thank you! A PDF copy is attached.</p>
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
    const doc = await getDocument(id);
    if (!doc) return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
    if (token) {
      const { rows } = await query(
        `SELECT id
         FROM bookings
         WHERE manage_token = $1
           AND gallery_id = $2
         LIMIT 1`,
        [token, doc.gallery_id]
      );
      if (!rows[0]) return NextResponse.json({ error: 'Document not available for this booking.' }, { status: 403 });
    } else {
      const unauthorized = requireAdmin(req);
      if (unauthorized) return unauthorized;
    }
    const pdf = buildPdf(doc);
    return new NextResponse(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `attachment; filename="${sanitizeFilename(`${doc.document_type}-${doc.id}-${doc.title}`)}.pdf"`,
      },
    });
  }

  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  const galleryId = req.nextUrl.searchParams.get('galleryId');
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
  return NextResponse.json({ documents: rows });
}

export async function POST(req: NextRequest) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Invalid document request.' }, { status: 400 });
    const action = normalize(body.action);
    const galleryId = Number(body.galleryId);
    const documentType = normalizeType(body.documentType);
    const title =
      truncate(normalize(body.title), 140) ||
      (documentType === 'contract' ? 'Photography Contract' : 'Photography Invoice');
    const clientEmail = normalize(body.clientEmail).toLowerCase();
    const amount = parseAmount(body.amount);
    const currency = normalizeCurrency(body.currency);
    const dueDate = normalize(body.dueDate);
    const lineItems = truncate(normalize(body.lineItems), 3000);
    const terms = truncate(normalize(body.terms), 3000);
    const rawItems = body.items || body.invoiceItems;
    if (documentType === 'invoice' && action !== 'generate') {
      if (!Array.isArray(rawItems) || rawItems.length === 0 || rawItems.length > 20 || rawItems.some((item) =>
        !item || typeof item !== 'object' || !normalize(item.description) ||
        normalize(item.description).length > 220 || !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0 ||
        !Number.isFinite(Number(item.unitPrice)) || Number(item.unitPrice) < 0 || item.unitPrice === ''
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

    if (!Number.isInteger(galleryId) || galleryId <= 0) {
      return NextResponse.json({ error: 'Choose a gallery.' }, { status: 400 });
    }
    if (!Number.isFinite(storedAmount) || storedAmount < 0) {
      return NextResponse.json({ error: 'Enter a valid amount.' }, { status: 400 });
    }
    if (documentType === 'invoice' && action !== 'generate') {
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

    const { rows } = await query(
      `INSERT INTO gallery_documents (
        gallery_id, document_type, title, client_email, amount, currency, due_date, line_items, terms
      )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [galleryId, documentType, title, clientEmail, storedAmount, currency, dueDate, storedLineItems, terms]
    );

    return NextResponse.json({ document: rows[0] });
  } catch (error) {
    console.error('[gallery documents] POST error', error);
    return NextResponse.json({ error: 'Unable to save this document.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json();
    const id = normalizeId(body.id);
    const action = normalize(body.action);
    if (!id) return NextResponse.json({ error: 'Missing document id.' }, { status: 400 });

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

      const label = doc.document_type === 'contract' ? 'Contract' : 'Invoice';
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
            filename: `${sanitizeFilename(`${doc.document_type}-${doc.id}-${doc.title}`)}.pdf`,
            content: buildPdf(doc),
            contentType: 'application/pdf',
          },
        ],
      });

      if (!delivery.accepted?.length) {
        return NextResponse.json({ error: 'The mail server did not accept the recipient. The document has not been marked sent.' }, { status: 502 });
      }

      const { rows } = await query(
        `UPDATE gallery_documents
         SET sent_at = NOW(), updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [id]
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
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing document id.' }, { status: 400 });
    await query('DELETE FROM gallery_documents WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[gallery documents] DELETE error', error);
    return NextResponse.json({ error: 'Unable to delete this document.' }, { status: 500 });
  }
}
