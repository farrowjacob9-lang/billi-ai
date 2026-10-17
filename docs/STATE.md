# Session state

Read this first. Last updated 17 Oct 2026. Branch: `claude/serene-albattani-sqwi7a` (not yet merged to `main`; no PR opened yet).

## Shipped (on the branch, all tests green)
- Workspace UI split into components (`src/components/`), storage seam `src/lib/store.ts` (local vs cloud).
- Accounts: email + password, hashed session tokens, per-email/per-IP throttles, sign-up limit (`src/server/auth.ts`, `limits.ts`).
- Postgres: runs, routines, audit, AI usage; every tenant query filtered + FORCE row-level security; app refuses to run as a superuser/BYPASSRLS role (`db/migrations/`, `src/server/db.ts`, `repo.ts`).
- Claude: server-only (`src/server/ai.ts`); model writes placeholders, code fills exact figures (`src/lib/ai/verify.ts`); template fallback; per-business + global daily caps.
- Neon linked: project `silent-bread-10483900`, branch `production`, endpoint `ep-purple-rice-a7eja082` (ap-southeast-2). Migrations 001–003 applied; `billions_app` role created; test data removed. Migration 003 closes Neon Data API default grants (see README › On Neon).
- 17 Oct (2nd session): UI quick fixes (icons, error titles by kind, 401 → sign-in, chevron removed, logo/breadcrumb → Overview, per-report delete). Full-screen conversation that splits when a report appears. Account recovery: forgot password (emailed one-time link, 30 min), email verification (gates AI only), change password, delete account, draft `/privacy` + `/terms`. Email via Resend HTTP API (`src/server/email.ts`). Independently reviewed twice; fixes in `a6dac9e` and the follow-up commit.
- Tests: `npm test` (33, set `TEST_DATABASE_URL` for the Postgres ones), `npm run test:e2e` (19; set `E2E_DATABASE_URL` for accounts, which use a fake Resend server).

## Operator to-dos (outside the code)
- [x] `authenticator` role password reset (17 Oct, after its connection string was pasted in chat).
- [ ] Revoke the Neon API key that was pasted in chat (Neon › Account settings › API keys).
- [ ] Reset `billions_app` password in Neon; keep it in a password manager.
- [ ] Turn off Neon Data API (unused).
- [x] Migration 004 applied to Neon production (17 Oct, via the SQL Editor as owner; `schema_migrations` shows 001–004).
- [ ] **Deferred by operator (17 Oct).** Resend: verify the sending domain; set `RESEND_API_KEY` and `EMAIL_FROM` in Vercel as Sensitive (never in chat). `BILLIONS_APP_URL` only if not using the Vercel production domain. Any of these set without the rest keeps AI off for unverified accounts (fail closed).
- [ ] Legal: fill `src/lib/legal.ts` (entity, ABN, contact email, state), lawyer review of `/privacy` + `/terms`, then set `draft: false`.
- [ ] Merge the branch, then Vercel: Node 24.x, `DATABASE_URL` = billions_app pooled URL, `ANTHROPIC_API_KEY`, Resend vars, all Sensitive.

## Next session
Pick from Later. Known open items from the review, deliberately not done: sign-up still answers 409 for a taken email (enumeration); per-email login lockout can be triggered by anyone (reset is the way out); no backfill of `email_verified_at` (no real users yet — revisit if any sign up before Resend is configured); `RESEND_BASE_URL` override is honoured in production; per-IP limits are env-tunable with no production ceiling (never copy the e2e values to Vercel); a half-set email config keeps AI off for unverified users but the UI can't explain why (fix: report it in capabilities); the per-address reset cap (30/day) can still be exhausted by an attacker with many networks.

## Later (from the 17 Oct UI audit)
Real routines (link runs, schedule, email delivery), landing page, billing, team invites, onboarding, PDF export, saved conversations, visible AI allowance.

## Landmines
- This cloud container can't open TCP to Neon; use Neon's HTTPS SQL endpoint, or a WebSocket bridge for app tests (see the 17 Oct session: `wss://<host>/v2` via HTTPS proxy).
- `neon env pull` / `neon deploy` reset `DATABASE_URL` in `.env.local` to the owner; the app then refuses tenant queries until it's pointed back at `billions_app`.
- Browser tests run against a production build: the Next 16 dev server won't hydrate on 127.0.0.1.
- Local test Postgres: `initdb` into `/var/tmp/billions-pg`, port 54329, socket `/tmp` (see README › Validation). Accounts e2e: `billions_e2e` db, role `billions_app`.
- Per-IP limits share one bucket in tests (everything is 127.0.0.1); the e2e server raises them via `BILLIONS_*_PER_IP_*` env vars. Without that, repeat runs within 15 minutes fail at verification.
