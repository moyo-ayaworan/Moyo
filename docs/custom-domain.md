# Production domain

The production website uses `https://moyoayaworan.com`, registered at Namecheap. Namecheap BasicDNS remains authoritative. `www.moyoayaworan.com` redirects to the apex through Vercel.

Website DNS records returned by Vercel during setup on 14 November 2026:

- A `@`: `216.198.79.1`
- CNAME `www`: `3742a293dc6dd579.vercel-dns-017.com`

Recheck Vercel's recommended records before future DNS changes. Preserve mail records.

Production URL variables: `NEXT_PUBLIC_SITE_URL`, `PAYMENT_ORIGIN`, `STILLBOUNDS_AUTH_URL`, and `STILLBOUNDS_BILLING_ORIGIN` use `https://moyoayaworan.com`.

`STILLBOUNDS_LICENSE_ISSUER` remains `https://moyo-roan.vercel.app` so existing desktop clients can continue validating newly issued certificates. This identity is independent of the website and checkout origin.

Legacy website pages redirect to the new domain. API endpoints are excluded so the existing Paystack webhook and desktop API URLs keep working. Sessions are domain-scoped; clients and administrators may need to sign in again on the new domain.
