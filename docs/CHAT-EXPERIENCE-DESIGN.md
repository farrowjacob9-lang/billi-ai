# Naxium conversation and workbench design

Research: 23 October 2026. Proposed direction, not a claim that the redesign is implemented. User references: Codex, ChatGPT, Claude and Claude Code. Preserve Naxium's own neutral identity and business terminology.

## What is wrong now

The user's screenshot shows workflow/storage/service controls before the conversation, a large repeated heading, equal visual weight for secondary controls, several nested vertical scroll areas, a spreadsheet competing with chat even when it is not being inspected, and long repeated source/privacy paragraphs. The sidebar's recent reports do not represent the currently saved CRM conversation. Users have to discover implementation controls rather than express a task.

The conversation should be the front door. A user should be able to upload a file, ask for an outcome, review a concrete proposal and save/reuse it without learning how our query engine works.

## Research and interpretation

| Reference | Documented pattern | Naxium adaptation |
|---|---|---|
| [ChatGPT release notes](https://help.openai.com/en/articles/6825453-chatgpt-release-notes) | Conversation navigation, persistent composer, responsive sidebar and predictable scroll behaviour | A readable central thread, always-available composer and compact recent work |
| [Codex app](https://openai.com/index/introducing-the-codex-app/) | Project-organised threads, in-thread review and comments on work | Organise by business/project; show real workflow progress and reviewable outputs |
| [Claude artifacts](https://support.claude.com/en/articles/17153992-what-are-artifacts-and-how-do-i-use-them) | Reusable outputs beside the conversation, available for further editing | Open a report or workflow in a purposeful right panel, not another chat bubble |
| [Claude Code desktop](https://code.claude.com/docs/en/desktop) | Configurable panels, plan mode, permission modes and review of changes | Separate proposing from running; keep activity inspectable and external actions explicit |

These are documented interaction principles. The proposed Naxium geometry, labels and styling below are design recommendations, not descriptions of those products or an audited pixel-for-pixel comparison. The Codex introduction is historical; it links to current product material. An old Canvas documentation URL was unavailable, so it is not used as supporting evidence.

## Proposed desktop layout

- **Left sidebar, approximately 240 px:** New conversation; Recent work (actual saved conversations); Workflows library; account/settings at bottom. Collapse it. Hide technical service configuration in settings. Avoid parallel “Routines” and “Workflows” concepts.
- **Compact header, approximately 56 px:** editable conversation/workspace title, truthful save state, Show workbench and an overflow menu. No marketing heading once work starts.
- **Main conversation:** centred content about 720–800 px wide when the workbench is closed; comfortable line spacing, restrained user bubbles, open assistant messages. One thread scroll region that fills the viewport. Composer anchored at its bottom.
- **Optional right workbench:** resizable, roughly 420–640 px, with Data / Workflow / Results tabs. Open it when an output or source inspection needs it; close or expand it without losing the thread. It owns one scroll region. Large spreadsheets can expand to full width. Do not stack the workbench below every message on mobile.

On smaller screens, chat is primary and the workbench becomes a full-screen sheet with a clear Back to conversation action. Keep the keyboard from covering the composer. Restore the place the user was reading when switching surfaces.

## Conversation behaviour

**Empty state:** one short prompt (“What would you like to work on?”), the composer and an attachment action. A few genuine task examples below it, such as “Review my sales follow-ups”. No empty workflow selector or save panel above it.

**After upload:** a compact file chip with filename, selected sheet and row count. A short confirmation; offer Show data. Do not repeat a paragraph of tool capabilities. Put privacy details behind a labelled information control while preserving access to the full policy.

**Workflow request:** the assistant proposes a named plan in the thread. Show purpose, input, 2–5 readable steps and important assumptions. Ask one necessary clarification with answer chips only when it changes the plan. Default suggestions remain explicitly proposed, not secretly adopted.

**Preview and approval:** show genuine preview results beside the plan. One primary action: Save workflow. Separate scheduling from saving; “daily” in a name must not imply a background schedule is connected. Show invalid input as Needs attention and a precise repair action; do not restart the user with generic query prompts.

**Execution:** display real states — Checking input, Running steps, Needs attention, Ready to review — driven by actual requests/jobs. No fake progress timers or invented actions. Let users stop supported work and retry failed work safely.

**Answers:** lead with the useful result, then a compact source badge (“24 rows · grouped by Stage”). Put filters, calculation details and precision under Show workings. Clicking a source opens highlighted rows in Data. Charts and detailed tables belong in Results. Retain scope, source version and units; don't reduce evidence to decorative checkmarks.

**Memory:** after explicit approval, a short receipt identifies what was remembered and offers Edit / Forget. Saved workflows have clear names and last-used/source status. Distinguish reusable rules from temporary uploaded records. Show retention accurately.

**Scroll/focus:** auto-follow while the user is at the latest message. If they scroll up, preserve position and offer Jump to latest. Updating a result must not scroll the whole app. New conversation starts at the empty state with composer focus. Source inspection returns focus to its trigger when closed.

## Visual feel

Use system sans-serif, warm neutral light surfaces and an equivalent charcoal dark theme; reserve one accent for primary actions and selection. Body text around 15–16 px with 1.5–1.65 line height, smaller muted metadata that remains readable, generous horizontal space and compact vertical tool rows. Use borders sparingly, mostly for the composer, attachments and outputs. Avoid rounded cards nested inside more rounded cards. Define spacing/type/colour tokens rather than appending more competing CSS overrides.

State colours must not be the only signal. Support keyboard navigation, visible focus, screen readers, reduced motion and comfortable touch targets. Split-panel resize controls need keyboard alternatives.

## Implementation sequence

1. Establish viewport-height app layout and tokenised styles. Move storage/configuration/workflow management out of the top of chat. Preserve existing capabilities behind the new navigation.
2. Extract a conversation shell, composer and optional workbench; preserve readable scroll position and mobile behaviour.
3. Render proposals and actions inline. The current daily-sales template/save path is an interim functional slice, not the finished chat layout.
4. Unify saved work and recent conversation navigation. Represent actual save states and retention. Migrate existing work without loss.
5. Add workbench tabs and source selection, then consolidate result rendering and real activity states.
6. Verify the sales-CRM journey end to end with a few users before adding more controls.

## Acceptance criteria

- At typical laptop size, the conversation and composer are visible immediately without scrolling past administration panels.
- A first-time user can upload the CRM, request a review, understand the proposed steps and save it without being told where to click.
- The active file, workflow draft and saved state remain unambiguous.
- Users can review a table/report while continuing the conversation, and can return to chat on mobile.
- No lost messages/data, hidden permissions, misleading save confirmations, unsolicited scheduling, global page jumps or focus traps.
- Verify at 390, 768 and 1440 px, with keyboard-only operation, Safari/WebKit and Chromium. Include long messages, 10-column files, errors and interrupted requests.
