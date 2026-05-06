---
name: do:task
description: "Start a new piece of work with agent-based workflow. Orchestrates <<DO:AGENT_PREFIX>>-planner, <<DO:AGENT_PREFIX>>-plan-reviewer + <<DO:AGENT_PREFIX>>-council-reviewer (parallel, at plan review), <<DO:AGENT_PREFIX>>-griller (if needed), <<DO:AGENT_PREFIX>>-executioner, <<DO:AGENT_PREFIX>>-code-reviewer + <<DO:AGENT_PREFIX>>-council-reviewer (parallel, at code review), and <<DO:AGENT_PREFIX>>-verifier agents. Creates task file, runs reviews, executes, reviews code, and verifies."
argument-hint: '"description of what you want to accomplish"'
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

# /do:task

Orchestrate a complete task workflow using specialized agents.

<<DO:IF CODEX>>

## Agent Authorization

By invoking this workflow, the user explicitly authorizes spawning the following
internal agents. These agents are integral to the workflow contract and MUST be
spawned as subagents — they are not optional.

| Agent                                | Role                                                                                       |
| ------------------------------------ | ------------------------------------------------------------------------------------------ |
| <<DO:AGENT_PREFIX>>-planner          | Fills in the task file: Problem Statement, Approach, Concerns, confidence score            |
| <<DO:AGENT_PREFIX>>-plan-reviewer    | Reviews the plan against 5 criteria (Clarity, Completeness, Feasibility, Atomicity, Risks) |
| <<DO:AGENT_PREFIX>>-council-reviewer | Independent council review of the plan (when council gate is enabled)                      |
| <<DO:AGENT_PREFIX>>-griller          | Asks clarifying questions when confidence is below threshold                               |
| <<DO:AGENT_PREFIX>>-executioner      | Implements the plan step by step, logs progress, handles deviations                        |
| <<DO:AGENT_PREFIX>>-code-reviewer    | Reviews code changes against 6 criteria after execution                                    |
| <<DO:AGENT_PREFIX>>-verifier         | Runs approach checklist, quality checks, and UAT after code review                         |

**No inline fallback:** If agent spawning is unavailable or blocked, STOP immediately
and report: "Cannot spawn required agents. This workflow requires <<DO:CLAUDE:agent spawning>><<DO:CODEX:subagent spawning>> to
function correctly. Please ensure agent spawning is enabled and retry." Do NOT fall back
to inline execution — inline execution bypasses review gates and breaks the workflow
contract.

<<DO:ENDIF>>

## Why this exists

Orchestrates 7 specialized agents to ensure every task gets proper planning, review, execution, and verification.

## Usage

```
/do:task "description of what you want to accomplish"
```

## Prerequisites

1. **Project initialized** — `.do/config.json` exists
2. **Database entry exists** — `project.md` exists for this project

## Workflow

```
<<DO:AGENT_PREFIX>>-planner (cyan) → <<DO:AGENT_PREFIX>>-plan-reviewer (green)  ┐ (parallel) → <<DO:AGENT_PREFIX>>-griller (yellow, if needed)
<<DO:IF CLAUDE>>
                    <<DO:AGENT_PREFIX>>-council-reviewer (purple)┘                        ↓
<<DO:ENDIF>>
<<DO:IF CODEX>>
                        <<DO:AGENT_PREFIX>>-council-reviewer (purple)┘                        ↓
<<DO:ENDIF>>
                                                              USER APPROVAL
                                                                         ↓
                                                            <<DO:AGENT_PREFIX>>-executioner (red)
                                                                         ↓
                                                 <<DO:AGENT_PREFIX>>-code-reviewer (blue)  ┐ (parallel)
                                                 <<DO:AGENT_PREFIX>>-council-reviewer (purple)┘
                                                                         ↓
                                                            <<DO:AGENT_PREFIX>>-verifier (silver)
```

---

## Step -1: Parse Delivery Contract

Check if `$ARGUMENTS` contains `--delivery=...`.

### If `--delivery=...` is present

1. Extract the value: everything after `--delivery=` up to the next unquoted space (or end of string).
2. Call `parseDeliveryArg(value)` from `@scripts/validate-delivery-contract.cjs`. If it returns `{ error }`, stop with:
   ```
   Delivery contract parse error: <error>
   Fix the --delivery argument and retry. See skills/references/delivery-contract.md for the expected format.
   ```
3. Call `validateDeliveryContract(delivery)` from the same module. If `{ valid: false }`, stop with:
   ```
   Delivery contract validation failed:
   <errors, one per line>
   Fix the --delivery argument and retry.
   ```
4. Call `applyDefaults(delivery)` and store the result as in-session variable `delivery_contract`.
5. Strip the `--delivery=...` flag from `$ARGUMENTS` so the remaining string is the clean task description for Step 0's routing heuristic.
6. Never touch `delivery_contract.onboarded` — pre-passed invocations skip onboarding entirely.

### If `--delivery=...` is absent

Read the project config:

```bash
node <<DO:SCRIPTS_PATH>>/read-config.cjs delivery
```

- **`onboarded: false`**: Trigger the onboarding flow. Load `@references/delivery-onboarding.md` and follow its instructions. After onboarding completes, set `delivery_contract` to whatever contract was established (or `null` if dismissed).
- **`onboarded: true, dismissed: true`**: Set `delivery_contract = null`. The executioner will use project defaults from `project.md`. This is the only path where implicit behavior is permitted — because the user explicitly opted in.
- **`onboarded: true, dismissed: false`**: Set `delivery_contract = null`. The entry command was previously wired but `--delivery` was not passed — this may be an error in the caller. Log a one-line warning but proceed: `"Warning: onboarded but --delivery not passed. Executioner will use project defaults."`.

### Thread delivery_contract into task file

At Step 4 (task file creation) and when invoking `@references/stage-fast-exec.md` (fast path):

- If `delivery_contract` is non-null, populate the `delivery:` frontmatter fields and render the `## Delivery Contract` markdown section with the contract data.
- If `delivery_contract` is null, leave both sections empty (commented-out defaults in frontmatter, empty comment block in markdown section).

Rendered `delivery:` frontmatter (when non-null):

```yaml
delivery:
  branch: <delivery_contract.branch>
  commit_prefix: <delivery_contract.commit_prefix>
  push_policy: <delivery_contract.push_policy>
  pr_policy: <delivery_contract.pr_policy>
  stop_after_push: <delivery_contract.stop_after_push>
  exclude_paths: <delivery_contract.exclude_paths as YAML flow-array, e.g. [".do/"]>
```

Render `exclude_paths` as a YAML flow-array (e.g. `[".do/"]`), never as a JSON-stringified value. Quotes around path strings stay single-level — no `\"` escapes.

Rendered `## Delivery Contract` format (when non-null):

```markdown
## Delivery Contract

- **Branch:** <delivery_contract.branch>
- **Commit prefix:** <delivery_contract.commit_prefix>
- **Push policy:** <delivery_contract.push_policy>
- **PR policy:** <delivery_contract.pr_policy>
- **Stop after push:** <delivery_contract.stop_after_push>
- **Exclude paths:** <delivery_contract.exclude_paths.join(', ')>
```

---

## Step 0: Smart Routing

**Manual entry via `/do:quick` or `/do:fast` skips this step entirely.** This router chooses between `quick`, `fast`, and the full `task` pipeline. `quick` is recommended when the change is 1-2 files, mechanical, high-confidence, and the conversation already has warm context for the change.

**Note on confidence:** Step 0 uses a single routing heuristic (0.0-1.0 scalar) to decide `quick` vs `fast` vs `task`. This is a routing heuristic only. If routed to `quick`, no planner confidence is calculated — quick-path has no task file on the happy path; the routing confidence is the only score used. If routed to full `task`, the planner runs its own 4-factor confidence calculation (context/scope/complexity/familiarity) which supersedes the routing score — the two mechanisms are independent.

### Heuristic Assessment

Perform a quick heuristic assessment from `$ARGUMENTS`:

1. **File scope estimate** — if the description mentions specific filenames or components, use a couple of Grep/Glob calls to estimate how many files are likely affected. Otherwise rate as "unclear". Target buckets: `1-3 files` / `4-6 files (shared-utility reuse)` / `6+ files` / `unclear`. Use the `4-6 files (shared-utility reuse)` bucket when the estimated file count is 4-6 AND the change is bounded mechanical reuse of an existing shared utility (e.g., replacing duplicate helpers with an existing shared function across several consumers) — the shared utility's contract must not be materially changing.

2. **Mechanical-vs-planning signal** — yes/no judgment: can the change be described in 1-2 sentences without branching decisions?
   - Presence of "and", "also", "plus" ≥ 2 times → planning signal
   - Presence of comparative decisions ("either X or Y", "depending on", "need to figure out") → planning signal
   - If both signals are absent and the change is a targeted fix → mechanical

3. **Confidence score** — 0.0-1.0 scalar (same mechanism as `/jira:start` Step 8):
   - Start at 1.0
   - Deduct for: business logic clarity unclear (-0.10), affected files unknown (-0.10), edge-case risk present (-0.10), multiple concerns bundled (-0.10)
   - Store as in-session `routing_confidence`. Do NOT write to a task file — no task file exists yet at this point.

4. **Warm-context signal** — yes/no judgment: was `/do:task` invoked mid-conversation after prior discussion of this exact change, or is it a cold start?
   - **Warm:** the current conversation already contains discussion, code snippets, or reasoning about the specific change described in `$ARGUMENTS`.
   - **Cold:** `/do:task` is the first mention of this change (cold start from Jira, backlog, or direct invocation with no prior discussion).
   - This is a soft signal — the user can always override. If warm-context is ambiguous, treat as cold.

### Decision Matrix

Rows are evaluated top-to-bottom; first match wins.

| Files                       | Mechanical | Confidence | Warm Context | Recommend                                             |
| --------------------------- | ---------- | ---------- | ------------ | ----------------------------------------------------- |
| 1-2                         | yes        | ≥ 0.8      | yes          | `quick`                                               |
| 1-3                         | yes        | ≥ 0.8      | any          | `fast`                                                |
| 4-6 (shared-utility reuse)  | yes        | ≥ 0.8      | any          | `fast`                                                |
| 4-6                         | any        | any        | any          | `task`                                                |
| any                         | no         | any        | any          | `task`                                                |
| any                         | any        | < 0.8      | any          | `task` (router honesty — default to full when unsure) |
| unclear                     | any        | any        | any          | `task`                                                |
| any                         | any        | any        | any          | `task` (catch-all)                                    |

**Router honesty:** If signals are ambiguous (description is vague, can't estimate file scope), default to `task` — do not gamble on `fast` or `quick`. Better to over-ceremony a small task than under-ceremony a subtle one. The user can always override down.

**Quick exclusions:** `quick` is excluded when any of the following apply: backend/API/schema/auth changes, broad generated-type fallout (e.g., a type change that cascades across many consumers), shared behavior/abstraction changes (utilities, hooks, context providers), state-machine modifications, unclear business logic, file scope is 3+, or context is cold.

### Present Assessment

Display the routing assessment:

```
## Routing assessment

Task: <description>
Assessment: <N files estimate>, <mechanical/planning>, confidence: <score>, context: <warm/cold>
Recommended: /do:<quick|fast|task>

Why not <tier>: <one-line reason for each non-recommended tier>

Proceed with [quick | fast | task]? [<recommended>]
```

The "Why not" lines explain why each non-recommended tier was rejected. Examples: "Why not quick: cold context (no prior discussion of this change)", "Why not task: mechanical change with clear 2-file scope, no planning needed", "Why not fast: unclear file scope, needs planning".

Present all three tiers with the recommended option as default.

### Branch on User Choice

**If user chooses `quick`:**

1. Do NOT run Steps 1-4 below. `/do:quick` has its own prerequisite, active-task, and model-config checks built into its flow.
2. Invoke `/do:quick "<description>"` and **STOP** — the quick skill handles everything from here (prerequisites, active task check, model config, inline execution, council review).

**Note:** The user will see a second confirmation inside `/do:quick` (the "Proceed? [Y/n]" prompt at QE-0) — this is by design. The router prompt confirms workflow tier selection; the `/do:quick` prompt confirms the specific change description and scope after its own prerequisite validation. These are separate concerns and collapsing them would create fragile coupling.

**If user chooses `fast`:**

1. Run Steps 1-3 below (prerequisites, active task guard, model config read — same as `/do:fast` Steps 1-3b). Skip Step 4 (task-file creation); the fast reference writes the task file itself.
2. Invoke `@references/stage-fast-exec.md` with `<description>` and `models` as in-session variables per the caller-contract preamble
3. **STOP** — do not fall through to Step 4. The fast reference handles task-file creation; falling through would write a second task file (violation of "no double task files" invariant).

**If user chooses `task`:**

- Continue normally to Step 1 below.

---

## Step 1: Check Prerequisites

```bash
node <<DO:SCRIPTS_PATH>>/check-database-entry.cjs --message
```

If fails, stop and report what's missing.

## Step 2: Check for Active Task

```bash
node <<DO:SCRIPTS_PATH>>/task-abandon.cjs check --config .do/config.json
```

If active task exists, offer options:

- Continue it (`/do:continue`)
- Abandon it and start new: `node <<DO:SCRIPTS_PATH>>/task-abandon.cjs abandon <filename>`
- Cancel

## Step 3: Read Model Config

```bash
node <<DO:SCRIPTS_PATH>>/read-config.cjs models
```

Store result for <<DO:CLAUDE:agent spawning>><<DO:CODEX:subagent spawning>>. Default to sonnet if not configured.

## Step 4: Create Task File

Generate task filename and create initial file:

```bash
# Generate filename: YYMMDD-<slug>.md
TASK_DATE=$(date +%y%m%d)
TASK_SLUG=$(echo "<description>" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | cut -c1-30)
TASK_FILE="${TASK_DATE}-${TASK_SLUG}.md"
```

Create task file from template using the Write tool:

- Read `@references/task-template.md`
- Replace `{{TASK_ID}}` with filename (without .md)
- Replace `{{CREATED_AT}}` with ISO timestamp
- Replace `{{DESCRIPTION}}` with user's task description
- Write to `.do/tasks/${TASK_FILE}`
- Leave all other `{{PLACEHOLDER}}` fields as-is — <<DO:AGENT_PREFIX>>-planner fills them in Step 5.

Update config:

```bash
node -e "
const fs = require('fs');
const c = JSON.parse(fs.readFileSync('.do/config.json', 'utf8'));
c.active_task = '${TASK_FILE}';
fs.writeFileSync('.do/config.json', JSON.stringify(c, null, 2));
"
```

## Step 5: Spawn <<DO:AGENT_PREFIX>>-planner

Spawn planner to fill in the task file:

<<DO:IF CLAUDE>>

```javascript
Agent({
  description: "Plan task: <description>",
  subagent_type: "<<DO:AGENT_PREFIX>>-planner",
  model: "<models.overrides.planner || models.default>",
  prompt: `
Complete the plan for this task.

Task description: <user's description>
Task file: .do/tasks/<active_task>
Config: .do/config.json

The task file already exists with basic metadata. Load context, analyze the task, 
calculate confidence, and fill in the Problem Statement, Approach, and Concerns sections.
Return a structured summary when complete.
`,
});
```

<<DO:ENDIF>>
<<DO:IF CODEX>>
Spawn the <<DO:AGENT_PREFIX>>-planner subagent with model `<models.overrides.planner || models.default>` and the description "Plan task: <description>". Pass the following prompt:

Complete the plan for this task.

Task description: <user's description>
Task file: .do/tasks/<active_task>
Config: .do/config.json

The task file already exists with basic metadata. Load context, analyze the task,
calculate confidence, and fill in the Problem Statement, Approach, and Concerns sections.
Return a structured summary when complete.
<<DO:ENDIF>>

Parse the returned summary for:

- Confidence score and factors
- Approach summary
- Concerns count

<<DO:IF CODEX>>
**Codex cleanup:** The <<DO:AGENT_PREFIX>>-planner subagent has completed and its output has been fully consumed. Close (dismiss) the <<DO:AGENT_PREFIX>>-planner subagent now to free the thread slot before proceeding to plan review.
<<DO:ENDIF>>

## Step 6: Plan Review

@references/stage-plan-review.md

Handle result:

- **APPROVED** (council_review_ran.plan set to true by reference file): Continue to Step 7
- **ITERATE**: stage-plan-review.md owns this loop — follow its PR-5 steps. ITERATE may resolve inline if all findings are nitpicks (see PR-4.5 in stage-plan-review.md). Do NOT handle plan revisions manually. stage-plan-review.md owns the ITERATE loop, including inline Edit tool calls for nitpick-only rounds. The caller must not bypass stage logic or edit the task file outside of the stage reference.
- **MAX_ITERATIONS**: Show user the outstanding issues, ask to proceed or revise
- **ESCALATE**: Show critical issues, require user decision

<!--
Schema note: When stage-plan-review.md applies nitpick-only rounds inline (PR-4.5 INLINE_NITPICKS path),
it logs the changes in a "### Inline Patches" subsection under the relevant "### Iteration <N>" entry
in the "## Review Iterations" section. This subsection lists each nitpick and the Edit applied.
Orchestrators resuming via /do:continue should be aware this subsection may exist.
-->

## Step 7: Check Confidence & Grill (if needed)

Read confidence from task file:

```bash
node <<DO:SCRIPTS_PATH>>/update-task-frontmatter.cjs read '.do/tasks/<active_task>' confidence
# Then read threshold from config:
node -e "const c=require('./.do/config.json'); console.log(JSON.stringify({ threshold: c.auto_grill_threshold || 0.9 }))"
```

Combine the confidence score from the first command with the threshold from the second.

If `score < threshold`:

<<DO:IF CLAUDE>>

```javascript
Agent({
  description: "Grill user for clarity",
  subagent_type: "<<DO:AGENT_PREFIX>>-griller",
  model: "<models.overrides.griller || models.default>",
  prompt: `
The task confidence is below threshold. Ask clarifying questions.

Task file: .do/tasks/<active_task>
Current confidence: <score>
Threshold: <threshold>

Ask targeted questions for lowest-scoring factors.
Present all questions at once. After receiving combined answer, update confidence for each Q&A pair independently. Check threshold after processing the full batch. If below threshold, batch any follow-up questions into the next round.
`,
});
```

<<DO:ENDIF>>
<<DO:IF CODEX>>
Spawn the <<DO:AGENT_PREFIX>>-griller subagent with model `<models.overrides.griller || models.default>` and the description "Grill user for clarity". Pass the following prompt:

The task confidence is below threshold. Ask clarifying questions.

Task file: .do/tasks/<active_task>
Current confidence: <score>
Threshold: <threshold>

Ask targeted questions for lowest-scoring factors.
Present all questions at once. After receiving combined answer, update confidence for each Q&A pair independently. Check threshold after processing the full batch. If below threshold, batch any follow-up questions into the next round.
<<DO:ENDIF>>

**Note:** The griller resolves the full question loop internally via AskUserQuestion (with inline text fallback). It returns only the final GRILLING COMPLETE summary to the orchestrator — no relaying of questions through the orchestrator.

<<DO:IF CODEX>>
**Codex cleanup:** The <<DO:AGENT_PREFIX>>-griller subagent has completed and its output has been fully consumed. Close (dismiss) the <<DO:AGENT_PREFIX>>-griller subagent now to free the thread slot before proceeding.
<<DO:ENDIF>>

## Step 8: User Approval Checkpoint

Display summary and ask for execution approval:

```

## Ready to Execute

**Task:** <task file>
**Confidence:** <score> (<factors>)
**Plan:** <approach summary>
**Reviews:** <plan review status>

Proceed with execution? [Y/n]

```

If user says no, stop. Task file is saved for later `/do:continue`.

## Step 9: Spawn <<DO:AGENT_PREFIX>>-executioner

<<DO:IF CLAUDE>>

```javascript
Agent({
  description: "Execute task",
  subagent_type: "<<DO:AGENT_PREFIX>>-executioner",
  model: "<models.overrides.executioner || models.default>",
  prompt: `
Execute the plan in this task file.

Task file: .do/tasks/<active_task>

Follow the Approach section step by step.
Log each action to Execution Log.
Handle deviations appropriately.
Return summary when complete.
`,
});
```

<<DO:ENDIF>>
<<DO:IF CODEX>>
Spawn the <<DO:AGENT_PREFIX>>-executioner subagent with model `<models.overrides.executioner || models.default>` and the description "Execute task". Pass the following prompt:

Execute the plan in this task file.

Task file: .do/tasks/<active_task>

Follow the Approach section step by step.
Log each action to Execution Log.
Handle deviations appropriately.
Return summary when complete.
<<DO:ENDIF>>

Handle result:

- **COMPLETE**: Continue to Step 10
- **BLOCKED**: The executioner has already asked the user via AskUserQuestion (with inline fallback). BLOCKED is only returned when the user explicitly chose "Pause and investigate" or both interaction methods failed. Display the executioner's output as-is — it already contains the issue context and the user's decision (or interaction failure note). Do NOT re-ask the user.
- **FAILED**: Show error, offer recovery options

<<DO:IF CODEX>>
**Codex cleanup:** The <<DO:AGENT_PREFIX>>-executioner subagent has completed and its output has been fully consumed. Close (dismiss) the <<DO:AGENT_PREFIX>>-executioner subagent now to free the thread slot before proceeding to code review.
<<DO:ENDIF>>

## Step 10: Code Review

@references/stage-code-review.md

Handle result:

- **VERIFIED** (stage:verification + council_review_ran.code set by reference file): Continue to Step 11
- **ITERATE**: stage-code-review.md owns this loop — follow its CR-5 steps, which will re-spawn <<DO:AGENT_PREFIX>>-executioner and reviewers (up to 3x). ITERATE now passes classified findings to <<DO:AGENT_PREFIX>>-executioner as a prioritized brief (blockers first, nitpicks second — see CR-4.5 in stage-code-review.md). Do NOT fix code issues manually.
- **MAX_ITERATIONS**: Show outstanding issues to user, ask to proceed or fix manually

## Step 11: Spawn <<DO:AGENT_PREFIX>>-verifier

<<DO:IF CLAUDE>>

```javascript
Agent({
  description: "Verify implementation",
  subagent_type: "<<DO:AGENT_PREFIX>>-verifier",
  model:
    "<models.overrides.verifier || models.overrides.code_reviewer || models.default>",
  prompt: `
Run verification flow for this task.

Task file: .do/tasks/<active_task>

Run verification: approach checklist, quality checks, UAT.
`,
});
```

<<DO:ENDIF>>
<<DO:IF CODEX>>
Spawn the <<DO:AGENT_PREFIX>>-verifier subagent with model `<models.overrides.verifier || models.overrides.code_reviewer || models.default>` and the description "Verify implementation". Pass the following prompt:

Run verification flow for this task.

Task file: .do/tasks/<active_task>

Run verification: approach checklist, quality checks, UAT.
<<DO:ENDIF>>

Handle result:

- **PASS**: Task marked complete by <<DO:AGENT_PREFIX>>-verifier; continue to Step 12
- **FAIL**: The verifier has already asked the user which fix option they prefer (via AskUserQuestion with inline fallback). Display the verifier's output as-is — it already contains the failure details and the user's chosen next step. Do NOT re-ask.
- **UAT_FAILED**: The verifier has already asked the user about loop-back vs new task (or generated the handoff prompt for >= 80% context). Display the verifier's output as-is — it already contains the user's decision or the handoff prompt. Do NOT re-ask.

<<DO:IF CODEX>>
**Codex cleanup:** The <<DO:AGENT_PREFIX>>-verifier subagent has completed and its output has been fully consumed. Close (dismiss) the <<DO:AGENT_PREFIX>>-verifier subagent now to free the thread slot before proceeding to completion.
<<DO:ENDIF>>

## Step 12: Completion

**Backlog cleanup:** Read the `backlog_item` field from the active task's frontmatter. If non-null, invoke `/do:backlog done <id>` to remove the item from BACKLOG.md. Log: "Removed backlog item `<id>` from BACKLOG.md."

Read the task file to check final stage:

```bash
node <<DO:SCRIPTS_PATH>>/update-task-frontmatter.cjs read '.do/tasks/<active_task>' stage
```

- **If stage is `complete`**: Display brief confirmation:
  ```
  Task complete.
  Task file: .do/tasks/<filename>
  ```
- **If stage is not `complete`** (UAT failed, verification failed, user chose to loop back): Display <<DO:AGENT_PREFIX>>-verifier's output as-is — it already contains the user's next steps.

---

## Failure Handling

Any <<DO:CLAUDE:agent failure>><<DO:CODEX:subagent failure>> returns immediately to user with:

- Which agent failed
- What it was trying to do
- Last known good state
- Task file path (for `/do:continue` resume)

No automatic retries. User decides next step.

---

## Files

- **Task template:** @references/task-template.md
- **Gate script:** @scripts/check-database-entry.cjs
- **Abandon script:** @scripts/task-abandon.cjs
- **Config reader:** @scripts/read-config.cjs
