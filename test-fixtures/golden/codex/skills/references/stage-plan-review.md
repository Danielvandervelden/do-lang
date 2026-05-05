---
name: stage-plan-review
description: Orchestrator plan review block. Council gate check, parallel reviewer spawning (when enabled), verdict combination, iteration loop via codex-planner, and escalation rules.
---

**Agent authorization:** The caller workflow has authorized spawning all agents
referenced in this file (codex-plan-reviewer, codex-council-reviewer, codex-planner
on ITERATE). Spawn them as subagents — do NOT execute their work inline. If spawning
fails, STOP and report; do not fall back to inline execution.

# Plan Review Stage

This reference file is loaded by `do:task` (Step 6) and `do:continue` (stage routing for `refinement` + plan review not ran). It encodes the full plan review logic including council gate, parallel spawning, verdict combination, iteration, and escalation.

**Caller contract:** When this stage returns APPROVED, `council_review_ran.plan: true` has been updated in the task frontmatter — continue to the next step. If ESCALATE or MAX_ITERATIONS, stop and present to the user. The caller does NOT need to spawn any agents — this stage owns the full loop.

---

## PR-0: Resume Guard

Check if plan review already ran:

```bash
node ~/.codex/skills/do/scripts/update-task-frontmatter.cjs check '.do/tasks/<active_task>' council_review_ran.plan
```

**If already ran (exit 1):** Skip this entire stage. Return control to caller immediately.

---

## PR-1: Council Gate Check

Resolve config using the cascade (project → workspace → defaults):

```bash
node ~/.codex/skills/do/scripts/council-gate.cjs planning
```

Store result as `council_enabled` (enabled/disabled).

---

## PR-2: Initialize Iteration Counter

Set `review_iterations = 0` (in-session variable, not persisted to task file).

---

## PR-3: Spawn Reviewers

### PR-3a: If council enabled

In a single response, spawn BOTH of the following subagents (parallel dispatch — do NOT wait between them):

Spawn the codex-plan-reviewer subagent with model `<models.overrides.plan_reviewer || models.default>` and the description "Self-review plan". Pass the following prompt:

Review the plan in this task file.

Task file: .do/tasks/<active_task>

Read the task file, evaluate the plan against the 5 criteria (Clarity, Completeness, Feasibility, Atomicity, Risks), and return PASS, CONCERNS, or RETHINK with evidence.

Spawn the codex-council-reviewer subagent with model `<models.overrides.plan_reviewer || models.default>` and the description "Council review plan". Pass the following prompt:

Run council review for this task plan.

Task file: .do/tasks/<active_task>
Review type: plan
Workspace: <pwd>

Run council-invoke.cjs --type plan and return the structured verdict.

Wait for BOTH subagents to complete before proceeding to PR-4.

### PR-3b: If council disabled

Spawn the codex-plan-reviewer subagent with model `<models.overrides.plan_reviewer || models.default>` and the description "Self-review plan (council disabled)". Pass the following prompt:

Review the plan in this task file.

Task file: .do/tasks/<active_task>

Read the task file, evaluate the plan against the 5 criteria (Clarity, Completeness, Feasibility, Atomicity, Risks), and return PASS, CONCERNS, or RETHINK with evidence.

Apply single-review fallback in PR-4b (skip PR-4a).

---

## PR-4: Combine Verdicts

### PR-4a: Two-reviewer combination (council enabled)

Collect `self_verdict` (PASS/CONCERNS/RETHINK) from codex-plan-reviewer and `council_verdict` (LOOKS_GOOD/CONCERNS/RETHINK) from codex-council-reviewer.

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

## PR-4.5: Classify Findings (when combined verdict is ITERATE)

When the combined verdict from PR-4 is ITERATE, classify findings before deciding the action.

Load and follow `@references/classify-findings.md`. The self-review output comes from codex-plan-reviewer (CONCERNS or RETHINK response).

---

## PR-5: Handle Combined Verdict

### If APPROVED

**Codex cleanup (council enabled path):** Both codex-plan-reviewer and codex-council-reviewer subagents have completed and their output has been fully consumed. Close (dismiss) both subagents now to free thread slots before returning APPROVED to the caller.

**Codex cleanup (council disabled path):** The codex-plan-reviewer subagent has completed and its output has been fully consumed. Close (dismiss) the subagent now to free the thread slot before returning APPROVED to the caller.

Update task frontmatter:
```yaml
council_review_ran:
  plan: true
```

Return control to caller (continue to next step).

### If ITERATE

**Step 1: Increment the iteration counter.**

Increment `review_iterations` BEFORE calling `planReviewDecisionMatrix()`. This ensures the matrix sees the count for the current round, not the previous round. Nitpick-only rounds also increment the counter, but since `planReviewDecisionMatrix()` returns `INLINE_NITPICKS` regardless of count, the cap only applies to blocker rounds. The effective cap is:
- Round 1 calls matrix with `reviewIterations=1`
- Round 2 calls matrix with `reviewIterations=2`
- Round 3 calls matrix with `reviewIterations=3` → MAX_ITERATIONS

**Step 2: Call `planReviewDecisionMatrix(classifiedFindings, reviewIterations)`** from `stage-decision.cjs` to determine the action.

**The orchestrator constructs the actual invocation — this is not a copy-paste script.** The `classified_findings_json` produced by PR-4.5 is safe JSON (no unescaped shell metacharacters in the structure), but finding text may contain apostrophes that would break a single-quoted shell string. Use the temp-file approach or write the JSON to a file first.

**Instructions for the orchestrator:**

1. Take the `classified_findings_json` string captured from PR-4.5 stdout (e.g. `{"blockers":["[blocker] scope gap"],"nitpicks":["[nitpick] typo"]}`).
2. Write it to a temp file (e.g. `/tmp/do-classified.json`) to avoid shell quoting issues with apostrophes in finding text.
3. Resolve the `stage-decision.cjs` path (installed or dev):
   - Installed: `~/.codex/skills/do/scripts/stage-decision.cjs`
   - Dev: `<cwd>/skills/scripts/stage-decision.cjs`
4. Run `planReviewDecisionMatrix(classifiedFindings, reviewIterations)` where `classifiedFindings` is the parsed JSON object and `reviewIterations` is the already-incremented integer iteration count.
5. Capture the JSON result and branch on `result.action`.

Example invocation using the temp file from step 2 (the orchestrator adapts this):

```bash
# /tmp/do-classified.json was written in step 2 with the classified_findings_json content
# review_iterations has already been incremented before this call (e.g. 1 for round 1)
node -e "
const path = require('path');
const fs = require('fs');
const installedPath = path.join(require('os').homedir(), '.codex/skills/do/scripts/stage-decision.cjs');
const devPath = path.join(process.cwd(), 'skills/scripts/stage-decision.cjs');
const scriptPath = fs.existsSync(installedPath) ? installedPath : devPath;
const { planReviewDecisionMatrix } = require(scriptPath);
const classified = JSON.parse(fs.readFileSync('/tmp/do-classified.json', 'utf8'));
const result = planReviewDecisionMatrix(classified, <review_iterations>);
console.log(JSON.stringify(result));
"
```

Note: `<review_iterations>` is a bare integer (e.g. `1`, `2`, `3`) — it contains no special characters and is safe to substitute directly into the script. The value used here must already be incremented (see Step 1 above).

Branch on `result.action`:

#### If `INLINE_NITPICKS` (all findings are nitpicks)

Apply each nitpick inline using Edit tool calls — the orchestrator does this directly, no subagent spawn. Log the inline patches in the task file:

```markdown
### Iteration <N>
- **Self-review:** <verdict> - <summary of findings>
- **Council:** <verdict> - <summary> (or "disabled")
- **Changes made:** Inline nitpick edits applied (see Inline Patches below)

#### Inline Patches
- Nitpick: <description> — Applied: <what was changed>
```

Then convert to APPROVED for the caller: set `council_review_ran.plan: true` and return APPROVED. The caller contract only exposes APPROVED as a success branch — INLINE_NITPICKS never surfaces beyond this stage. No re-review loop. **Nitpick-only rounds do NOT count against the 3-iteration cap.**

#### If `RESPAWN` (any finding is a blocker)

1. Log the iteration in the task file (iteration counter was already incremented before the matrix call):
   ```markdown
   ## Review Iterations

   ### Iteration <N>
   - **Self-review:** <verdict> - <summary of findings>
   - **Council:** <verdict> - <summary> (or "disabled")
   - **Changes made:** (pending — codex-planner will revise)
   ```
1.5. **Codex cleanup (council enabled path):** Both codex-plan-reviewer and codex-council-reviewer subagents have completed and their output has been fully consumed. Close (dismiss) both subagents now to free thread slots before spawning codex-planner for revision.

**Codex cleanup (council disabled path):** The codex-plan-reviewer subagent has completed and its output has been fully consumed. Close (dismiss) the subagent now to free the thread slot before spawning codex-planner for revision.
2. Spawn codex-planner with ALL findings (blockers + nitpicks bundled):

   Spawn the codex-planner subagent with model `<models.overrides.planner || models.default>` and the description "Revise plan based on review feedback". Pass the following prompt:

   Revise the plan based on review feedback.

   Task file: .do/tasks/<active_task>
   Reviewer feedback (blockers — must fix):
   <result.blockers joined with newlines>
   Reviewer feedback (nitpicks — should fix):
   <result.nitpicks joined with newlines>

   Update the Approach and/or Concerns sections to address all issues.
   Do not change the Problem Statement unless a reviewer explicitly flagged it.
   Return a summary of changes made.

3. Wait for codex-planner to complete
4. Update the iteration log entry with "Changes made: <planner summary>"
5. **Codex cleanup:** The codex-planner subagent has completed and its output has been fully consumed. Close (dismiss) the codex-planner subagent now to free the thread slot before returning to PR-3.
6. Return to PR-3 and re-spawn both reviewers

#### If `MAX_ITERATIONS`

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

#### If `APPROVED` (empty findings — handled gracefully)

Update task frontmatter and return APPROVED (same as the APPROVED branch above).

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
