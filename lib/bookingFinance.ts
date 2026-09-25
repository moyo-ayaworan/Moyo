import { getBookingPackage } from './bookingRates';
import { roundMoney } from './documentPayments';

type BookingFinancialFields = {
  service: string;
  package_id?: string | null;
  estimated_total?: string | number | null;
};

type BookingInvoice = {
  document_type: string;
  amount: string | number;
  paid_at?: string | null;
  billing_details?: { depositAmount?: number } | null;
  payments?: Array<{ amount: number }> | null;
  currency?: string | null;
  created_at?: string | null;
};

const LEGACY_SESSION_VALUES: Record<string, number> = {
  portrait: 50000,
  family: 80000,
  wedding: 400000,
};

export function getBookingFinance(booking: BookingFinancialFields, documents: BookingInvoice[] = []) {
  const invoices = documents
    .filter(document => document.document_type === 'invoice')
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  const invoice = invoices[0] || null;
  const invoiceSummary = invoice ? (() => {
    const total = Number(invoice.amount || 0);
    const paid = invoice.payments?.length ? roundMoney(invoice.payments.reduce((sum, payment) => sum + Number(payment.amount), 0)) : invoice.paid_at ? total : 0;
    return { total, paid, deposit: Number(invoice.billing_details?.depositAmount || 0), balance: roundMoney(Math.max(0, total - paid)) };
  })() : null;
  const packagePrice = getBookingPackage(booking.package_id || '')?.price;
  const savedEstimate = Number(booking.estimated_total || 0);
  const legacyValue = LEGACY_SESSION_VALUES[booking.service.toLowerCase()] || 0;
  const sessionValue = savedEstimate > 0
    ? savedEstimate
    : invoiceSummary && invoiceSummary.total > 0
      ? invoiceSummary.total
      : Number(packagePrice || legacyValue);

  return {
    sessionValue,
    invoiceTotal: invoiceSummary?.total || 0,
    depositRequired: invoiceSummary?.deposit || 0,
    paid: invoiceSummary?.paid || 0,
    balance: invoiceSummary?.balance ?? sessionValue,
    currency: invoice?.currency || 'NGN',
    hasInvoice: Boolean(invoice),
    fullyPaid: Boolean(invoiceSummary && invoiceSummary.total > 0 && invoiceSummary.balance === 0),
  };
}
