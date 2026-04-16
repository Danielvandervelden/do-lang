---
id: 260416-fix-orchestrator-reliability
created: 2026-04-16T00:00:00.000Z
updated: 2026-04-16T00:00:00.000Z
description: >-
  Fix two orchestrator reliability gaps: ITERATE in task.md + rogue
  do-council-reviewer
stage: complete
stages:
  refinement: skipped
  grilling: skipped
  execution: review_pending
  verification: pending
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

# Fix Orchestrator Reliability Gaps

## Problem Statement

Two gaps cause orchestrator and council review to behave incorrectly. First, `task.md` Step 6 lists APPROVED/MAX_ITERATIONS/ESCALATE as outcomes but omits ITERATE — the most common non-passing result — which leads the orchestrator to try handling plan revisions itself instead of delegating to do-planner via stage-plan-review.md. Second, `do-council-reviewer.md` goes rogue when `council-invoke.cjs` exits non-zero: instead of returning the script-error verdict format, it generates its own inline review labeled as an external advisor.

## Context Loaded

- `skills/do/task.md` — Step 6 result-handling list (target)
- `agents/do-council-reviewer.md` — Critical rules + error handling section (target)

## Approach

1. In `skills/do/task.md` Step 6, add ITERATE to the result-handling list with an explicit note that stage-plan-review.md owns this loop and the orchestrator must not handle it manually
2. In `agents/do-council-reviewer.md`, strengthen the rogue-prevention rules: when council-invoke.cjs exits non-zero or produces unparseable output, the agent MUST return the script-error verdict verbatim — it is explicitly forbidden from generating its own review as a substitute

## Execution Log

### 2026-04-16 - Execution started
**Status:** In progress
**Steps:** 0/2 complete

### 2026-04-16 - Step 1: Add ITERATE to task.md Step 6 result-handling list
**Files:**
- `/Users/globalorange/workspace/github-projects/do/skills/do/task.md` — Added ITERATE bullet between APPROVED and MAX_ITERATIONS at line 145, with explicit note that stage-plan-review.md owns the loop and the orchestrator must not handle plan revisions manually

**Status:** Complete

### 2026-04-16 - Step 2: Strengthen rogue-prevention rules in do-council-reviewer.md
**Files:**
- `/Users/globalorange/workspace/github-projects/do/agents/do-council-reviewer.md` — Added explicit prohibition bullet to critical_rules block at line 28: NEVER generate a substitute review when the script fails; script failure always means script-error verdict

**Status:** Complete

### 2026-04-16 - Execution complete
**Status:** Complete
**Summary:**
- Steps completed: 2/2
- Files modified: 2
- Deviations: 0

## Council Review

## Verification Results
