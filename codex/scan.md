---
name: do:scan
description: Scan a project's codebase and create a database entry with tech stack, structure, and conventions. Use when user says "scan project", "create database entry", or "analyze codebase".
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
Scan a project's codebase and create a database entry with tech stack, structure, and conventions.
</objective>

<process>

## Step 1: Check prerequisites

- Workspace must be initialized (grep "do init completed" ~/workspace/CLAUDE.md)
- Must be in a project directory (has .git or package.json)
- Project must have .do/ folder initialized

## Step 2: Mode selection

Display prompt:
```
/do:scan - Database Entry Creation

Choose a mode:
1. Auto-scan - Infer everything from codebase, edit project.md after
2. Interview - Walk through questions to fill in details

Enter 1 or 2 (default: 1):
```

## Step 3: Run scan

```bash
node "$HOME/.codex/commands/do/scripts/scan-project.cjs" .
```

Parse JSON output for detected tech stack, directories, conventions.

## Step 4: Create database entry

Follow ~/.codex/commands/do/scan.md workflow:
- Create database folder structure
- Generate project.md from template
- Update __index__.md
- Set database_entry: true in config

## Reference

Templates: ~/.codex/commands/do/references/project-template.md

</process>
