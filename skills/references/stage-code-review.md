---
name: stage-code-review
description: Orchestrator code review block. Council gate check, parallel reviewer spawning (when enabled), verdict combination, iteration loop via <<DO:AGENT_PREFIX>>-executioner, stage update, and escalation rules.
---

<<DO:IF CODEX>>
**Agent authorization:** The caller workflow has authorized spawning all agents
referenced in this file (<<DO:AGENT_PREFIX>>-code-reviewer, <<DO:AGENT_PREFIX>>-council-reviewer, <<DO:AGENT_PREFIX>>-executioner
on ITERATE). Spawn them as subagents — do NOT execute their work inline. If spawning
fails, STOP and report; do not fall back to inline execution.

<<DO:ENDIF>>
# Code Review Stage

This reference file is loaded by `do:task` (Step 10) and `do:continue` (stage routing for `execution` + stages.execution: complete). It encodes the full code review logic including council gate, parallel spawning, verdict combination, iteration, stage update, and escalation.

**Caller contract:** When this stage returns VERIFIED, the task file has been updated with `stage: verification`, `stages.verification: pending`, and `council_review_ran.code: true`. Continue to <<DO:AGENT_PREFIX>>-verifier. If MAX_ITERATIONS, stop and present to the user.

---

## CR-0: Resume Guard

Check if code review already ran:

```bash
node <<DO:SCRIPTS_PATH>>/update-task-frontmatter.cjs check '.do/tasks/<active_task>' council_review_ran.code
```

**If already ran (exit 1):** Skip this entire stage. Return control to caller (proceed to <<DO:AGENT_PREFIX>>-verifier).

---

## CR-1: Council Gate Check

Resolve config using the cascade (project → workspace → defaults):

```bash
node <<DO:SCRIPTS_PATH>>/council-gate.cjs execution
```

Store result as `council_enabled` (enabled/disabled).

---

## CR-2: Initialize Iteration Counter

Set `code_review_iterations = 0` (in-session variable, not persisted to task file).

---

## CR-3: Spawn Reviewers

### CR-3a: If council enabled

<<DO:IF CLAUDE>>
Spawn TWO agents in a SINGLE message (both Agent calls in one response):

```javascript
// Both calls sent in the same message — parallel dispatch
Agent({
  description: "Self-review code",
  subagent_type: "<<DO:AGENT_PREFIX>>-code-reviewer",
  model: "<models.overrides.code_reviewer || models.default>",
  prompt: `
Review the code changes from this task execution.

Task file: .do/tasks/<active_task>
<<DO:ENDIF>>
<<DO:IF CODEX>>
In a single response, spawn BOTH of the following subagents (parallel dispatch — do NOT wait between them):
<<DO:ENDIF>>

<<DO:IF CLAUDE>>
Read the task file and git diff, evaluate the changes against the 6 criteria (Correctness, Quality, Tests, Types, Security, Completeness), and return APPROVED, NITPICKS_ONLY, or CHANGES_REQUESTED with file:line references.
`
})
<<DO:ENDIF>>
<<DO:IF CODEX>>
Spawn the <<DO:AGENT_PREFIX>>-code-reviewer subagent with model `<models.overrides.code_reviewer || models.default>` and the description "Self-review code". Pass the following prompt:

Review the code changes from this task execution.

Task file: .do/tasks/<active_task>

Read the task file and git diff, evaluate the changes against the 6 criteria (Correctness, Quality, Tests, Types, Security, Completeness), and return APPROVED, NITPICKS_ONLY, or CHANGES_REQUESTED with file:line references.

Spawn the <<DO:AGENT_PREFIX>>-council-reviewer subagent with model `<models.overrides.code_reviewer || models.default>` and the description "Council review code". Pass the following prompt:
<<DO:ENDIF>>

<<DO:IF CLAUDE>>
Agent({
  description: "Council review code",
  subagent_type: "<<DO:AGENT_PREFIX>>-council-reviewer",
  model: "<models.overrides.code_reviewer || models.default>",
  prompt: `
<<DO:ENDIF>>
Run council review for this task's code changes.

Task file: .do/tasks/<active_task>
Review type: code
Workspace: <pwd>

Run council-invoke.cjs --type code and return the structured verdict.
<<DO:IF CLAUDE>>
`
})
```
<<DO:ENDIF>>

<<DO:IF CLAUDE>>
Wait for BOTH agents to complete before proceeding to CR-4.
<<DO:ENDIF>>
<<DO:IF CODEX>>
Wait for BOTH subagents to complete before proceeding to CR-4.
<<DO:ENDIF>>

### CR-3b: If council disabled

<<DO:IF CLAUDE>>
Spawn only <<DO:AGENT_PREFIX>>-code-reviewer:

```javascript
Agent({
  description: "Self-review code (council disabled)",
  subagent_type: "<<DO:AGENT_PREFIX>>-code-reviewer",
  model: "<models.overrides.code_reviewer || models.default>",
  prompt: `
Review the code changes from this task execution.

Task file: .do/tasks/<active_task>

Read the task file and git diff, evaluate the changes against the 6 criteria (Correctness, Quality, Tests, Types, Security, Completeness), and return APPROVED, NITPICKS_ONLY, or CHANGES_REQUESTED with file:line references.
`
})
```

Apply single-review fallback in CR-4b (skip CR-4a).
<<DO:ENDIF>>
<<DO:IF CODEX>>
Spawn the <<DO:AGENT_PREFIX>>-code-reviewer subagent with model `<models.overrides.code_reviewer || models.default>` and the description "Self-review code (council disabled)". Pass the following prompt:

Review the code changes from this task execution.

Task file: .do/tasks/<active_task>

Read the task file and git diff, evaluate the changes against the 6 criteria (Correctness, Quality, Tests, Types, Security, Completeness), and return APPROVED, NITPICKS_ONLY, or CHANGES_REQUESTED with file:line references.

Apply single-review fallback in CR-4b (skip CR-4a).
<<DO:ENDIF>>

---

## CR-4: Combine Verdicts

### CR-4a: Two-reviewer combination (council enabled)

Collect `self_verdict` (APPROVED/NITPICKS_ONLY/CHANGES_REQUESTED) from <<DO:AGENT_PREFIX>>-code-reviewer and `council_verdict` (APPROVED/NITPICKS_ONLY/CHANGES_REQUESTED) from <<DO:AGENT_PREFIX>>-council-reviewer.

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

Map self-reviewer verdict directly:

| Self-Review | Combined |
|-------------|----------|
| APPROVED | **VERIFIED** |
| NITPICKS_ONLY | **VERIFIED** (log nitpicks) |
| CHANGES_REQUESTED | **ITERATE** |

---

## CR-4.5: Classify Findings (when combined verdict is ITERATE)

When the combined verdict from CR-4 is ITERATE, classify findings before building the brief for <<DO:AGENT_PREFIX>>-executioner.

Load and follow `@references/classify-findings.md`. The self-review output comes from <<DO:AGENT_PREFIX>>-code-reviewer (CHANGES_REQUESTED response).

**No decision matrix for code review.** Code review CR-5 ITERATE always respawns <<DO:AGENT_PREFIX>>-executioner — there is no inline-fix path. Classification is used only to build a prioritized brief: blockers section first ("Must fix"), nitpicks section second ("Should fix"). This helps the executioner prioritize but does not change the branch logic.

---

## CR-5: Handle Combined Verdict

### If VERIFIED

1. Log any nitpicks to the task file (non-blocking)
2. Update task frontmatter (merge — do not replace the full object):
   ```yaml
   stage: verification
   stages:
     verification: pending
   council_review_ran:
     code: true   # merge into existing object — plan: true is already set
   ```
<<DO:IF CODEX>>
2.5. **Codex cleanup (council enabled path):** Both <<DO:AGENT_PREFIX>>-code-reviewer and <<DO:AGENT_PREFIX>>-council-reviewer subagents have completed and their output has been fully consumed. Close (dismiss) both subagents now to free thread slots before returning VERIFIED to the caller.

**Codex cleanup (council disabled path):** The <<DO:AGENT_PREFIX>>-code-reviewer subagent has completed and its output has been fully consumed. Close (dismiss) the subagent now to free the thread slot before returning VERIFIED to the caller.
<<DO:ENDIF>>
3. Return control to caller (continue to <<DO:AGENT_PREFIX>>-verifier).

### If ITERATE

**Step 1: Increment the iteration counter.**

Increment `code_review_iterations` BEFORE deciding which branch to take. This ensures the counter reflects the current round, so round 3 immediately hits MAX_ITERATIONS. The effective cap is:
- Round 1 increments to 1 → proceed with RESPAWN
- Round 2 increments to 2 → proceed with RESPAWN
- Round 3 increments to 3 → MAX_ITERATIONS

**If `code_review_iterations = 3`:** escalate immediately (see MAX_ITERATIONS section below).

**If `code_review_iterations < 3`:** continue with the steps below.

1. Classify findings via CR-4.5 to build a prioritized brief
3. Deserialize `classified_findings_json` into a `classified_findings` object before using it in the prompt.

   **The orchestrator constructs the actual invocation — this is not a copy-paste script.** The `classified_findings_json` string from CR-4.5 contains finding text that may include apostrophes or other characters that break shell string literals. Use the temp-file approach to parse it safely.

   **Instructions for the orchestrator:**

   1. Take the `classified_findings_json` string captured from CR-4.5 stdout (e.g. `{"blockers":["[blocker] scope gap"],"nitpicks":["[nitpick] typo"]}`).
   2. Write it to a temp file (e.g. `/tmp/do-cr-classified.json`) to avoid shell quoting issues.
   3. Parse via Node.js to produce the `classified_findings` object:

   ```bash
   # /tmp/do-cr-classified.json was written in step 2 with the classified_findings_json content
   node -e "
   const fs = require('fs');
   const classified = JSON.parse(fs.readFileSync('/tmp/do-cr-classified.json', 'utf8'));
   // Use classified.blockers and classified.nitpicks to build the executioner prompt
   console.log(JSON.stringify(classified));
   "
   ```

   Store the parsed result as `classified_findings` (an object with `blockers` and `nitpicks` arrays).

<<DO:IF CODEX>>
3.5. **Codex cleanup (council enabled path):** Both <<DO:AGENT_PREFIX>>-code-reviewer and <<DO:AGENT_PREFIX>>-council-reviewer subagents have completed and their output has been fully consumed. Close (dismiss) both subagents now to free thread slots before spawning <<DO:AGENT_PREFIX>>-executioner for fixes.

**Codex cleanup (council disabled path):** The <<DO:AGENT_PREFIX>>-code-reviewer subagent has completed and its output has been fully consumed. Close (dismiss) the subagent now to free the thread slot before spawning <<DO:AGENT_PREFIX>>-executioner for fixes.
<<DO:ENDIF>>
4. Spawn <<DO:AGENT_PREFIX>>-executioner with classified findings as a prioritized fix brief:
<<DO:IF CLAUDE>>
   ```javascript
   Agent({
     description: "Fix code review issues (iteration <N>)",
     subagent_type: "<<DO:AGENT_PREFIX>>-executioner",
     model: "<models.overrides.executioner || models.default>",
     prompt: `
   Fix the issues identified in code review.

   Task file: .do/tasks/<active_task>

   Must fix (blockers):
   <classified_findings.blockers joined with newlines, with file:line references>

   Should fix (nitpicks):
   <classified_findings.nitpicks joined with newlines, with file:line references>

   Fix each issue. Log changes in the Execution Log. Return summary when complete.
   `
   })
   ```
5. Wait for <<DO:AGENT_PREFIX>>-executioner to complete
6. Log the iteration in the task file:
   ```markdown
   ## Code Review Iterations
<<DO:ENDIF>>

<<DO:IF CLAUDE>>
   ### Iteration <N>
   - **Self-review:** <verdict>
     - <issue 1> at file:line
   - **Council:** <verdict> (or "disabled")
     - <issue 1> at file:line
   - **Action:** Spawned <<DO:AGENT_PREFIX>>-executioner with prioritized findings (blockers: <N>, nitpicks: <M>); executor completed
   ```
7. Return to CR-3 and re-spawn both review agents
<<DO:ENDIF>>
<<DO:IF CODEX>>
   Spawn the <<DO:AGENT_PREFIX>>-executioner subagent with model `<models.overrides.executioner || models.default>` and the description "Fix code review issues (iteration <N>)". Pass the following prompt:

   Fix the issues identified in code review.

   Task file: .do/tasks/<active_task>

   Must fix (blockers):
   <classified_findings.blockers joined with newlines, with file:line references>

   Should fix (nitpicks):
   <classified_findings.nitpicks joined with newlines, with file:line references>

   Fix each issue. Log changes in the Execution Log. Return summary when complete.

5. Wait for <<DO:AGENT_PREFIX>>-executioner to complete
6. Log the iteration in the task file:
   ```markdown
   ## Code Review Iterations

   ### Iteration <N>
   - **Self-review:** <verdict>
     - <issue 1> at file:line
   - **Council:** <verdict> (or "disabled")
     - <issue 1> at file:line
   - **Action:** Spawned <<DO:AGENT_PREFIX>>-executioner with prioritized findings (blockers: <N>, nitpicks: <M>); executor completed
   ```
7. **Codex cleanup:** The <<DO:AGENT_PREFIX>>-executioner subagent has completed and its output has been fully consumed. Close (dismiss) the <<DO:AGENT_PREFIX>>-executioner subagent now to free the thread slot before returning to CR-3.
8. Return to CR-3 and re-spawn both review agents
<<DO:ENDIF>>

### MAX_ITERATIONS (code_review_iterations = 3)

Escalate with MAX_ITERATIONS:

```markdown
## CODE REVIEW: MAX ITERATIONS

**Iterations:** 3/3
**Status:** Could not resolve all issues after 3 attempts

### Outstanding Issues
<list remaining issues with file:line references>

### Options
1. Proceed anyway (ship with known issues)
2. Fix manually and run /do:continue
3. Abandon task
```

Stop and await user decision.
