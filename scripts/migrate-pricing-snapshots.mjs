// Additive, nullable columns only. Older orders retain their original pricing data.
import pg from 'pg';
try { process.loadEnvFile('.env.local'); } catch {}
const sql = `ALTER TABLE public.payment_orders ADD COLUMN IF NOT EXISTS pricing JSONB;
ALTER TABLE public.stillbounds_license_orders ADD COLUMN IF NOT EXISTS pricing JSONB;`;
if (!process.argv.includes('--apply')) { console.log(sql); process.exit(0); }
const url = new URL(process.env.DATABASE_URL);
url.searchParams.set('sslmode', 'verify-full'); url.searchParams.delete('uselibpqcompat');
const pool = new pg.Pool({ connectionString: url.href, ssl: { rejectUnauthorized: true }, max: 1, connectionTimeoutMillis: 15000 });
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query("SELECT pg_advisory_xact_lock(hashtext('moyo-pricing-snapshots-v2'))");
  await client.query(sql);
  await client.query('COMMIT');
  console.log('Pricing snapshot columns ready for shop and Stillbounds. Historical orders unchanged.');
} catch (error) { await client.query('ROLLBACK'); throw error; }
finally { client.release(); await pool.end(); }
