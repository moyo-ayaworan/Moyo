# Reliability operations

Scope: error monitoring, payment/receipt recovery, isolated load checks and release gates. The owner explicitly chose to skip all additional backups on 15 November 2026. No database or media backups are scheduled or uploaded by this work. Cloudinary remains the original media store; no duplicate media is created.

## Production behavior

- Vercel's build command runs regression tests and TypeScript before the Next.js production build. This gate also covers CLI deployments.
- GitHub runs `verify` and a `performance` job on main pushes and PRs. The latter uses a disposable PostgreSQL 17 service with synthetic data and refuses non-loopback database hosts.
- Daily payment maintenance also drains saved newsletter jobs and checks unresolved shop and invoice payments, performs a bounded Stillbounds reconciliation pass using the existing fulfilment validation/locking, retries the receipt outbox and records completion. Partial provider failures return HTTP 503.
- Next.js request errors and handled payment/download/Stillbounds server errors produce safe event logs. Hourly aggregate counters contain event names and counts, without customer records, raw error messages, request URLs or tokens. Counters expire after seven days when errors are recorded.
- `/api/operations/health` requires a separate monitor secret. GET checks database connectivity; POST records the independent monitor's successful completion. Unauthorized callers receive 401.
- The private `moyo-operations` repository runs an hourly monitor using a restricted read-only database role. It checks recent server errors, overdue receipt notifications, live payments needing review/dispute handling, overdue verification attempts for pending shop/Stillbounds checkouts, failed or missing maintenance completion, and authenticated application/database availability. Counts are aggregate only. The check uses last verification-attempt time, so an abandoned checkout that maintenance has already checked does not become an alert solely because it is old.
- A failed check sends an alert to the configured owner through SMTP. The monitor can trigger the authenticated, bounded application email-retry endpoint for already queued customer mail; it does not read customer addresses or send campaigns itself. Alerts may repeat hourly while a problem remains. SMTP acceptance does not prove inbox placement.
- A daily Vercel watchdog detects absence of a successful independent monitor run within 26 hours and alerts the owner. GitHub monitoring and Vercel watchdog scheduling are separate, but simultaneous failures of both remain possible.

The private workflow pins `SOURCE_REVISION` to a reviewed full commit SHA. Keep that variable aligned with deployed source. Production credentials are never placed in the public repository or its workflows. The monitor role can SELECT only payment_orders, payment_notifications, stillbounds_license_orders, operations_runs, operations_checks and operations_failures. It cannot change customer records.

## Load-check limits

The synthetic check submits forty concurrent retries of one checkout key, 120 distinct checkout reservations, 200 catalog queries and 24 simultaneous one-MiB upload-body reads. It verifies one order per idempotency key and rejection above the four-MiB upload-body limit. Its four-connection pool bounds database pressure. p50/p95/p99 measurements include queueing.

This is a component/database concurrency baseline, not a production capacity promise. It does not load Paystack, Cloudinary, SMTP or real customer data, nor simulate a complete hosted checkout or CDN upload. External providers need their own test-mode capacity exercises if observed traffic warrants them. No production load traffic is generated.

## Incident handling

1. Open the private Actions run linked in the alert and inspect aggregate failures.
2. Check Vercel runtime logs for `request_error`, `payment_error`, `download_error`, `stillbounds_error`, `payment_maintenance_failed` and `operations_watchdog_failed`.
3. Review original payment references through the authenticated admin ledger. Reconcile before asking a customer to pay again. Never paste private links, customer data or credentials into public issues.
4. For unsent receipts, check SMTP and the durable outbox. Re-run authenticated maintenance only after fixing the underlying problem.
5. For monitor failures, check database grants, the production monitor secret, GitHub scheduling and the pinned source revision. For database loss, inspect the provider's actual recovery options; additional backups were declined and no recovery guarantee is made here.

## Video checklist

| Topics in the supplied video | Applicability to this work |
| --- | --- |
| DNS, reverse proxies, load balancing, horizontal scaling, DDoS protection | Primarily managed by hosting; no new infrastructure or account-level protection claims. |
| CORS, OAuth, SQL injection, XSS, rate limiting, secrets, JWT rotation | Existing application/authentication boundaries and earlier audit reports; this task is not a fresh certification of every security control. |
| Timeouts, retries, cron jobs, webhooks, idempotency, race conditions, deadlocks, exponential backoff, queues | Existing payment safeguards, now complemented by maintenance completion monitoring, receipt alerts and Stillbounds reconciliation. |
| Indexes, N+1 queries, connection pooling, p99 latency, memory, backpressure | Synthetic database/query/upload baseline and bounded workers; tune further from measured production evidence. |
| CI/release gates, feature flags, canary releases, circuit breakers, dead-letter queues | Automatic test/build gates added; existing checkout enablement flags retained. No new canary, breaker or dead-letter service introduced. |
| Docker, Kubernetes, API gateways, WebSockets, pub/sub, TCP/UDP | Not required to ship these reliability changes. Docker is used only by isolated CI PostgreSQL. |
| Distributed locks/transactions, saga pattern, eventual consistency, CAP theorem, leader election, network partitions, clock skew | Relevant design concepts, not a mandate for extra distributed infrastructure. Current financial state remains transactionally controlled in PostgreSQL. |
| Backups, disaster recovery, chaos engineering | Additional backups explicitly declined. Failure-path regression checks and independent watchdogs added; no disaster-recovery drill or chaos program claimed. |

## Verified evidence (15 November 2026, Africa/Lagos)

- GitHub run 43653960801 passed 161 regression tests, TypeScript and the isolated PostgreSQL load job. The load job performed 384 operations with a four-connection pool: 121 unique orders, forty retries producing one order, p50 33 ms, p95 100 ms and p99 110 ms. These are runner measurements, not internet or production latency.
- Production health returned 401 without the monitor credential and 200 with it.
- Authenticated production maintenance returned 200: seven payments checked, zero failures and zero queued receipts. No payment was created or charged by this check.
- Private monitor run 43653996623 exercised an alert condition and Gmail SMTP accepted the owner-only alert. This does not certify inbox placement. The initial stale-checkout warning was refined to use verification timing rather than checkout age.
- GitHub main protection requires both `verify` and `performance`, including administrator pushes. Vercel runs regression tests and TypeScript before each production build.
- Backup role and secrets were removed after the owner declined all additional backups. No database/media archive was created or uploaded.
