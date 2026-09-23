'use client';

export type BillingForm = { depositType: 'fixed' | 'percent'; depositValue: string; sessionDate: string; addAgreement: boolean; agreementScope: string; agreementTerms: string };
export default function BillingOptions({ value, onChange, total, currency }: { value: BillingForm; onChange: (value: Partial<BillingForm>) => void; total: number; currency: string }) {
  const input = 'mt-1 w-full min-w-0 rounded border border-white/20 bg-[#202124] px-3 py-3 text-sm text-white';
  const deposit = value.depositType === 'percent' ? Math.round(total * Number(value.depositValue || 0)) / 100 : Number(value.depositValue || 0);
  return <div className="space-y-4 rounded border border-white/15 p-3">
    <h4 className="text-sm font-semibold text-white">Booking deposit · optional</h4>
    <p className="text-xs leading-relaxed text-white/60">Leave blank for full payment. The deposit is part of the invoice total, not an additional fee.</p>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="min-w-0 text-xs text-white/75">Deposit type<select className={input} value={value.depositType} onChange={e => onChange({ depositType: e.target.value as 'fixed' | 'percent' })}><option value="fixed">Fixed amount</option><option value="percent">Percentage</option></select></label>
      <label className="min-w-0 text-xs text-white/75">Deposit {value.depositType === 'percent' ? '%' : currency}<input className={input} type="number" min="0" step="0.01" max={value.depositType === 'percent' ? 100 : total} placeholder="0" value={value.depositValue} onChange={e => onChange({ depositValue: e.target.value })} /></label>
    </div>
    {deposit > 0 && <p className="text-xs text-white/80">Deposit: {currency} {deposit.toLocaleString()} · Balance after deposit: {currency} {Math.max(0, total - deposit).toLocaleString()}</p>}
    <label className="block text-xs text-white/75">Session date already agreed with the client · optional<input className={input} type="date" value={value.sessionDate} onChange={e => onChange({ sessionDate: e.target.value })} /></label>
    <p className="text-xs leading-relaxed text-white/60">Enter a date only after agreeing it with the client and checking availability. The receipt confirms the booking only when the required payment is received and this date is set. This does not reserve a new calendar slot.</p>
    <label className="flex gap-3 text-sm text-white/85"><input type="checkbox" checked={value.addAgreement} onChange={e => onChange({ addAgreement: e.target.checked })} />Add agreement to this invoice</label>
    {value.addAgreement && <div className="space-y-3"><p className="text-xs text-white/60">Saved with the invoice and included as a separate PDF when you email it. Attaching an agreement does not record a client signature or acceptance.</p><label className="block text-xs text-white/75">Agreed scope of work<textarea className={input} rows={4} maxLength={3000} value={value.agreementScope} onChange={e => onChange({ agreementScope: e.target.value })} /></label><label className="block text-xs text-white/75">Agreement terms · delivery, cancellations, refunds & usage<textarea className={input} rows={5} maxLength={3000} value={value.agreementTerms} onChange={e => onChange({ agreementTerms: e.target.value })} /></label></div>}
  </div>;
}
