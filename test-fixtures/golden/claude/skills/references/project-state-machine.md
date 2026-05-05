---
name: project-state-machine
description: "Authoritative state-machine specification for /do:project nodes (project, phase, wave). Consumed by AC #3. project-state.cjs implements what this doc specifies — any divergence is a bug in the script, not the doc."
---

# Project State Machine

This document is the **human-authoritative specification** for all legal statuses, scopes, and transitions across the three `/do:project` node types: **project**, **phase**, and **wave**.

`project-state.cjs` implements what this doc specifies — any divergence is a bug in the script, not the doc.

**Runtime truth:** `project-state.cjs` carries an **inline const transition table** that is the machine truth. No markdown is parsed at runtime. This document is the human spec; the script's const is the machine mirror. A drift-detection test in `project-state.test.cjs` parses this document at test time and asserts set equality with the code table.

---

## (a) Status Enum

The status field tracks *work state* — is the node being worked on, finished, or abandoned?

| Status | project.md | phase.md | wave.md | Notes |
|--------|-----------|----------|---------|-------|
| `intake` | Yes | No | No | Leading project-only state before planning begins |
| `planning` | Yes | Yes | Yes | Default after scaffold |
| `in_progress` | Yes | Yes | Yes | Active work underway |
| `blocked` | Yes | Yes | Yes | Blocked waiting on external dependency |
| `completed` | Yes | Yes | Yes | All in-scope children completed |
| `abandoned` | Yes | Yes | Yes | Explicitly abandoned; pre_abandon_status preserved |

Status enum (exhaustive): `intake | planning | in_progress | blocked | completed | abandoned`

Additional project-level leading status: **`intake`** (precedes `planning`; appears only on `project.md`).

---

## (b) Scope Field

The `scope` field tracks an orthogonal decision: *does this node count toward parent completion?*

| Field | project.md | phase.md | wave.md |
|-------|-----------|----------|---------|
| `scope` | Absent | Present | Present |

- **Legal values:** `in_scope` | `out_of_scope`
- **Default:** `in_scope` (set at scaffold time)
- **Semantics:** `out_of_scope` means "deferred — does not count toward parent completion". It is NOT a status; it is a scope flag.
- **project.md has no `scope` field** — the project is never "out-of-scope" relative to itself. Setting `scope` on a project node is rejected by `project-state.cjs` with `{error: "illegalTarget", reason: "project has no scope field"}`.

---

## (c) State Diagram — Status × Scope Matrix

### project.md (no scope field)

| Status | Legal? | Notes |
|--------|--------|-------|
| `intake` | Yes | Initial state at scaffold |
| `planning` | Yes | After intake complete |
| `in_progress` | Yes | Active phase work |
| `blocked` | Yes | Blocked on external dep |
| `completed` | Yes | All in-scope phases completed |
| `abandoned` | Yes | Explicitly abandoned |

### phase.md (scope: in_scope | out_of_scope)

| Status | `in_scope` | `out_of_scope` | Notes |
|--------|-----------|----------------|-------|
| `planning` | Legal | Legal | Default at scaffold |
| `in_progress` | Legal | **Illegal** | Cannot work on out-of-scope phase |
| `blocked` | Legal | Legal | Blocked work allowed |
| `completed` | Legal | Legal | out_of_scope phase can be completed if manually transitioned |
| `abandoned` | Legal | Legal | out_of_scope phase can be abandoned |

### wave.md (scope: in_scope | out_of_scope)

| Status | `in_scope` | `out_of_scope` | Notes |
|--------|-----------|----------------|-------|
| `planning` | Legal | Legal | Default at scaffold |
| `in_progress` | Legal | **Illegal** | Cannot work on out-of-scope wave |
| `blocked` | Legal | Legal | Blocked work allowed |
| `completed` | Legal | Legal | out_of_scope wave can be completed if manually transitioned |
| `abandoned` | Legal | Legal | out_of_scope wave can be abandoned |

---

## (d) Legal Transitions

### Status Transitions

All status transitions are gated by rules. The inline const table in `project-state.cjs` encodes these exactly.

#### project.md status transitions

| From | To | Allowed | Guard |
|------|----|---------|-------|
| `intake` | `planning` | Yes | None |
| `planning` | `in_progress` | Yes | None |
| `planning` | `abandoned` | Yes | None |
| `in_progress` | `blocked` | Yes | None |
| `in_progress` | `completed` | Yes | All in-scope phases must be `completed` |
| `in_progress` | `abandoned` | Yes | None |
| `blocked` | `in_progress` | Yes | None |
| `blocked` | `abandoned` | Yes | None |
| `intake` | `completed` | No | Illegal |
| `planning` | `completed` | No | Illegal |
| `completed` | `*` | No | Terminal state |
| `abandoned` | `*` | No | Terminal state (use restore-from-abandoned) |

#### phase.md status transitions

| From | To | Allowed | Guard |
|------|----|---------|-------|
| `planning` | `in_progress` | Yes | Phase `scope` must be `in_scope`. Note: parent-project-status activation guard is enforced by β's activation flow (`/do:project phase next` / equivalent), not by `project-state.cjs` directly. |
| `planning` | `abandoned` | Yes | None |
| `in_progress` | `blocked` | Yes | None |
| `in_progress` | `completed` | Yes | All in-scope waves must be `completed` |
| `in_progress` | `abandoned` | Yes | None |
| `blocked` | `in_progress` | Yes | None |
| `blocked` | `abandoned` | Yes | None |
| `planning` | `completed` | No | Illegal |
| `completed` | `*` | No | Terminal state |
| `abandoned` | `*` | No | Terminal state (use restore-from-abandoned) |

#### wave.md status transitions

| From | To | Allowed | Guard |
|------|----|---------|-------|
| `planning` | `in_progress` | Yes | Wave `scope` must be `in_scope`. Note: parent-phase-status activation guard is enforced by β's activation flow (`/do:project wave next` / equivalent), not by `project-state.cjs` directly. |
| `planning` | `abandoned` | Yes | None |
| `in_progress` | `blocked` | Yes | None |
| `in_progress` | `completed` | Yes | None |
| `in_progress` | `abandoned` | Yes | None |
| `blocked` | `in_progress` | Yes | None |
| `blocked` | `abandoned` | Yes | None |
| `planning` | `completed` | No | Illegal |
| `completed` | `*` | No | Terminal state |
| `abandoned` | `*` | No | Terminal state (use restore-from-abandoned) |

### Scope Transitions

Scope transitions apply to **phase.md** and **wave.md** only (project has no scope field).

| From | To | Allowed | Guard |
|------|----|---------|-------|
| `in_scope` | `out_of_scope` | Yes | Node `status` must be `planning` or `blocked` |
| `in_scope` | `out_of_scope` | **No** | If node `status` is `in_progress` (Illegal) |
| `out_of_scope` | `in_scope` | Yes | Always allowed (no guard) |

Scope transitions are logged to `changelog.md` exactly like status transitions.

---

## (e) Completion Rules

### Phase completion rule (single clause)

A phase may transition to `completed` **only when every one of its in-scope waves** (`scope === 'in_scope'`) has `status: completed`. Out-of-scope waves (`scope === 'out_of_scope'`) are ignored by the check; their `status` may be anything except `in_progress`.

### Project completion rule (single clause)

A project may transition to `completed` **only when every one of its in-scope phases** has `status: completed`.

---

## (f) Abandon Cascade Rule (in-scope-only semantics)

When `abandon project <slug>` is invoked:

1. Record `pre_abandon_status = current status` on **project.md**.
2. Set `status: abandoned` on **project.md**.
3. Walk every **in-scope** descendant phase.md (`scope === 'in_scope'`):
   - Record `pre_abandon_status = current status` on the phase.md.
   - Set `status: abandoned` on the phase.md.
   - Walk every **in-scope** descendant wave.md of that phase (`scope === 'in_scope'`):
     - Record `pre_abandon_status = current status` on the wave.md.
     - Set `status: abandoned` on the wave.md.
4. **Out-of-scope descendants are untouched** — their `status` remains as-is (typically `planning` or `blocked`) and their `scope: out_of_scope` is preserved. No `pre_abandon_status` is set on out-of-scope nodes.
5. **After all per-node writes complete:** move `.do/projects/<slug>/` to `.do/projects/archived/<slug>/` via `fs.renameSync`. Destination-collision guard: if `.do/projects/archived/<slug>/` already exists, exit non-zero with `{error: "archiveDestinationExists", dest}`.
6. If `config.active_project === slug`, clear it to `null` via atomic temp-file + rename on `.do/config.json`.

**Idempotency:** On re-invoke (e.g. partial cascade due to interruption), nodes already carrying a non-null `pre_abandon_status` are skipped. Re-running `abandon` picks up where it left off.

For non-project `abandon` (phase or wave): cascade propagates downward to in-scope descendants only. No folder moves. No `config.active_project` clearing.

---

## (g) Resume-from-Abandoned Restore Rule

When `restore-from-abandoned <project_slug>` is invoked:

1. **Before per-node frontmatter writes:** move `.do/projects/archived/<slug>/` to `.do/projects/<slug>/` via `fs.renameSync`. Destination-collision guard: if `.do/projects/<slug>/` already exists, exit non-zero with `{error: "restoreDestinationExists", dest}`.
2. Walk **project.md**: if `pre_abandon_status` is non-null, set `status = pre_abandon_status` then null `pre_abandon_status`. Atomic temp-file + rename.
3. Walk every **in-scope** phase.md: same restore pattern.
4. Walk every **in-scope** wave.md of each in-scope phase: same restore pattern.
5. **Out-of-scope nodes are untouched** — no field restoration because the cascade never touched them (they never had `pre_abandon_status` set).
6. **Does NOT automatically re-set `config.active_project`** — the caller (β or the user) decides whether to re-activate the project.

**Idempotency:** Nodes with `pre_abandon_status: null` are skipped (already restored or never abandoned). Re-invoking `restore-from-abandoned` is safe.

---

## (h) Terminal-Pre-Complete State Definition

A project is in the **terminal-pre-complete state** when:

- `project.md` `active_phase: null` AND
- `project.md` `status: in_progress` AND
- Every **in-scope** phase has `status: completed`

This state means: all in-scope work is done, but `/do:project complete` has not yet been invoked to move the project folder to `completed/` and finalize the project. The `activeProjectNoActivePhase` health-check issue does **not** fire in this state (see §13 explicit non-issue gate — the warning fires only when un-completed in-scope phases remain).

---

## Confidence Field Semantics

The `confidence.score` field on project.md / phase.md / wave.md is typed `<0..1>` ONCE SET, but is `null` during scaffold — before the planner has scored the node. `null` signals "not yet measured".

**Consumers treat `null` as "unscored" and do NOT gate on it:**
- `project-health.cjs` schema-version and scope checks do not consult `confidence` — `null` scores produce no false-positive issues.
- `project-state.cjs` transition validation does not consult `confidence` — `null` scores do not block transitions.

The full `confidence` frontmatter shape — including the nested `factors.{context,scope,complexity,familiarity}` — is **always present** with `null` sentinels for unscored values. The structure is never omitted.

---

## Changelog Format

Every state write by `project-state.cjs` appends a line to `.do/projects/<project_slug>/changelog.md`:

```
2026-04-18T14:22:05Z  phase:02-foundations  planning -> in_progress  reason: /do:project phase complete
```

Format: `<ISO timestamp>  <node-type>:<slug>  <old_status> -> <new_status>  reason: <reason>`

Scaffold events use a different prefix format: `<ISO-timestamp> scaffold:<op>:<full-path-slug>` — the `scaffold:` prefix distinguishes create events from state-transition events. Both formats coexist in the same `changelog.md`.
