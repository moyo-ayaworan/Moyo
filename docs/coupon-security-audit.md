# Coupon security and financial audit

Reviewed 27 November 2026. Source revision: `c36d2e97b1b3219bc8c353ae554c8b508cd7a47a`.

## Assessment

Three reproducible defects/abuse paths were found: unpaid reservation exhaustion, coupon totals below the payment gateway minimum, and a public email-allowance oracle. Three additional business-policy risks need an explicit decision: email aliases, late discounted payments, and bulk discount exposure.

No critical payment-forgery, arbitrary-discount, coupon-stacking, cross-product eligibility, or free-delivery bypass was found in the reviewed paths. This is not proof of absence. This review did not examine production orders, incident logs, active coupon settings, provider dashboards, or infrastructure permissions, so it cannot establish whether anyone has exploited these issues or whether money has been lost.

## Remediation status

The original findings below describe revision `c36d2e9`. The implementation addresses each finding below. Release checks and deployment status are recorded against the source revision in GitHub and Vercel.

- **CPN-01:** coupon quotes and checkout require a signed mailbox-verification session. Codes are browser/recipient-bound, single-use, ten-minute challenges with five attempts and IP/recipient cooldowns. A canonical-mailbox advisory lock permits one active coupon checkout per mailbox, with safe recovery of an existing matching reference. Intentional abuse by multiple separately verified people is still possible; reserving scarce stock/offers inherently has an availability tradeoff.
- **CPN-02:** quote, order creation and provider initialization enforce the ₦50 final NGN minimum. Failed new subminimum purchases save no order or hold.
- **CPN-03:** unverified requests stop before any coupon/customer-allowance lookup, returning the same verification-required response. Only the owner of the verified exact email can inspect its allowance.
- **CPN-04:** canonical Gmail/googlemail aliases share usage and hold identity, including legacy orders. Other providers are not destructively canonicalized. No guest system can prove that separate real mailboxes belong to different humans; mandatory discount budgets and explicit quantity/discount caps contain that residual exposure.
- **CPN-05:** settlement uses verified payment time and the saved deadline, bounded by coupon expiry. Actually late payments enter review; on-time payments with delayed webhooks remain eligible subject to capacity/budget. A permanent emergency stop blocks payments made afterward, including outstanding checkouts. Provider URLs may still accept money after the site deadline: those funds require reconciliation and no automatic delivery is granted.
- **CPN-06:** creating/reviewing a coupon requires operator-supplied maximum discount per order, total discount budget and maximum quantity. No values or shipping rates are invented. Legacy unreviewed coupons fail closed for new uses until reviewed. Row locks account for discounts already used/reserved. Database constraints reject incomplete reviewed limits.

A related physical-retry bug was also fixed: JSONB key order no longer changes the delivery-details comparison.

Validation: all 262 automated tests pass, including eleven new security tests. The in-memory PostgreSQL hardening script passes, including schema reruns and real SQL checks for budgets, alias identity, payment timing, code consumption and physical retry recovery. Browser QA used mocked APIs and synthetic data for code errors/success, original-payment recovery, cap submission, legacy review and mobile/desktop layouts in both themes. The independent PostgreSQL concurrency load script was extended for budget and alias races; these races run in the required release CI/PostgreSQL environment. No real emails, purchases or refunds were sent during QA.

See [hardening verification evidence](coupon-hardening-evidence.json). The original evidence remains as a record of the pre-fix findings. The reproduction script now asserts secure behavior rather than the original weaknesses.

## Confirmed defects and abuse paths

### CPN-01 — Medium: unpaid checkouts can exhaust a promotion or block an email's allowance

**Source:** [order creation](../lib/payments/store.ts#L50), [reservation persistence](../lib/payments/store.ts#L59), [usage counting](../lib/coupons.ts#L17), [public checkout](../app/api/paystack/initialize/route.ts#L17), [initialization failure](../app/api/paystack/initialize/route.ts#L48).

Any caller with a usable coupon and syntactically valid email can create a pending order, consuming a coupon use for 30 minutes before provider initialization or payment. A coupon with one remaining redemption becomes unavailable to the next buyer. For a coupon without a global cap but with a one-per-email limit, an attacker can also supply a target's email to occupy that allowance. Mailbox ownership is not checked.

**Evidence:** actual order creation in the disposable database returned `pending`, `checkout_url=null`, and a reservation. A second buyer received the usage-limit error without any provider calls. The IP limit of 10 initializations per 15 minutes reduces volume but does not prevent a single-slot attack or distributed abuse. A normal abandoned checkout has the same effect; the reservation itself is intentional, but its unauthenticated abuse is insufficiently constrained.

**Fix:** add identity/resource-aware abuse controls and bot friction for scarce offers; consider verified customer identity before reserving targeted coupons. Keep reservations bounded and distinguish definitive initialization rejection from an uncertain provider timeout. Do not release a hold blindly after a timeout: a payable provider session may already exist. Preserve transaction locking, exact payment verification, and idempotent retries.

### CPN-02 — Medium: coupons can create payable amounts below Paystack's minimum

**Source:** [discount validation](../lib/coupons.ts#L5), [total validation](../lib/payments/store.ts#L51), [coupon preview](../app/api/shop/coupon/route.ts#L28), [provider initialization](../lib/payments/server.ts#L44).

The code ensures the discounted product charge is positive but does not enforce the provider's minimum final charge. Paystack documents an NGN minimum of **₦50 / 5,000 kobo**; subminimum transactions are rejected. See [Paystack's API reference](https://paystack.com/docs/api/).

**Evidence:** a ₦1,000 digital product with a 99% coupon produced a saved pending order charging ₦10 / 1,000 kobo, with an active coupon reservation. No provider request was made during reproduction; rejection at the provider is based on its published contract. This creates failed checkouts and can compound CPN-01. It does not grant free downloads because exact successful payment is still required.

**Fix:** validate the final NGN amount, after discount and configured shipping, against the gateway minimum in both quote and order creation, before committing reservations. Apply the same guard at provider initialization for older saved orders. Reject clearly; do not silently reduce the promised discount or invent shipping fees. Preserve uncertain existing payments for reconciliation.

### CPN-03 — Low: public coupon preview exposes an email's allowance state

**Source:** [unverified supplied email](../app/api/shop/coupon/route.ts#L18), [eligibility call](../app/api/shop/coupon/route.ts#L27), [per-email query and error](../lib/coupons.ts#L17).

Knowing a valid coupon and eligible product, a caller can compare preview results for arbitrary email addresses. The endpoint uses a supplied email without proving ownership and returns a different result when that email's allowance is exhausted.

**Evidence:** the actual preview handler backed by the disposable database returned HTTP 409 with “This coupon has reached its usage limit.” for an exhausted address and HTTP 200 for an unused address. This reveals redemption/hold eligibility, not necessarily a completed purchase: pending holds also consume allowance. Global exhaustion and other restrictions can prevent a reliable inference.

**Fix:** bind detailed recipient eligibility to a verified mailbox/customer session and apply server-owned identity/resource cooldowns. Generalize public error details. Error text alone is insufficient because success versus rejection also reveals eligibility. Never weaken final checkout enforcement to hide the distinction.

## Business-policy risks, not newly discovered authorization bypasses

### CPN-04 — Medium financial risk if “per email” is intended to mean “per person”

**Source:** [email validation](../lib/payments/policy.ts#L35), [allowance counting](../lib/coupons.ts#L17).

Limits compare lowercased email strings. The same person may use aliases or separate inboxes to redeem again. This matches the current “uses per email” wording and is already acknowledged in the operations guide; it does not meet a one-per-person policy.

**Evidence:** a second order using the same exact address was rejected, while `buyer+alias@example.test` was accepted after the base address had used its allowance. Whether a particular provider routes two addresses to one mailbox was not tested; different email strings are demonstrably independent.

**Recommendation:** use a verified, stable customer identity if needed, together with global redemption and discount-budget limits. Email verification alone does not prove one human. Do not universally strip dots or plus tags: providers differ, and unrelated addresses could be merged. OWASP treats multiple identities claiming repeated rewards as [business-logic abuse](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html).

### CPN-05 — Medium financial/operational risk: disabling or expiring a coupon does not stop late settlement

**Source:** [late fulfillment policy](../lib/coupons.ts#L22), [order settlement](../lib/payments/store.ts#L105), [expired browser retries](../lib/payments/store.ts#L31).

Within a valid reservation the saved terms are deliberately honored. After expiry, fulfillment checks remaining global/per-email capacity but does not recheck the coupon's active flag, dates, or a maximum age of the order. Browser retries are rejected after hold expiry, but the fulfillment path can still accept late verified payment evidence for the original reference. This is consistent with the current documented late-payment policy, rather than a bypass of the exact saved charge.

**Evidence:** an order aged 30 days with an expired reservation settled as `paid` using matching synthetic evidence even after its coupon was disabled and expired. **This proves the application's settlement policy, not that Paystack will keep a particular old checkout URL payable for 30 days**; provider URL lifetime was not tested.

**Recommendation:** define a maximum payable window and distinguish an ordinary promotion expiry from an emergency stop. Use verified provider payment time to distinguish an on-time payment with a delayed webhook from a payment actually made late. Late/unacceptable captured funds need reconciliation/refund handling, not silent rejection or automatic second charges. Inspect provider session controls before changing this policy.

### CPN-06 — Medium margin risk: a redemption limit does not cap units or discount value

**Source:** [bounded physical quantity](../lib/inventory.ts#L5), [subtotal and discount](../lib/payments/store.ts#L49), [coupon fields](../lib/couponAdmin.ts#L3).

Percentage coupons discount the whole product subtotal, including physical quantities up to 10,000 if stock exists. `max_uses=1` means one order, not one unit. There is no coupon-specific maximum discounted quantity, maximum discount per order, total discount budget, or margin floor. A general coupon also covers future eligible products. These are configuration/design choices; the system does enforce the configured percentage and available stock.

**Evidence:** one synthetic use of a 99% physical coupon covered 10,000 stocked units priced at ₦10,000 each: ₦100,000,000 subtotal, ₦99,000,000 discount, and ₦1,000,000 product charge. No shipping rates or stock were changed outside the in-memory fixture.

**Recommendation:** add explicit optional caps on discount value, units, and total promotional budget if the business requires them, plus an admin preview of maximum exposure. Start with selected products and a global redemption cap for expensive physical goods. Shipping remains separately charged. The operator must choose policy values; this audit does not invent them.

## Safeguards verified

- Coupon administration checks live admin authorization; writes require same-origin validation.
- User-supplied prices/discounts are rejected. Product, section, activation, dates and minimum spend are checked on new checkout; shipping is excluded from the discount.
- Coupon totals use integer kobo; a zero/negative payable product amount is rejected. 693 boundary/percentage combinations were exercised.
- Coupon row locks and the order transaction protect concurrent capacity allocation. This audit used a serial in-memory PostgreSQL engine and does not independently prove production concurrency behavior. The release's existing PostgreSQL concurrency tests cover competing coupon buyers, stock reservation and repeated settlement.
- Request keys bind original buyer, product, coupon, mode and delivery details; retries preserve the saved charge and provider reference.
- Settlement checks exact reference, amount, currency, mode, buyer, metadata and provider ID. Synthetic changes to amount, currency, email, mode or discount metadata were rejected.
- Refunded/disputed/review orders continue consuming coupon allowance; refunded use is not automatically recycled. Physical orders cannot receive digital downloads.
- SQL parameters, bounded bodies, normalized coupon codes, private/no-store responses and IP limits are present. Coupon codes are promotional identifiers, not credentials.

## Verification and reproducibility

Evidence: [synthetic results](coupon-security-audit-evidence.json). Reproduction: [audit script](../scripts/ops/coupon-security-audit.mjs). The script now asserts the hardened behavior against an isolated database. The original evidence JSON preserves the pre-fix observations.

The engine is installed outside the project so no dependency or lockfile changes are required:

```sh
npm install --prefix /private/tmp/moyo-coupon-audit --no-save --ignore-scripts @electric-sql/pglite
COUPON_AUDIT_PGLITE_MODULE=file:///private/tmp/moyo-coupon-audit/node_modules/@electric-sql/pglite/dist/index.js node --experimental-transform-types scripts/ops/coupon-security-audit.mjs
npm test
```

All 251 existing automated tests passed after the audit, and the portable reproduction script reproduced the saved evidence.

Only synthetic in-memory PostgreSQL data is used. The reproduction never connects to `DATABASE_URL`, calls Paystack, sends email, or reads credentials. PostgreSQL advisory-lock calls are stubbed because the fixture runs serially; other tested order/eligibility SQL runs against the engine. Public handler dependencies for origin/rate-limit/provider-key configuration are mocked; those controls were inspected separately and are not claimed as exercised by the oracle reproduction.

## Recommended priority

1. Reject subminimum final charges before saving holds; add quote/checkout/legacy-order tests.
2. Reduce unauthenticated hold abuse and protect recipient eligibility information while preserving retry safety.
3. Decide whether the business needs per-customer identity, strict late-payment cutoff/emergency disable, and per-order/total discount budgets before changing those policies.

A separate incident review would be needed to determine actual abuse: inspect coupon-linked live orders, unusually high pending/failed reservation volume, near-minimum charges, late payments after coupon deactivation/expiry, and repeat patterns. Alias-like addresses or repeated attempts alone are not proof of fraud. Current records do not provide a full coupon-administration audit trail or preserve every failed preview attempt, so historical attribution may be incomplete.
