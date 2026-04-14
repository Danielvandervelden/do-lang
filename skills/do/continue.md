---
name: do:continue
description: "Resume work from where you left off. Use when returning to a task after a break, after /clear, after switching branches, or when the user says 'continue', 'pick up where we left off', 'what was I working on', 'resume'. Reloads context and shows current progress before proceeding."
argument-hint: "[--task <filename>]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

# /do:continue

Resume the active task from its current state. Reloads context, shows where you left off, and picks up the workflow.

## Why this exists

Tasks span multiple sessions. After a break, context switch, or `/clear`, you need to know where things stand before diving back in. This skill reloads the task state, summarizes progress, and routes to the right stage — so you're never guessing what was done or what's next.

## Usage

```
/do:continue                    # Resume active task
/do:continue --task <filename>  # Resume a specific (possibly abandoned) task
```

## What it does

1. **Finds the active task** — Reads from `.do/config.json`
2. **Reloads context** — Re-reads any docs referenced in the task file
3. **Shows progress** — Displays stage, last action, and any mid-execution state
4. **Routes to the right stage** — Grill, execute, or verify based on current state

## Stage Detection

**Step 1: Load active task**

Read `.do/config.json` to get `active_task`.
- No active task: "No active task. Run /do:task to create one."
- Stale pointer (file missing): Clear reference, show same message

**Step 2: Resume abandoned task** (with `--task` flag)

If the specified task has `stage: abandoned`:
1. Restore to `pre_abandon_stage`
2. Set as active task
3. Proceed with normal routing

**Step 3: Route by stage**

| Stage | Condition | Goes to |
|-------|-----------|---------|
| refinement | grilling in_progress or pending + low confidence | @references/stage-grill.md |
| refinement | grilling complete or high confidence | @references/stage-execute.md |
| execution | any | @references/stage-execute.md |
| verification | any | @references/stage-verify.md |
| abandoned | any | Prompt to use `--task` flag |

## Resume Behavior

Every `/do:continue` shows a summary before proceeding:

```
Resuming: <task-id> (stage: <stage>)
Last action: <summary>

Continue? (yes/no)
```

If referenced docs are missing, you can continue without them or stop to locate them.

For mid-execution resume, shows a progress checklist of completed vs remaining steps.

## Files

- **Resume logic:** @references/resume-preamble.md
- **Stage workflows:** @references/stage-grill.md, @references/stage-execute.md, @references/stage-verify.md
