---
name: do:fast
description: "Lightweight fast path for low-risk, small-surface tasks (1-6 files for bounded mechanical shared-utility refactors, 1-3 files otherwise; no new shared abstractions, no schema/auth/API changes). Skips planning ceremony and full verification. Single code review round at the end. Use when the user explicitly says 'fast' or the task is low-risk and mechanical. Triggers on phrases like 'quick fix', 'small tweak', 'fast path', 'minor change', 'just update this'."
argument-hint: '"brief description"'
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

# /do:fast

Lightweight fast path for low-risk, small-surface tasks. Skips plan review, grilling, and verification ceremony. One code review round at the end.

## Why this exists

The full `/do:task` workflow (5-7 agent spawns + review rounds) is disproportionate for low-risk mechanical changes. `/do:fast` removes ceremony while keeping context scan, execution, validation, and single code review. Handles 1-6 files for bounded mechanical shared-utility refactors, 1-3 files otherwise.

## Usage

```
/do:fast "description of the small change to make"
```

---

## Entry Criteria

ALL of the following must be true for `/do:fast` to be valid:

1. Single repo, single concern
2. Small surface area: **1-3 files** for general fast-path tasks, OR **up to ~6 files** when all of the following hold for the mechanical shared-utility pattern:
   - The change is mechanical reuse of an *existing* shared utility/component (no new abstractions introduced)
   - The shared utility's contract (function signature, exported types, observable behavior) is not materially changing
   - The affected consumers are bounded (scope was known upfront and remains bounded)
   - Focused tests exist or can be added as part of this task
3. No *new* shared abstractions introduced (mechanical edits to *existing* shared utilities are allowed per criterion 2)
4. No backend/API contract changes
5. No schema, auth, permissions, or state-machine changes
6. No Jira workflow complexity beyond basic execution
7. No unclear business logic
8. No need for deep debugging

**Explicit exclusions (always redirect to `/do:task`):** new shared abstractions, broad shared behavior changes (changing the contract of an existing shared utility), generated/API fallout, unclear product behavior, large or exploratory refactors.

If any criterion fails, redirect to `/do:task`.

**Auto-escalation during execution:** If any criterion stops being true during execution, abandon and preserve the task. Triggers: (i) new shared abstractions are introduced, (ii) an existing shared utility's contract (signature, exported types, observable behavior) changes materially, (iii) consumer fallout becomes unbounded (more files than originally scoped), (iv) any other entry criterion stops being true. Mechanical edits to existing shared utilities with unchanged contracts do NOT trigger auto-escalation. Print:

> "Fast-path criteria no longer met: <reason>. The task has been abandoned and preserved at `.do/tasks/<filename>` for reference. Please run `/do:task "description"` to start fresh with the full workflow."
> Do NOT attempt to automatically hand off to `/do:task`.

**Note:** Auto-escalation does NOT trigger on mechanical edits to existing shared utilities when the contract is unchanged and consumers remain bounded — that is the intended use case of the broadened fast-path criteria above.

---

## Step 0: Parse Delivery Contract

Check if `$ARGUMENTS` contains `--delivery=...`.

### If `--delivery=...` is present

1. Extract the value: everything after `--delivery=` up to the next unquoted space (or end of string).
2. Call `parseDeliveryArg(value)` from `@scripts/validate-delivery-contract.cjs`. If it returns `{ error }`, stop with:
   ```
   Delivery contract parse error: <error>
   Fix the --delivery argument and retry. See skills/references/delivery-contract.md for the expected format.
   ```
3. Call `validateDeliveryContract(delivery)` from the same module. If `{ valid: false }`, stop with:
   ```
   Delivery contract validation failed:
   <errors, one per line>
   Fix the --delivery argument and retry.
   ```
4. Call `applyDefaults(delivery)` and store the result as in-session variable `delivery_contract`.
5. Strip the `--delivery=...` flag from `$ARGUMENTS` so the remaining string is the clean task description.

### If `--delivery=...` is absent

Read the project config:

```bash
node ~/.claude/commands/do/scripts/read-config.cjs delivery
```

- **`onboarded: false`**: Trigger the onboarding flow. Load `@references/delivery-onboarding.md` and follow its instructions.
- **`onboarded: true, dismissed: true`**: Set `delivery_contract = null`. Executioner uses project defaults.
- **`onboarded: true, dismissed: false`**: Set `delivery_contract = null`. Log warning: `"Warning: onboarded but --delivery not passed. Executioner will use project defaults."`.

Pass `delivery_contract` as an in-session variable to `@references/stage-fast-exec.md` alongside `<description>` and `models`.

---

## Step 1: Check Prerequisites

```bash
node ~/.claude/commands/do/scripts/check-database-entry.cjs --message
```

If fails, stop and report what's missing.

## Step 2: Check for Active Task

```bash
node ~/.claude/commands/do/scripts/task-abandon.cjs check --config .do/config.json
```

If active task exists, offer options:

- Continue it (`/do:continue`)
- Abandon it and start new
- Cancel

## Step 3: Validate Entry Criteria

The entry criteria are listed above — the task must meet all of them.

Ask the user:

```
This looks like a fast-path task. Proceed? [Y/n]
```

If user says no (or expresses doubt), redirect to `/do:task "description"` and stop.

## Step 3b: Read Model Config

```bash
node ~/.claude/commands/do/scripts/read-config.cjs models
```

Store result for agent spawning. Default to sonnet if not configured.

---

## Steps 4-11: Fast Execution

The reference file below handles task-file creation, quick context scan, do-executioner spawn, stage override, validation, single code review round, completion, and the `/skill-creator` reminder. See `@references/stage-fast-exec.md`.

@references/stage-fast-exec.md

---

## Files

- **Task template:** @references/task-template.md
- **Gate script:** @scripts/check-database-entry.cjs
- **Abandon script:** @scripts/task-abandon.cjs
- **Context loader:** @scripts/load-task-context.cjs
- **Fast execution reference:** @references/stage-fast-exec.md
