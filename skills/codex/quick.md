---
name: do:quick
description: "Tightest execution tier for mid-conversation follow-ups where context is already warm and the change is 1-2 files of mechanical work. Orchestrator executes inline (no sub-agent spawn), runs available validation, then a single council reviewer checks the diff. One fix iteration allowed. If council requests changes twice, materializes a task file and escalates to /do:continue. Manual-only — never auto-recommended by the /do:task router."
argument-hint: '"brief description"'
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

# /do:quick

Tightest execution tier — orchestrator makes the change inline, council reviews the diff, done. No task file on the happy path.

## Why this exists

The execution-tier hierarchy was bimodal:
- **Inline edit** — zero review, fine for true trivia (typo, rename), risky for anything touching logic
- **`/do:fast`** — task file, sub-agent spawn, full single-reviewer code review; too ceremonious for small mid-conversation follow-ups where the main session already has all the context

The gap: small but non-obvious changes (the null check we just discussed, wiring a guard we sketched) deserve a second opinion but not a full agent pipeline. `/do:quick` fills that gap:

1. Orchestrator executes inline — the conversation IS the execution context
2. No task file on the happy path (lazy creation only on escalation)
3. Single council reviewer checks the diff — ~30s for a fresh perspective
4. One iteration allowed before escalation

**Known limitation:** No task file on the happy path means no `backlog_item` tracking. If a quick-path run closes a backlog item, invoke `/do:backlog done <id>` manually afterwards.

## Usage

```
/do:quick "brief description of the change"
```

**Examples:**

- `/do:quick "add the null-check we just discussed in parseToken"`
- `/do:quick "wire the permission guard on the Admin reducer we sketched"`
- `/do:quick "fix the off-by-one in the pagination helper"`

---

## Entry Criteria

**All four must be true.** These are documented criteria, not an interactive checkbox gate — if you are invoking `/do:quick` you are asserting they hold. If any criterion fails, use `/do:fast` instead.

1. **1-2 files** — the change touches at most 2 files
2. **Main session already has the context** — invoked mid-conversation after discussion, not as a cold-start ("the change we just discussed")
3. **No backend/API/schema/auth/state-machine changes** — same restriction as `/do:fast`
4. **Fix is mechanical once described** — no real planning surface; the change is obvious once stated

If you invoke `/do:quick` and any criterion fails mid-execution, stop and redirect to `/do:fast "description"`.

---

## Confirmation

Before executing, ask:

```
This looks like a quick-path task (1-2 files, mechanical, context already warm). Proceed? [Y/n]
```

If the user hesitates, expresses doubt, or says no — redirect to `/do:fast "<description>"` and stop.

---

## Step 1: Check Prerequisites

```bash
node ~/.codex/skills/do/scripts/check-database-entry.cjs --message
```

If fails, stop and report what's missing.

## Step 2: Check for Active Task

```bash
node ~/.codex/skills/do/scripts/task-abandon.cjs check --config .do/config.json
```

If active task exists, offer options:

- Continue it (`/do:continue`)
- Abandon it and start fresh
- Cancel

## Step 3: Read Model Config

```bash
node -e "
const c = require('./.do/config.json');
const models = c.models || { default: 'sonnet', overrides: {} };
console.log(JSON.stringify(models));
"
```

Store result for council spawning. Default to sonnet if not configured.

## Step 4: Quick Execution

@references/stage-quick-exec.md

---

## Files

- **Quick execution reference:** @references/stage-quick-exec.md
- **Task template (escalation only):** @references/task-template.md
- **Gate script:** @scripts/check-database-entry.cjs
- **Abandon script:** @scripts/task-abandon.cjs
