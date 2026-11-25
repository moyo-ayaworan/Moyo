# Practical site hardening

This update adds authenticator-based admin sign-in, revocable admin sessions, expiring booking/collector portal links, stricter private-page script policy and a persistent newsletter delivery queue. It preserves existing customer records, media, review encryption and desktop API compatibility.

## Owner setup

After deployment, previous password-only admin sessions no longer authorize API access. Open `/admin/login`, enter the existing password, scan the locally generated QR code in an authenticator app and enter its current code. Save the eight recovery codes privately. Each works once. The website cannot enroll a phone on the owner's behalf. Setup challenges expire after five minutes and allow five verification attempts; authenticator counters cannot be reused. Recovery codes and authenticator seeds must never be pasted in chat, tickets or logs.

Seeds are encrypted using AES-256-GCM with a purpose-derived key from the existing session secret. Recovery codes are keyed hashes. Do not rotate `ADMIN_SESSION_SECRET` without a migration/recovery plan: existing review encryption also depends on it. There is no self-service authenticator replacement flow yet. Keep recovery codes available and use a controlled operator-assisted migration if replacing a lost authenticator.

`/admin/security` lists active four-hour sessions and revokes individual/other sessions. Logout revokes the current stored session before clearing its cookie. API authorization checks both the signature and current database state and fails closed during database errors. Proxy routing checks the signature optimistically; private data remains behind the database-backed API checks.

## Client portal links

New links expire after 180 days. Existing booking and collector links receive a 180-day migration grace period, without changing their tokens. Admin booking/collector controls can revoke or replace a link; replacement invalidates the previous token and requires sharing the new URL. No automatic email is sent by those controls. Booking recovery renews expired links after the existing email verification/rate limits; it never restores explicitly revoked links. Collector replacement is handled by the studio. Independent gallery access codes remain a separate authorization mechanism.

Expiry/revocation checks cover portals, certificate/document access and portal-authorized invoice payments. Existing data is retained.

## Private-page script policy

Private pages use request-specific nonces, no-store/no-referrer headers and dynamic rendering. Framework scripts receive nonces. The fixed next-themes bootstrap is explicitly hashed; both the package rendering and verified production bundling form are allowed. Recheck actual rendered script hashes after theme dependency/compiler changes. Public static pages retain their existing policy and caching. Inline style support remains necessary for the existing interface. This is not a claim that all public pages have a strict nonce CSP.

Entering a private page from a public client-side navigation reloads the document to apply its private policy. Verify no reload loop, functional theme switching, account/review/payment pages and production login after deployment.

## Email delivery

Campaigns persist content and deduplicated recipient jobs before background sending. A request key prevents retrying the same submission from creating another campaign. Workers claim rows with leases, apply bounded retry backoff, recheck subscription status and acknowledge only SMTP-accepted messages. Eight failed attempts move a recipient to the owner-visible failed state. The newsletter dashboard shows aggregate status and can retry failed recipients.

SMTP delivery is at least once: a process failure after SMTP acceptance but before database acknowledgement can cause a duplicate retry. Stable message IDs help correlation, but cannot guarantee deduplication or inbox placement. Unsubscribing cannot recall mail already accepted or already in flight.

The existing daily maintenance remains a fallback. The independent hourly monitor calls a shared-secret-protected, rate-limited, bounded email worker before recording a successful heartbeat. Update its pinned `SOURCE_REVISION` only after matching website deployment is ready. Its database role stays read-only; the authenticated application endpoint performs writes.

## Hosting and scope

Read-only provider inspection found Vercel Hobby hosting and no active custom project firewall configuration. DNS remains at Namecheap with Vercel hosting. Vercel supplies baseline platform DDoS mitigation; no custom WAF rule, Cloudflare proxy, attack simulation or capacity claim is introduced. Blanket browser challenges could block desktop API clients and are not enabled.

The owner's earlier decision to skip additional backups remains in force. No backup service, duplicate media, new infrastructure or new paid plan is added.

## Validation

Regression tests cover existing functionality plus authenticator encryption, counter replay, recovery-code entropy and database-backed authorization failure. An isolated PGlite check exercises enrollment, one-use recovery, campaign idempotency, deduplicated recipients and unsubscribe rechecks against synthetic records, with zero real emails. Production build and browser/header verification are release gates; deployment and owner enrollment must be recorded separately when complete.
