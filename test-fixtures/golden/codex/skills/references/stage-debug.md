---
name: stage-debug
description: Debug workflow. Scientific method approach with hypothesis tracking, evidence accumulation, and elimination of dead ends.
---

# Debug Workflow

This reference file is loaded by /do:debug for the structured debugging workflow.

**Prerequisites:**
- Active debug session exists in `.do/debug/`
- Debug file loaded via `active_debug` in config.json

**Global rule — timestamp updates:** Every state transition in this workflow updates `updated: <ISO timestamp>` in the debug file frontmatter. This applies to ALL steps below — individual steps do not repeat this instruction.

Before running debug logic, execute Step D0 (Resume Check).

---

### Step D0: Resume Check (adapted from resume-preamble.md per D-47)

Load debug file from `.do/debug/<active_debug>`.

Parse frontmatter for:
- `status` - Current debug status
- `trigger` - Original problem description
- `current_hypothesis` - Active hypothesis being tested
- `task_ref` - Optional link to active task

**If status is `resolved`:**
```
Debug session already resolved.
Session file: .do/debug/<filename>

Run /do:debug "new issue" to start a new session.
```
**STOP**

**Otherwise, display resume summary:**
```
Resuming debug: <filename> (status: <status>)
Current hypothesis: <hypothesis or "None yet">
Last evidence: <from Evidence section, last entry or "None yet">
Next action: <from Current Focus.next_action>

Continue? (yes/no)
```

Wait for user confirmation:
- **If "yes" or "y":** Continue to the appropriate step based on status
- **If "no" or "n":** Display "Paused. Run /do:debug to resume." and **STOP**

**Status routing:**
| Status | Continue to |
|--------|-------------|
| gathering | Step D1 |
| investigating | Step D2 |
| fixing | Step D5 |
| verifying | Step D6 |
| awaiting_human_verify | Step D7 |

---

### Step D1: Gathering Phase (status: gathering)

**Entry:** Status is `gathering` (new session or resumed at gathering).

Ask symptom questions in sequence. Wait for response after each question.

**Question 1:**
```
Gathering symptoms...

What should happen? (expected behavior)
```
Wait for response.

**Question 2:**
```
What actually happens? (actual behavior)
```
Wait for response.

**Question 3:**
```
Any error messages? (paste or "none")
```
Wait for response.

**Question 4:**
```
How do you reproduce this?
```
Wait for response.

**Question 5:**
```
When did this start? (or "always broken")
```
Wait for response.

**After all questions:**

Write answers to Symptoms section (IMMUTABLE after this):
```markdown
## Symptoms

expected: <user answer to Q1>
actual: <user answer to Q2>
errors: <user answer to Q3>
reproduction: <user answer to Q4>
started: <user answer to Q5>
```

Transition status: `gathering` -> `investigating`

Update Current Focus:
```markdown
## Current Focus

hypothesis:
test:
expecting:
next_action: form initial hypothesis
```

Continue to **Step D2**.

---

### Step D2: Investigating Phase (status: investigating)

**Entry:** Status is `investigating` or just transitioned from gathering.

Read Eliminated section to avoid re-investigating disproved hypotheses.

Display:
```
Status: investigating

Eliminated hypotheses:
- <list from Eliminated section, or "None yet">

Form a hypothesis about the root cause.
What do you think is causing this?
```

Wait for user's hypothesis.

Update Current Focus:
```markdown
## Current Focus

hypothesis: <user input>
test: <derive test from hypothesis - how to verify/disprove>
expecting: <what result would confirm this hypothesis>
next_action: run test
```

Update frontmatter:
- `current_hypothesis: <user's hypothesis>`

Continue to **Step D3**.

---

### Step D3: Test Hypothesis

Display:
```
Testing: <hypothesis>

I'll run: <test description from Current Focus>
Expecting: <expected outcome from Current Focus>
```

Execute the test:
- File reads, grep searches, command execution as appropriate
- Observe the results

Add entry to Evidence section (APPEND only):
```markdown
- timestamp: <ISO timestamp>
  checked: <what was examined>
  found: <observation - what actually happened>
  implication: <what this means for the hypothesis>
```

Display test results and ask:
```
Evidence collected:
- Checked: <what was examined>
- Found: <observation>
- Implication: <meaning>

Based on this evidence, is the hypothesis:
1. Confirmed (we found the root cause)
2. Rejected (this wasn't the issue)
3. Needs more investigation

Enter 1, 2, or 3:
```

Wait for user response. Continue to **Step D4**.

---

### Step D4: Handle Test Result (CRITICAL: Explicit branches per review feedback)

This step MUST handle all three outcomes explicitly.

---

**Branch A - CONFIRMED (user enters 1):**

The hypothesis is confirmed as the root cause.

Transition: `investigating` -> `fixing`

Update Resolution section:
```markdown
## Resolution

root_cause: <the confirmed hypothesis>
fix:
verification:
files_changed: []
```

Update Current Focus:
```markdown
## Current Focus

hypothesis: <confirmed>
test: confirmed
expecting:
next_action: apply fix
```

Update frontmatter:
- `status: fixing`

Display:
```
Root cause confirmed: <hypothesis>

Proceeding to fixing phase.
```

Proceed to **Step D5** (Fixing Phase).

---

**Branch B - REJECTED (user enters 2):**

The hypothesis was disproved by the evidence.

Add to Eliminated section (APPEND only):
```markdown
- hypothesis: <the hypothesis that was tested>
  evidence: <why it was rejected based on test results>
  timestamp: <ISO timestamp>
```

Clear `current_hypothesis` in frontmatter (set to null).

Update frontmatter:
- `current_hypothesis: null`

Display:
```
Hypothesis eliminated: <hypothesis>
Reason: <evidence summary>

This hypothesis has been recorded in the Eliminated section.
Let's form a new hypothesis.
```

**LOOP BACK to Step D2** (Investigating Phase) to form a new hypothesis.

DO NOT terminate or proceed to fixing.

---

**Branch C - INCONCLUSIVE (user enters 3):**

The evidence is not sufficient to confirm or reject.

Display:
```
The evidence is inconclusive. What additional test would help narrow this down?
```

Wait for user response.

Update Current Focus:
- `test: <user's new test suggestion>`
- `expecting: <what the new test should reveal>`

**LOOP BACK to Step D3** (Test Hypothesis) to run the additional test.

---

### Step D5: Fixing Phase (status: fixing)

**Entry:** Status is `fixing` or just transitioned from investigating.

Display:
```
Root cause confirmed: <from Resolution.root_cause>

Describe the fix you want to apply:
```

Wait for fix description.

Apply the fix:
- Make file edits as described
- Run commands if needed
- Track all modified files

Update Resolution section:
```markdown
## Resolution

root_cause: <already set>
fix: <user's fix description>
verification:
files_changed: [<list of modified files>]
```

Update Current Focus:
```markdown
## Current Focus

hypothesis: <root cause>
test: apply fix
expecting: issue resolved
next_action: verify fix
```

Transition: `fixing` -> `verifying`

Update frontmatter:
- `status: verifying`

Continue to **Step D6**.

---

### Step D6: Verifying Phase (status: verifying)

**Entry:** Status is `verifying` or just transitioned from fixing.

Read Symptoms section for reproduction steps.

Display:
```
Verifying fix...

Reproduction steps: <from Symptoms.reproduction>
Expected: <from Symptoms.expected>

Running verification...
```

Execute the reproduction steps from Symptoms section.

Ask:
```
Does the expected behavior now occur?
1. Yes, fix works
2. No, still broken

Enter 1 or 2:
```

Wait for user response.

**If "2" (still broken):**

Transition: `verifying` -> `investigating`

Update frontmatter:
- `status: investigating`
- `current_hypothesis: null`

Display:
```
Back to investigating. The fix didn't work.

What we tried: <Resolution.fix>
Result: Still broken

Let's form a new hypothesis.
```

**Return to Step D2** (Investigating Phase) to form new hypothesis.

**If "1" (fix works):**

Update Resolution section:
```markdown
verification: Self-verified: <summary of verification>
```

Transition: `verifying` -> `awaiting_human_verify`

Update frontmatter:
- `status: awaiting_human_verify`

Continue to **Step D7**.

---

### Step D7: Human Verification (status: awaiting_human_verify per D-44)

**Entry:** Status is `awaiting_human_verify`.

Display:
```
Self-verification passed.

Please confirm the fix works for your use case:

Root cause: <from Resolution.root_cause>
Fix applied: <from Resolution.fix>
Files changed: <from Resolution.files_changed>

Does this fix your issue? (yes/no)
```

Wait for user response.

**If "no" or "n":**

Ask:
```
What's still broken?
```

Wait for response. Add to Evidence section:
```markdown
- timestamp: <ISO timestamp>
  checked: User verification
  found: <user's description of what's still broken>
  implication: Fix incomplete or incorrect
```

Transition: `awaiting_human_verify` -> `investigating`

Update frontmatter:
- `status: investigating`
- `current_hypothesis: null`

Display:
```
User reports issue still exists.

New observation: <user's input>

Back to investigating. Let's form a new hypothesis.
```

**Return to Step D2** (Investigating Phase).

**If "yes" or "y":**

Transition: `awaiting_human_verify` -> `resolved`

Update frontmatter:
- `status: resolved`

Continue to **Step D8**.

---

### Step D8: Resolution (status: resolved) -- with explicit D-48/D-49 implementation

**8.1: Clear active session**

Read `.do/config.json`.
Set `active_debug: null`.
Write config.json (use safe write pattern).

**8.2: Task linking check (per D-48, D-49)**

Read `task_ref` field from debug file frontmatter.

```javascript
// Pseudocode for clarity
const { frontmatter, sections } = parseDebugFile(debugFilePath);
const taskRef = frontmatter.task_ref;
```

**If `task_ref` is set (not null):**

Verify the linked task file exists at `.do/tasks/<task_ref>`.

**If task file exists:**
```
Debug session linked to task: <task_ref>

Copy findings to task context? (yes/no)

This will append:
- Root cause: <Resolution.root_cause>
- Fix: <Resolution.fix>
- Files changed: <Resolution.files_changed>
```

Wait for user response.

**If "yes" or "y":**
- Read the task file
- Append a "## Debug Findings" section (or append to existing "## Context Loaded" section):
  ```markdown
  ## Debug Findings
  
  **From debug session:** <debug filename>
  **Root cause:** <Resolution.root_cause>
  **Fix applied:** <Resolution.fix>
  **Files changed:** <Resolution.files_changed>
  **Resolved:** <timestamp>
  ```
- Write task file (using safe write pattern)
- Display: "Findings synced to task."

**If "no" or "n":**
- Display: "Skipping task sync."

**If task file does not exist:**
- Display: "Warning: Linked task file not found at .do/tasks/<task_ref>. Skipping sync."

**If `task_ref` is null:**
- Skip task linking (session was independent)

**8.3: Display completion summary**

```
Debug session resolved!

Session file: .do/debug/<filename>
Root cause: <Resolution.root_cause>
Fix: <Resolution.fix>
Files changed: <Resolution.files_changed>
```

---

### Files

- **Config:** `.do/config.json` - Read/write `active_debug`
- **Debug file:** `.do/debug/<active_debug>` - Session state
- **Task file:** `.do/tasks/<task_ref>` - Optional sync target (per D-48, D-49)
- **Template:** `skills/references/debug-template.md` - For new sessions
- **Script:** `skills/scripts/debug-session.cjs` - Session management
