---
id: 260416-fix-task-continue-review-gaps
created: 2026-04-16T00:00:00.000Z
updated: 2026-04-16T00:00:00.000Z
description: Fix 5 gaps in task.md and continue.md found during skill-creator review
stage: complete
stages:
  refinement: skipped
  grilling: skipped
  execution: complete
  verification: skipped
  abandoned: false
council_review_ran:
  plan: skipped
  code: true
fast_path: true
confidence:
  score: null
  factors:
    context: null
    scope: null
    complexity: null
    familiarity: null
---

# Fix task.md and continue.md Review Gaps

## Problem Statement

A skill-creator review of task.md identified 5 gaps: the ITERATE outcome wording in Step 6 overstates autonomy, Step 10 is missing ITERATE entirely, Step 4 doesn't clarify that unreplaced template placeholders are left for do-planner, Step 2 doesn't say how to actually abandon an active task, and continue.md has the same ITERATE omission in both its plan review and code review result blocks.

## Context Loaded

- `skills/do/task.md` — Steps 2, 4, 6, 10 (all change targets)
- `skills/do/continue.md` — plan review and code review result blocks (change targets)

## Approach

1. `task.md` Step 6 — tighten ITERATE wording from "automatically" to "follow its PR-5 steps, which will re-spawn do-planner and reviewers (up to 3x)"
2. `task.md` Step 10 — add ITERATE bullet: "stage-code-review.md owns this loop — follow its CR-5 steps, which will re-spawn do-executioner and reviewers (up to 3x). Do NOT fix code issues manually."
3. `task.md` Step 4 — add after the 3 placeholder replacements: "Leave all other `{{PLACEHOLDER}}` fields as-is — do-planner fills them in Step 5."
4. `task.md` Step 2 — add concrete abandon instruction: `node ~/.claude/commands/do/scripts/task-abandon.cjs abandon <filename>`
5. `continue.md` — add ITERATE to both plan review result block and code review result block with matching wording

## Execution Log

### 2026-04-16 00:00 - Execution started
**Status:** In progress
**Steps:** 0/5 complete

### 2026-04-16 00:01 - Step 1: task.md Step 6 — tighten ITERATE wording
**Files:**
- `skills/do/task.md` — Replaced "it re-spawns do-planner and reviewers automatically" with "follow its PR-5 steps, which will re-spawn do-planner and reviewers"

**Status:** Complete

### 2026-04-16 00:01 - Step 2: task.md Step 10 — add ITERATE bullet
**Files:**
- `skills/do/task.md` — Added ITERATE bullet to code review result block: "stage-code-review.md owns this loop — follow its CR-5 steps, which will re-spawn do-executioner and reviewers (up to 3x). Do NOT fix code issues manually."

**Status:** Complete

### 2026-04-16 00:01 - Step 3: task.md Step 4 — add placeholder clarification
**Files:**
- `skills/do/task.md` — Added "Leave all other `{{PLACEHOLDER}}` fields as-is — do-planner fills them in Step 5." after the Write line

**Status:** Complete

### 2026-04-16 00:01 - Step 4: task.md Step 2 — add concrete abandon instruction
**Files:**
- `skills/do/task.md` — Added `node ~/.claude/commands/do/scripts/task-abandon.cjs abandon <filename>` to the abandon option

**Status:** Complete

### 2026-04-16 00:01 - Step 5: continue.md — add ITERATE to plan review and code review result blocks
**Files:**
- `skills/do/continue.md` — Added ITERATE bullet to plan review result block
- `skills/do/continue.md` — Added ITERATE bullet to code review result block

**Status:** Complete

### 2026-04-16 00:01 - Execution complete
**Status:** Complete
**Summary:**
- Steps completed: 5/5
- Files modified: 2 (task.md x4 edits, continue.md x2 edits) — git diff shows 10+ files but extras (check-database-entry.cjs, task-abandon.cjs, do-council-reviewer.md, package.json, etc.) are pre-existing uncommitted changes from earlier tasks in the same session, not from this task
- Deviations: 0

### 2026-04-16 - Code review: CHANGES_REQUESTED (session ended before fix)

Code reviewer flagged two issues. Both are addressable — session hit context limit before executioner could run.

**Issue 1 (minor — documentation):** Execution log said "Files modified: 3" but git diff shows 10+ files. The extra files (check-database-entry.cjs, task-abandon.cjs, do-council-reviewer.md, package.json, etc.) are pre-existing uncommitted changes from earlier tasks in the same session — NOT from this task. Fix: add a scope note to the log line.

**Issue 2 (backlog — not this task's scope):** check-database-entry.cjs (100-byte empty detection) and task-abandon.cjs (deep-clone fix) lack test coverage. These were changed in earlier tasks. Fix: add two backlog items to .do/BACKLOG.md, IDs: `test-check-database-entry-empty` and `test-task-abandon-deep-clone`.

**Next session: run `/do:continue` — it will route to code review re-run after the above fixes are applied.**

### 2026-04-16 - Code review (re-run): APPROVED

Both CHANGES_REQUESTED fixes confirmed applied. All 6 criteria pass. Task marked complete.

## Council Review

## Verification Results
