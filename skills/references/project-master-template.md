---
project_schema_version: 1
slug: {{SLUG}}
id: {{SLUG}}
title: "{{TITLE}}"
created: {{CREATED_AT}}
updated: {{CREATED_AT}}
kind: greenfield
status: intake
active_phase: null
pre_abandon_status: null
database_entry: null
tech_stack: []
repo_path: null
confidence:
  score: null
  factors:
    context: null
    scope: null
    complexity: null
    familiarity: null
council_review_ran:
  project_plan: false
  phase_plans: {}
  code: {}
phases: []
---

# {{TITLE}}

## Vision

{{VISION}}

<!--
One-paragraph vision statement. What is this project at its core?
Who benefits, and how? Written during intake (Pass 1 Q1).
-->

## Target Users

{{TARGET_USERS}}

<!--
Who will use this? Personas, roles, technical level.
-->

## Non-Goals

{{NON_GOALS}}

<!--
What this project explicitly will NOT do. Scope guard.
-->

## Success Criteria

{{SUCCESS_CRITERIA}}

<!--
Measurable outcomes that define "done" for the project.
Format: numbered list of testable/observable criteria.
-->

## Constraints

{{CONSTRAINTS}}

<!--
Hard constraints: timeline, budget, tech stack, team size, compatibility.
-->

## Risks

{{RISKS}}

<!--
Top risks and mitigations. Format:
- Risk: <description>
  Likelihood: low|medium|high
  Impact: low|medium|high
  Mitigation: <approach>
-->

## Phase Plan

{{PHASE_PLAN}}

<!--
High-level phase breakdown decided during intake.
Format:
- Phase 01 — <slug>: <one-line goal>
- Phase 02 — <slug>: <one-line goal>
-->

## Clarifications

<!--
Populated by <<DO:AGENT_PREFIX>>-griller during intake (Pass 1 + Pass 2 Q&A) and per-phase re-grill.
Format:
### Q1: <question>
<answer>
-->

## Changelog Pointer

See `changelog.md` in this project folder for the full history of state transitions and scaffold events.
