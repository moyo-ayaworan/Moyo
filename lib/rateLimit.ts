import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

/** Shared across server instances through Postgres. The proxy must set a trusted client IP header. */
export async function rateLimit(req: Request, action: string, limit: number, seconds: number) {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  // Vercel overwrites X-Forwarded-For, preventing clients from choosing this key.
  const ip = forwarded || 'unknown';
  const key = createHash('sha256').update(`${action}:${ip}`).digest('hex');
  const { rows } = await query(
    `INSERT INTO request_rate_limits (rate_key, hits, window_start)
     VALUES ($1, 1, NOW())
     ON CONFLICT (rate_key) DO UPDATE SET
       hits = CASE WHEN request_rate_limits.window_start < NOW() - ($2::int * INTERVAL '1 second') THEN 1 ELSE request_rate_limits.hits + 1 END,
       window_start = CASE WHEN request_rate_limits.window_start < NOW() - ($2::int * INTERVAL '1 second') THEN NOW() ELSE request_rate_limits.window_start END
     RETURNING hits`,
    [key, seconds]
  );
  if (Number(rows[0]?.hits) <= limit) return null;
  return NextResponse.json({ error: 'Too many requests. Please try again later.' }, {
    status: 429,
    headers: { 'Retry-After': String(seconds), 'Cache-Control': 'no-store' },
  });
}
