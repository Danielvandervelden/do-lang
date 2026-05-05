---
name: init-workspace-setup
description: Detailed workspace initialization procedure. Loaded by /do:init when workspace marker is missing.
---

# Workspace Setup

Interactive setup for new workspace. Due to AskUserQuestion bug (fails after skill load), use inline prompts.

## Step 1: Ask workspace location

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

## Step 2: Ask database location

```
Where should the database live?
Default: <workspace>/database
```

## Step 3: Ask github-projects location

```
Where do your git repos live?
Default: <workspace>/github-projects
```

## Step 4: Ask about custom workflows

```
Do you have custom workflows to add? (Jira integration, CI/CD, etc.)
Enter workflow descriptions or press Enter to skip:
```

## Step 5: Create workspace structure

1. **Create database folders:**
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
   
   ## Shared
   <!-- Add shared documentation links here -->
   ```

3. **Create AGENTS.md** from @references/agents-template.md with placeholders:
   - `{{WORKSPACE_PATH}}` → workspace root
   - `{{DATABASE_PATH}}` → database location
   - `{{GITHUB_PROJECTS_PATH}}` → github-projects location
   - `{{VERSION}}` → `0.1.0`

4. **Create pointer files** from @references/pointer-templates.md:
   - `<workspace>/CLAUDE.md` (includes "do init completed v0.1.0" marker)
   - `<workspace>/CURSOR.md`
   - `<workspace>/GEMINI.md`

5. **Detect AI tools:**
   ```bash
   node <<DO:SCRIPTS_PATH>>/detect-tools.cjs
   ```
   Handle exit code 1 as warning (no tools detected), not failure.

6. **Create .do-workspace.json:**
   ```json
   {
     "version": "0.1.0",
     "workspace": "<absolute-workspace-path>",
     "database": "<absolute-database-path>",
     "githubProjects": "<absolute-github-projects-path>",
     "initializedAt": "<ISO-8601-timestamp>",
     "availableTools": <from-detect-tools>,
     "defaultReviewer": "random",
     "council_reviews": { "planning": true, "execution": true }
   }
   ```

## Step 6: Confirm completion

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

Detected AI tools: <availableTools or "none">
Default reviewer: random

Next steps:
- Run /do:scan in a project to create its database entry
- Add your custom rules to AGENTS.md as needed
```
