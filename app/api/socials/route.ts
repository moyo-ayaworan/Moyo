import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

const DEFAULT_SOCIALS = [
  {
    platform: 'Instagram',
    url: 'https://www.instagram.com/moyo_ayaworan?igsh=cWJmemc0M3AxOHln&utm_source=qr',
    icon: 'instagram',
  },
  {
    platform: 'Behance',
    url: 'https://www.behance.net/moyoayaworan',
    icon: 'behance',
  },
  {
    platform: 'X',
    url: 'https://x.com/moyo_ayaworan?s=11',
    icon: 'x',
  },
  {
    platform: 'YouTube',
    url: 'https://youtube.com/@moyo_ayaworan?si=9XMRp2JopXt3oYjF',
    icon: 'youtube',
  },
];

export async function GET() {
  const { rows } = await query('SELECT * FROM social_links ORDER BY created_at DESC');
  return NextResponse.json({ socials: rows.length ? rows : DEFAULT_SOCIALS });
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin(req);
  if (unauthorized) return unauthorized;

  const body = await req.json() as Record<string, unknown>;
  const { rows } = await query(
    `INSERT INTO social_links (platform, url, icon) VALUES ($1,$2,$3) RETURNING *`,
    [
      typeof body.platform === 'string' ? body.platform : '',
      typeof body.url === 'string' ? body.url : '',
      typeof body.icon === 'string' ? body.icon : '',
    ]
  );
  return NextResponse.json({ social: rows[0] });
}

export async function PUT(req: NextRequest) {
  const unauthorized = await requireAdmin(req);
  if (unauthorized) return unauthorized;

  const body = await req.json() as Record<string, unknown>;
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const { rows } = await query(
    `UPDATE social_links SET platform=$1, url=$2, icon=$3 WHERE id=$4 RETURNING *`,
    [
      typeof updates.platform === 'string' ? updates.platform : '',
      typeof updates.url === 'string' ? updates.url : '',
      typeof updates.icon === 'string' ? updates.icon : '',
      id,
    ]
  );
  return NextResponse.json({ social: rows[0] });
}

export async function DELETE(req: NextRequest) {
  const unauthorized = await requireAdmin(req);
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  await query('DELETE FROM social_links WHERE id=$1', [id]);
  return NextResponse.json({ success: true });
}
