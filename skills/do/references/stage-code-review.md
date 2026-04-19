---
name: stage-code-review
description: Orchestrator code review block. Council gate check, parallel reviewer spawning (when enabled), verdict combination, iteration loop via do-executioner, stage update, and escalation rules.
---

# Code Review Stage

This reference file is loaded by `do:task` (Step 10) and `do:continue` (stage routing for `execution` + stages.execution: complete). It encodes the full code review logic including council gate, parallel spawning, verdict combination, iteration, stage update, and escalation.

**Caller contract:** When this stage returns VERIFIED, the task file has been updated with `stage: verification`, `stages.verification: pending`, and `council_review_ran.code: true`. Continue to do-verifier. If MAX_ITERATIONS, stop and present to the user.

---

## CR-0: Resume Guard

Check if code review already ran:

```bash
node -e "const fm=require('gray-matter'); const t=fm(require('fs').readFileSync('.do/tasks/<active_task>','utf8')); process.exit(t.data.council_review_ran?.code === true ? 1 : 0)"
```

**If already ran (exit 1):** Skip this entire stage. Return control to caller (proceed to do-verifier).

---

## CR-1: Council Gate Check

Resolve config using the cascade (project → workspace → defaults):

```bash
node -e "
const path = require('path');
const fs = require('fs');
const installedPath = path.join(require('os').homedir(), '.claude/commands/do/scripts/council-invoke.cjs');
const devPath = path.join(process.cwd(), 'skills/do/scripts/council-invoke.cjs');
const scriptPath = fs.existsSync(installedPath) ? installedPath : devPath;
const { resolveConfig } = require(scriptPath);
const cfg = resolveConfig('.do/config.json', process.cwd());
console.log(cfg.council_reviews?.execution === true ? 'enabled' : 'disabled');
"
```

Store result as `council_enabled` (enabled/disabled).

---

## CR-2: Initialize Iteration Counter

Set `code_review_iterations = 0` (in-session variable, not persisted to task file).

---

## CR-3: Spawn Reviewers

### CR-3a: If council enabled

Spawn TWO agents in a SINGLE message (both Agent calls in one response):

```javascript
// Both calls sent in the same message — parallel dispatch
Agent({
  description: "Self-review code",
  subagent_type: "do-code-reviewer",
  model: "<models.overrides.code_reviewer || models.default>",
  prompt: `
Review the code changes from this task execution.

Task file: .do/tasks/<active_task>

Read the task file and git diff, evaluate the changes against the 6 criteria (Correctness, Quality, Tests, Types, Security, Completeness), and return APPROVED, NITPICKS_ONLY, or CHANGES_REQUESTED with file:line references.
`
})

Agent({
  description: "Council review code",
  subagent_type: "do-council-reviewer",
  model: "<models.overrides.code_reviewer || models.default>",
  prompt: `
Run council review for this task's code changes.

Task file: .do/tasks/<active_task>
Review type: code
Workspace: <pwd>

Run council-invoke.cjs --type code and return the structured verdict.
`
})
```

Wait for BOTH agents to complete before proceeding to CR-4.

### CR-3b: If council disabled

Spawn only do-code-reviewer:

```javascript
Agent({
  description: "Self-review code (council disabled)",
  subagent_type: "do-code-reviewer",
  model: "<models.overrides.code_reviewer || models.default>",
  prompt: `
Review the code changes from this task execution.

Task file: .do/tasks/<active_task>

Read the task file and git diff, evaluate the changes against the 6 criteria (Correctness, Quality, Tests, Types, Security, Completeness), and return APPROVED, NITPICKS_ONLY, or CHANGES_REQUESTED with file:line references.
`
})
```

Apply single-review fallback in CR-4b (skip CR-4a).

---

## CR-4: Combine Verdicts

### CR-4a: Two-reviewer combination (council enabled)

Collect `self_verdict` (APPROVED/NITPICKS_ONLY/CHANGES_REQUESTED) from do-code-reviewer and `council_verdict` (APPROVED/NITPICKS_ONLY/CHANGES_REQUESTED) from do-council-reviewer.

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

When the combined verdict from CR-4 is ITERATE, classify findings before building the brief for do-executioner.

**The orchestrator constructs the actual invocation — this is not a copy-paste script.** The inputs (`self_review_output` and `council_agent_output`) are multiline markdown/text from agent responses. They may contain apostrophes, double quotes, and newlines that would break any shell string literal. The orchestrator must write the agent output to a temporary file or use a heredoc to pass it safely to Node.js.

**Instructions for the orchestrator:**

1. Resolve the `council-invoke.cjs` path (installed or dev):
   - Installed: `~/.claude/commands/do/scripts/council-invoke.cjs`
   - Dev: `<cwd>/skills/do/scripts/council-invoke.cjs`
2. Write the self-reviewer output to a temp file (e.g. `/tmp/do-self-review.txt`) and the council agent output to another (e.g. `/tmp/do-council-review.txt`). If council is disabled, write an empty file for the council path.
3. Run `parseSelfReviewFindings()` on the self-review agent's output text (the full CHANGES_REQUESTED markdown response from do-code-reviewer).
4. Run `parseCouncilRunnerOutput()` on the council agent's output text (the flattened `VERDICT: ...\nAdvisor: ...\nFindings:\n- ...\nRecommendations:\n- ...` block from do-council-reviewer). Do NOT use `parseFindings()` — that function parses raw advisor markdown with `### Key Findings` headers, not council runner output.
5. Merge the results into a single `allFindings` array.
6. Run `classifyFindings()` on the merged array to produce `{ blockers: [...], nitpicks: [...] }`.
7. Write the JSON result to stdout (via `JSON.stringify`) so it can be captured as `classified_findings_json`.

Example invocation using temp files (the orchestrator adapts this to its actual tool — Bash with heredoc, Write tool + Bash, etc.):

```bash
# Step 1: write agent outputs to temp files (orchestrator does this via Write tool or heredoc)
# /tmp/do-self-review.txt   <- full text of do-code-reviewer agent response
# /tmp/do-council-review.txt <- full text of do-council-reviewer agent response (or empty)

# Step 2: invoke the classifier
node -e "
const path = require('path');
const fs = require('fs');
const installedPath = path.join(require('os').homedir(), '.claude/commands/do/scripts/council-invoke.cjs');
const devPath = path.join(process.cwd(), 'skills/do/scripts/council-invoke.cjs');
const scriptPath = fs.existsSync(installedPath) ? installedPath : devPath;
const { parseSelfReviewFindings, parseCouncilRunnerOutput, classifyFindings } = require(scriptPath);
const selfText = fs.readFileSync('/tmp/do-self-review.txt', 'utf8');
const councilText = fs.readFileSync('/tmp/do-council-review.txt', 'utf8');
const selfFindings = parseSelfReviewFindings(selfText);
const councilFindings = parseCouncilRunnerOutput(councilText);
const allFindings = [...selfFindings, ...councilFindings];
const classified = classifyFindings(allFindings);
console.log(JSON.stringify(classified));
"
```

Store the stdout as `classified_findings_json` (a JSON string, e.g. `{"blockers":[...],"nitpicks":[...]}`).

**No decision matrix for code review.** Code review CR-5 ITERATE always respawns do-executioner — there is no inline-fix path. Classification is used only to build a prioritized brief: blockers section first ("Must fix"), nitpicks section second ("Should fix"). This helps the executioner prioritize but does not change the branch logic.

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
3. Return control to caller (continue to do-verifier).

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

4. Spawn do-executioner with classified findings as a prioritized fix brief:
   ```javascript
   Agent({
     description: "Fix code review issues (iteration <N>)",
     subagent_type: "do-executioner",
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
5. Wait for do-executioner to complete
6. Log the iteration in the task file:
   ```markdown
   ## Code Review Iterations

   ### Iteration <N>
   - **Self-review:** <verdict>
     - <issue 1> at file:line
   - **Council:** <verdict> (or "disabled")
     - <issue 1> at file:line
   - **Action:** Spawned do-executioner with prioritized findings (blockers: <N>, nitpicks: <M>); executor completed
   ```
7. Return to CR-3 and re-spawn both review agents

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
