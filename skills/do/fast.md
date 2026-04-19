---
name: do:fast
description: "Lightweight fast path for low-risk, small-surface tasks (1-3 files, no shared abstractions, no schema/auth/API changes). Skips planning ceremony and full verification. Single code review round at the end. Use when the user explicitly says 'fast' or the task is clearly trivial. Triggers on phrases like 'quick fix', 'small tweak', 'fast path', 'minor change', 'just update this'."
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

The full `/do:task` workflow is optimized for correctness — 5-7 agent spawns plus multiple review rounds. For trivial changes (single-file fixes, small tweaks, obvious additions that touch 1-3 files), that overhead is disproportionate. `/do:fast` removes the ceremony while keeping just enough structure for session continuity and quality: quick context scan, execute, validate, single code review.

## Usage

```
/do:fast "description of the small change to make"
```

**Examples:**

- `/do:fast "fix the typo in the header component"`
- `/do:fast "add a missing null check in UserService.parseToken"`
- `/do:fast "update the button color in the theme config"`

---

## Entry Criteria

ALL of the following must be true for `/do:fast` to be valid:

1. Single repo, single concern
2. Small surface area (1-3 files)
3. No new shared abstractions or shared component changes
4. No backend/API contract changes
5. No schema, auth, permissions, or state-machine changes
6. No Jira workflow complexity beyond basic execution
7. No unclear business logic
8. No need for deep debugging

If any criterion fails, redirect to `/do:task`.

**Auto-escalation during execution:** If any criterion stops being true during execution (scope grows, shared abstractions get touched, schema changes needed), abandon and preserve the task. Print:

> "Fast-path criteria no longer met: <reason>. The task has been abandoned and preserved at `.do/tasks/<filename>` for reference. Please run `/do:task "description"` to start fresh with the full workflow."
> Do NOT attempt to automatically hand off to `/do:task`.

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
node -e "
const c = require('./.do/config.json');
const models = c.models || { default: 'sonnet', overrides: {} };
console.log(JSON.stringify(models));
"
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
