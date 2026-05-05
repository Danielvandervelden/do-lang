---
name: stage-wave-code-review
description: "Wave code review block for /do:project. Council gate check, parallel reviewer spawning (when enabled), verdict combination, iteration loop via codex-executioner, and escalation rules. Target file: wave.md."
---

**Agent authorization:** The caller workflow has authorized spawning all agents
referenced in this file (codex-code-reviewer, codex-council-reviewer, codex-executioner
on ITERATE). Spawn them as subagents — do NOT execute their work inline. If spawning
fails, STOP and report; do not fall back to inline execution.

# Wave Code Review Stage

This reference file is loaded by `skills/project.md` `wave next` after `stage-wave-exec.md` returns COMPLETE. It encodes the full code review logic for the wave's git diff, targeting `wave.md`.

**Caller contract:** The caller provides `<wave_path>` = abs path to `wave.md`. When this stage returns VERIFIED, `wave.md` has been updated with `council_review_ran.code: true`. Continue to `stage-wave-verify.md`. If MAX_ITERATIONS, stop and present to the user.

---

## CR-0: Resume Guard

Check if wave code review already ran:

```bash
node ~/.codex/skills/do/scripts/update-task-frontmatter.cjs check '<wave_path>' council_review_ran.code
```

**If already ran (exit 1):** Skip this entire stage. Return control to caller (proceed to `stage-wave-verify.md`).

---

## CR-1: Council Gate Check

```bash
node ~/.codex/skills/do/scripts/council-gate.cjs project.code execution
```

Store result as `council_enabled` (enabled/disabled).

---

## CR-2: Initialize Iteration Counter

Set `code_review_iterations = 0` (in-session variable, not persisted).

---

## CR-3: Spawn Reviewers

### CR-3a: If council enabled

In a single response, spawn BOTH of the following subagents (parallel dispatch — do NOT wait between them):

Spawn the codex-code-reviewer subagent with model `<models.overrides.code_reviewer || models.default>` and the description "Self-review wave code". Pass the following prompt:

Review the code changes from this wave execution.

Target file: <wave_path>

Read the target file and the current git diff. Evaluate the changes against
the 6 criteria (Correctness, Quality, Tests, Types, Security, Completeness)
and return APPROVED, NITPICKS_ONLY, or CHANGES_REQUESTED with file:line references.
Focus on: wave Approach steps all implemented, no regressions, wave
Acceptance Criteria met.

Spawn the codex-council-reviewer subagent with model `<models.overrides.code_reviewer || models.default>` and the description "Council review wave code". Pass the following prompt:

Run council review for this wave's code changes.

Target file: <wave_path>
Review type: code
Workspace: <pwd>

Run council-invoke.cjs --type code --task-file "<wave_path>" --workspace "<pwd>"
and return the structured verdict.

Wait for BOTH subagents to complete before proceeding to CR-4.

### CR-3b: If council disabled

Spawn the codex-code-reviewer subagent with model `<models.overrides.code_reviewer || models.default>` and the description "Self-review wave code (council disabled)". Pass the following prompt:

Review the code changes from this wave execution.

Target file: <wave_path>

Read the target file and the current git diff. Evaluate the changes against
the 6 criteria (Correctness, Quality, Tests, Types, Security, Completeness)
and return APPROVED, NITPICKS_ONLY, or CHANGES_REQUESTED with file:line references.

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
2.5. **Codex cleanup (council enabled path):** Both codex-code-reviewer and codex-council-reviewer subagents have completed and their output has been fully consumed. Close (dismiss) both subagents now to free thread slots before returning VERIFIED to the caller.

**Codex cleanup (council disabled path):** The codex-code-reviewer subagent has completed and its output has been fully consumed. Close (dismiss) the subagent now to free the thread slot before returning VERIFIED to the caller.
3. Return control to caller (continue to `stage-wave-verify.md`).

### If ITERATE (and code_review_iterations < 3)

1. Increment `code_review_iterations`
2. Compile combined findings
2.5. **Codex cleanup (council enabled path):** Both codex-code-reviewer and codex-council-reviewer subagents have completed and their output has been fully consumed. Close (dismiss) both subagents now to free thread slots before spawning codex-executioner for fixes.

**Codex cleanup (council disabled path):** The codex-code-reviewer subagent has completed and its output has been fully consumed. Close (dismiss) the subagent now to free the thread slot before spawning codex-executioner for fixes.
3. Spawn codex-executioner with combined findings:

   Spawn the codex-executioner subagent with model `<models.overrides.executioner || models.default>` and the description "Fix wave code review issues (iteration <N>)". Pass the following prompt:

   Fix the issues identified in code review.

   Target file: <wave_path>

   Issues to fix:
   <combined findings from both reviewers with file:line references>

   Fix each issue. Log changes in the Execution Log in the target file.
   Return summary when complete.

4. Wait for codex-executioner to complete
5. Log the iteration in `wave.md`'s `## Review Notes` section:
   ```markdown
   ## Review Notes

   ### Code Review Iteration <N>
   - **Self-review:** <verdict>
   - **Council:** <verdict> (or "disabled")
   - **Action:** Spawned codex-executioner with combined findings; executor completed
   ```
6. **Codex cleanup:** The codex-executioner subagent has completed and its output has been fully consumed. Close (dismiss) the codex-executioner subagent now to free the thread slot before returning to CR-3.
7. Return to CR-3 and re-spawn both review agents

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
