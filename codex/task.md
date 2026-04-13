---
name: do:task
description: Create and refine a task with flat agent hierarchy. Use when user says "start a task", "new task", "let me work on", or provides a task description.
argument-hint: "<task description>"
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
Create and refine a task with AI assistance. Follows the same workflow as Claude Code /do:task.
</objective>

<context>
$ARGUMENTS
</context>

<process>

## Step 1: Check prerequisites

Run database entry check:
```bash
node "$HOME/.codex/commands/do/scripts/check-database-entry.cjs" --message
```

If exit code is non-zero, display error and stop.

## Step 2: Check for active task

```bash
node "$HOME/.codex/commands/do/scripts/task-abandon.cjs" check --config .do/config.json
```

Parse JSON output. If `active: true`, display options:
- Continue existing task (/do:continue)
- Abandon and start new task
- Cancel

If user chooses abandon:
```bash
node "$HOME/.codex/commands/do/scripts/task-abandon.cjs" abandon <file> --config .do/config.json
```

## Step 3: Load context

```bash
node "$HOME/.codex/commands/do/scripts/load-task-context.cjs" "$ARGUMENTS"
```

Parse JSON output for project_md_path, matched_docs, keywords.

## Step 4: Analyze and refine task

Follow refinement process from SKILL.md:
- Calculate confidence with factor breakdown
- Propose wave breakdown (always ask user)
- Create task file in .do/tasks/

## Step 5: Update config and display summary

Set active_task in config.json and show next steps.

## Reference

For full workflow, see SKILL.md /do:task section.
Templates: ~/.codex/commands/do/references/task-template.md

</process>
