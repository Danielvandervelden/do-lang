---
id: 260415-remove-the-redundant-execution
created: 2026-04-15T06:54:53Z
updated: 2026-04-15T08:45:00Z
description: "Remove the redundant executioner verification step at the end of the /do:task pipeline. Code-reviewer already verifies the work, so the post-review verification stage is unnecessary."

stage: verified
stages:
  refinement: complete
  grilling: pending
  execution: complete
  revision: pending
  abandoned: false

council_review_ran:
  plan: true
  code: false

confidence:
  score: 0.82
  factors:
    context: 0.95
    scope: 0.75
    complexity: 0.82
    familiarity: 0.90

revision_count: 1
---

# Remove redundant executioner verification step

## Problem Statement

The current `/do:task` pipeline ends with a redundant verification step:

```
do-planner -> do-plan-reviewer -> USER APPROVAL -> do-executioner -> do-code-reviewer -> do-executioner (verification) -> COMPLETE
```

After `do-code-reviewer` returns VERIFIED, Step 11 in `task.md` spawns `do-executioner` again to run the verification stage (V0-V6 from `stage-verify.md`). This duplicates work that the code-reviewer already does: checking completeness against the Approach, reviewing quality, and generating a UAT checklist.

However, the verification stage is NOT purely redundant. It contains three things the code-reviewer does not currently provide:

1. **Running actual quality check commands** (V3) -- `npm run lint`, `npm run typecheck`, `npm run test` -- whereas code-reviewer only inspects the diff visually.
2. **UAT confirmation flow** (V5) -- presenting the checklist to the user and waiting for manual verification.
3. **Accept/revise/complete decision** (V6) -- the "are we done?" choice, revision loop, and task completion (setting `stage: complete`, clearing `active_task`).

The goal is to eliminate the redundant second executioner pass while preserving the UAT and completion flows. Quality checks (V3) are already run by `do-executioner` in its Step 4. The UAT and accept/revise flows need to move into the orchestrator (task.md and continue.md) so they happen after code review passes, without spawning another agent.

### Acceptance Criteria

- Step 11 in `task.md` no longer spawns `do-executioner` for verification
- The pipeline after code review VERIFIED sets `stage: verified` (not `stage: complete`) as the intermediate "awaiting UAT" state
- Only after user accepts UAT does the task move to `stage: complete`
- Task completion (setting `stage: complete`, clearing `active_task`) still works
- Revision loop still works (user can request changes after UAT)
- `/do:continue` routing handles the new flow (no dead `verification` stage routing that spawns executioner)
- `stage-verify.md` is removed
- The `do-executioner` agent no longer sets `stage: verification` or `stages.verification: pending` in its completion step
- The task-template frontmatter is updated to remove the `verification: pending` stage entry
- The `codex/continue.md` routing table AND loader block are updated
- All `stage-verify.md` cross-references in `stage-revise.md` are updated
- Back-compat fallback distinguishes between legacy tasks with PASS vs. FAIL vs. empty Verification Results

## Clarifications

### Q: Does "stop after code-reviewer" mean literally stop the pipeline, or remove the redundant agent spawn while keeping UAT?
**A (inferred, not user-confirmed):** The user's intent is to remove the redundant executioner spawn for verification, not to eliminate user-visible UAT confirmation and task completion logic. Literally stopping after code-reviewer would mean: (1) no UAT confirmation -- the user never gets to manually verify the implementation works, (2) no accept/revise choice -- no way to request changes or formally complete the task, (3) no `stage: complete` transition -- tasks would be left in a limbo state with no completion path. The user almost certainly wants to keep these behaviors but have them happen without spawning another agent. The fix is to inline the UAT and completion flow into the orchestrator files (task.md and continue.md) so they run directly after code review passes.

## Context Loaded

- `skills/do/task.md` -- The /do:task orchestrator. Contains Step 11 (verification spawn) that needs to be removed, Step 10 (code review) whose VERIFIED path needs to change, and Step 12 (completion display) that needs to absorb some verification logic. Line 22 mentions verification in the orchestrator overview.
- `skills/do/continue.md` -- The /do:continue resume handler. Routes `verification` and `verified` stages to stage-verify.md. Needs routing table update, post-code-review routing update, and removal of verification spawn section.
- `skills/do/references/stage-verify.md` -- The V0-V6 verification flow. UAT (V5) and accept/revise/complete (V6) logic needs to be extracted before removing this file. V4 writes `### Result: PASS` or `### Result: FAIL` while stage is still `verification` -- only V5 promotes to `verified`.
- `skills/do/references/stage-execute.md` -- Execution stage reference. Step E3 note says "Do NOT update stage here -- the orchestrator manages stage transitions after code review." No direct changes needed.
- `skills/do/references/stage-revise.md` -- Revision flow. References `stage-verify.md` at: line 8 (prose overview), lines 43-46 (RV0 cross-reference to V6 "yes" path), line 52 (RV1 "from stage-verify.md V6 context"), lines 139-142 (RV5 sets `stage: verification`), lines 144-166 (RV6 spawns executioner for stage-verify.md). All need updating.
- `skills/do/references/task-template.md` -- Task template. Has `verification: pending` in stages and comments listing `verification` and `verified` as valid stages. Line 188 has guidance comment for Verification Results section that references the old V0-V6 flow.
- `skills/do/references/resume-preamble.md` -- Resume logic. References `verification` and `verified` stages in the R0.5 resume summary table (line 111). Also lists `verification` in the stage field description (line 25).
- `agents/do-executioner.md` -- Executioner agent. Step 5 sets `stage: verification`, `stages.verification: pending` on completion. Needs to stop doing this.
- `agents/do-code-reviewer.md` -- Code reviewer agent. Already generates UAT checklist (Step 4) and writes it to Verification Results section.
- `codex/continue.md` -- Codex version of continue. Routes verification/verified stages to stage-verify.md in routing table (Step 3, lines 47-48) AND hard-codes `stage-verify.md` in the loader block (Step 4, lines 57-65).
- `/Users/globalorange/workspace/database/projects/do/project.md` -- Project overview and conventions.

## Approach

### Phase 1: Inline UAT + completion logic into the orchestrators

1. **Update `skills/do/task.md` Step 10 (VERIFIED path)** -- After code review returns VERIFIED, change the frontmatter update from `stage: verification`, `stages.verification: in_progress` to `stage: verified`, `council_review_ran.code: true`. Do NOT set `stage: complete` here -- the task is now in the "awaiting UAT" intermediate state. This is the orchestrator's responsibility (not the executioner's).
   - **File:** `skills/do/task.md` line 447
   - **Expected outcome:** VERIFIED path sets `stage: verified` instead of `stage: verification`

2. **Replace `skills/do/task.md` Step 11 (verification spawn) with inline UAT + accept/revise flow** -- Remove the agent spawn entirely. Replace with the UAT and completion logic extracted from `stage-verify.md` V5-V6, adapted for inline orchestrator use:
   - Present the UAT checklist from Verification Results section (code-reviewer already wrote it)
   - Wait for user confirmation
   - If user says "yes": set `stage: complete`, clear `active_task` in config -- task is done
   - If user says "no" or requests revisions: enter revision flow via `stage-revise.md`
   - Include context estimation (V6.1) and handoff prompt (V6.2) for high-context sessions
   - **File:** `skills/do/task.md` lines 518-543
   - **Expected outcome:** Step 11 handles UAT inline without spawning an agent

3. **Update `skills/do/task.md` Step 12 (completion display)** -- Simplify to match the new flow. The UAT confirmation already happened in Step 11. Step 12 just shows the final summary.
   - **File:** `skills/do/task.md` lines 544-577
   - **Expected outcome:** Clean completion display, no verification references

4. **Update `skills/do/continue.md` Step 6 routing table** -- Replace the `verification` and `verified` rows with a three-way branch for legacy tasks and the new `verified` flow:

   | Stage | Condition | Action |
   |-------|-----------|--------|
   | `verified` | any | Present UAT checklist inline, handle accept/revise |
   | `verification` (legacy) | Verification Results contains `### Result: PASS` or has UAT checklist | Treat as `verified`, present UAT inline |
   | `verification` (legacy) | Verification Results contains `### Result: FAIL` | Preserve failure path: present the failure to user, offer fix/revise options (do not auto-skip to UAT) |
   | `verification` (legacy) | Verification Results empty/incomplete | Re-spawn `do-code-reviewer` to generate UAT checklist, then proceed to UAT |

   - **File:** `skills/do/continue.md` lines 107-118
   - **Expected outcome:** Routing table handles new flow AND three legacy scenarios correctly

5. **Update `skills/do/continue.md` post-code-review VERIFIED path** -- In the "Spawn do-code-reviewer" section, after VERIFIED: change from setting `stage: verification`, `stages.verification: in_progress` to setting `stage: verified`. Then present the UAT + accept/revise flow inline (same logic as task.md Step 11).
   - **File:** `skills/do/continue.md` lines 418-434
   - **Expected outcome:** Post-code-review path goes to `stage: verified` then inline UAT

6. **Remove `skills/do/continue.md` "Spawn do-executioner for verification" section** -- Delete the entire verification spawn block and its "After do-executioner returns from verification" handling.
   - **File:** `skills/do/continue.md` lines 485-508
   - **Expected outcome:** No verification agent spawn in continue.md

7. **Add inline UAT + accept/revise section to `skills/do/continue.md`** -- Add a new section "Handle UAT (verified stage)" that contains the inlined UAT flow (same logic as task.md Step 11). This is what the routing table's `verified` row points to.
   - **File:** `skills/do/continue.md` (new section after code review handling)
   - **Expected outcome:** continue.md can handle verified stage resume without loading stage-verify.md

8. **Update `skills/do/continue.md` after-revision routing** -- The current comment at line 342 says "After code review passes, route to verification (stage-verify.md V0-V6)." Change this to "After code review passes, set `stage: verified` and present UAT inline."
   - **File:** `skills/do/continue.md` line 342
   - **Expected outcome:** Revision loop routes to inline UAT, not stage-verify.md

### Phase 2: Update agents (dual-responsibility fix)

9. **Update `agents/do-executioner.md` Step 5** -- The executioner currently sets BOTH `stage: verification` AND `stages.verification: pending` on completion. This is wrong because (a) stage-execute.md E3 already says "Do NOT update stage here -- the orchestrator manages stage transitions", and (b) the orchestrator (task.md Step 10, continue.md post-code-review) also sets the stage. Fix: executioner should ONLY set `stages.execution: complete` and NOT set the top-level `stage` field at all. The orchestrator owns stage transitions.
   - **File:** `agents/do-executioner.md` lines 187-192
   - **Expected outcome:** Executioner no longer sets `stage` or `stages.verification`

10. **Note: `skills/do/task.md` Step 10 dual-responsibility** -- Currently BOTH the executioner (Step 9 above) and the orchestrator task.md Step 10 VERIFIED path set `stage: verification`. After fix #9, only the orchestrator sets it. And after fix #1, the orchestrator sets `stage: verified` (not `verification`). This means the dual-write conflict is resolved: executioner writes `stages.execution: complete`, orchestrator writes `stage: verified`. Documenting this explicitly so the executioner understands there's no collision.

### Phase 3: Update cross-references

11. **Update `skills/do/references/stage-revise.md` line 8 (prose overview)** -- Change "This reference file is loaded by stage-verify.md (accept/revise choice)" to "This reference file is loaded by the orchestrator (task.md/continue.md) at the accept/revise choice."
    - **File:** `skills/do/references/stage-revise.md` line 8
    - **Expected outcome:** No stale reference to stage-verify.md

12. **Update `skills/do/references/stage-revise.md` RV0 (lines 43-46)** -- Change the cross-reference "Proceed with completion flow (same as stage-verify.md V6 'yes' path)" to "Proceed with completion flow (set `stage: complete`, clear `active_task` -- same as UAT accept path in task.md/continue.md)."
    - **File:** `skills/do/references/stage-revise.md` lines 43-46
    - **Expected outcome:** RV0 points to the right completion flow

13. **Update `skills/do/references/stage-revise.md` RV1 (line 52)** -- Change "from stage-verify.md V6 context" to "from the orchestrator's UAT accept/revise flow" or similar wording that doesn't reference the deleted file.
    - **File:** `skills/do/references/stage-revise.md` line 52
    - **Expected outcome:** RV1 no longer references stage-verify.md

14. **Update `skills/do/references/stage-revise.md` RV5 (lines 138-142)** -- After code review passes, change from setting `stage: verification`, `stages.verification: in_progress` to setting `stage: verified`.
    - **File:** `skills/do/references/stage-revise.md` lines 138-142
    - **Expected outcome:** Revision post-code-review uses `verified` not `verification`

15. **Update `skills/do/references/stage-revise.md` RV6 (lines 144-166)** -- Replace the "Spawn do-executioner for verification" with inline UAT + accept/revise flow. Remove the reference to "V0-V6 from stage-verify.md." Instead, the orchestrator presents UAT inline (same logic as task.md Step 11). The revision loop returns naturally if user requests another revision.
    - **File:** `skills/do/references/stage-revise.md` lines 144-166
    - **Expected outcome:** RV6 uses inline UAT, no stage-verify.md reference

16. **Update `skills/do/references/stage-revise.md` State Transitions table (lines 170-181)** -- Change `verification` references to `verified`. Update the "Code review passes" row from `stage: verification` to `stage: verified`.
    - **File:** `skills/do/references/stage-revise.md` lines 170-181
    - **Expected outcome:** State table reflects new flow

17. **Update `skills/do/references/task-template.md` frontmatter (lines 8-9, 19)** -- Remove `verification: pending` from the `stages` frontmatter. Update the valid stages comment: remove `verification` from the list (keep `verified` -- it's still used as the intermediate "awaiting UAT" state).
    - **File:** `skills/do/references/task-template.md` lines 8, 9, 19
    - **Expected outcome:** Template no longer creates tasks with verification stage

18. **Update `skills/do/references/task-template.md` Verification Results guidance comment (line 188)** -- The current comment says "This section is populated during the verification phase." and describes V0-V6 output format (Approach Checklist, Quality Checks, Result, UAT). Update to reflect the new flow: this section is populated by `do-code-reviewer` with the UAT checklist. Remove references to V3 quality-check output (Approach Checklist, Quality Checks, `### Result: PASS|FAIL`) since those are no longer written by the code-reviewer. Keep the UAT checklist format since that's what the code-reviewer writes.
    - **File:** `skills/do/references/task-template.md` lines 187-212
    - **Expected outcome:** Guidance comment describes what code-reviewer actually writes, not the deleted V0-V6 flow

19. **Update `skills/do/references/resume-preamble.md` R0.5 resume summary table (lines 106-112)** -- Remove the `verification` row. Keep the `verified` row (it now means "awaiting UAT confirmation, present checklist").
    - **File:** `skills/do/references/resume-preamble.md` lines 106-112
    - **Expected outcome:** Resume preamble has no stale verification reference

20. **Update `skills/do/references/resume-preamble.md` stage field description (line 25)** -- Change "(refinement, execution, verification, etc.)" to "(refinement, execution, verified, etc.)" or remove `verification` from the example list.
    - **File:** `skills/do/references/resume-preamble.md` line 25
    - **Expected outcome:** Stage field example list doesn't mention deleted stage

21. **Update `skills/do/task.md` orchestrator overview (line 22)** -- Change "This skill orchestrates 5 agents to ensure every task gets proper planning, review, execution, and verification." to reflect the new pipeline. The orchestrator still does planning, review, execution, code review, and UAT -- but "verification" as a named stage no longer exists. Reword to something like "...proper planning, review, execution, and code review with UAT."
    - **File:** `skills/do/task.md` line 22
    - **Expected outcome:** Overview describes the actual pipeline, not the old verification stage

22. **Update `codex/continue.md` routing table (Step 3, lines 47-48)** -- Remove `verification | any | stage-verify.md` and `verified | any | stage-verify.md` rows. Replace with `verified | any | (inline UAT flow)` and add legacy fallback for `verification` with the same three-way branch as Step 4 above.
    - **File:** `codex/continue.md` lines 47-48
    - **Expected outcome:** Codex routing table matches Claude routing table

23. **Update `codex/continue.md` loader block (Step 4, lines 57-65)** -- Remove the reference to `stage-verify.md` from the list of stage reference files to load.
    - **File:** `codex/continue.md` lines 57-65
    - **Expected outcome:** Codex loader no longer tries to load deleted file

### Phase 4: Clean up

24. **Delete `skills/do/references/stage-verify.md`** -- All UAT/completion logic has been inlined into orchestrators. All cross-references have been updated. No code path routes to this file anymore.
    - **File:** `skills/do/references/stage-verify.md` (delete)
    - **Expected outcome:** File removed, no orphan references remain

25. **Update this task file's own frontmatter** -- Remove `verification: pending` from this task's stages (eat your own dog food).
    - **File:** `.do/tasks/260415-remove-the-redundant-execution.md`
    - **Expected outcome:** Self-consistent with the changes being made

### Design decision: inline UAT vs. stage-complete.md reference file

The original plan proposed creating a new `stage-complete.md` reference file for the UAT logic. Review finding #5 correctly identified that this introduces a new pattern (orchestrator loading a reference file inline) that the current codebase does not use -- the orchestrator uses procedural numbered steps in its own skill file, while only spawned agents load reference files. To avoid introducing a new architectural pattern for a small amount of logic, the UAT + accept/revise flow is inlined directly into `task.md` Step 11 and `continue.md`'s verified-stage handler. This keeps the change minimal and consistent with existing patterns.

### Back-compat strategy (refined per review findings #4 and iteration 2 finding #1)

For legacy tasks paused with `stage: verification`, the fallback uses a three-way branch based on the **content** of the Verification Results section, not just whether it is populated. This is necessary because `stage-verify.md` V4 writes results (including `### Result: PASS` or `### Result: FAIL`) while the task is still at `stage: verification` -- only V5 promotes to `stage: verified`. A legacy task paused at `stage: verification` with `### Result: FAIL` is in a failed state and must NOT be jumped to UAT.

The three-way branch:

1. **`stage: verification` + Verification Results contains `### Result: PASS` or has a UAT checklist** -- Safe to treat as equivalent to `stage: verified`. The verification passed, V5 just hadn't promoted the stage yet. Present UAT checklist inline, handle accept/revise.

2. **`stage: verification` + Verification Results contains `### Result: FAIL`** -- The verification failed. Preserve the failure path: present the failure details to the user and offer fix/revise options (same as V4.3 did). Do NOT auto-skip to UAT. Options:
   - Route to `/do:task "Fix: <issue>"` for a new task to fix the problem
   - Handle manually, then `/do:continue` to re-run code review
   This maintains the failure-handling semantics the user expected from the old flow.

3. **`stage: verification` + Verification Results empty/incomplete** -- The task's code was not yet reviewed (paused before code review completed, or during an earlier V0-V4 step before results were written). Re-spawn `do-code-reviewer` to generate the UAT checklist, then proceed to UAT. This avoids skipping to UAT for a task that never had its code reviewed.

This fallback is implemented in `continue.md` Step 6 routing table (see Approach step 4) and `codex/continue.md` (see Approach step 22).

## Concerns

1. **UAT flow ownership change** -- The UAT confirmation currently lives inside `stage-verify.md` which is loaded by a spawned executioner. Moving it into the orchestrator means the orchestrator itself (task.md/continue.md) needs to handle user interaction (presenting checklist, waiting for response, branching on accept/revise). The orchestrator already handles similar prompts (Step 8 approval checkpoint), so this is feasible but adds some length to the orchestrator files.
   - **Mitigation**: The inlined UAT logic is small (display checklist, wait for yes/no, branch). It follows the same pattern as existing user prompts in the orchestrator. No new architectural patterns needed.

2. **Revision loop integration** -- The revision flow (`stage-revise.md`) currently routes back to verification after code review. This needs to route to the new inline UAT flow instead. The revision flow is already complex with its own state machine.
   - **Mitigation**: The change in stage-revise.md is localized to RV0 (cross-reference), RV1 (context reference), RV5 (stage setting), RV6 (verification spawn), and the state transitions table. The revision loop's internal logic (RV1-RV4) is unaffected.

3. **Scope across many files** -- This task touches 11 files across skills, agents, references, and codex. A mistake in one routing path could break the pipeline.
   - **Mitigation**: Each file change is small and focused. The approach is structured so each step can be verified independently. Changes are grouped by phase (orchestrators, agents, cross-references, cleanup) so dependencies are clear.

4. **Legacy task migration** -- Tasks saved with `stage: verification` before this change will have a stage that no longer has a direct routing entry.
   - **Mitigation**: Three-way back-compat fallback in `continue.md` routing. Tasks with PASS results go to UAT. Tasks with FAIL results preserve the failure path. Tasks with empty results get code review re-run. This handles all three pause scenarios correctly.

5. **Quality checks gap** -- Verification V3 runs `npm run lint/test/typecheck`. If we remove verification, do we lose these checks? Analysis shows `do-executioner` Step 4 already runs quality checks after execution. The code-reviewer then reviews the results. So quality checks are NOT lost -- they just happen at the executioner stage instead of being re-run at verification.
   - **Mitigation**: None needed. The executioner already runs quality checks. No gap.

6. **Dual-responsibility for stage transitions** -- Both `do-executioner` Step 5 and the orchestrator (task.md Step 10 / continue.md post-code-review) currently write `stage: verification`. This creates a race/overwrite scenario. The fix explicitly separates responsibilities: executioner writes only `stages.execution: complete`, orchestrator writes only `stage: verified`.
   - **Mitigation**: Explicit in approach steps 9 and 10. The executioner's own reference (stage-execute.md E3) already says "Do NOT update stage here," so this aligns the executioner agent with its own reference file.

## Execution Log

### 2026-04-15 09:00 - Execution started
**Status:** In progress
**Steps:** 0/25 complete

### 2026-04-15 09:30 - Step 1: Update task.md Step 10 VERIFIED path stage
**Files:**
- `skills/do/task.md` - Changed VERIFIED path frontmatter update from `stage: verification`, `stages.verification: in_progress` to `stage: verified` only

**Status:** Complete

### 2026-04-15 09:31 - Step 2: Replace task.md Step 11 with inline UAT flow
**Files:**
- `skills/do/task.md` - Replaced agent spawn (do-executioner for stage-verify.md) with inline UAT + accept/revise + context-estimation flow (V5-V6 logic inlined)

**Status:** Complete

### 2026-04-15 09:32 - Step 3: Update task.md Step 12 completion display
**Files:**
- `skills/do/task.md` - Removed "Status: Verified" and UAT checklist display (now handled in Step 11); simplified to "Status: Complete"

**Status:** Complete

### 2026-04-15 09:33 - Step 4: Update continue.md Step 6 routing table
**Files:**
- `skills/do/continue.md` - Replaced `verification | any | stage-verify.md` and `verified | any | Task complete` rows with three-way legacy branch and new `verified` inline UAT row

**Status:** Complete

### 2026-04-15 09:34 - Step 5: Update continue.md post-code-review VERIFIED path
**Files:**
- `skills/do/continue.md` - Changed `stage: verification`, `stages.verification: in_progress` to `stage: verified`; updated "proceed to verification" comment to "proceed to inline UAT"

**Status:** Complete

### 2026-04-15 09:35 - Steps 6+7: Remove verification spawn, add inline UAT section
**Files:**
- `skills/do/continue.md` - Removed "Spawn do-executioner for verification" section; added "Handle UAT (verified stage)" section with full inline UAT + accept/revise + legacy FAIL path logic

**Status:** Complete

### 2026-04-15 09:36 - Step 8: Update continue.md after-revision routing comment
**Files:**
- `skills/do/continue.md` - Changed "route to verification (stage-verify.md V0–V6)" to "set stage: verified and present UAT inline"

**Status:** Complete

### 2026-04-15 09:37 - Step 9: Update do-executioner.md Step 5
**Files:**
- `agents/do-executioner.md` - Removed `stage: verification` and `stages.verification: pending` from completion frontmatter; added note that orchestrator owns stage transitions

**Status:** Complete

### 2026-04-15 09:38 - Step 10: Dual-responsibility documented
**Decisions:**
- No file changes needed — documented in approach as an explanatory step confirming that steps 9 and 1/5 together resolve the dual-write conflict

**Status:** Complete

### 2026-04-15 09:39 - Step 11: Update stage-revise.md prose overview
**Files:**
- `skills/do/references/stage-revise.md` - Changed "loaded by stage-verify.md" to "loaded by the orchestrator (task.md/continue.md)"

**Status:** Complete

### 2026-04-15 09:40 - Step 12: Update stage-revise.md RV0 cross-reference
**Files:**
- `skills/do/references/stage-revise.md` - Changed "same as stage-verify.md V6 yes path" to "set stage: complete, clear active_task — same as UAT accept path in task.md/continue.md"

**Status:** Complete

### 2026-04-15 09:41 - Step 13: Update stage-revise.md RV1 context reference
**Files:**
- `skills/do/references/stage-revise.md` - Changed "from stage-verify.md V6 context" to "from the orchestrator's UAT accept/revise flow"

**Status:** Complete

### 2026-04-15 09:42 - Step 14: Update stage-revise.md RV5 stage setting
**Files:**
- `skills/do/references/stage-revise.md` - Changed `stage: verification`, `stages.verification: in_progress` to `stage: verified`

**Status:** Complete

### 2026-04-15 09:43 - Step 15: Update stage-revise.md RV6
**Files:**
- `skills/do/references/stage-revise.md` - Replaced "Spawn do-executioner for verification" agent spawn block with inline UAT reference; removed stage-verify.md V0-V6 reference

**Status:** Complete

### 2026-04-15 09:44 - Step 16: Update stage-revise.md State Transitions table
**Files:**
- `skills/do/references/stage-revise.md` - Changed "Code review passes → verification" to "verified"; "Verification passes, user accepts" to "UAT accepted"; updated revision rejection row wording

**Status:** Complete

### 2026-04-15 09:45 - Step 17: Update task-template.md frontmatter
**Files:**
- `skills/do/references/task-template.md` - Removed `verification: pending` from stages; updated valid stages comment to remove `verification`, keep `verified`

**Status:** Complete

### 2026-04-15 09:46 - Step 18: Update task-template.md Verification Results guidance comment
**Files:**
- `skills/do/references/task-template.md` - Replaced V0-V6 output format description (Approach Checklist, Quality Checks, Result: PASS|FAIL) with code-reviewer UAT checklist format description

**Status:** Complete

### 2026-04-15 09:47 - Step 19: Update resume-preamble.md R0.5 table
**Files:**
- `skills/do/references/resume-preamble.md` - Removed `verification` row from resume summary table

**Status:** Complete

### 2026-04-15 09:48 - Step 20: Update resume-preamble.md stage field description
**Files:**
- `skills/do/references/resume-preamble.md` - Changed "(refinement, execution, verification, etc.)" to "(refinement, execution, verified, etc.)"

**Status:** Complete

### 2026-04-15 09:49 - Step 21: Update task.md orchestrator overview
**Files:**
- `skills/do/task.md` - Changed "5 agents... planning, review, execution, and verification" to "agents... planning, review, execution, and code review with UAT"

**Status:** Complete

### 2026-04-15 09:50 - Step 22: Update codex/continue.md routing table
**Files:**
- `codex/continue.md` - Removed `verification | any | stage-verify.md` and `verified | any | stage-verify.md` rows; replaced with `verified` inline UAT row and three-way legacy `verification` fallback

**Status:** Complete

### 2026-04-15 09:51 - Step 23: Update codex/continue.md loader block
**Files:**
- `codex/continue.md` - Removed `stage-verify.md` from the list of stage reference files to load; added note that `verified` stage uses inline UAT

**Status:** Complete

### 2026-04-15 09:52 - Step 24: Delete stage-verify.md
**Files:**
- `skills/do/references/stage-verify.md` - DELETED (grep confirmed zero remaining cross-references before deletion)

**Decisions:**
- Ran final grep for `stage-verify` across all .md files — only match was the file itself

**Status:** Complete

### 2026-04-15 09:53 - Step 25: Update this task file's frontmatter
**Files:**
- `.do/tasks/260415-remove-the-redundant-execution.md` - Updated stage to `verified`; set execution: complete; removed verification: pending (was already absent from this task)

**Status:** Complete

### 2026-04-15 09:54 - Execution complete
**Status:** Complete
**Summary:**
- Steps completed: 25/25
- Files modified: 9 (task.md, continue.md, do-executioner.md, stage-revise.md, task-template.md, resume-preamble.md, codex/continue.md, this task file)
- Files deleted: 1 (stage-verify.md)
- Deviations: 1 minor (Steps 6+7 combined into single edit for atomicity)
- Quality: N/A (markdown skill files, no lint/typecheck/test applicable)

### 2026-04-15 10:30 - Code review fix: Add UAT flow to codex/continue.md
**Files:**
- `codex/continue.md` - Added "Step 5: Handle UAT (verified stage)" section after Step 4 loader block; covers UAT.1 display, UAT.2 accept/revise, UAT.3 context estimation, FAIL legacy path, and empty Verification Results path — equivalent to the `skills/do/continue.md` "Handle UAT" section

**Decisions:**
- Used `~/.codex/commands/do/references/stage-revise.md` path (Codex reference path convention) for the revision flow pointer
- Condensed context estimation to prose rather than copy-pasting the JavaScript snippet, keeping the Codex file lightweight

**Status:** Complete

### 2026-04-15 10:31 - Code review fix: Update task.md line 461 stale text
**Files:**
- `skills/do/task.md` line 461 - Changed "Continue to Step 11 (verification)." to "Continue to Step 11 (UAT Confirmation)."

**Status:** Complete

### 2026-04-15 - Code review fix (Issue 1): Gate UAT.2 on "yes" response in task.md and continue.md
**Files:**
- `skills/do/task.md` - Changed "Step 11.2: Accept/revise decision" heading to "Step 11.2: Accept/revise decision (if UAT.1 answer was \"yes\")"
- `skills/do/continue.md` - Changed "Step UAT.2: Accept/revise decision" heading to "Step UAT.2: Accept/revise decision (if UAT.1 answer was \"yes\")"

**Decisions:**
- Used exact wording from codex/continue.md which already had the correct "(if UAT.1 answer was \"yes\")" qualifier
- Only heading text changed; body and "If response at UAT.1 was no" branch already correctly positioned after

**Status:** Complete

### 2026-04-15 - Code review fix (Issue 2): Remove unimplemented UAT response persistence (Option A)
**Files:**
- `skills/do/references/task-template.md` - Removed "User response: [pending|yes|no]" and "[If no] Reason:" lines from Verification Results guidance comment
- `skills/do/references/resume-preamble.md` - Replaced "Last UAT status, or 'Awaiting UAT confirmation'" with "Awaiting UAT confirmation (UAT is handled inline — no persisted state needed)"

**Decisions:**
- Option A chosen: simpler, avoids adding write steps to three separate handler files
- The UAT result is already unambiguous from stage value: `stage: complete` means accepted, `stage: verified` means still awaiting

**Status:** Complete

## Revisions

## Council Review

### Plan Review
- **Reviewer:** codex
- **Verdict:** CONCERNS
- **Self-Review:** CONCERNS
- **Combined:** ITERATE
- **Findings:**
  - Codex: Plan jumps to `stage: complete` immediately after code review (task plan lines 91-97), but the system uses `verified` as the persisted "awaiting UAT" state (stage-verify.md:224-255, resume-preamble.md:106-113). `/do:continue` has no `complete` routing path for unfinished UAT (continue.md:107-118), so a pause between "show checklist" and "user accepts/revises" would lose the resume point.
  - Codex: Cleanup scope under-specified — `codex/continue.md` hardcodes `stage-verify.md` in its reference loader (codex/continue.md:57-65), and `stage-revise.md` still references `stage-verify.md`'s completion path (lines 8, 43-46, 144-166).
  - Self: Stage collision — setting `stage: complete` before UAT acceptance breaks resume semantics.
  - Self: Back-compat fallback underspecified — needs to distinguish tasks paused with empty Verification Results vs. populated.
  - Self: Dual-responsibility (executioner sets `stage: verification` AND orchestrator task.md Step 10 sets it) needs to be explicit in the plan.
  - Self: `stage-complete.md` introduces a new pattern (orchestrator loading reference file inline). Either justify or inline directly.
  - Self: User intent — "stop after code-reviewer" is being interpreted as "move UAT inline, don't literally stop." Should be flagged in plan.
  - Self: RV0 in stage-revise.md cross-references `stage-verify.md V6 yes path` — orphaned after deletion.
- **Recommendations:**
  - Use `verified` as the intermediate "awaiting UAT" state. Only set `stage: complete` after user accepts.
  - Refine back-compat: tasks paused with empty Verification Results need V0-V4 (or equivalent); populated → skip to UAT.
  - Make dual-responsibility explicit: do-executioner removes its `stage: verification` line AND orchestrator task.md Step 10 stops writing it.
  - Update RV0 and all stage-verify.md cross-references in stage-revise.md and codex/continue.md loader.
  - Either justify the inline-reference pattern for stage-complete.md or inline the UAT flow directly into task.md/continue.md.
  - Add a brief Clarification entry explaining the user-intent interpretation.

## Review Iterations

### Iteration 1
- **Self-review:** CONCERNS — 7 findings
- **Council:** CONCERNS — 2 findings (codex)
- **Changes made:** Revised plan to address all 6 consolidated findings: (1) use `stage: verified` as intermediate state, only `complete` after UAT accept; (2) expanded file checklist for all stage-verify.md references including codex loader and stage-revise.md prose/RV0; (3) made dual-responsibility explicit with separate approach steps for executioner vs orchestrator; (4) refined back-compat to distinguish empty vs populated Verification Results; (5) dropped stage-complete.md in favor of inlining UAT directly into task.md/continue.md with design rationale; (6) added Clarification entry for user intent interpretation.

### Iteration 2
- **Self-review:** PASS — all 6 findings genuinely addressed; line refs spot-checked accurate; back-compat noted as feasible. One non-blocking note: cold-diff edge case for re-spawning code-reviewer.
- **Council:** CONCERNS — 2 new findings (codex):
  1. Legacy fallback branches only on "Verification Results populated," but stage-verify.md V4 writes results with `### Result: FAIL` while task remains `stage: verification`. A failed verification is not safe to jump to UAT. Should branch on `Result: PASS` vs `FAIL` instead.
  2. Cleanup missed two non-routing references: `skills/do/task.md:22` (orchestrator overview mentions verification stage) and `skills/do/references/task-template.md:188` (Verification Results section guidance).
- **Changes made:**
  - (a) **Back-compat fallback refined to three-way branch** based on Verification Results content, not just populated/empty. Added `### Result: FAIL` detection branch that preserves the failure path (presents failure to user, offers fix/revise options) instead of auto-skipping to UAT. Updated routing table in Approach Step 4, codex routing in Step 22, and the "Back-compat strategy" section. The three branches are now: PASS/UAT-checklist -> treat as verified; FAIL -> preserve failure path; empty -> re-spawn code-reviewer.
  - (b) **Added two new approach steps for missed references:** Step 21 updates `skills/do/task.md:22` orchestrator overview wording. Step 18 (expanded) updates `skills/do/references/task-template.md:188` Verification Results guidance comment to describe code-reviewer output instead of V0-V6 output.
  - (c) **Additional references found via grep:** `stage-revise.md:52` (RV1 references "stage-verify.md V6 context") was missed -- added as new Step 13. `resume-preamble.md:25` (stage field description lists "verification") was missed -- added as new Step 20. Debug-related references (`debug-template.md`, `stage-debug.md`, `do-debugger.md`) use "verification" in the context of bug-fix verification, not the task pipeline stage -- these are unrelated and do NOT need changes. `README.md:17` uses "verification" generically ("Quality gates: Planning, verification, and debugging") -- marketing language, not instructional, no change needed.
  - (d) **Renumbered approach steps** from 20 to 25 due to inserted steps (old steps 17-21 are now 17-25). Updated cross-references within the approach.
  - (e) **Confidence score adjusted** from 0.80 to 0.82 -- scope factor unchanged (still many files), but complexity improved (+0.02) because the back-compat logic is now well-defined with clear branching rules.

### Iteration 3
- **Self-review:** PASS — both council findings from iteration 2 fully resolved (three-way branch in Approach Step 4 + back-compat strategy; Step 21 + expanded Step 18 cover missed refs; grep adds Step 13 and Step 20). No new issues.
- **Council:** LOOKS_GOOD (codex) — confirms three-way branching matches stage-verify.md V4 PASS/FAIL behavior; executioner/code-reviewer dual-responsibility correctly accounted for. Recommendation: keep legacy FAIL branch aligned with current V4.3 semantics — offer "new `/do:task`" or "manual fix then `/do:continue`," NOT the post-UAT revision loop.
- **Combined:** APPROVED

## Verification Results

### UAT Checklist

1. [ ] `skills/do/task.md` Step 10 VERIFIED path sets `stage: verified` (not `stage: verification`) in the frontmatter update — confirm at line ~447
2. [ ] `skills/do/task.md` Step 11 is titled "UAT Confirmation" and contains inline UAT flow (no `Agent` spawn for do-executioner)
3. [ ] `skills/do/task.md` Step 11 sets `stage: complete` only after "If option 1 (accept)" — not before
4. [ ] `skills/do/continue.md` routing table has exactly 3 rows for legacy `verification` stage (PASS/UAT, FAIL, empty) plus a `verified` row
5. [ ] `skills/do/continue.md` post-code-review VERIFIED path sets `stage: verified` (not `stage: verification`)
6. [ ] `skills/do/continue.md` has no "Spawn do-executioner for verification" section
7. [ ] `skills/do/continue.md` legacy FAIL path offers: (1) `/do:task "Fix: ..."`, (2) fix manually then `/do:continue` — NOT the post-UAT revision loop
8. [ ] `agents/do-executioner.md` Step 5 does NOT set `stage` or `stages.verification` in its frontmatter update
9. [ ] `codex/continue.md` routing table has `verified` inline UAT row + 3 legacy `verification` rows
10. [ ] `codex/continue.md` loader block (Step 4) does NOT reference `stage-verify.md`; has note that `verified` stage uses inline UAT
11. [ ] `skills/do/references/stage-verify.md` is deleted (file does not exist)
12. [ ] Zero `stage-verify.md` or `stages.verification` references remain in any non-deleted file
13. [ ] `skills/do/references/stage-revise.md` has no `stage-verify.md` references; RV5 sets `stage: verified`; RV6 delegates to orchestrator inline UAT
14. [ ] `skills/do/references/task-template.md` stages block does NOT include `verification: pending`; valid stages comment lists `verified` not `verification`
15. [ ] `skills/do/references/resume-preamble.md` stage field description lists `verified` not `verification`; R0.5 table has no `verification` row
16. [ ] `skills/do/task.md` overview (line ~22) references "code review with UAT" not "verification"
17. [ ] `codex/continue.md` Step 5 "Handle UAT" covers all 3 legacy `verification` branches: PASS path leads to UAT flow, FAIL path has its own block, empty path re-spawns code-reviewer
18. [ ] `skills/do/task.md` line 461 comment reads "Continue to Step 11 (UAT Confirmation)." — not "verification"

### Code Review (Iteration 2)
- **Fix 1:** `codex/continue.md` — Step 5 "Handle UAT (verified stage)" added with UAT.1/UAT.2/UAT.3, legacy FAIL block, and empty path re-spawn instruction. Confirmed present and covers all 3 legacy branches.
- **Fix 2:** `skills/do/task.md` line 461 — Updated from "Continue to Step 11 (verification)." to "Continue to Step 11 (UAT Confirmation)." Confirmed present.
- **UAT flow alignment:** `codex/continue.md` Step 5 matches `skills/do/continue.md` "Handle UAT" in all behavioral branches. Codex version uses condensed prose for context estimation rather than a JavaScript snippet (intentional per execution log decision note). The >= 80% handoff prompt template is omitted from Codex version — acceptable given Codex convention of lightweight prose, not a behavioral defect.

### Code Review (Iteration 3)
- **Fix 1 (task.md + continue.md UAT.2 heading):** `skills/do/task.md` line 537 heading reads "Step 11.2: Accept/revise decision (if UAT.1 answer was \"yes\")". `skills/do/continue.md` line 506 heading reads "Step UAT.2: Accept/revise decision (if UAT.1 answer was \"yes\")". `codex/continue.md` line 89 already had the qualifier — all three files now consistent. Confirmed.
- **Fix 2 (task-template.md):** `User response: [pending|yes|no]` and `[If no] Reason:` lines absent from `skills/do/references/task-template.md` Verification Results guidance comment. Grep confirms zero matches. Confirmed.
- **Fix 3 (resume-preamble.md):** Line 111 reads `| verified | "Awaiting UAT confirmation" (UAT is handled inline — no persisted state needed) |`. No "Last UAT status" text remains. Confirmed.
- **Verdict:** APPROVED — all three iteration 3 fixes correctly applied. No remaining stale references to `stage-verify.md` in source files (`.yalc/` cache copy is expected and non-functional). All acceptance criteria from the problem statement satisfied.
