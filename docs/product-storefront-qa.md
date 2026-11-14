# Product storefront verification — 13 November 2026

This change adds reusable product pages and owner-managed content for every digital product. It retains the existing server-owned NGN pricing and verified-payment download flow.

## Validation

- Workspace: 133 automated tests passed; ESLint reported zero errors and zero warnings; TypeScript and the production webpack build passed.
- Isolated release source: 126 tests passed and ESLint/TypeScript passed. The remaining workspace tests belong to unrelated work excluded from this release.
- A disposable database schema held several photography products, fine-art products and an unpublished draft. The schema search path was asserted before any fixture writes. No fixtures were inserted into the live catalogue.
- Checked public API and server-rendered HTML projections for paid-file URL leakage. Public responses contain explicit storefront fields and a delivery-availability boolean, never the paid URL or creation key.
- Verified collection boundaries, unpublished and malformed product not-found pages, old-title canonical redirects, independent product edits, authentication/foreign-origin rejection, invalid private preview rejection and repeat-safe creation of a future product.
- Saved a product description through the actual admin interface and confirmed it appeared on that product page. A synthetic admin session was confined to the local preview.
- Browser checks covered 1440px desktop, 768px tablet and 390px mobile layouts, the existing light/dark themes, reduced motion, long product titles, empty optional sections, category filters, gallery thumbnails and the before/after slider’s keyboard controls. Mobile and admin pages had no horizontal document overflow.
- Mocked checkout failed once and succeeded on retry only when the request retained its key, correct product/collection and normalized buyer email. No real Paystack checkout or customer email was sent.

Screenshots are under `output/playwright/product-*` and `output/playwright/products-*` (ignored from deployment). The preview schema and local server are removed after verification.

## Content boundaries

Only authenticated admin mutations can write product content. Payloads and individual fields are bounded; owner text renders as text, not HTML. Public image fields allow approved public-image locations and reject authenticated paid files, API URLs and active URL schemes. Preview uploads are public and are labelled separately from the protected paid download.

No MELATONE specifications, licence statements or results were invented or published. Its live price remains ₦20,000. This pass does not include a real live payment, which the owner previously excluded.

## Brand revision

After owner feedback, strengthened the main site’s existing `--accent` red on checkout and mobile purchase buttons, catalogue actions, selected filters, active image borders, section rules and comparison controls. Kept the shared typography, theme variables, navigation and footer. White button labels preserve contrast without changing the brand colour. Lowered the mobile purchase bar below the navigation overlay. Rechecked desktop/mobile renders and rebuilt successfully; targeted lint remained clean.

Published release: `dpl_7MpR3tYd7pgqZe42nrAf4XiGwoPV`, aliased to `https://moyo-roan.vercel.app`. Read-only production checks confirmed photography contains MELATONE at ₦20,000, fine art has no digital products yet, the new product page contains the branded checkout, and no fixture content or private delivery URL is exposed. Inspected live desktop and mobile screenshots; no live payment was started.

## Product asset editing

Added upload/replace/remove controls for thumbnails and protected delivery files on existing products. Upload controls use the existing Cloudinary transport, requesting authenticated private delivery for paid files. The product retains its previous linked asset until upload succeeds and the owner saves. URL fields are under Advanced. Removing a thumbnail now persists an empty value and renders the public placeholder, rather than resurrecting the saved image. New-product thumbnails are optional too.

134 workspace tests passed, lint and TypeScript passed, and the production build passed. An isolated browser test exercised mocked thumbnail upload, replacement/save, removal/save and the public placeholder; price and delivery availability remained unchanged. A mocked private delivery upload asserted the private flag and saved its replacement URL through the real isolated admin API. No live assets, product prices or purchase records were changed during testing.

Asset-editor deployment: `dpl_BUU7VZUWdEonMQAU4aNsTHgGdg93`, production alias `https://moyo-roan.vercel.app`. Read-only live checks confirmed MELATONE retains its thumbnail, protected delivery availability and ₦20,000 price, with no paid URL exposed publicly. Final upload-first controls were inspected on desktop/mobile in the disposable preview.
