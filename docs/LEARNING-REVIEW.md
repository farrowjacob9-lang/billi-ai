# First learning-and-reuse slice — review guide

24 October 2026, Australia/Melbourne. Implemented behavior, not a general-purpose workflow learner.

## The review point

The app can now attach a natural correction and acceptance to useful spreadsheet work, establish a scoped approach without a separate workflow-save action, and apply it to a later matching request on fresh data. This is the first complete implementation of the agreed interaction. Review whether this feels like doing work rather than configuring software before widening task coverage or making recognition less conservative.

## Try the complete loop

Use the preview and the synthetic files:

- `/samples/approach-week-one.csv`
- `/samples/approach-week-two.csv`

1. Upload week one and ask **Total Amount**. Expected total: **980**.
2. On the answer, choose **Adjust result** and enter **Only Posted**. A new answer should be **80**, with the original preserved.
3. Choose **That's right**, leaving the visible scope as **Matching requests**. The accepted calculation becomes an established approach; no workflow naming or step assembly is required.
4. Start a new conversation, upload week two, and ask **Total Amount**. Expected answer: **150**, with the established approach/version and the applied rules visible. It should not ask you to approve the unchanged method again.
5. Adjust that result with **Exclude Travel**. Expected answer: **200**. Until accepted, this correction affects only the new result. Accept it to establish version 2.
6. Open its approach link. Inspect the scope and history. Restore version 1; that becomes version 3 with the earlier rules. A later matching request should return **150** again.
7. Forget the approach and ask again. Expected unfiltered total on week two: **850**. Historical answers should remain unchanged.

Separate one-off test: adjust with **Only Posted this time**. The scope should default to **This result only**. Accept it, then repeat **Total Amount**: the earlier default should remain unchanged. You can also select This result only manually.

Changed-input test: upload a file with different headings and repeat a recognized request. The app should stop reuse, explain the mismatch, and offer **Run as a new task** rather than silently dropping old filters. Reordered headings are compatible; changed names or extra/missing headings require a fresh decision.

## Account setup — required for persistence beyond this tab in the hosted preview

Migration **006** adds `learned_methods` and `method_executions`, with tenant isolation and independent 30-day retention. Existing workspaces and legacy routines are not rewritten or migrated. The new tables do not depend on a source workspace, so deleting a source workspace does not delete its established approach.

Preferred: configure an owner-role `DATABASE_MIGRATION_URL` and run `npm run db:migrate`. The application should continue to use its least-privilege role.

For the existing manual Neon workflow, the ready-to-run transaction is:

`db/manual/006_learned_methods_neon.sql`

Run it once in the Neon SQL Editor, on the same production database where 005 was applied, using the owner connection. It creates the tables/policies and records `006_learned_methods.sql`. If it reports that a table or migration already exists, do not rerun individual fragments; inspect migration history first. The whole transaction should succeed before refreshing the app.

The app detects readiness on refresh/listing. Check **Workspace tools → Service connections → Established approaches**. No new API key or worker is needed for manual reuse. Existing scheduling infrastructure only supplies optional expiry cleanup; acceptance does not create schedules.

The user subsequently supplied a Neon screenshot confirming the full migration 006 transaction committed successfully. This environment has no production database credentials or Neon connector; authenticated production persistence still needs the owner’s smoke test. If 006 readiness is unavailable, signed-in users are explicitly offered **this-tab-only** approaches. They work across conversations/uploads in that tab, but refresh or closing the tab forgets them. No cloud data is silently copied into browser local storage. Browser-only mode uses local storage with the disclosed 30-day expiry.

## Implemented contract

- **Recognition:** same request after case/whitespace/trailing punctuation normalization, plus exactly the same set of headings. No semantic matching or broad paraphrase inference yet. Explicit new conditions in a question do not inherit unrelated prior rules.
- **Correction:** narrow categorical changes such as Only Posted, Exclude Travel and Include all rows run locally if their meaning is unambiguous in the sheet. Other changes use a constrained AI plan revision with schema validation and code execution. Missing/ambiguous values require clarification.
- **Acceptance:** matching scope is displayed beside the action, with storage location and lifetime. This result only does not establish or update a method. Explicit “this time” language defaults to one-off scope. No acceptance is inferred from a download, silence or viewing an answer.
- **Versions:** accepting changed rules creates a new version. Restoring copies old rules to a new version; it never rewrites past outputs. Latest 20 accepted versions are retained. Stale cloud revisions fail rather than overwrite another tab.
- **Provenance:** answers and method versions carry a SHA-256 input fingerprint, file/sheet name and source/matched row counts. These identify the input, but do not reconstruct an old file. Original worksheet cells are not retained in the method itself. Explicit workspace saving is still needed to retain the full cells/conversation.
- **Usage history:** account runs retain version/input metadata, not result text or source rows; capped at 50 records per approach. The inspector shows the latest 20. Browser history is capped at 20. These histories are not a full business event ledger.
- **Retention:** 30 days from accepting a changed version or restoring a version; running an approach does not renew expiry. Expired methods cannot run and are deleted on listing or by the configured cleanup worker. Forget cascades version/run metadata, leaving independently saved answers intact.
- **Privacy/security:** all cloud access requires a session and tenant context. Mutations have same-origin protection; acceptance/run requests have rate limits. Only headings, questions and existing calculation rules being revised go to the model, not full source rows. Filter values/correction text may contain private information and are disclosed as such. Forget and restore remain visible controls.
- **UI:** the manual calculation-workflow builder remains available under Advanced; it is no longer the primary way to establish repeatable behavior.

## Validation and limits

Verification passed: production build/typecheck, 25/25 offline execution fixtures, 62 unit/database tests against disposable Postgres (no skips), and 45 browser cases including 12 account journeys.

Unit and database tests cover request scope, ambiguity, expired methods, input evidence, metadata preservation, tenant isolation, independence from source deletion, stale writes, concurrent acceptance and version restoration. Browser scenarios cover corrected acceptance/reuse, one-off acceptance, restore/forget, schema mismatch, clarification, mobile layout, fresh authenticated browsers, cross-business access and account-storage fallback. Fake AI/email providers are used; this is not a live-model quality benchmark.

This slice still supports one validated spreadsheet calculation/listing at a time. It does not infer arbitrary multi-step procedures from edits, create/update a CRM, reconcile entities across exports, learn arbitrary business semantics, act in external systems, schedule itself, or establish permanent memory. Exact wording recognition is intentionally restrictive for this first review. The matcher does not yet model separate business contexts: identically worded requests on identical headings are the same scope, even if their business purpose differs. Use This result only when a correction should not generalize; context scoping is a specific point to review before broad rollout.

## Next after this review

Evaluate whether acceptance and scope are understandable with very little explanation. Then prioritize:

1. More natural task recognition, with explicit repair/confirmation when meaning could change.
2. Multiple accepted steps and named business definitions, using the same evidence/version/scope controls.
3. Output editing and action status as learning signals, with one-off versus reusable scope tested separately.
4. Stable input/entity versions and measured reduction in owner effort.

Do not widen recognition or take external actions merely to make the demo feel more intelligent. The first review should establish whether this interaction actually reduces the owner's setup effort.
