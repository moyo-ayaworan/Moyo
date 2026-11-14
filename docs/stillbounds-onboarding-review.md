# Stillbounds onboarding review — 11 November 2026

The desktop welcome panel and website account page now use the same sequence: Account → Verify email → Connect Mac.

## Changes

- Desktop: one browser-handoff action, a connection-code waiting state, visible account errors, activation retry, and collapsed saved-book/privacy controls. Existing offline viewing, saving, device management and licensing checks remain available.
- Website: desktop links begin with registration and an existing-account sign-in option. Successful registration opens a dedicated verification screen. The email callback retains the device code. Code review and explicit approval precede a return-to-app screen. Licence/payment/session controls are secondary.
- Password help is associated through `aria-describedby`; step changes focus the heading. Terms/privacy open separately to preserve form input. Expired-code errors leave approval unavailable.
- The website’s “Create your account” action opens registration directly.

## Verification

- Desktop test suite: 198 passed; TypeScript and production build passed.
- Website auth integration: passed using isolated SQLite and captured verification emails; covers verified sign-in, device ownership, approval, revocation and rejection.
- Browser UI fixtures: registration → verification → code review → explicit approval → return to app; callback preserves code; mobile view has no horizontal overflow. Expired-code recovery checked. These fixture tests do not send real emails or create production users.
- Native Electron fixture: signed-out screen, single primary action, collapsed book tools, waiting code, cancellation, connected account and activation retry passed.
- Screenshots: `output/playwright/onboarding-*`.

A separate Apple Silicon app is built under `/Users/ayaworan/Documents/mofolio/release-onboarding/mac-arm64/Stillbounds.app`; the existing release archive is not replaced. This is a local build, not a newly signed/notarized distribution. Intel packaging and actual mailbox delivery are outside this verification pass.
