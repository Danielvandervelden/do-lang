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
<<DO:IF CLAUDE>>
  - Agent
<<DO:ENDIF>>
  - AskUserQuestion
---

# /do:continue

Resume the active task by spawning the appropriate agent for its current stage.

<<DO:IF CODEX>>
## Agent Authorization

By invoking this workflow, the user explicitly authorizes spawning the following
internal agents. These agents are integral to the workflow contract and MUST be
spawned as subagents — they are not optional. `/do:continue` can resume at any
stage, so the full agent set is authorized.

| Agent | Role |
|-------|------|
| <<DO:AGENT_PREFIX>>-planner | Resumes or completes planning (refinement stage resume) |
| <<DO:AGENT_PREFIX>>-plan-reviewer | Reviews the plan if plan review has not yet run |
| <<DO:AGENT_PREFIX>>-council-reviewer | Independent council review during plan or code review stages |
| <<DO:AGENT_PREFIX>>-griller | Asks clarifying questions when confidence is below threshold |
| <<DO:AGENT_PREFIX>>-executioner | Executes or resumes execution of the plan |
| <<DO:AGENT_PREFIX>>-code-reviewer | Reviews code changes after execution completes |
| <<DO:AGENT_PREFIX>>-verifier | Runs verification (approach checklist, quality checks, UAT) |

**No inline fallback:** If agent spawning is unavailable or blocked, STOP immediately
and report: "Cannot spawn required agents. This workflow requires <<DO:CLAUDE:agent spawning>><<DO:CODEX:subagent spawning>> to
function correctly. Please ensure agent spawning is enabled and retry." Do NOT fall back
to inline execution — inline execution bypasses review gates and breaks the workflow
contract.

<<DO:ENDIF>>
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
node <<DO:SCRIPTS_PATH>>/update-task-frontmatter.cjs read '.do/tasks/<active_task>' stage stages confidence council_review_ran
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
node <<DO:SCRIPTS_PATH>>/update-task-frontmatter.cjs read '.do/tasks/<active_task>' fast_path quick_path
```

Parse the output: if `fast_path` is `true`, the path is `fast`; otherwise `normal`. Extract `quick_path` as-is.

### Fast-path routing (fast_path: true)

| Stage       | Sub-condition                                                        | Action                                                              |
| ----------- | -------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `execution` | `stages.execution: pending`                                          | Spawn <<DO:AGENT_PREFIX>>-executioner (task was created but execution never started) |
| `execution` | `stages.execution: in_progress`                                      | Spawn <<DO:AGENT_PREFIX>>-executioner to continue (same as normal)                   |
| `execution` | `stages.execution: review_pending` AND `quick_path: false` or absent | Run the single fast code review round (see below)                   |
| `execution` | `stages.execution: review_pending` AND `quick_path: true`            | Run full code-review stack (see Quick-path escalation resume below) |
| `complete`  | -                                                                    | Show "Task already complete. No action needed." and stop            |

**Fast code review round** (for `review_pending` state, `quick_path: false` or absent):

Spawn <<DO:AGENT_PREFIX>>-code-reviewer only (no council, no parallel spawning). Follow FE-6 logic from `@skills/references/stage-fast-exec.md`:

- APPROVED or NITPICKS_ONLY → mark `council_review_ran.code: true`, update `stage: complete`, done
- CHANGES_REQUESTED (first time) → spawn <<DO:AGENT_PREFIX>>-executioner with fix instructions, override stage back to `execution: review_pending`, re-spawn <<DO:AGENT_PREFIX>>-code-reviewer once
- CHANGES_REQUESTED (second time) → abandon task: set `abandoned: true`, `pre_abandon_stage: execution`, `fast_path: false`. Print: "Fast-path review failed twice. The task has been abandoned and preserved at `.do/tasks/<filename>` for reference. Please run `/do:task "description"` to start fresh with the full workflow." Stop.

**Quick-path escalation resume** (for `review_pending` state, `quick_path: true`):

The escalated quick-path task file carries `council_review_ran.code: true` (preserving the two quick-path council rounds as history). Before invoking the full code-review stack, flip that flag back to `false` so the CR-0 resume guard in `stage-code-review.md` does not skip the review:

```bash
# Flip council_review_ran.code to false so CR-0 allows a fresh full review.
# The existing Council Review section with both quick-path rounds is preserved as history.
# Also override stage to execution:complete so stage-code-review.md picks it up correctly.
node <<DO:SCRIPTS_PATH>>/update-task-frontmatter.cjs set '.do/tasks/<active_task>' council_review_ran.code=false stages.execution=complete
```

Then invoke the full code-review stack via `@references/stage-code-review.md`. This brings in the full review stack (council + <<DO:AGENT_PREFIX>>-code-reviewer in parallel) rather than the single-reviewer tier that already failed twice.

**Important:** Do NOT delete the existing Council Review section — it contains both quick-path round-1 and round-2 findings, preserved as history. `stage-code-review.md` appends new findings; it does not overwrite.

After `@references/stage-code-review.md` returns:

- **VERIFIED** → `stage-code-review.md` CR-5 has already set `stage: verification`, `stages.verification: pending`, and `council_review_ran.code: true`. Spawn <<DO:AGENT_PREFIX>>-verifier.
- **ITERATE** → `stage-code-review.md` owns the loop (CR-5). Do NOT handle manually.
- **MAX_ITERATIONS** → show to user, stop (same as normal flow).

**Note on abandoned fast-path tasks:** When a fast-path task was abandoned via escalation, `fast_path` is set to `false`. The normal abandoned-task flow in Step 3 applies: restore `pre_abandon_stage`, resume. The task resumes as a normal `/do:task` pipeline from that point.

### Normal routing (fast_path: false or absent)

| Stage          | Sub-condition                                    | Action                                                        |
| -------------- | ------------------------------------------------ | ------------------------------------------------------------- |
| `refinement`   | stages.refinement: in_progress                   | Spawn <<DO:AGENT_PREFIX>>-planner to finish planning                           |
| `refinement`   | stages.refinement: complete, plan review not ran | Run stage-plan-review (parallel reviewers if council enabled) |
| `refinement`   | plan review complete, confidence < threshold     | Spawn <<DO:AGENT_PREFIX>>-griller                                              |
| `refinement`   | all complete                                     | Show approval checkpoint, then spawn <<DO:AGENT_PREFIX>>-executioner           |
| `execution`    | stages.execution: in_progress                    | Spawn <<DO:AGENT_PREFIX>>-executioner to continue                              |
| `execution`    | stages.execution: complete                       | Run stage-code-review (parallel reviewers if council enabled) |
| `verification` | any                                              | Spawn <<DO:AGENT_PREFIX>>-verifier                                             |
| `verified`     | -                                                | Spawn <<DO:AGENT_PREFIX>>-verifier (resumes at V5 UAT flow)                    |
| `complete`     | -                                                | Show "Task already complete. No action needed." and stop      |

### Spawn <<DO:AGENT_PREFIX>>-planner (resume planning)

<<DO:IF CLAUDE>>
```javascript
Agent({
  description: "Continue planning",
  subagent_type: "<<DO:AGENT_PREFIX>>-planner",
  model: "<models.overrides.planner || models.default>",
  prompt: `
Continue planning this task.

Task file: .do/tasks/<active_task>

The task file already exists. Read it, complete any missing sections.
Return structured summary when done.
`,
});
```
<<DO:ENDIF>>
<<DO:IF CODEX>>
Spawn the <<DO:AGENT_PREFIX>>-planner subagent with model `<models.overrides.planner || models.default>` and the description "Continue planning". Pass the following prompt:

Continue planning this task.

Task file: .do/tasks/<active_task>

The task file already exists. Read it, complete any missing sections.
Return structured summary when done.
<<DO:ENDIF>>

<<DO:IF CODEX>>
**Codex cleanup:** The <<DO:AGENT_PREFIX>>-planner subagent has completed and its output has been fully consumed. Close (dismiss) the <<DO:AGENT_PREFIX>>-planner subagent now to free the thread slot before proceeding.
<<DO:ENDIF>>

### Plan Review

@references/stage-plan-review.md

The resume guard (PR-0) handles the `council_review_ran.plan` skip-entirely check. If already ran, stage-plan-review returns immediately. Result handling:

- **APPROVED**: Continue to griller check / approval checkpoint
- **ITERATE**: stage-plan-review.md owns this loop — follow its PR-5 steps. ITERATE may resolve inline if all findings are nitpicks (see PR-4.5 in stage-plan-review.md). Do NOT handle plan revisions manually. stage-plan-review.md owns the ITERATE loop, including inline Edit tool calls for nitpick-only rounds. The caller must not bypass stage logic or edit the task file outside of the stage reference.
- **MAX_ITERATIONS** or **ESCALATE**: Show to user, stop

### Spawn <<DO:AGENT_PREFIX>>-griller

Before spawning, read the threshold from config:

```bash
node -e "const c=require('./.do/config.json'); console.log(c.auto_grill_threshold || 0.9)"
```

Use this value as `<threshold>` in the spawn prompt below.

<<DO:IF CLAUDE>>
```javascript
Agent({
  description: "Grill for clarity",
  subagent_type: "<<DO:AGENT_PREFIX>>-griller",
  model: "<models.overrides.griller || models.default>",
  prompt: `
Task confidence is below threshold. Ask clarifying questions.

Task file: .do/tasks/<active_task>
Current confidence: <score>
Threshold: <threshold>
`,
});
```
<<DO:ENDIF>>
<<DO:IF CODEX>>
Spawn the <<DO:AGENT_PREFIX>>-griller subagent with model `<models.overrides.griller || models.default>` and the description "Grill for clarity". Pass the following prompt:

Task confidence is below threshold. Ask clarifying questions.

Task file: .do/tasks/<active_task>
Current confidence: <score>
Threshold: <threshold>
<<DO:ENDIF>>

**Note:** The griller resolves the full question loop internally via AskUserQuestion (with inline text fallback). It returns only the final GRILLING COMPLETE summary — no relaying of questions through the orchestrator.

<<DO:IF CODEX>>
**Codex cleanup:** The <<DO:AGENT_PREFIX>>-griller subagent has completed and its output has been fully consumed. Close (dismiss) the <<DO:AGENT_PREFIX>>-griller subagent now to free the thread slot before proceeding.
<<DO:ENDIF>>

### Spawn <<DO:AGENT_PREFIX>>-executioner (new or resume)

<<DO:IF CLAUDE>>
```javascript
Agent({
  description: "Execute task",
  subagent_type: "<<DO:AGENT_PREFIX>>-executioner",
  model: "<models.overrides.executioner || models.default>",
  prompt: `
Execute (or continue executing) this task.

Task file: .do/tasks/<active_task>

Check Execution Log for prior progress.
Continue from where it left off.
`,
});
```
<<DO:ENDIF>>
<<DO:IF CODEX>>
Spawn the <<DO:AGENT_PREFIX>>-executioner subagent with model `<models.overrides.executioner || models.default>` and the description "Execute task". Pass the following prompt:

Execute (or continue executing) this task.

Task file: .do/tasks/<active_task>

Check Execution Log for prior progress.
Continue from where it left off.
<<DO:ENDIF>>

**Note:** Deviation decisions are handled internally — the executioner asks the user directly via AskUserQuestion (with inline text fallback). BLOCKED is only returned when the user explicitly chose "Pause and investigate" or both interaction methods failed. If BLOCKED is returned, display its output as-is — do NOT re-ask the user.

<<DO:IF CODEX>>
**Codex cleanup:** The <<DO:AGENT_PREFIX>>-executioner subagent has completed and its output has been fully consumed. Close (dismiss) the <<DO:AGENT_PREFIX>>-executioner subagent now to free the thread slot before proceeding to code review.
<<DO:ENDIF>>

### Code Review

@references/stage-code-review.md

The resume guard (CR-0) handles the `council_review_ran.code` skip-entirely check. If already ran, stage-code-review returns immediately (proceed to <<DO:AGENT_PREFIX>>-verifier). Result handling:

- **VERIFIED**: Task file updated with stage:verification — spawn <<DO:AGENT_PREFIX>>-verifier
- **ITERATE**: stage-code-review.md owns this loop — follow its CR-5 steps, which will re-spawn <<DO:AGENT_PREFIX>>-executioner and reviewers (up to 3x). ITERATE now passes classified findings to <<DO:AGENT_PREFIX>>-executioner as a prioritized brief (blockers first, nitpicks second — see CR-4.5 in stage-code-review.md). Do NOT fix code issues manually.
- **MAX_ITERATIONS**: Show to user, stop

### Spawn <<DO:AGENT_PREFIX>>-verifier

<<DO:IF CLAUDE>>
```javascript
Agent({
  description: "Verify implementation",
  subagent_type: "<<DO:AGENT_PREFIX>>-verifier",
  model:
    "<models.overrides.verifier || models.overrides.code_reviewer || models.default>",
  prompt: `
Run verification for this task.

Task file: .do/tasks/<active_task>

Run verification: approach checklist, quality checks, UAT.
If stage is verified, resume at UAT flow (Step V5).
`,
});
```
<<DO:ENDIF>>
<<DO:IF CODEX>>
Spawn the <<DO:AGENT_PREFIX>>-verifier subagent with model `<models.overrides.verifier || models.overrides.code_reviewer || models.default>` and the description "Verify implementation". Pass the following prompt:

Run verification for this task.

Task file: .do/tasks/<active_task>

Run verification: approach checklist, quality checks, UAT.
If stage is verified, resume at UAT flow (Step V5).
<<DO:ENDIF>>

**Note:** UAT approval and fail handling are resolved internally — the verifier asks the user directly via AskUserQuestion (with inline text fallback). If FAIL or UAT_FAILED is returned, display the verifier's output as-is — it already contains the user's chosen next step. Do NOT re-ask.

<<DO:IF CODEX>>
**Codex cleanup:** The <<DO:AGENT_PREFIX>>-verifier subagent has completed and its output has been fully consumed. Close (dismiss) the <<DO:AGENT_PREFIX>>-verifier subagent now to free the thread slot before proceeding.
<<DO:ENDIF>>

## Step 7: Handle <<DO:CLAUDE:Agent Result>><<DO:CODEX:Subagent Result>>

<<DO:CLAUDE:After agent returns>><<DO:CODEX:After subagent returns>>, check the result and either:

- Continue to next stage (loop back to Step 6)
- Show completion summary
- Report blocker/failure to user

---

## Files

- **Task template:** @references/task-template.md

```

```
