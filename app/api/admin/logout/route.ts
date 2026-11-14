import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE, adminRequestOriginAllowed } from '@/lib/auth';

export async function POST(req: NextRequest) {
  if (!adminRequestOriginAllowed(req)) return NextResponse.json({ error: 'Request origin rejected.' }, { status: 403 });
  const response = NextResponse.json({ success: true });

  response.cookies.set(ADMIN_COOKIE, '', {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  response.cookies.set('moyo-admin-key', '', { httpOnly: true, path: '/', maxAge: 0 });

  return response;
}
