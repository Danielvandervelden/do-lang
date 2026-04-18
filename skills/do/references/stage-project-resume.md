---
name: stage-project-resume
description: "Cold-start resume orchestrator for /do:project resume. Reads config + project state via project-resume.cjs, runs resume-preamble-project.md once per target file, shows unified resume summary, and routes to the correct stage reference."
---

# Project Resume Stage

This reference file is loaded by `skills/do/project.md` `resume`. It implements the cold-start resume flow per orchestrator §7 steps 1–8.

**Caller contract:** Invoked by `/do:project resume` with no arguments. Reads `active_project` from `.do/config.json`. Returns COMPLETE when the routed stage reference returns COMPLETE, or STOP when any guard condition aborts the flow.

---

## SPR-0: Read Config

```bash
node -e "
const c = require('./.do/config.json');
console.log(JSON.stringify({ active_project: c.active_project || null }));
"
```

If `active_project` is null or `.do/config.json` does not exist:

```
No active project. Run `/do:project new <slug>` to start one.
```

**STOP.**

---

## SPR-1: Compute Next Action

Run `project-resume.cjs` to determine the next action:

```bash
node ~/.claude/commands/do/scripts/project-resume.cjs
```

Parse the JSON output into:
- `action` — routing key
- `target_file` — relative path to the relevant `.md` file
- `target_type` — `project` | `phase` | `wave`
- `summary` — human-readable description
- `preamble_targets` — array of `{ path, type }` objects for preamble invocations

---

## SPR-2: Handle Special Cases Before Preamble

Check the `action` value:

**`inconsistent-state`:**
```
Project `<active_project>` is in an inconsistent state (active_phase: null but
in-scope phases incomplete). Run `/do:init` for diagnostics.
```
**STOP.**

**`already-complete`:**
```
Project `<active_project>` is already completed.
```
**STOP.**

**`error`** (error from `project-resume.cjs`):
```
Resume error: <summary from JSON>
```
**STOP.**

All other actions continue to SPR-3.

---

## SPR-3: Run Resume Preamble Per Target File

Invoke `@references/resume-preamble-project.md` **once per entry** in `preamble_targets`, in order (project.md first, then phase.md if present, then wave.md if present).

Each invocation receives:
- `<target-file-path>` = the `path` field from the current `preamble_targets` entry
- `<target-file-type>` = the `type` field from the current `preamble_targets` entry

**If any preamble invocation STOPs** (user chose option 2 in the stale-reference prompt, or declined the resume confirmation in R0.5p), the entire resume stops immediately. Do NOT proceed to the next preamble invocation or to SPR-4.

---

## SPR-4: Display Unified Resume Summary

After all preamble invocations complete successfully, display a unified summary.

**If `action` == `terminal-pre-complete`:**
```
Project `<active_project>` — all in-scope phases complete.
Action required: Run `/do:project complete` to finalise the project.
```
Return control to the user. Do NOT auto-invoke `stage-project-complete.md`.
**STOP** (advisory only — user triggers completion explicitly).

**For all other actions**, read display fields from disk then display:

```bash
node -e "
const fm = require('gray-matter'), fs = require('fs'), path = require('path');
const projPath = '.do/projects/<active_project>/project.md';
const proj = fm(fs.readFileSync(projPath, 'utf8'));
const activePhase = proj.data.active_phase || null;
let activeWave = null;
if (activePhase) {
  const phPath = path.join('.do/projects/<active_project>/phases', activePhase, 'phase.md');
  if (fs.existsSync(phPath)) {
    const ph = fm(fs.readFileSync(phPath, 'utf8'));
    activeWave = ph.data.active_wave || null;
  }
}
const clPath = '.do/projects/<active_project>/changelog.md';
const clLines = fs.existsSync(clPath) ? fs.readFileSync(clPath, 'utf8').split('\n').filter(l => l.trim()) : [];
const lastAction = clLines.length > 0 ? clLines[clLines.length - 1] : '(none)';
console.log('Project: <active_project>');
console.log('Active phase: ' + (activePhase || '(none)'));
console.log('Active wave: ' + (activeWave || '(none)'));
console.log('Last action: ' + lastAction);
"
```

Then display:
```
<output from above>

Next: <summary from project-resume.cjs output>
```

---

## SPR-5: Route to Stage Reference

Based on the `action` value from `project-resume.cjs`, route as follows:

| Action | Routing |
|--------|---------|
| `stage-project-intake` | Invoke `@references/stage-project-intake.md` |
| `stage-project-plan-review` | Invoke `@references/stage-project-plan-review.md` |
| `stage-phase-plan-review` | Invoke `@references/stage-phase-plan-review.md` targeting the active phase |
| `stage-wave-plan-review` | Invoke `@references/stage-wave-plan-review.md` targeting the active wave |
| `stage-wave-exec` | Invoke `@references/stage-wave-exec.md` targeting the active wave |
| `stage-wave-code-review` | Invoke `@references/stage-wave-code-review.md` targeting the active wave |
| `stage-wave-verify` | Invoke `@references/stage-wave-verify.md` targeting the active wave |
| `wave-next-needed` | Display "No active wave. Run `/do:project wave next` to activate the next wave." **STOP.** |
| `wave-completed-next-needed` | Display "Active wave completed. Run `/do:project wave next` for the next wave." **STOP.** |
| `project-blocked` | Display "Project `<active_project>` is blocked. Resolve the blocker and retry." **STOP.** (`<active_project>` is known from SPR-0 config read.) |
| `phase-blocked` | Display "Phase is blocked. Resolve the blocker and retry." (Phase slug is in SPR-4 output above.) **STOP.** |
| `wave-blocked` | Display "Wave is blocked. Resolve the blocker and retry." (Wave slug is in SPR-4 output above.) **STOP.** |
| `terminal-pre-complete` | Handled in SPR-4 above (advisory, no auto-routing). **STOP.** |
| _(unknown)_ | Display "Unexpected resume action: `<action>`. Run `/do:init` for diagnostics." **STOP.** |

Return whatever the invoked stage reference returns (COMPLETE or STOP propagates to the caller).

---

## Files

- **Script:** `@scripts/project-resume.cjs` — State reader, returns next-action JSON
- **Preamble:** `@references/resume-preamble-project.md` — Per-file context reload
- **Stage references (called from SPR-5):**
  - `@references/stage-project-intake.md`
  - `@references/stage-project-plan-review.md`
  - `@references/stage-phase-plan-review.md`
  - `@references/stage-wave-plan-review.md`
  - `@references/stage-wave-exec.md`
  - `@references/stage-wave-code-review.md`
  - `@references/stage-wave-verify.md`
