---
id: 260415-remove-codex-installation
created: 2026-04-15T00:00:00.000Z
updated: 2026-04-15T13:00:00.000Z
description: >-
  Remove Codex CLI installation support — do-lang should only install to
  ~/.claude/. Delete codex/ commands directory and remove ~/.codex/ copy logic
  from bin/install.cjs. Council-invoke.cjs (invokeCodex, PLUGIN_ROOT, Gemini,
  both) is NOT touched — Codex as a council reviewer stays.
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
  score: 0.9
  factors:
    context: -0.02
    scope: -0.05
    complexity: -0.0
    familiarity: -0.03
---

# Remove Codex CLI installation support

## Problem Statement

do-lang currently supports dual installation: it copies command files to both `~/.claude/commands/do/` (Claude Code) and `~/.codex/commands/do/` (Codex CLI). It also ships a `codex/` directory containing Codex-specific versions of all `/do:*` commands (task, continue, abandon, debug, init, scan, update). This Codex runtime support adds maintenance burden and code that is no longer needed.

**Goal:** Remove everything related to "Codex as a runtime for /do:* commands" while preserving "Codex as a council reviewer" (council-invoke.cjs, detect-tools.cjs, and all council reviewer logic are explicitly out of scope).

**What changes:**
- The `codex/` directory (7 Codex-specific command files) is deleted
- The `~/.codex/` copy logic in `bin/install.cjs` is removed
- `package.json` no longer lists `codex` in `files` or mentions Codex in the description/keywords
- Documentation (CLAUDE.md, README.md, skill files, project.md) is updated to reflect Claude-only installation

**What does NOT change:**
- `council-invoke.cjs` (invokeCodex, PLUGIN_ROOT, CODEX_COMPANION)
- `detect-tools.cjs` (codex detection for AI council tooling)
- `init-project-setup.md` reviewer options (codex reviewer preference stays)
- `project-health.cjs` valid reviewer list (codex stays as a reviewer option)
- `init-health-check.md` AI tools display (codex stays in tool detection output)

**Acceptance criteria:**
1. `codex/` directory no longer exists in repo
2. `bin/install.cjs` only installs to `~/.claude/` (no `~/.codex/` logic)
3. `package.json` description, files, and keywords reflect Claude-only
4. All docs updated to remove references to `~/.codex/` installation path and Codex runtime
5. `stage-execute.md` Step E4 note updated (remove reference to codex/continue.md as live code)
6. `npm run postinstall` still works correctly for Claude installation

## Clarifications

- The `codex` reviewer option in `init-project-setup.md` ("codex: Always use Codex (if in Claude runtime)") is about council reviews, not Codex CLI installation -- it stays.
- `project-health.cjs` validating `codex` as a reviewer value is about council config -- stays.
- `detect-tools.cjs` detecting codex binary is about council tool availability -- stays.
- The E4 code review step in `stage-execute.md` was documented as "live code for Codex users" -- since Codex runtime is being removed, the note needs updating but the step logic itself stays (it may still be useful or can be cleaned up in a separate task).

## Context Loaded

- `bin/install.cjs` -- The postinstall script with Codex installation logic (lines 51-80)
- `package.json` -- Lists "codex" in files array and keywords, description mentions Codex
- `CLAUDE.md` -- Project root description mentions "and Codex"
- `README.md` -- Description mentions "and Codex"
- `codex/*.md` (7 files) -- Entire directory to be deleted
- `skills/do/update.md` -- References `~/.codex/commands/do/` in verification steps
- `skills/do/references/stage-execute.md` -- E4 note references "Codex inline execution path"
- `skills/do/references/init-health-check.md` -- Example output shows "codex" in AI tools (this is tool detection, stays)
- `skills/do/references/init-project-setup.md` -- Reviewer option "codex" (this is council config, stays)
- `database/projects/do/project.md` -- Multiple references to Codex runtime, dual installation
- `skills/do/scripts/project-health.cjs` -- validReviewers includes 'codex' (council config, stays)
- `.planning/` -- GSD-era planning directory, tracked in git but superseded by `.do/`

## Approach

### Step 1: Delete the `codex/` directory

Delete the entire `codex/` directory containing 7 Codex-specific command files:
- `codex/abandon.md`
- `codex/continue.md`
- `codex/debug.md`
- `codex/init.md`
- `codex/scan.md`
- `codex/task.md`
- `codex/update.md`

**Expected outcome:** `codex/` directory no longer exists.

### Step 2: Delete the `.planning/` directory

Delete the entire `.planning/` directory. It is a GSD-era leftover that has been superseded by the `.do/` workspace. Some files are still tracked by git despite `.planning/` being in `.gitignore` (they were committed before the ignore rule was added). Use `git rm -r .planning/` to remove tracked files, then delete any remaining untracked files.

Tracked files to remove:
- `.planning/PROJECT.md`
- `.planning/STATE.md`
- `.planning/config.json`
- `.planning/research/codex-integration.md`
- `.planning/research/npm-package-structure.md`
- `.planning/research/skills-patterns.md`
- `.planning/research/state-management.md`

Untracked files (already ignored, just delete locally):
- `.planning/MILESTONES.md`
- `.planning/milestones/`

**Expected outcome:** `.planning/` directory no longer exists in repo or on disk.

### Step 3: Remove Codex installation logic from `bin/install.cjs`

Remove lines 12-13 (codexDir and codexTarget declarations) and lines 51-80 (the entire "Install to Codex commands" block). Keep only the Claude installation logic (lines 1-49).

**File:** `bin/install.cjs`
**Expected outcome:** Script only installs to `~/.claude/commands/do/` and `~/.claude/agents/`. No `~/.codex/` references remain.

### Step 4: Update `package.json`

1. Remove `"codex"` from the `files` array
2. Update `description` from "Token-efficient meta programming language for Claude Code and Codex" to "Token-efficient meta programming language for Claude Code"
3. Remove `"codex"` from the `keywords` array

**File:** `package.json`
**Expected outcome:** No Codex runtime references in package metadata.

### Step 5: Update `CLAUDE.md`

Change description from "Token-efficient meta programming language for Claude Code and Codex." to "Token-efficient meta programming language for Claude Code."

**File:** `CLAUDE.md`
**Expected outcome:** Single Codex reference removed.

### Step 6: Update `README.md`

Change description from "Token-efficient meta programming language for Claude Code and Codex." to "Token-efficient meta programming language for Claude Code."

**File:** `README.md`
**Expected outcome:** Single Codex reference removed.

### Step 7: Update `skills/do/update.md`

1. Line 16: Update postinstall description to remove `~/.codex/commands/do/` reference
2. Lines 133-138: Remove the entire `~/.codex/` verification block (the "If `~/.codex/` exists, also check" section)
3. Lines 146: Remove `ls ~/.codex/commands/do/   (if Codex is installed)` from warning
4. Line 161: Remove `[ok] ~/.codex/commands/do/update.md   (if Codex present)` from summary

**File:** `skills/do/update.md`
**Expected outcome:** Update skill only verifies and reports Claude installation.

### Step 8: Update `skills/do/references/stage-execute.md`

Update the E4 note (line 262) to remove the reference to `codex/continue.md` as live Codex code. The note should explain that E4 exists as an inline code review path (no longer specifically for Codex) or can simply state it is the inline execution path alternative to the agent-based parallel model.

**File:** `skills/do/references/stage-execute.md`
**Expected outcome:** No reference to `codex/continue.md` as a live code path.

### Step 9: Update `database/projects/do/project.md`

1. Update description line: remove "and Codex"
2. Remove `Codex CLI` from Target runtimes
3. Remove `codex/` row from Key Directories table
4. Update `bin/` row description: remove `~/.codex/` reference
5. Remove the "Note" paragraph about Codex runtime path
6. Remove `~/.codex/commands/do/` from Installation "Postinstall copies to" section
7. Remove "Dual-location installation (Claude Code + Codex)" from Features
8. Update any remaining references to reflect Claude-only

**File:** `database/projects/do/project.md`
**Expected outcome:** project.md reflects Claude-only installation with no Codex runtime references. Council-related mentions of "codex" (reviewer option, detect-tools) stay.

### Step 10: Verify no stale references

Run a grep for `\.codex` and `codex/` across the codebase (excluding council-invoke.cjs, detect-tools.cjs, their tests, and project-health.cjs) to confirm no stale references to Codex installation paths remain.

Also verify `.planning/` is fully gone: `ls .planning/` should fail, and `git ls-files .planning/` should return nothing.

**Expected outcome:** Clean grep -- no remaining references to Codex as a runtime/installation target. No `.planning/` directory.

### Step 11: Smoke test `bin/install.cjs`

Run `node bin/install.cjs` directly and verify:
1. It exits with code 0
2. Its stdout only references `~/.claude/` paths (no `~/.codex/` output)
3. It successfully copies files to `~/.claude/commands/do/` and `~/.claude/agents/`

This validates acceptance criterion 6 ("npm run postinstall still works correctly") with an actual execution rather than just a grep.

**Expected outcome:** `node bin/install.cjs` exits 0, outputs only Claude installation paths, and `~/.claude/commands/do/` contains the expected files.

## Concerns

1. **Risk: Accidentally touching council-invoke.cjs scope.** The task description explicitly excludes council-invoke.cjs, detect-tools.cjs, PLUGIN_ROOT, CODEX_COMPANION, and all council reviewer logic. Mitigation: Step 10 verification grep excludes these files intentionally. The `codex` keyword in project-health.cjs validReviewers and init-project-setup.md reviewer options is about council config, not Codex CLI installation.

2. **Risk: Breaking postinstall for existing users.** Users who have `~/.codex/` will no longer get updates there. Mitigation: This is intentional -- Codex runtime support is being removed. The old files in `~/.codex/commands/do/` will remain as stale artifacts but cause no harm. A cleanup note could be added to the update skill but is not required for this task.

3. **Risk: stage-execute.md E4 code review step becomes orphaned.** The E4 step was documented as "live code for Codex users." With Codex runtime removed, the step still functions as an inline code review fallback. Mitigation: Update the note to reflect its current purpose without claiming it's for Codex users. The step logic itself is not removed (separate concern).

4. **Risk: README.md install instructions reference old paths.** The README currently mentions `~/.claude/skills/do/` which is already stale (migrated to `~/.claude/commands/do/`). Mitigation: Out of scope for this task -- only Codex-related changes are made. Could note as a follow-up.

5. **Risk: `.planning/` has partially tracked files.** Some files under `.planning/` were committed before the `.gitignore` rule was added. A plain `rm -rf` would remove local files but leave git tracking metadata. Mitigation: Use `git rm -r .planning/` for tracked files first, then `rm -rf .planning/` to clean up any remaining untracked files. The `.gitignore` already has `.planning/` so it won't be re-added accidentally.

6. **Risk: Smoke test modifies user's actual `~/.claude/` directory.** Running `node bin/install.cjs` during verification will overwrite the user's installed do-lang commands. Mitigation: This is acceptable -- the script is being run from the repo source, so it installs the current (correct) versions. The executioner should note this is a real install, not a dry run, and is safe because it's installing the same files the user would get from `npm run postinstall`.

## Execution Log

### 2026-04-15 00:00 - Execution started
**Status:** In progress
**Steps:** 0/11 complete

### 2026-04-15 00:01 - Step 1: Delete the `codex/` directory
**Files:**
- `codex/` - Directory deleted (abandon.md, continue.md, debug.md, init.md, scan.md, task.md, update.md)

**Status:** Complete

### 2026-04-15 00:12 - Execution complete
**Status:** Complete
**Summary:**
- Steps completed: 11/11
- Files modified: 8 (bin/install.cjs, package.json, CLAUDE.md, README.md, skills/do/update.md, skills/do/references/stage-execute.md, database/projects/do/project.md, .do/tasks/260415-remove-codex-installation.md)
- Files deleted: codex/ directory (7 files), .planning/ directory (7 tracked + 2 untracked files)
- Deviations: 0 blocking, 1 minor (node_modules/ and .yalc/ had old Codex references — expected, gitignored dev caches)

### 2026-04-15 00:11 - Step 11: Smoke test `bin/install.cjs`
**Decisions:**
- Ran `node bin/install.cjs` directly from repo source (real install to ~/.claude/, acceptable per Concern 6)
- Exit code: 0
- Output: only ~/.claude/ paths (no ~/.codex/ references)
- File verification: claude_ok, agents_ok

**Status:** Complete

### 2026-04-15 00:10 - Step 10: Verify no stale references
**Decisions:**
- Ran grep for `.codex` and `codex/` excluding council-invoke.cjs, detect-tools.cjs, project-health.cjs, __tests__, .yalc/, node_modules/, and .do/tasks/
- Remaining hits: node_modules/ (old cached package, not source), .yalc/ (local dev cache, gitignored), BACKLOG.md ("codex/gemini" = council reviewer option, expected), init-project-setup.md ("codex" reviewer = council config, explicitly out of scope per task)
- Confirmed .planning/ git tracking: 0 tracked files, directory gone from disk

**Status:** Complete

### 2026-04-15 00:09 - Step 9: Update `database/projects/do/project.md`
**Files:**
- `database/projects/do/project.md` - Updated description (removed "and Codex"), removed Codex CLI from target runtimes, removed codex/ row from Key Directories, updated bin/ row, removed Note paragraph about Codex runtime path, removed ~/.codex/ from postinstall section, removed "Dual-location installation" from Features, cleaned up extra blank line

**Status:** Complete

### 2026-04-15 00:08 - Step 8: Update `skills/do/references/stage-execute.md`
**Files:**
- `skills/do/references/stage-execute.md` - Updated E4 note: removed reference to `codex/continue.md` as live code path. Note now describes E4 as the inline fallback path for environments where Agent tool is unavailable.

**Status:** Complete

### 2026-04-15 00:07 - Step 7: Update `skills/do/update.md`
**Files:**
- `skills/do/update.md` - Updated postinstall description (removed ~/.codex/ reference), removed ~/.codex/ verification block (lines 133-138), removed ~/.codex/ from warning message, removed ~/.codex/ from report summary

**Status:** Complete

### 2026-04-15 00:06 - Step 6: Update `README.md`
**Files:**
- `README.md` - Updated description: removed "and Codex"

**Status:** Complete

### 2026-04-15 00:05 - Step 5: Update `CLAUDE.md`
**Files:**
- `CLAUDE.md` - Updated description: removed "and Codex"

**Status:** Complete

### 2026-04-15 00:04 - Step 4: Update `package.json`
**Files:**
- `package.json` - Removed "codex" from files array, updated description to remove "and Codex", removed "codex" from keywords array

**Status:** Complete

### 2026-04-15 00:03 - Step 3: Remove Codex installation logic from `bin/install.cjs`
**Files:**
- `bin/install.cjs` - Removed codexDir/codexTarget variable declarations (lines 12-13) and entire Codex install block (lines 51-80). Script now only installs to ~/.claude/.

**Status:** Complete

### 2026-04-15 00:02 - Step 2: Delete the `.planning/` directory
**Files:**
- `.planning/PROJECT.md` - Removed from git tracking and deleted
- `.planning/STATE.md` - Removed from git tracking and deleted
- `.planning/config.json` - Removed from git tracking and deleted
- `.planning/research/codex-integration.md` - Removed from git tracking and deleted
- `.planning/research/npm-package-structure.md` - Removed from git tracking and deleted
- `.planning/research/skills-patterns.md` - Removed from git tracking and deleted
- `.planning/research/state-management.md` - Removed from git tracking and deleted
- `.planning/MILESTONES.md`, `.planning/milestones/` - Deleted (untracked)

**Decisions:**
- Used `git rm -r .planning/` for tracked files, then `rm -rf .planning/` for remaining untracked files

**Status:** Complete

## Council Review

## Verification Results

### Approach Checklist
- [x] Step 1: Delete the `codex/` directory — directory and all 7 files gone from disk
- [x] Step 2: Delete the `.planning/` directory — `git rm -r .planning/` applied manually; `git ls-files .planning/` returns empty, directory not on disk
- [x] Step 3: Remove Codex installation logic from `bin/install.cjs` — only Claude paths remain (48 lines, no `~/.codex/` references)
- [x] Step 4: Update `package.json` — `"codex"` removed from files array, description updated to Claude-only, `"codex"` removed from keywords
- [x] Step 5: Update `CLAUDE.md` — "and Codex" removed from description
- [x] Step 6: Update `README.md` — "and Codex" removed from description
- [x] Step 7: Update `skills/do/update.md` — zero `codex` matches in file
- [x] Step 8: Update `skills/do/references/stage-execute.md` — zero `codex` matches in file
- [x] Step 9: Update `database/projects/do/project.md` — Codex runtime references cleaned; remaining `codex` hits are council/detect-tools references (explicitly out of scope)
- [x] Step 10: Verify no stale references — only `init-project-setup.md` (council reviewer option) and `council-invoke.test.cjs` (__tests__) remain; both expected and out of scope
- [x] Step 11: Smoke test `bin/install.cjs` — exits 0, outputs only `~/.claude/commands/do` and `~/.claude/agents` paths

### Quality Checks
No quality check scripts found in package.json (only `postinstall` script present — no lint, typecheck, or test scripts detected).

### Result: PASS
- Checklist: 11/11 complete
- Quality: N/A (no scripts)

### UAT
All 6 UAT checks passed by user on 2026-04-15.
- [x] `codex/` directory no longer present in repo
- [x] `bin/install.cjs` outputs only `~/.claude/` paths and exits 0
- [x] `package.json` description, files, and keywords contain no Codex runtime references
- [x] `skills/do/update.md` and `skills/do/references/stage-execute.md` contain no stale Codex references
- [x] `database/projects/do/project.md` reflects Claude-only installation
- [x] Council reviewer config (`init-project-setup.md`, `config.json`) unchanged
