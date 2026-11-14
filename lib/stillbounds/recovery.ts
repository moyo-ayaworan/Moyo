import { query } from '../db';
import { billingService } from './billing-service';
export async function recoverStillboundsPayments(deadline: number) {
  const service = billingService();
  if (!service.config.enabled || !service.config.checkoutEnabled) return { checked: 0, failed: 0 };
  const { rows } = await query(`SELECT o.reference FROM stillbounds_license_orders o
    LEFT JOIN operations_checks c ON c.reference=o.reference
    WHERE o.mode=$1 AND o.status IN ('pending','failed')
    ORDER BY COALESCE(c.checked_at,o.created_at) ASC LIMIT 30`, [service.config.mode]);
  let checked = 0, failed = 0;
  for (const row of rows) {
    if (Date.now() >= deadline) break;
    try {
      const payment = await service.provider('/transaction/verify/' + encodeURIComponent(row.reference));
      if (payment.status === 'success') await service.store.fulfill(service.config.mode, row.reference, payment);
      checked++;
    } catch { failed++; }
    await query('INSERT INTO operations_checks(reference,checked_at) VALUES($1,NOW()) ON CONFLICT(reference) DO UPDATE SET checked_at=EXCLUDED.checked_at', [row.reference]);
  }
  return { checked, failed };
}
