# Billions: first working slice

## Product direction

An approachable conversation beside a reviewable result. Help employees complete work before offering to turn it into a routine. Current customer demand is an accepted product assumption; customer interviews are not a prerequisite.

## First workflow

Upload a weekly transaction CSV → validate inputs → calculate metrics in code → prepare a report → inspect checks and sources → download → optionally save the configuration as a routine.

The initial CSV contract is `date,description,category,amount`. Dates use YYYY-MM-DD. Amounts are AUD with at most two decimal places: positive for income, negative for expenses. One file covers at most seven consecutive calendar dates. Reject malformed records rather than silently omitting them. Preserve the original file. No external writes or sending.

## Interface prototype (this implementation)

- Responsive workspace with conversation, report preview and verification details.
- Working sample and local CSV upload, deterministic financial calculations and download.
- Run history and routine preferences stored locally in this browser; no uploaded source data is retained in history.
- Clearly identified template-generated narrative; no AI service is connected.
- Accessible controls, visible errors, drag and drop, mobile navigation and keyboard support.
- No authentication, tenant security, database, cloud file storage, scheduling or third-party integrations are claimed by this prototype.

## Production foundation (next implementation)

1. Authentication and business membership, with server-enforced tenant isolation from the first stored record.
2. PostgreSQL for runs, versioned routine definitions and audit records; private object storage for source files and outputs.
3. Server-side schema and file validation, upload limits, retention policies and signed file access.
4. Durable execution with queued, running, validating, completed, failed and cancelled states; idempotency and resumable work.
5. One model provider through a backend gateway. Send only necessary data; validate narrative claims against calculated metrics. Never expose provider credentials to the browser.
6. Explicit permissions and approvals for any future external action. Published routines never grant access to their underlying resources.

## Acceptance criteria

Correct integer-cent financial calculations; invalid records stop processing with actionable errors; original source is unchanged; checks distinguish input validation from output preparation; completed reports download correctly; run history survives refresh; routine configurations can be reused; production build and browser workflow pass.

Production readiness additionally requires cross-tenant access tests, secure upload/storage tests, provider failure handling, retention/deletion, durable execution and real authentication. Local browser persistence is a prototype convenience, not an implementation of business security.

## Deferred

Additional providers, OAuth business integrations, inferred memory, automatic routine detection, scheduled execution, desktop companion, personal passport portability and team routine publishing.
