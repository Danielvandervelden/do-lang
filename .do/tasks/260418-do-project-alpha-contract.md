---
id: 260418-do-project-alpha-contract
created: 2026-04-18T12:34:22.000Z
updated: '2026-04-18T13:52:00.000Z'
description: >-
  Implement Task α (project-contract) for /do:project — ship the on-disk
  contract locked by orchestrator design file
  .do/tasks/260418-do-project-orchestrator.md §14. Scope:
  project.md/phase.md/wave.md frontmatter schemas + project_schema_version:1,
  .do/projects/{,completed/,archived/} folder shape,
  skills/do/references/project-state-machine.md (authoritative state doc per AC
  #3), skills/do/scripts/project-state.cjs (public ops:
  status/set/abandon/restore-from-abandoned with transition validation, atomic
  temp-file+rename, unit tests incl. round-trip abandon→restore),
  skills/do/scripts/project-scaffold.cjs (project/phase/wave ops with NN- prefix
  allocation, atomic parent-index update, default frontmatter, changelog
  append), skills/do/scripts/project-health.cjs ADDITIVE extension
  (project-folder checks from §13 + config-schema validation for
  active_project/project_intake_threshold/council_reviews.project.* mirroring
  existing patterns), templates
  (project-master/phase/wave/handoff/changelog/intake-transcript/completion-summary),
  config-template.json additions, task-template.md `related: []` field,
  init-health-check.md issue-types table extension, init.md Quick Reference
  additive note. Explicitly OUT of scope: /do:project skill file, any stage
  reference, any orchestrator code. Foundation task — β and γ depend on it.
related:
  - 260418-do-project-orchestrator
stage: complete
stages:
  refinement: complete
  grilling: complete
  execution: complete
  verification: complete
  abandoned: false
council_review_ran:
  plan: false
  code: true
confidence:
  score: 0.9
  factors:
    context: -0.0
    scope: -0.05
    complexity: -0.05
    familiarity: -0.0
backlog_item: null
---

# Task α — /do:project project-contract

## Problem Statement

### What
Ship the on-disk contract for `/do:project` as locked by the design file `.do/tasks/260418-do-project-orchestrator.md` §14 "Task α — project-contract" (L832-867). Task α is the foundation child of the three-way split (α → β → γ); β and γ both depend on α landing first. α ships artefacts only — no skill file, no stage reference, no orchestrator code. A human can hand-scaffold a project folder with just α's outputs before β's automation exists.

Verbatim scope from orchestrator §14 (L837-865):
- Frontmatter schemas for `project.md` / `phase.md` / `wave.md` (all sections of §2), with `project_schema_version: 1`.
- Folder shape: `.do/projects/<slug>/`, `.do/projects/completed/`, `.do/projects/archived/` (§2).
- `skills/do/references/project-state-machine.md` — "dedicated state-machine reference file (the authoritative spec consumed by AC #3)". Must enumerate (a)–(h) from §14 (status enum + project-only `intake`; orthogonal `scope` field; state diagram as status × scope matrix; all legal status + scope transitions per §3; completion rules; abandon cascade with in-scope-only semantics; resume-from-abandoned restore rule; terminal-pre-complete state definition).
- `skills/do/scripts/project-state.cjs` — "atomic frontmatter R/W, transition validation (§3 rules), `changelog.md` append. Unit tests for every legal + illegal transition including scope transitions. Implementation must match `project-state-machine.md` exactly."
- `skills/do/scripts/project-scaffold.cjs` — "folder tree creation + template slot-filling. No wave.md / task.md cross-link (§6 removes that)." Ops: `project`, `phase`, `wave`. Prefix allocation (`max+1`, zero-padded to 2 digits). Atomic parent-index update on project.md/phase.md arrays. Default frontmatter on every new node. Changelog append.
- `skills/do/scripts/project-health.cjs` — "extends the existing script's `checkProjectHealth()` function with the project-folder checks in §13. The existing task-pipeline integrity checks ... stay intact ... Task α only adds new project-folder check types to the same `issues[]` array under the same JSON return shape." Plus config-schema validation additions for `active_project`, `project_intake_threshold`, `council_reviews.project.{plan,phase_plan,wave_plan,code}` mirroring the existing `council_reviews` / `auto_grill_threshold` / `active_task` patterns at current L114-156, L149-156, L164-170.
- Templates under `skills/do/references/`: `project-master-template.md`, `phase-template.md`, `wave-template.md`, `handoff-template.md`, `changelog-template.md`, `intake-transcript-template.md`, `completion-summary-template.md` (the last is consumed by β's `stage-project-complete.md` per §12; α ships the template, β ships the rendering flow).
- `skills/do/references/config-template.json` additions: `active_project`, `project_intake_threshold`, `council_reviews.project.{plan,phase_plan,wave_plan,code}`.
- `skills/do/references/task-template.md` — "add a `related: []` frontmatter field so children can carry `related: [\"260418-do-project-orchestrator\"]`. No other edits."
- `skills/do/references/init-health-check.md` — extend the existing `### Project Issues` sub-table (current L123-133) with the new project-folder issue types from §13 (12 types enumerated below) and their severity + fix.
- `skills/do/init.md` — additive Quick-Reference / Files note (may be skipped per iteration-9 reality check if no natural insertion point exists — see Concern 5).

Explicitly OUT of scope (§14 last bullet, L865): "the `/do:project` skill file, any stage reference, any orchestrator code." All nine stage references (stage-project-*.md, stage-phase-*.md, stage-wave-*.md), `skills/do/project.md`, `skills/do/do.md` router update, and `project-resume.cjs` / `resume-preamble-project.md` are β's or γ's work.

### Why
Per orchestrator §14 L869: "the contract needs to freeze before orchestration sits on top of it. Shipping α alone also lets a user hand-scaffold and experiment before automation exists." And per the user directive cited in §1 Why (L50): "It's VERY important to get the foundation of this new project command right — a lot of tokens and time will go into creating a new project for users. So the contract must be stable on day one even if the automation ships incrementally."

### Acceptance criteria
1. All files listed in Approach exist at the specified paths with the specified content shape. Scaffolded `project.md` / `phase.md` / `wave.md` files carry the full `confidence` frontmatter shape with explicit `null` sentinels (`confidence: {score: null, factors: {context: null, scope: null, complexity: null, familiarity: null}}`) — the structure is present at scaffold time; only the numeric values are unscored until the planner fills them in. `null` is NOT omitted.
2. `project-state.cjs` implements every legal + illegal transition (status × scope) described in `project-state-machine.md`. Unit tests cover every transition. All public ops validate their slug / slash-delimited path operands up front via the shared `validate-slug.cjs` library before any filesystem call; invalid inputs (empty, `..`, absolute path, malformed prefix, wrong arity) exit non-zero with structured stderr JSON and produce no side effects.
3. Round-trip test: `abandon project` → `restore-from-abandoned` recovers every in-scope node's `status` from `pre_abandon_status` and nulls the field; out-of-scope nodes remain untouched (not modified by either leg). The folder round-trip is also asserted: `abandon project <slug>` moves `.do/projects/<slug>/` to `.do/projects/archived/<slug>/`, and `restore-from-abandoned <slug>` moves it back to `.do/projects/<slug>/` before writing frontmatter.
4. `project-scaffold.cjs` allocates correct numeric prefixes, writes valid frontmatter, and updates parent `phases[]` / `waves[]` arrays atomically. Integration tests for prefix allocation (first child = `01-`, subsequent = `max+1`). All ops validate `project_slug` / `phase_slug` / `wave_slug` inputs via the shared `validate-slug.cjs` library before any `mkdirSync` or `fs.writeFileSync`; invalid inputs exit non-zero with structured stderr JSON and produce no side effects. (User-supplied phase/wave slugs are unprefixed — the `NN-` prefix is allocated by the script; validation uses `validateSlug`, not `validatePrefixedSlug`, for those inputs.)
5. `project-health.cjs` passes every existing task-pipeline test verbatim (no regression) AND emits each of the 12 new project-folder issue types on a crafted fixture tree. Config-schema validation additions emit `missingField` + `invalidField` as appropriate for all four new keys.
6. `npm test` (existing `node --test skills/do/scripts/__tests__/*.test.cjs` harness) passes.

## Clarifications

## Context Loaded

- `.do/tasks/260418-do-project-orchestrator.md` §1 (L117-161) — skill file layout + artefact inventory: confirms α owns project-state-machine.md, project-state.cjs, project-scaffold.cjs, project-health.cjs extension, all 7 templates, config-template.json + task-template.md + init-health-check.md + init.md edits.
- `.do/tasks/260418-do-project-orchestrator.md` §2 (L164-315) — frontmatter schemas + folder shape. α ships these verbatim.
- `.do/tasks/260418-do-project-orchestrator.md` §3 (L317-351) — state machine: status enum, scope semantics, legal transitions, abandon cascade with in-scope-only rule, writer assignment (project-state.cjs owns both abandon and restore-from-abandoned writes).
- `.do/tasks/260418-do-project-orchestrator.md` §13 (L801-822) — health-check integration: the 12 new issue types, the "awaiting /do:project complete" non-issue gate that project-health.cjs must distinguish.
- `.do/tasks/260418-do-project-orchestrator.md` §14 (L832-869) — the authoritative Task α scope block; quoted throughout the Approach.
- `skills/do/scripts/project-health.cjs` (existing, 257 lines) — pattern to mirror for config-schema validation: `council_reviews` loop at L114-147, `auto_grill_threshold` at L149-156, `active_task` at L164-191.
- `skills/do/scripts/debug-session.cjs` L120-131 — canonical atomic-write pattern (temp-file + `renameSync`) used by α's scripts.
- `skills/do/scripts/__tests__/*.test.cjs` (6 existing test files) — `node --test` harness, `mkdtempSync` for isolated fixtures. α's unit tests follow this convention.
- `skills/do/references/init-health-check.md` L123-133 — existing `### Project Issues` sub-table structure α extends.
- `skills/do/references/task-template.md` — existing frontmatter + body-section layout. α adds a `related: []` field (minimal one-field additive edit per §14 L860).
- `skills/do/references/config-template.json` (20 lines) — existing config shape α extends with four new keys.
- `package.json` L12 — `"test": "node --test skills/do/scripts/__tests__/*.test.cjs"` (test harness contract).

## Approach

Implementation is ordered by dependency: spec doc → state script (implements the doc) → scaffold script (uses state script for transitions, writes frontmatter directly for CREATE) → health extension → templates → surface-level template/config/doc edits. The "mirror existing pattern" rule applies throughout: every new `project-health.cjs` check replicates the exact shape of the current `council_reviews` / `auto_grill_threshold` / `active_task` validation loops. Every atomic write uses temp-file + `renameSync` per `debug-session.cjs` L120-131. Every script is test-covered under `skills/do/scripts/__tests__/` using the `node --test` + `mkdtempSync` convention.

### Step 1 — Author the authoritative state-machine reference
**File:** `skills/do/references/project-state-machine.md` (new)

Structure mirrors the (a)–(h) enumeration in orchestrator §14 L839, one section per clause:
- **(a) Status enum** — `planning | in_progress | blocked | completed | abandoned`, plus the project-only leading `intake` status. Table: which values are legal on project.md vs. phase.md vs. wave.md.
- **(b) Scope field** — `scope: in_scope | out_of_scope`, default `in_scope`, absent on project.md per §2/§3 (the project is never "out-of-scope" relative to itself).
- **(c) State diagram as status × scope matrix** — one matrix per node type (project / phase / wave). Cells mark legal states.
- **(d) All legal status transitions + all legal scope transitions** — two tables: status-transitions (from → to, gated-by-rule) and scope-transitions (`in_scope → out_of_scope` legal only from `planning`/`blocked`; `out_of_scope → in_scope` always legal).
- **(e) Completion rules** — phase completes when every in-scope wave `completed`; project completes when every in-scope phase `completed` (per §3).
- **(f) Abandon cascade rule with in-scope-only semantics** — `pre_abandon_status` recorded on project + every in-scope descendant; `status: abandoned` set on those. Out-of-scope descendants untouched.
- **(g) Resume-from-abandoned restore rule** — in-scope nodes restore `status` from `pre_abandon_status` then null the field; out-of-scope nodes remain unchanged.
- **(h) Terminal-pre-complete state definition** — `active_phase: null` + `status: in_progress` + every in-scope phase `completed` (per §7 step 5 / §12 / §13).

Doc includes a paragraph stating: "`project-state.cjs` implements what this doc specifies — any divergence is a bug in the script, not the doc" (quote from §14 L839).

**Confidence field semantics.** The `confidence.score` field on project.md / phase.md / wave.md is typed `<0..1>` ONCE SET, but is `null` during scaffold — before the planner has scored the node. `null` signals "not yet measured" (mirroring task-template.md's precedent where the planner fills `confidence` in during the plan phase). All consumers treat `null` as "unscored" and do NOT gate on it: `project-health.cjs` schema-version and scope checks do not consult `confidence` (so `null` scores produce no false-positive issues); `project-state.cjs` transition validation does not consult `confidence` (so `null` scores do not block transitions). The full `confidence` frontmatter shape — including the nested `factors.{context,scope,complexity,familiarity}` — is always present, with `null` sentinels for unscored values; the structure is never omitted.

### Step 2 — Implement `project-state.cjs`
**File:** `skills/do/scripts/project-state.cjs` (new)

**Slug / path input validation (applies to every op below).** Every public op validates its slug / slash-delimited path operand up front via the shared `skills/do/scripts/lib/validate-slug.cjs` library (see Step 2b below) BEFORE any filesystem call. `project_slug` is validated via `validateSlug`; slash-delimited phase/wave paths are validated via `validateNodePath(nodeType, path)` (splits on `/`, enforces arity, checks each segment carries a legal `NN-<slug>` prefix). Rejection exits non-zero with structured stderr JSON `{error: "invalidSlug"|"invalidPath", reason, value}` and produces zero side effects (no temp files, no partial writes, no config touches). This closes the path-traversal / absolute-path hole (mirrors the canonical pattern at `skills/do/scripts/task-abandon.cjs` L42-56).

**Confidence is not consulted.** Transition validation does NOT read `confidence.score`. `null` scores do not block `set` / `abandon` / `restore-from-abandoned`. Confidence is planner-metadata only; the state machine is orthogonal.

Public ops (quoted from §14 L840-845):

- **`status <project_slug>`** — "read-only. Returns JSON: `{project: {status, active_phase}, phases: [{slug, status, scope, active_wave, waves: [{slug, status, scope}]}]}`. No `scope` at the project level." Used by `/do:project status` (β).
- **`set <node-type> <path> <status=<new_status> | scope=<new_scope>>`** — `node-type ∈ {project, phase, wave}`; `path` is a prefixed slug or slash-delimited prefixed-slug tuple (e.g. `01-discovery` for a phase, `01-discovery/02-intake` for a wave) — canonical prefixed form, matching `validateNodePath()`. The third positional arg is parsed as `status=X` (status mutation — current behavior per §14 L842) OR `scope=X` (NEW — scope mutation). Validates transition against the state machine: status transitions use the status sub-table; scope transitions use the scope sub-table (state-machine section (d)). Atomic temp-file + rename. Returns old→new transition record as JSON to stdout. Scope mutation is only legal on phase / wave (not project — per state-machine section (b), scope is absent on project.md); `set project <slug> scope=...` exits non-zero with `{error: "illegalTarget", reason: "project has no scope field"}`. **When the op is `set project <slug> status=completed`** (per orchestrator §3 L338): AFTER the frontmatter write completes, additionally MOVE `.do/projects/<slug>/` → `.do/projects/completed/<slug>/` via `fs.renameSync`. Destination-collision guard: if the destination already exists, exit non-zero with stderr JSON `{error: "completedDestinationExists", dest}`. Then, if `config.active_project === slug`, clear it to `null` via atomic temp-file + rename on `.do/config.json` (AFTER the folder move).
- **`abandon <node-type> <path>`** — "records `pre_abandon_status` on the target node and every in-scope descendant (per §3 cascade rule). Sets each such node's `status: abandoned`. Out-of-scope descendants untouched. Atomic per node." **When `node-type == project`** (per orchestrator §3 L337 and §12 L795): AFTER the per-node frontmatter writes complete, additionally MOVE `.do/projects/<slug>/` → `.do/projects/archived/<slug>/` via `fs.renameSync`. If the destination already exists, exit non-zero with stderr JSON `{error: "archiveDestinationExists", dest}`. Then, if `config.active_project === slug`, clear it: set `config.active_project = null` via atomic temp-file + rename on `.do/config.json` (this happens AFTER the folder move). The cascade-abandon for non-project nodes (phase, wave) does NOT move folders and does NOT touch `config.active_project`.
- **`restore-from-abandoned <project_slug>`** — (per orchestrator §12 L795 resume flow) BEFORE the per-node frontmatter writes, MOVE `.do/projects/archived/<slug>/` → `.do/projects/<slug>/` via `fs.renameSync` (so the subsequent writes land at the canonical project location, not the archive). Destination-collision guard: if `.do/projects/<slug>/` already exists, exit non-zero with `{error: "restoreDestinationExists", dest}`. Then walk project.md + all in-scope phase.md + all in-scope wave.md; for each node with non-null `pre_abandon_status`, sets `status = pre_abandon_status` and nulls `pre_abandon_status`; atomic temp-file + rename per node; out-of-scope nodes untouched. Does NOT automatically re-set `config.active_project` — per orchestrator §12 L795, the caller (β or the user) decides whether to re-activate; document this explicitly in the op's module docblock.

**Transition-table shape.** The const transition table inside `project-state.cjs` now carries two sub-tables: one keyed by status transitions (existing) and one keyed by scope transitions (new). Both are exercised by the tests below. The state-machine doc's (d) section enumerates both sub-tables; the script's const is the machine-truth mirror (see Concern 3 — the drift-detection test locks doc/script equality).

Atomicity: every state-mutating op uses `.tmp-<basename>` + `fs.renameSync` per `debug-session.cjs` L120-131. Each node write is atomic on its own; multi-node cascade is best-effort with per-node atomicity (caller handles any partial-cascade recovery via re-invoke — idempotent because the op skips nodes whose `pre_abandon_status` is already populated on abandon, or null on restore).

Transition validation: every op consults an **inline const transition table in `project-state.cjs`** — this const is the **runtime source of truth**; no markdown is parsed at runtime. `project-state-machine.md` is the **human-authoritative spec**; a dedicated drift-detection test (see Concern 3) parses the doc once at test time and asserts the code table matches the doc exactly. Invalid transitions exit non-zero with structured JSON error to stderr: `{error: "illegalTransition", from, to, node_type, path}` (for status) or `{error: "illegalScopeTransition", from, to, node_type, path}` (for scope).

Changelog append: every state write appends a line to `.do/projects/<project_slug>/changelog.md` in the format specified by §3 L348-350: `<ISO timestamp>  <node-type>:<slug>  <old_status> -> <new_status>  reason: <reason>`. Append is NOT wrapped in a temp-file rename (append is atomic on POSIX for writes ≤ PIPE_BUF; for this use case append-and-flush via `fs.appendFileSync` is sufficient — matches existing workspace-health.cjs / task-abandon.cjs conventions).

**Tests** (`skills/do/scripts/__tests__/project-state.test.cjs`, new):
- One test per legal status transition (planning → in_progress, in_progress → blocked, blocked → in_progress, in_progress → completed, in_progress → abandoned, etc.) across all three node types.
- One test per illegal transition (planning → completed; in_progress wave under planning phase; in_progress node with scope out_of_scope; etc.).
- One test per legal scope transition (in_scope → out_of_scope from planning; in_scope → out_of_scope from blocked; out_of_scope → in_scope from any).
- One test per illegal scope transition (in_scope → out_of_scope from in_progress).
- Completion rule tests: phase cannot `completed` while any in-scope wave not `completed`; phase may `completed` if only out-of-scope waves incomplete; analogous for project.
- Round-trip cascade test: create project with 2 phases (1 in-scope, 1 out-of-scope) each with 2 waves (mix of scopes); `abandon project`; verify every in-scope node has `status: abandoned` + `pre_abandon_status` populated; verify out-of-scope nodes untouched (original scope + original status intact). Run `restore-from-abandoned`; verify every in-scope node's `status` back to pre-abandon value and `pre_abandon_status: null`; verify out-of-scope nodes still untouched.
- Changelog-append test: verify each state write appends exactly one line with the expected format.
- **Scope set via `set` op:** `set phase foo scope=out_of_scope` from `planning` succeeds; `set phase foo scope=out_of_scope` from `in_progress` is rejected with `illegalScopeTransition`; `set project <slug> scope=...` is rejected with `illegalTarget`.
- **Folder-move on project abandon:** after `abandon project <slug>`, `.do/projects/<slug>/` no longer exists and `.do/projects/archived/<slug>/` does exist with frontmatter intact. A second `abandon project <slug>` with a pre-existing archive destination exits non-zero with `archiveDestinationExists`.
- **Folder-move on project completion:** after `set project <slug> status=completed`, the folder is at `.do/projects/completed/<slug>/`. Collision case returns `completedDestinationExists`.
- **Folder-move on restore-from-abandoned:** given an archived project, `restore-from-abandoned <slug>` moves `.do/projects/archived/<slug>/` back to `.do/projects/<slug>/` BEFORE writing frontmatter; frontmatter writes land at the canonical path; collision on destination returns `restoreDestinationExists`.
- **`active_project` clearing:** (1) with `config.active_project === <slug>`, `abandon project <slug>` clears it to `null`; (2) with `config.active_project === <other>`, `abandon project <slug>` leaves it untouched; (3) same two cases for `set project <slug> status=completed`; (4) `restore-from-abandoned <slug>` does NOT set `config.active_project` under any condition (even if it was `null` beforehand).
- **Slug / path rejection (at least 4 cases):** `set phase ../evil status=in_progress` exits non-zero with `invalidSlug|invalidPath`; `abandon project /absolute/path` exits non-zero; `status ''` (empty slug) rejected; `set wave 01-foo//02-bar scope=in_scope` (empty segment) rejected; `set wave 01-foo status=in_progress` (wrong arity — wave needs 2 segments) rejected; `set phase FOO status=in_progress` rejected if regex forbids upper case. Every rejection must produce NO on-disk side effects (assert fixture tree is byte-identical before/after).

### Step 2b — Shared slug / path validator library (α-owned)
**File:** `skills/do/scripts/lib/validate-slug.cjs` (new)

Shared leaf module consumed by both `project-state.cjs` (Step 2) and `project-scaffold.cjs` (Step 3). Rationale: both scripts accept user-supplied slug and slash-delimited path operands and both must reject traversal / absolute-path / malformed input before touching disk. The canonical prior-art reference is `skills/do/scripts/task-abandon.cjs` L42-56; this module generalises that pattern into a reusable helper so the two new scripts stay DRY and consistent.

Exports:
- **`validateSlug(slug)`** — rejects (throws structured error): empty string, slug containing `/`, slug containing `..`, slug starting with `.`, slug starting with `-`, slug containing any path separator, slug not matching `/^[a-z0-9][a-z0-9-]*$/` (lower-case alphanumeric + hyphen, must start with alphanumeric). Returns normalised slug on success.
- **`validatePrefixedSlug(slug)`** — as above but requires the `NN-` prefix: `/^\d{2}-[a-z0-9][a-z0-9-]*$/`. Rejects single-digit prefixes (`1-foo`), empty body (`01-`), upper-case body (`01-FOO`), unprefixed (`foo`).
- **`validateNodePath(nodeType, path)`** — validates slash-delimited tuples. Splits on `/`. Enforces arity per `nodeType`:
  - `project`: 1 segment, validated with `validateSlug` (unprefixed — project slugs don't carry `NN-`).
  - `phase`: 1 segment, validated with `validatePrefixedSlug`.
  - `wave`: 2 segments (`<NN-phase>/<NN-wave>`), both validated with `validatePrefixedSlug`.
  Any empty segment (e.g. `foo//bar`) rejected. Any segment containing `..` rejected.

All validators throw a structured error object `{error: "invalidSlug" | "invalidPath", reason: <string>, value: <string>}` on failure. Callers catch and convert to exit-non-zero + stderr JSON. No I/O, no imports beyond Node builtins — pure validation.

**Tests** (`skills/do/scripts/__tests__/validate-slug.test.cjs`, new):
- `validateSlug`: empty (`''` → fail), `..` (fail), `../foo` (fail), `/foo` (fail), `foo/bar` (fail), `.hidden` (fail), `-leading-dash` (fail), `UPPER-CASE` (fail — regex forbids), `valid-slug` (pass), `abc123` (pass), `a` (pass).
- `validatePrefixedSlug`: `01-foo` (pass), `99-abc-def` (pass), `1-foo` (fail — single digit), `01-` (fail — empty body), `01-FOO` (fail — upper case), `foo` (fail — no prefix), `01--foo` (fail — body starts with hyphen), `abc-foo` (fail — non-numeric prefix).
- `validateNodePath`: `validateNodePath('project', 'my-proj')` pass; `validateNodePath('phase', '01-discovery')` pass; `validateNodePath('wave', '01-discovery/02-intake')` pass; wrong arity (`validateNodePath('phase', '01-a/02-b')` fail; `validateNodePath('wave', '01-a')` fail); bad segments (`validateNodePath('wave', '01-a/../etc')` fail; `validateNodePath('wave', '01-a//02-b')` fail — empty segment); absolute (`validateNodePath('project', '/abs')` fail).

### Step 3 — Implement `project-scaffold.cjs`
**File:** `skills/do/scripts/project-scaffold.cjs` (new)

**Slug input validation (applies to every op below).** Every op validates its slug inputs via the shared `skills/do/scripts/lib/validate-slug.cjs` library (Step 2b) BEFORE any `mkdirSync` or `fs.writeFileSync`. For the `project` and `phase` ops, `project_slug` / `phase_slug` / `wave_slug` are user-supplied UNPREFIXED slugs (scaffold allocates the `NN-` prefix itself — see prefix allocation below); validation uses `validateSlug`, NOT `validatePrefixedSlug`, for those operands. The derived prefixed folder name (e.g. `01-<phase_slug>`) is script-built, not user-supplied, and is trusted by construction. For the `wave` op, the parent `phase_slug` operand is PREFIXED (it identifies an existing phase folder — see wave-op signature note below) and uses `validatePrefixedSlug`; the new `wave_slug` is unprefixed (script allocates) and uses `validateSlug`. Rejection exits non-zero with structured stderr JSON `{error: "invalidSlug", reason, value}` and produces zero side effects.

**Prefixed vs unprefixed input across ops (explicit distinction).** The `phase` op takes UNPREFIXED input (the prefix is allocated by the script — the phase folder does not yet exist). The `wave` op takes PREFIXED parent-phase input (it must identify an existing phase folder at `phases/<prefixed_phase_slug>/`). The canonical `NN-<slug>` form is the form used everywhere else in the contract — frontmatter `phase_slug`, `active_phase`, state-ops `path` arg at §14 L841-844 — so the scaffold's `wave` op consuming it keeps the interface consistent. A user-friendly lookup layer that accepts bare `discovery` and resolves to `01-discovery` is β's responsibility (β's `/do:project wave new <phase-slug> <wave-slug>` subcommand handler may accept either form and resolve via `fs.readdirSync` of the phases directory); the raw `project-scaffold.cjs` script accepts the canonical prefixed form ONLY. Rationale: a bare unprefixed `discovery` is ambiguous if the user scaffolded both `01-discovery` and `02-discovery-followup`; the canonical form is unambiguous by construction.

Ops (quoted from §14 L847):
- `project <project_slug>` — creates `.do/projects/<slug>/` with `project.md`, empty `intake/`, empty `phases/`, empty `changelog.md`. **Also ensures `.do/projects/completed/` and `.do/projects/archived/` exist** (mkdir-p semantics via `fs.mkdirSync(..., {recursive: true})` — no-op if already present). Justification: orchestrator §2's folder-shape enumeration is `.do/projects/{,completed/,archived/}`, and the folder-move ops added to `project-state.cjs` (Patch A / Patch B) require these destinations to exist on first use. Guaranteeing them at project-scaffold time closes the ordering hole.
- `phase <project_slug> <phase_slug>` — creates `.do/projects/<slug>/phases/<NN>-<phase_slug>/` with `phase.md` and empty `waves/`. Input `phase_slug` is UNPREFIXED (prefix allocated by script).
- `wave <project_slug> <prefixed_phase_slug> <wave_slug>` — creates `.do/projects/<slug>/phases/<prefixed_phase_slug>/waves/<NN>-<wave_slug>/` with `wave.md`. Input `prefixed_phase_slug` is the FULL `NN-<slug>` form (e.g. `01-discovery`) and must identify an existing phase folder; input `wave_slug` is UNPREFIXED (prefix allocated by script). Validator wiring: `phase_slug` arg → `validatePrefixedSlug`; `wave_slug` arg → `validateSlug`.
  - **Parent-phase-not-found failure mode:** if `phases/<prefixed_phase_slug>/` does not exist on disk after slug validation passes, the op exits non-zero with structured stderr JSON `{error: "parentPhaseNotFound", project_slug, phase_slug}` and produces zero side effects (no `mkdirSync`, no `writeFileSync`, no parent-index update, no changelog append).

**CREATE-vs-transition distinction (Concern 1):** scaffold writes frontmatter DIRECTLY for newly-created files; it does NOT go through `project-state.cjs`. Rationale: `project-state.cjs` owns *transitions* (status mutations on existing files); scaffold owns *creates* (initial frontmatter write). The initial status of a new node is always `planning` (or `intake` at project level) — this is not a transition, it's a birth. Per §14 L850: "Default frontmatter on new node: `status: planning`, `scope: in_scope`, `pre_abandon_status: null`, `project_schema_version: 1`, plus all node-type-specific required fields." Scaffold fills these in.

Prefix allocation (§14 L848): scan parent container (`phases/` for phases; `waves/` within a phase folder for waves); parse leading `NN-` from each child folder name; allocate `max+1` zero-padded to 2 digits. First child = `01-`. Implementation: `fs.readdirSync(parentDir)`, regex-match `^(\d{2})-`, `Math.max(...matches, 0) + 1`, `.padStart(2, '0')`.

Parent-index atomic update (§14 L849): on `phase`, read `project.md`, parse frontmatter via gray-matter, append `{slug: <NN-phase_slug>, status: planning}` to `phases[]`, re-serialize, temp-file + rename. On `wave`, same pattern on `phase.md` `waves[]`. Parent file's `updated` timestamp bumped to current ISO.

Default frontmatter per node type — fills every field from §2 schemas:
- **project.md:** `project_schema_version: 1`, `slug`, `id: <slug>`, `title`, `created` (ISO), `updated` (ISO), `kind: greenfield` (default; can be overridden by caller), `status: intake` (initial project state per §3 L322 "Additional project-level leading status: `intake`"), `active_phase: null`, `pre_abandon_status: null`, `database_entry: null`, `tech_stack: []`, `repo_path: null`, `confidence: {score: null, factors: {context: null, scope: null, complexity: null, familiarity: null}}`, `council_review_ran: {project_plan: false, phase_plans: {}, code: {}}`, `phases: []`.
- **phase.md:** `project_schema_version: 1`, `project_slug`, `phase_slug`, `title`, `created`, `updated`, `status: planning`, `scope: in_scope`, `active_wave: null`, `pre_abandon_status: null`, `backlog_item: null`, `council_review_ran: {plan: false}`, `confidence: {score: null, factors: {context: null, scope: null, complexity: null, familiarity: null}}`, `waves: []`, `entry_context: [{path: "project.md"}, {path: "phase.md"}]` (prior-phase handoff added later by scaffold when non-first phase), `exit_summary: null`.
- **wave.md:** `project_schema_version: 1`, `project_slug`, `phase_slug`, `wave_slug`, `title`, `created`, `updated`, `status: planning`, `scope: in_scope`, `pre_abandon_status: null`, `backlog_item: null`, `parent_project`, `parent_phase`, `stage: refinement`, `stages: {refinement: pending, grilling: pending, execution: pending, verification: pending, abandoned: false}`, `council_review_ran: {plan: false, code: false}`, `confidence: {score: null, factors: {context: null, scope: null, complexity: null, familiarity: null}}`, handoff-harvest fields (`modified_files: []`, `unresolved_concerns: []`, `discovered_followups: []`, `wave_summary: null`).

**Confidence defaults are `null` sentinels, not numeric.** All three node types scaffold with `confidence.score: null` and all four `confidence.factors.*: null`. The structure (the keys) is always present — only the values are `null`. This matches task-template.md's precedent: the planner fills `confidence` in during the plan phase, not at creation. Scaffold-time is pre-planning, so "not yet measured" (`null`) is the truthful default; writing `0.0` would be misleading (it would imply a scored-and-zero result).

Body sections filled from the corresponding template file (project-master-template.md, phase-template.md, wave-template.md) — scaffold reads the template, strips the template's frontmatter, concatenates its own generated frontmatter + the template body.

Changelog append (Concern 2): per §14 L851, scaffold appends `<ISO-timestamp> scaffold:<op>:<full-path-slug>` to `.do/projects/<project_slug>/changelog.md`. Note the deliberate `scaffold:` prefix distinguishes create events from state-transition events (the latter use the `<ISO>  <node-type>:<slug>  <old> -> <new>  reason:<reason>` format per §3). Both formats coexist in the same changelog file; the `scaffold:` prefix is how readers tell them apart. The format is canonical; both project-state.cjs and project-scaffold.cjs append consistently using their respective formats.

Atomicity: every frontmatter write uses temp-file + rename (same pattern as project-state.cjs). Per §14 L852: "If any step fails mid-op, the caller (β's subcommand handler) is responsible for rollback — β wraps every `project-scaffold.cjs` invocation in a try/catch and re-raises on error. The script does NOT silently swallow errors." Scaffold surfaces errors by exit code + stderr JSON.

**Tests** (`skills/do/scripts/__tests__/project-scaffold.test.cjs`, new):
- Prefix allocation: new phase in empty `phases/` = `01-`; after 01-foo, new phase = `02-`; skipped-number case (01- + 03- existing) = `04-` (max+1, not gap-fill — per §14 L848 "max(existing prefixes) + 1").
- Default frontmatter: every field from §2 schema is present with the specified default value.
- Parent-index update: after `phase foo bar`, `foo/project.md` frontmatter `phases[]` contains a new entry with the allocated prefixed slug.
- Changelog: after scaffold ops, `.do/projects/<slug>/changelog.md` contains the `<ISO> scaffold:<op>:<full-path-slug>` line.
- Atomicity: simulated mid-op failure (inject by making the target dir read-only after first write) leaves no partial state behind; caller sees a non-zero exit.
- **Confidence shape:** scaffolded `project.md`, `phase.md`, `wave.md` each carry the FULL confidence frontmatter — `confidence.score === null` and all four `confidence.factors.*` keys present with `null` values. Assert the nested structure is NOT omitted (i.e. `frontmatter.confidence.factors` is an object with four known keys, not `undefined`).
- **Slug rejection (at least 4 cases):** `scaffold project ../evil` exits non-zero with `invalidSlug`; `scaffold phase my-proj /abs-path` rejected; `scaffold wave my-proj '' somewave` (empty segment) rejected; `scaffold phase my-proj .hidden` rejected; `scaffold project FOO` rejected if regex forbids upper case. The `wave` op's parent-phase slug is validated with `validatePrefixedSlug`: `scaffold wave my-proj discovery mywave` (unprefixed) is rejected with `invalidSlug`; `scaffold wave my-proj 1-discovery mywave` (single-digit prefix) rejected. Every rejection must produce NO on-disk side effects (no new dirs, no new files — fixture tree byte-identical before/after).
- **Parent-phase-not-found rejection (wave op):** `scaffold wave my-proj 99-nonexistent mywave` against a fixture tree where `phases/99-nonexistent/` does NOT exist exits non-zero with stderr JSON `{error: "parentPhaseNotFound", project_slug: "my-proj", phase_slug: "99-nonexistent"}`. Assert zero side effects: no new `waves/` dir, no `wave.md` write, no parent-index update on any `phase.md`, no changelog append — fixture tree byte-identical before/after.

### Step 4 — Extend `project-health.cjs` (additive only)
**File:** `skills/do/scripts/project-health.cjs` (modify)

Preserve the existing function body verbatim through L191 (task-pipeline checks stay intact). Add new checks AFTER the existing `active_task` block (L164-191), BEFORE the `healthy` computation (L193-194).

**Config-schema validation additions (mirror existing patterns — §14 L854-857):**
- `active_project` — same shape as `active_task` at L164-170: `if (config.active_project !== null && config.active_project !== undefined)` → type-check `string`, else `invalidField` error. Missing (undefined) → `missingField` warning. Also the path-traversal guard from L173-179 applies: if contains `..` or is absolute → `invalidField` error.
- `project_intake_threshold` — mirror `auto_grill_threshold` at L149-156 EXACTLY: undefined → `missingField` warning; non-number → `invalidField` error; out-of-range 0..1 → `invalidField` warning.
- `council_reviews.project` — nested check inside the existing `else` branch that already validates `council_reviews` (L117-147). After the existing `reviewer` check (L140-146), add: if `config.council_reviews.project === undefined` → `missingField` warning; else if non-object or null → `invalidField` error; else loop over `['plan', 'phase_plan', 'wave_plan', 'code']` — each, if present, must be boolean (non-boolean → `invalidField` error). Absence of individual sub-keys is acceptable. This loop uses the same shape as the existing `planning`/`execution` loop at L121-136.

**Project-folder checks (§13 + §14 L853) — 12 new issue types:**
Add a new block after the config-schema additions that walks `.do/projects/` if it exists:

1. **`orphanedActiveProject`** (error) — `config.active_project` is a non-null string but `.do/projects/<active_project>/` does not exist.
2. **`activeProjectNoActivePhase`** (warning) — active project's `project.md` has `status: in_progress` AND `active_phase: null` AND **at least one in-scope phase is NOT `completed`** (this is the critical in-scope-incomplete gate per §13 "Explicit non-issue" paragraph L822: the warning fires only when un-completed in-scope phases remain; the post-terminal-pre-complete state is silent). This distinction is the single check consumed by four call sites (§7, §7.5, §12, §13) — implement it once as a helper `isTerminalPreComplete(projectFrontmatter)` and reuse.
3. **`orphanedActivePhase`** (error) — `project.md` `active_phase` is non-null but the folder `phases/<active_phase>/` does not exist.
4. **`orphanedActiveWave`** (error) — `phase.md` `active_wave` is non-null but `waves/<active_wave>/` does not exist.
5. **`orphanProjectFolder`** (warning) — a folder under `.do/projects/` (excluding `completed/` and `archived/`) that is not `<active_project>` — stale scaffold.
6. **`phaseStatusDrift`** (warning) — `project.md` `phases[].status` disagrees with the corresponding `phase.md` frontmatter `status`.
7. **`waveStatusDrift`** (warning) — `phase.md` `waves[].status` disagrees with `wave.md` frontmatter `status`.
8. **`schemaVersionMismatch`** (error) — any file's `project_schema_version` ≠ 1.
9. **`invalidScopeValue`** (error) — any phase.md or wave.md `scope` field value is not `in_scope` / `out_of_scope`.
10. **`illegalScopeTransition`** (error) — any node has `status: in_progress` AND `scope: out_of_scope` (forbidden per §3).
11. **`missingHandoffFields`** (warning) — a `completed` wave is missing any of `modified_files` / `unresolved_concerns` / `discovered_followups` arrays (even empty) OR has null `wave_summary`.
12. **`illegalPhaseTransition`** (error) — a phase has `status: completed` but has in-scope waves that are not `completed`.

All 12 checks push onto the same `issues[]` array under the same JSON return shape — no structural change to the return. The `healthy: !hasErrors` computation at L194 is unchanged.

**Confidence is not consulted.** The existing schema-version, scope-value, and illegal-transition checks do NOT read `confidence.score` or any `confidence.factors.*`. `null` sentinels at scaffold time produce no false-positive issues — no new issue type is needed for "unscored confidence". Confidence is planner-metadata; health-check is state-integrity only.

**Tests** (extend `skills/do/scripts/__tests__/project-health.test.cjs` if it exists; else create it alongside existing tests). At least one integration test per new issue type with a crafted fixture tree under `mkdtempSync`. Also a regression test confirming the existing task-pipeline issue types still fire on the existing fixtures (no regression).

### Step 5 — Author the seven templates
**Files** (all new, under `skills/do/references/`):
- `project-master-template.md` — master `project.md` template with §2 frontmatter + §2 body sections (`## Vision`, `## Target Users`, `## Non-Goals`, `## Success Criteria`, `## Constraints`, `## Risks`, `## Phase Plan`, `## Changelog Pointer`).
- `phase-template.md` — `phase.md` template with §2 frontmatter + §2 body sections (`## Goal`, `## Entry Criteria`, `## Exit Criteria`, `## Wave Plan`, `## Concerns`, `## Review Notes`, `## Exit Summary`).
- `wave-template.md` — `wave.md` template with §2 frontmatter + §2 body sections (`## Problem Statement`, `## Approach`, `## Concerns`, `## Execution Log`, `## Verification Results`, `## Review Notes`, `## Council Review`).
- `handoff-template.md` — `handoff.md` template with §2 body sections (`## What Shipped`, `## What Remains`, `## Open Decisions`, `## Files of Record`, `## Next Phase Entry Prompt` — conditional, with `## Project Completion Hint` alternative).
- `changelog-template.md` — minimal template: header + empty append area; both the `<ISO> <node-type>:<slug> <old> -> <new> reason:<reason>` state-transition line and the `<ISO> scaffold:<op>:<full-path-slug>` scaffold line are documented at the top as legal entry formats.
- `intake-transcript-template.md` — template for `.do/projects/<slug>/intake/session-<timestamp>.md`: headers for each Pass-1 + Pass-2 question from §4, plus a free-form notes section.
- `completion-summary-template.md` — template consumed by β's `stage-project-complete.md` per §12 step 3: sections `## Completed Phases`, `## Deferred (Out-of-Scope)`, `## Success Criteria Status`, `## Final File Set`, `## Residual Open Decisions`.

Templates use placeholder syntax consistent with existing `task-template.md` (`{{FIELD}}` style).

### Step 6 — Extend `config-template.json`
**File:** `skills/do/references/config-template.json` (modify)

Add four new keys to the existing 20-line JSON, placed logically (project keys grouped):
```json
"active_project": null,
"project_intake_threshold": 0.85,
"council_reviews": {
  ...existing planning/execution/reviewer...,
  "project": {
    "plan": true,
    "phase_plan": true,
    "wave_plan": true,
    "code": true
  }
}
```
Default `project_intake_threshold: 0.85` per §4 L383. Default `council_reviews.project.*: true` to match the existing `planning`/`execution` defaults.

### Step 7 — Extend `task-template.md` with `related: []`
**File:** `skills/do/references/task-template.md` (modify)

Per §14 L860: "add a `related: []` frontmatter field so children can carry `related: [\"260418-do-project-orchestrator\"]`. No other edits to the template." Insert only the `related: []` field in the frontmatter block near `id` / `created` / `description`. The field addition is the only edit — no comment, no prose explanation; §14 L860 says "No other edits" and that is binding. The placement near `id`/`created`/`description` is positioning, not content. Align with the value already present on this very task file (frontmatter line 7-8): `related: - 260418-do-project-orchestrator`.

### Step 8 — Extend `init-health-check.md` Project Issues table
**File:** `skills/do/references/init-health-check.md` (modify)

Append 12 new rows to the existing `### Project Issues` table at L123-133, one per issue type from Step 4. Each row: `| <type> | <severity> | <fix suggestion> |`. Suggested fixes (human-readable):
- `orphanedActiveProject` (error) — Clear `active_project` or restore the project folder.
- `activeProjectNoActivePhase` (warning) — Run `/do:project phase new <slug>` or re-activate a phase.
- `orphanedActivePhase` (error) — Clear `active_phase` in project.md or restore the phase folder.
- `orphanedActiveWave` (error) — Clear `active_wave` in phase.md or restore the wave folder.
- `orphanProjectFolder` (warning) — Move folder to `.do/projects/completed/` or `.do/projects/archived/`, or set `active_project`.
- `phaseStatusDrift` (warning) — Manually reconcile: update `project.md` `phases[].status` to match `phase.md` frontmatter `status`, OR update `phase.md` `status` to match the `project.md` entry — whichever reflects intent. α ships no automated drift-sync tool; `project-state.cjs status <slug>` is read-only (see Step 2) and will NOT correct drift.
- `waveStatusDrift` (warning) — Same pattern at wave level: manually reconcile `phase.md` `waves[].status` with `wave.md` frontmatter `status` — whichever reflects intent.
- `schemaVersionMismatch` (error) — Run schema migration (v1 only, so this issue should not occur until v2 lands).
- `invalidScopeValue` (error) — Set `scope` to `in_scope` or `out_of_scope`.
- `illegalScopeTransition` (error) — Set `status: blocked` or `abandoned` before setting `scope: out_of_scope`.
- `missingHandoffFields` (warning) — Ensure completed waves have `modified_files[]`, `unresolved_concerns[]`, `discovered_followups[]`, and `wave_summary` populated.
- `illegalPhaseTransition` (error) — Complete all in-scope waves before marking phase completed, or mark remaining waves `out_of_scope`.

Existing table rows (L127-132) stay verbatim.

**Note on drift reconciliation.** α ships no automated drift-reconciliation command. `project-state.cjs status` is read-only; no `sync` op exists. β or a later phase may add `/do:project sync` or an equivalent reconciliation command. Until then, fixes for `phaseStatusDrift` and `waveStatusDrift` are manual edits to the affected frontmatter blocks.

### Step 9 — Optional: `init.md` Quick-Reference additive note
**File:** `skills/do/init.md` (modify if natural insertion point exists; per §14 L863 "leaving `init.md` untouched ... is acceptable" if no natural insertion exists)

Inspect `init.md` at implementation time. If it has a `## Quick Reference` block that lists recognised `.do/` artefacts, append a line noting `.do/projects/` is a valid project-time artefact. Extend `## Files` (if it exists) to mention that `project-health.cjs` now also covers project-folder integrity (the script file itself is unchanged — same path — so no new `## Files` entry, just a note if natural).

If neither section exists or the insertion would be forced / awkward, SKIP this step per the iteration-9 reality check. The `init-health-check.md` extension (Step 8) is sufficient — the health-check output already routes through `init.md` step 3 via the existing call path. Document the skip decision in the task's Execution Log.

---

### Dependency order (implementation sequence)
1. Step 1 (state-machine doc) — authors the spec
2. Step 2 (project-state.cjs) — implements the spec + tests
3. Step 3 (project-scaffold.cjs) — writes default frontmatter + tests
4. Step 4 (project-health.cjs) — extends health with new checks + tests
5. Step 5 (seven templates) — consumed by scaffold in Step 3 (circular; templates drafted alongside Step 3 but finalized here — Step 3's test fixtures use stub templates, Step 5 replaces them with the final files)
6. Step 6 (config-template.json)
7. Step 7 (task-template.md)
8. Step 8 (init-health-check.md)
9. Step 9 (init.md — conditional)

The templates-vs-scaffold circularity is resolved by drafting minimal stub templates inline during Step 3 development (just enough for scaffold to concatenate body sections onto) and replacing them with the finalized Step 5 templates before test-harness runs. Step 3's tests assert on frontmatter fields, not body content, so the stub/final swap is test-transparent.

### Testing strategy summary
- Harness: `node --test skills/do/scripts/__tests__/*.test.cjs` (existing, per package.json L12).
- Isolation: every test creates a fresh `mkdtempSync` fixture tree; no shared state.
- Coverage minimum: every legal + illegal transition in `project-state.cjs` (Concern 4: estimated ~30 test cases across status + scope + completion-rule + cascade); full round-trip abandon → restore test; prefix-allocation tests for `project-scaffold.cjs` (empty parent, first child, sequential, gap-in-sequence); at least one integration test per each of the 12 new health-check issue types + one regression test confirming existing task-pipeline checks still fire.

## Concerns

1. **`project-scaffold.cjs` writes frontmatter directly, not via `project-state.cjs` (resolved in plan).** Scaffold's initial write is a CREATE, not a status transition — `project-state.cjs` owns only transitions. This is the natural split and matches §14 L850's description ("Default frontmatter on new node: ..."). No shared-write surface. *Mitigation:* the interpretation is documented in Step 3's plan text; integration test confirms a scaffolded node is then legally transitionable via `project-state.cjs set` with no state-machine violation.

2. **Dual changelog-append formats (resolved in plan).** §3 L348-350 specifies `<ISO>  <node-type>:<slug>  <old> -> <new>  reason: <reason>` for state transitions; §14 L851 specifies `<ISO-timestamp> scaffold:<op>:<full-path-slug>` for scaffold events. Both formats coexist in the same `changelog.md`. The `scaffold:` prefix is the discriminator. *Mitigation:* `changelog-template.md` (Step 5) documents both formats at the top of the file so human readers and future tooling know both are canonical.

3. **Doc/script coupling: inline const is runtime truth; the doc is the human spec; a test locks them equal.** `project-state-machine.md` is the **human-authoritative specification** of legal status + scope transitions (section (d) enumerates both sub-tables). The **inline const transition table in `project-state.cjs`** is the **runtime source of truth** — every `set` / `abandon` call consults this const; **runtime never parses markdown**. To prevent silent drift, a dedicated **drift-detection test** (in `project-state.test.cjs`) parses `project-state-machine.md` once at test time (simple regex over the transitions-table rows in section (d)), builds a set of `(from, to, node_type)` tuples for status and `(from, to, node_type)` tuples for scope, and asserts **set equality** with the code table (every doc entry is in the const, every const entry is in the doc). Divergence fails the test. *Mitigation summary:* doc = human spec; const = machine truth; test = guarantee they match. A comment at the top of the const in `project-state.cjs` names `project-state-machine.md` as its authoritative origin and names the drift test as its lock.

4. **Test-harness convention confirmed.** `package.json` L12 uses `node --test skills/do/scripts/__tests__/*.test.cjs`. Existing test files (`task-abandon.test.cjs`, `optimise-target.test.cjs`, etc.) use `mkdtempSync` + `node:test` describe/it. α's new tests follow this convention verbatim. No new test framework, no additional tooling.

5. **`init.md` Step 9 may be skippable (iteration-9 reality check).** Per §14 L863, leaving `init.md` untouched is explicitly acceptable if no natural insertion exists. *Mitigation:* Step 9 is marked conditional; the skip-with-explanation path is pre-approved by the design file and documented in the plan. The Execution Log records the decision either way.

6. **Abandon cascade is per-node-atomic, not transaction-atomic across the cascade.** Each node's frontmatter write is atomic (temp-file + rename), but a multi-node cascade can be interrupted mid-way (e.g., power loss between node 3 and node 4 of a 10-node abandon). *Mitigation:* the op is idempotent — on re-invoke, nodes already carrying `pre_abandon_status` are skipped (they already have their pre-abandon status recorded). Re-running `abandon` picks up where it left off. Same property for `restore-from-abandoned`: nodes with `pre_abandon_status: null` are skipped (already restored). Document this in `project-state-machine.md` section (f) so users understand re-invocation is safe.

7. **Changelog append atomicity.** Append via `fs.appendFileSync` is atomic for small writes but not transactional with the frontmatter rename. If frontmatter write succeeds but changelog append fails, the state machine stays consistent but the audit trail is incomplete. *Mitigation:* changelog append happens AFTER the frontmatter rename (state is authoritative even if log is lossy). Document this ordering invariant in `project-state.cjs` module docblock.

8. **Gray-matter dependency.** `project-state.cjs` and `project-scaffold.cjs` rely on `gray-matter` for YAML frontmatter parsing — already a dependency (`package.json` L15). *Mitigation:* reuse existing import pattern from `task-abandon.cjs` L20-26 (with fallback comment).

9. **Completion-summary template is owned by α but consumed by β.** Per §14 L858 + §1 L135, α ships `completion-summary-template.md` even though nothing in α itself renders it. This is the "shared template" pattern — α's artefacts outlast α's code landing. *Mitigation:* Step 5 notes the ownership split explicitly; the template file itself includes a comment at the top pointing to β's `stage-project-complete.md` as the consumer.

10. **Prefix allocation uses `max+1`, not gap-fill.** Per §14 L848: "numeric prefix `NN-` derived from `max(existing prefixes) + 1`". If the user deletes `02-foo` leaving `01-a` and `03-b`, the next allocation is `04-`, not `02-`. *Mitigation:* plain `max+1` semantics match the spec verbatim; Step 3 test includes the gap-in-sequence case to lock this behaviour.

11. **Schema version migration is deferred (v2 concern, not v1).** `schemaVersionMismatch` check fires only when `project_schema_version ≠ 1`. v1 emits 1 everywhere; the check is dormant until v2. *Mitigation:* no v1 work required; the check is authored as a placeholder and will activate when v2's migration tooling lands.

12. **No stage-project-complete.md means completion-summary-template.md is "dead weight" until β ships.** α's template file sits idle. *Mitigation:* expected per §14 L865 ("A human can hand-scaffold a project folder with just these artefacts"); the template is hand-usable as a starting point for a manual completion summary even before β automates it.

13. **Shared slug / path validator lives in its own lib file (α-owned leaf).** Both `project-state.cjs` and `project-scaffold.cjs` accept user-supplied slug / slash-delimited path operands and must reject traversal / absolute-path / malformed input before touching disk. Rather than duplicate the guard inline in two scripts (drift risk), α ships a shared leaf helper at `skills/do/scripts/lib/validate-slug.cjs` with three pure functions (`validateSlug`, `validatePrefixedSlug`, `validateNodePath`) and a dedicated test file. The canonical prior-art reference is `skills/do/scripts/task-abandon.cjs` L42-56 (rejects `..` segments and absolute paths before touching disk) — the new lib generalises that pattern. *Mitigation:* the lib is a leaf dependency (no imports beyond Node builtins, consumed by both state and scaffold scripts), so it does not alter the Step 5 dependency ordering — it slots in as a zeroth layer before Step 2 and Step 3. The dedicated `validate-slug.test.cjs` locks the regex rules; Step 2 and Step 3 test files add at-least-4 rejection cases each to prove the guard is wired up at every entry point. Document the prior-art link in a comment at the top of `validate-slug.cjs`.

## Review Iterations

### Iteration 2 — 2026-04-18
Addressed self-review (A, B) and council (C, D, E, F) findings. Patches applied:

- **A — Folder-move ops on project-state.cjs (self-review #1):** Step 2's `abandon project` op now moves `.do/projects/<slug>/` → `.do/projects/archived/<slug>/` after frontmatter writes (with `archiveDestinationExists` collision guard); `set project <slug> status=completed` moves to `completed/<slug>/` (same guard shape); `restore-from-abandoned <slug>` moves `archived/<slug>/` → `<slug>/` BEFORE frontmatter writes. Cascade-abandon for phase/wave does NOT move folders. AC #3 updated to assert the folder round-trip (`archived/<slug>/` → `<slug>/`) alongside the frontmatter round-trip.
- **B — `active_project: null` clearing ownership (self-review #2):** project-state.cjs now owns clearing. `abandon project <slug>` and `set project <slug> status=completed` both clear `config.active_project` to `null` (atomic temp-file + rename on `.do/config.json`) when the slug matches, AFTER the folder move. `restore-from-abandoned` does NOT auto-re-activate (caller's decision per §12 L795). Added test case covering all four scenarios.
- **C — Completed/archived directory creation (council #1):** Step 3's `project <slug>` op now also ensures `.do/projects/completed/` and `.do/projects/archived/` exist (mkdir-p). Closes the ordering hole for Patch A's destination folders.
- **D — Scope-mutation write path (council #2):** Step 2's `set` op signature now accepts `status=X` or `scope=X` (parsed from third positional). Scope on project is rejected with `illegalTarget`. Transition validation uses the scope sub-table. Added a paragraph noting the const table now carries two sub-tables, and added scope-set test cases (legal + illegal + project-reject).
- **E — Remove Step 7 comment (council #3):** Step 7 no longer says "Add a comment explaining purpose" — the field addition is the only edit, per §14 L860 "No other edits". Placement guidance (near id/created/description) is kept as positioning.
- **F — Replace runtime markdown-parse with code table + test (council #4):** Concern 3 rewritten: inline const in `project-state.cjs` is the runtime source of truth; doc is human-authoritative spec; drift-detection test parses doc at test time and asserts set equality with the const. Step 2's transition-validation paragraph updated to drop any wording implying runtime markdown parsing.

Confidence unchanged at 0.90 — revisions sharpen existing scope but do not add novel unknowns; folder-move ops use the same atomic rename pattern already in scope, and the new const/doc test is a routine addition.

### Iteration 3 — 2026-04-18
Addressed council findings G (confidence null-sentinels) and H (slug/path validator + shared lib). Patches applied:

- **G — Concrete default frontmatter for `confidence` (null-sentinel decision):** Adopted the null-sentinel option (rationale: confidence is planner-assigned post-context-load; numeric defaults would be misleading; matches task-template.md precedent). Alternative considered: numeric default (e.g. `0.0`) — rejected because it conflates "scored zero" with "unscored". Patches: Step 1 adds a "Confidence field semantics" subsection specifying `<0..1>`-when-set + `null`-when-scaffolded + no consumer gates on `null`. Step 3's default-frontmatter enumeration now writes the full `confidence: {score: null, factors: {context: null, scope: null, complexity: null, familiarity: null}}` shape verbatim for phase.md and wave.md (previously `{...}` placeholder); project.md already carried this shape. Step 3 gains an explicit "Confidence defaults are `null` sentinels, not numeric" paragraph. Step 4 gains a "Confidence is not consulted" paragraph confirming health-check does not gate on `null` scores (no new issue type needed). Step 2 gains a matching "Confidence is not consulted" note on transition validation. AC #1 updated to assert the full confidence shape is present with `null` sentinels (not omitted). Step 3 test suite gains an explicit "Confidence shape" test asserting the nested structure is present with `null` values.
- **H — Slug / path input validation (shared lib):** Added new **Step 2b** for a shared validator library at `skills/do/scripts/lib/validate-slug.cjs` (new α-owned leaf), exporting `validateSlug` / `validatePrefixedSlug` / `validateNodePath` pure functions; canonical prior-art reference is `skills/do/scripts/task-abandon.cjs` L42-56. Added a new dedicated test file `skills/do/scripts/__tests__/validate-slug.test.cjs` covering all three validators with both pass and fail cases. Step 2's public-op block gains a "Slug / path input validation" paragraph: every op validates its slug/path operand via the shared lib BEFORE any filesystem call; rejection exits non-zero with structured stderr JSON + zero side effects. Step 3's ops block gains a matching "Slug input validation" paragraph; the clarifying note that user-supplied phase/wave slugs are unprefixed (NN- is script-allocated, so validator is `validateSlug` not `validatePrefixedSlug`). Step 2 and Step 3 test suites each gain at-least-4 rejection cases (`..`, absolute path, empty segment, malformed prefix, upper-case if regex forbids) with byte-identical-fixture assertions. AC #2 and AC #4 updated to note slug/path validation at all entry points. New **Concern 13** documents the validator split, names the prior-art reference, and notes the lib is a leaf dep (does not alter Step 5 dependency ordering).

Confidence held at 0.90 — both patches are specificity sharpenings, not scope expansions (confidence null-sentinels codify an already-implicit convention; the shared validator generalises an existing in-repo guard pattern).

### Iteration 4 — 2026-04-18
Addressed council findings I (scaffold wave takes prefixed phase_slug; phase op unchanged with unprefixed; zero-match and non-existent-parent failure modes locked) and J (drift fix text corrected — manual reconcile only; automated sync deferred to β or later). Patches applied:

- **I — Unprefixed → prefixed slug resolution for scaffold `wave` and `phase` ops:** Step 3's `wave` op signature updated to `wave <project_slug> <prefixed_phase_slug> <wave_slug>` — the parent-phase operand is the canonical `NN-<slug>` form (matches frontmatter `phase_slug`, `active_phase`, and state-ops `path` arg at §14 L841-844). Rationale: avoids zero/multiple-match ambiguity when multiple phases share a base slug (e.g. `01-discovery` and `02-discovery-followup`); keeps the raw script interface consistent with the canonical form used everywhere else in the contract. β (not α) owns any user-friendly lookup layer — β's `/do:project wave new` subcommand handler may accept either form and resolve via `fs.readdirSync`, but `project-scaffold.cjs` accepts the prefixed form ONLY. The `phase` op remains unchanged: it CREATES the phase, so no parent-phase lookup is needed; unprefixed `phase_slug` is the correct input (prefix allocated by script). Step 3's prose now makes this distinction explicit ("Prefixed vs unprefixed input across ops"). Validator wiring: `wave`'s `phase_slug` arg → `validatePrefixedSlug` (already exported by Step 2b, no new validator needed); `wave`'s `wave_slug` arg → `validateSlug`. Added failure mode: if `phases/<prefixed_phase_slug>/` does not exist on disk, scaffold exits non-zero with `{error: "parentPhaseNotFound", project_slug, phase_slug}` and produces zero side effects. Added rejection tests to `project-scaffold.test.cjs`: wave with unprefixed parent slug rejected with `invalidSlug`; wave with non-existent prefixed parent exits non-zero with `parentPhaseNotFound` and byte-identical fixture tree. Open question noted in prose: β's subcommand handler may accept unprefixed `phase_slug` for `wave new` and resolve to prefixed via `fs.readdirSync` — but that lookup layer is β's responsibility, not α's.
- **J — Drift fix-text correction for `phaseStatusDrift` / `waveStatusDrift`:** Step 8's table rows corrected. Previous text ("Re-run `project-state.cjs status <slug>` to sync, or manually reconcile") was wrong because `status` is explicitly read-only (Step 2 L134-135) and cannot sync. New text instructs manual reconciliation: update `project.md` `phases[].status` to match `phase.md` frontmatter `status`, OR update `phase.md` `status` to match the `project.md` entry — whichever reflects intent. Same pattern for `waveStatusDrift` at wave level. Added explicit note at end of Step 8's table: "α ships no automated drift-reconciliation command. β or a later phase may add `/do:project sync` or equivalent. Until then, drift fixes are manual edits." Doc-text correction only; no scope expansion.

Confidence held at 0.90 — both patches are doc-text corrections / interface clarifications, not scope expansions. Patch I uses an already-exported validator (`validatePrefixedSlug` from Step 2b) and adds a single on-disk existence check; Patch J is pure fix-text correction.

### Iteration 4 inline patch — 2026-04-18
Council iter-4 verdict: LOOKS_GOOD with one documentation nitpick — Step 2 L114 used unprefixed example paths (`phase1`, `phase1/wave2`) while `validateNodePath()` and the rest of the plan require canonical prefixed forms (`01-<slug>`). Applied as inline edit (no planner re-spawn): updated the example to `01-discovery` / `01-discovery/02-intake`. No semantic change.

## Execution Log

### 2026-04-18 18:30 - Execution started
**Status:** In progress
**Steps:** 0/9 complete
**Branch:** feat/do-project-alpha-contract

### 2026-04-18 18:35 - Steps 1-3 complete
**Files:**
- `skills/do/references/project-state-machine.md` - New, authoritative state-machine spec with sections (a)-(h)
- `skills/do/scripts/lib/validate-slug.cjs` - New shared validator library (Step 2b)
- `skills/do/scripts/__tests__/validate-slug.test.cjs` - 35 tests, all passing
- `skills/do/scripts/project-state.cjs` - New, implements state machine; exports all ops
- `skills/do/scripts/__tests__/project-state.test.cjs` - 59 tests, all passing
- `skills/do/scripts/project-scaffold.cjs` - New, scaffold ops with prefix allocation and parent-index update
- `skills/do/references/project-master-template.md` - Final template (not stub — gray-matter handles nested YAML)
- `skills/do/references/phase-template.md` - Final template
- `skills/do/references/wave-template.md` - Final template
- `skills/do/scripts/__tests__/project-scaffold.test.cjs` - 36 tests, all passing

**Decisions:**
- gray-matter not installed → ran npm install; all tests pass with gray-matter
- `atomicAppendToIndex` in scaffold uses gray-matter round-trip for nested YAML correctness
- Templates created as final versions immediately (no separate stub/final swap needed)

**Status:** Steps 1-3 complete (130 tests passing)

### 2026-04-18 19:00 - Steps 4-9 complete
**Files:**
- `skills/do/scripts/project-health.cjs` - Extended with council_reviews.project + active_project + project_intake_threshold validation + 12 project-folder issue types + isTerminalPreComplete helper
- `skills/do/scripts/__tests__/project-health.test.cjs` - New, 35 tests (regression + 3 config-schema + 12 issue types), all passing
- `skills/do/references/handoff-template.md` - New
- `skills/do/references/changelog-template.md` - New
- `skills/do/references/intake-transcript-template.md` - New
- `skills/do/references/completion-summary-template.md` - New
- `skills/do/references/config-template.json` - Extended with active_project, project_intake_threshold, council_reviews.project
- `skills/do/references/task-template.md` - Added `related: []` field (Step 7)
- `skills/do/references/init-health-check.md` - Extended Project Issues table with 12 new issue types + drift reconciliation note
- `skills/do/init.md` - Added `.do/projects/` note under "Project creates:" (Step 9 — natural insertion point found)
- `.do/projects/completed/` - Created directory
- `.do/projects/archived/` - Created directory

**Decisions:**
- Step 9 (init.md): natural insertion point FOUND in "Project creates:" block; added one-line note per plan
- Pre-existing council-invoke.test.cjs failures (2 tests) confirmed pre-existing on main; not introduced by this task
- `parseFrontmatterSimple` added to project-health.cjs (no gray-matter dependency in health check — avoids circular dep risk)

**Status:** All 9 steps complete. 325/327 tests passing (2 pre-existing failures in council-invoke.test.cjs unrelated to this task)

## Council Review

## Verification Results

### Approach Checklist
- [x] Step 1 — `skills/do/references/project-state-machine.md` authored with sections (a)-(h)
- [x] Step 2b — `skills/do/scripts/lib/validate-slug.cjs` shared validator library (validateSlug / validatePrefixedSlug / validateNodePath)
- [x] Step 2 — `skills/do/scripts/project-state.cjs` (status / set / abandon / restore-from-abandoned; folder moves; active_project clearing; scope mutations)
- [x] Step 3 — `skills/do/scripts/project-scaffold.cjs` (project / phase / wave ops; NN- prefix allocation; atomic parent-index update; confidence null sentinels)
- [x] Step 4 — `skills/do/scripts/project-health.cjs` extended (12 new issue types + config-schema additions for active_project / project_intake_threshold / council_reviews.project)
- [x] Step 5 — Seven templates authored (project-master, phase, wave, handoff, changelog, intake-transcript, completion-summary)
- [x] Step 6 — `skills/do/references/config-template.json` extended (active_project, project_intake_threshold, council_reviews.project)
- [x] Step 7 — `skills/do/references/task-template.md` `related: []` field added
- [x] Step 8 — `skills/do/references/init-health-check.md` Project Issues table extended with 12 new rows + drift reconciliation note
- [x] Step 9 — `skills/do/init.md` additive note added under "Project creates:" (natural insertion point found)
- [x] `.do/projects/completed/` and `.do/projects/archived/` directories created
- [x] Test files: validate-slug.test.cjs (35 tests), project-state.test.cjs (59+ tests), project-scaffold.test.cjs (36+ tests), project-health.test.cjs (35 tests)

### Quality Checks
- **Tests:** PASS (npm test) — 388/390 pass; 2 pre-existing failures in council-invoke.test.cjs exist on main and are unrelated to this task (introduced before this branch)
- **Lint:** No lint script configured in package.json — skipped
- **Types:** No typecheck script configured in package.json — skipped

### UAT — Hand-scaffold Path
Verified manually via `node skills/do/scripts/project-scaffold.cjs` in a clean `/tmp/do-uat-test` fixture:

- [x] `project my-test-proj` creates folder tree: `project.md`, `changelog.md`, `phases/`, `completed/`, `archived/`
- [x] `project.md` has correct frontmatter: `project_schema_version: 1`, `status: intake`, `confidence: {score: null, factors: {context: null, scope: null, complexity: null, familiarity: null}}`
- [x] `phase my-test-proj discovery` allocates `01-discovery`; `phase my-test-proj implementation` allocates `02-implementation` (NN- prefix allocation correct)
- [x] `project.md` `phases[]` array updated atomically after each phase scaffold
- [x] `wave my-test-proj 01-discovery intake` allocates `01-intake`; `wave my-test-proj 01-discovery analysis` allocates `02-analysis`
- [x] `phase.md` and `wave.md` carry full confidence null-sentinel shape and all required frontmatter fields
- [x] `changelog.md` receives `scaffold:project:`, `scaffold:phase:`, `scaffold:wave:` entries with ISO timestamps
- [x] `project-state.cjs status my-test-proj` returns correct JSON tree (project + 2 phases + 2 waves)
- [x] `set project my-test-proj status=planning` (intake→planning) succeeds; `set project my-test-proj status=in_progress` (planning→in_progress) succeeds
- [x] `abandon project my-test-proj` cascades to all in-scope descendants, moves folder to `archived/`, returns structured JSON
- [x] `restore-from-abandoned my-test-proj` moves folder back from `archived/`, restores all statuses, clears pre_abandon_status
- [x] Invalid slug `../evil` and upper-case `FOO-PROJECT` both rejected with structured stderr JSON, exit non-zero, zero side effects

### Result: PASS
- Checklist: 12/12 complete
- Quality: 388/390 tests passing (2 pre-existing failures on main, unrelated)
- UAT: all paths verified

## Code Review Iterations

### Iteration 1 — 2026-04-18

**Issues addressed:** 7 blockers (correctness, AC violations, dead code paths)

#### Issue 1 — Pre-flight ordering bug in `opSet` and `opAbandon`
**Fix applied:** `skills/do/scripts/project-state.cjs`
- `opSet`: moved `completedDestinationExists` collision check BEFORE `updateFrontmatterField`. Used `completedProjectDir`/`completedDestDir` variables captured in pre-flight, passed to post-write block. No write occurs if destination exists.
- `opAbandon`: moved `archiveDestinationExists` collision check BEFORE `abandonNode` cascade calls. Guard now runs before any frontmatter writes.
- CLI `set` handler: was also duplicating the bug; replaced with delegation to `opSet` (see Issue 5 fix), eliminating the inline re-implementation entirely.

#### Issue 2 — Missing tests: folder-move on project completion
**Fix applied:** `skills/do/scripts/__tests__/project-state.test.cjs`
- Added describe `folder-move on project completion (Issue 2)` with 3 tests:
  - `set project status=completed` moves folder to `completed/`
  - Collision: `completedDestinationExists` exits non-zero AND source project.md NOT mutated (byte-identical assertion)
  - Completing project clears `active_project` when slug matches
- Added describe `archive collision pre-flight in opAbandon (Issue 2)` with 1 test:
  - `archiveDestinationExists` exits non-zero AND source project.md NOT mutated (byte-identical assertion)

#### Issue 3 — Drift-detection test must be set-equality
**Fix applied:** `skills/do/scripts/__tests__/project-state.test.cjs`
- Replaced spot-check-only drift tests with full set-equality approach:
  - `parseDocTransitions()` helper reads `project-state-machine.md` at test time, regex-extracts "Yes" rows from §(d) status transition tables (per node type) and scope transition table.
  - Builds `Set<"nodeType:from:to">` from doc and from `STATUS_TRANSITIONS` const.
  - 4 new set-equality tests: `doc ⊇ code` AND `code ⊇ doc` for both STATUS_TRANSITIONS and SCOPE_TRANSITIONS.
- All original spot-check tests kept as supplementary.

#### Issue 4 — Parent-status guard doc/code mismatch
**Fix applied:** `skills/do/references/project-state-machine.md`
- Phase `planning → in_progress` row: removed "Parent project must be `in_progress`" text. Replaced with note: "Phase `scope` must be `in_scope`. Note: parent-project-status activation guard is enforced by β's activation flow, not by `project-state.cjs` directly."
- Wave `planning → in_progress` row: same treatment — removed "Parent phase must be `in_progress`" text. Replaced with note pointing to β's activation flow.

#### Issue 5 + 7 — CLI `set` duplicates `opSet` logic / `opSet` broken for phase/wave
**Fix applied:** `skills/do/scripts/project-state.cjs`
- Added `resolveNodeFilePath(projectsDir, nodeType, segments, projectSlug)` helper — unified path resolver that does NOT throw for non-project nodes (requires `projectSlug` for phase/wave context).
- Extended `opSet` signature: added optional 7th param `projectSlug` for phase/wave resolution.
- `opSet` now uses `resolveNodeFilePath` for all node types — no more `resolveNodePath` throw.
- CLI `set` handler: completely replaced inline re-implementation with a call to `opSet`. Logic reduced to: validate args, resolve `projectSlug` (from `--project` flag or `active_project` config), call `opSet`.
- Exported `opSet` and `resolveNodeFilePath` from `module.exports`.
- Added 9 new integration tests in `project-state.test.cjs`:
  - 3 legal status transitions (project/phase/wave via `opSet`)
  - 3 illegal status transitions (exit non-zero with `illegalTransition`)
  - 2 legal scope transitions (phase and wave via `opSet`)
  - 1 illegal scope on project (`illegalTarget`)

#### Issue 6 — Scaffold templates resolve to wrong directory
**Fix applied:** `skills/do/scripts/project-scaffold.cjs`
- `getReferencesDir()`: changed `path.resolve(__dirname, '..', '..', 'references')` → `path.resolve(__dirname, '..', 'references')`. Correct path is `skills/do/references/` (one up from `scripts/`), not `skills/references/`.
- `readTemplateBody()`: changed from silent `return ''` on missing file to `throw { error: 'templateNotFound', path }`. Templates are bundled with the skill; a missing template is an installation error.
- Exported `readTemplateBody` and `getReferencesDir` for testing.
- Added 5 new tests in `project-scaffold.test.cjs`:
  - `project.md` contains `## Vision`
  - `phase.md` contains `## Goal`
  - `wave.md` contains `## Problem Statement`
  - `getReferencesDir` resolves to path where `project-master-template.md` exists
  - `readTemplateBody` throws `{error: "templateNotFound"}` when template is missing

**Test results after iteration 1:**
- Total tests: 349 (was 327)
- New tests added: 22
- Pass: 347
- Fail: 2 (pre-existing `council-invoke.test.cjs` failures — unchanged)
- Files modified: 5
  - `skills/do/scripts/project-state.cjs`
  - `skills/do/scripts/__tests__/project-state.test.cjs`
  - `skills/do/scripts/project-scaffold.cjs`
  - `skills/do/scripts/__tests__/project-scaffold.test.cjs`
  - `skills/do/references/project-state-machine.md`

### Iteration 2 — 2026-04-18

**Issues addressed:** 4 blockers (Issue 1: opAbandon broken for phase/wave; Issue 2: scaffold CLI pre-validation side-effect; Issue 3: transition test coverage; Issue 4: identical to council's "Issue 2" labelling — see below)

Root pattern: iteration-1's fix for `opSet` (threading `projectSlug` + switching to `resolveNodeFilePath`) was NOT applied consistently to `opAbandon`, and the scaffold CLI had a pre-validation `mkdirSync` side-effect.

#### Issue 1 — `opAbandon` broken for phase/wave
**Fix applied:** `skills/do/scripts/project-state.cjs`
- Added optional `projectSlug` (6th) parameter to `opAbandon` signature — matching `opSet`'s L352 pattern.
- Replaced `resolveNodePath(projectsDir, nodeType, segments)` call (which threw an unstructured `Error` for non-project types) with `resolveNodeFilePath(projectsDir, nodeType, segments, effectiveProjectSlug)`. The `effectiveProjectSlug` is `segments[0]` for `project` nodeType, or the `projectSlug` parameter for `phase`/`wave`.
- Cleaned up the dead-code `phase` branch: removed the broken `const projectSlug = segments[0].split('/')[0]` shadow variable and the explanatory comments that described the problem; the branch now works correctly via `filePath` resolved at function entry.
- CLI `abandon` handler: completely replaced the inline re-implementation (duplicate `abandonNodeCli` function + phase/wave cascading logic) with a single delegation call to `opAbandon`. Same cleanup pattern as iteration-1 did for `set`.

**Tests added:** `skills/do/scripts/__tests__/project-state.test.cjs`
- `opAbandon phase: in_scope phase with 2 waves (1 in_scope, 1 out_of_scope) cascades correctly` — verifies cascade semantics and `abandoned` list.
- `opAbandon phase: phase frontmatter has status=abandoned and pre_abandon_status set`.
- `opAbandon wave: in_progress wave gets abandoned with pre_abandon_status recorded`.
- `opAbandon phase: nonexistent phase returns structured JSON error (fileNotFound), exits non-zero`.
- `opAbandon phase: missing projectSlug for phase throws structured missingArg error`.

#### Issue 2 — `project-scaffold.cjs` CLI creates `.do/projects/` before validating
**Fix applied:** `skills/do/scripts/project-scaffold.cjs`
- Removed the unconditional `fs.mkdirSync(doProjectsDir, { recursive: true })` call that ran before op parsing and slug validation.
- Added pre-validation in the CLI: for each op branch (`project`/`phase`/`wave`), slug arguments are now validated via `validateSlug`/`validatePrefixedSlug` BEFORE the op function is invoked. This is a belt-and-suspenders approach (the op functions also validate internally).
- `opProject` already creates `doProjectsDir` implicitly via its `completed/` and `archived/` mkdir calls (both use `recursive: true`). `opPhase` and `opWave` assume the project already exists, so they never need to create `doProjectsDir` from scratch.
- The comment block explains: "doProjectsDir is resolved here but NOT created eagerly."

**Tests added:** `skills/do/scripts/__tests__/project-scaffold.test.cjs`
- New describe `CLI: no filesystem side effects on invalid slug (Issue 2 iter-2)`:
  - `invalid project slug ../escape exits non-zero and .do/projects/ does NOT exist` — uses `spawnSync` to invoke CLI in a fresh `tempDir` where `.do/` doesn't exist. Asserts non-zero exit AND `!fs.existsSync(projectsDir)`.
  - `invalid project slug /absolute exits non-zero and .do/projects/ does NOT exist` — same but checks stderr structured JSON for `error: 'invalidSlug'`.

#### Issue 3 — Transition test coverage overstated
**Fix applied:** `skills/do/scripts/__tests__/project-state.test.cjs`
- Pre-existing "legal status transitions" tests used `updateFrontmatterField` directly (bypassing `opSet` validation). Pre-existing "illegal status transitions (table)" tests only checked `STATUS_TRANSITIONS` const. Pre-existing "scope transitions" tests only read `OUT_OF_SCOPE_ALLOWED_FROM`. None of these were removed (they remain as internal-helper tests).
- Added comprehensive `opSet`-backed suites:
  - `opSet: complete legal status transitions — project`: intake→planning, planning→abandoned, in_progress→blocked, in_progress→completed, in_progress→abandoned, blocked→in_progress, blocked→abandoned (7 tests).
  - `opSet: complete legal status transitions — phase`: planning→abandoned, in_progress→blocked, in_progress→completed, in_progress→abandoned, blocked→in_progress, blocked→abandoned (6 tests).
  - `opSet: complete legal status transitions — wave`: planning→abandoned, in_progress→blocked, in_progress→completed, in_progress→abandoned, blocked→in_progress, blocked→abandoned (6 tests).
  - `opSet: illegal status transitions via opSet — terminal and gap`: project completed→in_progress (table check), project abandoned→planning (table check), project planning→blocked, project in_progress→planning, phase planning→blocked, phase completed→in_progress, phase abandoned→planning, wave planning→blocked, wave completed→in_progress, wave abandoned→planning (10 tests).
  - `opSet: complete scope transitions via opSet`: phase in_scope→out_of_scope from blocked (legal), phase out_of_scope→in_scope (legal), wave out_of_scope→in_scope (legal), phase in_scope→out_of_scope from in_progress (illegal/illegalScopeTransition), wave in_scope→out_of_scope from in_progress (illegal/illegalScopeTransition) (5 tests).
- Coverage comment block added at top of new suite enumerates which prior `opSet` tests existed and which transitions each new test covers.

**Test results after iteration 2:**
- Total tests: 390 (was 349)
- New tests added: 41 (5 opAbandon phase/wave + 2 CLI side-effect + 34 transition coverage)
- Pass: 388
- Fail: 2 (same pre-existing `council-invoke.test.cjs` failures — unchanged)
- Files modified: 4
  - `skills/do/scripts/project-state.cjs` — opAbandon fix + CLI abandon handler delegation
  - `skills/do/scripts/__tests__/project-state.test.cjs` — 39 new tests
  - `skills/do/scripts/project-scaffold.cjs` — CLI pre-validation fix
  - `skills/do/scripts/__tests__/project-scaffold.test.cjs` — 2 new CLI tests
