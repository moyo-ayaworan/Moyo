export type BillingDetails = {
  depositAmount: number;
  sessionDate: string;
  agreementScope: string;
  agreementTerms: string;
  documentTheme?: 'dark' | 'light';
};
export type DocumentPayment = {
  id: string;
  amount: number;
  receivedAt: string;
  recordedAt: string;
  reference: string;
  totalPaid: number;
  balance: number;
  bookingConfirmed: boolean;
};
export type PaymentFields = {
  amount: string | number;
  paid_at?: string | null;
  billing_details?: BillingDetails | null;
  payments?: DocumentPayment[] | null;
};
export const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
export function paymentSummary(doc: PaymentFields) {
  const total = Number(doc.amount);
  const paid = doc.payments?.length ? roundMoney(doc.payments.reduce((sum, payment) => sum + Number(payment.amount), 0)) : doc.paid_at ? total : 0;
  const deposit = Number(doc.billing_details?.depositAmount || 0);
  const balance = roundMoney(Math.max(0, total - paid));
  const confirmed = Boolean(doc.billing_details?.sessionDate && total > 0 && paid >= (deposit || total));
  return { total, paid, balance, deposit, confirmed };
}
export function normalizeBilling(input: { depositType?: unknown; depositValue?: unknown; sessionDate?: unknown; agreementScope?: unknown; agreementTerms?: unknown; addAgreement?: unknown; documentTheme?: unknown }, total: number): BillingDetails {
  if (input.depositValue != null && !['string', 'number'].includes(typeof input.depositValue)) throw new Error('Enter a valid booking deposit.');
  const raw = Number(input.depositValue || 0);
  if (!Number.isFinite(raw) || raw < 0 || !['fixed', 'percent', undefined].includes(input.depositType as string | undefined)) throw new Error('Enter a valid booking deposit.');
  if (input.depositType === 'percent' && raw > 100) throw new Error('Booking deposit cannot exceed 100%.');
  const depositAmount = roundMoney(input.depositType === 'percent' ? total * raw / 100 : raw);
  if (depositAmount > total || (raw > 0 && depositAmount === 0)) throw new Error('Booking deposit must be at least 0.01 and cannot exceed the invoice total.');
  const sessionDate = typeof input.sessionDate === 'string' ? input.sessionDate.trim() : '';
  if (sessionDate && (!/^\d{4}-\d{2}-\d{2}$/.test(sessionDate) || !Number.isFinite(Date.parse(sessionDate)) || new Date(sessionDate).toISOString().slice(0, 10) !== sessionDate)) throw new Error('Choose a valid agreed session date.');
  const agreementScope = input.addAgreement === true && typeof input.agreementScope === 'string' ? input.agreementScope.trim() : '';
  const agreementTerms = input.addAgreement === true && typeof input.agreementTerms === 'string' ? input.agreementTerms.trim() : '';
  if (input.addAgreement === true && (!agreementScope || !agreementTerms || agreementScope.length > 3000 || agreementTerms.length > 3000)) throw new Error('Add agreement scope and terms, at most 3000 characters each.');
  const documentTheme = input.documentTheme === 'light' ? 'light' : 'dark';
  return { depositAmount, sessionDate, agreementScope, agreementTerms, documentTheme };
}
export function receiptLabel(doc: PaymentFields, receipt: Pick<DocumentPayment, 'totalPaid' | 'balance'>) {
  return doc.billing_details?.depositAmount && receipt.totalPaid <= doc.billing_details.depositAmount ? 'Booking deposit' : receipt.balance > 0 ? 'Part payment' : 'Final payment';
}
export function paymentNarrative(doc: PaymentFields, currency: string, receipt?: DocumentPayment) {
  const summary = paymentSummary(doc);
  const money = (n: number) => `${currency} ${n.toLocaleString('en-GB', { maximumFractionDigits: 2 })}`;
  const lines = [`Full session total: ${money(summary.total)}`];
  if (summary.deposit) lines.push(`Booking deposit required: ${money(summary.deposit)}`);
  if (receipt) {
    lines.push(`This payment received: ${money(receipt.amount)}`, `Payment date: ${receipt.receivedAt}`, `Total received to this receipt: ${money(receipt.totalPaid)}`, `Remaining balance: ${money(receipt.balance)}`);
    if (receipt.reference) lines.push(`Payment reference: ${receipt.reference}`);
  } else {
    lines.push(`Payments received: ${money(summary.paid)}`, `Remaining balance: ${money(summary.balance)}`);
  }
  if (doc.billing_details?.sessionDate) lines.push(`Agreed session date: ${doc.billing_details.sessionDate}`);
  if (receipt ? receipt.bookingConfirmed : summary.confirmed) lines.push('BOOKING CONFIRMED: required payment received and session date agreed.');
  else lines.push(`Booking is confirmed once ${summary.deposit ? 'the required booking deposit' : 'full payment'} is received and the session date is agreed with the studio.`);
  return lines;
}
