import PDFDocument from 'pdfkit';
import { existsSync } from 'fs';
import path from 'path';

type Document = {
  id: number; document_type: string; title: string; client_name?: string;
  client_email: string; amount: string | number; currency: string; due_date: string;
  line_items: string; terms: string; paid_at?: string | null; created_at: string;
};
type Calculation = {
  items: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
  subtotal: number; discount: number; taxRate: number; tax: number; total: number;
};

// Embed fonts rather than stripping accented names or relying on viewer-installed fonts.
const fontPath = (weight: string) => path.join(process.cwd(), 'public', 'fonts', `NotoSans-${weight}.ttf`);
const money = (value: number | string, currency: string) => `${currency || 'NGN'} ${Number(value).toLocaleString('en-GB', { maximumFractionDigits: 2 })}`;
const date = (value: string) => new Date(value).toLocaleDateString('en-GB', { timeZone: 'Africa/Lagos' });

export async function buildDocumentPdf(doc: Document, calculation: Calculation | null): Promise<Buffer> {
  const pdf = new PDFDocument({ autoFirstPage: false, size: 'LETTER', margin: 48, info: { Title: doc.title, Author: 'MOYO AYAWORAN' } });
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    pdf.on('data', (chunk: Buffer) => chunks.push(chunk));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);
  });
  pdf.registerFont('Body', fontPath('Regular'));
  pdf.registerFont('Bold', fontPath('Bold'));
  const label = doc.document_type === 'contract' ? 'CONTRACT' : doc.paid_at ? 'RECEIPT' : 'INVOICE';
  const logo = path.join(process.cwd(), 'public', 'brand', 'moyo-logo-red.png');
  const foreground = '#eeeae5';
  const accent = '#e06673';
  let y = 80;
  let page = 0;
  const font = (size: number, bold = false) => pdf.font(bold ? 'Bold' : 'Body').fontSize(size);
  const text = (value: string, x: number, top: number, size = 10, bold = false, color = foreground) => {
    font(size, bold).fillColor(color).text(value, x, top, { lineBreak: false });
  };
  const newPage = () => {
    pdf.addPage();
    page++;
    pdf.rect(0, 0, 612, 792).fill('#151618');
    pdf.rect(48, 59, 516, 3).fill('#920110');
    if (existsSync(logo)) pdf.image(logo, 48, 17, { fit: [65, 34] });
    else text('MOYO', 48, 22, 16, true, accent);
    text(label, 355, 12, 24);
    text(`MOYO-${doc.id}`, 355, 43, 8);
    text('MOYO AYAWORAN / Photography & Fine Art', 48, 753, 8);
    text(`Page ${page}`, 510, 753, 8);
    y = 80;
  };
  // Measure actual glyph widths, including long unbroken email addresses and item names.
  const wrap = (value: string, width: number, size = 10, bold = false) => {
    font(size, bold);
    return value.replace(/\\n/g, '\n').split('\n').flatMap(paragraph => {
      if (!paragraph.trim()) return [''];
      const lines: string[] = [];
      let line = '';
      for (const word of paragraph.trim().split(/\s+/)) {
        const candidate = line ? `${line} ${word}` : word;
        if (pdf.widthOfString(candidate) <= width) { line = candidate; continue; }
        if (line) lines.push(line);
        line = '';
        // Keep combining accents with their base letter when breaking a long word.
        for (const { segment } of new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(word)) {
          if (line && pdf.widthOfString(line + segment) > width) { lines.push(line); line = ''; }
          line += segment;
        }
      }
      if (line) lines.push(line);
      return lines;
    });
  };
  const ensure = (height: number) => { if (y + height > 725) newPage(); };
  const write = (value: string, size = 10, bold = false, color = foreground) => {
    for (const line of wrap(value, 516, size, bold)) {
      ensure(size + 7);
      text(line, 48, y, size, bold, color);
      y += size + 7;
    }
  };
  const heading = (value: string) => { ensure(50); write(value, 10, true, accent); };
  newPage();
  write(doc.title, 18, true);
  y += 8;
  write(`Prepared for ${doc.client_name || 'Client'}`, 10, true);
  write(doc.client_email);
  write(`Issued: ${date(doc.created_at)}`);
  if (doc.document_type === 'invoice' && !doc.paid_at) write(`Due: ${doc.due_date || 'On receipt'}`);
  y += 18;
  heading(doc.document_type === 'contract' ? 'SCOPE OF WORK' : 'SERVICES');
  if (doc.document_type === 'invoice' && calculation) {
    const header = () => {
      ['ITEM', 'QTY', 'RATE', 'AMOUNT'].forEach((name, index) => text(name, [48, 314, 360, 462][index], y, 8));
      y += 25;
    };
    ensure(65);
    header();
    for (const item of calculation.items) {
      const cells = [wrap(item.description, 250), wrap(String(item.quantity), 34, 9), wrap(money(item.unitPrice, doc.currency), 90, 9), wrap(money(item.total, doc.currency), 102, 9)];
      const lines = Math.max(...cells.map(cell => cell.length));
      if (y + Math.min(lines, 30) * 17 + 18 > 725) { newPage(); header(); }
      for (let line = 0; line < lines; line++) {
        if (y + 17 > 725) { newPage(); header(); }
        cells.forEach((cell, column) => { if (cell[line]) text(cell[line], [48, 314, 360, 462][column], y, column === 0 ? 10 : 9); });
        y += 17;
      }
      pdf.moveTo(48, y + 3).lineTo(564, y + 3).lineWidth(0.5).stroke('#303135');
      y += 18;
    }
    ensure(115);
    y += 10;
    write(`Subtotal: ${money(calculation.subtotal, doc.currency)}`);
    write(`Discount: -${money(calculation.discount, doc.currency)}`);
    write(`Tax (${calculation.taxRate}%): ${money(calculation.tax, doc.currency)}`);
  } else {
    write(doc.line_items || 'Photography services as agreed with the studio.');
  }
  y += 12;
  if (doc.document_type === 'invoice') {
    ensure(doc.paid_at ? 155 : 60);
    write(`${doc.paid_at ? 'TOTAL PAID' : 'TOTAL DUE'}: ${money(calculation?.total ?? doc.amount, doc.currency)}`, 14, true, accent);
    if (doc.paid_at) {
      y += 12;
      pdf.rect(350, y, 150, 48).lineWidth(3).stroke('#920110');
      text('PAID', 389, y + 5, 26, true, accent);
      y += 62;
      write(`Payment confirmed: ${date(doc.paid_at)}`);
      write(`Balance: ${money(0, doc.currency)}`);
    }
    write(`Payment: studio confirmation. Reference: Moyo-${doc.id}`);
    y += 14;
  }
  if (doc.terms) { heading('TERMS'); write(doc.terms); y += 14; }
  ensure(75);
  write('Thank you for creating with Moyo Ayaworan.', 10, true);
  write('Ijabiken Moyosoreoluwa');
  write('Creative Director, MOYO AYAWORAN');
  write('ijabikenm@gmail.com / +2348148192201');
  pdf.end();
  return result;
}
