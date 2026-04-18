---
project_schema_version: 1
project_slug: {{PROJECT_SLUG}}
phase_slug: {{PHASE_SLUG}}
title: "{{TITLE}}"
created: {{CREATED_AT}}
updated: {{CREATED_AT}}
status: planning
scope: in_scope
active_wave: null
pre_abandon_status: null
backlog_item: null
council_review_ran:
  plan: false
confidence:
  score: null
  factors:
    context: null
    scope: null
    complexity: null
    familiarity: null
waves: []
entry_context:
  - path: project.md
  - path: phase.md
exit_summary: null
---

# {{TITLE}}

## Goal

{{GOAL}}

<!--
What does this phase accomplish? One paragraph.
Populated during phase-plan review (stage-phase-plan-review.md).
-->

## Entry Criteria

{{ENTRY_CRITERIA}}

<!--
What must be true before this phase can start?
Format: bullet list of verifiable conditions.
-->

## Exit Criteria

{{EXIT_CRITERIA}}

<!--
What must be true for this phase to be considered complete?
Format: bullet list of verifiable outcomes.
-->

## Wave Plan

{{WAVE_PLAN}}

<!--
Ordered list of waves in this phase:
- Wave 01 — <slug>: <one-line goal>
- Wave 02 — <slug>: <one-line goal>
-->

## Concerns

{{CONCERNS}}

<!--
Potential blockers, unknowns, or risks specific to this phase.
Format: numbered list with mitigation notes.
-->

## Review Notes

<!--
Populated by do-plan-reviewer and do-council-reviewer during phase-plan review.
-->

## Exit Summary

<!--
Populated at phase completion (stage-phase-exit.md renders this via handoff.md).
One paragraph: what shipped, what was deferred, handoff to next phase.
-->
