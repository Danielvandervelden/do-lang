# Phase 5: Task Creation & Refine Agent - Research

**Researched:** 2026-04-13
**Domain:** Task workflow, YAML frontmatter schemas, confidence scoring, keyword-based context loading
**Confidence:** HIGH

## Summary

This phase implements the `/do:task` command that creates task markdown files with YAML frontmatter and spawns a refine agent to document the task. The core challenge is balancing comprehensive problem documentation (for session resume via `/do:continue`) with token efficiency (the project's core value).

The research confirms clear patterns from existing implementation: the `check-database-entry.cjs` script handles the prerequisite gate, `config.json` already has `active_task` and `auto_grill_threshold` fields, and the template pattern from `references/` provides the structure for task markdown. The refine agent should calculate multi-factor confidence transparently and propose wave breakdown for complex tasks, with user confirmation before adoption.

**Primary recommendation:** Build the refine agent as inline prompt logic within SKILL.md (not a separate agent file), following the established interactive prompt pattern from Phase 2-4. Use a task markdown template in `references/` with YAML frontmatter, and create a helper script for keyword-based context loading.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Task Markdown Structure:**
- D-01: Comprehensive problem statements for session resumption
- D-02: Adaptive stage structure (linear for simple, waves for complex)
- D-03: Refine agent always asks user about wave breakdown

**Confidence Calculation:**
- D-04: Multi-factor confidence model starting from 1.0 base
- D-05: Show confidence breakdown to user transparently
- D-06: Threshold from config (`auto_grill_threshold`, default 0.9)

**Context Loading Strategy:**
- D-07: Targeted context, not blanket loading
- D-08: Always load: project.md and task description
- D-09: Keyword matching for task-relevant docs
- D-10: Not loaded by default: git history, open files, codebase maps

**Active Task Handling:**
- D-11: Block with status when active task exists (show continue/abandon options)
- D-12: `/do:abandon` marks task as abandoned but keeps file

### Claude's Discretion

- Exact wording of refinement prompts and confidence explanations
- Wave naming conventions (foundation/api/ui vs phase-1/phase-2)
- How to present confidence breakdown (table vs inline)
- Task slug generation from description (YYMMDD-slug.md)
- Error handling for malformed task descriptions

### Deferred Ideas (OUT OF SCOPE)

- Grill-me agent (Phase 6)
- Implementation agent (Phase 7+)
- Verification agent (Phase 8)
- Task resume `/do:continue` (Phase 9)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TS-06 | Task Workflow - Refinement | Task markdown template, YAML frontmatter schema, confidence calculation model, keyword matching strategy, active task enforcement |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Always use `/skill-creator`** when creating or modifying skill files
- **Conventional commits** with prefixes: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`
- **Branch naming**: `feat/<description>`, `fix/<description>`, `chore/<description>`

## Standard Stack

### Core (Existing Assets to Reuse)

| Asset | Path | Purpose |
|-------|------|---------|
| check-database-entry.cjs | `skills/do/scripts/` | Gate check for database entry |
| project-health.cjs | `skills/do/scripts/` | Health check pattern |
| config-template.json | `skills/do/references/` | Config schema with `active_task`, `auto_grill_threshold` |
| SKILL.md | `skills/do/` | Skill file to extend with `/do:task` |

### New Assets to Create

| Asset | Path | Purpose |
|-------|------|---------|
| task-template.md | `skills/do/references/` | Task markdown template with YAML frontmatter |
| load-task-context.cjs | `skills/do/scripts/` | Keyword matching for context loading |

## Architecture Patterns

### Task Markdown Structure

Per D-01, D-02 from CONTEXT.md, task files use YAML frontmatter + comprehensive body:

```yaml
---
id: 260413-fix-login-validation
created: 2026-04-13T14:30:00Z
updated: 2026-04-13T14:30:00Z
description: "Fix login form validation not showing errors"

# Stage tracking (simple task - linear)
stage: refinement  # refinement | grilling | execution | verification | complete | abandoned
stages:
  refinement: in_progress  # pending | in_progress | complete
  grilling: pending
  execution: pending
  verification: pending

# Confidence calculation
confidence:
  score: 0.72
  factors:
    context: -0.10    # Database entry loaded but missing component docs
    scope: -0.10      # Task spans multiple files
    complexity: -0.08 # Touches form validation + API error handling
    familiarity: 0.0  # Similar patterns exist in codebase

# Wave breakdown (only if user confirms complex task)
# waves:
#   - name: foundation
#     status: pending
#   - name: api-layer
#     status: pending
#   - name: ui-components
#     status: pending
---

# Fix Login Form Validation

## Problem Statement

[Comprehensive description for session resume - per D-01]

The login form at `src/routes/auth/login.tsx` does not display validation errors when the user submits invalid credentials. The form accepts any input and only fails silently on API error.

**Symptoms:**
- No error messages appear when validation fails
- API returns 400 but no user feedback
- Previously worked in commit abc123 (pre-refactor)

**Impact:**
- Users cannot understand why login fails
- Support tickets increased 30% this week

## Context Loaded

[Documents loaded via keyword matching]

- `project.md` - React 19, react-hook-form + Zod
- `components/FormFields.md` - Error display patterns
- `tech/forms.md` - Form system conventions

## Approach

[Refine agent's analysis of how to solve]

1. Add Zod schema for login form
2. Wire react-hook-form error state to MUI TextField
3. Add API error handling to display server errors
4. Add test for validation display

## Concerns

[Potential issues or uncertainties]

- Need to check if form error styling exists in theme
- API error shape not documented - may need backend check

## Execution Log

[Populated during implementation - Phase 7]
```

### Complex Task with Waves

```yaml
---
id: 260413-implement-document-upload
created: 2026-04-13T14:30:00Z
updated: 2026-04-13T14:30:00Z
description: "Implement document upload with preview and categorization"

stage: execution
stages:
  refinement: complete
  grilling: complete
  execution: in_progress
  verification: pending

confidence:
  score: 0.95  # Post-grilling confidence
  factors:
    context: 0.0
    scope: 0.0
    complexity: -0.05
    familiarity: 0.0

# User confirmed wave breakdown
waves:
  - name: api-types
    description: "Generate upload endpoint types"
    status: complete
  - name: upload-hook
    description: "Create useDocumentUpload hook"
    status: in_progress
  - name: ui-components
    description: "Build UploadDropzone and Preview"
    status: pending
  - name: integration
    description: "Wire into DocumentsPage"
    status: pending
---
```

### Refine Agent Flow

The refine agent is implemented as inline logic in SKILL.md (not a separate agent file), following the established Phase 2-4 pattern:

```markdown
### Refinement Process

**Step 1: Check prerequisites**

Run database entry check:
```bash
node <skill-path>/scripts/check-database-entry.cjs --message
```

If missing, display error and stop.

**Step 2: Check for active task**

Read `.do/config.json` and check `active_task` field.

If active task exists:
```
Active task: fix-login-bug.md (stage: execution)

Options:
- /do:continue — Resume this task
- /do:abandon — Mark as abandoned and start fresh
```

Wait for user response. Do not proceed until resolved.

**Step 3: Load context**

Run context loading script:
```bash
node <skill-path>/scripts/load-task-context.cjs "<task-description>"
```

Parse JSON output for:
- `project_md_path` - Path to project.md
- `matched_docs` - Array of matched component/tech/feature docs
- `keywords` - Extracted keywords for transparency

**Step 4: Analyze task**

Read project.md and matched docs.
Analyze task description against loaded context.

**Step 5: Calculate confidence**

Starting from 1.0, apply deductions:

| Factor | Deduction | Condition |
|--------|-----------|-----------|
| context | -0.1 to -0.2 | Missing component/tech docs that task likely needs |
| scope | -0.05 to -0.15 | Task spans multiple files/systems |
| complexity | -0.05 to -0.15 | Multiple integration points |
| familiarity | -0.05 to -0.1 | No similar patterns found in codebase |

Display breakdown transparently:
```
Confidence: 0.72 (context: -0.10, scope: -0.10, complexity: -0.08)
```

**Step 6: Propose wave breakdown (if complex)**

If task description mentions multiple concerns OR touches 3+ systems:

```
This task looks complex. Break into waves?

1. Yes - Document waves before proceeding
2. No - Execute as single unit

Enter choice (default: 2):
```

If user selects waves, ask for wave names/descriptions.

**Step 7: Create task file**

Generate filename: `YYMMDD-<slug>.md`
- Extract first 3-5 words from description
- Kebab-case, remove special characters
- Example: "Fix login validation errors" -> `260413-fix-login-validation.md`

Write task file to `.do/tasks/<filename>`
Update `.do/config.json` with `active_task: "<filename>"`

**Step 8: Display summary**

```
Task created: .do/tasks/260413-fix-login-validation.md

Confidence: 0.72 (below threshold 0.9)
→ Grill-me phase will ask clarifying questions

Context loaded:
- project.md
- components/FormFields.md

Problem: [1-line summary]
Approach: [1-line summary]
```
```

### Keyword Matching Strategy (D-09)

The `load-task-context.cjs` script extracts keywords from task description and searches database folders:

```javascript
/**
 * Extract keywords from task description
 * @param {string} description - Task description
 * @returns {string[]} Keywords to search
 */
function extractKeywords(description) {
  // Common tech terms to look for
  const techTerms = [
    'datagrid', 'table', 'form', 'input', 'select', 'autocomplete',
    'authentication', 'auth', 'login', 'validation', 'api', 'endpoint',
    'upload', 'download', 'modal', 'dialog', 'route', 'navigation',
    'state', 'redux', 'store', 'hook', 'i18n', 'translation',
    'error', 'loading', 'skeleton', 'pagination'
  ];
  
  const words = description.toLowerCase().split(/\W+/);
  return words.filter(w => techTerms.includes(w) || w.length > 5);
}

/**
 * Search database folders for matching docs
 * @param {string} databasePath - Path to database/projects/<project>
 * @param {string[]} keywords - Keywords to search
 * @returns {string[]} Paths to matched docs
 */
function findMatchingDocs(databasePath, keywords) {
  const searchDirs = ['components', 'tech', 'features'];
  const matches = [];
  
  for (const dir of searchDirs) {
    const dirPath = path.join(databasePath, dir);
    if (!fs.existsSync(dirPath)) continue;
    
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const content = fs.readFileSync(path.join(dirPath, file), 'utf-8');
      const lowerContent = content.toLowerCase();
      
      // Match if any keyword appears in filename or content
      if (keywords.some(k => file.toLowerCase().includes(k) || lowerContent.includes(k))) {
        matches.push(path.join(dirPath, file));
      }
    }
  }
  
  return matches;
}
```

**Output format:**

```json
{
  "project_md_path": "/Users/.../database/projects/my-project/project.md",
  "matched_docs": [
    "/Users/.../database/projects/my-project/components/FormFields.md",
    "/Users/.../database/projects/my-project/tech/forms.md"
  ],
  "keywords": ["form", "validation", "error"],
  "database_path": "/Users/.../database/projects/my-project"
}
```

### Active Task Enforcement (D-11, D-12)

config.json schema already supports this (from Phase 3):

```json
{
  "version": "0.1.0",
  "project_name": "my-project",
  "active_task": "260413-fix-login-validation.md",
  "auto_grill_threshold": 0.9,
  ...
}
```

Enforcement logic:

1. **On `/do:task`:** Check `active_task`. If set and file exists, block with options.
2. **On `/do:abandon`:** Update task file stage to `abandoned`, clear `active_task` in config.
3. **On task completion:** Clear `active_task` in config (Phase 8 verification handles this).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter parsing | Custom parser | `yaml` npm package or simple regex | Edge cases in YAML spec |
| File watching | Custom watcher | Node.js `fs.watch` or skip | Only needed for IDE integration |
| Slug generation | Complex slugifier | Simple regex replace | Task slugs are internal only |

## Common Pitfalls

### Pitfall 1: Over-loading Context

**What goes wrong:** Loading all database docs inflates token usage.
**Why it happens:** Blanket loading seems safer than risking missing context.
**How to avoid:** Keyword matching per D-09. If no matches found, note "No internal docs matched" rather than loading everything.
**Warning signs:** Task file context section lists 10+ docs.

### Pitfall 2: Confidence Calculation Opacity

**What goes wrong:** User doesn't understand why confidence is low.
**Why it happens:** Confidence shown as single number without breakdown.
**How to avoid:** Per D-05, always show factor breakdown.
**Warning signs:** User asks "why is confidence 0.7?" after seeing score.

### Pitfall 3: Wave Breakdown Auto-Decision

**What goes wrong:** Agent decides task is complex and creates waves without asking.
**Why it happens:** Heuristics seem obvious to agent.
**How to avoid:** Per D-03, always ask user. Propose, don't decide.
**Warning signs:** User surprised by wave structure they didn't request.

### Pitfall 4: Stale Active Task

**What goes wrong:** `active_task` points to deleted file.
**Why it happens:** User manually deletes task file without using `/do:abandon`.
**How to avoid:** `project-health.cjs` already checks this (staleActiveTask warning). Honor it in `/do:task`.
**Warning signs:** Health check shows staleActiveTask warning.

### Pitfall 5: AskUserQuestion Bug

**What goes wrong:** AskUserQuestion fails silently after skill load.
**Why it happens:** Known Claude Code bug documented in workspace CLAUDE.md.
**How to avoid:** Use inline prompts (established Phase 2-4 pattern).
**Warning signs:** AskUserQuestion returns nothing, no user prompt appears.

## Code Examples

### Task Filename Generation

```javascript
/**
 * Generate task filename from description
 * @param {string} description - Task description
 * @returns {string} Filename in YYMMDD-slug.md format
 */
function generateTaskFilename(description) {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const datePrefix = `${yy}${mm}${dd}`;
  
  // Extract first 5 words, kebab-case
  const words = description
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .slice(0, 5)
    .filter(w => w.length > 0);
  
  const slug = words.join('-') || 'task';
  
  return `${datePrefix}-${slug}.md`;
}

// Examples:
// "Fix login form validation errors" -> "260413-fix-login-form-validation.md"
// "Add user profile page" -> "260413-add-user-profile-page.md"
// "" -> "260413-task.md"
```

### Confidence Calculation

```javascript
/**
 * Calculate confidence score with factor breakdown
 * @param {Object} analysis - Task analysis results
 * @returns {{score: number, factors: Object}}
 */
function calculateConfidence(analysis) {
  const factors = {
    context: 0,
    scope: 0,
    complexity: 0,
    familiarity: 0
  };
  
  // Context completeness
  if (!analysis.projectMdLoaded) {
    factors.context = -0.2;  // Critical
  } else if (analysis.matchedDocs.length === 0) {
    factors.context = -0.1;  // Missing specific docs
  }
  
  // Scope clarity
  if (analysis.mentionsMultipleFiles) {
    factors.scope = -0.1;
  }
  if (analysis.vaguePhrases.length > 2) {
    factors.scope = -0.15;  // "improve", "fix all", "make better"
  }
  
  // Complexity
  if (analysis.systemsTouched > 2) {
    factors.complexity = -0.05 * (analysis.systemsTouched - 2);
  }
  
  // Familiarity
  if (!analysis.similarPatternsExist) {
    factors.familiarity = -0.1;
  }
  
  const score = Math.max(0, 1.0 + Object.values(factors).reduce((a, b) => a + b, 0));
  
  return { score: Math.round(score * 100) / 100, factors };
}
```

### Task Template (for references/task-template.md)

```markdown
---
id: {{TASK_ID}}
created: {{CREATED_AT}}
updated: {{CREATED_AT}}
description: "{{DESCRIPTION}}"

stage: refinement
stages:
  refinement: in_progress
  grilling: pending
  execution: pending
  verification: pending

confidence:
  score: {{CONFIDENCE_SCORE}}
  factors:
    context: {{CONTEXT_FACTOR}}
    scope: {{SCOPE_FACTOR}}
    complexity: {{COMPLEXITY_FACTOR}}
    familiarity: {{FAMILIARITY_FACTOR}}
---

# {{TITLE}}

## Problem Statement

{{PROBLEM_STATEMENT}}

## Context Loaded

{{CONTEXT_LOADED}}

## Approach

{{APPROACH}}

## Concerns

{{CONCERNS}}

## Execution Log

<!-- Populated during implementation phase -->
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| GSD hierarchical phases/plans | Flat task files | This project | Single `.do/tasks/` folder, no nested structure |
| File existence as state | Explicit `stages` enum | This project | Cleaner state detection, no inference needed |
| Implicit subagent spawning | Inline prompt logic | This project | Token efficiency, no agent file overhead |

## Open Questions

1. **Wave naming conventions**
   - What we know: User wants to choose between `foundation/api/ui` vs `phase-1/phase-2`
   - What's unclear: Should we suggest domain-specific names based on task type?
   - Recommendation: Default to descriptive names, let user override

2. **Confidence factor weights**
   - What we know: D-04 specifies context/scope/complexity/familiarity
   - What's unclear: Exact deduction amounts per factor
   - Recommendation: Start with proposed values, tune based on user feedback

3. **Keyword matching precision**
   - What we know: Should match tech terms from task to database docs
   - What's unclear: Balance between over-matching (too many docs) vs under-matching (missing context)
   - Recommendation: Start with explicit tech terms list, expand based on usage

## Integration Points

| System | Integration |
|--------|-------------|
| `.do/config.json` | Read `active_task`, `auto_grill_threshold`; write `active_task` |
| `check-database-entry.cjs` | Call first to gate task creation |
| Database folders | Search `components/`, `tech/`, `features/` for keyword matches |
| Phase 6 (Grill-me) | If confidence < threshold, Phase 6 triggers |
| Phase 9 (Resume) | `/do:continue` reads task file frontmatter |

## Sources

### Primary (HIGH confidence)
- `.planning/phases/05-task-creation-refine-agent/05-CONTEXT.md` - User decisions
- `.planning/research/state-management.md` - YAML frontmatter patterns
- `.planning/research/skills-patterns.md` - Skill anatomy, inline prompts
- `skills/do/SKILL.md` - Current implementation to extend
- `skills/do/scripts/check-database-entry.cjs` - Gate pattern
- `skills/do/references/config-template.json` - Config schema

### Secondary (MEDIUM confidence)
- `~/.claude/get-shit-done/workflows/quick.md` - GSD quick task pattern (inspiration)
- `~/workspace/database/projects/leaselinq-frontend/project.md` - Rich database entry example

## Metadata

**Confidence breakdown:**
- Task markdown structure: HIGH - Clear decisions in CONTEXT.md
- Confidence calculation: HIGH - D-04, D-05 specify multi-factor model
- Keyword matching: MEDIUM - D-09 specifies approach but implementation is Claude's discretion
- Wave breakdown: HIGH - D-02, D-03 clear on user confirmation requirement

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (30 days - stable requirements, internal project)
