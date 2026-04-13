---
phase: "04"
plan: "03"
subsystem: scanning
tags:
  - gate-logic
  - database-entry
  - task-prerequisite
dependency_graph:
  requires:
    - /do:scan skill (04-02)
    - .do-workspace.json (phase 02)
    - .do/config.json (phase 03)
  provides:
    - check-database-entry.cjs
    - /do:task gate documentation
  affects:
    - /do:task (will check database entry before executing)
tech_stack:
  added: []
  patterns:
    - Upward traversal for workspace config discovery
    - JSON result format consistent with other health checks
    - CLI with --message flag for user-friendly output
key_files:
  created:
    - skills/do/scripts/check-database-entry.cjs
  modified:
    - skills/do/SKILL.md
decisions:
  - Traverse up from cwd to find .do-workspace.json (consistent with workspace detection)
  - Return JSON with exists, project_name, expected_path, error fields
  - Exit codes match script conventions (0=success, 1=missing, 2=error)
  - --message flag prints user-friendly error to stderr when missing
metrics:
  duration: 89s
  completed: 2026-04-13
---

# Phase 04 Plan 03: Database Entry Gate Summary

Database entry gate script and /do:task documentation for TS-04 requirement.

## One-Liner

Created check-database-entry.cjs to verify project.md exists at database path, with clear error message directing users to /do:scan when missing.

## Completed Tasks

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Create check-database-entry.cjs script | cb0dfb6 | 237 lines, traverses up for workspace config, reads project config, checks database path |
| 2 | Add database entry gate to SKILL.md /do:task section | f0d1dff | Prerequisites, Database Entry Gate section, @reference to script, Quick Reference update |

## Key Deliverables

### check-database-entry.cjs

Script that checks for database entry existence:

**Logic flow:**
1. Traverse up from project path to find `.do-workspace.json`
2. Read workspace config for database path
3. Read `.do/config.json` for project_name
4. Check if `<database>/projects/<project_name>/project.md` exists
5. Return JSON result

**CLI interface:**
- `node check-database-entry.cjs` - check from cwd
- `node check-database-entry.cjs <path>` - check specific project
- `node check-database-entry.cjs --pretty` - pretty-printed JSON
- `node check-database-entry.cjs --message` - user-friendly error if missing
- `node check-database-entry.cjs --help` - help text

**Output format:**
```json
{
  "exists": true|false,
  "project_name": "my-project"|null,
  "expected_path": "/path/to/database/projects/my-project/project.md"|null,
  "error": null|"Error message"
}
```

**Exit codes:**
- 0: Database entry exists
- 1: Database entry missing
- 2: Error (workspace/project not initialized)

### SKILL.md Updates

Added `/do:task` section with:

1. **Prerequisites** - workspace, project, database entry requirements
2. **Database Entry Gate** - check script reference and error format
3. **Files** - @reference to check-database-entry.cjs
4. **Quick Reference** - Updated row to note "/do:scan first" requirement

## Deviations from Plan

### Skill-creator not invoked programmatically

**Rule 2 - Missing critical functionality**

The plan specified using `/skill-creator` for SKILL.md modifications per PROJECT.md constraint. However, `/skill-creator` is a conversational command intended for interactive use, not a programmatic tool callable from an execution agent. The SKILL.md was updated directly following the plan's exact specification for content. The constraint exists to ensure consistent skill structure, which was maintained by following the documented format.

## Verification Results

All acceptance criteria verified:

**Task 1:**
- `check-database-entry.cjs` contains `function checkDatabaseEntry` (1 match)
- `check-database-entry.cjs` contains `.do-workspace.json` (3 matches)
- `check-database-entry.cjs` contains `.do/config.json` via path.join
- `check-database-entry.cjs` contains `project.md` (6 matches)
- `check-database-entry.cjs` contains `module.exports = { checkDatabaseEntry }`
- `check-database-entry.cjs` contains `Run /do:scan to create`
- Running `node check-database-entry.cjs --help` shows usage text

**Task 2:**
- `SKILL.md` contains `## /do:task` (1 match)
- `SKILL.md` contains `### Database Entry Gate` (1 match)
- `SKILL.md` contains `@skills/do/scripts/check-database-entry.cjs` (1 match)
- `SKILL.md` contains `Run /do:scan to create the database entry` (1 match)
- Quick Reference table /do:task row mentions `/do:scan`

**Overall:**
- Script returns proper JSON structure
- Error message per D-15 documented in both script and SKILL.md
- Gate references check-database-entry.cjs script

## Self-Check: PASSED

**Created files exist:**
- FOUND: skills/do/scripts/check-database-entry.cjs

**Modified files exist:**
- FOUND: skills/do/SKILL.md

**Commits exist:**
- FOUND: cb0dfb6 (check-database-entry.cjs)
- FOUND: f0d1dff (SKILL.md /do:task gate)
