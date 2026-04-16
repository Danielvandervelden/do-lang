---
id: 260415-harden-do-code-reviewer
created: "2026-04-15T09:28:44Z"
updated: "2026-04-15T10:15:00.000Z"
description: "Harden do-code-reviewer.md to prevent premature edits and enforce parallel review spawning"
stage: complete
stages:
  refinement: complete
  grilling: pending
  execution: complete
  verification: complete
  abandoned: false
council_review_ran:
  plan: false
  code: true
confidence:
  score: 0.95
  factors: null
  context: 0.0
  scope: 0.0
  complexity: -0.05
  familiarity: 0.0
pre_abandon_stage: verification
---

# Harden do-code-reviewer Agent

## Problem Statement

In production, `do-code-reviewer` violated its own workflow in two ways:

1. **Skipped parallel spawning** — ran self-review only, never spawned council review despite `council_reviews.execution: true` in config
2. **Applied edits directly** — after getting `NITPICKS_ONLY` from self-review, the agent made code edits inline instead of (a) waiting for council and (b) routing findings to do-executioner for iteration

The root cause is insufficient enforcement in the agent's critical rules. The instructions describe the correct flow but don't explicitly prohibit the incorrect shortcuts the model took.

## Clarifications

None needed — bug is clearly observed, fix is well-scoped.

## Context Loaded

- `agents/do-code-reviewer.md` — the file being modified
- `agents/do-plan-reviewer.md` — reference for parallel spawn pattern (same structure, working correctly)

## Approach

All changes are to `agents/do-code-reviewer.md` only.

1. **Add CRITICAL rule (top of `<critical_rules>`)**: "NO EDITS OR FIXES before both review agents have returned. You are a reviewer, not an implementer. Making edits before both reviews complete is a workflow violation."

2. **Add CRITICAL rule**: "BOTH self-review and council review (when enabled) MUST be spawned in a SINGLE message with multiple Agent tool calls. Sending them in separate messages is a workflow violation."

3. **Strengthen Step 3**: Add explicit note after the spawn instructions — "Do NOT proceed to Step 4 until ALL spawned agents have returned a response."

4. **Clarify ITERATE flow in Step 5**: Make it explicit that when the combined verdict is ITERATE, the agent must spawn `do-executioner` with the combined findings — NOT apply fixes itself. Then after executioner completes, re-run Step 3 (both reviewers in parallel) for the next iteration.

No structural changes. No changes to result handling table, fallback section, or success criteria.

## Concerns

- None. This is additive text strengthening existing sections — no logic changes, no new behavior, no API changes.

## Execution Log

### 2026-04-15 09:35 - Execution started
**Status:** In progress
**Steps:** 0/4 complete

### 2026-04-15 09:36 - Steps 1 & 2: Add two CRITICAL rules at top of `<critical_rules>`
**Files:**
- `agents/do-code-reviewer.md` - Added two new bullet rules before the existing bullets in `<critical_rules>`: one prohibiting edits before both agents return, one requiring parallel spawning in a single message.

**Status:** Complete

### 2026-04-15 09:36 - Step 3: Add wait gate after Council Review Agent Prompt block
**Files:**
- `agents/do-code-reviewer.md` - Added "**Wait gate:** Do NOT proceed to Step 4 until ALL spawned agents have returned a response. Never read partial results and continue early." at the end of the Step 3 section, before `</review_flow>`.

**Status:** Complete

### 2026-04-15 09:36 - Step 4: Clarify ITERATE flow in Step 5 to route through do-executioner
**Files:**
- `agents/do-code-reviewer.md` - Replaced "Apply requested changes (use Edit tool)" with spawning do-executioner with combined findings. Removed "Re-run quality checks" step (executioner handles that). Updated iteration log template to include the action taken.

**Status:** Complete

### 2026-04-15 09:36 - Execution complete
**Status:** Complete
**Summary:**
- Steps completed: 4/4
- Files modified: 1 (agents/do-code-reviewer.md)
- Deviations: 0

## Council Review

### Code Review — 2026-04-15

**Self-Review:** APPROVED
- All 4 planned steps implemented correctly and completely
- Additive-only changes, no scope creep
- Iteration log template correctly updated to remove "fixed how" columns (executioner now owns that)

**Council (codex):** APPROVED
- Two new top-level guardrails directly address observed failure modes
- Wait gate closes "read partial results and continue early" gap
- ITERATE path correctly routes fixes through do-executioner

**Combined Verdict:** VERIFIED
**Nitpicks:** None

## Verification Results

### Approach Checklist
- [x] Add CRITICAL rule prohibiting edits before both agents return (line 24 of `agents/do-code-reviewer.md`)
- [x] Add CRITICAL rule requiring parallel spawning in a single message (line 25 of `agents/do-code-reviewer.md`)
- [x] Add wait gate at end of Step 3 before `</review_flow>` (line 121 of `agents/do-code-reviewer.md`)
- [x] Clarify ITERATE flow in Step 5 to spawn do-executioner instead of applying fixes directly (lines 169-181 of `agents/do-code-reviewer.md`)

### Quality Checks
- **Lint/Types/Tests:** N/A — markdown agent file, no package.json scripts apply
- **Code review:** PASS — both self-review and council returned APPROVED (council_review_ran.code: true)

### Result: PASS
- Checklist: 4/4 complete
- Quality: N/A (markdown file)
- All three edits confirmed present in `agents/do-code-reviewer.md`
