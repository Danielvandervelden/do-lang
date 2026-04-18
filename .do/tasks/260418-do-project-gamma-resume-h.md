---
id: 260418-do-project-gamma-resume-h
created: 2026-04-18T18:30:00.000Z
updated: 2026-04-18T20:30:00.000Z
description: >-
  Implement Task γ (project-gamma-resume-handoff) for /do:project — ship the
  resume + handoff artefact layer that sits on top of Task β's orchestration
  pipeline. Scope per orchestrator §14: /do:project resume subcommand,
  stage-project-resume.md, resume-preamble-project.md, project-resume.cjs,
  stage-phase-exit.md, cold-start UAT, /do:continue isolation verification.
related:
  - 260418-do-project-orchestrator
  - 260418-do-project-alpha-contract
  - 260418-do-project-beta-orchestration

stage: complete
stages:
  refinement: complete
  grilling: complete
  execution: complete
  verification: complete
  abandoned: false

council_review_ran:
  plan: false
  code: false

confidence:
  score: 0.82
  factors:
    context: -0.02
    scope: -0.06
    complexity: -0.08
    familiarity: -0.02

backlog_item: null
---

# Task γ — /do:project resume + handoff artefact layer

## Problem Statement

### What

Ship Task γ (project-gamma-resume-handoff) — the resume + handoff artefact layer that sits on top of Task β's orchestration pipeline. This is the final piece of the three-way α/β/γ split defined in the orchestrator design (§14 lines 918-932).

**Verbatim scope from orchestrator §14 lines 918-932:**

> **Task γ — project-resume-handoff** (slug: `project-gamma-resume-handoff`)
>
> *Scope:*
> - `/do:project resume` subcommand + `stage-project-resume.md` (§7 cold-start flow).
> - `skills/do/references/resume-preamble-project.md` — **new sibling reference** (see §1 and the full step-by-step spec in §7.5). γ's implementer follows §7.5's R0.1p–R0.6p numbered steps directly — do not re-derive by analogy to `resume-preamble.md`. Key replacements vs. the task-pipeline sibling (per §7.5): project-native structured context reads replace `load-task-context.cjs`; target-file-type stage table replaces the task-file stage enum; `changelog.md` (project scope) / wave.md Execution Log (wave scope) replaces the single task Execution Log as "last action" source; `/do:project resume` replaces `/do:continue` in stale-reference and pause prompts. Composed by `stage-project-resume.md`, invoked once per nested file in order (project.md → phase.md → wave.md). The original `resume-preamble.md` is NOT modified — it remains task-pipeline-only. Duplication accepted per O-29.
> - `skills/do/scripts/project-resume.cjs` — reads active project's state (project.md / phase.md / wave.md frontmatter in that order) and returns the next action to take (which stage reference to invoke, with what target file). `stage-project-resume.md` delegates the "what's the next action" computation to this helper rather than re-implementing it inline; the stage reference handles the routing and UX around it.
> - `stage-phase-exit.md` — **render-only** handoff artefact writer reading structured wave.md / phase.md / project.md frontmatter fields (§7 locked decision); renders `handoff.md` from `handoff-template.md`. **This file does NOT call `project-state.cjs` and does NOT mutate any frontmatter** — state transition (previous phase → `completed`, next phase → `planning` (non-terminal) or `active_phase: null` (terminal), `changelog.md` append) is owned by β's `/do:project phase complete` subcommand and runs BEFORE `stage-phase-exit.md` is invoked. γ's responsibility is strictly reader/renderer: ingest state, write `handoff.md`, return. **Terminal-phase rendering contract (per §7 step 3):** `stage-phase-exit.md` detects terminal phase by reading `project.md`'s `phases[]` array and checking whether a next in-scope entry exists after the just-completed phase. If a next phase exists, it emits `## Next Phase Entry Prompt` with the copy-paste resume string. If no next phase exists, it emits `## Project Completion Hint` instead — a single line: "This was the final phase. Run `/do:project complete` to finalise the project." All other `handoff.md` body sections (`## What Shipped`, `## What Remains`, `## Open Decisions`, `## Files of Record`) render identically in both cases. **Hook point:** γ wires this into β's `/do:project phase complete` routing — after β's state transition completes, β invokes `stage-phase-exit.md` as the render step. Before γ, β still runs the state transition and then prints the "Handoff artefact pending (Task γ)" stub in place of the render step.
> - Cold-start UAT script — the acceptance test from O-10: "fresh session + `/clear` + `/do:project resume` succeeds without re-interviewing the user."
> - Verification that `/do:continue` does NOT route to project state (confirms isolation per §10).
>
> *Dependencies:* Task β (orchestration pipeline must exist for resume to route into it).
>
> *Hard-prerequisite relationship:* γ is a hard prerequisite for both `/do:project phase complete` producing its handoff artefact (β prints the "Handoff artefact pending" stub without γ) AND for `/do:project complete` running end-to-end (§12 reads each phase's `handoff.md`, which only exists after γ's `stage-phase-exit.md` has run at each phase boundary). Without γ, β's `/do:project complete` blocks with "Complete requires phase handoff artefacts (Task γ)."
>
> *Rationale for isolation:* the cold-start resume path is the architectural guarantee called out in the problem statement. Keeping it in its own task gives it focused council review and a dedicated UAT gate. If γ fails review, β is still landable on its own as a "hot-session-only" orchestration (minus `/do:project complete`, which depends on γ's handoff artefacts).

### Why

- β is shipped but incomplete at two critical points: (1) `/do:project phase complete` prints "Handoff artefact pending (Task γ)" instead of rendering `handoff.md`, and (2) `/do:project complete` blocks with "Complete requires phase handoff artefacts (Task γ)" because `stage-project-complete.md` PC-2 checks for `handoff.md` files that don't yet exist.
- The cold-start resume path (`/do:project resume`) is the architectural guarantee that makes multi-session projects viable. Without it, `/do:project` only works in hot sessions — any context clear or session break loses the user's place.
- The isolation verification (confirming `/do:continue` does NOT route to project state) is the formal proof that the full-split architecture from orchestrator §10 holds end-to-end.

### Acceptance criteria

1. `skills/do/project.md` `resume` subcommand is fully implemented (replaces the current "Not yet implemented" stub at ~line 393).
2. `skills/do/references/stage-project-resume.md` exists and implements §7 cold-start flow steps 1-8 (reads config, reads project/phase/wave state, branches on `active_phase`, composes `resume-preamble-project.md` per target file, shows unified resume summary, routes to correct stage reference).
3. `skills/do/references/resume-preamble-project.md` exists and implements §7.5 steps R0.1p-R0.6p verbatim (load target-file markdown, detect context state, project-native context reload, handle stale references with changelog logging, display target-file-type-keyed resume summary, wave-scope mid-execution progress check).
4. `skills/do/scripts/project-resume.cjs` exists and returns structured JSON: `{ action: "<stage-reference-name>", target_file: "<path>", target_type: "<project|phase|wave>", summary: "<human-readable>" }`. Handles all branching: normal in-progress, terminal-pre-complete, blocked (project/phase/wave), intake, planning states. No `abandoned` branch (unreachable — see C-5).
5. `skills/do/references/stage-phase-exit.md` exists and renders `handoff.md` from `handoff-template.md` using structured frontmatter reads only (no state mutation, no `project-state.cjs` calls). Terminal-phase rendering contract: emits `## Project Completion Hint` instead of `## Next Phase Entry Prompt` when no next in-scope phase exists. Includes backlog-promotion reminder when any `discovered_followups[]` entry has `promote == backlog`.
6. β's `/do:project phase complete` (in `skills/do/project.md` ~line 134) is updated to invoke `stage-phase-exit.md` as the render step, replacing the "Handoff artefact pending (Task γ)" stub message.
7. Cold-start UAT: a fresh session with `/clear` followed by `/do:project resume` succeeds without re-interviewing the user — lands on the correct stage with state loaded from disk.
8. `/do:continue` does NOT route to project state — it continues to handle `.do/tasks/` only. Verified by inspection of `skills/do/continue.md` confirming no `active_project` / `.do/projects/` reads.
9. The original `resume-preamble.md` is NOT modified — it remains task-pipeline-only.

## Clarifications

<!--
Populated by grill-me flow when confidence < threshold.
-->

## Context Loaded

- `database/projects/do/project.md` — project context for do-lang repo (tech stack, conventions, directory structure)
- `.do/tasks/260418-do-project-orchestrator.md` §7 (lines 445-488) — cold-start handoff and resume flow spec
- `.do/tasks/260418-do-project-orchestrator.md` §7.5 (lines 491-656) — full R0.1p-R0.6p step-by-step spec for `resume-preamble-project.md`
- `.do/tasks/260418-do-project-orchestrator.md` §10 (lines 729-753) — isolation model: `/do:project` does not touch `.do/tasks/` or `active_task`
- `.do/tasks/260418-do-project-orchestrator.md` §12 (lines 776-798) — completion/archival flow including γ dependency on handoff.md
- `.do/tasks/260418-do-project-orchestrator.md` §14 (lines 918-932) — γ's verbatim scope definition
- `skills/do/references/resume-preamble.md` — task-pipeline sibling pattern (R0.1-R0.6) that γ parallels but does NOT modify
- `skills/do/references/handoff-template.md` — α's template consumed by `stage-phase-exit.md` for rendering `handoff.md`
- `skills/do/project.md` — β's shipped skill file with resume stub (~line 393) and phase complete hookpoint (~line 231)
- `skills/do/references/stage-project-complete.md` — β's completion stage (PC-2 γ-gate checks for handoff.md)
- `skills/do/continue.md` — task-pipeline resume command (isolation verification target)
- `.do/tasks/260418-do-project-beta-orchestration.md` — β's completed task (confirms shipped state; stage: complete)

## Approach

> **Execution order note:** Steps 5, 6, and 10 all modify `skills/do/project.md`. They MUST be executed in order (5 then 6 then 10) within a single editing pass to avoid merge conflicts. Step 5 touches the `phase complete` section (~lines 134-233), step 6 touches the `resume` stub (~lines 393-400) plus the usage block (~line 38) plus the `## Files` section (~line 428), and step 10 touches the `abandon` message (~line 389). No overlap between the three edit regions.

### 1. Create `skills/do/scripts/project-resume.cjs`

**File:** `skills/do/scripts/project-resume.cjs` (new)

Implements the "what's the next action" computation that `stage-project-resume.md` delegates to. Reads active project state and returns structured JSON.

**Input:** project slug (from CLI arg or read from `.do/config.json`).

**Logic (maps §7 steps 1-4 + §7 step 7's routing):**
1. Read `.do/config.json` -> `active_project`. If null, exit with error JSON.
2. Read `.do/projects/<slug>/project.md` frontmatter -> `status`, `active_phase`.
3. **Branch on project status:**
   - `blocked`: return `{ action: "project-blocked", target_file: "project.md", target_type: "project", summary: "Project is blocked — resolve the blocker and retry." }`.
   - `intake`: return `{ action: "stage-project-intake", target_file: "project.md", target_type: "project" }`.
   - `planning`: return `{ action: "stage-project-plan-review", target_file: "project.md", target_type: "project" }`.
   - `completed`: return `{ action: "already-complete", ... }`.
   - ~~`abandoned`~~: **REMOVED.** After abandon, `active_project` is cleared to null by `project-state.cjs`, so step 1 above already exits with error JSON ("No active project"). The abandoned branch is dead code. Archived-project restoration is not in gamma's scope (orchestrator §14 iteration 12 finding Q explicitly deleted `--archived <slug>` from v1). If the user wants to restore an archived project, they manually move `.do/projects/archived/<slug>/` back to `.do/projects/<slug>/`, set `active_project` in config, then run `/do:project resume` — at which point the project is no longer abandoned (statuses were restored by `restore-from-abandoned`).
4. **Branch on `active_phase` (when status is `in_progress`):**
   - `active_phase: null` — check terminal-pre-complete using the **same filesystem-walk pattern** as beta's `skills/do/project.md` line 186-205 (next-phase identification): walk the `phases/` folder, read each `phase.md` leaf file directly, sort by NN-prefixed slug (`a.slug.localeCompare(b.slug)`), filter `scope: in_scope`. Check that every in-scope phase has `status: completed`. If all completed: return `{ action: "terminal-pre-complete", target_file: "project.md", target_type: "project" }`. If any incomplete: return `{ action: "inconsistent-state", ... }` (maps to §7 step 3 branch 3). **This is the single algorithm for "are all phases done?" — PE-3 in step 4 uses the identical pattern.**
   - Non-null `active_phase`: read `phase.md` -> `status`, `active_wave`. Continue.
5. **Branch on phase status:**
   - `planning`: return `{ action: "stage-phase-plan-review", target_file: "phase.md", target_type: "phase" }`.
   - `in_progress`: read wave state. Continue.
   - `blocked`: return `{ action: "phase-blocked", target_file: "phase.md", target_type: "phase", summary: "Phase <slug> is blocked — resolve the blocker and retry." }`.
6. **Branch on `active_wave` / wave state:**
   - No active wave (`active_wave: null`): return `{ action: "wave-next-needed", ... }` (user runs `/do:project wave next`).
   - Active wave exists: read `wave.md` -> `status`, `stage`, `stages`.
   - Wave `blocked`: return `{ action: "wave-blocked", target_file: "wave.md", target_type: "wave", summary: "Wave <slug> is blocked — resolve the blocker and retry." }`.
   - Wave `planning`: return `{ action: "stage-wave-plan-review", ... }`.
   - Wave `in_progress` + stage `execution`: return `{ action: "stage-wave-exec", ... }`.
   - Wave `in_progress` + stage `verification`: return `{ action: "stage-wave-verify", ... }`.
   - Wave `in_progress` + stages.execution == `complete` or `review_pending`: return `{ action: "stage-wave-code-review", ... }`.
   - Wave `completed`: return `{ action: "wave-completed-next-needed", ... }`.
7. Return `summary` field with human-readable description for each case.
8. Include `preamble_targets` array listing which files to run resume-preamble on: `[project.md]` for terminal-pre-complete, `[project.md, phase.md]` for phase-level states, `[project.md, phase.md, wave.md]` for wave-level states.

**Tests:** Unit tests in `skills/do/scripts/__tests__/project-resume.test.cjs` covering all branches (normal, terminal-pre-complete, inconsistent state, intake, planning, each wave stage, plus all three blocked levels).

### 2. Create `skills/do/references/resume-preamble-project.md`

**File:** `skills/do/references/resume-preamble-project.md` (new)

Implements §7.5 R0.1p-R0.6p verbatim. This is the project-pipeline sibling of `resume-preamble.md`. Key structural choices:

- **R0.1p:** Parse YAML frontmatter per target-file-type table from §7.5 (project/phase/wave have different field sets). Extract body sections per type.
- **R0.2p:** Always proceed to R0.3p (same conservative heuristic as task pipeline). Note that second/third invocations are additive (project context already loaded).
- **R0.3p:** Replace `load-task-context.cjs` with project-native structured reads. For `project` type: read body sections + optional `database_entry`. For `phase` type: read `entry_context[]` paths. For `wave` type: read parent phase's `## Wave Plan`, previous phase's `handoff.md`, project's `## Constraints` and `## Risks`. Always read last 10 changelog entries.
- **R0.4p:** Stale references get the blocking prompt with the `(pointed at by <field/section>)` annotation. Changelog logging uses the qualified log-line label per target type (project/phase/wave scope prefix).
- **R0.5p:** Display resume summary using the 12-row target-file-type x status/stage table from §7.5.
- **R0.6p:** Wave-scope only, execution stage only. Parse `## Approach` steps, match against `modified_files[]` frontmatter + `## Execution Log` entries, display progress checklist. Project and phase targets skip this step (no-op).

**Caller contract section** at top of file: documents `<target-file-path>` and `<target-file-type>` inputs.

### 3. Create `skills/do/references/stage-project-resume.md`

**File:** `skills/do/references/stage-project-resume.md` (new)

Implements §7 cold-start flow. This is the orchestrating stage reference that composes `resume-preamble-project.md` and `project-resume.cjs`.

**Steps:**
1. **SPR-0:** Read `.do/config.json` -> `active_project`. If null, error: "No active project. Run `/do:project new <slug>` to start one."
2. **SPR-1:** Run `project-resume.cjs` to get the next-action JSON.
3. **SPR-2:** Handle special cases before preamble:
   - `inconsistent-state`: display diagnostic message per §7 step 3 branch 3: "Project `<slug>` is in an inconsistent state (`active_phase: null` but in-scope phases incomplete). Run `/do:init` for diagnostics." STOP.
   - `already-complete`: display "Project `<slug>` is already completed." STOP.
   - `project-blocked`: display "Project `<slug>` is blocked. Resolve the blocker and retry." STOP.
   - `error` (from project-resume.cjs): display the error message and STOP.
4. **SPR-3:** Invoke `resume-preamble-project.md` once per file in the `preamble_targets` array (project.md first, then phase.md if present, then wave.md if present). Each invocation gets `<target-file-path>` and `<target-file-type>`. If any preamble invocation STOPs (stale-ref user chose option 2), the entire resume STOPs.
5. **SPR-4:** Display unified resume summary per §7 step 6. Terminal-pre-complete gets the advisory message: "Project complete pending — all in-scope phases done. Run `/do:project complete` to finalise." Normal flow gets project stage / active phase / active wave / last changelog action.
6. **SPR-5:** Route to the appropriate stage reference per `project-resume.cjs`'s `action` field. Routing map:
   - `stage-project-intake` -> invoke `@references/stage-project-intake.md`
   - `stage-project-plan-review` -> invoke `@references/stage-project-plan-review.md`
   - `stage-phase-plan-review` -> invoke `@references/stage-phase-plan-review.md`
   - `stage-wave-plan-review` -> invoke `@references/stage-wave-plan-review.md`
   - `stage-wave-exec` -> invoke `@references/stage-wave-exec.md`
   - `stage-wave-code-review` -> invoke `@references/stage-wave-code-review.md`
   - `stage-wave-verify` -> invoke `@references/stage-wave-verify.md`
   - `wave-next-needed` -> display "No active wave. Run `/do:project wave next` to activate the next wave." STOP.
   - `wave-completed-next-needed` -> display "Active wave completed. Run `/do:project wave next` for the next wave." STOP.
   - `project-blocked` -> display "Project `<slug>` is blocked. Resolve the blocker and retry." STOP.
   - `phase-blocked` -> display "Phase `<slug>` is blocked. Resolve the blocker and retry." STOP.
   - `wave-blocked` -> display "Wave `<slug>` is blocked. Resolve the blocker and retry." STOP.
   - `terminal-pre-complete` -> advisory only (no auto-invoke of `stage-project-complete.md`). Print the advisory line from SPR-4 and return control to the user. User runs `/do:project complete` themselves.
   - Unknown action -> display "Unexpected resume action: `<action>`. Run `/do:init` for diagnostics." STOP.

### 4. Create `skills/do/references/stage-phase-exit.md`

**File:** `skills/do/references/stage-phase-exit.md` (new)

Implements the render-only handoff artefact writer per §7 steps 1-4.

**Caller contract:** Invoked by `/do:project phase complete` (β's skill) AFTER the state transition has completed. Receives `<active_project>` slug and `<completed_phase_slug>`. Does NOT call `project-state.cjs`. Does NOT mutate any frontmatter.

**Steps:**
1. **PE-1:** Read `project.md` frontmatter (slug). Read `phase.md` for the completed phase. Read each wave's `wave.md` frontmatter within the phase (walk `waves/` folder, read leaf files authoritatively per beta's pattern). Also read `changelog.md` for the project (needed by PE-2 for abandoned/blocked wave reasons).
2. **PE-2:** Collect handoff inputs from wave frontmatter:
   - `wave_summary` from each completed wave -> `## What Shipped`
   - Abandoned/blocked waves: one row per wave with its frontmatter status **+ last changelog reason** (read `changelog.md`, find the most recent entry matching `abandon:wave:<slug>` or `blocked:wave:<slug>` for each affected wave). Out-of-scope waves: one row labelled as deferred. `discovered_followups[]` with `promote == wave`: work routed to future phase -> `## What Remains`
   - `unresolved_concerns[]` grouped by severity -> `## Open Decisions`
   - Union of `modified_files[]` arrays, deduplicated + sorted, **plus `project.md` and the completed `phase.md`** -> `## Files of Record` (per orchestrator §7 step 3 line 458: "plus `project.md` and `phase.md`")
3. **PE-3:** Detect terminal phase using the **same filesystem-walk pattern** as beta's `skills/do/project.md` lines 186-205 and `project-resume.cjs` step 4. **Do NOT read `project.md`'s `phases[]` array** — it is a scaffold-seeded index not synced by `project-state.cjs` and beta's Authoritative state reads doctrine (skills/do/project.md line 41-50) says "do not use them for control-flow decisions." Terminal detection IS a control-flow decision. Algorithm:
   - Walk the `phases/` folder, read each `phase.md` leaf file directly (slug, status, scope).
   - Sort by NN-prefixed slug (`a.slug.localeCompare(b.slug)`) — this IS the ordering (phases are named `01-xxx`, `02-yyy`, etc.; lexical sort on slug reproduces scaffold order).
   - Filter `scope: in_scope`.
   - Find the first in-scope phase whose slug sorts AFTER the completed phase's slug. If found, that is the next phase (non-terminal). If none found, this is terminal.
   - **Non-terminal:** render `## Next Phase Entry Prompt` section with the copy-paste string per §7 step 3.
   - **Terminal:** replace the `## Next Phase Entry Prompt` heading and content with `## Project Completion Hint` containing: "This was the final phase. Run `/do:project complete` to finalise the project."
4. **PE-4:** If any `discovered_followups[]` entry has `promote == backlog`, append reminder line: "N follow-ups flagged for backlog promotion; run `/do:backlog add` for each."
5. **PE-5:** Read `handoff-template.md`. Slot-fill all sections. For the conditional final section: if non-terminal, fill the `## Next Phase Entry Prompt` slot and strip the commented-out `## Project Completion Hint` block from the template. If terminal, replace the `## Next Phase Entry Prompt` heading with `## Project Completion Hint`, fill it with the completion hint text, and strip the original `## Next Phase Entry Prompt` slot. Write the result to `.do/projects/<slug>/phases/<completed_phase>/handoff.md`.
6. **PE-6:** Return COMPLETE with path to the rendered `handoff.md`.

### 5. Update `/do:project phase complete` hookpoint in `skills/do/project.md`

**File:** `skills/do/project.md` (modify phase complete section, ~lines 134-233)

**Critical ordering constraint:** `stage-phase-exit.md` must run AFTER the state transition (steps 2-4) and BEFORE the next-phase re-grill + plan review (current step 6). The handoff artefact documents the JUST-COMPLETED phase; it must be written while that phase's state is fresh and before the system pivots to the next phase's planning flow.

Replace the current steps 5-7 with a reordered sequence. The new flow for the `phase complete` section after steps 1-4 (precondition check, state transition, clear active pointers, backlog cleanup) remain unchanged:

**Current step 5 (identify next phase)** becomes new step 6.
**Current step 6 (per-phase re-grill)** becomes new step 7.
**Current step 7 (stub print)** is removed entirely.

**New step 5 (insert immediately after step 4's text, which ends at line 184 with: `4. **Backlog cleanup:** read \`phase.md\` \`backlog_item\`. If non-null, invoke \`/do:backlog done <id>\`. Log: "Removed backlog item \`<id>\` from BACKLOG.md."` — the new step goes between that line and the current step 5 "Identify next phase" which starts at line 186):**
```
5. **Render handoff artefact:** invoke `@references/stage-phase-exit.md` with `<active_project>` and `<completed_phase_slug>`. This writes `handoff.md` for the just-completed phase. `stage-phase-exit.md` is read-only — all state transitions are already complete from steps 2-4.
```

**New step 6:** (unchanged content from old step 5 — identify next phase)

**New step 7:** (unchanged content from old step 6 — per-phase re-grill + plan review)

**New step 8 (replaces old step 7's stub):**
```
8. **Print handoff result:** read the rendered `handoff.md`:
   - Non-terminal phase: print the `## Next Phase Entry Prompt` block and suggest:
     "Phase `<prev>` complete. Consider `/clear` and paste the prompt above into a fresh session."
   - Terminal phase: print the `## Project Completion Hint` line.
```

This ensures: state transition (2-4) -> handoff render (5) -> next-phase identification (6) -> next-phase re-grill + plan review (7) -> user-facing handoff print (8).

### 6. Implement `/do:project resume` subcommand in `skills/do/project.md`

**File:** `skills/do/project.md` (modify ~lines 393-400)

Replace the current stub:
```
### `resume`
Not yet implemented (Task γ).
/do:project resume is not yet implemented. See Task γ (project-gamma-resume-handoff).
```

With a full implementation block:
```
### `resume`

Resume the active project from cold start. Delegates all routing to `stage-project-resume.md`.

1. Invoke `@references/stage-project-resume.md`.
   The stage reference handles: config read, state computation via `project-resume.cjs`,
   preamble loading, resume summary display, and routing to the correct stage.
2. Return whatever the stage reference returns (COMPLETE or STOP propagates to user).
```

Also update the usage block at the top (~line 38) to change `resume not yet implemented (Task γ)` to `Resume from cold start (reload context + route to active stage)`.

Also update the `## Files` section (~line 428) to add:
```
  - `@references/stage-project-resume.md` — Cold-start resume orchestrator
  - `@references/stage-phase-exit.md` — Render-only handoff artefact writer
  - `@references/resume-preamble-project.md` — Per-file context reload (project pipeline sibling)
  - `@scripts/project-resume.cjs` — State reader, returns next-action JSON for resume routing
```

### 7. Write unit tests for `project-resume.cjs`

**File:** `skills/do/scripts/__tests__/project-resume.test.cjs` (new)

Test all routing branches:
- No active project -> error
- Project status: intake -> routes to stage-project-intake
- Project status: planning -> routes to stage-project-plan-review
- Project status: blocked -> project-blocked action
- Project status: completed -> already-complete action
- In-progress with active phase, phase status: blocked -> phase-blocked action
- In-progress with active phase + active wave, wave status: blocked -> wave-blocked action
- In-progress with active phase + active wave in execution -> routes to stage-wave-exec
- In-progress with active phase + active wave in verification -> routes to stage-wave-verify
- In-progress with active phase + active wave in code review -> routes to stage-wave-code-review
- In-progress with active phase + active wave completed -> wave-completed-next-needed
- In-progress with active phase + no active wave -> wave-next-needed
- In-progress with no active phase + all phases completed (terminal-pre-complete) -> terminal-pre-complete
- In-progress with no active phase + incomplete phases (inconsistent) -> inconsistent-state
- Preamble_targets array correctness for each branch
- **Terminal-pre-complete status check walks `phases/` leaf files** (mock filesystem with phase.md files, verify it does NOT read `project.md`'s `phases[]` for status)
- **No `abandoned` branch exists** — verify that `status: abandoned` is not handled (unreachable because `active_project` is cleared on abandon)

### 8. Cold-start UAT verification

Manual UAT script (documented in Verification Results section):
1. Ensure a project exists with `active_project` set in config and at least one phase/wave in progress.
2. Open a fresh terminal / new Claude Code session.
3. Run `/clear` to ensure no prior context.
4. Run `/do:project resume`.
5. Verify: lands on the correct stage reference without asking the user any intake/grilling questions.
6. Verify: the resume summary displays correct project/phase/wave state and last action.
7. Verify: the stage-specific logic begins execution (not just a summary).

### 9. `/do:continue` isolation verification

Static inspection of `skills/do/continue.md`:
- Confirm it reads only `active_task` from `.do/config.json`.
- Confirm it reads only from `.do/tasks/`.
- Confirm no references to `active_project`, `.do/projects/`, or `/do:project resume`.
- Document findings in Verification Results.

This is already the case in the current `skills/do/continue.md` (confirmed by reading it). The verification step is documenting the proof, not making changes.

### 10. Update `skills/do/project.md` abandon message

**File:** `skills/do/project.md` (modify ~line 389)

Replace the current message that says "Re-activation (`/do:project resume`) is not yet implemented — ships in Task γ" with the actual resume instruction now that γ has shipped: "Re-activate with: move `.do/projects/archived/<slug>/` back to `.do/projects/<slug>/` and run `/do:project resume`."

## Concerns

- **C-1: Single-source filesystem walk for all phase enumeration.** Beta's Authoritative state reads doctrine (skills/do/project.md lines 41-50) says leaf files are the single source and parent indexes "must not be used for control-flow decisions (next-phase selection, precondition checks, gamma-gate, etc.)." Terminal detection and next-phase identification ARE control-flow decisions, so they MUST use the filesystem walk, not `project.md`'s `phases[]` array. Beta already solves this at lines 186-205: walk `phases/` folder, read each `phase.md` leaf file, sort by NN-prefixed slug (lexical sort reproduces scaffold order because phase slugs are `01-xxx`, `02-yyy`). **Resolution (iteration 2):** PE-3 (step 4) and project-resume.cjs step 4 now both use the identical filesystem-walk + lexical-sort pattern. The `phases[]` parent index is not read anywhere in this task for control-flow purposes. This eliminates the two-source split entirely.

- **C-2: `stage-phase-exit.md` hookpoint must run BEFORE next-phase processing.** The orchestrator spec (§7 step 5) says β invokes `stage-phase-exit.md` after the state transition and before next-phase processing. The original plan incorrectly placed the hookpoint at step 7 (after the re-grill + plan review). The handoff artefact must document the just-completed phase while its context is current, before the system pivots to next-phase planning. **Mitigation:** step 5 in the revised Approach inserts the `stage-phase-exit.md` invocation immediately after backlog cleanup (old step 4) and before next-phase identification (old step 5, now step 6). The user-facing handoff print moves to new step 8 (after next-phase processing completes). This matches the spec's ordering: state transition -> render -> next-phase processing -> user output.

- **C-3: Template conditional rendering mechanics.** `handoff-template.md` has `## Next Phase Entry Prompt` as a real section and `## Project Completion Hint` as a commented-out alternative. `stage-phase-exit.md` PE-5 handles the conditional: on non-terminal, fill the `## Next Phase Entry Prompt` slot and strip the commented-out hint block. On terminal, replace the `## Next Phase Entry Prompt` heading+content with `## Project Completion Hint` heading+content and strip the original prompt slot. The template itself is not modified (owned by alpha). **Mitigation:** PE-5 in the Approach now explicitly describes both rendering paths and how the template's commented-out block is handled.

- **C-4: Resume preamble runs 3x per resume (project + phase + wave).** Each invocation reads files, checks for stale refs, and displays a summary. This could be verbose/slow for the user. **Mitigation:** §7.5 R0.2p explicitly says second/third invocations are additive (project context already loaded). R0.5p summary is compact. The unified summary in SPR-4 aggregates everything into one display. Keep individual preamble outputs minimal.

- **C-5: Abandoned path is unreachable and removed (iteration 2).** After `project-state.cjs abandon project <slug>` runs, it cascades `status: abandoned` on all in-scope nodes, moves the project folder to `.do/projects/archived/<slug>/`, and clears `active_project` to null in `.do/config.json`. Since `project-resume.cjs` step 1 reads `active_project` and exits with error JSON when null, the `status: abandoned` branch is dead code. The orchestrator spec (§14 iteration 12 finding Q) explicitly deleted `--archived <slug>` from v1 scope and documented the manual restore procedure (move folder back + run resume). **Mitigation:** the `abandoned` branch has been removed from `project-resume.cjs` (step 1) and `stage-project-resume.md` (SPR-2). The `restore-from-abandoned` action no longer exists in gamma's routing. If archived-resume is needed later, it is a separate backlog item.

- **C-6: `stage-phase-exit.md` must NOT mutate state.** This is a hard contract from §14. The rendering step is strictly read-only: reads frontmatter, writes `handoff.md`, returns. Any state mutation (phase status, active_phase, changelog) is β's responsibility and happens BEFORE `stage-phase-exit.md` is invoked. **Mitigation:** the stage reference's caller contract explicitly documents "Does NOT call `project-state.cjs`. Does NOT mutate any frontmatter." Code review gate will verify.

- **C-7: Three edit regions in `skills/do/project.md`.** Steps 5, 6, and 10 all modify `skills/do/project.md` in different sections. Executing them out of order or in separate passes risks merge conflicts. **Mitigation:** the Approach now includes an execution order note at the top requiring all three edits in a single ordered pass (5 then 6 then 10). The three edit regions are non-overlapping: step 5 touches lines ~134-233 (phase complete), step 6 touches lines ~38 + ~393-400 + ~428-448 (usage + resume + files), step 10 touches line ~389 (abandon message).

- **C-8: The R0.5p "last action" table has 12+ status/stage combinations.** Getting every row correct requires careful transcription from §7.5. **Mitigation:** transcribe the table verbatim from the orchestrator spec (§7.5 lines 586-602) rather than re-deriving. Council review will verify completeness.

- **C-9: Cold-start UAT is manual and requires a real project state on disk.** The UAT cannot be automated in the standard test suite because it requires a Claude Code session and `/do:project resume` invocation. **Mitigation:** the UAT script is documented as a step-by-step manual checklist. The unit tests for `project-resume.cjs` cover the routing logic programmatically; the UAT covers the integration.

- **C-10: Blocked state routing completeness (iteration 2).** The R0.5p table in the orchestrator spec (§7.5, lines 592/596/601) has `blocked` rows for all three target types (project, phase, wave). The original plan only handled `phase.status=blocked` and missed project-level and wave-level blocked states entirely. **Mitigation:** `project-resume.cjs` now has explicit blocked branches at all three levels (project step 3, phase step 5, wave step 6). `stage-project-resume.md` SPR-5 routing map includes `project-blocked`, `phase-blocked`, and `wave-blocked` actions. Unit tests cover all three. The R0.5p resume summary table entry for each blocked state reads the last changelog entry with reason.

- **C-11: Hookpoint insertion anchor precision (iteration 2).** Step 5's insertion point in `skills/do/project.md` must be unambiguous. The backlog cleanup step ends at line 184 with: `4. **Backlog cleanup:** read \`phase.md\` \`backlog_item\`. If non-null, invoke \`/do:backlog done <id>\`. Log: "Removed backlog item \`<id>\` from BACKLOG.md."` The new step 5 inserts immediately after that line and before the current step 5 ("Identify next phase") which starts at line 186. **Mitigation:** step 5 in the Approach now includes the quoted anchor text from the current `skills/do/project.md` so the executor can place the insert unambiguously.

- **C-12: PE-2 handoff contract completeness (iteration 2).** The original PE-2 was missing two requirements from orchestrator §7 step 3 (lines 456 and 458): (a) abandoned/blocked waves must include the last changelog reason (not just frontmatter status), and (b) `## Files of Record` must include `project.md` and the completed `phase.md` in addition to wave-level `modified_files[]`. **Mitigation:** PE-1 now reads `changelog.md`. PE-2 now reads changelog for abandoned/blocked wave reasons and adds `project.md` + `phase.md` to Files of Record.

## Execution Log

### 2026-04-18 19:00 - Execution started
**Status:** In progress
**Steps:** 0/10 complete

Read all key reference files: resume-preamble.md, handoff-template.md, skills/do/project.md, stage-project-complete.md, skills/do/continue.md, orchestrator §7 + §7.5.

### 2026-04-18 19:30 - Step 1: Create project-resume.cjs
**Files:**
- `skills/do/scripts/project-resume.cjs` — new script; reads active project state from disk, returns routing JSON for stage-project-resume.md. Implements all branches: project-level (intake/planning/blocked/completed), terminal-pre-complete via filesystem walk, phase-level (planning/blocked/no-wave), wave-level (blocked/planning/completed/in_progress with execution/verification/code-review stages). Abandoned branch intentionally absent per C-5.

**Decisions:**
- Used `process.cwd()` for config/project resolution so tests can monkey-patch it
- preamble_targets uses 1/2/3 entries matching project/phase/wave scope depth

**Status:** Complete

### 2026-04-18 19:35 - Step 2: Create resume-preamble-project.md
**Files:**
- `skills/do/references/resume-preamble-project.md` — new reference; implements R0.1p–R0.6p per orchestrator §7.5. Covers all three target-file-types (project/phase/wave). 12-row R0.5p status/stage table transcribed verbatim from spec. R0.6p wave-scope only (no-op for project/phase). Changelog logging uses qualified log-line labels per target type.

**Status:** Complete

### 2026-04-18 19:40 - Step 3: Create stage-project-resume.md
**Files:**
- `skills/do/references/stage-project-resume.md` — new reference; implements §7 cold-start flow (SPR-0..SPR-5). SPR-2 handles special-case actions before preamble. SPR-3 runs preamble once per target. SPR-4 unified summary with terminal-pre-complete advisory. SPR-5 routing table for all 13 action values.

**Status:** Complete

### 2026-04-18 19:45 - Step 4: Create stage-phase-exit.md
**Files:**
- `skills/do/references/stage-phase-exit.md` — new reference; implements PE-1..PE-6. Read-only: no project-state.cjs calls, no frontmatter mutation. PE-3 uses filesystem-walk for terminal detection (not project.md phases[]). Includes deliberate-deviation comment per council item 1. PE-4 backlog-promotion reminder. PE-5 template slot-fill with conditional Next Phase Entry Prompt vs Project Completion Hint.

**Decisions:**
- Added explicit comment in PE-3 explaining deliberate deviation from phases[] per council item 1
- completed_phase_slug captured from precondition check before active_phase cleared (per council item 3)

**Status:** Complete

### 2026-04-18 19:50 - Steps 5+6+10: Update skills/do/project.md (3 edit regions)
**Files:**
- `skills/do/project.md` — three non-overlapping edits:
  1. Phase complete section (~lines 186–234): inserted new step 5 (render handoff artefact via stage-phase-exit.md), renumbered old 5→6, old 6→7, replaced old step 7 stub with new step 8 (print handoff result).
  2. Usage block line 38: updated resume line to "Resume from cold start (reload context + route to active stage)".
  3. Resume subcommand (~lines 394–399): replaced "Not yet implemented" stub with full implementation block.
  4. Files section: added 4 new entries for stage-project-resume.md, stage-phase-exit.md, resume-preamble-project.md, project-resume.cjs.
  5. Abandon message (~line 390): replaced γ-ships message with manual-restore instructions; no promise of first-class archived-restore command.

**Status:** Complete

### 2026-04-18 19:55 - Step 7: Write project-resume.test.cjs
**Files:**
- `skills/do/scripts/__tests__/project-resume.test.cjs` — 27 tests covering all routing branches; terminal-pre-complete leaf-file walk verified; no abandoned branch present; preamble_targets depth verified per scope level; slug argument override tested.

**Test run:** 27/27 pass, 0 fail.

**Status:** Complete

### 2026-04-18 20:00 - Steps 8+9: Verification documentation
**Decisions:**
- Step 8 (Cold-start UAT): manual checklist documented in Approach section. Requires live session — cannot be automated in unit test suite.
- Step 9 (/do:continue isolation): grep confirmed zero references to active_project, .do/projects/, or /do:project resume in skills/do/continue.md. Isolation holds.

**Status:** Complete

### 2026-04-18 20:05 - Execution complete
**Status:** Complete
**Summary:**
- Steps completed: 10/10
- Files created: 5 new (project-resume.cjs, resume-preamble-project.md, stage-project-resume.md, stage-phase-exit.md, project-resume.test.cjs)
- Files modified: 1 (skills/do/project.md — 3 edit regions)
- Deviations: 0 blocking, 0 minor
- All 27 unit tests pass

## Council Review

<!--
Populated by council review stages.
-->

## Verification Results

### Approach Checklist

- [x] 1. Create `skills/do/scripts/project-resume.cjs` — exists, implements all branches per spec (intake/planning/blocked/completed/terminal-pre-complete/inconsistent-state/phase-planning/phase-blocked/no-wave/wave-blocked/wave-planning/wave-completed/wave-in_progress all stages). Abandoned branch intentionally absent per C-5. Filesystem-walk for terminal detection (not phases[] index).
- [x] 2. Create `skills/do/references/resume-preamble-project.md` — exists, implements R0.1p-R0.6p verbatim. All three target-file-types covered. 12-row R0.5p status/stage table present. R0.6p wave-scope only (no-op for project/phase). Changelog logging with qualified log-line labels.
- [x] 3. Create `skills/do/references/stage-project-resume.md` — exists, implements SPR-0..SPR-5. Special-case handling (SPR-2), preamble per target (SPR-3), unified summary with terminal-pre-complete advisory (SPR-4), full 13-action routing table (SPR-5).
- [x] 4. Create `skills/do/references/stage-phase-exit.md` — exists, implements PE-1..PE-6. Read-only (no project-state.cjs calls, no frontmatter mutation explicitly stated in caller contract). PE-3 uses filesystem-walk for terminal detection with deliberate-deviation comment. PE-4 backlog-promotion reminder. PE-5 conditional template rendering.
- [x] 5. Update `/do:project phase complete` hookpoint in `skills/do/project.md` — new step 5 (stage-phase-exit.md invocation) inserted after backlog cleanup (step 4) and before next-phase identification (step 6). Steps renumbered. New step 8 (print handoff result). Correct ordering: state transition → render → next-phase processing → user output.
- [x] 6. Implement `/do:project resume` subcommand in `skills/do/project.md` — stub replaced with full implementation block. Usage block updated. Files section updated with all 4 new artefacts.
- [x] 7. Write unit tests for `project-resume.cjs` — 28 tests covering all routing branches, terminal-pre-complete leaf-file detection, no abandoned branch, preamble_targets depth verification, slug argument override.
- [x] 8. Cold-start UAT verification — documented as manual checklist in Verification Results. Cannot be automated (requires live Claude Code session).
- [x] 9. `/do:continue` isolation verification — grep confirmed zero matches for `active_project`, `.do/projects`, `/do:project resume` in `skills/do/continue.md`. Isolation holds.
- [x] 10. Update `skills/do/project.md` abandon message — updated to manual-restore instructions; `active_project` cleared on abandon, so first-class archived-restore is not promised (deferred per C-5).

### Quality Checks

- **Tests (project-resume):** PASS (node --test skills/do/scripts/__tests__/project-resume.test.cjs) — 28/28
- **Tests (beta-skill-structural):** PASS (node --test skills/do/scripts/__tests__/beta-skill-structural.test.cjs) — 37/37
- **Tests (beta-backlog-integration):** PASS (node --test skills/do/scripts/__tests__/beta-backlog-integration.test.cjs) — 9/9
- **Tests (project-lifecycle-roundtrip):** PASS (node --test skills/do/scripts/__tests__/project-lifecycle-roundtrip.test.cjs) — 4/4
- **Tests (full suite, npm test):** 479/481 pass — 2 failures are pre-existing in `council-invoke.test.cjs` (unrelated to Task γ; present in the same count before Task γ changes were applied)

### /do:continue isolation (Step 9)

Grep of `skills/do/continue.md` for `active_project`, `.do/projects`, `/do:project resume`: **zero matches**.

`skills/do/continue.md` reads only:
- `active_task` from `.do/config.json` (Step 1)
- `.do/tasks/<active_task>` (Step 2)

No references to the project pipeline. Isolation confirmed.

### resume-preamble.md unmodified (Step 9 / AC-9)

`git diff HEAD skills/do/references/resume-preamble.md` — no output (no changes). Original task-pipeline sibling is untouched.

### Result: PASS

- Checklist: 10/10 complete
- Quality: All γ-scope tests pass (479/481 total; 2 pre-existing failures in unrelated council-invoke.test.cjs)
- No blocking issues
