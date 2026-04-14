---
name: resume-preamble
description: Shared resume logic for all stage reference files. Handles context reload, resume summary display, and stale reference prompts.
---

# Resume Preamble

This reference file provides shared resume logic (Step R0) for all stage reference files. Execute Step R0 at the start of every stage when resuming via `/do:continue`.

---

### Step R0: Resume Check

Run this step at the start of every `/do:continue` invocation before stage-specific logic.

---

### Step R0.1: Load task markdown

Read task file from `.do/tasks/<active_task>`.

Parse YAML frontmatter for:
- `id` - Task identifier
- `description` - Task description
- `stage` - Current stage (refinement, execution, verification, etc.)
- `stages` - Stage status map
- `confidence` - Confidence score and factors

Extract from markdown body:
- **Context Loaded section** - Parse backtick-wrapped paths (e.g., `` `path/to/doc.md` ``)
- **Clarifications section** - Last Q&A entry if present (format: `**Q:**` and `**A:**`)
- **Execution Log section** - Last entry if present (format: `### YYYY-MM-DD HH:MM`)

---

### Step R0.2: Detect context state (per D-34)

Heuristic: Try to recall if task `description` from frontmatter is known in the current conversation.

Since Claude cannot reliably introspect its context window, **always proceed to R0.3**.

**Skip reload ONLY if:**
- Context was explicitly loaded earlier in this conversation (e.g., user ran `/do:task` in same session)
- The current conversation already contains references to the task's specific details

---

### Step R0.3: Reload context (per D-33)

Run `load-task-context.cjs` to get paths:

```bash
node ~/.claude/commands/do/scripts/load-task-context.cjs "<task-description>"
```

Parse JSON output for:
- `project_md_path` - Path to project.md
- `matched_docs` - Array of matched component/tech/feature docs
- `database_path` - Path to project's database folder

For each path in the result:
1. Check if file exists
2. If missing, add to `stale_refs` list
3. If exists, read file to reload context

Also re-read all paths from the task's "Context Loaded" section:
1. Parse each `` `path/to/doc.md` `` from the section
2. Check if file exists
3. If missing, add to `stale_refs` list
4. If exists, read file to reload context

---

### Step R0.4: Handle stale references (per D-39)

If `stale_refs` is non-empty, display blocking prompt:

```
Referenced doc(s) not found:
- <path1>
- <path2>

Options:
1. Continue without them (task markdown has context)
2. Stop and locate the docs

Enter 1 or 2:
```

Wait for user response:

- **If "1":** 
  - Add to Execution Log: `**Context:** Continued without missing docs: [<path1>, <path2>]`
  - Continue to Step R0.5
  
- **If "2":** 
  - Display: "Locate the missing docs, then run /do:continue again."
  - **STOP** - Do not proceed with stage-specific logic

---

### Step R0.5: Display resume summary (per D-35, D-36)

Determine last action based on current stage:

| Stage | Last Action Source |
|-------|-------------------|
| refinement (grilling) | Last Q&A pair from Clarifications section, or "Grill-me not started" |
| execution | Summary from last Execution Log entry (Files + Status), or "Execution not started" |
| verification | "Verification: " + stages.verification status (in_progress, awaiting UAT, etc.) |
| verified | Last UAT status, or "Awaiting UAT confirmation" |

Display resume summary:

```
Resuming: <task-id> (stage: <stage>)
Last action: <summary from last entry>

Continue? (yes/no)
```

Wait for user confirmation:

- **If "yes" or "y":** Continue to stage-specific logic
- **If "no" or "n":** Display: "Paused. Run /do:continue when ready." and **STOP**

---

### Step R0.6: Mid-execution progress check (per D-37, D-38)

**Only applies to `execution` stage** when:
- Execution Log has at least one entry
- Last entry's Status is NOT "Execution complete"

**Step R0.6.1: Parse Approach into steps**

Read the Approach section and extract discrete steps:
1. Look for numbered lists: `1.`, `2.`, `3.` patterns
2. Look for bullet points: `- ` or `* ` patterns
3. Convert each to a tracked item

**Step R0.6.2: Match completed work to steps**

Parse Execution Log's **Files:** entries to identify completed work.
Match file paths and change summaries to approach steps.

Use heuristics:
- File path matches step description
- Change summary matches step intent
- Explicit "completed" or "done" in log entry

**Step R0.6.3: Display progress checklist**

```
Execution paused. Progress so far:
- [x] <completed step from approach, matched to files in log>
- [x] <another completed item>
- [ ] <remaining step from approach>

Continue from here? (yes/no)
```

Wait for user confirmation:

- **If "yes" or "y":** 
  - Skip E0 (context clear decision)
  - Continue from E2 (execute implementation) for remaining items
  
- **If "no" or "n":** 
  - Display: "Paused. Run /do:continue when ready."
  - **STOP**

---

### Files

- **Context loading script:**
  - `skills/do/scripts/load-task-context.cjs` - Loads project.md and matched docs
  
- **Task file:**
  - `.do/tasks/<active_task>` - Source of context paths, execution log, clarifications
