---
name: do:project
description: "Multi-phase project orchestration for Claude Code. Routes to subcommands: new <slug>, phase (new/abandon/complete), wave (new/complete/abandon/next), status, complete, abandon. Use when starting a large greenfield or massive-feature initiative that requires multiple phases and waves of work."
argument-hint: "<subcommand> [args]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Agent
  - AskUserQuestion
---

# /do:project

Orchestrate a large multi-phase project: intake grilling → project plan → phase plans → wave execution → phase transitions → project completion.

## Why this exists

`/do:task` handles single tasks well. Large initiatives (greenfield apps, massive refactors) span dozens of tasks across multiple phases and sessions. `/do:project` manages the full lifecycle: structured intake, phase-boundary confidence checks, per-wave execution pipelines, and state tracking across cold-start resume sessions. Phases and waves each go through the full plan-review → execute → code-review → verify pipeline via `wave.md` as the execution target — not task files.

## Usage

```
/do:project new <slug>                    Start a new project
/do:project phase new <slug>              Create a new phase (optional: --from-backlog <id>)
/do:project phase abandon <slug>          Abandon a phase (cascades to its waves)
/do:project phase complete                Complete the active phase and advance
/do:project wave new <slug>               Create a new wave (optional: --from-backlog <id>)
/do:project wave complete <slug>          Mark a wave completed
/do:project wave abandon <slug>           Abandon a wave
/do:project wave next                     Activate next planning wave and run its execution pipeline
/do:project status                        Display project/phase/wave status summary
/do:project complete                      Finalise and archive the project
/do:project abandon                       Abandon the active project
/do:project resume                        Resume from cold start (reload context + route to active stage)
```

## Authoritative state reads — LEAF FILES ONLY

All control-flow decisions read state from **leaf files**, never from parent indexes:
- project → `.do/projects/<slug>/project.md`
- phase → `.do/projects/<slug>/phases/<phase-slug>/phase.md`
- wave → `.do/projects/<slug>/phases/<phase-slug>/waves/<wave-slug>/wave.md`

`project.md.phases[]` and `phase.md.waves[]` are scaffold-seeded once and never updated on status transitions. They are display-only. For enumeration, use `project-state.cjs check` which walks leaf files sorted by NN-prefixed slug.

## Prerequisites

1. **do workspace initialized** — `.do/config.json` exists (run `/do:init` first)
2. **For all subcommands except `new`** — `active_project` is non-null in config

---

## Step 0: Read Config

```bash
node -e "
const c = require('./.do/config.json');
const models = c.models || { default: 'sonnet', overrides: {} };
console.log(JSON.stringify({ active_project: c.active_project || null, models, project_intake_threshold: c.project_intake_threshold || c.auto_grill_threshold || 0.85 }));
"
```

Store `active_project`, `models`, and `project_intake_threshold` for downstream steps.

---

## Step 1: Dispatch Subcommand

Parse `$ARGUMENTS` to extract `argv[0]` (primary subcommand) and remaining args.

### `new <slug>`

1. **Single-active guard:** if `active_project` is non-null, error:
   ```
   A project is already active (`<current_slug>`).
   Run `/do:project complete` or `/do:project abandon` first.
   ```
2. Call `project-scaffold.cjs project <slug>`:
   ```bash
   node ~/.claude/commands/do/scripts/project-scaffold.cjs project <slug>
   ```
3. Write `active_project: <slug>` to `.do/config.json` (atomic temp-file + rename):
   ```bash
   node -e "
   const fs = require('fs'), os = require('os'), path = require('path');
   const cfg = JSON.parse(fs.readFileSync('.do/config.json', 'utf8'));
   cfg.active_project = '<slug>';
   const tmp = path.join(os.tmpdir(), 'config-' + Date.now() + '.json');
   fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2));
   fs.renameSync(tmp, '.do/config.json');
   "
   ```
4. Invoke `@references/stage-project-intake.md`.
5. On intake completion, invoke `@references/stage-project-plan-review.md`.

---

### `phase`

Parse `argv[1]` ∈ `{new, abandon, complete}`:

#### `phase new <slug> [--from-backlog <id>]`

1. Call scaffold:
   ```bash
   node ~/.claude/commands/do/scripts/project-scaffold.cjs phase <active_project> <slug>
   ```
2. If `--from-backlog <id>` flag present:
   - Read `BACKLOG.md` and find entry with `id: <id>`.
   - If not found: error loudly before any mutation — "Backlog entry `<id>` not found. Run `/do:backlog` to verify."
   - If found but `status: done`: warn "Backlog entry `<id>` is already done — seeding anyway."
   - Write backlog entry's problem/fix content into `phase.md` `## Goal` body section.
   - Set `backlog_item: <id>` in `phase.md` frontmatter (atomic temp-file + rename).
   - Append changelog entry: `<ISO> backlog-seed:phase:<slug>:<id>`.
3. Append changelog entry for scaffold: `<ISO> scaffold:phase:<slug>`.
4. Invoke `@references/stage-phase-plan-review.md` targeting the new phase.

#### `phase abandon <slug>`

1. Call:
   ```bash
   node ~/.claude/commands/do/scripts/project-state.cjs abandon phase <slug> --project <active_project>
   ```
   This cascades `status: abandoned` to phase + every in-scope wave (records `pre_abandon_status`).
2. Append changelog entry: `<ISO> abandon:phase:<slug>`.

#### `phase complete`

Completes the active phase and advances to the next one. The multi-step sequence here exists because phase transitions involve a handoff artefact, backlog cleanup, and a planning gate for the next phase — these can't be collapsed into a single script call without losing the grilling and plan review stages.

1. **Read active phase** from `project.md` frontmatter (`active_phase`). Error if null.

2. **Precondition check** — every in-scope wave must be completed:
   ```bash
   node ~/.claude/commands/do/scripts/project-state.cjs check waves-complete <active_phase> --project <active_project>
   ```
   If `complete: false`, abort with the `incomplete` list from the JSON output.

3. **State transition:**
   ```bash
   node ~/.claude/commands/do/scripts/project-state.cjs set phase <active_phase> status=completed --project <active_project>
   ```

4. **Clear active pointers** (`active_wave` lives on `phase.md`, `active_phase` lives on `project.md`):
   - Set `active_wave: null` on the completing phase's `phase.md` (atomic temp-file + rename).
   - Set `active_phase: null` on `project.md` (atomic temp-file + rename).
   - Append changelog entries for both clears.

5. **Backlog cleanup:** read `phase.md` `backlog_item`. If non-null, invoke `/do:backlog done <id>`.

6. **Render handoff artefact:** invoke `@references/stage-phase-exit.md` with `<active_project>` and `<completed_phase_slug>`. Use the slug captured in step 1 — step 4 has already cleared `active_phase` so re-reading it would return null. This stage is read-only (all state transitions are done).

7. **Find next phase:**
   ```bash
   node ~/.claude/commands/do/scripts/project-state.cjs check next-planning-phase --project <active_project>
   ```
   - If `found: false` (terminal): do NOT auto-complete — user runs `/do:project complete`.
   - If `found: true`: do NOT write `active_phase` here. That pointer is single-owner in `stage-phase-plan-review.md` and is written only after the next phase's plan review approves. This preserves the planning gate.

8. **Per-phase re-grill (Pass 3):** if a next phase was found, read its `phase.md` confidence score. If below `project_intake_threshold`, spawn `do-griller` (pass the project threshold explicitly — `do-griller`'s default is task-safe):

   ```javascript
   Agent({
     description: "Per-phase re-grill (Pass 3)",
     subagent_type: "do-griller",
     model: "<models.overrides.griller || models.default>",
     prompt: `Phase confidence is below threshold. Ask clarifying questions.
   Target file: .do/projects/<active_project>/phases/<next_phase_slug>/phase.md
   Current confidence: <score>
   Threshold: <project_intake_threshold>
   Ask targeted questions for lowest-scoring factors. Stop when threshold reached, 10 questions asked, or user overrides.`
   })
   ```

   After re-grill (or immediately if at threshold), invoke `@references/stage-phase-plan-review.md` for the next phase.

9. **Print handoff result:** read `handoff.md`:
   - Non-terminal: print the `## Next Phase Entry Prompt` block, suggest `/clear` + fresh session.
   - Terminal: print the `## Project Completion Hint` line.

---

### `wave`

Parse `argv[1]` ∈ `{new, complete, abandon, next}`:

#### `wave new <slug> [--from-backlog <id>]`

1. Read `active_phase` from `project.md`.
2. Call scaffold:
   ```bash
   node ~/.claude/commands/do/scripts/project-scaffold.cjs wave <active_project> <active_phase> <slug>
   ```
3. If `--from-backlog <id>` flag present:
   - Read `BACKLOG.md` and find entry with `id: <id>`.
   - If not found: error loudly — "Backlog entry `<id>` not found."
   - If found but `status: done`: warn "Backlog entry `<id>` is already done — seeding anyway."
   - Write backlog entry's problem/fix content into `wave.md` `## Problem Statement` body section.
   - Set `backlog_item: <id>` in `wave.md` frontmatter (atomic).
   - Append changelog: `<ISO> backlog-seed:wave:<slug>:<id>`.
4. Append changelog: `<ISO> scaffold:wave:<active_phase>:<slug>`.

#### `wave complete <slug>`

1. Call:
   ```bash
   node ~/.claude/commands/do/scripts/project-state.cjs set wave <active_phase>/<slug> status=completed --project <active_project>
   ```
2. Append changelog: `<ISO> complete:wave:<slug>`.

> **No backlog cleanup here.** Backlog cleanup is verification-gated: it only runs in `stage-wave-verify.md` (wave-level) and `phase complete` (phase-level). Manual wave completion skips verification, so it must not touch the backlog.

#### `wave abandon <slug>`

1. Call:
   ```bash
   node ~/.claude/commands/do/scripts/project-state.cjs abandon wave <active_phase>/<slug> --project <active_project>
   ```
   Records `pre_abandon_status`, sets `status: abandoned`. Does NOT cascade to parent phase.
2. Append changelog: `<ISO> abandon:wave:<slug>`.

#### `wave next`

Activates the next planning wave and runs it through the full execution pipeline. This is the inner loop of project execution — each wave goes through plan → review → execute → code review → verify.

1. Read `active_project` + `active_phase` from config and `project.md`.
2. Find the next planning wave:
   ```bash
   node ~/.claude/commands/do/scripts/project-state.cjs check next-planning-wave <active_phase> --project <active_project>
   ```
3. If `found: false`: display "No planning waves in current phase; run `/do:project wave new <slug>` to create one." Stop.
4. Set wave status to `in_progress`:
   ```bash
   node ~/.claude/commands/do/scripts/project-state.cjs set wave <active_phase>/<wave_slug> status=in_progress --project <active_project>
   ```
5. Update `phase.md` `active_wave: <wave_slug>` (atomic). Append changelog.
6. **Per-wave confidence rescue:** read `wave.md` confidence score. If below `project_intake_threshold`, spawn `do-griller` (pass the project threshold explicitly):
   ```javascript
   Agent({
     description: "Wave confidence rescue: grill for clarity",
     subagent_type: "do-griller",
     model: "<models.overrides.griller || models.default>",
     prompt: `Wave confidence is below threshold. Ask clarifying questions.
   Target file: .do/projects/<active_project>/phases/<active_phase>/waves/<wave_slug>/wave.md
   Current confidence: <score>
   Threshold: <project_intake_threshold>
   Ask targeted questions for lowest-scoring factors. Stop when threshold reached or user overrides.`
   })
   ```
7. Invoke `@references/stage-wave-plan-review.md` (targets `wave.md`).
8. Then `@references/stage-wave-exec.md`.
9. Then `@references/stage-wave-code-review.md`.
10. Then `@references/stage-wave-verify.md`.

---

### `status`

Read-only. Invoke state script and render summary:

```bash
node ~/.claude/commands/do/scripts/project-state.cjs status <active_project>
```

Render a markdown table:

```
## Project Status: <slug>

| Node | Slug | Status | Scope | Notes |
|------|------|--------|-------|-------|
| Project | <slug> | <status> | — | <phase count> phases |
| Phase | <phase_slug> | <status> | in_scope | <wave count> waves |
| Wave | <wave_slug> | <status> | in_scope | active |
| … | … | … | … | … |
```

No writes.

---

### `complete`

Invoke `@references/stage-project-complete.md`.

---

### `abandon`

Top-level project abandon — α's `project-state.cjs abandon project <slug>` is the single owner of all side effects (cascade abandon of in-scope phases + waves, rename to `.do/projects/archived/<slug>/`, clear `active_project` in config). Do NOT re-implement these inline; following this step after the script runs would attempt to move a folder that no longer exists.

1. If `active_project` null, error: "No active project to abandon."
2. Prompt for one-line abandon reason (inline text prompt).
3. Call α's single-owner abandon operation:
   ```bash
   node ~/.claude/commands/do/scripts/project-state.cjs abandon project <active_project>

   # Note: `abandon project` does NOT take --project (project slug is the path arg).
   ```
   This cascades `status: abandoned` on project + every in-scope phase + wave (records `pre_abandon_status`; out-of-scope untouched), renames the project folder into `.do/projects/archived/<slug>/`, and clears `active_project` in `.do/config.json` — all atomic, all in one script invocation.

4. Append abandon-reason changelog:
   ```
   <ISO> abandon:project:<slug>: <reason>
   ```
   (α's script appends its own state-transition changelog line; this step adds the user-provided reason on top. Writing to the changelog in the archived location: `.do/projects/archived/<active_project>/changelog.md`.)

5. Display: "Project `<slug>` abandoned and archived at `.do/projects/archived/<slug>/`. To re-activate: move `.do/projects/archived/<slug>/` back to `.do/projects/<slug>/`, set `active_project: <slug>` in `.do/config.json`, then run `/do:project resume`. Note: archived-project restore is not yet implemented as a first-class command and may ship in a future iteration."

---

### `resume`

Resume the active project from cold start. Delegates all routing to `stage-project-resume.md`.

1. Invoke `@references/stage-project-resume.md`.
   The stage reference handles: config read, state computation via `project-resume.cjs`,
   preamble loading per target file (project.md → phase.md → wave.md), resume summary
   display, and routing to the correct stage reference.
2. Return whatever the stage reference returns (COMPLETE or STOP propagates to user).

---

### Unknown subcommand

Display usage and stop:

```
Unknown subcommand: <argv[0]>

Usage: /do:project <new|phase|wave|status|complete|abandon|resume>
Run /do:project without arguments to see this help.
```

---

## Failure Handling

On any failure: report which subcommand/step failed, the last known good state, and the project file path. No automatic retries — user decides next step.

---

## Files

- **Scripts:**
  - `@scripts/project-scaffold.cjs` — Creates project/phase/wave folders and files
  - `@scripts/project-state.cjs` — State transitions, abandon cascade, status reads, `check` queries (waves-complete, next-planning-phase, next-planning-wave)
  - `@scripts/project-health.cjs` — Health checks (used by `/do:init`)
  - `@scripts/project-resume.cjs` — State reader, returns next-action JSON for resume routing
- **Stage references (called inline via `@references/...`):**
  - `@references/stage-project-intake.md` — Pass 1 + 2 grilling flow
  - `@references/stage-project-plan-review.md` — PR-0..PR-5, targets `project.md`
  - `@references/stage-phase-plan-review.md` — PR-0..PR-5, targets `phase.md`
  - `@references/stage-wave-plan-review.md` — PR-0..PR-5, targets `wave.md`
  - `@references/stage-wave-exec.md` — Spawns `do-executioner` against `wave.md`
  - `@references/stage-wave-code-review.md` — Spawns `do-code-reviewer` + council
  - `@references/stage-wave-verify.md` — Spawns `do-verifier` against `wave.md`
  - `@references/stage-project-complete.md` — Renders `completion-summary.md`
  - `@references/stage-project-resume.md` — Cold-start resume orchestrator
  - `@references/stage-phase-exit.md` — Render-only handoff artefact writer
  - `@references/resume-preamble-project.md` — Per-file context reload (project pipeline sibling)
- **Templates (α artefacts):**
  - `@references/project-master-template.md`
  - `@references/phase-template.md`
  - `@references/wave-template.md`
  - `@references/completion-summary-template.md`
