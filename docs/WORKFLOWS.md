# Learning and workflows — first implementation

Naxium's central product direction is to learn approved ways of working and make them repeatable. Learning here is explicit saved rules, not hidden model training or autonomous financial actions.

## Use the current builder

1. Upload a spreadsheet and ask successful calculation questions.
2. Save the workspace when using cloud accounts.
3. Open **Build from successful answers** in **Learn a workflow**.
4. Add answers as steps, name the workflow and its steps, reorder/remove steps, then **Approve and remember workflow**.
5. Upload a fresh file or reopen another workspace. Select the remembered workflow, inspect its rules and current input, then run it.
6. Required headings are checked before running. All steps must calculate successfully before results are returned. Inspect result source rows, then save the workspace to retain the run's conversation.
7. **Forget workflow** removes the definition. It does not delete answers already saved in another workspace.

The first builder supports up to 12 independent calculation steps on one selected sheet. No emails, bank actions, arbitrary scripts or file changes are performed. Preview searches do not change workflow inputs. Date filters are explicit rules: uploading a new month does not automatically shift a previously saved date range.

Cloud definitions reuse tenant-isolated `workspace_routines`; scheduled jobs support both old single plans and new step definitions. Cloud manual application is authenticated, rate limited, schema validated and recorded in the audit log. Inputs are processed transiently unless the user saves the workspace. No additional schema migration is needed for this slice beyond migration 005 already applied.

**Current retention limitation:** cloud definitions are attached to their source workspace and are deleted if it expires after 30 days or is deleted. Local definitions are stored in this browser's localStorage with their approved questions/rules; browser storage removal deletes them. Neither is yet a permanent organisation-wide workflow knowledge base.

## Other improvements in this slice

- Header-row choice for CSV/XLSX; source row numbers preserve skipped title rows. This is not yet a full import/type-mapping wizard. Hosted Excel success still needs confirmation.
- Structured calculation results with source-row inspection and grouped comparison bars.
- First-class model clarification response rather than forcing ambiguous questions into calculations. Local tests use a fake model; live interpretation remains to be evaluated separately.
- ISO-date before/after filters, monthly/yearly groups and distinct counts. Currency conversion, date-locale conversion, arithmetic across columns, period-change calculations and joins are not implemented.
- Unsaved-work warnings, opt-in autosave after an explicit save, separate version copies and per-sheet conversation preservation.
- Cloud workspace revision checks reject stale writes from another tab. Older open clients must reload/reopen before updating. Copies are separate workspaces, not a durable version timeline or undo stack. Local storage does not have cloud concurrency protection.
- Health endpoint, authenticated configuration status, request references, response timing and sanitised unexpected-error logs. This is not yet hosted alerting, an availability guarantee or a completed restore drill.
- CI now configures an isolated Postgres service for the existing database integration suite.
- `/plans` explains current limits and private-beta status. Paid checkout, subscription billing, invoices, team entitlements and payment webhooks are not enabled.

## Next workflow milestones

1. Independent durable workflow definitions with deliberate retention, versioned approvals and a source-dataset version per run.
2. Parameter inputs (month, date range, status), column mapping and preview of changed/missing types.
3. Conditional steps, intermediate outputs and explicit multi-sheet joins with cardinality checks.
4. A workflow run history with retries, per-step state, input-required checkpoints and review/resume.
5. Suggest candidate workflows from repeated successful tasks; require user approval before remembering or changing rules.
6. Reusable business definitions and preferences with provenance, editable scope and explicit forget controls. Keep rules separate from temporary raw data.
7. Read-only integrations and refreshed inputs; approved recipients before any report delivery or external action.
8. Team ownership, permissions, publishing and subscription entitlements after workflow value is proven.
