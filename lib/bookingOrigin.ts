// Private access links must never inherit an attacker-controlled Host header.
export function bookingOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const fallback = 'https://moyoayaworan.com';
  if (!configured) return fallback;
  try {
    const url = new URL(/^https?:\/\//i.test(configured) ? configured : `https://${configured}`);
    return url.protocol === 'https:' && !url.username && !url.password ? url.origin : fallback;
  } catch { return fallback; }
}
