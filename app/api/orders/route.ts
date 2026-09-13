import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  const { rows } = await query('SELECT * FROM orders ORDER BY created_at DESC');
  return NextResponse.json({ orders: rows });
}

export async function PUT(req: NextRequest) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  const body = await req.json().catch(() => null);
  const id = Number(body?.id);
  const status = body?.status;
  if (!Number.isInteger(id) || id <= 0 || !['pending', 'processing', 'completed', 'cancelled'].includes(status)) {
    return NextResponse.json({ error: 'A valid order id and status are required.' }, { status: 400 });
  }
  const { rows } = await query(`UPDATE orders SET status=$1 WHERE id=$2 RETURNING *`, [status, id]);
  if (!rows[0]) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  return NextResponse.json({ order: rows[0] });
}
