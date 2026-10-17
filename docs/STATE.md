# Session state

Read this first. Last updated 17 Oct 2026. Branch: `claude/serene-albattani-sqwi7a` (not yet merged to `main`; no PR opened yet).

## Shipped (on the branch, all tests green)
- Workspace UI split into components (`src/components/`), storage seam `src/lib/store.ts` (local vs cloud).
- Accounts: email + password, hashed session tokens, per-email/per-IP throttles, sign-up limit (`src/server/auth.ts`, `limits.ts`).
- Postgres: runs, routines, audit, AI usage; every tenant query filtered + FORCE row-level security; app refuses to run as a superuser/BYPASSRLS role (`db/migrations/`, `src/server/db.ts`, `repo.ts`).
- Claude: server-only (`src/server/ai.ts`); model writes placeholders, code fills exact figures (`src/lib/ai/verify.ts`); template fallback; per-business + global daily caps.
- Neon linked: project `silent-bread-10483900`, branch `production`, endpoint `ep-purple-rice-a7eja082` (ap-southeast-2). Migrations 001–003 applied; `billions_app` role created; test data removed. Migration 003 closes Neon Data API default grants (see README › On Neon).
- Tests: `npm test` (24, set `TEST_DATABASE_URL` for the Postgres ones), `npm run test:e2e` (11; set `E2E_DATABASE_URL` for accounts).

## Operator to-dos (outside the code)
- [ ] Revoke the Neon API key that was pasted in chat (Neon › Account settings › API keys).
- [ ] Reset `billions_app` password in Neon; keep it in a password manager (the one set in-session was only on the throwaway container).
- [ ] Turn off Neon Data API (unused).
- [ ] Merge the branch, then Vercel: Node 24.x, `DATABASE_URL` = billions_app pooled URL, `ANTHROPIC_API_KEY`, both Sensitive.

## Next session: do 1 + 2 (agreed 17 Oct)

**1. UI quick fixes (frontend only, nothing needed from the operator)**
- Favicon + app icon (no `public/` folder exists; browsers 404).
- Error card always says "Let's check that file." — title by error kind (file / session / server).
- Session expiry: any API 401 → back to the sign-in screen (today it just errors).
- Workspace picker shows a ▾ but only opens Settings: remove the chevron (no business switching yet).
- Breadcrumb "Workspace" and the logo → go to Overview, not a reload.
- Run history: per-report delete (API + UI), not only "Clear all".

**2. Account recovery + legal minimum**
- Forgot password: emailed one-time link (hashed token, ~30 min expiry, single use), sets new password, ends other sessions.
- Email verification on sign-up (link); decide whether unverified users can use the app (suggest: yes, with a banner, but no AI until verified — limits sign-up abuse).
- Gentler lockout: correct password always works from a verified email link path; per-email throttle stays for guessing.
- Privacy policy + terms pages, linked from sign-up and Settings. Draft only — needs the operator's legal entity name, ABN and contact email, and a legal review before launch.
- Settings: change password, delete account (and business data) with confirmation.
- Needs from the operator: a Resend account with the sending domain verified, and `RESEND_API_KEY` + `EMAIL_FROM` stored as environment secrets — never pasted in chat.

## Later (from the 17 Oct UI audit)
Real routines (link runs, schedule, email delivery), landing page, billing, team invites, onboarding, PDF export, saved conversations, visible AI allowance.

## Landmines
- This cloud container can't open TCP to Neon; use Neon's HTTPS SQL endpoint, or a WebSocket bridge for app tests (see the 17 Oct session: `wss://<host>/v2` via HTTPS proxy).
- `neon env pull` / `neon deploy` reset `DATABASE_URL` in `.env.local` to the owner; the app then refuses tenant queries until it's pointed back at `billions_app`.
- Browser tests run against a production build: the Next 16 dev server won't hydrate on 127.0.0.1.
- Local test Postgres: `initdb` into `/var/tmp/billions-pg`, port 54329, socket `/tmp` (see README › Validation).
