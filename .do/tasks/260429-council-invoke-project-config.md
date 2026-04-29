---
id: 260429-council-invoke-project-config
created: "2026-04-29T00:00:00.000Z"
updated: "2026-04-29T08:39:30.146Z"
description: "council-invoke CLI ignores project reviewer config"
related: []
stage: complete
stages:
  refinement: skipped
  grilling: skipped
  execution: review_pending
  verification: pending
  abandoned: false
council_review_ran:
  plan: skipped
  code: true
fast_path: true
confidence:
  score: 0.95
  factors: null
  context: high
  scope: small
  complexity: low
  familiarity: high
backlog_item: council-invoke-project-config
---

# council-invoke CLI ignores project reviewer config

## Problem Statement

`council-invoke.cjs` CLI defaults `reviewer` to `"random"` and never passes `projectConfigPath` to `invokeCouncil`, so the `council_reviews.reviewer` value in `.do/config.json` is never read. The cascade in `resolveConfig()` only applies when `projectConfigPath` is explicitly passed — but the CLI never passes it. Result: a project configured with `"reviewer": "codex"` still gets Gemini half the time.

**Proposed Fix:** In the CLI section, auto-detect `.do/config.json` from the workspace CWD and pass it as `projectConfigPath` to `invokeCouncil`. A `--project-config-path` override flag should also be accepted for explicit control.

## Delivery Contract

<!--
Populated by entry commands (e.g., /jira:start) or the onboarding flow.
-->

## Clarifications

<!--
No clarifications needed — fix is well-scoped.
-->

## Context Loaded

No internal docs matched task keywords. Fix is self-contained to `skills/do/scripts/council-invoke.cjs` and its test file.

## Approach

1. Add `--project-config-path` flag parsing in the CLI section of `council-invoke.cjs`; auto-detect `.do/config.json` from `process.cwd()` as the default value when the flag is absent
2. Pass the resolved `projectConfigPath` to the `invokeCouncil` call at line 1017
3. Update the `--help` output to document the new `--project-config-path` flag
4. Add/update test coverage in `__tests__/council-invoke.test.cjs` for the CLI config auto-detection path

## Concerns

None identified — `resolveConfig()` already handles `null` gracefully, so adding a path only enables the existing cascade logic.

## Execution Log

### 2026-04-29 10:00 - Execution started

**Status:** In progress
**Steps:** 0/4 complete

### 2026-04-29 10:05 - Step 1: Add --project-config-path flag parsing with auto-detection

**Files:**

- `skills/do/scripts/council-invoke.cjs` - Added `--project-config-path` flag parsing in the CLI section; auto-detects `.do/config.json` from `process.cwd()` as the default value when the flag is absent. Also updated the file-level JSDoc usage comment.

**Decisions:**

- Auto-detection uses `fs.existsSync` before assigning; if `.do/config.json` is absent the value stays `null`, which is already handled gracefully by `resolveConfig`.

**Status:** Complete

### 2026-04-29 10:06 - Step 2: Pass projectConfigPath to invokeCouncil call

**Files:**

- `skills/do/scripts/council-invoke.cjs` - Updated the `invokeCouncil({...})` call at the bottom of the CLI section to include `projectConfigPath` in the options object.

**Decisions:**

- No changes to `invokeCouncil` internals needed; the parameter was already declared and wired through `resolveConfig`.

**Status:** Complete

### 2026-04-29 10:07 - Step 3: Update --help output

**Files:**

- `skills/do/scripts/council-invoke.cjs` - Added `--project-config-path <path>` to the Options block with a description noting auto-detection from cwd. Added a corresponding example. Updated usage line. Aligned all option labels to consistent 30-char column width.

**Status:** Complete

### 2026-04-29 10:10 - Step 4: Add test coverage for CLI config auto-detection

**Files:**

- `skills/do/scripts/__tests__/council-invoke.test.cjs` - Added new `describe("CLI project config auto-detection")` block with 4 tests:
  1. auto-detects `.do/config.json` from cwd when file exists
  2. returns null when `.do/config.json` does not exist
  3. explicit `--project-config-path` flag overrides auto-detected path
  4. `invokeCouncil` accepts `projectConfigPath` and propagates it without error

**Decisions:**

- Test 4 intentionally allows `success: false` since no actual reviewer runtime is available in the test environment; the assertion checks that the result is a well-formed object and any error message is a string (not a crash from missing config).

**Status:** Complete

### 2026-04-29 10:11 - Execution complete

**Status:** Complete
**Summary:**

- Steps completed: 4/4
- Files modified: 2
- Deviations: 0 (0 minor / 0 blocking)

## Council Review

<!--
Populated during code review.
-->

## Verification Results

<!--
Populated during verification.
-->
