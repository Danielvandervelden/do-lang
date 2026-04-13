# do

## What This Is

A token-efficient meta programming language for Claude Code and Codex. An npm package that provides `/do:*` commands for AI-assisted task execution with a flat agent hierarchy (no nested subagents). Designed to replace GSD's token-heavy approach while maintaining structured workflows, state persistence, and quality gates.

## Core Value

**Minimize token usage while maintaining execution quality.** Every architectural decision prioritizes flat agent hierarchies, efficient state management, and avoiding the nested subagent explosion that makes GSD expensive.

## Requirements

### Validated

(None yet — ship to validate)

### Active

#### Workspace & Project Setup
- [ ] `/do:init` — Context-aware setup that detects workspace vs project level
  - Workspace level: Creates database structure, AGENTS.md (canonical), CLAUDE.md/CURSOR.md/GEMINI.md pointing to it
  - Project level: Creates `.do/` folder with `config.json` and `tasks/`
- [ ] `/do:scan` — Create database entry for a project (project.md, components/, tech/)
- [ ] Three-level initialization gate: workspace → project .do/ → database entry

#### Task Execution
- [ ] `/do:task` — Full task workflow with flat agent hierarchy:
  - Refine agent → creates task markdown with YAML frontmatter + markdown body
  - Grill-me agent (if confidence < 0.9) → forces user clarification
  - AskUserQuestion: "Clear context before implementation?" (never implicit)
  - Implementation agent → executes task, documents changes
  - Verify agent → checks implementation vs plan
- [ ] `/do:continue` — Resume from last task state (reads YAML frontmatter for status)
- [ ] `/do:debug` — Debug mode for troubleshooting

#### State Management
- [ ] Per-project `.do/` folder structure:
  - `config.json` — project-specific settings (council toggles, thresholds)
  - `tasks/` — task markdown files with execution state
- [ ] Task markdown format: YAML frontmatter (machine-parseable status) + markdown body (human-readable)
- [ ] One active task per project constraint with user confirmation to switch

#### AI Council (Bidirectional)
- [ ] Claude reviews Codex executions
- [ ] Codex reviews Claude executions
- [ ] Configurable per-project via `.do/config.json`
- [ ] Briefing template system for council reviews

#### Multi-Runtime Support
- [ ] Works in Claude Code CLI
- [ ] Works in Codex CLI
- [ ] Portable skill definitions

### Out of Scope

- Global `~/.do/` config folder — per-project config only, consistent with GSD pattern
- Nested subagent spawning — core architectural constraint, defeats the purpose
- `/do:jira` integration — Jira commands will route TO `/do:task`, not the other way around
- Multiple concurrent tasks per project — v1 is single-task, may revisit later

## Context

**Why this exists:** GSD's nested subagent architecture burns tokens rapidly. A task that should cost $0.50 can cost $5+ when agents spawn agents spawn agents. The user wants the structured workflow benefits (planning, verification, state persistence) without the token explosion.

**Existing patterns to leverage:**
- GSD's `.planning/` folder structure (proven pattern)
- The user's internal database at `~/workspace/database/` (project.md, components/, tech/)
- Existing `/skill-creator` for building skills
- Existing council patterns (`/council:ask-codex`, `/council:review-plan`)

**Key insight from user:** The existing `/do` command in GSD (zero-subagent inline executor) already proves the concept works — this project extends that into a full system.

## Constraints

- **Flat hierarchy**: Orchestrator → single agent per phase. No agent spawning agents.
- **Skill creation**: All skills MUST be created via `/skill-creator`, never hand-written.
- **npm package**: Must be installable via `npm i -g` and publishable to npm registry.
- **Local dev**: Must support yalc for local testing during development.
- **State in project**: All state lives in `.do/` within each project, never global.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Flat agent hierarchy | Token efficiency is core value | — Pending |
| YAML frontmatter + markdown | Machine-parseable status, human-readable content | — Pending |
| Per-project config only | Matches GSD pattern, avoids global state complexity | — Pending |
| Bidirectional council | Claude and Codex can review each other | — Pending |
| Use /skill-creator | Ensures consistent skill structure, user preference | — Pending |

---
*Last updated: 2026-04-13 after initial project setup*
