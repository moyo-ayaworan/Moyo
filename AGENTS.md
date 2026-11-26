<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Release workflow

When the user asks to push, deploy, or publish an update, update both the GitHub repository and the Vercel production site. Keep both on the same source revision and report the result for each. This is the user's standing preference; do not ask again unless a concrete blocker or conflict requires their input.

## Site design system

Use the existing Moyo design system for all UI work, including private review, account, and admin flows. Read `docs/design-system.md` before changing visible UI. The source of truth is `app/globals.css`, with established Stillbounds patterns in `components/mofolio/mofolio.module.css` and `app/stillbounds/account/account.module.css`.

Reuse the shared color and typography variables, existing components, button/form treatments, and responsive spacing. Support both light and dark themes. Do not introduce a separate palette, hardcoded UI colors, or substitute fonts. Preserve original colors in uploaded previews and other media. Verify new screens in both themes and at desktop and mobile sizes.

## Sharing previews and analytics

Every new public page must use `createPageMetadata` from `lib/seo.ts` with its own title, description and canonical path. The helper creates a page-specific sharing card; extend `lib/sharePreview.ts` to use that page’s public CMS imagery when applicable. Dynamic product/detail pages must set both Open Graph and Twitter previews through the helper. Never expose private/client media in sharing cards. Keep preview metadata aligned with content updates.

Public navigation is tracked centrally by `AnalyticsTracker`; register new public paths in `analyticsPath` without allowing private identifiers, query strings or tokens. Keep shop purchases sourced from verified live `payment_orders` and label download requests accurately. Preserve the dashboard’s privacy exclusions, 90-day retention and design tokens.

## Shop integrity

Keep all prices, coupon eligibility, shipping charges and stock calculations authoritative on the server. Digital checkout rejects quantity/shipping fields; physical checkout requires positive bounded integer quantities and configured shipping. Preserve coupon/stock reservation locks, exact payment verification, retry identity and idempotent fulfilment. Never expose physical delivery details in public product APIs, analytics or provider metadata, and never grant digital download access to a physical order. Extend the checkout/API and concurrency tests when changing these flows. Shipping fees and destinations are the operator's configuration; do not invent or enable rates.
