---
id: 260418-do-project-beta-orchestration
created: 2026-04-18T13:53:57.000Z
updated: '2026-04-18T14:01:30.926Z'
description: >-
  Implement Task β (project-orchestration) for /do:project — ship the skill +
  stage references + subcommand routing that sit on top of Task α's contract.
  Scope per orchestrator §14 L873-915: skills/do/project.md (new skill with
  subcommands new/phase/wave/status/complete/abandon and 2 top-level wave
  subcommands new/next/complete/abandon — no resume), skills/do/do.md router
  update (new /do:project row in sub-commands table + one routing example),
  stage-project-intake.md (Passes 1-2 grilling), project-plan flow +
  stage-project-plan-review.md, phase-plan flow + stage-phase-plan-review.md,
  wave-plan flow + stage-wave-plan-review.md, stage-wave-exec.md,
  stage-wave-code-review.md, stage-wave-verify.md (project-aware failure paths),
  per-phase re-grill (Pass 3) and per-wave confidence rescue, phase-complete
  state transition (no handoff artefact — that's γ), stage-project-complete.md
  rendering from α's completion-summary-template.md, agent-spec caller-agnostic
  revisions (do-verifier + do-executioner terminological + new behavioural
  writes; 5 other agents terminological-only), 8 subcommand contracts.
  Explicitly OUT of scope: resume subcommand, stage-project-resume.md,
  stage-phase-exit.md, cold-start UAT (all Task γ). Carries related:
  [260418-do-project-orchestrator, 260418-do-project-alpha-contract].
related:
  - 260418-do-project-orchestrator
  - 260418-do-project-alpha-contract
stage: execution
stages:
  refinement: complete
  grilling: skipped
  execution: in_progress
  verification: pending
  abandoned: false
council_review_ran:
  plan: true
  code: false
confidence:
  score: 0.88
  factors:
    context: -0.02
    scope: -0.05
    complexity: -0.05
    familiarity: -0.0
backlog_item: null
---

# Task β — /do:project project-orchestration

## Problem Statement

### What
Ship Task β (project-orchestration) of the three-way `/do:project` split. α (project-contract) is landed and verified — it shipped frontmatter schemas, folder shape, `project-state-machine.md`, `project-state.cjs`, `project-scaffold.cjs`, `project-health.cjs` extension, templates, and config / init-health-check additions. β now sits on top of α and delivers the user-facing surface: the skill file, the routing update, stage references for every gate, per-phase / per-wave confidence rescue, agent-spec generalisation, and a phase-complete state transition that lets the hot-session flow run end-to-end. γ (resume + handoff artefact + cold-start UAT) remains out of scope and will layer on afterwards.

Verbatim scope from orchestrator §14 L873-915 ("Task β — project-orchestration"):

> *Scope:*
> - `skills/do/project.md` — the skill file with subcommand routing: `new`, `phase`, `wave`, `status`, `complete`, `abandon`. (Resume is carved into Task γ.)
> - `skills/do/do.md` — router update: add a `/do:project` row to the sub-commands table (between `/do:task` and the existing `/do:fast` entry, with a "When to use" that says "Starting a large multi-phase project — new codebase or massive feature") and add one routing example (e.g., "let's start a new app from scratch" → `/do:project new "..."`).
> - `stage-project-intake.md` — intake grilling flow (Passes 1-2 per §4).
> - Project-plan flow + `stage-project-plan-review.md` (PR-0..PR-5 iteration, targets `project.md`).
> - Phase-plan flow + `stage-phase-plan-review.md` (targets `phase.md`).
> - Per-phase confidence re-grill (Pass 3 of §4) — v1 scope. β owns the phase-boundary confidence gate: when β transitions from wave N to wave N+1 within a single phase, no re-grill fires; when β transitions from phase N to phase N+1 ... β invokes `do-griller` against the next phase's `phase.md` with the 4-factor confidence calculation scoped to that phase. Threshold is read from `.do/config.json`'s `project_intake_threshold` (per §4 default 0.85).
> - Wave-plan flow + `stage-wave-plan-review.md` (targets `wave.md`).
> - `stage-wave-exec.md` — spawns `do-executioner` against `wave.md` (§6).
> - `stage-wave-code-review.md` — spawns `do-code-reviewer` + council against wave diff targeting `wave.md`.
> - `stage-wave-verify.md` — spawns `do-verifier` against `wave.md`. Failure paths are project-aware (retry / debug / abandon wave / out_of_scope). **Explicitly NOT "spawn /do:task"** (§6).
> - Phase-complete state transition only (no handoff artefact): `/do:project phase complete` routing lives here. β validates the completion precondition (every in-scope wave `completed`), sets the phase `status: completed` via `project-state.cjs`, clears `active_phase`, appends to `changelog.md`, promotes the next phase to `planning`. β does NOT render `handoff.md` — that is γ's job. Without γ, `/do:project phase complete` succeeds and prints "Phase complete. Handoff artefact pending (Task γ)."
> - Completion/archival: `stage-project-complete.md` (§12) — renders `completion-summary.md` from α's `completion-summary-template.md`. Note: this ships in β but depends on γ's `stage-phase-exit.md` having been run at each phase boundary. If γ is not yet shipped, `/do:project complete` prints "Complete requires phase handoff artefacts (Task γ)." and blocks.
> - Agent-spec revisions (per §8 table) — caller-agnostic clean-up + structured handoff writes:
>   - `agents/do-verifier.md` — (terminological) remove hardcoded `.do/tasks/<active_task>` paths, `/do:task` / `/do:continue` suggestions, and `active_task` clears. (behavioural, new) at end of verification, write `unresolved_concerns[]`, append `discovered_followups[]`, and write `wave_summary` into target-file frontmatter if those arrays/keys exist. No-op for plain task files.
>   - `agents/do-executioner.md` — (terminological) same substitutions; remove `/do:continue` from on-failure message. (behavioural, new) at end of execution, write `modified_files[]` and append `discovered_followups[]` into target-file frontmatter if those arrays exist.
>   - `agents/do-planner.md` — generalise description + "Spawned by" list; substitute "task file" → "target file".
>   - `agents/do-plan-reviewer.md` — terminological only.
>   - `agents/do-code-reviewer.md` — terminological only.
>   - `agents/do-council-reviewer.md` — terminological only.
>   - `agents/do-griller.md` — terminological only.
>   - `agents/do-debugger.md` — no changes needed.
>   **Safeguard:** each shared-agent edit MUST preserve existing task-pipeline behavior verbatim. Verified by running `/do:task` smoke test post-edit.
> - Sub-command contracts for all v1 subcommands (iteration-16 addition): [the 8 subcommand contracts quoted in full in the Approach section below].
> - **Explicitly out of scope:** resume subcommand, `stage-project-resume.md`, `stage-phase-exit.md`, cold-start UAT (all in Task γ).
>
> *Dependencies:* Task α (contract must exist).
>
> *Rationale for isolation:* β is the bulk of the user-facing surface. Carving out resume+handoff into γ keeps the architectural-guarantee code (the cold-start path) under focused review separately.

### Why
- α is landed but inert — with only the contract, a user can hand-scaffold a project folder, but the automation pipeline does not run. β turns the contract into a working command.
- The hot-session flow (new project → intake → project plan → phase plan → wave plan → wave exec → wave code review → wave verify → phase complete → repeat) is the bulk of user-facing surface. γ adds the cold-start (`/do:project resume`) and the `handoff.md` render, but β delivers everything users interact with during a live session.
- Agents have task-pipeline-specific language today (hardcoded `.do/tasks/<active_task>`, `/do:task` / `/do:continue` suggestions, `active_task` clears). β generalises them so the same binaries serve both pipelines — this is the "reuse agents, duplicate stage references" path chosen in orchestrator §9. Doing it in β (rather than α) keeps α's scope tight and groups agent edits with the stage references that consume the new behaviour.

### Acceptance criteria
1. `skills/do/project.md` exists with routing for all 8 subcommands: `new <slug>`, `phase new <slug>` / `phase abandon <slug>` / `phase complete`, `wave new <slug>` / `wave complete <slug>` / `wave abandon <slug>` / `wave next`, `status`, `complete`, `abandon`. `--from-backlog <id>` works on `phase new` and `wave new`. `/do:project resume` is explicitly NOT implemented (γ's work).
2. `skills/do/do.md` has a new `/do:project` row in the sub-commands table (between `/do:task` and `/do:fast`) and one routing example. No removals, no reorderings.
3. Eight new stage reference files exist under `skills/do/references/`: `stage-project-intake.md`, `stage-project-plan-review.md`, `stage-phase-plan-review.md`, `stage-wave-plan-review.md`, `stage-wave-exec.md`, `stage-wave-code-review.md`, `stage-wave-verify.md`, `stage-project-complete.md`. Each follows the existing stage-reference shape (caller contract preamble + numbered steps).
4. Seven agent specs generalised: `do-verifier.md` and `do-executioner.md` receive terminological substitutions AND behavioural-new frontmatter-presence-gated writes (per orchestrator §8 table). `do-planner.md`, `do-plan-reviewer.md`, `do-code-reviewer.md`, `do-council-reviewer.md`, `do-griller.md` receive terminological-only edits. `do-debugger.md` is unchanged.
5. Per-phase re-grill fires at phase N→N+1 transitions when the next phase's confidence is below `project_intake_threshold`. Per-wave confidence rescue fires during `wave next` when the wave's confidence is below threshold. Both consume α's `project_intake_threshold` config key.
6. Backlog integration: `phase new --from-backlog <id>` and `wave new --from-backlog <id>` seed `phase.md` `## Goal` / `wave.md` `## Problem Statement` body sections from the backlog entry and set `backlog_item: <id>` in frontmatter. `/do:project phase complete` and `stage-wave-verify.md`'s success path invoke `/do:backlog done <id>` when `backlog_item != null`.
7. `/do:project complete` renders `completion-summary.md` from α's `completion-summary-template.md` BUT blocks with "Complete requires phase handoff artefacts (Task γ)." if any phase lacks a `handoff.md` (γ's artefact).
8. `/do:project phase complete` runs the state transition and prints "Handoff artefact pending (Task γ)" in place of the render step (γ hasn't shipped yet).
9. `/do:task` smoke test on a known existing task passes post-edit — agent generalisation has not regressed the task pipeline.
10. Structural assertions pass on every new skill / stage-reference file: required sections present, correct preamble shape, no stale `/do:task` / `.do/tasks/` literals.
11. New behavioural tests for `do-executioner` and `do-verifier`: with frontmatter arrays present → writes happen; with arrays absent → no-op.

## Clarifications

## Context Loaded

- `.do/tasks/260418-do-project-orchestrator.md` — the authoritative design file. §14 L873-915 (Task β scope block, 8 subcommand contracts verbatim), §4 (Pass 1-2 intake, Pass 3 per-phase re-grill), §6 (wave execution flow including step 1a phase-planning seeding and step 3a per-wave confidence rescue), §7 step 3 (phase-complete split between β state transition and γ handoff render), §7 step 5-6 (terminal-phase behaviour), §8 (agent-spec revision table — do-verifier + do-executioner get behavioural edit #6), §11 L756-772 (user-visible `--from-backlog` contract + auto-trigger of `/do:backlog done`), §12 (completion flow, γ-gated).
- `.do/tasks/260418-do-project-alpha-contract.md` — α is `stage: complete`. β consumes α's artefacts directly: frontmatter schemas (§2), folder shape, `project-state-machine.md`, `project-state.cjs` public ops (`status` / `set` / `abandon` / `restore-from-abandoned`), `project-scaffold.cjs` ops (`project` / `phase` / `wave` with `NN-` prefix allocation + parent-index update), `completion-summary-template.md`, `handoff-template.md`, `changelog-template.md`, `intake-transcript-template.md`, config keys (`active_project`, `project_intake_threshold`, `council_reviews.project.{plan,phase_plan,wave_plan,code}`), `task-template.md` `related: []` field. α is on the current branch `feat/do-project-alpha-contract` — β builds on α directly (stacked-branch or merge-first; see Concerns).
- `.do/config.json` — current config: `council_reviews.planning: true`, `council_reviews.execution: true`, `reviewer: codex`, `auto_grill_threshold: 0.9`. α added `project_intake_threshold` / `active_project` / `council_reviews.project.*` keys to the config template; the live config may not yet have them — β must tolerate absence and fall back to `auto_grill_threshold` / defaults.
- `skills/do/do.md` — top-level router with existing sub-commands table and routing-examples list. β edit is additive: one table row + one example.
- `skills/do/task.md` — most detailed reference for the full 12-step orchestration pipeline. Primary model for `skills/do/project.md`'s shape.
- `skills/do/references/stage-plan-review.md` — PR-0..PR-5 pattern that β's three plan-review siblings (`stage-project-plan-review.md`, `stage-phase-plan-review.md`, `stage-wave-plan-review.md`) duplicate with different target files.
- `skills/do/references/stage-execute.md` / `stage-verify.md` / `stage-code-review.md` — shape templates for `stage-wave-exec.md` / `stage-wave-verify.md` / `stage-wave-code-review.md`.
- `skills/do/references/stage-grill.md` — shape template for `stage-project-intake.md`'s Passes 1-2 grilling flow and for the per-phase / per-wave rescue invocations.
- `skills/do/references/resume-preamble.md` — task-pipeline sibling; NOT modified in β (γ ships `resume-preamble-project.md` as a separate file, duplication accepted per O-29).
- `agents/do-verifier.md`, `agents/do-executioner.md`, `agents/do-planner.md`, `agents/do-plan-reviewer.md`, `agents/do-code-reviewer.md`, `agents/do-council-reviewer.md`, `agents/do-griller.md`, `agents/do-debugger.md` — seven need edits (two behavioural + terminological, five terminological-only). `do-debugger.md` untouched.
- `skills/do/scripts/project-state.cjs` (α) — called by β's subcommand handlers (`set` / `abandon`, and indirectly via scaffold's changelog append).
- `skills/do/scripts/project-scaffold.cjs` (α) — called by β's `new` / `phase new` / `wave new` handlers. Scaffold is deliberately backlog-unaware; β owns the post-scaffold backlog-seed mutation for `--from-backlog`.
- `skills/do/references/completion-summary-template.md`, `handoff-template.md` (α) — completion-summary rendered by β; handoff rendered by γ.
- `CLAUDE.md` / AGENTS.md — conventional commits, feature-branch discipline (`feat/do-project-beta-orchestration`), `/skill-creator` reminder at end of skill creation.

## Approach

Work in eight numbered groups. Each group maps to a cohesive slice that can land as an atomic commit on `feat/do-project-beta-orchestration`. Groups 1-3 are additive (new files only — cannot regress the task pipeline). Group 4 is the only group that edits shared agent specs — it carries the smoke-test safeguard. Groups 5-8 wire the subcommand routing and the gates on top of Groups 1-4.

### Group 1 — Branch setup + skill skeleton

1. **Branch off α's tip.** Current branch is `feat/do-project-alpha-contract`. Either wait for α to merge to `main` and branch `feat/do-project-beta-orchestration` off `main`, or create `feat/do-project-beta-orchestration` off `feat/do-project-alpha-contract` as a stacked branch. Stacked is acceptable per orchestrator §14 (β depends on α; merge order is α → β → γ).
2. **Create `skills/do/project.md`** — the skill file with subcommand routing. Model shape on `skills/do/task.md` (the richest existing skill). Surface: single entry point that dispatches on argv[0] ∈ `{new, phase, wave, status, complete, abandon}`. `phase` and `wave` are sub-dispatchers (phase → `{new, abandon, complete}`; wave → `{new, complete, abandon, next}`). Include a "Files" section listing every script / reference β invokes. Remind the author of the `/skill-creator` polish pass at the end (per CLAUDE.md convention).
3. **Edit `skills/do/do.md` — router additive update.** Add one row to the sub-commands table between `/do:task` and `/do:fast`: `/do:project` with "When to use: Starting a large multi-phase project — new codebase or massive feature." Add one routing example: e.g. "let's start a new app from scratch" → `/do:project new "..."`. No removals, no reorderings (per §14 L877 reality check). Expected outcome: `/do:do` / skill discovery finds `/do:project`.

### Group 2 — Plan-review stage references (three siblings of stage-plan-review.md)

4. **Create `skills/do/references/stage-project-plan-review.md`.** Duplicate the PR-0..PR-5 iteration structure from `stage-plan-review.md`. Target file = `project.md`. Spawn `do-planner` (project-planner prompt shape) at PR-0, `do-plan-reviewer` at PR-3, gate `do-council-reviewer` behind `council_reviews.project.plan`. Writes `council_review_ran.project_plan: true` on `project.md`. No `/do:task` literals.
5. **Create `skills/do/references/stage-phase-plan-review.md`.** Same PR-0..PR-5 duplication, target = `phase.md`. Phase-planner prompt at PR-0. Council gated by `council_reviews.project.phase_plan`. Writes `council_review_ran.plan: true` on `phase.md`. After user approves the wave list, invokes `project-scaffold.cjs wave` once per wave to seed the folders (per §6 step 1a initial-wave-seeding hook).
6. **Create `skills/do/references/stage-wave-plan-review.md`.** PR-0..PR-5, target = `wave.md`. Wave-planner prompt at PR-0. Council gated by `council_reviews.project.wave_plan`. Writes `council_review_ran.plan: true` on `wave.md`.

### Group 3 — Wave execution stage references

7. **Create `skills/do/references/stage-wave-exec.md`.** Spawn `do-executioner` with prompt: "Execute the plan in `<abs path to wave.md>`. Log progress in its Execution Log section. At the end, write `modified_files[]` and any `discovered_followups[]` into the wave.md frontmatter." Never references `/do:task` or `.do/tasks/`.
8. **Create `skills/do/references/stage-wave-code-review.md`.** Spawn `do-code-reviewer` + council on the wave diff, targeting `wave.md`'s Council Review section. Council gated by `council_reviews.project.code` (falls back to `council_reviews.execution` if project subkey absent).
9. **Create `skills/do/references/stage-wave-verify.md`.** Spawn `do-verifier` with prompt: "Verify `<abs path to wave.md>`. Write `unresolved_concerns[]` for any concern you cannot close. Append `discovered_followups[]` as needed." On success, advance wave `status: completed` via `project-state.cjs set wave`, clear `phase.md` `active_wave`, append changelog. If `wave.md` has `backlog_item != null`, invoke `/do:backlog done <id>` (per §11 L768). On failure, present FOUR options — retry / debug / abandon wave / mark out_of_scope — per §6 step 6. Explicitly NOT `/do:task`.

### Group 4 — Agent-spec generalisation (with `/do:task` smoke-test safeguard)

10. **Edit `agents/do-verifier.md`** — terminological substitutions per §8 table (remove hardcoded `.do/tasks/<active_task>`, `/do:task`, `/do:continue`, `active_task` clears; replace with abstract "target file" + "return control to caller"). **Behavioural (new, edit #6):** at end of verification, if target-file frontmatter has `unresolved_concerns: []` array, write unresolvable concerns using `{title, body, severity}` shape. If it has `discovered_followups: []`, append using `{title, body, promote}` shape. If it has `wave_summary` key, write one-sentence summary. Frontmatter-presence-gated — no-op for plain task files.
11. **Edit `agents/do-executioner.md`** — terminological substitutions (replace "task file" → "target file", remove `/do:continue` from on-failure message). **Behavioural (new, edit #6):** at end of execution, if target-file frontmatter has `modified_files: []` array, write repo-relative list. If it has `discovered_followups: []`, append discoveries. Frontmatter-presence-gated.
12. **Edit the five terminological-only agent specs:** `agents/do-planner.md` (generalise description + "Spawned by" list), `agents/do-plan-reviewer.md`, `agents/do-code-reviewer.md`, `agents/do-council-reviewer.md`, `agents/do-griller.md` — all substitute "task file" → "target file" per §8 table. `agents/do-debugger.md` — unchanged.
13. **Run `/do:task` smoke test.** Pick a known existing task file, run the full pipeline end-to-end (or a representative slice). Verify the task pipeline still works verbatim — no regression from agent edits. This is the §14 safeguard; β is NOT complete until this passes. Also add a new test fixture under `skills/do/scripts/__tests__/` (or similar) that spawns `do-executioner` and `do-verifier` against two fixture target files: one with the new frontmatter arrays present (expect writes), one without (expect no-op).

### Group 5 — Intake flow

14. **Create `skills/do/references/stage-project-intake.md`.** Implements §4 Passes 1-2 grilling. Spawns `do-griller` with the scripted question bank (Pass 1: vision / users / non-goals / success criteria / constraints / risks / integrations / non-functionals — 10 questions; Pass 2: phase seed list + dependencies + MVP marker — 3 questions). Saves raw Q&A to `.do/projects/<slug>/intake/session-<timestamp>.md`. Threshold for exiting intake = `project_intake_threshold` (default 0.85) — on threshold-met, spawns `do-planner` (project-planner prompt) to curate `project.md` body sections from transcripts. Then invokes `stage-project-plan-review.md`.

### Group 6 — Phase-boundary + wave-rescue confidence gates

15. **Per-phase re-grill (Pass 3 hook in β's subcommand logic, not a standalone stage reference).** In `skills/do/project.md`'s `phase complete` handler: after β's state transition promotes the next in-scope phase to `planning`, read the next phase's `phase.md` confidence score. If below `project_intake_threshold`, spawn `do-griller` against the next phase's `phase.md` (wave-scope rescue prompt shape) before firing `stage-phase-plan-review.md`. If at/above threshold, proceed directly. This fires at phase-boundary transitions only — NOT between waves within the same phase.
16. **Per-wave confidence rescue (hook in `wave next` handler).** In `skills/do/project.md`'s `wave next` handler: after loading `wave.md` and writing `active_wave`, check `wave.md` confidence score. If below `project_intake_threshold`, spawn `do-griller` against `wave.md` (wave-level rescue prompt shape) before invoking `stage-wave-plan-review.md`. On threshold-met or explicit user override ("proceed anyway"), proceed. This is the per-wave analogue of Pass 3; §6 step 3a is the authoritative spec.

### Group 7 — 8 subcommand contracts in `skills/do/project.md`

Quoting orchestrator §14 L899-909 verbatim as spec:

17. **`status`** — read-only. Invoke `project-state.cjs status <active_project>`; render summary table (project / phase / wave status, scope, progress counts). No writes.
18. **`phase new <slug>`** — call `project-scaffold.cjs phase <active_project> <slug>`. Default `status: planning`, `scope: in_scope`. Append changelog. Optional `--from-backlog <id>`: after scaffold, β reads backlog entry from `BACKLOG.md`, writes problem/fix into `phase.md` `## Goal`, sets `backlog_item: <id>` in frontmatter, appends changelog entry for the seed. Scaffold stays generic; β owns the post-scaffold mutation.
19. **`phase abandon <slug>`** — call `project-state.cjs abandon phase <active_project> <slug>` (cascades to `abandoned` on phase + every in-scope wave, records `pre_abandon_status` per §3). Append changelog. No folder move.
20. **`phase complete`** — validate precondition (every in-scope wave `completed`). Call `project-state.cjs set phase <active_project> <active_phase> completed`. Clear `active_phase`. Append changelog. Promote next in-scope phase to `planning` and set `active_phase` to its slug (non-terminal); on terminal phase, set `active_phase: null` and leave project `in_progress` (do NOT auto-complete project; user runs `/do:project complete` per §12). If `phase.md` has `backlog_item != null`, invoke `/do:backlog done <id>` (§11 L767). Print "Phase complete. Handoff artefact pending (Task γ)" — no `stage-phase-exit.md` invocation (γ's work).
21. **`wave new <slug>`** — call `project-scaffold.cjs wave <active_project> <active_phase> <slug>`. Default `status: planning`, `scope: in_scope`. Append changelog. Optional `--from-backlog <id>`: same pattern as `phase new` — seed `wave.md` `## Problem Statement`, set `backlog_item: <id>`.
22. **`wave complete <slug>`** — call `project-state.cjs set wave <active_project> <active_phase> <slug> completed`. Append changelog. Does NOT advance `active_phase` (explicit `/do:project phase complete` required).
23. **`wave abandon <slug>`** — call `project-state.cjs abandon wave <active_project> <active_phase> <slug>` (records `pre_abandon_status`). Append changelog. Does NOT cascade to parent phase.
24. **`wave next`** — read `active_project` + `active_phase`. Find first wave in `waves[]` with `status: planning` AND `scope: in_scope`. If none, exit with "No planning waves in current phase; run `/do:project wave new <slug>` to create one." Call `project-state.cjs set wave <...> in_progress`. Update `phase.md` `active_wave: <wave_slug>`. Append changelog. Load existing `wave.md` (no scaffold — wave folder must exist already, created by `wave new` or by `stage-phase-plan-review.md`'s phase-seeding hook per step 5 above). Fire per-wave confidence rescue (step 16 above). Proceed to `stage-wave-plan-review.md` → `stage-wave-exec.md` → `stage-wave-code-review.md` → `stage-wave-verify.md`.
25. **`new <slug>`** (top-level project creation) — read `.do/config.json` → if `active_project` non-null, error with single-active-invariant message. Call `project-scaffold.cjs project <slug>` (creates `.do/projects/<slug>/` with `project.md` default `status: intake`, empty `phases/`, empty `changelog.md`). Write `active_project: <slug>` in `.do/config.json` (atomic temp-file + rename). Append changelog `<ISO> new:project:<slug>`. Invoke `stage-project-intake.md` (Group 5). On intake completion, route to `stage-project-plan-review.md`.
26. **`abandon`** (top-level project abandon) — if `active_project` null, error with "No active project to abandon." Prompt for one-line reason. Call `project-state.cjs abandon project <active_project>` (cascades to `abandoned` on project + every in-scope phase + wave; records `pre_abandon_status`; out-of-scope untouched). Append changelog `<ISO> abandon:project:<slug>: <reason>`. Move `.do/projects/<active_project>/` to `.do/projects/archived/<active_project>/` (atomic rename). Write `active_project: null` in `.do/config.json`. NO autonomous resume — re-activation is manual per §12 step 6 (γ's `/do:project resume` handles the restore).

### Group 8 — Project completion (γ-gated)

27. **Create `skills/do/references/stage-project-complete.md`.** Renders `completion-summary.md` from α's `completion-summary-template.md` per §12. Sections: `## Completed Phases`, `## Deferred (Out-of-Scope)`, `## Success Criteria Status`, `## Final File Set` (dedup + sort of every wave's `modified_files[]`), `## Residual Open Decisions` (concatenation of `unresolved_concerns[]`). Inputs are each phase's `handoff.md` (γ's artefact) + each wave's `wave.md` frontmatter. **γ gate:** if any in-scope phase lacks a `handoff.md`, block with "Complete requires phase handoff artefacts (Task γ)." User confirms inline prompt. On confirm: `project.md` status → `completed`, `updated` bumped. Move `.do/projects/<slug>/` → `.do/projects/completed/<slug>/` atomically. Clear `active_project` in `.do/config.json`. `active_task` is not touched.
28. **Wire `complete` subcommand in `skills/do/project.md`** — route to `stage-project-complete.md`.

### Out of scope (enumerated to lock it down)

- `/do:project resume` subcommand — γ.
- `stage-phase-exit.md` — γ (handoff.md render).
- `stage-project-resume.md` — γ.
- `resume-preamble-project.md` — γ (sibling of `resume-preamble.md`).
- `project-resume.cjs` — γ.
- Cold-start UAT (fresh session + `/clear` + `/do:project resume` succeeds without re-interview) — γ.
- Any edits to `skills/do/task.md`, `fast.md`, `quick.md`, `continue.md`, `backlog.md`, `abandon.md` — the task pipeline is not touched (§10 isolation).
- Any edits to `project-state.cjs` / `project-scaffold.cjs` / `project-health.cjs` — α's scripts are consumed as-is; β adds no script extensions.
- v2 deferrals per §14 / §6 / §12: wave-fast tier, phase-level debugger (`--phase`), automatic phase-exit detection, do-verifier phase-exit critique variant, database entry auto-sync.

### Testing strategy

- **Structural assertions** on every new skill / stage-reference file: required preamble present, no stale `/do:task` / `.do/tasks/` / `/do:continue` / `active_task` literals, correct bash-block shapes (script invocations use `~/.claude/commands/do/scripts/...` per install-pipeline convention), correct agent-spawn patterns (target-file path passed explicitly).
- **Agent-edit tests:** new fixture-based tests for `do-executioner` and `do-verifier` (frontmatter-presence-gated writes — two fixtures per agent, one with arrays present, one absent).
- **`/do:task` smoke test** — mandatory before β is marked complete. Verifies task-pipeline behaviour preserved verbatim.
- **Subcommand round-trip tests** (where feasible): `new → phase new → wave new → wave next → wave complete → phase complete → abandon` exercising `project-state.cjs` + `project-scaffold.cjs` behind the subcommand surface. Terminate before γ-gated ops (`stage-phase-exit.md` render, `/do:project complete` full flow).
- **Backlog integration tests:** `phase new --from-backlog <id>` / `wave new --from-backlog <id>` seed body + set `backlog_item`. `/do:project phase complete` with `backlog_item != null` invokes `/do:backlog done` (mock `/do:backlog` call).

## Concerns

1. **Branch dependency on α (stacked vs. merge-first).** β depends on α's artefacts (`project-state.cjs`, `project-scaffold.cjs`, templates, state-machine doc, config keys). α is verified but sits on branch `feat/do-project-alpha-contract`, not yet merged to `main`. Two options: (a) wait for α to merge, then branch `feat/do-project-beta-orchestration` off `main`; (b) create `feat/do-project-beta-orchestration` off α's tip as a stacked branch, rebase if α's PR changes during review. **Mitigation:** default to (a) if α's merge is imminent; use (b) with clear rebase discipline if merge is blocked. Call out the branch choice in the first commit message. Document in Execution Log which option was taken.

2. **Agent-spec edits risk regressing the task pipeline.** Seven shared agents get edits. Terminological substitutions are low-risk but could introduce subtle wording changes that shift agent behaviour. Behavioural edits #6 on `do-executioner` + `do-verifier` add new frontmatter writes that, if not correctly gated, could corrupt plain task files. **Mitigation:** (a) frontmatter-presence-gated is the ONLY switch — agents MUST NOT detect caller pipeline; (b) mandatory `/do:task` smoke test before β is marked complete (§14 safeguard); (c) new fixture-based tests for both agents that assert no-op behaviour when frontmatter arrays are absent; (d) every terminological substitution is a pure find-replace with no semantic change — reviewed against the line numbers enumerated in §8 table.

3. **Skill-file structural assertions harder to test than scripts.** `skills/do/project.md` is not a script; there is no automated test harness for skill files today. **Mitigation:** add minimal smoke-test helpers — grep-based checks for required subcommand route headers, absence of `/do:task` / `.do/tasks/` / `/do:continue` literals, bash-block shape validation. Stage-reference files get the same treatment. This is a regression suite against drift, not a behavioural test.

4. **Backlog integration edge cases.** `--from-backlog <id>` reads `BACKLOG.md` via `/do:backlog`-compatible parsing. Edge cases: backlog entry deleted between scan and seed; entry missing `fix:` line; `<id>` not found; entry already `done`. **Mitigation:** β handles missing-entry by failing loudly before mutating `phase.md` / `wave.md`; for already-done, emit warning but still seed (user may be intentionally re-opening); parse errors fall back to seeding the raw entry text into the body section and leave `backlog_item: null` with a changelog note. `/do:backlog done <id>` auto-trigger on `phase complete` / `wave complete` success is gated on `backlog_item != null` (normal case: no-op). Add explicit test coverage for each edge case.

5. **γ-gating on `/do:project complete`.** β ships `stage-project-complete.md` but it depends on γ's `handoff.md` artefacts existing per phase. If a user runs `/do:project complete` without γ shipped, β must block cleanly. **Mitigation:** `stage-project-complete.md` step 1 is a precondition check that lists every in-scope phase's expected `handoff.md` path — if any missing, block with the exact message "Complete requires phase handoff artefacts (Task γ)." and list the missing paths. No partial rendering. This is the only γ-dependency user-facing surface in β; `/do:project phase complete` degrades gracefully (state transition still runs; render step prints "Handoff artefact pending (Task γ)").

6. **Per-phase re-grill firing location.** The re-grill must fire AT the phase boundary (after state transition promotes next phase to `planning`), not upfront for every phase at project planning time. Orchestrator §4 Pass 3 and §14 Task β scope both explicitly note "per-phase when that phase enters planning, NOT upfront." **Mitigation:** the re-grill is wired inside `phase complete`'s post-state-transition block (Group 7 step 20 + Group 6 step 15), not inside `stage-project-plan-review.md`. Test fixture asserts re-grill is NOT invoked when β transitions wave N → wave N+1 within the same phase.

7. **Config-key absence tolerance.** α added `project_intake_threshold` and `council_reviews.project.*` to the config template, but the live `.do/config.json` may not yet have them if β ships before the user's config is updated. **Mitigation:** β reads these keys with fallbacks: `project_intake_threshold` falls back to `auto_grill_threshold` (0.9) if absent; `council_reviews.project.plan` falls back to `council_reviews.planning`; `council_reviews.project.code` falls back to `council_reviews.execution`. `/do:init` will surface the absence as a `missingField` warning (α's health-check addition) prompting the user to update.

8. **Scope creep into γ.** It is tempting for β's author to "just ship `stage-phase-exit.md` too since the phase-complete transition is right there." This is explicitly γ's scope and carries its own focused council review. **Mitigation:** β's Out of Scope section lists every γ artefact by name. β prints "Handoff artefact pending (Task γ)" verbatim — do NOT substitute a partial render. The one-line stub is the acceptance criterion.

9. **`/do:project resume` NOT implemented.** `skills/do/project.md` must route the `resume` subcommand somewhere — blocking with "Resume not yet implemented (Task γ)." is the expected behaviour per the β/γ split. **Mitigation:** include an explicit `resume` case in the dispatcher that errors with the γ-pending message; do not omit the route (which would surface as "unknown subcommand").

10. **Open question (flag, not block): exact location of the 3-question "Pass 2 phase seed" prompts.** §4 says they run in the same session as Pass 1. `stage-project-intake.md` should include both passes in one flow. Confirm during grilling whether Pass 2 should spawn a separate `do-griller` invocation with a distinct question bank, or continue the Pass 1 griller session. **Working assumption:** single griller invocation, two-pass question bank loaded together; re-grilling at confidence threshold fires a new griller session scoped to the gaps.

11. **Final stage-reference count.** The prompt text mentions "nine new stage reference files" then counts to eight. The phase-complete transition is embedded in `skills/do/project.md`'s subcommand handler (not a standalone stage reference — no `stage-phase-complete.md` exists). The project-plan flow is similarly embedded. Final count: **eight** standalone stage reference files (`stage-project-intake.md`, `stage-project-plan-review.md`, `stage-phase-plan-review.md`, `stage-wave-plan-review.md`, `stage-wave-exec.md`, `stage-wave-code-review.md`, `stage-wave-verify.md`, `stage-project-complete.md`). The embedded flows (phase-complete transition, project-plan orchestration) live in `skills/do/project.md`'s subcommand handlers directly. This matches §14 L878-887.

## Execution Log

## Council Review

## Verification Results
