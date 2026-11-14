import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { query } from '@/lib/db';
export async function GET(req: NextRequest) {
  const unauthorized = requireAdmin(req); if (unauthorized) return unauthorized;
  const { rows } = await query(`SELECT reference,mode,kind,target_id,email,amount_kobo,currency,title,status,provider_id,paid_at,created_at,updated_at FROM payment_orders ORDER BY created_at DESC LIMIT 200`);
  const licensing = await query(`SELECT reference,mode,'stillbounds' AS kind,user_id AS target_id,email,amount AS amount_kobo,currency,'Stillbounds' AS title,status,provider_id,paid_at,created_at FROM stillbounds_license_orders ORDER BY created_at DESC LIMIT 200`);
  const notifications = await query('SELECT COUNT(*)::int AS pending FROM payment_notifications WHERE sent_at IS NULL');
  return NextResponse.json({ orders: [...rows, ...licensing.rows].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), pendingNotifications: notifications.rows[0].pending }, { headers: { 'Cache-Control': 'private, no-store' } });
}
