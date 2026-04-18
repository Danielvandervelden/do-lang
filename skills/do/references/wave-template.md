---
project_schema_version: 1
project_slug: {{PROJECT_SLUG}}
phase_slug: {{PHASE_SLUG}}
wave_slug: {{WAVE_SLUG}}
title: "{{TITLE}}"
created: {{CREATED_AT}}
updated: {{CREATED_AT}}
status: planning
scope: in_scope
pre_abandon_status: null
backlog_item: null
parent_project: {{PROJECT_SLUG}}
parent_phase: {{PHASE_SLUG}}
stage: refinement
stages:
  refinement: pending
  grilling: pending
  execution: pending
  verification: pending
  abandoned: false
council_review_ran:
  plan: false
  code: false
confidence:
  score: null
  factors:
    context: null
    scope: null
    complexity: null
    familiarity: null
modified_files: []
unresolved_concerns: []
discovered_followups: []
wave_summary: null
---

# {{TITLE}}

## Problem Statement

{{PROBLEM_STATEMENT}}

<!--
Per D-01: Comprehensive problem statement for session resumption.
Include: symptoms, impact, related context, any prior attempts.
This section should have enough detail that /do:project resume can
fully understand the wave without additional context.
-->

## Approach

{{APPROACH}}

<!--
Proposed solution and implementation steps.
Include: proposed solution, files to modify, key decisions.
-->

## Concerns

{{CONCERNS}}

<!--
Potential issues, uncertainties, or risks identified during refinement.
Format:
- Concern 1: description and potential mitigation
-->

## Execution Log

<!--
Populated during implementation (do-executioner writes here).

Entry format:
### YYYY-MM-DD HH:MM
**Files:**
- `path/to/file.ts` - Change summary

**Decisions:**
- Plan said X — chose approach Y because Z

**Status:** In progress / Execution complete
-->

## Verification Results

<!--
Populated during verification (do-verifier writes here).

### Approach Checklist
- [x] Step 1 from Approach section
- [ ] Step 2 (INCOMPLETE: reason)

### Quality Checks
- **Lint:** PASS|FAIL
- **Tests:** PASS|FAIL

### Result: PASS|FAIL
-->

## Clarifications

<!--
Populated by do-griller during per-wave confidence rescue when confidence is below threshold.
Format:
### Q1: <question>
<answer>
-->

## Review Notes

<!--
Populated by do-plan-reviewer and do-code-reviewer.
-->

## Council Review

<!--
Populated by council review stages.

### Plan Review
- **Reviewer:** <advisor name>
- **Verdict:** LOOKS_GOOD | CONCERNS | RETHINK

### Code Review
- **Reviewer:** <advisor name>
- **Verdict:** APPROVED | NITPICKS_ONLY | CHANGES_REQUESTED
-->
