---
id: 260414-add-revise-re-execute-loop
created: 2026-04-14T21:00:00Z
updated: 2026-04-14T21:00:00Z
description: "Add revise and re-execute loop to /do:task workflow — structured amendments after code review or user feedback with re-spawn of executioner"

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
  score: 0.91
  factors:
    context: 0.00
    scope: -0.02
    complexity: -0.02
    familiarity: -0.05
---

# Add Revise and Re-Execute Loop

## Problem Statement

After code review or user feedback, there's no structured way to update the task file with changes and re-execute. The user has to manually ask to update the task file, then manually ask to spawn the executor again. This "user requests changes -> update task -> re-execute" cycle is a natural part of any task workflow but isn't represented in the skill.

Every revision requires the user to manually orchestrate what should be an automatic loop. The workflow breaks out of the structured /do system into ad-hoc conversation, losing the benefits of task file tracking and execution logging.

### Acceptance Criteria

1. After code review completes (Step 10 VERIFIED) or after verification UAT fails, the user can request revisions that get structured in the task file
2. Revisions are recorded in a dedicated `## Revisions` section with numbered steps, file paths, and concrete changes
3. The executioner is re-spawned with only the revision steps (not the full original plan)
4. Each revision cycle is logged in the main Execution Log with "Revision N:" prefixes (single source of truth for execution progress)
5. The loop integrates cleanly with `/do:continue` stage routing (a task in "revision" stage can be resumed)
6. No new CLI command needed -- revision is a stage within the existing lifecycle, triggered by the orchestrator

## Clarifications

### Context (was: -0.05 -> now: 0.00)
**Q:** When Step 12 (Complete) runs, should the completion summary show how many revision cycles occurred? And should there be a visible revision trail in the task file?
**A:** Yes. Revision cycles should be tracked with incrementing status labels (revision_1, revision_2, etc.). The completion summary should make it visible how many revision cycles occurred. The frontmatter field serves this purpose, and Step 12 should surface it in the summary output.

### Scope (was: -0.10 -> now: -0.02)
**Q:** What format should the Step 12 completion summary use for revision info — minimal count only, or rich revision trail?
**A:** Conditional + rich: only show revision info if revision_count > 0. When shown, include a "### Revisions" subsection that lists each revision's trigger and what it addressed (pulled from the ## Revisions section). If revision_count == 0, no revision info shown — clean summary.

## Context Loaded

- `skills/do/task.md` -- Main orchestrator, 12-step workflow. Steps 10-12 are where revision entry points live (after code review, after verification). The iteration loop in Step 10 handles auto-fix of code review findings but not user-initiated revisions.
- `skills/do/continue.md` -- Resume orchestrator. Step 6 routes by stage. Needs a new `revision` stage entry in the routing table.
- `agents/do-executioner.md` -- Executor agent. Already supports receiving targeted fix instructions (used by Step 10 iteration loop). Revision re-spawn can follow the same prompt pattern.
- `skills/do/references/task-template.md` -- Task file template with frontmatter stages. Valid stages listed on line 13: `refinement, grilling, execution, verification, verified, complete, abandoned`. Needs `revision` added.
- `skills/do/references/stage-verify.md` -- Verification flow. Step V6 handles UAT completion. This is the SINGLE OWNER of the "are we done?" decision -- the accept/revise choice must live here, not in a separate step in task.md.
- `skills/do/references/stage-execute.md` -- Execution flow. Logs to Execution Log, handles deviations. Revision re-execution should follow same logging conventions.
- `skills/do/references/resume-preamble.md` -- Shared resume logic for all stage reference files. Needs `revision` stage added to the R0.5 routing table and R0.6 mid-execution progress handling.
- `.do/BACKLOG.md` -- Backlog item with original problem description and proposed fix outline.

## Approach

### 1. Add `revision` as a valid stage in the task template

**File:** `skills/do/references/task-template.md`

- Add `revision` to the valid stages comment on line 8
- Add `revision: pending` to the `stages:` block in frontmatter (after `verification`)
- Add `revision_count: 0` to the frontmatter (after `confidence` block, before `waves`)
- Add a `## Revisions` section to the template body (after Council Review, before Verification Results)

Template for the Revisions section:
```markdown
## Revisions

<!--
Populated when user requests changes after code review or UAT failure.
Records ONLY what was requested. All execution of revision steps is logged
in the main ## Execution Log with "Revision N:" prefixes.

### Revision <N>
**Trigger:** code_review | uat_failure | user_feedback
**Changes requested:**
1. <step with file path and concrete change>
2. <step with file path and concrete change>
-->
```

Frontmatter addition:
```yaml
revision_count: 0  # Incremented each time a revision is requested
```

### 2. Create stage-revise.md reference file

**File:** `skills/do/references/stage-revise.md` (new file)

This reference file contains the shared revision logic used by both stage-verify.md (accept/revise choice) and continue.md (revision stage routing). It avoids duplicating the revision flow across orchestrators.

Contents:

1. **Collect revision description** -- Gather user's change request (free-form text)
2. **Structure into revision steps** -- Parse user description into numbered steps, each with a file path and concrete change. Write to `## Revisions > ### Revision N` in the task file. This section records ONLY what was requested -- no execution logs here.
3. **Update frontmatter** -- Set `stage: revision`, `stages.revision: in_progress`, increment `revision_count`. If `stages.revision` was already `complete` from a prior cycle, reset it to `in_progress`
4. **Spawn do-executioner** with revision-specific prompt:

```javascript
Agent({
  description: "Execute revision <N>",
  subagent_type: "do-executioner",
  model: "<models.overrides.executioner || models.default>",
  prompt: `
Execute revision <N> for this task.

Task file: .do/tasks/<active_task>

Read the ## Revisions section, specifically Revision <N>.
Execute ONLY the revision steps (not the original Approach).
Log each action to the main ## Execution Log with "Revision <N>:" prefix.
Do NOT log to the Revisions section -- all execution goes to Execution Log.
Return summary when complete.
`
})
```

5. **Route to code review** -- After executioner returns, run code review (same as execution complete flow)
6. **Route to verification** -- After code review passes, run verification (which includes the accept/revise choice in V6)

Both stage-verify.md and continue.md load this reference file rather than inlining the logic.

### 3. Move accept/revise choice INTO stage-verify.md (single owner)

**File:** `skills/do/references/stage-verify.md`

Stage-verify.md already owns the "are we done?" decision at Step V6. Modify V6 to include the accept/revise choice instead of going straight to complete. This replaces the need for a separate Step 12 in task.md.

**Modify Step V6 "yes" path (UAT passes):**

Replace the current "yes" flow (which goes straight to `stage: complete`) with:

```
UAT verified. Would you like to:
1. Accept and complete the task
2. Request revisions (describe changes needed)

Choose option:
```

If option 1:
- Proceed with existing completion flow (set `stage: complete`, clear `active_task`, etc.)

If option 2:
- Load `@references/stage-revise.md` and follow its flow (collect, structure, spawn, route back through review/verify)
- The loop returns to stage-verify.md V5/V6 after revision completes

**Modify Step V6.2 "no" path (UAT fails):**

Currently offers two options: loop back to execution, or spawn new /do:task. Replace option 1 with revision:

```
UAT failed. What would you like to do?
1. Request revisions (describe what to fix)
2. Spawn new /do:task for the fix

Choose option:
```

If option 1:
- Load `@references/stage-revise.md` and follow its flow

This makes stage-verify.md the SINGLE owner of the accept/revise decision for both UAT pass and UAT fail paths.

### 4. Update resume-preamble.md for revision stage

**File:** `skills/do/references/resume-preamble.md`

**Step R0.5 update:** Add `revision` row to the "Last Action Source" table:

| Stage | Last Action Source |
|-------|-------------------|
| refinement (grilling) | Last Q&A pair from Clarifications section, or "Grill-me not started" |
| execution | Summary from last Execution Log entry (Files + Status), or "Execution not started" |
| revision | Last "Revision N:" entry from Execution Log, or "Revision not started" |
| verification | "Verification: " + stages.verification status (in_progress, awaiting UAT, etc.) |
| verified | Last UAT status, or "Awaiting UAT confirmation" |

**Step R0.6 update:** Extend mid-execution progress check to also apply to `revision` stage:

Currently R0.6 says "Only applies to `execution` stage". Change to: "Only applies to `execution` or `revision` stage".

When in `revision` stage:
- R0.6.1: Parse `## Revisions` for the latest Revision N's steps (instead of Approach)
- R0.6.2: Match completed work by scanning Execution Log for "Revision N:" prefixed entries
- R0.6.3: Display progress checklist for revision steps only

### 5. Add revision stage routing to continue.md

**File:** `skills/do/continue.md`

Add new rows to the Step 6 routing table:

| Stage | Sub-condition | Action |
|-------|---------------|--------|
| `revision` | stages.revision: in_progress | Spawn do-executioner with revision prompt (see spawn block below) |
| `revision` | stages.revision: complete | Run code review (same as execution complete) |

Add the full spawn block section for revision routing (alongside existing spawn blocks like "Spawn do-executioner (new or resume)"):

### Spawn do-executioner for revision (resume)

When stage is `revision` and `stages.revision: in_progress`, load `@references/stage-revise.md` for the full revision flow. For resume specifically, use this spawn block:

```javascript
Agent({
  description: "Execute revision (resume)",
  subagent_type: "do-executioner",
  model: "<models.overrides.executioner || models.default>",
  prompt: `
Continue executing the latest revision for this task.

Task file: .do/tasks/<active_task>

Read ## Revisions section for the latest revision.
Check main ## Execution Log for prior "Revision N:" entries to find progress.
Execute remaining revision steps only.
Log to main ## Execution Log with "Revision N:" prefix.
`
})
```

After executioner returns from revision, route through code review and verification (same as normal execution complete flow, as specified in stage-revise.md).

When `stages.revision: complete`, route to "Spawn do-code-reviewer" (same as `execution` stage with `stages.execution: complete`).

### 6. Update do-executioner to recognize revision context

**File:** `agents/do-executioner.md`

Add a section to the execution_flow that handles revision mode:

- When the prompt mentions "revision", read `## Revisions` section instead of `## Approach`
- Use the same step-by-step execution, logging, and deviation handling
- Log ALL execution to the main `## Execution Log` section with "Revision N:" prefix -- do NOT create a separate log inside the Revisions section
- On completion, set `stages.revision: complete` (not `stages.execution: complete`)

This is a small addition since the executioner already supports targeted fix prompts from the code review iteration loop.

### 7. Handle revision state transitions and multi-cycle resets

**Files:** `skills/do/references/stage-revise.md`, `skills/do/references/stage-verify.md`, `skills/do/continue.md`

State transitions for revision (documented in stage-revise.md):
- Entry: `stage: revision`, `stages.revision: in_progress`, increment `revision_count`
- On second+ revision: `stages.revision` resets from `complete` back to `in_progress`. The `revision_count` field tracks how many revisions have occurred (1, 2, 3, ...). There is no ambiguity -- `revision_count` is the cumulative count, `stages.revision` is the current cycle status.
- Executioner completes: `stages.revision: complete`
- Code review passes: `stage: verification`, `stages.verification: in_progress`
- Verification passes: stage-verify.md V6 presents accept/revise choice
- User accepts in V6: `stage: complete`

Note: task.md does NOT have a separate revision check step. After Step 11 (verification), task.md proceeds to Step 12 (Complete). The accept/revise loop is entirely owned by stage-verify.md's V6 flow.

### 8. Add revision cap to prevent infinite loops

**Files:** `skills/do/references/stage-revise.md`, `skills/do/references/stage-verify.md`, `skills/do/continue.md`

Set a maximum revision count (default: 3, configurable in `.do/config.json` as `max_revisions`). Check `revision_count` against cap before entering the revision flow (in stage-revise.md). After reaching the cap:

```
## REVISION LIMIT REACHED

**Revisions:** 3/3
**Status:** Maximum revisions reached

### Options
1. Accept current implementation
2. Spawn new /do:task for remaining changes
3. Continue anyway (override limit)
```

## Concerns

1. **Duplication between orchestrators** -- The revision flow needs to be callable from stage-verify.md (accept/revise choice) and continue.md (resume routing). Mitigation: Step 2 creates `skills/do/references/stage-revise.md` as a shared reference file. Both stage-verify.md and continue.md load this reference rather than inlining the logic. Status: addressed in approach.

2. **Execution log bloat** -- Multiple revisions will make the task file long, increasing token usage on resume. Mitigation: revision execution logs should be compact (only changed files + decisions). The revision steps themselves are already scoped to specific changes rather than full re-implementation.

3. **Code review after revision may flag original code** -- When re-running code review after a revision, the reviewer sees all changes (not just revision changes). It might flag issues in already-reviewed code. Mitigation: the revision re-execution prompt should instruct the code reviewer to focus on revision-related changes by providing a targeted `git diff` from before the revision.

4. **Stage transition complexity** -- Adding `revision` as a new stage creates more routing paths. The `stages.revision` flag resets to `in_progress` on each new revision cycle, which could be confusing. Mitigation: `revision_count` provides the cumulative count (monotonically increasing), while `stages.revision` only tracks the current cycle. This separation is documented in stage-revise.md and follows the same pattern as other stages.

5. **Context window pressure on multi-revision tasks** -- After 2-3 revisions, the task file will be significantly larger. The stage-verify.md context estimation heuristic (Step V6.1) should account for revision content. Mitigation: update the token estimation formula to include revision entries (both Revisions section and "Revision N:" Execution Log entries).

6. **Single logging source of truth** -- Revision requested changes go to `## Revisions`, all execution of those changes goes to `## Execution Log` with "Revision N:" prefixes. Resume-preamble only parses Execution Log, so this alignment is critical. Mitigation: stage-revise.md executor prompt explicitly instructs "log to main Execution Log, not Revisions section". do-executioner.md revision mode section reinforces this. Status: addressed in approach steps 2, 4, and 6.

7. **resume-preamble must know about revision stage** -- Without updating resume-preamble.md, `/do:continue` on a revision-stage task would show wrong resume summary and skip mid-execution progress tracking. Mitigation: Step 4 adds the `revision` row to R0.5 and extends R0.6 to handle revision stage. Status: addressed in approach.

## Execution Log

### 2026-04-14 21:30 - Execution started
**Status:** In progress
**Steps:** 0/8 complete

### 2026-04-14 21:40 - Execution complete
**Status:** Complete
**Summary:**
- Steps completed: 8/8 (plus task.md Step 12 update per plan clarifications)
- Files modified: 6
- Deviations: 0
- Quality: N/A (markdown files only, no lint/test scripts)

### 2026-04-14 21:31 - Step 1: Add revision stage to task template
**Files:**
- `skills/do/references/task-template.md` - Added `revision` to valid stages comment, added `stages.revision: pending` to frontmatter, added `revision_count: 0` field, added `## Revisions` section template body

**Status:** Complete

### 2026-04-14 21:32 - Step 2: Create stage-revise.md reference file
**Files:**
- `skills/do/references/stage-revise.md` - Created new file with RV0 (revision cap check), RV1 (collect description), RV2 (structure into steps), RV3 (update frontmatter), RV4 (spawn executioner), RV5 (route to code review), RV6 (route to verification), plus state transitions table

**Status:** Complete

### 2026-04-14 21:39 - task.md Step 12 conditional revision summary
**Files:**
- `skills/do/task.md` - Updated Step 12 Complete to read revision_count and conditionally append "### Revisions" subsection showing each revision's trigger and changes requested (only shown when revision_count > 0)

**Status:** Complete

### 2026-04-14 21:38 - Step 8: Add revision cap to prevent infinite loops
**Files:**
- `skills/do/references/stage-revise.md` - Cap logic already implemented in RV0: reads `max_revisions` from config (default 3), checks revision_count >= cap, presents REVISION LIMIT REACHED message with 3 options (accept/spawn-new/override). Both stage-verify.md and continue.md load stage-revise.md which runs RV0 first, so cap is enforced in all revision entry points.

**Decisions:**
- Cap implemented centrally in stage-revise.md RV0 rather than duplicating across stage-verify.md and continue.md — single enforcement point, no duplication

**Status:** Complete

### 2026-04-14 21:37 - Step 7: Handle revision state transitions and multi-cycle resets
**Files:**
- `skills/do/references/stage-revise.md` - State transitions already covered: RV3 explicitly resets stages.revision to in_progress even if prior cycle set complete; State Transitions table at end of file documents full lifecycle including multi-cycle resets
- No additional changes needed: continue.md routing handles both in_progress and complete sub-conditions; the separation of revision_count (cumulative) vs stages.revision (current cycle status) is documented in stage-revise.md

**Decisions:**
- Step 7 was primarily documentation/wiring — all state transition logic was implemented as part of Steps 2, 3, and 5. Verified correctness of existing content rather than making new changes.

**Status:** Complete

### 2026-04-14 21:36 - Step 6: Update do-executioner to recognize revision context
**Files:**
- `agents/do-executioner.md` - Added "Revision Mode Detection" section to Step 1 Load Execution Context; describes how to detect revision mode from prompt, read Revisions section instead of Approach, log with "Revision N:" prefix, and set stages.revision: complete on completion

**Status:** Complete

### 2026-04-14 21:35 - Step 5: Add revision stage routing to continue.md
**Files:**
- `skills/do/continue.md` - Added `revision` rows to Step 6 routing table (in_progress → spawn executioner, complete → spawn code reviewer); added "Spawn do-executioner for revision (resume)" spawn block with resume-specific prompt referencing stage-revise.md

**Status:** Complete

### 2026-04-14 21:34 - Step 4: Update resume-preamble.md for revision stage
**Files:**
- `skills/do/references/resume-preamble.md` - Added `revision` row to R0.5 stage routing table; extended R0.6 to apply to both `execution` and `revision` stages; added R0.6.1/R0.6.2/R0.6.3 revision-specific variants that parse Revisions section and match "Revision N:" prefixed log entries

**Status:** Complete

### 2026-04-14 21:33 - Step 3: Move accept/revise choice into stage-verify.md
**Files:**
- `skills/do/references/stage-verify.md` - Modified V6 to add V6.0 accept/revise prompt before completion; option 2 loads stage-revise.md. Modified UAT-fail path to offer "Request revisions" instead of "Loop back to execution". Updated V6.1 token estimation formula to include revision entries.

**Decisions:**
- V6.0 is inserted before the existing V6 completion logic so UAT-pass path always presents the accept/revise choice
- UAT-fail option 1 changed from "Loop back to execution" to "Request revisions" — routes through stage-revise.md for structured tracking

**Status:** Complete

## Council Review

## Verification Results
