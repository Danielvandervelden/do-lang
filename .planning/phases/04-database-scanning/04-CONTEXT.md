# Phase 4: Database Scanning - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Create `/do:scan` skill that analyzes a project's codebase and generates a database entry. This enables `/do:task` to have rich project context for task execution.

**Delivers:**
- `/do:scan` skill with auto-scan and interview modes
- Codebase analysis logic (deps, folders, configs, git conventions)
- `project.md` template generation with core sections
- `components/`, `tech/`, `features/` subfolder creation with READMEs
- `__index__.md` update with project reference
- Database entry check for `/do:task` (TS-04 requirement)

</domain>

<decisions>
## Implementation Decisions

### Auto-Detection Scope
- **D-01:** Parse package.json/requirements.txt for framework, UI lib, testing, linting tools
- **D-02:** Scan src/ for folder structure at top level — focus on **non-obvious or surprising patterns**, document the project's way of working, complex things, niche patterns. Skip obvious things (standard Button component, etc.)
- **D-03:** Detect config files (.eslintrc, tsconfig, vite.config, commitlint.config) and infer conventions
- **D-04:** Read recent commits to detect commit prefix patterns and branch naming conventions

### project.md Structure
- **D-05:** Core sections always generated: General info, Tech Stack, Key Directories, Conventions
- **D-06:** Empty barrel import sections included: Components, Tech, Features with placeholder links (ready for future docs)
- **D-07:** No Jira section by default — this will be configurable via workspace customization system (deferred)

### Interaction Mode
- **D-08:** Choice at start of `/do:scan`: "Auto-scan or Interview?"
  - **Auto-scan:** Infer everything from codebase, user edits project.md after
  - **Interview:** Walk through questions to fill in details (name, description, purpose, key URLs)
- **D-09:** Use inline prompts (not AskUserQuestion) consistent with Phase 2/3 pattern due to skill load bug

### Subfolder Creation
- **D-10:** Create `components/`, `tech/`, `features/` folders in database entry
- **D-11:** Each folder contains README.md explaining what goes there — provides guidance for user and Claude

### Index Update
- **D-12:** Append project reference to `~/workspace/database/__index__.md`
- **D-13:** Follow existing format: project folder path, database folder path, optional notes

### Task Entry Gate (TS-04)
- **D-14:** `/do:task` must check for database entry before proceeding
- **D-15:** If missing, display clear message: "This project needs a database entry. Run `/do:scan` first."
- **D-16:** Check path: `<database>/projects/<project-name>/project.md`

### Claude's Discretion
- Exact wording of auto-scan vs interview prompt
- README.md content for subfolders (explain purpose and examples)
- How to detect "non-obvious" patterns during scan (heuristics)
- Error handling for malformed package.json or missing files
- Order of sections in generated project.md

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Research (from /gsd:new-project)
- `.planning/research/skills-patterns.md` — Skill anatomy, inline prompt patterns
- `.planning/research/state-management.md` — File-based state patterns

### Project Context
- `.planning/PROJECT.md` — Core value (token efficiency), constraints (flat hierarchy, /skill-creator)
- `.planning/REQUIREMENTS.md` — TS-04, TS-05 acceptance criteria

### Prior Phase Context
- `.planning/phases/02-workspace-detection-init/02-CONTEXT.md` — Database location, detection markers, interactive prompt pattern
- `.planning/phases/03-project-setup/03-CONTEXT.md` — config.json schema with `database_entry` field

### Reference Implementation
- `~/workspace/database/__index__.md` — Existing index format to follow
- `~/workspace/database/projects/leaselinq-frontend/project.md` — Example of rich project.md structure (target output)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `skills/do/SKILL.md` — Current /do:init skill with detection logic and interactive prompts
- `skills/do/scripts/workspace-health.cjs` — Health check script pattern
- `skills/do/scripts/project-health.cjs` — Project health check pattern
- `skills/do/references/` — Template files pattern (agents-template.md, config-template.json)

### Established Patterns
- Interactive setup with inline prompts (consistent with Phase 2/3)
- Template files with placeholder replacement
- JSON config files with version markers
- Health check returns `{ healthy: bool, version: string, issues: [] }`

### Integration Points
- `.do/config.json` has `database_entry` field that `/do:scan` should set to true
- `~/workspace/database/__index__.md` needs project reference appended
- `/do:task` (future) will check database entry exists before proceeding

</code_context>

<specifics>
## Specific Ideas

- Use `/skill-creator` to create the `/do:scan` skill
- Auto-scan should be fast — read package.json, scan folder names, grep config patterns
- Interview mode should ask ~5 questions max: name, description, purpose, prod URL, test URL
- Generated project.md should have TODO comments for sections user needs to fill
- READMEs in subfolders should include examples from leaselinq-frontend structure
- Consider detecting monorepo patterns (lerna.json, pnpm-workspace.yaml) for future support

</specifics>

<deferred>
## Deferred Ideas

### Workspace Customization System
User requested workspace-level command customization stored in `.do-workspace.json`:
- Configure during `/do:init`: "Do you use Jira?", "What sections in project.md?"
- Commands like `/do:scan` read these prefs and adjust output
- Add as new phase (Phase 13?) after v1 ships

**Why deferred:** Touches Phase 2 deliverables, adds complexity to v1 scope. Better to ship core functionality first.

</deferred>

---

*Phase: 04-database-scanning*
*Context gathered: 2026-04-13 via discuss-phase*
