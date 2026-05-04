---
name: stage-execute
description: Implementation execution flow. Handles context clear decision and task execution with logging.
---

# Execution Stage

This reference file is loaded by /do:continue when the task is ready for implementation.

**Prerequisites:**

- Active task exists in `.do/tasks/`
- Task stage is `refinement` with `stages.grilling: complete` OR confidence >= threshold
- OR task stage is `execution` (resuming)

**Entry conditions:**

- If stage is `refinement`, first transition to `execution` stage
- If stage is already `execution`, resume from current state

Before running execution logic, execute Step R0 from resume-preamble.md.

@skills/do/references/resume-preamble.md

---

### Step R0: Resume Check (per D-33, D-34, D-35)

Follow @skills/do/references/resume-preamble.md Steps R0.1-R0.6.

**For execution stage:**

- Last action = summary of last Execution Log entry (Files and Status)
- If no Execution Log entries, last action = "Execution not started"
- Run R0.6 if Execution Log has entries but last Status is NOT "Execution complete"
- If R0.6 shows progress checklist and user confirms, skip E0 and continue from E2

---

### Step E-1: Plan Review (per D-33, D-35)

**First entry only (stage was refinement, not resuming execution):**

Check if plan review already ran (prevents re-running on resume):

```bash
node ~/.codex/skills/do/scripts/update-task-frontmatter.cjs check '.do/tasks/<active_task>' council_review_ran.plan
```

**If already ran (exit 1):** Skip to Step E0.

Check if plan review is enabled:

```bash
node -e "const c=require('./.do/config.json'); process.exit(c.council_reviews?.planning === true ? 0 : 1)"
```

**If disabled (exit 1):** Mark as skipped in frontmatter (`council_review_ran.plan: 'skipped'`), skip to Step E0.

**If enabled (exit 0):** Run council plan review.

**Step E-1.1: Invoke council**

```bash
node ~/.codex/skills/do/scripts/council-invoke.cjs \
  --type plan \
  --task-file ".do/tasks/<active_task>" \
  --reviewer "$(node -e "const c=require('./.do/config.json'); console.log(c.council_reviews?.reviewer || 'random')")" \
  --workspace "$(pwd)"
```

Parse JSON output for: `advisor`, `verdict`, `findings`, `recommendations`, `success`.

**Step E-1.2: Handle verdict**

| Verdict    | Action                                                                                 |
| ---------- | -------------------------------------------------------------------------------------- |
| LOOKS_GOOD | Log to Council Review section, mark `council_review_ran.plan: true`, proceed to E0     |
| CONCERNS   | Log to Council Review, display concerns to user, ask if they want to revise or proceed |
| RETHINK    | Log to Council Review, display RETHINK findings, recommend revision, ask user          |

**If CONCERNS or RETHINK:**

```
Plan Review: <verdict>

Advisor: <advisor>

Findings:
<findings list>

Recommendations:
<recommendations list>

Options:
1. Revise plan (update Approach section, run /do:continue)
2. Proceed anyway

Enter 1 or 2:
```

Wait for user response.

- If 1: Display "Update the Approach section in .do/tasks/<active_task>, then run /do:continue." Stop.
- If 2: Log "User override: proceeding despite <verdict>" in Council Review section. Mark `council_review_ran.plan: true`. Continue to E0.

**Step E-1.3: Log council results to task markdown**

Add/update Council Review section **after Execution Log** (per D-46):

```markdown
## Council Review

### Plan Review

- **Reviewer:** <advisor>
- **Verdict:** <verdict>
- **Findings:**
  - <finding 1>
  - <finding 2>
- **Recommendations:**
  - <recommendation 1>
    {{#if USER_OVERRIDE}}
- **User Override:** Proceeded despite <verdict>
  {{/if}}
```

Also update frontmatter: `council_review_ran.plan: true`

**If resuming (stage was already execution):** Skip E-1, continue to E0.

---

### Step E0: Context Clear Decision (per D-18, after plan review completes if enabled)

**First entry only (stage was refinement):**

Before starting execution, ask user about clearing context.

Try AskUserQuestion:

```javascript
AskUserQuestion({
  header: "Context",
  question: "Clear context before implementation?",
  options: [
    {
      label: "Yes",
      description: "Run /clear, then /do:continue to resume with fresh context",
    },
    { label: "No", description: "Proceed with current context" },
  ],
  multiSelect: false,
});
```

**If response is empty, undefined, or tool fails:**
Fall back to inline text prompt:

```
Context Decision

Before implementing, you can clear context to reduce token usage.

Options:
1. Yes - Clear context (run /clear, then /do:continue)
2. No - Proceed with current context

Enter 1 or 2 (default: 2):
```

**Process response:**

- If "Yes" or "1": Update task stage, display instructions, STOP
  - Update frontmatter: `stage: execution`, `stages.refinement: complete`, `stages.execution: pending`
  - Display: "Run /clear to clear context, then /do:continue to resume execution."
  - Do NOT proceed with execution yet
- If "No" or "2" or empty (default): Continue to Step E1
  - Update frontmatter: `stage: execution`, `stages.refinement: complete`, `stages.execution: in_progress`

**Log context decision:**
Add to Execution Log:

```markdown
### <timestamp>

**Context decision:** [AskUserQuestion|inline prompt] - user chose [Yes|No]
```

**If resuming (stage was already execution):** Skip E0, continue to E1.

---

### Step E1: Load Task Context

Read task markdown for:

- Problem Statement (what to solve)
- Approach (how to solve it)
- Concerns (what to watch for)
- Context Loaded (relevant docs)
- Clarifications (from grill-me, if any)

Load each file from Context Loaded section to understand the codebase patterns.

---

### Step E2: Execute Implementation

Follow the Approach section step by step.

**Execution rules:**

1. Execute changes following the documented approach
2. After each significant action, update the Execution Log (per D-20)
3. If plan says X but you encounter Y, STOP and ask (per D-21)

**Log entry format (per D-20):**

```markdown
### <YYYY-MM-DD HH:MM>

**Files:**

- `path/to/file.ts` - Change summary

**Decisions:**

- Plan said X - chose approach Y because Z
- [If error] Tried A, failed because B, resolved with C

**Status:** In progress
```

**Deviation handling (per D-21):**
If ANY deviation from plan, try AskUserQuestion first:

```javascript
AskUserQuestion({
  header: "Deviation from plan",
  questions: [
    {
      question:
        "Plan said: [original instruction]\nIssue: [what actually happened or what's different]\n\nHow should we proceed?",
      options: [
        { label: "[Alternative A]" },
        { label: "[Alternative B]" },
        { label: "Pause and investigate" },
      ],
    },
  ],
  multiSelect: false,
});
```

**If AskUserQuestion returns empty, undefined, or fails** (inline fallback):

```
Plan said: [original instruction from Approach section]
Issue: [what actually happened or what's different]

Options:
1. [Alternative A]
2. [Alternative B]
3. Pause and investigate

Which option?
```

Wait for response (either method). Log the decision in Execution Log with "User chose: X".

If user chooses "Pause and investigate" (option 3 / "Other" with that text): stop execution and surface the blocker to the caller.

---

### Step E3: Update Task State After Execution

After all execution is complete:

1. Update frontmatter:
   - `stage: verification`
   - `stages.execution: complete`
   - `stages.verification: pending`
   - `updated: <ISO-8601 timestamp>`

2. Final log entry:

```markdown
### <timestamp>

**Status:** Execution complete

**Summary:**

- Files modified: <count>
- Decisions made: <count>
- Deviations: <count or "none">
```

3. Display completion message:

```
Execution complete. Checking council config before verification.
```

---

### Step E4: Code Review (per council config)

> **Note:** This step is an inline code review path. In the orchestrated pipeline path, code review is handled via `stage-code-review.md` instead (which spawns `codex-code-reviewer` + `codex-council-reviewer` in parallel and auto-iterates up to 3 times). `codex-verifier` handles the subsequent verification step (approach checklist, quality checks, UAT). E4 remains as the inline fallback path for environments where subagent spawning is unavailable.

**Step E4.0: Check if code review already ran**

```bash
node ~/.codex/skills/do/scripts/update-task-frontmatter.cjs check '.do/tasks/<active_task>' council_review_ran.code
```

**If already ran (exit 1):** Skip to end -- display "Proceeding to verification. Run /do:continue to verify and complete the task." and stop.

**Step E4.1: Check if execution review is enabled**

```bash
node -e "const c=require('./.do/config.json'); process.exit(c.council_reviews?.execution === true ? 0 : 1)"
```

**If disabled (exit 1):** Mark as skipped in frontmatter (`council_review_ran.code: 'skipped'`), display "Code review disabled. Proceeding to verification. Run /do:continue to verify and complete the task." and stop.

**If enabled (exit 0):** Continue to E4.2.

**Step E4.2: Invoke council for code review**

```bash
node ~/.codex/skills/do/scripts/council-invoke.cjs \
  --type code \
  --task-file ".do/tasks/<active_task>" \
  --reviewer "$(node -e "const c=require('./.do/config.json'); console.log(c.council_reviews?.reviewer || 'random')")" \
  --workspace "$(pwd)"
```

Parse JSON output for: `advisor`, `verdict`, `findings`, `recommendations`, `success`.

**Step E4.3: Handle verdict**

| Verdict           | Action                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| APPROVED          | Log to Council Review section, mark `council_review_ran.code: true`, display completion message                    |
| NITPICKS_ONLY     | Log to Council Review section (include nitpicks), mark `council_review_ran.code: true`, display completion message |
| CHANGES_REQUESTED | Log to Council Review, display issues to user, ask if they want to fix or proceed                                  |

**If CHANGES_REQUESTED:**

```
Code Review: CHANGES_REQUESTED

Advisor: <advisor>

Findings:
<findings list>

Recommendations:
<recommendations list>

Options:
1. Fix issues (update code, run /do:continue)
2. Proceed anyway

Enter 1 or 2:
```

Wait for user response.

- If 1: Display "Fix the reported issues, then run /do:continue." Stop.
- If 2: Log "User override: proceeding despite CHANGES_REQUESTED" in Council Review section. Mark `council_review_ran.code: true`. Continue to completion message.

**Step E4.4: Log council results to task markdown**

Add/update Council Review section with `### Code Review` heading:

```markdown
### Code Review

- **Reviewer:** <advisor>
- **Verdict:** <verdict>
- **Findings:**
  - <finding 1>
  - <finding 2>
- **Recommendations:**
  - <recommendation 1>
    {{#if USER_OVERRIDE}}
- **User Override:** Proceeded despite CHANGES_REQUESTED
  {{/if}}
```

Also update frontmatter: `council_review_ran.code: true`

**Final completion message (after E4 completes):**

```
Execution complete. Proceeding to verification.

Run /do:continue to verify and complete the task.
```

---

### Files

- **Config:** `.do/config.json` - Read `active_task` and `council_reviews.execution`
- **Task:** `.do/tasks/<active_task>` - Read context, write Execution Log, Council Review, and stage updates
