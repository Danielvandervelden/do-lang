---
name: stage-plan-review
description: Orchestrator plan review block. Council gate check, parallel reviewer spawning (when enabled), verdict combination, iteration loop via do-planner, and escalation rules.
---

# Plan Review Stage

This reference file is loaded by `do:task` (Step 6) and `do:continue` (stage routing for `refinement` + plan review not ran). It encodes the full plan review logic including council gate, parallel spawning, verdict combination, iteration, and escalation.

**Caller contract:** When this stage returns APPROVED, `council_review_ran.plan: true` has been updated in the task frontmatter — continue to the next step. If ESCALATE or MAX_ITERATIONS, stop and present to the user. The caller does NOT need to spawn any agents — this stage owns the full loop.

---

## PR-0: Resume Guard

Check if plan review already ran:

```bash
node -e "const fm=require('gray-matter'); const t=fm(require('fs').readFileSync('.do/tasks/<active_task>','utf8')); process.exit(t.data.council_review_ran?.plan === true ? 1 : 0)"
```

**If already ran (exit 1):** Skip this entire stage. Return control to caller immediately.

---

## PR-1: Council Gate Check

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
console.log(cfg.council_reviews?.planning === true ? 'enabled' : 'disabled');
"
```

Store result as `council_enabled` (enabled/disabled).

---

## PR-2: Initialize Iteration Counter

Set `review_iterations = 0` (in-session variable, not persisted to task file).

---

## PR-3: Spawn Reviewers

### PR-3a: If council enabled

Spawn TWO agents in a SINGLE message (both Agent calls in one response):

```javascript
// Both calls sent in the same message — parallel dispatch
Agent({
  description: "Self-review plan",
  subagent_type: "do-plan-reviewer",
  model: "<models.overrides.plan_reviewer || models.default>",
  prompt: `
Review the plan in this task file.

Task file: .do/tasks/<active_task>

Read the task file, evaluate the plan against the 5 criteria (Clarity, Completeness, Feasibility, Atomicity, Risks), and return PASS, CONCERNS, or RETHINK with evidence.
`
})

Agent({
  description: "Council review plan",
  subagent_type: "do-council-reviewer",
  model: "<models.overrides.plan_reviewer || models.default>",
  prompt: `
Run council review for this task plan.

Task file: .do/tasks/<active_task>
Review type: plan
Workspace: <pwd>

Run council-invoke.cjs --type plan and return the structured verdict.
`
})
```

Wait for BOTH agents to complete before proceeding to PR-4.

### PR-3b: If council disabled

Spawn only do-plan-reviewer:

```javascript
Agent({
  description: "Self-review plan (council disabled)",
  subagent_type: "do-plan-reviewer",
  model: "<models.overrides.plan_reviewer || models.default>",
  prompt: `
Review the plan in this task file.

Task file: .do/tasks/<active_task>

Read the task file, evaluate the plan against the 5 criteria (Clarity, Completeness, Feasibility, Atomicity, Risks), and return PASS, CONCERNS, or RETHINK with evidence.
`
})
```

Apply single-review fallback in PR-4b (skip PR-4a).

---

## PR-4: Combine Verdicts

### PR-4a: Two-reviewer combination (council enabled)

Collect `self_verdict` (PASS/CONCERNS/RETHINK) from do-plan-reviewer and `council_verdict` (LOOKS_GOOD/CONCERNS/RETHINK) from do-council-reviewer.

| Self-Review | Council | Combined |
|-------------|---------|----------|
| PASS | LOOKS_GOOD | **APPROVED** |
| PASS | CONCERNS | **ITERATE** |
| PASS | RETHINK | **ITERATE** |
| CONCERNS | LOOKS_GOOD | **ITERATE** |
| CONCERNS | CONCERNS | **ITERATE** |
| CONCERNS | RETHINK | **ESCALATE** |
| RETHINK | any | **ESCALATE** |

### PR-4b: Single-reviewer fallback (council disabled)

Map self-reviewer verdict directly:

| Self-Review | Combined |
|-------------|----------|
| PASS | **APPROVED** |
| CONCERNS | **ITERATE** |
| RETHINK | **ESCALATE** |

---

## PR-5: Handle Combined Verdict

### If APPROVED

Update task frontmatter:
```yaml
council_review_ran:
  plan: true
```

Return control to caller (continue to next step).

### If ITERATE (and review_iterations < 3)

1. Increment `review_iterations`
2. Compile combined findings from both reviewers (or single reviewer if council disabled)
3. Log the iteration in the task file:
   ```markdown
   ## Review Iterations

   ### Iteration <N>
   - **Self-review:** <verdict> - <summary of findings>
   - **Council:** <verdict> - <summary> (or "disabled")
   - **Changes made:** (pending — do-planner will revise)
   ```
4. Spawn do-planner with reviewer feedback as revision instructions:
   ```javascript
   Agent({
     description: "Revise plan based on review feedback",
     subagent_type: "do-planner",
     model: "<models.overrides.planner || models.default>",
     prompt: `
   Revise the plan based on review feedback.

   Task file: .do/tasks/<active_task>
   Reviewer feedback: <combined findings from self-review and council>

   Update the Approach and/or Concerns sections to address the issues listed.
   Do not change the Problem Statement unless a reviewer explicitly flagged it.
   Return a summary of changes made.
   `
   })
   ```
5. Wait for do-planner to complete
6. Update the iteration log entry with "Changes made: <planner summary>"
7. Return to PR-3 and re-spawn both reviewers

### If ITERATE (and review_iterations = 3)

Escalate with MAX_ITERATIONS:

```markdown
## PLAN REVIEW: MAX ITERATIONS

**Iterations:** 3/3
**Status:** Could not resolve all concerns after 3 attempts

### Outstanding Issues
<list remaining concerns from latest reviewer feedback>

### Options
1. Proceed anyway (acknowledge risks)
2. Revise plan manually and run /do:continue
3. Abandon task
```

Stop and await user decision.

### If ESCALATE

Return immediately to user:

```markdown
## PLAN REVIEW: NEEDS USER INPUT

**Self-Review:** <verdict>
**Council:** <verdict> (or "disabled")

### Critical Issues
<list the RETHINK-level concerns with evidence>

### Reviewer Recommendations
<list suggestions from reviewers>

User decision required before proceeding.
```

Stop and await user decision.
