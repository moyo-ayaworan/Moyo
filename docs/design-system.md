# Moyo site design system

Use this system for public pages, Stillbounds, account screens, private book reviews, and admin additions. Extend the nearest existing pattern before creating a new one.

## Sources of truth

- `app/globals.css`: global tokens, dark/light themes, and typography.
- `components/mofolio/mofolio.module.css`: Stillbounds page layouts and established product treatments. Its `--mf-*` aliases map directly to the global tokens.
- `app/stillbounds/account/account.module.css`: account cards, forms, buttons, consent, status notices, and compact review management.
- `components/studio/studio.module.css`: private review and studio components, using the same global tokens.

## Tokens

| Role                 | Token                          | Dark            | Light           |
| -------------------- | ------------------------------ | --------------- | --------------- |
| Page                 | `--background`                 | `#050505`       | `#fbfaf7`       |
| Text                 | `--foreground`                 | `#fafafa`       | `#080808`       |
| Secondary text       | `--muted`                      | `#888888`       | `#666666`       |
| Brand/action         | `--accent`                     | `#920110`       | `#920110`       |
| Card                 | `--surface`                    | `#111111`       | `#f1eee8`       |
| Border               | `--border`                     | `#222222`       | `#ddd7ce`       |
| Text on brand/action | `--on-accent`                  | white           | white           |
| Subtle interaction   | `--glass-bg`, `--glass-border` | Theme-dependent | Theme-dependent |

Reference variables in component CSS instead of duplicating these values. The active `[data-theme]` controls colors; components must inherit it. White paper and image colors inside book previews are media, not interface surfaces, and must remain faithful to the upload.

## Typography and controls

Use `var(--font-heading)` (Playfair Display and the existing serif fallbacks) for editorial headings, with light weight and restrained negative tracking. Use `var(--font-body)` (Inter and the existing system fallbacks) for body copy, forms, labels, navigation, and controls. Do not set Arial or a new typeface on individual screens.

Follow the account/product patterns: compact 12–14 px control text, clear 14–16 px reading text, fine borders, restrained 4–8 px corner radii, and the existing red for the primary action. Secondary actions use a transparent surface and a themed border. Primary actions use `--on-accent` for readable text. Focus rings use the accent with a visible offset. Status messages use a surface and an accent border, with meaningful text and accessible status/alert roles.

## Layout and verification

Reuse the nearest screen's widths, gutters, and spacing. Keep related inputs and actions together. Let columns stack on small screens; allow long receipt IDs, fingerprints, email addresses, and comments to wrap. Avoid decorative cards or motion that add no hierarchy. Respect reduced motion.

Before completing visible changes, inspect desktop and mobile in both themes, plus keyboard focus, errors, loading, empty, and success states. Preserve the preview image aspect ratio and test both covers and spreads.
