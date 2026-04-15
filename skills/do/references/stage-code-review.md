---
name: stage-code-review
description: Orchestrator code review block. Council gate check, parallel reviewer spawning (when enabled), verdict combination, iteration loop via do-executioner, stage update, and escalation rules.
---

# Code Review Stage

This reference file is loaded by `do:task` (Step 10) and `do:continue` (stage routing for `execution` + stages.execution: complete). It encodes the full code review logic including council gate, parallel spawning, verdict combination, iteration, stage update, and escalation.

**Caller contract:** When this stage returns VERIFIED, the task file has been updated with `stage: verification`, `stages.verification: pending`, and `council_review_ran.code: true`. Continue to do-verifier. If MAX_ITERATIONS, stop and present to the user.

---

## CR-0: Resume Guard

Check if code review already ran:

```bash
node -e "const fm=require('gray-matter'); const t=fm(require('fs').readFileSync('.do/tasks/<active_task>','utf8')); process.exit(t.data.council_review_ran?.code === true ? 1 : 0)"
```

**If already ran (exit 1):** Skip this entire stage. Return control to caller (proceed to do-verifier).

---

## CR-1: Council Gate Check

Resolve config using the cascade (project → workspace → defaults):

```bash
node -e "
const path = require('path');
const fs = require('fs');
const installedPath = path.join(require('os').homedir(), '.claude/commands/do/scripts/council-invoke.cjs');
const devPath = path.join(process.cwd(), 'skills/do/scripts/council-invoke.cjs');
const scriptPath = fs.existsSync(installedPath) ? installedPath : devPath;
const { resolveConfig } = require(scriptPath);
const cfg = resolveConfig('.do/config.json', process.cwd());
console.log(cfg.council_reviews?.execution === true ? 'enabled' : 'disabled');
"
```

Store result as `council_enabled` (enabled/disabled).

---

## CR-2: Initialize Iteration Counter

Set `code_review_iterations = 0` (in-session variable, not persisted to task file).

---

## CR-3: Spawn Reviewers

### CR-3a: If council enabled

Spawn TWO agents in a SINGLE message (both Agent calls in one response):

```javascript
// Both calls sent in the same message — parallel dispatch
Agent({
  description: "Self-review code",
  subagent_type: "do-code-reviewer",
  model: "<models.overrides.code_reviewer || models.default>",
  prompt: `
Review the code changes from this task execution.

Task file: .do/tasks/<active_task>

Read the task file and git diff, evaluate the changes against the 6 criteria (Correctness, Quality, Tests, Types, Security, Completeness), and return APPROVED, NITPICKS_ONLY, or CHANGES_REQUESTED with file:line references.
`
})

Agent({
  description: "Council review code",
  subagent_type: "do-council-reviewer",
  model: "<models.overrides.code_reviewer || models.default>",
  prompt: `
Run council review for this task's code changes.

Task file: .do/tasks/<active_task>
Review type: code
Workspace: <pwd>

Run council-invoke.cjs --type code and return the structured verdict.
`
})
```

Wait for BOTH agents to complete before proceeding to CR-4.

### CR-3b: If council disabled

Spawn only do-code-reviewer:

```javascript
Agent({
  description: "Self-review code (council disabled)",
  subagent_type: "do-code-reviewer",
  model: "<models.overrides.code_reviewer || models.default>",
  prompt: `
Review the code changes from this task execution.

Task file: .do/tasks/<active_task>

Read the task file and git diff, evaluate the changes against the 6 criteria (Correctness, Quality, Tests, Types, Security, Completeness), and return APPROVED, NITPICKS_ONLY, or CHANGES_REQUESTED with file:line references.
`
})
```

Apply single-review fallback in CR-4b (skip CR-4a).

---

## CR-4: Combine Verdicts

### CR-4a: Two-reviewer combination (council enabled)

Collect `self_verdict` (APPROVED/NITPICKS_ONLY/CHANGES_REQUESTED) from do-code-reviewer and `council_verdict` (APPROVED/NITPICKS_ONLY/CHANGES_REQUESTED) from do-council-reviewer.

| Self-Review | Council | Combined |
|-------------|---------|----------|
| APPROVED | APPROVED | **VERIFIED** |
| APPROVED | NITPICKS_ONLY | **VERIFIED** (log nitpicks) |
| NITPICKS_ONLY | APPROVED | **VERIFIED** (log nitpicks) |
| NITPICKS_ONLY | NITPICKS_ONLY | **VERIFIED** (log nitpicks) |
| APPROVED | CHANGES_REQUESTED | **ITERATE** |
| CHANGES_REQUESTED | any | **ITERATE** |
| any | CHANGES_REQUESTED | **ITERATE** |

### CR-4b: Single-reviewer fallback (council disabled)

Map self-reviewer verdict directly:

| Self-Review | Combined |
|-------------|----------|
| APPROVED | **VERIFIED** |
| NITPICKS_ONLY | **VERIFIED** (log nitpicks) |
| CHANGES_REQUESTED | **ITERATE** |

---

## CR-5: Handle Combined Verdict

### If VERIFIED

1. Log any nitpicks to the task file (non-blocking)
2. Update task frontmatter (merge — do not replace the full object):
   ```yaml
   stage: verification
   stages:
     verification: pending
   council_review_ran:
     code: true   # merge into existing object — plan: true is already set
   ```
3. Return control to caller (continue to do-verifier).

### If ITERATE (and code_review_iterations < 3)

1. Increment `code_review_iterations`
2. Compile combined findings from both reviewers (or single reviewer if council disabled)
3. Spawn do-executioner with combined findings as fix instructions:
   ```javascript
   Agent({
     description: "Fix code review issues (iteration <N>)",
     subagent_type: "do-executioner",
     model: "<models.overrides.executioner || models.default>",
     prompt: `
   Fix the issues identified in code review.

   Task file: .do/tasks/<active_task>

   Issues to fix:
   <combined findings from both reviewers with file:line references>

   Fix each issue. Log changes in the Execution Log. Return summary when complete.
   `
   })
   ```
4. Wait for do-executioner to complete
5. Log the iteration in the task file:
   ```markdown
   ## Code Review Iterations

   ### Iteration <N>
   - **Self-review:** <verdict>
     - <issue 1> at file:line
   - **Council:** <verdict> (or "disabled")
     - <issue 1> at file:line
   - **Action:** Spawned do-executioner with combined findings; executor completed
   ```
6. Return to CR-3 and re-spawn both review agents

### If ITERATE (and code_review_iterations = 3)

Escalate with MAX_ITERATIONS:

```markdown
## CODE REVIEW: MAX ITERATIONS

**Iterations:** 3/3
**Status:** Could not resolve all issues after 3 attempts

### Outstanding Issues
<list remaining issues with file:line references>

### Options
1. Proceed anyway (ship with known issues)
2. Fix manually and run /do:continue
3. Abandon task
```

Stop and await user decision.
