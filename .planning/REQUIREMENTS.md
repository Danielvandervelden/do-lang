# Requirements

## Overview

**Product:** do — Token-efficient meta programming language for Claude Code and Codex
**Core Value:** Minimize token usage while maintaining execution quality through flat agent hierarchies

## Table Stakes (Must Have)

### TS-01: npm Package Structure
The package must be installable via `npm i -g do-lang` and publish skills to `~/.claude/skills/do/`.

**Acceptance:**
- [ ] `package.json` with postinstall script
- [ ] `bin/install.cjs` copies skills to `~/.claude/skills/`
- [ ] `yalc publish` works for local development
- [ ] Skills directory structure follows Claude Code conventions

### TS-02: Workspace-Level Initialization
Running any `/do:*` command without workspace setup triggers `/do:init` at workspace level.

**Acceptance:**
- [ ] Detects missing workspace setup (no CLAUDE.md marker)
- [ ] Creates database folder structure (`~/workspace/database/`)
- [ ] Creates AGENTS.md (canonical) at workspace root
- [ ] Creates CLAUDE.md, CURSOR.md, GEMINI.md pointing to AGENTS.md
- [ ] Marks workspace as initialized in CLAUDE.md

### TS-03: Project-Level Initialization
Running `/do:*` in a project without `.do/` folder triggers project setup.

**Acceptance:**
- [ ] Detects missing `.do/` folder in project
- [ ] Creates `.do/config.json` with project settings
- [ ] Creates `.do/tasks/` folder for task tracking
- [ ] Config includes: council toggles, auto_grill_threshold (0.9)

### TS-04: Database Entry Requirement
Running `/do:task` without database entry informs user to run `/do:scan` first.

**Acceptance:**
- [ ] Checks for `~/workspace/database/projects/<project>/project.md`
- [ ] Clear error message directing to `/do:scan`
- [ ] Does not proceed until database entry exists

### TS-05: Database Scanning
`/do:scan` creates database entry for a project by analyzing codebase.

**Acceptance:**
- [ ] Creates `project.md` with detected tech stack, structure
- [ ] Creates `components/`, `tech/` subdirectories as needed
- [ ] Interactive questions for things that can't be auto-detected
- [ ] Updates `~/workspace/database/__index__.md`

### TS-06: Task Workflow - Refinement
`/do:task` spawns a refine agent that creates task documentation.

**Acceptance:**
- [ ] Creates task markdown in `.do/tasks/YYMMDD-<slug>.md`
- [ ] YAML frontmatter with stages: refinement, grilling, execution, verification
- [ ] Documents: problem statement, context loaded, approach, concerns
- [ ] Calculates confidence score (0-1)
- [ ] One active task per project constraint

### TS-07: Task Workflow - Grill-Me
If confidence < 0.9, spawns grill-me agent for clarification.

**Acceptance:**
- [ ] Triggered automatically when confidence < threshold
- [ ] Asks targeted questions about gray areas
- [ ] Updates task markdown with clarifications
- [ ] Re-calculates confidence after grilling
- [ ] Loops until confidence >= threshold or user overrides

### TS-08: Context Clear Decision
After refinement/grilling, asks user whether to clear context.

**Acceptance:**
- [ ] AskUserQuestion: "Clear context before implementation?"
- [ ] Never clears implicitly
- [ ] If yes: user runs `/clear`, then `/do:continue`
- [ ] If no: proceeds to implementation immediately

### TS-09: Task Workflow - Implementation
Spawns implementation agent to execute the task.

**Acceptance:**
- [ ] Reads task markdown for context
- [ ] Executes changes following the documented approach
- [ ] Documents files changed, decisions made
- [ ] Updates task markdown execution log
- [ ] Flat hierarchy: no nested agent spawning

### TS-10: Task Workflow - Verification
Spawns verify agent to check implementation vs plan.

**Acceptance:**
- [ ] Compares implementation against task requirements
- [ ] Runs quality checks (lint, types, tests as applicable)
- [ ] Documents verification results in task markdown
- [ ] Marks task complete or flags issues

### TS-11: Task Resume
`/do:continue` resumes from last task state.

**Acceptance:**
- [ ] Reads `.do/config.json` for active task
- [ ] Parses YAML frontmatter for stage status
- [ ] Routes to correct stage (refinement/grilling/execution/verification)
- [ ] Preserves all prior context from task markdown

### TS-12: Debug Mode
`/do:debug` provides structured debugging for issues.

**Acceptance:**
- [ ] Scientific method: hypothesis → test → confirm/reject
- [ ] Creates debug session in `.do/debug/`
- [ ] Documents debugging steps and findings
- [ ] Separate from task workflow (can run independently)

## Features (Should Have)

### F-01: AI Council - Plan Review
Council reviews task plan before implementation (configurable).

**Acceptance:**
- [ ] Configurable via `.do/config.json` (`council_reviews.planning`)
- [ ] Spawns council advisor (Codex or Claude depending on runtime)
- [ ] Briefing template system for consistent reviews
- [ ] Incorporates feedback before proceeding

### F-02: AI Council - Implementation Review
Council reviews implementation after execution (configurable).

**Acceptance:**
- [ ] Configurable via `.do/config.json` (`council_reviews.execution`)
- [ ] Bidirectional: Claude reviews Codex, Codex reviews Claude
- [ ] Reviews against task requirements
- [ ] Can flag issues requiring revision

### F-03: Codex CLI Support
Full `/do:*` workflow works in Codex CLI.

**Acceptance:**
- [ ] Skills install to `~/.codex/commands/do/`
- [ ] Cross-runtime adapter pattern
- [ ] Same workflow behavior in both runtimes
- [ ] AGENTS.md support for workspace context

### F-04: Task Abandonment
Ability to abandon an active task and start a new one.

**Acceptance:**
- [ ] Detects existing active task
- [ ] Asks user to confirm completion/abandonment
- [ ] Marks abandoned tasks with status
- [ ] Allows starting new task

## Out of Scope

- **Global config (`~/.do/`)** — Per-project config only, matches GSD pattern
- **Nested subagent spawning** — Core architectural constraint
- **Multiple concurrent tasks** — v1 is single-task per project
- **Jira integration** — Jira commands will route TO `/do:task`, separate concern
- **IDE extensions** — CLI-first, extensions can come later

## Dependencies

| Requirement | Depends On |
|-------------|------------|
| TS-03 | TS-02 (workspace must be initialized first) |
| TS-04 | TS-03 (project must have .do/ folder) |
| TS-06 | TS-04, TS-05 (database entry required) |
| TS-07 | TS-06 (follows refinement) |
| TS-08 | TS-07 or TS-06 (after grilling or refinement) |
| TS-09 | TS-08 (after clear decision) |
| TS-10 | TS-09 (after implementation) |
| TS-11 | TS-06 (needs task to exist) |
| F-01 | TS-06 (needs task plan) |
| F-02 | TS-10 (needs implementation) |
| F-03 | TS-01 (needs package structure first) |

---
*Generated: 2026-04-13 from research synthesis*
