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
| `/do:abandon` | Abandon active task |
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

**Step 2: Ask council review preferences (per D-04, D-05, D-39)**

```
Configure AI council reviews:

Planning reviews (review task plans before execution):
- Enable planning reviews? (yes/no, default: yes)

Execution reviews (review implementations after execution):
- Enable execution reviews? (yes/no, default: yes)

Reviewer selection:
- random: Randomly select between available advisors (default)
- codex: Always use Codex (if in Claude runtime)
- gemini: Always use Gemini
- both: Run both advisors in parallel

Enter reviewer preference (random/codex/gemini/both, default: random):
```

Wait for user responses.

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
   - `council_reviews.planning` - true if user enabled planning reviews, false otherwise
   - `council_reviews.execution` - true if user enabled execution reviews, false otherwise
   - `council_reviews.reviewer` - user's reviewer preference (default: "random")
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
- Council planning reviews: <enabled/disabled>
- Council execution reviews: <enabled/disabled>
- Council reviewer: <reviewer preference>
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

## /do:scan

Scan a project's codebase and create a database entry with tech stack, structure, and conventions.

### Prerequisites

- Workspace must be initialized (`/do:init` completed)
- Must be run from a project directory (has `.git/` or `package.json` or `requirements.txt`)
- Project must have `.do/` folder initialized

### Mode Selection

**Per D-09: Use inline prompts (not AskUserQuestion)**

Display mode selection prompt:

```
/do:scan - Database Entry Creation

This will create a database entry for: <detected-project-name>

Choose a mode:
1. Auto-scan - Infer everything from codebase, edit project.md after
2. Interview - Walk through questions to fill in details

Enter 1 or 2 (default: 1):
```

Wait for user response.

### Auto-Scan Mode

**Step 1: Run scan-project.cjs**

```bash
node <skill-path>/scripts/scan-project.cjs <project-path>
```

Parse JSON output. If `monorepo` field is not null, display warning:
```
Warning: This appears to be a monorepo (<type>).
<warning message from scan output>
Continue anyway? (yes/no, default: no)
```

**Step 2: Read workspace config**

```bash
cat <workspace-root>/.do-workspace.json
```

Extract `database` path.

**Step 3: Check for existing entry**

```bash
test -f <database>/projects/<project-name>/project.md
```

If exists, prompt:
```
Database entry already exists at:
<database>/projects/<project-name>/project.md

Overwrite? (yes/no, default: no)
```

Wait for response. If "no", abort.

**Step 4: Create database entry folder structure**

```bash
mkdir -p <database>/projects/<project-name>/components
mkdir -p <database>/projects/<project-name>/tech
mkdir -p <database>/projects/<project-name>/features
```

**Step 5: Copy README templates to subfolders**

Copy from references/:
- `component-readme.md` -> `<database>/projects/<project-name>/components/README.md`
- `tech-readme.md` -> `<database>/projects/<project-name>/tech/README.md`
- `features-readme.md` -> `<database>/projects/<project-name>/features/README.md`

**Step 6: Generate project.md from template**

Read `@skills/do/references/project-template.md`

Replace placeholders using scan output:

| Placeholder | Source |
|-------------|--------|
| `{{PROJECT_NAME}}` | `scan.project_name` |
| `{{DESCRIPTION}}` | `"TODO: Add project description"` |
| `{{REPO_PATH}}` | Current working directory (absolute path) |
| `{{PROD_URL}}` | `"TODO: Add production URL"` |
| `{{TEST_URL}}` | `"TODO: Add test URL"` |
| `{{DATABASE_PATH}}` | `<database>/projects/<project-name>` |
| `{{TECH_STACK}}` | Generate from `scan.detected` (see format below) |
| `{{KEY_DIRECTORIES}}` | Generate from `scan.key_directories` |
| `{{CONVENTIONS}}` | Generate from `scan.conventions` |

**Tech Stack format:**
```markdown
- **Framework**: <frameworks joined with ", ">
- **UI**: <ui_libraries joined with ", "> (if any)
- **State**: <state_management joined with ", "> (if any)
- **Routing**: <routing joined with ", "> (if any)
- **Forms**: <forms joined with ", "> (if any)
- **Testing**: <testing joined with ", "> (if any)
- **Linting**: <linting joined with ", "> (if any)
- **Data**: <data joined with ", "> (if any, Python projects)
- **ORM**: <orm joined with ", "> (if any)
```

Only include lines where the array is non-empty.

**Key Directories format:**
```markdown
- `<path>` - <description>
```

One line per entry in `scan.key_directories`.

**Conventions format (per council advisory - no fabrication):**

If `scan.conventions.commit_prefixes` is non-empty:
```markdown
- **Commit prefixes**: `<prefixes joined with "`, `">`
- **Branch naming**: TODO: Document branch naming convention
```

If `scan.conventions.commit_prefixes` is empty:
```markdown
- **Commit prefixes**: TODO: Document commit message conventions
- **Branch naming**: TODO: Document branch naming convention
```

**IMPORTANT:** Do NOT fabricate branch naming patterns like `<type>/<description>`. Only output patterns that were actually detected from git history. Use TODO placeholders for undetected conventions.

Write generated content to `<database>/projects/<project-name>/project.md`

**Step 7: Update __index__.md (per D-12, D-13)**

Read `<database>/__index__.md`

Check if entry already exists:
```bash
grep -q "projects/<project-name>" <database>/__index__.md
```

If not found, append under `# Projects` section:

```markdown

## <Project Name>

- Project folder: <absolute-path-to-project>
- Database folder: <database>/projects/<project-name>
```

**Step 8: Update config.json database_entry flag**

Read `.do/config.json`
Set `"database_entry": true`
Write back to `.do/config.json`

**Step 9: Display completion summary**

```
Database entry created!

Created:
- <database>/projects/<project-name>/project.md
- <database>/projects/<project-name>/components/README.md
- <database>/projects/<project-name>/tech/README.md
- <database>/projects/<project-name>/features/README.md

Updated:
- <database>/__index__.md
- .do/config.json (database_entry: true)

Detected:
- Project type: <javascript|python|unknown>
- Framework: <frameworks>
- UI: <ui_libraries>
- Testing: <testing>
- Conventions: <commit_pattern or "none detected">

Next steps:
- Edit project.md to add description, URLs, and refine detected info
- Add component docs to components/ as needed
- Add tech pattern docs to tech/ as needed
```

### Interview Mode

**Step 1: Run scan-project.cjs** (same as auto-scan, including monorepo warning)

**Step 2: Ask questions (per D-08: name, description, purpose, key URLs)**

Ask these questions with inline prompts (wait for response after each):

```
Project name: <detected-name>
Confirm or enter different name:
```

```
Brief description of this project:
(What does it do? Who uses it?)
```

```
What is the main purpose of this project?
(e.g., "Internal tool for managing X", "Customer-facing dashboard for Y")
```

```
Production URL (or press Enter to skip):
```

```
Test/staging URL (or press Enter to skip):
```

**Step 3: Merge user input with detected data**

Use user-provided values for:
- `{{PROJECT_NAME}}` - from question 1
- `{{DESCRIPTION}}` - combine description + purpose from questions 2-3 (or "TODO" if both empty)
- `{{PROD_URL}}` - from question 4 (or "TODO" if empty)
- `{{TEST_URL}}` - from question 5 (or "TODO" if empty)

**Steps 4-9: Same as auto-scan mode**

### Files

- **Detection script:**
  - @skills/do/scripts/scan-project.cjs

- **Template files:**
  - @skills/do/references/project-template.md
  - @skills/do/references/component-readme.md
  - @skills/do/references/tech-readme.md
  - @skills/do/references/features-readme.md

## /do:task

Create and refine a task with AI assistance.

### Usage

```
/do:task "description of what you want to accomplish"
```

### Prerequisites

Before /do:task can run, it checks:

1. **Workspace initialized** - `.do-workspace.json` exists at workspace root
2. **Project initialized** - `.do/config.json` exists in project
3. **Database entry exists** - `<database>/projects/<project-name>/project.md` exists

### Refinement Process

**Step 1: Check prerequisites**

Run database entry check:
```bash
node <skill-path>/scripts/check-database-entry.cjs --message
```

If exit code is non-zero, display error and stop.

**Step 2: Check for active task (per D-11, D-55)**

Run active task check:
```bash
node <skill-path>/scripts/task-abandon.cjs check --config .do/config.json
```

Parse JSON output. Handle each case:

**If `active: false` with no `stale` field:** No active task, proceed to Step 3.

**If `active: false` with `stale` field:**
- Display warning: "Warning: active_task points to missing file '<stale>'. Clearing stale reference."
- Update config.json: set `active_task: null`
- Proceed to Step 3.

**If `active: true`:** Display blocking message with options (per D-55):

```
Active task found: <file> (stage: <stage>)

Options:
1. Continue existing task (/do:continue)
2. Abandon and start new task
3. Cancel

What would you like to do?
```

Wait for user response:
- **Option 1 (Continue):** Display "Run /do:continue to resume." and stop.
- **Option 2 (Abandon):** Run abandonment:
  ```bash
  node <skill-path>/scripts/task-abandon.cjs abandon <file> --config .do/config.json
  ```
  Display "Task abandoned: <file>. Previous stage (<pre_abandon_stage>) preserved for resume."
  Display "To resume later: /do:continue --task <file>"
  Continue to Step 3.
- **Option 3 (Cancel):** Display "Cancelled." and stop.

**Step 3: Load context (per D-07, D-08, D-09, D-10)**

Run context loading script:
```bash
node <skill-path>/scripts/load-task-context.cjs "<task-description>"
```

Parse JSON output for:
- `project_md_path` - Path to project.md
- `matched_docs` - Array of matched component/tech/feature docs
- `keywords` - Extracted keywords for transparency
- `database_path` - Path to project's database folder

Read project.md and each matched doc to gather context.

**Step 4: Analyze task**

With loaded context, analyze the task description:
- Identify what systems/components it touches
- Identify potential implementation approach
- Identify concerns or uncertainties
- Check if similar patterns exist in codebase

**Step 5: Calculate confidence (per D-04, D-05)**

Starting from 1.0, apply deductions:

| Factor | Deduction | Condition |
|--------|-----------|-----------|
| context | -0.1 to -0.2 | Missing component/tech docs that task likely needs |
| scope | -0.05 to -0.15 | Task spans multiple files/systems |
| complexity | -0.05 to -0.15 | Multiple integration points |
| familiarity | -0.05 to -0.1 | No similar patterns found in codebase |

Display breakdown transparently (per D-05):
```
Confidence: 0.72 (context: -0.10, scope: -0.10, complexity: -0.08, familiarity: 0.00)
```

**Step 5.5: Read grill threshold from config (per D-06)**

Read `.do/config.json` and extract `auto_grill_threshold` (default 0.9 if not set).
Store for use in Step 9 to determine if grill-me will trigger.

**Step 6: Propose wave breakdown (per D-02, D-03)**

**ALWAYS ask the user about wave breakdown** — per D-03, refine agent always asks, user decides:

```
This task {complexity assessment - e.g., "touches 3 systems" or "is focused on one component"}.

Break into waves, or execute as single unit?

1. Yes - Document waves before proceeding
2. No - Execute as single unit

Enter choice (default: 2):
```

Wait for user response.

If user selects "1" (waves):
```
Enter wave names and descriptions (one per line, format: name: description)
Enter a blank line when done:

Example:
api-types: Generate upload endpoint types
upload-hook: Create useDocumentUpload hook
ui-components: Build UploadDropzone and Preview
```

Collect wave definitions from user.

**Step 7: Create task file**

Generate filename: `YYMMDD-<slug>.md`
- Extract first 5 words from description
- Kebab-case, remove special characters
- Example: "Fix login validation errors" -> `260413-fix-login-validation-errors.md`

Read task-template.md:
@skills/do/references/task-template.md

Replace placeholders:
- `{{TASK_ID}}` - filename without .md
- `{{CREATED_AT}}` - ISO 8601 timestamp
- `{{DESCRIPTION}}` - user's task description
- `{{CONFIDENCE_SCORE}}` - calculated score
- `{{CONTEXT_FACTOR}}` - context deduction
- `{{SCOPE_FACTOR}}` - scope deduction
- `{{COMPLEXITY_FACTOR}}` - complexity deduction
- `{{FAMILIARITY_FACTOR}}` - familiarity deduction
- `{{TITLE}}` - task description as title (first ~50 chars)
- `{{PROBLEM_STATEMENT}}` - comprehensive problem statement (generate from analysis)
- `{{CONTEXT_LOADED}}` - list of loaded docs
- `{{APPROACH}}` - planned implementation approach
- `{{CONCERNS}}` - identified concerns

If user confirmed wave breakdown, add waves section to frontmatter:
```yaml
waves:
  - name: <wave-name>
    description: "<wave-description>"
    status: pending
```

Write task file to `.do/tasks/<filename>`

**Step 8: Update config.json**

Read `.do/config.json`
Set `active_task` to the task filename
Write back to `.do/config.json`

**Step 9: Display summary**

```
Task created: .do/tasks/<filename>

Confidence: <score> (<factor breakdown>)
{If below threshold:}
-> Grill-me phase will ask clarifying questions

Context loaded:
- project.md
{For each matched doc:}
- <doc-name>

Problem: <1-line summary>
Approach: <1-line summary>
{If waves:}
Waves: <count> defined

Next: {If confidence >= auto_grill_threshold: "Ready for implementation. Run /do:continue when ready (Phase 7)."}
      {If confidence < auto_grill_threshold: "Grill-me will ask clarifying questions. Run /do:continue (Phase 6)."}
```

### Files

- **Context loading script:**
  - @skills/do/scripts/load-task-context.cjs

- **Task template:**
  - @skills/do/references/task-template.md

- **Gate script:**
  - @skills/do/scripts/check-database-entry.cjs

## /do:abandon

Mark the active task as abandoned. The task file remains in `.do/tasks/` with `stage: abandoned` and `pre_abandon_stage` preserved for resume capability.

### Usage

```
/do:abandon
```

### Process

**Step 1: Check for active task**

```bash
node <skill-path>/scripts/task-abandon.cjs check --config .do/config.json
```

If no active task (`active: false` without `stale`), display: "No active task to abandon."

If stale reference (`active: false` with `stale`), display: "Cleared stale reference to missing task file."

**Step 2: Confirm and abandon**

Display current task info and confirm:
```
Active task: <file> (stage: <stage>)

Abandon this task? (yes/no)
```

If confirmed:
```bash
node <skill-path>/scripts/task-abandon.cjs abandon <file> --config .do/config.json
```

**Step 3: Display confirmation**

Display:
- "Task abandoned: <file>"
- "Previous stage (<pre_abandon_stage>) preserved."
- "To resume later: /do:continue --task <file>"
- "You can now start a new task with /do:task."

## /do:continue

Resume the active task from its current state.

### Stage Detection

**Step 1: Load active task**

Read `.do/config.json` to get `active_task`.
If no active task, display: "No active task. Run /do:task to create one."

Check if task file exists at `.do/tasks/<active_task>`:
- If file does NOT exist (stale pointer):
  - Display: "Warning: active_task points to missing file '<active_task>'. Clearing stale reference."
  - Update config.json: set `active_task: null`
  - Display: "No active task. Run /do:task to create one."
  - Stop

Read task file at `.do/tasks/<active_task>`.
Parse YAML frontmatter for `stage`, `stages`, and `confidence`.

**Optional: Resume abandoned task (per D-57, D-58)**

If user runs `/do:continue --task <filename>`:
1. Validate the file exists in `.do/tasks/<filename>`
2. Parse frontmatter to confirm it's a task file
3. If `stage: abandoned`:
   - Read `pre_abandon_stage` field (if present) to get previous stage
   - Update `stage` to `pre_abandon_stage` value (or `refinement` if not set)
   - Set `stages.abandoned: false`
   - Update the restored stage in stages map back to `in_progress`
4. Set `active_task` in config to this filename
5. Proceed with normal stage routing

Default `/do:continue` (no flag) still uses `active_task` from config only.

**Step 2: Route by stage**

Read `auto_grill_threshold` from `.do/config.json` (default 0.9 if not set).

| Stage | Condition | Reference File |
|-------|-----------|----------------|
| refinement | stages.grilling: in_progress | @skills/do/references/stage-grill.md |
| refinement | stages.grilling: pending AND confidence < threshold | @skills/do/references/stage-grill.md |
| refinement | stages.grilling: complete OR confidence >= threshold | @skills/do/references/stage-execute.md |
| execution | any | @skills/do/references/stage-execute.md |
| verification | any | @skills/do/references/stage-verify.md |
| verified | any | @skills/do/references/stage-verify.md |
| abandoned | any | Display: "Task was abandoned. Resume with /do:continue --task <filename> or start fresh with /do:task." |

**NOTE:** `grilling` is NOT a valid top-level stage value. Grill status is tracked via `stages.grilling` field (pending/in_progress/complete). The routing checks `stages.grilling: complete` BEFORE checking confidence, ensuring user overrides via "Proceed anyway" are respected.

### Resume Behavior (per TS-11)

Every `/do:continue` invocation runs Step R0 from the stage reference file before stage-specific logic.

**Resume flow:**
1. Load task markdown and parse state
2. Reload context from Context Loaded section (re-read all referenced docs)
3. Handle any missing docs (prompt user to continue or stop)
4. Display resume summary with task name, stage, and last action
5. Wait for user confirmation before proceeding
6. (Execution stage only) Show progress checklist if mid-execution

**Resume summary format:**
```
Resuming: <task-id> (stage: <stage>)
Last action: <summary>

Continue? (yes/no)
```

**Stale reference handling:**
```
Referenced doc(s) not found:
- <missing-path>

Options:
1. Continue without them
2. Stop and locate the docs
```

This ensures users always know their position before work continues, especially after `/clear`.

### Stage Reference Loading

Based on the routing table above, load and follow the appropriate reference file:

**For grill-me (refinement with confidence < threshold or grilling in_progress):**
@skills/do/references/stage-grill.md

**For execution (refinement ready or execution stage):**
@skills/do/references/stage-execute.md

**For verification or verified:**
@skills/do/references/stage-verify.md

Follow the instructions in the loaded reference file to complete the stage.

**Note:** All stage reference files run Step R0 (Resume Check) first. See @skills/do/references/resume-preamble.md for the shared resume logic.

### Files

- **Resume preamble:**
  - @skills/do/references/resume-preamble.md - Shared resume logic for context reload and summary display

## /do:debug

Structured debugging workflow using scientific method: hypothesis -> test -> confirm/reject.

### Usage

```
/do:debug "description of the bug or unexpected behavior"
```

### Prerequisites

- Project must be initialized (`.do/config.json` exists)
- `.do/debug/` directory will be created if not exists

### Active Session Detection (per D-45, D-46)

**Step 1: Check for active debug session**

```bash
node <skill-path>/scripts/debug-session.cjs check
```

Parse JSON output. If `active: true`:

Display blocking message:
```
Active debug: <filename> (status: <status>)
Current hypothesis: <hypothesis or "None yet">

Options:
- Continue - Resume this session
- Close - Mark as abandoned, start fresh
- Force new - Keep this session, start another (override constraint)

Enter choice:
```

Wait for user response:
- **Continue:** Load stage-debug.md and resume
- **Close:** Set debug file status to `abandoned`, clear `active_debug` in config, proceed to new session
- **Force new:** Proceed to new session without clearing active

If `stale: true` in output:
- Display: "Warning: active_debug points to missing file '<stale>'. Clearing stale reference."
- Clear `active_debug` in config
- Proceed to new session

**Step 2: Create new debug session**

If no active session (or user chose Close/Force new):

```bash
node <skill-path>/scripts/debug-session.cjs create "<trigger>"
```

If user wants to link to active task (per D-48):
- Check if `active_task` is set in config.json
- If set, ask:
  ```
  Link this debug session to active task: <active_task>? (yes/no)
  ```
- If yes, pass taskRef to create command

Parse output for `filename` and `path`.

Update config.json: `active_debug: <filename>`

**Step 3: Load debug workflow**

@skills/do/references/stage-debug.md

Follow the steps in stage-debug.md starting from the appropriate status:
- If new session: Start at Step D1 (Gathering)
- If resuming: Start at Step D0 (Resume Check)

### Files

- **Session management script:**
  - @skills/do/scripts/debug-session.cjs

- **Debug workflow reference:**
  - @skills/do/references/stage-debug.md

- **Debug template:**
  - @skills/do/references/debug-template.md

## Architecture

The do system uses a flat agent hierarchy to minimize token usage:
- Single orchestrator coordinates execution
- One agent per phase (no nested subagents)
- State persisted in project `.do/` folder
- YAML frontmatter for machine-parseable status

## Installation

This skill is installed automatically when you run `npm i -g do-lang`.
Skills are copied to `~/.claude/skills/do/`.
