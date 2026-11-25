import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE, adminRequestOriginAllowed } from '@/lib/auth';
import { revokeAdminSession } from '@/lib/adminSessions';

export async function POST(req: NextRequest) {
  if (!adminRequestOriginAllowed(req)) return NextResponse.json({ error: 'Request origin rejected.' }, { status: 403 });
  try {
    const token=req.cookies.get(ADMIN_COOKIE)?.value;
    if(token)await revokeAdminSession(token);
  } catch { return NextResponse.json({error:'Could not revoke this session. Try signing out again.'},{status:503,headers:{'Cache-Control':'no-store'}}); }
  const response = NextResponse.json({ success: true },{headers:{'Cache-Control':'no-store'}});

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
