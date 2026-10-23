# Connected Naxium product experience

23 October 2026. Product-wide design following the first chat/workbench implementation. This describes the next implementation direction; it is not implemented behaviour.

## Principle

Chat and direct controls operate on the same work, files, workflows and outputs. Users can express an outcome in conversation or click a clear action. Both paths show the same state and preserve the same context.

The interface should answer: What am I working on? What input is selected? What is Naxium doing? What changed? What can I do next? Can I return to this later?

## Repository findings

- `App.tsx` uses local view/panel state; pages have no durable navigation identity for a particular conversation/run. Browser Back and reload cannot reconstruct every place the user was working.
- `Sidebar.tsx` separately lists saved work, recent reports, report routines and workflows. These represent overlapping ways to return to work.
- `ListViews.tsx` and older routine/report APIs preserve the original single-week transaction model; the workflow builder uses a separate definition/job model.
- Opening an old report can keep unrelated current messages (`openRun(...,false)`). An output and its originating conversation are not consistently linked.
- Workspace saving is an explicit snapshot; workflow approval and saving the conversation are separate actions. People must understand internal storage boundaries.
- The workflow panel exposes raw plan JSON and manual answer assembly. These are useful advanced controls but weak default product entry points.
- Settings mix prototype copy, account controls, history management and other concerns. The business/workspace picker currently opens settings, which does not match its visual promise.
- Raw files, saved parsed data, reusable definitions and historical results have different lifetimes; current cloud workflow deletion follows source-workspace deletion. A unified interface cannot conceal that dependency.

## Shared model and destinations

| Item | User-facing meaning | Connection to the rest of the app |
|---|---|---|
| Work | An ongoing task, e.g. “Sales follow-ups” | Owns the conversation and links to inputs, outputs and runs |
| Input | A named file/sheet version | Identified in the composer and every dependent result |
| Output | A review, table, chart or report | Opens in the workbench and links to the question/run that produced it |
| Workflow | An approved repeatable method | Can be inspected/edited from its library or a conversation; each execution creates a run |
| Run | One execution with particular inputs and settings | Shows status, results and review decisions; offers Continue in chat |

These internal distinctions need not become five separate sidebar sections. Proposed navigation: New work, recent/saved work, Workflows, Activity, and account/settings. Outputs remain discoverable within their work and run context. Existing legacy reports should be accessible during migration; do not erase or relabel historical records misleadingly.

## Connected journeys

**Start:** New work opens the composer. Upload attaches an input and suggests a task based on known capabilities. The header shows the work title and honest save state. Initial retention consent remains explicit; subsequent authorised autosave removes repeated saving chores.

**Understand:** A question produces a useful answer and source badge. Click the badge to inspect the relevant rows; click the output to expand it. Ask follow-up questions against the explicitly selected input. Switching sheets preserves per-sheet context and makes that scope visible.

**Build:** Ask for a workflow. A proposed method appears alongside a concise chat explanation. Clarify only missing decisions that change behaviour, with optional choices. Preview results, edit the proposal and approve once. Show exactly what rules were remembered and how to change or forget them.

**Repeat:** Open a workflow from the sidebar or ask to run it. Identify it in the conversation, request the next input if necessary and preview mapping/schema changes. Run approved steps, report actual progress and highlight any input-required step. Changing data never quietly changes a previously approved method.

**Review:** Results, errors and approvals belong to a run. “Show me why” reveals the calculation and input version. “Change the date range” proposes/executes the supported refinement with the changed scope visible. Save/share/export controls act on this identified output. Any future external action names its destination and requires the appropriate explicit approval.

**Return:** Recent work restores its conversation and linked files/results. Activity opens the run with a Continue in chat action. Browser Back restores the previous location. Display expired/unavailable source data honestly; do not present re-execution on fresh data as the historical answer.

**Recover:** An import problem keeps the attempted file/context identifiable and gives a precise next action. A failed save leaves a visible unsaved state. A run failure offers supported retry or repair without losing the conversation. Deletion explains linked effects and asks once at the destructive action; undo is offered only where restoration is actually implemented.

## Interaction contract across the program

- Consistent terms and verbs: work, file, workflow, run; Open, Run, Review, Save, Export. Consolidate legacy routine terminology through an explicit compatibility/migration path.
- One canonical state for the active work/input/run. Chat commands, buttons, panels and libraries call the same application actions with the same validation and permissions.
- Stable identifiers and routes for work, workflow and run; preserve panel selection, draft text and reading position through navigation. Sensitive cell contents stay out of URLs.
- A real event/activity model links input selection, proposal approval, execution and output creation. Chat narrates meaningful events without flooding the thread with duplicate operational logs.
- Common visual tokens, menus, dialogs, lists, loading/error states and keyboard conventions across login, settings, libraries and the workbench. A polished chat shell cannot compensate for inconsistent surrounding screens.
- Show what is remembered, its scope, owner and retention, with Edit/Forget controls. Changing retention requires an intentional product and data-policy decision.
- Keep service configuration and usage accounting in settings. Surface relevant limits or failed connections at the moment they affect an action, with a route to resolve them.
- Do not claim a general chat action is supported simply because its words match a narrow template. Route supported requests clearly and preserve a helpful unsupported/clarification path.

## Recommended implementation order

1. Define shared work/input/output/workflow/run types and commands; add stable navigation and linked IDs without deleting existing records.
2. Consolidate saved/recent work and activity; fix report-to-conversation linking and misleading picker/settings behaviour.
3. Give workflow creation/run/repair one guided path reachable from both chat and the library. Keep manual plan editing under advanced controls.
4. Unify save/approval states and implement independently retained/versioned workflow definitions before promising durable workflow memory.
5. Bring settings, account recovery, empty/error/loading screens and mobile navigation into the same design system.
6. Verify three complete journeys: first CRM review; rerun next week's file; recover from changed columns or failed execution. Include reload, Back, cancellation, two-tab conflicts and returning from Activity.

Success means a new user can complete and repeat a useful job without a narrated tour, and can always identify its input, result, saved state and next action. Test that with observed journeys rather than counting implemented panels.
