---
name: do:continue
description: "Resume work from where you left off. Detects current stage and spawns the appropriate agent to continue."
argument-hint: "[--task <filename>]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

# /do:continue

Resume the active task by spawning the appropriate agent for its current stage.

## Why this exists

Tasks span multiple sessions. After a break, context switch, or `/clear`, this skill reloads the task state, shows progress, and spawns the right agent to continue — planner, reviewer, executioner, etc.

## Usage

```
/do:continue                    # Resume active task
/do:continue --task <filename>  # Resume a specific (possibly abandoned) task
```

---

## Step 1: Find Active Task

Read `.do/config.json` to get `active_task`.

```bash
node -e "const c=require('./.do/config.json'); console.log(c.active_task || 'none')"
```

- **No active task**: "No active task. Run /do:task to create one."
- **File missing**: Clear stale reference, show same message

If `--task <filename>` provided, use that instead.

## Step 2: Load Task State

Read the task file and extract:

- `stage`: Current workflow stage
- `stages`: Sub-stage completion status
- `confidence`: Score and factors
- Execution Log: Last action

```bash
node ~/.codex/skills/do/scripts/update-task-frontmatter.cjs read '.do/tasks/<active_task>' stage stages confidence council_review_ran
```

## Step 3: Handle Abandoned Tasks

If `stage: abandoned`:

1. Restore to `pre_abandon_stage`
2. Update frontmatter
3. Set as active task
4. Continue with normal routing

## Step 4: Show Resume Summary

```
## Resuming Task

**File:** .do/tasks/<filename>
**Stage:** <stage>
**Confidence:** <score>

### Last Action
<summary from Execution Log or stage status>

### Next
<what will happen when you continue>

Continue? [Y/n]
```

If user declines, stop.

## Step 5: Read Model Config

```bash
node -e "
const c = require('./.do/config.json');
const models = c.models || { default: 'sonnet', overrides: {} };
console.log(JSON.stringify(models));
"
```

## Step 6: Route by Stage

**Fast-path guard:** Before using the routing table below, check if `fast_path: true` is present in the task frontmatter, and also extract the `quick_path` discriminator:

```bash
node ~/.codex/skills/do/scripts/update-task-frontmatter.cjs read '.do/tasks/<active_task>' fast_path quick_path
```

Parse the output: if `fast_path` is `true`, the path is `fast`; otherwise `normal`. Extract `quick_path` as-is.

### Fast-path routing (fast_path: true)

| Stage       | Sub-condition                                                        | Action                                                              |
| ----------- | -------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `execution` | `stages.execution: pending`                                          | Spawn codex-executioner (task was created but execution never started) |
| `execution` | `stages.execution: in_progress`                                      | Spawn codex-executioner to continue (same as normal)                   |
| `execution` | `stages.execution: review_pending` AND `quick_path: false` or absent | Run the single fast code review round (see below)                   |
| `execution` | `stages.execution: review_pending` AND `quick_path: true`            | Run full code-review stack (see Quick-path escalation resume below) |
| `complete`  | -                                                                    | Show "Task already complete. No action needed." and stop            |

**Fast code review round** (for `review_pending` state, `quick_path: false` or absent):

Spawn codex-code-reviewer only (no council, no parallel spawning). Follow FE-6 logic from `@skills/do/references/stage-fast-exec.md`:

- APPROVED or NITPICKS_ONLY → mark `council_review_ran.code: true`, update `stage: complete`, done
- CHANGES_REQUESTED (first time) → spawn codex-executioner with fix instructions, override stage back to `execution: review_pending`, re-spawn codex-code-reviewer once
- CHANGES_REQUESTED (second time) → abandon task: set `abandoned: true`, `pre_abandon_stage: execution`, `fast_path: false`. Print: "Fast-path review failed twice. The task has been abandoned and preserved at `.do/tasks/<filename>` for reference. Please run `/do:task "description"` to start fresh with the full workflow." Stop.

**Quick-path escalation resume** (for `review_pending` state, `quick_path: true`):

The escalated quick-path task file carries `council_review_ran.code: true` (preserving the two quick-path council rounds as history). Before invoking the full code-review stack, flip that flag back to `false` so the CR-0 resume guard in `stage-code-review.md` does not skip the review:

```bash
# Flip council_review_ran.code to false so CR-0 allows a fresh full review.
# The existing Council Review section with both quick-path rounds is preserved as history.
# Also override stage to execution:complete so stage-code-review.md picks it up correctly.
node ~/.codex/skills/do/scripts/update-task-frontmatter.cjs set '.do/tasks/<active_task>' council_review_ran.code=false stages.execution=complete
```

Then invoke the full code-review stack via `@references/stage-code-review.md`. This brings in the full review stack (council + codex-code-reviewer in parallel) rather than the single-reviewer tier that already failed twice.

**Important:** Do NOT delete the existing Council Review section — it contains both quick-path round-1 and round-2 findings, preserved as history. `stage-code-review.md` appends new findings; it does not overwrite.

After `@references/stage-code-review.md` returns:

- **VERIFIED** → `stage-code-review.md` CR-5 has already set `stage: verification`, `stages.verification: pending`, and `council_review_ran.code: true`. Spawn codex-verifier.
- **ITERATE** → `stage-code-review.md` owns the loop (CR-5). Do NOT handle manually.
- **MAX_ITERATIONS** → show to user, stop (same as normal flow).

**Note on abandoned fast-path tasks:** When a fast-path task was abandoned via escalation, `fast_path` is set to `false`. The normal abandoned-task flow in Step 3 applies: restore `pre_abandon_stage`, resume. The task resumes as a normal `/do:task` pipeline from that point.

### Normal routing (fast_path: false or absent)

| Stage          | Sub-condition                                    | Action                                                        |
| -------------- | ------------------------------------------------ | ------------------------------------------------------------- |
| `refinement`   | stages.refinement: in_progress                   | Spawn codex-planner to finish planning                           |
| `refinement`   | stages.refinement: complete, plan review not ran | Run stage-plan-review (parallel reviewers if council enabled) |
| `refinement`   | plan review complete, confidence < threshold     | Spawn codex-griller                                              |
| `refinement`   | all complete                                     | Show approval checkpoint, then spawn codex-executioner           |
| `execution`    | stages.execution: in_progress                    | Spawn codex-executioner to continue                              |
| `execution`    | stages.execution: complete                       | Run stage-code-review (parallel reviewers if council enabled) |
| `verification` | any                                              | Spawn codex-verifier                                             |
| `verified`     | -                                                | Spawn codex-verifier (resumes at V5 UAT flow)                    |
| `complete`     | -                                                | Show "Task already complete. No action needed." and stop      |

### Spawn codex-planner (resume planning)

Spawn the codex-planner subagent with model `<models.overrides.planner || models.default>` and the description "Continue planning". Pass the following prompt:

Continue planning this task.

Task file: .do/tasks/<active_task>

The task file already exists. Read it, complete any missing sections.
Return structured summary when done.

### Plan Review

@references/stage-plan-review.md

The resume guard (PR-0) handles the `council_review_ran.plan` skip-entirely check. If already ran, stage-plan-review returns immediately. Result handling:

- **APPROVED**: Continue to griller check / approval checkpoint
- **ITERATE**: stage-plan-review.md owns this loop — follow its PR-5 steps. ITERATE may resolve inline if all findings are nitpicks (see PR-4.5 in stage-plan-review.md). Do NOT handle plan revisions manually. stage-plan-review.md owns the ITERATE loop, including inline Edit tool calls for nitpick-only rounds. The caller must not bypass stage logic or edit the task file outside of the stage reference.
- **MAX_ITERATIONS** or **ESCALATE**: Show to user, stop

### Spawn codex-griller

Before spawning, read the threshold from config:

```bash
node -e "const c=require('./.do/config.json'); console.log(c.auto_grill_threshold || 0.9)"
```

Use this value as `<threshold>` in the spawn prompt below.

Spawn the codex-griller subagent with model `<models.overrides.griller || models.default>` and the description "Grill for clarity". Pass the following prompt:

Task confidence is below threshold. Ask clarifying questions.

Task file: .do/tasks/<active_task>
Current confidence: <score>
Threshold: <threshold>

**Note:** The griller resolves the full question loop internally via AskUserQuestion (with inline text fallback). It returns only the final GRILLING COMPLETE summary — no relaying of questions through the orchestrator.

### Spawn codex-executioner (new or resume)

Spawn the codex-executioner subagent with model `<models.overrides.executioner || models.default>` and the description "Execute task". Pass the following prompt:

Execute (or continue executing) this task.

Task file: .do/tasks/<active_task>

Check Execution Log for prior progress.
Continue from where it left off.

**Note:** Deviation decisions are handled internally — the executioner asks the user directly via AskUserQuestion (with inline text fallback). BLOCKED is only returned when the user explicitly chose "Pause and investigate" or both interaction methods failed. If BLOCKED is returned, display its output as-is — do NOT re-ask the user.

### Code Review

@references/stage-code-review.md

The resume guard (CR-0) handles the `council_review_ran.code` skip-entirely check. If already ran, stage-code-review returns immediately (proceed to codex-verifier). Result handling:

- **VERIFIED**: Task file updated with stage:verification — spawn codex-verifier
- **ITERATE**: stage-code-review.md owns this loop — follow its CR-5 steps, which will re-spawn codex-executioner and reviewers (up to 3x). ITERATE now passes classified findings to codex-executioner as a prioritized brief (blockers first, nitpicks second — see CR-4.5 in stage-code-review.md). Do NOT fix code issues manually.
- **MAX_ITERATIONS**: Show to user, stop

### Spawn codex-verifier

Spawn the codex-verifier subagent with model `<models.overrides.verifier || models.overrides.code_reviewer || models.default>` and the description "Verify implementation". Pass the following prompt:

Run verification for this task.

Task file: .do/tasks/<active_task>

Run verification: approach checklist, quality checks, UAT.
If stage is verified, resume at UAT flow (Step V5).

**Note:** UAT approval and fail handling are resolved internally — the verifier asks the user directly via AskUserQuestion (with inline text fallback). If FAIL or UAT_FAILED is returned, display the verifier's output as-is — it already contains the user's chosen next step. Do NOT re-ask.

## Step 7: Handle Subagent Result

After subagent returns, check the result and either:

- Continue to next stage (loop back to Step 6)
- Show completion summary
- Report blocker/failure to user

---

## Files

- **Task template:** @references/task-template.md

```

```
