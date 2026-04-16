---
id: 260414-refactor-council-review-architecture
created: 2026-04-14T17:00:00Z
updated: 2026-04-14T20:00:00Z
description: "Refactor council review architecture: move parallel spawning to orchestrator, create do-council-reviewer agent, simplify existing reviewers to self-review only"

stage: verified
stages:
  refinement: complete
  grilling: complete
  execution: complete
  verification: complete
  abandoned: false

council_review_ran:
  plan: true
  code: true

confidence:
  score: 0.90
  factors:
    context: -0.03
    scope: -0.05
    complexity: 0.00
    familiarity: -0.02
---

# Refactor Council Review Architecture

## Problem Statement

Models consistently ignore the Agent tool instructions in do-plan-reviewer and do-code-reviewer, performing council reviews inline instead of spawning sub-agents to run council-invoke.cjs. This defeats the purpose of the council architecture -- the external reviewer (codex/gemini) never actually runs.

The root cause is architectural: asking a reviewer agent to spawn further sub-agents is too indirect. Models treat the "spawn a sub-agent to run a bash script" instruction as overhead and collapse it into inline behavior.

**Fix:** Move the parallel spawning responsibility up to the orchestrator level. The orchestrator already spawns reviewer agents; it should also spawn the council reviewer in parallel. Create a new `do-council-reviewer` agent that is a thin wrapper around `council-invoke.cjs`, and strip all council logic from the existing reviewers so they do self-review only.

**Acceptance criteria:**
1. New `agents/do-council-reviewer.md` exists -- thin agent that runs council-invoke.cjs via Bash and returns structured verdict
2. `agents/do-plan-reviewer.md` simplified -- self-review only, no council spawn logic, no critical_rules section, no sequential fallback
3. `agents/do-code-reviewer.md` simplified -- self-review only, no council spawn logic, no critical_rules section, no sequential fallback
4. `skills/do/task.md` Step 6 spawns do-plan-reviewer + do-council-reviewer in parallel; Step 10 spawns do-code-reviewer + do-council-reviewer in parallel; orchestrator combines verdicts using existing verdict tables
5. `skills/do/continue.md` Step 6 routing spawns reviewer + council in parallel at each review point
6. `skills/do/references/stage-execute.md` council review logic removed from E-1 and E4 (moved to orchestrator)
7. `skills/do/references/stage-verify.md` council review logic removed from V-1 (moved to orchestrator)
8. Verdict combination tables preserved (moved to orchestrator files where verdicts are combined)

## Clarifications

### Scope (was: -0.10 -> now: -0.05)
**Q:** When a combined verdict is negative (council or self-review finds issues), what is the user-facing escalation flow? Does the orchestrator immediately prompt the user, or does it iterate silently?
**A:** The orchestrator (or reviewer acting on both verdicts) silently iterates: it reads both the self-review verdict and the council verdict, determines what is valid/invalid, applies fixes, and re-reviews. This cycle repeats up to 3 times. Only after 3 failed iterations does it escalate to the user. No immediate user-facing prompt on a negative verdict.

### Complexity (was: -0.05 -> now: 0.00)
**Q:** Who owns the iteration loop -- does the self-reviewer iterate internally and re-run itself up to 3 times, or does the orchestrator own the outer loop (re-spawning both reviewers each cycle)?
**A:** Design B -- orchestrator owns it. The executioner/planner finishes > orchestrator spawns self-reviewer + council-reviewer in parallel > orchestrator reads both results, filters valid vs invalid findings > if valid issues remain: orchestrator passes them back to executioner/planner with specific fixes to apply, then re-spawns both reviewers (back to step 1). Up to 3 iterations of this outer loop. After 3 failed iterations: escalate to user. Self-reviewer does NOT iterate internally -- runs once per orchestrator cycle.

## Context Loaded

- `database/projects/do/project.md` -- project overview, tech stack, conventions, directory structure
- `skills/do/task.md` -- main orchestrator; Steps 6 and 10 currently spawn single reviewer agents
- `skills/do/continue.md` -- resume orchestrator; Step 6 routing spawns reviewers at each stage transition
- `skills/do/references/stage-execute.md` -- execution stage reference; E-1 runs council-invoke.cjs for plan review, E4 runs it for code review (loaded by do-executioner)
- `skills/do/references/stage-verify.md` -- verification stage reference; V-1 runs council-invoke.cjs for code review (loaded by do-executioner)
- `agents/do-plan-reviewer.md` -- current plan reviewer with council spawn logic, critical_rules, sequential fallback, verdict tables
- `agents/do-code-reviewer.md` -- current code reviewer with council spawn logic, critical_rules, sequential fallback, verdict tables
- `agents/do-executioner.md` -- execution agent; tools: Read, Write, Edit, Bash, Grep, Glob (NO Agent tool -- cannot spawn sub-agents)
- `skills/do/scripts/council-invoke.cjs` -- the script that invokes codex/gemini; accepts --type plan|code, returns JSON with advisor/verdict/findings/recommendations/success
- `.do/config.json` -- project config; council_reviews.planning, council_reviews.execution, council_reviews.reviewer settings

## Approach

1. **Create `agents/do-council-reviewer.md`** -- New thin agent file
   - Role: run council-invoke.cjs via Bash, parse JSON output, return structured verdict
   - Accepts prompt parameters: review type (plan|code), task file path, workspace path
   - For code reviews: also accepts optional files-modified list (comma-separated); pass as `--files-modified` to council-invoke.cjs when present
   - Reads config for reviewer setting (codex/gemini/random)
   - Returns structured format: VERDICT, Advisor, Findings, Recommendations
   - On script failure: returns error verdict (CONCERNS for plan, CHANGES_REQUESTED for code) with raw error text
   - No opinion generation, no inline analysis -- script output only
   - Tools needed: Bash, Read

2. **Simplify `agents/do-plan-reviewer.md`** -- Remove council logic
   - Remove `<critical_rules>` section entirely
   - Remove `<fallback>` (Sequential Fallback) section entirely
   - Remove council review agent prompt from Step 3
   - Simplify Step 3: run self-review only (inline, no need to spawn sub-agent for a single review)
   - Remove verdict combination table from Step 4 (orchestrator handles this now)
   - Simplify Step 4/5: return self-review verdict directly (PASS, CONCERNS, or RETHINK)
   - Remove all iteration logic -- self-reviewer runs once and returns; the orchestrator owns the outer retry loop
   - Remove Agent from tools list (no longer spawns sub-agents)
   - Update description in frontmatter to reflect self-review-only role

3. **Simplify `agents/do-code-reviewer.md`** -- Remove council logic
   - Remove `<critical_rules>` section entirely
   - Remove `<fallback>` (Sequential Fallback) section entirely
   - Remove council review agent prompt from Step 3
   - Simplify Step 3: run self-review only (inline)
   - Remove verdict combination table from Step 4
   - Simplify Step 4/5: return self-review verdict directly (APPROVED, NITPICKS_ONLY, or CHANGES_REQUESTED)
   - Remove all iteration logic -- self-reviewer runs once and returns; the orchestrator owns the outer retry loop
   - Remove the `stage: verified` / `stages.verification: complete` frontmatter update from the VERIFIED result block -- the orchestrator now owns stage transitions (see Steps 4 and 5)
   - Keep UAT generation step (Step 6)
   - Remove Agent from tools list
   - Update description in frontmatter to reflect self-review-only role

4. **Update `skills/do/task.md` Step 6** -- Parallel plan review spawning
   - Check if council planning review is enabled (read config `council_reviews.planning`)
   - If enabled: spawn do-plan-reviewer AND do-council-reviewer in parallel (two Agent calls in one message)
   - If disabled: spawn do-plan-reviewer only
   - After both return: combine verdicts using the plan verdict table (move table here from do-plan-reviewer.md)
   - Handle combined result: APPROVED / ITERATE / ESCALATE
   - ITERATE path (up to 3 cycles): pass valid findings back to do-planner as specific fixes to apply, re-spawn do-plan-reviewer + do-council-reviewer in parallel, re-evaluate; after 3 failed cycles escalate to user
   - Add council prompt template: pass review type "plan", task file path, workspace
   - Update the do-plan-reviewer prompt to remove "Spawn parallel self-review and council review" language -- just say "Run self-review"
   - After combining verdicts, set `council_review_ran.plan: true` in task file frontmatter
   - Log council results to the task file's Council Review section

5. **Update `skills/do/task.md` Step 10** -- Parallel code review spawning
   - Check if council execution review is enabled (read config `council_reviews.execution`)
   - If enabled: spawn do-code-reviewer AND do-council-reviewer in parallel; extract modified files from git diff or Execution Log and pass as files-modified to council reviewer
   - If disabled: spawn do-code-reviewer only
   - After both return: combine verdicts using the code verdict table (move table here from do-code-reviewer.md)
   - Handle combined result: VERIFIED / ITERATE / MAX_ITERATIONS
   - ITERATE path (up to 3 cycles): filter valid findings from both verdicts, pass valid findings back to do-executioner as specific fixes to apply, re-spawn do-code-reviewer + do-council-reviewer in parallel, re-evaluate; after 3 failed cycles escalate to user
   - Add council prompt template: pass review type "code", task file path, workspace, files-modified list
   - Update the do-code-reviewer prompt to remove "Spawn parallel self-review and council review" language -- just say "Run self-review"
   - After combining verdicts and reaching VERIFIED: set `council_review_ran.code: true`, `stage: verification`, `stages.verification: in_progress` in task file frontmatter
   - Log council results to the task file's Council Review section

6. **Update `skills/do/continue.md` Step 6** -- Parallel review spawning at each routing point
   - "Spawn do-plan-reviewer" routing: add parallel do-council-reviewer spawn (if enabled via `council_reviews.planning`)
   - "Spawn do-code-reviewer" routing: add parallel do-council-reviewer spawn (if enabled via `council_reviews.execution`); extract modified files from git diff or Execution Log and pass as files-modified to council reviewer
   - Add verdict combination logic after each parallel spawn pair
   - Include both verdict tables (plan and code)
   - Update reviewer prompts to remove council-spawning language
   - ITERATE path (up to 3 cycles per review point): filter valid findings, pass back to do-planner or do-executioner with specific fixes, re-spawn both reviewers, re-evaluate; after 3 failed cycles escalate to user
   - After combining verdicts and reaching VERIFIED for code review: set `council_review_ran.code: true`, `stage: verification`, `stages.verification: in_progress` in task file frontmatter
   - After combining verdicts for plan review: set `council_review_ran.plan: true` in task file frontmatter
   - Log council results to the task file's Council Review section

7. **Update `skills/do/references/stage-execute.md`** -- Remove council review logic entirely
   - Step E-1 (plan review): Remove entirely. Plan review is now handled by the orchestrator (task.md/continue.md) BEFORE spawning the executioner, not by the executioner itself. Remove the "check if already ran" gate, the council-invoke.cjs call, the verdict handling, and the logging. The orchestrator writes council results to the task file before execution begins.
   - Step E4 (code review): Remove entirely. Code review is now handled by the orchestrator AFTER execution completes (task.md Step 10, continue.md routing). Remove the council-invoke.cjs call, verdict handling, and logging.
   - Rationale: do-executioner has tools [Read, Write, Edit, Bash, Grep, Glob] -- no Agent tool. It cannot spawn do-council-reviewer. Rather than adding Agent tool to executioner (violating separation of concerns), move all review responsibility to the orchestrator.
   - Keep R0 (resume check), E0 (context clear), E1 (load context), E2 (execute), E3 (update state) intact.
   - Update E3 completion message to reflect that code review happens next via orchestrator (e.g., "Execution complete. Returning to orchestrator for code review.").

8. **Update `skills/do/references/stage-verify.md`** -- Remove council review logic
   - Step V-1 (code review): Remove entirely. Code review is handled by the orchestrator before entering verification stage. The orchestrator spawns do-code-reviewer + do-council-reviewer in parallel, combines verdicts, and only enters verification if review passes.
   - Keep R0 (resume check), V0-V6 intact (load context, parse checklist, verify steps, quality checks, UAT).
   - Rationale: same as step 7 -- do-executioner lacks Agent tool.

## Concerns

1. **Verdict table consistency** -- The verdict combination tables need to exist in task.md and continue.md (the two orchestrator files). Risk: tables diverge between files. Mitigation: define tables once per review type and copy verbatim; add a comment noting they must stay in sync.

2. **do-council-reviewer prompt must be precise** -- The whole point of this refactor is that models ignore complex agent-spawning instructions. The do-council-reviewer agent prompt must be dead simple: run script, parse output, return result. Mitigation: keep the agent file minimal, no optional behavior paths, no decision branches.

3. **Iteration loop ownership (Design B)** -- The orchestrator owns the outer retry loop entirely. Each cycle: (1) executioner/planner finishes, (2) orchestrator spawns self-reviewer + council-reviewer in parallel, (3) orchestrator reads both verdicts, filters valid vs invalid findings, (4) if valid issues remain, orchestrator passes only the valid findings back to executioner/planner with specific fixes, then loops. Up to 3 cycles; after 3 failures escalate to user. Self-reviewers and council-reviewer each run once per cycle and return immediately -- no internal iteration. Mitigation: remove all iteration logic from do-plan-reviewer.md and do-code-reviewer.md; add the 3-cycle loop to Steps 4, 5, and 6 of the approach.

4. **Council review timing shift for execution** -- Currently council plan review (E-1) runs just before execution starts, and council code review (E4) runs right after execution ends -- both inside the executioner's flow. Moving these to the orchestrator changes the timing: plan council review now happens earlier (at Step 6, before grilling/approval) and code council review happens later (at Step 10, potentially with a context clear in between). This is actually better -- reviews happen with full orchestrator context and the executioner stays focused on implementation. No mitigation needed; this is a design improvement.

5. **Scope breadth** -- 7 files modified across agents and skills (1 new, 6 existing). Risk of missing a reference or breaking a flow. Mitigation: verify each file compiles to a coherent flow by tracing task.md Steps 5-11 and continue.md Step 6 routing end-to-end after changes.

6. **council_review_ran frontmatter flags** -- The task file has `council_review_ran.plan` and `council_review_ran.code` flags that stage-execute.md and stage-verify.md check to avoid re-running reviews. With reviews moved to the orchestrator, these flags need to be set by the orchestrator (task.md/continue.md) after combining verdicts, not by the stage files. Explicitly handled in Steps 4, 5, and 6 of the approach.

7. **Stage transition ownership** -- The current do-code-reviewer sets `stage: verified` and `stages.verification: complete` when review passes. After refactoring, the code reviewer returns a verdict and the orchestrator owns all stage transitions. Steps 3, 5, and 6 of the approach explicitly address this: Step 3 removes the frontmatter update from do-code-reviewer; Steps 5 and 6 add the transition to the orchestrator logic.

8. **`--files-modified` parameter for code council review** -- council-invoke.cjs accepts `--files-modified` (comma-separated file list) to scope the code review. This parameter appears in stage-verify.md V-1.2 but was missing from the original plan. Addressed in Steps 1, 5, and 6: do-council-reviewer accepts files-modified as an optional prompt parameter; the orchestrators extract modified files before spawning and pass them.

## Execution Log

### 2026-04-14 20:30 - Execution started
**Status:** In progress
**Steps:** 0/8 complete

### 2026-04-14 20:41 - Execution complete
**Status:** Complete
**Summary:**
- Steps completed: 8/8
- Files modified: 7 (1 new, 6 existing)
- Deviations: 0
- Quality: N/A (markdown files only)

### 2026-04-14 20:31 - Step 1: Create agents/do-council-reviewer.md
**Files:**
- `agents/do-council-reviewer.md` - New thin agent that wraps council-invoke.cjs; accepts review_type, task_file, workspace, optional files_modified; returns structured verdict; no inline analysis

**Decisions:**
- Added separate error verdict format for plan vs code reviews (CONCERNS vs CHANGES_REQUESTED) per task spec
- Kept agent minimal with no optional behavior branches per Concern 2

**Status:** Complete

### 2026-04-14 20:32 - Step 2: Simplify agents/do-plan-reviewer.md
**Files:**
- `agents/do-plan-reviewer.md` - Removed critical_rules section, fallback section, council review agent prompt, verdict combination table, iteration logic, Agent tool from tools list; simplified to self-review-only; updated description

**Decisions:**
- Removed Agent tool from tools list (no longer spawns sub-agents)
- Removed Write tool (no longer logs iterations to task file -- orchestrator owns this)
- Kept Grep and Glob for plan analysis

**Status:** Complete

### 2026-04-14 20:33 - Step 3: Simplify agents/do-code-reviewer.md
**Files:**
- `agents/do-code-reviewer.md` - Removed critical_rules section, fallback section, council review agent prompt, verdict combination table, iteration logic, Agent tool from tools list, stage transition from VERIFIED block; simplified to self-review-only; updated description; kept UAT generation step

**Decisions:**
- Removed Agent tool (no longer spawns sub-agents)
- Removed Write tool (orchestrator owns stage transitions and iteration logging)
- Kept Bash for git diff
- Kept Edit for writing UAT checklist to task file
- Removed `stage: verified` / `stages.verification: complete` frontmatter update per Concern 7 in task spec

**Status:** Complete

### 2026-04-14 20:35 - Step 4 & 5: Update skills/do/task.md Steps 6 and 10
**Files:**
- `skills/do/task.md` - Step 6: replaced single reviewer spawn with parallel plan review logic (council check, verdict table, iteration loop, council logging, plan-reviewer prompt updated to say "Run self-review"); Step 10: replaced single reviewer spawn with parallel code review logic (council check, files-modified extraction, verdict table, iteration loop with do-executioner fix pass, council logging, stage transition)

**Decisions:**
- Verdict tables added directly to task.md with sync comment pointing to continue.md per Concern 1
- Iteration loop passes valid findings to do-planner/do-executioner for fixes (Design B from clarifications)
- Stage transition (stage: verification, stages.verification: in_progress) moved here from do-code-reviewer per Concern 7

**Status:** Complete

### 2026-04-14 20:37 - Step 6: Update skills/do/continue.md Step 6
**Files:**
- `skills/do/continue.md` - "Spawn do-plan-reviewer" section expanded to parallel review with council check, verdict table, iteration loop with do-planner fix pass, frontmatter flags, council logging; "Spawn do-code-reviewer" section expanded similarly with files-modified extraction, code verdict table, iteration loop with do-executioner fix pass, stage transition

**Decisions:**
- Both verdict tables in continue.md have sync comments pointing to task.md per Concern 1
- Stage transition for code review (stage: verification, stages.verification: in_progress) added here per Concern 7

**Status:** Complete

### 2026-04-14 20:39 - Step 7: Update skills/do/references/stage-execute.md
**Files:**
- `skills/do/references/stage-execute.md` - Removed Step E-1 entirely (plan council review moved to orchestrator); removed Step E4 entirely (code council review moved to orchestrator); updated E3 completion message to say "Returning to orchestrator for code review"; updated Files section

**Decisions:**
- E-1 removal is clean -- the entire step is gone, not just the council parts
- E4 removal is clean -- the entire step is gone
- E3 completion message updated to reflect new flow

**Status:** Complete

### 2026-04-14 20:40 - Step 8: Update skills/do/references/stage-verify.md
**Files:**
- `skills/do/references/stage-verify.md` - Removed Step V-1 entirely (code review moved to orchestrator); V0 heading updated to remove reference to "after code review completes if enabled"

**Decisions:**
- V-1 removal is complete -- entire step gone, including V-1.1 through V-1.4
- V0 through V6 left intact as required

**Status:** Complete

## Council Review

### Plan Review (Gemini)
- **Verdict:** LOOKS_GOOD
- **Findings:** Architecture is correct — orchestrator ownership, executioner tool limitations, comprehensive concern coverage
- **Recommendation:** Extract verdict tables into a shared reference file instead of duplicating in task.md and continue.md

### Code Review
- **Self-review:** APPROVED — all 8 acceptance criteria met, verdict tables consistent, flow coherent
- **Council (Codex):** Timeout — no response

## Verification Results

## Review Iterations

### Iteration 1
- **Self-review:** CONCERNS
- **Council:** disabled
- **Changes made:**
  - Added `--files-modified` parameter handling to Approach Step 1 (do-council-reviewer) and Steps 5/6 (orchestrators)
  - Added explicit instruction in Step 3 to remove stage transition from do-code-reviewer VERIFIED block; noted orchestrator owns stage transitions
  - Added Concern 7 (stage transition ownership) and Concern 8 (--files-modified parameter) to Concerns section
  - Clarified iteration loop wording in Steps 2 and 3 to explicitly say "re-run self-review only -- no mention of council in iteration"
  - Updated Concern 3 to note that iteration loops must explicitly say "re-run self-review only" (superseded by grilling Q2: Design B adopted -- orchestrator owns outer loop, reviewers run once per cycle)
