---
id: 260419-griller-ask-all-at-once
created: 2026-04-19T08:31:17.000Z
updated: '2026-04-19T08:54:59.282Z'
description: do-griller — ask all questions upfront + include project root in spawn prompts
related: []
stage: complete
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
  score: 0.9
  factors:
    context: -0.0
    scope: -0.05
    complexity: -0.05
    familiarity: -0.0
backlog_item: griller-ask-all-at-once
---

# do-griller — ask all questions upfront + include project root in spawn prompts

## Problem Statement

**Part 1: Batch questions instead of one-at-a-time** — `do-griller` currently asks one question per spawn — the orchestrator relays Q1, the user answers, the orchestrator re-spawns the griller for Q2, etc. Each round costs ~16k tokens and ~40s. For 3 questions that's ~48k tokens and ~2 minutes wasted in back-and-forth.

**Part 2: Missing project root in spawn prompt** — `do-griller` was observed running `find /Users/globalorange -name "260416-do-backlog-skill.md"` because it didn't know where to find the task file. The orchestrator passes `Task file: .do/tasks/<filename>` (relative path) without a project root, so the griller can't resolve it and falls back to a filesystem search.

**Proposed Fix (Part 1):** `agents/do-griller.md` `<grilling_philosophy>` explicitly says "**One question at a time.**" — change this to "**Ask all questions at once.**" and update Step 3 (`Ask Questions`) to present all questions in a single numbered list. The user answers all in one message. If answers raise new questions, ask all new questions in the next spawn (again, all at once). Never present one question and wait — always batch everything you have.

**Proposed Fix (Part 2):** Two changes: (1) All griller spawn prompts in `task.md`, `continue.md`, and any reference files must include `Project root: <cwd>` alongside the task file path. (2) Add an instruction to `agents/do-griller.md` to always read the task file using the path provided — never search for it with `find`.

<!--
Per D-01: Comprehensive problem statement for session resumption.
Include: symptoms, impact, related context, any prior attempts.
This section should have enough detail that /do:continue can
fully understand the task without additional context.
-->

## Clarifications

<!--
Populated by grill-me flow when confidence < threshold.
Format:

### <Factor> (was: <old_value> -> now: <new_value>)
**Q:** <question asked>
**A:** <user's answer>

If user overrides before reaching threshold:
"User override at confidence <score>"
-->

## Context Loaded

- `database/projects/do/project.md` -- project overview, key directories, conventions, tech stack
- `agents/do-griller.md` -- primary target: the griller agent definition with `<grilling_philosophy>`, step 3 "one at a time" instruction, and `<user_interaction>` formatting
- `skills/do/task.md` (lines 220-250) -- griller spawn prompt in `/do:task` Step 7 (passes `Task file:` without project root)
- `skills/do/continue.md` (lines 210-222) -- griller spawn prompt in `/do:continue` (passes `Task file:` without project root, also missing confidence/threshold)
- `skills/do/references/stage-grill.md` -- inline grill-me flow used by `/do:continue` when stage is refinement; uses `AskUserQuestion` inline, not Agent spawn (no project root needed here, but philosophy alignment needed)
- `skills/do/project.md` (lines 164-177, 241-253) -- per-phase re-grill and per-wave confidence rescue spawn prompts (use `Target file:` with relative paths, no project root)
- `skills/do/references/stage-project-intake.md` (lines 60-161) -- PI-2 and PI-5 griller spawn prompts for project intake passes (use `Target file:`, no project root)
- `.do/BACKLOG.md` (lines 5-21) -- original backlog entries for both items

## Approach

### Part 1: Batch all questions (agents/do-griller.md)

1. **Update `<grilling_philosophy>` section** in `agents/do-griller.md` (line 33). Change `**One question at a time.** Each answer updates confidence. Stop when threshold is reached.` to `**Ask all questions at once.** Present every question you have in a single numbered list. The user answers all in one message. If answers raise new questions, batch all follow-ups into the next round. Never present one question and wait.` Also add a caller-override rule: `**Caller precedence:** When the spawn prompt includes structured question instructions (e.g., a numbered question bank with "ask in order, one at a time"), follow the caller's instructions on presentation order. The batch-all default applies only to confidence-gap grilling where the griller generates its own questions.`
   - File: `agents/do-griller.md`
   - Expected outcome: Philosophy section reflects batch-all approach with caller-override escape hatch

2. **Update Step 3 (Ask Questions)** in `agents/do-griller.md` (lines 87-98). Currently says "Present questions one at a time. After each answer:" -- rewrite to present all questions as a numbered list in a single message. After receiving the combined answer, process all answers at once: update each factor, log each Q&A pair to Clarifications, recalculate confidence once at the end.
   - File: `agents/do-griller.md`
   - Expected outcome: Step 3 instructs batch presentation and batch processing

3. **Update `<user_interaction>` section** in `agents/do-griller.md` (lines 120-148). The "Presenting Questions" example shows `### Question 1 of ~3` with a single question -- rewrite to show a multi-question format. Change the header to show all questions at once (e.g., `### Questions (3 total)`). Update "Handling Responses" to describe parsing a multi-answer response.
   - File: `agents/do-griller.md`
   - Expected outcome: User interaction template matches batch approach

4. **Update Step 4 (Check Threshold)** in `agents/do-griller.md` (lines 104-117). Currently says "After each answer, check if confidence >= threshold." Rewrite to: "After processing all answers in the batch, check if confidence >= threshold." Change threshold check from per-answer to per-round (one check after the full batch is processed).
   - File: `agents/do-griller.md`
   - Expected outcome: Threshold check is per-round, not per-answer

5. **Update `<success_criteria>` section** in `agents/do-griller.md` (lines 185-194). Change `Each question asked and answered (or skipped)` to `All questions presented in batch and answers processed`. Change `Confidence updated after each answer` to `Confidence updated after processing all answers in a round`.
   - File: `agents/do-griller.md`
   - Expected outcome: Success criteria reflect batch semantics

6. **Update `<completion>` section** in `agents/do-griller.md` (lines 152-176). The summary format already works for batch -- just verify the "Questions asked: <count>" still makes sense when all are asked at once. No change expected unless wording implies sequential.
   - File: `agents/do-griller.md`
   - Expected outcome: Completion summary is compatible with batch flow

7. **Update `stage-grill.md` inline flow** in `skills/do/references/stage-grill.md`. Steps G2-G6 currently loop one question at a time (G2: find weakest factor, G3: generate one question, G4-G5: process one answer, G6: check threshold or loop). Rewrite to: G2: identify all factors with significant deductions, G3: generate questions for all of them, G4: present all questions at once and wait for combined answer, G5: process all answers and update all factors (apply per-answer boost formula to each Q&A pair independently, not to combined text), G6: check threshold -- if still below, generate follow-up questions for remaining gaps (again all at once).
   - File: `skills/do/references/stage-grill.md`
   - Expected outcome: Inline grill-me flow matches batch philosophy

8. **Update griller spawn prompt in `task.md`** (line 239-247). Currently says "Update confidence after each answer" and "Stop when threshold reached or user overrides." Change to "Present all questions at once. After receiving combined answer, update confidence for each Q&A pair. Check threshold after processing the full batch. If below threshold, batch any follow-up questions into the next round." This aligns the spawn instructions with the batch philosophy.
   - File: `skills/do/task.md`
   - Expected outcome: task.md spawn prompt no longer implies sequential processing

### Part 2: Include project root in spawn prompts

**Convention note:** Existing Agent spawn prompts do NOT use `<cwd>` as a runtime-substituted placeholder. The `<cwd>` notation in `stage-plan-review.md` and `stage-code-review.md` is a descriptive path reference in human-readable instructions, not an angle-bracket template variable like `<active_task>`. All existing spawn prompts pass file paths as relative paths from CWD (e.g., `Task file: .do/tasks/<active_task>`). The spawned agent inherits the parent's working directory, which IS the project root. The actual bug was that the griller didn't know to use CWD-relative paths and instead ran `find` to search the filesystem. The fix is two-fold: (a) add an explicit instruction to `do-griller.md` to resolve paths relative to CWD, and (b) enrich sparse spawn prompts so the griller has enough context to avoid searching.

9. **Add path resolution instruction to `agents/do-griller.md`** in the `<role>` section (lines 9-17). After the "Read the target file provided in the prompt" instruction, add: "The file paths in the spawn prompt (e.g., `Task file: .do/tasks/...` or `Target file: .do/projects/...`) are relative to the working directory (the project root). Read them directly -- never search for files with `find` or `locate`."
    - File: `agents/do-griller.md`
    - Expected outcome: Griller agent resolves paths from CWD, never searches

10. **Enrich griller spawn in `continue.md`** (line 217-221). The current spawn is too sparse (only `Task file:`, no confidence or threshold). Add `Current confidence: <score>` and `Threshold: <threshold>` lines to match the task.md spawn prompt. This gives the griller the context it needs without inventing new placeholder conventions.
    - File: `skills/do/continue.md`
    - Expected outcome: continue.md griller spawn matches task.md richness

11. **Skip adding `Project root:` to intake spawn prompts** (`stage-project-intake.md` PI-2 and PI-5). These already pass `Target file: <project_path>` where `<project_path>` is documented as an absolute path in the caller contract (line 10: "The caller provides `<project_path>` = abs path to `project.md`"). Adding a redundant `Project root:` line is unnecessary. No change needed.
    - File: `skills/do/references/stage-project-intake.md`
    - Expected outcome: No change -- intake spawn prompts already have absolute paths

12. **Skip adding `Project root:` to `project.md` re-grill and rescue spawns** (lines 171-176 and 247-252). These pass `Target file:` with relative paths, which will work correctly once Step 9 adds the CWD-resolution instruction to the griller agent. The paths follow the same `<active_project>` placeholder convention as other spawn prompts. No new placeholder needed.
    - File: `skills/do/project.md`
    - Expected outcome: No change -- CWD instruction in griller agent covers these

## Concerns

- **Concern 1: stage-grill.md confidence-boost formula assumes single-answer processing.** Steps G4-G5 calculate a boost per answer with caps (+0.10 max per answer). When processing multiple answers at once, we need to apply the formula per Q&A pair independently, not to the combined text. Mitigation: Step 7 explicitly specifies that the per-answer boost formula is applied to each Q&A pair independently within the batch.

- **Concern 2: Intake one-at-a-time requirement conflicts with batch default.** Line 76 of `stage-project-intake.md` says "ask in order, one at a time" for the 10-question bank. This is a deliberate design choice -- intake questions build on earlier answers. Mitigation: Step 1 adds a caller-override rule to `<grilling_philosophy>`: when the spawn prompt includes structured question instructions (numbered question bank with explicit ordering), the griller follows the caller's instructions rather than the batch default. This means intake flows continue working as designed while confidence-gap grilling gets the batch improvement.

- **Concern 3: User answer parsing for batched questions.** When users answer multiple questions in one message, the answers may not be clearly delimited. Mitigation: In the updated Step 3 (Approach Step 2), instruct the griller to ask users to number their answers to match the question numbers. If answers are ambiguous, use best-effort mapping and ask follow-up clarifications only for truly unclear answers.

- **Concern 4 (resolved): `<cwd>` placeholder was unverified.** Investigation confirmed `<cwd>` is NOT used as a runtime-substituted variable in Agent spawn prompts anywhere in the codebase. The existing occurrences in `stage-plan-review.md` and `stage-code-review.md` are descriptive path references in instruction text, not template variables. Resolution: Part 2 was redesigned (Steps 9-12) to avoid inventing a new placeholder convention. Instead, the fix adds a CWD-resolution instruction directly to `do-griller.md` and enriches sparse spawn prompts with existing placeholder patterns (`<score>`, `<threshold>`).

## Execution Log

### 2026-04-19 09:00 - Execution started
**Status:** In progress
**Steps:** 0/12 complete

### 2026-04-19 09:05 - Steps 1-8 complete (Part 1: Batch questions)
**Files:**
- `agents/do-griller.md` - Updated `<grilling_philosophy>` to batch-all with caller-override escape hatch (Step 1)
- `agents/do-griller.md` - Rewrote Step 3 to present all questions at once and process answers in batch (Step 2)
- `agents/do-griller.md` - Rewrote `<user_interaction>` Presenting Questions to show multi-question format, updated Handling Responses for combined answer parsing (Step 3)
- `agents/do-griller.md` - Updated Step 4 threshold check from per-answer to per-round (Step 4)
- `agents/do-griller.md` - Updated `<success_criteria>` to batch semantics (Step 5)
- `agents/do-griller.md` - Step 6 verified: `<completion>` section compatible with batch flow, no change needed
- `skills/do/references/stage-grill.md` - Rewrote G2-G6 to identify all factors, batch all questions, process all answers independently, check threshold once per round (Step 7)
- `skills/do/task.md` - Updated spawn prompt instructions from sequential to batch semantics (Step 8)

**Decisions:**
- Step 6 required no changes: "Questions asked: `<count>`" counts total across all rounds, compatible with batch approach
- Applied per-Q&A-pair boost formula explicitly in stage-grill.md G5 per Concern 1 mitigation

**Status:** Steps 1-8 complete

### 2026-04-19 09:10 - Steps 9-12 complete (Part 2: Path resolution)
**Files:**
- `agents/do-griller.md` - Added CWD-relative path resolution instruction to `<role>` section; never use find/locate (Step 9)
- `skills/do/continue.md` - Enriched griller spawn prompt with `Current confidence: <score>` and `Threshold: <threshold>` lines (Step 10)

**Decisions:**
- Steps 11 and 12 are no-ops by plan design: intake spawns already use absolute paths, project.md spawns are covered by Step 9's CWD instruction

**Status:** Steps 9-12 complete

### 2026-04-19 09:12 - Execution complete
**Status:** Complete

**Summary:**
- Steps completed: 10/12 (steps 11 and 12 are intentional no-ops per plan)
- Files modified: 4 (`agents/do-griller.md`, `skills/do/references/stage-grill.md`, `skills/do/task.md`, `skills/do/continue.md`)
- Deviations: 0

### 2026-04-19 09:30 - Code review fixes
**Files:**
- `skills/do/continue.md` - Added explicit `auto_grill_threshold` read from `.do/config.json` (default 0.9) before the griller spawn block so `<threshold>` is always populated (Must Fix #1)
- `agents/do-griller.md` - Updated Step 4 explanatory text to reflect that all current callers (`/do:task`, `/do:continue`, `/do:project`) now pass `Threshold:` explicitly; fallback is now described as an unexpected-legacy-path guard only (Should Fix #2)

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
- [x] Step 1: Updated `<grilling_philosophy>` to "Ask all questions at once" with caller-override escape hatch (`agents/do-griller.md`)
- [x] Step 2: Rewrote Step 3 (Ask Questions) to present all questions in a single numbered list and process answers in batch (`agents/do-griller.md`)
- [x] Step 3: Rewrote `<user_interaction>` Presenting Questions to multi-question format (`### Questions (3 total)`), updated Handling Responses for combined answer parsing (`agents/do-griller.md`)
- [x] Step 4: Updated Step 4 threshold check to "After processing all answers in the batch" — per-round, not per-answer (`agents/do-griller.md`)
- [x] Step 5: Updated `<success_criteria>` to batch semantics ("All questions presented in batch", "Confidence updated after processing all answers in a round") (`agents/do-griller.md`)
- [x] Step 6: Verified `<completion>` section compatible with batch flow — no change needed (`agents/do-griller.md`)
- [x] Step 7: Rewrote G2-G6 in `stage-grill.md` — identifies all factors, batches all questions, processes answers per-pair independently, checks threshold once per round (`skills/do/references/stage-grill.md`)
- [x] Step 8: Updated griller spawn prompt in `task.md` to batch semantics — "Present all questions at once. After receiving combined answer, update confidence for each Q&A pair independently..." (`skills/do/task.md`)
- [x] Step 9: Added CWD-relative path resolution instruction to `<role>` section — never use find/locate (`agents/do-griller.md`)
- [x] Step 10: Enriched griller spawn in `continue.md` with config read for threshold and `Current confidence: <score>` / `Threshold: <threshold>` lines (`skills/do/continue.md`)
- [x] Step 11: Intentional no-op — intake spawn prompts already use absolute paths (`skills/do/references/stage-project-intake.md`)
- [x] Step 12: Intentional no-op — CWD instruction in griller agent covers project.md spawns (`skills/do/project.md`)

### Quality Checks
- **Tests:** PASS (npm run test) — 542 tests, 0 failures

### Result: PASS
- Checklist: 12/12 complete (2 intentional no-ops)
- Quality: 1/1 passing
