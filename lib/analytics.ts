import { createHmac, randomUUID } from 'node:crypto';
import { query } from '@/lib/db';
import { analyticsDevice, excludedAnalytics, referrerHost } from './analyticsPolicy';
export const analyticsSchema = `CREATE TABLE IF NOT EXISTS site_analytics (
 id UUID PRIMARY KEY, happened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), day DATE NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')::date,
 kind TEXT NOT NULL CHECK(kind IN ('pageview','download')), path TEXT NOT NULL, visitor TEXT NOT NULL,
 country TEXT NOT NULL, device TEXT NOT NULL, referrer TEXT NOT NULL, detail TEXT NOT NULL DEFAULT ''
); CREATE INDEX IF NOT EXISTS site_analytics_time ON site_analytics(happened_at);`;
let ready: Promise<unknown> | undefined;
export async function ensureAnalytics() { return ready ??= query(analyticsSchema).catch(e => { ready = undefined; throw e; }); }
export async function recordAnalytics(req: Request, kind: 'pageview'|'download', path: string, options: {id?:string;referrer?:string;detail?:string} = {}) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || excludedAnalytics(req.headers)) return;
  await ensureAnalytics();
  const day = new Date().toISOString().slice(0,10);
  const visitor = createHmac('sha256', secret).update(`${day}:${req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'}:${req.headers.get('user-agent') || ''}`).digest('hex');
  const geo = process.env.VERCEL === '1' ? req.headers.get('x-vercel-ip-country') || '' : '';
  const country = /^[A-Z]{2}$/.test(geo) ? geo : 'Unknown';
  const host = referrerHost(options.referrer);
  await query(`INSERT INTO site_analytics(id,kind,path,visitor,country,device,referrer,detail) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO NOTHING`,[options.id || randomUUID(),kind,path,visitor,country,analyticsDevice(req.headers.get('user-agent') || ''),host === new URL(req.url).hostname ? 'Internal' : host || 'Direct / unknown',options.detail || '']);
  // Retention is enforced by the daily cleanup and before dashboard queries.
}
export async function analyticsReport(days: number, period = String(days)) {
  await ensureAnalytics();
  await query(`DELETE FROM site_analytics WHERE happened_at < NOW() - INTERVAL '90 days'`);
  const since = `((NOW() AT TIME ZONE 'UTC')::date - ($1::int - 1)) AT TIME ZONE 'UTC'`;
  const results = await Promise.all([
    query(`SELECT COUNT(*) FILTER(WHERE kind='pageview')::int views, COUNT(DISTINCT visitor) FILTER(WHERE kind='pageview')::int visitors, COUNT(*) FILTER(WHERE kind='download')::int downloads, COUNT(DISTINCT visitor) FILTER(WHERE kind='download')::int download_visitors, MIN(happened_at) first_event FROM site_analytics WHERE happened_at >= ${since}`,[days]),
    query(`SELECT day::text AS "day",COUNT(*) FILTER(WHERE kind='pageview')::int views,COUNT(DISTINCT visitor) FILTER(WHERE kind='pageview')::int visitors,COUNT(*) FILTER(WHERE kind='download')::int downloads FROM site_analytics WHERE happened_at >= ${since} GROUP BY day ORDER BY day`,[days]),
    ...['country','path','referrer','device'].map(column => query(`SELECT ${column} label, COUNT(*)::int views,COUNT(DISTINCT visitor)::int visitors FROM site_analytics WHERE kind='pageview' AND happened_at >= ${since} GROUP BY ${column} ORDER BY views DESC LIMIT 12`,[days])),
    query(`SELECT detail label,COUNT(*)::int total FROM site_analytics WHERE kind='download' AND happened_at >= ${since} GROUP BY detail ORDER BY total DESC`,[days]),
    query(`SELECT COUNT(*) FILTER(WHERE status='paid')::int purchases,COUNT(DISTINCT LOWER(email)) FILTER(WHERE status='paid')::int buyers,COALESCE(SUM(amount_kobo) FILTER(WHERE status='paid'),0)::text revenue,COUNT(*) FILTER(WHERE status='pending')::int pending,COUNT(*) FILTER(WHERE status='refunded')::int refunded,COUNT(*) FILTER(WHERE status='disputed')::int disputed FROM payment_orders WHERE kind='digital' AND mode='live' AND COALESCE(paid_at,created_at) >= ${since}`,[days]),
    query(`SELECT target_id, title label,shop_section section,COUNT(*)::int purchases,SUM(amount_kobo)::text revenue FROM payment_orders WHERE kind='digital' AND mode='live' AND status='paid' AND COALESCE(paid_at,created_at) >= ${since} GROUP BY target_id,title,shop_section ORDER BY SUM(amount_kobo) DESC LIMIT 20`,[days]),
    query(`SELECT (COALESCE(paid_at,created_at) AT TIME ZONE 'UTC')::date::text AS "day",COUNT(*)::int purchases,SUM(amount_kobo)::text revenue FROM payment_orders WHERE kind='digital' AND mode='live' AND status='paid' AND COALESCE(paid_at,created_at) >= ${since} GROUP BY 1 ORDER BY 1`,[days]),
  ]);
  const [summary,trend,countries,pages,referrers,devices,downloads,sales,products,salesTrend] = results;
  return {days,period,generatedAt:new Date().toISOString(),summary:summary.rows[0],trend:trend.rows,countries:countries.rows,pages:pages.rows,referrers:referrers.rows,devices:devices.rows,downloads:downloads.rows,sales:sales.rows[0],products:products.rows,salesTrend:salesTrend.rows};
}
export type AnalyticsReport = Awaited<ReturnType<typeof analyticsReport>>;
