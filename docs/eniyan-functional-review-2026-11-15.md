# Ẹnìyàn and customer-journey review — 15 November 2026

Scope: AI assistant behaviour and code in relation to Stillbounds, protected digital purchases, booking recovery, privacy and the current site. The owner required no design changes. This batch changes no stylesheets, CSS classes, colours, layout or existing visible form copy. New assistant guidance uses the existing chat interface.

## Findings and changes

1. **Stillbounds was missing from assistant navigation and knowledge.** The app has account, trial and activation flows, but the assistant's route map did not contain them. Added current public destinations, account guidance, and the distinction between local books/photos and separately published review previews. English account/activation support now uses deterministic guidance rather than letting the model invent private account status. No new AI account or payment tools were introduced.
2. **Digital-purchase recovery could point to the client gallery or booking portal.** The generic download/receipt fallback did not distinguish MELATONE and other shop purchases from commissioned photography. Added photography and fine-art digital recovery destinations and context-aware deterministic replies. These explain the actual recovery form and discourage duplicate payments while a charge is uncertain.
3. **Navigation destinations and public tracking needed separate allowlists.** Recovery and account screens can be useful chat links without becoming public page context. Private navigation destinations now remain excluded from analytics and provider page context. Query-bearing links and unknown routes remain excluded.
4. **Obvious customer contact details were not covered by the existing private-text filter.** Added email-address and explicitly labelled phone-number detection. Matching new messages are handled locally, and matching history is removed before model requests. This is pattern-based protection, not comprehensive personal-data detection; names, addresses and unusual formatting may still pass. Contact fields in the dedicated booking flow continue to go directly to the studio rather than the language model.
5. **Development and preview activity could use production telemetry channels.** A local browser visit triggered the existing owner session notification, and a stale development module error produced seven aggregate test events in the shared database. Added production-only guards for session notification email and persisted operational error counters. Regression tests verify that non-production requests cannot parse the session payload, invoke SMTP or persist operational counters. The seven known local test events were removed, preserving any additional events. No customer records were altered.
6. **Published photography prices were copied in multiple assistant strings.** Assistant knowledge and fallback quotes now derive from the same booking packages and extra-shooter estimate used by the booking forms. A regression changes a fixture package price and verifies both knowledge and the returned quote follow it.
7. **Search crawl metadata still referenced the old domain.** robots.txt now uses the same configured site origin as the sitemap. The default origin is moyoayaworan.com. Removed an obsolete fixed last-modified date rather than inventing a new update timestamp for every page.
8. **Booking accessibility and failed availability requests.** Connected the existing Phone label to its input, added name/email/phone autofill attributes, full calendar-date names and selected-state announcements for dates/times/packages. A stalled availability GET now times out after fifteen seconds and exposes the existing retry state. Submission behaviour, styling and visible copy are unchanged.

## Existing safeguards checked

- The model has no tools to query accounts, change bookings, charge/refund payments, activate devices or read private galleries.
- The separate deterministic booking flow requires an explicit confirmation click, uses actual availability, freezes uncertain submissions and retries the same booking key. Closing the chat does not discard an in-flight request.
- Request-body/message limits, chat rate limiting, provider timeouts, bounded response length and rejection of incomplete model responses remain in place.
- Caller-supplied page text and titles are not sent to Gemini. Allowed public route identities and the chosen language are the only page context.
- Assistant replies render as text, with separate allowlisted navigation buttons. Unknown links are not turned into navigation actions.
- Payment verification and download authorisation remain server-side; assistant text cannot unlock a purchase.

## Verification

- 167 automated tests passed, including new support-routing, contact-data, navigation/privacy separation and telemetry-isolation cases.
- TypeScript, focused ESLint and the production build passed.
- Mobile browser checks at 390 × 844 on production booking, commission and shop pages found no horizontal overflow or failed images in those checks. The booking Phone field lacked a label before the fix; the local candidate has zero unlabelled inputs in that form.
- Local browser interception stalled only the availability request. The calendar left loading and displayed the existing Try again control after timeout. No booking or purchase was submitted.
- Six synthetic HTTP probes against the local candidate returned 200. Stillbounds activation, MELATONE recovery and pasted-contact protection used guided replies. Three actual provider-backed probes refused an instruction to claim a refund/booking confirmation, declined to invent live availability, and correctly quoted the published family two-outfit base package at NGN 100,000 with six images and an online gallery. Synthetic probes contain no real customer details. Local evidence is in ignored output/ai-review/probes.json.
- Local robots and sitemap responses returned 200, contained no old domain, and omitted the stale August last-modified value.
- The stale development module error disappeared after restarting the development server. Runtime integration checks were completed after the restart.

## Limits and follow-up

This was a targeted functional/code review, not a guarantee against all model hallucination or a new full-site security certification. Three live model replies are a smoke check, not a statistical evaluation. English product/account guidance is deterministic; other languages retain the existing model and generic translated fallback behaviour. No live payment, refund, customer booking, customer recovery email or private gallery was exercised.

The release goes through the protected GitHub checks and Vercel production build. Existing production reliability monitoring remains active. Additional backups remain disabled at the owner's request.
