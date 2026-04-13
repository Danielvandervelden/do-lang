---
name: do
description: |
  Token-efficient meta programming language for Claude Code and Codex. Provides workspace initialization, project scanning, task refinement, and structured execution with minimal token overhead through flat agent hierarchies.
  
  ALWAYS use this skill when:
  - User mentions /do:init, /do:scan, /do:task, /do:continue, or /do:debug
  - User wants to set up a workspace for AI coding assistants
  - User asks about initializing their development environment for Claude/Codex
  - User mentions "do-lang" or the "do" meta programming language
  - User wants efficient task execution without token bloat
  - User needs workspace health checks or validation
---

# do

Token-efficient meta programming language for Claude Code and Codex. Execute tasks with minimal token overhead through flat agent hierarchies.

## Quick Reference

| Command | Purpose |
|---------|---------|
| `/do:init` | Initialize workspace or run health check |
| `/do:scan` | Scan project and create database entry |
| `/do:task` | Create and refine a task |
| `/do:continue` | Resume from last task state |
| `/do:debug` | Structured debugging workflow |

---

## /do:init

Initialize a workspace for AI coding assistant collaboration, or run health checks on an existing workspace.

### Detection Logic

Before running any `/do:*` command, check for the "do init completed" marker:

```bash
grep -q "do init completed" ~/workspace/CLAUDE.md 2>/dev/null
```

**Routing:**

- **If marker missing:** Trigger interactive workspace setup (see below)
- **If marker exists:** Continue to project-level detection (per D-12, D-13)

#### Project-Level Detection (per D-01, D-12, D-13)

After workspace check passes, detect project-level setup:

**Step 1: Check if CWD is a project**

```bash
test -d .git || test -f package.json
```

If neither exists, skip project-level logic (not in a project). Run workspace health check only and display combined status:
```
Workspace: ~/workspace (healthy)
Project: Not in a project directory (no .git or package.json)
```

**Step 2: Check project initialization (per D-03)**

```bash
test -d .do && test -f .do/config.json && node -e "const c=require('./.do/config.json'); if(typeof c.version!=='string')throw new Error('invalid')"
```

- **If check fails:** Trigger interactive project setup (see Project Setup Mode)
- **If check passes:** Run combined health check (see Health Check Mode)

### Interactive Setup Mode

When the marker is not found, run interactive setup. Due to the AskUserQuestion bug (fails after skill load), use inline prompts and wait for user response between questions.

**Step 1: Display welcome and ask workspace location**

```
/do:init - Workspace Initialization

I'll set up your workspace for AI coding assistant collaboration.
This creates:
- AGENTS.md (canonical instructions for all AI tools)
- CLAUDE.md, CURSOR.md, GEMINI.md (pointers to AGENTS.md)
- Database folder structure for project documentation

Where is your workspace root?
Default: ~/workspace
```

Wait for user response. Use default if they confirm or provide empty response.

**Step 2: Ask database location**

```
Where should the database live?
Default: <workspace>/database
```

Wait for user response.

**Step 3: Ask github-projects location**

```
Where do your git repos live?
Default: <workspace>/github-projects
```

Wait for user response.

**Step 4: Ask about custom workflows**

```
Do you have custom workflows to add? (Jira integration, CI/CD, etc.)
Enter workflow descriptions or press Enter to skip:
```

Wait for user response. This is optional.

**Step 5: Create workspace structure**

After gathering all answers, create the workspace:

1. **Create database folder structure:**
   ```bash
   mkdir -p <database>/projects
   mkdir -p <database>/shared
   ```

2. **Create __index__.md:**
   ```markdown
   # Database Index

   Barrel import file for workspace documentation.

   ## Projects

   <!-- Add project links here -->
   <!-- Format: - [project-name](projects/project-name/project.md) - Description -->

   ## Shared

   <!-- Add shared documentation links here -->
   <!-- Format: - [topic](shared/topic.md) - Description -->
   ```

3. **Read agents-template.md and replace placeholders:**

   @skills/do/references/agents-template.md

   Replace:
   - `{{WORKSPACE_PATH}}` with the workspace root
   - `{{DATABASE_PATH}}` with the database location
   - `{{GITHUB_PROJECTS_PATH}}` with the github-projects location
   - `{{VERSION}}` with `0.1.0`

   Write to `<workspace>/AGENTS.md`

4. **Read pointer-templates.md and create pointer files:**

   @skills/do/references/pointer-templates.md

   Extract each template section and write:
   - `<workspace>/CLAUDE.md` (includes "do init completed v0.1.0" marker)
   - `<workspace>/CURSOR.md`
   - `<workspace>/GEMINI.md`

   Replace `{{VERSION}}` with `0.1.0` in each.

5. **If user provided custom workflows:**
   Append to AGENTS.md under a new `## Custom Workflows` section.

6. **Create .do-workspace.json config file:**
   ```json
   {
     "version": "0.1.0",
     "workspace": "<absolute-workspace-path>",
     "database": "<absolute-database-path>",
     "githubProjects": "<absolute-github-projects-path>",
     "initializedAt": "<ISO-8601-timestamp>"
   }
   ```

**Step 6: Confirm completion**

```
Workspace initialized successfully!

Created:
- <workspace>/AGENTS.md (canonical instructions)
- <workspace>/CLAUDE.md (pointer + init marker)
- <workspace>/CURSOR.md (pointer)
- <workspace>/GEMINI.md (pointer)
- <database>/__index__.md (barrel imports)
- <database>/projects/ (project documentation)
- <database>/shared/ (shared patterns)
- <workspace>/.do-workspace.json (config)

Next steps:
- Run /do:scan in a project to create its database entry
- Add your custom rules to AGENTS.md as needed
```

### Health Check Mode

When both workspace marker exists AND project is initialized, run combined health checks.

**Step 1: Run workspace health check**

```bash
node <skill-path>/scripts/workspace-health.cjs <workspace-path>
```

**Step 2: Run project health check (if in a project)**

```bash
node <skill-path>/scripts/project-health.cjs .
```

**Step 3: Display combined health report (per D-14)**

Both health check scripts return JSON:
```json
{
  "healthy": true|false,
  "version": "0.1.0"|null,
  "issues": [...]
}
```

Display combined status showing BOTH workspace AND project state:

If both healthy:
```
/do:init - Health Check

Workspace: ~/workspace (healthy, v0.1.0)
Project: my-project/.do/ (healthy, v0.1.0)

No issues found.
```

If workspace healthy but project has issues:
```
/do:init - Health Check

Workspace: ~/workspace (healthy, v0.1.0)
Project: my-project/.do/ (ISSUES FOUND)

Project Issues:
- [ERROR] noTasksFolder: .do/tasks/ folder not found
- [WARNING] staleActiveTask: active_task points to missing file: old-task.md

Suggested fixes:
- noTasksFolder: Run `mkdir -p .do/tasks` to recreate
- staleActiveTask: Remove active_task from config.json or restore the task file
```

If both have issues:
```
/do:init - Health Check

Workspace: ~/workspace (ISSUES FOUND)
Project: my-project/.do/ (ISSUES FOUND)

Workspace Issues:
- [WARNING] duplicateIndex: Duplicate entries found in __index__.md

Project Issues:
- [ERROR] noConfig: config.json not found or invalid

Run /do:init to reinitialize affected components.
```

If not in a project (workspace-only health check):
```
/do:init - Health Check

Workspace: ~/workspace (healthy, v0.1.0)
Project: Not in a project directory

No workspace issues found.
```

### Workspace Health Check Types

| Type | Severity | Description | Fix |
|------|----------|-------------|-----|
| `duplicateIndex` | warning | Duplicate entries in `__index__.md` | Remove duplicates |
| `staleProjects` | warning | Database entry exists but repo was deleted | Remove database entry or restore repo |
| `orphanedEntries` | warning | Database entry with no matching repo | Remove or link to repo |
| `missingAgentsSections` | warning | Required sections missing from AGENTS.md | Add missing sections |
| `pointerConsistency` | error | Pointer files don't reference AGENTS.md | Regenerate pointer files |
| `versionMarker` | error/warning | Missing or invalid version marker | Re-run /do:init |

### Interactive Project Setup Mode

When `.do/` folder is missing or invalid, run interactive project setup. Due to the AskUserQuestion bug (fails after skill load), use inline prompts and wait for user response between questions.

**Step 1: Display welcome and detect project name**

```
/do:init - Project Setup

This project needs initialization for the do workflow.
This creates:
- .do/config.json (project settings)
- .do/tasks/ (task storage)

Detected project name: <from-package.json-name-field-or-folder-name>

Confirm this name or enter a different one:
```

To detect project name:
1. Read `package.json` and use `name` field if present
2. Otherwise, use the current directory name

Wait for user response. Use detected name if they confirm or provide empty response.

**Step 2: Ask council review preferences (per D-04, D-05)**

```
Configure AI council reviews:

Planning reviews (review task plans before execution):
- Enable planning reviews? (yes/no, default: yes)
- Model for planning reviews? (default: codex-1)

Execution reviews (review implementations after execution):
- Enable execution reviews? (yes/no, default: no)
- Model for execution reviews? (default: o3)

Enter responses (or press Enter for defaults):
```

Wait for user response.

**Step 3: Ask grill threshold (per D-09)**

```
Grill threshold: When task confidence is below this value, 
the grill-me agent asks clarifying questions.

Suggested default: 0.9 (triggers grilling if confidence < 90%)

Enter threshold (0.0-1.0) or press Enter for 0.9:
```

Wait for user response.

**Step 4: Check database entry (per D-11)**

```
Database entry check:

Does this project have a database entry at:
~/workspace/database/projects/<project-name>/project.md?

If not, you can run /do:scan to create one.
Do you want to mark this project as having a database entry? (yes/no)
```

Wait for user response. Set `database_entry: true` or `false` in config.

**Step 5: Create project structure**

After gathering all answers, create the project structure:

1. **Create .do folder:**
   ```bash
   mkdir -p .do/tasks
   ```

2. **Read config-template.json and replace placeholders:**

   @skills/do/references/config-template.json

   Replace:
   - `{{PROJECT_NAME}}` with the confirmed project name
   
   Update values based on user responses:
   - `council_reviews.planning.enabled` - user's planning review choice
   - `council_reviews.planning.model` - user's planning model choice
   - `council_reviews.execution.enabled` - user's execution review choice
   - `council_reviews.execution.model` - user's execution model choice
   - `auto_grill_threshold` - user's threshold choice
   - `database_entry` - user's database entry response

   Write to `.do/config.json`

**Step 6: Confirm completion with combined status (per D-14)**

```
Project initialized successfully!

Workspace: ~/workspace (healthy)
Project: <project-name>/.do/ (initialized)

Created:
- .do/config.json (project settings)
- .do/tasks/ (task storage)

Configuration:
- Project name: <name>
- Council planning reviews: <enabled/disabled> (model: <model>)
- Council execution reviews: <enabled/disabled> (model: <model>)
- Grill threshold: <threshold>
- Database entry: <yes/no>

Next steps:
- Run /do:scan to create database entry (if not already done)
- Run /do:task "description" to start a task
```

### Project Health Check Types

| Type | Severity | Description | Fix |
|------|----------|-------------|-----|
| `noDotDoFolder` | error | `.do/` folder missing | Re-run /do:init |
| `noConfig` | error | `config.json` missing or invalid JSON | Re-run /do:init |
| `noVersion` | error | Missing version field in config | Re-run /do:init |
| `missingField` | warning | Required field missing from config | Add field to config.json |
| `noTasksFolder` | error | `.do/tasks/` folder missing | Run `mkdir -p .do/tasks` |
| `staleActiveTask` | warning | `active_task` references missing file | Clear active_task or restore file |

### Files

- **Template files:**
  - @skills/do/references/agents-template.md - AGENTS.md template with placeholders
  - @skills/do/references/pointer-templates.md - CLAUDE.md, CURSOR.md, GEMINI.md templates

- **Project config template:**
  - @skills/do/references/config-template.json - Default config.json structure

- **Health check scripts:**
  - `skills/do/scripts/workspace-health.cjs` - Node.js workspace health check implementation
  - `skills/do/scripts/project-health.cjs` - Node.js project health check implementation

## Planned Commands

- `/do:scan` - Scan project and create database entry
- `/do:task` - Create and refine a task with AI assistance
- `/do:continue` - Resume from last task state
- `/do:debug` - Structured debugging workflow

## Architecture

The do system uses a flat agent hierarchy to minimize token usage:
- Single orchestrator coordinates execution
- One agent per phase (no nested subagents)
- State persisted in project `.do/` folder
- YAML frontmatter for machine-parseable status

## Installation

This skill is installed automatically when you run `npm i -g do-lang`.
Skills are copied to `~/.claude/skills/do/`.
