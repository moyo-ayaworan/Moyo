import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  const unauthorized = await requireAdmin(req);
  if (unauthorized) return unauthorized;

  const { rows } = await query(
    `SELECT list_type, COUNT(*)::int AS count
     FROM newsletter_subscribers
     WHERE status = 'active'
     GROUP BY list_type`
  );

  const totals = rows.reduce(
    (acc, row) => {
      const listType = String(row.list_type);
      const count = Number(row.count);
      if (listType === 'photography') acc.photography = count;
      if (listType === 'art') acc.art = count;
      acc.total += count;
      return acc;
    },
    { photography: 0, art: 0, total: 0 }
  );

  const recent = await query(
    `SELECT email, list_type, subscribed_at
     FROM newsletter_subscribers
     WHERE status = 'active'
     ORDER BY subscribed_at DESC
     LIMIT 12`
  );

  return NextResponse.json({
    totals,
    recent: recent.rows,
  });
}
