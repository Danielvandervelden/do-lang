---
name: do:continue
description: "Resume work from where you left off. Detects current stage and spawns the appropriate agent to continue."
argument-hint: "[--task <filename>]"
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

# /do:continue

Resume the active task by spawning the appropriate agent for its current stage.

## Why this exists

Tasks span multiple sessions. After a break, context switch, or `/clear`, this skill reloads the task state, shows progress, and spawns the right agent to continue — planner, reviewer, executioner, etc.

## Usage

```
/do:continue                    # Resume active task
/do:continue --task <filename>  # Resume a specific (possibly abandoned) task
```

---

## Step 1: Find Active Task

Read `.do/config.json` to get `active_task`.

```bash
node -e "const c=require('./.do/config.json'); console.log(c.active_task || 'none')"
```

- **No active task**: "No active task. Run /do:task to create one."
- **File missing**: Clear stale reference, show same message

If `--task <filename>` provided, use that instead.

## Step 2: Load Task State

Read the task file and extract:
- `stage`: Current workflow stage
- `stages`: Sub-stage completion status
- `confidence`: Score and factors
- Execution Log: Last action

```bash
node -e "
const fm = require('gray-matter');
const t = fm(require('fs').readFileSync('.do/tasks/<active_task>', 'utf8'));
console.log(JSON.stringify({
  stage: t.data.stage,
  stages: t.data.stages,
  confidence: t.data.confidence,
  council_review_ran: t.data.council_review_ran
}));
"
```

## Step 3: Handle Abandoned Tasks

If `stage: abandoned`:
1. Restore to `pre_abandon_stage`
2. Update frontmatter
3. Set as active task
4. Continue with normal routing

## Step 4: Show Resume Summary

```
## Resuming Task

**File:** .do/tasks/<filename>
**Stage:** <stage>
**Confidence:** <score>

### Last Action
<summary from Execution Log or stage status>

### Next
<what will happen when you continue>

Continue? [Y/n]
```

If user declines, stop.

## Step 5: Read Model Config

```bash
node -e "
const c = require('./.do/config.json');
const models = c.models || { default: 'sonnet', overrides: {} };
console.log(JSON.stringify(models));
"
```

## Step 6: Route by Stage

| Stage | Sub-condition | Action |
|-------|---------------|--------|
| `refinement` | stages.refinement: in_progress | Spawn do-planner to finish planning |
| `refinement` | stages.refinement: complete, plan review not ran | Spawn do-plan-reviewer |
| `refinement` | plan review complete, confidence < threshold | Spawn do-griller |
| `refinement` | all complete | Show approval checkpoint, then spawn do-executioner |
| `execution` | stages.execution: in_progress | Spawn do-executioner to continue |
| `execution` | stages.execution: complete | Spawn do-code-reviewer |
| `verification` | any | Spawn do-code-reviewer |
| `verified` | - | Task complete, show UAT checklist |

### Spawn do-planner (resume planning)

```javascript
Agent({
  description: "Continue planning",
  subagent_type: "do-planner",
  model: "<models.overrides.planner || models.default>",
  prompt: `
Continue planning this task.

Task file: .do/tasks/<active_task>

The task file already exists. Read it, complete any missing sections.
Return structured summary when done.
`
})
```

### Spawn do-plan-reviewer

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
`
})
```

### Spawn do-griller

```javascript
Agent({
  description: "Grill for clarity",
  subagent_type: "do-griller",
  model: "<models.overrides.griller || models.default>",
  prompt: `
Task confidence is below threshold. Ask clarifying questions.

Task file: .do/tasks/<active_task>
`
})
```

### Spawn do-executioner (new or resume)

```javascript
Agent({
  description: "Execute task",
  subagent_type: "do-executioner",
  model: "<models.overrides.executioner || models.default>",
  prompt: `
Execute (or continue executing) this task.

Task file: .do/tasks/<active_task>

Check Execution Log for prior progress.
Continue from where it left off.
`
})
```

### Spawn do-code-reviewer

```javascript
Agent({
  description: "Review code",
  subagent_type: "do-code-reviewer",
  model: "<models.overrides.code_reviewer || models.default>",
  prompt: `
Review the code changes from this task.

Task file: .do/tasks/<active_task>
`
})
```

## Step 7: Handle Agent Result

After agent returns, check the result and either:
- Continue to next stage (loop back to Step 6)
- Show completion summary
- Report blocker/failure to user

---

## Files

- **Task template:** @references/task-template.md
