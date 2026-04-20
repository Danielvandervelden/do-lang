---
name: stage-fast-exec
description: Fast-path execution block. Task-file creation, quick context scan, do-executioner spawn, stage override, validation, single code-review round, completion, and /skill-creator reminder. Invoked by do:fast (after entry-criteria confirmation) and by do:task (when Step 0 routes to fast).
---

# Fast Execution Stage

This reference file is loaded by `do:fast` (after entry-criteria confirmation) and by `do:task` (when Step 0 routes to `fast`). It encodes the full fast-path execution logic from task-file creation through completion.

**Caller contract:** Caller has already validated prerequisites, checked for an active task, and confirmed the entry criteria (or selected "fast" via the Step 0 router). Caller passes `<description>` as an in-session variable (the `$ARGUMENTS` value or the router's description argument) substituted into the prompt at load time. No scratch files, no config mutation by the caller. Model config (`models` object) is also passed as an in-session variable having been read in the caller's model-config step. An optional `delivery_contract` in-session variable may be passed — if present, it is a fully validated and defaults-applied delivery object produced by `validate-delivery-contract.cjs`; if absent or null, delivery sections are left empty. Working directory is the project root at invocation time; this reference assumes relative paths from there.

When this stage returns, the task is complete (or escalation has been printed and execution has stopped).

---

## FE-1: Create Task File and Generate Minimal Approach

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

**Delivery contract threading:** If `delivery_contract` in-session variable is non-null, populate the `delivery:` frontmatter fields and render the `## Delivery Contract` markdown section (between `## Problem Statement` and `## Clarifications`) with the contract data:

```markdown
## Delivery Contract

- **Branch:** <delivery_contract.branch>
- **Commit prefix:** <delivery_contract.commit_prefix>
- **Push policy:** <delivery_contract.push_policy>
- **PR policy:** <delivery_contract.pr_policy>
- **Stop after push:** <delivery_contract.stop_after_push>
- **Exclude paths:** <delivery_contract.exclude_paths.join(', ')>
```

If `delivery_contract` is null or absent, leave both sections empty (commented-out defaults in frontmatter, empty comment block in markdown section).

**Critical: Write a minimal Approach section (2-4 numbered bullets) derived inline from the user's description.** Both `do-executioner` and `do-code-reviewer` depend on the Approach section as their source of truth — the executioner uses it as the step-by-step guide and the code reviewer checks completeness against it.

Example — for "fix the typo in the header component":

```markdown
## Approach

1. Locate the header component file and identify the typo
2. Fix the typo
3. Verify the fix looks correct in context
```

Keep the bullets concrete and task-scoped. If the description is too vague to generate meaningful bullets, ask the user for clarification before proceeding.

Also populate Problem Statement with the user's description (keep it brief — 1-3 sentences). Leave Clarifications empty. Context Loaded will be filled in FE-2.

Update config:

```bash
node -e "
const fs = require('fs');
const c = JSON.parse(fs.readFileSync('.do/config.json', 'utf8'));
c.active_task = '${TASK_FILE}';
fs.writeFileSync('.do/config.json', JSON.stringify(c, null, 2));
"
```

---

## FE-2: Quick Context Scan

Load project context:

```bash
node ~/.claude/commands/do/scripts/load-task-context.cjs
```

This resolves to this project's database entry via `load-task-context.cjs`. Spot-check the files most likely to be affected based on the task description. No deep research, no broad codebase scan.

Update the Context Loaded section in the task file with the files reviewed.

---

## FE-3: Spawn do-executioner

**CRITICAL: You MUST use the Agent tool to spawn do-executioner. Do NOT make changes to files yourself — not even a single-line edit, not even a typo fix. The point of spawning a sub-agent is independent execution with its own context and tool access. Skipping the Agent call and editing inline defeats the workflow and breaks session continuity.**

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

- **COMPLETE**: Continue to FE-4
- **BLOCKED**: Show blocker, ask user for resolution. Stop — do not attempt to continue automatically.
- **FAILED**: Show error with last good state and task file path for `/do:continue` resume. Stop.

---

## FE-4: Fast-path Stage Override

**Immediately after do-executioner returns** — before any other action — override the stage:

```bash
node @scripts/update-task-frontmatter.cjs set '.do/tasks/<active_task>' stage=execution stages.execution=review_pending
```

**Why:** The executioner sets `stage: verification` (its standard contract) but the fast path skips do-verifier entirely. The `review_pending` sub-state is unique to fast-path tasks and signals "executioner done, awaiting fast code review." It does not collide with the normal pipeline (where `stages.execution: complete` routes to the full code review + council flow).

---

## FE-5: Discover and Run Validation

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

---

## FE-6: Single Code Review Round

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

Continue to FE-7.

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

After executioner completes, re-run FE-4 (override stage back to `execution: review_pending`), then re-spawn do-code-reviewer once more (go back to the top of FE-6).

### If CHANGES_REQUESTED (second time — escalation)

Abandon the task:

```bash
node @scripts/update-task-frontmatter.cjs set '.do/tasks/<active_task>' abandoned=true pre_abandon_stage=execution fast_path=false
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

---

## FE-7: Completion

**Backlog cleanup:** Read the `backlog_item` field from the active task's frontmatter. If non-null, invoke `/do:backlog done <id>` to remove the item from BACKLOG.md. Log: "Removed backlog item `<id>` from BACKLOG.md."

Display brief completion summary:

```
## Fast-path task complete

**Task:** .do/tasks/<filename>
**Changes:** <summary of what was changed>
**Validation:** <what passed / what was skipped>
**Review:** APPROVED (or NITPICKS_ONLY — nitpicks logged)
```

Do-verifier is skipped entirely — no approach checklist, no UAT. The change is too small to warrant it.

---

## FE-8: Remind about /skill-creator

After all implementation is complete, remind the user:

> "If any skill files were created or heavily edited during this task, invoke `/skill-creator` to review and polish them. Do not invoke it automatically."

---

## Fast-path State Machine

```
FE-1: stage: execution,     stages.execution: pending        (task created)
FE-3: stage: verification,  stages.execution: complete       (executioner standard behavior)
FE-4: stage: execution,     stages.execution: review_pending (fast skill overrides)
FE-6a: stage: complete                                       (review passes)
FE-6b: stage: execution,    stages.execution: review_pending (CHANGES_REQUESTED, after re-exec)
FE-6c: abandoned: true, pre_abandon_stage: execution         (escalation — user runs /do:task fresh)
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
