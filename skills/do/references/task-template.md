---
id: {{TASK_ID}}
created: {{CREATED_AT}}
updated: {{CREATED_AT}}
description: "{{DESCRIPTION}}"
related: []

# Stage tracking (linear by default)
# Valid stages: refinement, grilling, execution, verification, verified, complete, abandoned
# Note: 'verified' is intermediate state between verification pass and UAT approval
# Note: 'abandoned' is set when user abandons task via /do:task or /do:abandon
# When abandoned, 'pre_abandon_stage' preserves the previous stage for resume capability
# Abandoned tasks remain in .do/tasks/ and can be resumed via /do:continue --task <file>
stage: refinement
stages:
  refinement: in_progress
  grilling: pending
  execution: pending
  verification: pending
  abandoned: false  # Set to true when task is abandoned
                    # When abandoned, the in-progress stage entry is also set to 'abandoned'
                    # for state consistency (e.g., execution: abandoned)

# pre_abandon_stage: null  # Set to previous stage when task is abandoned (e.g., "execution")
                           # Used by /do:continue --task to restore the task to its prior state

# fast_path: true          # Optional. Set by /do:fast and /do:task fast-path router.
                           # Signals /do:continue to use fast-path routing (single code-reviewer,
                           # no plan review, no do-verifier).

# quick_path: true         # Optional. Set only when a /do:quick run escalates (two council
                           # CHANGES_REQUESTED rounds). Requires fast_path: true also present.
                           # Signals /do:continue Step 6 to run the full code-review stack
                           # (council + do-code-reviewer in parallel) rather than the single-
                           # reviewer fast round. /do:continue flips council_review_ran.code
                           # from true to false before invoking stage-code-review.md so the
                           # CR-0 guard does not skip the review.

# Council review tracking (prevents re-running on resume)
council_review_ran:
  plan: false
  code: false

# Confidence calculation (per D-04, D-05)
confidence:
  score: {{CONFIDENCE_SCORE}}
  factors:
    context: {{CONTEXT_FACTOR}}
    scope: {{SCOPE_FACTOR}}
    complexity: {{COMPLEXITY_FACTOR}}
    familiarity: {{FAMILIARITY_FACTOR}}

# Backlog item this task was started from (set by /do:backlog start)
backlog_item: null

# Wave breakdown (only added when user confirms complex task - per D-03)
# waves:
#   - name: <wave-name>
#     description: "<wave-description>"
#     status: pending
---

# {{TITLE}}

## Problem Statement

{{PROBLEM_STATEMENT}}

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

{{CONTEXT_LOADED}}

<!--
List of documentation files loaded via keyword matching.
Format:
- \`path/to/component.md\` - reason matched
- \`path/to/tech-pattern.md\` - reason matched

If no internal docs matched, note: "No internal docs matched task keywords."
-->

## Approach

{{APPROACH}}

<!--
Refine agent's analysis of how to solve this task.
Include: proposed solution, implementation steps, files to modify.
-->

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
