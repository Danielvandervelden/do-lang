---
name: stage-wave-plan-review
description: "Wave plan review block for /do:project. Council gate check, parallel reviewer spawning (when enabled), verdict combination, iteration loop via do-planner, and escalation rules. Target file: wave.md."
---

# Wave Plan Review Stage

This reference file is loaded by `skills/do/project.md` `wave next` after the per-wave confidence rescue check. It encodes the full plan review logic for `wave.md`.

**Caller contract:** The caller provides `<wave_path>` = abs path to `wave.md`, `<active_project>` slug, `<phase_slug>`, and `<wave_slug>`. When this stage returns APPROVED, `council_review_ran.plan: true` has been written into `wave.md`'s frontmatter — the `wave next` handler then proceeds to `stage-wave-exec.md`. If ESCALATE or MAX_ITERATIONS, stop and present to the user.

---

## PR-0: Resume Guard

Check if wave plan review already ran:

```bash
node -e "
const fm = require('gray-matter');
const t = fm(require('fs').readFileSync('<wave_path>', 'utf8'));
process.exit(t.data.council_review_ran?.plan === true ? 1 : 0)
"
```

**If already ran (exit 1):** Skip this entire stage. Return control to caller (proceed to `stage-wave-exec.md`).

---

## PR-1: Council Gate Check

```bash
node -e "
const path = require('path');
const fs = require('fs');
const installedPath = path.join(require('os').homedir(), '.claude/commands/do/scripts/council-invoke.cjs');
const devPath = path.join(process.cwd(), 'skills/do/scripts/council-invoke.cjs');
const scriptPath = fs.existsSync(installedPath) ? installedPath : devPath;
const { resolveConfig } = require(scriptPath);
const cfg = resolveConfig('.do/config.json', process.cwd());
// Prefer project-specific key; fall back to planning key
const enabled = cfg.council_reviews?.project?.wave_plan !== undefined
  ? cfg.council_reviews.project.wave_plan === true
  : cfg.council_reviews?.planning === true;
console.log(enabled ? 'enabled' : 'disabled');
"
```

Store result as `council_enabled` (enabled/disabled).

---

## PR-2: Initialize Iteration Counter

Set `review_iterations = 0` (in-session variable, not persisted).

---

## PR-3: Spawn Reviewers

### PR-3a: If council enabled

Spawn TWO agents in a SINGLE message (both Agent calls in one response):

```javascript
Agent({
  description: "Self-review wave plan",
  subagent_type: "do-plan-reviewer",
  model: "<models.overrides.plan_reviewer || models.default>",
  prompt: `
Review the wave plan in this target file.

Target file: <wave_path>

Read the target file, evaluate the wave plan against the 5 criteria
(Clarity, Completeness, Feasibility, Atomicity, Risks), and return PASS,
CONCERNS, or RETHINK with evidence. Focus on: problem statement precision,
approach step atomicity, acceptance criteria testability, file scope
(soft cap: >10 files → split wave), blockers identified.
`
})

Agent({
  description: "Council review wave plan",
  subagent_type: "do-council-reviewer",
  model: "<models.overrides.plan_reviewer || models.default>",
  prompt: `
Run council review for this wave plan.

Target file: <wave_path>
Review type: plan
Workspace: <pwd>

Run council-invoke.cjs --type plan --task-file "<wave_path>" --workspace "<pwd>"
and return the structured verdict.
`
})
```

Wait for BOTH agents to complete before proceeding to PR-4.

### PR-3b: If council disabled

Spawn only do-plan-reviewer:

```javascript
Agent({
  description: "Self-review wave plan (council disabled)",
  subagent_type: "do-plan-reviewer",
  model: "<models.overrides.plan_reviewer || models.default>",
  prompt: `
Review the wave plan in this target file.

Target file: <wave_path>

Read the target file, evaluate the wave plan against the 5 criteria
(Clarity, Completeness, Feasibility, Atomicity, Risks), and return PASS,
CONCERNS, or RETHINK with evidence.
`
})
```

Apply single-review fallback in PR-4b (skip PR-4a).

---

## PR-4: Combine Verdicts

### PR-4a: Two-reviewer combination (council enabled)

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

| Self-Review | Combined |
|-------------|----------|
| PASS | **APPROVED** |
| CONCERNS | **ITERATE** |
| RETHINK | **ESCALATE** |

---

## PR-5: Handle Combined Verdict

### If APPROVED

Update `wave.md` frontmatter:
```yaml
council_review_ran:
  plan: true
```

Return control to caller (proceed to `stage-wave-exec.md`).

### If ITERATE (and review_iterations < 3)

1. Increment `review_iterations`
2. Compile combined findings
3. Log iteration in `wave.md`:
   ```markdown
   ## Review Iterations

   ### Iteration <N>
   - **Self-review:** <verdict> - <summary>
   - **Council:** <verdict> - <summary> (or "disabled")
   - **Changes made:** (pending — do-planner will revise)
   ```
4. Spawn do-planner with reviewer feedback:
   ```javascript
   Agent({
     description: "Revise wave plan based on review feedback",
     subagent_type: "do-planner",
     model: "<models.overrides.planner || models.default>",
     prompt: `
   Revise the wave plan based on review feedback.

   Target file: <wave_path>
   Reviewer feedback: <combined findings from self-review and council>

   Update the Problem Statement, Approach, and/or Concerns sections to address
   the issues. Do not change the wave slug, scope, or frontmatter metadata
   (status, project_schema_version, etc.).
   Return a summary of changes made.
   `
   })
   ```
5. Wait for do-planner to complete
6. Update iteration log with "Changes made: <planner summary>"
7. Return to PR-3 and re-spawn reviewers

### If ITERATE (and review_iterations = 3)

```markdown
## WAVE PLAN REVIEW: MAX ITERATIONS

**Iterations:** 3/3
**Status:** Could not resolve all concerns after 3 attempts

### Outstanding Issues
<list remaining concerns from latest reviewer feedback>

### Options
1. Proceed anyway (acknowledge risks)
2. Revise wave plan manually and re-invoke
3. Abandon wave (`/do:project wave abandon <slug>`)
```

Stop and await user decision.

### If ESCALATE

```markdown
## WAVE PLAN REVIEW: NEEDS USER INPUT

**Self-Review:** <verdict>
**Council:** <verdict> (or "disabled")

### Critical Issues
<list the RETHINK-level concerns with evidence>

### Reviewer Recommendations
<list suggestions from reviewers>

User decision required before proceeding.
```

Stop and await user decision.
