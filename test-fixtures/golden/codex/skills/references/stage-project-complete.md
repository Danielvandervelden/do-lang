---
name: stage-project-complete
description: "Project completion and archival for /do:project complete. Renders completion-summary.md from alpha's completion-summary-template.md. Gated on all in-scope phases having handoff.md artefacts (Task γ). On confirm: sets project status to completed, archives project folder, clears active_project."
---

# Project Complete Stage

This reference file is loaded by `skills/project.md` `complete`. It validates preconditions, renders `completion-summary.md`, advances project state, and archives the project folder.

**Caller contract:** The caller provides `<active_project>` slug and `<project_path>` = abs path to `project.md`. When this stage returns COMPLETE, `project.md` status is `completed`, `.do/projects/<active_project>/` has been moved to `.do/projects/completed/<active_project>/`, and `active_project` is null in config. If the γ-gate blocks, this stage returns BLOCKED and the caller stops.

---

## PC-0: Read Project State

```bash
node ~/.codex/skills/do/scripts/project-state.cjs status <active_project>
```

Parse the output to get:
- `project.status`
- `phases[]` with each phase's `slug`, `status`, `scope`

---

## PC-1: Precondition Check — All In-Scope Phases Completed

Read phase state authoritatively from each `phase.md` leaf file, NOT from `project.md.phases[]` (parent index is seeded once by scaffold and not synced — see §Authoritative state reads in `skills/project.md`).

```bash
node -e "
const fs = require('fs'), path = require('path');
const { execSync } = require('child_process');
const phasesDir = '.do/projects/<active_project>/phases';
const fmRead = (f) => JSON.parse(execSync('node ~/.codex/skills/do/scripts/update-task-frontmatter.cjs read \"' + f + '\"', { encoding: 'utf8' }));
const phases = fs.readdirSync(phasesDir)
  .filter(d => fs.statSync(path.join(phasesDir, d)).isDirectory())
  .map(slug => {
    const phPath = path.join(phasesDir, slug, 'phase.md');
    if (!fs.existsSync(phPath)) return null;
    const data = fmRead(phPath);
    return { slug, status: data.status, scope: data.scope };
  })
  .filter(Boolean)
  .sort((a, b) => a.slug.localeCompare(b.slug));
const incomplete = phases.filter(p => p.scope === 'in_scope' && p.status !== 'completed');
if (incomplete.length > 0) {
  console.error('Incomplete in-scope phases: ' + incomplete.map(p => p.slug).join(', '));
  process.exit(1);
}
console.log('all-complete');
"
```

If any in-scope phase is not `completed`, display:
```
Cannot complete project: in-scope phases are not all completed.

Incomplete phases:
- <slug> (status: <status>)

Complete all in-scope phases first, then run `/do:project complete` again.
Run `/do:project status` to see full state.
```
Stop.

---

## PC-2: γ-Gate — Check for handoff.md Artefacts

For each in-scope phase, check whether `handoff.md` exists:

Enumerate phases authoritatively from leaf files (not `project.md.phases[]`):

```bash
node -e "
const fs = require('fs'), path = require('path');
const { execSync } = require('child_process');
const phasesDir = '.do/projects/<active_project>/phases';
const fmRead = (f) => JSON.parse(execSync('node ~/.codex/skills/do/scripts/update-task-frontmatter.cjs read \"' + f + '\"', { encoding: 'utf8' }));
const phases = fs.readdirSync(phasesDir)
  .filter(d => fs.statSync(path.join(phasesDir, d)).isDirectory())
  .map(slug => {
    const phPath = path.join(phasesDir, slug, 'phase.md');
    if (!fs.existsSync(phPath)) return null;
    const data = fmRead(phPath);
    return { slug, status: data.status, scope: data.scope };
  })
  .filter(Boolean)
  .filter(p => p.scope === 'in_scope')
  .sort((a, b) => a.slug.localeCompare(b.slug));
const missing = phases.filter(p => {
  const handoffPath = path.join(phasesDir, p.slug, 'handoff.md');
  return !fs.existsSync(handoffPath);
});
if (missing.length > 0) {
  console.log(JSON.stringify({ blocked: true, missing: missing.map(p => p.slug) }));
} else {
  console.log(JSON.stringify({ blocked: false, missing: [] }));
}
"
```

**If any handoff.md is missing (γ-gate fires):**

```
Complete requires phase handoff artefacts (Task γ).

Missing handoff.md for phases:
- .do/projects/<active_project>/phases/<phase_slug>/handoff.md
- …

In β, `/do:project phase complete` marks the phase complete but does NOT
render handoff.md (that rendering is Task γ — project-gamma-resume-handoff).
`/do:project phase complete` has no phase argument — it operates only on
`project.md.active_phase`, which has already been cleared on every completed
phase in this project. So on β alone, there is no skill invocation that can
retroactively render handoff.md for an already-completed phase, and
`/do:project complete` is blocked whenever any phase is missing its handoff
artefact.

To proceed on β without γ: author the handoff.md files manually for each
listed phase using the structure in `@references/handoff-template.md`, then
re-run `/do:project complete`. Once Task γ ships it will define the
authoritative CLI for regenerating handoff artefacts from completed-phase
state (likely via `/do:project resume` or a dedicated `rehydrate` op); β's
BLOCKED message cannot prescribe that CLI because the γ contract is not yet
defined. Manual authoring is the only path available on β alone.
```

Return BLOCKED. Stop.

---

## PC-3: Confirm with User

Display a summary of what will happen:

```
Ready to complete project `<active_project>`.

Summary:
- Phases completed: <count>
- Phases deferred (out-of-scope): <count>
- Total waves shipped: <count>

This will:
1. Render completion-summary.md
2. Set project status to completed
3. Move .do/projects/<active_project>/ → .do/projects/completed/<active_project>/
4. Clear active_project in .do/config.json

Proceed? [Y/n]
```

Wait for user confirmation. If n, stop without changes.

---

## PC-4: Render completion-summary.md

Read the template:

```bash
cat skills/references/completion-summary-template.md
# or installed path:
# cat ~/.codex/skills/do/references/completion-summary-template.md
```

Collect inputs from each in-scope phase's:
- `handoff.md` — exit summary, key deliverables, what shipped
- `phase.md` — status, scope, wave list
- Each wave's `wave.md` — `modified_files[]`, `unresolved_concerns[]`

Populate template sections:

### ## Completed Phases
List each in-scope completed phase with:
- Phase slug + title (from `phase.md` title)
- Waves shipped count
- Key deliverables (from `handoff.md` `## What Shipped`)
- Exit summary (from `handoff.md` `## What Remains` intro)

### ## Deferred (Out-of-Scope)
List phases and waves that were marked `scope: out_of_scope` during the project.

### ## Success Criteria Status
From `project.md` `## Success Criteria` — check each criterion against what shipped:
- `[x]` if met (present in any handoff.md deliverable)
- `[ ]` if deferred (note reason)

### ## Final File Set
Collect union of all `modified_files[]` arrays from all completed waves.
Deduplicate. Sort by path. Group by phase.

```bash
node -e "
const fs = require('fs'), path = require('path');
const { execSync } = require('child_process');
const basePath = '.do/projects/<active_project>/phases';
const fmRead = (f) => JSON.parse(execSync('node ~/.codex/skills/do/scripts/update-task-frontmatter.cjs read \"' + f + '\"', { encoding: 'utf8' }));
const phases = fs.readdirSync(basePath).filter(d => fs.statSync(path.join(basePath, d)).isDirectory());
const allFiles = [];
phases.forEach(phase => {
  const wavesPath = path.join(basePath, phase, 'waves');
  if (!fs.existsSync(wavesPath)) return;
  const waves = fs.readdirSync(wavesPath).filter(d => fs.statSync(path.join(wavesPath, d)).isDirectory());
  waves.forEach(wave => {
    const waveMd = path.join(wavesPath, wave, 'wave.md');
    if (!fs.existsSync(waveMd)) return;
    const data = fmRead(waveMd);
    (data.modified_files || []).forEach(f => allFiles.push(f));
  });
});
const unique = [...new Set(allFiles)].sort();
console.log(unique.join('\n'));
"
```

### ## Residual Open Decisions
Concatenate `unresolved_concerns[]` from all waves. If empty: "No residual open decisions."

Write `completion-summary.md` to `.do/projects/<active_project>/completion-summary.md`.

---

## PC-5: Advance Project State (single-owner transition)

**`project-state.cjs set project <slug> status=completed` already performs the full completion transition:** (a) validates all in-scope phases are `completed` (blocks if not), (b) pre-flight-checks for `completedDestinationExists` in `.do/projects/completed/<slug>/`, (c) writes `status: completed` + fresh `updated` timestamp to `project.md`, (d) `fs.renameSync` the project folder into `.do/projects/completed/<slug>/`, (e) clears `config.active_project` to `null` if it matches the slug. All atomic, all in one script invocation. Do NOT re-implement these side effects inline — α's script is the single owner.

```bash
node ~/.codex/skills/do/scripts/project-state.cjs set project <active_project> status=completed
```

The script appends its own state-transition changelog line before renaming the folder. No additional changelog write is needed here.

**If the script fails** (e.g. `illegalTransition` because an in-scope phase isn't complete, or `completedDestinationExists`): surface the error JSON to the user and stop. Do not proceed to PC-6.

---

## PC-6: Display Completion Summary

```
Project `<active_project>` complete.

Completion summary: .do/projects/completed/<active_project>/completion-summary.md

Summary:
- Phases: <completed_count> completed, <deferred_count> deferred
- Waves shipped: <wave_count>
- Files modified: <file_count> unique files
- Residual open decisions: <concern_count>

Project archived at: .do/projects/completed/<active_project>/
```
