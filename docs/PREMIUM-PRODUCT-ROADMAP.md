# Naxium premium product roadmap

Research and repository review: 23 October 2026. This is a proposed roadmap, not a claim that these capabilities are implemented. Priority assumes the first customers are small businesses analysing transactions and expenses.

## Recommendation

Build a dependable business-data workspace: upload an ordinary file, agree what its columns mean, ask a question, inspect the calculation and source rows, and repeat the analysis on a newer file. Make that journey excellent before expanding into a general-purpose agent.

The strongest current asset is validated calculation plans executed in code. Its limit is important: correct arithmetic does not establish that the AI selected the right interpretation, filters or business definition.

## Evidence and current position

Repository reviewed: ingestion, plan generation/execution, workspace persistence, sidebar, usage, legal configuration, evaluations and CI.

Confirmed in the hosted preview by the operator: CSV ingestion, three correct aggregate/filter answers, save/reopen, improved reopening flow. Local spreadsheet browser tests cover seven scenarios with a fake model provider. Existing 25 execution evaluations supply plans directly; they do not evaluate live language interpretation. Hosted XLSX success remains unconfirmed.

Already implemented: accounts and tenant isolation, deterministic sums/averages/min/max/counts/rows, AND filters and grouping, source/filter text, optional 30-day saved snapshots, review decisions, Excel/PDF exports, basic routines, optional Inngest scheduling, usage/token activity, full-row preview/search and initial data checks.

Current constraints include 2 MB files/extracted snapshots, 10,000 rows, 60 columns, 100,000 cells, header row one, formula rejection, one active sheet per question, no time grouping/joins/derived arithmetic, and 100 saved conversation messages. Switching sheets clears the visible conversation. Existing sidebar recent work lists reports rather than all saved spreadsheet work. Workspace saves replace the current snapshot without a version-conflict check. These are implementation observations, not inferred customer demand.

## Research findings

- [Microsoft Copilot insights](https://support.microsoft.com/en-us/excel/copilot/data-insights-with-copilot-in-excel) and [visualisation](https://support.microsoft.com/en-us/excel/copilot/visualize-your-data-with-copilot-in-excel) establish a benchmark of plain-language analysis, charts, pivot summaries and formula explanations. Naxium needs useful visual results and understandable workings to compete for business analysis.
- [Rows AI Analyst documentation](https://rows.com/docs/using-the-rows-ai-analyst) describes checkpoints, charts, transformations and explicit table joins. This supports prioritising recovery/versioning and broader analysis, rather than only a chat interface. Documentation is a capability benchmark; the site currently displays a Superhuman transition notice, so do not infer unchanged standalone availability or pricing.
- [Julius security information](https://julius.ai/security) documents customer isolation, encryption, roles, deletion and a trust centre. These are vendor claims, not independently audited findings here. They demonstrate the depth of information business buyers may expect about data handling; copying certification badges is not a substitute for actual controls.
- [Anthropic evaluation guidance](https://platform.claude.com/docs/en/test-and-evaluate/develop-tests) recommends measurable, task-relevant success criteria and multidimensional evaluation. Our engine tests need a separate live-model question-to-plan benchmark.
- [OWASP prompt injection guidance](https://genai.owasp.org/llmrisk/llm01-prompt-injection/) supports constrained outputs, deterministic validation and limited tool authority. Preserve the existing separation between AI interpretation and code execution as capabilities grow.
- [WCAG 2.2 guidance](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/) makes keyboard focus, usable targets and accessible authentication relevant acceptance criteria, alongside visual polish.
- [Neon restore documentation](https://neon.com/docs/postgres/backup-restore/branch-restore) explains recovery within a configured history window. Verify our actual plan/window and practise restoration; neither the account's recovery configuration nor recovery time was verified in this research.

## Phase 1 — dependable private beta

| Work | Implementation | Acceptance evidence |
|---|---|---|
| Reliable imports | Diagnose hosted XLSX failure; import preview with selectable header/table, explicit date locale and numeric/currency types; recognise title/footer/subtotal rows; show proposed changes before applying | A corpus of real bank/accounting exports imports correctly or produces a precise actionable rejection; no silently omitted rows |
| Clarification | First-class clarification response instead of generic unsupported-operation text; ask about date range, posted/pending, refunds and sign convention | Ambiguous expense questions ask a specific question; confirmed definitions appear in the result |
| Evidence-rich answers | Structured result cards with calculation, filters, currency/units, matched/excluded counts and clickable source rows; distinguish a valid answer from an error/refusal | Every supported answer can be reproduced from a saved dataset version and visible plan |
| Work preservation | Saved-work library, clear active title, unsaved indicator and navigation warning; opt-in autosave after initial explicit save; per-sheet histories; named versions and conflict detection | Refresh/reopen, failed save and two-tab edit tests; switching sheets loses no conversation; never report Saved after a failed request |
| Operational readiness | Sanitised error monitoring and request IDs, import/AI/save latency and success metrics, synthetic smoke checks, deployment rollback and restore drill | Operators can diagnose a failure without inspecting customer cells; restore tested on a separate environment |
| Release essentials | Domain, configured Resend recovery/verification, legal identity/privacy terms, retention explanation and support contact | Hosted account recovery, deletion, expiry and cross-tenant tests pass; no draft legal claims |

Important privacy boundary: spreadsheet question planning currently sends headings and user questions to Claude. This cannot support arbitrary interpretation of descriptions it never receives. Preserve this guarantee or introduce a separate, explicit, documented consent flow for selected text analysis. Do not quietly send raw transactions to make the assistant seem smarter. User-entered questions and headings can themselves contain personal information.

Retention is also a product choice. Thirty-day expiry suits temporary analysis; persistent business work needs an explicit paid retention policy, visible expiry dates, export and expiry reminders. Do not silently extend retention or claim indefinite storage.

## Phase 2 — compelling paid individual product

1. **Business date analysis.** Date ranges, weekly/monthly grouping, Australian financial-year definitions, period comparisons, percentages/share-of-total, distinct counts and validated derived metrics. Separate currencies and avoid invented conversion rates. Add boolean OR and supported combinations through the validated query schema, not free-form code execution.
2. **Charts and presentation.** Bar charts for categories and line charts for time, each backed by the same structured results as tables. Pin useful answers to a dashboard, export clean branded reports, retain units, filters and source version. Avoid implying forecasts from historical trends.
3. **Repeatable reporting.** Replace/append a new file into a saved workflow with column mapping, schema-drift preview, duplicate-handling choices and immutable input versions. Show whether a routine uses a saved snapshot or refreshed data. Then enable verified schedules, timezone controls, run logs, failure notifications and explicit recipient approval before delivery.
4. **Business templates.** Start with expense review, monthly spending comparison and category/vendor breakdowns. Add recurring-charge or budget variance templates only when required fields and matching rules are defined. Label possible duplicates as candidates, not proven errors.
5. **Paid service basics.** One understandable paid tier first; server-enforced entitlements, usage limits, checkout, subscription changes, invoices, cancellation, payment failure handling and verified webhooks. Base pricing on measured model/storage/export costs and willingness to pay; no revenue or margin assumptions have been validated.

## Phase 3 — team and integration value

- Invitations, owner/editor/viewer roles, shared approved reports, comments, auditable changes and controlled exports. Keep authorization server-side and test every role and tenant boundary.
- Start with one customer-driven read-only connector, such as Xero or Google Sheets. Implement scoped OAuth, encrypted token storage, revocation, sync history and source freshness before adding more connectors. Choose the connector after observing pilot workflows, not feature-count comparisons.
- Explicit cross-sheet joins and multi-file comparisons, with key selection, unmatched-row reports and protection against duplicated totals from many-to-many joins.
- Passkeys or trusted social sign-in for easier recovery; MFA and finer session management as customer requirements warrant. SSO/SCIM and formal certifications can follow genuine procurement needs.

## Proposed quality gates

These are recommended targets to measure, not achieved results or industry guarantees.

- Build a versioned corpus of at least 30 representative files and 150 natural-language questions, with held-out cases. Include mixed dates, decimal formats, refunds, pending/void entries, duplicates, malicious headings and instructions, empty values and multi-sheet workbooks.
- Require exact engine results for every supported deterministic fixture. Separately target at least 95% correct live-model plans on supported held-out questions and review every confident wrong answer. Score clarification/refusal behaviour independently so refusing all queries cannot count as success.
- Run repeated paraphrases and follow-up questions; capture model, prompt and dataset versions. Evaluate before model/prompt changes. Never use customer files in evaluations without permission and an appropriate data policy.
- Initial hosted latency targets: local shortcuts under 1 second; supported AI questions p95 under 8 seconds under representative load. Keep cancellation and retry usable. Existing 3–4 second responses are encouraging observations, not a measured p95.
- Run real database account/tenant tests in CI against an isolated database; current workflow does not configure that service. Add expiry/deletion, concurrency, provider failure and restored-backup checks.
- Test Safari/WebKit, Chromium and mobile layouts, keyboard and screen-reader use. Target WCAG 2.2 AA and verify before claiming conformance.
- Define and measure availability, recovery point and recovery time objectives before selling contractual guarantees. Check billing spend limits and per-business abuse controls under load.
- Track upload-to-first-correct-answer, save/reopen completion, repeated weekly use and support incidents with privacy-preserving analytics. Validate with a small pilot group before committing to a broad paid launch.

## Recommended next implementation order

1. Structured answers and clickable evidence, plus clarification questions.
2. Robust import preview and business column/date settings; resolve hosted Excel ingestion.
3. Saved-work library, explicit autosave/versioning and per-sheet conversation preservation.
4. Date comparisons and charts, followed by replace-file reporting.
5. Production monitoring/recovery and account/email/legal setup in parallel, then billing once the full journey is proven.

Do not prioritise more model providers, autonomous financial actions, broad forecasting, a large integration catalogue or cosmetic dashboards over this sequence. Keep the product focused enough that ordinary business questions work predictably.
