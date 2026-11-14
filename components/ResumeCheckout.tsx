'use client';
import type { SavedCheckoutQuote } from '@/lib/pricingSnapshot';
export default function ResumeCheckout({ quote, busy, onResume }: { quote: SavedCheckoutQuote; busy: boolean; onResume: () => void }) {
  const amount = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(quote.amountMinor / 100);
  return <div role="status" className="my-4 space-y-3 border border-foreground/25 p-4 text-sm">
    <p>You have an earlier checkout saved at <strong>{amount} NGN</strong>. It keeps its original price even if rates or your selected currency have changed.</p>
    <button type="button" disabled={busy} onClick={onResume} className="min-h-11 border border-current px-4 py-3 disabled:opacity-50">{busy ? 'Opening saved checkout…' : `Resume saved checkout · ${amount}`}</button>
  </div>;
}
