import { stillboundsAuth } from '@/lib/stillboundsAuth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function handle(request: Request) {
  try {
    const response = await stillboundsAuth().handler(request);
    response.headers.set('Cache-Control', 'private, no-store');
    response.headers.set('Referrer-Policy', 'no-referrer');
    return response;
  } catch {
    return Response.json({ message: 'Accounts are temporarily unavailable. Please try again later.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
export { handle as GET, handle as POST };
