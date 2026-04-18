---
name: stage-phase-plan-review
description: "Phase plan review block for /do:project. Council gate check, parallel reviewer spawning (when enabled), verdict combination, iteration loop via do-planner, wave-seeding hook, and escalation rules. Target file: phase.md."
---

# Phase Plan Review Stage

This reference file is loaded by `skills/do/project.md` when a phase enters planning (after `phase new` or after the per-phase re-grill). It encodes the full plan review logic for `phase.md` including wave-seeding on approval.

**Caller contract:** The caller provides `<phase_path>` = abs path to `phase.md`, `<active_project>` slug, and `<phase_slug>`. When this stage returns APPROVED, `council_review_ran.plan: true` has been written into `phase.md`'s frontmatter, AND all wave folders for in-scope waves have been seeded via `project-scaffold.cjs wave`. Return control to caller. If ESCALATE or MAX_ITERATIONS, stop and present to the user.

---

## PR-0: Resume Guard

Check if phase plan review already ran:

```bash
node -e "
const fm = require('gray-matter');
const t = fm(require('fs').readFileSync('<phase_path>', 'utf8'));
process.exit(t.data.council_review_ran?.plan === true ? 1 : 0)
"
```

**If already ran (exit 1):** Skip this entire stage. Return control to caller immediately.

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
const enabled = cfg.council_reviews?.project?.phase_plan !== undefined
  ? cfg.council_reviews.project.phase_plan === true
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
  description: "Self-review phase plan",
  subagent_type: "do-plan-reviewer",
  model: "<models.overrides.plan_reviewer || models.default>",
  prompt: `
Review the phase plan in this target file.

Target file: <phase_path>

Read the target file, evaluate the phase plan against the 5 criteria
(Clarity, Completeness, Feasibility, Atomicity, Risks), and return PASS,
CONCERNS, or RETHINK with evidence. Focus on: goal clarity, wave list
feasibility (soft cap: >10 files or confidence <0.5 → split or promote),
acceptance criteria measurability, dependency risks.
`
})

Agent({
  description: "Council review phase plan",
  subagent_type: "do-council-reviewer",
  model: "<models.overrides.plan_reviewer || models.default>",
  prompt: `
Run council review for this phase plan.

Target file: <phase_path>
Review type: plan
Workspace: <pwd>

Run council-invoke.cjs --type plan --task-file "<phase_path>" --workspace "<pwd>"
and return the structured verdict.
`
})
```

Wait for BOTH agents to complete before proceeding to PR-4.

### PR-3b: If council disabled

Spawn only do-plan-reviewer:

```javascript
Agent({
  description: "Self-review phase plan (council disabled)",
  subagent_type: "do-plan-reviewer",
  model: "<models.overrides.plan_reviewer || models.default>",
  prompt: `
Review the phase plan in this target file.

Target file: <phase_path>

Read the target file, evaluate the phase plan against the 5 criteria
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

1. Update `phase.md` frontmatter:
   ```yaml
   council_review_ran:
     plan: true
   ```

2. **Wave-seeding hook (§6 step 1a):** for each wave listed in `phase.md`'s `## Wave Plan` section (or `waves[]` frontmatter), call `project-scaffold.cjs wave` to create the wave folder and `wave.md` if it does not already exist:
   ```bash
   # For each wave slug in the phase plan:
   node ~/.claude/commands/do/scripts/project-scaffold.cjs wave <active_project> <phase_slug> <wave_slug>
   ```
   Skip any wave that already has a folder. Append changelog entry per wave seeded.

3. Return control to caller.

### If ITERATE (and review_iterations < 3)

1. Increment `review_iterations`
2. Compile combined findings
3. Log iteration in `phase.md`:
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
     description: "Revise phase plan based on review feedback",
     subagent_type: "do-planner",
     model: "<models.overrides.planner || models.default>",
     prompt: `
   Revise the phase plan based on review feedback.

   Target file: <phase_path>
   Reviewer feedback: <combined findings from self-review and council>

   Update the Goal, Wave Plan, Acceptance Criteria, and/or Risks sections to
   address the issues. Do not change the phase slug or frontmatter metadata
   (status, scope, project_schema_version, etc.).
   Return a summary of changes made.
   `
   })
   ```
5. Wait for do-planner to complete
6. Update iteration log with "Changes made: <planner summary>"
7. Return to PR-3 and re-spawn reviewers

### If ITERATE (and review_iterations = 3)

```markdown
## PHASE PLAN REVIEW: MAX ITERATIONS

**Iterations:** 3/3
**Status:** Could not resolve all concerns after 3 attempts

### Outstanding Issues
<list remaining concerns from latest reviewer feedback>

### Options
1. Proceed anyway (acknowledge risks)
2. Revise phase plan manually and re-invoke
3. Abandon phase (`/do:project phase abandon <slug>`)
```

Stop and await user decision.

### If ESCALATE

```markdown
## PHASE PLAN REVIEW: NEEDS USER INPUT

**Self-Review:** <verdict>
**Council:** <verdict> (or "disabled")

### Critical Issues
<list the RETHINK-level concerns with evidence>

### Reviewer Recommendations
<list suggestions from reviewers>

User decision required before proceeding.
```

Stop and await user decision.
