import { stillboundsAuth } from '@/lib/stillboundsAuth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function handle(request: Request) {
  try {
    const response = await stillboundsAuth().handler(request);
    response.headers.set('Cache-Control', 'private, no-store');
    response.headers.set('Referrer-Policy', 'no-referrer');
    const url = new URL(request.url);
    // Installed betas pin this origin and path before opening the browser.
    // The browser then follows the existing redirect to the current account page.
    if (request.method === 'POST' && response.ok &&
        url.origin === 'https://moyo-roan.vercel.app' &&
        url.pathname === '/api/stillbounds/auth/device/code') {
      const data = await response.json();
      const verification = new URL('/mofolio/account', url.origin);
      const complete = new URL(verification);
      complete.searchParams.set('user_code', data.user_code);
      const headers = new Headers(response.headers);
      headers.delete('Content-Length');
      return Response.json({
        ...data,
        verification_uri: verification.href,
        verification_uri_complete: complete.href,
      }, { status: response.status, headers });
    }
    return response;
  } catch {
    return Response.json({ message: 'Accounts are temporarily unavailable. Please try again later.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
export { handle as GET, handle as POST };
