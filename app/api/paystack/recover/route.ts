import { after, NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { isPaymentEmail } from '@/lib/payments/policy';
import { rateLimit } from '@/lib/rateLimit';
import { transaction } from '@/lib/db';
import { requestBody, requirePaymentOrigin, paymentFailure, privateHeaders } from '@/lib/payments/server';
import { deliverPaymentNotifications } from '@/lib/payments/notifications';
export async function POST(req: NextRequest) {
  try {
    requirePaymentOrigin(req);
    const limited = await rateLimit(req, 'purchase-recovery-email', 3, 3600); if (limited) return limited;
    const body = await requestBody(req), email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (isPaymentEmail(email)) await transaction(async c => {
      const lock = createHash('sha256').update(email).digest('hex');
      await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['recovery:' + lock]);
      // An email can receive at most one recovery batch per hour, even across many IPs.
      const recent = (await c.query('SELECT 1 FROM payment_recovery_requests WHERE email_hash=$1 AND requested_at>NOW()-INTERVAL \'1 hour\'', [lock])).rows[0];
      if (recent) return;
      await c.query('INSERT INTO payment_recovery_requests(email_hash) VALUES($1) ON CONFLICT(email_hash) DO UPDATE SET requested_at=NOW()', [lock]);
      await c.query(`INSERT INTO payment_notifications(reference) SELECT reference FROM payment_orders WHERE email=$1 AND kind='digital' AND status='paid'
        ORDER BY created_at DESC LIMIT 10 ON CONFLICT(reference) DO UPDATE SET sent_at=NULL,claimed_at=NULL`, [email]);
    });
    after(() => deliverPaymentNotifications());
    return NextResponse.json({ message: 'If this email has a paid purchase, a recovery link will be sent. Check your inbox and spam folder.' }, { headers: privateHeaders });
  } catch (error) { return paymentFailure(error); }
}
