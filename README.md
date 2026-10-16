# Billions

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

## What works

- Responsive chat-and-output workspace, including mobile navigation.
- Sample data or real CSV upload, including drag and drop (up to 2 MB and 10,000 transactions).
- Strict column, date, record and currency validation. Financial calculations use integer cents.
- Weekly income, expense, net-movement and category summaries; daily chart and accessible table.
- Expandable checks, Markdown report download, run history with search and clearing, routines with create/delete/reuse.
- **Claude, without invented numbers.** The model sees only the calculated totals (largest 15 categories plus one "other" line) and never writes a figure: it cites placeholders such as `{income}` or `{category:Rent}` and code fills in the exact value (`src/lib/ai/verify.ts`). A reply containing any digit, number word, currency or percent sign, comparison with another period, or the wrong direction of net movement is discarded and the template is used instead. The report labels which one you are reading.
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

## Validation

```sh
npm run typecheck
npm test            # unit tests; set TEST_DATABASE_URL to also run the Postgres tests
npm run test:e2e    # builds, then runs the browser tests
```

- `TEST_DATABASE_URL` is a superuser or owner connection. Each run creates a throwaway database and a no-BYPASSRLS role, proves one business cannot read, change or delete another's data (even through SQL that omits the business filter), then drops it.
- `npm run test:e2e` starts a fake Anthropic server and the production build in browser-only mode and in browser-only + Claude mode. Set `E2E_DATABASE_URL` (a migrated database, connected as the app role) to also run the accounts tests. No real API key or spend is involved.
- Browser tests use `/usr/bin/chromium` when present, or set `CHROMIUM_EXECUTABLE`. Elsewhere, `npx playwright install chromium`.

The scope and next production work are in [docs/MVP.md](docs/MVP.md).

## Deploy to Vercel

Import `farrowjacob9-lang/billi-ai` into Vercel with the Next.js preset, root directory `./`, Node.js 24.x and the default build command. With no environment variables it deploys the browser-only prototype.

To turn on accounts and Claude, add in **Project → Settings → Environment Variables** (mark the secrets Sensitive): `DATABASE_URL` (app role, pooled URL), `ANTHROPIC_API_KEY`, and optionally `BILLIONS_AI_DAILY_LIMIT` and `BILLIONS_AI_GLOBAL_DAILY_LIMIT`. Per-IP limits rely on Vercel's `x-real-ip`; on another host, put a proxy in front that sets it. Run the migration and grants above against the database first. Leave `BILLIONS_ANONYMOUS_AI` unset in production.

After deploying: create a workspace, run **Try this report**, check the takeaway says "Written by Claude · figures verified" (when a key is set) and the totals match the sample above, download the report, sign in from a second browser to confirm the history is there, then check the mobile navigation.
