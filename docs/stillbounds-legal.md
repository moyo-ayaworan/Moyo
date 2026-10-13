# Stillbounds terms and privacy implementation

Local effective date: 13 October 2026. Policy version: `2026-10-13-v1`.

- Terms: `/mofolio/terms`; privacy: `/mofolio/privacy`.
- Operator/contact: existing Moyo Ayaworan, Nigeria, `ijabikenm@gmail.com`, as authorised by the user. No invented company registration, street address or database-provider location.
- The public signup requires terms agreement and independently offers unchecked, optional product marketing consent. The privacy notice is linked before the choices.
- The API records terms version/time, privacy version, marketing preference and (only if opted in) marketing version/time. Existing rows receive marketing=false, without retroactively accepting new terms. A legacy consent_version remains for compatibility.
- Duplicate requests do not overwrite preferences. The UI explains that an existing participant must contact the operator to change them. Withdrawal is by email; no email is sent automatically by signup.
- Admin list distinguishes opted-in recipients and legacy requests. Never send marketing to every beta requester.
- Schema additions are idempotent and run on the next valid signup or authorised admin read. Verification uses an isolated in-memory adapter; no real subscriber records were created for testing.
- Automatic SessionTracker visit emails and the chatbot are excluded from `/mofolio` and its legal descendants. General site privacy text was corrected to disclose visit-email notifications on other routes.

## Update before a public release

The user asked to use existing identity/contact details and update them later. Confirm the full legal operator name and business/residential contact address. Confirm the actual PostgreSQL provider, processing locations, log/backup retention and lawful international-transfer safeguards. The notice currently describes recipient categories and purpose-based retention; do not claim a verified residency guarantee.

Assign responsibility for manual withdrawal/deletion requests and periodically reviewing inactive waitlist records, support correspondence and security-log retention. There is no automated cleanup or unsubscribe portal added here. Do not promise a specific automated deletion deadline.

Review the desktop binary's actual data flows and supply release-specific privacy disclosures before beta installation, especially client links, sync, telemetry or external AI. This website notice explicitly limits its scope; it does not certify the desktop app.

Have the legal text reviewed before public release, including consumer protections and licence provisions. Paid checkout, renewal, cancellation and refund policies must be supplied before selling; no paid service or recurring payment is created by joining this list.

## Primary references checked

- Nigeria Data Protection Act 2023, particularly notice, lawful basis, rights and transfers: https://ndpc.gov.ng/wp-content/uploads/2024/03/Nigeria_Data_Protection_Act_2023.pdf
- Federal Competition and Consumer Protection Act 2018, including unfair contract terms and mandatory consumer remedies: https://fccpc.gov.ng/wp-content/uploads/2022/07/FCCPA-2018.pdf

## Validation

Targeted ESLint and TypeScript passed. The isolated beta API checks cover required terms, optional marketing, invalid preferences, recorded versions, opt-out migration defaults, duplicate preservation, rate limiting, bot-field handling, admin gating and database failure. All 79 existing regression tests pass.
