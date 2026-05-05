# Changelog — {{PROJECT_SLUG}}

Append-only audit log of all state transitions and scaffold events for this project.

## Entry Formats

Two canonical entry formats coexist in this file:

**State-transition entries** (written by `project-state.cjs`):
```
<ISO timestamp>  <node-type>:<slug>  <old_status> -> <new_status>  reason: <reason>
```
Example:
```
2026-04-18T14:22:05Z  phase:02-foundations  planning -> in_progress  reason: /do:project phase start
2026-04-18T16:30:00Z  project:my-proj  in_progress -> abandoned  reason: /do:project abandon
```

**Scaffold entries** (written by `project-scaffold.cjs`):
```
<ISO timestamp> scaffold:<op>:<full-path-slug>
```
Example:
```
2026-04-18T14:00:00Z scaffold:project:my-proj
2026-04-18T14:01:00Z scaffold:phase:my-proj/01-discovery
2026-04-18T14:02:00Z scaffold:wave:my-proj/01-discovery/01-intake
```

The `scaffold:` prefix distinguishes create events from state-transition events.
Both formats are canonical and machine-readable.

---

<!-- Append entries below this line. Do not edit existing entries. -->
