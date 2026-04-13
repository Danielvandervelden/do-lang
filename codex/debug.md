---
name: do:debug
description: Structured debugging workflow using scientific method. Use when user says "debug", "investigate bug", or describes unexpected behavior.
argument-hint: "<description of the bug or unexpected behavior>"
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - AskUserQuestion
---

<objective>
Structured debugging workflow using scientific method: hypothesis -> test -> confirm/reject.
</objective>

<context>
$ARGUMENTS
</context>

<process>

## Step 1: Check for active debug session

```bash
node "$HOME/.codex/commands/do/scripts/debug-session.cjs" check
```

Parse JSON output. If active: true, display options:
- Continue: Resume this session
- Close: Mark as abandoned, start fresh
- Force new: Keep this session, start another

If stale: true, clear reference and proceed.

## Step 2: Create new debug session (if needed)

```bash
node "$HOME/.codex/commands/do/scripts/debug-session.cjs" create "$ARGUMENTS"
```

Update config.json: active_debug: <filename>

## Step 3: Load debug workflow

Follow ~/.codex/commands/do/references/stage-debug.md:
- New session: Start at Step D1 (Gathering)
- Resuming: Start at Step D0 (Resume Check)

## Reference

Templates: ~/.codex/commands/do/references/debug-template.md

</process>
