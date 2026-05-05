# Handoff — {{PHASE_SLUG}}

<!-- Rendered by stage-phase-exit.md (Task γ) at phase completion. -->
<!-- Template owned by Task α; rendering flow owned by Task γ (stage-phase-exit.md). -->

## What Shipped

{{WHAT_SHIPPED}}

<!--
One-paragraph summary of what this phase delivered.
Source: wave_summary fields from completed waves in this phase.
Format: prose summary of key deliverables.
-->

## What Remains

{{WHAT_REMAINS}}

<!--
Deferred items from this phase that were not completed:
- Out-of-scope waves (scope: out_of_scope) — reason they were deferred
- Incomplete in-scope items (if any — should be empty on clean phase complete)
-->

## Open Decisions

{{OPEN_DECISIONS}}

<!--
Unresolved architectural / product decisions that carry forward to the next phase.
Source: unresolved_concerns arrays from waves in this phase.
Format:
- Decision: <description>
  Severity: info|warning|blocking
  Context: <brief context>
-->

## Files of Record

{{FILES_OF_RECORD}}

<!--
Canonical list of files modified in this phase.
Source: modified_files arrays from all waves in this phase (union, deduplicated).
Format: bullet list of repo-relative paths.
-->

## Next Phase Entry Prompt

{{NEXT_PHASE_ENTRY_PROMPT}}

<!--
CONDITIONAL: Rendered only when a next in-scope phase exists after this one.
On terminal phase, this section is replaced by "## Project Completion Hint".

Copy-paste-ready prompt for starting a fresh session on the next phase:

"Resume /do:project. Active project: {{PROJECT_SLUG}}. Phase {{NEXT_PHASE_SLUG}} is now active.
Read project.md, phases/{{NEXT_PHASE_SLUG}}/phase.md, and this handoff.md in that order.
Then continue from the phase plan."
-->

<!--
## Project Completion Hint

<!-- ALTERNATIVE to "Next Phase Entry Prompt" — rendered only on the FINAL phase. -->
<!-- "This was the final phase. Run `/do:project complete` to finalise the project." -->
-->
