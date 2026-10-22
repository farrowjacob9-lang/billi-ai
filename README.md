# Billions

## Spreadsheet questions (23 October update)

Upload an `.xlsx` workbook or `.csv`, select a worksheet, then ask questions using its column headings. Examples: `total Amount`, `average Amount`, `sum Amount by Category`, `count rows where Category equals Travel`, or `show the five lowest Amount transactions`. Multi-month data is supported; the seven-day restriction only applies to the separate **Prepare weekly report** action.

Claude translates questions into a restricted query; code validates the query and calculates the answer. Replies name the source sheet, matching row count, filters and any result limit. Excel uploads are parsed transiently on our server; CSV uploads are parsed in the browser. Spreadsheet rows are also sent to our server for AI questions, but only headings and user questions go to Claude. Simple totals, averages and row counts work locally without AI. Natural-language questions require the existing AI configuration and, in accounts mode, sign-in and AI allowance.

Limits: 2 MB file/extracted sheet, 10,000 rows, 60 columns, 100,000 cells, 20 worksheets and a 20 MB expanded workbook. Put unique headings in row 1. Use numeric cells or plain numeric CSV values (thousands separators supported when properly quoted). Blank or non-numeric cells in a calculation cause an explicit error, rather than silently counting as zero. Amounts keep their source units; mixed currencies are not converted. Export formulas as values or CSV first: cached Excel formulas are rejected. Older `.xls` files, joins, forecasts and arbitrary spreadsheet formulas aren't supported.

Spreadsheet attachments and their question history are held in the active tab only. They are not saved to report history, and refresh/new conversation removes them. Weekly reports can still be prepared and saved through the separate button, using the CSV contract below.

Validation: `npm test`, `npm run typecheck`, `npm run test:e2e`. The spreadsheet browser suite uses real generated Excel workbooks and a fake provider; live Claude and production database checks still need the deployed environment.

A browser-first AI workspace for useful conversations, verified reports and repeatable work. The first workflow turns a weekly transaction CSV into a checked report, built with Next.js 16, React 19 and TypeScript.

## Run locally

Requires Node.js 24 (tested on 24.19.0; 22.x also runs the tests) and npm.

```sh
npm ci
npm run dev
```

The app listens on port 3000. With no environment variables it runs as a browser-only prototype. Copy `.env.example` to `.env.local` to turn on accounts or Claude.

## Three modes, chosen by environment

| Mode | Set | What happens |
| --- | --- | --- |
| Browser-only | nothing | CSV processed in the browser; history and routines in local storage; template narrative and keyword chat helpers. |
| Browser-only + Claude | `ANTHROPIC_API_KEY`, `BILLIONS_ANONYMOUS_AI=on` | As above, but the browser sends the calculated totals (never transactions) to the server, which asks Claude for the takeaway and chat replies. For demos: the per-IP limit is per server instance. |
| Accounts | `DATABASE_URL` (+ optional `ANTHROPIC_API_KEY`) | Sign-in required. The server re-validates and recalculates each CSV, keeps the calculated report (never the file) in Postgres for that business, and meters Claude per business per day. |
| Accounts + email | also `RESEND_API_KEY`, `EMAIL_FROM` (and `BILLIONS_APP_URL` off Vercel) | Adds email verification and password reset. New accounts can run reports at once but get Claude only after confirming their email. |

## What works

- Responsive chat-and-output workspace, including mobile navigation.
- Sample data or real CSV upload, including drag and drop (up to 2 MB and 10,000 transactions).
- Strict column, date, record and currency validation. Financial calculations use integer cents.
- Weekly income, expense, net-movement and category summaries; daily chart and accessible table.
- Expandable checks, Markdown report download, run history with search, per-report delete and clearing, routines with create/delete/reuse. A session that expires mid-use returns to the sign-in screen.
- **Claude, without invented numbers.** The model sees only the calculated totals (largest 15 categories plus one "other" line) and never writes a figure: it cites placeholders such as `{income}` or `{category:Rent}` and code fills in the exact value (`src/lib/ai/verify.ts`). A reply containing any digit, number word, currency or percent sign, comparison with another period, or the wrong direction of net movement is discarded and the template is used instead. The report labels which one you are reading.
- **Account recovery.** "Forgot password?" emails a one-time link (30 minutes); following it sets a new password, verifies the address, lifts a sign-in lockout, ends every other session and signs in. The reset request answers identically whether or not the email has an account, and looks it up after responding. A new reset link doesn't cancel earlier ones (so nobody can keep cancelling the owner's), and reset emails are limited per address and per address-and-IP. Sign-up emails a verification link (24 hours). Links carry the token in the URL fragment, so it never reaches server logs or a Referer, and confirming takes a click so mail scanners can't do it; only a SHA-256 of each token is stored and redeeming deletes it, so a link works once. Settings: change password (signs out other devices) and delete account (the user, their business and all of its data). Draft Privacy Policy and Terms at `/privacy` and `/terms`; fill in `src/lib/legal.ts` and get them reviewed before launch.
- **Accounts and tenant isolation.** Email and password sign-up creates a business workspace. Sessions are random tokens in an httpOnly cookie, stored only as SHA-256 hashes. Sign-ins are throttled per email (atomically, so parallel guesses don't slip through) and per IP; sign-ups per IP; password hashing is concurrency-capped. Model spend is capped per business and across the deployment per day. Runs, routines, audit events and AI usage are filtered by business in every query and also guarded by Postgres row-level security.

Select **Try this report** to start without uploading a file. The sample contains AUD 24,350 income, AUD 8,290 expenses and AUD 16,060 net movement across 12 transactions.

## CSV contract

```csv
date,description,category,amount
2026-10-05,Consulting,Services,1250.50
2026-10-06,Travel,Operations,-50.25
```

Use real YYYY-MM-DD dates spanning at most seven consecutive calendar days. Positive amounts are income, negative amounts are expenses; all amounts are AUD with at most two decimal places, without currency symbols or thousands separators. Quoted CSV fields are supported. The source file is not modified. This transaction summary is not a profit-and-loss statement or bank balance.

## Database setup

Any Postgres 13+ works (Neon, Supabase, Vercel's Postgres marketplace, RDS). Use two roles: an owner for migrations and a least-privilege role for the app. **The app role must not be a superuser or have BYPASSRLS**: row-level security would be skipped, so the app refuses to serve tenant data through such a role.

```sql
-- as the owner, after `DATABASE_MIGRATION_URL=<owner url> npm run db:migrate`
CREATE ROLE billions_app LOGIN PASSWORD '<strong password>' NOSUPERUSER NOBYPASSRLS;
GRANT USAGE ON SCHEMA public TO billions_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO billions_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO billions_app;
```

Then set `DATABASE_URL` to the `billions_app` connection string (on serverless, the provider's pooled URL). Re-run the grants after any migration that adds tables. Migrations live in `db/migrations/` and are applied once each, in order.

### On Neon (this project's production database)

The repo is linked to Neon project `silent-bread-10483900`, branch `production` (`neon.ts`, git-ignored `.neon`). Neon specifics:

- **Data API grants.** With Neon's Data API enabled, every table the owner creates is granted to its `authenticated` role by default, which would expose `users` and `sessions` over the public REST endpoint. Migration `003_close_data_api_grants.sql` revokes those grants and defaults; `tests/db.test.ts` proves it. Billions doesn't use the Data API, so turning it off in the console is better still.
- **Connections.** Migrations use the owner's **direct** URL (`DATABASE_URL_UNPOOLED`, set as `DATABASE_MIGRATION_URL`); the app uses `billions_app` on the **pooled** host. On Vercel the pool is registered with `attachDatabasePool`, per Neon's guidance for `node-postgres`.
- **`neon env pull` / `neon deploy` reset `DATABASE_URL` in `.env.local` to the owner.** The app then refuses tenant queries (owner bypasses row-level security) until you point `DATABASE_URL` back at `billions_app`. In Vercel, set `DATABASE_URL` by hand; don't use the Neon integration's auto-provisioned owner URL.

## Validation

```sh
npm run typecheck
npm test            # unit tests; set TEST_DATABASE_URL to also run the Postgres tests
npm run test:e2e    # builds, then runs the browser tests
```

- `TEST_DATABASE_URL` is a superuser or owner connection. Each run creates a throwaway database and a no-BYPASSRLS role, proves one business cannot read, change or delete another's data (even through SQL that omits the business filter), then drops it.
- `npm run test:e2e` starts a fake Anthropic server and the production build in browser-only mode and in browser-only + Claude mode. Set `E2E_DATABASE_URL` (a migrated database, connected as the app role) to also run the accounts tests, which use a fake Resend server (`tests/fake-resend.ts`) to follow emailed links. No real API key or spend is involved.
- Browser tests use `/usr/bin/chromium` when present, or set `CHROMIUM_EXECUTABLE`. Elsewhere, `npx playwright install chromium`.

The scope and next production work are in [docs/MVP.md](docs/MVP.md).

## Deploy to Vercel

Import `farrowjacob9-lang/billi-ai` into Vercel with the Next.js preset, root directory `./`, Node.js 24.x and the default build command. With no environment variables it deploys the browser-only prototype.

To turn on accounts and Claude, add in **Project → Settings → Environment Variables** (mark the secrets Sensitive): `DATABASE_URL` (app role, pooled URL), `ANTHROPIC_API_KEY`, `RESEND_API_KEY` and `EMAIL_FROM`, and optionally `BILLIONS_AI_DAILY_LIMIT` and `BILLIONS_AI_GLOBAL_DAILY_LIMIT`. Per-IP limits rely on Vercel's `x-real-ip`; on another host, put a proxy in front that sets it. Run the migration and grants above against the database first. Leave `BILLIONS_ANONYMOUS_AI` unset in production.

After deploying: create a workspace, run **Try this report**, check the takeaway says "Written by Claude · figures verified" (when a key is set) and the totals match the sample above, download the report, sign in from a second browser to confirm the history is there, then check the mobile navigation.
