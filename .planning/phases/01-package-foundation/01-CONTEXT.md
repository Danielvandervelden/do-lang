# Phase 1: Package Foundation - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish the npm package infrastructure for "do" — the token-efficient meta programming language for Claude Code and Codex. This phase creates the foundational package structure that all subsequent phases will build upon.

**Delivers:**
- `package.json` with correct metadata and scripts
- `bin/install.cjs` postinstall script for skill installation
- `skills/do/` directory structure (empty skill files as placeholders)
- `.gitignore`, `README.md` with full documentation
- Verified yalc local development workflow

</domain>

<decisions>
## Implementation Decisions

### Package Identity
- **Package name:** `do-lang` — available on npm, clear purpose
- **Version:** Start at `0.1.0`, follow semantic versioning
- **Description:** "Token-efficient meta programming language for Claude Code and Codex"

### Directory Structure
- **Skill organization:** Nested directory pattern (`skills/do/init.md`, `skills/do/task.md`, etc.)
- **Rationale:** Most token-efficient — each command loads only its own file, no router overhead
- **Installation target:** `~/.claude/skills/do/` (preferred over commands/)

### Documentation
- **README scope:** Full documentation — installation, usage, command reference, development guide
- **Not minimal:** User explicitly wants comprehensive docs

### Claude's Discretion
- Exact postinstall script implementation details
- `.gitignore` contents (standard Node.js patterns)
- package.json field ordering and optional metadata
- Placeholder skill file content (just enough to verify installation works)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Research (from /gsd:new-project)
- `.planning/research/npm-package-structure.md` — npm conventions, postinstall patterns, yalc workflow
- `.planning/research/skills-patterns.md` — Claude Code skill anatomy, frontmatter fields

### Project Context
- `.planning/PROJECT.md` — Core value (token efficiency), constraints (flat hierarchy, /skill-creator)
- `.planning/REQUIREMENTS.md` — TS-01 acceptance criteria

</canonical_refs>

<specifics>
## Specific Ideas

- Use `/skill-creator` for all skill files (project constraint)
- Verify installation with `npm pack` → `npm i -g ./do-lang-0.1.0.tgz` → check `~/.claude/skills/do/` exists
- Test yalc workflow: `yalc publish` → `yalc add do-lang` in a test project → verify changes propagate

</specifics>

<deferred>
## Deferred Ideas

None — this is a focused infrastructure phase.

</deferred>

---

*Phase: 01-package-foundation*
*Context gathered: 2026-04-13 via discuss-phase*
