# Payment and regional pricing audit — 14 November 2026

Source reviewed: `2aa0865`. Main site: https://moyoayaworan.com.

## Result

No confirmed critical/high payment bypass or protected delivery-file disclosure was found in the reviewed paths. The original review found one medium checkout availability defect and one low audit-trail gap. Both are addressed in the remediation below. This is a scoped code review and payment test, not a guarantee against all vulnerabilities.

The review covers regional/currency quoting, both shop collections, Stillbounds billing, payment verification, idempotency, webhook authentication, protected downloads, invoice deposits/balances, recovery receipts, adjacent admin/upload boundaries, frontend injection sinks and production dependencies. The native Stillbounds binary was not rebuilt or exercised.

## Findings

### R-01 — Medium: an old pending quote can block checkout after exchange rates or currency change

Locations:

- `lib/payments/store.ts:19–24` rejects the saved request when its amount differs from the refreshed expected amount.
- `components/PaystackPurchase.tsx:16–25` persists and reuses the same request key for an email/product; refreshing does not replace it.
- `lib/stillbounds/billing-store.ts:51–52` always returns an existing pending checkout for that account.
- `lib/stillbounds/billing-service.ts:17` then rejects that pending checkout if its saved amount differs from today's calculated amount.

Reproduction: create an unpaid USD checkout using 0.000700 USD/NGN, then refresh at 0.000739 USD/NGN and retry using the newly displayed amount. Both services reject with a different-quote error. The old payment URL may remain payable, but the error response provides no authenticated resume quote/URL and a page refresh does not resolve the persisted order. The same problem can occur when switching currency.

Impact: a legitimate buyer can get stuck until they locate their original checkout or receive studio help. This fails safely for money: the saved order is not silently repriced and no second payment is automatically created. No underpayment bypass was demonstrated.

Evidence: `node scripts/reproduce-stale-quote.mjs` reproduces both cases without any database/provider writes.

Recommended fix: return the authenticated saved quote and original checkout URL, show its original amount, and let the buyer explicitly resume it. Only replace an old session after confirming it cannot still collect money. Do not simply generate a fresh reference after a timeout or currency switch.

### R-02 — Low: USD quote history is incomplete in the stored audit trail

Locations: `lib/payments/store.ts:38`, `lib/stillbounds/billing-store.ts:53`, `lib/stillbounds/billing-schema.sql:23–29`.

Shop order metadata stores `usd_price`, `display_currency` and the multiplier, but not the validated exchange rate/timestamp used for conversion. Stillbounds orders retain the charged NGN amount and currency but no original dollar selling price, selected currency, tier or FX snapshot.

Impact: payment verification remains exact and secure against the saved NGN amount. Later support/reporting cannot reliably reconstruct what USD quote and FX snapshot the customer accepted, particularly after rates change.

Recommended fix: persist a server-generated pricing snapshot (base price, region/tier, selected selling currency, rounded dollar price when applicable, FX rate/as-of, final NGN minor amount and quote version) for both systems. Historical receipts must retain the actual charge rather than recomputing today's price.

## Confirmed protections

- New amounts come from server-owned product/Stillbounds prices and server-derived country tiers. Client expected amounts are compared with the server USD calculation, not accepted as authoritative.
- Europe/USA use the configured 2× tier. Other tested regions retain the base tier. Selecting a display currency does not remove the country multiplier.
- Only USD prices round up to $10 before the tier multiplier. NGN and other currency pricing retain their existing rules.
- Paystack charges NGN for every current currency choice. Non-USD foreign currency values are estimates, not separate settlement currencies.
- Provider verification binds reference, exact minor amount, NGN currency, environment and customer/product metadata. Duplicate success processing does not double-credit orders.
- Protected downloads require purchase access plus a verified paid order. Public product data excludes delivery URLs.
- Admin mutations require signed session authentication and same-origin checks. Upload signatures require admin access; paid delivery files use authenticated Cloudinary assets.
- Signed webhook validation precedes payment processing. Late success cannot revive revoked/refunded access.
- Receipt recovery proofs bind the purchase reference, email and expiry. Test receipts are captured rather than sending fixture recovery links.
- Tracked-file scanning found no matching hard-coded Paystack secret/private-key blocks. `.env*` files are not tracked. This is a pattern scan, not exhaustive secret forensics.
- Production dependency audit reported zero known vulnerabilities via `npm audit --omit=dev` at review time.

## Live negative checks

| Check | Result |
|---|---|
| Payment records without admin session | HTTP 401 |
| Protected product download without purchase cookie | HTTP 403 |
| Forged payment webhook | HTTP 401 |
| Public photography shop response | 2 products; no delivery URL fields/authenticated asset URLs |
| Supply a forged `x-vercel-ip-country: US` from Nigeria | Platform returned NGN/base tier, overriding the supplied country |

These requests did not complete a live payment or modify real customer orders. A prior rejected-price probe is not counted as a completed payment.

## Test coverage and evidence

- Unit/regression suite: **148 passing**; TypeScript passed.
- Baseline real Paystack sandbox test: shop purchase, ₦30,000 invoice deposit, ₦70,000 balance, Stillbounds purchase/paid activation; verified private delivery, captured receipts/recovery links and duplicate processing. **4 genuine sandbox transactions**.
- Regional matrix: **442 combinations passed** — 17 currencies × 13 country/fallback cases × 2 product prices. Countries/fallbacks: Nigeria, USA, France, UK, South Africa, Ghana, Kenya, Canada, Australia, India, Brazil, missing country and unknown country.
- Full regional sandbox run: **16 genuine Paystack sandbox transactions passed**, including a repeat of the four baseline payments plus 12 additional shop/Stillbounds payments for NG/NGN, US/NGN, FR/EUR, US/USD, NG/USD and GB/GBP. The separate baseline run also completed four transactions; thus 20 test-provider transactions were executed across the two runs.
- In each additional shop/Stillbounds scenario, a one-minor-unit/wrong-amount payment and wrong-currency payment were rejected; correct independently verified sandbox payments succeeded, and duplicate fulfillment remained safe.
- The regional script used the actual application pricing, stores and Stillbounds checkout service. Checkout initialization arguments were captured by the test adapter; card charges and transaction verification used the real Paystack sandbox API. Notification emails were captured. This is not a full browser/3-D Secure or production-webhook acceptance test.
- Every charge in these tests was **NGN**, including USD/EUR/GBP storefront choices, matching the current implementation.
- Art and photography share the same order/quote path; collection mismatch isolation is covered by the regression suite. Additional real sandbox transactions used the photography fixture.
- Evidence: `output/regional-paystack-audit-verification.json` and `output/paystack-acceptance-verification.json` (local ignored artifacts). Runner: `scripts/verify-regional-payments.mjs`. Both runs exited successfully after dropping their disposable schemas.

### Representative regional payment results

Rates used: 0.000739 USD/NGN. Actual charged NGN minor amounts were verified against the saved order.

| Case | Shop price/charge | Stillbounds price/charge |
|---|---:|---:|
| Nigeria, NGN | ₦20,000 | ₦30,000 |
| USA, NGN | ₦40,000 | ₦60,000 |
| France, EUR estimate | ₦40,000 charged | ₦60,000 charged |
| USA, rounded USD | $40 → ₦54,127.20 | $60 → ₦81,190.80 |
| Nigeria, rounded USD | $20 → ₦27,063.60 | $30 → ₦40,595.40 |
| UK, GBP estimate | ₦40,000 charged | ₦60,000 charged |

## Limits and commercial rules

IP location is approximate; a VPN/proxy can affect the tier. The country header is trusted only behind the verified deployment proxy. Currency choice is intentionally user-controlled: a buyer can select NGN instead of rounded USD; the different rounded USD price is not a mechanism for forcing every foreign buyer to pay USD. Enforcing a different commercial rule would require an explicit change.

Rates are checked for validity and age, but an external FX feed is not a guarantee of a customer's bank rate. A stale or changed quote stops new USD checkout rather than silently charging a different amount. No real-money settlement, customer bank conversion, browser 3-D Secure flow, native desktop purchase UI, or new production mailbox delivery was tested in this audit. Sandbox success is not proof that every international bank/card will authorize a live charge.

The initial audit did not change production application code. The user subsequently authorized remediation.

## Remediation — 14 November 2026

- **R-01 fixed:** saved checkout amounts are returned for explicit confirmation when the fresh quote differs. Confirmation must match the existing reference and amount; only that original session is resumed. Paid shop retries still recover their receipt. Stillbounds resolves existing pending orders before fetching today's exchange rate. Race/concurrency reservation checks retain the original quote.
- **R-02 fixed for new orders:** both ledgers store a separate, versioned JSON pricing snapshot containing base amount, country/tier, selected currency, selling amount, exchange rate/as-of, quote time and final NGN minor amount. Historical orders are not backfilled with invented quote information.
- USD and EUR now both round the base selling price up to the next 10 units before applying the region multiplier. NGN amounts retain their existing rules. All current payment settlement remains NGN.
- Additive migration: `scripts/migrate-pricing-snapshots.mjs --apply`.
- Regression coverage: `tests/pricing-resume.test.mjs`; verification helper: `scripts/reproduce-stale-quote.mjs` now asserts the repaired flow rather than the original failure.
- Updated sandbox/matrix evidence is generated by rerunning `scripts/verify-regional-payments.mjs`. The earlier table above describes the initial audit at source `2aa0865`; EUR prices change under the approved rounding rule.

Remediation validation: **156 automated tests passed**, TypeScript and focused lint checks passed, and the updated **442-case matrix / 16 real sandbox transaction run passed** with persisted pricing snapshots checked in both ledgers. The additive production pricing-column migration completed successfully. The updated French EUR scenario charged ₦58,997.06 for the €40 shop fixture and ₦88,495.58 for the €60 Stillbounds fixture at the tested FX rate. No real money was charged.
