---
name: do:task
description: "Start a new piece of work with agent-based workflow. Orchestrates do-planner, do-plan-reviewer, do-griller (if needed), do-executioner, and do-code-reviewer agents. Creates task file, runs reviews, executes with quality gates."
argument-hint: "\"description of what you want to accomplish\""
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Agent
  - AskUserQuestion
---

# /do:task

Orchestrate a complete task workflow using specialized agents.

## Why this exists

Skills are markdown prompts that get skipped when context is long. Agents can't skip steps — they own their full loop. This skill orchestrates 5 agents to ensure every task gets proper planning, review, execution, and verification.

## Usage

```
/do:task "description of what you want to accomplish"
```

## Prerequisites

1. **Project initialized** — `.do/config.json` exists
2. **Database entry exists** — `project.md` exists for this project

## Workflow

```
do-planner (cyan) → do-plan-reviewer (green) → do-griller (yellow, if needed)
                                                         ↓
                                              USER APPROVAL
                                                         ↓
                    do-code-reviewer (magenta) ← do-executioner (red)
```

---

## Step 1: Check Prerequisites

```bash
node ~/.claude/commands/do/scripts/check-database-entry.cjs --message
```

If fails, stop and report what's missing.

## Step 2: Check for Active Task

```bash
node ~/.claude/commands/do/scripts/task-abandon.cjs check --config .do/config.json
```

If active task exists, offer options:
- Continue it (`/do:continue`)
- Abandon it and start new
- Cancel

## Step 3: Read Model Config

```bash
node -e "
const c = require('./.do/config.json');
const models = c.models || { default: 'sonnet', overrides: {} };
console.log(JSON.stringify(models));
"
```

Store result for agent spawning. Default to sonnet if not configured.

## Step 4: Create Task File

Generate task filename and create initial file:

```bash
# Generate filename: YYMMDD-<slug>.md
TASK_DATE=$(date +%y%m%d)
TASK_SLUG=$(echo "<description>" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | cut -c1-30)
TASK_FILE="${TASK_DATE}-${TASK_SLUG}.md"
```

Create task file from template using the Write tool:
- Read `@references/task-template.md`
- Replace `{{TASK_ID}}` with filename (without .md)
- Replace `{{CREATED_AT}}` with ISO timestamp
- Replace `{{DESCRIPTION}}` with user's task description
- Write to `.do/tasks/${TASK_FILE}`

Update config:
```bash
node -e "
const fs = require('fs');
const c = JSON.parse(fs.readFileSync('.do/config.json', 'utf8'));
c.active_task = '${TASK_FILE}';
fs.writeFileSync('.do/config.json', JSON.stringify(c, null, 2));
"
```

## Step 5: Spawn do-planner

Spawn planner to fill in the task file:

```javascript
Agent({
  description: "Plan task: <description>",
  subagent_type: "do-planner",
  model: "<models.overrides.planner || models.default>",
  prompt: `
Complete the plan for this task.

Task description: <user's description>
Task file: .do/tasks/<active_task>
Config: .do/config.json

The task file already exists with basic metadata. Load context, analyze the task, 
calculate confidence, and fill in the Problem Statement, Approach, and Concerns sections.
Return a structured summary when complete.
`
})
```

Parse the returned summary for:
- Confidence score and factors
- Approach summary
- Concerns count

## Step 6: Spawn do-plan-reviewer

```javascript
Agent({
  description: "Review plan",
  subagent_type: "do-plan-reviewer",
  model: "<models.overrides.plan_reviewer || models.default>",
  prompt: `
Review the plan in this task file.

Task file: .do/tasks/<active_task>
Config: .do/config.json

Spawn parallel self-review and council review (if enabled).
Auto-iterate up to 3 times if issues found.
Return APPROVED, ITERATE status, or ESCALATE with details.
`
})
```

Handle result:
- **APPROVED**: Continue to Step 6
- **MAX_ITERATIONS**: Show user the outstanding issues, ask to proceed or revise
- **ESCALATE**: Show critical issues, require user decision

## Step 7: Check Confidence & Grill (if needed)

Read confidence from task file:

```bash
node -e "
const fm = require('gray-matter');
const t = fm(require('fs').readFileSync('.do/tasks/<active_task>', 'utf8'));
const threshold = require('./.do/config.json').auto_grill_threshold || 0.9;
console.log(JSON.stringify({ score: t.data.confidence.score, threshold }));
"
```

If `score < threshold`:

```javascript
Agent({
  description: "Grill user for clarity",
  subagent_type: "do-griller",
  model: "<models.overrides.griller || models.default>",
  prompt: `
The task confidence is below threshold. Ask clarifying questions.

Task file: .do/tasks/<active_task>
Current confidence: <score>
Threshold: <threshold>

Ask targeted questions for lowest-scoring factors.
Update confidence after each answer.
Stop when threshold reached or user overrides.
`
})
```

## Step 8: User Approval Checkpoint

Display summary and ask for execution approval:

```
## Ready to Execute

**Task:** <task file>
**Confidence:** <score> (<factors>)
**Plan:** <approach summary>
**Reviews:** <plan review status>

Proceed with execution? [Y/n]
```

If user says no, stop. Task file is saved for later `/do:continue`.

## Step 9: Spawn do-executioner

```javascript
Agent({
  description: "Execute task",
  subagent_type: "do-executioner",
  model: "<models.overrides.executioner || models.default>",
  prompt: `
Execute the plan in this task file.

Task file: .do/tasks/<active_task>

Follow the Approach section step by step.
Log each action to Execution Log.
Handle deviations appropriately.
Return summary when complete.
`
})
```

Handle result:
- **COMPLETE**: Continue to Step 9
- **BLOCKED**: Show blocker, ask user for resolution
- **FAILED**: Show error, offer recovery options

## Step 10: Spawn do-code-reviewer

```javascript
Agent({
  description: "Review code changes",
  subagent_type: "do-code-reviewer",
  model: "<models.overrides.code_reviewer || models.default>",
  prompt: `
Review the code changes from this task execution.

Task file: .do/tasks/<active_task>

Spawn parallel self-review and council review (if enabled).
Auto-iterate up to 3 times if issues found.
Generate UAT checklist when approved.
`
})
```

Handle result:
- **VERIFIED**: Continue to completion
- **MAX_ITERATIONS**: Show issues, ask user to fix manually or ship anyway
- **Changes applied**: Re-run quality checks, confirm

## Step 11: Complete

Display final summary:

```
## Task Complete

**Task:** .do/tasks/<filename>
**Status:** Verified

### Summary
- Files modified: <count>
- Commits: <count>
- Review iterations: <plan> plan, <code> code

### UAT Checklist
<generated checklist from code reviewer>

Run the application and verify the checklist items.
When verified, the task is complete.
```

Update task file stage to `verified`.

---

## Failure Handling

Any agent failure returns immediately to user with:
- Which agent failed
- What it was trying to do
- Last known good state
- Task file path (for `/do:continue` resume)

No automatic retries. User decides next step.

---

## Files

- **Task template:** @references/task-template.md
- **Gate script:** @scripts/check-database-entry.cjs
- **Abandon script:** @scripts/task-abandon.cjs
