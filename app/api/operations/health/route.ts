import { timingSafeEqual } from 'node:crypto';
import { query } from '@/lib/db';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function handle(request: Request) {
  const expected = process.env.OPERATIONS_MONITOR_SECRET ? `Bearer ${process.env.OPERATIONS_MONITOR_SECRET}` : '';
  const actual = request.headers.get('authorization') || '';
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!expected || Buffer.byteLength(expected) !== Buffer.byteLength(actual) || !timingSafeEqual(Buffer.from(expected), Buffer.from(actual)))
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
  try {
    await query('SELECT 1');
    if (request.method === 'POST') await query("INSERT INTO operations_runs(name,completed_at,failed) VALUES('external-monitor',NOW(),0) ON CONFLICT(name) DO UPDATE SET completed_at=EXCLUDED.completed_at,failed=0");
    return Response.json({ healthy: true }, { headers });
  } catch {
    console.error(JSON.stringify({ event: 'database_health_failed' }));
    return Response.json({ healthy: false }, { status: 503, headers });
  }
}
export { handle as GET, handle as POST };
