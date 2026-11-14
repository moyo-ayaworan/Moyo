import { query } from './db';
export async function recordOperationalFailure(event: 'request_error' | 'payment_error' | 'download_error' | 'stillbounds_error') {
  console.error(JSON.stringify({ event }));
  try {
    await query(`INSERT INTO operations_failures(event,bucket,total) VALUES($1,date_trunc('hour',NOW()),1)
      ON CONFLICT(event,bucket) DO UPDATE SET total=operations_failures.total+1`, [event]);
    await query("DELETE FROM operations_failures WHERE bucket < NOW()-INTERVAL '7 days'");
  } catch { console.error(JSON.stringify({ event: 'operations_record_failed' })); }
}
