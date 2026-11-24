# Stillbounds app feedback

## Where it appears

The development app exposes Send app feedback on Home, in Help, and on the
activation/sign-in panel. Website administrators use /admin/stillbounds/feedback,
also linked from the website Admin page. The inbox is separate from client book
reviews. It lists reports newest first, with status filters, 30-report pages and
New / Investigating / Fixed / Closed status updates. Status changes do not send
email or delete reports. Reply email is optional, tester-provided and unverified.

## Submission and privacy

Sign-in is not required, including for reporting sign-in failures. The tester
reviews a type, title, description, optional reproduction steps and reply email.
Optional diagnostics consist only of app version, macOS version, platform and
processor architecture. The main process supplies these fields; credentials are
never exposed to the renderer or sent with a report. No photos, editable projects,
screenshots, logs, file paths, face data or account identities are attached.

A narrow caller-validated IPC bridge validates the strict shared schema, bounds
text and prevents concurrent submissions. The fixed HTTPS website transport
retains public-address pinning, TLS verification, redirect rejection, timeouts
and bounded response checks. The renderer cannot supply a URL or executable.
Sending is deliberate, never automatic. Draft text survives closing/reopening
the dialog within the same running app, and remains after a send failure; it is
not persisted across app restarts. Unchanged retries reuse a report reference;
changed details get a new reference. A matching website receipt is required
before the UI says Report received.

The public POST /api/stillbounds/feedback accepts only bounded JSON (64 KiB),
validates exact fields and applies the existing hashed-IP limit of ten requests
per hour. SQL values are parameterized. Reports use an idempotent UUID plus a
content hash; duplicate retries do not create duplicate rows or replace content.
The server stores no arbitrary attachments, file paths or caller-supplied status.

GET/PATCH /api/admin/stillbounds-feedback require the existing signed admin
session. Status mutations additionally require the exact browser origin. Private
responses use no-store/noindex headers. Report text is rendered as escaped React
text. A separate table and indexes initialize under a transaction advisory lock;
existing account, licensing and client-review records are not changed.

## Storage and deployment

The existing website PostgreSQL database stores stillbounds_app_feedback, using
existing server-only database configuration and protected admin login. No new
service credentials are needed. The website source at
/Users/ayaworan/Documents/Moyo contains the changes; the guarded sync manifest is
output/feedback-site-sync.json and scripts/sync-feedback-site.mjs checks source
hashes before applying. The privacy notice now describes this optional flow.

Deploy the website before distributing an app build using this form. The
website admin inbox is /admin/stillbounds/feedback after deployment. GitHub and
Vercel should use the same source revision; deployment verification is recorded
separately. Before deployment, submissions against the older website report
failure and retain text. App release packaging and Developer ID
signing/notarization remain separate and are not included in website deployment.

Reports have no automatic retention cleanup, attachments, account submission
history, push/email notifications or in-app replies. Administrators handle any
requested reply/deletion separately. No production database reports, real
accounts, credentials or original photos were used for verification.

## Verification

- npm test: 247 tests, including feedback schema/privacy, failures, receipts,
  retries and concurrency; npm run build passed with the existing chunk warning.
- Website: 200 tests and production build passed. Turbopack CSS worker port binding
  is blocked here, so the supported npm run build -- --webpack path was used.
- node scripts/verify-feedback-backend.mjs exercises actual route handlers and
  isolated PostgreSQL-compatible storage, idempotency, strict input, rate limits,
  admin authentication, CSRF/origin checks, pagination and status filters.
- node scripts/verify-feedback-native.mjs exercises actual Electron submission,
  opt-out, system-field previews, a failed send, retry, persisted receipt and
  website inbox/status integration, with light/dark/compact screenshots.
- node scripts/verify-feedback-activation.mjs checks access before activation,
  overlay stacking, background inertness and Escape/focus recovery.
- scripts/preview-feedback-inbox.mjs and scripts/verify-feedback-inbox.mjs inspect
  the actual Next.js page with isolated admin credentials and synthetic records,
  status changes/reload, empty states, desktop/mobile rendering and overflow.
- npm run verify:desktop covers editor, save/reopen, preview, exports, client
  reviews and feedback shortcut isolation using temporary fixture profiles.

Durable evidence: output/feedback-{backend,native,activation,inbox}-verification.json,
output/desktop-verification.json and output/playwright/feedback*.png. The preview
must use only loopback and synthetic storage. It does not test a live deployment.
