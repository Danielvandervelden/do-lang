---
name: do:init
description: Initialize workspace or project for AI coding assistant collaboration. Use when user says "initialize", "setup workspace", or "do init".
argument-hint: ""
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
Initialize a workspace or project for AI coding assistant collaboration. Follows the same workflow as Claude Code /do:init.
</objective>

<process>

## Step 1: Check workspace initialization

Check for "do init completed" marker:
```bash
grep -q "do init completed" ~/workspace/CLAUDE.md 2>/dev/null
```

If marker missing, follow workspace setup flow from SKILL.md.

## Step 2: Check project initialization (if in project)

```bash
test -d .git || test -f package.json
```

If in project, check for .do/config.json. If missing, follow project setup flow.

## Step 3: Run health checks (if already initialized)

```bash
node "$HOME/.codex/commands/do/scripts/workspace-health.cjs" ~/workspace
node "$HOME/.codex/commands/do/scripts/project-health.cjs" .
```

Display combined health status.

## Reference

For full workflow details, see:
- Workspace setup: ~/.codex/commands/do/references/agents-template.md
- Project setup: ~/.codex/commands/do/references/config-template.json

</process>
