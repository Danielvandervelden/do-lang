---
name: stage-verify
description: Verification flow. Compares implementation against task context, runs quality checks, handles UAT approval.
---

# Verification Stage

This reference file is loaded by /do:continue when the task is in verification stage.

**Prerequisites:**
- Active task exists in `.do/tasks/`
- Task stage is `verification` or `verified`
- `stages.execution: complete`

**Entry conditions:**
- If stage is `verification`, run full verification flow
- If stage is `verified`, resume at UAT flow (Step V5)

Before running verification logic, execute Step R0 from resume-preamble.md.

@skills/do/references/resume-preamble.md

---

### Step R0: Resume Check (per D-33, D-34, D-35)

Follow @skills/do/references/resume-preamble.md Steps R0.1-R0.5.

**For verification stage:**
- Last action = "Verification: " + stages.verification status (in_progress, awaiting UAT, etc.)
- If Verification Results section exists, summarize: "Checklist X/Y, Quality X/Y"
- Skip R0.6 (mid-execution progress) - not applicable to verify stage

---

### Step V0: Load Task Context (per D-23, after code review completes if enabled)

Read the active task markdown file and extract:
- **Problem Statement** - What was to be solved
- **Approach** - How it was to be solved
- **Concerns** - What to watch for
- **Clarifications** - User answers from grill-me (if any)

This is the full context to verify against, not just Approach.

---

### Step V1: Parse Approach Checklist (per D-24)

Extract discrete steps from the Approach section:

1. Look for numbered lists: `1.`, `2.`, `3.` patterns
2. Look for bullet points: `- ` or `* ` patterns
3. Convert each line item to a checklist item

**Output format:**
```markdown
- [ ] Step 1 description
- [ ] Step 2 description
- [ ] Step 3 description
```

**If Approach is prose without clear steps:**
Display concern:
```
Warning: Approach section has no clear numbered steps or bullets.
Unable to generate verification checklist.

Options:
1. Proceed with quality checks only
2. Stop and update Approach section with explicit steps

Enter 1 or 2:
```

Wait for user response. If 2, display: "Update the Approach section in `.do/tasks/<active_task>`, then run /do:continue again."

---

### Step V2: Verify Each Step

For each checklist item from Step V1:

1. Review the Execution Log to check if the step was completed
2. Check relevant files mentioned in the step
3. Mark completion status:
   - Done: `- [x] Step description`
   - Incomplete: `- [ ] Step description (INCOMPLETE: reason)`

Build the verification output for the Verification Results section.

**Example:**
```markdown
### Approach Checklist
- [x] Added validation schema to `login-form.ts`
- [x] Imported and applied schema in `LoginPage.tsx`
- [x] Error messages use `FormError` component
- [ ] Unit tests exist for validation logic (INCOMPLETE: test file not found)
```

---

### Step V3: Detect and Run Quality Checks (per D-25)

**Step V3.1: Read package.json**

Read `package.json` in the project root to detect available scripts.

**Step V3.2: Detect quality check scripts**

Match scripts using patterns (case-insensitive):

| Pattern | Type | Examples |
|---------|------|----------|
| `/^lint/i` | Lint | `lint`, `lint:fix`, `lint:check` |
| `/^(typecheck\|tsc\|type-check)/i` | Types | `typecheck`, `tsc`, `type-check` |
| `/^test/i` excluding `/watch/i` | Tests | `test`, `test:unit`, `test:integration` |

Collect matching scripts into a list.

**Step V3.3: Run detected checks**

For each detected script:

```bash
npm run <script-name>
```

Capture:
- Exit code (0 = pass, non-zero = fail)
- Output (truncate to last 50 lines if longer)

**If no scripts detected:**
Note: "No quality check scripts found in package.json"

**Timeout handling:**
If a check runs longer than 5 minutes, terminate and mark as:
```
- **<Type>:** TIMEOUT (npm run <script>)
  Script exceeded 5 minute timeout. Run manually: npm run <script>
```

---

### Step V4: Handle Results (per D-26, D-27, D-28)

**Step V4.1: Determine Pass/Fail (binary, per D-28)**

- **PASS:** All checklist items complete AND all quality checks pass
- **FAIL:** Any incomplete checklist item OR any quality check failure

**Step V4.2: Write Verification Results section**

Update the task markdown file by adding/updating the Verification Results section after Execution Log:

```markdown
## Verification Results

### Approach Checklist
- [x] Step 1 description
- [x] Step 2 description
- [ ] Step 3 description (INCOMPLETE: reason)

### Quality Checks
- **Lint:** PASS (npm run lint)
- **Types:** PASS (npm run typecheck)
- **Tests:** FAIL (npm run test)
  ```
  <truncated test output - last 50 lines>
  ```

### Result: FAIL
- Checklist: 2/3 complete
- Quality: 2/3 passing
- Blocking issue: Tests failing
```

**Step V4.3: Handle FAIL result**

**If FAIL due to quality check (per D-27):**

```
Quality check failed: <script-name>

Options:
1. /do:task "Fix: <brief description of failure>"
2. Handle manually, then run /do:continue

Choose option (1 or 2):
```

Wait for user response.
- If 1: Display "Run the /do:task command shown above, then return to verify this task."
- If 2: Display "Fix the issue manually, then run /do:continue to re-run verification."

Stop execution in either case.

**If FAIL due to incomplete checklist:**

```
Verification failed: Incomplete checklist items

Missing:
- <incomplete item 1>
- <incomplete item 2>

Options:
1. /do:task "Complete: <brief summary>"
2. Handle manually, then run /do:continue

Choose option (1 or 2):
```

Wait for user response and handle same as quality failure.

**If PASS:** Continue to Step V5.

---

### Step V5: UAT Flow (per D-29, D-30)

Only reached if Step V4 result is PASS.

**Step V5.1: Update stage to verified**

Update task frontmatter:
- `stage: verified`
- `stages.verification: in_progress`
- `updated: <ISO-8601 timestamp>`

**Step V5.2: Generate UAT checklist (per D-30)**

Parse the task to identify user-observable behaviors:
- From Approach section: extract user-facing outcomes
- From Execution Log: identify files/components changed
- From Concerns: include edge cases that warrant manual check

Generate 3-7 checklist items. Focus on:
- UI state changes
- Error handling paths
- Success paths
- Edge cases mentioned in Concerns

**Step V5.3: Display UAT checklist**

```
Please verify manually:
1. [ ] <user-observable behavior>
2. [ ] <another behavior>
3. [ ] <edge case>

All checks complete? (yes/no)
```

Wait for user response.

---

### Step V6: Completion Flow (per D-31, D-32)

**If response is "yes" or "y" (per D-31):**

1. Update task frontmatter:
   - `stage: complete`
   - `stages.verification: complete`
   - `updated: <ISO-8601 timestamp>`

2. Read `.do/config.json`
3. Set `active_task: null`
4. Write config.json

5. Display completion message:
```
Task marked complete.

Updated:
- stage: complete
- stages.verification: complete
- active_task: null (cleared)

Task file: .do/tasks/<filename>
```

**If response is "no" or "n" (per D-32):**

**Step V6.1: Estimate context usage**

Use heuristic based on task file content:

```javascript
// Rough estimation based on observable factors
const executionLogEntries = (taskMarkdown.match(/^### \d{4}-\d{2}-\d{2}/gm) || []).length;
const clarificationCount = (taskMarkdown.match(/^\*\*Q:\*\*/gm) || []).length;
const approachSteps = (taskMarkdown.match(/^\d+\./gm) || []).length;

// Each execution log entry ~750 tokens
// Each Q&A pair ~300 tokens
// Each approach step ~150 tokens (read multiple times)
const estimatedTokens = 
  (executionLogEntries * 750) + 
  (clarificationCount * 300) + 
  (approachSteps * 150);

// Assume 200k context window, reserve 40k buffer
const usableContext = 160000;
const percentage = Math.min(100, Math.round((estimatedTokens / usableContext) * 100));
```

**Step V6.2: Branch by context percentage**

**If estimated < 80%:**

```
UAT failed. What would you like to do?
1. Loop back to execution (describe what to fix)
2. Spawn new /do:task for the fix

Choose option:
```

Wait for user response.

If option 1:
- Update frontmatter: `stage: execution`, `stages.verification: pending`
- Display: "Describe what needs to be fixed:"
- Wait for response, add to Execution Log as deviation note
- Continue execution

If option 2:
- Display: "Run: /do:task \"Fix: <description>\""

**If estimated >= 80%:**

Traverse up from project root to find `.do-workspace.json`, read it for paths.

Generate handoff prompt:
```
Context at 80%+. Starting fresh session recommended.

Copy this to start a new session:
---
Database: <database-path from .do-workspace.json>
Project: <project-path>
Task: .do/tasks/<task-filename>

UAT failed: <summary of what user reported>
Implementation complete, quality checks pass.

/do:continue
---
```

Display handoff prompt and stop.

---

### Files

- **Config:** `.do/config.json` - Read/write `active_task`
- **Task:** `.do/tasks/<active_task>` - Read context, write Verification Results and stage updates
- **Workspace:** `.do-workspace.json` - Read for handoff prompt paths (found by traversing up from project)
- **Package:** `package.json` - Read for quality check script detection
