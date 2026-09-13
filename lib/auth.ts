import { NextRequest, NextResponse } from 'next/server';

export function requireAdmin(req: NextRequest) {
  const headerKey = req.headers.get('x-admin-key');
  const cookieKey = req.cookies.get('moyo-admin-key')?.value;
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) {
    return NextResponse.json({ error: 'Admin access is not configured.' }, { status: 503 });
  }
  if (headerKey !== adminKey && cookieKey !== adminKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
