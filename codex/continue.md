---
name: do:continue
description: Resume the active task from its current state. Use when user says "continue", "resume task", or "pick up where I left off".
argument-hint: "[--task <filename>]"
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
Resume the active task from its current state. Routes to appropriate stage based on task frontmatter.
</objective>

<process>

## Step 1: Load active task

Read .do/config.json to get active_task.
If no active task, display: "No active task. Run /do:task to create one."

Check if task file exists at .do/tasks/<active_task>:
- If missing (stale pointer), clear reference and display message

## Step 2: Parse task state

Read task file and parse YAML frontmatter for:
- stage
- stages (map of stage statuses)
- confidence
- pre_abandon_stage (if resuming abandoned task)

Read auto_grill_threshold from config (default 0.9).

## Step 3: Route by stage

| Stage | Condition | Reference File |
|-------|-----------|----------------|
| refinement | stages.grilling: in_progress | stage-grill.md |
| refinement | stages.grilling: pending AND confidence < threshold | stage-grill.md |
| refinement | stages.grilling: complete OR confidence >= threshold | stage-execute.md |
| execution | any | stage-execute.md |
| verification | any | stage-verify.md |
| verified | any | stage-verify.md |
| abandoned | any | Display message with resume option |

For abandoned tasks with `--task <file>` flag:
1. Restore `stage` from `pre_abandon_stage` (or `refinement` if not set)
2. Set `stages.abandoned: false`
3. Set active_task in config
4. Route normally

## Step 4: Load stage reference

Based on routing, load and follow:
- ~/.codex/commands/do/references/stage-grill.md
- ~/.codex/commands/do/references/stage-execute.md
- ~/.codex/commands/do/references/stage-verify.md

All stage files start with Step R0 (Resume Check) from:
~/.codex/commands/do/references/resume-preamble.md

</process>
