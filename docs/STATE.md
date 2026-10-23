# Current checkpoint — 23 Oct 2026

Branch: `spreadsheet-questions`. Draft PR: https://github.com/farrowjacob9-lang/billi-ai/pull/2 (includes the earlier account foundation). Implementation history is on this branch; see the workflow-first checkpoint below for the latest scope.

Preview: https://billi-ai-git-spreadsheet-questions-naxium-langs-projects.vercel.app/

## Excel compatibility fix — exact failing CRM reproduced

Uploaded CRM is 6768 bytes and uses namespace-prefixed SpreadsheetML (`x:workbook`, `x:sheets`, etc.). ExcelJS 4.4 fails in `xlsx.js` reading `workbook.sheets` because its transforms match unprefixed names. This reproduces locally and supersedes the earlier runtime-only hypotheses. The fix resolves spreadsheet/relationship element names using a namespace-aware XML parser before ExcelJS import. Text, rich strings and relationship attributes are preserved; DTDs are rejected. Original uploads are unchanged.

Exact fictional CRM tracked as `tests/fixtures/naxium-sales-crm-prefixed.xlsx`: 24 rows, 10 columns, total Deal value 442300. Production build/typecheck passed; all 11 spreadsheet browser tests passed, including this upload and total. Six reader tests passed, including prefixed formula rejection and text preservation. Direct JSZip/saxes dependency declarations reuse installed versions. Deployment still needs user confirmation on the hosted preview; do not claim every Excel format is supported.

## Latest UX direction and sales-review slice

User confirmed Excel upload worked after the namespace compatibility deployment. User wants the chat feel to combine ChatGPT conversation, Codex review/progress, Claude artifacts and Claude Code planning. Research/design specification is in `docs/CHAT-EXPERIENCE-DESIGN.md`; the broader layout redesign is not yet implemented.

New bounded sales intent flow: “Create my daily sales review” proposes overdue/today/missing-date steps, lets the user choose overdue-only vs overdue+today, previews results and has one Save sales review action. Relative today uses Australia/Melbourne on each execution. Closed Won/Lost are explicitly excluded; manual workflow saving does not schedule anything. Cloud saving creates a source workspace if necessary, subject to existing 30-day retention. This is a CRM template, not a general natural-language workflow planner.

Important input finding: the uploaded CRM contains literal text `43` in intended empty follow-up cells. These are source values, not blanks; do not replace them automatically. Date-based preview must flag them rather than guess. Unit tests cover dynamic dates and malformed values. Production build passed; prior 11 spreadsheet browser scenarios passed, and the new one-request proposal/save/run scenario passed after resolving a duplicate-text test selector.

## Chat-first layout implementation

Implemented the researched chat/workbench design: viewport-height conversation, fixed composer, optional Data/Workflow/Results panel, wider-panel control and mobile full-width panel with Back to conversation. Saved work is in the sidebar; save/export/settings are under Workspace tools. Upload confirmations and answer metadata are compact, with detailed evidence retained under workings. Source inspection opens Data. Draft workflow state stays mounted while switching history/views. Scroll-follow respects the user's reading position. Keyboard workbench navigation, focus return and mobile error visibility are verified.

Build/typecheck passed. All 23 browser scenarios passed before final polish; final affected spreadsheet/layout and report suites rechecked successfully, with an added draft-preservation case. Browser providers are fakes; hosted account smoke testing remains useful. No database migration or data transformation is part of this redesign. Existing saved work and routines remain supported. See `docs/CHAT-EXPERIENCE-DESIGN.md` for implemented vs future scope.

## Confirmed by the user in the hosted preview

- Signed in successfully after password recovery.
- Naxium branding and neutral styling deployed.
- `billions-tricky-test.csv` loaded: 18 rows, 6 columns.
- Total Amount: 9,808.97 across all 18 rows, immediate response.
- Posted Amount: 1,208.97 across 14 rows, about 3 seconds.
- Posted Travel Amount: -200 across 3 rows, about 4 seconds.
- Workspace saved for 30 days and reopened after refresh, preserving data and conversation.
- Reopening UX improved and user confirmed “okay better”: saved work is visible above the tools panel; one-click restore closes tools and returns to the workspace heading; conversation scrolling stays inside its panel.
- Neon migration `005_workspaces.sql` manually applied and recorded in `schema_migrations`.

## Implemented on this branch

CSV and Excel ingestion, validated AI calculation plans executed in code, source/filter evidence, optional saved workspaces, answer review decisions, Excel/PDF exports, light/dark theme, AI token activity and allowance, manual calculation routines and optional Inngest schedules. Saved work has 30-day retention. Source files are not retained; explicitly saved work retains parsed cells/conversation.

Reused suitable Naxium brand assets and email layout from retired `farrowjacob9-lang/naxium-app`; did not move its construction engine or domain bindings.

## Latest feature additions — 23 Oct

- Full spreadsheet preview: 25 rows per page, search across every row, original source row numbers.
- Data checks: blank cells by column, mixed numeric/non-numeric values, exact repeated rows. Review filters never remove or change source data and do not affect calculations.
- Suggested questions use actual column headings and fill the composer for review before sending.
- Validation: production build, typecheck and unit suite passed; all 7 spreadsheet browser scenarios passed, including search beyond the first page, repeat/blank review, unaffected full-sheet counts, saved work and exports. Browser model responses use a fake provider; hosted Excel upload remains unconfirmed.

## Workflow-first implementation — 23 Oct

User clarified that learning and building workflows is the biggest product feature. New builder remembers explicitly approved calculation steps (up to 12), names/reorders them, checks required columns and reruns them against a fresh sheet. Cloud storage uses existing tenant-isolated routines and audits applications; local mode stores rules in this browser. See `docs/WORKFLOWS.md` for usage and limits.

Also added structured answers/source inspection, model clarification responses, ISO-date filters/month/year grouping/distinct counts, header selection, opt-in autosave, unsaved-work warnings, per-sheet histories, cloud save revision checks and separate version copies. Operations: health/configuration endpoints, request references/timing, sanitised errors and Postgres CI service. Commercial work is limited to a factual private-beta plan/limits page; no payments or subscriptions enabled.

Validation: production build passed; all 10 spreadsheet browser scenarios passed and all 6 report browser scenarios passed after adapting them to deliberately accept unsaved-work prompts; 4 model browser scenarios passed in the full run. Unit tests: 29 passed, 19 external-Postgres tests skipped locally. Offline calculations: 25/25. Browser AI uses a fake provider. New cloud workflow application and conflict handling still need hosted account verification; CI now supplies Postgres for the existing database suite. Hosted Excel remains unconfirmed.

Important: remembered cloud workflows currently expire/delete with their source workspace. Durable independent workflow memory, parameters/mapping, conditional steps, full version history, teams, connectors and billing remain future work. No migration beyond already-applied 005 is required for this slice. Domain, Resend and worker setup remain pending.

## Verification and limits

Latest UX change: typecheck and production build passed; targeted browser test passed, covering refresh/reopen, reviewed answers and Excel/PDF exports. Earlier full browser suite: 16 passed; unit suite: 24 passed, 19 database-dependent skips; offline calculation evaluations: 25 passed. These local evaluations do not prove every natural-language interpretation.

Excel upload previously failed for the user's `billions-tricky-test.xlsx`. Server-side parsing and externalized ExcelJS fixes are deployed and fixture tests pass locally, but hosted Excel success remains UNCONFIRMED. Do not mark fixed based on CSV success. Reader failures now have a safe diagnostic reference.

## Next steps

1. Confirm hosted `.xlsx` upload works; if it fails, collect the new diagnostic reference and investigate hosting logs when available.
2. Follow `docs/NAXIUM-SETUP.md` for production release, domain cutover and Resend. Domain and email changes remain pending; existing domain bindings have not been changed.
3. Review/merge PR #2 to main and confirm production before moving `naxium.app` and `www`. Keep the retired deployment available for rollback.
4. Configure Resend together: `RESEND_API_KEY`, `EMAIL_FROM`, `BILLIONS_APP_URL`; redeploy and test recovery/verification. Do not put secrets in repository or chat.
5. Optional: configure dedicated Inngest keys/environment and sync `/api/inngest`; test scheduling. No automatic report email delivery exists yet.
6. Fill/review draft legal pages before public launch. Change the temporary testing password when testing finishes.

The earlier checkpoint below is historical; its “Later” and release status are superseded by this checkpoint. Unresolved account/security items in it have not been independently reverified or silently marked complete.

---

# Earlier checkpoint — 17 Oct 2026

Read this first. Last updated 17 Oct 2026. Branch: `claude/serene-albattani-sqwi7a` (PR open: https://github.com/farrowjacob9-lang/billi-ai/pull/1, waiting on the operator to merge).

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
- [ ] **Parked by operator (17 Oct) until the product works.** Legal: fill `src/lib/legal.ts` (entity, ABN, contact email, state), lawyer review of `/privacy` + `/terms`, then set `draft: false`.
- [x] Vercel env set (17 Oct): `DATABASE_URL` (billions_app, pooled) and `ANTHROPIC_API_KEY`, all environments. Branch preview `billi-ai-gules.vercel.app` signs up and runs. First attempt failed with `getaddrinfo ENOTFOUND base`: the Anthropic key had been pasted into `DATABASE_URL`.
- [ ] Merge PR farrowjacob9-lang/billi-ai#1 so production gets this work; confirm Node 24.x in Vercel. Preview verified 17 Oct: sign-up, sample report, Claude takeaway and chat all correct (figures checked against the sample).

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

## Excel investigation — reference eacd9e7a

User reported another hosted upload failure. Vercel log: 23 Oct 07:33:10 UTC, kind reader, Node v24.21.0, 6768 bytes. Generated fictional CRM `/workspace/artifacts/naxium-sales-crm.xlsx` is 9078 bytes; it parses locally both with traced deployment dependencies and on Node v24.21.0. This does not reproduce the user's exact upload or prove hosted parsing works. Root cause remains unresolved; exact failing workbook is needed. Added allowlisted stage/error-name/library-frame diagnostics without messages, XML or cells. Reader tests (3) and typecheck pass. Do not mark XLSX fixed.
