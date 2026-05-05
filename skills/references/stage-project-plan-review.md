---
name: stage-project-plan-review
description: "Project plan review block for /do:project. Council gate check, parallel reviewer spawning (when enabled), verdict combination, iteration loop via <<DO:AGENT_PREFIX>>-planner, and escalation rules. Target file: project.md."
---

<<DO:IF CODEX>>
**Agent authorization:** The caller workflow has authorized spawning all agents
referenced in this file (<<DO:AGENT_PREFIX>>-plan-reviewer, <<DO:AGENT_PREFIX>>-council-reviewer, <<DO:AGENT_PREFIX>>-planner
on ITERATE). Spawn them as subagents — do NOT execute their work inline. If spawning
fails, STOP and report; do not fall back to inline execution.

<<DO:ENDIF>>
# Project Plan Review Stage

This reference file is loaded by `skills/project.md` after intake completes. It encodes the full plan review logic for `project.md`: council gate, parallel spawning, verdict combination, iteration, and escalation.

**Caller contract:** The caller provides `<project_path>` = abs path to `project.md` and `<active_project>` slug. When this stage returns APPROVED, `council_review_ran.project_plan: true` has been written into `project.md`'s frontmatter — continue to the next step. If ESCALATE or MAX_ITERATIONS, stop and present to the user. The caller does NOT need to spawn any agents — this stage owns the full loop.

---

## PR-0: Resume Guard

Check if project plan review already ran:

```bash
node <<DO:SCRIPTS_PATH>>/update-task-frontmatter.cjs check '<project_path>' council_review_ran.project_plan
```

**If already ran (exit 1):** Skip this entire stage. Return control to caller immediately.

---

## PR-1: Council Gate Check

Resolve config using the cascade (project → workspace → defaults):

```bash
node <<DO:SCRIPTS_PATH>>/council-gate.cjs project.plan planning
```

Store result as `council_enabled` (enabled/disabled).

---

## PR-2: Initialize Iteration Counter

Set `review_iterations = 0` (in-session variable, not persisted).

---

## PR-3: Spawn Reviewers

### PR-3a: If council enabled

<<DO:IF CLAUDE>>
Spawn TWO agents in a SINGLE message (both Agent calls in one response):

```javascript
// Both calls sent in the same message — parallel dispatch
Agent({
  description: "Self-review project plan",
  subagent_type: "<<DO:AGENT_PREFIX>>-plan-reviewer",
  model: "<models.overrides.plan_reviewer || models.default>",
  prompt: `
Review the project plan in this target file.

Target file: <project_path>
<<DO:ENDIF>>
<<DO:IF CODEX>>
In a single response, spawn BOTH of the following subagents (parallel dispatch — do NOT wait between them):
<<DO:ENDIF>>

<<DO:IF CLAUDE>>
Read the target file, evaluate the project plan against the 5 criteria
(Clarity, Completeness, Feasibility, Atomicity, Risks), and return PASS,
CONCERNS, or RETHINK with evidence. Focus on: vision clarity, phase list
feasibility, success criteria measurability, risk mitigations.
<<DO:ENDIF>>
<<DO:IF CODEX>>
Spawn the <<DO:AGENT_PREFIX>>-plan-reviewer subagent with model `<models.overrides.plan_reviewer || models.default>` and the description "Self-review project plan". Pass the following prompt:

Review the project plan in this target file.

Target file: <project_path>

Read the target file, evaluate the project plan against the 5 criteria
(Clarity, Completeness, Feasibility, Atomicity, Risks), and return PASS,
CONCERNS, or RETHINK with evidence. Focus on: vision clarity, phase list
feasibility, success criteria measurability, risk mitigations.
<<DO:ENDIF>>

<<DO:IF CLAUDE>>
If the target file's frontmatter has \`intake_override: true\`, intake
<<DO:ENDIF>>
<<DO:IF CODEX>>
If the target file's frontmatter has `intake_override: true`, intake
<<DO:ENDIF>>
exited below the configured confidence threshold via an explicit user
override (recorded in the session transcript). Weigh this in your
review: apply stricter scrutiny to Vision, Target Users, and Phase
Plan sections, and be prepared to return CONCERNS or RETHINK if the
plan inherits the intake uncertainty the override carried forward.
<<DO:IF CLAUDE>>
`
})
<<DO:ENDIF>>

<<DO:IF CLAUDE>>
Agent({
  description: "Council review project plan",
  subagent_type: "<<DO:AGENT_PREFIX>>-council-reviewer",
  model: "<models.overrides.plan_reviewer || models.default>",
  prompt: `
Run council review for this project plan.

Target file: <project_path>
Review type: plan
Workspace: <pwd>
<<DO:ENDIF>>
<<DO:IF CODEX>>
Spawn the <<DO:AGENT_PREFIX>>-council-reviewer subagent with model `<models.overrides.plan_reviewer || models.default>` and the description "Council review project plan". Pass the following prompt:

Run council review for this project plan.

Target file: <project_path>
Review type: plan
Workspace: <pwd>
<<DO:ENDIF>>

Run council-invoke.cjs --type plan --task-file "<project_path>" --workspace "<pwd>"
and return the structured verdict.
<<DO:IF CLAUDE>>
`
})
```
<<DO:ENDIF>>

<<DO:IF CLAUDE>>
Wait for BOTH agents to complete before proceeding to PR-4.
<<DO:ENDIF>>
<<DO:IF CODEX>>
Wait for BOTH subagents to complete before proceeding to PR-4.
<<DO:ENDIF>>

### PR-3b: If council disabled

<<DO:IF CLAUDE>>
Spawn only <<DO:AGENT_PREFIX>>-plan-reviewer:
<<DO:ENDIF>>
<<DO:IF CODEX>>
Spawn the <<DO:AGENT_PREFIX>>-plan-reviewer subagent with model `<models.overrides.plan_reviewer || models.default>` and the description "Self-review project plan (council disabled)". Pass the following prompt:

Review the project plan in this target file.

Target file: <project_path>

Read the target file, evaluate the project plan against the 5 criteria
(Clarity, Completeness, Feasibility, Atomicity, Risks), and return PASS,
CONCERNS, or RETHINK with evidence.
<<DO:ENDIF>>

<<DO:IF CLAUDE>>
```javascript
Agent({
  description: "Self-review project plan (council disabled)",
  subagent_type: "<<DO:AGENT_PREFIX>>-plan-reviewer",
  model: "<models.overrides.plan_reviewer || models.default>",
  prompt: `
Review the project plan in this target file.

Target file: <project_path>

Read the target file, evaluate the project plan against the 5 criteria
(Clarity, Completeness, Feasibility, Atomicity, Risks), and return PASS,
CONCERNS, or RETHINK with evidence.

If the target file's frontmatter has \`intake_override: true\`, intake
exited below the configured confidence threshold via an explicit user
override (recorded in the session transcript). Weigh this in your
review: apply stricter scrutiny to Vision, Target Users, and Phase
Plan sections, and be prepared to return CONCERNS or RETHINK if the
plan inherits the intake uncertainty the override carried forward.
`
})
```
<<DO:ENDIF>>
<<DO:IF CODEX>>
If the target file's frontmatter has `intake_override: true`, intake
exited below the configured confidence threshold via an explicit user
override (recorded in the session transcript). Weigh this in your
review: apply stricter scrutiny to Vision, Target Users, and Phase
Plan sections, and be prepared to return CONCERNS or RETHINK if the
plan inherits the intake uncertainty the override carried forward.
<<DO:ENDIF>>

Apply single-review fallback in PR-4b (skip PR-4a).

---

## PR-4: Combine Verdicts

### PR-4a: Two-reviewer combination (council enabled)

Collect `self_verdict` (PASS/CONCERNS/RETHINK) from <<DO:AGENT_PREFIX>>-plan-reviewer and `council_verdict` (LOOKS_GOOD/CONCERNS/RETHINK) from <<DO:AGENT_PREFIX>>-council-reviewer.

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

<<DO:IF CODEX>>
**Codex cleanup (council enabled path):** Both <<DO:AGENT_PREFIX>>-plan-reviewer and <<DO:AGENT_PREFIX>>-council-reviewer subagents have completed and their output has been fully consumed. Close (dismiss) both subagents now to free thread slots before returning APPROVED to the caller.

**Codex cleanup (council disabled path):** The <<DO:AGENT_PREFIX>>-plan-reviewer subagent has completed and its output has been fully consumed. Close (dismiss) the subagent now to free the thread slot before returning APPROVED to the caller.
<<DO:ENDIF>>

Update `project.md` frontmatter:
```yaml
council_review_ran:
  project_plan: true
```

Return control to caller (continue to next step).

### If ITERATE (and review_iterations < 3)

1. Increment `review_iterations`
2. Compile combined findings from both reviewers
3. Log the iteration in `project.md`:
   ```markdown
   ## Review Iterations

   ### Iteration <N>
   - **Self-review:** <verdict> - <summary of findings>
   - **Council:** <verdict> - <summary> (or "disabled")
   - **Changes made:** (pending — <<DO:AGENT_PREFIX>>-planner will revise)
   ```
<<DO:IF CODEX>>
3.5. **Codex cleanup (council enabled path):** Both <<DO:AGENT_PREFIX>>-plan-reviewer and <<DO:AGENT_PREFIX>>-council-reviewer subagents have completed and their output has been fully consumed. Close (dismiss) both subagents now to free thread slots before spawning <<DO:AGENT_PREFIX>>-planner for revision.

**Codex cleanup (council disabled path):** The <<DO:AGENT_PREFIX>>-plan-reviewer subagent has completed and its output has been fully consumed. Close (dismiss) the subagent now to free the thread slot before spawning <<DO:AGENT_PREFIX>>-planner for revision.
<<DO:ENDIF>>
4. Spawn <<DO:AGENT_PREFIX>>-planner with reviewer feedback:
<<DO:IF CLAUDE>>
   ```javascript
   Agent({
     description: "Revise project plan based on review feedback",
     subagent_type: "<<DO:AGENT_PREFIX>>-planner",
     model: "<models.overrides.planner || models.default>",
     prompt: `
   Revise the project plan based on review feedback.

   Target file: <project_path>
   Reviewer feedback: <combined findings from self-review and council>

   Update the Vision, Target Users, Non-Goals, Success Criteria, Constraints,
   Risks, and/or Phase Plan sections to address the issues listed. Do not change
   the project slug or frontmatter metadata (project_schema_version, status, etc.).
   Return a summary of changes made.
   `
   })
   ```
5. Wait for <<DO:AGENT_PREFIX>>-planner to complete
6. Update the iteration log entry with "Changes made: <planner summary>"
7. Return to PR-3 and re-spawn both reviewers
<<DO:ENDIF>>
<<DO:IF CODEX>>

   Spawn the <<DO:AGENT_PREFIX>>-planner subagent with model `<models.overrides.planner || models.default>` and the description "Revise project plan based on review feedback". Pass the following prompt:

   Revise the project plan based on review feedback.

   Target file: <project_path>
   Reviewer feedback: <combined findings from self-review and council>

   Update the Vision, Target Users, Non-Goals, Success Criteria, Constraints,
   Risks, and/or Phase Plan sections to address the issues listed. Do not change
   the project slug or frontmatter metadata (project_schema_version, status, etc.).
   Return a summary of changes made.

5. Wait for <<DO:AGENT_PREFIX>>-planner to complete
6. Update the iteration log entry with "Changes made: <planner summary>"
7. **Codex cleanup:** The <<DO:AGENT_PREFIX>>-planner subagent has completed and its output has been fully consumed. Close (dismiss) the <<DO:AGENT_PREFIX>>-planner subagent now to free the thread slot before returning to PR-3.
8. Return to PR-3 and re-spawn both reviewers
<<DO:ENDIF>>

### If ITERATE (and review_iterations = 3)

Escalate with MAX_ITERATIONS:

```markdown
## PROJECT PLAN REVIEW: MAX ITERATIONS

**Iterations:** 3/3
**Status:** Could not resolve all concerns after 3 attempts

### Outstanding Issues
<list remaining concerns from latest reviewer feedback>

### Options
1. Proceed anyway (acknowledge risks) — user explicitly accepts the outstanding concerns; caller records an override and advances to phase planning.
2. Revise `project.md` manually (edit Vision / Phase Plan / etc. in place), then re-invoke this stage reference against the already-active project. Do NOT run `/do:project new` — the skill rejects `new` while `active_project` is set. The active project stays active throughout revision.
3. Abandon project via `node <<DO:SCRIPTS_PATH>>/project-state.cjs abandon project <active_project>` (cascade + archive + clear `active_project`).
```

Stop and await user decision.

### If ESCALATE

Return immediately to user:

```markdown
## PROJECT PLAN REVIEW: NEEDS USER INPUT

**Self-Review:** <verdict>
**Council:** <verdict> (or "disabled")

### Critical Issues
<list the RETHINK-level concerns with evidence>

### Reviewer Recommendations
<list suggestions from reviewers>

User decision required before proceeding.
```

Stop and await user decision.
