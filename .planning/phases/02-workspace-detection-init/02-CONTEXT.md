# Phase 2: Workspace Detection & Init - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Create `/do:init` skill that detects missing workspace setup and interactively creates the foundation. This is the entry point for new users — it sets up the database structure, AGENTS.md (canonical), and pointer files (CLAUDE.md, CURSOR.md, GEMINI.md).

**Delivers:**
- `/do:init` skill with workspace-level detection and initialization
- Interactive setup flow (questions about paths and workflows)
- AGENTS.md template with generic patterns
- Pointer files that reference AGENTS.md
- Database folder structure creation

</domain>

<decisions>
## Implementation Decisions

### Detection Logic
- **Marker:** Check for "do init completed" in CLAUDE.md at workspace root
- **If missing:** Trigger interactive workspace setup
- **If exists:** Run health check / review mode
- **Any `/do:*` command** should check this marker first and redirect to init if needed

### Dual-Purpose Behavior
| Scenario | Behavior |
|----------|----------|
| No workspace setup | Interactive initialization (create everything) |
| Workspace exists | Health check / review mode |

**Review mode checks:**
- Duplicate entries in `__index__.md`
- Stale project references (project folder deleted but database entry remains)
- Contradicting instructions across AGENTS.md sections
- Missing required sections in AGENTS.md
- Orphaned database entries (projects/ folder with no matching repo)
- Outdated version markers
- Consistency between AGENTS.md and pointer files (CLAUDE.md, CURSOR.md, GEMINI.md)

### Interactive Setup Flow
`/do:init` asks these questions (with sensible defaults):
1. **Workspace location** — "Where is your workspace root?" (default: `~/workspace`)
2. **Database location** — "Where should the database live?" (default: `<workspace>/database`)
3. **GitHub projects location** — "Where do your git repos live?" (default: `<workspace>/github-projects`)
4. **Custom workflows** — "Do you have custom tools/workflows to add? (Jira, CI/CD, etc.)" (optional freeform)

### AGENTS.md Template
**Generic only** — core patterns that work for any user:
- Loading context (database pattern, __index__.md barrel imports)
- Writing context (when to document discoveries)
- Database folder naming (match project folder names)
- project.md structure (sections every project.md should have)
- Git conventions (conventional commits, branches)
- Reuse before building (check existing components first)
- API types (never assume, always look up)
- Formatting (always format after edits)
- Database bootstrapping (verify project.md exists before tasks)

**NOT in default template** (user adds if needed):
- Jira integration rules
- Custom agent configurations
- Tool-specific workflows (GSD patches, etc.)

### File Generation
- **AGENTS.md** — Generated at workspace root with generic template + any user-specified custom workflows
- **CLAUDE.md** — Points to AGENTS.md, contains "do init completed" marker
- **CURSOR.md** — Points to AGENTS.md
- **GEMINI.md** — Points to AGENTS.md

### Database Structure
Created at `<database_location>/`:
```
database/
├── __index__.md      # Barrel imports (empty template)
├── projects/         # Per-project documentation
└── shared/           # Cross-project patterns
```

### Claude's Discretion
- Exact wording of interactive prompts
- Default content for __index__.md and shared/ files
- Error handling for invalid paths
- Whether to create github-projects/ folder or just reference it

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Research (from /gsd:new-project)
- `.planning/research/skills-patterns.md` — Skill anatomy, AskUserQuestion patterns
- `.planning/research/state-management.md` — File-based state patterns

### Project Context
- `.planning/PROJECT.md` — Core value (token efficiency), constraints
- `.planning/REQUIREMENTS.md` — TS-02 acceptance criteria
- `~/workspace/CLAUDE.md` — Reference implementation of what AGENTS.md should contain (generic parts)

</canonical_refs>

<specifics>
## Specific Ideas

- Use `/skill-creator` to create the `/do:init` skill
- Detection check should be a reusable function (other `/do:*` commands will need it)
- Store workspace config in a `.do-workspace.json` at workspace root for future reference
- The "do init completed" marker should include the version (e.g., "do init completed v0.1.0")

</specifics>

<deferred>
## Deferred Ideas

- **Project-level init** — Phase 3 handles `.do/` folder creation in individual projects
- **Database scanning** — Phase 4 handles `/do:scan` for creating project.md entries
- **Migration from existing setup** — Could detect existing CLAUDE.md and offer to convert, but not for v1

</deferred>

---

*Phase: 02-workspace-detection-init*
*Context gathered: 2026-04-13 via discuss-phase*
