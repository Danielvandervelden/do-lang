# Phase 9: Task Resume - Research

**Researched:** 2026-04-13
**Domain:** Session continuity, context reconstruction, YAML frontmatter parsing
**Confidence:** HIGH

## Summary

Phase 9 enhances the existing `/do:continue` implementation with robust context reconstruction for resuming work after `/clear`. The core infrastructure already exists from Phases 5-8: stage routing via YAML frontmatter, stage reference files (`stage-grill.md`, `stage-execute.md`, `stage-verify.md`), and the `load-task-context.cjs` script. This phase adds post-`/clear` detection, resume summary display, Execution Log parsing for mid-execution resume, and stale reference handling.

The implementation is straightforward because the task markdown already contains all necessary context for resumption (Problem Statement, Context Loaded, Approach, Clarifications, Execution Log). The key additions are: (1) a heuristic to detect when context needs reloading, (2) a resume summary UI before proceeding, and (3) handling edge cases like missing referenced docs.

**Primary recommendation:** Add a shared "Step R0: Resume Check" preamble to each stage reference file that handles context detection, reload, and summary display before proceeding to stage-specific logic.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-33:** Always re-read project.md + all docs listed in "Context Loaded" section after `/clear`. Ensures full context is available even when conversation history is lost.
- **D-34:** Use heuristic to detect if context needs reloading -- only reload after `/clear`, not on every `/do:continue`. Heuristic: check if task description is already in conversation context.
- **D-35:** Always show resume summary before proceeding. User should know exactly where they are before work continues.
- **D-36:** Summary includes: task name + current stage, last action from Execution Log (or last Q&A from grill-me). Does NOT include confidence breakdown or next step preview -- keep it focused.
- **D-37:** Parse Execution Log to determine resume point. Read last entry's "Status" and "Files" to understand what was completed.
- **D-38:** Show summary of completed work, ask user to confirm before continuing (checklist format with completed/remaining items).
- **D-39:** Block and ask user when referenced docs are missing. Don't silently skip -- the missing doc might be critical.

### Claude's Discretion
- Exact heuristic for detecting post-/clear state (e.g., grep conversation for task ID)
- How to summarize last Execution Log entry in one line
- Whether to group multiple missing docs into one prompt or ask about each

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TS-11 | `/do:continue` resumes from last task state | Existing routing table in SKILL.md handles stage detection; this phase adds context reconstruction |
| TS-11.a | Reads `.do/config.json` for active task | Already implemented in SKILL.md Step 1 |
| TS-11.b | Parses YAML frontmatter for stage status | Already implemented via routing table |
| TS-11.c | Routes to correct stage (refinement/grilling/execution/verification) | Already implemented; stage files exist |
| TS-11.d | Preserves all prior context from task markdown | D-33 context reload pattern; load-task-context.cjs reuse |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Always use `/skill-creator` when creating or modifying skill files** -- never hand-write skills directly
- **Conventional commits** -- prefixes: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`
- **Branch naming** -- `feat/<description>`, `fix/<description>`, etc.
- **Never commit `.planning/`** -- gitignored, local-only

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js CJS | 18+ | Script execution | Existing scripts use CommonJS pattern |
| YAML frontmatter | gray-matter-compatible | Stage/state tracking | Established pattern in task-template.md |
| Markdown | Standard | Task documentation | Human-readable, machine-parseable |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fs (node builtin) | - | File reading/writing | All file operations |
| path (node builtin) | - | Path manipulation | Cross-platform paths |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom YAML parser | gray-matter npm | Extra dependency vs manual regex; existing code uses manual parsing |
| Conversation introspection | File marker | Claude cannot reliably introspect conversation; file marker more reliable |

## Architecture Patterns

### Existing Project Structure
```
skills/do/
  SKILL.md              # Main router (already has /do:continue routing)
  references/
    stage-grill.md      # Grill-me flow
    stage-execute.md    # Execution flow (has Step E1 "Load Task Context")
    stage-verify.md     # Verification flow (has Step V0 "Load Task Context")
    task-template.md    # Task markdown structure
  scripts/
    load-task-context.cjs  # Context loading script (REUSABLE)
    check-database-entry.cjs
    workspace-health.cjs
    project-health.cjs
    scan-project.cjs
```

### Pattern 1: Resume Preamble (Step R0)
**What:** A shared step at the top of each stage reference file that handles context detection and resume summary
**When to use:** Every `/do:continue` invocation
**Example:**
```markdown
### Step R0: Resume Check (per D-33, D-34, D-35)

**Step R0.1: Detect context state**

Check if task description from frontmatter appears in recent conversation context.
- If found: Context is warm, skip to Stage-specific Step 1
- If not found: Context needs reload, continue to R0.2

**Step R0.2: Reload context**

Call load-task-context.cjs to re-read:
- project.md
- All docs listed in "Context Loaded" section of task markdown

Read each file to restore context.

**Step R0.3: Display resume summary (per D-35, D-36)**

Display:
```
Resuming: <task-slug> (stage: <stage>)
Last action: <summary from last log entry>

Continue? (yes/no)
```

Wait for user confirmation.
```

### Pattern 2: Execution Log Parsing for Mid-Resume
**What:** Parse the Execution Log section to determine what work was completed
**When to use:** When resuming `execution` stage
**Example:**
```markdown
### Parse Execution Log entries

Each entry has format:
```markdown
### YYYY-MM-DD HH:MM
**Files:**
- `path/to/file.ts` - Change summary

**Decisions:**
- ...

**Status:** In progress | Execution complete
```

Extract:
- Last entry's Status field
- Last entry's Files list (completed work)
- Compare against Approach steps (remaining work)
```

### Pattern 3: Stale Reference Handling (per D-39)
**What:** Prompt user when a doc listed in "Context Loaded" no longer exists
**When to use:** During context reload in Step R0.2
**Example:**
```markdown
For each path in "Context Loaded" section:
1. Check if file exists
2. If missing, collect into stale_refs list
3. After checking all, if stale_refs non-empty:

Display:
```
Referenced doc(s) not found:
- <path1>
- <path2>

Options:
1. Continue without them (task markdown has context)
2. Stop and locate the docs

Enter 1 or 2:
```
```

### Anti-Patterns to Avoid
- **Implicit context reload:** Never reload context on every `/do:continue` -- wastes tokens when context is warm
- **Silent skip of missing docs:** D-39 requires user confirmation; missing docs may be critical
- **Stage-specific resume logic scattered:** Keep resume preamble consistent across all stage files

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Context loading | Custom doc search | `load-task-context.cjs` | Already handles workspace/project config traversal, keyword matching |
| YAML frontmatter parsing | Custom parser | Manual regex extraction | Simple enough; existing code uses `match(/^---[\s\S]*?---/)` |
| Missing file detection | Complex checks | `fs.existsSync()` | Simple, synchronous, sufficient |

**Key insight:** Most infrastructure exists. This phase is about orchestrating existing pieces for resume UX.

## Common Pitfalls

### Pitfall 1: Conversation Introspection Unreliability
**What goes wrong:** Trying to detect `/clear` by introspecting Claude's conversation state
**Why it happens:** Claude cannot reliably know what's in its context window
**How to avoid:** Use file-based markers or heuristics based on observable state
**Warning signs:** Logic that asks "do I remember X?" without checking files

### Pitfall 2: Execution Log Status Values
**What goes wrong:** Misinterpreting "In progress" vs "Execution complete" status
**Why it happens:** "In progress" appears mid-execution; "Execution complete" only at final entry
**How to avoid:** Always check the LAST entry's Status field, not intermediate ones
**Warning signs:** Resuming at wrong point in execution

### Pitfall 3: Context Loaded Section Format
**What goes wrong:** Parsing "Context Loaded" section incorrectly
**Why it happens:** Section has format `- \`path/to/doc.md\` - reason matched`
**How to avoid:** Extract paths from backticks, not plain text
**Warning signs:** Paths including "- reason matched" suffix

### Pitfall 4: Grill-me Resume Point
**What goes wrong:** Not knowing where to resume in grill-me flow
**Why it happens:** Grill-me updates confidence factors progressively
**How to avoid:** Read `stages.grilling` status AND check Clarifications section for last Q&A
**Warning signs:** Re-asking questions that were already answered

## Code Examples

### Context Detection Heuristic (per D-34)
```javascript
// Heuristic: Check if task description is in recent conversation
// Since Claude cannot introspect its context, this is approximate
// The real indicator is whether Step R0 is being run

// In stage reference file:
// "If resuming (user ran /clear before /do:continue):"
// - Check if project.md content is already known
// - If not, run load-task-context.cjs

// Practical approach: ALWAYS show resume summary on /do:continue
// Let the summary display before proceeding
// This ensures user sees state before continuing, whether context is warm or cold
```

### Resume Summary Display (per D-35, D-36)
```markdown
# In each stage reference file, Step R0.3:

Parse task markdown:
- `id` from frontmatter -> task slug
- `stage` from frontmatter -> current stage
- Last entry in Execution Log -> last action
- OR last Q&A in Clarifications -> last action (for grill stage)

Format:
```
Resuming: 260413-fix-login-validation (stage: execution)
Last action: Modified LoginForm.tsx - added validation schema

Continue? (yes/no)
```
```

### Execution Log Parsing (per D-37)
```javascript
// Extract last entry from Execution Log section
const logSection = taskMarkdown.match(/## Execution Log\n([\s\S]*?)(?=\n##|$)/);
if (logSection) {
  const entries = logSection[1].match(/### \d{4}-\d{2}-\d{2} \d{2}:\d{2}[\s\S]*?(?=### \d{4}|$)/g);
  const lastEntry = entries ? entries[entries.length - 1] : null;
  
  if (lastEntry) {
    const status = lastEntry.match(/\*\*Status:\*\* (.+)/);
    const files = lastEntry.match(/\*\*Files:\*\*\n([\s\S]*?)(?=\n\*\*|$)/);
    // Use status and files for resume summary
  }
}
```

### Mid-Execution Resume Checklist (per D-38)
```markdown
# When stage is execution and last Status is "In progress":

1. Parse Approach section into numbered steps
2. Parse Execution Log Files entries to find completed work
3. Match completed files to approach steps
4. Display:

```
Execution paused. Progress so far:
- [x] Added validation schema to login-form.ts
- [x] Imported schema in LoginPage.tsx
- [ ] Add unit tests for validation logic
- [ ] Update error messages

Continue from here? (yes/no)
```
```

### Stale Reference Prompt (per D-39)
```markdown
# After attempting to read each doc in Context Loaded:

If any files missing, batch into single prompt:

```
Referenced doc(s) not found:
- ~/workspace/database/projects/my-app/components/FormFields.md
- ~/workspace/database/projects/my-app/tech/validation.md

Options:
1. Continue without them (task markdown has context)
2. Stop and locate the docs

Enter 1 or 2:
```

Wait for user response before proceeding.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Implicit context reload | D-34 heuristic detection | Phase 9 | Token efficiency |
| No resume UI | D-35 resume summary | Phase 9 | User awareness |
| Silent skip missing docs | D-39 blocking prompt | Phase 9 | User control |

**Current implementation status:**
- `/do:continue` routing table: EXISTS in SKILL.md
- Stage reference files: EXIST (`stage-grill.md`, `stage-execute.md`, `stage-verify.md`)
- `load-task-context.cjs`: EXISTS and reusable
- Resume preamble (Step R0): NOT YET IMPLEMENTED -- this phase adds it
- Stale reference handling: NOT YET IMPLEMENTED -- this phase adds it

## Open Questions

1. **Context detection reliability**
   - What we know: D-34 specifies heuristic (check if task description in conversation)
   - What's unclear: Claude cannot reliably introspect its context window
   - Recommendation: Always display resume summary; make reload conditional on user behavior (if they ran /clear, they'll see "Resuming..." message and know context was reloaded)

2. **Grill-me resume point detection**
   - What we know: Clarifications section tracks Q&A pairs
   - What's unclear: How to detect which factor was being grilled when interrupted
   - Recommendation: Parse last Q&A entry to get factor, resume from next weakest

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js native test runner or manual verification |
| Config file | None -- scripts are tested manually or via integration |
| Quick run command | Manual skill invocation |
| Full suite command | Manual workflow walkthrough |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TS-11 | Resume from task state | integration/manual | `/do:continue` in test project | N/A (skill) |
| TS-11.a | Read active_task from config | unit | Already tested in load-task-context.cjs | Yes |
| TS-11.b | Parse YAML frontmatter | unit | Parse task file manually | Yes |
| TS-11.c | Route to correct stage | integration | `/do:continue` after creating task | N/A |
| TS-11.d | Preserve context | integration | `/clear` then `/do:continue` | N/A |

### Sampling Rate
- **Per task commit:** Manual verification via `/do:continue`
- **Per wave merge:** Full workflow test (create task, grill, clear, resume)
- **Phase gate:** Successfully resume after `/clear` in all stages

### Wave 0 Gaps
- None -- this phase modifies existing reference files, no new test infrastructure needed

## Sources

### Primary (HIGH confidence)
- **Existing SKILL.md** - `/do:continue` routing table and stage detection
- **stage-grill.md, stage-execute.md, stage-verify.md** - Current stage implementations
- **load-task-context.cjs** - Context loading script with workspace/project traversal
- **task-template.md** - Task markdown structure with all sections

### Secondary (MEDIUM confidence)
- **09-CONTEXT.md** - User decisions D-33 through D-39
- **Prior phase CONTEXT.md files** - Decisions D-01, D-19, D-20, D-32 for established patterns

### Tertiary (LOW confidence)
- None -- all findings verified against existing implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All patterns established in prior phases
- Architecture: HIGH - Building on existing infrastructure
- Pitfalls: HIGH - Based on analysis of existing code

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (30 days - stable domain)
