---
id: {{TASK_ID}}
created: {{CREATED_AT}}
updated: {{CREATED_AT}}
description: "{{DESCRIPTION}}"

# Stage tracking (linear by default)
stage: refinement
stages:
  refinement: in_progress
  grilling: pending
  execution: pending
  verification: pending

# Confidence calculation (per D-04, D-05)
confidence:
  score: {{CONFIDENCE_SCORE}}
  factors:
    context: {{CONTEXT_FACTOR}}
    scope: {{SCOPE_FACTOR}}
    complexity: {{COMPLEXITY_FACTOR}}
    familiarity: {{FAMILIARITY_FACTOR}}

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

## Context Loaded

{{CONTEXT_LOADED}}

<!--
List of documentation files loaded via keyword matching.
Format:
- `path/to/component.md` - reason matched
- `path/to/tech-pattern.md` - reason matched

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
This section is populated during the implementation phase.
Each entry should include: timestamp, action taken, result.

Format:
### YYYY-MM-DD HH:MM
- Action: <what was done>
- Result: <outcome>
- Files: <files modified>
-->
