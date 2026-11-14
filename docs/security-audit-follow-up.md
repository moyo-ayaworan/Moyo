# Security audit follow-up — 13 November 2026

The fresh cross-path review found five additional weaknesses or hardening gaps, now fixed in code and regression-tested. No critical/high-severity exploit was confirmed in this pass. This is not a claim that the site is breach-proof or that no compromise has occurred; incident forensics and hosting/account configuration are separate work.

This extends [the repository audit](full-code-security-audit.md). The scope includes every inventoried first-party source/configuration file through automated scanning, plus focused manual review of authentication, authorization, payment state transitions, private media, account/device ownership, public input, email flows and recent changes. It does not claim manual inspection of every line of vendor code, generated output or external desktop source.

All **55 API route files** have their methods and security boundaries classified in `output/security-route-matrix.json`. Scan results, hashes and review methods are in `output/code-audit-static.json` and `output/code-audit-coverage.json`.

## New findings and fixes

### B1 — Medium: general admin mutations lacked exact-origin enforcement

**Affected:** `lib/auth.ts:39`, `app/api/admin/logout/route.ts:5`, with callers throughout the admin API.

A valid signed admin cookie previously authorized a mutation without checking Origin. SameSite Strict protects cross-site requests, but a hostile sibling origin on the same registrable domain can still submit a credentialed request. An attacker would need control of such an origin and a victim with an active admin session; this was not an anonymous internet authentication bypass. No attacker-controlled production subdomain was established during this audit.

A local regression supplied a genuine synthetic signed cookie and a sibling Origin; the old guard accepted it. The guard now rejects foreign/missing origins on mutations and foreign fetch metadata. It retains the browser-facing Host handling needed behind a standalone reverse proxy. Logout has the same boundary. Scheduled state-changing GET handlers additionally require an explicit origin for admin-cookie access; correctly authenticated cron calls remain unchanged.

**Compatibility:** browser admin requests continue to work. Native admin integrations making mutations must send the matching Origin. Read-only same-origin requests and cron bearer authentication are retained.

### B2 — Medium: preview signing could deliver an untransformed original

**Affected:** `lib/privateMedia.ts:21`, `app/api/galleries/access/route.ts`, `app/api/galleries/download/route.ts`.

`signedGalleryPreview` accepted raw assets and signed them without a size/quality transformation. If a raw archive had been configured as a finished gallery item, the client could receive a directly accessible original before the payment-gated download endpoint was consulted. Vector/PDF formats also did not enforce a raster-only preview boundary. This required the asset to be configured in the gallery; no unauthenticated user could choose arbitrary server assets through this helper.

The helper now signs only image resources, always as a first-page JPEG bounded to 1200 pixels and quality 75. Raw/video assets are excluded. Finished-only covers cannot fall back to an original. Download eligibility uses the same image-resource filter so displayed preview indexes continue to identify the correct original.

A read-only aggregate compatibility check found **53 final assets, zero raw, video, SVG or PDF finals**. No private URLs or client records were printed. Digital-product archive delivery still uses the separate verified original-download path.

### B3 — Medium: ambiguous processed refunds could leave a paid licence active

**Affected:** `lib/stillbounds/billing-store.ts:63`.

When a processed-refund event had an identifier but no usable positive integer amount, the licensing store recorded it and returned without changing paid entitlement. A malformed but authenticated provider event could therefore leave access enabled instead of requiring review. No forged-signature bypass or real malformed provider delivery was demonstrated.

The store now quarantines such events using its existing disputed/review state, removing further paid activation and requiring support review. Valid partial refunds continue to retain access until the cumulative refund reaches the purchase total. Stable event IDs still prevent duplicate accounting.

Actual PostgreSQL tests in a disposable namespace verified that a valid partial refund preserves access, while an unknown-amount refund disables entitlement and blocks further activation. All integration-test payment records were synthetic. A separate read-only aggregate found zero historical paid licences with already-recorded missing/nonpositive refund amounts, so no legacy entitlement rewrite was needed. Paystack's [refund documentation](https://paystack.com/docs/payments/refunds/) describes partial/full refunds and the processed notification; the missing-amount case here is a defensive malformed-event test, not a claim about an observed provider fault.

### B4 — Low: licence verification utility accepted expired signed claims

**Affected:** `lib/stillbounds/license-proof.ts:20`.

The helper validated signatures and time-interval structure but did not reject a certificate after its grace deadline. Regression tests reproduced acceptance of an expired certificate and now verify rejection at/after the deadline, while preserving a paid certificate's valid grace interval.

**Scope limit:** repository callers found for this helper are verification scripts/tests. This is a secure-default library correction; it does not demonstrate that the separately maintained desktop application accepted expired licences. Native enforcement remains outside this repository audit.

### B5 — Low: SMTP could hold an authorized download response open

**Affected:** `app/api/galleries/download/route.ts:96`.

The handler awaited a best-effort email before returning the file stream, without SMTP timeouts. An email outage could stall a permitted customer download.

Notification work now runs through Next.js `after`, with bounded SMTP connection/greeting/socket timeouts and generic failure logging. A regression confirms that the file response is returned without opening an SMTP transport. Notification timing does not change payment, ownership or lock checks.

## Validation

- **128 tests passed**, including five new security regressions. Three newly added assertions failed against the old implementation before their fixes.
- Full repository lint: **0 errors, 0 warnings**; no rules disabled.
- TypeScript and production webpack build: passed.
- Fresh full npm audit: **0 reported vulnerabilities**, including development dependencies.
- Actual PostgreSQL integration passed in a disposable schema, including financial-record retention, receipt/refund notification ordering, newsletter consent and refund quarantine. The schema was removed; mail was captured.
- API matrix has no unclassified routes; source parsing/import/credential-literal/SVG scans remain clean within the documented scanner's limits.
- No live payment, refund, real confirmation email or newsletter campaign was performed.

## Remaining design risks and external verification

1. **Admin session revocation:** admin cookies are stateless and expire after four hours (`lib/auth.ts:5`). Logout removes the browser's cookie, but a stolen copy remains valid until expiry or signing-key rotation. Persistent revocation is not implemented. Plan compromise response carefully: the admin signing secret also derives the review-code encryption key in `lib/studio/protocol.ts`, so rotating it blindly can impair recovery of existing review links. No secret values were printed or downloaded, and no credentials were rotated.
2. **Trial/device identity:** the server checks verified accounts, one trial per stored device identifier and possession of an Ed25519 device key. The device identifier is still asserted by the client (`lib/stillbounds/billing-service.ts`, `billing-store.ts`). This does not cryptographically attest physical hardware or prove that different verified email accounts belong to different people. Modified clients/new identities can challenge anti-trial-abuse policy. A determined owner's control of the separate desktop binary cannot be solved solely by this website.
3. **Aggregate review capacity:** per-account review storage is 50 MiB while the shared pool is 200 MiB (`lib/studio/service.ts:492`, `lib/studio/protocol.ts:8`). Multiple verified accounts can exhaust the shared budget and block new uploads. Existing media remains protected; the cap limits storage spend rather than guaranteeing fair capacity. Invitation/entitlement gates, moderation and capacity reservations require an explicit product policy. No load/stress attack was run against production.
4. **Bearer links and previews:** booking/collector links are long-lived bearer credentials, and shared proof/preview URLs are not DRM. Keep them private; already captured previews cannot be recalled. Token expiry/rotation, private proof migration and log-retention controls are separate design/operations work. Final-original downloads still require the server's current payment/ownership checks.
5. **XSS defense-in-depth:** the CSP still permits inline scripts (`next.config.ts`). No unsanitized public HTML execution path was confirmed, but a nonce/hash-based policy would provide a stronger secondary barrier. This was not weakened during this review.
6. **Infrastructure:** database grants/public data APIs, secret entropy, domain/subdomain ownership, CDN/WAF/client-IP handling, backups, provider account permissions, external desktop checks, historical fraud and incident logs are not certified by this code audit. The fresh dependency audit is an advisory check, not a guarantee against unknown supply-chain issues.
7. **Operational delivery:** newsletter delivery is not a durable exactly-once campaign queue, and offline licences necessarily have a revocation window until reconnect/expiry. Existing limitations in the primary report still apply. Per your sandbox-only instruction, real live settlement and real recipient mailbox delivery remain untested.

## Release evidence

The patch is deployed as `dpl_FJ2HiZboCXGeigDyifyv5yr92h8H`, READY at https://moyo-roan.vercel.app. Authenticated production checks returned 403 for foreign/missing origins, 400 for a deliberately invalid same-origin gallery request, and 200 for the test-session check/logout. No gallery/customer/payment was changed. Public shops and private headers passed smoke checks. The exact deployment and read-only smoke checks are recorded in `output/security-follow-up-verification.json`. Local test results alone are not treated as proof that a change is deployed.
