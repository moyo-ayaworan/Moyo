import { NextRequest, NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')?.trim() || '';
  if (token.length < 24) return NextResponse.json({ error: 'Invalid collector link.' }, { status: 400 });
  const { rows } = await query(`SELECT i.id, i.name, i.status, i.details, i.gallery_id, a.title, a.year, a.medium, a.dimensions FROM art_inquiries i LEFT JOIN artworks a ON a.id=i.artwork_id WHERE i.manage_token=$1 LIMIT 1`, [token]);
  const inquiry = rows[0];
  if (!inquiry) return NextResponse.json({ error: 'Collector record not found.' }, { status: 404 });
  if (inquiry.status !== 'delivered') return NextResponse.json({ error: 'The certificate becomes available after delivery.' }, { status: 403 });
  const invoice = inquiry.gallery_id ? (await query(`SELECT amount, paid_at, payments FROM gallery_documents WHERE gallery_id=$1 AND document_type='invoice' ORDER BY created_at DESC LIMIT 1`, [inquiry.gallery_id])).rows[0] : null;
  const paid = invoice?.payments?.length ? invoice.payments.reduce((sum: number, payment: { amount: number }) => sum + Number(payment.amount), 0) : invoice?.paid_at ? Number(invoice.amount) : 0;
  if (!invoice || paid < Number(invoice.amount)) return NextResponse.json({ error: 'The certificate becomes available after full payment.' }, { status: 403 });
  const details = inquiry.details || {};
  const title = inquiry.title || details.artwork || `Commission ART-${inquiry.id}`;
  const pdf = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 64 }); const chunks: Buffer[] = [];
    doc.on('data', chunk => chunks.push(chunk)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
    doc.rect(28, 28, 539, 786).lineWidth(1).stroke('#9b111e');
    doc.fillColor('#9b111e').font('Times-Italic').fontSize(32).text('Certificate of Authenticity', { align: 'center' });
    doc.moveDown(1.5).fillColor('#222222').font('Helvetica').fontSize(11).text('MOYO AYAWORAN · ORIGINAL WORK / ARTIST-AUTHORISED EDITION', { align: 'center', characterSpacing: 1.4 });
    doc.moveDown(3).font('Times-Italic').fontSize(26).text(title, { align: 'center' });
    doc.moveDown(1.5).font('Helvetica').fontSize(12).text(`Certificate reference: ART-${inquiry.id}`, { align: 'center' });
    doc.moveDown(2).text(`Collector: ${inquiry.name}`); doc.text(`Year: ${inquiry.year || new Date().getFullYear()}`); doc.text(`Medium: ${inquiry.medium || details.medium || 'As commissioned'}`); doc.text(`Dimensions: ${inquiry.dimensions || details.size || 'As commissioned'}`);
    doc.moveDown(2).fontSize(11).fillColor('#555555').text('This document certifies that the work described above was created or authorised by Moyo Ayaworan and recorded by the studio under the reference shown. Ownership of the physical work does not transfer copyright or reproduction rights unless separately agreed in writing.', { lineGap: 6 });
    doc.moveDown(4).fillColor('#222222').text('Ijabiken Moyosoreoluwa', { align: 'right' }); doc.text('Creative Director, MOYO AYAWORAN', { align: 'right' });
    doc.end();
  });
  return new NextResponse(new Uint8Array(pdf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="Moyo-ART-${inquiry.id}-certificate.pdf"`, 'Cache-Control': 'private, no-store' } });
}
