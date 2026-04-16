---
id: 260414-fix-skill-path-resolution
created: 2026-04-14T15:30:00.000Z
updated: '2026-04-14T09:28:36.200Z'
description: Replace all <skill-path> placeholders with resolved ~/.claude/commands/do path
stage: complete
stages:
  refinement: complete
  grilling: pending
  execution: complete
  verification: complete
  abandoned: false
council_review_ran:
  plan: true
  code: true
confidence:
  score: 0.95
  factors:
    context: 0
    scope: -0.05
    complexity: 0
    familiarity: 0
---

# Fix skill-path Resolution

## Problem Statement

The `<skill-path>` placeholder in do-lang skill files never resolves to an actual directory. When Claude encounters `node <skill-path>/scripts/check-database-entry.cjs`, it guesses wrong paths like `~/.claude/skills/do-task/scripts/`, causing `MODULE_NOT_FOUND` errors.

The correct installed path is `~/.claude/commands/do`. All 15 occurrences follow the pattern `<skill-path>/scripts/<name>.cjs`, so the replacement is a literal string swap of `<skill-path>` with `~/.claude/commands/do`.

**Acceptance criteria:**
- Zero occurrences of `<skill-path>` remain in any skill file
- All script invocations point to `~/.claude/commands/do/scripts/<name>.cjs`
- `node bin/install.cjs` syncs updated files to `~/.claude/commands/do/` without errors

## Context Loaded

- `CLAUDE.md` (project root) -- confirmed git workflow and skill creation conventions
- Grep results -- verified all 15 occurrences and their exact locations
- `~/.claude/commands/do/scripts/` -- confirmed directory exists with all referenced scripts
- `bin/install.cjs` -- confirmed install script exists for syncing

## Approach

Mechanical find-and-replace of `<skill-path>` with `~/.claude/commands/do` in these 9 source files (15 occurrences total):

1. **`skills/do/task.md`** (lines 50, 58 -- 2 occurrences)
2. **`skills/do/abandon.md`** (lines 25, 44 -- 2 occurrences)
3. **`skills/do/scan.md`** (line 43 -- 1 occurrence)
4. **`skills/do/debug.md`** (line 44 -- 1 occurrence)
5. **`skills/do/references/resume-preamble.md`** (line 53 -- 1 occurrence)
6. **`skills/do/references/stage-execute.md`** (lines 62, 283 -- 2 occurrences)
7. **`skills/do/references/init-workspace-setup.md`** (line 80 -- 1 occurrence)
8. **`skills/do/references/init-health-check.md`** (lines 13, 19, 25 -- 3 occurrences)
9. **`skills/do/references/stage-verify.md`** (line 74 -- 1 occurrence)

Post-replacement steps:

10. **Verify** -- grep for `<skill-path>` to confirm zero remaining occurrences
11. **Install** -- run `node bin/install.cjs` to sync changes to `~/.claude/commands/do/`

## Concerns

None. This is a mechanical find-and-replace with a verified target path. All scripts exist at the resolved location. No logic changes, no new dependencies, no behavioral changes beyond fixing the broken path resolution.

## Execution Log

### 2026-04-14 15:45 - Execution started
**Status:** In progress
**Steps:** 0/11 complete

### 2026-04-14 15:46 - Steps 1-9: Replace <skill-path> in all source files
**Files:**
- `skills/do/task.md` - 2 occurrences replaced (lines 50, 58)
- `skills/do/abandon.md` - 2 occurrences replaced (lines 25, 44)
- `skills/do/scan.md` - 1 occurrence replaced (line 43)
- `skills/do/debug.md` - 1 occurrence replaced (line 44)
- `skills/do/references/resume-preamble.md` - 1 occurrence replaced (line 53)
- `skills/do/references/stage-execute.md` - 2 occurrences replaced (lines 62, 283)
- `skills/do/references/init-workspace-setup.md` - 1 occurrence replaced (line 80)
- `skills/do/references/init-health-check.md` - 3 occurrences replaced (lines 13, 19, 25)
- `skills/do/references/stage-verify.md` - 1 occurrence replaced (line 74)

**Decisions:**
- Used replace_all where multiple occurrences in same file (abandon.md, stage-execute.md, init-health-check.md)
- Used targeted replace for single-occurrence files to avoid unintended changes

**Status:** Complete

### 2026-04-14 15:46 - Step 10: Verify zero remaining occurrences
**Result:** Grep for `<skill-path>` in skills/do — 0 matches found across 0 files.
**Status:** Complete

### 2026-04-14 15:46 - Step 11: Install — sync to ~/.claude/commands/do/
**Result:** `node bin/install.cjs` succeeded — installed to /Users/globalorange/.claude/commands/do, /Users/globalorange/.claude/agents, /Users/globalorange/.codex/commands/do
**Status:** Complete

### 2026-04-14 15:46 - Execution complete
**Status:** Complete
**Summary:**
- Steps completed: 11/11
- Files modified: 9 source files
- Occurrences replaced: 14 total
- Deviations: 0

## Council Review

### 2026-04-14 - Code Review (Iteration 1/1)

**Self-Review:** APPROVED
- All 9 files modified, 14 occurrences replaced (plan said 15 — pre-existing overcount, benign)
- Zero remaining `<skill-path>` instances confirmed via grep
- Correct target path `~/.claude/commands/do` matches install script destination (bin/install.cjs line 10)
- Install ran successfully, changes live in installed location

**Council Review:** APPROVED
- Path pattern consistent with Codex files (which use `~/.codex/commands/do`)
- `~` tilde resolves correctly in bash blocks executed by Claude
- No architectural concerns; purely mechanical, correct replacement
- Pre-existing nitpick: README still references old `~/.claude/skills/do/` path (not introduced by this task)

**Combined Verdict:** VERIFIED

## Verification Results

## UAT Checklist

Based on the task requirements, verify:

1. [ ] Run `grep -r '<skill-path>' skills/` in the project root — should return 0 matches
2. [ ] Run `/do:task` in a project that has a `.do/` folder — Step 1 runs `node ~/.claude/commands/do/scripts/check-database-entry.cjs --message` without MODULE_NOT_FOUND errors
3. [ ] Run `/do:abandon` in a project with an active task — the check command `node ~/.claude/commands/do/scripts/task-abandon.cjs check` resolves correctly
4. [ ] Run `/do:scan` on a project — `node ~/.claude/commands/do/scripts/scan-project.cjs` resolves without path errors
5. [ ] Run `/do:debug` — `node ~/.claude/commands/do/scripts/debug-session.cjs check` resolves without errors
6. [ ] After `/do:init` health check step, `node ~/.claude/commands/do/scripts/workspace-health.cjs` and `node ~/.claude/commands/do/scripts/project-health.cjs` both resolve correctly
7. [ ] Verify `~/.claude/commands/do/skills/` (or `skills/` at installed path) contains the updated files with `~/.claude/commands/do` paths (not the old `<skill-path>` placeholder)
