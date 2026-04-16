---
id: 260415-remove-codex-support
created: 2026-04-15T00:00:00.000Z
updated: 2026-04-15T00:00:00.000Z
description: >-
  Remove Codex support from do-lang — deploy to ~/.claude/ only. Remove
  ~/.codex/ install, invokeCodex/PLUGIN_ROOT/CODEX_COMPANION from
  council-invoke.cjs, codex detection from detect-tools.cjs, codex branching
  from agents, delete codex/ directory, update docs.
stage: abandoned
stages:
  refinement: abandoned
  grilling: pending
  execution: pending
  verification: pending
  abandoned: false
council_review_ran:
  plan: false
  code: false
confidence:
  score: 0.9
  factors:
    context: -0.02
    scope: -0.05
    complexity: -0.03
    familiarity: 0
pre_abandon_stage: refinement
---

# Remove Codex support

## Problem Statement

Supporting both Claude Code and Codex CLI adds complexity, token cost, and maintenance burden for negligible benefit. The dual-location install path (copying to both `~/.claude/` and `~/.codex/`), the Codex-specific runtime branches in `council-invoke.cjs` (invokeCodex, PLUGIN_ROOT, CODEX_COMPANION, codex branches in invokeBoth), codex detection in `detect-tools.cjs`, and the entire `codex/` command directory all exist to support a runtime that is no longer being actively used.

This task removes all Codex support, making do-lang a Claude Code-only tool. This simplifies the codebase, reduces the published package size, and eliminates dead code paths.

**Acceptance criteria:**
- `bin/install.cjs` no longer references `~/.codex/` or copies anything there
- `council-invoke.cjs` has no `invokeCodex` function, no `PLUGIN_ROOT`/`CODEX_COMPANION` constants, no codex branches in `invokeBoth`, no codex in `VALID_REVIEWERS` or `detectRuntime`
- `invokeBoth` delegates directly to `invokeGemini` (single advisor), returning `advisor: "both"` for forward-compatibility with Phase 12 (claude-as-reviewer)
- `detect-tools.cjs` no longer detects or maps `codex`
- `codex/` directory is deleted from the repo
- `package.json` no longer lists `codex` in `files` or `keywords`, description updated
- All docs (`project.md`, `CLAUDE.md`, `README.md`, reference files) reflect Claude-only support
- `project-health.cjs` valid reviewers list updated
- `.do/config.json` reviewer updated from `codex` to `gemini` (since codex is no longer valid)
- Test files updated to remove codex-specific test cases and expectations
- All existing tests pass after changes

## Clarifications

None needed. The backlog item clearly defines scope. Grep confirms agents/ directory has zero Codex references, so that scope item requires no changes.

## Context Loaded

- `backlog-remove-codex-support.md` -- Original backlog item with scope definition
- `bin/install.cjs` -- Postinstall script with codex copy logic (lines 51-79)
- `skills/do/scripts/council-invoke.cjs` -- Council invocation with invokeCodex, PLUGIN_ROOT, CODEX_COMPANION, detectRuntime, getAvailableReviewers, invokeBoth codex branches, VALID_REVIEWERS
- `skills/do/scripts/detect-tools.cjs` -- Tool detection with codex in TOOLS array and TOOL_TO_REVIEWER map
- `skills/do/scripts/project-health.cjs` -- Valid reviewers list includes codex (line 139)
- `skills/do/scripts/__tests__/council-invoke.test.cjs` -- Tests for codex-related exports and behaviors
- `skills/do/scripts/__tests__/detect-tools.test.cjs` -- Tests for codex tool detection
- `~/workspace/database/projects/do/project.md` -- Project documentation referencing Codex throughout (**NOTE: this is a workspace file outside the git repo**, located at `~/workspace/database/projects/do/project.md`, not inside the do repo)
- `package.json` -- Package metadata with codex in files, keywords, description
- `CLAUDE.md` -- Repo-level instruction file referencing Codex
- `README.md` -- Readme referencing Codex
- `skills/do/update.md` -- Update skill with codex verification logic
- `skills/do/references/init-project-setup.md` -- Init reference with codex reviewer option
- `skills/do/references/init-health-check.md` -- Health check reference with codex tool mention
- `skills/do/references/stage-execute.md` -- Stage execute with Codex inline path note
- `.do/config.json` -- Project config with `"reviewer": "codex"` that must be changed

## Approach

### 1. Delete `codex/` directory

Delete the entire `codex/` directory (7 files: abandon.md, continue.md, debug.md, init.md, scan.md, task.md, update.md). This is the cleanest first step since no other code imports from it -- `bin/install.cjs` only reads it if `~/.codex/` exists.

**Files:** `codex/` (delete entire directory)

### 2. Remove Codex install logic from `bin/install.cjs`

Remove lines 12-13 (`codexDir`, `codexTarget` declarations) and lines 51-79 (the entire "Install to Codex commands" block). The file should only handle `~/.claude/` installation.

**Files:** `bin/install.cjs`

### 3. Strip Codex from `council-invoke.cjs`

This is the largest change. Remove in order:
- Lines 26-48: The `versionDir`, `codexVersion`, version scanning try/catch, `PLUGIN_ROOT`, `CODEX_COMPANION` constants
- Line 59: Remove `"codex"` from `VALID_REVIEWERS` array (becomes `["claude", "gemini", "random", "both"]`)
- Lines 170-177: `detectRuntime()` -- simplify to always return `"claude"` or remove entirely (since runtime is always claude). Remove the function and inline `"claude"` where it is called.
- Lines 187-205: `getAvailableReviewers()` -- remove codex from hardcoded fallback lists. When `currentRuntime === "claude"`, fallback should be `["gemini"]` only. Remove the `currentRuntime === "codex"` branch and the trailing default.
- Lines 373-448: Delete entire `invokeCodex()` function
- Lines 597-684: **Rewrite `invokeBoth()` to delegate to `invokeGemini` only.** The decision: preserve `"both"` as a valid reviewer value for forward-compatibility (claude-as-reviewer is planned for Phase 12), but simplify `invokeBoth` to call only `invokeGemini`. Specifically:
  - Remove all codex runtime detection, codex promise creation, codex result handling, and the two-advisor synthesis logic (lines 604-683)
  - Replace the function body with: call `invokeGemini(briefPath, workspace, timeout, reviewType)`, then wrap the result in the return shape `{ success, advisor: "both", verdict, findings, recommendations, raw: { gemini } }`. The `advisor` field stays `"both"` so callers don't break.
  - Add a code comment: `// Phase 12: When claude-as-reviewer is implemented, invokeBoth will invoke both Claude + Gemini. Until then, "both" delegates to Gemini only.`
  - This makes `both` behave identically to `gemini` at runtime but preserves it as a distinct config value so users don't have to change configs again when Phase 12 lands.
- Lines 785-793: Remove `case "codex":` from the switch in `invokeCouncil`
- Lines 795-801: Remove `case "claude":` fallback-to-gemini comment about "Phase 12"
- Lines 885-913: Update `module.exports` to remove `invokeCodex`, `PLUGIN_ROOT`, `CODEX_COMPANION` from exports
- Line 838: Update CLI help text -- remove `codex` from reviewer values description. Change `Values: claude, codex, gemini, random, both` to `Values: claude, gemini, random, both`. Also update the example on line 845-846 that uses `--reviewer codex` to use `--reviewer gemini` instead.

**Files:** `skills/do/scripts/council-invoke.cjs`

### 4. Strip Codex from `detect-tools.cjs`

- Remove `"codex"` from `TOOLS` array (becomes `["gemini", "claude-cli"]`)
- Remove `codex: "codex"` from `TOOL_TO_REVIEWER` map
- Update module doc comment to reflect two tools not three

**Files:** `skills/do/scripts/detect-tools.cjs`

### 5. Update `project-health.cjs` valid reviewers

- Line 139: Remove `'codex'` from `validReviewers` array (becomes `['claude', 'gemini', 'random', 'both']`)

**Files:** `skills/do/scripts/project-health.cjs`

### 6. Update `package.json`

- Remove `"codex"` from `files` array
- Remove `"codex"` from `keywords` array
- Update `description` to remove "and Codex"

**Files:** `package.json`

### 7. Update `.do/config.json`

- Change `"reviewer": "codex"` to `"reviewer": "gemini"` (codex is no longer valid)

**Files:** `.do/config.json`

### 8. Update test files

**`skills/do/scripts/__tests__/detect-tools.test.cjs`:**
- Update TOOLS constant test to expect `["gemini", "claude-cli"]` with length 2
- Remove `"maps codex to codex"` test
- Update `"has all three mappings"` to expect two mappings without codex
- Update canonical ID checks to only include `["gemini", "claude"]`

**`skills/do/scripts/__tests__/council-invoke.test.cjs`:**
- Remove `detectRuntime` tests (if function removed) or update to always return claude
- Update `selectReviewer` tests: remove tests that expect codex as a valid result, update `random` selection to only expect gemini
- Remove `PLUGIN_ROOT` and `CODEX_COMPANION` constant tests (lines 356-383)
- Remove `invokeCodex` export test (line 414-419)
- Update `getAvailableReviewers` tests to not expect codex in results
- Update workspace config tests that use codex in `availableTools` examples
- **Add or update `invokeBoth` behavior test**: verify that `invokeBoth` returns `advisor: "both"` and delegates to gemini (a basic smoke test confirming the new single-advisor behavior)

**Files:** `skills/do/scripts/__tests__/council-invoke.test.cjs`, `skills/do/scripts/__tests__/detect-tools.test.cjs`

### 9. Update documentation files

**`~/workspace/database/projects/do/project.md`** (NOTE: this file lives outside the git repo at `~/workspace/database/projects/do/project.md` -- it is a workspace-level database file, not a repo file. The executor must use the absolute path):
- Line 1: Remove "and Codex" from description
- Line 19: Remove "Codex CLI" from Target runtimes
- Line 29: Remove `codex/` from Key Directories table
- Line 30: Remove `~/.codex/` from bin/ description
- Line 74: Remove the Codex runtime path note
- Line 136-137: Remove `~/.codex/` from Postinstall description
- Line 140: Remove "codex," from detect-tools.cjs description
- Line 159: Update AI Council line to remove codex
- Line 160: Remove "Dual-location installation" feature line
- Update last-updated date

**`CLAUDE.md`:**
- Line 3: Remove "and Codex" from description

**`README.md`:**
- Update description line to remove "and Codex"

**`skills/do/update.md`:**
- Remove codex verification block (lines 133-138 area: the `~/.codex/` check)
- Remove codex from success output
- Update postinstall note to only mention `~/.claude/`

**`skills/do/references/init-project-setup.md`:**
- Remove `codex` from reviewer selection options (line 45, 49)

**`skills/do/references/init-health-check.md`:**
- Remove `codex` from AI tools example output (line 49)

**`skills/do/references/stage-execute.md`:**
- Remove or update the Codex note at line 262 (Step E4 note). Since the Codex path no longer exists, E4 may now be dead code. Update the note to remove the Codex reference and clarify E4's status.

**Files:** `~/workspace/database/projects/do/project.md` (outside repo), `CLAUDE.md`, `README.md`, `skills/do/update.md`, `skills/do/references/init-project-setup.md`, `skills/do/references/init-health-check.md`, `skills/do/references/stage-execute.md`

### 10. Run tests and verify

Run `node --test skills/do/scripts/__tests__/` to verify all tests pass after changes.

**Expected outcome:** All tests pass. No remaining references to codex/Codex/CODEX in the codebase except potentially in git history or the backlog task file.

## Concerns

1. **"both" reviewer becomes single-advisor (explicit decision)** -- With codex removed, `invokeBoth` has only one advisor (Gemini). The explicit decision is: **preserve `"both"` as a forward-compatibility alias that delegates to `invokeGemini`**. The `invokeBoth` function will call `invokeGemini` directly, return `advisor: "both"` in the result shape, and include a Phase 12 comment. `"both"` stays in `VALID_REVIEWERS`. CLI help text will list `both` without codex. When Phase 12 lands (claude-as-reviewer), `invokeBoth` will be expanded to invoke both Claude + Gemini. Tests will be updated to verify this single-advisor delegation behavior. **Mitigation:** The approach in Step 3 spells out exactly what to replace `invokeBoth` with. Step 8 adds a test for the new behavior.

2. **`project.md` is outside the repo** -- The file `database/projects/do/project.md` lives at `~/workspace/database/projects/do/project.md`, outside the do git repository. The executor must use the absolute path and understand this file won't appear in `git status` or `git diff` for the repo. **Mitigation:** Step 9 explicitly calls out the full path and notes it is a workspace file, not a repo file.

3. **Stage E4 in stage-execute.md may be dead code** -- The note says E4 is for the Codex inline path. With codex/ deleted, nothing invokes E4 via that path. **Mitigation:** Update the note to indicate E4 is legacy/unused. Do not delete E4 in this task -- that's a separate cleanup task to avoid scope creep.

4. **`.do/config.json` reviewer change** -- The project's own config has `"reviewer": "codex"`. Changing to `"gemini"` is the safest default. No risk since this is a development config. **Mitigation:** Change to `"gemini"`.

5. **Published package consumers** -- Anyone who has `~/.codex/` and relies on do-lang installing there will lose Codex command support on next `npm install -g`. **Mitigation:** This is the intended behavior. Codex support is being deliberately removed.

6. **Test coverage for `invokeBoth` post-simplification** -- The test file currently has no direct test for `invokeBoth`. After simplification to single-advisor delegation, a test should confirm `invokeBoth` returns `advisor: "both"` and produces a valid result. **Mitigation:** Step 8 explicitly includes adding an `invokeBoth` behavior test.

## Execution Log

## Council Review

## Verification Results
