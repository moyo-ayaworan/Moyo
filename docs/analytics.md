# Site analytics and sharing previews

The authenticated dashboard lives at `/admin/analytics`, linked from the admin landing page. It supports 7-, 30- and 90-day UTC calendar ranges, metric charts, country/page/referrer/device breakdowns, Stillbounds editions, paid shop sales and CSV exports. Traffic is new from deployment; verified live shop history comes from `payment_orders`. Dashboard screenshots used synthetic data, never seeded production metrics.

## Measurement

`AnalyticsTracker` records public pathname changes, including Stillbounds. It excludes private paths and honors DNT/GPC. The endpoint enforces origin checks, payload bounds, rate limits, event UUID deduplication, bot/prefetch exclusions and signed admin-session exclusion. No query strings, fragments, full IP addresses, email addresses or raw user agents are stored in analytics. Referrers retain only their host; SPA navigation is identified as internal.

A daily HMAC of the request IP and browser, using `ADMIN_SESSION_SECRET`, estimates daily visitors without an analytics cookie. Summing daily estimates does not measure distinct people across an entire range. Country comes only from Vercel's country header when deployed on Vercel; local/unknown geography is labelled Unknown. VPNs, shared networks, browser blocking and bot heuristics affect counts.

Stillbounds anchors redirect through `/api/stillbounds/download/arm64` and `/x64`. GET requests are recorded after the response; metric storage failures never block the file redirect. These are download requests, not completed transfers or app installations. HEAD and recognised preview/prefetch requests do not count. Existing external worker links bypass this site's metric.

Shop totals come from live digital orders currently marked paid, using paid timestamps and NGN amounts. Buyer counts deduplicate lowercased buyer emails within the selected paid-order range; only the count is returned. Download visitor estimates use the same rotating daily hashes as public traffic. Test payments and invoices are excluded; refunds/disputes are shown separately and excluded from current paid revenue. Pending totals use order creation dates. Payments are never inferred from client-side clicks. Country reporting applies to public traffic, not historical buyer geography.

Traffic has a 90-day window. `/api/analytics/cleanup` runs daily using the existing `CRON_SECRET`; dashboard reads also remove expired rows. Schema creation is automatic and idempotent. The cleanup endpoint rejects unauthenticated requests. No additional service credentials are required. Host/platform logs and existing security rate-limit records have their own policies.

## Sharing metadata

Use `createPageMetadata({title, description, path, image?})` on each public page. Without an explicit image, `/api/share` renders a 1200 × 630 branded card with page-specific text and public imagery resolved by `lib/sharePreview.ts`. CMS image changes feed subsequent renders automatically, with a five-minute image cache. Product pages use their product image in both OG and Twitter metadata. Exhibition pages use their own references when available; text cards cover missing imagery. Private routes never render a content card.

Extend the resolver when introducing a new content type. The public-route metadata regression test fails if a new page has no metadata at its own page/layout level. Social platforms maintain independent caches: existing posted messages may retain old thumbnails and platforms may need to fetch the page again. Never promise that old messages will change.

## Verification

`npm test`, `npx tsc --noEmit`, and `npm run build`. The analytics tests cover public-path privacy, tracking exclusions, matching OG/Twitter cards and route coverage. Implementation was additionally exercised against isolated PostgreSQL (PGlite) for idempotency, country reporting, visitor grouping, retention, daily aggregation, and excluding test/refunded/invoice payments. Browser QA covers both themes at desktop/mobile sizes, metric/range controls, CSV, empty and retry states. No production purchases or downloads were fabricated.

## Daily, weekly and monthly calculations

Choose Today, This week, This month, or a rolling 7/30/90-day range, then choose Daily, Weekly or Monthly calculation. Both the chart and calculation table aggregate the selected days. Tables include page views, summed daily visitor estimates, download requests, paid purchases and revenue, including zero-activity periods and a totals row. CSV exports follow the selected grouping. Weeks start on Monday. Current periods and boundary weeks/months are partial, labelled in the dashboard; monthly traffic still follows the 90-day retention window. Buyer counts are unique within the selected range, while visitor estimates rotate daily.
