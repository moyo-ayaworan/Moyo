# Private Moyo Studio connection

Moyo's own Stillbounds desktop app connects to `/admin/stillbounds`. This is an owner-only website adapter for the existing desktop `mofolio-review-v1` connector, not a general-user account system. General beta users cannot obtain Moyo access without an explicit approval by a signed-in Moyo administrator. No Moyo URL or credential is hardcoded into the shared desktop app. No desktop source or packaged binary changes are required for this adapter.

## Connect your own Mac

1. Sign into Moyo admin and open `/admin/stillbounds`.
2. In Stillbounds, open **Share for review**, enter the HTTPS website origin shown in Studio (no path), and choose **Connect website**.
3. Enter the ten-character code displayed by your app into Moyo Studio. Confirm that you initiated the request on your own Mac, then approve.
4. Return to the app and choose **Finish connecting**. The existing app stores the device credential through Electron safeStorage/macOS Keychain; the renderer receives connection status, not the bearer token.
5. Publish a fixed preview version from the app. Share its private link with the intended client. Refresh feedback in the app to see comments and approval or changes. Published previews cannot be edited in place; publish a new version when the design changes.

## What is implemented

- Discovery: `/.well-known/mofolio-review.json` → `/api/mofolio/studio`.
- Five-minute pairing, server-enforced polling delay, explicit authenticated approval, CSRF origin checks, one-time token delivery and hashed thirty-day revocable device sessions.
- Separate `stillbounds_*` PostgreSQL tables with their own initialization. Existing galleries, orders, accounts, newsletters and waitlist membership are not changed by pairing or review publication.
- Atomic draft creation, stable per-book version counters, declared spread IDs, complete-upload check and immutable publication. Authenticated owner routes are scoped to the single private Moyo workspace.
- Flattened JPEG input validated and re-encoded using Sharp: at most 1600px on either dimension, metadata stripped, 4 MiB input limit (below Vercel's 4.5 MB body cap), 40 MiB/version, 200 MiB/workspace, up to 101 surfaces and 100 active versions. These are application caps, not a claim about the database plan's capacity or cost.
- Private previews stored as bounded PostgreSQL BYTEA data, never uploaded to public Cloudinary or Blob URLs. Every image request rechecks review-scoped authorization, publication, expiry and revocation. No-store caching and no-referrer/noindex response headers protect review routes.
- Client links carry a high-entropy access code in the fragment, avoiding server path/query logs. The viewer exchanges it for an HttpOnly, SameSite=Strict, review-specific eight-hour cookie and removes the fragment from the address bar. The link is a capability: anyone intentionally given it can submit feedback. It is not proof of a named client's identity.
- Version-scoped comments, resolving comments from the app, and explicit approval/change requests tied to the fixed review. Approval does not automatically print, invoice or send email.
- Owner dashboard: pair devices, see connection expiry, revoke devices, copy client links and revoke review previews. The dashboard and review pages exclude the wider site's session tracker, chat and social overlays.
- Revocation removes previews and viewer sessions immediately; status/comments and a small spread manifest remain until original expiry. Daily authenticated cleanup at `15 7 * * *` UTC and lazy Studio cleanup remove expired versions/comments/media/viewers and abandoned 24-hour drafts. Minimal book ID/version counters persist to avoid resetting version numbers.
- Privacy notice updated to describe these actual data flows. Existing waitlist marketing preferences remain independent.

## Configuration and operations

Uses existing `DATABASE_URL`, `ADMIN_KEY`, `ADMIN_SESSION_SECRET` and `CRON_SECRET`. No new hosting or authentication service is provisioned. The admin signing secret also derives the encryption key for stored client-link codes: keep it stable while reviews are active, or revoke/republish reviews when rotating it. No secret is returned to the desktop renderer or placed in a share URL.

Only approve a code you initiated on your own app. Never approve a code sent by someone else. Revoking a device stops future publishing/feedback access; it does not revoke already published client links. Revoke the review separately when necessary. The app's existing **Disconnect website** clears its local saved credential; use **Revoke device** in Studio to revoke it server-side.

Backups and hosting logs follow provider retention; deleting previews from the live database cannot erase provider backups immediately. No email is automatically sent. Review previews can be captured by an authorised viewer. Photos/books remain local until explicit publishing.

## Verification

- Production build, TypeScript and targeted ESLint pass in an isolated checkout excluding unrelated local work.
- Existing regression suite plus dedicated Studio unit tests: token/code handling, ownership/expiry filters, CSRF, bounded bodies and browser-facing origins.
- `scripts/verify-moyo-studio.mjs` exercises 41 actual HTTP assertions against the isolated local production build and PostgreSQL, using synthetic records and a local-only admin signing key. Tests include pending/approved pairing, replay rejection, input/image validation, incomplete publication, private image delivery, immutable versions, cross-version feedback rejection, decisions/resolution, revocation and retention. Synthetic book/version/device/pairing records are removed in cleanup; no emails sent.
- `scripts/verify-moyo-desktop-connector.mjs` runs the actual neighbouring Stillbounds `WebsiteReviews` client and JPEG generator against the local HTTP backend through a test transport mapping to a logical HTTPS origin. Discovery, pairing, vault write, upload, strict review-schema validation, list refresh and revocation pass. This check does not replace verified-TLS/public-DNS or native Keychain checks in the desktop project's tests.
- Browser QA uses a synthetic local admin password. Owner dashboard inspected at 1440px and 390px; client viewer checked with representative intercepted review content. Real client records are not used for UI fixtures.

## Deliberate boundaries

This release connects Moyo's own app for client book reviews. It does not build general-user sign-up/sign-in, import existing gallery originals into the app, synchronise editable projects, automatically email clients, or provide subscriptions. Those are separate capabilities. Existing gallery workflows remain independent; linking a review to an existing client/gallery can be added later through a distinct owner-only endpoint.
