import { NextResponse, type NextRequest } from 'next/server';
import { ADMIN_COOKIE, hasAdminSession } from '@/lib/auth';

const adminLoginPath = '/admin/login';

function isPublicAdminPath(pathname: string) {
  return pathname === adminLoginPath;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith('/admin') || isPublicAdminPath(pathname)) {
    return NextResponse.next();
  }

  if (hasAdminSession(request.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = adminLoginPath;
  loginUrl.searchParams.set('next', pathname);
  const response = NextResponse.redirect(loginUrl);
  if (request.cookies.has('moyo-admin-key')) {
    response.cookies.set('moyo-admin-key', '', { httpOnly: true, path: '/', maxAge: 0 });
  }
  return response;
}

export const config = {
  matcher: ['/admin/:path*'],
};
