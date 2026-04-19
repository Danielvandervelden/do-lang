---
id: 260419-fast-entry-declaration
created: 2026-04-19T09:06:30.000Z
updated: '2026-04-19T09:28:43.060Z'
description: '/do:fast — replace 8-item criteria checklist with a declaration'
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
  score: 0.97
  factors:
    context: -0.0
    scope: -0.0
    complexity: -0.03
    familiarity: -0.0
backlog_item: fast-entry-declaration
---

# /do:fast — replace 8-item criteria checklist with a declaration

## Problem Statement

`fast.md` Step 3 presents an 8-checkbox "entry criteria check" to the user before every fast-path task. This adds friction to what is supposed to be the quick path — anyone invoking `/do:fast "fix typo"` already knows it qualifies. The routing logic in `do.md` already filters tasks toward `/do:fast` only when they're clearly trivial; the checklist is a second gate on top of a gate that already ran.

**Impact:** The fast path feels slower than it should for genuinely simple tasks. Users who are already familiar with the criteria still see the full checklist every time.

**Proposed Fix:** Replace the interactive 8-item checklist with a concise declaration in the skill description (e.g., "Fast-path is for tasks touching 1-3 files with no schema/auth/API changes. If you're unsure, use `/do:task`."), then just ask a single confirmation: "This looks like a fast-path task — proceed? [Y/n]". If the user hesitates, redirect to `/do:task`. The criteria don't need to be enumerated every run — they should live in the skill header/description as permanent context.

**Scope:** `skills/do/fast.md` Step 3 only. Single-file change.

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

- `database/projects/do/project.md` - project overview, conventions, directory layout
- `skills/do/fast.md` - the target file; read in full to understand current Step 3 and surrounding structure
- `skills/do/references/stage-fast-exec.md` - caller contract that follows Step 3; confirms Step 3's output is just "entry criteria confirmed"
- `skills/do/do.md` - routing note confirming `/do:fast` is an explicit skip of the smart router
- `skills/do/task.md` (Step 0 excerpt) - smart router heuristic; confirms the router already gates tasks before they reach `/do:fast`
- `.do/config.json` - project config (council reviews, model overrides)
- No external library docs needed (internal skill file change only)

## Approach

1. **Move the 8 criteria into the skill description / "Entry Criteria" section header area.** The criteria list already lives in lines 40-49 of `fast.md` under "## Entry Criteria" (above the steps). This section is permanent context that the LLM reads every invocation. The criteria are therefore already declared as permanent knowledge -- they do not need repeating in Step 3. No change needed to lines 40-55 (the Entry Criteria section and auto-escalation note are already good).

2. **Rewrite Step 3 ("Validate Entry Criteria") in `skills/do/fast.md`.** Replace lines 82-102 (the current interactive 8-checkbox checklist block and confirmation) with:
   - A brief sentence referencing the Entry Criteria section above ("The entry criteria are listed above -- the task must meet all of them.")
   - A single concise confirmation prompt: `This looks like a fast-path task. Proceed? [Y/n]`
   - If the user says no or expresses doubt, redirect to `/do:task "description"` and stop (same behavior as today).

3. **Preserve the Step 3b model config read** (lines 104-113). This step is unrelated and must remain untouched.

4. **Verify that the "Entry Criteria" section (lines 39-55) already serves as the permanent declaration.** Confirm the auto-escalation note remains intact. No edits needed to this section -- it already does its job as a declaration.

**Target file:** `skills/do/fast.md`
**Lines modified:** Approximately lines 82-102 (Step 3 body only)

## Concerns

- **Concern 1: Loss of explicit user awareness of criteria.** Users who invoke `/do:fast` directly (bypassing the `/do:task` router) will no longer see the full checklist interactively. **Mitigation:** The criteria remain in the "Entry Criteria" section of the skill file, which the LLM reads every invocation. The LLM still knows the criteria and will auto-escalate mid-execution if any criterion stops holding (the auto-escalation note in lines 53-56 is preserved). The single Y/n confirmation gives the user a pause point.

- **Concern 2: Wording must be concise but clear enough.** The replacement prompt must communicate that the user is affirming the entry criteria without being so terse that it loses meaning. **Mitigation:** The prompt references the Entry Criteria section explicitly so anyone reading the conversation can scroll up. Approach step 2 specifies the exact wording.

## Execution Log

### 2026-04-19 10:00 - Execution started
**Status:** In progress
**Steps:** 0/4 complete

### 2026-04-19 10:00 - Step 1: Verify Entry Criteria section (lines 39-55) is already a permanent declaration
**Files:**
- `skills/do/fast.md` - Read and confirmed: lines 38-57 contain "## Entry Criteria" with all 8 criteria listed plus auto-escalation note. No changes needed.

**Decisions:**
- Section already serves as a permanent declaration. Plan step 1 confirmed as no-op.

**Status:** Complete

### 2026-04-19 10:01 - Step 2: Rewrite Step 3 ("Validate Entry Criteria") in fast.md
**Files:**
- `skills/do/fast.md` - Replaced lines 82-102 (8-checkbox interactive checklist + confirmation block) with a brief reference sentence and a single Y/n prompt.

**Decisions:**
- Kept the redirect instruction ("If user says no or expresses doubt, redirect to `/do:task "description"` and stop.") verbatim — same behavior as before.
- Wording references the Entry Criteria section explicitly per approach step 2.

**Status:** Complete

### 2026-04-19 10:01 - Step 3: Verify Step 3b (model config read, lines 104-113) is untouched
**Files:**
- `skills/do/fast.md` - Confirmed Step 3b block is preserved intact.

**Status:** Complete

### 2026-04-19 10:01 - Step 4: Verify Entry Criteria section auto-escalation note intact
**Files:**
- `skills/do/fast.md` - Confirmed lines 53-56 auto-escalation note is untouched.

**Status:** Complete

### 2026-04-19 10:02 - Execution complete
**Status:** Complete

**Summary:**
- Files modified: 1 (`skills/do/fast.md`)
- Decisions made: 2
- Deviations: none

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
- [x] Step 1: Verify Entry Criteria section (lines 39-55) already serves as a permanent declaration — confirmed as no-op
- [x] Step 2: Rewrite Step 3 in `skills/do/fast.md` — replaced 8-checkbox interactive checklist with a single reference sentence and Y/n prompt
- [x] Step 3: Verify Step 3b model config read is preserved intact
- [x] Step 4: Verify Entry Criteria section auto-escalation note remains intact

### Quality Checks
- **Tests:** PASS (npm run test) — 542 tests, 0 failures

### Result: PASS
- Checklist: 4/4 complete
- Quality: 1/1 passing

### UAT
Generated checklist:
1. [ ] Invoking `/do:fast` reaches Step 3 and shows the single Y/n prompt (not the 8-item checklist)
2. [ ] The Entry Criteria section (above Step 1) still lists all 8 criteria as permanent context
3. [ ] Answering "n" or expressing doubt at the Y/n prompt redirects to `/do:task "description"` and stops
4. [ ] Step 3b (model config read) still executes after the Y/n confirmation
5. [ ] The auto-escalation note in the Entry Criteria section is still present and intact

User response: pending
