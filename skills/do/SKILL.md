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

- **If marker missing:** Trigger interactive workspace setup
- **If marker exists:** Run health check mode

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

When the marker exists, run health checks instead of setup.

**Step 1: Run health check script**

```bash
node <skill-path>/scripts/workspace-health.cjs <workspace-path>
```

The script path is relative to where the skill is installed. For npm global installs, this would be in the package's scripts directory.

**Step 2: Parse and display results**

The script returns JSON:
```json
{
  "healthy": true|false,
  "version": "0.1.0"|null,
  "issues": [
    {"type": "duplicateIndex", "severity": "warning", "details": "..."},
    {"type": "staleProjects", "severity": "error", "details": ["project-x"]}
  ]
}
```

**Step 3: Display health report**

If healthy:
```
Workspace Health Check - HEALTHY

Version: 0.1.0
Workspace: <path>
Database: <path>
GitHub Projects: <path>

No issues found.
```

If issues found:
```
Workspace Health Check - ISSUES FOUND

Version: 0.1.0
Workspace: <path>

Issues:
- [WARNING] duplicateIndex: Duplicate entries found in __index__.md
- [ERROR] staleProjects: Database entries without matching repos: project-x, project-y

Suggested fixes:
- duplicateIndex: Review __index__.md and remove duplicate entries
- staleProjects: Remove database/projects/<name> for deleted projects, or restore the repo
```

### Health Check Types

| Type | Severity | Description | Fix |
|------|----------|-------------|-----|
| `duplicateIndex` | warning | Duplicate entries in `__index__.md` | Remove duplicates |
| `staleProjects` | warning | Database entry exists but repo was deleted | Remove database entry or restore repo |
| `orphanedEntries` | warning | Database entry with no matching repo | Remove or link to repo |
| `missingAgentsSections` | warning | Required sections missing from AGENTS.md | Add missing sections |
| `pointerConsistency` | error | Pointer files don't reference AGENTS.md | Regenerate pointer files |
| `versionMarker` | error/warning | Missing or invalid version marker | Re-run /do:init |

### Files

- **Template files:**
  - @skills/do/references/agents-template.md - AGENTS.md template with placeholders
  - @skills/do/references/pointer-templates.md - CLAUDE.md, CURSOR.md, GEMINI.md templates

- **Health check script:**
  - `skills/do/scripts/workspace-health.cjs` - Node.js health check implementation

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
