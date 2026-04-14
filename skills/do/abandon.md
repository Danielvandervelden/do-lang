---
name: do:abandon
description: "Pause current work to start something else. Use when the user says 'never mind', 'let's work on something else', 'stop this task', 'I need to switch to...', or wants to drop what they're doing without losing progress. Preserves state so they can resume later with /do:continue --task."
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - AskUserQuestion
---

# /do:abandon

Pause the current task to work on something else. The task stays in `.do/tasks/` with its progress preserved — you can pick it back up anytime.

## Why this exists

Sometimes priorities shift mid-task. Rather than losing context or leaving the workspace in a confused state, abandoning cleanly marks where you stopped and clears the active task slot. This lets you start fresh work without the system thinking you're still mid-execution on the old task.

## Process

**Step 1: Check for active task**

```bash
node <skill-path>/scripts/task-abandon.cjs check --config .do/config.json
```

- If no active task (`active: false` without `stale`): "No active task to abandon."
- If stale reference (`active: false` with `stale`): "Cleared stale reference to missing task file."

**Step 2: Confirm and abandon**

Show what will be abandoned and ask for confirmation:

```
Active task: <file> (stage: <stage>)

Abandon this task? (yes/no)
```

If confirmed, run:

```bash
node <skill-path>/scripts/task-abandon.cjs abandon <file> --config .do/config.json
```

**Step 3: Confirm completion**

Display:
- "Task abandoned: `<file>`"
- "Previous stage (`<pre_abandon_stage>`) preserved."
- "To resume later: `/do:continue --task <file>`"
- "You can now start a new task with `/do:task`."

## Resuming later

Abandoned tasks aren't deleted. To pick one back up:

```
/do:continue --task <filename>
```

This restores the task to its previous stage and makes it active again.
