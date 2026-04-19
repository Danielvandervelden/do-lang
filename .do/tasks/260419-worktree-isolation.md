---
id: 260419-worktree-isolation
created: 2026-04-19T10:02:09.000Z
updated: '2026-04-19T10:52:18.501Z'
description: Delivery contract for do-executioner
related: []
stage: complete
stages:
  refinement: complete
  grilling: pending
  execution: complete
  verification: complete
  abandoned: false
council_review_ran:
  plan: true
  code: true
confidence:
  score: 0.8
  factors:
    context: 0
    scope: -0.1
    complexity: -0.1
    familiarity: 0
backlog_item: worktree-isolation
---

# Delivery contract for do-executioner

## Problem Statement

### The problem

The rules an executioner needs (branch name, commit prefix, push/PR stop points, never-commit-`.do/`) live in three different places today: `/jira:start` decides the branch, `AGENTS.md` has the stop-after-push rule, and `project.md` has the commit prefix list. These rules don't travel with the task file, so agents can't reliably follow them — especially if future isolation mechanisms (worktrees, etc.) are ever added.

### What we're building

#### 1. Delivery Contract in the task template

Add both frontmatter fields and a rendered `## Delivery Contract` markdown section to the task template:

**Frontmatter fields:**
```yaml
delivery:
  branch: "feat/LLDEV-851"
  commit_prefix: "feat"
  push_policy: "push"          # push | no-push
  pr_policy: "create"          # create | skip
  stop_after_push: true        # orchestrator stops after push, user reviews
  exclude_paths: [".do/"]      # paths the executioner must never stage/commit
```

**Markdown section:** rendered `## Delivery Contract` that the executioner reads as prose — same data, human-readable surface.

The executioner reads **only** the task file for these rules — not CLAUDE.md/AGENTS.md/project.md. A self-contained contract.

#### 2. Reference doc — `skills/do/references/delivery-contract.md`

Stable, documented interface spec that any entry command (like `/jira:start`) can target. Defines the exact schema: field names, types, allowed values, examples. External commands read this once and conform. If the schema changes, this doc is the single source of drift detection.

#### 3. Validator helper — `skills/do/scripts/validate-delivery-contract.cjs`

Any caller can invoke this before routing to `/do:task`. Returns `{ valid, errors[] }`. Entry commands call it to verify their args before handing off. `/do:task` itself runs the same validator on entry — non-conforming callers fail loudly rather than silently skipping the contract.

#### 4. Contract passing mechanism

Entry commands pass the contract via `$ARGUMENTS` as JSON: `/do:task --delivery='{"branch":"feat/LLDEV-851","commit_prefix":"feat","stop_after_push":true}' "description"`.

**Never infer.** If the contract isn't pre-passed, the onboarding flow (see below) handles it. No silent fallback derivation from git state.

#### 5. `/do:quick` doesn't need the contract

`/do:quick` is mid-conversation inline execution (no agent spawn). Only `/do:task` and `/do:fast` (which spawn executioner agents) get the contract.

#### 6. Project-scoped onboarding flow

Config flag in `.do/config.json`:
```json
{
  "delivery_contract": {
    "onboarded": false,
    "dismissed": false,
    "entry_commands": []
  }
}
```

**First cold-start invocation** (no contract passed, `onboarded: false`) triggers a one-time `AskUserQuestion` with three options:

1. **"Help me wire it up"** — ask which entry command file(s) the user has, read them, propose Edits to make them pass the contract (referencing `delivery-contract.md` and `validate-delivery-contract.cjs`). Wait for user confirmation before editing. Mark `onboarded: true`, store paths in `entry_commands[]`.

2. **"Give me a prompt"** — generate a self-contained prompt the user can paste into another Claude session. Includes: what the delivery contract is, what fields are required, where the reference doc and validator live, and how to wire their entry command to pass the contract. User takes it from there. Mark `onboarded: true`.

3. **"I'll handle it / don't care"** — mark `onboarded: true, dismissed: true`. Future cold-starts use project defaults from `project.md` silently. This is the only path where inference is allowed — because the user explicitly opted into it.

**Pre-passed invocations** (`$ARGUMENTS` includes `--delivery=...`): validate via `validate-delivery-contract.cjs` and proceed. Never touch the onboarding flag, never ask.

### Out of scope

- **Worktree isolation** — originally part of this task but descoped. do-lang is single-task (`active_task`), so worktrees add complexity without clear benefit today. The delivery contract is a prerequisite if worktrees are ever added later.
- **Changes to `/jira:start`** — the user will update their entry command after this ships, using the reference doc and validator we produce.
- **Workspace-level config** — this is project-scoped only (`.do/config.json`).

### Key design decisions (agreed)

| Decision | Rationale |
|----------|-----------|
| Task file is the delivery contract | Agent can't read stale global state; task file is self-contained and auditable |
| Both frontmatter + markdown section | Frontmatter for machine parsing (orchestrator scripts), markdown for agent consumption |
| Never infer branch/prefix silently | Prevents wrong branches; explicit opt-in via onboarding option 3 for users who don't care |
| `/jira:start` changes deferred | Clean separation — do-lang ships the interface, entry commands adopt it independently |
| Worktree isolation deferred | Single-task execution doesn't need it; delivery contract is the prerequisite |

## Clarifications

<!--
Populated by grill-me flow when confidence < threshold.
Format:

### <Factor> (was: <old_value> -> now: <new_value>)
**Q:** <question asked>
**A:** <user's answer>

If user overrides before reaching threshold:
"User override at confidence <score>"
-->

## Context Loaded

- `~/workspace/database/projects/do/project.md` — project overview, tech stack, agent pipeline, conventions, key directories
- `skills/do/references/task-template.md` — current task file template (delivery frontmatter + markdown section will be added here)
- `skills/do/references/wave-template.md` — current wave file template (same pattern applies)
- `skills/do/references/config-template.json` — config template that needs `delivery_contract` onboarding section
- `agents/do-executioner.md` — executioner agent definition (needs delivery contract awareness)
- `skills/do/task.md` — full-path orchestrator (needs `$ARGUMENTS` parsing for `--delivery=...` before Step 0)
- `skills/do/fast.md` — fast-path orchestrator (needs same `$ARGUMENTS` parsing)
- `skills/do/references/stage-fast-exec.md` — fast execution reference (needs to thread delivery fields into task file materialization)
- `skills/do/scripts/lib/validate-slug.cjs` — existing validator pattern (pure validation, no I/O, JSDoc, `module.exports`)
- `skills/do/scripts/__tests__/task-workflow-structural.test.cjs` — existing structural test pattern (file presence, content assertions, export checks)
- `skills/do/scripts/__tests__/task-abandon.test.cjs` — existing unit test pattern (temp dirs, gray-matter, beforeEach/afterEach cleanup)
- `skills/do/quick.md` — quick-path skill (confirmed: does NOT need the contract per Problem Statement section 5)

## Approach

### Step 1: Create reference doc — `skills/do/references/delivery-contract.md`

Stable interface specification that entry commands (like `/jira:start`) target. Contains:
- Schema definition: field names, types, allowed values, defaults
- `delivery.branch` (string, required) — target branch name
- `delivery.commit_prefix` (string, required) — one of the project's allowed commit prefixes
- `delivery.push_policy` (string, default `"push"`) — `push` | `no-push`
- `delivery.pr_policy` (string, default `"create"`) — `create` | `skip`
- `delivery.stop_after_push` (boolean, default `true`) — orchestrator stops after push, user reviews
- `delivery.exclude_paths` (string[], default `[".do/"]`) — paths the executioner must never stage/commit
- JSON example of the `--delivery='...'` argument format
- Rendered markdown `## Delivery Contract` section example (what agents see in task files)
- Validation rules (which fields are required, which have defaults, what constitutes invalid)

**File:** `skills/do/references/delivery-contract.md`
**Outcome:** Single source of truth for the delivery contract schema. Entry commands read this once to conform.

### Step 2: Create validator script — `skills/do/scripts/validate-delivery-contract.cjs`

Pure validation module following the `validate-slug.cjs` pattern (no I/O, JSDoc, `module.exports`). Exports:

- `validateDeliveryContract(obj)` — takes a parsed delivery object, returns `{ valid: boolean, errors: string[] }`. Validates:
  - `branch` is a non-empty string
  - `commit_prefix` is a non-empty string
  - `push_policy` is `"push"` or `"no-push"` (or absent — defaults applied by caller)
  - `pr_policy` is `"create"` or `"skip"` (or absent — defaults applied by caller)
  - `stop_after_push` is boolean (or absent)
  - `exclude_paths` is an array of strings (or absent)
  - No unknown keys (warn, don't reject — forward compatibility)
- `applyDefaults(obj)` — returns a new object with defaults merged for optional fields
- `parseDeliveryArg(argString)` — parses the `--delivery='...'` JSON string, returns `{ delivery: object } | { error: string }`

**File:** `skills/do/scripts/validate-delivery-contract.cjs`
**Outcome:** Any caller can validate before routing. Entry commands and `/do:task` both use the same validator.

### Step 3: Create validator tests — `skills/do/scripts/__tests__/validate-delivery-contract.test.cjs`

Unit tests following `task-abandon.test.cjs` pattern:

- Valid contract passes
- Missing required fields (`branch`, `commit_prefix`) produce errors
- Invalid enum values (`push_policy: "maybe"`) produce errors
- Defaults are applied correctly
- `parseDeliveryArg` handles valid JSON, malformed JSON, empty string
- Unknown keys produce warnings (not errors)

**File:** `skills/do/scripts/__tests__/validate-delivery-contract.test.cjs`
**Outcome:** Validator is fully tested before integration.

### Step 4: Update task template — `skills/do/references/task-template.md`

Add to the YAML frontmatter (after the `backlog_item` field, before the waves comment block):

```yaml
# Delivery contract (populated by entry commands or onboarding flow)
# delivery:
#   branch: null
#   commit_prefix: null
#   push_policy: "push"
#   pr_policy: "create"
#   stop_after_push: true
#   exclude_paths: [".do/"]
```

Add a new markdown section between `## Problem Statement` and `## Clarifications`:

```markdown
## Delivery Contract

<!--
Populated by entry commands (e.g., /jira:start) or the onboarding flow.
The executioner reads ONLY this section for branch, commit, and push rules.

If empty, the executioner follows project defaults from project.md
(only when the user explicitly dismissed the onboarding flow).
-->
```

**File:** `skills/do/references/task-template.md`
**Outcome:** Every new task file has a slot for delivery data.

### Step 5: Update wave template — `skills/do/references/wave-template.md`

Same pattern as Step 4: add commented-out `delivery:` frontmatter block and a `## Delivery Contract` markdown section. Waves inherit from the parent project's entry command, so the contract travels with each wave file too.

**File:** `skills/do/references/wave-template.md`
**Outcome:** Wave files also carry the delivery contract.

### Step 6: Update config template — `skills/do/references/config-template.json`

Add the `delivery_contract` onboarding section:

```json
{
  "delivery_contract": {
    "onboarded": false,
    "dismissed": false,
    "entry_commands": []
  }
}
```

**File:** `skills/do/references/config-template.json`
**Outcome:** New projects get the onboarding flag. Existing projects trigger onboarding on first cold-start.

### Step 7: Add `$ARGUMENTS` parsing for `--delivery=...` in `task.md`

Add a new section **before Step 0** (call it "Step -1: Parse Delivery Contract" or integrate as a preamble):

1. Check if `$ARGUMENTS` contains `--delivery='...'` or `--delivery="..."`.
2. If present: extract the JSON string, call `parseDeliveryArg()` from the validator, then `validateDeliveryContract()`. If invalid, stop with error message listing the validation failures.
3. Store valid delivery object as in-session variable `delivery_contract`.
4. Strip the `--delivery=...` flag from `$ARGUMENTS` so the remaining string is the clean description for Step 0's routing heuristic.
5. If `--delivery` is NOT present: check config for `delivery_contract.onboarded`. If `false`, run onboarding flow (Step 7b below). If `true` and `dismissed: true`, silently proceed with no contract (executioner uses project.md defaults). If `true` and `dismissed: false`, contract was previously wired — proceed without asking.

Thread `delivery_contract` into Step 4 (task file creation) so frontmatter `delivery:` fields and the `## Delivery Contract` markdown section are populated. Also thread into the fast-path branch that invokes `stage-fast-exec.md`.

**File:** `skills/do/task.md`
**Outcome:** `/do:task` parses, validates, and threads the delivery contract before any routing.

### Step 8: Add `$ARGUMENTS` parsing for `--delivery=...` in `fast.md`

Same parsing logic as Step 7, added before Step 1. Since `fast.md` delegates to `stage-fast-exec.md` for task file creation, pass `delivery_contract` as an additional in-session variable alongside `<description>` and `models`.

**File:** `skills/do/fast.md`
**Outcome:** `/do:fast` also supports the delivery contract.

### Step 9: Update `stage-fast-exec.md` for delivery contract threading

Update FE-1 (Create Task File) to:
1. Accept `delivery_contract` as an optional in-session variable from the caller
2. If present, populate the `delivery:` frontmatter fields and render the `## Delivery Contract` markdown section with the contract data
3. If absent, leave the delivery section empty (commented-out defaults in frontmatter, empty markdown section)

Update the caller contract preamble to document that `delivery_contract` may be passed.

**File:** `skills/do/references/stage-fast-exec.md`
**Outcome:** Fast-path task files carry the delivery contract when provided.

### Step 10: Update `do-executioner.md` for delivery contract awareness

Add to Step 1 (Load Execution Context) a new bullet:
- **Delivery Contract**: If `## Delivery Contract` section exists and is populated, read it. This is your authoritative source for branch name, commit prefix, push policy, and exclude paths. Do NOT read CLAUDE.md, AGENTS.md, or project.md for these rules — the task file is self-contained.

Add to Step 4 (Complete Execution) a new instruction after the frontmatter update:
- Before committing: verify you are on the branch specified in the Delivery Contract (if present). Use the commit prefix from the contract. Never stage paths in `exclude_paths`. If `stop_after_push` is true, push and then return control to the orchestrator (do not create a PR).

Add to the `<deviation_handling>` section a new blocking deviation trigger:
- **Branch mismatch**: If the current branch doesn't match `delivery.branch`, stop and report — do not auto-switch.

**File:** `agents/do-executioner.md`
**Outcome:** The executioner reads and follows the delivery contract from the task file.

### Step 11: Create onboarding flow instructions

Add a new reference file `skills/do/references/delivery-onboarding.md` that documents the three-option AskUserQuestion flow:

1. **"Help me wire it up"** — read user's entry command file(s), propose Edits to pass the contract. Reference `delivery-contract.md` and `validate-delivery-contract.cjs`. Wait for user confirmation before editing. Mark config `onboarded: true`, store paths in `entry_commands[]`.
2. **"Give me a prompt"** — generate a self-contained prompt the user can paste into another session. Includes schema, reference doc path, validator path, and wiring instructions. Mark `onboarded: true`.
3. **"I'll handle it / don't care"** — mark `onboarded: true, dismissed: true`. Future cold-starts use project defaults silently.

This reference is loaded by `task.md` and `fast.md` when `--delivery` is absent and `onboarded: false`.

**File:** `skills/do/references/delivery-onboarding.md`
**Outcome:** First-time users get guided onboarding; returning users are never bothered again.

### Step 12: Create structural tests — add delivery contract assertions to test suite

Add a new test file `skills/do/scripts/__tests__/delivery-contract-structural.test.cjs` following `task-workflow-structural.test.cjs` pattern:

- `delivery-contract.md` reference file exists and contains schema field definitions
- `validate-delivery-contract.cjs` exists and exports `validateDeliveryContract`, `applyDefaults`, `parseDeliveryArg`
- `task-template.md` contains `delivery:` frontmatter block (commented or uncommented) and `## Delivery Contract` markdown section
- `wave-template.md` contains same
- `config-template.json` contains `delivery_contract` key with `onboarded`, `dismissed`, `entry_commands`
- `do-executioner.md` contains `Delivery Contract` reference
- `task.md` contains `--delivery` parsing step
- `fast.md` contains `--delivery` parsing step
- `stage-fast-exec.md` contains `delivery_contract` in caller contract
- `delivery-onboarding.md` exists and contains the three options

**File:** `skills/do/scripts/__tests__/delivery-contract-structural.test.cjs`
**Outcome:** All integration points are verified by structural assertions. Drift between files is caught by tests.

## Concerns

1. **$ARGUMENTS parsing reliability**: Claude Code's `$ARGUMENTS` is raw text — the `--delivery='{"branch":"feat/..."}'` JSON may contain quotes that get mangled by shell expansion or markdown escaping. **Mitigation:** The `parseDeliveryArg()` function should be lenient: try `JSON.parse` first, then try with single quotes replaced, then report a clear error. The reference doc should specify that callers should use single-quoted JSON wrapping. Structural tests verify the parser handles common quoting variations.

2. **Onboarding flow complexity in a skill file**: The three-option AskUserQuestion flow with conditional file reading and Edit proposals is the most complex piece. If inlined into `task.md`, it bloats the skill with rarely-executed logic. **Mitigation:** Extract into `delivery-onboarding.md` reference file (Step 11) and load it only when needed. Keep `task.md` changes to a thin dispatch: check config flag, load reference if needed.

3. **Backward compatibility for existing task files**: Existing `.do/tasks/*.md` files don't have `delivery:` frontmatter or `## Delivery Contract` section. `/do:continue` may resume them. **Mitigation:** The executioner's new logic is conditional ("if Delivery Contract section exists AND is populated"). Existing task files without the section are treated as "no contract" — the executioner falls back to its current behavior. No migration needed.

4. **Config template vs existing configs**: Adding `delivery_contract` to `config-template.json` only affects new `do:init` runs. Existing projects won't have the key. **Mitigation:** The `$ARGUMENTS` parsing step checks for `delivery_contract.onboarded` with a falsy default — if the key doesn't exist, it's treated as `false`, triggering the onboarding flow. This is the correct behavior for existing projects upgrading.

5. **Wave template delivery inheritance**: The Problem Statement says task files get the contract, but waves are created by the project pipeline (`/do:project`), not by entry commands. Should wave files inherit from the task? **Mitigation:** Add the template slots (commented-out frontmatter + empty markdown section) to the wave template for structural completeness, but document that wave contract population is deferred to the project pipeline integration. The executioner's awareness works the same regardless of whether the target is a task or wave file.

6. **Reference doc as @reference lazy-load**: The `delivery-contract.md` and `delivery-onboarding.md` files live in `references/` and use the `@references/` loading pattern. They should only be loaded when needed (not on every task invocation). **Mitigation:** Use conditional loading in `task.md` — only `@references/delivery-onboarding.md` when onboarding is triggered; `delivery-contract.md` is a stable spec document that callers (not `/do:task` itself) reference.

## Execution Log

### 2026-04-19 13:00 - Execution started
**Status:** In progress
**Steps:** 0/12 complete

### 2026-04-19 13:02 - Step 1: Create reference doc delivery-contract.md
**Files:**
- `skills/do/references/delivery-contract.md` - New stable interface spec for delivery contract schema, validation rules, `--delivery=...` passing format, `## Delivery Contract` section example, and entry command integration checklist

**Decisions:**
- Included the agent-readable rendered markdown section example so entry commands know exactly what the task file will look like
- Included a full entry command integration checklist at the end as a one-stop reference for `/jira:start` and similar tools

**Status:** Complete

### 2026-04-19 13:04 - Step 2: Create validator script validate-delivery-contract.cjs
**Files:**
- `skills/do/scripts/validate-delivery-contract.cjs` - New pure validation module following validate-slug.cjs pattern. Exports `validateDeliveryContract`, `applyDefaults`, `parseDeliveryArg`

**Decisions:**
- Added `warnings` field alongside `errors` in the return value to support unknown-key forward-compatibility warnings without breaking callers
- Implemented three-attempt parse strategy in `parseDeliveryArg` (direct JSON, strip outer single-quotes, swap single-to-double quotes) to handle common shell quoting variations per Concern 1
- `applyDefaults` returns a new object (no mutation) and applies all four optional-field defaults

**Status:** Complete

### 2026-04-19 13:22 - Step 12: Create structural tests delivery-contract-structural.test.cjs
**Files:**
- `skills/do/scripts/__tests__/delivery-contract-structural.test.cjs` - 33 structural tests covering all 10 integration points: delivery-contract.md schema fields, validator exports, task-template.md sections, wave-template.md sections, config-template.json keys, do-executioner.md awareness, task.md --delivery step, fast.md --delivery step, stage-fast-exec.md caller contract, delivery-onboarding.md options

**Decisions:**
- All 33 tests pass (0 failures)
- Used `before()` guards (assert.ok file exists) rather than try/catch so missing files cause a clear test failure rather than a crash

**Status:** Complete

### 2026-04-19 13:23 - Execution complete
**Status:** Complete

**Summary:**
- Steps completed: 12/12
- Files modified: 10
- Deviations: 0 minor, 0 blocking

### 2026-04-19 13:20 - Step 11: Create onboarding flow reference delivery-onboarding.md
**Files:**
- `skills/do/references/delivery-onboarding.md` - New reference doc with three-option AskUserQuestion flow. Option 1: wire entry command (read files, propose edits, wait for confirmation, mark onboarded). Option 2: generate self-contained wiring prompt for another session. Option 3: dismiss (mark onboarded + dismissed, use project defaults silently forever)

**Decisions:**
- Included complete bash snippets for marking `onboarded: true` in all three options for copy-paste correctness
- Option 1 flow uses five sub-steps (OB-1 through OB-5) to handle the interactive back-and-forth without ambiguity
- The generated prompt for Option 2 is included verbatim so the agent doesn't have to compose it under pressure

**Status:** Complete

### 2026-04-19 13:18 - Step 10: Update do-executioner.md for delivery contract awareness
**Files:**
- `agents/do-executioner.md` - Added delivery contract bullet to Step 1 (Load Execution Context); added delivery contract enforcement block to Step 4 (Complete Execution) before task file update; added branch mismatch as a blocking deviation trigger in `<deviation_handling>`

**Decisions:**
- Placed delivery enforcement block before the "Update target file" instruction in Step 4 so it fires before writing the completion log entry
- Branch mismatch is blocking (not auto-fixed) per the spec: "do not auto-switch"

**Status:** Complete

### 2026-04-19 13:16 - Step 9: Update stage-fast-exec.md for delivery contract threading
**Files:**
- `skills/do/references/stage-fast-exec.md` - Updated caller contract preamble to document optional `delivery_contract` in-session variable; added delivery contract threading block in FE-1 before the Approach-section instruction

**Decisions:**
- Placed threading instruction before the "Critical: Write a minimal Approach section" line so it's handled at task file creation time, same as in task.md
- Used explicit rendered format matching task.md Step -1's format for consistency

**Status:** Complete

### 2026-04-19 13:15 - Step 8: Add --delivery parsing to fast.md
**Files:**
- `skills/do/fast.md` - Added "Step 0: Parse Delivery Contract" before Step 1. Same parsing logic as task.md Step -1, adapted for fast path. Documents that `delivery_contract` is passed to `stage-fast-exec.md`

**Decisions:**
- Used "Step 0" (not "Step -1") since fast.md's existing step numbering starts at 1, not 0 — this fits cleanly without renumbering

**Status:** Complete

### 2026-04-19 13:13 - Step 7: Add --delivery parsing to task.md
**Files:**
- `skills/do/task.md` - Added "Step -1: Parse Delivery Contract" before Step 0. Covers: `--delivery` present (parse → validate → applyDefaults → store as `delivery_contract` → strip from $ARGUMENTS), `--delivery` absent (config check → onboarding or silent proceed), and threading `delivery_contract` into task file creation (frontmatter + rendered markdown section)

**Decisions:**
- Used "Step -1" naming to avoid renumbering all existing steps (Step 0 through Step 12 stay unchanged)
- Added the three `onboarded`/`dismissed` case descriptions inline per the Problem Statement spec
- Included explicit rendered format for `## Delivery Contract` markdown section so Step 4 knows exactly what to write

**Status:** Complete

### 2026-04-19 13:11 - Step 6: Update config template
**Files:**
- `skills/do/references/config-template.json` - Added `delivery_contract` object with `onboarded: false`, `dismissed: false`, `entry_commands: []`

**Decisions:**
- Added after the `models` key as the last top-level entry (JSON trailing comma added to `models` closing brace)
- Kept `onboarded: false` as the default so new projects always trigger onboarding on first cold-start without `--delivery`

**Status:** Complete

### 2026-04-19 13:10 - Step 5: Update wave template
**Files:**
- `skills/do/references/wave-template.md` - Added commented-out `delivery:` frontmatter block after `wave_summary` field; added `## Delivery Contract` markdown section between `## Problem Statement` and `## Approach`

**Decisions:**
- Placed `## Delivery Contract` before `## Approach` in the wave template (wave template has no `## Clarifications` section, so closest equivalent position is before `## Approach`)
- Added note in comment: "Population of this section by the project pipeline is deferred" per Concern 5

**Status:** Complete

### 2026-04-19 13:08 - Step 4: Update task template
**Files:**
- `skills/do/references/task-template.md` - Added commented-out `delivery:` frontmatter block after `backlog_item` field; added `## Delivery Contract` markdown section between `## Problem Statement` and `## Clarifications`

**Decisions:**
- Kept delivery frontmatter as a comment block (not active YAML) since it requires population by entry commands, not at template instantiation time — consistent with other commented-out fields like `fast_path` and `quick_path`

**Status:** Complete

### 2026-04-19 13:06 - Step 3: Create validator unit tests
**Files:**
- `skills/do/scripts/__tests__/validate-delivery-contract.test.cjs` - 42 tests covering valid contracts, required-field errors, enum errors, type errors, unknown-key warnings, applyDefaults behavior, and parseDeliveryArg quoting variants

**Decisions:**
- Verified all 42 tests pass (0 failures) before proceeding to Step 4

**Status:** Complete

## Council Review

<!--
Populated by council review stages (E-1 for plan review, V-1 for code review).

### Plan Review
- **Reviewer:** <advisor name>
- **Verdict:** LOOKS_GOOD | CONCERNS | RETHINK
- **Findings:**
  - Finding with evidence citation
- **Recommendations:**
  - Actionable recommendation
- **User Override:** (only if user proceeded despite CONCERNS/RETHINK)

### Code Review
- **Reviewer:** <advisor name>
- **Verdict:** APPROVED | NITPICKS_ONLY | CHANGES_REQUESTED
- **Files Reviewed:** <count>
- **Findings:**
  - Finding with file:line citation
- **Recommendations:**
  - Actionable recommendation
- **User Override:** (only if user proceeded despite issues)

If council reviews are disabled in config, this section remains empty.
-->

## Verification Results

### Approach Checklist
- [x] Step 1: Create reference doc `skills/do/references/delivery-contract.md`
- [x] Step 2: Create validator script `skills/do/scripts/validate-delivery-contract.cjs`
- [x] Step 3: Create validator tests `skills/do/scripts/__tests__/validate-delivery-contract.test.cjs`
- [x] Step 4: Update task template — delivery frontmatter block + `## Delivery Contract` section
- [x] Step 5: Update wave template — delivery frontmatter block + `## Delivery Contract` section
- [x] Step 6: Update config template — `delivery_contract` onboarding object
- [x] Step 7: Add `--delivery` parsing in `skills/do/task.md` (Step -1)
- [x] Step 8: Add `--delivery` parsing in `skills/do/fast.md` (Step 0)
- [x] Step 9: Update `skills/do/references/stage-fast-exec.md` for delivery contract threading
- [x] Step 10: Update `agents/do-executioner.md` for delivery contract awareness
- [x] Step 11: Create onboarding flow reference `skills/do/references/delivery-onboarding.md`
- [x] Step 12: Create structural tests `skills/do/scripts/__tests__/delivery-contract-structural.test.cjs`

### Quality Checks
- **Tests:** PASS (npm test) — 617 tests, 0 failures

No lint or typecheck scripts in package.json.

### Result: PASS
- Checklist: 12/12 complete
- Quality: 1/1 passing
