---
name: init-health-check
description: Health check procedures for workspace and project. Loaded by /do:init when both are initialized.
---

# Health Check

Run combined health checks when workspace and project are both initialized.

## Step 1: Run workspace health check

```bash
node ~/.claude/commands/do/scripts/workspace-health.cjs <workspace-path>
```

## Step 2: Run project health check

```bash
node ~/.claude/commands/do/scripts/project-health.cjs .
```

## Step 3: Re-run AI tool detection

```bash
node ~/.claude/commands/do/scripts/detect-tools.cjs
```

Handle exit code 1 as warning (no tools detected), not failure.

Compare with `availableTools` in `.do-workspace.json`:
- If different: update config and display "AI tools updated: <new-list>"

## Step 4: Display combined health report

Both scripts return JSON:
```json
{
  "healthy": true|false,
  "version": "0.1.0"|null,
  "issues": [...]
}
```

**If both healthy:**
```
/do:init - Health Check

Workspace: ~/workspace (healthy, v0.1.0)
AI tools: codex, gemini
Project: my-project/.do/ (healthy, v0.1.0)

No issues found.
```

**If issues found:**
```
/do:init - Health Check

Workspace: ~/workspace (healthy, v0.1.0)
Project: my-project/.do/ (ISSUES FOUND)

Project Issues:
- [ERROR] <type>: <description>
- [WARNING] <type>: <description>

Suggested fixes:
- <type>: <fix instruction>
```

## Issue Types

### Workspace Issues

| Type | Severity | Fix |
|------|----------|-----|
| `duplicateIndex` | warning | Remove duplicates from `__index__.md` |
| `staleProjects` | warning | Remove database entry or restore repo |
| `orphanedEntries` | warning | Remove or link to repo |
| `missingAgentsSections` | warning | Add missing sections |
| `pointerConsistency` | error | Regenerate pointer files |
| `versionMarker` | error/warning | Re-run /do:init |

### Project Issues

| Type | Severity | Fix |
|------|----------|-----|
| `noDotDoFolder` | error | Re-run /do:init |
| `noConfig` | error | Re-run /do:init |
| `noVersion` | error | Re-run /do:init |
| `missingField` | warning | Add field to config.json |
| `noTasksFolder` | error | Run `mkdir -p .do/tasks` |
| `staleActiveTask` | warning | Clear active_task or restore file |
