---
id: 260423-planner-max-turns
created: "2026-04-23T08:11:49.000Z"
updated: "2026-04-23T08:17:01.617Z"
description: "Bump do-planner maxTurns from 30 to 45"
related: []
stage: complete
stages:
  refinement: skipped
  grilling: skipped
  execution: complete
  verification: skipped
  abandoned: false
fast_path: true
council_review_ran:
  plan: skipped
  code: true
confidence:
  score: {{CONFIDENCE_SCORE}}
  factors: null
  context: {{CONTEXT_FACTOR}}
  scope: {{SCOPE_FACTOR}}
  complexity: {{COMPLEXITY_FACTOR}}
  familiarity: {{FAMILIARITY_FACTOR}}
backlog_item: planner-max-turns
---

# Bump do-planner maxTurns from 30 to 45

## Problem Statement

On complex tasks that require reading many source files (e.g., 18 files for an offer flow validation task), the do-planner exhausts its 30-turn budget during context loading and analysis, leaving the Approach and Concerns sections unfilled. The orchestrator then has to spawn a second planner run to complete the plan, wasting tokens and time.

**Proposed Fix:** Increase `maxTurns` in `agents/do-planner.md` from 30 to 45. The planner's job is inherently read-heavy for complex tasks — capping reads would hurt plan quality more than the extra turn budget costs.

<!--
Per D-01: Comprehensive problem statement for session resumption.
Include: symptoms, impact, related context, any prior attempts.
This section should have enough detail that /do:continue can
fully understand the task without additional context.
-->

## Delivery Contract

<!--
Populated by entry commands (e.g., /jira:start) or the onboarding flow.
The executioner reads ONLY this section for branch, commit, and push rules.

If empty, the executioner follows project defaults from project.md
(only when the user explicitly dismissed the onboarding flow).
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

- `agents/do-planner.md:8` — target file, `maxTurns: 30`
- No internal docs matched task keywords.

## Approach

1. Open `agents/do-planner.md` and locate the `maxTurns` setting
2. Change `maxTurns` from 30 to 45
3. Verify no other references to the old value exist in the file

## Concerns

{{CONCERNS}}

<!--
Potential issues, uncertainties, or risks identified during refinement.
Format:
- Concern 1: description and potential mitigation
- Concern 2: description and potential mitigation

If no concerns, note: "None identified."
-->

## Execution Log

### 2026-04-23 08:15 - Execution started
**Status:** In progress
**Steps:** 0/3 complete

### 2026-04-23 08:15 - Step 1: Locate maxTurns setting in agents/do-planner.md
**Files:**
- `agents/do-planner.md:8` — confirmed `maxTurns: 30` at line 8

**Status:** Complete

### 2026-04-23 08:15 - Step 2: Change maxTurns from 30 to 45
**Files:**
- `agents/do-planner.md` — changed `maxTurns: 30` to `maxTurns: 45` at line 8

**Status:** Complete

### 2026-04-23 08:15 - Step 3: Verify no other references to old value
**Decisions:**
- Ran grep for `maxTurns: 30` in file — no matches found
- Confirmed `maxTurns: 45` is the only occurrence

**Status:** Complete

### 2026-04-23 08:15 - Execution complete
**Status:** Complete

**Summary:**
- Steps completed: 3/3
- Files modified: 1
- Deviations: 0

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

<!--
This section is populated during the verification phase.

Entry format:
### Approach Checklist
- [x] Step 1 from Approach section
- [x] Step 2 from Approach section
- [ ] Step 3 (INCOMPLETE: reason why)

### Quality Checks
- **Lint:** PASS|FAIL (npm run <script>)
- **Types:** PASS|FAIL (npm run <script>)
- **Tests:** PASS|FAIL (npm run <script>)
  [If FAIL, truncated output below]

### Result: PASS|FAIL
- Checklist: X/Y complete
- Quality: X/Y passing
- Blocking issue: <if any>

### UAT
[When Result is PASS]
Generated checklist:
1. [ ] User-observable behavior 1
2. [ ] User-observable behavior 2

User response: [pending|yes|no]
[If no] Reason: <what user reported>
-->
