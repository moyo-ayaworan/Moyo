import nextEnv from '@next/env';
import pg from 'pg';

nextEnv.loadEnvConfig(process.cwd());
const origin = process.env.SECURITY_TEST_ORIGIN || 'http://127.0.0.1:4174';

function check(condition, label) {
  console.log(`${condition ? 'PASS' : 'FAIL'} ${label}`);
  if (!condition) process.exitCode = 1;
}

const adminPage = await fetch(`${origin}/admin`, { redirect: 'manual' });
check(adminPage.status === 307 && adminPage.headers.get('location')?.includes('/admin/login'), 'admin page requires a session');

const adminApi = await fetch(`${origin}/api/galleries`);
check(adminApi.status === 401, 'admin API rejects an anonymous request');

const verifyUnauthed = await fetch(`${origin}/api/admin/verify`);
check(verifyUnauthed.status === 401, 'session check rejects an anonymous request');

const login = await fetch(`${origin}/api/admin/verify`, { method: 'POST', headers: { 'x-admin-key': process.env.ADMIN_KEY || '' } });
const cookie = login.headers.get('set-cookie')?.split(';')[0] || '';
check(login.ok && cookie.startsWith('moyo-admin-session='), 'login issues a signed session cookie');
check(Boolean(process.env.ADMIN_KEY) && !cookie.includes(process.env.ADMIN_KEY), 'cookie does not contain the admin password');

const authed = await fetch(`${origin}/api/galleries`, { headers: { Cookie: cookie } });
check(authed.ok, 'signed session grants admin API access');

const purchase = await fetch(`${origin}/api/paystack/verify?reference=moyo-1-00000000-0000-0000-0000-000000000000`);
check(purchase.status === 403, 'purchase verification rejects a missing buyer cookie');

const csp = await fetch(origin);
check((csp.headers.get('content-security-policy') || '').includes("frame-ancestors 'none'"), 'security policy is served');

const databaseUrl = new URL(process.env.DATABASE_URL);
databaseUrl.searchParams.set('sslmode', 'verify-full');
databaseUrl.searchParams.delete('uselibpqcompat');
const pool = new pg.Pool({ connectionString: databaseUrl.toString(), ssl: { rejectUnauthorized: true } });
try {
  const { rows } = await pool.query('SELECT id, access_code, finished_images FROM galleries WHERE is_locked=FALSE AND cardinality(finished_images)>0 ORDER BY id DESC LIMIT 1');
  if (rows[0]) {
    const access = await fetch(`${origin}/api/galleries/access`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessCode: rows[0].access_code }),
    });
    const data = await access.json();
    const previews = data.gallery?.finished_images || [];
    check(access.ok && previews.length > 0 && previews.every((url) => url.includes('/s--') && !rows[0].finished_images.includes(url)), 'gallery access returns signed previews only');
    const galleryCookie = access.headers.get('set-cookie')?.split(';')[0] || '';
    check(galleryCookie.startsWith(`moyo-gallery-${rows[0].id}=`) && !galleryCookie.includes(rows[0].access_code), 'gallery session cookie hides the access code');
    const downloadPath = `${origin}/api/galleries/download?galleryId=${rows[0].id}&index=999999`;
    const noCookie = await fetch(downloadPath);
    const wrongImage = await fetch(downloadPath, { headers: { Cookie: galleryCookie } });
    check(noCookie.status === 403 && wrongImage.status === 403, 'download requires a gallery session and a valid image');
  }
} finally {
  await pool.end();
}
