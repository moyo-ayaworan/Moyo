# Shop security and purchase-flow audit

Date: 13 November 2026. Reviewed the current working tree for both Fine Art and Photography shops, including product projection, checkout, payment verification, recovery, webhooks, delivery, uploads, and administrative routes.

## Remediation

Both findings below have been addressed in the working tree. Checkout retries recover the same order, verify its provider status, reuse a saved checkout URL, and serialize initialization by reference. Initialization exceptions retain the unresolved state instead of declaring failure. The browser persists its request key across reloads when local storage is available; paid retries return to the existing purchase. An initialization error also provides a protected link to check the original payment.

Maintenance now selects up to 100 unresolved orders independently from 10 paid audits, checks them with concurrency capped at five and a time budget, and retains old unresolved orders. It drains up to 100 notifications within a separate time budget and reports the remaining queue size. Email failures use capped exponential backoff, and fresh notifications are selected first. The function duration is 300 seconds; the existing daily schedule is unchanged.

Validation: 103 tests passed, including new retry, concurrent initialization, and maintenance regressions. TypeScript and focused ESLint checks passed. External services were mocked; no production payments or database changes were made.

Residual provider limitation: if Paystack accepted initialization but its checkout URL was never persisted, a duplicate-reference response does not supply a replacement URL. The code preserves that reference and offers payment checking/studio review rather than silently creating another payable order. Automatic recovery cannot infer that no charge is possible from a network timeout. See Paystack's transaction API and duplicate-reference guidance: https://paystack.com/docs/api/transaction/ and https://paystack.com/docs/api/errors/transaction/.

## Executive result

No confirmed public disclosure of paid delivery URLs, unauthenticated product modification, underpayment bypass, or forged purchase-access bypass was found. Two medium-severity purchase reliability defects were identified. Neither is a demonstrated free-download exploit.

## Findings

### 1. Medium — checkout failures strand the browser's retry key

Evidence: `lib/payments/store.ts:19`, `lib/payments/server.ts:44`, `components/PaystackPurchase.tsx:14`, `app/api/payments/maintenance/route.ts:16`.

The browser keeps its request key when retrying with the same email. After order creation, any initialization exception marks the order failed. The next attempt with that key is rejected because the existing order is no longer pending. An existing pending order without a saved checkout URL is also rejected. A process interruption between order creation and checkout persistence therefore strands the key too. The button's suggested retry cannot recover either case.

An ambiguous provider timeout can occur after the provider accepted initialization; marking it failed is not proof that no payable session exists. Failed orders are excluded from scheduled reconciliation. Reloading creates a new request key and can create a second checkout while the first provider result remains uncertain. A later signed success webhook can still fulfill the earlier order, so this is a recovery/duplicate-purchase risk rather than proof of lost funds.

Reproduced locally with the actual PaymentStore and an isolated query stub: both a failed order and a pending order with no checkout URL reject a same-key createDigital retry.

Fix: distinguish definite rejection from unknown provider outcome, reconcile the same reference before allowing another payable attempt, and make same-key retries recover initialization under a lock/lease. Persist the browser's unresolved request identity across reloads. Do not merely issue a new key after a timeout.

### 2. Medium — scheduled recovery can fall behind indefinitely

Evidence: `app/api/payments/maintenance/route.ts:16`, `lib/payments/notifications.ts:31`, `vercel.json:14`.

The cron runs daily, verifies at most two orders, and invokes a notification worker that attempts at most two messages. Reconciliation selects all paid orders together with pending orders in oldest-updated order. For example, 100 older paid orders ahead of a newly missed pending payment can consume roughly 50 daily runs before that payment is reached. Pending orders disappear from this selection after seven days. A customer who does not return to the verification page and whose webhook was missed can therefore remain unreconciled.

Webhooks, verification visits, and recovery requests also invoke notification delivery, so two per day is the scheduled fallback capacity, not a global throughput limit. Nevertheless, after an SMTP outage with no further traffic, 100 queued messages need at least 50 daily runs. Persistent failures among the oldest messages can repeatedly consume that fallback budget.

Fix: process a bounded batch sized to actual demand within the execution budget, prioritize unresolved orders separately from paid-order audits, retain unresolved payments until explicitly resolved, and use notification retry backoff plus monitoring/dead-letter handling. Schedule frequent drains appropriate to deployment limits.

## Controls inspected

- Server derives price, product, collection and delivery snapshot from the database; caller-supplied amounts are not trusted.
- Fulfillment checks exact amount, currency, reference, environment, buyer email, metadata and provider transaction identity. Provider IDs are unique per environment.
- Payment success is verified server-side; webhook signatures are checked before event processing. Refund/dispute states cannot be revived by later success fulfillment.
- Purchase verification and download require signed, scoped cookies. Recovery proof binds reference, email and expiry and is exchanged through a same-origin POST.
- Download rechecks payment with the provider and streams the file with private/no-store headers. Error responses suppress raw provider/database payloads.
- Public product API and page queries omit paid delivery URLs; story/media fields reject authenticated assets as public previews.
- Admin product and upload handlers check session authorization and request origin. Both private upload transports request authenticated storage.
- Payment pages suppress referrers and indexing. Recovery tokens use URL fragments and the client removes them from browser history before API exchange.

## Verification and limits

The four local suites (`payments`, `product-storefront`, `security-audit`, and `regressions`) passed all 100 tests. A separate PaymentStore fixture reproduced finding 1. These tests use mocks for external services; no production requests, real payments, credential changes, or database mutations were performed.

Production verification remains necessary for Cloudinary unsigned access and historical public copies, database role grants/API exposure, trusted proxy IP headers used for rate limiting, webhook subscriptions, cron execution, and SMTP delivery. Repository review alone cannot establish those settings.

Recovery links are bearer credentials valid for 30 days and can be reused during that time. Purchase cookies last one day. Sharing a valid link can share access to that purchase; there is no buyer-account binding or single-use token ledger. This is the implemented delivery policy, not a signature bypass. Previously downloaded files cannot be recalled by refund processing.
