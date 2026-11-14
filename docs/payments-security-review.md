# Payment implementation and security review — 13 November 2026

The website payment flows now cover digital purchases, booking/gallery invoice deposits and balances, art invoices, and Stillbounds licences. Photography and fine-art collections are separate. MELATONE belongs to Photography at NGN 20,000. This is a focused application/payment review, not a guarantee against every possible vulnerability or an audit of Paystack's infrastructure.

## Findings addressed

| ID | Priority | Evidence and change |
| --- | --- | --- |
| P01 | High | The previous price parser extracted digits from arbitrary strings, so `$20` became NGN 20. `lib/payments/policy.ts:16` now accepts explicit NGN/numeric prices only, converts exactly to integer kobo, and rejects signs, foreign currencies, malformed grouping, extra decimals and overflow. Checkout takes its price from the database, never the browser. |
| P02 | High | Shop webhooks previously only supported the legacy signature and could acknowledge failed verification. `app/api/paystack/webhook/route.ts:9` now verifies raw-body timestamped signatures with the configured `whsec_` secret, refuses downgrade, bounds bodies, and returns errors for transient verification/storage failures so Paystack retries. A genuine signed live ping returned HTTP 200. |
| P03 | High | Refunded/disputed digital purchases previously remained downloadable. `lib/payments/store.ts:106` now records and deduplicates reversals, blocks delivery, and prevents later success notifications from reviving reversed orders. Downloads also recheck Paystack, and gallery settlement checks all invoices. Refund/dispute cases remain locked for studio review. |
| P04 | Medium / hardening | Previous shop checks compared success, amount and currency only. `lib/payments/policy.ts:42` now also binds the exact reference, live/test environment, buyer email, product/invoice metadata and provider ID. Database uniqueness prevents provider-ID reuse. No cross-order exploit was demonstrated against Paystack itself. |
| P05 | High / new-flow control | New online invoice payments use invoice/order row locks, one pending invoice checkout, immutable amount snapshots, idempotent payment entries and guarded manual recording. Concurrent callbacks cannot add duplicate credits. An overpayment is retained as a review case rather than credited or silently discarded. See `lib/payments/store.ts:37` and `lib/payments/store.ts:63`. Deposits do not unlock final gallery downloads. |
| P06 | Medium | Purchase cookies now have a signed, server-checked expiry. Recovery links are bound to the order and email, expire after 30 days, and exchange through a POST body for an HttpOnly cookie. Private return pages use no-referrer/no-index. Recovery requests have IP and email limits and do not disclose whether an address has an order. |
| P07 | Medium / isolation | Photography cards previously linked to the fine-art shop and both sections shared the complete product list. Products now have a validated collection, admin create/edit controls, collection-filtered APIs, database-bound checkout selection and separate return URLs. Wrong-collection checkout is rejected. |
| P08 | Version advisories | The installed Next.js, Nodemailer and source-map-js versions matched published security advisories. They were updated to Next.js 16.4.6, Nodemailer 10.5.0 and source-map-js 1.2.2. The final production dependency audit reports zero advisories. Version applicability was confirmed; exploitation of this deployment was not demonstrated. Receipt recipients are also validated conservatively and passed as address objects. |

Primary advisory references: [Next.js image optimization](https://github.com/advisories/GHSA-2464-fhr4-w9xw), [Next.js cache functions](https://github.com/advisories/GHSA-673q-mjm6-r5xr), [Nodemailer recipient parsing](https://github.com/advisories/GHSA-8c8m-p3m8-cjg8). Webhook behavior follows [Paystack's signature documentation](https://paystack.com/docs/payments/webhooks/).

## Verification

Final production deployment: `dpl_6F9jSn8UAT6nXeY849mZZpgZ6JZ5` (READY), https://moyo-roan.vercel.app. The genuine signed ping was repeated successfully after the dependency update. Non-secret launch evidence is saved in `output/payment-launch-verification.json`.

- 112 automated tests pass, including price/identity/recovery/email controls and existing site regressions.
- TypeScript, targeted ESLint and the isolated release production build pass. Vercel also builds the release with its default Turbopack pipeline.
- Real PostgreSQL tests in a disposable schema verify wrong buyer/amount/collection rejection, repeated/concurrent callbacks, provider-ID reuse, invoice ownership, checkout reuse, deposit/full-settlement delivery rules, duplicate refunds, cumulative Stillbounds refunds and overpayment review. Payment provider success objects in these tests are fixtures, not real live payments. The schema is removed afterward.
- Live checks confirm separate collections, MELATONE at NGN 20,000, ignored browser-supplied amount, a valid hosted checkout, no download for an unpaid order, forged webhook rejection, protected admin routes and authenticated Stillbounds checkout.
- Paystack sent a genuine signed live webhook ping; the application returned 200.
- MELATONE's private delivery asset returns 401 without authorization and 206 for the short-lived signed delivery request. The asset URL and signing values are not exposed by public product APIs.
- Mobile browser inspection covers the paid confirmation screen, deposit/balance controls and the live Photography shop. Local fixture checks do not establish a settled live sale.

## Operations and limits

- Photography shop: `/photography/shop`; return: `/photography/shop/payment`.
- Fine-art shop: `/art/shop`; return: `/art/shop/payment`.
- Bookings and art use their private portals; gallery-only clients can pay through `/payments/gallery` after opening their private gallery.
- Payment attempts and review states are visible at `/admin/payments` after admin sign-in. Amounts are stored in kobo. Historic orders and payment events are retained.
- Receipt/recovery emails use a durable outbox. Mail failure does not roll back a paid order; deferred messages are retried by payment traffic and scheduled maintenance. SMTP can deliver duplicate mail after an uncertain send; this cannot create another payment credit.
- Refunds are issued in Paystack. Refunds/disputes/ambiguous reversals and overpayments deliberately require studio review. An ambiguous refund does not automatically deduct an unidentifiable amount twice. Do not manually mark a pending online payment as paid.
- The daily maintenance route reconciles a bounded batch of orders and retries notifications. Signed webhooks and authenticated return checks are the primary fulfilment paths; a large outage backlog may need additional maintenance runs.
- Already downloaded files cannot be recalled. Stillbounds offline device certificates follow their existing refresh/expiry policy; online account revocation is not instantaneous on an offline laptop. Desktop signing/notarization/distribution are separate from this website release.
- No real card was charged, refund issued, or bank settlement performed during this work. A completed live payment through receipt, download/activation and settlement still needs acceptance checking by the account owner. That is distinct from the successful signed webhook and unpaid-checkout tests.
- Secret values were kept out of output, source and public responses. A proposal to pull all production environment values was rejected by automatic approval review and was not executed. The account owner instead saved the specific webhook signing secret directly in Vercel; setup and signed-ping verification ran inside the existing authenticated production application.

## Additional sandbox acceptance — 13 November 2026, 10:00 WAT

The account owner chose to keep this acceptance pass sandbox-only. Production settings and live entitlements were not changed.

`scripts/verify-paystack-acceptance.mjs` completed four genuine Paystack sandbox transactions using the published no-validation test card and an explicitly required `sk_test_` key: NGN 20,000 digital purchase, NGN 30,000 invoice deposit, NGN 70,000 invoice balance, and NGN 30,000 Stillbounds purchase. An initial standalone sandbox probe also succeeded. All four acceptance transactions were independently verified with Paystack before application fulfilment.

Application writes were confined to a randomly named disposable PostgreSQL schema. The verified digital purchase could retrieve the real private delivery asset through a short-lived signed request. Repeated fulfilment produced one payment event. The invoice deposit kept downloads locked; the balance unlocked them. The actual receipt/outbox implementation produced three captured messages, marked the notifications sent, used the photography return route, and generated a valid order/email-bound recovery proof. No fixture recovery email was delivered to a real mailbox.

The verified Stillbounds sandbox purchase produced a signed, device-bound paid **test** certificate. Signature verification succeeded with the test issuer/device and rejected the same certificate as a live licence. No production paid entitlement was granted. The disposable schema was removed on completion; provider test transaction history remains available in Paystack.

The configured SMTP connection and credentials separately authenticated successfully without sending an email. This verifies SMTP authentication, not real-mailbox acceptance, spam placement or a live customer receipt. No live purchase, bank settlement, live refund, or completed paid hosted-checkout browser flow is claimed by this pass.

Evidence: `output/paystack-acceptance-verification.json`. The original report's live acceptance limitation remains; the user explicitly elected to leave real-money acceptance unperformed.
