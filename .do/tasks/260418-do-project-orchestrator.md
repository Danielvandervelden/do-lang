---
id: 260418-do-project-orchestrator
created: 2026-04-18T09:06:24Z
updated: 2026-04-18T18:30:00Z
description: "Design and implement /do:project — a top-tier orchestrator skill for large, multi-phase projects (new-from-scratch or massive features). Introduces .do/projects/ folder with active/archived state, a project-as-folder structure (project.md master + phases/<phase>/phase.md + phases/<phase>/waves/<wave>/wave.md), heavy do-griller-driven upfront information gathering, and coordinated use of all existing do-lang agents across phases with context-clear handoffs between phases."

stage: complete
stages:
  refinement: complete
  grilling: skipped
  execution: skipped
  verification: skipped
  abandoned: false
completion_reason: "Design-locked artifact. Ships no code — implementation delegated to child tasks α/β/γ."

council_review_ran:
  plan: false
  code: false

confidence:
  score: 0.98
  factors:
    context: -0.01
    scope: -0.01
    complexity: -0.00
    familiarity: -0.00

design_locked: true
backlog_item: null
---

# /do:project — Large-feature multi-phase orchestrator

## Problem Statement

### What
Design and implement `/do:project` — a new top-tier orchestrator skill that sits **alongside** (not on top of) `/do:task`, `/do:fast`, and `/do:quick`. It is a fully independent command family with its own pipeline, its own state, and its own stage references. It reuses the existing do-lang **agents** (`do-executioner`, `do-verifier`, `do-planner`, etc.) but does NOT reuse the task pipeline's stage references or share any state (`active_task`, `.do/tasks/`) with it.

`/do:project` is the entry point for two classes of work that the existing pipeline cannot handle well:

1. **Greenfield projects** — creating a brand-new codebase from scratch (product concept to running app).
2. **Massive features in existing apps** — multi-month, multi-surface initiatives that span many task-sized units of work.

A project is not a single markdown file. It is a folder (`.do/projects/<slug>/`) with a master `project.md`, a `phases/<phase-slug>/phase.md` for each phase, and `phases/<phase-slug>/waves/<wave-slug>/wave.md` for each wave inside a phase. Active projects live at the root of `.do/projects/`; finished or abandoned projects move to `.do/projects/completed/` or `.do/projects/archived/`.

### Why
- `/do:task` assumes a single deliverable completed in one session (or a continuous resume). It does not model a multi-month initiative with dozens of sub-tasks, nor does it structure the upfront discovery needed for greenfield.
- There is no do-lang entry point that says "before you do anything, gather the vision, the users, the non-goals, the constraints, the success criteria." `do-griller` exists but only fires late, as a confidence rescue — not as the primary intake.
- Large initiatives blow past a single context window. The do-lang workflow has no concept of a clean boundary at which to `/clear` and cold-start from disk. `/do:project` must bake that boundary in (phase transitions) and guarantee resume-from-disk on any session.
- The user explicitly said: "It's VERY important to get the foundation of this new project command right, a lot of tokens and time will go into creating a new project for users." So the contract must be stable on day one even if the automation ships incrementally.

### Gap relative to `/do:task`
| Dimension | `/do:task` | `/do:project` |
|---|---|---|
| Unit | one deliverable | a product or a massive feature |
| File shape | single `.md` in `.do/tasks/` | folder in `.do/projects/<slug>/` with nested phase + wave folders |
| Intake | confidence factors + optional grill | heavy structured grilling is the *first-class* step (vision, users, non-goals, constraints, success criteria, risks) |
| Decomposition | linear Approach steps | project → phases → waves → tasks |
| Sessions | designed for one session with resume | designed for many sessions with deliberate context-clear handoffs at phase boundaries |
| State | one `active_task` | one `active_project` (with its own active phase / active wave) |

### Acceptance criteria (for the v1 "foundation" slice)
`/do:project` v1 is considered done — and ready to iterate on — when:

1. `.do/projects/<slug>/` folder contract is locked in and documented: `project.md`, `phases/<phase>/phase.md`, `phases/<phase>/waves/<wave>/wave.md`, plus `completed/` and `archived/` sibling folders.
2. Frontmatter schemas for `project.md`, `phase.md`, `wave.md` are specified (including `project_schema_version` on all three) and templated under `skills/do/references/`.
3. The state machine (status values, transitions, "active" tracking) is specified in a dedicated reference file and implemented in a script (`project-state.cjs` or similar).
4. `/do:project` can: (a) start a new project, (b) run the intake grill, (c) produce an initial project.md plus at least one phase.md, (d) execute a wave via the project-specific pipeline (`stage-wave-exec.md` → `do-executioner` targeting `wave.md`), (e) resume cold from disk via `/do:project resume`. `/do:continue` is **not** project-aware; it stays task-pipeline-only.
5. Health check (`/do:init`) understands and validates the new folder shape.
6. No edits to task-pipeline command files (`skills/do/task.md`, `fast.md`, `quick.md`, `continue.md`, `backlog.md`). Shared agents (`do-executioner`, `do-verifier`, `do-planner`, `do-griller`, `do-plan-reviewer`, `do-code-reviewer`, `do-council-reviewer`) are intentionally generalized to be caller-agnostic — they accept a `target-file` parameter from either pipeline. Generalization edits (Task β scope, §14) preserve all existing task-pipeline behavior verbatim; they remove hardcoded `/do:task`/`.do/tasks/` assumptions in agent prompts so the same agents serve both pipelines. `/do:project` does not touch `.do/tasks/` or `active_task`. A one-way advisory (task pipeline reads `active_project` to print a soft notice) is the only touchpoint, and is optional (see O-30).
7. A versioning story (`project_schema_version`) is present so schema changes in v2+ are non-destructive.

Automation polish (parallel-waves, advanced completion reporting, cross-project dashboards) is explicitly out of scope for v1.

## Clarifications

## Context Loaded

- `.do/config.json` — project config, includes `active_task` field; template for the equivalent `active_project` field.
- `.do/tasks/260418-do-project-orchestrator.md` — this task file; template to follow for frontmatter shape.
- `skills/do/do.md` — top-level router; `/do:project` will need to register here as a new sub-command.
- `skills/do/task.md` — most detailed reference for the full 12-step orchestration pipeline; primary model for `/do:project`'s per-wave inner loop.
- `skills/do/fast.md` — lightweight tier; model for when a wave is trivial enough to bypass full ceremony.
- `skills/do/quick.md` — tightest tier; used to understand the execution-tier hierarchy `/do:project` must compose on top of.
- `skills/do/continue.md` — resume logic with stage routing; `/do:project` needs an analogous project-aware resume.
- `skills/do/abandon.md` — shows the `pre_abandon_stage` pattern; transferable to project-level abandonment.
- `skills/do/backlog.md` — structured BACKLOG.md interface; relevant for promoting/demoting project work items.
- `skills/do/init.md` — health-check routing; `/do:init` will need to grow awareness of `.do/projects/`.
- `skills/do/scan.md` — database-entry creation; interesting because greenfield `/do:project` runs may need to *produce* a `project.md` in the database, not just consume one.
- `skills/do/references/task-template.md` — frontmatter shape for tasks; template for wave.md frontmatter.
- `skills/do/references/project-template.md` — database-level project.md template; the `.do/projects/<slug>/project.md` is distinct but informs the design.
- `skills/do/references/stage-plan-review.md` — full council gate + iteration loop pattern; left UNTOUCHED under full split. The project pipeline ships its own sibling plan-review references modelled on the same structure (caller-contract preamble, PR-0 resume guard, PR-3 parallel reviewer spawn, PR-4 verdict combination, PR-5 iteration loop) but targeting project/phase/wave files.
- `skills/do/references/stage-grill.md` — grill-me flow detail; `/do:project` intake will be a richer, structured superset.
- `skills/do/references/resume-preamble.md` — shared R0 resume steps for the task pipeline; hardcoded to `.do/tasks/<active_task>` and `/do:continue`. Left UNTOUCHED under the full split. The project pipeline ships a sibling (`resume-preamble-project.md`) in Task γ — same R0.1-R0.6 structure, different target files (project.md / phase.md / wave.md) and different command label (`/do:project resume`). Duplication accepted per O-29.
- `skills/do/references/init-health-check.md` — existing health-check shape; adding project-level checks follows this pattern.
- `skills/do/scripts/project-health.cjs` — current project health script; a sibling script for project-folder health is likely.
- `skills/do/scripts/workspace-health.cjs` — paired with project-health for workspace-wide checks.
- `skills/do/scripts/load-task-context.cjs` — keyword-based context loader; the per-wave planner will still call this.
- `skills/do/scripts/task-abandon.cjs` — active-task lifecycle; reference for active-project lifecycle.
- `agents/do-planner.md` — planner; will be spawned for project-level plan, phase-level plan, and wave-level plan with different prompt shapes.
- `agents/do-griller.md` — griller; central to `/do:project` intake (scaled up significantly).
- `agents/do-plan-reviewer.md` — self-reviewer; fires at project / phase / wave plan review gates.
- `agents/do-council-reviewer.md` — external council; pairs with plan-reviewer at each gate (config-gated).
- `agents/do-executioner.md` — executioner; fires inside each wave exactly as today.
- `agents/do-code-reviewer.md` — code reviewer; fires inside each wave exactly as today.
- `agents/do-verifier.md` — verifier; fires at the end of each wave. Also needs a project-level "phase-exit" variant (see Approach §7).
- `agents/do-debugger.md` — debugger; available per-wave. May also fire at phase level for cross-wave symptoms.
- `CLAUDE.md` (root project) — "skill-creator reminder" rule; applies when `/do:project` skill file is written.
- `database/projects/*/project.md` (selection) — real-world examples of database project.md (distinct from `.do/projects/<slug>/project.md`).

## Approach

> **Framing note (design-locked v0.2).** After iteration 3 council review, the user directed a full architectural split: `/do:project` becomes a fully independent command family with its own project-specific stage references (siblings to the existing task-pipeline ones), its own state (`active_project` + `.do/projects/`), and its own wave.md-as-execution-state-file model. It does NOT share `active_task` or `.do/tasks/` with `/do:task` / `/do:fast` / `/do:quick` / `/do:continue` / `/do:backlog`. This task file is now **design-locked** and does not produce code. Implementation is delivered by three sibling child tasks (Task α, β, γ) specified in §14. Open questions still tagged in Concerns remain relevant for implementation-time grilling, but the architectural contract below is fixed.

---

### 1. Skill file layout

- **New top-level skill:** `skills/do/project.md` with frontmatter `name: do:project`, `argument-hint: "[new|resume|phase|wave|status|complete|abandon] ..."`. Follows the same shape as `task.md` / `fast.md` / `continue.md`.
- **Sub-command dispatch inside the skill:** similar to `/do:backlog` (`list|add|start|done`), `/do:project` parses the first positional arg:
  - `/do:project new "<idea>"` — start a brand-new project; triggers intake grilling and scaffolding.
  - `/do:project resume` — cold-start from disk, re-enter at the correct stage/phase/wave.
  - `/do:project status` — show active project's phase/wave tree and each node's status.
  - `/do:project phase new|complete|abandon` — phase lifecycle operations. `phase new` accepts `--from-backlog <id>` to seed the new phase from a BACKLOG.md entry (see §11). Phase advancement is handled implicitly by `phase complete`, which promotes the next phase to `planning`; there is no separate `phase next` command.
  - `/do:project wave new|next|complete|abandon` — wave lifecycle operations. `wave new` accepts `--from-backlog <id>` analogously.
  - `/do:project complete` — graduate the whole project to `completed/`.
  - `/do:project abandon` — move the whole project to `archived/` with `pre_abandon_status` preserved per node (see §3 cascade semantics).
- **Delegated references (new, under `skills/do/references/`):** all are **siblings** of the existing task-pipeline stage references — the existing `stage-plan-review.md`, `stage-code-review.md`, `stage-execute.md`, `stage-verify.md`, `stage-fast-exec.md`, `stage-quick-exec.md` are **left untouched**. `/do:project` ships its own parallel set:
  - `project-master-template.md` *(new — not to be confused with the existing database `project-template.md`; see Concern O-16)* → master `project.md` template.
  - `phase-template.md` → `phase.md` template.
  - `wave-template.md` → `wave.md` template (carries the full body-section set of a task file: Problem Statement, Approach, Execution Log, Verification Results, etc. — because wave.md IS the execution state file).
  - `handoff-template.md` → phase-exit handoff artefact template.
  - `changelog-template.md` → project-root append-only transition log template.
  - `intake-transcript-template.md` → raw Q&A transcript template.
  - `completion-summary-template.md` → completion summary template filled by `stage-project-complete.md` (per §12) with sections `## Completed Phases`, `## Deferred (Out-of-Scope)`, `## Success Criteria Status`, `## Final File Set`, `## Residual Open Decisions`. **Owned by Task α** (α owns all template files; β owns the rendering flow in `stage-project-complete.md`, which consumes this template — see §14 Task β scope).
  - `stage-project-intake.md` → the big grilling flow (vision, users, non-goals, tech constraints, success criteria, risks, phasing seed).
  - `stage-project-plan-review.md` → project-level plan review (PR-0..PR-5 iteration pattern targeting `project.md`).
  - `stage-phase-plan-review.md` → phase-level plan review (targets `phase.md`).
  - `stage-wave-plan-review.md` → wave-level plan review (targets `wave.md`). Sibling to the task pipeline's `stage-plan-review.md`; operates on wave.md directly.
  - `stage-wave-exec.md` → wave execution; spawns `do-executioner` with a wave-aware prompt pointing at `wave.md`.
  - `stage-wave-code-review.md` → wave-level code review; spawns `do-code-reviewer` + council on the wave diff.
  - `stage-wave-verify.md` → wave-level verify; spawns `do-verifier`. On failure it routes back into the wave workflow (retry / debug / abandon wave / mark out_of_scope). It **NEVER** instructs "spawn /do:task".
  - `stage-phase-exit.md` → the context-clear handoff flow at phase boundaries.
  - `stage-project-resume.md` → project-aware resume (composes `resume-preamble-project.md` on each nested file; see below).
  - `resume-preamble-project.md` → **new sibling** of the task-pipeline's `resume-preamble.md` (which remains untouched and hardcoded to `.do/tasks/<active_task>` + `/do:continue`). **Full step-by-step spec lives in §7.5** — do not re-derive by analogy; γ's implementer follows §7.5's R0.1p–R0.6p numbered steps directly. Summary: invoked once per target file (project.md, phase.md, wave.md) with `<target-file-path>` + `<target-file-type>` inputs; replaces the task-pipeline's `load-task-context.cjs` call with project-native structured reads; replaces the task-file stage table with a target-file-type stage table; uses `changelog.md` (project scope) or the wave.md Execution Log (wave scope) as the "last action" source; references `/do:project resume` in stale-reference prompts. Composed by `stage-project-resume.md` (§7 step 5). Per O-29, duplication across pipeline siblings is accepted.
  - `stage-project-complete.md` → completion + archival flow.
- **State-machine reference (new, under `skills/do/references/`):**
  - `project-state-machine.md` — **dedicated reference file** that specifies the state machine (status enum × `scope` field, allowed transitions, completion rules, abandon cascade semantics including out-of-scope exclusion, terminal-pre-complete state definition, `pre_abandon_status` record-and-restore rule). This is the authoritative source consumed by AC #3; `project-state.cjs` implements exactly what this doc specifies. **Owned by Task α** (see §14).
- **Delegated scripts (new, under `skills/do/scripts/`):**
  - `project-state.cjs` — reads/writes project/phase/wave frontmatter atomically; the single source of truth for stage transitions. Implements the state machine specified in `project-state-machine.md` — no divergence permitted.
  - `project-health.cjs` *(extend existing — additive only)* → the existing script already owns task-pipeline integrity checks for `/do:init` (`.do/` folder, `config.json` schema, `version`, `project_name`, `council_reviews`, `auto_grill_threshold`, `.do/tasks/` folder, `active_task` integrity including path-traversal guard). Task α extends `checkProjectHealth()` with additional project-folder checks (§13) appended to the same `issues[]` array under the same return shape. The existing task-pipeline checks are preserved verbatim; the new checks are purely additive.
  - `project-scaffold.cjs` — creates the `.do/projects/<slug>/` folder tree + initial files from templates.
  - `project-resume.cjs` — reads active project's state, returns the next action to take (next stage in phase/wave tree).
- **Update existing files (minimal, non-invasive — each assigned explicitly to a child task in §14):**
  - `skills/do/do.md` — add `/do:project` row to the sub-commands table and a routing example. **Owned by Task β** (β owns `skills/do/project.md`; adding the router entry belongs in the same task).
  - `skills/do/init.md` — additive Quick-Reference / Files note documenting that `.do/projects/` is a valid project-time artefact recognised by the health check. **Owned by Task α** (α owns the project-folder health rules and the `project-health.cjs` extension). See Task α scope in §14 for the reality-check caveat on whether a natural insertion point exists.
  - `skills/do/references/init-health-check.md` — extend the existing `### Project Issues` sub-table with the new project-folder issue types from §13. **Owned by Task α** (α owns the health-check output format extensions).
  - `skills/do/references/config-template.json` — add `active_project`, `project_intake_threshold`, `council_reviews.project.{plan,phase_plan,wave_plan,code}` fields. **Owned by Task α** (α owns the config-field additions — already listed explicitly in α's scope in §14).
  - `skills/do/references/task-template.md` — add a `related: []` frontmatter field so children can carry `related: ["260418-do-project-orchestrator"]`. **Owned by Task α** (α owns template files; this is a minimal one-field additive edit).
  - **No edits to `skills/do/task.md` / `fast.md` / `quick.md` / `continue.md` / `backlog.md`.** `/do:project` does not read or write their state; they do not read or write `/do:project` state. See §10 for the isolation model. A non-blocking soft-warning in `/do:task` Step 0 when `active_project` is set is optional (see Concern O-30) — not a hard guard.

---

### 2. On-disk folder / file contract

```
.do/projects/
├── <project-slug>/                 # ACTIVE project (only one by default — see O-1)
│   ├── project.md                  # master: vision, phases list, status
│   ├── intake/                     # raw intake artefacts (transcripts, notes)
│   │   ├── session-<timestamp>.md
│   │   └── ...
│   ├── phases/
│   │   ├── 01-<phase-slug>/
│   │   │   ├── phase.md            # phase plan + status + wave index
│   │   │   ├── handoff.md          # written at phase-exit; the "cold-start pack"
│   │   │   └── waves/
│   │   │       ├── 01-<wave-slug>/
│   │   │       │   └── wave.md     # wave IS the execution state file (see §6)
│   │   │       └── 02-<wave-slug>/
│   │   │           └── wave.md
│   │   └── 02-<phase-slug>/
│   │       └── ...
│   └── changelog.md                # append-only human-readable history of state transitions
├── completed/
│   └── <project-slug>/             # graduated projects preserved intact
└── archived/
    └── <project-slug>/             # abandoned projects preserved intact
```

**Numeric prefixes** (`01-`, `02-`, ...) give deterministic sort order independent of slug text. Phase/wave order is authoritative in the filesystem; `project.md` and `phase.md` mirror it for fast reads but are rebuilt from disk on drift.

#### Frontmatter schemas (resume contract — locked on day one, versioned)

All three share a `project_schema_version: 1` field at the top. Any schema change in v2+ bumps this number, and `project-state.cjs` knows how to migrate.

**`project.md` frontmatter:**
```yaml
---
project_schema_version: 1
slug: <project-slug>                   # matches folder name
id: <project-slug>                     # alias; stable across renames
title: "<human title>"
created: <ISO timestamp>
updated: <ISO timestamp>
kind: greenfield | feature             # greenfield = new repo; feature = massive feature in existing app
status: intake | planning | in_progress | blocked | completed | abandoned
active_phase: 01-discovery | null      # full prefixed slug — same value as phase folder name and phase_slug field; null when no phase is active
pre_abandon_status: null               # set on abandon
database_entry: <path> | null          # link to database/projects/<name>/project.md if one exists
tech_stack: [...]                      # populated during intake
repo_path: <absolute or workspace-relative path> | null
confidence:                            # project-level confidence (separate from per-wave task confidence)
  score: <0..1>
  factors: { context, scope, complexity, familiarity }
council_review_ran:
  project_plan: false
  phase_plans: {}                      # keyed by phase-slug
  code: {}                             # keyed by wave-slug
phases:                                # mirror of phases/ folder; authoritative dir is filesystem; slugs are full prefixed values (e.g. 01-discovery)
  - slug: 01-discovery
    status: completed
  - slug: 02-foundations
    status: in_progress
---
```

**`phase.md` frontmatter:**
```yaml
---
project_schema_version: 1
project_slug: <project-slug>
phase_slug: 01-discovery              # full prefixed slug — matches phases/<this-value>/ folder name and project.md phases[].slug
title: "<human title>"
created: <ISO timestamp>
updated: <ISO timestamp>
status: planning | in_progress | blocked | completed | abandoned
scope: in_scope | out_of_scope                 # default in_scope; see §3 for semantics
active_wave: 01-auth-shell | null     # full prefixed slug — matches waves/<this-value>/ folder name and waves[].slug
pre_abandon_status: null
backlog_item: <id> | null                      # set if `phase new --from-backlog <id>` seeded this phase; consumed on complete (see §11)
council_review_ran:
  plan: false
confidence:
  score: <0..1>
  factors: { context, scope, complexity, familiarity }
waves:                                 # full prefixed slugs (e.g. 01-auth-shell); match waves/ folder names
  - slug: 01-auth-shell
    status: completed
  - slug: 02-session-mgmt
    status: in_progress
entry_context:                         # what the next cold session MUST read first
  - path: project.md
  - path: phase.md
  - path: handoff.md (if previous phase exists)
exit_summary: null                     # set on complete; one-paragraph handoff to next phase
---
```

**`wave.md` frontmatter:**
```yaml
---
project_schema_version: 1
project_slug: <project-slug>
phase_slug: 01-discovery              # full prefixed slug — matches phases/<this-value>/
wave_slug: 01-intake                  # full prefixed slug — matches waves/<this-value>/
title: "<human title>"
created: <ISO timestamp>
updated: <ISO timestamp>
status: planning | in_progress | blocked | completed | abandoned
scope: in_scope | out_of_scope                 # default in_scope; see §3 for semantics
pre_abandon_status: null
backlog_item: <id> | null                      # set if `wave new --from-backlog <id>` seeded this wave; consumed on complete (see §11)
parent_project: <project-slug>
parent_phase: 01-discovery            # full prefixed slug
stage: refinement | grilling | execution | verification
stages:
  refinement: pending | in_progress | complete
  grilling: pending | in_progress | complete
  execution: pending | in_progress | complete
  verification: pending | in_progress | complete
  abandoned: false
council_review_ran:
  plan: false
  code: false
confidence:
  score: <0..1>
  factors: { context, scope, complexity, familiarity }

# --- Handoff harvest fields (populated by executioner/verifier; read by stage-phase-exit.md) ---
modified_files: []            # array of repo-relative paths; written by do-executioner at wave end
unresolved_concerns: []       # array of { title, body, severity: info|warning|blocking }
discovered_followups: []      # array of { title, body, promote: wave|backlog|none }
wave_summary: null            # one-sentence summary of what the wave shipped; written by do-verifier at end of wave verification. Canonical input to `## What Shipped` in handoff.md (replaces prose-reading from `## Review Notes`).
---
```

**Handoff-field ownership & write points** (authoritative — mirrored in §8 agent coverage):
- `modified_files` — written by **do-executioner** at the end of wave execution. Source of truth for files touched. The existing task-file `## Execution Log` stays (human-readable) but the canonical list is this field.
- `unresolved_concerns` — written by **do-verifier** at the end of wave verification when it encounters a concern it cannot close. Severity drives `stage-phase-exit.md` rollup grouping.
- `discovered_followups` — written by **do-executioner** OR **do-verifier** when a discovery is logged. `promote` field tells `stage-phase-exit.md` where to route it (`wave` = next wave in same phase; `backlog` = `/do:backlog add`; `none` = report-only).
- `wave_summary` — written by **do-verifier** at the end of wave verification (one-sentence summary of what the wave shipped, derived from the verifier's pass summary). Canonical input for `stage-phase-exit.md`'s `## What Shipped` rendering — replaces any prose-read from the `## Review Notes` body section. The body section remains in the wave.md body-section list for human readability, but is no longer a machine-read input.

**Source-of-truth note:** the above fields live on `wave.md`, which IS the execution state file. There is no sibling `task.md`; there is no `task_file:` pointer. `wave.md` carries the same body sections as a `/do:task` task file (Problem Statement, Approach, Execution Log, Verification Results, Concerns, Council Review) plus the wave-specific frontmatter above. `do-executioner`, `do-verifier`, and `do-code-reviewer` are all caller-agnostic — they take a file path as input — so pointing them at `wave.md` is a no-op change for the agent; only the spawning stage reference differs. Existing `/do:task` consumers are unaffected because this pipeline does not touch `.do/tasks/` at all.

**`project.md` body sections** (fixed order, locked):
`## Vision`, `## Target Users`, `## Non-Goals`, `## Success Criteria`, `## Constraints`, `## Risks`, `## Phase Plan`, `## Changelog Pointer`.

**`phase.md` body sections:** `## Goal`, `## Entry Criteria`, `## Exit Criteria`, `## Wave Plan`, `## Concerns`, `## Review Notes`, `## Exit Summary`.

**`wave.md` body sections:** `## Problem Statement`, `## Approach`, `## Concerns`, `## Execution Log`, `## Verification Results`, `## Review Notes`, `## Council Review`. Same body sections as a task file so the familiar shape carries over; the file IS the wave's execution artefact.

**`handoff.md` body sections** (the cold-start pack): `## What Shipped`, `## What Remains`, `## Open Decisions`, `## Files of Record`, `## Next Phase Entry Prompt` (copy-paste-ready prompt for a fresh session — **conditional:** rendered only when a next in-scope phase exists; on terminal phase this section is replaced by `## Project Completion Hint`, a single line: "This was the final phase. Run `/do:project complete` to finalise the project." See §7 steps 3 / 5 / 6 for terminal-phase routing).

---

### 3. State machine

**Node types** (project, phase, wave) all share the same status enum:
`planning` → `in_progress` → (`blocked` ↔ `in_progress`) → `completed` or `abandoned`.

Additional project-level leading status: `intake` (precedes `planning`).

**Scope vs. status (locked — finding #1 option b).** Status tracks *work state* (is the node being worked on / finished / abandoned?). Scope tracks a separate orthogonal decision: *does this node count toward parent completion?* Every phase and wave carries a `scope: in_scope | out_of_scope` frontmatter field (default `in_scope`; see §2). `out_of_scope` is NOT a status; it is a scope flag.

**Legal scope transitions:**
- `in_scope → out_of_scope` is allowed only when the node's current status is `planning` or `blocked` (i.e. no in-flight work to discard). Moving from `in_progress → out_of_scope` is disallowed; the user must first `blocked` or `abandoned` the node, which surfaces the abandonment explicitly.
- `out_of_scope → in_scope` is always allowed (re-pulling deferred work into scope).
- Scope changes are logged to `changelog.md` exactly like status transitions.

**Status transitions** are only legal via `project-state.cjs` which enforces:
- You cannot `in_progress` a wave whose parent phase is not `in_progress`.
- You cannot `in_progress` a wave or phase whose `scope` is `out_of_scope` (must re-scope first).
- **Phase completion rule (single clause):** a phase may transition to `completed` only when every one of its in-scope waves (i.e. waves whose `scope == in_scope`) has `status: completed`. Out-of-scope waves are ignored by the check; their `status` may be anything except `in_progress`.
- **Project completion rule (single clause):** a project may transition to `completed` only when every one of its in-scope phases has `status: completed`.
- `abandon` at any level records `pre_abandon_status` from the current `status` on the target node **and cascades the same record-and-set pattern down to every descendant**: `project.md` `status: abandoned`, every in-scope descendant `phase.md` and `wave.md` gets its current `status` copied into `pre_abandon_status` and then its `status` set to `abandoned`. Cascading to `abandoned` makes the abandon state unambiguous to readers of any single node's frontmatter — no tracing up to `project.md` to tell. On resume-from-abandoned (via the manual folder move described in §12 — there is no dedicated `--archived` flag in v1), each node's `status` is restored from `pre_abandon_status` and `pre_abandon_status` is cleared back to `null`. Resume-ability is preserved by the `pre_abandon_status` field; the cascade is lossless. **Writer assignment:** `project-state.cjs` owns both the abandon cascade write (forward) and the restore-from-abandoned write (reverse), exposed as an explicit `restore-from-abandoned <project_slug>` operation. The restore op walks project.md + every in-scope phase.md + every in-scope wave.md; for each node with a non-null `pre_abandon_status`, it sets `status = pre_abandon_status` then nulls `pre_abandon_status`. Each write is atomic (temp-file + rename). Out-of-scope nodes are not touched. `project-resume.cjs` is read-only — it does not perform writes.
- On `abandon` at project level, the whole folder moves to `.do/projects/archived/<slug>/` atomically.
- On `complete` at project level, the whole folder moves to `.do/projects/completed/<slug>/` atomically.

**Rationale for option (b) over option (a):** keeping the status enum tight (five values, one meaning per value) avoids overloading `status` with two orthogonal concepts. Deferring a wave because "we decided not to do it" is semantically distinct from "we started and gave up" (which is `abandoned`). A separate `scope` field also makes it natural to re-pull a deferred wave back into scope without inventing an `out_of_scope → planning` transition.

**"Active" tracking** (default, revisable — O-1):
- `.do/config.json` gains an `active_project: <slug> | null` field.
- Exactly one active project is allowed in v1. Second call to `/do:project new` while one is active prompts the same "abandon or cancel" flow as `/do:task` does for `active_task`.
- Inside the project, `project.md` carries `active_phase` and each `phase.md` carries `active_wave`. The single-active constraint applies recursively.

**Transition logging:** every state write by `project-state.cjs` also appends a line to `changelog.md` at the project root:
```
2026-04-18T14:22:05Z  phase:02-foundations  planning -> in_progress  reason: /do:project phase complete
```

---

### 4. Interview / grilling flow (stage-project-intake.md)

Grilling is the single most important step. It is structured and multi-pass, not a free-form interrogation.

**Pass 1 — Vision pass** (one session; do-griller with a scripted question bank):
1. **Product vision** — one sentence; what is this, at its core?
2. **Elevator pitch** — two paragraphs; audience and value.
3. **Target users** — primary persona(s), secondary, explicitly out-of-scope personas.
4. **Non-goals** — things this project explicitly will not do (sharpest clarifier; forces hard choices).
5. **Success criteria** — measurable acceptance at the project level (not per-phase).
6. **Timeline and budget constraints** — soft or hard?
7. **Tech constraints** — must-use stack? existing codebase? hosting constraints? compliance (e.g., HIPAA, PCI)?
8. **Risk register seed** — top 3-5 risks the user is already worried about.
9. **Known integrations / external APIs** — third-party, internal services, data sources.
10. **Accessibility / localization / performance** non-functional baselines.

**Pass 2 — Phase seed pass** (same session or next, depending on size):
11. Rough phase list in the user's own words (discovery, foundations, MVP, polish, launch — or the user's own taxonomy).
12. Dependencies between candidate phases.
13. Which phase is "done enough to demo" (MVP phase marker).

**Pass 3 — Confidence pass** (per-phase when that phase enters planning, NOT upfront):
14. Same 4-factor confidence calculation as per-task, but at the phase scope.
15. If a phase's confidence is below threshold, a scoped re-grill fires just for that phase.

**Iteration model:** the intake grill is **one pass at project start + a scoped per-phase pass before each phase's planning**. It is **not** one-shot for the whole project. This keeps intake tractable and prevents context bloat up-front (see Concern O-6).

**Intake artefacts:** raw Q&A transcripts are saved to `.do/projects/<slug>/intake/session-<timestamp>.md`. `project.md`'s body sections are populated from these transcripts by do-planner in the next step, so the transcripts are canonical; `project.md` is a curated summary.

**Confidence threshold for exiting intake:** default 0.85 (slightly lower than the 0.90 per-task threshold, because project-level uncertainty is inherent; the phase-level grilling will narrow things further). Configurable via `.do/config.json`'s new `project_intake_threshold` field.

---

### 5. Phase decomposition

**Who decides phases:** hybrid.
1. User provides a *seed* list during Pass 2 of intake.
2. `do-planner` (spawned with a project-planner prompt) refines the seed: checks ordering, merges near-duplicates, flags missing phases (e.g., "you listed MVP but not deployment/ops — intentional?"), and emits a proposed phase list into `project.md` under `## Phase Plan`.
3. Plan-review gate fires on the project-level plan via `stage-project-plan-review.md` (project-pipeline sibling of `stage-plan-review.md`; spawns `do-plan-reviewer` + `do-council-reviewer` against `project.md`, not a task file). Council is optional per config.
4. User approves the phase list before any phase is scaffolded.

**Phase boundary rule (critical for safe context-clear):** a phase must satisfy all of these before it can be marked as a boundary:
- It has a crisp written **Exit Criteria** section.
- All artefacts a future session would need to resume from disk are listed under `entry_context` in the *next* phase's frontmatter.
- There is a `handoff.md` template ready to be filled at phase-exit time.

Phases that cannot satisfy this rule are flagged by the planner and either merged or refactored before approval.

**Wave decomposition within a phase** (happens lazily, when that phase becomes active):
- `do-planner` runs again with a phase-planner prompt.
- Output is a list of waves under `## Wave Plan` in `phase.md`.
- Plan-review gate fires (`review_type: phase_plan`).
- User approves before any wave is scaffolded.

---

### 6. Per-phase execution — waves via project-specific pipeline

**LOCKED DECISION (full split, post-iteration-3 user directive):** `/do:project` ships its own wave pipeline using project-specific stage references. The wave's execution artefact is `wave.md` itself, living at `.do/projects/<slug>/phases/<phase>/waves/<wave>/wave.md`. There is no sibling task file, no `task_file:` pointer, and no `active_task` touch. `/do:task`, `/do:fast`, `/do:quick`, `/do:continue`, `/do:backlog`, `task-abandon.cjs`, `load-task-context.cjs`, and every other `active_task` consumer are untouched and unaware a project is running.

**Why full split over the iteration-2 "bridge via .do/tasks/":**
- Cleaner ownership: `/do:project` owns `.do/projects/` and `active_project`; `/do:task` owns `.do/tasks/` and `active_task`. Neither reads the other's state.
- No shared-surface edge cases: no guard, no stomping risk, no two-command resume confusion.
- Agents become caller-agnostic via the minor spec revisions in §8 (removing task-pipeline literals: `.do/tasks/<active_task>`, `/do:task`, `/do:continue`, `active_task`). Post-revision, `do-executioner`, `do-verifier`, `do-code-reviewer`, `do-planner`, `do-plan-reviewer`, `do-council-reviewer`, `do-griller` accept a caller-provided target file path and return control to the caller on failure. Pointing them at `wave.md` then costs the project pipeline a different spawning prompt, nothing more. `do-debugger` requires no changes. Drift is guarded by O-31's `/do:optimise` audit rule.
- Duplication cost is accepted: sibling stage references duplicate ~200 lines of structure per gate. Iteration-1 finding #2 already concluded that sibling-file duplication was the cheaper path over parameterization; the split just extends that logic across all gates consistently.

**Wave execution flow (locked):**
1. `/do:project wave next` reads `phase.md`'s `waves: []` list, finds the first entry with `status: planning` AND `scope: in_scope`, and promotes it to `in_progress` via `project-state.cjs` (records in `changelog.md`). If no such wave exists, β exits with: "No planning waves found in current phase. Run `/do:project wave new <slug>` to create one first." **No scaffold call is made by `wave next`** — the wave folder and `wave.md` must already exist (created by `wave new` or by an initial phase-seeding step; see step 1a). This mirrors the `phase new` / `phase complete` split: `new` scaffolds, `next` only activates.
1a. **Initial wave seeding (phase-planning hook):** after `stage-phase-plan-review.md` completes for a newly-active phase and the user approves the wave list, β seeds the initial waves for that phase by calling `project-scaffold.cjs wave <project_slug> <phase_slug> <wave_slug>` once per wave identified in the phase plan — before the user runs `wave next`. This ensures wave.md files are on disk and ready when `wave next` fires.
2. `wave next` then loads the existing `wave.md` for the activated wave (reads it; does not recreate it). The wave's Problem Statement was seeded at scaffold time from the phase plan's entry; Context Loaded was pre-seeded with `project.md` and `phase.md` paths. No file is created under `.do/tasks/`.
3. **No touch to `active_task`.** The project's active-wave pointer lives in `phase.md` frontmatter (`active_wave`). `.do/config.json` gets `active_project: <slug>` updated (from §3) but `active_task` is not written.
3a. **Per-wave confidence rescue (between wave.md loaded and wave execution pipeline).** After `wave.md` is loaded (step 2) and the `active_wave` pointer is written (step 3), before entering the pipeline (step 4): if `wave.md`'s confidence score is below `project_intake_threshold` (`.do/config.json`, default 0.85 per §4), β spawns `do-griller` against `wave.md`. Griller questions target wave-level context gaps (scope, acceptance criteria, blockers). On threshold reached or user override, execution continues at step 4. This is the per-wave analogue of the per-phase re-grill (Pass 3 of §4); see §14 Task β scope for full ownership and threshold contract.
4. Control transfers through the project pipeline:
   - `stage-wave-plan-review.md` — PR-0..PR-5 iteration targeting `wave.md`, spawns `do-plan-reviewer` + (config-gated) `do-council-reviewer`, writes `council_review_ran.plan: true` on `wave.md`.
   - `stage-wave-exec.md` — spawns `do-executioner` with a prompt that says "Execute the plan in `<abs path to wave.md>`. Log progress in its Execution Log section. At the end, write `modified_files` and any `discovered_followups[]` into the wave.md frontmatter."
   - `stage-wave-code-review.md` — spawns `do-code-reviewer` + council on the wave diff, targeting `wave.md`'s Council Review section.
   - `stage-wave-verify.md` — spawns `do-verifier` with a prompt that says "Verify `<abs path to wave.md>`. Write `unresolved_concerns[]` for any concern you cannot close. Append `discovered_followups[]` as needed."
5. On `stage-wave-verify.md` success, the wave's stages advance to complete, wave status → `completed` via `project-state.cjs`, `phase.md` `active_wave` clears, changelog is appended. Control returns to `/do:project`.
6. **On `stage-wave-verify.md` failure, the project pipeline owns the response.** `stage-wave-verify.md` presents four options tailored to the wave-layer workflow — it **NEVER** tells the user to "spawn `/do:task`":
   - **Retry wave** — re-run `stage-wave-exec.md` with the verifier's findings appended to the wave's Execution Log (analogous to the task pipeline's retry).
   - **Debug** — spawn `do-debugger` targeting `wave.md`; on completion, loop back to retry.
   - **Abandon wave** — set wave `status: abandoned`, record `pre_abandon_status`, surface in the next `handoff.md` under "What Remains".
   - **Mark out_of_scope** — set `scope: out_of_scope` (legal only from `planning`/`blocked`; if currently `in_progress`, the user must first `blocked` or `abandoned` — per §3).
7. Wave completion writes no config state other than clearing `phase.md` `active_wave`. If the last in-scope wave in a phase completes, the user is reminded that `/do:project phase complete` is the next step (no auto-transition — per §7).

**Caller-agnostic agent invariant:** at no point in the wave pipeline does a project-specific stage reference pass `active_task` or a `.do/tasks/` path to an agent. Agents receive `wave.md`'s absolute path and operate on it directly. Same agent binary, same prompt template conventions, different target file.

**No fast/quick tier inside a wave in v1.** The project pipeline does not ship a wave-fast variant in v1. If a wave is trivial enough for the fast tier, the user should scope it smaller or accept the small overhead. A wave-fast tier can land in v2 if a real need emerges — it would require a `stage-wave-fast-exec.md` sibling of `stage-fast-exec.md`.

---

### 7. Context-clear handoff (stage-phase-exit.md) — v1 SCOPE INCLUDES THE ARTEFACT

This is the single biggest architectural risk. The design must guarantee that **a fresh Claude Code session, started with `/do:project resume` and nothing else, can pick up where the previous session left off without re-interviewing the user**.

**LOCKED DECISION:** the `handoff.md` artefact ships in v1 — it is the foundation of AC #4 ("resume cold from disk"). What is deferred to v2 is **automatic detection of phase-exit** (e.g., auto-firing when the last wave of a phase reaches `completed`). The v1 version is user-triggered and template-driven; the output file is identical to what v2's automation will produce.

**v1 minimum viable handoff mechanism:**
1. User runs `/do:project phase complete` (explicit, not auto-triggered).
2. `project-state.cjs` validates that every **in-scope** wave in the active phase has `status: completed` (per §3 phase completion rule); blocks with an error otherwise. Out-of-scope waves are surfaced in the handoff as deferred (see step 3) but do not block the transition.
3. `stage-phase-exit.md` reads: `project.md`, `phase.md`, and each wave's `wave.md` **frontmatter fields** (`scope`, `status`, `modified_files`, `unresolved_concerns`, `discovered_followups`, `wave_summary`; see §2). All inputs are on `wave.md` frontmatter directly — there is no sibling task file and no prose parsing. It renders `handoff-template.md` with slot-filled content:
   - `## What Shipped` — for each wave with `status: completed`, one line taken from `wave.md`'s `wave_summary` frontmatter field (populated at wave completion by do-verifier via `stage-wave-verify.md`). The wave.md body section `## Review Notes` remains for human readability but is not a `stage-phase-exit.md` input.
   - `## What Remains` — three structured buckets: (a) waves with `status: abandoned` or `status: blocked` (one row per wave with its frontmatter status + last changelog reason); (b) waves with `scope: out_of_scope` (one row, labelled as deferred); (c) each wave's `discovered_followups[]` entries where `promote == wave` (work routed to a follow-up wave in a future phase).
   - `## Open Decisions` — concatenation of each wave's `unresolved_concerns[]` entries, grouped by severity (blocking > warning > info). Read directly from frontmatter — no heuristic scraping.
   - `## Files of Record` — dedup + sort of every wave's `modified_files[]` (each wave's canonical list written by do-executioner, per §2), plus `project.md` and `phase.md`.
   - Backlog-promotion note — if any `discovered_followups[]` entry has `promote == backlog`, `stage-phase-exit.md` emits a reminder line at the end of `handoff.md`: "N follow-ups flagged for backlog promotion; run `/do:backlog add` for each." (It does not auto-promote; user consent is required. `/do:backlog` is untouched — the user runs it themselves.)
   - `## Next Phase Entry Prompt` — **literal copy-paste-ready string** the user pastes into a fresh session. **Conditional rendering:** this section is emitted ONLY IF `project.md`'s `phases[]` array has a next in-scope phase after the one just completed. On terminal phase (no next phase exists), this section is replaced by `## Project Completion Hint` — a single line: "This was the final phase. Run `/do:project complete` to finalise the project." No copy-paste resume prompt is emitted because there is no next phase to resume to. Terminal detection is done by `stage-phase-exit.md` at render time by reading `project.md`'s `phases[]` in order and checking whether any subsequent entry exists.
     ```
     Resume project <slug> at phase <next-phase>.
     Read these files first, in order:
       1. .do/projects/<slug>/project.md
       2. .do/projects/<slug>/phases/<prev>/handoff.md
       3. .do/projects/<slug>/phases/<next>/phase.md
     Then run: /do:project resume
     ```
4. Output is written to `.do/projects/<slug>/phases/<prev>/handoff.md`.
5. **State transition is owned by β, not by `stage-phase-exit.md`.** The `/do:project phase complete` subcommand (routed in `skills/do/project.md`, shipped by Task β) validates the completion precondition (step 2), then calls `project-state.cjs` to set the previous phase `completed`, clear / update `active_phase` in `project.md`, and append to `changelog.md`. **Next-phase promotion is conditional on non-terminal:** if `project.md`'s `phases[]` array has a next in-scope phase after the one just completed, β promotes it to `planning` and sets `active_phase` to its slug. **Terminal-phase behaviour:** if no next phase exists (the completed phase is the last in-scope entry in `phases[]`), β sets `active_phase: null` and leaves `project.md`'s status as `in_progress` — it does **NOT** auto-transition the project to `completed`. Explicit `/do:project complete` is still required (§12). The changelog entry for a terminal-phase completion records "final phase completed, awaiting `/do:project complete`" as the transition reason. After the state transition returns successfully, β invokes `stage-phase-exit.md` (shipped by γ) as the **render step** — `stage-phase-exit.md` is purely a reader/renderer: it reads the now-updated phase state + each wave's frontmatter, renders `handoff-template.md` into `handoff.md`, and returns. It does NOT call `project-state.cjs` and does NOT mutate any frontmatter. Without γ, β's `/do:project phase complete` still performs the state transition (terminal-aware per above) but prints "Handoff artefact pending (Task γ)" in place of the render step — users get a working transition; the cold-start pack lands with γ. (This preserves the iteration-6 β/γ split: β ships state transition, γ adds handoff render.)
6. **`/do:project` (β's skill) prints the handoff hint** inline in the terminal after the render step completes. **Non-terminal phase:** β reads the `## Next Phase Entry Prompt` block out of the `handoff.md` γ just wrote and prints it, suggesting: "Phase `<prev>` complete. Consider `/clear` and paste the prompt above into a fresh session." **Terminal phase:** β reads the `## Project Completion Hint` block instead (γ emits this in place of `## Next Phase Entry Prompt` per step 3's conditional rendering) and prints that single line: "This was the final phase. Run `/do:project complete` to finalise the project." No copy-paste resume prompt is printed because there is no next phase to resume to. Detection is the same rule as step 5 (check `project.md`'s `phases[]`). Without γ (fall-through behaviour), β skips the terminal print entirely — there is no `handoff.md` to read from — and the "Handoff artefact pending" message from step 5 is the only user-visible output, regardless of whether the completed phase was terminal or non-terminal.
7. **The user, not the tool, runs `/clear`.** We do not try to clear context automatically — that is the user's call and session hygiene. What v1 guarantees is that the state survives and the resume prompt is deterministic.

**v2 additions (deferred):** automatic phase-exit detection on last-wave-completed; do-verifier phase-exit variant that *critiques* the rollup (not just template-fills); multi-phase handoff chains (phase 3 sees handoff from phase 2 which sees handoff from phase 1) as a single "project state snapshot" rather than isolated files.

**Cold-start resume flow (`/do:project resume`):**
1. Read `.do/config.json` → `active_project` slug.
2. Read `<slug>/project.md` frontmatter → `active_phase`, project status.
3. **Branch on `active_phase`:**
   - **Non-null `active_phase` (normal case):** read `phases/<active_phase>/phase.md` frontmatter → `active_wave`, phase status. Proceed to step 4.
   - **`active_phase: null` AND `status: in_progress` AND every in-scope phase in `project.md`'s `phases[]` has `status: completed` (terminal-pre-complete gate):** this is the valid "awaiting `/do:project complete`" state locked by iteration 8 and consumed by §12 / §13. Skip the `phase.md` read and skip the `wave.md` read (there is no active phase or active wave to read). Proceed to step 5 with project-only scope.
   - **`active_phase: null` AND any other combination** (e.g., `status: planning` with no active phase, OR `status: in_progress` with at least one in-scope phase still incomplete): this is the broken state §13's `activeProjectNoActivePhase` flags. Do not attempt to resume. Display: "Project `<slug>` is in an inconsistent state (`active_phase: null` but in-scope phases incomplete). Run `/do:init` for diagnostics." and **STOP**.
4. If an `active_wave` exists, read `wave.md` frontmatter → wave status and stage.
5. Invoke `resume-preamble-project.md`'s step-by-step (see §7.5 for the full numbered spec) targeting `project.md`, then `phase.md`, then `wave.md` in order. Each invocation runs the full R0.1-R0.6p sequence against that single target file. The task-pipeline's `resume-preamble.md` is NOT invoked from the project pipeline — it stays hardcoded to `.do/tasks/` and `/do:continue`. **Terminal-pre-complete override (step 3 branch 2):** if step 3 hit the terminal-pre-complete gate, invoke `resume-preamble-project.md` ONLY on `project.md` (with `<target-file-type>: project`). Do not invoke it for `phase.md` or `wave.md` — there is no active phase or wave to target.
6. Show a unified resume summary: project stage, active phase, active wave, last action from `changelog.md`. **Terminal-pre-complete override:** when step 3 hit the terminal-pre-complete gate, the summary instead reads: "Project complete pending — all in-scope phases done. Run `/do:project complete` to finalise." No active phase / active wave lines are printed (both are null by construction).
7. Hand off to the appropriate project-specific stage reference (`stage-project-intake` / project-plan / phase-plan / wave-plan / wave-exec / wave-code-review / wave-verify / phase-exit / project-complete) based on state. **Terminal-pre-complete override:** routing is advisory only — do NOT auto-invoke `stage-project-complete.md`. Instead, print the advisory line from step 6 and return control to the user. This matches §12's user-triggered completion pattern (completion is always explicit, never auto). The user then runs `/do:project complete` themselves to enter `stage-project-complete.md`.
8. **`/do:project resume` is the only entry point for resuming a project.** `/do:continue` does not route to project state — it continues to handle `.do/tasks/` only. (See §10 and O-22.)

---

### 7.5. Project resume preamble — step-by-step spec for `resume-preamble-project.md`

This sub-section specifies the full numbered step-by-step for the project-pipeline sibling preamble shipped by Task γ (§14). It is the authoritative spec γ's author implements; §1's delegated-references entry and §7 step 5 reference this sub-section.

**Structural parallel:** the task-pipeline's `resume-preamble.md` runs R0.1–R0.6 against a single task file (`.do/tasks/<active_task>`). Its step list is: R0.1 load task markdown; R0.2 detect context state; R0.3 reload context via `load-task-context.cjs`; R0.4 handle stale references; R0.5 display resume summary (stage-keyed "last action" table); R0.6 mid-execution progress check (execution stage only).

**Project-pipeline adaptation:** `resume-preamble-project.md` is invoked **once per target file** by `stage-project-resume.md` — in the order `project.md` → `phase.md` → `wave.md` (per §7 step 5). Each invocation runs the full R0.1p–R0.6p sequence against that single target file. The `p` suffix disambiguates from the task-pipeline's R0.* steps. The three task-pipeline primitives that must be replaced are: (1) `load-task-context.cjs "<task-description>"` keyword context loader — replaced by project-native reads; (2) task-file stage table (`grilling / execution / verification / verified`) — replaced by target-file-type stage table keyed on which of project.md / phase.md / wave.md is current target; (3) `/do:continue` references — replaced by `/do:project resume`. "Last action" source is also replaced: task pipeline reads the Execution Log; project pipeline reads `changelog.md` (at project scope) or the target file's Execution Log (at wave scope).

**Caller contract:** `stage-project-resume.md` passes two inputs on each invocation: `<target-file-path>` (absolute path to project.md / phase.md / wave.md) and `<target-file-type>` (one of `project` / `phase` / `wave`). All sub-steps below consume these inputs.

---

**Step R0p — Resume check (project pipeline).** Run this at the start of every `/do:project resume` invocation, once per target file, before stage-specific logic.

---

**Step R0.1p — Load target-file markdown**

Read the target file from `<target-file-path>`.

Parse YAML frontmatter. Fields differ per `<target-file-type>` (§2 schemas):
- `project`: `project_schema_version`, `slug`, `id`, `title`, `status`, `active_phase`, `confidence`, `phases[]`, `council_review_ran.project_plan`.
- `phase`: `project_schema_version`, `project_slug`, `phase_slug`, `status`, `scope`, `active_wave`, `waves[]`, `entry_context[]`, `confidence`, `council_review_ran.plan`, `backlog_item`.
- `wave`: `project_schema_version`, `project_slug`, `phase_slug`, `wave_slug`, `status`, `scope`, `stage`, `stages`, `confidence`, `council_review_ran.{plan,code}`, handoff-harvest fields (`modified_files`, `unresolved_concerns`, `discovered_followups`, `wave_summary`), `backlog_item`.

Extract from markdown body (body sections differ per type per §2):
- `project`: `## Vision`, `## Target Users`, `## Non-Goals`, `## Success Criteria`, `## Constraints`, `## Risks`, `## Phase Plan`.
- `phase`: `## Goal`, `## Entry Criteria`, `## Exit Criteria`, `## Wave Plan`, `## Concerns`, `## Review Notes`, `## Exit Summary`.
- `wave`: `## Problem Statement`, `## Approach`, `## Concerns`, `## Execution Log` (parse last entry: `### YYYY-MM-DD HH:MM`), `## Verification Results`, `## Review Notes`, `## Council Review`.

---

**Step R0.2p — Detect context state**

Same heuristic as task-pipeline R0.2 (Claude cannot reliably introspect its context window), with one wrinkle: `stage-project-resume.md` calls this preamble three times in a row. After the first invocation, subsequent invocations (for phase.md, wave.md) can assume the project-level context is already loaded in the current conversation if the first invocation has completed without a stale-reference stop — so R0.3p's reads for the second and third invocations are additive, not full reloads. If in doubt, proceed to R0.3p.

**Skip reload ONLY if:**
- Context was explicitly loaded earlier in this conversation (e.g., user ran `/do:project new` or a prior `/do:project resume` in the same session).
- The current conversation already contains references to the target file's specific details.

---

**Step R0.3p — Reload context (project-native)**

This step replaces the task-pipeline's `load-task-context.cjs` invocation entirely. The project pipeline does not use keyword-based context matching — the project's context is already fully specified on disk in structured form. Read, in order:

1. **Always (on any invocation):** the target file itself (already loaded in R0.1p — no re-read).
2. **If `<target-file-type>` == `project`:** read the `project.md` body sections (`## Vision`, `## Target Users`, `## Non-Goals`, `## Success Criteria`, `## Constraints`, `## Risks`, `## Phase Plan`) to reload project-level intent. If `database_entry` frontmatter field is non-null, read that database project.md too.
3. **If `<target-file-type>` == `phase`:** read the phase's `entry_context[]` frontmatter array and load each listed path. Typical entries: `project.md`, `phase.md`, `handoff.md` (previous phase, if prior phase exists). If `backlog_item` is non-null, optionally read the backlog entry (non-blocking — if the backlog item is gone, note it but do not stale-fail).
4. **If `<target-file-type>` == `wave`:** read the parent phase's `phase.md` (`## Wave Plan` section for this wave's entry context). Read the previous phase's `handoff.md` if one exists. Read each of `project.md`'s `## Constraints` and `## Risks` bodies (for cross-cutting awareness).
5. **Changelog read (always, at project scope):** read the last 10 entries of `.do/projects/<project_slug>/changelog.md`. The `<project_slug>` here is always the project-level slug from `project.md` frontmatter, regardless of `<target-file-type>` — there is one changelog per project at the project root, not per phase or per wave. This informs R0.5p's "last action" rendering.

For each path resolved above:
- Check if file exists.
- If missing, add to `stale_refs` list (with the field or section that pointed at it — e.g., "phase.md `entry_context[]` path N").
- If exists, read file to reload context.

**No keyword matching, no fuzzy path matching.** All paths are structured and come directly from frontmatter fields or from the known folder layout in §2. This is a strict improvement over the task pipeline's keyword-based context loading because the project pipeline's on-disk state is already fully typed.

---

**Step R0.4p — Handle stale references**

If `stale_refs` is non-empty, display blocking prompt:

```
Referenced doc(s) not found:
- <path1> (pointed at by <field/section>)
- <path2> (pointed at by <field/section>)

Options:
1. Continue without them (<target-file-type>.md has enough context to resume)
2. Stop and locate the docs

Enter 1 or 2:
```

Wait for user response:

- **If "1":**
  - Append a line to `.do/projects/<project_slug>/changelog.md` (changelog always lives at project root; `<project_slug>` is the project-level slug). The log-line label qualifies the target by its full slug path per `<target-file-type>`:
    - `project` target: `<timestamp>  project:<project_slug>  resume  reason: continued without missing docs: [<path1>, <path2>]`
    - `phase` target: `<timestamp>  phase:<project_slug>/<phase_slug>  resume  reason: continued without missing docs: [<path1>, <path2>]`
    - `wave` target: `<timestamp>  wave:<project_slug>/<phase_slug>/<wave_slug>  resume  reason: continued without missing docs: [<path1>, <path2>]`
  - Continue to R0.5p.
- **If "2":**
  - Display: "Locate the missing docs, then run `/do:project resume` again."
  - **STOP** — do not proceed with stage-specific logic; do not call the next nested preamble invocation.

---

**Step R0.5p — Display resume summary**

Determine "last action" based on `<target-file-type>` and the target file's current `status` / `stage` field. The table below is keyed on target-file-type (not on a single task-pipeline stage enum — that is the primary replacement):

| Target file type | Status / stage | Last action source |
|---|---|---|
| `project` | `intake` | Last Q&A pair from most recent `.do/projects/<slug>/intake/session-*.md`, or "Intake not started" |
| `project` | `planning` | "Project plan in review" + last `council_review_ran.project_plan` state |
| `project` | `in_progress` (has `active_phase`) | Last entry from `.do/projects/<slug>/changelog.md` (top-level project activity summary) |
| `project` | `in_progress` (`active_phase: null`, every in-scope phase `completed`) | "Project complete pending — all in-scope phases done. Run `/do:project complete` to finalise." (terminal-pre-complete; see §7 cold-start resume step 3 branch 2) |
| `project` | `blocked` | Last changelog entry with reason field |
| `project` | `completed` / `abandoned` | Terminal — should not normally reach R0.5p for these states |
| `phase` | `planning` | "Phase plan in review" + last `council_review_ran.plan` state |
| `phase` | `in_progress` | Last changelog entry scoped to `phase:<project_slug>/<phase_slug>` (qualified per R0.4p log-label convention) |
| `phase` | `blocked` | Last changelog entry for this phase with reason |
| `phase` | `completed` | "Phase complete" + handoff.md path if rendered |
| `wave` | `planning` | "Wave plan in review" + last `council_review_ran.plan` state |
| `wave` | `in_progress` + stage == `execution` | Summary from last Execution Log entry on the wave.md (Files + Status), or "Execution not started" |
| `wave` | `in_progress` + stage == `verification` | "Verification in progress" + `stages.verification` status |
| `wave` | `blocked` | Last changelog entry for this wave with reason |
| `wave` | `completed` | `wave_summary` frontmatter field (one-sentence summary) |

Display resume summary:

```
Resuming: <project-slug> / <phase-slug?> / <wave-slug?> (<target-file-type> stage: <status>)
Last action: <summary from table>

Continue? (yes/no)
```

Wait for user confirmation:

- **If "yes" or "y":** Continue to R0.6p.
- **If "no" or "n":** Display: "Paused. Run `/do:project resume` when ready." and **STOP**.

---

**Step R0.6p — Mid-execution progress check (wave-scope only)**

**Only applies when `<target-file-type>` == `wave`** AND the wave is at `stage: execution` AND its `## Execution Log` has at least one entry AND the last entry's Status is NOT "Execution complete".

At project and phase scope, this step is a no-op — those target files do not carry an Execution Log (they carry plan / changelog rollup instead). `stage-project-resume.md` moves to the next nested preamble invocation without running R0.6p for project.md and phase.md targets.

**Step R0.6.1p — Parse Approach into steps.** Read the wave.md `## Approach` section and extract discrete steps (numbered-list or bullet patterns), same heuristic as task-pipeline R0.6.1.

**Step R0.6.2p — Match completed work to steps.** Parse the wave.md `## Execution Log`'s `**Files:**` entries AND the `modified_files[]` frontmatter array (§2 canonical source) to identify completed work. The frontmatter array is authoritative; the body section is human-readable.

**Step R0.6.3p — Display progress checklist.**

```
Wave execution paused. Progress so far:
- [x] <completed step from approach, matched to modified_files[]>
- [x] <another completed item>
- [ ] <remaining step from approach>

Continue from here? (yes/no)
```

Wait for user confirmation:

- **If "yes" or "y":** Skip any wave-level context-clear decision; continue from `stage-wave-exec.md` for remaining items.
- **If "no" or "n":** Display: "Paused. Run `/do:project resume` when ready." and **STOP**.

---

**Files referenced by the spec:**
- Target file: one of `.do/projects/<slug>/project.md` / `.do/projects/<slug>/phases/<p>/phase.md` / `.do/projects/<slug>/phases/<p>/waves/<w>/wave.md`.
- Project changelog: `.do/projects/<slug>/changelog.md`.
- Phase handoff: `.do/projects/<slug>/phases/<p>/handoff.md` (only if the phase is past its handoff render).
- Intake sessions: `.do/projects/<slug>/intake/session-*.md` (project scope only).
- Database project.md (optional): pointed at by `project.md` `database_entry` frontmatter field.

**Not referenced:** `load-task-context.cjs` (task-pipeline primitive; replaced by structured reads above), `.do/tasks/<file>.md` (task-pipeline surface; isolated from project pipeline per §10), `/do:continue` (task-pipeline command; project pipeline uses `/do:project resume` per §7 step 8).

---

### 8. Agent coverage map — agents are caller-agnostic

**LOCKED DECISION (post-iteration-3 split, post-iteration-4 refinement):** every agent (`do-executioner`, `do-verifier`, `do-code-reviewer`, `do-planner`, `do-plan-reviewer`, `do-council-reviewer`, `do-griller`, `do-debugger`) is — or **will be made** — **caller-agnostic**: it takes a target file path and does its job without referring to a specific pipeline. The `/do:project` pipeline spawns the same agents from project-specific stage references; only the spawning prompt differs (different target file, different slot-fill text). **No new agents are introduced.** There is no `do-wave-executor`, no `do-phase-executor`, no `do-project-planner` agent — those are *stage references* invoking the existing agents with wave-aware / phase-aware / project-aware prompts.

**Agent-spec revisions required (LOCKED — option (a) chosen over prompt-override hacks):** several agent specs today contain task-pipeline-specific language that contradicts the caller-agnostic claim. This must be fixed at the source, not papered over with prompt overrides. Under Task β (§14), the following agent spec files receive targeted edits:

| Agent spec | Lines with task-pipeline language | Required edits |
|---|---|---|
| `agents/do-verifier.md` | 83 (`.do/tasks/<active_task>`), 190–198 (`/do:task` / `/do:continue` in failure flows), 212–213 (same in complete flows), 273 (`active_task: null` — specific to task pipeline), 283 (`active_task: null` output), 285 (`Task file: .do/tasks/<filename>`), 292 (`task file content` heuristic), 320 (spawn new `/do:task`), 334 (`Run: /do:task ...`), 348 (`Task: .do/tasks/<task-filename>`), 353 (`/do:continue`), 377–378 (fix instructions mention `/do:task` + `/do:continue`), 381 (`task file`), 391 (`task file` in checklist) | **(a) Terminological:** Remove hardcoded `.do/tasks/<active_task>` paths; replace with "caller-provided target file path". Remove `/do:task` / `/do:continue` from failure-instruction branches; replace with "return control to the caller; the caller decides next-step routing." Keep "target file" as the abstract term. Remove `active_task` config clears; replace with "clear whatever active-pointer the caller owns." **(b) NEW RESPONSIBILITY — structured handoff write:** At end of verification, if the target file's frontmatter contains an `unresolved_concerns: []` array (wave.md shape), write any concerns the verifier could not close into that array using the `{ title, body, severity: info\|warning\|blocking }` shape from §2. If the array is absent (plain task file), skip — no-op for standalone task runs. Append to `discovered_followups[]` likewise, using `{ title, body, promote: wave\|backlog\|none }`. Additionally, if the frontmatter contains a `wave_summary` key (wave.md shape), write a one-sentence summary of what the wave shipped into it (derived from the verifier's pass summary); if absent, skip. Array/key presence is the switch; no pipeline-detection logic in the agent. |
| `agents/do-executioner.md` | 18 (`task file provided in the prompt`), 25 (same), 35 (`task file's Execution Log`), 136 (`Update task file`), 199 (`Use /do:continue to resume after fixing the issue`), 202 (`Update task file stage to execution with status blocked`) | **(a) Terminological:** Replace "task file" → "target file (path provided in the prompt)". Remove `/do:continue` from the on-failure message; replace with "return control to the caller; the caller's orchestrator will decide retry routing." Keep the Execution Log / stage update semantics (both task files and wave.md carry these sections). **(b) NEW RESPONSIBILITY — structured handoff write:** At end of execution, if the target file's frontmatter contains a `modified_files: []` array, write the full repo-relative list of files touched in this run into it. If the frontmatter also contains `discovered_followups: []`, append any discoveries surfaced during execution using the `{ title, body, promote: wave\|backlog\|none }` shape. Array presence is the switch — no-op if absent. The existing human-readable `## Execution Log` write remains; the new frontmatter write is the canonical machine-readable list (per §2 source-of-truth note). |
| `agents/do-planner.md` | 3 (description mentions `/do:task` + `/do:continue`), 15–16 (spawn list hardcoded to `/do:task` and `/do:continue`), 92 (`task file`) | Generalise the "Spawned by" list to include project-pipeline callers (or make it a caller-neutral "entry command sets context and provides target file path"). Replace "task file" → "target file". |
| `agents/do-plan-reviewer.md` | 3 (description: `task file`), 12 (same), 15 (`Read the task file`), 33 (same) | Replace "task file" → "target plan file (path provided in the prompt)". No hardcoded paths present; changes are purely terminological. |
| `agents/do-code-reviewer.md` | 3 (description: `task file`), 12 (same), 15 (same), 34 (same) | Same terminological substitution as plan-reviewer. |
| `agents/do-council-reviewer.md` | 17, 25, 36, 53 — all reference "task file" but no hardcoded paths; it already accepts `<task_file_path>` as a parameter | Rename the variable/term in prose from "task file" to "target file" for consistency. Behaviour unchanged — already caller-agnostic by construction. |
| `agents/do-griller.md` | 17, 45, 91, 190 — all reference "task file" | Terminological substitution; already does not hardcode paths or pipeline commands. |
| `agents/do-debugger.md` | (none) | No changes needed. Already caller-agnostic. |

**Kinds of edits:**

*Terminological (minor — applies to all seven affected agents):*
1. **Remove hardcoded `.do/tasks/<active_task>` literals** from any failure branch, prompt template, or output example. Replace with the abstract "target file path provided by caller".
2. **Remove `/do:task` and `/do:continue` suggestions** from failure or blocked states. Replace with "return control to the caller without recommending a specific `/do:` subcommand — the caller's orchestrator owns retry routing."
3. **Remove `active_task` literal field references** from agent bodies that clear or write config. Replace with "clear the caller-owned active pointer (whatever key the caller passes)." Agents that actually write config clears stay in the task pipeline's scope; the project pipeline's `project-state.cjs` handles project-side clears.
4. **Substitute "task file" → "target file"** in prose. The abstract term carries over: both `.do/tasks/<file>.md` and `wave.md` have the same body sections.
5. **Leave the "Spawned by" comments caller-inclusive.** Either list both pipelines ("`/do:task` / `/do:continue` / `/do:project wave` / `stage-wave-*.md`"), or switch to a caller-neutral phrasing.

*Behavioural (only do-executioner and do-verifier — new responsibility, not a rename):*
6. **Structured handoff-field writes on frontmatter-presence.** do-executioner writes `modified_files[]` (canonical list) and `discovered_followups[]` into the target file's frontmatter at end of execution **if those arrays exist in the file's frontmatter**. do-verifier writes `unresolved_concerns[]`, `discovered_followups[]`, and `wave_summary` (one-sentence summary) at end of verification on the same presence-check rule. For plain task files (no such arrays/keys), this is a no-op — existing `/do:task` callers are unaffected. Array/key presence is the only switch; neither agent detects pipelines. This behaviour is spec'd in §2 (ownership table) and consumed by `stage-phase-exit.md` in §7.

Edits 1-5 are **terminological cleanup**. Edit 6 is a **small new responsibility** gated on frontmatter shape. All live inside Task β's scope (§14) because the project-side stage references depend on the new behaviour. Task α does not touch agent specs.

**Council plan-review gates in v1:** three gates, one sibling stage reference each:
- `stage-project-plan-review.md` — project plan (targets `project.md`, updates `project.md` `council_review_ran.project_plan`). Council gated by `council_reviews.project.plan`.
- `stage-phase-plan-review.md` — phase plan (targets `phase.md`, updates `phase.md` `council_review_ran.plan`). Council gated by `council_reviews.project.phase_plan`. *Unlike the iteration-2 plan which deferred phase-plan council to v2, the full split removes the coupling cost that made deferral attractive — sibling files are cheap, so we ship all three gates.*
- `stage-wave-plan-review.md` — wave plan (targets `wave.md`, updates `wave.md` `council_review_ran.plan`). Council gated by `council_reviews.project.wave_plan`.

Each sibling duplicates the PR-0..PR-5 iteration structure from the existing `stage-plan-review.md` but targets a different file. Duplication cost accepted (iteration-1 finding #2 logic extended).

**Agent coverage map (all agents, no new ones):**

| Agent | Where it fires in `/do:project` v1 | Spawning stage reference |
|---|---|---|
| **do-griller** | Project intake (Passes 1-2); per-phase confidence re-grill (Pass 3); per-wave confidence rescue (§6 step 3a + §14 Task β per-wave confidence rescue bullet — same `project_intake_threshold` knob, wave.md target). | `stage-project-intake.md` + inline from plan-review references |
| **do-planner** | Three prompt shapes: project-planner (intake → phase list), phase-planner (phase → wave list), wave-planner (wave plan). | `stage-project-plan-review.md` PR-0 region, `stage-phase-plan-review.md` PR-0, `stage-wave-plan-review.md` PR-0 |
| **do-plan-reviewer** | Self-review at all three plan-review gates. | All three `stage-*-plan-review.md` |
| **do-council-reviewer** | Council review at all three plan-review gates (config-gated per level); wave code review. | All three `stage-*-plan-review.md` + `stage-wave-code-review.md` |
| **do-executioner** | Per wave. Target file: `wave.md`. Writes `modified_files` and `discovered_followups[]` into wave.md frontmatter at end of execution. | `stage-wave-exec.md` |
| **do-code-reviewer** | Per wave. Target file: `wave.md` (reviews the diff produced during execution). | `stage-wave-code-review.md` |
| **do-verifier** | Per wave. Target file: `wave.md`. Writes `unresolved_concerns[]` for unclosable concerns. | `stage-wave-verify.md` |
| **do-debugger** | Per wave via explicit user invocation or `stage-wave-verify.md` failure routing. Target file: `wave.md`. Phase-level debugger (`--phase`) is v2. | `stage-wave-verify.md` (debug branch) |

**Key invariant:** the agents are identical binaries to the ones `/do:task` uses. The only difference between a `/do:task` execution and a `/do:project` wave execution is the target file path and the spawning stage reference. This is what makes the split cheap: we duplicate stage-reference structure, not agent logic.

---

### 9. Relationship to existing commands — full split, agent reuse

**LOCKED DECISION (post-iteration-3, refined post-iteration-4):** `/do:project` neither calls `/do:task` nor replicates it. It is a parallel pipeline that **reuses existing AGENTS** (made genuinely caller-agnostic via minor spec edits — see §8 table) via **project-specific stage references** (siblings of the task-pipeline ones). This is the "replicate stage references, reuse agents (with agent-spec clean-up)" path.

| Option | Pros | Cons |
|---|---|---|
| Iteration-2 Call path via `.do/tasks/` bridge | zero stage-reference duplication | shared `active_task` surface; cross-command guards; resume-command confusion; breaks isolation |
| **Full split, reuse agents with spec clean-up (chosen)** | no shared state; no guards; isolation is airtight; each half evolves independently; agents genuinely caller-agnostic (no prompt-hack overrides) | duplicate stage-reference structure (~200 lines per gate); two places to fix plan-review structural changes; one-time agent-spec revision to purge task-pipeline literals |
| Full replicate (new agents too) | fully independent | massive agent-prompt duplication; drift; no shared bug-fix path |
| Prompt-override hack (leave agent specs, inject overrides in each project-side stage ref) | zero agent-spec churn | brittle — agents still carry task-pipeline language in their spec and may fall back to it when in doubt; every new project-side stage reference must include the override block; hides coupling behind prompt hacks |

Chosen path: **full split of stage references + state, with shared agents + one-time agent-spec revision.** Duplication cost accepted. Agent-spec revision lands in Task β (§14) and is a MINOR edit per agent (terminology substitution, removal of hardcoded `.do/tasks/` / `/do:task` / `/do:continue` / `active_task` literals). Option "prompt-override hack" rejected as brittle — making the agents genuinely caller-agnostic IS the reuse story. See O-31 for the drift-prevention guard.

---

### 10. Isolation model — `/do:project` does not touch `.do/tasks/` or `active_task`

**LOCKED DECISION (post-iteration-3):** there is **no cross-command guard**. `/do:project` owns `active_project` + `.do/projects/`; `/do:task` / `/do:fast` / `/do:quick` / `/do:continue` / `/do:backlog` own `active_task` + `.do/tasks/`. Neither system reads or writes the other's state. The two pipelines are fully orthogonal.

**State ownership table:**

| State | Owner | Read by |
|---|---|---|
| `.do/config.json` `active_task` | `/do:task`, `/do:fast`, `/do:quick`, `/do:continue`, `/do:backlog`, `/do:abandon` | same set |
| `.do/tasks/<file>.md` | task pipeline | task pipeline |
| `.do/config.json` `active_project` | `/do:project` | `/do:project` |
| `.do/projects/<slug>/project.md` `active_phase` | `/do:project` | `/do:project` |
| `.do/projects/<slug>/phases/<p>/phase.md` `active_wave` | `/do:project` | `/do:project` |
| `.do/projects/<slug>/**/wave.md` | `/do:project` | `/do:project` |

**Consequences of isolation:**
- A user CAN run `/do:task "unrelated thing"` mid-phase. It will set its own `active_task` and run to completion independently. The project state is preserved — `active_project` / `active_phase` / `active_wave` are untouched because `/do:task` doesn't know about them.
- `/do:continue` resumes the current `.do/tasks/<active_task>` file, regardless of whether a project is active. It never routes to a wave.
- `/do:project resume` is the ONLY way to resume a project. See §7 step 8 and O-22.
- `/do:backlog` is untouched — the project pipeline does not auto-promote discoveries; the user runs `/do:backlog add` themselves if prompted by `stage-phase-exit.md`.

**Optional soft-warning (recommendation, not a hard guard):** `/do:task` Step 0 MAY emit a one-line notice when `active_project` is set ("Note: project `<slug>` is currently active. This standalone task will run in parallel and does not affect project state."). This is a UX hint, not an isolation mechanism, and can ship as a low-risk courtesy edit. See O-30.

**Not a regression from iteration-2:** iteration-2 had the guard because it specified the project pipeline to write `active_task`. The full split removes the underlying write, which removes the need for the guard.

---

### 11. Backlog integration

**Decision (default, revisable):** `/do:project` is **mostly self-contained**. The only touchpoints with `.do/BACKLOG.md` are the two seed-and-consume operations below; no other automation exists between the project pipeline and `/do:backlog`.

- **Promotion (project → backlog):** any "Discovered" item logged by do-executioner during a wave that is *explicitly out of scope for the current project* can be promoted to the backlog via `/do:backlog add`. This is manual, not automatic — do-executioner already logs discoveries in `discovered_followups[]` (per §2); the user decides whether to run `/do:backlog add` for entries flagged `promote == backlog` (reminder emitted by `stage-phase-exit.md` per §7).
- **Demotion (backlog → project):** a backlog item can seed a new phase or wave.
  - `/do:project phase new --from-backlog <id>` calls `project-scaffold.cjs` first (generic scaffold, no backlog knowledge), then β performs a post-scaffold mutation: reads the backlog entry, fills `phase.md` `## Goal` with the entry's problem/fix content, and sets `backlog_item: <id>` in frontmatter. **Ownership:** β's `phase new` handler owns the backlog read + body write. `project-scaffold.cjs` is not modified.
  - `/do:project wave new --from-backlog <id>` does the analogous thing for `wave.md` (post-scaffold mutation: fills `## Problem Statement`, sets `backlog_item: <id>`). **Ownership:** β's `wave new` handler. Same separation — scaffold generic, β mutates.

**`/do:backlog done <id>` auto-trigger (locked):** fired in exactly two places, both inside the project pipeline's state-transition side (Task β — never γ):

1. **Phase complete.** Inside the `/do:project phase complete` flow owned by Task β (§14): **immediately after** `project-state.cjs` writes the phase `status: completed` transition and appends to `changelog.md`, **and only if** `phase.md` frontmatter has `backlog_item != null`, the skill invokes `/do:backlog done <backlog_item>`. This runs on β's state-transition side, *before* γ's `stage-phase-exit.md` handoff render — they are independent steps.
2. **Wave complete.** Inside `stage-wave-verify.md`'s success path (§6 step 5): after the wave's `status: completed` write, **and only if** `wave.md` frontmatter has `backlog_item != null`, the stage reference invokes `/do:backlog done <backlog_item>`.

If `backlog_item == null` (the normal case for waves/phases not seeded from backlog), nothing fires. `/do:backlog` is **not** modified — the project pipeline calls its existing `done` subcommand. No other direction of automation exists: the project pipeline never auto-`add`s, never auto-`start`s, never reads backlog state beyond the explicit `--from-backlog <id>` seed read.

Waves are **not** auto-promoted to the backlog. A wave is already inside a plan; adding it to the backlog would duplicate the unit of work.

---

### 12. Completion / archival flow (stage-project-complete.md) — self-contained

**LOCKED DECISION (post-iteration-3, dependency clarified post-iteration-6):** completion is fully self-contained with respect to the task pipeline. `stage-project-complete.md` reads `project.md` and each phase's `handoff.md` (rendered by γ's `stage-phase-exit.md` at each phase boundary), writes `completion-summary.md`, moves the folder, and clears `active_project`. **No interaction with the task pipeline.** No `/do:task` call, no `active_task` read or write, no `.do/tasks/` touch. **Dependency on γ is explicit:** because completion reads each phase's `handoff.md`, `/do:project complete` requires γ to have been shipped and each phase to have passed through `stage-phase-exit.md`. Without γ, β's `/do:project complete` blocks early with "Complete requires phase handoff artefacts (Task γ)." See §14 Task β and Task γ for the delivery-order contract.

**Project complete path:**
1. All in-scope phases are `completed` (enforced by `project-state.cjs` per §3 project completion rule). Out-of-scope phases are ignored. **Canonical pre-state:** per §7 step 5 terminal-phase behaviour, after the final phase's `/do:project phase complete` runs, the project sits at `active_phase: null`, `status: in_progress`, every in-scope phase `completed`. This is the valid "awaiting `/do:project complete`" state that this subcommand consumes — it is not a health-check issue (see §13 note) and does not block. `/do:project complete` transitions the project from that state to `completed` + archival.
2. User runs `/do:project complete`.
3. `stage-project-complete.md` validates the completion precondition (step 1), collects each phase's `handoff.md` path, and renders a **template-filled** `completion-summary.md` at the project root with sections: `## Completed Phases` (one row per phase, linking to its handoff.md), `## Deferred (Out-of-Scope)` (any phase/wave with `scope: out_of_scope`), `## Success Criteria Status` (each bullet from `project.md` `## Success Criteria` with a user-confirmable checkbox — default unchecked; the user edits before confirming), `## Final File Set` (dedup + sort of every wave's `modified_files[]` across all phases, per §7), `## Residual Open Decisions` (concatenation of `unresolved_concerns[]` still flagged across all waves).
4. User confirms (inline prompt: "Review completion-summary.md. Proceed? y/N"). Only interactive step.
5. On confirm: `project.md` status → `completed`, `updated` bumped. `project-state.cjs` moves `.do/projects/<slug>/` → `.do/projects/completed/<slug>/` atomically (per O-19).
6. `.do/config.json` `active_project: null`. `active_task` is not touched (not our concern).
7. Database entry (if linked) gets a completion note appended via `/do:scan update` or manual edit — this is *suggested*, not enforced, because the database is a separate concern.

**Deferred to a future iteration:** do-verifier project-exit variant that *critiques* the summary instead of just filling it; automatic detection of "all phases complete" offering `/do:project complete`; rollup metrics (total waves, total files, token cost if tracked); database entry auto-sync.

**Project abandon path:**
1. User runs `/do:project abandon`.
2. Prompt for reason; append to `changelog.md`.
3. **Cascade is in-scope-only** (matches §3): `project.md` status set to `abandoned` with `pre_abandon_status` recorded from its current `status`. Each **in-scope** descendant phase and wave gets its current `status` copied into `pre_abandon_status` and then its `status` set to `abandoned`. **Out-of-scope descendants are untouched** — their `status` stays as-is and their `scope: out_of_scope` is preserved. Rationale: out-of-scope nodes were explicitly parked and never part of the active workstream, so cascading them to `abandoned` would overload the `scope` field's semantics (a node with both `scope: out_of_scope` AND `status: abandoned` is ambiguous). Keeping them silent is cleaner.
4. `project-state.cjs` moves folder → `.do/projects/archived/<slug>/`.
5. `active_project: null`.
6. Archived projects are terminal. To resume one manually, move `.do/projects/archived/<slug>/` back to `.do/projects/<slug>/` and run `/do:project resume`. **Resume-from-archived restore sequence:** `/do:project resume` detects the returned project's `status: abandoned` (project.md still carries `abandoned` at this point — the folder move does not touch frontmatter). Before delegating to `project-resume.cjs` for routing, it calls `project-state.cjs restore-from-abandoned <slug>`. That op walks project.md + every in-scope phase.md + every in-scope wave.md; for each node with a non-null `pre_abandon_status`, sets `status = pre_abandon_status` then nulls `pre_abandon_status` (atomic temp-file + rename per node). **Out-of-scope nodes are left alone** — they were untouched by the abandon cascade (step 3) so there is nothing to restore: their `scope: out_of_scope` and their original `status` remain intact (per §3 abandon semantics). After `restore-from-abandoned` completes, `project-resume.cjs` reads the now-restored frontmatter and returns the correct next routing action. If the project.md `status` is not `abandoned` at resume time (i.e. the project was moved back but `project-state.cjs` was already run manually), the restore step is skipped — resume proceeds directly to `project-resume.cjs`. No dedicated `--archived` flag exists in v1.

---

### 13. Health-check integration (extends init-health-check.md)

`project-health.cjs` grows these checks (returned as issues in the existing JSON shape, appended to the same `issues[]` array that already carries the script's task-pipeline checks). **No cross-pipeline checks beyond what the script already performs for `/do:init`'s task-pipeline integrity** — the existing checks (`.do/` folder, `config.json` schema, `version`, `project_name`, `council_reviews`, `auto_grill_threshold`, `.do/tasks/` folder, `active_task` integrity) are preserved verbatim; the new checks below are purely additive and concern only the `.do/projects/` shape. No drift-detection across the two pipelines (i.e., the project checks do not read `active_task`, nor do they validate `.do/tasks/` integrity — that remains owned by the pre-existing task-pipeline checks).

| Type | Severity | Description |
|---|---|---|
| `orphanedActiveProject` | error | `.do/config.json` `active_project` points to a folder that does not exist under `.do/projects/` |
| `activeProjectNoActivePhase` | warning | project status is `in_progress` but `active_phase` is null |
| `orphanedActivePhase` | error | `active_phase` points to a phase folder that does not exist |
| `orphanedActiveWave` | error | `active_wave` points to a wave folder that does not exist |
| `orphanProjectFolder` | warning | a folder exists under `.do/projects/` with no matching active/completed/archived state (stale scaffold) |
| `phaseStatusDrift` | warning | `project.md` `phases[].status` disagrees with the corresponding `phase.md` frontmatter |
| `waveStatusDrift` | warning | `phase.md` `waves[].status` disagrees with `wave.md` frontmatter |
| `schemaVersionMismatch` | error | `project_schema_version` in any file does not match the current schema — suggests migration |
| `invalidScopeValue` | error | any `scope` field (phase or wave) has a value other than `in_scope` / `out_of_scope` |
| `illegalScopeTransition` | error | a wave or phase has `status: in_progress` AND `scope: out_of_scope` — forbidden per §3 |
| `missingHandoffFields` | warning | a `completed` wave is missing one of `modified_files` / `unresolved_concerns` / `discovered_followups` arrays (even empty) OR is missing a populated `wave_summary` string — its handoff inputs are not canonical |
| `illegalPhaseTransition` | error | a phase is `completed` but has in-scope waves that are not `completed` |

`/do:init` displays these alongside existing workspace/task issues under a new `Project Issues:` subsection.

**Explicit non-issue — "awaiting `/do:project complete`" state** (preempts health-check confusion): a project with `active_phase: null` AND `status: in_progress` AND at least one phase with `status: completed` AND every in-scope phase `completed` is the valid post-terminal-phase state defined in §7 step 5 and consumed by §12. This is NOT flagged by `activeProjectNoActivePhase` — that warning is scoped to projects where in-scope phases remain incomplete. `project-health.cjs` must distinguish the two: the warning fires only when the project has un-completed in-scope phases AND no `active_phase`. The post-terminal state (every in-scope phase `completed`, waiting on explicit `/do:project complete`) is valid and silent. **Cross-reference:** §7 cold-start resume step 3 branch 2 and §7.5 R0.5p's terminal-pre-complete table row specify the corresponding resume behaviour (advisory-only routing, no auto-invoke of `stage-project-complete.md`). The gate condition is identical across §7, §7.5, §12, and this §13 non-issue paragraph — a single check, consumed by four call sites.

---

### 14. Child execution tasks

**This task file is DESIGN-LOCKED as of iteration 20 and does NOT produce code.** Further precision work is explicitly delegated to child tasks α (project-contract), β (orchestration), γ (resume-handoff). No more iterations on this orchestrator file — remaining nits surface inside the child tasks' own planning passes. Implementation is delivered by three sibling `/do:task` files, authored next (by a separate pass — not inside this task). Each carries `related: ["260418-do-project-orchestrator"]` in frontmatter (add this field to `task-template.md` if absent — minor template extension) and a Problem Statement that references this design file and enumerates the child's scope by quoting from the sections below.

Child tasks are standard `.do/tasks/` files — we are **not** dogfooding the `.do/projects/` shape yet, which would be chicken-and-egg (the shape doesn't exist until Task α ships).

---

**Task α — project-contract** (slug: `project-alpha-contract`)

*Scope:*
- Frontmatter schemas: `project.md`, `phase.md`, `wave.md` (all sections of §2), with `project_schema_version: 1`.
- Folder shape: `.do/projects/<slug>/`, `.do/projects/completed/`, `.do/projects/archived/` (§2).
- `skills/do/references/project-state-machine.md` — **dedicated state-machine reference file** (the authoritative spec consumed by AC #3). Must enumerate: (a) the status enum (`planning | in_progress | blocked | completed | abandoned`) + the project-only leading `intake` status; (b) the orthogonal `scope: in_scope | out_of_scope` field on phase.md / wave.md (default `in_scope`, absent on project.md); (c) the full state diagram as a status × scope matrix for each node type (project, phase, wave); (d) all legal status transitions + all legal scope transitions (per §3); (e) completion rules (phase completes when every in-scope wave `completed`; project completes when every in-scope phase `completed`); (f) **abandon cascade rule with explicit in-scope-only semantics**: `pre_abandon_status` recorded on the project + every **in-scope** descendant phase and wave; their `status` set to `abandoned`. **Out-of-scope descendants are untouched by the cascade** — their `status` remains whatever it was (typically `planning` or `blocked`) and their `scope: out_of_scope` is preserved; (g) resume-from-abandoned restore rule: in-scope nodes restore `status` from `pre_abandon_status` (then null the field); out-of-scope nodes remain `out_of_scope` with their original `status` intact (no field to restore because cascade never touched them); (h) the terminal-pre-complete state definition (`active_phase: null` + `status: in_progress` + every in-scope phase `completed`) as defined in §7 step 5 / §12 / §13. `project-state.cjs` implements what this doc specifies — any divergence is a bug in the script, not the doc.
- `skills/do/scripts/project-state.cjs` — atomic frontmatter R/W, transition validation (§3 rules), `changelog.md` append. Unit tests for every legal + illegal transition including scope transitions. Implementation must match `project-state-machine.md` exactly. **Public ops (all ops load `project-state-machine.md`'s transition table to validate; invalid transitions return non-zero exit + structured JSON error):**
  - **`status <project_slug>`** — read-only. Returns JSON: `{project: {status, active_phase}, phases: [{slug, status, scope, active_wave, waves: [{slug, status, scope}]}]}`. **No `scope` at the project level** — per §2/§3, `scope` is defined only on phase and wave nodes (the project itself is never "out-of-scope" relative to itself). Used by `/do:project status`.
  - **`set <node-type> <path> <new_status>`** — `node-type ∈ {project, phase, wave}`. `path` is slug or slash-delimited slug tuple (e.g. `phase1` for a phase, `phase1/wave2` for a wave). Validates transition against the state machine. Atomic temp-file + rename. Returns old→new transition record as JSON to stdout.
  - **`abandon <node-type> <path>`** — records `pre_abandon_status` on the target node and every **in-scope** descendant (per §3 cascade rule). Sets each such node's `status: abandoned`. Out-of-scope descendants untouched. Atomic per node.
  - **`restore-from-abandoned <project_slug>`** — (per §3 writer-assignment and §12 step 6) walks project.md + all in-scope phase.md + all in-scope wave.md; for each node with non-null `pre_abandon_status`, sets `status = pre_abandon_status` and nulls `pre_abandon_status`; atomic temp-file + rename per node; out-of-scope nodes untouched.
  Unit-tested with a round-trip: abandon cascade → restore-from-abandoned → verify every in-scope node's status matches pre-abandon value and `pre_abandon_status` is null; verify out-of-scope nodes untouched.
- `skills/do/scripts/project-scaffold.cjs` — folder tree creation + template slot-filling. No wave.md / task.md cross-link (§6 removes that). **Op signatures and explicit behaviours (iteration-16 addition):**
  - **Ops:** `project <project_slug>`, `phase <project_slug> <phase_slug>`, `wave <project_slug> <phase_slug> <wave_slug>`.
  - **Prefix allocation:** numeric prefix `NN-` derived from `max(existing prefixes) + 1` within the parent container (`phases/` for phases; `waves/` within a phase folder for waves); zero-padded to 2 digits. First child gets prefix `01-`.
  - **Parent-index update:** on `phase`, append the new phase entry to `project.md`'s `phases: []` frontmatter list in canonical order; on `wave`, append the new wave entry to `phase.md`'s `waves: []` frontmatter list in canonical order. Both writes are atomic (temp-file + rename). The parent file's `updated` timestamp is bumped.
  - **Default frontmatter on new node:** `status: planning`, `scope: in_scope`, `pre_abandon_status: null`, `project_schema_version: 1`, plus all node-type-specific required fields (slug, `created` ISO timestamp, and any arrays such as `phases: []` / `waves: []` / `modified_files: []` / `unresolved_concerns: []` / `discovered_followups: []` per §2 schemas).
  - **Changelog:** append an entry `<ISO-timestamp> scaffold:<op>:<full-path-slug>` to `.do/projects/<project_slug>/changelog.md` after all file writes succeed. Template follows `changelog-template.md`.
  - **Atomicity:** all writes use temp-file + rename. If any step fails mid-op, the caller (β's subcommand handler) is responsible for rollback — β wraps every `project-scaffold.cjs` invocation in a try/catch and re-raises on error. The script does NOT silently swallow errors.
- `skills/do/scripts/project-health.cjs` — **extends** the existing script's `checkProjectHealth()` function with the project-folder checks in §13. The existing task-pipeline integrity checks (`.do/` folder, `config.json` schema, `.do/tasks/`, `active_task` integrity) stay intact and continue to be emitted as part of `/do:init`'s existing coverage; Task α only adds new project-folder check types to the same `issues[]` array under the same JSON return shape. No cross-pipeline checks beyond what the script already performs for `/do:init`.
  - **Config-schema validation additions (mirror the existing `council_reviews` / `auto_grill_threshold` pattern at current lines 114-156):** extend the config validation block to also check the new project-specific keys, emitting `missingField` (warning) when absent and `invalidField` (error) when type-incorrect:
    - `active_project` — must be `string` or `null` (missing is a warning; non-string / non-null is an error — mirror the existing `active_task` type check at current lines 164-170).
    - `project_intake_threshold` — must be a `number` in the inclusive range `0..1` (mirror `auto_grill_threshold` exactly: non-number is an error; out-of-range is a warning).
    - `council_reviews.project` — must be an `object` (non-null). Inside it, each of `plan`, `phase_plan`, `wave_plan`, `code` must be a `boolean` when present; non-boolean is an error. Absence of individual sub-keys is acceptable (defaults apply upstream); absence of the `project` object itself is a `missingField` warning. This check is additive to the existing `council_reviews.{planning,execution,reviewer}` validation — the existing loop stays untouched and the new nested check runs in the same `else` branch that already validates the parent `council_reviews` object.
- Templates under `skills/do/references/`: `project-master-template.md`, `phase-template.md`, `wave-template.md`, `handoff-template.md`, `changelog-template.md`, `intake-transcript-template.md`, `completion-summary-template.md` (consumed by β's `stage-project-complete.md` per §12; α ships the template, β ships the rendering flow).
- Config-template updates in `skills/do/references/config-template.json`: add `active_project`, `project_intake_threshold`, `council_reviews.project.{plan,phase_plan,wave_plan,code}` fields.
- Minor template extension: add `related: []` field to `skills/do/references/task-template.md` so child tasks (and any other task file) can carry `related: ["260418-do-project-orchestrator"]` without being rejected as a schema violation (§14 opening paragraph cites this). No other edits to the template.
- **Health-check wiring updates** (keep the `/do:init` surface consistent with the new checks α ships in `project-health.cjs`):
  - `skills/do/references/init-health-check.md` — extend the existing `### Project Issues` sub-table (lines 123-133 of the current file) with the new project-folder issue types from §13 (`orphanedActiveProject`, `activeProjectNoActivePhase`, `orphanedActivePhase`, `orphanedActiveWave`, `orphanProjectFolder`, `phaseStatusDrift`, `waveStatusDrift`, `schemaVersionMismatch`, `invalidScopeValue`, `illegalScopeTransition`, `missingHandoffFields`, `illegalPhaseTransition`) and their severity + fix. The existing step 1-5 flow is unchanged — `project-health.cjs` still returns the same `{healthy, version, issues[]}` JSON, so Step 5's "Display combined health report" continues to work; α only appends rows to the issue-types reference table.
  - `skills/do/init.md` — additive note under `## Quick Reference` documenting that `.do/projects/` is a valid project-time artefact (so users reading `/do:init` know it is recognised by the health check), and extend `## Files` to list `project-health.cjs` alongside the existing `project-health.cjs` entry (the existing entry covers the extended script; no new script file to reference). **Reality check (iteration 9):** `init.md` is a thin router that delegates to `init-health-check.md` — it does not itself invoke scripts. The iteration-8 wording "delegate project-folder health to new script" was loose; α's actual edit here is the additive Quick-Reference / Files note described above, not a script-invocation change. If on implementation α's author finds no natural insertion point (the file is already terse), leaving `init.md` untouched and landing the project-health coverage entirely in `init-health-check.md` is acceptable — `init.md`'s routing already reaches the extended checks via existing Step 3.
- **Script location and packaging note:** all new and modified scripts (including `project-state.cjs`, `project-scaffold.cjs`, `project-health.cjs`, `project-resume.cjs`) live under `skills/do/scripts/` in the repo. The existing do-lang install pipeline copies them to `~/.claude/commands/do/scripts/` — this is the same pattern used by all `/do:*` scripts today (e.g. `project-health.cjs` at `skills/do/scripts/` is already the pattern `init-health-check.md` line 38 references via `~/.claude/commands/do/scripts/project-health.cjs`). **No separate packaging step is scoped here.** Task α authors write to the repo path; the install pipeline handles the home-directory copy. Gap X (reviewer finding): this pattern was undocumented in Task α scope but was always the existing convention — no new work required, documentation only.
- **Explicitly out of scope:** the `/do:project` skill file, any stage reference, any orchestrator code. A human can hand-scaffold a project folder with just these artefacts.

*Dependencies:* none (depends only on this design file being locked).

*Rationale for isolation:* the contract needs to freeze before orchestration sits on top of it. Shipping α alone also lets a user hand-scaffold and experiment before automation exists.

---

**Task β — project-orchestration** (slug: `project-beta-orchestration`)

*Scope:*
- `skills/do/project.md` — the skill file with subcommand routing: `new`, `phase`, `wave`, `status`, `complete`, `abandon`. (Resume is carved into Task γ.)
- `skills/do/do.md` — router update: add a `/do:project` row to the sub-commands table (between `/do:task` and the existing `/do:fast` entry, with a "When to use" that says "Starting a large multi-phase project — new codebase or massive feature") and add one routing example (e.g., "let's start a new app from scratch" → `/do:project new "..."`). **Reality check (iteration 9):** confirmed `skills/do/do.md` has a sub-commands table (current lines 20-32) and a routing-examples list (current lines 38-62) — the two edit sites are well-defined and additive. No removals or reorderings. **Rationale for β ownership:** this file is the router for skill discovery; β owns `skills/do/project.md` and ships the subcommand surface, so adding the routing entry here belongs in the same task.
- `stage-project-intake.md` — intake grilling flow (Passes 1-2 per §4).
- Project-plan flow + `stage-project-plan-review.md` (PR-0..PR-5 iteration, targets `project.md`).
- Phase-plan flow + `stage-phase-plan-review.md` (targets `phase.md`).
- **Per-phase confidence re-grill (Pass 3 of §4) — v1 scope.** β owns the phase-boundary confidence gate: when β transitions from wave N to wave N+1 within a single phase, **no re-grill fires**; when β transitions from phase N to phase N+1 (i.e., at the context-clear handoff boundary described in §7 after the next phase is promoted to `planning`), β invokes `do-griller` against the next phase's `phase.md` with the 4-factor confidence calculation scoped to that phase. Threshold is read from `.do/config.json`'s `project_intake_threshold` (per §4 default 0.85; same key α validates). If the next phase's confidence is at or above threshold, β proceeds directly to the phase-plan flow; if below, the scoped re-grill runs before `stage-phase-plan-review.md` fires. This is the Pass-3 hook from §4 and the `do-griller` row in §8's coverage map — β is its owning stage reference.
- Wave-plan flow + `stage-wave-plan-review.md` (targets `wave.md`).
- `stage-wave-exec.md` — spawns `do-executioner` against `wave.md` (§6).
- `stage-wave-code-review.md` — spawns `do-code-reviewer` + council against wave diff targeting `wave.md`.
- `stage-wave-verify.md` — spawns `do-verifier` against `wave.md`. Failure paths are project-aware (retry / debug / abandon wave / out_of_scope). **Explicitly NOT "spawn /do:task"** (§6).
- **Phase-complete state transition only (no handoff artefact):** `/do:project phase complete` routing lives here. β validates the completion precondition (every in-scope wave `completed`), sets the phase `status: completed` via `project-state.cjs`, clears `active_phase`, appends to `changelog.md`, promotes the next phase to `planning`. **β does NOT render `handoff.md`** — that is γ's job. Without γ, `/do:project phase complete` succeeds and prints "Phase complete. Handoff artefact pending (Task γ)." Users get a working state transition; the cold-start pack lands with γ.
- Completion/archival: `stage-project-complete.md` (§12) — renders `completion-summary.md` from α's `completion-summary-template.md` (per §1). **Note:** this ships in β but depends on γ's `stage-phase-exit.md` having been run at each phase boundary — the completion summary reads phase `handoff.md` artefacts (rendered by γ), not wave.md frontmatter directly. If γ is not yet shipped, `/do:project complete` prints "Complete requires phase handoff artefacts (Task γ)." and blocks. β is landable without γ for the hot-session flow (new / phase transitions / wave execution / abandon) — only `/do:project complete` is gated on γ.
- **Agent-spec revisions (per §8 table) — caller-agnostic clean-up + structured handoff writes:**
  - `agents/do-verifier.md` — **(terminological)** remove hardcoded `.do/tasks/<active_task>` paths, `/do:task` / `/do:continue` suggestions, and `active_task` clears from failure/complete flows (§8 cites specific line numbers); replace with abstract "target file" + "return control to caller". **(behavioural, new)** at end of verification, write `unresolved_concerns[]`, append `discovered_followups[]`, and write `wave_summary` (one-sentence summary) into target-file frontmatter if those arrays/keys exist (§8 edit #6). No-op for plain task files.
  - `agents/do-executioner.md` — **(terminological)** same kind of substitutions; remove `/do:continue` from on-failure message. **(behavioural, new)** at end of execution, write `modified_files[]` (canonical list) and append `discovered_followups[]` into target-file frontmatter if those arrays exist. Human-readable `## Execution Log` write is unchanged.
  - `agents/do-planner.md` — generalise description + "Spawned by" list; substitute "task file" → "target file".
  - `agents/do-plan-reviewer.md` — terminological substitution only ("task file" → "target plan file").
  - `agents/do-code-reviewer.md` — terminological substitution only.
  - `agents/do-council-reviewer.md` — terminological substitution only (already accepts a file path parameter).
  - `agents/do-griller.md` — terminological substitution only.
  - `agents/do-debugger.md` — no changes needed; already caller-agnostic.
  Scope: remove pipeline-specific literals + add frontmatter-presence-gated handoff writes in the two agents that write to target files. No new agents, no new tool calls, no new prompt templates.
  **Safeguard:** each shared-agent edit MUST preserve existing task-pipeline behavior verbatim. Verified by running `/do:task` smoke test (a known existing task) post-edit as part of β's verification step — before β is marked complete.
- **Sub-command contracts for all v1 subcommands (iteration-16 addition).** β owns `skills/do/project.md`'s routing; the six thin-wrapper subcommands below are fully specified so β's implementer needs no inference:
  - **`status`:** read-only. Invokes `project-state.cjs status <active_project>`; renders a summary table (project / phase / wave status, scope, progress counts). No writes to any file.
  - **`phase new <slug>`:** calls `project-scaffold.cjs phase <active_project> <slug>` (see Task α scaffold semantics above). Default status `planning`, scope `in_scope`. Appends changelog entry. Optional `--from-backlog <id>` flag triggers a **post-scaffold mutation owned by β** (scaffold stays generic — no backlog awareness in `project-scaffold.cjs`): (a) β reads the backlog entry by `<id>` from `BACKLOG.md` (parsing the existing `/do:backlog` format — no new helper required); (b) writes the entry's problem/fix content into the freshly-scaffolded `phase.md`'s `## Goal` body section; (c) sets `backlog_item: <id>` in `phase.md` frontmatter; (d) appends a changelog entry recording the backlog seed. **Cross-reference §11:** §11 describes the user-visible contract; β's `phase new` handler is the implementation owner of the backlog read + body write steps.
  - **`phase abandon <slug>`:** calls `project-state.cjs abandon phase <active_project> <slug>`, which cascades status to `abandoned` on the phase and every in-scope wave within it (recording `pre_abandon_status` per §3). Appends changelog entry. Does NOT move any folder.
  - **`wave new <slug>`:** calls `project-scaffold.cjs wave <active_project> <active_phase> <slug>`. Default status `planning`, scope `in_scope`. Appends changelog entry. Optional `--from-backlog <id>` flag triggers a **post-scaffold mutation owned by β** (same pattern as `phase new`): (a) β reads the backlog entry by `<id>` from `BACKLOG.md`; (b) writes the entry's problem/fix content into the freshly-scaffolded `wave.md`'s `## Problem Statement` body section; (c) sets `backlog_item: <id>` in `wave.md` frontmatter; (d) appends a changelog entry recording the backlog seed. **Cross-reference §11:** §11 describes the user-visible contract; β's `wave new` handler owns the implementation. `project-scaffold.cjs` is unchanged — it has no backlog awareness.
  - **`wave complete <slug>`:** calls `project-state.cjs set wave <active_project> <active_phase> <slug> completed`. Appends changelog entry. Does NOT advance `active_phase` or trigger phase-exit (caller uses `/do:project phase complete` for that — a separate, explicit user action).
  - **`wave abandon <slug>`:** calls `project-state.cjs abandon wave <active_project> <active_phase> <slug>` (records `pre_abandon_status`, sets `status: abandoned`). Appends changelog entry. Does NOT cascade to the parent phase; phase status is unchanged.
  - **`wave next`:** reads `active_project` + `active_phase` from `.do/config.json` and `phase.md` respectively; finds the first wave in the active phase's `waves: []` list with `status: planning` and `scope: in_scope`; if none found, exits with "No planning waves in current phase; run `/do:project wave new <slug>` to create one"; calls `project-state.cjs set wave <active_project> <active_phase> <wave_slug> in_progress`; updates `phase.md` `active_wave: <wave_slug>` atomically; appends changelog entry; loads the existing `wave.md`. **No scaffold call** — wave must already exist (created by `wave new` or the initial phase-seeding step triggered after `stage-phase-plan-review.md` approval; see §6 step 1a). **Per-wave confidence rescue (before wave execution pipeline):** if `wave.md`'s confidence score is below `project_intake_threshold` (from `.do/config.json`), β spawns `do-griller` against `wave.md` before invoking the wave execution pipeline — see per-wave confidence rescue bullet below. On threshold reached or user override, proceeds to `stage-wave-plan-review.md`.
  - **`new <slug>` (top-level project creation):** reads `.do/config.json` → if `active_project` is non-null, errors with: "A project is already active (`<current_slug>`). Run `/do:project complete` or `/do:project abandon` first." (single-active invariant per O-1). Calls `project-scaffold.cjs project <slug>` which creates `.do/projects/<slug>/` with `project.md` (default `status: intake`; no `scope` field at project level per KK), empty `phases/` folder, and empty `changelog.md`. Writes `active_project: <slug>` into `.do/config.json` (atomic temp-file + rename). Appends changelog entry: `<ISO> new:project:<slug>`. Then triggers the intake flow per §4 (do-griller Pass 1 + Pass 2) via `stage-project-intake.md`. On intake completion, the user is routed to project-plan-review for initial phase list.
  - **`abandon` (top-level project abandon):** reads `.do/config.json` → if `active_project` is null, errors with: "No active project to abandon." Prompts user for a one-line abandon reason. Calls `project-state.cjs abandon project <active_project>` (cascades status to `abandoned` on the project and every in-scope phase + wave per §3; records `pre_abandon_status` on each in-scope node; out-of-scope nodes untouched). Appends changelog entry with the reason: `<ISO> abandon:project:<slug>: <reason>`. Moves `.do/projects/<active_project>/` to `.do/projects/archived/<active_project>/` (atomic rename). Clears `active_project` in `.do/config.json` (writes `null`). **No autonomous resume** — to re-activate an archived project, the user must manually move the folder back per §12 step 6; `/do:project resume` then detects `status: abandoned` and invokes `project-state.cjs restore-from-abandoned` before routing.
  - **Per-wave confidence rescue (β scope, parallel to per-phase re-grill):** during `wave next`, after `wave.md` is loaded, if `wave.md`'s confidence score is below `project_intake_threshold` (from `.do/config.json`, default 0.85 per §4), β spawns `do-griller` against `wave.md` before invoking the wave execution pipeline. Griller questions target wave-level context gaps (scope, acceptance criteria, blockers). On threshold reached or explicit user override ("proceed anyway"), β proceeds to `stage-wave-plan-review.md`. This mirrors the per-phase re-grill pattern (Pass 3 of §4) applied at the wave granularity; same threshold knob, same override mechanism, different target file.
- **Explicitly out of scope:** resume subcommand, `stage-project-resume.md`, `stage-phase-exit.md`, cold-start UAT (all in Task γ).

*Dependencies:* Task α (contract must exist).

*Rationale for isolation:* β is the bulk of the user-facing surface. Carving out resume+handoff into γ keeps the architectural-guarantee code (the cold-start path) under focused review separately.

---

**Task γ — project-resume-handoff** (slug: `project-gamma-resume-handoff`)

*Scope:*
- `/do:project resume` subcommand + `stage-project-resume.md` (§7 cold-start flow).
- `skills/do/references/resume-preamble-project.md` — **new sibling reference** (see §1 and the full step-by-step spec in §7.5). γ's implementer follows §7.5's R0.1p–R0.6p numbered steps directly — do not re-derive by analogy to `resume-preamble.md`. Key replacements vs. the task-pipeline sibling (per §7.5): project-native structured context reads replace `load-task-context.cjs`; target-file-type stage table replaces the task-file stage enum; `changelog.md` (project scope) / wave.md Execution Log (wave scope) replaces the single task Execution Log as "last action" source; `/do:project resume` replaces `/do:continue` in stale-reference and pause prompts. Composed by `stage-project-resume.md`, invoked once per nested file in order (project.md → phase.md → wave.md). The original `resume-preamble.md` is NOT modified — it remains task-pipeline-only. Duplication accepted per O-29.
- `skills/do/scripts/project-resume.cjs` — reads active project's state (project.md / phase.md / wave.md frontmatter in that order) and returns the next action to take (which stage reference to invoke, with what target file). `stage-project-resume.md` delegates the "what's the next action" computation to this helper rather than re-implementing it inline; the stage reference handles the routing and UX around it.
- `stage-phase-exit.md` — **render-only** handoff artefact writer reading structured wave.md / phase.md / project.md frontmatter fields (§7 locked decision); renders `handoff.md` from `handoff-template.md`. **This file does NOT call `project-state.cjs` and does NOT mutate any frontmatter** — state transition (previous phase → `completed`, next phase → `planning` (non-terminal) or `active_phase: null` (terminal), `changelog.md` append) is owned by β's `/do:project phase complete` subcommand and runs BEFORE `stage-phase-exit.md` is invoked. γ's responsibility is strictly reader/renderer: ingest state, write `handoff.md`, return. **Terminal-phase rendering contract (per §7 step 3):** `stage-phase-exit.md` detects terminal phase by reading `project.md`'s `phases[]` array and checking whether a next in-scope entry exists after the just-completed phase. If a next phase exists, it emits `## Next Phase Entry Prompt` with the copy-paste resume string. If no next phase exists, it emits `## Project Completion Hint` instead — a single line: "This was the final phase. Run `/do:project complete` to finalise the project." All other `handoff.md` body sections (`## What Shipped`, `## What Remains`, `## Open Decisions`, `## Files of Record`) render identically in both cases. **Hook point:** γ wires this into β's `/do:project phase complete` routing — after β's state transition completes, β invokes `stage-phase-exit.md` as the render step. Before γ, β still runs the state transition and then prints the "Handoff artefact pending (Task γ)" stub in place of the render step.
- Cold-start UAT script — the acceptance test from O-10: "fresh session + `/clear` + `/do:project resume` succeeds without re-interviewing the user."
- Verification that `/do:continue` does NOT route to project state (confirms isolation per §10).

*Dependencies:* Task β (orchestration pipeline must exist for resume to route into it).

*Hard-prerequisite relationship:* γ is a hard prerequisite for both `/do:project phase complete` producing its handoff artefact (β prints the "Handoff artefact pending" stub without γ) AND for `/do:project complete` running end-to-end (§12 reads each phase's `handoff.md`, which only exists after γ's `stage-phase-exit.md` has run at each phase boundary). Without γ, β's `/do:project complete` blocks with "Complete requires phase handoff artefacts (Task γ)."

*Rationale for isolation:* the cold-start resume path is the architectural guarantee called out in the problem statement. Keeping it in its own task gives it focused council review and a dedicated UAT gate. If γ fails review, β is still landable on its own as a "hot-session-only" orchestration (minus `/do:project complete`, which depends on γ's handoff artefacts).

---

**What is deferred beyond Task α/β/γ (future iterations, scoped individually):**
- Automatic phase-exit detection (v1 is user-triggered via `/do:project phase complete`).
- do-verifier phase-exit and project-exit critique variants (v1 is template-fill only).
- `/do:debug --phase <slug>` scoping.
- Cross-project dashboard (`/do:project status --all`).
- Parallel-wave / parallel-phase models (O-11, O-12).
- Migration tooling for `project_schema_version` bumps.
- Database entry auto-sync on project complete.
- Backlog promotion shortcut from do-executioner discoveries.
- Wave-fast / wave-quick tier sibling references (`stage-wave-fast-exec.md` / `stage-wave-quick-exec.md`).
- `/do:project phase reorder` subcommand (O-23). v1 workaround: users hand-edit `project.md`'s `phases[]` order + `## Phase Plan` body, manually rename phase-folder numeric prefixes, and add a `changelog.md` entry. v2 adds a first-class op that automates the rename + invariant checks.

Task α + β + γ together constitute the "foundation" the user flagged as token-critical. Each future iteration is its own `/do:project`-managed feature (once `/do:project` exists to manage itself — pleasantly recursive).

## Concerns

Tagged O-N for reference. Each has a working mitigation (or is explicitly flagged as an open question for grilling). The user said "raise every open question you encounter" — the list is long by design.

**Locked decisions** (moved out of the grilling bucket after Iteration 1 / 2 / 3 council review + iteration-3 user-directed architectural split): O-5 (council review gates — see §8), O-8 (project-level council review — subsumed into O-5), O-9 (wave execution file — wave.md IS the execution file per §6), O-22 (continue vs. resume — fully separated per §10), O-26 (scope semantics — see §3), O-27 (structured handoff fields — see §2/§7), O-28 (v1 completion flow — see §12). O-4 (greenfield DB gate) is REMOVED — no longer applicable under the full split.

---

### O-1. Single vs. multiple active projects *(open question — grill)*
**Risk:** I've defaulted to "exactly one active project" to mirror the existing `active_task` invariant. But a user with two real projects (e.g., backend rebuild + mobile app launch) might want both active in parallel.
**Mitigation for v1 (locked schema):** ship single-active with the singular `active_project: <slug> | null` config field (as specified throughout §1, §2, §10, §12, §13, and Task α scope in §14). **Do NOT add `active_projects: []` now.** Rationale: v1 explicitly enforces single-active-project (mirrors the single `active_task` invariant and the single-active-phase/active-wave constraints in O-11, O-12); shipping a plural array without the orchestration to consume it would ship dead schema. Forward-compatibility is handled by the existing `project_schema_version: 1` field on every project/phase/wave file (per §2 / Task α scope) — v2 can introduce `active_projects: []` as a schema bump with a migration step from v1's singular field, rather than carrying an unused array from day one. This inverts the iteration-1-era "forward-compatible schema" mitigation in favour of "ship what we enforce; evolve via the version field".
**Question for user:** "Do you realistically run two large initiatives in parallel, or is it always one-at-a-time?" (If v2 answer is "parallel", the schema-version bump defined in §2 carries the `active_project` → `active_projects[]` migration.)

### O-2. `/do:task` stomping project state *(RESOLVED by full split — see §10, O-30)*

### O-3. Interaction with `backlog` skill
**Risk:** overlap — does the backlog or the project own the "not-yet-started" queue?
**Mitigation:** the backlog owns **undecided / ad-hoc ideas**; the project owns **committed phases and waves**. Promotion from backlog to project is explicit; demotion from project to backlog is only for out-of-scope discoveries. `/do:backlog start` remains its own path and does NOT enter a project automatically.
**Residual risk:** user confusion about where something belongs. Document the distinction clearly in `project.md`'s skill description.

### O-4. Greenfield database-entry gate *(REMOVED — see iteration 3)*

### O-5. Council review gates *(LOCKED — see §8)*
**Resolution:** v1 wires council review at the project-plan / phase-plan / wave-plan gates via new project-specific sibling references (`stage-project-plan-review.md`, `stage-phase-plan-review.md`, `stage-wave-plan-review.md`). Existing `stage-plan-review.md` is untouched and owns only task-pipeline reviews. Each project-side reference follows the same structural pattern (caller-contract preamble, PR-0 resume guard, PR-3 parallel spawn, PR-4 verdict combination, PR-5 iteration loop) but reads `project.md` / `phase.md` / `wave.md` respectively. Council gating is per-config (`council_reviews.project.plan`, `council_reviews.project.phase_plan`, `council_reviews.project.wave_plan`, `council_reviews.project.code`). A wave code-review gate runs via `stage-wave-code-review.md` (project sibling of `stage-code-review.md`) against `wave.md`. This concern is no longer an open question for grilling.

### O-6. Grilling itself bloating context *(open question — grill)*
**Risk:** Pass 1 (10 questions) + Pass 2 (3 questions) + each Q carrying 300+ tokens of user response = 4000-6000 tokens minimum, plus do-griller's own turn overhead. For greenfield this can easily hit 15% of the context window before any planning happens.
**Mitigation:** grilling **writes each Q/A pair to disk** (`.do/projects/<slug>/intake/session-<timestamp>.md`) as it goes. If context bloats past 50% during intake, do-griller emits a **mid-intake context-clear prompt** the same shape as phase-exit: "Intake paused. Copy this prompt to a fresh session and continue: ..."
**Open question:** at what percentage threshold do we trigger the mid-intake clear? Pick 50% as a working default; may need tuning.

### O-7. Wave size ceiling *(open question — grill)*
**Risk:** a wave that turns out to be as large as a phase blows up `/do:task`'s assumptions.
**Mitigation:** soft cap — if `phase-planner` produces a wave whose estimated touch-count is > 10 files or whose confidence is < 0.5, it must either split the wave or promote it to its own phase. This rule lives in `stage-phase-plan-review.md` and is enforced via plan-review.
**Hard cap:** none in v1 (humans can override). Revisit after observing real waves.
**Question for user:** "Do you want a hard file-count ceiling per wave (e.g., 15 files), or trust the planner's soft cap?"

### O-8. Project-level council review *(LOCKED — subsumed by O-5 resolution, see §8)*
**Resolution:** v1 wires council review at the project-plan gate via new `stage-project-plan-review.md`. Gated by `council_reviews.project.plan` with default `true` (nested under the `council_reviews.project` object alongside sibling keys `phase_plan`, `wave_plan`, `code`). Users who disable it explicitly opt out; there is no "always-on override" in v1 because that would contradict the general user control over council review. If strategic errors slip through, users can re-enable. This concern is no longer an open question for grilling.

### O-9. Wave file colocation *(SUPERSEDED — see §6; `wave.md` IS the execution state)*

### O-10. Context-clear guarantee is architectural but untestable *(risk)*
**Risk:** we *claim* cold-start resume from disk works, but until we actually do it in a fresh session, we don't know. Bugs here are session-ending for the user.
**Mitigation:** v1 must include a **manual UAT script** in the verification phase: "open a new terminal, `/clear` Claude, run `/do:project resume`, verify you land on the correct stage with no user questions asked." This is the acceptance test for §7.

### O-11. Single-active-phase constraint
**Risk:** some projects have parallelizable phases (e.g., backend phase and design-system phase could run in parallel). My default forbids this.
**Mitigation:** ship single-active-phase in v1. If the need is real in v2, swap `active_phase: <slug>` for `active_phases: [<slug>, ...]`. Schema-version bump handles migration.
**Open question:** does the user have a use-case in mind where parallel phases matter? Probably not for v1, but worth asking.

### O-12. Parallel waves inside a phase *(open question — grill)*
**Risk:** two waves in the same phase could run in two parallel Claude Code sessions (e.g., one on a laptop, one on a desktop). Under the full split, parallelism is limited by the project pipeline's own active pointers — `phase.md`'s `active_wave` is single-valued, and `project-state.cjs` enforces one in-progress wave per phase.
**Mitigation in v1:** strictly sequential. One active wave per phase. This constraint lives entirely in the project pipeline (`active_wave` on `phase.md`); the task pipeline's `active_task` is irrelevant here because the two pipelines do not share state (see §10).
**Question for user:** "Do you ever plan to run two waves in parallel? If so, we need to upgrade `active_wave` on phase.md to `active_waves[]` and relax the state-machine rule in `project-state.cjs`." (Likely answer: not in v1. Flag for v3.)

### O-13. `do-griller` scaling up
**Risk:** do-griller was designed for per-factor confidence rescue (2-4 questions). Running it as a 10-13-question structured intake is qualitatively different.
**Mitigation:** do not modify do-griller itself. Instead, `stage-project-intake.md` drives the question list and uses do-griller-style prompting *inline* in the orchestrator, OR spawns do-griller multiple times with narrow prompts (one factor-equivalent per spawn).
**Preferred:** inline in orchestrator for Pass 1-2 (lower overhead), spawn do-griller for Pass 3 (per-phase rescue, matches its current usage pattern).

### O-14. `do-debugger` at phase level
**Risk:** cross-wave debugging doesn't have a home today.
**Mitigation:** add `/do:debug --phase <slug>` in v2 (§8). v1 uses per-wave `/do:debug` only.

### O-15. Schema versioning — are we over-engineering?
**Risk:** `project_schema_version: 1` on every file adds cost; might never be used.
**Mitigation:** keep it. The user explicitly said "it's VERY important to get the foundation right" — a schema version costs one line per file and saves a migration nightmare later. Cheap insurance.

### O-16. Template naming collision
**Risk:** `skills/do/references/project-template.md` already exists (used by `/do:scan` for the *database* project.md). Adding another `project-template.md` for the `.do/projects/<slug>/project.md` master file collides.
**Mitigation:** rename one. Working names:
- keep existing `project-template.md` as-is (it's referenced by `/do:scan`)
- new file: `skills/do/references/project-master-template.md` for the `.do/projects/<slug>/project.md`
- similarly `phase-template.md`, `wave-template.md`, `handoff-template.md`, `changelog-template.md`, `intake-transcript-template.md`.
**Note:** a rename is invasive but name clarity matters for a foundation file. Decide before v1 ships.

### O-17. Migrating an in-flight `/do:task` into a `/do:project` wave
**Risk:** user has a `/do:task` running, realizes it's really a massive feature, wants to "convert" it.
**Mitigation:** out of scope for v1. Document in the skill description: "If your task is larger than one wave, abandon it and start with `/do:project new`." v2 could add a migration command.

### O-18. Database project.md vs. project-master project.md *(naming confusion)*
**Risk:** two files named `project.md` in the system, with different purposes:
- `database/projects/<name>/project.md` — human-curated codebase documentation (tech stack, components, conventions).
- `.do/projects/<slug>/project.md` — project-initiative master file (vision, phases, status).
**Mitigation:** documentation emphasis. Also: the `database_entry` field in `.do/projects/<slug>/project.md` frontmatter links to the database one, making the relationship explicit. Consider renaming the latter to `initiative.md` — but this contradicts the user's explicit ask ("project.md master file at the root"). Keep both names; lean hard on docs.

### O-19. Atomicity of folder moves (complete / abandon)
**Risk:** moving `.do/projects/<slug>/` → `.do/projects/completed/<slug>/` mid-flight could leave the filesystem in a bad state if the process dies.
**Mitigation:** use `fs.renameSync` (single syscall, atomic within a filesystem). If cross-filesystem, fall back to copy + verify + delete with a rollback file. `project-state.cjs` wraps this.

### O-20. Changelog conflict in git *(LOCKED — single file `changelog.md`)*
**Risk:** `changelog.md` is append-only, so two branches touching the same project will merge-conflict on every append.
**Resolution (locked):** single file `changelog.md` at the project root. Rationale: (1) the single-file shape is consistent across §2 (folder shape), §3 (transition logging), §7.5 R0.3p (last 10 changelog entries read), §7.5 R0.5p (last-action source at project/phase scopes), §7 step 5 (β's changelog append on phase complete), §11 (backlog `done` trigger ordering), and §12 (changelog pointer) — flipping to a directory shape would require coordinated edits across all six sections and would break §7.5 R0.3p's "last 10 entries" read (which cannot operate directly on a timestamped-filename directory without added tooling). (2) The merge-conflict risk is narrow — it fires only when two branches concurrently edit the same project's changelog, which collides with the single-active-project + single-active-phase + single-active-wave invariants already enforced in §3. In practice, projects are one-user-at-a-time; the multi-branch scenario is rare enough that `git rerere` or manual conflict resolution is acceptable. (3) If the directory shape becomes necessary later (e.g., multi-user projects), `project_schema_version` bump handles the v2 migration — the structured-frontmatter + schema-versioning story from §2 already absorbs this class of change non-destructively.
**Alternative considered and rejected:** timestamped-filename directory (`changelog/<ISO-timestamp>.md` one-line files). Rejected because the cross-section inconsistency it would introduce outweighs the conflict-free append benefit for the v1 single-user-per-project usage pattern.

### O-21. Token cost of a full greenfield run *(risk awareness)*
**Risk:** a full greenfield project from `/do:project new` through v1 completion could easily be >500k tokens across sessions.
**Mitigation:** this is inherent to the problem. The mitigations are:
- mandatory context-clear at phase boundaries (§7);
- cheap on-disk state so sessions are cheap to start;
- intake artefacts on disk rather than re-interviewed.

We cannot reduce the total work; we can only make sure no work is wasted.

### O-22. `/do:continue` vs. `/do:project resume` *(LOCKED — fully separated)*
**Resolution:** option (b) — they are fully separate. `/do:continue` handles `.do/tasks/` only; `/do:project resume` handles `.do/projects/` only. Neither routes to the other. Rationale: the iteration-3 full split makes isolation the core architectural property; coupling the two resume entry points would re-introduce cross-pipeline awareness we explicitly removed. Documentation responsibility: both `continue.md` and `project.md` should explain the scope of their resume, so users are not surprised that `/do:continue` "does nothing" when only a project is active, and vice versa.

### O-23. Phase plan drift vs. reality
**Risk:** user approves a phase plan in Pass 2, then reality changes three phases in — new phase needed, phase order wrong, etc.
**Mitigation:** `/do:project phase new` is first-class in v1 (see §1 skill layout + Task β scope in §14). `/do:project phase reorder` is **deferred to v2**; in v1, users hand-edit `project.md`'s `phases[]` frontmatter order and the `## Phase Plan` body to change ordering, and manually rename phase-folder numeric prefixes (e.g., `01-foo/` → `02-foo/`) on disk. `changelog.md` gets a manual entry noting the reorder and its rationale. This manual workaround is acceptable in v1 because (1) phase reordering is rare — phases are planned with explicit dependency analysis in §5 before any wave executes, so reorders typically surface as "insert a new phase" (covered by `phase new`) rather than "swap two existing phases"; (2) adding `phase reorder` as a first-class op would require state-mutation logic, numeric-prefix rename handling, cross-phase `active_phase` invariant checks, and changelog-entry templating — non-trivial scope creep for an edge case; (3) keeping Task β's scope bounded protects the foundation v1 is meant to ship. No changes to §1 (already only lists `new|next|complete|abandon`) or to Task β's scope. See the v2 deferred bucket at the end of §14 for the explicit deferral entry.

### O-24. Intake threshold config discoverability
**Risk:** new config fields (`project_intake_threshold`, `council_reviews.project.*`) must be documented somewhere the user can find.
**Mitigation:** update `skills/do/references/config-template.json` and `skills/do/init.md` to reflect new fields. Health check (§13) warns on missing-with-defaults.

### O-25. This plan may be missing something the user knows and I don't
**Risk:** user explicitly said "Is this enough information? I feel like I might miss a lot of things." I inherit that concern.
**Mitigation:** confidence raised to 0.86 after iteration-4 consistency sweep + agent-spec scoping. Remaining open questions for grilling (narrower post-split): **O-1** (single vs. multi active projects), **O-6** (intake bloat threshold), **O-7** (wave size ceiling), **O-11** (parallel phases), **O-12** (parallel waves). LOCKED and no longer grilling-targets: O-5, O-8, O-9, O-22, O-26, O-27, O-28, O-29, O-30, O-31. REMOVED: O-4. NEW from iteration-3: O-29 (sibling-reference duplication), O-30 (parallel single-session use). NEW from iteration-4: O-31 (agent spec drift under dual-pipeline reuse). If grilling exposes a contradiction with a locked decision, that is a signal to revisit the locked decision explicitly, not to silently ignore it.

### O-26. `out_of_scope` semantics — status vs. separate flag *(LOCKED — see §3, finding #1 option b)*
**Resolution:** `out_of_scope` is **not** a status value; it is a separate `scope: in_scope | out_of_scope` frontmatter field on phase.md and wave.md. Completion rules read it as a second clause: a phase completes when every in-scope wave has `status: completed`. Status enum stays tight (`planning | in_progress | blocked | completed | abandoned`). Rationale: semantic separation between work state ("did we start and finish?") and scope decision ("does this count?"). Health checks gain `invalidScopeValue` and `illegalScopeTransition` rules. Legal scope transitions defined in §3.

### O-27. Handoff inputs must be structured, not scraped *(LOCKED — see §2 and §7, finding #2)*
**Resolution:** `wave.md` frontmatter gains three arrays — `modified_files`, `unresolved_concerns`, `discovered_followups` — populated at wave completion. `stage-phase-exit.md` reads these fields directly instead of parsing prose from the linked task file. Ownership: do-executioner writes `modified_files` and optional `discovered_followups` at end of execution; do-verifier writes `unresolved_concerns` and optional `discovered_followups` at end of verification. `task-template.md` is NOT modified — the structured fields live on the wave envelope, not the task file, so existing `/do:task` callers are unaffected. Trade-off: do-executioner and do-verifier gain a small additional responsibility (one frontmatter write each) when running under a project. Mitigation: that responsibility is a no-op for standalone task runs (no parent wave to target).

### O-28. v1b without `/do:project complete` would leave a UX gap *(LOCKED — see §12, finding #3 option a)*
**Resolution:** `/do:project complete` and `stage-project-complete.md` ship in v1b with minimal scope — template-filled `completion-summary.md`, atomic folder move, config clear. No verifier critique, no fancy rollup (those are v2). Rationale: deferring completion to v2 while shipping `new` / `resume` / `phase complete` / `abandon` would force users to manually `mv` folders and edit config, which is both undocumented and error-prone. Completion is cheap given the state machine in §3 already exists. Scope is deliberately tight: one new reference file, one sub-command, one template.

### O-29. Sibling-reference duplication between task pipeline and project pipeline *(LOCKED — accepted trade-off from iteration-3 split)*
**Risk:** the project pipeline's plan-review / code-review / execute / verify references mirror the structure of their task-pipeline siblings. If the structural pattern (e.g. iteration loop, verdict combination table) ever changes in one, the other can drift.
**Mitigation:** (1) each project-specific stage reference includes a header comment pointing at its task-pipeline sibling as the canonical structural model; (2) the caller-contract preamble is copy-identical across siblings; (3) `/do:optimise` can audit both families and flag structural drift. The duplication is small (≤200 lines per gate) and was unavoidable given the iteration-1 finding #2 (task-pipeline references are task-file-hardcoded). Accepted.

### O-30. Users may run `/do:task` concurrently while a project is active *(LOCKED — by design)*
**Risk:** because the pipelines are fully isolated, nothing stops a user from running `/do:task "quick fix"` mid-phase while a project wave is in flight. Two active pieces of work in one session may confuse the user about where edits land.
**Mitigation:** the isolation is a FEATURE — it allows unrelated maintenance work to proceed without disturbing project state. Optional soft-warning: at the start of any `/do:task` / `/do:fast` / `/do:quick` run, if `active_project` is set in config, display an advisory line ("Heads-up: project <slug> is active. This task runs OUTSIDE the project.") and continue. This is advisory only — no hard guard, no user prompt. It is the only touchpoint between the two pipelines and is one-way (task pipeline reads `active_project`; project pipeline never reads `active_task`). If users still find it confusing, a future `--disallow-concurrent-project` config flag can upgrade the advisory to a prompt.

### O-31. Agent spec drift under dual-pipeline reuse *(LOCKED — mitigated by `/do:optimise` audit)*
**Risk:** once agent specs are made caller-agnostic under Task β (§8 table), future task-pipeline changes might accidentally re-hardcode task-specific language back into the specs (e.g., a reviewer adds `/do:continue` back into `do-verifier.md`'s failure flow because "that's what the task pipeline does"). Over time this drift would break `/do:project`'s reuse of the same agents without anyone noticing — the project pipeline would silently start carrying task-pipeline-flavoured agent behaviour.
**Mitigation:** `/do:optimise` audit check on agent specs flags any new occurrence of `.do/tasks/`, `/do:task`, `/do:continue`, or `active_task` **literals in caller-facing text** of `agents/*.md`. False-positive hedging: the audit permits these literals inside explicit "example task-pipeline usage" blocks and inside historical iteration notes, but fails the audit if they appear in execution / failure / routing instructions. Implemented as a grep-based lint in whichever `/do:optimise` script owns agent-spec checks. This runs every optimisation pass, so drift is caught within one optimise-cycle rather than accumulating silently. Complement: O-29's structural-drift audit on sibling stage references, so both axes of dual-pipeline drift are covered.

## Review Iterations

### Iteration 1
- **Self-review (do-plan-reviewer):** PASS — all 5 criteria met.
- **Council (codex):** CONCERNS. Key findings:
  1. Wave bridge breaks `active_task` contract — `/do:continue` (lines 18, 38) and `task-abandon.cjs` (line 191) hardcode `active_task` as a filename under `.do/tasks/`. Setting it to a nested `.do/projects/.../task.md` path will not work. "Reuse `/do:task` unchanged" is technically wrong as currently specified.
  2. `stage-plan-review.md` reuse is not "thin" — it is task-specific throughout (reads `.do/tasks/<active_task>`, updates `council_review_ran.plan` on that task file, addresses reviewers to a "Task file"). Project/phase plan review requires a real refactor (parameterize target file + review type) or a separate reference file.
  3. Greenfield database-entry requirement is left as an open question. `/do:task`, `/do:fast`, `/do:quick` all gate on a database entry. Greenfield has no codebase yet — when does `/do:scan` run, or is the gate bypassed for project-owned waves? v1 needs a locked rule.
  4. v1 defers automated phase-exit handoff even though safe phase-boundary cold starts are the main architectural guarantee in the problem statement. v1 slice should harden the handoff, not defer it.
- **Recommendations from council:**
  1. Lock the execution bridge: either keep all wave task files in `.do/tasks/` and reference them from `wave.md`, or generalize every `active_task` consumer (`/do:continue`, `task-abandon.cjs`, health, fast/quick) to accept project-relative paths.
  2. Split v1 into two implementation tasks: foundation contract (folders, schemas, state, config, health, paths) first; orchestration reuse/refactor (stage-plan-review parameterization, cross-command guards, wave bridge) second.
  3. Make greenfield database-entry behavior a v1 contract decision, not a grilling follow-up.
  4. Stop describing `stage-plan-review.md` and the task pipeline as "reused unchanged". Either parameterize the references or introduce project/phase/wave-specific review references, and say so in the plan.
- **Changes made (Iteration 1 revision — most later superseded by iteration 3):**
  - Picked Option A (wave files in `.do/tasks/` + `task_file:` pointer) → **reverted in iteration 3** (wave.md IS the execution state).
  - Added `stage-project-plan-review.md` sibling only; claimed wave-plan review reuses `stage-plan-review.md` unmodified → **superseded in iteration 3** (project pipeline ships all three sibling plan-review refs).
  - Added §8b greenfield DB gate → **deleted in iteration 3** (project pipeline never hits `check-database-entry.cjs`).
  - Pulled `handoff.md` artefact into v1, deferring only auto-detection to v2 → **still active**. See §7.
  - Adopted v1a / v1b implementation split → **replaced in iteration 3 by three sibling tasks α / β / γ**.
  - Moved O-4, O-5, O-8, O-9 from "open question" to LOCKED.
  - **Confidence raised** from 0.50 to 0.70.

### Iteration 2
- **Self-review (do-plan-reviewer):** PASS — no changes required.
- **Council (codex):** CONCERNS. Three new findings (iteration 1 findings all resolved):
  1. State machine inconsistent re: `out_of_scope`. Completion rule referenced `out_of_scope` but the status enum did not include it. Contract must pick: (a) add `out_of_scope` to the status enum, or (b) add a separate `scope: in_scope | out_of_scope` field and make the completion rule read both.
  2. Handoff depends on free-form prose. §7 was specified to harvest "unresolved concerns", "discovered follow-ups", and "modified files" by scraping task-file prose. Scraping is brittle; the handoff is the v1 cold-start safety guarantee and cannot rest on parser heuristics. Fix: add structured frontmatter fields on wave.md and specify ownership.
  3. `/do:project complete` vs v1 scope is contradictory. Skill layout (§1) listed it; §14 deferred it to v2. Pick: (a) pull into v1b with minimal scope, or (b) remove from §1 until v2.
- **Changes made (Iteration 2 revision):**
  1. **Finding #1 — picked option (b).** §3 rewritten: status enum stays `planning | in_progress | blocked | completed | abandoned`. New `scope: in_scope | out_of_scope` field added to phase.md and wave.md frontmatter in §2. Legal scope transitions documented (`in_progress → out_of_scope` forbidden; requires blocked/abandoned first). Phase and project completion rules rewritten as single clauses: completion requires every in-scope child to have `status: completed`. §13 health checks gain `invalidScopeValue` + `illegalScopeTransition`. Rationale: separates work state from scope decision, natural re-scoping semantics, tight status enum.
  2. **Finding #2 — resolved with structured wave.md fields.** §2 extended: `wave.md` frontmatter gains `modified_files`, `unresolved_concerns`, `discovered_followups` arrays with explicit item shapes. §2 adds ownership table: do-executioner writes `modified_files` + optional `discovered_followups` at end of wave execution; do-verifier writes `unresolved_concerns` + optional `discovered_followups` at end of wave verification. §6 step 5 updated: wave-complete transition ensures the fields are populated. §7 rewritten: `stage-phase-exit.md` reads these frontmatter fields directly — no prose parsing. §8 agent coverage table adds the new responsibilities to do-executioner and do-verifier (no-op for standalone task runs). §13 health checks gain `missingHandoffFields`. **task-template.md is NOT modified** (explicit v1a non-goal) — structured fields live on the wave envelope so existing `/do:task` callers are unaffected.
  3. **Finding #3 — picked option (a).** §12 rewritten with "LOCKED" marker: `/do:project complete` and `stage-project-complete.md` ship in v1b with minimal scope (template-filled `completion-summary.md`, atomic folder move, config clear). No verifier critique in v1b; that lands in v2. §14 v1b bullet list updated to include `complete` sub-command and `stage-project-complete.md`. v2 deferred bucket edited to remove the completion flow and add only the verifier-authored critique variant.
  4. **New Concerns added:** O-26 (`out_of_scope` semantics, LOCKED), O-27 (handoff inputs must be structured, LOCKED), O-28 (v1b completion UX gap, LOCKED). O-25 updated to reference O-26/O-27/O-28 as locked.
  5. **Confidence raised** from 0.70 to 0.75: context -0.08 (handoff contract now parser-free), complexity -0.07 (scope/status separation + structured fields reduce integration ambiguity). Scope and familiarity unchanged. Modest lift — the plan is converging but v1b now includes the completion flow, so scope has grown slightly; the lift comes from reduced brittleness, not reduced scope.

### Iteration 3 (user-directed architectural revision)
- **Self-review (do-plan-reviewer):** PASS — all 5 criteria met on the iteration-2 plan.
- **Council (codex):** CONCERNS. Three new findings:
  1. Wave failure paths escape the project state machine — `stage-verify.md` and `do-verifier.md` instruct failing tasks to spawn a fresh `/do:task` for fixes, which would orphan `active_wave` and handoff metadata when a project wave fails.
  2. `active_task` stomp guard is incomplete — `/do:backlog` writes and reads `active_task` directly (backlog.md lines 170, 238, 266), so backlog start/done could clobber a project-owned active wave.
  3. Scope still too large for one implementation task even after v1a/v1b framing — new command routing + schemas/templates + multiple new scripts + health/config + `/do:continue` routing + command guards + wave execution bridge + handoff + completion/archive is too much for a single task file.
- **User-directed resolution (architectural revision, not reviewer-directed):** user chose a full split over further reuse. `/do:project` becomes a fully independent command family. This supersedes several earlier iteration decisions.
- **Changes made (Iteration 3 revision):**
  1. **Full split adopted.** §9 now reads "full split, agent reuse". `/do:project` neither calls `/do:task` nor replicates it; it ships a parallel pipeline that reuses the existing CALLER-AGNOSTIC agents (do-executioner, do-verifier, do-code-reviewer, do-planner, do-plan-reviewer, do-council-reviewer, do-griller, do-debugger) via project-specific stage references. NO new agents.
  2. **Iteration-1 Option A reverted.** Wave execution files are no longer in `.do/tasks/`. `wave.md` IS the wave's execution state (same body sections as a task file). No `task_file:` pointer. O-9 rewritten to reflect the supersession.
  3. **§6 (Wave execution) rewritten.** Ten-step flow: plan wave → `stage-wave-plan-review.md` → execute via `stage-wave-exec.md` (spawns `do-executioner` targeting `wave.md`) → `stage-wave-code-review.md` → `stage-wave-verify.md` (on failure, routes back into wave workflow: retry / debug / abandon wave / mark wave out_of_scope — NEVER instructs "spawn /do:task"). Resolves council finding #1.
  4. **§10 rewritten as "Isolation model".** `/do:project` does not touch `.do/tasks/` or `active_task`. No cross-command guards added anywhere. `/do:task` / `/do:fast` / `/do:quick` / `/do:backlog` / `/do:continue` are NOT modified. Resolves council finding #2.
  5. **Iteration-1 additions superseded:** §8b greenfield DB gate deleted (project pipeline never hits `check-database-entry.cjs`); §13 health-check reduced to project-only checks (no cross-pipeline drift detection).
  7. **§14 (Delivery) replaced with "Child execution tasks".** Single implementation task supersession: three sibling `/do:task` task files to be authored next (not inside this task). Each child carries `related: ["260418-do-project-orchestrator"]` frontmatter.
     - **Task α — project-contract.** Schemas, `.do/projects/` folder shape, `project-state.cjs`, `project-scaffold.cjs`, health rules, config fields, all templates. Zero orchestrator code, zero skill file, zero stage references.
     - **Task β — project-orchestration.** Depends on α. `skills/do/project.md`, intake grilling (`stage-project-intake.md`), project/phase/wave plan references, wave execution via `stage-wave-exec.md`, wave code review, wave verify (project-aware failure paths — NO "spawn /do:task" instructions), completion flow. Does NOT include resume or phase-exit handoff.
     - **Task γ — project-resume-handoff.** Depends on β. `/do:project resume` + `stage-project-resume.md`, `stage-phase-exit.md` (reads structured wave fields to compose `handoff.md`), cold-start UAT script.
     Resolves council finding #3.
  8. **Concerns updated.** O-4 REMOVED (greenfield DB gate no longer applicable). O-9 SUPERSEDED and rewritten (wave.md is now the execution state). O-22 LOCKED (`/do:continue` vs `/do:project resume` — fully separated commands, both documented). New: O-29 (sibling-reference duplication — accepted), O-30 (parallel single-session `/do:task` + `/do:project` — by design, optional soft-warning). O-25 updated.
  9. **Problem Statement minimally updated (line 35)** to replace "sits above" with "sits alongside (not on top of)" and add the isolation clarification. Acceptance criteria unchanged.
- **Iteration counter reset** to 0 for subsequent plan reviews (user-granted).
- **Confidence raised** from 0.75 to 0.84: context -0.08→-0.04 (isolation removes cross-pipeline coupling), complexity -0.07→-0.06 (sibling references are well-precedented; agent reuse is trivially safe), scope -0.05→-0.05 (three child tasks rather than one, net-same surface area), familiarity -0.05→-0.01 (pattern is now "copy existing stage refs with targeted edits", which is highly familiar).

### Iteration 4 (post-reset iteration 1)
- **Self-review (do-plan-reviewer):** PASS, with one flag — O-5 Resolution paragraph contained stale "wave-plan review uses existing `stage-plan-review.md` unmodified" language that contradicted the iteration-3 split (wave.md is the execution state, not a `.do/tasks/` file).
- **Council (codex):** CONCERNS. Two findings:
  1. **Internal inconsistency after iteration-3 split.** Multiple normative sections still carried pre-split language: AC4 (hand-off to `/do:task` pipeline + `/do:continue` project-aware variant), AC6 (guards on existing commands), O-5 Resolution (`stage-plan-review.md` reuse), O-12 (`active_task`-based parallel-wave limits). General sweep requested for all remaining leftovers outside Review Iterations.
  2. **Caller-agnostic agents claim overstated.** Agent specs today carry task-pipeline-specific literals: `do-verifier.md` hardcodes `.do/tasks/<active_task>`, `/do:task`, `/do:continue`, `active_task` in failure/complete flows (lines 83, 190–198, 212–213, 273, 283, 285, 292, 320, 334, 348, 353, 377–378, 381, 391); `do-executioner.md` references "task file" and `/do:continue` on failure (lines 18, 25, 35, 136, 199, 202); `do-planner.md`, `do-plan-reviewer.md`, `do-code-reviewer.md`, `do-council-reviewer.md`, `do-griller.md` all use "task file" terminology. The plan's "same agent binary, different prompt" claim is factually wrong without agent-spec edits. Two options: (a) make agents genuinely caller-agnostic via minor spec edits in Task β; (b) override-prompt hack in each project-side stage ref. Council recommendation: option (a), cleaner and aligns with the reuse story.
- **User directive:** pick option (a) and lock it. Specify exact agent-spec edits in Task β's scope (§14). Update §8 and §9 accordingly. Add O-31 for drift prevention via `/do:optimise` audit. Preserve historical iteration notes as audit trail.
- **Changes made (Iteration 4 revision):**
  1. **AC4 rewritten.** Now reads: "(a) start a new project, (b) run the intake grill, (c) produce an initial project.md plus at least one phase.md, (d) execute a wave via the project-specific pipeline (`stage-wave-exec.md` → `do-executioner` targeting `wave.md`), (e) resume cold from disk via `/do:project resume`. `/do:continue` is not project-aware; it stays task-pipeline-only."
  2. **AC6 rewritten.** Now reads: "`/do:project` does not touch `.do/tasks/` or `active_task`; existing `/do:task` / `/do:fast` / `/do:quick` / `/do:backlog` / `/do:continue` are unmodified. A one-way advisory (task pipeline reads `active_project` to print a soft notice) is the only touchpoint, and is optional (see O-30)." Removes all guard language.
  3. **O-5 Resolution rewritten.** Now reads: "v1 wires council review at the project-plan / phase-plan / wave-plan gates via new project-specific sibling references (`stage-project-plan-review.md`, `stage-phase-plan-review.md`, `stage-wave-plan-review.md`). Existing `stage-plan-review.md` is untouched and owns only task-pipeline reviews. Each project-side reference follows the same structural pattern but reads project.md / phase.md / wave.md respectively. Council gating is per-config." Stale "uses existing `stage-plan-review.md` unmodified" line removed.
  4. **O-12 rewritten.** Now scoped to project-pipeline constraints only (`active_wave` on phase.md, `project-state.cjs` enforcement). Removed all `active_task` references — the task pipeline's active-task invariant is irrelevant to project waves under the split.
  5. **§8 extended with agent-spec revision table.** Each affected agent listed with its task-pipeline-specific line numbers and the exact kind of edits required (remove hardcoded `.do/tasks/<active_task>` paths, remove `/do:task` / `/do:continue` from failure instructions, substitute "task file" → "target file"). `do-debugger.md` confirmed CLEAN — no edits needed. `do-council-reviewer.md` confirmed already parameterised — terminological tidy only. Five kinds of edits enumerated exhaustively.
  6. **§9 updated.** Option table adds "prompt-override hack" row and rejects it as brittle. Chosen path relabelled "Full split, reuse agents with spec clean-up". Explicitly routes agent-spec revision to Task β.
  7. **Task β scope (§14) extended.** New bullet group listing each agent spec file and the exact nature of its revision. Explicitly minor — no new agents, no new tools, no new prompt templates.
  8. **O-31 added.** "Agent spec drift under dual-pipeline reuse" — risk: future task-pipeline changes silently re-hardcode task-specific language. Mitigation: `/do:optimise` grep-lint on `agents/*.md` for `.do/tasks/`, `/do:task`, `/do:continue`, `active_task` literals in caller-facing text. LOCKED.
  9. **O-25 updated.** Locked-list now includes O-29, O-30, O-31. Iteration counter noted as post-reset iteration 1 (1/3 of the reset budget).
  10. **Full sweep done.** All remaining `active_task` / `.do/tasks/` / `/do:task` references in the task file outside Review Iterations are correct usage (state ownership tables, isolation descriptions, O-30 advisory). Historical iteration notes in Iteration 1/2/3 are preserved verbatim as audit trail.
- **Confidence raised** from 0.84 to 0.86: context -0.04→-0.04 (unchanged), scope -0.05→-0.04 (agent-spec edits add a small prerequisite, but are now explicitly enumerated rather than hand-waved), complexity -0.06→-0.05 (one axis of the "same agent binary" claim is now backed by a concrete edit list rather than an assertion), familiarity -0.01→-0.01 (unchanged). Modest lift — the architecture did not change; this revision closed residual inconsistencies and scoped an edit list that was previously implicit.

### Iteration 5 (post-reset iteration 3)
- **Mode:** user-approved hand-edit-plus-planner-reconciliation pass. The user hand-drafted edits addressing iteration-4 council findings 1-2 and part of finding 3; the planner (this pass) verified those edits, finished §11 (the remaining part of finding 3), reconciled cross-references, and logged this iteration. No council re-spawn this iteration — the revisions close already-identified gaps rather than introduce new architecture. This is the last iteration in the post-reset budget.
- **Findings addressed** (all carried over from iteration-4 council review; summarised, not re-quoted):
  1. `phase complete` was split awkwardly between Task β (routing) and Task γ (the `stage-phase-exit.md` handoff artefact), so β alone would ship a broken subcommand.
  2. §8's agent-spec revision table captured the terminological substitutions but was silent on the NEW structured-frontmatter write behaviour that §2 assigns to do-executioner (`modified_files`, `discovered_followups`) and do-verifier (`unresolved_concerns`).
  3. §11's backlog integration was half-wired: it mentioned `--from-backlog <id>` and an automatic `/do:backlog done <id>` trigger, but no `backlog_item` field on phase/wave schemas, no `--from-backlog` flag in the §1 skill layout, and no precise specification of when/where the `done` trigger fires.
- **Changes landed this iteration:**
  1. **Finding 1 — §14 Task β scope** gains a dedicated bullet "Phase-complete state transition only (no handoff artefact)" clarifying that β ships state transition + changelog + `active_phase` clear, and prints a "Handoff artefact pending (Task γ)" stub when invoked without γ. Completion (§12) explicitly documented as runnable without γ because it reads `wave.md` frontmatter directly.
  2. **Finding 1 — §14 Task γ scope** gains a "Hook point" note on the `stage-phase-exit.md` bullet: γ wires the handoff render into β's `phase complete` routing, running after β's state transition completes.
  3. **Finding 2 — §8 agent-spec revision table** (do-verifier and do-executioner rows) now splits each cell into "(a) Terminological" and "(b) NEW RESPONSIBILITY — structured handoff write" subsections, explicitly describing the frontmatter-presence-gated write behaviour for each agent, citing the §2 item shapes.
  4. **Finding 2 — §8 "Kinds of edits" list** reorganised into "Terminological (edits 1-5)" covering all seven affected agents and "Behavioural (edit 6)" covering only do-executioner and do-verifier. Edit 6 spells out the array-presence switch: if `modified_files[]` / `unresolved_concerns[]` / `discovered_followups[]` exist in target-file frontmatter, write them; otherwise no-op. Plain task files remain unaffected.
  5. **Finding 2 — §14 Task β scope** agent-spec revision block now annotates each of do-verifier and do-executioner with `(terminological)` and `(behavioural, new)` subsections so the scope matches §8's revision table.
  6. **Finding 3 — §1 skill layout** — `phase new` and `wave new` subcommand lines now mention the `--from-backlog <id>` flag with a cross-reference to §11.
  7. **Finding 3 — §2 frontmatter schemas** — `phase.md` and `wave.md` each gain a `backlog_item: <id> | null` field (default `null`; set when seeded via `--from-backlog`; consumed on complete per §11).
  8. **Finding 3 — §11 tightened (planner-authored this iteration).** §11 now specifies the `/do:backlog done <id>` auto-trigger precisely: fires in exactly two places, both on the state-transition side owned by Task β (never γ). (a) Inside `/do:project phase complete`, immediately after `project-state.cjs` writes the phase `completed` transition and appends to `changelog.md`, only if `phase.md.backlog_item != null`, β invokes `/do:backlog done <id>` — this runs before γ's `stage-phase-exit.md` handoff render as an independent step. (b) Inside `stage-wave-verify.md`'s success path (§6 step 5), after the wave `completed` write, only if `wave.md.backlog_item != null`, the stage invokes `/do:backlog done <id>`. §11 also re-affirms "mostly self-contained" framing: these two triggers + the `--from-backlog` seed reads are the ONLY touchpoints between the project pipeline and `/do:backlog`. No auto-`add`, no auto-`start`, no other reads of backlog state. `/do:backlog` itself is unmodified.
- **Corrections to hand-edits:** none. Verified that §1 (skill-layout `--from-backlog` mentions), §2 (`backlog_item` fields on both schemas), §14 β/γ (phase-complete split + Hook point), and §8 (table + Kinds of edits reorganisation + Task β scope annotations) were all internally consistent and sufficient for findings 1-2 and the schema/layout parts of finding 3. No drive-by rewrites.
- **What was intentionally NOT changed:** §3 state machine, §6 wave execution flow, §7 phase-exit content contract, §9 full-split architecture, §10 isolation model, §12 completion flow, §13 health-check list, §14 Task α scope, all O-N concerns, iteration 1-4 audit trail. The locked architecture is untouched; this iteration closes specification gaps, not design choices. `council_review_ran.plan` remains `false` (plan-review reference's job to flip it).
- **Confidence raised** from 0.86 to 0.89: context -0.04→-0.03 (backlog wiring now fully specified end-to-end — schemas, skill flags, trigger points — removes the last ambiguity in the cross-command integration surface), scope -0.04→-0.03 (β/γ boundary now crisp on the phase-complete subcommand — no more "broken sub-command if β ships alone" ambiguity), complexity -0.05→-0.04 (§8 edit 6 is now explicitly called out as a distinct behavioural edit with its own item-shape references, reducing reviewer risk of missing it during Task β implementation), familiarity -0.01→-0.01 (unchanged — the edits follow the same patterns already established in earlier iterations). Modest lift of +0.03. The architecture has not changed; three specification gaps have closed.

### Iteration 6 (user-granted extension)
- **Mode:** user-granted 1-iteration extension beyond the post-reset 3/3 budget. Iteration 5 had been the final iteration in the post-reset budget, but plan-reviewer and council both returned CONCERNS on the iteration-5 review surfacing three specification-seam gaps. The user granted one additional iteration to close them. No architectural change; purely cross-reference cleanup.
- **Findings addressed** (three specification seams — plan-reviewer + council, iteration-5 review; no new architectural risk):
  A. **`project-resume.cjs` was unassigned.** §1 line 147 declared `skills/do/scripts/project-resume.cjs` as a delegated script ("reads active project's state, returns the next action to take"), but no child task (§14 α/β/γ) owned it. Task α owned the other three project-state scripts but not resume; Task β explicitly excluded resume; Task γ listed the resume stage reference and UAT but not the CJS helper.
  B. **§7 "no prose parsing" contradicted the body-section read.** §7 claimed "All inputs are on `wave.md` directly — there is no sibling task file and no prose parsing" while simultaneously specifying `## What Shipped` as "one line pulled from `wave.md`'s `## Review Notes` section" — a body-section prose read. The contract had to be genuinely parser-free to satisfy the O-27 guarantee.
  C. **§12 contradicted Task β.** §12 stated `stage-project-complete.md` "reads `project.md` and each phase's `handoff.md` path" and renders a `## Completed Phases` section linking to each `handoff.md`, yet Task β (§14) asserted "Project-complete may run without γ because §12's completion flow reads `wave.md` frontmatter directly, not phase `handoff.md`." These cannot both be true: γ owns `handoff.md` rendering, so β running completion without γ would have no handoff artefacts to read or link to.
- **Changes landed this iteration:**
  1. **Finding A — Task γ scope (§14)** gains a new bullet assigning `skills/do/scripts/project-resume.cjs` to γ: "reads active project's state (project.md / phase.md / wave.md frontmatter in that order) and returns the next action to take (which stage reference to invoke, with what target file). `stage-project-resume.md` delegates the 'what's the next action' computation to this helper rather than re-implementing it inline." Rationale: §1 lists `project-resume.cjs` as a first-class delegated script with a distinct machine-readable responsibility; the stage reference is the natural home (same task that owns `stage-project-resume.md`). Option to delete the script from §1 and fold the logic into the stage reference was rejected — keeping it as a CJS helper mirrors the pattern of `project-state.cjs` / `project-scaffold.cjs` / `project-health.cjs` and gives the stage reference a clean machine-readable dependency.
  2. **Finding B — new `wave_summary` frontmatter field.** §2 wave.md schema gains `wave_summary: <string> | null` next to the other handoff harvest fields. §2 ownership table gains a fourth row: do-verifier writes `wave_summary` at end of wave verification (one-sentence summary derived from the verifier's pass summary). §7 step 3 updated to list `wave_summary` in the set of frontmatter fields read by `stage-phase-exit.md` and updated to read `## What Shipped` from `wave_summary` frontmatter rather than from `## Review Notes` body section. §7 explicitly notes that `## Review Notes` remains in the wave.md body-section list for human readability, but is no longer a `stage-phase-exit.md` input. §8 agent-spec revision table (do-verifier row, edit (b)) now lists `wave_summary` alongside `unresolved_concerns[]` / `discovered_followups[]` in the frontmatter-presence-gated write behaviour. §8 "Kinds of edits" edit 6 updated likewise. §13 `missingHandoffFields` health check updated to also flag missing populated `wave_summary` on completed waves. §14 Task β do-verifier bullet extended to mention `wave_summary` alongside the other writes.
  3. **Finding C — γ is a hard prerequisite for `/do:project complete`.** §12 opening paragraph rewritten to make the dependency on γ explicit: `stage-project-complete.md` reads `project.md` and each phase's `handoff.md` (rendered by γ's `stage-phase-exit.md` at each phase boundary). Without γ, `/do:project complete` blocks with "Complete requires phase handoff artefacts (Task γ)." §14 Task β completion bullet rewritten: stage-project-complete.md ships in β but is gated on γ; β remains landable without γ for the hot-session flow (new / phase transitions / wave execution / abandon) — only `/do:project complete` is gated on γ. §14 Task γ scope gains a "Hard-prerequisite relationship" paragraph stating γ is a hard prereq for both the phase-complete handoff artefact (β prints the stub without γ) AND for `/do:project complete` running end-to-end. Alternative (moving `stage-project-complete.md` from β into γ) was considered and rejected: it keeps β's completion scope intact and matches γ's actual architectural dependency — the completion flow reads handoff artefacts that γ produces, so γ is a natural prerequisite, not a natural owner.
- **What was intentionally NOT changed:** §3 state machine, §6 wave execution flow, §7 content contract for handoff.md sections (only the input source for `## What Shipped` was changed — from body-section prose to frontmatter field), §9 full-split architecture, §10 isolation model, §13 health-check list apart from the `missingHandoffFields` extension, iteration 1-5 audit trail verbatim, all O-N concerns. No new concerns — these findings are specification cleanups, not new risks. `council_review_ran.plan` remains `false` (owned by the plan-review reference). `stage` remains `refinement` / `in_progress`.
- **Cross-references touched:** Finding A → §14 Task γ only. Finding B → §2 schema + §2 ownership table + §7 step 3 + §8 agent-spec table (do-verifier row) + §8 "Kinds of edits" edit 6 + §13 missingHandoffFields + §14 Task β do-verifier bullet. Finding C → §12 opening paragraph + §14 Task β completion bullet + §14 Task γ hard-prerequisite paragraph.
- **Confidence raised** from 0.89 to 0.91: context -0.03→-0.02 (last prose-read input removed; handoff pipeline is now fully structured end-to-end), scope -0.03→-0.03 (unchanged — no net scope change; `project-resume.cjs` was always listed in §1, just not assigned), complexity -0.04→-0.03 (γ-prereq relationship for `/do:project complete` now explicit rather than contradictory; reviewer risk of misinterpreting β/γ delivery order removed), familiarity -0.01→-0.01 (unchanged — same patterns). Modest lift of +0.02. The architecture has not changed; three specification seams have closed. No new concerns surfaced.

### Iteration 7 (user-waived iteration-budget extension)
- **Mode:** user-waived iteration-budget enforcement to close three findings from iteration-6's council. Two findings (D, F) required reading external files the plan referenced — not trusting the task file's claims about them. One finding (E) required re-examining a patch landed earlier in the β/γ split to remove dual-ownership of `phase complete` state transition. No architectural change; cross-reference cleanup + one new sibling reference file assigned to γ.
- **External files read before editing** (mandatory pre-work for findings D and F):
  - `skills/do/scripts/project-health.cjs` — existing 257-line `checkProjectHealth()` function. Owns task-pipeline integrity checks for `/do:init`: `.do/` folder existence, `config.json` schema (version / project_name / council_reviews.{planning,execution,reviewer} / auto_grill_threshold), `.do/tasks/` folder existence, and `active_task` integrity (including path-traversal guard + stale-reference warning). Returns `{healthy, version, issues[]}`. Structurally simple, moderate-size, linear — adding project-folder checks to the same function is trivial.
  - `skills/do/references/resume-preamble.md` — existing R0 preamble hardcoded to `.do/tasks/<active_task>` throughout: R0.1 reads task-file frontmatter from `.do/tasks/<active_task>`, R0.3 invokes `load-task-context.cjs`, R0.4 stale-reference prompt, R0.5 stage table keyed to task-pipeline stages (grilling / execution / verification / verified) with Execution Log as the "last action" source, R0.6 mid-execution progress check reading task-pipeline Execution Log and Approach. References `/do:continue` in stale-reference and pause prompts. Structurally dense but sub-step-delineated — cleanly mirrorable as a sibling.
- **Findings addressed** (all carried over from iteration-6 council, requiring external reads or a revisit of iteration-6's β/γ patch):
  D. **`project-health.cjs` ownership conflict.** §1 line called it "(extend existing)" and §13 claimed "No cross-pipeline checks", but the existing script already owns `/do:init`'s task-pipeline integrity validation (`.do/tasks/` folder, `active_task` integrity, config schema, etc.). If Task α "implemented" `project-health.cjs` the existing coverage would regress. §14 Task α scope claim "implements all checks in §13 (no cross-pipeline checks)" ambiguously risked replacement rather than extension.
  E. **`phase complete` dual ownership.** §7 step 5 (pre-iteration-7) stated `project-state.cjs` sets previous phase `completed` and promotes next phase — but didn't specify which file owns the call. Meanwhile §14 Task β scope (post-iteration-6) stated β owns state transition + `active_phase` clear + changelog append for `/do:project phase complete`. Reading §7 and §14 together created a dual-owner ambiguity: was `stage-phase-exit.md` (γ) or the `/do:project phase complete` subcommand (β) calling `project-state.cjs`? Race / confusion risk.
  F. **`resume-preamble.md` hardcoding.** Task file (pre-iteration-7) claimed `stage-project-resume.md` "composes `resume-preamble.md`" but the reference is hardcoded to `/do:continue` and `.do/tasks/<active_task>`. No child task was scoped to parameterise it or add a sibling. Genuine blocker for AC4 cold-start resume path — γ couldn't ship the cold-start flow without a resume preamble that reads project-pipeline state.
- **Changes landed this iteration:**
  1. **Finding D — option D1 chosen** (extend existing, single script). Rationale based on reading `project-health.cjs`: the existing `checkProjectHealth()` function is moderate-size (257 lines), structurally simple (linear check list returning `{healthy, version, issues[]}`), and already established as `/do:init`'s single script call. A sibling `project-folder-health.cjs` (D2) would require `/do:init` to call two scripts, merge their `issues[]` arrays, and maintain two health-check code paths — more plumbing for no semantic gain. D1 appends project-folder checks to the same `issues[]` array under the same JSON return shape. §1 delegated-scripts bullet rewritten to make "additive only" explicit and enumerate the pre-existing checks so α's implementer cannot accidentally remove them. §13 framing sentence rewritten from "No cross-pipeline checks" to "No cross-pipeline checks beyond what the script already performs for `/do:init`'s task-pipeline integrity … the new checks below are purely additive." §14 Task α `project-health.cjs` bullet rewritten from "implements all checks in §13" to "extends the existing script's `checkProjectHealth()` function" with an explicit "existing task-pipeline integrity checks … stay intact" assurance.
  2. **Finding E — option E1 chosen** (β owns state transition, γ render-only). Rationale: β's phase-complete state transition is cheap, a user-visible subcommand should not be gated on γ, and keeping γ render-only preserves the iteration-6 finding-1 split the user already approved. §7 step 5 rewritten to make the ownership unambiguous: β's `/do:project phase complete` subcommand calls `project-state.cjs` (state transition + `active_phase` update + `changelog.md` append), THEN invokes `stage-phase-exit.md` as the render step. Without γ, β still runs the transition and prints "Handoff artefact pending (Task γ)" stub in place of the render. §7 step 6 rewritten to confirm the terminal print of `## Next Phase Entry Prompt` is β's responsibility, post-γ-render (reads from the `handoff.md` γ just wrote); without γ, β skips the terminal print. §14 Task γ `stage-phase-exit.md` bullet rewritten to explicitly forbid the file from calling `project-state.cjs` or mutating frontmatter — "strictly reader/renderer: ingest state, write `handoff.md`, return." §14 Task β phase-complete bullet verified consistent (already says β owns transition); no edit needed.
  3. **Finding F — option F1 chosen** (sibling file, not parameterisation of the shared file). Rationale: consistent with iteration-3's locked pattern of sibling stage references per pipeline rather than parameterisation; duplication accepted by O-29. Rejected F2 (parameterise `resume-preamble.md`) because parameterisation would introduce cross-pipeline coupling (`/do:continue` and `/do:project resume` both depend on the same file) — the exact coupling iteration 3 eliminated. §1 delegated-references list gains `resume-preamble-project.md` bullet positioned directly beneath `stage-project-resume.md` (its caller), with a description of what differs from the task-pipeline sibling (target files, changelog as "last action" source, command label). §7 cold-start resume flow step 5 rewritten to reference `resume-preamble-project.md` with an explicit note that the task-pipeline's `resume-preamble.md` is NOT invoked from the project pipeline. §14 Task γ scope gains a new bullet assigning `skills/do/references/resume-preamble-project.md` to γ (positioned beside `stage-project-resume.md` and `project-resume.cjs`, since all three are the resume triad), with the "original `resume-preamble.md` is NOT modified" invariant explicit. Context Loaded entry for `resume-preamble.md` annotated to note the sibling ships in γ and the original stays untouched.
- **What was intentionally NOT changed:** §3 state machine, §6 wave execution flow, §7 content contract for handoff.md sections (only step-5 and step-6 ownership semantics changed; the §7 body-content spec is unchanged), §9 full-split architecture, §10 isolation model, §12 completion flow, §13 health-check list body (only the framing sentence was clarified; the check table is unchanged), all O-N concerns (no new risks surfaced — these are specification cleanups not new design choices), iterations 1-6 audit trail verbatim. `council_review_ran.plan` remains `false` (owned by the plan-review reference). `stage` remains `refinement` / `in_progress`. No new concerns added.
- **Cross-references touched:**
  - Finding D → §1 `project-health.cjs` delegated-scripts bullet + §13 framing paragraph + §14 Task α `project-health.cjs` scope bullet.
  - Finding E → §7 cold-start handoff flow steps 5 and 6 + §14 Task γ `stage-phase-exit.md` scope bullet. §14 Task β phase-complete bullet verified consistent (unchanged).
  - Finding F → §1 delegated-references list (new `resume-preamble-project.md` entry + amended `stage-project-resume.md` entry) + §7 cold-start resume-flow step 5 + §14 Task γ scope (new `resume-preamble-project.md` bullet) + Context Loaded `resume-preamble.md` annotation.
- **Confidence raised** from 0.91 to 0.93: context -0.02→-0.02 (unchanged — findings D/F required external reads but the reads confirmed the design is clean, no new ambiguity), scope -0.03→-0.02 (β/γ ownership of phase-complete is now crisp: β does transition, γ renders; resume-preamble-project.md is now explicitly assigned to γ instead of a hole in the scoping), complexity -0.03→-0.02 (three specification gaps closed, one of which — F — was a genuine blocker for AC4 cold-start because no child task previously owned the project-side resume preamble; E's dual-owner ambiguity removed reviewer risk), familiarity -0.01→-0.01 (unchanged — sibling-reference pattern is well-precedented in this plan). Modest lift of +0.02. The architecture has not changed; three specification gaps have closed (one of which was a latent AC4 blocker). No new concerns surfaced.

### Iteration 8 (user-waived iteration-budget extension)
- **Mode:** user-waived iteration-budget enforcement. Two findings (G, H) carried over from post-iteration-7 review. G is a small edge-case fix — the plan had undefined behaviour on terminal-phase completion (`## Next Phase Entry Prompt` referenced `<next-phase>` unconditionally; `stage-phase-exit.md` rendered the block unconditionally; β's step-5 state transition had no terminal branch). H is a substantive addition — §1 and §7 referenced a sibling `resume-preamble-project.md` but said it "mirrors R0.1-R0.6 structure" of `resume-preamble.md` without actually specifying the steps, and one of those steps (R0.3's `load-task-context.cjs` call) is a task-only primitive that does not translate to projects, so γ's implementer would have been stuck inventing the spec by analogy. This iteration writes the full step-by-step for the sibling preamble inline in the plan as a new §7.5 sub-section. No architectural change; one edge-case rule + one specification expansion.
- **External files read before editing** (mandatory pre-work for finding H):
  - `skills/do/references/resume-preamble.md` — existing R0 preamble, full file. Confirmed step structure: R0.1 load task markdown → R0.2 detect context state → R0.3 reload context (invokes `load-task-context.cjs "<task-description>"` — task-only primitive, must be replaced for project pipeline) → R0.4 handle stale references → R0.5 display resume summary (table keyed on task-pipeline stages: grilling / execution / verification / verified; "last action" sourced from Execution Log) → R0.6 mid-execution progress check (execution stage only, parses Approach + Execution Log). Preamble referenced `/do:continue` in R0.4 and R0.5 pause prompts and R0.6 completion prompt. These three axes — (1) keyword-based context loader, (2) task-file-only stage table, (3) `/do:continue` references — are the primitives that cannot be reused for project pipeline; all three are explicitly replaced in §7.5's R0.1p-R0.6p spec.
- **Findings addressed:**
  G. **Terminal-phase completion undefined.** §7 assumed every `phase complete` has a next phase to promote. §7 step 5 unconditionally said β promotes next phase to `planning`; §7's `## Next Phase Entry Prompt` block unconditionally used `<next-phase>`; `stage-phase-exit.md` always rendered the block. Terminal phase (last in-scope phase in `project.md`'s `phases[]`) was undefined behaviour — a real bug for any project that ever completes end-to-end.
  H. **`resume-preamble-project.md` needed a full step-by-step spec.** §1 and §14 Task γ named the file and said it "mirrors R0.1-R0.6 structure" of `resume-preamble.md`, but mirroring by analogy fails at R0.3 (the task-pipeline's `load-task-context.cjs` keyword loader has no project-pipeline equivalent — project context is fully structured on disk via frontmatter fields and §2 folder layout). γ's implementer would have had to invent the spec; worse, the task-file stage table in R0.5 does not map to the three target-file types (project.md / phase.md / wave.md). Required a real step-by-step, not a reference by analogy.
- **Changes landed this iteration:**
  1. **Finding G — terminal-phase rule applied across §2 / §7 / §12 / §13 / §14.**
     - **§2 body-sections list** (handoff.md) updated: `## Next Phase Entry Prompt` annotated as **conditional** — rendered only when a next in-scope phase exists; replaced by `## Project Completion Hint` (single line: "This was the final phase. Run `/do:project complete` to finalise the project.") on terminal phase. Cross-reference to §7 steps 3 / 5 / 6.
     - **§7 step 3** extended with a "Conditional rendering" note on `## Next Phase Entry Prompt`: emitted only if `project.md`'s `phases[]` array has a next in-scope phase; otherwise replaced by `## Project Completion Hint`. Terminal detection done by `stage-phase-exit.md` at render time by reading `phases[]` and checking whether any subsequent entry exists.
     - **§7 step 5** rewritten: β's state transition now has explicit terminal and non-terminal branches. Non-terminal: promote next phase to `planning`, set `active_phase` to its slug (unchanged from pre-iteration-8 behaviour). Terminal: set `active_phase: null`, leave `project.md` `status: in_progress` (NOT `completed` — explicit `/do:project complete` still required per §12). Changelog records "final phase completed, awaiting `/do:project complete`".
     - **§7 step 6** rewritten: β's terminal print behaviour now branches on phase type. Non-terminal phase: read `## Next Phase Entry Prompt` from handoff.md and print with clear-and-paste suggestion (unchanged). Terminal phase: read `## Project Completion Hint` instead and print that single line. Fall-through behaviour (without γ) unchanged — β skips the terminal print regardless of terminal status because there is no handoff.md to read from.
     - **§12 step 1** extended with a "Canonical pre-state" clarification: after the final phase's `/do:project phase complete` runs, the project sits at `active_phase: null` + `status: in_progress` + every in-scope phase `completed`. This is the valid "awaiting `/do:project complete`" state that this subcommand consumes — it is not a health-check issue and does not block.
     - **§13** gained an "Explicit non-issue" note at the end (before the "Project Issues:" hand-off sentence — actually positioned after): a project with `active_phase: null` AND `status: in_progress` AND at least one phase `status: completed` AND every in-scope phase `completed` is the valid post-terminal-phase state and is NOT flagged by `activeProjectNoActivePhase`. The warning fires only when in-scope phases remain incomplete. Preempts reviewer confusion about false-positive health flags during the terminal-phase → `/do:project complete` window.
     - **§14 Task γ `stage-phase-exit.md` bullet** gained a "Terminal-phase rendering contract" paragraph: detect terminal by reading `project.md`'s `phases[]`; emit `## Next Phase Entry Prompt` if a next in-scope entry exists; emit `## Project Completion Hint` otherwise. All other body sections render identically.
  2. **Finding H — §7.5 new sub-section written with full numbered step-by-step spec.** §7.5 titled "Project resume preamble — step-by-step spec for `resume-preamble-project.md`". Structure: preamble (structural parallel to the task-pipeline preamble + the three task-pipeline primitives that must be replaced + caller contract from `stage-project-resume.md`), then numbered steps R0.1p through R0.6p. Each step names explicitly what differs from its task-pipeline counterpart:
     - **R0.1p — Load target-file markdown.** Reads frontmatter fields and body sections specific to each of `project` / `phase` / `wave` target-file types (per §2 schemas).
     - **R0.2p — Detect context state.** Same heuristic as task-pipeline R0.2 with one wrinkle: the preamble is called three times in a row by `stage-project-resume.md`, so subsequent invocations can assume project-level context is already loaded if the first invocation completed without a stale-reference stop.
     - **R0.3p — Reload context (project-native).** Replaces the `load-task-context.cjs` keyword loader entirely with structured reads per target-file type: project-scope reads `## Vision` / `## Target Users` / `## Non-Goals` / `## Success Criteria` / `## Constraints` / `## Risks` / `## Phase Plan` bodies + optional `database_entry` link; phase-scope reads `entry_context[]` paths + optional backlog entry; wave-scope reads parent phase's `## Wave Plan` entry + previous phase's `handoff.md` (if exists) + project.md's `## Constraints` / `## Risks`. Always: last 10 changelog entries. No keyword matching, no fuzzy path matching — all paths are structured.
     - **R0.4p — Handle stale references.** Same blocking-prompt shape as R0.4, with "`<target-file-type>.md` has enough context to resume" and `/do:project resume` (not `/do:continue`) in stale-reference prompts. Resume-skip path logs to `changelog.md`.
     - **R0.5p — Display resume summary.** Replaces the task-pipeline stage table with a 13-row target-file-type × status table covering all valid combinations of {project, phase, wave} × {intake, planning, in_progress, blocked, completed}. "Last action" source varies: project-scope uses `changelog.md` last entry; phase-scope uses changelog entries scoped to `phase:<phase_slug>`; wave-scope uses wave.md's Execution Log (for `stage: execution`) or `wave_summary` frontmatter (for `completed`). Pause prompt uses `/do:project resume`.
     - **R0.6p — Mid-execution progress check (wave-scope only).** Same three sub-steps (Parse Approach / Match completed work / Display checklist) as task-pipeline R0.6 but authoritative "completed work" source switches from Execution Log prose to the wave.md `modified_files[]` frontmatter array (§2 canonical source). No-op at project and phase scope — those files do not carry an Execution Log.
     - **Files referenced** and **Not referenced** sections close §7.5 with the explicit list of project-pipeline paths used and the task-pipeline primitives explicitly excluded (`load-task-context.cjs`, `.do/tasks/<file>.md`, `/do:continue`).
  3. **Finding H cross-references updated.**
     - **§1 delegated-references `resume-preamble-project.md` bullet** rewritten to point at §7.5 as the authoritative spec ("do not re-derive by analogy") with a one-paragraph summary of the replacements.
     - **§7 cold-start resume flow step 5** rewritten: "Invoke `resume-preamble-project.md`'s step-by-step (see §7.5 for the full numbered spec) targeting project.md, then phase.md, then wave.md in order. Each invocation runs the full R0.1p–R0.6p sequence against that single target file."
     - **§14 Task γ `resume-preamble-project.md` bullet** rewritten to point at §7.5 ("do not re-derive by analogy"), with explicit enumeration of the four replacements vs. the task-pipeline sibling.
- **What was intentionally NOT changed:** §3 state machine, §6 wave execution flow, §7 content contract for handoff.md body sections (the conditional-rendering rule on `## Next Phase Entry Prompt` is new, but the section-by-section content contract for `## What Shipped` / `## What Remains` / `## Open Decisions` / `## Files of Record` is unchanged), §8 agent coverage map, §9 full-split architecture, §10 isolation model, §11 backlog integration, §12 completion flow body (only step 1 gained a pre-state clarification), §13 health-check table (only the post-table note is new — the check list is unchanged), iteration 1-7 audit trail verbatim, all O-N concerns (no new risks — G is a spec cleanup; H is a spec expansion). `council_review_ran.plan` remains `false` (owned by the plan-review reference). `stage` remains `refinement` / `in_progress`. No new concerns added.
- **Cross-references touched:**
  - Finding G → §2 handoff.md body-sections list + §7 step 3 + §7 step 5 + §7 step 6 + §12 step 1 + §13 post-table non-issue note + §14 Task γ `stage-phase-exit.md` bullet.
  - Finding H → §1 delegated-references `resume-preamble-project.md` entry + §7 cold-start resume-flow step 5 + §7.5 (new sub-section, full step-by-step spec) + §14 Task γ `resume-preamble-project.md` bullet.
- **Confidence raised** from 0.93 to 0.95: context -0.02→-0.01 (the post-terminal-phase state was a lurking ambiguity; §7.5's written-out spec removes γ-implementer guesswork on the sibling preamble — two of the last spec ambiguities close), scope -0.02→-0.02 (unchanged — G is an edge case within existing §7/§12/§13 scope; H is a sub-section within existing §7 scope, not new scope), complexity -0.02→-0.01 (§7.5's explicit R0.1p-R0.6p numbered spec removes the "invent by analogy" risk for γ; terminal-phase branching is now crisp at every step), familiarity -0.01→-0.01 (unchanged — sibling-reference + conditional-rendering patterns are well-precedented). Modest lift of +0.02. The architecture has not changed; one edge-case rule + one specification expansion have closed. No new concerns surfaced.

### Iteration 9 (user-waived iteration-budget extension)
- **Mode:** user-waived iteration-budget enforcement. Two cleanup findings (I, J) carried over from post-iteration-8 review. I is an ownership gap — four file updates listed in §1 had no explicit owner in §14's α/β/γ split, and §14 line 813 also referenced a `related` frontmatter addition on `task-template.md` without assignment. J is a long-standing "deferred to v1 implementation" decision on changelog shape (O-20) that the rest of the design has implicitly relied on being the single-file form; locking it avoids the risk of the v1 implementer flipping to a directory form and breaking §7.5 R0.3p's "last 10 entries" read contract. No architectural change; ownership clarification + one deferred-decision lock.
- **External files read before editing** (mandatory pre-work for finding I — verifying §1 lines 149-153's claimed update types match each file's actual shape, per the reviewer's instruction not to rubber-stamp):
  - `skills/do/do.md` — current file (71 lines). `## Sub-commands` table at lines 20-32 (ten `/do:*` rows); `## Routing` examples list at lines 38-62 (about twenty concrete examples). The claim "add row + routing example" fits cleanly — both edit sites are well-defined and additive, no removals needed.
  - `skills/do/init.md` — current file (91 lines). Structurally a thin router: `## Routing Logic` delegates to three `@references/init-*.md` files via a three-step check (workspace marker → at-workspace-root → project initialised). The file itself does NOT invoke any scripts — script invocation lives in the downstream reference files. The §1 pre-iteration-9 claim "delegate project-folder health to new script" was loose — `init.md` already delegates to `init-health-check.md`, which is where the new project-folder checks belong. Finding I's reassignment pushes the load-bearing edit into `init-health-check.md` (Task α) and leaves `init.md` with only an additive Quick-Reference / Files note (or no edit at all if no natural insertion point exists).
  - `skills/do/references/init-health-check.md` — current file (133 lines read). Structure: `## Step 1-5` procedure + `## Issue Types` section with two sub-tables (`### Workspace Issues` lines 112-121, `### Project Issues` lines 123-133). The claim "add project-shape checks to the output" fits — Task α extends the `### Project Issues` sub-table with the new §13 issue types + severities + fixes. Step 5's combined-health-report rendering already handles arbitrary `issues[]` entries, so no rendering-flow change needed.
- **Findings addressed:**
  I. **Unassigned edits to existing files.** §1 lines 149-153 listed updates to `skills/do/do.md`, `skills/do/init.md`, `skills/do/references/init-health-check.md`, and `skills/do/references/config-template.json` under "Update existing files (minimal, non-invasive)", but none of the four were explicitly attributed to α / β / γ in §14's child-task scope bullets. §14 line 813's in-line mention "add this field to `task-template.md` if absent — minor template extension" was similarly unassigned. Risk: any of these could slip through the α/β/γ partition, leaving a concrete implementation gap that surfaces only when a child task's author asks "who owns this?".
  J. **Changelog shape undecided.** O-20 (lines 990-992 pre-iteration-9) floated a `changelog/<ISO-timestamp>.md` directory alternative citing git merge conflicts and deferred the decision to "v1 implementation". The rest of the design consistently uses `changelog.md` as a single file across §2, §3, §7.5 R0.3p, §7.5 R0.5p, §7 step 5, §11, and §12. A late flip to the directory shape would require coordinated edits across six sections and would break §7.5 R0.3p's "last 10 entries" read directly. Locking single-file now avoids the implementer-surprise path.
- **Changes landed this iteration:**
  1. **Finding I — §1 "Update existing files" bullets rewritten with explicit ownership.** `skills/do/do.md` → Task β (β owns `skills/do/project.md`; adding the router entry belongs in the same task). `skills/do/init.md` → Task α (α owns project-folder health rules). `skills/do/references/init-health-check.md` → Task α (α owns health-check output format extensions). `skills/do/references/config-template.json` → Task α (α already listed `config-template.json` in its scope — now called out explicitly in the update list). `skills/do/references/task-template.md` → Task α (added as a fifth bullet; α owns template files). Each bullet in §1 now carries a `**Owned by Task X**` tag + one-sentence rationale.
  2. **Finding I — Task α scope (§14) extended.** New bullets added: (a) "Minor template extension: add `related: []` field to `skills/do/references/task-template.md`" with explicit "No other edits to the template"; (b) "Health-check wiring updates" group covering `skills/do/references/init-health-check.md` (extend the `### Project Issues` sub-table with §13's new issue types + severities + fixes; existing Step 1-5 flow unchanged — `project-health.cjs`'s JSON return shape is unchanged, so the display logic is unaffected) and `skills/do/init.md` (additive Quick-Reference / Files note, with an explicit reality-check that `init.md` is a thin router and leaving it untouched is acceptable if no natural insertion point exists — the `init-health-check.md` edit is the load-bearing change). Config-template bullet reworded from "Config-template updates" to "Config-template updates in `skills/do/references/config-template.json`" for path clarity.
  3. **Finding I — Task β scope (§14) extended.** New bullet added under β: "`skills/do/do.md` — router update: add `/do:project` row to sub-commands table + one routing example". Annotated with a reality-check citing the current file's table lines (20-32) and routing-examples list (38-62) to confirm both edit sites exist, plus a rationale for β ownership.
  4. **Finding J — O-20 rewritten.** Title changed from "Changelog conflict in git" to "Changelog conflict in git *(LOCKED — single file `changelog.md`)*". Body replaced: the "Decision deferred to v1 implementation" line removed; replaced by a `**Resolution (locked):**` paragraph with three enumerated rationale points — (1) cross-section consistency across §2 / §3 / §7.5 R0.3p / §7.5 R0.5p / §7 step 5 / §11 / §12, (2) narrow conflict risk scope given §3's single-active invariants, (3) `project_schema_version` bump handles a v2 migration to the directory form if needed. Rejected alternative (timestamped-filename directory) noted explicitly.
  5. **Finding J — no cross-section edits required.** Verified §2 folder shape (line 178), §3 transition logging (lines 341-344), §7.5 R0.3p (last 10 entries read), §7.5 R0.5p (last-action source), §7 step 5 (β's append), §11 (backlog `done` trigger ordering), and §12 (changelog pointer) all already use `changelog.md` (single file) consistently. No downstream edits needed — O-20's rewrite reconciles the design's existing usage with an explicit lock.
- **What was intentionally NOT changed:** §2 folder shape (already single-file), §3 transition logging (already single-file), §6 wave execution flow, §7 cold-start handoff content contract, §7.5 R0.1p–R0.6p spec (already references single `changelog.md`), §8 agent coverage map, §9 full-split architecture, §10 isolation model, §11 backlog integration (trigger ordering already assumes single-file append), §12 completion flow, §13 health-check table body (α's extension lands in `init-health-check.md`'s reference, not in §13's design-level spec), iteration 1-8 audit trail verbatim, all other O-N concerns (O-20 is the only one touched). `council_review_ran.plan` remains `false` (owned by the plan-review reference). `stage` remains `refinement` / `in_progress`. No new concerns added.
- **Cross-references touched:**
  - Finding I → §1 "Update existing files" bullets (all four rewritten + fifth added for `task-template.md`) + §14 Task α scope (two new bullet groups — `related` field on task-template + health-check wiring group covering `init-health-check.md` and `init.md`) + §14 Task β scope (new `skills/do/do.md` bullet with reality-check).
  - Finding J → O-20 rewritten (title + body). No cross-section edits (verified consistent).
- **Confidence raised** from 0.95 to 0.96: context -0.01→-0.01 (unchanged — external reads confirmed the plan's claims about the three files; one loose wording on `init.md` was reality-checked and scoped accordingly in α), scope -0.02→-0.01 (all five previously-unassigned file updates now have explicit owners + rationale; no more hand-waving about who ships the router / template / health-check reference edits), complexity -0.01→-0.01 (unchanged — ownership clarification is mechanical; O-20 lock reduces implementer-surprise risk but does not simplify any code path), familiarity -0.01→-0.01 (unchanged — sibling-reference + additive-row patterns are well-precedented). Modest lift of +0.01. The architecture has not changed; two cleanup patches have closed. No new concerns surfaced.

### Iteration 10 (user-waived iteration-budget extension)
- **Mode:** user-waived iteration-budget enforcement. Two cleanup findings (K, L) carried over from post-iteration-9 review. K is a real gap — iteration 8 locked `active_phase: null + status: in_progress + every in-scope phase completed` as a valid terminal-pre-complete state (awaiting explicit `/do:project complete`), but §7's cold-start resume flow step 3 unconditionally read `phases/<active_phase>/phase.md`, leaving the `null` branch undefined. L is a misaligned claim — O-23 asserted `/do:project phase reorder` as first-class, but §1 skill layout and Task β scope only list `phase new|next|complete|abandon`, so the claim was unsupported. No architectural change; gap closure + claim realignment.
- **Findings addressed:**
  K. **Resume undefined for terminal-pre-complete state.** §7 step 3 had no branch for `active_phase: null` after terminal phase completion. Undefined behaviour in a cold-start path is load-bearing — `/do:project resume` is the architectural guarantee per the problem statement, and the terminal-pre-complete state is reachable by design from any final `/do:project phase complete` call per §7 step 5 (β sets `active_phase: null` on terminal phase and leaves `status: in_progress`). Without an explicit branch, a user who runs `/do:project resume` after completing the final phase hits a null-dereference in the `phase.md` read.
  L. **`phase reorder` claim vs. scope.** O-23 (pre-iteration-10) asserted `/do:project phase new` AND `/do:project phase reorder` as first-class operations. §1 skill layout (pre-iteration-10 L122) lists only `phase new|next|complete|abandon`. Task β scope in §14 (pre-iteration-10) covers `new`, `next` (via phase state transition), `complete`, and `abandon` — no `reorder`. The unsupported claim is cleanup-worthy even though no downstream section depends on it, because plan-review readers catch unsupported claims and flag them (this review did).
- **Changes landed this iteration:**
  1. **Finding K — §7 cold-start resume flow step 3 rewritten with three explicit branches.** Branch 1 (non-null `active_phase`): unchanged normal-case behaviour. Branch 2 (terminal-pre-complete gate: `active_phase: null` AND `status: in_progress` AND every in-scope phase `completed`): skip `phase.md` and `wave.md` reads, proceed with project-only scope. Branch 3 (any other `active_phase: null` case): display error pointing at `/do:init` diagnostics and STOP (this is the broken state §13's `activeProjectNoActivePhase` flags).
  2. **Finding K — §7 step 5 augmented with terminal-pre-complete override.** When branch 2 fires, `resume-preamble-project.md` is invoked ONLY on `project.md` (with `<target-file-type>: project`) — no phase.md / wave.md invocation, since neither exists to target.
  3. **Finding K — §7 step 6 augmented with terminal-pre-complete override summary text.** Unified resume summary instead reads: "Project complete pending — all in-scope phases done. Run `/do:project complete` to finalise." No active phase / active wave lines printed.
  4. **Finding K — §7 step 7 augmented with advisory routing rule.** Terminal-pre-complete routing is advisory only — do NOT auto-invoke `stage-project-complete.md`. Rationale (decision explicit, as user instructed): matches §12's user-triggered completion pattern — completion is always explicit, never auto. The user runs `/do:project complete` themselves.
  5. **Finding K — §7.5 R0.5p status table extended.** `project` row at status `in_progress` split into two rows: one for `has active_phase` (existing behaviour — last changelog entry), one for `active_phase: null, every in-scope phase completed` (new — terminal-pre-complete advisory). The new row cross-references §7 step 3 branch 2 so γ's implementer has one authoritative gate definition.
  6. **Finding K — §13 non-issue paragraph cross-referenced.** Added a sentence at the end pointing readers at §7 step 3 branch 2 and §7.5 R0.5p's new table row, and noting that the gate condition is identical across §7, §7.5, §12, and §13 (single check, four call sites).
  7. **Finding L — O-23 rewritten.** Pre-iteration-10 body claimed `phase new` AND `phase reorder` as first-class. Post-iteration-10 body: `phase new` is first-class (cross-references §1 + §14 Task β scope); `phase reorder` is deferred to v2 with an explicit v1 manual workaround (hand-edit `phases[]` order + `## Phase Plan` body; rename phase-folder numeric prefixes; add changelog entry). Three-point rationale enumerated (reorder rarity given §5 dependency analysis upfront; scope-creep risk; foundation bounding). Cross-reference to the v2 deferred bucket in §14.
  8. **Finding L — §14 v2 deferred bucket extended.** New bullet added: "`/do:project phase reorder` subcommand (O-23). v1 workaround: users hand-edit `project.md`'s `phases[]` order + `## Phase Plan` body, manually rename phase-folder numeric prefixes, and add a `changelog.md` entry. v2 adds a first-class op that automates the rename + invariant checks."
  9. **Finding L — no changes to §1 or Task β scope.** Verified: §1 skill layout (L122) already lists only `phase new|next|complete|abandon`; Task β scope (§14 L845-855 region) already covers only these four operations. The claim was localised to O-23 — downgrading it there is sufficient; no other section cross-referenced `phase reorder` as first-class.
- **What was intentionally NOT changed:** §1 skill layout (already correct — no `phase reorder` listed), §2 folder shape, §3 state machine, §4 intake flow, §5 phase decomposition, §6 wave execution flow, §7 content contract for handoff.md body sections (unchanged — K only touches cold-start resume step 3 / 5 / 6 / 7), §7.5 R0.1p–R0.4p / R0.6p spec (unchanged — K only extends R0.5p's status table), §8 agent coverage map, §9 full-split architecture, §10 isolation model, §11 backlog integration, §12 completion flow (K's cross-reference note in §13 only points *at* §12, not *into* it — the already-locked `/do:project complete` user-triggered contract stands), §13 health-check issue-types table body (only the post-table non-issue paragraph gained a cross-reference sentence), §14 Task α/β/γ scope bullets (L only adds to the v2 deferred bucket at the end of §14, not to any α/β/γ scope), iteration 1-9 audit trail verbatim, all other O-N concerns (O-23 is the only one touched). `council_review_ran.plan` remains `false` (owned by the plan-review reference). `stage` remains `refinement` / `in_progress`. No new concerns added.
- **Cross-references touched:**
  - Finding K → §7 cold-start resume flow steps 3, 5, 6, 7 (all four gained explicit terminal-pre-complete branch/override text) + §7.5 R0.5p status table (one new row for the terminal-pre-complete state) + §13 post-table non-issue paragraph (new cross-reference sentence pointing at §7/§7.5).
  - Finding L → O-23 body rewritten + §14 v2 deferred bucket extended with a `phase reorder` entry. No changes to §1 or §14 Task α/β/γ scope.
- **Confidence raised** from 0.96 to 0.96: context -0.01→-0.01 (unchanged — K closed a genuine ambiguity in the cold-start path but the rest of the terminal-pre-complete state was already specified in §7 step 5 / §12 / §13; the null-branch gap was a single missed edge), scope -0.01→-0.01 (unchanged — L downgraded a misaligned claim without expanding or contracting scope; the v2 deferral was already implicit in §1 and §14 Task β scope), complexity -0.01→-0.01 (unchanged — three-branch step 3 is mechanical; terminal-pre-complete override rules are additive, not restructuring), familiarity -0.01→-0.01 (unchanged — gate-based conditional routing is well-precedented in §7 step 5's terminal-phase rendering and §12's completion trigger). Net delta: 0.00 (confidence held at 0.96). The user anticipated 0.96-0.97; the architecture has not changed and both patches are mechanical, so holding at 0.96 is honest — K closes a real gap but the gap was narrow (one step of one flow), and L realigns one claim but does not add certainty elsewhere. No new concerns surfaced.

### Iteration 11 (user-waived iteration-budget extension)
- **Mode:** cosmetic consistency patches (M, N, O). No architectural change, no scope change. Three findings from the iteration-10 council are all typo-class or enumeration-completeness — applied as surgical edits per the reviewer's explicit instruction.
- **Findings addressed:**
  M. **Task α scope: project-health.cjs config validation incomplete.** Task α's scope bullet for `project-health.cjs` mentioned extending the script but did not enumerate the exact new config keys + types the validator must cover. Risk: implementer could ship the script without validating the new keys and no reviewer check would catch it.
  N. **Council-review config key inconsistency (O-8).** §1/§8/§9 consistently use the nested form `council_reviews.project.{plan,phase_plan,wave_plan,code}`, but O-8's Resolution paragraph still carried the old flat form `council_reviews.project_plan`. Stale from a pre-nesting draft.
  O. **O-7 referenced undefined stage file.** O-7's mitigation said the wave-size rule "lives in `stage-phase-plan.md`" — no such file exists in the design. The only phase-plan stage reference defined (see §1 L135, §14 Task β L853) is `stage-phase-plan-review.md`. Typo.
- **Changes landed this iteration:**
  1. **Finding M — §14 Task α scope extended.** The `project-health.cjs` bullet gained a sub-bullet list enumerating the three new config-schema validation additions: `active_project` (string or null; mirrors the existing `active_task` type check at lines 164-170 of the script), `project_intake_threshold` (number in `0..1`; mirrors `auto_grill_threshold` at lines 149-156), and `council_reviews.project` (object with boolean sub-keys `plan`, `phase_plan`, `wave_plan`, `code`; runs in the same `else` branch as the existing `council_reviews` parent validation at lines 114-147). Severity mapping explicit: missing → warning, type-wrong → error, out-of-range numeric → warning. Pattern explicitly mirrors the existing `council_reviews.{planning,execution,reviewer}` + `auto_grill_threshold` validation style.
  2. **Finding N — O-8 Resolution rewritten.** `council_reviews.project_plan` → `council_reviews.project.plan`, with a parenthetical explicitly naming the nested object and sibling keys (`phase_plan`, `wave_plan`, `code`) so readers of O-8 in isolation see the canonical shape without cross-referencing §1/§8/§9. Full-file grep confirmed no other flat-form stragglers (`council_reviews.project_plan`, `council_reviews.project_phase_plan`, `council_reviews.project_wave_plan`, `council_reviews.project_code`) exist post-patch.
  3. **Finding O — O-7 Mitigation corrected.** `stage-phase-plan.md` → `stage-phase-plan-review.md`. Full-file grep confirmed no other occurrences of the bogus `stage-phase-plan.md` filename remain; every surviving reference points at the canonical review-stage file.
- **What was intentionally NOT changed:** all sections untouched by the three patches. §1 skill layout, §2-§13 body, §14 Task β/γ scope, O-1–O-6, O-9–O-31 (other than O-7 and O-8). Iteration 1-10 audit trail preserved verbatim. No new concerns added; no existing concerns re-opened. `stage` remains `refinement` / `in_progress`. `council_review_ran.plan` remains `false` (owned by the plan-review reference). Confidence factors unchanged.
- **Cross-references touched:**
  - Finding M → §14 Task α scope bullet for `project-health.cjs` (new sub-bullet list) + implicit alignment with §13 health-check integration rules (which already cover issue-type emission but not config-schema validation).
  - Finding N → O-8 Resolution paragraph only. §1, §8, §9 were already correct (nested form).
  - Finding O → O-7 Mitigation only. §1 L135 and §14 Task β L853 were already correct.
- **Confidence held** at 0.96: context -0.01→-0.01 (unchanged — M tightens an enumeration but does not add missing context; the existing bullet already named the config fields, it just did not enumerate the validation shape), scope -0.01→-0.01 (unchanged — no added or removed work; M makes an already-implicit validation explicit; N and O are pure typo fixes), complexity -0.01→-0.01 (unchanged — validation additions are mechanical mirror-edits of existing patterns at lines 114-156 of the script), familiarity -0.01→-0.01 (unchanged — the existing script pattern is the reference). Net delta: 0.00. Three surgical patches, zero semantic shift.

### Iteration 12 (user-waived iteration-budget extension)
- **Mode:** architectural-consistency reconciliation (P, Q, R). No new scope, no new research — three findings were each internal inconsistencies between sections that each read plausibly in isolation but contradicted when read against one another. Resolution is to pick one canonical answer per finding and align every section to it. Confidence unchanged at 0.96 (these are reconciliations, not added work).
- **Findings addressed:**
  P. **Pass 3 per-phase confidence re-grill — in v1 or v2?** §4 (L370-374) defined Pass 3 as part of the intake model running before each phase enters planning. §8 coverage map (`do-griller` row) said Pass 3 fires in v1. §14 deferred list contradicted both by pushing "Per-phase confidence re-grill (Pass 3 of §4)" beyond α/β/γ.
  Q. **Archived-resume feature — in v1 or delete?** §12 (step 6 of project abandon path) promised `/do:project resume --archived <slug>`, but no such flag appears in §1's command surface or Task γ's scope. Either the command surface was under-spec'd or the §12 promise was stale.
  R. **Abandon semantics — soft-freeze or cascade-with-preservation?** §3 said abandon was a soft freeze (child nodes retain their statuses, left alone for resume). §12 said `pre_abandon_status` is recorded then all node statuses cascade to `abandoned`. Two different models for the same operation.
- **Decisions and changes landed this iteration:**
  1. **Finding P — Pass 3 ships in v1, owned by β.** Rationale: the plan's philosophy is "heavy upfront information gathering"; Pass 3 is the natural continuation of Passes 1-2 and dropping it weakens the multi-phase intake/resume story §4 and §8 already sell. Added to β's scope is a dedicated bullet enumerating the rule: no re-grill between waves inside a phase; re-grill fires at phase N → phase N+1 boundary (the context-clear handoff described in §7 after next-phase promotion to `planning`); threshold read from `project_intake_threshold` config (α validates this key). Removed the "Per-phase confidence re-grill (Pass 3 of §4)" line from §14's deferred list. §4 and §8 left intact — they were already correct.
  2. **Finding Q — delete `--archived <slug>` from v1; use manual folder move.** Rationale: archived projects are terminal by design. A dedicated flag means γ has to handle divergent frontmatter states (e.g., `status: abandoned` on every node — what does "resume" mean to the router?), which is scope creep on γ that was never budgeted. The rare "I want to resume an archived project" escape hatch is cheap manually: move `.do/projects/archived/<slug>/` back to `.do/projects/<slug>/` and run `/do:project resume`. The cascade-with-preservation model from finding R makes this manual resume lossless — on resume each node's `status` is restored from `pre_abandon_status` and the field is cleared. Rewrote §12's step 6 to document the manual procedure and explicitly state no `--archived` flag exists. Confirmed §1's command surface (L117-125) never listed the flag (already correct). Task γ's scope is unchanged — its `/do:project resume` already handled only the normal case.
  3. **Finding R — cascade-with-preservation wins; §3 rewritten to match §12.** Rationale: cascading `status: abandoned` to every descendant node makes the abandon state unambiguous to any reader of any single node's frontmatter — you do not have to trace up to `project.md` to infer the project is abandoned. `pre_abandon_status` preserves full resume-ability, so the cascade is lossless. The soft-freeze language in §3 was the outlier and the source of the implementation ambiguity. Rewrote §3's abandon bullet to spell out the record-and-set cascade (project → every in-scope phase → every in-scope wave) and the resume restoration (copy `pre_abandon_status` back to `status`, null out `pre_abandon_status`). Cross-references the manual folder move from §12 / finding Q. Verified `pre_abandon_status` is already present in all three frontmatter schemas in §2 (project.md L204, phase.md L235, wave.md L267) — no schema edits needed. Full-file grep for "soft freeze", "soft-freeze", "left alone", "child nodes do not auto-abandon", "without losing wave-level" returned zero post-patch hits in §7, §10, §13, or elsewhere.
  4. **Collateral typo fix.** §1 L125 (subcommand dispatch) used `pre_abandon_stage` (the task-pipeline field name from `skills/do/abandon.md`) instead of the project-pipeline's `pre_abandon_status` (the name used in §2 schemas, §3 cascade rules, and §12). Renamed to `pre_abandon_status` with a `(see §3 cascade semantics)` pointer. The `skills/do/abandon.md` reference at L84 is left untouched — that line correctly names the existing task-pipeline file.
- **What was intentionally NOT changed:** §4 Pass-3 definition, §8 `do-griller` coverage-map row, §2 frontmatter schemas (all three already carry `pre_abandon_status`), §12 steps 1-5 of the abandon path (only step 6's flag promise changed), §14 Task α and γ scopes. §7 / §10 / §13 required zero edits after the §3 rewrite — grep confirmed no stale soft-freeze language remained. All prior Iteration 1-11 audit trail preserved verbatim. `stage` remains `refinement` / `in_progress`. `council_review_ran.plan` remains `false` (owned by the plan-review reference).
- **Cross-references touched:**
  - Finding P → §14 deferred list (one line removed) + §14 Task β scope (one bullet added). §4 and §8 unchanged.
  - Finding Q → §12 abandon-path step 6 only. §1 command surface and §14 Task γ scope unchanged (already correct by omission).
  - Finding R → §3 abandon bullet rewritten + §1 L125 typo (`pre_abandon_stage` → `pre_abandon_status`). §2 / §7 / §10 / §12 / §13 unchanged.
- **Confidence held** at 0.96: context -0.01→-0.01 (unchanged — P/Q/R close genuine internal inconsistencies but the information to resolve them was already present in other sections; nothing was missing from the research), scope -0.01→-0.01 (unchanged — Pass 3 moves into β's v1 scope but the work was already scoped at the phase-boundary level; `--archived` flag removal is a subtraction that makes γ's scope cleaner; the abandon cascade replaces a vaguer soft-freeze rule with a more precise one but does not expand or contract implementation work), complexity -0.01→-0.01 (unchanged — all three resolutions are mechanical: one list edit + one scope bullet for P, one prose rewrite for Q, one prose rewrite + one typo fix for R), familiarity -0.01→-0.01 (unchanged — the cascade-with-preservation pattern mirrors the existing task-pipeline `pre_abandon_stage` approach referenced in §1 L84; the Pass-3 hook reuses the phase-boundary context-clear described in §7). Net delta: 0.00. Three consistency resolutions, zero semantic shift in the design's architecture.

### Iteration 13 (user-waived iteration-budget extension)
- **Mode:** precision patches (S, T, U). No architectural change, no scope change. Three findings from the iteration-12 council are each narrow spec gaps — applied as surgical edits per the reviewer's explicit instruction. Confidence held at 0.96.
- **Findings addressed:**
  S. **AC #3 references a dedicated state-machine reference file, but the plan only shipped the script.** Acceptance criterion #3 (L65) says the state machine must be "specified in a dedicated reference file and implemented in a script", but §1's artefact list only named `project-state.cjs` + the per-file templates — no state-machine reference doc. AC #3 was self-inconsistent with the plan. Decision rule: add the reference file. A dedicated `project-state-machine.md` is cheap to write (it documents the diagram, transitions, and invariants — content α's implementer needs anyway) and makes AC #3 self-satisfying. Relaxing AC #3 was rejected because it would weaken the project contract.
  T. **Abandon cascade scope inconsistent between §3 and §12.** §3 (L331) narrowed the cascade to "every in-scope descendant". §12 (abandon path step 3, pre-iteration-13 wording "Each node's `pre_abandon_status` recorded... Statuses set to `abandoned`") read as "every node, regardless of scope". Real implementation seam — `project-state.cjs`'s abandon routine has to pick one. Decision rule: in-scope only. Rationale: the whole point of the `scope: in_scope | out_of_scope` field is that out-of-scope nodes are parked — they were never actively part of the project's workstream. Cascading abandon to them creates an ambiguous state where a node carries both `scope: out_of_scope` AND `status: abandoned`, overloading the scope field's semantics. In-scope-only cascade is cleaner and matches §3.
  U. **§7.5 `<slug>` placeholder ambiguous for phase/wave targets.** R0.1p (L506) correctly names the three slug fields (`project_slug`, `phase_slug`, `wave_slug`), but R0.3p (L534, changelog path) and R0.4p (L564, resume-skip log line) used bare `<slug>` — ambiguous which field applies per target type. An implementer following R0.3p / R0.4p for a phase or wave target would not know which slug to substitute. Decision rule: qualify every `<slug>` with its explicit field name per target type.
- **Changes landed this iteration:**
  1. **Finding S — §1 artefact list extended.** New entry `skills/do/references/project-state-machine.md` added as a new "State-machine reference" group under §1's delegated-references area, above the delegated-scripts group. Explicitly tagged as **Owned by Task α**. The `project-state.cjs` bullet now carries a sentence "Implements the state machine specified in `project-state-machine.md` — no divergence permitted."
  2. **Finding S — Task α scope (§14) extended.** Added a dedicated bullet enumerating what the reference file must contain: (a) status enum + project-only `intake` leading status; (b) `scope: in_scope | out_of_scope` field semantics + defaults; (c) full state diagram as status × scope matrix per node type; (d) legal status and scope transitions; (e) completion rules; (f) **abandon cascade rule with explicit in-scope-only semantics** (cross-ref finding T); (g) resume-from-abandoned restore rule (in-scope restore, out-of-scope untouched); (h) terminal-pre-complete state definition. Explicit statement that `project-state.cjs` implements what the doc specifies — any divergence is a script bug, not a doc bug.
  3. **Finding S — AC #3 text unchanged.** AC #3 already correctly describes the contract; the plan now matches it.
  4. **Finding T — §12 project abandon path step 3 rewritten** to explicitly match §3's in-scope-only cascade. New wording: `project.md` status set to `abandoned` with `pre_abandon_status` recorded; each **in-scope** descendant phase and wave gets `pre_abandon_status` recorded then `status` set to `abandoned`; **out-of-scope descendants are untouched** (both `status` and `scope` preserved). Rationale sentence inline: cascading out-of-scope nodes would overload the `scope` field's semantics.
  5. **Finding T — §12 project abandon path step 6 extended.** Manual resume-from-archived rule rewritten to match the in-scope-only cascade: in-scope nodes restore `status` from `pre_abandon_status` (then null the field); out-of-scope nodes are left alone (they were untouched by step 3, so there is nothing to restore — their `scope: out_of_scope` and original `status` remain intact).
  6. **Finding T — `project-state-machine.md` reference (from S) carries this rule.** Added to the Task α scope bullet for the new doc: "abandon cascade rule with explicit in-scope-only semantics" + "resume-from-abandoned restore rule: in-scope nodes restore; out-of-scope nodes remain out-of-scope with original `status` intact (no field to restore because cascade never touched them)." Single authoritative source across §3, §12, and the new reference file.
  7. **Finding T — grep confirmation.** Searched the file for `cascade`, `cascades`, `each node`, `in-scope descendant`. §3 already used "in-scope descendant" correctly. §12 was the only site with the conflicting "each node" language. No other cascade-language sites surfaced.
  8. **Finding U — §7.5 R0.3p changelog path qualified.** `changelog.md` path rewritten from `.do/projects/<slug>/changelog.md` to `.do/projects/<project_slug>/changelog.md` with an explicit sentence: "The `<project_slug>` here is always the project-level slug from `project.md` frontmatter, regardless of `<target-file-type>` — there is one changelog per project at the project root, not per phase or per wave."
  9. **Finding U — §7.5 R0.4p resume-skip log label qualified.** Previous single-line log-entry example using bare `<slug>` replaced with a three-variant bulleted list keyed on `<target-file-type>`: `project` target uses `project:<project_slug>`, `phase` target uses `phase:<project_slug>/<phase_slug>`, `wave` target uses `wave:<project_slug>/<phase_slug>/<wave_slug>`. Changelog path in the same bullet corrected to `<project_slug>` per R0.3p's convention.
  10. **Finding U — §7.5 R0.5p status table row corrected.** The `phase` × `in_progress` row's "Last action source" read `phase:<phase_slug>` (bare). Qualified to `phase:<project_slug>/<phase_slug>` with a parenthetical "(qualified per R0.4p log-label convention)" so the single log-label convention is consistent across R0.4p and R0.5p. No other R0.5p rows needed qualification (project-scope rows reference the full changelog; wave-scope rows reference the wave.md Execution Log, not changelog labels).
- **What was intentionally NOT changed:** §1 top-level skill file definition, §2 frontmatter schemas (all three already carry the slug fields R0.1p enumerates), §3 state-machine body (already correct for finding T — §12 was the drifting site; new `project-state-machine.md` consolidates §3's rules into a dedicated doc but the §3 body stays as the in-plan summary), §4 intake flow, §5 phase decomposition, §6 wave execution flow, §7 cold-start resume flow, §7.5 R0.1p / R0.2p / R0.6p (only R0.3p / R0.4p / R0.5p needed the qualification), §8 agent coverage map, §9 full-split architecture, §10 isolation model, §11 backlog integration, §12 steps 1, 2, 4, 5 of project abandon (only steps 3 and 6 rewrote for finding T), §13 health-check table, §14 Task β and γ scopes (only Task α gained the new reference-file bullet for finding S). Iteration 1-12 audit trail preserved verbatim. All O-N concerns untouched. `council_review_ran.plan` remains `false` (owned by the plan-review reference). `stage` remains `refinement` / `in_progress`. No new concerns added.
- **Cross-references touched:**
  - Finding S → §1 delegated-references (new `project-state-machine.md` bullet + existing `project-state.cjs` bullet amended) + §14 Task α scope (new reference-file bullet with full content enumeration). AC #3 text unchanged.
  - Finding T → §12 abandon path steps 3 and 6 rewritten + §14 Task α scope bullet for `project-state-machine.md` carries the in-scope-only cascade rule. §3 unchanged (already correct).
  - Finding U → §7.5 R0.3p (changelog path qualified) + R0.4p (log-label variants for project / phase / wave targets) + R0.5p (one table row corrected for consistency with R0.4p). R0.1p already correct (named the three slug fields).
- **Confidence held** at 0.96: context -0.01→-0.01 (unchanged — S closes a genuine AC-vs-plan inconsistency but the state-machine semantics themselves were already fully specified in §3; the reference file is a consolidation, not new specification), scope -0.01→-0.01 (unchanged — new `project-state-machine.md` adds one reference file to Task α but the content is content α's implementer needed anyway; T's cascade rule was already in §3 and now consistent in §12; U is pure placeholder qualification), complexity -0.01→-0.01 (unchanged — all three resolutions are mechanical: one new doc for S, one prose rewrite for T, three qualified references for U), familiarity -0.01→-0.01 (unchanged — dedicated-reference + in-scope-only cascade + qualified-placeholder patterns are all well-precedented in the existing plan). Net delta: 0.00. Three precision patches, zero semantic shift.

### Iteration 14 (user-waived iteration-budget extension)
- **Mode:** precision patches (V, W). No architectural change, no scope change. Two findings from the iteration-13 council are narrow spec gaps — applied as surgical edits per the reviewer's explicit instruction. Confidence held at 0.96.
- **Findings addressed:**
  V. **Completion template missing from §1 and Task α scope.** §12 (L773-779, post-iteration-13) specifies the completion flow as template-driven: "renders a **template-filled** `completion-summary.md` at the project root with sections `## Completed Phases` / `## Deferred (Out-of-Scope)` / `## Success Criteria Status` / `## Final File Set` / `## Residual Open Decisions`." O-28 (LOCKED, L1047) explicitly frames the v1b scope as "one new reference file, one sub-command, one template". But §1's template inventory and Task α's template bullet enumerated six templates (`project-master-template.md`, `phase-template.md`, `wave-template.md`, `handoff-template.md`, `changelog-template.md`, `intake-transcript-template.md`) with no completion template among them. Decision rule: add the template. This is the simplest way to honour both §12 and O-28 and keeps completion output consistent across projects. The alternative — rendering the completion summary inline from `stage-project-complete.md` without a template file — directly contradicts O-28's "one template" count and would diverge from the handoff / intake / changelog pattern that every other rendered artefact in the plan follows.
  W. **Config schema drift — singular `active_project` vs. plural `active_projects: []`.** §1 schema update (L155), §2 cascade semantics, §10 isolation model, §13 health-check table, Task α scope (§14) all use the singular `active_project: <slug> | null` field. But O-1 (L929-932, the pre-iteration-14 wording) said "v1 adds `active_projects: []` array to config as a *forward-compatible schema*" — directly contradicting the plan body, which shipped the singular field everywhere. An implementer reading the plan would see §1 and α's scope specifying one field and O-1 specifying another. Decision rule: lock in singular `active_project` for v1; defer `active_projects[]` to v2 behind a schema-version bump. Rationale: v1 explicitly enforces single-active-project (O-11, O-12 mirror the same single-active constraint for phases and waves), and `project_schema_version: 1` already exists as the non-destructive evolution lever — v2 can migrate singular→plural without breaking v1. Shipping a plural array today without any code that reads past index 0 would be dead schema and would drift out of sync with the enforcement layer. "Ship what you enforce; evolve via the version field" is the right posture here.
- **Changes landed this iteration:**
  1. **Finding V — §1 delegated-references extended.** Added `skills/do/references/completion-summary-template.md` bullet directly below `intake-transcript-template.md`. Bullet enumerates the five body sections per §12 (`## Completed Phases`, `## Deferred (Out-of-Scope)`, `## Success Criteria Status`, `## Final File Set`, `## Residual Open Decisions`) and marks **Owned by Task α** with a cross-reference that β owns the rendering flow in `stage-project-complete.md` (per §14 Task β).
  2. **Finding V — §14 Task α templates bullet extended.** Appended `completion-summary-template.md` to the existing comma-separated list of templates under α's "Templates under `skills/do/references/`" bullet, with an inline parenthetical "(consumed by β's `stage-project-complete.md` per §12; α ships the template, β ships the rendering flow)" to lock the α-owns-template / β-owns-rendering split.
  3. **Finding V — §14 Task β completion bullet extended.** Added a clarifier at the start of β's "Completion/archival" bullet noting that `stage-project-complete.md` renders `completion-summary.md` from α's new `completion-summary-template.md`, making the template-dependency explicit in β's scope.
  4. **Finding V — γ scope not changed.** γ owns `stage-phase-exit.md` and `handoff.md` rendering; γ does NOT own `stage-project-complete.md` (β owns it per §14). The original iteration-14 finding V draft referenced γ in error; corrected during implementation — the template is consumed by β's completion flow, which in turn depends on γ's phase-handoff artefacts (cross-ref §14 Task β note and Task γ hard-prerequisite relationship). No γ scope edit needed.
  5. **Finding W — O-1 rewritten.** Mitigation rewritten to lock in singular `active_project: <slug> | null` for v1, explicitly marked as the locked schema matching §1 / §2 / §10 / §12 / §13 / §14. Explicit "Do NOT add `active_projects: []` now" instruction added to preempt the iteration-1-era mitigation re-entering the plan. Rationale paragraph added: mirrors single-active-task / single-active-phase (O-11) / single-active-wave (O-12); `project_schema_version: 1` field on every project/phase/wave file provides the non-destructive evolution lever. Grilling question preserved but annotated with the v2 migration target so the answer has a landing path.
  6. **Finding W — grep confirmation.** Searched the file for `active_projects` post-edit. Two hits remain, both inside O-1's rewritten body (the prohibition "Do NOT add `active_projects: []`" and the v2 migration target reference). Both are intentional and scoped to the single concern. No stray plural references elsewhere in §1 / §2 / §10 / §12 / §13 / §14 — those sites all use the singular `active_project`.
  7. **Finding W — Task α scope unchanged.** §14 Task α scope already correctly specified `active_project` (singular) as the config-schema-validation addition; no edit needed. The drift was localised to O-1's mitigation text.
- **What was intentionally NOT changed:** §1 top-level skill-file surface (the router update row), §2 frontmatter schemas, §3 state-machine body, §4 intake flow, §5 phase decomposition, §6 wave execution flow, §7 cold-start resume flow, §7.5 resume-preamble spec (already iteration-13-qualified), §8 agent coverage map, §9 full-split architecture, §10 isolation model, §11 backlog integration, §12 project-complete and project-abandon step bodies (only the cross-reference from §12's template language into §1 was the drift site, which V closes by adding the template; §12 prose itself already said "template-filled" so no rewrite required), §13 health-check table, §14 Task γ scope (only α and β gained a completion-template reference for finding V), Iteration 1-13 audit trail (preserved verbatim). All O-N concerns other than O-1 untouched. `council_review_ran.plan` remains `false` (owned by the plan-review reference). `stage` remains `refinement` / `in_progress`. No new concerns added.
- **Cross-references touched:**
  - Finding V → §1 delegated-references (new `completion-summary-template.md` bullet) + §14 Task α templates bullet (list extension) + §14 Task β completion bullet (template-dependency clarifier). §12 prose unchanged — it already specified the template contract.
  - Finding W → O-1 mitigation rewritten. §1 / §2 / §10 / §12 / §13 / §14 already singular — no edits. Task α config-schema-validation scope already correct — no edit.
- **Confidence held** at 0.96: context -0.01→-0.01 (unchanged — V closes an inventory omission but §12's template contract was already fully specified; W reconciles an O-1 drift but §1 and α's scope were already correct), scope -0.01→-0.01 (unchanged — V adds one template file to α's existing template set; W removes a dead-schema entry from O-1 without adding anything), complexity -0.01→-0.01 (unchanged — V is a bullet addition; W is a mitigation rewrite; both mechanical), familiarity -0.01→-0.01 (unchanged — α-owns-template / β-owns-renderer pattern is the same split that applies to handoff, changelog, intake transcript; singular-then-migrate pattern matches O-11 / O-12 / active_task). Net delta: 0.00. Two precision patches, zero semantic shift.

### Iteration 15 (user-waived iteration-budget extension)
- **Mode:** reviewer-flagged integration gaps, surgical resolution only. Two gaps (X and Y) closed; no architectural change; confidence holds at 0.96.
- **Findings addressed:**
  - **Gap X — script sync path undocumented.** `init-health-check.md:38` invokes `~/.claude/commands/do/scripts/project-health.cjs` (home-directory copy), while Task α modifies the repo copy at `skills/do/scripts/project-health.cjs`. Decision: repo is source of truth; packaging is handled by the existing do-lang install pipeline. No new work scoped. Fix: added a "Script location and packaging note" bullet to §14 Task α scope documenting the convention and referencing Gap X.
  - **Gap Y — restore writer unassigned.** §3 and §12 specified the resume-from-archived restore (status ← pre_abandon_status; null pre_abandon_status) but no writer owned it. Only `project-resume.cjs` was named, and it is read-only. Decision: assign write to `project-state.cjs` as explicit op `restore-from-abandoned <project_slug>` (per iteration-13 decision S that `project-state.cjs` owns all status transitions). Three edits: (1) §3 — added "Writer assignment" sentence naming `project-state.cjs` as owner of both cascade and restore, describing the op semantics; (2) §12 step 6 — expanded the resume-from-archived description to document the detect-abandoned → call restore-from-abandoned → proceed-to-routing sequence, including the skip condition when status is already non-abandoned; (3) §14 Task α `project-state.cjs` bullet — extended to include the `restore-from-abandoned` op spec and its round-trip unit test.
- **What was intentionally NOT changed:** §1 script listing (project-state.cjs already listed), §2 frontmatter schemas (pre_abandon_status already present on all three), §4, §5, §6, §7, §7.5, §8, §9, §10, §11, §12 project-complete path, §13 health-check table, §14 Task β and γ scopes. Iteration 1-14 audit trail preserved verbatim. All O-N concerns untouched. `council_review_ran.plan` remains `false` (owned by the plan-review reference). `stage` remains `refinement` / `in_progress`. No new concerns added.
- **Cross-references touched:** Gap X → §14 Task α (new packaging bullet). Gap Y → §3 (writer-assignment sentence) + §12 step 6 (restore-sequence prose) + §14 Task α `project-state.cjs` bullet (op spec + unit-test requirement).
- **Confidence held** at 0.96: Gap X is documentation-only (no scope change); Gap Y assigns a write to an already-scoped script (project-state.cjs) for an already-specified semantic (restore-from-abandoned) — the gap was ownership ambiguity, not missing functionality. Net delta: 0.00.

### Iteration 16 (user-waived iteration-budget extension)
- **Mode:** surface completeness patches (Z, AA). No architectural change. Two command-surface gaps identified by reviewer — both closed as surgical additions to §14 Task β and Task α scopes respectively. Confidence held at 0.96.
- **Findings addressed:**
  Z. **Undocumented v1 subcommands in Task β scope.** §1 (L121-123) advertises the full command surface: `/do:project status`, `/do:project phase new|next|complete|abandon`, `/do:project wave new|next|complete|abandon`. Task β scope only had explicit contracts for `phase complete` (the heavy state-transition bullet) and the wave execution pipeline. The five remaining subcommands (`status`, `phase new`, `phase abandon`, `wave new`, `wave complete`, `wave abandon`) were implied but unspecified — a real gap for β's implementer who would have to invent their semantics, particularly the `project-state.cjs` / `project-scaffold.cjs` call shapes and the backlog-flag wiring. Decision rule: add a compact "Sub-command contracts" bullet block to Task β scope, one sub-bullet per subcommand, each under 25 words of core contract. Small surface, tight spec, no inference required.
  AA. **`project-scaffold.cjs` creation semantics undocumented.** §6 L419 showed wave-next invoking `project-scaffold.cjs` but no contract existed for: op signatures, prefix allocation, parent-index update in project.md/phase.md, default frontmatter fields, changelog entry format, atomicity/rollback rule. Task α's scaffold bullet said "folder tree creation + template slot-filling" with no further detail. Decision rule: document scaffold's contract inline in Task α's `project-scaffold.cjs` scope bullet. Content is fully derivable from §2 (schemas), §3 (changelog), O-20 (single `changelog.md`), and O-19 (atomic moves) — this closes an implementer gap, not a design gap.
- **Changes landed this iteration:**
  1. **Finding AA — §14 Task α `project-scaffold.cjs` bullet expanded.** Added a sub-bullet list with six explicit behaviours: op signatures (`project`, `phase`, `wave`); prefix allocation rule (NN-prefix from max-existing+1, zero-padded to 2 digits); parent-index update (atomic append to `phases: []` / `waves: []` with `updated` timestamp bump); default frontmatter fields (`status: pending`, `scope: in_scope`, `pre_abandon_status: null`, `project_schema_version: 1`, plus all node-type arrays per §2); changelog entry format (`<ISO-timestamp> scaffold:<op>:<full-path-slug>` per `changelog-template.md`); atomicity rule (temp-file + rename; β caller wraps in try/catch and re-raises on error; script does not swallow errors).
  2. **Finding Z — §14 Task β scope gained a "Sub-command contracts" block** with one sub-bullet per subcommand: `status` (read-only, `project-state.cjs status` call, renders summary table, no writes); `phase new` (scaffold call, `--from-backlog` flag wired per §11); `phase abandon` (in-scope cascade via `project-state.cjs abandon phase`, no folder move); `wave new` (scaffold call, `--from-backlog` flag wired per §11); `wave complete` (`project-state.cjs set wave … completed`, no phase advancement); `wave abandon` (`project-state.cjs abandon wave`, no phase cascade).
- **What was intentionally NOT changed:** §1 command surface (already correct — all six subcommands listed), §2 frontmatter schemas, §3 state machine, §6 wave execution flow, §7 cold-start resume, §7.5 preamble spec, §8 agent coverage map, §9 full-split architecture, §10 isolation model, §11 backlog integration (backlog-flag wiring in the new sub-command contracts cross-references §11; §11 prose unchanged), §12 completion flow, §13 health-check table, §14 Task γ scope, all O-N concerns. Iteration 1-15 audit trail preserved verbatim. `council_review_ran.plan` remains `false` (owned by the plan-review reference). `stage` remains `refinement` / `in_progress`. No new concerns added.
- **Cross-references touched:**
  - Finding AA → §14 Task α `project-scaffold.cjs` bullet (expanded with sub-bullet list). No cross-section edits required — §6 already referenced scaffold, §19/O-20 remain the atomicity/changelog authorities.
  - Finding Z → §14 Task β scope (new "Sub-command contracts" block). §1 command surface and §11 unchanged (already correct).
- **Confidence held** at 0.96: context -0.01→-0.01 (unchanged — AA and Z close implementer-facing gaps but all design information was already present in §1, §2, §3, §6, §11 — the additions are specification consolidation, not new research); scope -0.01→-0.01 (unchanged — the six subcommands were always implied by §1's command surface; AA makes scaffold semantics explicit within already-scoped script work); complexity -0.01→-0.01 (unchanged — thin-wrapper subcommands are mechanical compositions of `project-state.cjs` + `project-scaffold.cjs` ops already fully specified elsewhere); familiarity -0.01→-0.01 (unchanged — the added spec patterns mirror the existing `phase complete` bullet and scaffold patterns already described in §6). Net delta: 0.00.

### Iteration 17 (consistency fixes BB + CC)
- **Mode:** two surgical consistency fixes. No architectural change. Both findings are internal contradictions between the declared status enum and scaffold/subcommand output (BB) and between the §1 command surface and §3/§14 command definitions (CC).
- **Findings addressed:**
  BB. **`status: pending` violates status enum.** §2 schemas (L235, L268) and §3 state machine (L317) define status as `planning | in_progress | blocked | completed | abandoned`. Lines 841, 891, 893 scaffolded new nodes with `status: pending` — an illegal value. Decision rule: `planning` is the correct initial status (matches enum; matches `phase complete` behavior that promotes the next phase to `planning`). Replaced `status: pending` with `status: planning` at all three locations.
  CC. **`phase next` undefined in v1.** §1 command surface (L122) advertised `phase new|next|complete|abandon`, and the changelog example (L347) showed `/do:project phase next` as a transition reason. But §14 Task β defines no `phase next` handler — advancement is handled implicitly by `phase complete` (promotes next phase to `planning`). Decision rule: remove `phase next` from v1. Rationale: `phase complete` already handles advancement; a separate `phase next` would be a redundant alias for the same transition. `wave next` is unaffected — waves do not auto-advance. Updated §1 command surface to `phase new|complete|abandon` (L122); updated changelog example to use `/do:project phase complete` (L347); added rationale note inline at L122.
- **Changes landed this iteration:**
  1. **Finding BB — §1 command surface (L122):** `phase new|next|complete|abandon` → `phase new|complete|abandon`; added inline note that advancement is handled by `phase complete`, no separate `phase next` exists.
  2. **Finding BB — §3 changelog example (L347):** `/do:project phase next` → `/do:project phase complete`.
  3. **Finding BB — §14 Task α `project-scaffold.cjs` bullet (L841):** `status: pending` → `status: planning`.
  4. **Finding BB — §14 Task β `phase new` sub-command contract (L891):** `Default status `pending`` → `Default status `planning``.
  5. **Finding BB — §14 Task β `wave new` sub-command contract (L893):** `Default status `pending`` → `Default status `planning``.
- **What was intentionally NOT changed:** §2 frontmatter schemas, §3 state machine enum definitions, §6 wave execution flow, §7 cold-start resume, §8 agent coverage map, §9-§13, §14 Task γ scope, all O-N concerns. Iteration 1-16 audit trail preserved verbatim. The Iteration 16 changelog entry (L1376) accurately records what was written at that time and is left as a historical record. `council_review_ran.plan` remains `false`. `stage` remains `refinement` / `in_progress`. `wave next` and `wave abandon` are unaffected.
- **Cross-references touched:** §1 L122 (command surface), §3 L347 (changelog example), §14 Task α L841 (scaffold default frontmatter), §14 Task β L891 (phase new contract), §14 Task β L893 (wave new contract).
- **Confidence raised** to 0.97: BB and CC close internal contradictions that were present since Iteration 16; no new design research required, and all five edits are direct enum-compliance fixes. Net delta: +0.01.

### Iteration 18 (gap-fills DD + EE + FF)
- **Mode:** three surgical gap-fills. No architectural change. Confidence holds at 0.97.
- **Findings addressed:**
  DD. **Isolation claim vs. shared-agent edits.** AC #6 (L68) promised no edits to existing task-pipeline command files, but §14 Task β (L879) edits `agents/do-verifier.md` and `agents/do-executioner.md`, which `/do:task` depends on. Decision rule: reconcile by reframing — shared agents become caller-agnostic (intended for both pipelines). AC #6 rewritten to distinguish task-pipeline command files (untouched) from shared agents (intentionally generalized, existing behavior preserved verbatim). Safeguard bullet added to β agent-edit block requiring `/do:task` smoke test post-edit before β is marked complete.
  EE. **`wave next` β contract missing.** §1 L123 and §6 L419 define `wave next` (select next planning wave, promote to `in_progress`), but β sub-command contracts omitted it. Added full `wave next` contract parallel to other wave subcommands, including the per-wave confidence rescue trigger inline.
  FF. **Per-wave confidence rescue undefined.** §8 cited per-wave confidence rescue but §14 had no threshold/owner/hook. Added: (1) per-wave confidence rescue bullet in §14 Task β scope with full spec; (2) `wave next` contract references it; (3) §6 wave execution flow gains step 3a between "wave.md loaded" and "wave execution begins"; (4) §8 do-griller row cross-references §6 step 3a + §14 bullet.
- **Changes landed this iteration:**
  1. **AC #6:** rewritten to name command files (untouched) vs. shared agents (generalized, behavior-preserving). Isolation claim preserved; scope of "no edit" tightened to command files only.
  2. **§14 Task β agent-spec block:** safeguard bullet added — each shared-agent edit must preserve task-pipeline behavior; verified by `/do:task` smoke test post-edit.
  3. **§14 Task β sub-command contracts (after `wave abandon`):** `wave next` contract added with full spec (state reads, `project-state.cjs` call, `active_wave` write, changelog, per-wave confidence rescue trigger).
  4. **§14 Task β sub-command contracts (new bullet after `wave next`):** per-wave confidence rescue fully specified (threshold, target, griller spawn, override, handoff to `stage-wave-plan-review.md`).
  5. **§6 wave execution flow (step 3a):** new step inserted between steps 3 and 4 — per-wave confidence rescue with cross-reference to §4 threshold and §14 ownership.
  6. **§8 do-griller coverage map row:** updated to cross-reference §6 step 3a + §14 Task β per-wave confidence rescue bullet.
- **What was intentionally NOT changed:** §2 frontmatter schemas, §3 state machine, §4 grill pass definitions (threshold value unchanged), §7 cold-start resume, §9-§13, §14 Task α/γ scope, all O-N concerns. Iteration 1-17 audit trail preserved verbatim. `council_review_ran.plan` remains `false`. `stage` remains `refinement` / `in_progress`.
- **Cross-references touched:** AC #6, §6 step 3a (new), §8 do-griller row, §14 Task β agent-spec safeguard bullet, §14 Task β `wave next` contract, §14 Task β per-wave confidence rescue bullet.
- **Confidence:** holds at 0.97. These are gap-fills, not new design decisions.

### Iteration 19 (gap-fills GG + HH + II)
- **Mode:** three surgical gap-fills. No architectural change. Confidence holds at 0.97.
- **Findings addressed:**
  GG. **`wave next` creation vs. activation contradiction.** §6 step 1 implied `wave next` both scaffolds and activates; β contract (added iter 18) correctly said no scaffold. Resolved: `wave next` is activation-only. Added §6 step 1a for "initial wave seeding" — β calls `project-scaffold.cjs wave` once per wave identified in the approved phase plan (triggered after `stage-phase-plan-review.md` approval), seeding all wave.md files before the user runs `wave next`. This matches the `phase new`/`phase complete` pattern (explicit create vs. state transition). `wave next` gains an explicit error exit when no planning+in_scope wave is found.
  HH. **`project-state.cjs` API surface undeclared.** α scoped `restore-from-abandoned` explicitly but β uses `status`, `set`, `abandon` without α formally declaring them. Added explicit "Public ops" sub-list to the `project-state.cjs` bullet in Task α: `status`, `set`, `abandon`, `restore-from-abandoned` — each with full signature, return shape, and validation contract.
  II. **`--from-backlog` writer unowned.** §11 and §14 described the user-visible contract but left ambiguous whether `project-scaffold.cjs` or β did the backlog read + body write. Resolved: scaffold stays generic (no backlog awareness). β's `phase new` and `wave new` handlers own the post-scaffold mutation when `--from-backlog <id>` is present: read backlog entry, write body section, set frontmatter `backlog_item`, append changelog. §11 updated to name β as the implementation owner. `project-scaffold.cjs` contract unchanged.
- **Changes landed this iteration:**
  1. **§6 wave execution flow step 1:** rewritten to make `wave next` activation-only. No-planning-wave error exit added.
  2. **§6 step 1a (new):** initial wave seeding hook — β calls `project-scaffold.cjs wave` per wave in the approved phase plan, before `wave next` fires.
  3. **§6 step 2:** updated — `wave next` loads existing wave.md (no scaffold call).
  4. **§14 Task β `wave next` contract:** rewritten to match §6 (no scaffold, explicit error exit, references §6 step 1a).
  5. **§14 Task α `project-state.cjs` bullet:** Public ops sub-list added (`status`, `set`, `abandon`, `restore-from-abandoned`) with signatures and validation contract.
  6. **§14 Task β `phase new` contract:** `--from-backlog` now explicitly states β owns the post-scaffold mutation; scaffold stays generic.
  7. **§14 Task β `wave new` contract:** same pattern as `phase new`.
  8. **§11:** `--from-backlog` description updated to name β as implementation owner; clarifies scaffold is not modified.
- **What was intentionally NOT changed:** §2 frontmatter schemas, §3 state machine, §4 grill passes, §7 cold-start resume, §8 agent coverage map, §9-§13 (except §11 clarification), §14 Task α/γ scope (except `project-state.cjs` public ops addition), all O-N concerns. Iteration 1-18 audit trail preserved verbatim. `council_review_ran.plan` remains `false`. `stage` remains `refinement` / `in_progress`.
- **Cross-references touched:** §6 step 1 (rewritten), §6 step 1a (new), §6 step 2 (updated), §11 (--from-backlog wording), §14 Task α `project-state.cjs` Public ops sub-list, §14 Task β `phase new`, `wave new`, `wave next` contracts.
- **Confidence:** holds at 0.97. Three gap-fills; no new architectural decisions.

### Iteration 20 (FINAL — JJ + KK + LL; design-locked)
- **Mode:** final round. User decision: "1 more round and leave the rest up to the individual phases." After this iteration, the orchestrator plan is design-locked; remaining precision nits are delegated to child tasks α/β/γ.
- **Findings addressed:**
  JJ. **Slug format inconsistency.** `project.md`, `phase.md`, `wave.md` schemas mixed unprefixed (`<phase-slug>`, `<wave-slug>`) and prefixed (`01-discovery`) forms. Leaked into routing paths (`phases/<active_phase>`) and `project-state.cjs set ... <path>`. Resolved: full prefixed slugs everywhere. Schema placeholders `<phase-slug>` / `<wave-slug>` replaced with concrete prefixed examples (`01-discovery`, `01-intake`) and explanatory comments. §6 and §12 already used the canonical form. `project-scaffold.cjs` prefix-allocation bullet (iter 16) already documented the `NN-` prefix as canonical — no additional edit needed there.
  KK. **Project-level `scope` inconsistency.** `project-state.cjs status` op return shape included a top-level `project.scope` field, but §2 schemas and §3 state machine explicitly define `scope` only on phase/wave. Resolved: return shape corrected to `{project: {status, active_phase}, phases: [{slug, status, scope, active_wave, waves: [{slug, status, scope}]}]}` with explicit "No `scope` at the project level" note pointing to §2/§3.
  LL. **Top-level `/do:project new` and `abandon` β contracts missing.** Command surface advertised both; §12 and §3 described behavior; but β's sub-command-contracts block only covered `status`, phase ops, and wave ops. Resolved: added explicit `new <slug>` and `abandon` contracts to β alongside the other subcommand contracts. `new` enforces the single-active-project invariant (O-1), scaffolds, writes `active_project`, triggers `stage-project-intake.md`. `abandon` prompts for reason, calls `project-state.cjs abandon project`, moves folder to `archived/`, clears `active_project`.
- **Changes landed this iteration:**
  1. **§2 phase.md / wave.md schemas:** placeholder normalization — `phase_slug: <phase-slug>` → `phase_slug: 01-discovery` (with "full prefixed slug" comment); `wave_slug: <wave-slug>` → `wave_slug: 01-intake`; `parent_phase: <phase-slug>` → `parent_phase: 01-discovery`.
  2. **§14 Task α `project-state.cjs` Public ops — `status` op return shape:** removed `scope` from the project-level object; added explanatory note citing §2/§3 as the authority.
  3. **§14 Task β sub-command contracts:** added `new <slug>` and `abandon` as top-level-project contracts, parallel in style to the other subcommand bullets. Both reference existing α artefacts (scaffold, state-machine, restore-from-abandoned).
  4. **§1 framing note:** design-locked marker updated — "DESIGN-LOCKED as of iteration 20" with explicit delegation of remaining precision work to child tasks α/β/γ.
  5. **Frontmatter:** `design_locked: true` added; `confidence.score` ticked 0.97 → 0.98 (plan is as tight as it's going to get at orchestrator level); `updated` bumped.
- **What was intentionally NOT changed:** §3, §4, §5, §6 (already canonical), §7, §7.5, §8, §9, §10, §11, §13, all O-N concerns, Task γ scope (§14). Iteration 1-19 audit trail preserved verbatim. `council_review_ran.plan` remains `false` — orchestrator-level plan review is considered complete at iteration 19's PASS; this iteration's edits are consistency fixes only.
- **Cross-references touched:** §1 framing, §2 schemas (phase.md + wave.md), §14 Task α `project-state.cjs` Public ops, §14 Task β sub-command contracts (2 new bullets).
- **Confidence:** 0.97 → 0.98. Final. Remaining precision work delegated to child tasks.
- **Design-lock signal:** child tasks α/β/γ can be authored next. The orchestrator contract is frozen. Any further finding surfaces inside the relevant child task's own planning pass — not on this file.

## Execution Log

## Council Review

## Verification Results
