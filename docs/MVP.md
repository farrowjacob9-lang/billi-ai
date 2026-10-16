# Billions: first working slice

## Product direction

An approachable conversation beside a reviewable result. Help employees complete work before offering to turn it into a routine. Current customer demand is an accepted product assumption; customer interviews are not a prerequisite.

## First workflow

Upload a weekly transaction CSV → validate inputs → calculate metrics in code → prepare a report → inspect checks and sources → download → optionally save the configuration as a routine.

The initial CSV contract is `date,description,category,amount`. Dates use YYYY-MM-DD. Amounts are AUD with at most two decimal places: positive for income, negative for expenses. One file covers at most seven consecutive calendar dates. Reject malformed records rather than silently omitting them. Preserve the original file. No external writes or sending.

## Interface prototype (first implementation)

- Responsive workspace with conversation, report preview and verification details.
- Working sample and local CSV upload, deterministic financial calculations and download.
- Run history and routine preferences stored locally in this browser; no uploaded source data is retained in history.
- Clearly identified template-generated narrative; no AI service is connected.
- Accessible controls, visible errors, drag and drop, mobile navigation and keyboard support.
- No authentication, tenant security, database, cloud file storage, scheduling or third-party integrations are claimed by this prototype.

## Production foundation

Status as of 17 Oct 2026. ✅ built and tested · ◐ partly · ○ not started.

1. ✅ Authentication and business membership, with server-enforced tenant isolation from the first stored record. Email and password (scrypt), hashed session tokens, failed-login throttling; every tenant query filters on the session's business and runs under Postgres row-level security. Gaps: no email verification, password reset, invitations or business switching yet.
2. ◐ PostgreSQL for runs, versioned routine definitions (insert-only rows with a `definition`) and audit records. No object storage: by decision, source files are never kept, so there is nothing to store yet. Outputs are regenerated from the stored report.
3. ◐ Server-side schema and file validation and upload limits: the server re-validates and recalculates every CSV. Retention policies and signed file access are not built (no files are retained).
4. ○ Durable execution. Reports finish in one request today, so there is no queue, run state machine or resumable work; build this alongside scheduled routines.
5. ✅ One model provider through a backend gateway (`src/server/ai.ts`). Only calculated totals are sent. The model cites figures by placeholder and code fills in the exact values; replies with any self-written number, comparison or wrong direction fall back to the template. Credentials never reach the browser. Per-business and deployment-wide daily caps; server-side refusal fallback enabled. Known gap: the check can't catch a placeholder used in the wrong sentence (say, calling {expenses} income).
6. ○ Explicit permissions and approvals for any future external action. Nothing external is written or sent today.

## Acceptance criteria

Correct integer-cent financial calculations; invalid records stop processing with actionable errors; original source is unchanged; checks distinguish input validation from output preparation; completed reports download correctly; run history survives refresh; routine configurations can be reused; production build and browser workflow pass.

Production readiness additionally requires cross-tenant access tests (done: `tests/db.test.ts`, `tests/browser/accounts.spec.ts`), secure upload/storage tests, provider failure handling (done: failures, refusals and unverifiable replies fall back to the template), retention/deletion, durable execution and real authentication (done, without verification or reset). Local browser persistence is a prototype convenience, not an implementation of business security.

## Deferred

Additional providers, OAuth business integrations, inferred memory, automatic routine detection, scheduled execution, desktop companion, personal passport portability and team routine publishing.
