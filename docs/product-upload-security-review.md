# Product upload security review

Reviewed 13 November 2026. Scope: product thumbnail and delivery-file uploads, replacement/removal, public product projection, admin authorization, order file snapshots, and paid downloads in the current working tree.

## Result

No confirmed private-file disclosure, unauthorized product modification, or payment bypass was found in the reviewed code. This is a local code and regression review, not a verification of production storage configuration.

## Evidence

- Both upload handlers and product writes call `requireAdmin` before processing input. The shared authorization helper validates signed sessions and checks request origin for mutations (`lib/auth.ts`).
- Delivery uploads use Cloudinary `type: authenticated` in both transports; local fallback refuses private uploads (`app/api/upload/route.ts`, `app/api/upload/signature/route.ts`).
- Product delivery URLs must parse as authenticated assets in the configured cloud. Thumbnail and product-story validators reject authenticated delivery URLs (`app/api/digital-products/route.ts`, `lib/productStory.ts`).
- Public API and product-page data use explicit field projections that omit delivery URLs (`app/api/digital-products/route.ts`, `lib/productStorefront.ts`).
- Orders snapshot the delivery URL when checkout is created. Replacing or clearing a product's delivery URL does not rewrite existing order snapshots (`lib/payments/store.ts`). Removal does not delete the underlying Cloudinary asset.
- Downloads require a valid signed purchase cookie, a paid digital order, and fresh provider verification; the server streams the protected file with private/no-store headers (`app/api/digital-products/download/route.ts`).

## Validation

Ran `node --test tests/payments.test.mjs tests/product-storefront.test.mjs tests/security-audit.test.mjs tests/regressions.test.mjs`: 100 passed, 0 failed. These include upload identity/signature behavior, retry behavior, thumbnail replacement/removal, public data filtering, cross-origin admin rejection, and payment matching. Cloudinary and database operations in these tests are mocked; actual uploaded file access was not tested.

## Remaining verification

- Confirm deployed authenticated assets reject unsigned downloads and that any historical public copies have been removed. Application code cannot establish this by inspecting a URL alone.
- Confirm actual uploads through both transports and delivery of paid files against the configured Cloudinary account. No production requests or real payments were made in this review.
- Public upload validation checks filename and declared MIME rather than decoding file contents. It is behind admin authorization; this is a hardening opportunity, not a demonstrated unauthenticated leak.
- Replacing/removing assets retains old Cloudinary files. This preserves prior purchases, but is not storage erasure or revocation of previously public thumbnails.
