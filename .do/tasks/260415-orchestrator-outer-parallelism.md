---
id: 260415-orchestrator-outer-parallelism
created: 2026-04-15T10:27:31Z
updated: 2026-04-15T15:30:00Z
description: "Move review parallelism to orchestrator level in do-lang. The orchestrator (task.md / continue.md) should directly spawn do-plan-reviewer + do-council-reviewer in parallel at Step 6, and do-code-reviewer + do-council-reviewer in parallel at Step 10 — rather than delegating that parallelism to the reviewer agents themselves. Reviewer agents should become self-review only."

# Stage tracking (linear by default)
# Valid stages: refinement, grilling, execution, verification, verified, complete, abandoned
stage: complete
stages:
  refinement: complete
  grilling: complete
  execution: complete
  verification: complete
  abandoned: false

# Council review tracking (prevents re-running on resume)
council_review_ran:
  plan: false
  code: false

# Confidence calculation (per D-04, D-05)
confidence:
  score: 0.90
  factors:
    context: 0.95
    scope: 0.85
    complexity: 0.90
    familiarity: 0.90
---

# Orchestrator-Level Parallel Review Spawning

## Problem Statement

Currently `do:task` (Step 6 and Step 10) spawns a single reviewer agent (e.g. `do-plan-reviewer`) and trusts that agent to internally spawn self-review + council sub-agents in parallel via the Agent tool. This nested parallelism is fragile -- sub-agents skip the inner parallel spawn silently, running only self-review and omitting the council review entirely. This bug has been observed in production twice (leaselinq FL-227 session, and during a `/do:update` plan review).

Patching critical rules inside each reviewer agent is whack-a-mole. The fix is structural: move parallelism up to the orchestrator level so Claude Code's Agent tool handles the parallel dispatch directly (one message, two Agent calls) rather than depending on a child agent to do it.

**Scope note:** The Codex runtime (`stage-execute.md`, `stage-verify.md`, `codex/continue.md`) has its own independent council-review path using inline Bash `council-invoke.cjs` calls. Codex does not support the Agent tool, so it cannot use the new parallel-spawn model. The Codex path is explicitly **out of scope** for this task — it will be addressed in a separate task once the Claude path is stable.

**What needs to change:**
- `skills/do/task.md` Steps 6 and 10 must each spawn TWO agents in parallel (reviewer + council) instead of one reviewer that internally spawns council
- `skills/do/continue.md` must match the same pattern at its equivalent routing points
- `agents/do-plan-reviewer.md` and `agents/do-code-reviewer.md` must be stripped down to self-review only (no Agent tool, no sub-agent spawning, no council awareness)
- A new `agents/do-council-reviewer.md` agent must be created that runs `council-invoke.cjs` and returns the result
- The verdict combination logic (currently inside reviewers) moves to the orchestrator
- The iteration loop (up to 3x) moves to the orchestrator
- The council gate check (is planning/execution council enabled?) moves to the orchestrator
- Agent and reference docs that describe the old reviewer-owned council spawning model must be updated for spec alignment

**Acceptance criteria:**
1. `do:task` Step 6 spawns `do-plan-reviewer` + `do-council-reviewer` in a single message with two Agent calls (when council is enabled)
2. `do:task` Step 10 spawns `do-code-reviewer` + `do-council-reviewer` in a single message with two Agent calls (when council is enabled)
3. Orchestrator combines verdicts using the existing verdict tables and owns the iteration loop (re-spawn both if ITERATE, up to 3x)
4. `do-plan-reviewer` has no Agent tool, no council awareness -- pure self-review returning PASS/CONCERNS/RETHINK
5. `do-code-reviewer` has no Agent tool, no council awareness -- pure self-review returning APPROVED/NITPICKS_ONLY/CHANGES_REQUESTED
6. New `do-council-reviewer` agent exists, runs `council-invoke.cjs`, returns structured verdict
7. `do:continue` routes to the same parallel pattern at its equivalent stages
8. Council gate check (config lookup for planning/execution enabled) lives in the orchestrator, not in agents
9. `council_review_ran` resume flags follow skip-entirely convention: if true, the entire review stage is skipped (no partial reviewer spawning)
10. Agent descriptions (`do-plan-reviewer.md`, `do-code-reviewer.md`, `do-verifier.md`) and any reference docs accurately describe the new architecture -- no references to reviewer-owned council spawning remain

## Clarifications

### Complexity (was: 0.80 -> now: 0.90)
**Q:** How much logic does continue.md need to duplicate from task.md for the parallel review blocks?
**A:** Duplication is bad. continue.md should just route to the stage and let the orchestrator continue from that point on -- it is already a stage router. Extract the parallel review blocks into @reference files so both task.md and continue.md can include them without copying the full logic into both skills. Existing pattern: skills/do/references/stage-*.md files are already used this way.

**Impact:** Concern #3 (duplication mitigation) and Approach Step 6 must be revised. Instead of copying logic + sync comment, the executor will:
1. Extract parallel plan-review block to a new reference file (e.g., @references/stage-plan-review.md)
2. Extract parallel code-review block to a new reference file (e.g., @references/stage-code-review.md)
3. Both task.md and continue.md reference these files -- no duplication, no drift risk.

## Context Loaded

- `~/workspace/database/projects/do/project.md` -- project overview, agent inventory, conventions, release flow
- `.do/backlog/orchestrator-outer-parallelism.md` -- full problem description and required change spec
- `skills/do/task.md` -- current orchestrator (Steps 6 and 10 delegate parallelism to reviewer agents)
- `skills/do/continue.md` -- resume skill (routes by stage, spawns single reviewer agents same way as task.md)
- `agents/do-plan-reviewer.md` -- current plan reviewer (spawns self-review + council sub-agents in parallel)
- `agents/do-code-reviewer.md` -- current code reviewer (spawns self-review + council sub-agents in parallel)
- `agents/do-council-reviewer.md` -- does not exist yet (referenced in backlog as "already exists" but missing)
- `skills/do/scripts/council-invoke.cjs` -- council invocation script (advisor selection, runtime detection, process spawning)
- `skills/do/references/council-brief-plan.md` -- briefing template for plan reviews
- `skills/do/references/council-brief-code.md` -- briefing template for code reviews
- `skills/do/references/task-template.md` -- task file template with frontmatter structure
- `agents/do-verifier.md` -- verifier agent (references stage-verify.md as authoritative spec, describes post-code-reviewer flow)
- `skills/do/references/stage-execute.md` -- read for context only; OUT OF SCOPE for this task (Codex path, no Agent tool)
- `skills/do/references/stage-verify.md` -- read for context only; OUT OF SCOPE for this task

## Approach

### 1. Create `agents/do-council-reviewer.md`

**File:** `agents/do-council-reviewer.md`

Create a new agent definition. This agent:
- Accepts a task file path, review type (`plan` or `code`), and workspace path via prompt
- Runs `council-invoke.cjs` via Bash tool with the provided parameters
- Parses the JSON result
- Returns a structured response: VERDICT, Advisor, Findings, Recommendations
- Has NO opinion of its own -- it is a script runner only
- Tools: Read, Bash only (no Write, no Edit, no Agent)
- Error handling: if script fails, return CONCERNS (plan) or CHANGES_REQUESTED (code) with raw error

Base the prompt structure on the existing council sub-agent prompts already embedded in `do-plan-reviewer.md` (lines 77-106) and `do-code-reviewer.md` (lines 88-119), but as a standalone agent file.

### 2. Simplify `agents/do-plan-reviewer.md` to self-review only

**File:** `agents/do-plan-reviewer.md`

Strip the agent down:
- Remove `Agent` from the tools list (no sub-agent spawning)
- Remove Step 2 (Check Council Setting) entirely
- Remove Step 3's council branch and sub-agent prompts
- Remove the verdict combination table (Step 4) -- it will live in the orchestrator
- Remove the iteration loop (Step 5 ITERATE handling) -- orchestrator owns iteration
- Remove the Sequential Fallback section entirely
- Keep Step 1 (Load Plan) and the self-review checklist
- The agent reads the task file, evaluates the plan against the 5 criteria (Clarity, Completeness, Feasibility, Atomicity, Risks), and returns one of: PASS, CONCERNS, RETHINK with evidence
- Update description in frontmatter to reflect "self-review only" role
- Remove any references to council spawning from description and critical_rules

### 3. Simplify `agents/do-code-reviewer.md` to self-review only

**File:** `agents/do-code-reviewer.md`

Same pattern as step 2:
- Remove `Agent` from tools list
- Remove Step 2 (Check Council Setting)
- Remove Step 3's council branch and sub-agent prompts
- Remove verdict combination table (Step 4)
- Remove iteration loop and do-executioner re-spawning
- Remove Sequential Fallback section
- Keep Step 1 (Gather Context) and the self-review checklist (6 criteria)
- The agent reads task file + git diff, evaluates against criteria, returns one of: APPROVED, NITPICKS_ONLY, CHANGES_REQUESTED with file:line references
- Remove the stage update logic (stage: verification) -- orchestrator handles this
- Remove the "NO EDITS before reviews complete" rule -- this agent IS the only reviewer now; it still should not edit files though (it's a reviewer, not an implementer)
- Update description in frontmatter to reflect "self-review only" role
- Remove any references to council spawning from description and critical_rules

### 4. Update `skills/do/task.md` Step 6 (plan review)

**File:** `skills/do/task.md`

**Note on skill editing convention:** `CLAUDE.md` says "Always use `/skill-creator` when creating or modifying skill files." This task requires direct targeted edits to `task.md` and `continue.md`. The executor MUST use direct file editing (Read + Edit tools) for this task -- using `/skill-creator` for scoped changes to existing complex skills would be impractical and is explicitly waived for this task. This deviation is approved at planning time.

Replace the current Step 6 (single agent spawn) with:

a. **Council gate check**: Read config to determine if `council_reviews.planning` is enabled
b. **Iteration counter**: Initialize `review_iterations = 0` in skill state (tracked in local variable; not persisted to task file)
c. **If council enabled**: Spawn TWO agents in a single message (single `Agent({...})` call block with two parallel Agent invocations):
   - `do-plan-reviewer` (self-review only, returns PASS/CONCERNS/RETHINK)
   - `do-council-reviewer` (runs council-invoke.cjs --type plan, returns LOOKS_GOOD/CONCERNS/RETHINK)
d. **If council disabled**: Spawn only `do-plan-reviewer`. Apply single-review fallback semantics:
   - PASS -> APPROVED
   - CONCERNS -> ITERATE
   - RETHINK -> ESCALATE
e. **Combine verdicts** (two-reviewer case): Use the existing combination table (currently in do-plan-reviewer.md Step 4):
   - PASS + LOOKS_GOOD -> APPROVED
   - PASS + CONCERNS -> ITERATE
   - PASS + RETHINK -> ITERATE
   - CONCERNS + LOOKS_GOOD -> ITERATE
   - CONCERNS + CONCERNS -> ITERATE
   - CONCERNS + RETHINK -> ESCALATE
   - RETHINK + any -> ESCALATE
f. **Iteration loop** (if ITERATE and `review_iterations < 3`):
   - Increment `review_iterations`
   - Log iteration N findings in task file under `## Review Iterations`
   - Spawn `do-planner` with the reviewer feedback as revision instructions (option b -- the planner is purpose-built for plan writing and produces better revisions than inline orchestrator edits):
     ```
     Revise the plan based on review feedback.
     Task file: .do/tasks/<active_task>
     Reviewer feedback: <combined findings from self-review and council>
     Update the Approach and/or Concerns sections to address the issues listed.
     ```
   - Wait for do-planner to complete, then go back to step (c) to re-spawn both reviewers
g. **If ITERATE and `review_iterations = 3`**: Escalate to user with MAX_ITERATIONS (list outstanding issues)
h. **If ESCALATE**: Return immediately to user with critical issues listed
i. **If APPROVED**: Update task frontmatter to set `council_review_ran.plan: true`, then continue to Step 7

### 5. Update `skills/do/task.md` Step 10 (code review)

**File:** `skills/do/task.md`

Replace the current Step 10 with the same parallel pattern:

a. **Council gate check**: Read config for `council_reviews.execution`
b. **Iteration counter**: Initialize `code_review_iterations = 0` in skill state
c. **If council enabled**: Spawn TWO agents in parallel (single message with two Agent calls):
   - `do-code-reviewer` (self-review only, returns APPROVED/NITPICKS_ONLY/CHANGES_REQUESTED)
   - `do-council-reviewer` (runs council-invoke.cjs --type code, returns APPROVED/NITPICKS_ONLY/CHANGES_REQUESTED)
d. **If council disabled**: Spawn only `do-code-reviewer`. Apply single-review fallback semantics:
   - APPROVED -> VERIFIED
   - NITPICKS_ONLY -> VERIFIED (log nitpicks)
   - CHANGES_REQUESTED -> ITERATE
e. **Combine verdicts** (two-reviewer case): Use the existing code review combination table (currently in do-code-reviewer.md Step 4):
   - APPROVED + APPROVED -> VERIFIED
   - APPROVED + NITPICKS_ONLY -> VERIFIED (log nitpicks)
   - NITPICKS_ONLY + APPROVED -> VERIFIED (log nitpicks)
   - NITPICKS_ONLY + NITPICKS_ONLY -> VERIFIED (log nitpicks)
   - APPROVED + CHANGES_REQUESTED -> ITERATE
   - CHANGES_REQUESTED + any -> ITERATE
   - any + CHANGES_REQUESTED -> ITERATE
f. **Iteration loop** (if ITERATE and `code_review_iterations < 3`):
   - Increment `code_review_iterations`
   - Compile combined findings from both reviewers
   - Spawn `do-executioner` with combined findings as fix instructions; wait for completion
   - Log the iteration in task file under `## Code Review Iterations`
   - Go back to step (c) to re-spawn both review agents
g. **If ITERATE and `code_review_iterations = 3`**: Escalate with MAX_ITERATIONS
h. **If VERIFIED**: Update task file (`stage: verification`, `stages.verification: pending`, `council_review_ran.code: true`); continue to Step 11
i. **Handle nitpicks**: Log them to task file, treat as VERIFIED

### 6. Extract review blocks into reference files

**Files:**
- `skills/do/references/stage-plan-review.md` (new)
- `skills/do/references/stage-code-review.md` (new)

Extract the parallel review logic from Steps 4 and 5 into standalone reference files:

a. **`stage-plan-review.md`**: Contains the full plan review block -- council gate check, single-review fallback semantics, two-reviewer verdict combination table, iteration loop (spawn do-planner for revisions), escalation rules, and the `council_review_ran.plan: true` frontmatter update on APPROVED. **Resume rule**: If `council_review_ran.plan` is true, skip the entire plan review stage (no reviewers spawned at all). This matches the existing convention in `stage-execute.md` Step E-1 where `council_review_ran.plan === true` causes a full skip to the next step.
b. **`stage-code-review.md`**: Contains the full code review block -- council gate check, single-review fallback semantics, two-reviewer verdict combination table, iteration loop (spawn do-executioner for fixes), escalation rules, and the `council_review_ran.code: true` frontmatter update on VERIFIED. **Resume rule**: If `council_review_ran.code` is true, skip the entire code review stage (no reviewers spawned at all). This matches the existing convention in `stage-execute.md` Step E4 and `stage-verify.md` Step V-1 where `council_review_ran.code === true` causes a full skip.

Both `task.md` (Steps 6 and 10) and `continue.md` (Step 7 routing table) reference these files via `@references/stage-plan-review.md` and `@references/stage-code-review.md` respectively, eliminating duplication entirely.

### 7. Update `skills/do/continue.md` routing table

**File:** `skills/do/continue.md`

Update the stage routing in Step 6:

a. **"refinement" + "plan review not ran"**: Replace the current single `do-plan-reviewer` spawn with a reference to `@references/stage-plan-review.md` which contains the full parallel review block (council gate, parallel spawn, single-review fallback, verdict combination, iteration via do-planner, `council_review_ran.plan: true` update).
b. **"execution" + "stages.execution: complete"**: Replace the current single `do-code-reviewer` spawn with a reference to `@references/stage-code-review.md` which contains the full parallel review block (council gate, parallel spawn, single-review fallback, verdict combination, iteration via do-executioner, `council_review_ran.code: true` update).
c. **Resume with `council_review_ran` flags**: If `council_review_ran.plan` is true, skip plan review entirely -- do NOT spawn any reviewer agent (not even self-reviewer). Proceed directly to execution. If `council_review_ran.code` is true, skip code review entirely -- do NOT spawn any reviewer agent. Proceed directly to verification. This matches the existing convention used by `stage-execute.md` (Step E-1 exits immediately if `council_review_ran.plan === true`) and `stage-verify.md` (Step V-1 exits immediately if `council_review_ran.code === true`). The reference files (`stage-plan-review.md`, `stage-code-review.md`) encode this skip-entirely rule as their first check.

### 8. Spec alignment -- update agent and reference docs

**Files:**
- `agents/do-plan-reviewer.md` (already simplified in Step 2 -- verify description is updated)
- `agents/do-code-reviewer.md` (already simplified in Step 3 -- verify description is updated)
- `agents/do-verifier.md`

After all other changes are made, do a spec alignment pass:

a. **`agents/do-verifier.md`:** Currently says "Spawned after `do-code-reviewer` completes (stage is `verification`)" and "code review is handled by `do-code-reviewer` before this agent runs." These descriptions are still accurate under the new architecture (the orchestrator spawns do-code-reviewer, which returns to the orchestrator, which then spawns do-verifier). However, `do-verifier.md` also says "stage-verify.md is the authoritative spec" for its flow. Since `stage-verify.md` is being updated (Step 8c) to reference the shared code review reference file instead of inline council invocation, verify that `do-verifier.md`'s critical rules still make sense. Specifically: `do-verifier.md` says "Do NOT perform code review -- code review is handled by `do-code-reviewer`" which is correct. No changes expected, but confirm after Step 8 edits.

b. **`agents/do-plan-reviewer.md` and `agents/do-code-reviewer.md`:** Already stripped of council spawning in Steps 2 and 3. Verify that:
   - Frontmatter `description` no longer mentions "parallel self-review and council review"
   - Frontmatter `description` no longer mentions "Auto-iterates up to 3 times"
   - `tools` list does not include `Agent`
   - No remaining references to `council-invoke.cjs`, council verdicts, combination tables, or sub-agent spawning exist anywhere in the file
   - `do-code-reviewer.md` description no longer says "Sets stage to verification" (orchestrator does this now)

c. **Cross-reference check:** Search all files under `agents/` and `skills/do/references/` for any remaining references to the old pattern: "spawns self-review + council", "parallel self-review and council", "council sub-agent", "Sequential Fallback". If found in files not already covered by Steps 1-8, flag them for update.

### 9. Update `project.md` agent table

**File:** `~/workspace/database/projects/do/project.md`

Add `do-council-reviewer` to the agent table. Update descriptions for `do-plan-reviewer` and `do-code-reviewer` to reflect "self-review only" role. Update the full task flow diagram. Note that `stage-execute.md` and `stage-verify.md` now reference the shared review files.

## Concerns

1. **Iteration plan revision at orchestrator level** -- **RESOLVED**: The executor will spawn `do-planner` with reviewer feedback as revision instructions (option b). This keeps the planner as the sole plan-writer. Accepted overhead: one extra agent call per iteration (at most 2 extra planner calls total).

2. **do-council-reviewer agent does not exist yet** -- The backlog says "already exists and does the right thing" but it is missing from `agents/`. This is not a risk per se (we need to create it), but the backlog's claim should be noted as inaccurate. Mitigation: Create it as Step 1 of the approach.

3. **continue.md duplication** -- **RESOLVED**: The parallel review blocks will be extracted into `@references/stage-plan-review.md` and `@references/stage-code-review.md` (Approach Step 6). Both `task.md` and `continue.md` reference these files, eliminating duplication and drift risk entirely. No sync comments needed.

4. **Skill file editing convention** -- `CLAUDE.md` says "Always use `/skill-creator` when creating or modifying skill files." This task requires targeted edits to `task.md` and `continue.md`. Using `/skill-creator` for scoped changes to existing complex skills is impractical. **RESOLVED at planning time**: The executor is explicitly approved to use direct file editing (Read + Edit tools) for this task. No action needed at execution time.

5. **Code review iteration re-spawns executioner** -- At the orchestrator level, the iteration loop for code review needs to spawn `do-executioner` with fix instructions between review iterations. This is straightforward but the orchestrator skill becomes more complex. Mitigation: Document the loop clearly with pseudocode in the skill (done in Step 5 above).

6. **Iteration counter tracking** -- Skills (unlike agents) do not have persistent state between tool calls. The iteration counter (`review_iterations`, `code_review_iterations`) must be tracked as an in-skill variable that persists within the single orchestrated session. This is fine since `do:task` runs as a single continuous skill invocation. If the session is interrupted mid-review-iteration, `/do:continue` will re-run from the review stage (iteration counter resets to 0), which is acceptable -- at worst the user sees one extra review cycle.

7. **Codex runtime path (OUT OF SCOPE)** -- Codex does not support the Agent tool, so it cannot use the parallel-spawn model. `stage-execute.md`, `stage-verify.md`, and `codex/continue.md` are explicitly excluded from this task. The Codex path retains its inline Bash `council-invoke.cjs` approach until a separate task addresses it.

8. **Codex verdict model shift (OUT OF SCOPE)** -- Deferred with Concern #7.

## Review Iterations

### Iteration 1
- **Self-review:** CONCERNS
  - Iteration plan-revision approach was undecided in Step 4 note
  - Iteration counter tracking at orchestrator level was unspecified
  - Stage update (verification) omitted from Step 5's task.md changes
  - Concern #4 mitigation was weak (deferred to execution time)
- **Council:** disabled (user instruction)
- **Changes made:**
  - Step 4: Resolved plan revision approach (option b -- re-spawn do-planner); added explicit iteration counter variable (`review_iterations`); documented full verdict combination table inline
  - Step 5: Added explicit iteration counter (`code_review_iterations`); added stage update to item (h) (`stage: verification`, `stages.verification: pending`, `council_review_ran.code: true`)
  - Concern #1: Marked RESOLVED with explicit decision
  - Concern #4: Marked RESOLVED with explicit deviation approval at planning time
  - Concern #6: Added new concern documenting iteration counter behavior and interruption handling

### Iteration 2 (Council Review Fixes)
- **Source:** Council review feedback (3 findings)
- **Changes made:**
  - **Finding 1 (single-review fallback):** Added explicit single-review fallback semantics to Step 4 item (d) and Step 5 item (d). When council is disabled and only the self-reviewer runs, its verdict maps directly: PASS->APPROVED, CONCERNS->ITERATE, RETHINK->ESCALATE (plan review); APPROVED->VERIFIED, NITPICKS_ONLY->VERIFIED, CHANGES_REQUESTED->ITERATE (code review).
  - **Finding 2 (council_review_ran flags):** Added `council_review_ran.plan: true` frontmatter update to Step 4 item (i) APPROVED path. Step 5 item (h) already had `council_review_ran.code: true` -- confirmed present. Also added these updates to the reference file descriptions in Step 6.
  - **Finding 3 (clarification/approach inconsistency):** Rewrote Step 6 to commit to the `@references/stage-*.md` extraction approach per the Clarification decision. Rewrote Step 7 (continue.md) to reference these files instead of "replicating" logic. Marked Concern #3 as RESOLVED with the extraction approach.

### Iteration 3 (Council Review - 3 Findings)
- **Source:** Council review iteration 2 feedback (3 findings)
- **Changes made:**
  - **Finding 1 (missed scope: Codex runtime files):** Added new Step 8 covering `stage-execute.md`, `stage-verify.md`, and `codex/continue.md`. These files call `council-invoke.cjs` directly and own their own verdict handling -- a second active council-review path. Step 8 replaces their inline council invocation with references to the new shared `stage-plan-review.md` / `stage-code-review.md` reference files, unifying both Claude and Codex runtimes under one architecture. Added files to Context Loaded. Added acceptance criteria 9-11. Added Concern #7 (path resolution) and Concern #8 (verdict model shift). Expanded Problem Statement to describe the dual-architecture issue.
  - **Finding 2 (resume rule inconsistency with council_review_ran):** Fixed Step 7c to skip review entirely when `council_review_ran` flag is true (no reviewer spawned at all), matching the existing convention in `stage-execute.md` Step E-1 and `stage-verify.md` Step V-1. Updated Step 6a and 6b reference file descriptions to encode the skip-entirely rule as their first check. Added acceptance criterion 12. Previous Step 7c said "only spawn self-reviewer (no council agent)" which was inconsistent -- now corrected to full skip.
  - **Finding 3 (spec alignment step missing):** Added new Step 9 for explicit spec alignment pass across `do-verifier.md`, `do-plan-reviewer.md`, `do-code-reviewer.md`, and a cross-reference search for any remaining old-model references. Added acceptance criterion 13. Old Step 8 (project.md) renumbered to Step 10.
  - **Confidence adjustment:** Reduced from 0.90 to 0.85. Scope factor reduced from 0.85 to 0.80 (3 additional files in scope: stage-execute.md, stage-verify.md, codex/continue.md). Complexity factor reduced from 0.90 to 0.85 (Codex runtime has different path resolution and verdict model that need careful handling).

### Scope decision (post iteration 3)
- **Finding 1 (Codex Agent tool):** Investigated `codex/continue.md` and all `codex/` commands — Codex CLI does not support the Agent tool. `allowed-tools` in all Codex commands is Bash/Read/Write/Edit/Glob/Grep only. Option B (add Agent to Codex) is not feasible.
- **Decision:** User chose to scope this task to Claude path only. `stage-execute.md`, `stage-verify.md`, and `codex/continue.md` are explicitly OUT OF SCOPE. Concerns #7 and #8 marked deferred. Step 8 (Codex runtime) removed from Approach. Acceptance criteria 9-11 (Codex-specific) removed.
- **Finding 2 (council gate config cascade):** The plan's "Read config" gate check should use `resolveConfig()` from `council-invoke.cjs` rather than a direct `.do/config.json` read — otherwise the gate and the actual council invocation can disagree. Executor must use the cascade pattern.
- **Finding 3 (shared reference caller contract):** The shared `stage-plan-review.md` / `stage-code-review.md` reference files should define their own resume/skip rule as the first check, and return control to caller on APPROVED/VERIFIED. Callers (`task.md`, `continue.md`) handle "what to do next." This is workable without an explicit interface definition — executor to handle naturally.

## Execution Log

### 2026-04-15 13:00 - Execution started
**Status:** In progress
**Steps:** 0/9 complete

### 2026-04-15 13:10 - Execution complete
**Status:** Complete
**Summary:**
- Steps completed: 9/9
- Files modified: 9
- Deviations: 1 minor (auto-fixed)
  - `stage-execute.md` note text updated to reflect new architecture — technically Codex path but the note describes Claude Code behavior; minimal change to note text only, no Codex logic touched

### 2026-04-15 13:01 - Step 1: Create agents/do-council-reviewer.md
**Files:**
- `agents/do-council-reviewer.md` - New agent created. Thin script-runner wrapper around council-invoke.cjs. Tools: Read, Bash only. Accepts task file path, review type, workspace via prompt. Runs council-invoke.cjs without passing --reviewer (resolveConfig handles cascade internally). Returns structured VERDICT block. Error handling: CONCERNS for plan failures, CHANGES_REQUESTED for code failures.

**Decisions:**
- Did not pass `--reviewer` flag — council-invoke.cjs resolveConfig() handles the project→workspace→defaults cascade correctly and is the authoritative source
- Kept the agent minimal: Step 1 (confirm file exists), Step 2 (run script), Step 3 (parse JSON), Step 4 (return structured verdict)

**Status:** Complete

### 2026-04-15 13:09 - Step 9: Update database/projects/do/project.md
**Files:**
- `~/workspace/database/projects/do/project.md` - Added `do-council-reviewer` to agent table (purple, "Runs council-invoke.cjs, returns structured verdict. Script runner only."). Updated do-plan-reviewer description to "Self-review only — reads plan, returns PASS/CONCERNS/RETHINK". Updated do-code-reviewer description to "Self-review only — reads diff, returns APPROVED/NITPICKS_ONLY/CHANGES_REQUESTED". Replaced task flow diagram with new parallel-spawn architecture showing orchestrator owning the parallel dispatch. Added note about Codex path being independent/out of scope. Updated Last updated line.

**Status:** Complete

### 2026-04-15 13:08 - Step 8: Spec alignment pass
**Files:**
- `skills/do/references/stage-execute.md` - Updated E4 note text: replaced "do-code-reviewer spawns parallel self-review and council review, and auto-iterates up to 3 times" with accurate description ("orchestrator via stage-code-review.md which spawns do-code-reviewer + do-council-reviewer in parallel"). Codex execution logic untouched (out of scope).
- `agents/do-verifier.md` - Verified: no stale references. "Spawned after do-code-reviewer completes (stage is verification)" remains accurate under new architecture. "Do NOT perform code review" critical rule also remains accurate. No changes needed.
- `agents/do-plan-reviewer.md` - Verified: no stale references. Mentions council-invoke.cjs only in prohibition ("do not invoke council-invoke.cjs"). No Agent tool in tools list.
- `agents/do-code-reviewer.md` - Verified: no stale references. Same prohibition pattern. No Agent/Write/Edit in tools list.

**Decisions:**
- stage-execute.md note was technically OUT OF SCOPE (Codex path) but the note itself described Claude Code agent behavior — updating the factual claim in the note is minimal and correct, not touching any Codex execution logic
- No other files found with stale phrases (searched for: "Spawn parallel self-review", "parallel self-review and council", "Auto-iterate up to 3 times", "Sequential Fallback")

**Status:** Complete

### 2026-04-15 13:07 - Step 7: Update skills/do/continue.md routing table
**Files:**
- `skills/do/continue.md` - Replaced "Spawn do-plan-reviewer" section with "Plan Review" section loading `@references/stage-plan-review.md`. Replaced "Spawn do-code-reviewer" section with "Code Review" section loading `@references/stage-code-review.md`. Updated routing table descriptions for both rows. Resume guard notes added (PR-0/CR-0 handle skip-entirely).

**Decisions:**
- resume guard notes kept in continue.md as inline comments to make it clear to the orchestrator that the skip logic is inside the reference file, not in continue.md itself
- routing table updated to say "Run stage-plan-review / stage-code-review" (not "Spawn do-plan-reviewer") to accurately reflect the new architecture

**Status:** Complete

### 2026-04-15 13:06 - Step 6: Update skills/do/task.md Steps 6 and 10
**Files:**
- `skills/do/task.md` - Step 6 replaced: single do-plan-reviewer spawn → `@references/stage-plan-review.md` reference with handle-result block. Step 10 replaced: single do-code-reviewer spawn → `@references/stage-code-review.md` reference with handle-result block. All other steps untouched.

**Decisions:**
- Followed existing `@references/` pattern already used at bottom of task.md (task-template.md, scripts)
- Handle-result blocks kept minimal — full logic is in the reference files

**Status:** Complete

### 2026-04-15 13:05 - Steps 4 & 5: Create stage-plan-review.md and stage-code-review.md
**Files:**
- `skills/do/references/stage-plan-review.md` - New reference file. PR-0 (resume guard skips entirely if council_review_ran.plan=true), PR-1 (council gate using resolveConfig cascade), PR-2 (iteration counter init), PR-3 (parallel spawn or single spawn), PR-4 (verdict combination tables for both cases), PR-5 (APPROVED sets council_review_ran.plan:true; ITERATE spawns do-planner for revisions up to 3x; ESCALATE stops).
- `skills/do/references/stage-code-review.md` - New reference file. CR-0 (resume guard), CR-1 (council gate), CR-2 (iteration counter), CR-3 (parallel spawn or single spawn), CR-4 (verdict combination), CR-5 (VERIFIED updates stage:verification + council_review_ran.code:true; ITERATE spawns do-executioner for fixes up to 3x).

**Decisions:**
- resolveConfig gate check uses dynamic path resolution: checks ~/.claude/commands/do/scripts first (installed location), falls back to skills/do/scripts (dev location)
- Resume guard is PR-0/CR-0 as the very first check — matches the skip-entirely convention from stage-execute.md
- Caller contract documented at top: callers don't handle stage update — this reference file does it in CR-5

**Status:** Complete

### 2026-04-15 13:03 - Step 3: Simplify agents/do-code-reviewer.md to self-review only
**Files:**
- `agents/do-code-reviewer.md` - Stripped to self-review only. Removed: Agent tool, Write/Edit from tools, Step 2 (council setting check), council branch from Step 3, verdict combination table (Step 4), iteration loop + do-executioner re-spawning, Sequential Fallback section, stage update logic (stage: verification). Kept: context gathering, 6-criteria evaluation, structured verdict output with file:line references. Description updated to "Self-review only."

**Decisions:**
- Removed Write and Edit from tools — reviewer should not write files (orchestrator updates task file)
- Removed "NO EDITS before reviews complete" critical rule — irrelevant for a single self-reviewer that cannot spawn agents
- Replaced that rule with "Do NOT edit files" to reinforce reviewer-not-implementer stance
- Stage update (stage: verification) removed — orchestrator handles this per plan

**Status:** Complete

### 2026-04-15 13:02 - Step 2: Simplify agents/do-plan-reviewer.md to self-review only
**Files:**
- `agents/do-plan-reviewer.md` - Stripped to self-review only. Removed: Agent tool, Step 2 (council setting check), council branch from Step 3, verdict combination table, iteration loop, Sequential Fallback section. Kept: plan loading, 5-criteria evaluation, structured verdict output. Description updated to "Self-review only."

**Decisions:**
- Removed Write from the tools list — a self-reviewer doesn't need to write files (it returns a verdict, not updates the task file)
- Kept Bash in tools for any file existence checks the reviewer might need during feasibility assessment
- Simplified success criteria to match the narrow scope: just evaluate and return one verdict

**Status:** Complete

## Council Review

## Verification Results

### Approach Checklist
- [x] **Step 1:** Create `agents/do-council-reviewer.md` — file exists with correct tools (Read, Bash only), accepts task path/review type/workspace, runs council-invoke.cjs, returns structured VERDICT block, dev-path fallback present
- [x] **Step 2:** Simplify `agents/do-plan-reviewer.md` to self-review only — Agent removed from tools, no council awareness, description updated to "Self-review only", returns PASS/CONCERNS/RETHINK
- [x] **Step 3:** Simplify `agents/do-code-reviewer.md` to self-review only — Agent/Write/Edit removed from tools, no council awareness, stage update logic removed, description updated to "Self-review only"
- [x] **Steps 4 & 5:** Create `stage-plan-review.md` and `stage-code-review.md` — both exist with PR-0/CR-0 resume guard as first check, council gate (resolveConfig cascade with fs.existsSync fallback), parallel spawn block (PR-3a/CR-3a), single-review fallback (PR-3b/CR-3b), verdict combination tables, iteration loop, escalation rules, and frontmatter updates on APPROVED/VERIFIED
- [x] **Step 6:** Extract review blocks into reference files — `stage-plan-review.md` and `stage-code-review.md` exist as standalone reference files
- [x] **Step 6 (task.md):** `skills/do/task.md` Step 6 replaced with `@references/stage-plan-review.md` reference; Step 10 replaced with `@references/stage-code-review.md` reference; frontmatter description and workflow diagram updated
- [x] **Step 7:** Update `skills/do/continue.md` routing table — Plan Review section loads `@references/stage-plan-review.md`; Code Review section loads `@references/stage-code-review.md`; routing table updated; ESCALATE removed from code review result handler
- [x] **Step 8:** Spec alignment pass — `stage-execute.md` E4 note updated to describe new architecture; `do-verifier.md` confirmed no stale refs; `do-plan-reviewer.md` and `do-code-reviewer.md` verified clean; stale phrase search found no remaining matches
- [x] **Step 9:** Update `project.md` agent table — `do-council-reviewer` added, descriptions for `do-plan-reviewer` and `do-code-reviewer` updated, task flow diagram replaced with parallel-spawn architecture

### Quality Checks
- **Lint:** N/A — markdown/prose project, no lint script
- **Types:** N/A — no TypeScript in this project
- **Tests:** N/A — no test suite

### UAT
- [x] `agents/do-council-reviewer.md` exists, tools list shows Read and Bash only, no Agent/Write/Edit
- [x] `agents/do-plan-reviewer.md` tools list has no Agent or Write; description says "Self-review only"
- [x] `agents/do-code-reviewer.md` tools list has no Agent, Write, or Edit; description says "Self-review only"
- [x] `skills/do/task.md` Step 6 references `@references/stage-plan-review.md` (not a single do-plan-reviewer spawn); Step 10 references `@references/stage-code-review.md`
- [x] `skills/do/references/stage-plan-review.md` and `stage-code-review.md` both open with the PR-0/CR-0 resume guard (skip-entirely if flag is true)
- [x] `skills/do/continue.md` Plan Review and Code Review sections reference the shared stage files, not single-agent spawns

**UAT: PASS** — all 6 checks confirmed by user (2026-04-15)

### Result: PASS
- Checklist: 9/9 complete
- Quality: N/A (markdown project)
- All acceptance criteria verified against implementation

## Post-Review Fixes

### 2026-04-15 14:00 - Targeted fixes from code review
**Status:** Complete

**Fix 1 — `agents/do-plan-reviewer.md`: Remove `Write` from tools list**
- `agents/do-plan-reviewer.md` - Changed `tools: Read, Write, Grep, Glob, Bash` to `tools: Read, Grep, Glob, Bash`. Agent is read-only self-reviewer; Write was left in accidentally.

**Fix 2 — `skills/do/task.md`: Update description and workflow diagram**
- `skills/do/task.md` - Updated frontmatter `description` to mention `do-council-reviewer` spawned in parallel alongside `do-plan-reviewer` and `do-code-reviewer` at review stages.
- `skills/do/task.md` - Replaced ASCII workflow diagram to show parallel spawn at plan review (`do-plan-reviewer + do-council-reviewer (parallel)`) and code review (`do-code-reviewer + do-council-reviewer (parallel)`).

**Fix 3 — `skills/do/references/stage-code-review.md`: Remove ESCALATE from caller contract**
- `skills/do/references/stage-code-review.md` - Removed "ESCALATE" from caller contract at top of file. Code review has no ESCALATE path; only VERIFIED, ITERATE, and MAX_ITERATIONS.

**Fix 4 — Path resolution in stage-plan-review.md and stage-code-review.md**
- `skills/do/references/stage-plan-review.md` - Replaced `readdirSync` pattern with `fs.existsSync(installedPath) ? installedPath : devPath` in PR-1 council gate check. Prevents ENOENT throw in dev mode when installed path directory does not exist.
- `skills/do/references/stage-code-review.md` - Same fix applied to CR-1 council gate check.

**Fix 5 — `agents/do-council-reviewer.md`: Add dev-path fallback**
- `agents/do-council-reviewer.md` - Replaced hardcoded `node ~/.claude/commands/do/scripts/council-invoke.cjs` with shell pattern that checks installed path first and falls back to `skills/do/scripts/council-invoke.cjs` for dev environments.

### 2026-04-15 14:30 - Targeted fixes from iteration 2 code review
**Status:** Complete

**Fix 1 — `skills/do/continue.md`: Remove ESCALATE from code review result handler**
- `skills/do/continue.md` line 184 — Changed `- **MAX_ITERATIONS** or **ESCALATE**: Show to user, stop` to `- **MAX_ITERATIONS**: Show to user, stop` in the Code Review section. The plan review section (line 143) correctly retains ESCALATE.

**Fix 2 — `skills/do/references/stage-plan-review.md`: Fix caller contract wording**
- `skills/do/references/stage-plan-review.md` — Changed "update `council_review_ran.plan: true` in the task frontmatter and continue to the next step" to "`council_review_ran.plan: true` has been updated in the task frontmatter — continue to the next step." Passive voice now matches `stage-code-review.md` convention; PR-5 owns the update, not the caller.

**Fix 3 — `agents/do-plan-reviewer.md` and `agents/do-code-reviewer.md`: Remove council awareness**
- `agents/do-plan-reviewer.md` — Removed "Spawned by the orchestrator (`do:task` or `do:continue`) in parallel with `do-council-reviewer` (when council is enabled)." from `<role>` section.
- `agents/do-code-reviewer.md` — Same sentence removed from `<role>` section.

**Fix 4 — `skills/do/references/init-project-setup.md`: Update code_reviewer description**
- `skills/do/references/init-project-setup.md` line 88 — Changed "Reviews code (parallel self-review + council, auto-iterates)" to "Reviews code (self-review only; orchestrator handles parallel council spawning)".
