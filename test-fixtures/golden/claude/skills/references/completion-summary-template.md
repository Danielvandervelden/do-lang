# Completion Summary — {{PROJECT_SLUG}}

<!-- This template is consumed by Task β's stage-project-complete.md. -->
<!-- Template owned by Task α; rendering flow owned by Task β. -->
<!-- Reference: orchestrator §12, §14 L858. -->

**Project:** {{PROJECT_SLUG}}
**Completed:** {{COMPLETED_AT}}
**Phases:** {{PHASE_COUNT_COMPLETED}} completed, {{PHASE_COUNT_DEFERRED}} deferred (out-of-scope)

---

## Completed Phases

{{COMPLETED_PHASES}}

<!--
List of all phases that completed (status: completed, scope: in_scope):
Format:
- **Phase {{SLUG}}** — {{PHASE_TITLE}}
  - Waves shipped: {{WAVE_COUNT}}
  - Key deliverables: {{KEY_DELIVERABLES}}
  - Exit summary: {{EXIT_SUMMARY}}
-->

## Deferred (Out-of-Scope)

{{DEFERRED_ITEMS}}

<!--
All phases and waves that were marked out_of_scope during the project.
These represent deferred work, not failures.

Format:
- **Phase {{SLUG}}** (out_of_scope) — {{REASON}}
  - Waves deferred: {{WAVE_COUNT}}
-->

## Success Criteria Status

{{SUCCESS_CRITERIA_STATUS}}

<!--
From project.md ## Success Criteria — was each criterion met?
Format:
- [x] Criterion 1 — met
- [x] Criterion 2 — met
- [ ] Criterion 3 — deferred (reason)
-->

## Final File Set

{{FINAL_FILE_SET}}

<!--
Canonical list of all files modified across all waves of this project.
Source: union of all modified_files[] across all completed waves.
Format: bullet list of repo-relative paths, grouped by phase.
-->

## Residual Open Decisions

{{RESIDUAL_OPEN_DECISIONS}}

<!--
Unresolved concerns that carry forward after project completion.
Source: unresolved_concerns arrays from all waves.
Format:
- Decision: <description>
  Severity: info|warning|blocking
  Suggested follow-up: <action>

If none: "No residual open decisions."
-->
