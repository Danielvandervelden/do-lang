---
name: do:init
description: "Initialize workspace or project for the /do workflow, or run health checks. Use when setting up a new workspace, initializing a project, checking system health, or when any /do:* command reports 'not initialized'. Triggers on 'initialize', 'set up workspace', 'health check', 'is everything working'."
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

# /do:init

Initialize workspace and project for the /do workflow, or run health checks on existing setup.

## Why this exists

The /do workflow needs two things: a workspace (where your database and config live) and a project setup (where task files go). This skill handles both initial setup and ongoing health checks. It's the foundation that makes `/do:task`, `/do:scan`, and other commands work.

## Usage

```
/do:init
```

Run from your workspace root or a project directory. Automatically detects what's needed.

## What it does

1. **Checks workspace** — Is `.do-workspace.json` present with valid config?
2. **Checks project** — Is `.do/config.json` present in current directory?
3. **Routes to the right mode:**
   - Missing workspace → Interactive workspace setup
   - Missing project config → Interactive project setup
   - Both present → Health check

## Routing Logic

**Step 1: Check workspace marker**

```bash
grep -q "do init completed" ~/workspace/CLAUDE.md 2>/dev/null
```

- Marker missing → Load @references/init-workspace-setup.md
- Marker exists → Continue to Step 2

**Step 2: Check if in a project**

```bash
test -d .git || test -f package.json
```

- Not a project → Workspace health check only
- Is a project → Continue to Step 3

**Step 3: Check project initialization**

```bash
test -d .do && test -f .do/config.json
```

- Project not initialized → Load @references/init-project-setup.md
- Project initialized → Load @references/init-health-check.md

## Reference Files

| Mode | Reference |
|------|-----------|
| Workspace setup | @references/init-workspace-setup.md |
| Project setup | @references/init-project-setup.md |
| Health check | @references/init-health-check.md |

## Quick Reference

**Workspace creates:**
- `AGENTS.md` — Canonical AI instructions
- `CLAUDE.md`, `CURSOR.md`, `GEMINI.md` — Tool-specific pointers
- `.do-workspace.json` — Workspace config
- `database/` — Project documentation folder

**Project creates:**
- `.do/config.json` — Project settings (council, thresholds)
- `.do/tasks/` — Task file storage

## Files

- **Scripts:** @scripts/workspace-health.cjs, @scripts/project-health.cjs, @scripts/detect-tools.cjs
- **Templates:** @references/agents-template.md, @references/pointer-templates.md, @references/config-template.json
