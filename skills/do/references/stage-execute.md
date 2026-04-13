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

---

### Step E0: Context Clear Decision (per D-18)

**First entry only (stage was refinement):**

Before starting execution, ask user about clearing context.

Try AskUserQuestion:
```javascript
AskUserQuestion({
  header: "Context",
  question: "Clear context before implementation?",
  options: [
    { label: "Yes", description: "Run /clear, then /do:continue to resume with fresh context" },
    { label: "No", description: "Proceed with current context" }
  ],
  multiSelect: false
})
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
If ANY deviation from plan:
```
Plan said: [original instruction from Approach section]
Issue: [what actually happened or what's different]

Options:
1. [Alternative A]
2. [Alternative B]
3. Pause and investigate

Which option?
```
Wait for user response. Log the decision in Execution Log with "User chose: X".

---

### Step E3: Update Task State After Execution

After all execution is complete:

1. Update frontmatter:
   - `stage: verification`
   - `stages.execution: complete`
   - `stages.verification: in_progress`
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
Execution complete. Proceeding to verification.

Run /do:continue to verify and complete the task.
```

---

### Files

- **Config:** `.do/config.json` - Read `active_task`
- **Task:** `.do/tasks/<active_task>` - Read context, write Execution Log and stage updates
