---
id: 260419-review-findings-classifier
created: 2026-04-19T05:58:52.000Z
updated: 2026-04-19T15:30:00.000Z
description: 'Review findings classifier — blockers re-spawn planner, nitpicks go inline'
related: []
stage: complete
stages:
  refinement: complete
  grilling: pending
  execution: complete
  verification: complete
  abandoned: false
council_review_ran:
  plan: true
  code: true
confidence:
  score: 0.89
  factors:
    context: -0.05
    scope: -0.03
    complexity: -0.02
    familiarity: -0.01
backlog_item: review-findings-classifier
modified_files:
  - agents/do-plan-reviewer.md
  - agents/do-code-reviewer.md
  - agents/do-council-reviewer.md
  - skills/do/references/council-brief-plan.md
  - skills/do/references/council-brief-code.md
  - skills/do/references/stage-plan-review.md
  - skills/do/references/stage-code-review.md
  - skills/do/task.md
  - skills/do/continue.md
  - skills/do/scripts/council-invoke.cjs
  - skills/do/scripts/stage-decision.cjs
  - skills/do/scripts/__tests__/council-invoke.test.cjs
  - skills/do/scripts/__tests__/task-workflow-structural.test.cjs
  - skills/do/scripts/__tests__/stage-decision.test.cjs
---

# Review findings classifier — blockers re-spawn planner, nitpicks go inline

## Problem Statement

`stage-plan-review.md` (and `stage-code-review.md` by analogy) treats every non-PASS verdict the same — any CONCERN returned by self-reviewer or council triggers a full `do-planner` / `do-executioner` re-spawn. That's ~45k opus tokens and ~3 minutes per round. In a healthy iteration, late rounds surface nitpicks (example-text corrections, missing one-line clarifications, fix-text wording) that a one-line Edit tool call would resolve. Observed live during Task α plan review: across 4 iterations, ~6 of ~12 findings were nitpicks that cost full planner spawns. The reviewers are doing the right thing — they're finding real residuals — but the response is over-sized for the severity.

**Proposed Fix:** Extend `stage-plan-review.md` (and `stage-code-review.md`) with a finding-classification step BEFORE the ITERATE branch. Each reviewer finding gets a severity tag:
- **blocker** — scope gap, unassigned responsibility, contradicts authoritative source, or a design-level ambiguity. Requires planner/executioner re-spawn with a structured patch brief.
- **nitpick** — doc-text wording, missing example, typo, one-line clarification, or a fix that demonstrably changes no code path. Handle inline via Edit tool; log the inline patch in a dedicated "Review Iterations — Inline Patches" subsection.

If the set of findings is all-nitpick: PASS the stage after inline application, no re-spawn. If any finding is a blocker: re-spawn planner with all findings (nitpicks included — the planner can batch them into the same patch pass). Keep the 3-iteration cap; nitpick-only passes don't count against it.

Classification could be done by the orchestrator reading each finding's severity (reviewers already produce severity-ish language), or by adding an explicit `severity: blocker | nitpick` field to the reviewer output contract. Latter is cleaner but requires prompt changes in both `do-plan-reviewer.md` and the council-invoke codex prompt. Former is zero-config but relies on orchestrator judgment.

Secondary surfaces to review once the core logic lands: `stage-code-review.md` (same pattern), `task.md` Step 6 + Step 10 (reference the new classification), possibly the `do-plan-reviewer` / `do-code-reviewer` output contracts (if explicit severity tagging is adopted).

Scope: primarily `skills/do/references/stage-plan-review.md` + `skills/do/references/stage-code-review.md`, with optional reviewer-output-contract updates. Ship with tests covering: all-PASS (no-op), all-nitpick (inline + pass), mixed (re-spawn with full brief), all-blocker (re-spawn with full brief).

<!--
Per D-01: Comprehensive problem statement for session resumption.
Include: symptoms, impact, related context, any prior attempts.
This section should have enough detail that /do:continue can
fully understand the task without additional context.
-->

## Clarifications

### Complexity (was: -0.10 -> now: -0.05)
**Q:** Should stage-plan-review.md PR-4.5 contain a ready-to-run `node -e` bash block that invokes planReviewDecisionMatrix(), or prose instructions telling the orchestrator to invoke the function conceptually?
**A:** Whatever is more consistent and less ambiguous — which means: use a ready-to-run `node -e` bash block, consistent with the existing PR-0 and PR-1 patterns in stage-plan-review.md.

<!--
Additional clarifications appended below as grilling continues.
-->
### Complexity (was: -0.05 -> now: -0.02)
**Q:** Should stage-decision.cjs use the same installed-vs-dev dual-path resolver (treating it as a first-class installed script), or require it only relative to the dev path?
**A:** Yes — use the same dual-path resolver. stage-decision.cjs is a first-class installed script alongside council-invoke.cjs and must be resolved the same way.



### Scope (was: -0.10 -> now: -0.03)
**Q:** Should PR-5 keep the two-branch outer structure (separate `if review_iterations < 3` / `if review_iterations = 3` branches) or collapse both branches into one matrix call (Option B)?
**A:** Option B — collapse into one matrix call. More consistent and less ambiguous: all decision logic lives in the matrix (single source of truth), executor calls `planReviewDecisionMatrix()` once and branches on its return action, no pre-matrix iteration check that could diverge from matrix logic.

### Familiarity (was: -0.05 -> now: -0.03)
**Q:** Should the inline-patch log entry follow the same ### Iteration <N> structure (self-review verdict, council verdict, changes made), or a simpler format?
**A:** Yes — same ### Iteration <N> structure with self-review verdict, council verdict, and changes made lines, even for nitpick-only rounds that resolve inline.

### Familiarity (was: -0.03 -> now: -0.01)
**Q:** Should stage-decision.test.cjs use the same full boilerplate as council-invoke.test.cjs or a leaner pattern?
**A:** Leaner pattern — planReviewDecisionMatrix is a pure function with no I/O, no mocking, no async behavior. Use direct require (no try/catch import guard), same describe/test structure, but skip the mock/beforeEach/afterEach imports that council-invoke.test.cjs uses for its I/O-bound tests.


## Context Loaded

- `database/projects/do/project.md` - project overview, key directories, conventions, agent hierarchy
- `skills/do/references/stage-plan-review.md` - primary target: current ITERATE logic (PR-5), verdict combination tables (PR-4), reviewer spawning (PR-3)
- `skills/do/references/stage-code-review.md` - secondary target: analogous ITERATE logic (CR-5), verdict combination tables (CR-4), reviewer spawning (CR-3)
- `agents/do-plan-reviewer.md` - output contract: PASS/CONCERNS/RETHINK with evidence per 5 criteria, unstructured findings text
- `agents/do-code-reviewer.md` - output contract: APPROVED/NITPICKS_ONLY/CHANGES_REQUESTED with file:line references per 6 criteria
- `agents/do-council-reviewer.md` - output contract: flattened text block `VERDICT: <v>\nAdvisor: <a>\nFindings:\n- <f1>\n- <f2>\nRecommendations:\n- <r1>` (Step 4, line 64-71); Step 3.5 tightens this from ambiguous free text to one-item-per-line bullets; this is NOT raw advisor markdown — the agent runs council-invoke.cjs, parses JSON, and returns flat text
- `skills/do/scripts/council-invoke.cjs` - council output JSON shape: `{success, advisor, verdict, findings[], recommendations[]}`, parseVerdict/parseFindings/parseRecommendations functions; NOTE: `parseFindings()` parses raw advisor markdown (`### Key Findings` sections) — it does NOT parse the `do-council-reviewer` agent's flattened text output
- `skills/do/references/council-brief-plan.md` - council brief template for plan reviews, response format with Key Findings and Recommendations sections
- `skills/do/references/council-brief-code.md` - council brief template for code reviews, same structure
- `skills/do/task.md` - orchestrator Step 6 (plan review) and Step 10 (code review) reference delegation
- `skills/do/continue.md` - stage routing, plan review and code review delegation via @references
- `agents/do-planner.md` - respawn target during ITERATE, tools/model/maxTurns (30 turns, opus model)

## Approach

### Design Decision: Tagged-findings contract (reviewer + orchestrator changes)

The problem statement offers two routes: (A) explicit `severity: blocker | nitpick` field in reviewer output contracts, or (B) orchestrator-side classification of findings. This plan adopts **tagged findings as the canonical contract**: reviewers and council briefs produce `[blocker]` / `[nitpick]` prefixed findings, the orchestrator reads those tags via a `classifyFindings()` helper, and the stage references branch on the result. This is an explicit contract change touching reviewer agents, council briefs, the parsing helper, and both stage references. The alternative (pure orchestrator-side heuristic classification with no contract changes) was rejected because it relies on fragile text inference and produces inconsistent tagging.

### Scope clarification for code review

The current `stage-code-review.md` verdict combination table already maps every `NITPICKS_ONLY` outcome (from either reviewer) to `VERIFIED`. The only path to `ITERATE` is when at least one reviewer returns `CHANGES_REQUESTED`. The real gap is narrower than originally stated: a `CHANGES_REQUESTED` response can contain mixed-severity items (some blockers, some nitpicks), and the current stage treats ALL of them as equally blocking. This task addresses that gap — it does NOT replace or duplicate the existing `NITPICKS_ONLY -> VERIFIED` semantics.

### Code-review inline patching: deferred

Applying inline patches in code review and auto-marking `VERIFIED` is a behavior change: `VERIFIED` currently means reviewers have accepted the code. Auto-marking it after orchestrator edits skips a review pass. Rather than introduce a re-review loop (adding complexity) or break the `VERIFIED` semantic, code-review inline patching is **deferred to a follow-up task**. This first task implements classification and inline patching for **plan review only**. Code review gets classification (to separate blockers from nitpicks in the `CHANGES_REQUESTED` finding list) but still re-spawns do-executioner for any `ITERATE` — the improvement is that the executioner receives a prioritized brief (blockers first, nitpicks second) rather than an undifferentiated list.

### Steps

1. **Update `do-plan-reviewer.md` output contract to include severity tags**
   - File: `agents/do-plan-reviewer.md`
   - In the CONCERNS and RETHINK response format templates, change each finding line from `- <criterion>: <specific issue>` to `- [blocker|nitpick] <criterion>: <specific issue>`
   - Add a classification rule in the `<review_flow>` section: blocker = scope gap, unassigned responsibility, contradicts authoritative source, design-level ambiguity; nitpick = doc-text wording, missing example, typo, one-line clarification, fix that changes no code path
   - RETHINK findings are always blocker by definition (fundamental problems)
   - Expected outcome: plan reviewer findings carry explicit severity tags

2. **Update `do-code-reviewer.md` output contract to include severity tags**
   - File: `agents/do-code-reviewer.md`
   - In the CHANGES_REQUESTED response format template only, change each issue line from `- <criterion>: file:line - <description>` to `- [blocker|nitpick] <criterion>: file:line - <description>`
   - NITPICKS_ONLY format is unchanged (it already maps to VERIFIED; tagging those findings adds no value)
   - Add the same classification rule adapted for code criteria: blocker = incorrect behavior, missing test for changed logic, security issue, type unsafety; nitpick = style, naming, comment wording, missing doc-string
   - Expected outcome: code reviewer CHANGES_REQUESTED findings carry explicit severity tags

3. **Update council brief templates to request severity tags in findings**
   - Files: `skills/do/references/council-brief-plan.md`, `skills/do/references/council-brief-code.md`
   - In the "Response Format > Key Findings" section, change `- [Finding 1 -- cite file:line or pattern]` to `- [blocker|nitpick] Finding 1 -- cite file:line or pattern`
   - Add a one-line instruction above the findings list: "Tag each finding as [blocker] or [nitpick]. blocker = design-level issue, scope gap, correctness bug. nitpick = wording, style, minor clarification."
   - Expected outcome: council advisors (codex, gemini) also tag their findings

3.5. **Update `do-council-reviewer.md` output contract to emit findings as one-item-per-line bullets (per council finding 1, iteration 5)**
   - File: `agents/do-council-reviewer.md`
   - **Problem:** The current Step 4 output format says `Findings: <findings from JSON>`. The agent receives a JSON `findings[]` array and must serialize it into flat text — but the serialization format is unspecified. The agent may comma-join the array, stringify it as JSON, or use newlines. If any single finding contains commas (common in natural language — e.g., "scope gap in modules A, B, and C"), a downstream comma-split parser would fracture one finding into multiple fake findings, making blocker/nitpick classification unreliable.
   - **Change:** Replace the `Findings: <findings from JSON>` line in the Step 4 response template with a bulleted-list format:
     ```
     VERDICT: <verdict from JSON>
     Advisor: <advisor from JSON>
     Findings:
     - <finding 1 from JSON>
     - <finding 2 from JSON>
     Recommendations:
     - <recommendation 1 from JSON>
     - <recommendation 2 from JSON>
     ```
   - Each element of the JSON `findings[]` array becomes one `- ` prefixed line. Same treatment for `recommendations[]`. The `Findings:` and `Recommendations:` labels become section headers on their own line, followed by bulleted items on subsequent lines.
   - Update the error handling templates (lines 78-83, 86-91) to use the same bulleted format: `Findings:\n- council-invoke.cjs failed -- <raw error output>`
   - **Why this is safe:** The `do-council-reviewer` agent is a script runner, not a reviewer — it simply reformats JSON output. Changing the serialization format does not change what it reviews. The agent already parses the JSON `findings` array in Step 3; the only change is how it emits each element.
   - Expected outcome: council runner output has a deterministic one-finding-per-line shape that `parseCouncilRunnerOutput()` can parse unambiguously without comma-splitting

4. **Add `parseSelfReviewFindings()`, `parseCouncilRunnerOutput()`, and `classifyFindings()` helper functions to `council-invoke.cjs`**
   - File: `skills/do/scripts/council-invoke.cjs`
   - **`parseSelfReviewFindings(markdown)`**: New exported function that extracts findings from self-review agent freeform markdown. The self-reviewer (`do-plan-reviewer.md`) returns findings in two known formats: (a) CONCERNS — list under `**Issues found:**` with format `1. <criterion>: <specific issue>` (numbered) or `- <criterion>: <specific issue>` (bulleted), and (b) RETHINK — list under `**Fundamental issues:**` with the same format options. For `do-code-reviewer.md`, the same approach applies: CHANGES_REQUESTED findings appear under `**Issues requiring changes:**`. **Section-boundary slicing (per council finding 2, iteration 5):** The reviewer output formats place additional bullet lists immediately after the findings block — `**Recommendations:**` in CONCERNS (do-plan-reviewer.md:79-81), `**Why this is blocking:**` / `**Suggested direction:**` in RETHINK (do-plan-reviewer.md:93-97), and `**Required changes:**` in CHANGES_REQUESTED (do-code-reviewer.md:103-105). Without explicit boundary detection, the parser would misclassify those items as findings. Implementation: (1) Match the findings header using regex for known headers: `/\*\*Issues found:\*\*|\*\*Fundamental issues:\*\*|\*\*Issues requiring changes:\*\*/`; (2) Capture text from the line after the matched header up to (but NOT including) the next bold subsection header, detected by regex `/^\*\*[^*]+:\*\*/m` — this catches `**Recommendations:**`, `**Required changes:**`, `**Why this is blocking:**`, `**Suggested direction:**`, and any future bold subsection; (3) Within the bounded slice only, extract list items using a unified pattern that handles both numbered (`/^\d+\.\s+/`) and bulleted (`/^[-*]\s+/`) formats, stripping the leading marker in both cases; (4) If no findings header is found, return empty array. Returns `string[]` (same shape as `parseFindings()` output for council). The parser must handle both numbered and bulleted formats because reviewer agents may drift between formats across model versions — the current templates in `do-plan-reviewer.md` (lines 76-77, 90-91) and `do-code-reviewer.md` (lines 99-101) use numbered items, but future template revisions may switch to bullets or vice versa.
   - **`parseCouncilRunnerOutput(agentText)`**: New exported function that extracts findings from `do-council-reviewer`'s flattened text output. **Contract tightening (per council finding 1, iteration 5):** The current `do-council-reviewer.md` Step 4 output format serializes the JSON `findings[]` array as `Findings: <findings from JSON>` — an ambiguous free-text serialization. If any single finding contains commas (e.g., "scope gap in modules A, B, and C"), a naive comma-split would fracture one finding into multiple fake findings, making blocker/nitpick classification unreliable. **Solution:** This step depends on the new Step 3.5 (below) which updates `do-council-reviewer.md` to emit findings as one-item-per-line bullets (`- <finding>`) instead of ambiguous free text. With the tightened contract, `parseCouncilRunnerOutput()` implements: (1) match the `Findings:` section using regex `/^Findings:\s*([\s\S]*?)(?=^(?:Recommendations:|$))/m`, (2) within the captured text, extract only lines matching the bullet pattern `/^[-*]\s+(.+)/` — each bullet is one finding, (3) trim each entry and filter empties, (4) return `string[]`. **Fallback for pre-contract output:** If no bullet lines are found in the Findings section (indicating the agent has not yet been updated or used an older format), fall back to treating the entire captured text block as a single finding string (wrapped in a one-element array). This single-string fallback is untagged and therefore defaults to blocker via `classifyFindings()`, degrading gracefully to current behavior. The parser does NOT split on commas — comma-splitting is explicitly rejected per council finding 1. This function is distinct from `parseFindings()` (which parses raw advisor markdown with `### Key Findings` headers) and from `parseSelfReviewFindings()` (which parses self-review agent markdown). The stage reference must use this function for council output because it receives the agent's flattened text, NOT the raw advisor markdown or the JSON object.
   - **`classifyFindings(findings)`**: New exported function that takes an array of finding strings (from `parseSelfReviewFindings()`, `parseCouncilRunnerOutput()`, or `parseFindings()`) and returns `{ blockers: string[], nitpicks: string[] }`. Classification logic: if finding starts with `[blocker]` tag it as blocker; if `[nitpick]` tag as nitpick; if untagged, default to blocker (safe fallback, prevents silent skips).
   - Export all three from `module.exports` for use by stage references and for testing
   - Expected outcome: reusable extraction and classification functions available to orchestrator, covering council runner output, raw advisor markdown, and self-review freeform markdown — each with a dedicated parser matching its actual data shape

5. **Rewrite PR-5 ITERATE branch in `stage-plan-review.md` with classification logic**
   - File: `skills/do/references/stage-plan-review.md`
   - After PR-4 combines verdicts and the result is ITERATE, insert a new step PR-4.5: "Classify Findings"
     - Extract self-reviewer findings using `parseSelfReviewFindings(self_review_output)` — this handles the freeform markdown output from `do-plan-reviewer.md` (CONCERNS: `**Issues found:**` section; RETHINK: `**Fundamental issues:**` section)
     - Extract council findings using `parseCouncilRunnerOutput(council_agent_output)` — this handles the flattened text block returned by `do-council-reviewer.md` (format: `VERDICT: ...\nAdvisor: ...\nFindings: ...\nRecommendations: ...`). Do NOT use `parseFindings()` here — that function parses raw advisor markdown (`### Key Findings` sections) and would return empty results against the council runner's flattened output format
     - Merge both finding arrays into a single `allFindings` list
     - Run `classifyFindings(allFindings)` to split into `{ blockers, nitpicks }`
     - Determine: `has_blockers = blockers.length > 0` and `nitpicks_only = blockers.length === 0 && nitpicks.length > 0`
   - Call `planReviewDecisionMatrix(classifiedFindings, review_iterations)` from `stage-decision.cjs` to determine the action. The matrix returns one of: `APPROVED`, `INLINE_NITPICKS`, `RESPAWN`, `MAX_ITERATIONS`.
   - Modify PR-5 ITERATE handling based on the matrix result:
     - **If `INLINE_NITPICKS` (all findings are nitpicks):**
       - Apply each nitpick inline using Edit tool calls (the orchestrator does this directly, no agent spawn). Log the inline patches in a new "Review Iterations -- Inline Patches" subsection in the task file. Then **convert the internal `INLINE_NITPICKS` action to `APPROVED`** for the caller: set `council_review_ran.plan: true` and return APPROVED. The caller contract (`stage-plan-review.md` line 10) only exposes APPROVED as a success branch — `INLINE_NITPICKS` never surfaces beyond the stage boundary. No re-review loop — the stage passes immediately after inline application. This matches the Problem Statement: "If the set of findings is all-nitpick: PASS the stage after inline application, no re-spawn." Nitpick-only rounds do NOT count against the 3-iteration cap.
     - **If `RESPAWN` (any finding is a blocker):**
       - Proceed with existing ITERATE logic: spawn do-planner with ALL findings (blockers + nitpicks bundled), increment iteration counter, loop back to PR-3
     - **If `MAX_ITERATIONS`:** escalate per existing PR-5 MAX_ITERATIONS handling
     - **If `APPROVED`:** pass through (empty findings — matrix should not be reached in this case, but handles it gracefully)
   - Expected outcome: nitpick-only rounds apply inline edits and immediately PASS the stage (no planner respawn, no re-review); blocker rounds respawn planner as before

6. **Add classification step to CR-5 ITERATE branch in `stage-code-review.md` (no inline patching, no decision matrix)**
   - File: `skills/do/references/stage-code-review.md`
   - After CR-4 combines verdicts and the result is ITERATE, insert CR-4.5: "Classify Findings"
     - Collect all findings from both reviewers (the existing behavior)
     - Run `classifyFindings()` (from `council-invoke.cjs`) to split findings into blockers and nitpicks
   - Modify CR-5 ITERATE spawning of do-executioner:
     - Pass the classified findings as a **prioritized brief**: blockers section first ("Must fix"), nitpicks section second ("Should fix")
     - The executioner still fixes everything in one pass, but the structured brief helps it prioritize
   - **No decision matrix for code review (per council finding 2, iteration 7).** Code review CR-5 ITERATE always respawns do-executioner — there is no inline-fix path, no `INLINE_NITPICKS` action, and no `codeReviewDecisionMatrix()` function. The only enhancement is brief prioritization via `classifyFindings()`. Unlike plan review (which has a full `planReviewDecisionMatrix()` encoding APPROVED/INLINE_NITPICKS/RESPAWN/MAX_ITERATIONS), code review's decision logic remains simple: any ITERATE = respawn. A `codeReviewDecisionMatrix()` would be a single-path function returning RESPAWN every time, which adds no value. If a future task introduces code-review inline patching, that task creates the matrix at that time.
   - Do NOT add an inline-fix path or auto-VERIFIED shortcut for code review (deferred — see "Code-review inline patching: deferred" above)
   - Preserve existing `NITPICKS_ONLY -> VERIFIED` semantics in CR-4 combination table (no changes)
   - Expected outcome: code review ITERATE respawns with a better-structured brief; no semantic changes to VERIFIED; no phantom decision matrix

7. **Update `task.md` Step 6 and Step 10 handler commentary AND caller contracts**
   - File: `skills/do/task.md`
   - In Step 6 handler text:
     - Add a note: "ITERATE may resolve inline if all findings are nitpicks (see PR-4.5 in stage-plan-review.md)"
     - **Rewrite the ITERATE bullet** to explicitly permit stage-plan-review.md to perform inline nitpick edits. Current text says "Do NOT handle plan revisions manually or edit the task file yourself" — this must be revised to: "Do NOT handle plan revisions manually. stage-plan-review.md owns the ITERATE loop, including inline Edit tool calls for nitpick-only rounds. The caller must not bypass stage logic or edit the task file outside of the stage reference."
   - In Step 10 handler text, add a note: "ITERATE now passes classified findings to do-executioner (see CR-4.5 in stage-code-review.md)"
   - **Document the "Review Iterations -- Inline Patches" subsection** in task.md: add a schema comment (similar to the existing `## Review Iterations` template comments) noting that PR-4.5 nitpick-only rounds populate a "### Inline Patches" subsection under Review Iterations, listing each nitpick and the Edit applied. This ensures orchestrators on resume know the subsection exists and what it contains.
   - Expected outcome: caller contracts no longer contradict inline edits; Inline Patches subsection is documented in the task file schema

8. **Update `continue.md` plan review and code review handler commentary AND caller contracts**
   - File: `skills/do/continue.md`
   - In the Plan Review result handling section:
     - Add a note: "ITERATE may resolve inline if all findings are nitpicks (see PR-4.5 in stage-plan-review.md)"
     - **Rewrite the ITERATE bullet** to match the revised task.md contract: "Do NOT handle plan revisions manually. stage-plan-review.md owns the ITERATE loop, including inline Edit tool calls for nitpick-only rounds. The caller must not bypass stage logic or edit the task file outside of the stage reference."
   - In the Code Review result handling section, add a note: "ITERATE now passes classified findings to do-executioner (see CR-4.5 in stage-code-review.md)"
   - Expected outcome: consistency between task.md and continue.md; caller contracts explicitly permit inline nitpick edits by stage references

9. **Add `parseSelfReviewFindings` and `classifyFindings` tests to `council-invoke.test.cjs`**
   - File: `skills/do/scripts/__tests__/council-invoke.test.cjs`
   - **`classifyFindings` test cases:**
     - All findings tagged `[blocker]` -> all in blockers array, nitpicks empty
     - All findings tagged `[nitpick]` -> all in nitpicks array, blockers empty
     - Mixed tagged findings -> correct split
     - Untagged findings -> default to blockers (safe fallback)
     - Empty findings array -> both arrays empty
   - **`parseSelfReviewFindings` test cases:**
     - CONCERNS format with numbered items: markdown with `**Issues found:**` header and `1. criterion: issue` lines -> extracted as string array (matches current `do-plan-reviewer.md` template, lines 76-77)
     - CONCERNS format with bulleted items: markdown with `**Issues found:**` header and `- criterion: issue` lines -> extracted as string array (backward-compatible with bullet format)
     - RETHINK format with numbered items: markdown with `**Fundamental issues:**` header and `1. criterion: issue` lines -> extracted as string array (matches current template, lines 90-91)
     - RETHINK format with bulleted items: same but using `- ` prefix -> extracted correctly
     - CHANGES_REQUESTED format (code reviewer): markdown with `**Issues requiring changes:**` header and `1. criterion: file:line -- desc` lines -> extracted (matches `do-code-reviewer.md` template, lines 99-101)
     - PASS format (no findings section) -> empty array
     - Mixed content: findings interspersed with non-list lines -> only list items extracted
     - Mixed list markers within same section: some items numbered, some bulleted -> all extracted
     - Findings with `[blocker]`/`[nitpick]` tags preserved in output (tags not stripped, so `classifyFindings` can process them downstream)
     - **Section boundary tests (per council finding 2, iteration 5):**
     - CONCERNS with Recommendations section following: markdown with `**Issues found:**` + 2 numbered findings + `**Recommendations:**` + 2 bulleted recommendations -> only the 2 findings extracted, recommendations excluded
     - RETHINK with Why-this-is-blocking section following: markdown with `**Fundamental issues:**` + 1 finding + `**Why this is blocking:**` + explanatory text -> only the 1 finding extracted
     - CHANGES_REQUESTED with Required-changes section following: markdown with `**Issues requiring changes:**` + 2 findings + `**Required changes:**` + 2 fix items -> only the 2 findings extracted, required-changes items excluded
     - Back-to-back bold sections with no findings: markdown with `**Issues found:**` immediately followed by `**Recommendations:**` -> empty array (no list items between the two headers)
   - **`parseCouncilRunnerOutput` test cases (updated per council finding 1, iteration 5 — now expects bulleted-list format from tightened `do-council-reviewer.md` contract):**
     - Standard bulleted format (canonical): `VERDICT: CONCERNS\nAdvisor: codex\nFindings:\n- [blocker] scope gap\n- [nitpick] typo\nRecommendations:\n- fix both` -> extracted as `['[blocker] scope gap', '[nitpick] typo']`
     - Single finding: `Findings:\n- [blocker] scope gap in modules A, B, and C\nRecommendations:` -> extracted as `['[blocker] scope gap in modules A, B, and C']` (commas within a finding are preserved, not split)
     - Empty findings: `Findings:\nRecommendations: ...` -> empty array (no bullet lines between Findings: and Recommendations:)
     - Script-error format (bulleted): `Findings:\n- council-invoke.cjs failed -- timeout\nRecommendations:\n- Check script path` -> extracted as `['council-invoke.cjs failed -- timeout']` (untagged, defaults to blocker via classifyFindings)
     - **Fallback — pre-contract legacy format (no bullets):** `Findings: [blocker] scope gap, [nitpick] typo\nRecommendations: fix both` -> no bullet lines found, entire captured text `'[blocker] scope gap, [nitpick] typo'` returned as single-element array `['[blocker] scope gap, [nitpick] typo']` (untagged as a whole, defaults to blocker — safe degradation)
     - Tags preserved in output (not stripped by parser)
   - Expected outcome: extraction handles all three output shapes (self-review markdown, council runner flat text, raw advisor markdown) with correct parser-to-format matching, covering current reviewer templates and future format drift

10. **Add structural tests for the new stage patterns in a dedicated test file (per council finding 1, iteration 6)**
    - File: `skills/do/scripts/__tests__/task-workflow-structural.test.cjs` (NEW file — do NOT extend `beta-skill-structural.test.cjs`)
    - **Rationale:** `beta-skill-structural.test.cjs` is explicitly scoped to the beta project flow (`/do:project`). It hardcodes `BETA_STAGE_FILES` containing only beta stage references (`stage-project-intake.md`, `stage-phase-plan-review.md`, etc.) and all its `describe` blocks are named `"beta ..."`. Adding `/do:task` workflow assertions there creates cross-scope coupling — a beta-scoped test file would break if task-workflow files change, and vice versa. A dedicated `task-workflow-structural.test.cjs` file keeps the two scopes independent and follows the same naming pattern (`<scope>-structural.test.cjs`).
    - **Structure:** Same assertion style as `beta-skill-structural.test.cjs` (read file, assert pattern present), but scoped to task-workflow files:
      - Define `TASK_STAGE_FILES` array: `stage-plan-review.md`, `stage-code-review.md`
      - Define `TASK_AGENT_FILES` array: `do-plan-reviewer.md`, `do-code-reviewer.md`, `do-council-reviewer.md`
      - Define `TASK_SKILL_FILES` array: `task.md`
      - Define `TASK_SCRIPT_FILES` array: `council-invoke.cjs`, `stage-decision.cjs`
    - **Assertions:**
      - Verify `stage-plan-review.md` contains "PR-4.5" or "Classify Findings" section
      - Verify `stage-plan-review.md` contains "nitpicks_only" or "INLINE_NITPICKS" (inline-then-PASS path)
      - Verify `stage-plan-review.md` contains "parseCouncilRunnerOutput" (correct council parser, not `parseFindings`)
      - Verify `stage-code-review.md` contains "CR-4.5" or "Classify Findings" section
      - Verify `do-plan-reviewer.md` contains "[blocker|nitpick]" in output template
      - Verify `do-code-reviewer.md` contains "[blocker|nitpick]" in CHANGES_REQUESTED template
      - Verify `do-council-reviewer.md` Step 4 response template uses bulleted findings format (contains `- <finding` or similar one-per-line pattern, per council finding 1 iteration 5)
      - Verify `task.md` Step 6 ITERATE bullet permits inline edits by stage reference (contains "inline Edit" or "nitpick-only rounds")
      - Verify `council-invoke.cjs` exports `parseSelfReviewFindings`, `parseCouncilRunnerOutput`, and `classifyFindings` (but NOT `stageDecisionMatrix` — that lives in `stage-decision.cjs`)
      - Verify `stage-decision.cjs` exists and exports `planReviewDecisionMatrix` (NOT a generic `stageDecisionMatrix` — the function is plan-review scoped per council finding 2, iteration 7)
    - Expected outcome: structural smoke tests catch regression if classification is accidentally removed, without polluting the beta-scoped test suite

11. **Add `planReviewDecisionMatrix()` in a dedicated stage helper and add behavior-level tests (per council findings 1+2, iterations 6+7)**
    - **New file: `skills/do/scripts/stage-decision.cjs`** — a stage-oriented helper module, separate from `council-invoke.cjs`
    - **Rationale:** `council-invoke.cjs` is a council adapter focused on reviewer selection, invocation, and response parsing. `planReviewDecisionMatrix()` is stage-orchestration logic (branching on classified findings to decide the stage's next action). Placing it in `council-invoke.cjs` couples stage orchestration to the council transport layer, violating single-responsibility. A dedicated `stage-decision.cjs` module keeps concerns separated: `council-invoke.cjs` owns council transport + parsing helpers, `stage-decision.cjs` owns the decision matrix that stage references implement. The parsing helpers (`parseSelfReviewFindings`, `parseCouncilRunnerOutput`, `classifyFindings`) remain in `council-invoke.cjs` because they are parsing functions that reuse the existing parsing layer and share data shapes with `parseFindings`/`parseVerdict`/`parseRecommendations`.
    - **Scope: plan review only (per council finding 2, iteration 7).** This function is explicitly scoped to plan review (`stage-plan-review.md` PR-4.5 / PR-5 branching). It does NOT encode code review behavior. Code review (`stage-code-review.md`) has no analogous decision matrix — its CR-5 ITERATE path always respawns do-executioner regardless of finding severity. The only code-review enhancement is brief prioritization (blockers first, nitpicks second), which is handled by `classifyFindings()` directly in Step 6 without a dedicated matrix function. If a future task adds code-review inline patching, it should create a separate `codeReviewDecisionMatrix()` function in this same module at that time.
    - **`planReviewDecisionMatrix(classifiedFindings, reviewIterations)` function:** a pure function that encodes the PR-4.5 / PR-5 branching logic. Takes `{ blockers: string[], nitpicks: string[] }` (output of `classifyFindings`) and `reviewIterations` (int). Returns one of: `{ action: 'APPROVED' }`, `{ action: 'INLINE_NITPICKS', nitpicks: string[] }`, `{ action: 'RESPAWN', findings: string[], blockers: string[], nitpicks: string[] }`, `{ action: 'MAX_ITERATIONS' }`. No `nitpickPassCount` parameter — nitpick-only rounds always inline + PASS immediately (no re-review loop, so no counter needed). This function is the testable embodiment of the stage reference prose — if the prose and function diverge, the tests catch it.
    - **`INLINE_NITPICKS` is an internal action, not an external contract (per council finding 1, iteration 7).** The `stage-plan-review.md` caller contract exposes only `APPROVED` as a success branch (line 10: "When this stage returns APPROVED..."). `INLINE_NITPICKS` is an internal action returned by `planReviewDecisionMatrix()` that tells the stage reference to apply inline edits and then convert the outcome to `APPROVED` before returning to the caller. The stage reference (Step 5) handles this conversion explicitly: when the matrix returns `INLINE_NITPICKS`, the stage applies edits, sets `council_review_ran.plan: true`, and returns `APPROVED` to the caller. The caller never sees `INLINE_NITPICKS`. This is documented in the function's JSDoc: "`INLINE_NITPICKS` — stage-internal; caller receives APPROVED after inline application."
    - Export `planReviewDecisionMatrix` from `stage-decision.cjs` module.exports
    - **Test file: `skills/do/scripts/__tests__/stage-decision.test.cjs`** (NEW file — tests for `stage-decision.cjs`)
    - **Test cases (plan review decision matrix only — no code-review matrix tests):**
      - **All-PASS (no findings):** `classifyFindings([])` yields empty blockers + nitpicks -> `planReviewDecisionMatrix({ blockers: [], nitpicks: [] }, 0)` returns `{ action: 'APPROVED' }` (combined verdict was APPROVED, not ITERATE, so the matrix is never entered — test verifies the empty-findings precondition)
      - **All-nitpick, any round:** `classifyFindings(['[nitpick] wording fix', '[nitpick] missing example'])` -> `planReviewDecisionMatrix({ blockers: [], nitpicks: [...] }, 1)` returns `{ action: 'INLINE_NITPICKS', nitpicks: [...] }` (nitpick-only = stage applies inline edits then converts to APPROVED for the caller)
      - **All-nitpick at iteration 3:** same input with `reviewIterations=3` -> still returns `{ action: 'INLINE_NITPICKS', nitpicks: [...] }` (nitpick-only rounds do not count against the iteration cap and always inline + PASS)
      - **Mixed findings (blockers + nitpicks):** `classifyFindings(['[blocker] scope gap', '[nitpick] typo'])` -> `planReviewDecisionMatrix({ blockers: ['scope gap'], nitpicks: ['typo'] }, 1)` returns `{ action: 'RESPAWN', findings: [...], blockers: [...], nitpicks: [...] }` (any blocker triggers respawn with all findings)
      - **All-blocker:** `classifyFindings(['[blocker] design flaw', '[blocker] missing responsibility'])` -> returns `{ action: 'RESPAWN', ... }` with all findings as blockers
      - **All-blocker at iteration 3 (MAX_ITERATIONS):** same blocker input with `reviewIterations=3` -> returns `{ action: 'MAX_ITERATIONS' }`
      - **Untagged findings (safe fallback):** `classifyFindings(['some untagged concern'])` -> defaults to blockers -> `planReviewDecisionMatrix` returns `{ action: 'RESPAWN', ... }` (verifies safe degradation)
    - **No code-review decision matrix tests (per council finding 2, iteration 7).** Code review uses `classifyFindings()` for brief prioritization only — it does not have a decision matrix function. The `classifyFindings()` function is already fully tested in Step 9 (`council-invoke.test.cjs`), covering the split between blockers and nitpicks that Step 6 uses to build the prioritized brief. Adding a code-review "decision matrix" test would test a function that does not exist and would not map to the real CR-5 stage logic, which always respawns.
    - Expected outcome: the plan-review stage decision logic is tested with representative reviewer outputs covering all 4 plan-review flows (all-PASS, all-nitpick inline-then-APPROVED, mixed respawn, all-blocker respawn) plus the MAX_ITERATIONS boundary; code-review is cleanly separated with no phantom decision matrix; stage orchestration logic lives in its own module, not in the council transport layer

## Concerns

1. **Council advisors may not honor severity tags reliably.** External models (codex, gemini) receive the council brief template but may not consistently produce `[blocker]` / `[nitpick]` prefixes. Mitigation: the `classifyFindings()` helper defaults untagged findings to blocker. This means a non-compliant council response degrades gracefully to the current behavior (full respawn). Over time, the brief template wording can be tuned for better compliance.

2. **Inline Edit by orchestrator for plan nitpicks is a new capability pattern.** Currently the orchestrator only spawns agents; it never edits the task file's Approach/Concerns sections itself. For plan nitpicks (wording fixes, missing one-line clarifications), the orchestrator would need to apply Edit tool calls directly. This is safe because the orchestrator already has Edit in its allowed-tools, and nitpick-level changes are by definition small and low-risk. However, if a "nitpick" is misclassified and is actually a design change, the inline edit could be insufficient. Mitigation: the blocker-default-for-untagged rule minimizes this risk.

3. **Code review inline patching deliberately deferred.** The original plan had the orchestrator applying inline code fixes and auto-marking VERIFIED for nitpick-only ITERATE rounds. Council review correctly identified that auto-VERIFIED skips the review pass — VERIFIED means "reviewers accepted the code," not "orchestrator edited it." Rather than adding a re-review loop (complexity) or breaking VERIFIED semantics (correctness risk), code-review inline patching is deferred to a follow-up task. This first task limits code-review changes to providing a prioritized brief to do-executioner.

4. **Nitpick-only inline + PASS skips re-verification of the inline edit.** The revised flow applies nitpick edits inline and immediately PASSes the stage without re-running reviewers. This means a bad inline edit (wrong text, broken formatting) could slip through uncaught. Mitigation: (a) nitpicks are by definition low-risk (wording, examples, typos) — a bad edit at this severity does not affect code paths or design; (b) the inline edit is logged in the "Review Iterations -- Inline Patches" subsection, so it is visible for manual review; (c) if the orchestrator's inline edit is insufficient, the issue will surface during code review (which re-reviews the full task file) or verification. The tradeoff is acceptable: saving ~45k tokens per nitpick round outweighs the risk of a minor text fixup being slightly wrong.

5. **Three distinct parsers for three distinct output shapes — must use the right one.** The plan now has three finding-extraction functions: (a) `parseFindings()` for raw advisor markdown (`### Key Findings` sections — used internally by `council-invoke.cjs` when parsing codex/gemini responses), (b) `parseCouncilRunnerOutput()` for the `do-council-reviewer` agent's flattened text (bulleted `Findings:` section — used by stage references when reading council agent output), (c) `parseSelfReviewFindings()` for self-review agent freeform markdown (`**Issues found:**` / `**Fundamental issues:**` / `**Issues requiring changes:**` sections, bounded by the next bold subsection header — used by stage references when reading self-review agent output). Using the wrong parser against the wrong output shape returns empty findings, which combined with the blocker-default-for-untagged rule degrades to current behavior (full respawn) rather than silent skips. `parseCouncilRunnerOutput()` now parses bullet lines only (per tightened `do-council-reviewer.md` contract from Step 3.5), avoiding comma-splitting ambiguity. `parseSelfReviewFindings()` now slices at section boundaries (per explicit stop-at-next-bold-header rule), avoiding capture of recommendations/fixes as findings. Both parsers preserve `[blocker]` / `[nitpick]` tags. Tests in Steps 9 and 11 verify each parser against its target format, including section-boundary and comma-in-finding edge cases.

6. **Self-review output format is less structured than council output — section boundary required.** The `do-plan-reviewer.md` agent returns freeform markdown with findings under `**Issues found:**` or `**Fundamental issues:**` headers, followed immediately by additional bold-header sections (`**Recommendations:**`, `**Required changes:**`, `**Why this is blocking:**`, `**Suggested direction:**`). Without explicit section-boundary detection, the parser would capture recommendation and fix items as findings, producing misclassified entries. `parseSelfReviewFindings()` addresses this by slicing at the next bold subsection header (`/^\*\*[^*]+:\*\*/m`) — only list items between the findings header and the boundary are extracted. Within the bounded slice, the parser handles both numbered (`/^\d+\.\s+/`) and bulleted (`/^[-*]\s+/`) list markers per lines 76-77/90-91 in `do-plan-reviewer.md` and lines 99-101 in `do-code-reviewer.md`. If the reviewer omits the findings header entirely, the function returns an empty array, and ALL classification weight falls on council findings. Combined with the untagged-defaults-to-blocker rule, the worst case is a full re-spawn — identical to current behavior. Tests in Step 9 explicitly cover section-boundary edge cases: recommendations excluded, required-changes excluded, back-to-back headers yielding empty array.

7. **Caller contract rewrites in task.md and continue.md must be precise.** Steps 7 and 8 rewrite the ITERATE bullets to permit inline edits by stage-plan-review.md while still prohibiting callers from bypassing stage logic. The new wording must be clear that only the stage reference may perform inline edits — not the orchestrator caller directly. If the wording is ambiguous, a future orchestrator might interpret it as permission to skip stage-plan-review entirely. Mitigation: the revised contract text explicitly names `stage-plan-review.md` as the permitted editor and retains the "must not bypass stage logic" prohibition.

8. **`planReviewDecisionMatrix()` is a testable proxy for stage-reference prose — drift risk, module placement, and action contract (per council findings 1+2, iterations 6+7).** The stage reference `stage-plan-review.md` encodes the decision logic in prose. Step 11 extracts that logic into a pure `planReviewDecisionMatrix()` function so it can be tested. If the prose and function diverge (e.g., someone updates the stage reference's branching logic but forgets to update the function), the tests may pass while the actual behavior is wrong. **Module placement:** `planReviewDecisionMatrix()` lives in `skills/do/scripts/stage-decision.cjs`, NOT in `council-invoke.cjs`. Council finding 2 (iteration 6) correctly identified that `council-invoke.cjs` is a council adapter (reviewer selection, invocation, response parsing) and `planReviewDecisionMatrix()` is stage-orchestration logic — mixing them violates single-responsibility. The parsing helpers (`parseSelfReviewFindings`, `parseCouncilRunnerOutput`, `classifyFindings`) remain in `council-invoke.cjs` because they are parsing functions that reuse the existing parsing infrastructure (`parseFindings`, `parseVerdict`, `parseRecommendations`). `stage-decision.cjs` imports `classifyFindings` from `council-invoke.cjs` as a dependency. **Action contract (per council finding 1, iteration 7):** The function returns `INLINE_NITPICKS` as an internal action that the stage reference converts to `APPROVED` before returning to the caller. The caller contract in `stage-plan-review.md` (line 10) only exposes `APPROVED` as a success branch — `INLINE_NITPICKS` never crosses the stage boundary. This separation is intentional: the decision matrix encodes "what to do" (inline-edit the nitpicks), the stage reference encodes "how to report it" (as APPROVED). **No code-review decision matrix (per council finding 2, iteration 7):** The function is explicitly plan-review scoped. Code review CR-5 always respawns do-executioner — there is no analogous branching logic to encode. `classifyFindings()` (already tested in Step 9) is sufficient for code-review brief prioritization. A `codeReviewDecisionMatrix()` would be trivial (always RESPAWN) and would not map to any real stage branching. If a future task introduces code-review inline patching, it creates its own matrix function in `stage-decision.cjs` at that time. Mitigation for drift risk: (a) the structural tests in Step 10 (in the new `task-workflow-structural.test.cjs`) verify that the stage reference prose contains the key decision markers (`PR-4.5`, `Classify Findings`, `nitpicks_only`, `INLINE_NITPICKS`), so removal of the prose triggers a test failure; (b) the function's JSDoc explicitly references the stage reference line numbers, making the linkage visible during code review; (c) the function is intentionally simple (a pure branching function with no I/O), minimizing the surface area for drift. The alternative — no behavior tests at all — leaves the decision matrix entirely untested, which is worse than the drift risk.

9. **Contract changes span multiple files — must be deployed atomically.** The severity tagging contract touches reviewer agents, council briefs, the parsing helper, the council runner agent, and both stage references. If only some files are updated (e.g., stage references expect tags but reviewers do not produce them), the blocker-default-for-untagged fallback ensures safe degradation — every finding is treated as a blocker. This is by design: partial deployment degrades to current behavior, never to silent skips.

10. **`do-council-reviewer.md` output format change requires `parseCouncilRunnerOutput()` fallback (per council finding 1, iteration 5).** Step 3.5 changes the council runner's serialization from ambiguous free text to one-item-per-line bullets. If the agent is not yet updated (or if a cached/older version runs), the parser would see no bullet lines. Mitigation: `parseCouncilRunnerOutput()` includes an explicit fallback — if no bullet lines are found in the Findings section, it wraps the entire captured text as a single finding string. This single string is untagged and defaults to blocker via `classifyFindings()`, degrading to current behavior (full respawn). The fallback ensures the contract tightening is non-breaking during rollout.

## Execution Log

### 2026-04-19 10:00 - Execution started
**Status:** In progress
**Steps:** 0/11 complete

### 2026-04-19 10:05 - Step 1: Update do-plan-reviewer.md output contract
**Files:**
- `agents/do-plan-reviewer.md` - Added Step 2.5 classification rule with blocker/nitpick definitions; changed CONCERNS finding template from `<criterion>: <issue>` to `[blocker|nitpick] <criterion>: <issue>`; changed RETHINK finding template to always use `[blocker]` prefix

**Status:** Complete

### 2026-04-19 10:07 - Step 2: Update do-code-reviewer.md output contract
**Files:**
- `agents/do-code-reviewer.md` - Added Step 2.5 classification rule for CHANGES_REQUESTED only with blocker/nitpick definitions; changed CHANGES_REQUESTED finding template to include `[blocker|nitpick]` prefix; noted NITPICKS_ONLY format unchanged

**Status:** Complete

### 2026-04-19 10:09 - Step 3: Update council brief templates
**Files:**
- `skills/do/references/council-brief-plan.md` - Changed Key Findings section to use `[blocker|nitpick]` prefix format; added instruction line "Tag each finding as [blocker] or [nitpick]..."
- `skills/do/references/council-brief-code.md` - Same changes as council-brief-plan.md

**Status:** Complete

### 2026-04-19 10:11 - Step 3.5: Update do-council-reviewer.md output format to bulleted findings
**Files:**
- `agents/do-council-reviewer.md` - Changed Step 4 response template from `Findings: <findings from JSON>` (comma-ambiguous) to bulleted `Findings:\n- <finding 1>\n- <finding 2>` format; updated error handling templates to same bulleted format

**Status:** Complete

### 2026-04-19 10:15 - Step 4: Add parseSelfReviewFindings, parseCouncilRunnerOutput, classifyFindings to council-invoke.cjs
**Files:**
- `skills/do/scripts/council-invoke.cjs` - Added three new exported functions: `parseSelfReviewFindings(markdown)` with section-boundary slicing and dual numbered/bulleted format support; `parseCouncilRunnerOutput(agentText)` with bullet-line parsing and legacy fallback; `classifyFindings(findings)` with [blocker]/[nitpick] tag detection and untagged-defaults-to-blocker rule

**Status:** Complete

### 2026-04-19 10:20 - Step 5: Rewrite PR-5 ITERATE branch in stage-plan-review.md
**Files:**
- `skills/do/references/stage-plan-review.md` - Added PR-4.5 "Classify Findings" step with node -e bash block calling parseSelfReviewFindings+parseCouncilRunnerOutput+classifyFindings; rewrote PR-5 ITERATE handling into INLINE_NITPICKS/RESPAWN/MAX_ITERATIONS/APPROVED branches based on planReviewDecisionMatrix() result; INLINE_NITPICKS path applies edits inline and converts to APPROVED (no re-review); RESPAWN path passes prioritized brief (blockers first, nitpicks second) to do-planner

**Status:** Complete

### 2026-04-19 10:24 - Step 6: Add classification step to CR-5 in stage-code-review.md
**Files:**
- `skills/do/references/stage-code-review.md` - Added CR-4.5 "Classify Findings" step with node -e bash block calling classifyFindings(); updated CR-5 ITERATE to pass prioritized brief (blockers section "Must fix" first, nitpicks section "Should fix" second) to do-executioner; no decision matrix added (code review always respawns); updated iteration log to include blocker/nitpick counts

**Status:** Complete

### 2026-04-19 10:27 - Step 7: Update task.md Step 6 and Step 10 handler commentary
**Files:**
- `skills/do/task.md` - Rewrote Step 6 ITERATE bullet to permit inline Edit tool calls by stage-plan-review.md; added note about PR-4.5 nitpick-only rounds; added schema comment documenting "### Inline Patches" subsection; updated Step 10 ITERATE bullet to note classified findings and CR-4.5

**Status:** Complete

### 2026-04-19 10:29 - Step 8: Update continue.md plan review and code review handler commentary
**Files:**
- `skills/do/continue.md` - Rewrote Plan Review ITERATE bullet to match task.md contract (permits inline edits by stage-plan-review.md, notes PR-4.5 nitpick path); updated Code Review ITERATE bullet to note classified findings and CR-4.5

**Status:** Complete

### 2026-04-19 10:35 - Step 9: Add parseSelfReviewFindings, parseCouncilRunnerOutput, classifyFindings tests to council-invoke.test.cjs
**Files:**
- `skills/do/scripts/__tests__/council-invoke.test.cjs` - Added imports for parseSelfReviewFindings, parseCouncilRunnerOutput, classifyFindings; added 3 new describe blocks: classifyFindings (5 test cases: all-blocker, all-nitpick, mixed, untagged-default, empty), parseSelfReviewFindings (13 test cases: numbered/bulleted CONCERNS, numbered/bulleted RETHINK, CHANGES_REQUESTED, PASS, mixed content, mixed markers, tag preservation, 4 section-boundary tests), parseCouncilRunnerOutput (6 test cases: canonical bulleted, single with commas preserved, empty, script-error, legacy fallback, tag preservation)

**Status:** Complete

### 2026-04-19 10:40 - Step 10: Create task-workflow-structural.test.cjs
**Files:**
- `skills/do/scripts/__tests__/task-workflow-structural.test.cjs` - NEW file; 9 describe blocks covering: stage-plan-review.md (PR-4.5, INLINE_NITPICKS, parseCouncilRunnerOutput, parseSelfReviewFindings), stage-code-review.md (CR-4.5, NITPICKS_ONLY->VERIFIED preserved), do-plan-reviewer.md (blocker/nitpick tags), do-code-reviewer.md (blocker/nitpick tags in CHANGES_REQUESTED), do-council-reviewer.md (bulleted format), task.md (inline Edit), council-invoke.cjs exports (parseSelfReviewFindings, parseCouncilRunnerOutput, classifyFindings; NOT planReviewDecisionMatrix), stage-decision.cjs existence + planReviewDecisionMatrix export (NOT codeReviewDecisionMatrix)

**Status:** Complete

### 2026-04-19 10:48 - Step 11: Create stage-decision.cjs and stage-decision.test.cjs
**Files:**
- `skills/do/scripts/stage-decision.cjs` - NEW file; planReviewDecisionMatrix pure function (APPROVED/INLINE_NITPICKS/RESPAWN/MAX_ITERATIONS); dual-path resolver for council-invoke.cjs dependency; exports planReviewDecisionMatrix only (no codeReviewDecisionMatrix)
- `skills/do/scripts/__tests__/stage-decision.test.cjs` - NEW file; 7 test cases: all-PASS->APPROVED, all-nitpick round 1->INLINE_NITPICKS, all-nitpick round 3->INLINE_NITPICKS (no cap), mixed->RESPAWN, all-blocker->RESPAWN, all-blocker round 3->MAX_ITERATIONS, untagged->RESPAWN (safe fallback)

**Deviations:**
- JSDoc comment in council-invoke.cjs used regex literal syntax `/^\*\*[^*]+:\*\*/m` which Node.js parser misread as regex division operator, causing SyntaxError. Fixed by rewriting comment to use backtick notation instead of regex literal in JSDoc.
- parseCouncilRunnerOutput regex `(?=^Recommendations:|$)` caused premature termination due to multiline `$` matching end-of-line. Fixed by using index-based string slicing approach instead of regex lookahead.

**Status:** Complete

### 2026-04-19 10:52 - Execution complete
**Status:** Complete

**Summary:**
- Steps completed: 11/11
- Files modified: 11 (8 existing, 3 new)
- Deviations: 2 minor (auto-fixed)
  - JSDoc regex literal in comment caused SyntaxError — rewrote as prose description
  - Regex lookahead with multiline `$` caused premature capture termination — replaced with index-based slicing

### 2026-04-19 11:30 - Code review iteration 2 fixes: PR-5 type bug + stage snippet contract tests
**Files:**
- `skills/do/references/stage-plan-review.md` - PR-5 ITERATE block: renamed placeholder from `<classified_findings>` to `<classified_findings_json>`; changed call from `planReviewDecisionMatrix('<classified_findings>', '<review_iterations>')` to `planReviewDecisionMatrix(JSON.parse('<classified_findings_json>'), <review_iterations>)`; added inline comment above the call documenting expected types; updated prose comment block above the bash block to describe `<classified_findings_json>` as a JSON string and `<review_iterations>` as a bare integer.
- `skills/do/scripts/__tests__/stage-decision.test.cjs` - Added two stage-snippet-contract test cases: (1) documents and asserts that the broken string-input invocation pattern causes incorrect APPROVED regardless of findings, (2) verifies that the correct JSON.parse + integer invocation pattern returns RESPAWN for blockers.

**Decisions:**
- Used `JSON.parse('<classified_findings_json>')` pattern (not raw object literal inline) because PR-4.5 already emits JSON via `console.log(JSON.stringify(classified))`, so the orchestrator can substitute that output verbatim into the JSON.parse call.
- Renamed placeholder to `<classified_findings_json>` to make the string-vs-object distinction explicit in the variable name itself.
- The "broken invocation" test case asserts that `planReviewDecisionMatrix` DOES return APPROVED with string inputs — this documents the failure mode accurately rather than masking it, making the contract violation self-evident.

**Status:** Complete

### 2026-04-19 11:10 - Code review fixes: CR-4.5 extraction flow + bash block placeholder comments
**Files:**
- `skills/do/references/stage-code-review.md` - CR-4.5: Added explicit extraction steps parallel to PR-4.5 — calls `parseSelfReviewFindings()` on self-reviewer output and `parseCouncilRunnerOutput()` on council output, merges into `allFindings`, then calls `classifyFindings(allFindings)`. Added prose comment above bash block documenting `<self_review_output>` and `<council_agent_output>` as required orchestrator substitutions with `<variable_name>` placeholder format.
- `skills/do/references/stage-plan-review.md` - PR-4.5: Added prose comment above bash block documenting `<self_review_output>` and `<council_agent_output>` as required orchestrator substitutions. PR-5 ITERATE: Added prose comment above bash block documenting `<classified_findings>` and `<review_iterations>` as required orchestrator substitutions. Variable references inside bash blocks updated to use `<variable_name>` placeholder format (matching PR-0/PR-1 convention).

**Decisions:**
- Issue 1 fix: CR-4.5 now mirrors PR-4.5 exactly — imports `parseSelfReviewFindings` and `parseCouncilRunnerOutput` alongside `classifyFindings`, so both reviewer output shapes are handled with the correct dedicated parsers.
- Issue 2 fix: Bash blocks are orchestrator templates, not standalone scripts. Added explicit prose block above each bash block listing required in-session variable substitutions. Variable references in the bash block body use `<variable_name>` angle-bracket placeholder style (same convention as `<active_task>` used in PR-0/CR-0).

**Status:** Complete

### 2026-04-19 14:00 - Code review iteration 5 fixes: remove unused import + fix JSDoc param description

**Files:**
- `skills/do/scripts/stage-decision.cjs` - Removed unused `classifyFindings` import and dual-path resolver block (lines 24-32 in the original file). The function is pure; it receives pre-classified findings as input and never calls `classifyFindings` itself. Also updated module-level JSDoc to reflect that `stage-decision.cjs` does not import from `council-invoke.cjs`. Updated `@param reviewIterations` JSDoc from "0-based before increment" to "1-based post-increment (1 = first round, 2 = second, 3 triggers MAX_ITERATIONS)" to match the actual calling convention in `stage-plan-review.md`.

**Decisions:**
- Module-level JSDoc (file header) also said "stage-decision.cjs imports classifyFindings from council-invoke.cjs as a dependency" — updated to accurately describe the calling convention: the stage reference calls `classifyFindings()` and passes the result in; `stage-decision.cjs` does not import it.
- All 11 existing tests pass with no changes needed to the logic.

**Status:** Complete

### 2026-04-19 13:00 - Code review iteration 4 fixes: off-by-one cap + CR-5 deserialize step

**Files:**
- `skills/do/references/stage-plan-review.md` - PR-5 ITERATE: moved iteration counter increment to BEFORE calling `planReviewDecisionMatrix()` (was inside RESPAWN branch, now as Step 1 of ITERATE handling). Updated RESPAWN branch to remove redundant increment and renumber steps 3-6 → 2-5. Added prose explaining the effective 3-round cap: round 1 calls matrix with reviewIterations=1, round 2 with 2, round 3 with 3 → MAX_ITERATIONS.
- `skills/do/references/stage-code-review.md` - CR-5 ITERATE: added explicit Step 3 deserialize step that parses `classified_findings_json` (JSON string from CR-4.5) into a `classified_findings` object via temp-file + Node.js before using `classified_findings.blockers` / `classified_findings.nitpicks` in the executioner prompt. Added "not a copy-paste script" banner and temp-file instructions mirroring PR-5 pattern. Renumbered subsequent steps 4-6 → 5-7.
- `skills/do/scripts/__tests__/stage-decision.test.cjs` - Added boundary test: `reviewIterations=2` with blockers returns RESPAWN (one below the cap of 3), with explanatory comment documenting the pre-increment ordering. Existing `reviewIterations=3` → MAX_ITERATIONS test already covered the upper boundary.

**Decisions:**
- Increment moved to ITERATE entry (before matrix call) for ALL ITERATE rounds including nitpick-only. Nitpick rounds do increment the counter but receive INLINE_NITPICKS regardless of count, so the cap remains effectively blocker-only. The `>= 3` check in `stage-decision.cjs` is unchanged — no code change needed there since the fix is in the stage prose ordering.
- CR-5 deserialize mirrors PR-5 exactly: write JSON to `/tmp/do-cr-classified.json`, parse via `fs.readFileSync` + `JSON.parse`, produce `classified_findings` object. This matches the PR-5 temp-file pattern established in iteration 3.

**Status:** Complete

### 2026-04-19 12:00 - Code review iteration 3 fixes: prose instructions replacing unsafe node -e string interpolation
**Files:**
- `skills/do/references/stage-plan-review.md` - PR-4.5: Replaced `node -e` bash block that interpolated multiline agent output into single-quoted JS string literals with prose instructions telling the orchestrator to write agent output to temp files and read them via `fs.readFileSync`. Example invocation uses `fs.readFileSync('/tmp/do-self-review.txt')` and `fs.readFileSync('/tmp/do-council-review.txt')` instead of string interpolation. PR-5: Same treatment — replaced `JSON.parse('<classified_findings_json>')` pattern with prose instructions to write the JSON to `/tmp/do-classified.json` and read it via `fs.readFileSync`. Added banner "The orchestrator constructs the actual invocation — this is not a copy-paste script." to both sections. Removed duplicate `---` separator introduced by edit.
- `skills/do/references/stage-code-review.md` - CR-4.5: Same treatment as PR-4.5 — replaced `node -e` with multiline string interpolation with prose instructions + temp-file example invocation. Added the same banner clarifying this is an orchestrator instruction, not a copy-paste script.
- `skills/do/scripts/__tests__/stage-decision.test.cjs` - Added new test case: "apostrophe in finding text: JSON path handles correctly when parsed as object" — verifies that finding text containing apostrophes (e.g. "it's a scope gap") survives a JSON.stringify/JSON.parse round-trip correctly and produces the expected RESPAWN action. This guards the temp-file approach where shell never sees the finding text.

**Decisions:**
- PR-4.5/CR-4.5 blocks: switched from string interpolation to temp-file + `fs.readFileSync` pattern. The orchestrator (Claude) already has Write tool access to create temp files, so this is the natural safe pattern for passing multiline agent output to Node.js without shell quoting issues.
- PR-5 block: same approach — `classified_findings_json` from PR-4.5 is written to `/tmp/do-classified.json` before being parsed. Although JSON from `JSON.stringify` would not normally contain unescaped apostrophes in its structure, finding text values (strings) can contain apostrophes that would break a single-quoted shell string used in `JSON.parse('...')`.
- `<review_iterations>` remains a direct inline substitution in PR-5 example — it is a bare integer (e.g. `1`, `2`, `3`) with no shell-special characters, so it is safe to substitute directly.

**Status:** Complete

<!--
This section is populated during the implementation phase (per D-20).

Entry format:
### YYYY-MM-DD HH:MM
**Files:**
- `path/to/file.ts` - Change summary

**Decisions:**
- Plan said X - chose approach Y because Z
- [If error] Tried A, failed because B, resolved with C

**Status:** In progress / Execution complete

Context decision is logged first:
### <timestamp>
**Context decision:** [AskUserQuestion|inline prompt] - user chose [Yes|No]

Final entry has summary:
### <timestamp>
**Status:** Execution complete

**Summary:**
- Files modified: <count>
- Decisions made: <count>
- Deviations: <count or "none">
-->

### 2026-04-19 15:00 - Code review iteration 6 fixes: off-by-one cap + missing before import
**Files:**
- `skills/do/references/stage-code-review.md` - Moved `code_review_iterations` increment to BEFORE the branch selection (mirrors the PR-5 pattern from iteration 4 fix). Replaced the two-branch structure (`### If ITERATE (and code_review_iterations < 3)` / `### If ITERATE (and code_review_iterations = 3)`) with a single `### If ITERATE` entry point that increments first, then gates on the post-increment value. The old MAX_ITERATIONS branch heading renamed to `### MAX_ITERATIONS (code_review_iterations = 3)`. Effective cap is now: round 1 increments to 1 → RESPAWN, round 2 increments to 2 → RESPAWN, round 3 increments to 3 → MAX_ITERATIONS immediately.
- `skills/do/scripts/__tests__/task-workflow-structural.test.cjs` - Added `before` to the destructured import from `node:test` (line 22). Removed the now-redundant `function before(fn)` shim at the bottom of the file (line 265). Tests now use the natively imported `before` hook.

**Decisions:**
- Mirrored the PR-5 fix exactly: increment counter first, then branch on the post-increment value. No change to `stage-decision.cjs` logic needed — the `>= 3` check there was already correct; the bug was purely in the stage-code-review.md prose ordering.
- Removed the shim function rather than leaving it alongside the real import, since a shadowed `before` would mask import failures silently.

**Status:** Complete

### 2026-04-19 15:00 - Verification: 16/16 structural tests pass, 11/11 stage-decision tests pass
**Status:** Complete

## Council Review

<!--
Populated by council review stages (E-1 for plan review, V-1 for code review).

### Plan Review
- **Reviewer:** <advisor name>
- **Verdict:** LOOKS_GOOD | CONCERNS | RETHINK
- **Findings:**
  - Finding with evidence citation
- **Recommendations:**
  - Actionable recommendation
- **User Override:** (only if user proceeded despite CONCERNS/RETHINK)

### Code Review
- **Reviewer:** <advisor name>
- **Verdict:** APPROVED | NITPICKS_ONLY | CHANGES_REQUESTED
- **Files Reviewed:** <count>
- **Findings:**
  - Finding with file:line citation
- **Recommendations:**
  - Actionable recommendation
- **User Override:** (only if user proceeded despite issues)

If council reviews are disabled in config, this section remains empty.
-->

## Verification Results

### Approach Checklist
- [x] Step 1: Updated `do-plan-reviewer.md` output contract — Step 2.5 classification rule added; CONCERNS findings use `[blocker|nitpick]` prefix; RETHINK findings always use `[blocker]`
- [x] Step 2: Updated `do-code-reviewer.md` output contract — Step 2.5 added for CHANGES_REQUESTED only; NITPICKS_ONLY format unchanged
- [x] Step 3: Updated `council-brief-plan.md` and `council-brief-code.md` — Key Findings section uses `[blocker|nitpick]` prefix with instruction line above findings list
- [x] Step 3.5: Updated `do-council-reviewer.md` Step 4 response template to bulleted findings format; error handling templates updated to same format
- [x] Step 4: Added `parseSelfReviewFindings()`, `parseCouncilRunnerOutput()`, and `classifyFindings()` to `council-invoke.cjs`; all three exported from `module.exports`; section-boundary slicing implemented in `parseSelfReviewFindings`; bullet-line parsing with legacy fallback in `parseCouncilRunnerOutput`
- [x] Step 5: Rewrote PR-5 ITERATE branch in `stage-plan-review.md` — PR-4.5 "Classify Findings" added with temp-file + node -e instructions; INLINE_NITPICKS/RESPAWN/MAX_ITERATIONS/APPROVED branches; iteration counter incremented before matrix call; RESPAWN brief is prioritized (blockers first, nitpicks second)
- [x] Step 6: Added CR-4.5 "Classify Findings" to `stage-code-review.md`; CR-5 ITERATE passes prioritized brief; no decision matrix added (code review always respawns); NITPICKS_ONLY->VERIFIED semantics preserved; increment-before-branch pattern applied; deserialize step added
- [x] Step 7: Updated `task.md` Step 6 ITERATE bullet to permit inline Edit by stage-plan-review.md; added PR-4.5 nitpick-only note; documented "### Inline Patches" subsection schema; updated Step 10 ITERATE bullet with CR-4.5 reference
- [x] Step 8: Updated `continue.md` Plan Review ITERATE bullet to match task.md contract; Code Review ITERATE bullet updated with CR-4.5 reference
- [x] Step 9: Added `classifyFindings`, `parseSelfReviewFindings`, `parseCouncilRunnerOutput` test cases to `council-invoke.test.cjs` — covering all specified cases including section-boundary tests, comma-in-finding preservation, and legacy fallback
- [x] Step 10: Created `task-workflow-structural.test.cjs` — 9 describe blocks covering all stage files, agent files, task.md, council-invoke.cjs exports (not planReviewDecisionMatrix), and stage-decision.cjs existence + planReviewDecisionMatrix export
- [x] Step 11: Created `stage-decision.cjs` with `planReviewDecisionMatrix()` pure function (no unused imports); created `stage-decision.test.cjs` with 7+ test cases including boundary, apostrophe round-trip, and stage-snippet contract tests

### Quality Checks
- **Tests:** PASS (npm run test) — 542 tests, 142 suites, 0 failures, 0 skipped

### Result: PASS
- Checklist: 12/12 complete (Steps 1-11 plus Step 3.5)
- Quality: 1/1 passing (tests only — no lint or typecheck scripts detected)
- Blocking issue: none

## Review Iterations

### Iteration 1
- **Self-review:** PASS - All 5 criteria met. Clarity, completeness, feasibility, atomicity, and risks all validated with evidence.
- **Council:** CONCERNS - Three findings: (1) code-review scope overstated — `NITPICKS_ONLY` already maps to `VERIFIED`, real gap is narrower; (2) CR inline-fix path auto-marks `VERIFIED` without fresh review pass; (3) plan inconsistent about where classification lives — claims orchestrator-side but requires reviewer contract changes.
- **Changes made:** Revised Approach and Concerns per all 3 council findings: (1) Narrowed code-review scope — preserved existing NITPICKS_ONLY->VERIFIED semantics, scoped to mixed-severity CHANGES_REQUESTED gap only; (2) Deferred code-review inline patching entirely — no auto-VERIFIED, plan review gets inline path but code review only gets prioritized brief; (3) Relabeled design decision from "Orchestrator-side classification (no contract changes)" to "Tagged-findings contract (reviewer + orchestrator changes)" and explicitly documented every consumer that changes.

### Iteration 2
- **Self-review:** CONCERNS - Two findings: (1) Concern 4's nitpick-pass cap (2-round max) not translated into an executable Approach step — executor would produce unbounded nitpick loop; (2) "Review Iterations — Inline Patches" subsection not documented in task.md schema, orchestrators on resume won't know it exists.
- **Council:** CONCERNS - Two findings: (1) Self-review output parsing underspecified — classifyFindings() only handles council output, no extraction step for freeform self-review markdown; (2) Caller contracts in task.md and continue.md say "Do NOT handle plan revisions manually" but the new inline-edit path contradicts this — Steps 7/8 only add commentary notes, not contract rewrites.
- **Changes made:** Revised Approach and Concerns per all 4 findings: (1) Added `nitpick_pass_count` counter and force-APPROVED escape hatch after 2 nitpick-only rounds to Step 5, with blocker-round reset; (2) Step 7 now documents the "Inline Patches" subsection in task.md schema commentary; (3) Added `parseSelfReviewFindings()` function to Step 4 for extracting findings from freeform self-review markdown, with corresponding tests in Step 9, and Step 5 now explicitly extracts findings from both sources before merging; (4) Steps 7 and 8 now rewrite the ITERATE caller contract bullets to permit stage-plan-review.md inline edits while retaining bypass prohibition. Updated Concern 4 to reflect implementation. Added Concerns 6 (self-review format fragility) and 7 (caller contract wording precision). Updated Step 10 structural tests for new patterns.

### Iteration 3
- **Self-review:** PASS - All 5 criteria met with evidence.
- **Council:** CONCERNS - Two findings: (1) `parseSelfReviewFindings()` specified for bulleted lists but current reviewer templates emit numbered items — extraction path fragile; (2) Test plan only covers helper parsing/classification and structural assertions, not behavior-level tests for the stage decision matrix (nitpick-only inline, mixed respawn, blocker respawn paths).
- **Changes made:** Revised Approach and Concerns per both council findings: (1) Updated `parseSelfReviewFindings()` spec in Step 4 to handle both numbered (`/^\d+\.\s+/`) and bulleted (`/^[-*]\s+/`) list markers, with explicit reference to current template line numbers (do-plan-reviewer.md lines 76-77/90-91, do-code-reviewer.md lines 99-101); added 4 new numbered-format test cases to Step 9 plus a mixed-markers test case; updated Concern 6 to reflect the dual-format parser. (2) Added Step 11: `stageDecisionMatrix()` pure function in council-invoke.cjs that encodes PR-4.5/PR-5 branching logic, with 8 behavior-level test cases covering all-PASS, all-nitpick inline (rounds 1-3), force-APPROVED escape, mixed-findings respawn, all-blocker respawn, MAX_ITERATIONS boundary, and untagged-findings safe fallback; added Concern 8 (prose-function drift risk with mitigations); updated Step 10 structural tests to verify the new export.

### Iteration 4
- **Self-review:** PASS - All 5 criteria met with evidence.
- **Council:** CONCERNS - Two findings: (1) Council-finding extraction uses wrong data shape — `parseFindings()` parses `### Key Findings` markdown but `do-council-reviewer` returns flat `Findings:` block, council findings would parse as empty; (2) Nitpick-only behavior contradicts problem statement — problem says "all-nitpick = PASS the stage" but Step 5 says "apply inline then return to PR-3 and re-spawn reviewers."
- **Changes made:** Revised Approach and Concerns per both council findings: (1) Added `parseCouncilRunnerOutput()` function to Step 4 — a dedicated parser for the `do-council-reviewer` agent's flattened text output (`VERDICT: ...\nFindings: ...` format), distinct from `parseFindings()` (which parses raw advisor `### Key Findings` markdown). Updated Step 5 PR-4.5 to use `parseCouncilRunnerOutput(council_agent_output)` instead of `parseFindings(council_output)`, with explicit comment not to use `parseFindings()`. Added `parseCouncilRunnerOutput` test cases to Step 9 (6 cases: standard flat, newline-separated, JSON array literal, empty, script-error, tag preservation). Updated Step 10 structural tests to verify `parseCouncilRunnerOutput` export and stage reference usage. Updated Concern 5 to document all three parsers and their target formats. Updated Context Loaded to clarify the data shape distinction. (2) Aligned Step 5 nitpick-only behavior with Problem Statement: nitpick-only rounds now apply inline edits and immediately PASS the stage (set `council_review_ran.plan: true`), with no re-review loop. Removed `nitpick_pass_count` counter, force-APPROVED escape hatch, and `nitpickPassCount` parameter from `stageDecisionMatrix()`. Replaced Concern 4 (unbounded loop) with new Concern 4 (inline edit skips re-verification, with mitigations). Updated Concern 8 structural test markers to match simplified flow. Updated Step 11 behavior tests: removed force-APPROVED test case, simplified nitpick test cases (any round = INLINE_NITPICKS + PASS), reduced `stageDecisionMatrix` from 3 parameters to 2.

### Iteration 5
- **Self-review:** PASS - All 5 criteria met with evidence.
- **Council:** CONCERNS - Two findings: (1) `parseCouncilRunnerOutput()` comma-splitting ambiguity — if a single finding contains commas, parser splits one finding into fake findings, making classification unreliable; (2) `parseSelfReviewFindings()` lacks section boundary — bullets from `**Recommendations:**` or `**Required changes:**` sections could be captured as findings without "stop at next bold subsection header" rule.
- **Changes made:** Revised Approach and Concerns per both council findings: (1) Added Step 3.5 — update `do-council-reviewer.md` output contract to emit findings as one-item-per-line bullets instead of ambiguous free text. Updated `parseCouncilRunnerOutput()` in Step 4 to parse bullet lines only (no comma-splitting), with explicit fallback for pre-contract legacy format that wraps the entire text as a single untagged finding (defaults to blocker). Updated Step 9 `parseCouncilRunnerOutput` test cases to test bulleted format, comma-in-finding preservation, and legacy fallback. Updated Step 10 structural tests to verify `do-council-reviewer.md` uses bulleted format. Updated Context Loaded entry for `do-council-reviewer.md`. Added Concern 10 (contract change rollout risk with fallback mitigation). Updated Concern 5 to reflect tightened contract. (2) Updated `parseSelfReviewFindings()` in Step 4 to use explicit section-boundary slicing: capture text between findings header and the next bold subsection header (`/^\*\*[^*]+:\*\*/m`), extracting list items only from the bounded slice. This prevents `**Recommendations:**`, `**Required changes:**`, `**Why this is blocking:**`, and `**Suggested direction:**` items from being misclassified as findings. Added 4 section-boundary test cases to Step 9. Updated Concern 6 to document the boundary detection logic and edge cases.

### Iteration 6
- **Self-review:** PASS - All 5 criteria met with evidence.
- **Council:** CONCERNS - Two findings: (1) Step 10 uses `beta-skill-structural.test.cjs` which is β-scoped — adding task-workflow assertions creates cross-scope coupling; (2) `stageDecisionMatrix()` in `council-invoke.cjs` couples stage orchestration logic to the council transport layer.
- **Changes made:** Revised Approach and Concerns per both council findings: (1) Step 10 now creates a dedicated `task-workflow-structural.test.cjs` instead of extending `beta-skill-structural.test.cjs`. Rationale documented: the beta test file hardcodes `BETA_STAGE_FILES` and is named with beta-scoped describes; a dedicated file follows the same `<scope>-structural.test.cjs` naming pattern without cross-scope coupling. Step 10 structural assertion for `council-invoke.cjs` exports updated to explicitly exclude `stageDecisionMatrix` and add a separate assertion for `stage-decision.cjs`. (2) Step 11 now places `stageDecisionMatrix()` in a new `skills/do/scripts/stage-decision.cjs` module instead of `council-invoke.cjs`. Rationale documented: `council-invoke.cjs` is a council adapter (reviewer selection, invocation, parsing); `stageDecisionMatrix()` is stage-orchestration logic. Parsing helpers (`parseSelfReviewFindings`, `parseCouncilRunnerOutput`, `classifyFindings`) remain in `council-invoke.cjs` because they are parsing functions reusing the existing parsing layer. Tests for `stageDecisionMatrix` move to a new `stage-decision.test.cjs` file. Updated Concern 8 to reflect the new module location, decoupling rationale, and the dependency direction (`stage-decision.cjs` imports `classifyFindings` from `council-invoke.cjs`).

### Iteration 7
- **Self-review:** PASS - All 5 criteria met with evidence.
- **Council:** CONCERNS - Two findings: (1) `INLINE_NITPICKS` vs `APPROVED` contract ambiguity — Step 5 says "mark as APPROVED" but Step 11's `stageDecisionMatrix()` returns a separate `INLINE_NITPICKS` action, need to pick one; (2) `stageDecisionMatrix()` mixes plan-review and code-review behavior without clearly defining the code-review side, risks a test helper that doesn't map to real CR stage logic.
- **Changes made:** Revised Approach and Concerns per both council findings: (1) Resolved `INLINE_NITPICKS` vs `APPROVED` contract ambiguity — `INLINE_NITPICKS` is now explicitly documented as an internal action within `planReviewDecisionMatrix()` that the stage reference converts to `APPROVED` before returning to the caller. Step 5 now calls `planReviewDecisionMatrix()` and explicitly handles the conversion: when the matrix returns `INLINE_NITPICKS`, the stage applies inline edits, sets `council_review_ran.plan: true`, and returns `APPROVED` to the caller. The caller never sees `INLINE_NITPICKS`. Updated Step 5, Step 11, Concern 8 to reflect this contract. (2) Separated plan-review and code-review decision matrix concerns — renamed `stageDecisionMatrix()` to `planReviewDecisionMatrix()` and scoped it strictly to plan review. Removed the code-review decision matrix test cases from Step 11. Step 6 now explicitly documents why code review has no decision matrix (CR-5 always respawns; `classifyFindings()` alone handles brief prioritization). Updated Step 10 structural tests to verify the renamed export. Updated Concern 8 to document both the action contract boundary and the plan-review-only scope.
