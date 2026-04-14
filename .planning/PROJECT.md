# do

## What This Is

A token-efficient meta programming language for Claude Code and Codex. An npm package that provides `/do:*` commands for AI-assisted task execution with a flat agent hierarchy (no nested subagents). Designed to replace GSD's token-heavy approach while maintaining structured workflows, state persistence, and quality gates.

**Status:** Milestone v1.0 complete (2026-04-13) — all 13 phases implemented

## Core Value

**Minimize token usage while maintaining execution quality.** Every architectural decision prioritizes flat agent hierarchies, efficient state management, and avoiding the nested subagent explosion that makes GSD expensive.

## Requirements

### Validated

All requirements validated through implementation and testing:

#### Table Stakes (TS-01 through TS-12)
- [x] npm package structure with postinstall
- [x] Workspace-level initialization
- [x] Project-level initialization
- [x] Database entry requirement
- [x] Database scanning
- [x] Task refinement workflow
- [x] Grill-me for low confidence
- [x] Context clear decision
- [x] Implementation execution
- [x] Verification
- [x] Task resume
- [x] Debug mode

#### Features (F-01 through F-05)
- [x] AI Council plan review
- [x] AI Council implementation review
- [x] Codex CLI support
- [x] Task abandonment
- [x] Workspace customization with AI CLI detection

### Out of Scope

- **Global config (`~/.do/`)** — Per-project config only, consistent with GSD pattern
- **Nested subagent spawning** — Core architectural constraint, defeats the purpose
- **Multiple concurrent tasks per project** — v1 is single-task, may revisit later
- **Jira integration** — Jira commands will route TO `/do:task`, not the other way around

## Context

**Why this exists:** GSD's nested subagent architecture burns tokens rapidly. A task that should cost $0.50 can cost $5+ when agents spawn agents spawn agents. The user wants the structured workflow benefits (planning, verification, state persistence) without the token explosion.

**Existing patterns leveraged:**
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

| Decision | Phase | Rationale | Outcome |
|----------|-------|-----------|---------|
| Flat agent hierarchy | Setup | Token efficiency is core value | Validated |
| YAML frontmatter + markdown | Setup | Machine-parseable status, human-readable content | Validated |
| Per-project config only | Setup | Matches GSD pattern, avoids global state complexity | Validated |
| Bidirectional council | 11 | Claude and Codex can review each other | Validated |
| Use /skill-creator | Setup | Ensures consistent skill structure, user preference | Validated |
| Workspace config with cascade | 13 | Project overrides workspace overrides defaults | Validated |
| AI CLI auto-detection | 13 | Zero friction, runs every /do:init | Validated |

## Deliverables (Milestone v1.0)

### Scripts (`skills/do/scripts/`)
- `workspace-health.cjs` — Workspace health checks
- `project-health.cjs` — Project health checks
- `scan-project.cjs` — Database entry creation
- `check-database-entry.cjs` — Database entry validation
- `load-task-context.cjs` — Task context loading
- `task-abandon.cjs` — Task abandonment handling
- `debug-session.cjs` — Scientific method debugging
- `council-invoke.cjs` — AI council invocation with config cascade
- `detect-tools.cjs` — AI CLI detection

### Reference Files (`skills/do/references/`)
- `task-template.md` — Task markdown template
- `stage-refine.md` — Refinement stage
- `stage-grill.md` — Grill-me stage
- `stage-execute.md` — Execution stage
- `stage-verify.md` — Verification stage
- `stage-debug.md` — Debug stage
- `council-brief-plan.md` — Council plan review template
- `council-brief-code.md` — Council code review template

### Codex Commands (`codex/`)
- `do-init.md`, `do-task.md`, `do-continue.md`, `do-abandon.md`, `do-debug.md`, `do-scan.md`

---
*Last updated: 2026-04-13 — Milestone v1.0 complete*
