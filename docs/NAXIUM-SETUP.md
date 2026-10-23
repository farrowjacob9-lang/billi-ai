# Naxium setup and domain handover

Prepared 23 October 2026 (Melbourne). The new product still lives in GitHub `farrowjacob9-lang/billi-ai`, Vercel project `billi-ai`, branch `spreadsheet-questions` (draft PR #2). The construction repo/deployment has not been changed. Existing Billions accounts remain valid; a brand/domain change does not migrate Firebase accounts from the retired Naxium app.

## What is implemented

- Naxium marks and neutral light/dark workspace; simpler heading/navigation.
- Branded HTML verification/reset emails plus plain-text fallback, using the current account/token system.
- Explicit Save workspace: parsed cells, conversation, calculation plans and separate review decisions. Cloud saves use tenant-isolated Postgres. Local-mode saves use IndexedDB.
- Saved work expires 30 days after saving. Another save extends expiry. Maximum 30 cloud workspaces per business, 10 local workspaces, 2 MB per snapshot. Original XLSX/CSV binaries are not retained.
- Open/delete saved work. Deleting cloud work also removes its routines/jobs. Account deletion cascades to the new records.
- Excel export of source rows, conversation and reviewed answers; PDF conversation/report export. Corrections remain beside original answers.
- Daily AI allowance plus model/operation/token/failure activity for the signed-in business. Failed provider attempts without a usage response have no known token cost. This is activity metering, not an invoice or a verified dollar estimate.
- Saved calculation routines: run on demand using validated code; optional daily/weekly Inngest scheduling, durable jobs, retry/failure/cancellation states. Missing data/invalid query becomes `needs_input`, not a successful empty answer. For now resolve it by opening the workspace, clarifying the question and creating a corrected routine.
- Routines rerun the *saved snapshot*, not a bank integration or fresh file. Update/save data yourself. No automatic outbound emails or external writes.
- Cleanup when saved work is listed, plus every 15 minutes once the scheduler is connected. Expired records are inaccessible even before cleanup. Worker dispatch uses durable queued job IDs and idempotent event IDs.
- CI checks and 25 offline spreadsheet execution fixtures. They test calculation semantics, not live model language understanding.

## 1. Enable cloud saves in Neon

This is the only immediate prerequisite for Save workspace on the signed-in preview.

1. Open the existing Billions Neon project `silent-bread-10483900`, branch `production`, database `neondb`. Take a provider backup/branch before the schema change if desired.
2. In SQL Editor use an owner/admin role. Apply `db/migrations/005_workspaces.sql` from this repository. This adds four tables and row-level policies; it does not replace users, password hashes, reports or the existing database.
3. If applying through the SQL Editor rather than `npm run db:migrate`, also record the version:

```sql
INSERT INTO schema_migrations(version)
VALUES ('005_workspaces.sql')
ON CONFLICT(version) DO NOTHING;
```

4. The migration grants access to the existing `billions_app` role when it exists. Keep Vercel `DATABASE_URL` on that least-privilege role, pooled connection. Do not switch it to the owner URL. An alternative app-role name needs equivalent table grants.
5. Refresh the preview, upload a sheet, ask a question, open **Saved work, exports & routines**, then **Save workspace**. Refresh and reopen it. Test delete as well.

CLI alternative: set `DATABASE_MIGRATION_URL` to the owner's direct connection in a private terminal and run `npm run db:migrate`. Do not put that owner credential in Vercel's application `DATABASE_URL` or in chat.

## 2. Prepare production without disturbing the old site

1. Keep the retired construction Vercel project and repository intact. Record which Vercel project currently owns `naxium.app` and `www.naxium.app`, and any redirects, before moving bindings.
2. Review draft PR #2 in `billi-ai`. It includes the still-unmerged foundation from PR #1 as well as spreadsheet work and the Naxium transfer. Do not assume merging PR #1 alone publishes these changes.
3. When the preview and migration checks pass, merge the reviewed new product changes into `billi-ai/main` and verify Vercel's production deployment. This guide does not itself authorize an unreviewed merge.
4. Confirm production has the working `DATABASE_URL`, `ANTHROPIC_API_KEY`, Node 24.x, and existing AI limits. Keep preview and production settings distinct where appropriate.
5. Use the working Vercel production URL to test sign-in, upload, a filtered question, export, save/reopen/delete and account recovery before moving the domain.

## 3. Move naxium.app to the new Vercel project

No registrar transfer is needed. This is a hosting/domain-binding change.

1. In the *old construction project*, remove only the custom domain bindings you are moving. Keep its deployments for rollback.
2. In the *new `billi-ai` Vercel project*, Settings → Domains, add `naxium.app` and `www.naxium.app`.
3. Make `naxium.app` canonical and set `www.naxium.app` to redirect there (or choose www consistently everywhere instead).
4. At the domain's DNS provider, enter the exact web records Vercel currently shows. Do not use a copied IP address from an old tutorial. If the records already point to the same Vercel account, reassigning the binding may be enough; follow Vercel's domain check.
5. Preserve mail-related MX, SPF, DKIM and DMARC records. Moving web hosting does not require removing or replacing email DNS.
6. Wait for Vercel's domain validation and TLS certificate, then test both hostnames. Sign in again on the new origin; the old preview cookie/browser storage will not automatically become a domain session.
7. For rollback, reassign the domain to the preserved old deployment/project. Do not delete it during this transfer.

## 4. Connect the existing Resend sender

1. In Resend → Domains, confirm `naxium.app` is verified. If it already is, the web-hosting move does not require a new sending domain. Keep its existing mail DNS.
2. Create/select a Resend API key with permission to send from that domain. Save it privately in Vercel, not in GitHub or chat.
3. In the *new Vercel project* set these together:

| Variable | Value |
|---|---|
| `RESEND_API_KEY` | Private Resend key |
| `EMAIL_FROM` | `Naxium <notifications@naxium.app>` or your verified preferred sender |
| `BILLIONS_APP_URL` | `https://naxium.app` |

The old repo used `FROM_EMAIL` and `NEXT_PUBLIC_APP_URL`; this app uses **`EMAIL_FROM` and `BILLIONS_APP_URL`**. The BILLIONS prefix is deliberately retained for configuration/account compatibility; it is not visible product branding.

4. Set values for the intended environment(s) and redeploy. Adding Vercel variables alone does not change an existing deployment.
5. For preview-only recovery tests before moving DNS, use the preview's origin as `BILLIONS_APP_URL` in Preview. Remember Vercel protection may require a Vercel login. Use the canonical public origin in Production after cutover.
6. Test Forgot password to your own email, verify the sender and destination origin, choose a new password, and check that the used link cannot be reused. Never paste the reset URL into chat.
7. Test a verification email. Enabling mail also enables the AI email-verification gate for unverified accounts. Existing users may need to confirm their email; don't assume setting Resend leaves all account capabilities unchanged. Avoid a partial email configuration: it deliberately keeps AI off for unverified users.

## 5. Optional scheduling and expiry cleanup

On-demand calculation runs can execute without Inngest. Background schedules need all of:

1. Inngest Cloud app/environment dedicated to the new workspace, separate from the retired construction app. App id is `naxium-workspace`.
2. `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` in the new Vercel production environment. Redeploy.
3. In Inngest, sync `https://naxium.app/api/inngest` (or the production Vercel hostname before domain cutover). Endpoint requests are verified by the Inngest SDK/signing key.
4. Confirm functions `run-workspace-routine` and `scheduled-workspace-routines` are registered.
5. Save a workspace, ask a supported question, save it again, then save the latest calculation as a routine. Test Run now, cancellation, and one scheduled execution. Daily/weekly runs begin after creation and are dispatched by a 15-minute UTC scheduler, not an exact local-clock delivery promise.
6. Confirm an expired test workspace is inaccessible and removed by cleanup. With no worker connected, expiry cleanup occurs when saved work is loaded.

Preview protection can prevent Inngest reaching a preview URL. Prefer a dedicated accessible staging hostname or production for the configured worker; do not disable the retired app's worker or reuse its id blindly.

## Release checks and remaining product work

- Live Claude plus the production database and Resend have not been verified by local fake-provider browser tests.
- The new schema has an isolated Postgres row-level-security test; existing auth integration tests still require `TEST_DATABASE_URL`/`E2E_DATABASE_URL` against a test database.
- No automatic email report delivery, live bank integrations, subscription billing, team invitations, or public sharing has been introduced.
- Cost estimates need verified current pricing for the selected model; token activity is implemented now.
- The landing/waitlist marketing rewrite remains separate. The domain currently opens the workspace/sign-in flow. No construction-specific landing promises were copied.
- Privacy/terms remain drafts. Fill legal identity/contact placeholders and review the new optional saved-data behaviour before public launch.
- When testing is finished, replace the test account password you put in this chat.

The existing GitHub repository and Vercel project do not need to be renamed to launch as Naxium. Optional internal renaming can happen later, after deployment and recovery are stable.


## Established approaches (migration 006)

Apply `db/migrations/006_learned_methods.sql` using `npm run db:migrate` with the database-owner migration URL. For the manual Neon console path, `db/manual/006_learned_methods_neon.sql` wraps the migration and history record in one transaction. Do not apply both paths. Refresh the app after successful application; Service connections should list Established approaches as Configured. No deployment secret changes are needed. Until applied, account-mode approaches are explicitly tab-only, not persistent account memory. The new 30-day method lifecycle is independent of source-workspace expiry; legacy routines are unchanged. See `docs/LEARNING-REVIEW.md` for the full behavior and review exercise.
