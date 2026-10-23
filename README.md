# Naxium workspace

A spreadsheet-first business workspace: upload Excel/CSV, ask bounded questions, inspect calculations and source rows, review answers, export, and explicitly save work for later.

## Current features

- XLSX/CSV uploads with sheet selection and a source preview. Excel parsing runs transiently on the server; CSV parsing runs in the browser.
- Claude translates questions into a validated query. Code calculates totals, averages, extrema, counts, grouping and matching rows. Unsupported questions are declined rather than approximated.
- Simple total/average/count helpers work without an AI connection.
- Excel and PDF exports with source/conversation/review information.
- Optional saved workspaces: parsed cells, questions, answers, query plans and separate user review decisions. Save is explicit; unsaved work stays temporary.
- Cloud saved work uses tenant-isolated Postgres; browser-only mode uses IndexedDB. Saved work expires 30 days after the most recent save. Expired cloud records are removed when saved work is listed and by the optional worker.
- Saved calculations can run on demand; daily/weekly schedules require the optional Inngest worker. They use the saved snapshot, not fresh external data. No outbound routine emails are sent.
- Naxium light/dark theme and branded Resend account email templates.
- Daily AI allowance and per-business token/failure activity. Dollar-cost estimates are not asserted without verified model pricing.
- The original weekly CSV report, run history and manual weekly report formats remain available.

## Setup and rollout

See [docs/NAXIUM-SETUP.md](docs/NAXIUM-SETUP.md) for exact database, Vercel/domain, Resend and optional Inngest steps, rollout order and remaining work. The retired construction repository and hosting have not been modified. Existing accounts remain on the current Postgres system.

Cloud saves require migration `005_workspaces.sql`; the rest of the interface still works before it is applied. There are no production credentials in this repo. Configure keys privately in the host.

## Local development

Requires Node 24.x and npm.

```sh
npm ci
npm run dev
```

The default is browser-only mode without `DATABASE_URL`. Set `ANTHROPIC_API_KEY` and explicitly enable `BILLIONS_ANONYMOUS_AI=on` only for a controlled model demo. A deployed account application uses `DATABASE_URL` and authenticated AI access. See `.env.example`.

For Inngest local development run its dev server separately and sync `/api/inngest`. Local development events are routed to the dev server, not Inngest Cloud. Never use production database credentials for local development; development worker routing does not isolate database writes.

## Postgres

Migrations live in `db/migrations/` and run once in order:

```sh
npm run db:migrate
```

Use an owner's direct connection via `DATABASE_MIGRATION_URL` for migration. The running app must use a pooled `DATABASE_URL` for a role without superuser/BYPASSRLS; it refuses tenant access otherwise.

Example initial app-role setup, performed privately as owner:

```sql
CREATE ROLE billions_app LOGIN PASSWORD '<strong private password>' NOSUPERUSER NOBYPASSRLS;
GRANT USAGE ON SCHEMA public TO billions_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO billions_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO billions_app;
```

Existing role/cookie/environment names retain the Billions prefix for compatibility. Do not replace a working application connection with an owner URL pulled automatically by a provider integration. On Neon, leave the unused Data API disabled and preserve the grant restrictions from migration 003.

## Limits and input handling

Files and extracted workbook: 2 MB. Each sheet: 10,000 rows, 60 columns, 100,000 cells. Up to 20 worksheets and 20 MB declared expanded ZIP size. Unique headings belong in row 1. Formula cells require export as values or CSV. Blank/mixed-text cells in an aggregation cause an error rather than silently becoming zero. Numeric values keep their source units; mixed currencies are not converted.

Weekly report columns are `date,description,category,amount`, with real YYYY-MM-DD dates across at most seven consecutive days. Amounts are AUD, positive income and negative expense, with at most two decimal places. This summary is not a profit-and-loss statement or bank balance. General spreadsheet questions can cover longer periods.

## Validation

```sh
npm run typecheck
npm test
npm run eval:spreadsheet
npm run test:e2e
```

Tests include isolated Postgres row-level security via PGlite, snapshot validation, exact spreadsheet calculations, real Excel uploads, answer review, save/reopen/delete, themes and Excel/PDF downloads. Existing full auth/database suites additionally require `TEST_DATABASE_URL` / `E2E_DATABASE_URL` against a test database. Browser provider responses are simulated. The 25 offline execution fixtures do not grade live language interpretation.

Browser tests build the application first and use system Chromium when available, otherwise Playwright's browser (`npx playwright install chromium`). CI runs on Node 24.

Privacy/terms remain drafts pending operator details and review. No subscription billing, bank integrations, Firebase-account migration, construction engine or automatic external actions were copied into this product.
