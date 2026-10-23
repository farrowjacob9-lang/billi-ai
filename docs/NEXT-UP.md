# Naxium — product synthesis and next-session handoff

Consolidated 23 October 2026. Read this first when continuing product strategy or implementation. It records the latest user clarifications and supersedes conflicting recommendations in earlier research/design documents. Proposed architecture and next steps below are not implemented capabilities.

## 1. The agreed product direction

Naxium helps owners and decision makers get practical work done, while turning their accepted way of working into a repeatable business process.

The intended experience is:

1. **“Help me do this.”** The owner brings a real task, information or existing work.
2. **“That's how I want it.”** Their edits, decisions and acceptance establish the desired result and method.
3. **The next time they request the same job, it gets done that way.** They should not need to say “remember this,” “save these steps” or “create a workflow.”

The repeated method can become a workflow behind the scenes. A workflow is not automatically a schedule, an autonomous agent or permission to take external actions. It may simply be the method used when the owner asks again.

The owner does not have to understand workflow design. Practical business knowledge is expressed through working with useful outputs. Questions are small, relevant decisions when necessary, not the primary product experience.

## 2. What the user corrected — preserve these distinctions

- **Not another generic AI chat product.** Broad reasoning or nicer conversation is insufficient value.
- **Not a guided interview or setup questionnaire.** Extract knowledge through useful work, corrections and decisions. Ask only where an unresolved choice materially changes the job.
- **Not “do it this way next time.”** The product should carry the accepted method forward without a separate instruction to remember it.
- **Not a manual workflow builder as the default experience.** Adding successful answers as steps is an existing implementation, not the intended finished interaction.
- **Not necessarily an analysis or sales-review product.** Uploading a spreadsheet for analysis was the prototype journey, not a confirmed definition of the business.
- **The leads-sheet creation/update scenario was illustrative and then described by the user as probably not a good example.** Do not interpret it as an approved scope to build spreadsheet creation or a CRM now.
- **Sales/quoting remains a useful test domain, not a selected market or locked feature roadmap.** We need a realistic task to validate the mechanism.
- **A process consultant is an internal analogy.** The software supplies some process-analysis and structuring expertise; it should still produce usable work, rather than leave the owner with advice to implement elsewhere.
- **Smooth learning is not hidden, uncontrolled learning.** Distinguish an individual action, a possible preference and an established rule. Keep remembered behavior inspectable and reversible; seek a small confirmation when scope is ambiguous or consequential.

## 3. The customer value and competitive hypothesis

The customer pays for a useful business process becoming easy to establish, repeat and maintain. The owner should avoid the configuration, technical translation and ongoing repair otherwise required from themselves, a specialist or a collection of tools.

Foundation-model reasoning is a replaceable input to the product. Better models should improve Naxium's interpretation and task handling; Naxium does not need to build a frontier model.

Potential value is the combination of:

- Useful first output from an ordinary business request.
- Business-specific definitions, exceptions and responsibilities discovered through use.
- Accepted behavior that persists reliably across requests and fresh inputs.
- Validated execution, readable evidence and clear recovery when inputs change.
- Continuity of work and decisions, rather than isolated outputs.
- Low owner effort and low support burden.

This is a hypothesis, not an existing moat. Do not rely on the claim that large providers will never serve tailored workflows. They already provide many building blocks. Naxium must demonstrate a substantially easier complete experience for a specific job and customer.

## 4. What research established

Research was desk research of current official documentation and OECD SME reports. No competitor was hands-on benchmarked, no customers were interviewed, and willingness to pay was not established.

| Evidence | Consequence |
|---|---|
| ChatGPT supports code-backed analysis, persistent project context and configurable workspace agents with reusable processes, tools and schedules. | Do not claim competitors only chat, forget everything, cannot calculate reliably or cannot repeat work. |
| Claude supports reusable skills, connected tools and recurring tasks. | “Teach once” and scheduling alone are not differentiation. |
| Excel Copilot supports custom skills; Zapier supports automation and approvals; HubSpot/Pipedrive support business workflows; Julius supports code-backed reporting. | Neither spreadsheet chat, source-backed reports nor generic workflow building is uncontested. |
| OECD research identifies operational integration, time, maintenance and skill barriers. | Reduced setup and maintenance are credible problems to investigate, not proof of demand for Naxium. |
| Our own user found manual workflow creation confusing. | Workflow creation must emerge from getting useful work done, rather than expose implementation structure. |

Sources and detailed evidence: [Competitive research](NAXIUM-COMPETITIVE-STRATEGY.md). Primary references: [OpenAI agents](https://help.openai.com/en/articles/20001143-chatgpt-workspace-agents-for-enterprise-and-business), [OpenAI analysis](https://help.openai.com/en/articles/8437071-data-analysis-with-chatgpt), [Claude skills](https://academy.claude.com/tutorials/customize-claude-cowork), [Claude recurring tasks](https://support.claude.com/en/articles/13854387-schedule-recurring-tasks-in-claude-cowork), [OECD 2026 SME research](https://www.oecd.org/en/publications/empowering-smes-in-the-age-of-ai_bf5a9816-en.html).

Earlier recommendations to focus on a weekly sales review are a candidate experiment, not the final user-approved product definition. Experimental prices and pilot targets in the research are unvalidated proposals.

## 5. Proposed architecture to investigate next

This is a product/engineering starting point, not a finalized schema or instruction to implement every component immediately.

| Concept | Responsibility |
|---|---|
| Work/task | The owner's requested outcome, current inputs, output and task status |
| Business context | Scoped definitions, responsibilities and exceptions, with provenance and uncertainty |
| Interaction evidence | Relevant edits, decisions and acceptance tied to an identified task/output/input version |
| Candidate method | A proposed reusable procedure derived from the successful task, including known unknowns |
| Approved/established method | Versioned inputs, rules, steps, output expectations and validation examples |
| Recognition and execution | Identify whether a later request matches that method; check inputs; execute the applicable version or surface a focused decision |
| Review and recovery | Show material changes, retain history, distinguish one-off choices, repair input changes and allow correction/forgetting |

An LLM may interpret requests, identify possible patterns and propose changes. Application code must enforce schemas, access control, execution limits and stored-rule scope. The model should not silently overwrite established behavior.

Important unresolved design decisions:

- What signals constitute acceptance of a result or method? An edited cell, a download or silence is not necessarily approval of a general rule.
- Which low-impact preferences can carry forward visibly without another question, and which business rules need explicit confirmation?
- How do we infer scope: this record, this task, this process or the whole business?
- How do we recognize the same job without wrongly reusing an old method?
- How do we distinguish formatting preferences from calculation rules and business decisions?
- What should happen when a method is incomplete, ambiguous or incompatible with new inputs?
- What data and rules should persist, for how long, and under what customer consent and deletion policy?

Do not solve these by asking for permission after every interaction. Prototype the smallest decision that prevents a material misunderstanding and test whether the interaction remains natural.

## 6. Current implementation — foundation and gaps

Repository: `/workspace/billi-ai`; branch `spreadsheet-questions`; draft [PR #2](https://github.com/farrowjacob9-lang/billi-ai/pull/2).

Preview: https://billi-ai-git-spreadsheet-questions-naxium-langs-projects.vercel.app/

Latest application/CI-fix checkpoint: `ae06b12bfa084b1328be2bcdd8009b1f854d3c3c`. The connected UI is deployed; CI passed after correcting a screenshot test's machine-specific output path. Domain `naxium.app` and Resend cutover remain separate setup work.

Existing capabilities:

- Accounts/recovery and business-isolated storage.
- CSV and server-parsed Excel ingestion, including the exact test CRM compatibility fix.
- Questions translated into validated calculation plans executed in code, with source inspection.
- Optional saved work, reviews, exports, per-sheet conversations and cloud save conflict protection.
- Approved independent calculation steps reusable on another sheet, required-column checks and optional scheduled jobs.
- A bounded daily-sales-review proposal; not a general task/process discovery engine.
- Chat/workbench layout, shared saved-work list, Workflows library, Activity, saved-work/report links, Back/reload behavior and preserved in-session drafts.

Not yet supplied by the current application:

- Capturing work corrections into scoped candidate business rules.
- Automatically establishing and recognizing a reusable method from accepted work.
- Independently retained/versioned workflow memory with regression examples.
- General spreadsheet creation, editing or information merging.
- Stable entity matching and immutable input versions for historical comparisons.
- A persistent lifecycle for assigned/completed/snoozed business actions.
- Proven comparative advantage, customer willingness to pay or subscription economics.

Cloud workflow definitions currently follow their source workspace's 30-day retention/deletion lifecycle. This cannot support a promise of enduring business memory. Do not silently alter retention to fix the positioning.

Validation at the application checkpoint: production build/typecheck, 27 browser scenarios and CI passed. Locally, 36 unit tests passed with 19 external-database tests skipped; CI supplied Postgres and passed its database suite. Browser AI tests use fake providers, so they do not establish live-model interpretation quality.

More implementation detail: [STATE](STATE.md), [Workflows](WORKFLOWS.md), [Connected experience](CONNECTED-PRODUCT-EXPERIENCE.md), [Setup](NAXIUM-SETUP.md). Older checkpoint sections describe historical states; prefer the latest checkpoint over contradictory older text.

## 7. Next up — recommended work order

### A. Specify one complete interaction before expanding the feature list

Pick one realistic owner task to exercise the learning mechanism, using sales/quoting if useful. Define:

- The initial request and real input.
- A useful first output.
- Two or three natural corrections or choices the owner makes.
- What changes only once and what becomes a candidate reusable rule.
- The visible signal of acceptance and any necessary scope confirmation.
- The second request with fresh or changed input.
- The expected remembered behavior, failure cases and recovery.

Avoid another long conceptual interview. Use a concrete walkthrough or interactive prototype to resolve behavior. The goal is to demonstrate the mechanism, not to select an entire industry from one example.

### B. Build the smallest end-to-end learning slice

After the interaction is clear, implement one supported task, one meaningful correction, one scoped reusable method and one later reuse. Link evidence to input/output versions; preserve current validation and tenant isolation. Show what was carried forward and let the owner change or forget it. Do not start with a generic autonomous agent, a large workflow canvas or many new integrations.

### C. Verify the critical behavior

Acceptance cases:

1. Owner gets useful work without describing a workflow or selecting calculation operators.
2. A one-off correction does not become a global rule.
3. An accepted reusable choice affects the next matching task without a separate “remember” command.
4. An unrelated task does not inherit that choice.
5. Ambiguity or changed input produces a focused decision, not a confident guess.
6. A rule change is inspectable and reversible; prior outputs remain attributable to the version used.
7. Repetition does not silently authorize scheduling or external actions.
8. Reload, expiry and deletion match the explicit persistence policy.

Separate deterministic execution tests from live-model request interpretation and method-recognition evaluations.

### D. Test the commercial hypothesis with owners

Observe real work and compare total setup, correction, checking and maintenance effort against the current method and a reasonably configured ChatGPT/Claude equivalent. Include human assistance in both effort and cost. Test subsequent uses, not only first-output quality. Use small paid pilots to learn repeat usage and willingness to pay; do not infer demand from positive demo reactions.

## 8. Success criteria and boundaries

The key product measure is decreasing owner effort for a recurring useful job while preserving correctness and control. Messages sent, workflow count and model sophistication are not sufficient measures of value.

Track first useful result, effort to correct it, effort on the second/third request, materially wrong assumptions, recovery burden, unprompted return, actual payment/renewal and support cost. Do not equate time released with cash saved, pipeline identified with revenue earned, or generated output with completed work.

No request in this synthesis authorizes contacting customers, changing production retention, sending business communications, switching domains or implementing every proposed capability. The present task is to preserve the agreed direction and make the next work concrete.

## Suggested next-session opening instruction

“Read docs/NEXT-UP.md and the latest STATE checkpoint. Design one concrete end-to-end example where an owner asks for useful work, makes a natural correction, accepts the result, and receives the established behavior on the next matching request without asking to save a workflow. Distinguish one-off choices from reusable rules. Show the interaction and minimal architecture before expanding implementation scope. The previous sales spreadsheet example is a test vehicle, not a committed CRM product.”
