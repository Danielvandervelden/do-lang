# Phase 5: Task Creation & Refine Agent - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Create `/do:task` command that spawns a refine agent to analyze a user's task request, load relevant context, and create a comprehensive task markdown file. The refine agent produces a confidence score that determines whether grill-me (Phase 6) triggers.

**Delivers:**
- `/do:task` skill entry point
- Refine agent logic (analyzes task, loads context, documents approach)
- Task markdown template with YAML frontmatter + comprehensive body
- Confidence scoring with transparent factor breakdown
- One-task-per-project enforcement with clear active task status
- Wave-based execution structure for complex tasks

</domain>

<decisions>
## Implementation Decisions

### Task Markdown Structure
- **D-01:** Comprehensive problem statements — minimize ambiguity for session resumption. Full background, symptoms, impact, related context. Essential for `/do:continue` after `/clear`.
- **D-02:** Adaptive stage structure based on task complexity:
  - **Simple tasks:** Linear stages (`refinement → grilling → execution → verification`)
  - **Complex tasks:** Execution breaks into waves with individual status tracking:
    ```yaml
    stage: execution
    waves:
      - name: foundation
        status: complete
      - name: api-layer
        status: in_progress
      - name: ui-components
        status: pending
    ```
- **D-03:** Refine agent always asks user about wave breakdown — "This looks complex. Break into waves, or execute as one?" User decides, not heuristics.

### Confidence Calculation
- **D-04:** Multi-factor confidence model starting from 1.0 base:
  - **Context completeness** — Was database entry loaded? Are key patterns known?
  - **Scope clarity** — Is the task specific enough to plan?
  - **Integration complexity** — How many systems does it touch?
  - **Pattern familiarity** — Similar work exists in codebase?
- **D-05:** Show confidence breakdown to user: `Confidence: 0.72 (scope: -0.1, context: -0.1, complexity: -0.08)` — transparent so user sees exactly what's unclear.
- **D-06:** Threshold for grill-me trigger comes from config (`auto_grill_threshold`, default 0.9)

### Context Loading Strategy
- **D-07:** Targeted context, not blanket loading — token efficiency is core value
- **D-08:** Always load:
  - `project.md` from database (tech stack, conventions)
  - Task description (user's input)
- **D-09:** Task-relevant loading via keyword matching:
  - Parse task for key terms (e.g., "DataGrid", "authentication", "form validation")
  - Grep for matching files in `components/`, `tech/`, `features/` database folders
  - Load only docs that match task domain
- **D-10:** Not loaded by default: recent git history, open files, full codebase maps — unless task specifically relates

### Active Task Handling
- **D-11:** Block with status when user runs `/do:task` with active task:
  ```
  Active task: fix-login-bug.md (stage: execution)
  
  Options:
  - /do:continue — Resume this task
  - /do:abandon — Mark as abandoned and start fresh
  ```
- **D-12:** `/do:abandon` marks task as abandoned (`stage: abandoned`) but keeps the file in `.do/tasks/` for reference

### Claude's Discretion
- Exact wording of refinement prompts and confidence explanations
- Wave naming conventions (foundation/api/ui vs phase-1/phase-2)
- How to present confidence breakdown (table vs inline)
- Task slug generation from description (YYMMDD-<slug>.md)
- Error handling for malformed task descriptions

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Research (from /gsd:new-project)
- `.planning/research/skills-patterns.md` — Skill anatomy, inline prompt patterns (note: avoid AskUserQuestion in skills due to bug)
- `.planning/research/state-management.md` — File-based state, YAML frontmatter patterns

### Project Context
- `.planning/PROJECT.md` — Core value (token efficiency), constraints (flat hierarchy, /skill-creator)
- `.planning/REQUIREMENTS.md` — TS-06 acceptance criteria for task workflow

### Prior Phase Context
- `.planning/phases/03-project-setup/03-CONTEXT.md` — config.json schema with `active_task`, `auto_grill_threshold` fields
- `.planning/phases/04-database-scanning/04-CONTEXT.md` — Database entry structure, `/do:scan` outputs

### Existing Implementation
- `skills/do/SKILL.md` — Current skill file to extend with `/do:task`
- `skills/do/scripts/check-database-entry.cjs` — Database entry gate (required before task)
- `skills/do/scripts/project-health.cjs` — Project health check pattern
- `skills/do/references/project-template.md` — Template pattern with placeholders

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `check-database-entry.cjs` — Gate logic for database entry check; `/do:task` calls this first
- `project-health.cjs` — Health check pattern; can verify project is initialized
- `skills/do/references/` — Template files pattern for task markdown template

### Established Patterns
- Interactive setup with inline prompts (consistent with Phase 2/3/4)
- JSON config files with version markers
- YAML frontmatter for machine-parseable state
- Health check returns `{ healthy: bool, version: string, issues: [] }`

### Integration Points
- `.do/config.json` has `active_task` field that `/do:task` reads/writes
- `.do/config.json` has `auto_grill_threshold` that confidence check uses
- `<database>/projects/<project>/project.md` loaded for context
- `<database>/projects/<project>/components/`, `tech/`, `features/` searched for task-relevant docs

</code_context>

<specifics>
## Specific Ideas

- Task filename format: `YYMMDD-<slug>.md` (e.g., `260413-fix-login-validation.md`)
- Slug generated from first few words of task description, kebab-cased
- Confidence factors should be documented in task markdown for transparency
- If no matching docs found during keyword search, note "No internal docs matched" in context section
- Wave structure only appears in frontmatter when user confirms complex task breakdown

</specifics>

<deferred>
## Deferred Ideas

- **Grill-me agent** — Phase 6 implements the actual grilling when confidence < threshold
- **Implementation agent** — Phase 7+ handles actual task execution
- **Verification agent** — Phase 8 handles checking implementation vs plan
- **Task resume** — Phase 9 implements `/do:continue` that reads this task format

</deferred>

---

*Phase: 05-task-creation-refine-agent*
*Context gathered: 2026-04-13 via discuss-phase*
