import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE, ADMIN_SESSION_SECONDS, adminPasswordMatches, createAdminSession, requireAdmin } from '@/lib/auth';
import { rateLimit } from '@/lib/rateLimit';

export async function GET(req: NextRequest) {
  const unauthorized = requireAdmin(req);
  return unauthorized || NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, 'admin-login', 8, 900);
  if (limited) return limited;
  if (!adminPasswordMatches(req.headers.get('x-admin-key'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const response = NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });

  response.cookies.set(ADMIN_COOKIE, createAdminSession(), {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ADMIN_SESSION_SECONDS,
  });
  response.cookies.set('moyo-admin-key', '', { httpOnly: true, path: '/', maxAge: 0 });

  return response;
}
