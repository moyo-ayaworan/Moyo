import pg from 'pg';
import nodemailer from 'nodemailer';

// Run independently of Vercel cron so a stopped scheduler remains detectable.
const pool = new pg.Pool({ connectionString: process.env.MONITOR_DATABASE_URL, connectionTimeoutMillis: 10000, statement_timeout: 15000 });
try {
  if (!process.env.MONITOR_DATABASE_URL) throw Error('Missing monitor configuration');
  const { rows: [metrics] } = await pool.query(`SELECT
    (SELECT COALESCE(SUM(total),0)::int FROM operations_failures WHERE bucket > NOW()-INTERVAL '2 hours') AS recent_server_errors,
    (SELECT COUNT(*)::int FROM payment_notifications WHERE sent_at IS NULL AND created_at < NOW()-INTERVAL '2 hours') AS overdue_receipts,
    (SELECT COUNT(*)::int FROM payment_orders WHERE mode='live' AND status IN ('review','disputed')) AS review_payments,
    (SELECT COUNT(*)::int FROM payment_orders WHERE mode='live' AND status='pending' AND updated_at < NOW()-INTERVAL '26 hours') AS overdue_verifications,
    (SELECT COUNT(*)::int FROM stillbounds_license_orders o LEFT JOIN operations_checks c ON c.reference=o.reference WHERE o.mode='live' AND o.status='pending' AND COALESCE(c.checked_at,o.created_at) < NOW()-INTERVAL '26 hours') AS stillbounds_overdue_verifications,
    NOT EXISTS(SELECT 1 FROM operations_runs WHERE name='payments' AND completed_at > NOW()-INTERVAL '26 hours' AND failed=0) AS maintenance_unhealthy`);
  // Alert on overdue verification attempts; an old unpaid checkout alone is not an incident.
  console.log(JSON.stringify(metrics));
  if (Object.values(metrics).some(value => value === true || (typeof value === 'number' && value > 0))) process.exitCode = 1;
  const health = await fetch('https://moyoayaworan.com/api/operations/health', {
    headers: { Authorization: `Bearer ${process.env.OPERATIONS_MONITOR_SECRET}` }, redirect: 'error', signal: AbortSignal.timeout(20000),
  });
  if (!health.ok) process.exitCode = 1;
  if(health.ok){
    const retry=await fetch('https://moyoayaworan.com/api/operations/email-retry',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPERATIONS_MONITOR_SECRET}`},redirect:'error',signal:AbortSignal.timeout(45000)});
    if(!retry.ok)process.exitCode=1;
  }
  if (!process.exitCode) {
    const heartbeat = await fetch('https://moyoayaworan.com/api/operations/health', { method: 'POST', headers: { Authorization: `Bearer ${process.env.OPERATIONS_MONITOR_SECRET}` }, redirect: 'error', signal: AbortSignal.timeout(20000) });
    if (!heartbeat.ok) process.exitCode = 1;
  }
} catch {
  console.error('Operations monitoring failed; check database access and deployment.');
  process.exitCode = 1;
} finally {
  await pool.end();
  if (process.exitCode || process.env.OPERATIONS_ALERT_TEST === '1') {
    try {
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) throw Error('Missing alert configuration');
      const mail = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }, connectionTimeout: 10000, socketTimeout: 15000 });
      const result = await mail.sendMail({ from: process.env.SMTP_USER, to: process.env.OPERATIONS_ALERT_TO || 'moyoayaworan@gmail.com',
        subject: process.env.OPERATIONS_ALERT_TEST === '1' ? 'Moyo operations: alert delivery test' : 'Moyo operations: reliability check needs attention',
        text: `An operations check needs review. Open the private repository's Actions run for aggregate results: https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}\nNo customer records or credentials are included in this message.` });
      if (!result.accepted?.length || result.rejected?.length) throw Error('Mail not accepted');
      console.log('Operations alert accepted by SMTP.');
    } catch { console.error('Operations alert delivery failed; inspect this Actions run.'); process.exitCode = 1; }
  }
}
