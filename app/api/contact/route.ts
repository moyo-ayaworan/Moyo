import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

const DEFAULT_CONTACT = {
  id: 1,
  phone: '+2348148192201',
  email: 'moyoayaworan@gmail.com',
  address: '',
};

async function getContact() {
  const { rows } = await query('SELECT * FROM contact WHERE id=1');
  return {
    ...DEFAULT_CONTACT,
    ...rows[0],
    phone: rows[0]?.phone || DEFAULT_CONTACT.phone,
    email: rows[0]?.email || DEFAULT_CONTACT.email,
  };
}

export async function GET() {
  const contact = await getContact();
  return NextResponse.json({ contact });
}

export async function PUT(req: NextRequest) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  const body = await req.json() as Record<string, unknown>;
  const { rows } = await query(
    `UPDATE contact SET phone=$1, email=$2, address=$3 WHERE id=1 RETURNING *`,
    [
      typeof body.phone === 'string' ? body.phone : DEFAULT_CONTACT.phone,
      typeof body.email === 'string' ? body.email : DEFAULT_CONTACT.email,
      typeof body.address === 'string' ? body.address : '',
    ]
  );
  return NextResponse.json({ contact: rows[0] });
}
