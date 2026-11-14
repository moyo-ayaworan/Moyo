import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { query } from '@/lib/db';
import { verifyOrder, payments, privateHeaders } from '@/lib/payments/server';
import { deliverPaymentNotifications } from '@/lib/payments/notifications';
import type { PaymentOrder } from '@/lib/payments/policy';
export const runtime = 'nodejs';
export const maxDuration = 300;
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : '';
  const actual = req.headers.get('authorization') || '';
  const cron = !!expected && Buffer.byteLength(expected) === Buffer.byteLength(actual) && timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
  if (!cron) { const unauthorized = requireAdmin(req, true); if (unauthorized) return unauthorized; }
  // Keep unresolved orders eligible until reconciled; paid audits have their own quota.
  const deadline = Date.now() + 120000;
  let checked = 0, failed = 0;
  try {
    const pending = await query("SELECT * FROM payment_orders WHERE status IN ('pending','failed') ORDER BY updated_at ASC LIMIT 100");
    const paid = await query("SELECT * FROM payment_orders WHERE status='paid' ORDER BY updated_at ASC LIMIT 10");
    const rows = [...pending.rows, ...paid.rows] as PaymentOrder[];
    // Bounded concurrency prevents slow provider calls from reducing this to two/day.
    for (let index = 0; index < rows.length && Date.now() < deadline; index += 5) {
      await Promise.all(rows.slice(index, index + 5).map(async order => {
        try { await verifyOrder(order, true); checked++; } catch { failed++; }
        await payments.transact(c => c.query('UPDATE payment_orders SET updated_at=NOW() WHERE reference=$1', [order.reference]));
      }));
    }
    if (process.env.STILLBOUNDS_LICENSING_ENABLED === 'true') {
      const { recoverStillboundsPayments } = await import('@/lib/stillbounds/recovery');
      const recovery = await recoverStillboundsPayments(Date.now() + 70000);
      checked += recovery.checked; failed += recovery.failed;
    }
    await deliverPaymentNotifications({ limit: 100, deadline: Date.now() + 40000 });
    const backlog = await query("SELECT COUNT(*)::int AS pending FROM payment_notifications WHERE sent_at IS NULL");
    await query(`INSERT INTO operations_runs(name,completed_at,failed) VALUES ('payments',NOW(),$1)
      ON CONFLICT(name) DO UPDATE SET completed_at=EXCLUDED.completed_at,failed=EXCLUDED.failed`, [failed]);
    console.info(JSON.stringify({ event: 'payment_maintenance', checked, failed, pendingNotifications: backlog.rows[0]?.pending || 0 }));
    return NextResponse.json({ checked, failed, pendingNotifications: backlog.rows[0]?.pending || 0 }, { status: failed ? 503 : 200, headers: privateHeaders });
  } catch {
    console.error(JSON.stringify({ event: 'payment_maintenance_failed', checked, failed }));
    return NextResponse.json({ error: 'Payment maintenance needs retry.', checked, failed }, { status: 503, headers: privateHeaders });
  }
}
