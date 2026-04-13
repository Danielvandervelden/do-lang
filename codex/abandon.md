---
name: do:abandon
description: Mark the active task as abandoned and allow starting a new task. Use when user says "abandon task", "cancel task", or "start over".
argument-hint: ""
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
---

<objective>
Mark the active task as abandoned and allow starting a new task.
</objective>

<process>

## Step 1: Check for active task

```bash
node "$HOME/.codex/commands/do/scripts/task-abandon.cjs" check --config .do/config.json
```

Parse JSON output. If `active: false`, display: "No active task to abandon."

## Step 2: Validate and abandon

If active task exists:
```bash
node "$HOME/.codex/commands/do/scripts/task-abandon.cjs" abandon <file> --config .do/config.json
```

The script will:
- Store current stage in `pre_abandon_stage` for resume capability
- Set `stage: abandoned`
- Update the current stage in stages map to `abandoned`
- Set `stages.abandoned: true`
- Clear active_task in config

## Step 3: Confirm

Display: "Task abandoned: <filename>. You can now start a new task with /do:task."
Display: "To resume this task later: /do:continue --task <filename>"

</process>
