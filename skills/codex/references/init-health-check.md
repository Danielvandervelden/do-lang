---
name: init-health-check
description: Health check procedures for workspace and project. Loaded by /do:init when both are initialized.
---

# Health Check

Run combined health checks when workspace and project are both initialized.

## Step 1: Resolve workspace path

Traverse up from CWD to find `.do-workspace.json` (it lives at the workspace root, not necessarily in the project directory):

```bash
node -e "
const fs = require('fs'), path = require('path');
let d = process.cwd();
while (d !== path.dirname(d)) {
  const f = path.join(d, '.do-workspace.json');
  if (fs.existsSync(f)) { console.log(JSON.parse(fs.readFileSync(f, 'utf8')).workspace); process.exit(0); }
  d = path.dirname(d);
}
console.error('Could not find .do-workspace.json'); process.exit(1);
"
```

Store the result as `<workspace-path>` for use in Steps 2 and 4.

## Step 2: Run workspace health check

```bash
node ~/.codex/skills/do/scripts/workspace-health.cjs <workspace-path>
```

## Step 3: Run project health check

```bash
node ~/.codex/skills/do/scripts/project-health.cjs .
```

## Step 4: Re-run AI tool detection

```bash
node ~/.codex/skills/do/scripts/detect-tools.cjs
```

Handle exit code 1 as warning (no tools detected), not failure.

Read the current value from `.do-workspace.json` and compare (use the `<workspace-path>` resolved in Step 1):

```bash
node -e "
const fs = require('fs'), path = require('path');
const f = path.join('<workspace-path>', '.do-workspace.json');
console.log(JSON.stringify(JSON.parse(fs.readFileSync(f, 'utf8')).availableTools));
"
```

If the detected tools differ from the stored value, update the config:

```bash
node -e "
const fs = require('fs'), path = require('path');
const f = path.join('<workspace-path>', '.do-workspace.json');
const cfg = JSON.parse(fs.readFileSync(f, 'utf8'));
cfg.availableTools = <new-tools-array>;
fs.writeFileSync(f, JSON.stringify(cfg, null, 2));
"
```

Display "AI tools updated: <new-list>" when changed.

## Step 5: Display combined health report

Both scripts return JSON:
```json
{
  "healthy": true|false,
  "version": "0.1.0"|null,
  "issues": [...]
}
```

**If both healthy:**
```
/do:init - Health Check

Workspace: <workspace-path> (healthy, v0.1.0)
AI tools: <availableTools or "none">
Project: my-project/.do/ (healthy, v0.1.0)

No issues found.
```

**If issues found:**
```
/do:init - Health Check

Workspace: <workspace-path> (healthy, v0.1.0)
Project: my-project/.do/ (ISSUES FOUND)

Project Issues:
- [ERROR] <type>: <description>
- [WARNING] <type>: <description>

Suggested fixes:
- <type>: <fix instruction>
```

## Issue Types

### Workspace Issues

| Type | Severity | Fix |
|------|----------|-----|
| `duplicateIndex` | warning | Remove duplicates from `__index__.md` |
| `staleProjects` | warning | Remove database entry or restore repo |
| `orphanedEntries` | warning | Remove or link to repo |
| `missingAgentsSections` | warning | Add missing sections |
| `pointerConsistency` | error | Regenerate pointer files |
| `versionMarker` | error/warning | Re-run /do:init |

### Project Issues

| Type | Severity | Fix |
|------|----------|-----|
| `noDotDoFolder` | error | Re-run /do:init |
| `noConfig` | error | Re-run /do:init |
| `noVersion` | error | Re-run /do:init |
| `missingField` | warning | Add field to config.json |
| `noTasksFolder` | error | Run `mkdir -p .do/tasks` |
| `staleActiveTask` | warning | Clear active_task or restore file |
| `orphanedActiveProject` | error | Clear `active_project` in config.json or restore the project folder |
| `activeProjectNoActivePhase` | warning | Run `/do:project phase new <slug>` or re-activate a phase |
| `orphanedActivePhase` | error | Clear `active_phase` in project.md or restore the phase folder |
| `orphanedActiveWave` | error | Clear `active_wave` in phase.md or restore the wave folder |
| `orphanProjectFolder` | warning | Move folder to `.do/projects/completed/` or `.do/projects/archived/`, or set `active_project` |
| `phaseStatusDrift` | info | Advisory only. Per `skills/do/project.md` §Authoritative state reads, `project.md.phases[]` is a scaffold-seeded snapshot and not kept in sync by `project-state.cjs`. Control-flow reads use `phase.md` leaves directly, so drift here is expected — the parent index is for display. Reconcile manually only if you want the index to reflect current leaf state |
| `waveStatusDrift` | info | Advisory only. Same as phase drift — `phase.md.waves[]` is a scaffold-seeded snapshot. Control flow reads `wave.md` leaves. Reconcile manually only for display consistency |
| `schemaVersionMismatch` | error | Run schema migration (v1 only, so this issue should not occur until v2 lands) |
| `invalidScopeValue` | error | Set `scope` to `in_scope` or `out_of_scope` |
| `illegalScopeTransition` | error | Set `status: blocked` or `abandoned` before setting `scope: out_of_scope` |
| `missingHandoffFields` | warning | Ensure completed waves have `modified_files[]`, `unresolved_concerns[]`, `discovered_followups[]`, and a non-null `wave_summary` populated |
| `illegalPhaseTransition` | error | Complete all in-scope waves before marking phase completed, or mark remaining waves `out_of_scope` |

**Note on drift reconciliation.** α ships no automated drift-reconciliation command. `project-state.cjs status` is read-only; no `sync` op exists. β or a later phase may add `/do:project sync` or an equivalent reconciliation command. Until then, fixes for `phaseStatusDrift` and `waveStatusDrift` are manual edits to the affected frontmatter blocks.
