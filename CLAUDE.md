# Billions (billi-ai)

Browser-first AI workspace: weekly CSV → checked report, with Claude writing the summary. Next.js 16 on Vercel, Postgres on Neon.

## Start of every session

1. **Read `docs/STATE.md` first.** It is the handoff: what shipped, what the operator still owes, open review items, and landmines. Do not re-plan work it lists as shipped.
2. Work on the branch it names until that branch's PR is merged into `main`; `main` lags until then.
3. Next.js 16 differs from older versions: read `node_modules/next/dist/docs/` before using an API (see `AGENTS.md`).

## End of every session

1. `npx tsc --noEmit` and `npm test` pass (set `TEST_DATABASE_URL` for the Postgres tests).
2. `npm run test:e2e` passes for anything touching the UI or API (set `E2E_DATABASE_URL` for accounts).
3. Commit and push.
4. **Update `docs/STATE.md`**: shipped, operator to-dos, next, landmines. Keep it current; it is the only memory between sessions.

## Rules

- Never paste or commit secrets. Keys go in Vercel or the environment's secrets. `.env*` and `.neon` are git-ignored.
- The app's database role must not bypass row-level security; migrations run as the owner on the direct (unpooled) URL. See README › Database setup and › On Neon.
- Claude never writes figures itself: placeholders filled by code (`src/lib/ai/verify.ts`). Keep it that way.
- Neon agent skills are in `.claude/skills/`; use them for anything Neon.
