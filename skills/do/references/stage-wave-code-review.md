---
name: stage-wave-code-review
description: "Wave code review block for /do:project. Council gate check, parallel reviewer spawning (when enabled), verdict combination, iteration loop via do-executioner, and escalation rules. Target file: wave.md."
---

# Wave Code Review Stage

This reference file is loaded by `skills/do/project.md` `wave next` after `stage-wave-exec.md` returns COMPLETE. It encodes the full code review logic for the wave's git diff, targeting `wave.md`.

**Caller contract:** The caller provides `<wave_path>` = abs path to `wave.md`. When this stage returns VERIFIED, `wave.md` has been updated with `council_review_ran.code: true`. Continue to `stage-wave-verify.md`. If MAX_ITERATIONS, stop and present to the user.

---

## CR-0: Resume Guard

Check if wave code review already ran:

```bash
node -e "
const fm = require('gray-matter');
const t = fm(require('fs').readFileSync('<wave_path>', 'utf8'));
process.exit(t.data.council_review_ran?.code === true ? 1 : 0)
"
```

**If already ran (exit 1):** Skip this entire stage. Return control to caller (proceed to `stage-wave-verify.md`).

---

## CR-1: Council Gate Check

```bash
node @scripts/council-gate.cjs project.code execution
```

Store result as `council_enabled` (enabled/disabled).

---

## CR-2: Initialize Iteration Counter

Set `code_review_iterations = 0` (in-session variable, not persisted).

---

## CR-3: Spawn Reviewers

### CR-3a: If council enabled

Spawn TWO agents in a SINGLE message (both Agent calls in one response):

```javascript
Agent({
  description: "Self-review wave code",
  subagent_type: "do-code-reviewer",
  model: "<models.overrides.code_reviewer || models.default>",
  prompt: `
Review the code changes from this wave execution.

Target file: <wave_path>

Read the target file and the current git diff. Evaluate the changes against
the 6 criteria (Correctness, Quality, Tests, Types, Security, Completeness)
and return APPROVED, NITPICKS_ONLY, or CHANGES_REQUESTED with file:line references.
Focus on: wave Approach steps all implemented, no regressions, wave
Acceptance Criteria met.
`
})

Agent({
  description: "Council review wave code",
  subagent_type: "do-council-reviewer",
  model: "<models.overrides.code_reviewer || models.default>",
  prompt: `
Run council review for this wave's code changes.

Target file: <wave_path>
Review type: code
Workspace: <pwd>

Run council-invoke.cjs --type code --task-file "<wave_path>" --workspace "<pwd>"
and return the structured verdict.
`
})
```

Wait for BOTH agents to complete before proceeding to CR-4.

### CR-3b: If council disabled

Spawn only do-code-reviewer:

```javascript
Agent({
  description: "Self-review wave code (council disabled)",
  subagent_type: "do-code-reviewer",
  model: "<models.overrides.code_reviewer || models.default>",
  prompt: `
Review the code changes from this wave execution.

Target file: <wave_path>

Read the target file and the current git diff. Evaluate the changes against
the 6 criteria (Correctness, Quality, Tests, Types, Security, Completeness)
and return APPROVED, NITPICKS_ONLY, or CHANGES_REQUESTED with file:line references.
`
})
```

Apply single-review fallback in CR-4b (skip CR-4a).

---

## CR-4: Combine Verdicts

### CR-4a: Two-reviewer combination (council enabled)

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

| Self-Review | Combined |
|-------------|----------|
| APPROVED | **VERIFIED** |
| NITPICKS_ONLY | **VERIFIED** (log nitpicks) |
| CHANGES_REQUESTED | **ITERATE** |

---

## CR-5: Handle Combined Verdict

### If VERIFIED

1. Log any nitpicks to the `## Review Notes` section in `wave.md` (non-blocking).
2. Update `wave.md` frontmatter:
   ```yaml
   council_review_ran:
     code: true
   ```
3. Return control to caller (continue to `stage-wave-verify.md`).

### If ITERATE (and code_review_iterations < 3)

1. Increment `code_review_iterations`
2. Compile combined findings
3. Spawn do-executioner with combined findings:
   ```javascript
   Agent({
     description: "Fix wave code review issues (iteration <N>)",
     subagent_type: "do-executioner",
     model: "<models.overrides.executioner || models.default>",
     prompt: `
   Fix the issues identified in code review.

   Target file: <wave_path>

   Issues to fix:
   <combined findings from both reviewers with file:line references>

   Fix each issue. Log changes in the Execution Log in the target file.
   Return summary when complete.
   `
   })
   ```
4. Wait for do-executioner to complete
5. Log the iteration in `wave.md`'s `## Review Notes` section:
   ```markdown
   ## Review Notes

   ### Code Review Iteration <N>
   - **Self-review:** <verdict>
   - **Council:** <verdict> (or "disabled")
   - **Action:** Spawned do-executioner with combined findings; executor completed
   ```
6. Return to CR-3 and re-spawn both review agents

### If ITERATE (and code_review_iterations = 3)

```markdown
## WAVE CODE REVIEW: MAX ITERATIONS

**Iterations:** 3/3
**Status:** Could not resolve all issues after 3 attempts

### Outstanding Issues
<list remaining issues with file:line references>

### Options
1. Proceed anyway (ship with known issues)
2. Fix manually and re-invoke `/do:project wave next`
3. Abandon wave (`/do:project wave abandon <slug>`)
```

Stop and await user decision.
