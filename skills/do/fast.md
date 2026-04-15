---
name: do:fast
description: "Lightweight fast path for low-risk, small-surface tasks (1-3 files, no shared abstractions, no schema/auth/API changes). Skips planning ceremony and full verification. Single code review round at the end. Use when the user explicitly says 'fast' or the task is clearly trivial. Triggers on phrases like 'quick fix', 'small tweak', 'fast path', 'minor change', 'just update this'."
argument-hint: '"brief description"'
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

# /do:fast

Lightweight fast path for low-risk, small-surface tasks. Skips plan review, grilling, and verification ceremony. One code review round at the end.

## Why this exists

The full `/do:task` workflow is optimized for correctness — 5-7 agent spawns plus multiple review rounds. For trivial changes (single-file fixes, small tweaks, obvious additions that touch 1-3 files), that overhead is disproportionate. `/do:fast` removes the ceremony while keeping just enough structure for session continuity and quality: quick context scan, execute, validate, single code review.

## Usage

```
/do:fast "description of the small change to make"
```

**Examples:**

- `/do:fast "fix the typo in the header component"`
- `/do:fast "add a missing null check in UserService.parseToken"`
- `/do:fast "update the button color in the theme config"`

---

## Entry Criteria

ALL of the following must be true for `/do:fast` to be valid:

1. Single repo, single concern
2. Small surface area (1-3 files)
3. No new shared abstractions or shared component changes
4. No backend/API contract changes
5. No schema, auth, permissions, or state-machine changes
6. No Jira workflow complexity beyond basic execution
7. No unclear business logic
8. No need for deep debugging

If any criterion fails, redirect to `/do:task`.

**Auto-escalation during execution:** If any criterion stops being true during Steps 6-8 (scope grows, shared abstractions get touched, schema changes needed), abandon and preserve the task. Print:

> "Fast-path criteria no longer met: <reason>. The task has been abandoned and preserved at `.do/tasks/<filename>` for reference. Please run `/do:task "description"` to start fresh with the full workflow."
> Do NOT attempt to automatically hand off to `/do:task`.

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

## Step 3: Validate Entry Criteria

Display the 8 entry criteria as a checklist and ask the user to confirm the task qualifies:

```
## Fast-path entry criteria check

Does your task meet ALL of the following?

- [ ] Single repo, single concern
- [ ] Small surface area (1-3 files)
- [ ] No new shared abstractions or shared component changes
- [ ] No backend/API contract changes
- [ ] No schema, auth, permissions, or state-machine changes
- [ ] No Jira workflow complexity beyond basic execution
- [ ] No unclear business logic
- [ ] No need for deep debugging

If any criterion does not apply, please use `/do:task` instead.
Confirm all criteria are met? [Y/n]
```

If user says no (or expresses doubt), redirect to `/do:task "description"` and stop.

## Step 4: Create Task File and Generate Minimal Approach

Generate task filename and create file:

```bash
TASK_DATE=$(date +%y%m%d)
TASK_SLUG=$(echo "<description>" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | cut -c1-30)
TASK_FILE="${TASK_DATE}-${TASK_SLUG}.md"
```

Create the task file using the Write tool. Use the same format as `@references/task-template.md` but with these fast-path overrides:

```yaml
stage: execution
stages:
  refinement: skipped
  grilling: skipped
  execution: pending
  verification: pending
  abandoned: false
council_review_ran:
  plan: skipped
  code: false
fast_path: true
```

**Critical: Write a minimal Approach section (2-4 numbered bullets) derived inline from the user's description.** Both `do-executioner` and `do-code-reviewer` depend on the Approach section as their source of truth — the executioner uses it as the step-by-step guide and the code reviewer checks completeness against it.

Example — for "fix the typo in the header component":

```markdown
## Approach

1. Locate the header component file and identify the typo
2. Fix the typo
3. Verify the fix looks correct in context
```

Keep the bullets concrete and task-scoped. If the description is too vague to generate meaningful bullets, ask the user for clarification before proceeding.

Also populate Problem Statement with the user's description (keep it brief — 1-3 sentences). Leave Clarifications empty. Context Loaded will be filled in Step 5.

Update config:

```bash
node -e "
const fs = require('fs');
const c = JSON.parse(fs.readFileSync('.do/config.json', 'utf8'));
c.active_task = '${TASK_FILE}';
fs.writeFileSync('.do/config.json', JSON.stringify(c, null, 2));
"
```

## Step 5: Quick Context Scan

Load project context:

```bash
node ~/.claude/commands/do/scripts/load-task-context.cjs
```

This resolves to this project's database entry via `load-task-context.cjs`. Spot-check the files most likely to be affected based on the task description. No deep research, no broad codebase scan.

Update the Context Loaded section in the task file with the files reviewed.

## Step 6: Spawn do-executioner

**CRITICAL: You MUST use the Agent tool to spawn do-executioner. Do NOT make changes to files yourself — not even a single-line edit, not even a typo fix. The point of spawning a sub-agent is independent execution with its own context and tool access. Skipping the Agent call and editing inline defeats the workflow and breaks session continuity.**

Read model config:

```bash
node -e "
const c = require('./.do/config.json');
const models = c.models || { default: 'sonnet', overrides: {} };
console.log(JSON.stringify(models));
"
```

Spawn executioner:

```javascript
Agent({
  description: "Execute fast-path task: <description>",
  subagent_type: "do-executioner",
  model: "<models.overrides.executioner || models.default>",
  prompt: `
Execute the plan in this task file.

Task file: .do/tasks/<active_task>

Follow the Approach section step by step. Log each action to the Execution Log. Handle deviations appropriately. Return a summary when complete.
`,
});
```

Handle result:

- **COMPLETE**: Continue to Step 7
- **BLOCKED**: Show blocker, ask user for resolution. Stop — do not attempt to continue automatically.
- **FAILED**: Show error with last good state and task file path for `/do:continue` resume. Stop.

## Step 7: Fast-path Stage Override

**Immediately after do-executioner returns** — before any other action — override the stage:

```bash
node -e "
const fm = require('gray-matter');
const fs = require('fs');
const filePath = '.do/tasks/<active_task>';
const raw = fs.readFileSync(filePath, 'utf8');
const parsed = fm(raw);
parsed.data.stage = 'execution';
parsed.data.stages = { ...parsed.data.stages, execution: 'review_pending' };
const out = fm.stringify(parsed.content, parsed.data);
fs.writeFileSync(filePath, out);
console.log('Stage overridden to execution/review_pending');
"
```

**Why:** The executioner sets `stage: verification` (its standard contract) but the fast path skips do-verifier entirely. The `review_pending` sub-state is unique to fast-path tasks and signals "executioner done, awaiting fast code review." It does not collide with the normal pipeline (where `stages.execution: complete` routes to the full code review + council flow).

## Step 8: Discover and Run Validation

**Detect available validation scripts:**

```bash
node -e "
const pkg = require('./package.json');
const scripts = pkg.scripts || {};
const checks = ['lint', 'typecheck', 'check-types', 'format', 'test'];
const available = checks.filter(k => scripts[k]);
const missing = checks.filter(k => !scripts[k]);
console.log(JSON.stringify({ available, missing }));
"
```

Run each available script via `npm run <key>`. For missing scripts, log "Skipped <key>: not available in package.json". Do NOT assume any script exists — detection must be explicit.

**Additionally:**

- Check if a `__tests__/` directory exists near any changed files. If it does, run those tests directly (e.g., `node --test skills/do/scripts/__tests__/`).
- Check if prettier is available (`node_modules/.bin/prettier` or `npx prettier --version`). If available, run `npx prettier --write` on changed files only.

Log validation results in the task file's Execution Log.

## Step 9: Single Code Review Round

**CRITICAL: You MUST use the Agent tool to spawn do-code-reviewer. Do NOT review the changes yourself inline — not even a quick read-through. An independent agent with fresh context is required. Inline review defeats the purpose and misses things the orchestrator already knows about.**

Spawn do-code-reviewer **only** — no council reviewer, no parallel spawning:

```javascript
Agent({
  description: "Fast-path code review",
  subagent_type: "do-code-reviewer",
  model: "<models.overrides.code_reviewer || models.default>",
  prompt: `
Review the code changes from this task execution.

Task file: .do/tasks/<active_task>

Read the task file and git diff, evaluate the changes against the 6 criteria (Correctness, Quality, Tests, Types, Security, Completeness), and return APPROVED, NITPICKS_ONLY, or CHANGES_REQUESTED with file:line references.
`,
});
```

**Handle result:**

### If APPROVED or NITPICKS_ONLY

Log any nitpicks (non-blocking). Update task frontmatter:

```yaml
council_review_ran:
  code: true
stage: complete
```

Continue to Step 10.

### If CHANGES_REQUESTED (first time)

Spawn do-executioner with the fix instructions:

```javascript
Agent({
  description: "Fix fast-path code review issues",
  subagent_type: "do-executioner",
  model: "<models.overrides.executioner || models.default>",
  prompt: `
Fix the issues identified in code review.

Task file: .do/tasks/<active_task>

Issues to fix:
<findings from do-code-reviewer with file:line references>

Fix each issue. Log changes in the Execution Log. Return summary when complete.
`,
});
```

After executioner completes, re-run Step 7 (override stage back to `execution: review_pending`), then re-spawn do-code-reviewer once more (go back to the top of Step 9).

### If CHANGES_REQUESTED (second time — escalation)

Abandon the task:

```bash
node -e "
const fm = require('gray-matter');
const fs = require('fs');
const filePath = '.do/tasks/<active_task>';
const raw = fs.readFileSync(filePath, 'utf8');
const parsed = fm(raw);
parsed.data.abandoned = true;
parsed.data.pre_abandon_stage = 'execution';
parsed.data.fast_path = false;
const out = fm.stringify(parsed.content, parsed.data);
fs.writeFileSync(filePath, out);
console.log('Task abandoned');
"
```

Then clear the active task from config:

```bash
node -e "
const fs = require('fs');
const c = JSON.parse(fs.readFileSync('.do/config.json', 'utf8'));
c.active_task = null;
fs.writeFileSync('.do/config.json', JSON.stringify(c, null, 2));
"
```

Print this message:

> "Fast-path review failed twice. The task has been abandoned and preserved at `.do/tasks/<filename>` for reference. Please run `/do:task "description"` to start fresh with the full workflow."

**Stop.** Do NOT attempt to silently fall through to `/do:continue` routing or re-enter `/do:task` automatically. The user must invoke `/do:task` themselves.

## Step 10: Completion

Display brief completion summary:

```
## Fast-path task complete

**Task:** .do/tasks/<filename>
**Changes:** <summary of what was changed>
**Validation:** <what passed / what was skipped>
**Review:** APPROVED (or NITPICKS_ONLY — nitpicks logged)
```

Do-verifier is skipped entirely — no approach checklist, no UAT. The change is too small to warrant it.

## Step 11: Remind about /skill-creator

After all implementation is complete, remind the user:

> "If any skill files were created or heavily edited during this task, invoke `/skill-creator` to review and polish them. Do not invoke it automatically."

---

## Fast-path State Machine

```
Step 4:  stage: execution,     stages.execution: pending        (task created)
Step 6:  stage: verification,  stages.execution: complete       (executioner standard behavior)
Step 7:  stage: execution,     stages.execution: review_pending (fast skill overrides)
Step 9a: stage: complete                                        (review passes)
Step 9b: stage: execution,     stages.execution: review_pending (CHANGES_REQUESTED, after re-exec)
Step 9c: abandoned: true, pre_abandon_stage: execution          (escalation — user runs /do:task fresh)
```

Key invariant: `fast_path: true` + `stages.execution: review_pending` is the only state that triggers the fast code review path. This value never appears in the normal pipeline — zero collision with existing `/do:continue` routing.

---

## Failure Handling

Any agent failure returns immediately to the user with:

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
- **Context loader:** @scripts/load-task-context.cjs
