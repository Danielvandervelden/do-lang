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
/do:project resume                        Resume not yet implemented (Task γ)
```

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

Run Phase-Complete State Transition:

1. **Precondition check** — every in-scope wave must be `completed`:
   ```bash
   node -e "
   const fm = require('gray-matter');
   const fs = require('fs'), path = require('path');
   // Read active phase from project.md
   const proj = fm(fs.readFileSync('.do/projects/<active_project>/project.md', 'utf8'));
   const activePhase = proj.data.active_phase;
   if (!activePhase) { console.error('No active phase'); process.exit(1); }
   // Read phase.md waves[]
   const phasePath = '.do/projects/<active_project>/phases/' + activePhase + '/phase.md';
   const phase = fm(fs.readFileSync(phasePath, 'utf8'));
   const waves = phase.data.waves || [];
   const incomplete = waves.filter(w => w.scope === 'in_scope' && w.status !== 'completed');
   if (incomplete.length > 0) {
     console.error('Incomplete waves: ' + incomplete.map(w => w.slug).join(', '));
     process.exit(1);
   }
   console.log(JSON.stringify({ activePhase, waves }));
   "
   ```
   If any in-scope wave is not `completed`, abort with list of incomplete waves.

2. **State transition:**
   ```bash
   node ~/.claude/commands/do/scripts/project-state.cjs set phase <active_phase> status=completed --project <active_project>
   ```

3. **Clear active pointers (schema-correct: `active_wave` lives on `phase.md`, not `project.md`):**
   - In the completing phase's `phase.md`: set `active_wave: null` (atomic temp-file + rename).
   - In `project.md`: set `active_phase: null` (atomic temp-file + rename). Step 5 below may re-populate `active_phase` if a next planning phase exists.
   - Append changelog:
     ```
     <ISO> clear:active_wave:phase:<active_phase>  reason: phase complete
     <ISO> clear:active_phase:project:<active_project>  reason: phase complete
     ```

4. **Backlog cleanup:** read `phase.md` `backlog_item`. If non-null, invoke `/do:backlog done <id>`. Log: "Removed backlog item `<id>` from BACKLOG.md."

5. **Identify next phase (planning-gate preserved):** find the next in-scope phase in `project.md`'s `phases[]` with `status: planning`. If no such phase remains (terminal): set `active_phase: null` on `project.md` (atomic temp-file + rename), do NOT auto-complete the project — user runs `/do:project complete`. If found (non-terminal): do **NOT** write `active_phase` here — that pointer is owned by `stage-phase-plan-review.md` step 5 and is written only after the next phase's plan review approves. Leave the phase's `status` at `planning` and let the re-grill + plan review gate in step 6 below drive the transitions. This preserves the planning gate per `project-state-machine.md` §(c) and the orchestrator contract (§6) and keeps `active_phase` single-owner in `stage-phase-plan-review.md`.

6. **Per-phase re-grill (Pass 3):** if a next phase was found, read its `phase.md` confidence score. If below `project_intake_threshold`, spawn `do-griller` against next phase's `phase.md`; the `Threshold:` field in the prompt MUST be the project threshold (the fallback in `do-griller` is task-safe, so callers who want `project_intake_threshold` must pass it explicitly):

   ```javascript
   Agent({
     description: "Per-phase re-grill (Pass 3)",
     subagent_type: "do-griller",
     model: "<models.overrides.griller || models.default>",
     prompt: `
   Phase confidence is below threshold. Ask clarifying questions to raise confidence for the upcoming phase.

   Target file: .do/projects/<active_project>/phases/<next_phase_slug>/phase.md
   Current confidence: <score>
   Threshold: <project_intake_threshold>

   Ask targeted questions for lowest-scoring factors (scope, dependencies, acceptance criteria).
   Update confidence after each answer. Stop when threshold reached, all 10 questions asked, or user overrides ("proceed anyway").
   `
   })
   ```

   After re-grill returns (or immediately if already at/above threshold), invoke `@references/stage-phase-plan-review.md` for the next phase. Both paths run with the phase at `planning` — that stage reference is the single owner of (a) the phase `planning → in_progress` promotion after plan approval, (b) the idempotent project-level `planning → in_progress` promotion on first-phase-approval, and (c) setting `project.md.active_phase = <next_phase_slug>`.

7. Print:
   ```
   Phase complete. Handoff artefact pending (Task γ).
   ```
   (Do NOT invoke `stage-phase-exit.md` — that is Task γ's scope.)

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

> **No backlog cleanup here.** Wave-backed backlog cleanup runs exclusively in the two trigger points locked by the β contract: (a) `stage-wave-verify.md` success path (WV-3 step 4), and (b) `phase complete`'s phase-level cleanup (which reads `phase.md`'s `backlog_item`). Adding it to the manual `wave complete <slug>` command would let a user mark a backlog item done before the wave has actually been verified. (Rationale: orchestrator design §11 — backlog integration is verification-gated.)

#### `wave abandon <slug>`

1. Call:
   ```bash
   node ~/.claude/commands/do/scripts/project-state.cjs abandon wave <active_phase>/<slug> --project <active_project>
   ```
   Records `pre_abandon_status`, sets `status: abandoned`. Does NOT cascade to parent phase.
2. Append changelog: `<ISO> abandon:wave:<slug>`.

#### `wave next`

1. Read `active_project` + `active_phase` from config and `project.md`.
2. Read `phase.md` `waves[]`. Find first wave with `status: planning` AND `scope: in_scope`.
3. If none found:
   ```
   No planning waves in current phase; run `/do:project wave new <slug>` to create one.
   ```
   Stop.
4. Set wave status to `in_progress`:
   ```bash
   node ~/.claude/commands/do/scripts/project-state.cjs set wave <active_phase>/<wave_slug> status=in_progress --project <active_project>
   ```
5. Update `phase.md` `active_wave: <wave_slug>` (atomic).
6. Append changelog: `<ISO> activate:wave:<wave_slug>`.
7. Load existing `wave.md` (no scaffold — wave must already exist from `wave new` or phase-seeding hook).
8. **Per-wave confidence rescue:** read `wave.md` confidence score. If below `project_intake_threshold`, spawn `do-griller` against `wave.md`:
   ```javascript
   Agent({
     description: "Wave confidence rescue: grill for clarity",
     subagent_type: "do-griller",
     model: "<models.overrides.griller || models.default>",
     prompt: `
   Wave confidence is below threshold. Ask clarifying questions to raise confidence.

   Target file: .do/projects/<active_project>/phases/<active_phase>/waves/<wave_slug>/wave.md
   Current confidence: <score>
   Threshold: <project_intake_threshold>

   Ask targeted questions for lowest-scoring factors (scope, acceptance criteria, blockers).
   Update confidence after each answer. Stop when threshold reached or user overrides ("proceed anyway").
   `
   })
   ```
   On threshold-met or user override, proceed.
9. Invoke `@references/stage-wave-plan-review.md` (targets `wave.md`).
10. Then `@references/stage-wave-exec.md`.
11. Then `@references/stage-wave-code-review.md`.
12. Then `@references/stage-wave-verify.md`.

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

5. Display: "Project `<slug>` abandoned and archived. To re-activate, move `.do/projects/archived/<slug>/` back and run `/do:project resume` (Task γ)."

---

### `resume`

Not yet implemented (Task γ).

```
/do:project resume is not yet implemented. See Task γ (project-gamma-resume-handoff).
```

---

### Unknown subcommand

Display usage and stop:

```
Unknown subcommand: <argv[0]>

Usage: /do:project <new|phase|wave|status|complete|abandon>
Run /do:project without arguments to see this help.
```

---

## Failure Handling

Any agent or script failure returns immediately to user with:
- Which subcommand failed
- Which step failed
- Last known good state
- Project file path (for manual recovery)

No automatic retries. User decides next step.

---

## Files

- **Scripts:**
  - `@scripts/project-scaffold.cjs` — Creates project/phase/wave folders and files
  - `@scripts/project-state.cjs` — State transitions, abandon cascade, status reads
  - `@scripts/project-health.cjs` — Health checks (used by `/do:init`)
- **Stage references (called inline via `@references/...`):**
  - `@references/stage-project-intake.md` — Pass 1 + 2 grilling flow
  - `@references/stage-project-plan-review.md` — PR-0..PR-5, targets `project.md`
  - `@references/stage-phase-plan-review.md` — PR-0..PR-5, targets `phase.md`
  - `@references/stage-wave-plan-review.md` — PR-0..PR-5, targets `wave.md`
  - `@references/stage-wave-exec.md` — Spawns `do-executioner` against `wave.md`
  - `@references/stage-wave-code-review.md` — Spawns `do-code-reviewer` + council
  - `@references/stage-wave-verify.md` — Spawns `do-verifier` against `wave.md`
  - `@references/stage-project-complete.md` — Renders `completion-summary.md`
- **Templates (α artefacts):**
  - `@references/project-master-template.md`
  - `@references/phase-template.md`
  - `@references/wave-template.md`
  - `@references/completion-summary-template.md`
