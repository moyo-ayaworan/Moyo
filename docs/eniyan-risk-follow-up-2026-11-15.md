# Ẹnìyàn residual-risk fixes — 15 November 2026

This follow-up supersedes the corresponding open items in the earlier audit and threat model. Gemini remains enabled. The owner questioned removing Gemini and adding booking email verification, so neither a deterministic-only default nor an email-code step was introduced.

## Changes

### Keep conversational AI, constrain factual authority

`app/api/eniyan/route.ts` now requests structured JSON containing conversational text and one to three allowlisted source pages. The server validates both fields, rejects missing/unknown sources, appends source destinations the answer did not already contain, and retains the previous unsafe-link/private-data/action-claim checks. The UI distinguishes an AI suggestion from automatic site guidance.

Prices, policies, payment questions and live-state requests are handled with application-owned guidance rather than model-generated promises. Generated quantitative claims, currency amounts and common operational/policy assertions are rejected in favour of site guidance. Published photography prices still derive from `lib/bookingRates.ts`; private availability, checkout and account status remain owned by their real flows.

Gemini still handles natural questions, follow-ups and qualitative service comparisons. A synthetic live local request successfully returned `mode: ai`, compared individual portraits with family photography, and supplied valid public source paths. The structure follows [Google's structured-output API documentation](https://ai.google.dev/gemini-api/docs/structured-output?lang=rest).

A source path is a navigation aid, not proof that every generated sentence is true. Structured output constrains format, not semantics. This reduces misinformation risk; it does not make arbitrary language-model text infallible.

### Improve private-data detection without adding a booking step

`lib/privacy.ts` recognizes common labelled names and addresses in several languages, common street-address forms, encoded/Unicode disguises and previously covered secrets/contact details. Client and server check recent user turns together for split disclosures. Already detected private history is scrubbed before these combined checks, allowing a visitor to continue with a safe question.

No new transcript store or private-account retrieval was added. Detection is still pattern based: unlabelled names, unusual addresses and other languages/formats can pass. Gemini use is disclosed in the chat; dedicated booking/account/payment forms remain the place for personal details.

### Bound anonymous booking abuse across IPs

`app/api/bookings/route.ts` now applies shared Postgres-backed creation budgets after matching an existing idempotent request:

- Existing IP quota: five attempts per hour.
- Per booking email: three new attempts per day.
- Per normalized phone number: three new attempts per day.
- Site-wide: 100 new attempts per day by default. `BOOKING_DAILY_LIMIT` can set an integer from 1 to 10000; invalid values retain the default.

Rotating IP addresses therefore cannot produce unlimited new booking requests or email attempts. Failed/conflicting attempts can consume these abuse budgets; a successfully saved identical-key retry is returned before the new budgets. Both booking interfaces include a non-focusable honeypot. Cross-site browser submissions are rejected. These checks run on the server; bypassing the visible form does not bypass the budgets.

A fresh chat submission that receives a definite 429 remains editable and says that attempt was not saved. A 429 during an already uncertain retry keeps the original request frozen, because a previous attempt may already have saved.

These are abuse limits, not verified-human identity. A distributed attacker can still consume a finite budget or occupy slots. Avoiding that altogether would require stronger admission such as a challenge or contact verification, which would change the customer flow. No such step was added. Limits may also affect legitimate high-volume/shared-contact use; studio contact remains the fallback.

### Durable booking-link recovery

New modules: `lib/bookingRecovery.ts` and `lib/bookingRecoverySchema.ts`. The application initializer adds `booking_recovery_outbox` and its pending-job index; no existing booking/customer column is removed or rewritten.

The public recovery handler now persists an hourly-deduplicated job before returning its generic success response. It does not look up a booking or send SMTP in the acknowledgement path. If persistence fails, it returns a private 503 and does not acknowledge success. IP limits, cross-site rejection and a site-wide 500-enqueue-attempt daily budget bound public queue growth.

The worker:

1. Claims eligible jobs with `FOR UPDATE SKIP LOCKED`, a lease and exponential backoff.
2. Looks up the requested reference and email. Unmatched jobs are discarded without emailing or spending the matched-recipient delivery budget.
3. Atomically records recipient cooldown admission and job admission in one SQL statement. Retries of an admitted job do not spend that budget again.
4. Emails only the address stored on the matching booking, with the canonical site origin and a stable message ID. No bearer token is stored in the outbox.
5. Marks completion only after SMTP acceptance. Transport/worker failure leaves the job available for retry after its lease/backoff.

Delivery is attempted after the acknowledgement and by the existing authenticated `/api/payments/maintenance` job. Deferred deliveries make that maintenance run unhealthy instead of producing a silent success heartbeat. No new public worker endpoint was added. The existing Vercel maintenance schedule is daily; a request interrupted before its immediate delivery can therefore wait until the next scheduled run. Eligible recovery jobs expire after two days and queue data is pruned after three days, including when SMTP is unconfigured.

SMTP provides at-least-once delivery semantics. A crash after mail acceptance but before the database acknowledgement can cause a repeated email; the stable message ID helps threading/deduplication but does not guarantee exactly-once inbox delivery. The durable queue does not silently create a second booking or payment.

## Verification and release notes

- Automated coverage includes structured/unsourced replies, fabricated amounts and policies, labelled/split private text, recipient/phone/global budgets, honeypot/cross-site rejection, rate-limit uncertainty, durable enqueue failures, SMTP retries, modeled concurrent job claims, missing SMTP, recovery deduplication and unhealthy maintenance reporting.
- 195 automated tests, TypeScript, focused ESLint, whitespace checks and the webpack production build passed. Mobile browser checks verified source-link rendering, no horizontal overflow and the existing booking steps with the honeypot excluded from keyboard focus. Browser fixture responses were intercepted and no booking was submitted.
- Live Gemini smoke test used synthetic non-personal text through the local app. No real booking, recovery email, purchase, payment or activation was submitted.
- Existing audit/threat documents describe the earlier snapshot. This follow-up closes the non-durable recovery item and adds source/abuse controls; it does not erase their limitations around bearer links, proxy configuration and arbitrary model/PII detection.
- No release was requested. Deploying the code will use the additive outbox schema through the existing initializer and the existing authenticated maintenance schedule; verify SMTP and scheduled-worker operation in the deployed environment.
