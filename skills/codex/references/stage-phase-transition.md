# Stage: Phase Transition

Handles the post-completion transition after a phase's state has been mutated (status=completed, pointers cleared, backlog cleaned). Called with `<active_project>`, `<completed_phase_slug>`, `<models>`, and `<project_intake_threshold>` as in-session variables.

## PT-1: Render Handoff Artefact

Invoke `@references/stage-phase-exit.md` with `<active_project>` and `<completed_phase_slug>`. Use the slug passed in — `active_phase` has already been cleared by the caller, so re-reading it would return null. This stage is read-only (all state transitions are done).

## PT-2: Find Next Phase

```bash
node ~/.codex/skills/do/scripts/project-state.cjs check next-planning-phase --project <active_project>
```

- If `found: false` (terminal): do NOT auto-complete — user runs `/do:project complete`. Skip to PT-4.
- If `found: true`: do NOT write `active_phase` here. That pointer is single-owner in `stage-phase-plan-review.md` and is written only after the next phase's plan review approves. This preserves the planning gate.

## PT-3: Per-Phase Re-Grill (Pass 3)

Only if a next phase was found in PT-2.

Read the next phase's `phase.md` confidence score. If below `project_intake_threshold`, spawn `codex-griller` (pass the project threshold explicitly — `codex-griller`'s default is task-safe):

Spawn the codex-griller subagent with model `<models.overrides.griller || models.default>` and the description "Per-phase re-grill (Pass 3)". Pass the following prompt:

Phase confidence is below threshold. Ask clarifying questions.
Target file: .do/projects/<active_project>/phases/<next_phase_slug>/phase.md
Current confidence: <score>
Threshold: <project_intake_threshold>
Ask targeted questions for lowest-scoring factors. Stop when threshold reached, 10 questions asked, or user overrides.

After re-grill (or immediately if at threshold), invoke `@references/stage-phase-plan-review.md` for the next phase.

## PT-4: Print Handoff Result

Read `handoff.md`:
- Non-terminal: print the `## Next Phase Entry Prompt` block, suggest `/clear` + fresh session.
- Terminal: print the `## Project Completion Hint` line.
