---
name: stage-quick-exec
description: Quick-path execution block. Inline execution, validation, single council review, one-iteration budget, lazy task-file materialization on escalation. Invoked by do:quick only (after single confirmation prompt). Can be reached via the do:task router (when user accepts the quick recommendation) or by direct /do:quick invocation.
---

**Agent authorization:** The caller workflow has authorized spawning codex-council-reviewer
(QE-6 and QE-11). Spawn it as a subagent — do NOT skip or execute its review inline.
If spawning fails, STOP and report; do not fall back to inline execution.
Note: QE-2 inline execution is intentional and NOT a fallback violation — the
quick-path orchestrator makes changes directly by design.


# Quick Execution Stage

This reference file is loaded by `do:quick` only (after the single confirmation prompt). It can be reached via the `do:task` router (when user accepts the `quick` recommendation) or by direct `/do:quick` invocation.

**Caller contract:** Caller has already validated prerequisites, checked for an active task, and confirmed the single entry-criteria prompt. Caller passes `<description>` as an in-session variable (the `$ARGUMENTS` value) substituted into the prompt at load time. No scratch files, no config mutation by the caller. Model config (`models` object) is also passed as an in-session variable having been read in the caller's model-config step. Working directory is the project root at invocation time; this reference assumes relative paths from there.

When this stage returns:

- **Happy path:** task is complete, no task file written.
- **Escalation path:** task file materialized, `active_task` set, escalation message printed, execution stopped.

---

## QE-0: Sanity Check

Confirm `<description>` is available as an in-session variable. If it is empty or undefined, stop and ask the user for a description before proceeding.

---

## QE-1: Pre-execution Snapshot

Capture the baseline commit SHA and changed-file list as a reference point:

```bash
git rev-parse HEAD
```

Store as in-session `quick_baseline_sha`.

Also note the current working tree status (`git status --short`) so round-1 diff boundaries are unambiguous.

---

## QE-2: Execute Inline

**Orchestrator makes the change directly** using Read/Edit/Write in the main conversation. No subagent spawn.

The conversation IS the execution context. Make the change described in `<description>`. If the change requires more than 2 files or reveals non-mechanical complexity mid-way, stop and redirect to `/do:fast` instead.

---

## QE-3: Capture Round-1 Diff

```bash
git diff <quick_baseline_sha>
```

Store the full diff output as in-session `quick_diff_r1`. If the diff is empty (no changes were made), stop and inform the user.

---

## QE-4: Run Validation

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

- Check if a `__tests__/` directory exists near any changed files. If it does, run those tests directly (e.g., `node --test skills/scripts/__tests__/`).
- Check if prettier is available (`node_modules/.bin/prettier` or `npx prettier --version`). If available, run `npx prettier --write` on changed files only.

Store all results as in-session `quick_validation` (pass/fail per check, output for any failures).

---

## QE-5: Write Transient Task File for Council

Write `.do/tasks/.quick-transient.md` with the following content:

```markdown
---
id: quick-transient
description: "<description>"
quick_path: true
transient: true
---

# Quick-path transient — do not resume

This file is a temporary sentinel for council review. It will be deleted after review completes.

## Problem Statement

<description>

## Approach

(Inline execution — orchestrator made changes directly)

## Execution Log

### Round 1 diff
```

<quick_diff_r1>

```

### Validation results (round 1)

<quick_validation results>

## Round-1 Review

### Round-1 council findings

(Populated after round-1 council review — absent on first write)

### Round-2 diff (cumulative from baseline)

(Populated after round-2 execution — absent on first write)

### Validation results (round 2)

(Populated after round-2 validation — absent on first write)

## Council Review

(Pending — round 1)
```

**Note:** The dot-prefix (`.quick-transient.md`) keeps this file out of normal task enumeration. It is not a real task file and must not be used with `/do:continue`.

**Round-1 vs round-2:** On first write (round 1), the `## Round-1 Review` section is empty/absent. It is populated in QE-10 after round-1 findings are available.

---

## QE-6: Spawn Round-1 Council Review

Invoke `codex-council-reviewer` with `--type code` pointing at the transient file. Capture the returned verdict and full findings:

Spawn the codex-council-reviewer subagent with model `<models.overrides.code_reviewer || models.default>` and the description "Quick-path council review (round 1)". Pass the following prompt:

Run council review for this quick-path execution.

Task file: .do/tasks/.quick-transient.md
Review type: code
Workspace: <pwd>

Run council-invoke.cjs --type code and return the structured verdict (APPROVED, NITPICKS_ONLY, or CHANGES_REQUESTED) with full findings.

Store the returned verdict and findings as in-session `quick_council_r1`.

---

## QE-7: Interpret Round-1 Verdict

- **APPROVED or NITPICKS_ONLY** → proceed to QE-13 (happy-path completion).
- **CHANGES_REQUESTED** → proceed to QE-8 (inline fix round).

---

## QE-8: Apply Round-1 Fix Inline

Read the round-1 findings from `quick_council_r1`. Apply the requested changes directly via Read/Edit/Write in the main conversation. Do NOT spawn codex-executioner.

If the fix requires touching more than 2 files or reveals non-mechanical complexity, stop and proceed directly to QE-14 (escalation) rather than continuing the quick-path budget.

---

## QE-9: Capture Round-2 Diff

```bash
git diff <quick_baseline_sha>
```

Store as in-session `quick_diff_r2` (cumulative diff from baseline through both rounds of changes).

Also capture the round-1-to-round-2 delta for escalation fidelity:

```bash
# Store current HEAD SHA after round-1 fix
git rev-parse HEAD
```

The delta between `quick_diff_r1` and `quick_diff_r2` represents what changed in the fix round.

---

## QE-10: Update Transient for Round-2 Council

Update the existing `.do/tasks/.quick-transient.md` — populate the `## Round-1 Review` section (defined in the QE-5 template) with:

- **Round-1 council findings:** `quick_council_r1` findings
- **Round-2 diff (cumulative from baseline):** `quick_diff_r2`
- **Validation results (round 2):** re-run the QE-4 validation logic and store results here

Also update the `## Approach` line to `(Inline execution — orchestrator made changes directly, round 2 of 2)` and the `## Council Review` section to include the round-1 findings with `(Round 2 pending)` appended.

---

## QE-11: Spawn Round-2 Council Review

Spawn council review using the same spawn directive pattern as QE-6, with description updated to `"Quick-path council review (round 2 of 2)"` and the prompt including round-1 findings as additional context (note: "second and final round", and that the transient file now contains the round-1 council findings and the updated diff).

Store the returned verdict and findings as in-session `quick_council_r2`.

---

## QE-12: Interpret Round-2 Verdict

- **APPROVED or NITPICKS_ONLY** → proceed to QE-13 (happy-path completion).
- **CHANGES_REQUESTED** → one iteration budget exhausted; proceed to QE-14 (escalation).

---

## QE-13: Happy-Path Completion

1. Delete `.do/tasks/.quick-transient.md`:

   ```bash
   rm .do/tasks/.quick-transient.md
   ```

2. Print summary to the user:

```
## Quick-path task complete

**Description:** <description>
**Files touched:** <list of files changed>
**Validation:** <what passed / what was skipped>
**Review:** <APPROVED or NITPICKS_ONLY — nitpicks logged if any>
```

3. No task file is written. Control returns to the main conversation.

4. Continue to QE-20 (/skill-creator reminder).

---

## QE-14: Escalation — Capture Findings Bundle

Assemble in-session bundle:

- `quick_diff_r1` — round-1 diff (from QE-3)
- `quick_diff_r2` — cumulative round-2 diff (from QE-9)
- Round-1-to-round-2 delta — what changed in the fix round
- `quick_validation` — both validation runs (QE-4 and QE-10)
- `quick_council_r1` — full round-1 council findings
- `quick_council_r2` — full round-2 council findings

---

## QE-15: Escalation — Compose Task Content

Generate a slug from `<description>` (same logic as fast/task). Compose:

- **Problem Statement:** `<description>` (1-3 sentences)
- **Approach:** 2-4 bullets derived from what was executed inline (what files were changed, what the fix attempted to do)
- **Execution Log:** timestamp entry with all files changed, round-1 decisions, round-1 fix decisions, both validation runs
- **Council Review section:** both rounds formatted per template

---

## QE-16: Escalation — Write Task File

Write the full task file at `.do/tasks/<YYMMDD>-<slug>.md` using the Write tool. Use the format from `@references/task-template.md` with these overrides:

```yaml
stage: execution
stages:
  refinement: skipped
  grilling: skipped
  execution: review_pending
  verification: pending
  abandoned: false
fast_path: true
quick_path: true
council_review_ran:
  plan: skipped
  code: true
```

**Note on `council_review_ran.code: true`:** This preserves the two-round quick-path history. When `/do:continue` resumes this task, it will flip this flag back to `false` before invoking `@references/stage-code-review.md` so the CR-0 resume guard does not skip the full review. The existing Council Review section with both rounds is preserved as history — `stage-code-review.md` appends new findings, it does not overwrite.

Populate:

- `id` — `<YYMMDD>-<slug>`
- `description` — `<description>`
- `created` and `updated` — current ISO timestamp
- `Problem Statement` — from QE-15
- `Approach` — from QE-15
- `Execution Log` — from QE-15 (includes both diffs and validation runs)
- `Council Review` — both rounds from QE-14 bundle

---

## QE-17: Escalation — Mutate Config

Set `active_task` in `.do/config.json` to the new task filename:

```bash
node -e "
const fs = require('fs');
const c = JSON.parse(fs.readFileSync('.do/config.json', 'utf8'));
c.active_task = '<YYMMDD>-<slug>.md';
fs.writeFileSync('.do/config.json', JSON.stringify(c, null, 2));
"
```

---

## QE-18: Escalation — Cleanup Transient

Delete the transient file:

```bash
rm .do/tasks/.quick-transient.md
```

---

## QE-19: Escalation — User Message

Print exactly:

> "Quick-path review failed twice. The task has been materialized at `.do/tasks/<filename>` with both council rounds preserved in the Council Review section. Run `/do:continue` to resume with the full code-review stack (council + code-reviewer in parallel). Do NOT use `/do:fast` or `/do:task` — both have active-task guards that will prompt to continue/abandon rather than resume mid-flow."

**Stop.** Do NOT auto-invoke anything.

---

## QE-20: /skill-creator Reminder

Reached only on happy-path return (QE-13), not escalation.

Remind the user:

> "If any skill files were created or heavily edited during this task, invoke `/skill-creator` to review and polish them. Do not invoke it automatically."

---

## Quick-path State Machine

```
QE-2:  inline execution (no task file, no stage mutation)
QE-6:  council review round 1
QE-7:  APPROVED/NITPICKS → QE-13 (done, no task file)
QE-7:  CHANGES_REQUESTED → QE-8 (fix inline)
QE-11: council review round 2
QE-12: APPROVED/NITPICKS → QE-13 (done, no task file)
QE-12: CHANGES_REQUESTED → QE-14 (escalation)
QE-16: task file written with fast_path: true, quick_path: true,
       council_review_ran.code: true, stages.execution: review_pending
QE-19: user directed to /do:continue (NOT /do:fast or /do:task)
```

Key invariant: `fast_path: true` + `quick_path: true` + `stages.execution: review_pending` + `council_review_ran.code: true` uniquely identifies an escalated quick-path task. `/do:continue` Step 6 recognises this combination and runs the full code-review stack after flipping `council_review_ran.code` to `false`.

---

## Failure Handling

If any step fails unexpectedly:

- Show what failed and what was last completed
- Clean up `.do/tasks/.quick-transient.md` if it exists
- Inform the user they can restart with `/do:quick "<description>"` or escalate with `/do:fast "<description>"`

No automatic retries.
