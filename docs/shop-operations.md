# Coupons, physical products and delivery

Manage everything at `/admin/shop-tools`, linked from the admin home. Existing digital products continue to use the product editor and server-owned pricing.

## Coupons

Create percentage discounts (1–99%) or fixed discounts in NGN. Choose both shops, one shop or one product, an optional minimum product subtotal, total usage limit, per-email limit, start date and expiry. Dates entered in the admin use the operator's local time and are saved as UTC timestamps. Codes are case-insensitive and restricted to 3–40 ASCII letters, digits, underscores and hyphens.

Coupon terms are immutable after creation. Enable/disable controls affect new checkouts; a valid payment already in progress keeps its reserved terms. To change terms, disable a code and create a new one. Coupon codes are not secrets or authentication credentials.

The server calculates regional product pricing first, applies the coupon to the product subtotal, then adds the configured shipping fee. Coupons never discount shipping or create zero/negative payment totals. Only one code is accepted per checkout. A preview checks current eligibility without creating an order. Checkout rechecks the coupon and reserves a use for 30 minutes inside the order transaction. Live and test payment environments count usage separately; the admin shows live usage.

Coupon row locks prevent simultaneous buyers exceeding global or per-email limits. Paid, refunded, disputed and review orders count as used; usage is not automatically restored on a refund. Per-email limits are email limits, not verified-person limits. Pending/failed orders hold capacity only until their reservation expires. A late verified payment can use remaining capacity; otherwise it enters review and receives no automatic delivery. Expired checkouts offer an explicit new-checkout action after the customer checks their original payment.

## Physical products

Inventory creates unpublished physical drafts. Add the cover and product details in the existing product editor, configure shipping/pickup rules, set stock, then publish from Inventory. Physical checkout collects quantity, recipient contact details and the delivery address when applicable. Pickup does not require a delivery address. Nothing is published or shipping-priced automatically.

Shipping rules are configured by the operator: customer-facing label, two-letter country code, optional state/region, fee in NGN, pickup/delivery and active status. International rules have their own fees. A blank region covers the country; a specific region must match the address and takes precedence over a whole-country fallback. Unconfigured destinations cannot complete checkout. The shipping fee and delivery details are snapshotted on the order; customers cannot supply their own fee. Delivery addresses are not included in Paystack metadata or public analytics.

Physical product prices follow the site's existing regional pricing. Shipping fees are independent NGN amounts selected by the operator. There is no automatic carrier quote, tax/customs calculation, or promise of international duties coverage. Use clear product descriptions and shipping-rule labels to explain delivery terms.

Each physical checkout reserves stock for 30 minutes with a product-level inventory lock. Available stock excludes active holds. Invalid quantities, insufficient stock and attempts to reduce stock below active holds are rejected. Verified settlement commits stock exactly once. Expired reservations release availability automatically by time; a late physical payment goes to review rather than overselling. Refunds/cancelled fulfilment do not automatically restock goods—adjust inventory only when stock has actually been returned.

Physical orders appear in the admin with private recipient details, quantity, payment status, fulfilment status and tracking/reference. Only verified paid orders can be marked processing, shipped, collected or fulfilment-cancelled. Fulfilment cancellation does not issue a financial refund. Initial physical-order receipts include an expiring protected order link; the receipt page displays fulfilment status and tracking, and never exposes a digital download. Status edits themselves do not send an additional email.

## Checkout integrity and retries

Digital purchases accept no client-selected quantity or shipping fields. Physical quantities must be bounded positive whole numbers. Checkout rejects unsupported price, amount, discount, shipping-fee and currency fields. `expectedAmount` is only a comparison against the server quote, never the authority for a charge. Product prices, coupons, shipping and stock are read from the database and payments are verified against the exact saved amount, currency, buyer, reference and metadata.

Browser retry identities bind the buyer, coupon, quantity and delivery details while remaining stable across FX/price display changes. Existing digital retry keys are recovered for compatibility. Address data is hashed in the storage key rather than persisted in clear text. Changed saved charges require explicit confirmation; repeated notifications cannot deliver or decrement stock twice. Never ask a customer to create another payment while unsure of the original's status.

## Schema and verification

The main database initializer applies `commerceSchema` and `shippingSchema` automatically under its existing schema lock. No new service credentials are needed. Existing payment verification/load scripts apply the same additive schema. Public product projections exclude paid asset URLs and private order/delivery fields.

Run `npm test`, `npx tsc --noEmit`, and `npm run build`. New tests call the checkout API handler with forged fields and invalid quantities, and cover coupon validation and integer-money arithmetic. The disposable PostgreSQL load test additionally pits twenty buyers against one coupon slot and one stock unit, then repeats settlement twelve times. A separate isolated PostgreSQL/PGlite run verified schema reruns, saved coupon pricing, retry binding, per-email/global limits, exact-payment rejection, stock reservation/commit, shipping validation and late-payment review. Browser QA used mocked APIs and synthetic products; no real customer orders, payments, coupons or shipping rules were created.
