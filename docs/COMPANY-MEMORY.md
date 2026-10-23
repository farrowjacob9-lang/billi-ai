# Company memory: first review slice

Company memory holds explicitly kept text records independently of temporary spreadsheet workspaces. Records belong to the signed-in business, not the user who created them. This version has one shared business access scope; it does not yet add teams, invites, role-based record permissions, document ingestion, semantic search or a complete revision archive.

## Enable account storage

Apply `db/manual/007_company_memory_neon.sql` once in the Neon SQL Editor as owner on the same production database used by migrations 005 and 006. The full transaction records migration 007 and commits. Downloadable copy: `/setup/007-company-memory.sql`. Do not run again if already recorded. No production credentials are available in the development environment; local validation does not apply this migration to production.

The sidebar Company memory button opens the library. Account mode never silently falls back to browser storage. When 007 is absent, it explicitly reports setup is required and saving is disabled. Browser-only prototype mode uses device local storage and labels that limitation.

## Test with the owner

1. Open Company memory. Enter `Quote 1276 — Dave’s Electrical` and paste the fictional `/samples/company-memory-quote-1276.txt` reference.
2. Keep it. Close the library, refresh or sign in in a second browser. Ask `Find quote 1276`.
3. Open the citation, inspect the record and choose Use in chat. Ask `Help me build a quote for John’s Electrical from this reference`.
4. Confirm the output is a review draft, carries the source citation, flags missing details/old rates and does not claim to send, approve or update the original quote.
5. Export the record, edit it, and verify a stale edit is rejected. Delete it and verify new searches/drafts cannot use it. Excerpts already quoted in saved conversation history remain until that workspace expires or is deleted.
6. With a spreadsheet attached, ask today's Melbourne weather. It should use provider web search and show cited public source URLs. Ask Total Amount afterwards to check that calculation still works.

## Retrieval and provenance

Search uses bounded lexical matching, exact numeric identifier boundaries and up to six references. It searches up to 200 current memory records plus the latest 30 unexpired saved workspaces, including sheet rows and saved messages. This is deliberately not semantic recall. Multiple plausible matches are offered for selection; the app does not automatically merge unrelated quotes. No upload or conversation is silently added to permanent memory.

Source cards include title, update date and, for spreadsheet matches, the original row number. Clicking a permanent-record citation fetches its current content and revision. Saved-work citations reopen the source workspace; the exact excerpt/row is displayed in the citation, but automatic scrolling to the original message or row is not implemented yet. An expired/deleted workspace may no longer open. A permanently kept record survives that expiry/deletion and keeps its own text.

A selected permanent record is visibly attached to the composer. Draft requests fetch it server-side with the caller's tenant and expected revision, then recheck after generation so a changed/deleted source cannot produce a late new result. Drafts are model-generated, not audited calculations: monetary changes use confirmation placeholders and require review. The sheet calculator remains the code-verified path for arithmetic.

## Data control

Memory records remain until explicitly deleted or the business account is deleted. Workspace expiry remains 30 days; accepted approaches retain their existing independent 30-day lifetime. Memory stores current text/revision, dates, creator and optional workspace/message reference. Edits/deletions reject stale revisions; account operations create content-free audit events. There is no foreign key to the source workspace. Tenant RLS is enabled and forced, in addition to explicit tenant predicates. The runtime refuses a superuser/BYPASSRLS application role.

The library exports individual/all records as JSON and allows editing and deletion. There are 200 records per business, with 120-character titles and 20,000-character bodies. These are initial bounds, not a claim of production-scale knowledge management.

Searching saved records does not send them to a model. Selecting Use in chat and submitting a draft request sends that record's text and the new request to Anthropic, with an explicit disclosure in the library. Private context, worksheet rows and previous conversation history are not included in general web-search requests. General web answers use at most two provider searches per request; public current-information questions require citations or return a verification failure rather than an invented live answer. Live provider permissions/results must still be smoke-tested on the preview; automated browser checks use a fake provider.

## Next review points

Native source navigation to exact messages/rows; duplicate detection; richer typed business records; semantic retrieval with verified IDs; company-controlled retention choices; record revision history; granular permissions; structured quote output and code-checked totals; attachments and connectors; live-provider adversarial testing. Do not call this a general autonomous business knowledge system yet.
