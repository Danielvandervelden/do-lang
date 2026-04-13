# Phase 3: Project Setup - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Create project-level initialization that detects projects without a `.do/` folder and runs interactive setup to create project configuration. This phase extends `/do:init` to handle project-level concerns after workspace setup.

**Delivers:**
- Project-level detection in `/do:init` (extends existing workspace detection)
- Interactive project setup flow with user preferences
- `.do/config.json` with project settings
- `.do/tasks/` folder for task tracking
- Project health check mode for already-initialized projects

</domain>

<decisions>
## Implementation Decisions

### Detection & Trigger
- **D-01:** Automatic trigger on any `/do:*` command — if `.do/` folder missing, trigger project setup before proceeding (matches workspace-level pattern)
- **D-02:** Health check mode for already-initialized projects — running `/do:init` in a project with `.do/` validates config and reports status
- **D-03:** Detection requires BOTH folder existence AND valid config marker — `.do/` must exist AND `.do/config.json` must have valid version field

### config.json Schema
- **D-04:** Council review toggles use nested object structure:
  ```json
  {
    "council_reviews": {
      "planning": { "enabled": true, "model": "codex-1" },
      "execution": { "enabled": false, "model": "o3" }
    }
  }
  ```
- **D-05:** Per-review-type model configuration — each review type can specify its own model
- **D-06:** Include version marker for migration/health checks: `"version": "0.1.0"`
- **D-07:** Include project metadata: `"project_name"`, `"database_entry"` (boolean)
- **D-08:** Active task tracked in config.json: `"active_task": "filename.md"` or `null`
- **D-09:** Grill threshold in config: `"auto_grill_threshold": 0.9`

### Default Settings (Interactive)
- **D-10:** No hardcoded defaults — project init asks user preferences during setup
- **D-11:** Interactive setup asks these questions:
  1. Council review preferences (enable planning? execution? which models?)
  2. Grill threshold (show 0.9 as suggested default)
  3. Database entry check (offer to run `/do:scan` if missing)
  4. Project name (confirm/override detected name)

### Integration Pattern
- **D-12:** `/do:init` always checks both workspace AND project levels
- **D-13:** Flow: workspace check → (init or health check) → if in project: project check → (init or health check)
- **D-14:** Report combined status showing both workspace and project state

### Claude's Discretion
- Exact wording of interactive setup prompts
- Order of setup questions
- Health check validation details beyond version and folder existence
- Error messages for invalid states

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Research (from /gsd:new-project)
- `.planning/research/skills-patterns.md` — Skill anatomy, AskUserQuestion patterns (note the bug workaround)
- `.planning/research/state-management.md` — File-based state, YAML frontmatter patterns

### Project Context
- `.planning/PROJECT.md` — Core value (token efficiency), constraints (flat hierarchy, /skill-creator)
- `.planning/REQUIREMENTS.md` — TS-03 acceptance criteria

### Prior Phase Context
- `.planning/phases/01-package-foundation/01-CONTEXT.md` — Package identity, skill organization pattern
- `.planning/phases/02-workspace-detection-init/02-CONTEXT.md` — Workspace detection logic, dual-purpose behavior, health check types

### Existing Implementation
- `skills/do/SKILL.md` — Current workspace-level /do:init implementation to extend
- `skills/do/scripts/workspace-health.cjs` — Health check script pattern to follow

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `skills/do/scripts/workspace-health.cjs` — Health check script pattern; project health check can follow same JSON output structure
- `skills/do/references/agents-template.md` — Template pattern with placeholders; can use similar for config.json defaults
- Workspace detection logic in SKILL.md — "do init completed" marker pattern applies to project level

### Established Patterns
- Interactive setup with inline prompts (not AskUserQuestion due to skill load bug)
- JSON config files with version markers
- Health check returns `{ healthy: bool, version: string, issues: [] }`
- Detection markers in config files

### Integration Points
- `/do:init` in SKILL.md needs extension for project-level logic
- New `skills/do/scripts/project-health.cjs` for project health checks
- config.json schema will be consumed by future phases (task, council, etc.)

</code_context>

<specifics>
## Specific Ideas

- Use `/skill-creator` to update `/do:init` skill with project-level logic
- Project health check should validate:
  - `.do/config.json` exists and has valid JSON
  - Version field present and parseable
  - Required fields present (council_reviews, auto_grill_threshold)
  - `.do/tasks/` folder exists
  - If `database_entry: true`, verify database entry actually exists
  - If `active_task` set, verify task file exists
- Interactive setup should detect project name from `package.json` name field or folder name
- After project init, display clear summary of what was created and configured

</specifics>

<deferred>
## Deferred Ideas

- **Database scanning** — Phase 4 handles `/do:scan` for creating project.md entries
- **Task workflow** — Phase 5+ handles the actual task creation/execution that uses this config
- **Codex CLI support** — Phase 12 handles `/do:*` in Codex; config.json schema designed to support it

</deferred>

---

*Phase: 03-project-setup*
*Context gathered: 2026-04-13 via discuss-phase*
