> Follow-up: [residual-risk fixes](eniyan-risk-follow-up-2026-11-15.md) supersede the earlier snapshot below for grounded Gemini replies, creation budgets and durable recovery delivery.

# Ẹnìyàn security and integration audit — 15 November 2026

## Executive summary

No confirmed path was found from the language model to private customer records, payment fulfilment, refunds, Stillbounds activation or account privileges in the reviewed code. The model remains a text-only public guide. The important defects were around that boundary: incomplete sensitive-text filtering, unvalidated generated advice, email recovery abuse, unbounded calendar access and loss of booking retry state during navigation. This working-tree update fixes those issues and adds a deterministic account/purchase help panel. This is a targeted repository audit, not a certification of the entire site or a production penetration test.

The owner confirmed that Ẹnìyàn should remain a public guide, with pending booking creation only through its explicit confirmation form and no private-account capabilities. Fixes were authorized by the audit request. Earlier uncommitted Ẹnìyàn fixes were preserved.

## Scope and method

Reviewed chat UI and server handler; privacy and navigation policies; booking form hook, creation, availability, recovery and bearer portal; public shop presentation and purchase recovery/download authorization; Stillbounds account, billing and review entry points; shared rate limiting, request parsing and relevant deployment headers. Traced inputs to provider requests, database queries, SMTP, browser navigation and protected resources. Reviewed the existing payment, account, studio and security tests and added negative-case tests. Used mocked providers/SMTP for adversarial tests, intercepted browser chat requests and local screenshots. No customer booking, payment, recovery email, activation or refund was submitted. No secret values were printed or added to artifacts.

Application: Next.js 16.4.6, React 19, TypeScript, Postgres, Nodemailer, Paystack, Cloudinary and Google Gemini. Next.js documentation was read from the installed package before editing. Public production infrastructure is assumed to be Vercel; its actual project configuration and secret values were not audited.

## Findings and fixes

### EA-01 — Medium: sensitive details could cross the AI boundary

**Evidence:** `lib/privacy.ts:13`, `app/api/eniyan/route.ts:227`, `components/EniyanChat.tsx:324`. Earlier checks did not recognize API portal URLs, some encoded links, Unicode-disguised emails/labels, bearer credentials, PEM private-key headers or common unlabelled contact numbers. The browser sent pasted content to the app even when the server would withhold it from Gemini.

**Impact:** A visitor could accidentally send private details to a third-party language model. This does not prove another visitor could read them.

**Fix:** Normalize compatibility characters, remove common zero-width characters, decode at most three percent-encoding layers, and recognize the additional credential/link patterns. Block matching new content locally without echoing it into the conversation, filter client history, and independently retain server-side checks and history scrubbing. Added encoded/Unicode/credential tests and verified a pasted synthetic email caused zero browser chat requests.

**Residual:** This is pattern detection, not comprehensive PII classification. Names, addresses, unusual formatting, other languages and secrets split across turns may evade detection. Dedicated forms remain the appropriate place for private data. Benign requests can also match conservative patterns.

### EA-02 — Medium: model-generated destinations and success claims were not validated

**Evidence:** `lib/eniyanNavigation.ts:50`, `app/api/eniyan/route.ts` provider-result validation. Existing UI link buttons were allowlisted, but generated prose could still instruct a visitor to use an external phishing address or assert that an email/refund/activation had happened.

**Impact:** Misleading customer instructions or social engineering; no model tool execution or authorization bypass was found.

**Fix:** Reject generated external/protocol-relative URLs, unknown internal endpoints, query-bearing destinations, matching private data and common unsupported transaction-success claims. Require an explicit completed provider finish reason. Fall back to site guidance on rejection. Tests cover malicious addresses, private API links, fabricated payment/email actions and missing finish reasons.

**Residual:** Text validation cannot prove every factual claim or detect every paraphrase/language. No refund, booking, stock or account state should ever be inferred from model prose. Authorization remains in ordinary server endpoints. This follows OWASP's advice to use controls beyond system prompts: [OWASP prompt injection guidance](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html).

### EA-03 — Medium, deployment-dependent: private booking-email origin inherited the request host

**Evidence:** `lib/bookingOrigin.ts:2`; `app/api/bookings/route.ts` creation/admin email calls; `app/api/bookings/access/route.ts` recovery email construction. Email URLs previously used `req.nextUrl.origin`.

**Impact:** On a deployment that accepts an untrusted host/alias, a private access link could point to that host. An exploitable production Host-header chain was not demonstrated; platform host routing may constrain it.

**Fix:** Build booking creation, recovery and admin resend links from operator-configured HTTPS site origins, with a canonical-domain fallback. Reject credentials and non-HTTPS configuration. Tests cover invalid schemes and hostile request origins. Configuration controls the email destination host; request headers do not.

### EA-04 — Medium: recovery could amplify email and expose a matching lookup through SMTP delay

**Evidence:** `app/api/bookings/access/route.ts:27`, `lib/rateLimit.ts:15`. The original endpoint had only an IP limit and awaited SMTP only for a matching booking.

**Impact:** Repeated emails from distributed IPs; response-time evidence about a guessed booking/email pair.

**Fix:** Return the same generic response and queue lookup/SMTP using Next.js `after`. Add an atomic Postgres-backed hourly recipient cooldown, persisting a hash rather than a raw address. Apply it only after a real booking matches, so incorrect references do not consume a recipient's cooldown. Keep the existing IP quota and email only the address stored on the booking. Remove raw transport errors from logs. The client now times out stalled recovery and avoids claiming verified delivery.

**Residual:** This is an in-process post-response task, not a durable email outbox. A process or SMTP failure can prevent delivery; the recipient cooldown can delay a retry. A durable outbox is a future reliability improvement. The generic response intentionally does not reveal a match or SMTP status.

### EA-05 — Medium: public calendar access had no range or request bound

**Evidence:** `app/api/bookings/route.ts:175`. A valid request could query years of booking dates and times. The response did not include customer identities.

**Impact:** Bulk schedule scraping and avoidable database/response work.

**Fix:** Limit a single request to 63 inclusive days and add an availability-specific quota. The normal monthly calendar and one-day chat lookups fit this bound. Tests reject bulk ranges before a database query and verify rate-limit short-circuiting.

### EA-06 — Medium reliability: navigation discarded the booking retry key

**Evidence:** `components/AppChrome.tsx:44`, `lib/useEniyanBooking.ts:14`, `components/EniyanChat.tsx:295`. The application conditionally unmounted the chat on shop product/payment and Stillbounds pages. An in-flight or uncertain booking lost its in-memory payload and retry key.

**Impact:** A visitor could create another request because they could no longer safely retry the original outcome.

**Fix:** Keep the chat shell mounted while hiding its interface on those pages. Preserve the same booking state and key, warn before closing/reloading a tab while submission is pending/uncertain, and prevent package changes while locked. No private booking draft is written to browser storage.

**Residual:** A browser crash, forced reload or closing the tab can still discard the draft. The warning is best effort. The existing booking-reference/email recovery form remains available. A server-supported request-status lookup would need a separate scoped authorization design.

### EA-07 — Low: public context and support routing were incomplete

**Evidence:** `lib/eniyanNavigation.ts:41`, `app/api/eniyan/route.ts:103`, `components/EniyanChat.tsx:475`.

**Impact:** Product detail context could be lost; account/product support depended on English; ambiguous lost links could be sent to the wrong recovery flow. These are correctness gaps with payment/privacy consequences, rather than a demonstrated privilege bypass.

**Fix:** Reduce recognized public product/exhibition paths to their collection identity without sending slugs or arbitrary page text. Keep account/recovery paths available for deterministic navigation but excluded from provider page context and analytics. Add translated deterministic account/purchase guidance in all ten site languages, ask which purchase needs recovery when ambiguous, and add direct account, shop recovery, gallery, commission and studio-contact actions. Preserve the earlier fixes for recovery button labels, booking intent, retry context and focus.

**Residual:** Product stock and prices still come from the actual product/account page, not the model. Full booking-form, privacy-notice and help-panel localization is not complete; new translated support text has not had native-speaker review. Selected site language controls deterministic translations; free-form model replies retain their own language instruction.

### EA-08 — Low: booking service labels could disagree with the selected package

**Evidence:** `app/api/bookings/route.ts:257`. Prices already came from server-side package rates, but the service category was independently caller-supplied.

**Impact:** Inconsistent studio records or confusing service descriptions. No client-controlled price/payment settlement bypass was found.

**Fix:** Resolve service category from the current package; reject unknown packages for chat submissions and any non-empty invalid package identifier. Preserve legacy non-chat requests without a package. Tests forge category and price fields and verify the saved package/category/estimate remain authoritative.

### EA-09 — Low: private portal requests and quota-store failures needed tighter handling

**Evidence:** `app/api/bookings/portal/[token]/route.ts:11`, `app/api/eniyan/route.ts:191`.

**Fix:** Bound portal-token shape/length, throttle portal requests, return private non-cacheable failures without raw database details, and fail chat closed with a generic 503 if its quota store fails. The model cannot become unlimited paid usage during a limiter outage. Existing valid bearer links continue to work.

## Controls checked and retained

- **Model isolation:** `app/api/eniyan/route.ts` sends only the bounded conversation, a static public knowledge base and normalized public route/language context to a fixed Gemini endpoint. It declares no tools and imports no account/booking/payment store. It does not fetch caller-selected URLs or page text. API credentials stay server-side and are sent in a header. Replies render through React text nodes.
- **Booking:** `lib/useEniyanBooking.ts`, `lib/bookingRequest.ts`, `app/api/bookings/route.ts` require a review/confirm step, current future slot, bounded contact details, server-derived estimates and a UUID request key for chat creation. Uncertain retries reuse the same frozen key/payload; database uniqueness handles concurrent slot claims. A browser confirmation field is not anti-bot authentication: direct public submissions remain possible under their quota.
- **Shop delivery:** `lib/purchaseAccess.ts:16`, `app/api/digital-products/download/route.ts:8`, `lib/payments/server.ts` require scoped signed purchase access, a paid order, current provider verification and protected delivery. Chat text cannot set those cookies or fulfil an order. `app/api/paystack/recover/route.ts` requires the checkout origin, has IP/recipient limits, and queues verified paid-order recovery.
- **Stillbounds:** `app/api/stillbounds/billing/[action]/route.ts`, `lib/stillbounds/billing-policy.ts:9` enforce verified sessions, user-scoped orders, device challenges, payment amount/currency/reference/user checks and webhook signatures. `app/api/stillbounds/reviews/[...path]/route.ts` and `lib/studio/security.ts` separately enforce workspace/device/viewer authorization. No chat integration into these capabilities was added.
- **Abuse/deployment:** Postgres quotas are shared between instances. The client-IP assumption depends on trusted proxy headers. Vercel documents that it overwrites X-Forwarded-For; a move behind a different proxy needs explicit revalidation: [Vercel request headers](https://vercel.com/docs/headers/request-headers).
- **No new transcript store:** Chat history stays in component memory; booking/recovery form values go to their own endpoints. No customer text, raw provider errors or secrets were added to analytics or audit artifacts.

## Verification

- 181 automated tests, TypeScript, focused ESLint and whitespace checks passed. The webpack production build passed; final checks are recorded with the completion message.
- New adversarial tests exercise private-data disguises, generated phishing links, unsupported success claims, cross-site chat requests, quota-store failure, missing provider completion markers, normalized public context, all supported support languages, large calendar ranges, recipient cooldowns, queued recovery responses, canonical email origins and server-authoritative booking estimates.
- Local browser checks: desktop and 390 × 844 mobile support layouts; focus on opening/returning from tracking; pasted synthetic contact text causes zero chat requests; ambiguous download-link help does not open booking recovery. A guided booking also retained its selected package and schedule step after client navigation to Stillbounds and back. Browser requests for synthetic chat checks were intercepted rather than sent to Gemini. Screenshots are in ignored `output/playwright/eniyan-audit/`.
- `npm audit --omit=dev --json` completed against the registry and reported zero known production dependency advisories. This is a snapshot of registry knowledge, not proof that dependencies have no defects. Development dependencies were not included in that advisory result.
- Development browser logs included the existing React development/CSP eval warning and image-loading warnings. CSP was not weakened for debugging; the production build passed.

## Residual risks and follow-up

1. Keep the model unable to read private records or invoke payment/account tools. Adding either requires a new authorization and consent design, not a prompt change.
2. Pattern filters cannot guarantee privacy or factual correctness. Maintain regression cases for discovered evasions, including multilingual content, and keep high-stakes work on verified forms.
3. A durable booking/recovery email outbox, per-resource abuse budgets and stronger bot protection would improve resilience at higher scale. Current public booking creation still accepts unverified contact addresses and can be abused across distributed IPs; this audit did not add a CAPTCHA or email-verification prerequisite that would change the booking journey.
4. Existing booking portal bearer tokens are long random capabilities; they are not expiring sessions and expose related documents/gallery access to anyone holding the link. Revocation/rotation and expiry need a coordinated portal/customer-email migration; no new expiry policy was silently introduced here.
5. Verify deployed proxy-header trust, canonical-origin configuration, email delivery and authorized end-to-end purchase/account flows in the deployment environment. No production penetration testing, payment or customer-data test was performed.
6. No push or deployment was requested. These are local changes. A release should update GitHub and Vercel to the same revision under the standing release workflow.
