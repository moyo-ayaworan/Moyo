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
