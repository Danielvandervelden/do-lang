# Phase 7: Context Decision & Implementation - Research

**Researched:** 2026-04-13
**Domain:** Skill refactoring, conditional file loading, execution flow
**Confidence:** HIGH

## Summary

Phase 7 implements the context clear decision and task execution flow within `/do:continue`. This involves two key architectural changes: (1) refactoring SKILL.md into a router that loads stage-specific reference files, and (2) implementing the execution stage with logging.

The grill-me flow (currently inline in SKILL.md lines 951-1049) will be extracted to `references/stage-grill.md`. New `references/stage-execute.md` will contain execution logic. SKILL.md keeps only routing and shared utilities, targeting <100 lines for the `/do:continue` section.

**Primary recommendation:** Implement conditional reference loading via `@skills/do/references/stage-{stage}.md` pattern. Create stage-execute.md with execution flow, then refactor existing grill-me into stage-grill.md.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-18:** Hybrid context clear prompt — try AskUserQuestion first ("Clear context before implementation?"), if empty/fails, fall back to inline text prompt. Log which method succeeded. This addresses the documented AskUserQuestion bug while honoring TS-08.
- **D-19:** Conditional reference files — SKILL.md routes based on `stage` from task frontmatter, then reads the appropriate reference file:
  - `stage: refinement` + `stages.grilling: in_progress/pending` -> `references/stage-grill.md`
  - `stage: refinement` + ready for execution -> `references/stage-execute.md`
  - `stage: execution` -> `references/stage-execute.md`
  - `stage: verification` -> `references/stage-verify.md` (Phase 8)
  
  **Refactor required:** Move existing grill-me flow from SKILL.md into `references/stage-grill.md`. SKILL.md keeps only routing logic and shared utilities.
- **D-20:** Execution log format in task markdown:
  ```markdown
  ## Execution Log
  
  ### YYYY-MM-DD HH:MM
  **Files:**
  - `path/to/file.ts` - Change summary
  
  **Decisions:**
  - Plan said X - chose approach Y because Z
  - [If error] Tried A, failed because B, resolved with C
  
  **Status:** Wave N complete / In progress
  ```
- **D-21:** Stop and ask user on ANY deviation from plan. No autonomous resolution. Format:
  ```
  Plan said: [original instruction]
  Issue: [what happened]
  
  Options:
  1. [Alternative A]
  2. [Alternative B]
  3. Pause and investigate
  ```
  User must confirm before proceeding. Log the decision in execution log.
- **D-22:** After execution completes:
  - Update `stage: verification`
  - Update `stages.execution: complete`
  - Update `stages.verification: in_progress`
  - Display: "Execution complete. Proceeding to verification. (Phase 8 - not yet implemented)"

### Claude's Discretion
- Exact wording of context clear prompt options
- How to detect if AskUserQuestion succeeded vs failed
- Formatting of execution log entries
- How to chunk execution into logical entries (per file? per wave? per decision?)

### Deferred Ideas (OUT OF SCOPE)
- **Verification stage** - Phase 8 implements `stage-verify.md`
- **Wave-based execution with per-wave logging** - Could add wave headers to execution log when task has waves
- **Rollback on failure** - Git-based rollback if execution fails partway through
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TS-08 | Context Clear Decision: AskUserQuestion "Clear context before implementation?", never clears implicitly, if yes user runs /clear then /do:continue, if no proceeds immediately | D-18 hybrid approach (AskUserQuestion with inline fallback) handles the documented bug while meeting requirement |
| TS-09 | Task Workflow - Implementation: Reads task markdown for context, executes changes following documented approach, documents files changed and decisions made, updates task markdown execution log, flat hierarchy (no nested agent spawning) | D-19 reference file architecture, D-20 execution log format, D-21 deviation handling, D-22 stage transitions provide complete implementation pattern |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | 22.x | Runtime | Available in environment, supports built-in test runner |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| js-yaml | Not needed | YAML parsing | Could use for frontmatter, but SKILL.md uses string manipulation |

**No npm dependencies required for this phase.** All functionality implemented as plain JavaScript/markdown skill files. The existing codebase uses regex-based YAML frontmatter parsing.

## Architecture Patterns

### Recommended Project Structure
```
skills/do/
├── SKILL.md                          # Router (routes by stage, loads refs)
├── references/
│   ├── stage-grill.md                # [NEW] Extracted from SKILL.md
│   ├── stage-execute.md              # [NEW] Execution flow
│   ├── stage-verify.md               # [FUTURE Phase 8]
│   ├── task-template.md              # Existing
│   └── ...                           # Other existing templates
└── scripts/
    └── ...                           # Existing scripts
```

### Pattern 1: Conditional Reference File Loading

**What:** SKILL.md reads task stage from frontmatter and loads the appropriate reference file using the `@` syntax.

**When to use:** When different stages require different instruction sets that would bloat a single file.

**Example:**
```markdown
## /do:continue

### Stage Detection

**Step 1: Load active task**
[... existing loading logic ...]

**Step 2: Route by stage**

Read `auto_grill_threshold` from `.do/config.json` (default 0.9 if not set).

| Stage | Condition | Reference File |
|-------|-----------|----------------|
| refinement | stages.grilling: in_progress/pending AND confidence < threshold | @skills/do/references/stage-grill.md |
| refinement | stages.grilling: complete OR confidence >= threshold | @skills/do/references/stage-execute.md |
| execution | any | @skills/do/references/stage-execute.md |
| verification | any | @skills/do/references/stage-verify.md |
| abandoned | any | Display: "Task was abandoned. Run /do:task to create a new one." |

Follow the instructions in the loaded reference file.
```

**Source:** GSD `@` reference pattern from `.planning/research/skills-patterns.md`

### Pattern 2: Hybrid AskUserQuestion with Fallback

**What:** Try AskUserQuestion first, detect failure (empty/undefined response), fall back to inline text prompt.

**When to use:** When AskUserQuestion is preferred UX but the documented bug (fails after skill load) may occur.

**Example:**
```markdown
### Context Clear Decision

**Step E0: Ask about context clearing (per D-18)**

Try AskUserQuestion:
```javascript
AskUserQuestion(
  header: "Context",
  question: "Clear context before implementation?",
  options: [
    { label: "Yes", description: "Run /clear, then /do:continue to resume with fresh context" },
    { label: "No", description: "Proceed with current context" }
  ],
  multiSelect: false
)
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

Log which method was used in execution log: "Context decision: [AskUserQuestion|inline prompt] - user chose [Yes|No]"
```

### Pattern 3: Execution Log Entry Structure

**What:** Structured log entries documenting what changed, why, and any deviations.

**When to use:** After each significant action during execution.

**Example:**
```markdown
## Execution Log

### 2026-04-13 15:30
**Files:**
- `src/components/LoginForm.tsx` - Added email validation regex
- `src/utils/validators.ts` - Added validateEmail function export

**Decisions:**
- Plan said "use existing validation" - found validators.ts has email regex, reused it
- Plan said "update form component" - chose to extract validation to utils for reusability

**Status:** Wave 1 complete
```

### Anti-Patterns to Avoid
- **Monolithic SKILL.md:** Don't keep all stage logic inline - use reference files for extensibility
- **Silent AskUserQuestion failure:** Don't assume success - always have inline fallback
- **Uncommitted execution:** Don't execute without logging decisions - auditability matters
- **Implicit context clearing:** Never clear context without explicit user confirmation (TS-08)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML parsing | Custom regex parser | Existing frontmatter patterns in SKILL.md | Already proven to work |
| File reading | Custom fs utilities | Standard Node.js fs module | Sufficient for needs |
| Template substitution | Complex templating engine | Simple string replace | Keep token-efficient |

**Key insight:** The existing SKILL.md already has working patterns for reading config, parsing frontmatter, and updating task files. Reuse these patterns in the new reference files.

## Common Pitfalls

### Pitfall 1: AskUserQuestion After Skill Load
**What goes wrong:** AskUserQuestion fails silently when called in the same response turn as a skill load.
**Why it happens:** Documented bug in `~/workspace/CLAUDE.md` - AskUserQuestion bug after skill invocation.
**How to avoid:** D-18 hybrid approach - try AskUserQuestion, detect empty response, fall back to inline prompt.
**Warning signs:** User never sees the question, execution proceeds without asking.

### Pitfall 2: Lost Grill-Me Logic During Refactor
**What goes wrong:** Extracting grill-me to stage-grill.md breaks confidence recalculation or user override.
**Why it happens:** Missing steps or incorrect confidence boost calculation.
**How to avoid:** Exact copy of Steps G0-G5 from SKILL.md lines 955-1044, with only formatting changes.
**Warning signs:** Confidence doesn't update, "Proceed anyway" doesn't work, clarifications not saved.

### Pitfall 3: Stage Transition Gaps
**What goes wrong:** Task gets stuck because stage transition is incomplete.
**Why it happens:** Updating `stage:` but not `stages.{stage}:` or vice versa.
**How to avoid:** D-22 specifies both updates: `stage: verification` AND `stages.execution: complete` AND `stages.verification: in_progress`.
**Warning signs:** /do:continue routes incorrectly, displays "not yet implemented" when it should proceed.

### Pitfall 4: Deviation Without User Confirmation
**What goes wrong:** Agent makes autonomous decision when plan doesn't match reality.
**Why it happens:** Convenience bias - easier to just fix than ask.
**How to avoid:** D-21 is explicit - stop and ask user on ANY deviation, no exceptions.
**Warning signs:** Execution log shows decisions without "user chose X" notation.

## Code Examples

Verified patterns from existing implementation:

### Reading Task Frontmatter
```javascript
// From SKILL.md /do:continue pattern
// Parse YAML frontmatter for `stage`, `stages`, and `confidence`.
const frontmatterMatch = taskContent.match(/^---\n([\s\S]*?)\n---/);
if (frontmatterMatch) {
  const yaml = frontmatterMatch[1];
  // Extract stage
  const stageMatch = yaml.match(/^stage:\s*(.+)$/m);
  const stage = stageMatch ? stageMatch[1].trim() : 'refinement';
  // Extract stages.grilling
  const grillingMatch = yaml.match(/grilling:\s*(.+)$/m);
  const grillingStatus = grillingMatch ? grillingMatch[1].trim() : 'pending';
}
```

### Updating Frontmatter Field
```javascript
// Pattern for updating a specific frontmatter field
function updateFrontmatter(content, field, value) {
  const regex = new RegExp(`^(${field}:\\s*)(.+)$`, 'm');
  if (regex.test(content)) {
    return content.replace(regex, `$1${value}`);
  }
  // Field doesn't exist - add after opening ---
  return content.replace(/^---\n/, `---\n${field}: ${value}\n`);
}
```

### Appending to Execution Log Section
```javascript
// Pattern for appending to a markdown section
function appendToSection(content, sectionHeader, newContent) {
  const sectionRegex = new RegExp(`(## ${sectionHeader}\\n)([\\s\\S]*?)(?=\\n## |$)`);
  const match = content.match(sectionRegex);
  if (match) {
    const existingContent = match[2].trim();
    const updated = existingContent 
      ? `${existingContent}\n\n${newContent}`
      : newContent;
    return content.replace(sectionRegex, `$1\n${updated}\n\n`);
  }
  // Section doesn't exist - append at end
  return `${content}\n\n## ${sectionHeader}\n\n${newContent}\n`;
}
```

### ISO-8601 Timestamp
```javascript
// Standard timestamp format used in task frontmatter
const timestamp = new Date().toISOString();
// For execution log headers
const logTimestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
// Output: "2026-04-13 15:30"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Inline skill logic | Reference file loading | Phase 7 | Enables stage-specific instructions without bloat |
| AskUserQuestion only | Hybrid with fallback | Phase 7 | Addresses documented bug while preserving UX |
| Implicit context management | Explicit user decision | Phase 7 | Compliance with TS-08 |

**Deprecated/outdated:**
- Direct SKILL.md execution without stage routing - replaced by conditional reference loading

## Open Questions

1. **Chunking strategy for execution log entries**
   - What we know: D-20 specifies format with Files, Decisions, Status
   - What's unclear: Per-file entries? Per-wave? Per-decision point?
   - Recommendation: Per logical unit of work (wave if waves exist, otherwise per significant action)

2. **AskUserQuestion failure detection**
   - What we know: Bug causes empty/undefined response
   - What's unclear: Exact conditions that trigger the bug
   - Recommendation: Check for empty string, undefined, or null - any falsy response triggers fallback

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (node:test) |
| Config file | none - uses `node --test` |
| Quick run command | `node --test skills/do/scripts/__tests__/*.test.cjs` |
| Full suite command | `node --test skills/do/scripts/__tests__/*.test.cjs` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TS-08 | Context clear prompts user | manual-only | N/A - requires human interaction | N/A |
| TS-09 | Execution updates log | manual-only | N/A - requires running /do:continue | N/A |

### Sampling Rate
- **Per task commit:** Manual verification - run /do:continue through execution flow
- **Per wave merge:** Manual verification
- **Phase gate:** Full manual test: create task -> grill -> execute -> verify log

### Wave 0 Gaps
- None - this phase is skill markdown and manual testing. The existing test infrastructure covers supporting scripts.

## Sources

### Primary (HIGH confidence)
- `skills/do/SKILL.md` - Current implementation, lines 914-1049 contain /do:continue with grill-me flow
- `skills/do/references/task-template.md` - Task markdown structure with Execution Log section
- `.planning/phases/07-context-decision-implementation/07-CONTEXT.md` - D-18 through D-22 locked decisions
- `.planning/phases/06-grill-me-agent/06-CONTEXT.md` - D-13 through D-17 grill-me decisions
- `.planning/research/skills-patterns.md` - `@` reference syntax documentation

### Secondary (MEDIUM confidence)
- `~/workspace/CLAUDE.md` - AskUserQuestion bug documentation

## Project Constraints (from CLAUDE.md)

**Always use `/skill-creator` when creating or modifying skill files.** Never hand-write skills directly.

This means:
- stage-grill.md extraction must go through /skill-creator
- stage-execute.md creation must go through /skill-creator  
- SKILL.md refactoring must go through /skill-creator

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No external dependencies, plain Node.js
- Architecture: HIGH - Patterns verified from existing codebase
- Pitfalls: HIGH - Documented bugs and user decisions provide clear guidance

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (30 days - stable domain)
