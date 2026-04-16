---
id: 260414-add-revise-and-re-execute-loop
created: "2026-04-14T16:00:00Z"
updated: "2026-04-14T09:42:53.784Z"
description: "Add revise and re-execute loop to /do:task workflow for structured revision after code review or user feedback"
stage: abandoned
stages:
  refinement: abandoned
  grilling: pending
  execution: pending
  verification: pending
  abandoned: true
council_review_ran:
  plan: false
  code: false
confidence:
  score: 0.80
  factors: null
  context: -0.05
  scope: -0.05
  complexity: -0.05
  familiarity: -0.05
pre_abandon_stage: refinement
---

# Add Revise and Re-Execute Loop

## Problem Statement

After code review or user feedback, there's no structured way to update the task file with changes and re-execute. The user has to manually ask to update the task file, then manually ask to spawn the executor again. This "user requests changes -> update task -> re-execute" cycle is a natural part of any task workflow but isn't represented in the skill.

Every revision requires the user to manually orchestrate what should be an automatic loop. The workflow breaks out of the structured /do system into ad-hoc conversation, losing the benefits of task file tracking and execution logging.

### Acceptance Criteria

1. After code review returns CHANGES_REQUESTED, the workflow can loop back to execution with structured revision steps
2. A "Revision" section exists in the task file template to capture what changed and why
3. do-executioner can be re-spawned with instructions to execute only the revision steps (not the full Approach)
4. Revision execution is logged separately in the Execution Log (distinguishable from initial execution)
5. The loop works both from do-code-reviewer's CHANGES_REQUESTED verdict and from manual user feedback at UAT stage
6. /do:continue can detect "revision pending" state and route correctly

## Clarifications

## Context Loaded

- `~/workspace/database/projects/do/project.md` - Project overview, tech stack, conventions, directory structure
- `skills/do/task.md` - Current /do:task orchestrator showing the full workflow from planning through code review (Steps 1-11)
- `skills/do/continue.md` - /do:continue stage routing logic showing how stages map to agent spawning
- `skills/do/references/stage-execute.md` - Execution stage reference with E0-E4 steps, council review integration, and deviation handling
- `skills/do/references/stage-verify.md` - Verification stage with V-1 code review, V4 FAIL handling, V5 UAT flow, and V6 UAT failure loop-back
- `skills/do/references/task-template.md` - Task file template with all sections and YAML frontmatter schema
- `agents/do-executioner.md` - Executor agent with step-by-step execution, deviation handling, and logging format
- `agents/do-code-reviewer.md` - Code reviewer with self-review + council parallel spawning, ITERATE loop (up to 3x), and escalation
- `skills/do/references/resume-preamble.md` - Shared resume logic for /do:continue with context reload and progress detection

## Approach

### Design Decision: Integrate into existing stage system (not a new /do:revise command)

A separate /do:revise command would fragment the workflow. The revision loop fits naturally into the existing stage system: after code review or UAT failure, the task transitions back to execution with a revision scope. /do:continue already handles stage routing, so it can detect "revision pending" and route to a revision-scoped execution.

### Design Decision: Revision writes owned by stage-verify.md and /do:continue, not do-code-reviewer

do-code-reviewer is a verdict-returning agent -- it outputs APPROVED / NITPICKS_ONLY / CHANGES_REQUESTED and findings. It does not write to the task file beyond logging its own results. The responsibility to translate a verdict into a structured revision (write Revisions section, update frontmatter) belongs to the orchestrating layers: stage-verify.md (for the CHANGES_REQUESTED case during a running session) and /do:continue (for resumption after a break). This keeps do-code-reviewer stateless with respect to revision state.

### Step 1: Add revision tracking to task template frontmatter

**File:** `skills/do/references/task-template.md`

Add a `revision` field to the YAML frontmatter schema:

```yaml
revision:
  count: 0
  pending: false
  source: null  # "code_review" | "uat" | "user"
```

This tracks how many revision cycles have occurred, whether one is pending, and what triggered it.

### Step 2: Add "Revision" section to task template markdown body

**File:** `skills/do/references/task-template.md`

Add a new section between "Execution Log" and "Council Review":

```markdown
## Revisions

<!--
Populated when code review or UAT requests changes.
Each revision is a scoped re-execution cycle.

### Revision <N> (<source>)
**Trigger:** <what caused the revision - code review findings, UAT failure, user feedback>
**Steps:**
1. <specific change to make>
2. <specific change to make>

**Execution Log:**
### <timestamp>
**Files:** ...
**Status:** Complete / In progress
-->
```

### Step 3: Update stage-verify.md CHANGES_REQUESTED handler to create a structured revision

**File:** `skills/do/references/stage-verify.md`

In Step V-1.3 (handling a CHANGES_REQUESTED code review verdict), when the user chooses option 1 ("Fix issues"):

Instead of only updating `stage: execution` and telling the user to "Fix the issues, then run /do:continue":

- Translate the reviewer's findings into numbered revision steps and write them to the Revisions section
- Set frontmatter: `revision.pending: true`, `revision.source: "code_review"`, increment `revision.count`
- Set `stage: execution`, `stages.execution: in_progress`, `stages.verification: pending`
- Reset `council_review_ran.code: false` (code review must re-run after revision)
- Check `revision.count` against `max_revisions` from config.json (default 3); if exceeded, escalate to user instead
- Display: "Revision <N> written to task file. Run /do:continue to execute revision steps."

This converts a dead-end into a structured re-entry point. do-code-reviewer itself does not write revision state; it returns its verdict and findings, and stage-verify translates that verdict into revision steps.

### Step 4: Update stage-verify.md UAT failure to create revision

**File:** `skills/do/references/stage-verify.md`

In Step V6 (UAT failure), when estimated context is < 80% and user chooses option 1 ("Loop back to execution"):

Instead of the current ad-hoc "describe what to fix" flow that only updates frontmatter:

- Prompt user for what failed and what specific changes are needed
- Write structured revision steps to the Revisions section
- Set frontmatter: `revision.pending: true`, `revision.source: "uat"`, increment `revision.count`
- Set `stage: execution`, `stages.execution: in_progress`, `stages.verification: pending`
- Reset `council_review_ran.code: false` (code review must re-run after revision)
- Check `revision.count` against `max_revisions` from config.json (default 3); if exceeded, escalate to user

This replaces the current unstructured loop-back with the same revision structure used by code review.

### Step 5: Update stage-execute.md to handle revision-scoped execution

**File:** `skills/do/references/stage-execute.md`

Add a new check at the top of execution (after R0, before E-1):

```
Step E-0.5: Check for pending revision

Read frontmatter revision.pending. If true:
- Load the latest Revision section (highest N)
- Use revision Steps as the execution scope (NOT the full Approach)
- Skip E0 (context clear decision) - user is already in context
- Skip E-1 (plan review) - council_review_ran.plan is already true from initial run,
  so E-1 would be skipped anyway; document this explicitly rather than relying on flag state
- Jump directly to E2 with revision steps as the guide
- Mark revision.pending: false
- Log execution under the Revision's own Execution Log subsection
```

This is the core mechanism: the executor reads revision steps instead of the full Approach.

### Step 6: Update do-executioner agent to understand revision scope

**File:** `agents/do-executioner.md`

Add a section for revision-mode execution:

- Check if a pending revision exists in the task file (`revision.pending: true`)
- If yes, execute only the Revision steps (not the full Approach)
- Log entries under the Revision's Execution Log subsection, not the main Execution Log
- After completing revision steps, transition to verification stage as normal
- Note: do-executioner does not write revision state itself; it reads `revision.pending` (set by stage-verify) and executes accordingly

### Step 7: Update /do:continue stage routing for revision detection

**File:** `skills/do/continue.md`

In Step 6 (Route by Stage), add a sub-condition for the execution stage:

| Stage | Sub-condition | Action |
|-------|---------------|--------|
| `execution` | revision.pending: true | Spawn do-executioner with revision-scoped prompt |

The revision-scoped prompt tells the executor to read the latest Revision section instead of the Approach.

Note: This handles resumption across sessions (e.g., user ran /do:continue after a break). The same-session loop (when the user is already in a /do:task or /do:continue conversation) is handled by each orchestrating layer calling do-executioner directly with revision scope after writing the revision to the task file. Both paths converge on the same do-executioner revision-mode behavior defined in Steps 5 and 6.

### Step 8: Update /do:task orchestrator for revision loop after code review

**File:** `skills/do/task.md`

In Step 10 (do-code-reviewer handling), when the result is MAX_ITERATIONS or CHANGES_REQUESTED and user chooses to fix:

- Instead of the current dead-end, write revision steps to the Revisions section (same logic as stage-verify Step 3) and loop back to Step 9 (do-executioner) with a revision-scoped prompt
- This creates the automatic loop within a single /do:task session (no session break required)
- Note: /do:task only handles code review verdicts for the initial post-execution review. UAT failure loops use stage-verify Step 4. Both paths write the same revision frontmatter structure.

### Step 9: Add user-initiated revision entry point via /do:continue

**File:** `skills/do/continue.md`

Add support for a `revise` subcommand:

```
/do:continue revise "description of what to change"
```

Implementation:
- Parse the `revise` argument in Step 1 of /do:continue (after finding the active task)
- Write the user's description as a single revision step to the Revisions section
- Set frontmatter: `revision.pending: true`, `revision.source: "user"`, increment `revision.count`
- Set `stage: execution`, `stages.execution: in_progress`
- Update argument-hint in the frontmatter to: `"[--task <filename>] [revise \"<description>\"]"`
- Then route normally to do-executioner (revision.pending will be true, triggering revision mode)

This covers the case where the user spots something themselves, not triggered by code review or UAT. Drop the fragile "detect if user manually edited Revisions section" approach -- explicit subcommand is simpler and more reliable.

### Step 10: Add max_revisions to config.json schema and enforce the cap

**File:** `.do/config.json` default values and any config schema documentation

Add `max_revisions: 3` to the default config.json. Stages 3 and 4 (and any future revision writers) read this value before writing a new revision. If `revision.count >= max_revisions`, do not write a new revision; instead escalate:

```
Maximum revisions reached (<count>/<max_revisions>).

This task has been through <count> revision cycles without reaching verified state.
Options:
1. Continue manually (edit the task file directly and run /do:continue)
2. Abandon this task and create a new one with a cleaner scope

Manual intervention required.
```

## Concerns

1. **Infinite revision loops** - Risk: Code review keeps finding issues, revision keeps failing. Mitigation: Cap revisions at `max_revisions` (default 3, configurable in config.json). After max, escalate to user (Step 10). Similar to how code review caps at 3 ITERATE cycles.

2. **Revision scope creep** - Risk: Revision steps grow to be as large as the original approach. Mitigation: The revision section template should encourage atomic, targeted changes. The do-executioner in revision mode should flag if revision steps span more than 3 files and suggest creating a new task instead.

3. **Code review re-running after revision** - Risk: Council review has already run, re-running costs tokens. Mitigation: Reset `council_review_ran.code: false` when entering revision (Steps 3 and 4), so the full review pipeline runs again. This is correct behavior -- the code changed, it needs re-review. Token cost is a known tradeoff.

4. **Task file growing large** - Risk: Multiple revision cycles add significant content to the task file. Mitigation: Each revision logs under its own subsection, keeping the structure scannable. The resume preamble (R0) already handles long task files by parsing specific sections.

5. **Existing stage-verify.md UAT loop-back** - Risk: Step 4 changes V6 option 1 from an ad-hoc flow to the structured revision system. This is a clean replacement: the new flow captures the same information (what failed, what to fix) but persists it as structured revision steps rather than as a deviation note in the Execution Log. No duplication -- the old flow is fully replaced.

6. **Skill file modification requires /skill-creator** - Risk: The project convention requires using `/skill-creator` for skill file changes. Mitigation: All skill/agent file modifications in this plan should be executed through `/skill-creator` during implementation. This is a process concern for the executor, not a design concern.

## Execution Log

## Revisions

### Iteration 1
- **Self-review:** CONCERNS - Responsibility confusion in Step 3 (do-code-reviewer writing revision state violates agent statefulness contract); Step 8 relationship to Step 7 unclear; Step 9 underspecified (fragile edit-detection); `max_revisions` mentioned in Concerns but no corresponding Approach step.
- **Council:** ERROR (timeout - council-invoke.cjs timed out; treated as CONCERNS per fallback spec)
- **Changes made:** Added Design Decision 2 clarifying revision write ownership; rewrote Step 3 to target stage-verify V-1.3 instead of do-code-reviewer; clarified Step 5 E-1 skip reasoning; added note to Step 7 on same-session vs cross-session routing; added note to Step 8 on scope boundary; rewrote Step 9 to use explicit `/do:continue revise` subcommand; added Step 10 for `max_revisions` config enforcement; fixed Concern 5 wording.

## Council Review

## Verification Results
