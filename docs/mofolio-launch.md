# mofolio website page — 13 October 2026

Implemented in the Moyo website at `/mofolio`, with a photography navigation link and sitemap entry. A dedicated product header links back to Photography. The page uses the mofolio brand’s neutral charcoal palette, Monza red accents, white/light-grey sections, real app imagery, a scroll-driven album assembly, a live website composition/crop study and a page-turning sample book. The website studies are demonstrations; they do not run the desktop editor or save projects. Mobile layout, keyboard focus and reduced motion are supported. The unrelated portfolio social/chat overlays are hidden on this route.

The page advertises demonstrated editing capabilities and clearly explains Apple Silicon-only beta support, installer size, unsigned release preparation, unannounced pricing, AI limitations and the absence of printing/delivery services. It uses a beta signup rather than an unavailable download URL. Current demo assets are four locally hosted WebP stock photographs plus the actual app screenshot; no Cloudinary uploads or installer uploads were performed.

## Beta requests

`POST /api/mofolio/beta` accepts a valid email and explicit consent, with a bounded body, honeypot, existing rate limiter and parameterized insert. The dedicated `mofolio_beta_requests` table is created on first valid request and is separate from the existing newsletters. Duplicate addresses are not added twice. It uses the site's existing database configuration; no new credentials are required.

`GET /api/mofolio/beta` requires the existing admin session. Sign in and open `/admin/mofolio` to see the latest 500 requests. No emails are automatically sent by the new beta feature. Contact links use the site's existing public email. Requests to leave the list currently require contacting the owner; a self-service unsubscribe link is not implemented.

## Verification

- Production Next.js build passed; `/mofolio`, `/admin/mofolio` and API route generated.
- All 79 existing site regression tests passed; targeted new-file ESLint passed.
- Playwright checks: layout navigation; all images loaded; 1440px desktop and 390px mobile; no mobile horizontal overflow; reduced motion; success/error signup states using intercepted responses.
- Live local API rejects invalid input (400) and anonymous list access (401).
- `node scripts/verify-mofolio-beta.mjs` tests route validation, parameterized storage, duplicate requests, honeypot, rate limit, admin gating and database failure against an isolated in-memory database adapter. It does not exercise real PostgreSQL.
- The initial local checks wrote no subscriber addresses. The later isolated preview smoke test exercised real PostgreSQL create/insert/read, duplicate suppression and authenticated admin access. Its single reserved `example.invalid` test address was deleted; cleanup was confirmed through the deployed API. See the continuation below.

The existing session tracker sent one visitor notification to the site's configured inbox on the initial local preview. Further preview requests were blocked in the test browser. Existing notification behavior is unchanged in production.

## Publishing

Local review: `http://127.0.0.1:3107/mofolio` while the preview server runs. The local changes have not been committed or pushed. An isolated Vercel preview is now deployed; production is unchanged. There are pre-existing unrelated website changes in this checkout; do not stage or publish them indiscriminately. Review the page and sample-image permissions before publication. Request a Vercel preview, verify real signup storage there, then deploy the approved release. Signing/notarization and download hosting still belong to the desktop distribution step.


## Continuation — isolated preview, 13 October 2026

- Preview: https://moyo-q7pzznfmf-ijabiken-moyosoreoluwas-projects.vercel.app/mofolio
- Deployment: `dpl_EADwUDvALhszfPBWgYbQobm2Xgpj` — READY; Next.js 16.3.7; remote build passed (30 seconds).
- Target verified: `ijabiken-moyosoreoluwas-projects/moyo` (`prj_2fAYT34MSGubrNtUvHvp9fJmWJY2`).
- Source prepared at `/tmp/moyo-mofolio-preview` from baseline `17cc703`, with only mofolio page/API/admin/assets, navigation/chrome/sitemap integration, and the required shared dependencies.
- Shared dependencies included: signed admin sessions (`lib/auth.ts`, `proxy.ts`, admin verify/logout routes), `lib/rateLimit.ts`, the rate-limit table and TLS verification changes in `lib/db.ts`, and current dependency upgrades/lockfile. The unrelated digital-orders schema, payment, gallery, upload and shop changes were excluded. The unrelated migration script entry was excluded from the preview package manifest.
- Added a generated sensitive `ADMIN_SESSION_SECRET` to **Preview only**. Production still needs its own signing secret before releasing this admin-session implementation.
- Local checks rerun: all 79 regressions, isolated beta route checks and targeted mofolio ESLint passed.
- Deployed smoke checks passed: `/mofolio` returns 200; invalid signup returns 400; anonymous list access returns 401; real admin sign-in succeeds; valid signup is stored; duplicate signup produces one record; authenticated API list and admin page work. The reserved test record was deleted with a parameterized query, and its absence was confirmed through the deployed API. No notification emails were sent by these HTTP-only tests.

Production release remains pending page/sample-image permission review and approval. Signing/notarization and installer hosting remain desktop distribution work.


## Brand and reference revision — 13 October 2026

Reviewed `https://layzbooks.com/` in the browser. Applied its useful product-demonstration principle: direct hero link to the layout examples, named composition choices, visible selection state, arrow-key navigation and live announcements. Mofolio retains its own layout, imagery, claims and beta access flow.

Brand authority: `/Users/ayaworan/Documents/mofolio/docs/brand.md`. Removed green-tinted UI and cream surfaces; aligned dark layers to `#121212`, `#1B1B1B`, `#252525`, `#333333`, white to `#FFFFFF`, light surfaces to `#F5F5F5`, and action accent to Monza `#CF0015`. Supporting credit now reads “by Moyo Ayaworan”; descriptor is “Intelligent photobook design.” System sans-serif and Georgia remain the documented temporary substitutes for Visby CF and Adelle; licensed font files are still unavailable.

Latest preview: https://moyo-5rgg7p1ba-ijabiken-moyosoreoluwas-projects.vercel.app/mofolio
Deployment: `dpl_CtsToB7iwRJSx8No2r6jom7vHRnk` — READY. Isolated remote build passed (18 seconds); targeted ESLint passed. Browser checks: 1440px desktop, 768px tablet and 390px mobile; screenshots inspected on desktop and mobile; no tablet/mobile horizontal overflow; composition buttons and arrow keys work; images loaded; reduced motion honoured. Preview notifications were intercepted during local browser QA. The local development console reports the existing site CSP blocking React’s development-only eval; the isolated preview excludes that unrelated CSP change.

Production remains unchanged. Use this latest preview for review.


## Motion and interaction revision — 13 October 2026

Studied Layzbooks’ public motion/demo source and tested the reference in an isolated browser: scroll-linked hero assembly, shuffle, crop panning, drag resize, remove/reset, forward/backward book turns, mobile layout and reduced motion. Reference crop panning changed image position, resizing changed frame proportions, and page controls advanced from cover to spread 1 and reversed correctly. Reference captures are under `output/playwright/layzbooks-*`.

Implemented an original mofolio motion experience in `components/mofolio/MofolioExperience.tsx`:

- Scroll-linked photographs settle into a white spread; desktop uses a sticky scene, mobile uses normal page flow, and reverse scrolling reverses the assembly.
- Three stable photograph elements animate between compositions using Motion’s layout transforms. Named numbered choices and arrow-key navigation remain available.
- Crop panning supports mouse and touch. A draggable resize handle and native range input adjust frame width; arrow buttons adjust vertical crop; reset restores both crop and size. These studies do not upload or save anything.
- The reader turns a hinged half-sheet with front/back faces, correct forward/reverse geometry and bounded page navigation. Upcoming spread assets are loaded ahead of the turn to avoid an empty sheet during loading.
- Reduced motion renders the assembled album directly, removes sticky spacing and sheet animation, and preserves all controls. The first client render matches the static server render before motion is enabled.
- Brand colours and documented temporary typography remain unchanged. No animation libraries or remote font/media services were added. Three sample JPEGs were copied from the existing mofolio wedding validation imagery; image permissions remain part of release review.

Validation: targeted ESLint, TypeScript and isolated production build passed. Local browser checks covered desktop (1440px), tablet (768px), mobile (390px), forward/reverse scroll, resizing, mouse crop/resize/reset, keyboard composition selection, touch crop/shuffle/page-turn, forward/reverse sheet turns and reduced motion. Tablet/mobile had no horizontal overflow. The isolated touch context reported no page errors. Screenshots of intermediate and final states were inspected. Local automated visitor notifications were intercepted. Existing signed-in Chrome was used to verify the deployed page visually; its native visit retains the site’s existing visitor tracking behaviour.

Latest preview: https://moyo-dw4y5ln2l-ijabiken-moyosoreoluwas-projects.vercel.app/mofolio
Deployment: `dpl_BQe6ViDKr5QKbp7P1cPYV6kmBEZv` — READY; remote build passed (approximately one minute). Production remains unchanged.

The automated protected-preview browser token had expired. Automatic approval review rejected pulling the full development environment because it would retrieve unrelated credentials. No environment pull or protection change was performed; the deployed page was checked through existing signed-in Chrome instead.


## Downloaded online imagery — 13 October 2026

Replaced the hero, composition playground and crop demonstration photographs with a curated online set by Jonathan Borba, downloaded from Pexels. Rebuilt the reader’s three book studies in HTML/CSS using the same stock set, with a landscape reception detail, so it no longer relies on the earlier personal-photo raster spreads. The actual editor screenshot remains unchanged. The page includes a visible photographer/Pexels credit and identifies the book as a website study.

Four selected assets total 772,870 bytes (754.8 KiB), in WebP, at 900–1200 pixels wide. They are served locally and require no runtime request to Pexels. Source pages, license link, checked date, dimensions, sizes and SHA-256 digests are recorded in `docs/mofolio-image-sources.md` and `docs/mofolio-image-sources.json`. The selected photos are covered by the Pexels License for this website-demonstration use; no endorsement by the pictured people is implied.

The isolated preview’s asset directory includes only the four selected stock photographs and `editor.webp`. Earlier personal-photo JPEGs and raster spreads are omitted from this latest deployment; original workspace files remain available.

Validation: targeted ESLint, TypeScript and isolated remote production build passed (41 seconds). Desktop (1440px) and mobile (390px) screenshots inspected; all image elements loaded; no horizontal overflow; shuffle and crop reset work; all three reader spreads, reverse navigation, final-page bounds and reduced-motion navigation pass. The deployed page and all four image assets return HTTP 200; deployed HTML contains the new photos and visible source credit.

Latest preview: https://moyo-6s6qc6t7b-ijabiken-moyosoreoluwas-projects.vercel.app/mofolio
Deployment: `dpl_8hq6VjnvVZhQ6GZgDxMJUzc8Q39s` — READY. Production remains unchanged. Remaining production steps: final page/app-screenshot review, production admin signing-secret configuration, and release approval.


## Brand correction after landing-page redesign

Re-read the product brand authority at `/Users/ayaworan/Documents/mofolio/docs/brand.md`. Restored the prescribed charcoal layers, white/light-grey surfaces and Monza actions; removed gold, cream and tinted backgrounds. Restored Georgia as the temporary editorial typeface alongside system sans-serif. Applied the guide’s current displayed name, Stillbounds, while retaining the `/mofolio` URL, API paths and integration identifiers. Kept the redesigned page structure and interactive demos. The hero album now uses the same credited local stock photographs as the other website studies instead of the earlier personal-photo raster spread.


## Stronger motion pass

Replaced the static hero collage with a scroll-linked photo-to-album sequence, including staggered photograph motion and a progress line. Added masked line-by-line headline entrances, delayed feature reveals, a scroll-linked editor perspective reveal and responsive shuffle/hover feedback. Motion uses the existing Framer Motion dependency and transform/opacity values; there are no per-frame React state updates or new external assets. Mobile assembly uses normal document flow. Reduced motion renders the assembled spread, disables sticky pacing and skips the added transitions. Targeted ESLint and TypeScript checks pass. Desktop forward/reverse assembly and interactive shuffle were checked in Chrome.


## Cinematic album chapters

Added a two-stage hero: staggered photographs fly into a spread, then its hinged left page closes into a charcoal cover with visible page edges and a scroll-linked camera tilt. The editor showcase opens a photographic spread outward to uncover the actual app screenshot. Shuffle uses staggered spring layout transitions. A decorative hinged last-page overlay reveals the beta invitation; it cannot receive pointer events and disappears when the signup section receives keyboard focus. Mobile uses the flat photo assembly and screenshot reveal without long sticky pacing or folding overlays. Reduced motion retains static artwork and all interaction controls. No dependencies or external media were added. Targeted lint/TypeScript checks pass; desktop closed-book and beta completion states and the 390px mobile layout were inspected in Chrome.

The final mobile reload confirmed all three assembly images render. Assembly photographs use the existing compressed local WebP files directly to avoid the blank optimized-image frame observed during live resizing. The spring shuffle updates the selected composition correctly.


## Mobile cinematic parity

Enabled book folding, editor opening and the invitation page turn on mobile. Mobile keeps a shorter 140svh assembly stage, smaller book camera angles and a 290px invitation leaf that leaves the form accessible. Reduced-motion settings continue to disable nonessential 3D motion. Mobile book folding was visually confirmed at 390px; targeted lint and TypeScript pass.
