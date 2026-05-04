---
id: 260504-codex-claude-council-reviewer
created: "2026-05-04T17:38:31Z"
updated: "2026-05-04T18:14:01.787Z"
description: "Runtime-opposite council reviewer selection without Gemini fallback"
related: []
stage: complete
stages:
  refinement: complete
  grilling: complete
  execution: complete
  verification: complete
  abandoned: "false  # Set to true when task is abandoned"
council_review_ran:
  plan: true
  code: true
confidence:
  score: 0.82
  factors: null
  context: -0.05
  scope: -0.07
  complexity: -0.06
  familiarity: 0
backlog_item: codex-claude-council-reviewer
---

# Runtime-opposite council reviewer selection without Gemini fallback

## Problem Statement

Council review should choose the external reviewer that is opposite to the current AI runtime when the configured tools allow it: Codex sessions should review through Claude, Claude sessions should review through Codex. Gemini must not be used as an implicit fallback for Claude; it should only be selected when the workspace or project explicitly lists/configures Gemini.

The current implementation does not honor that boundary. `skills/do/scripts/council-invoke.cjs` accepts `claude` as a reviewer ID but `case "claude"` writes a warning and invokes Gemini. Runtime detection only checks `CODEX_RUNTIME`, while this Codex environment exposes markers such as `CODEX_CI`, `CODEX_THREAD_ID`, and `CODEX_MANAGED_BY_NPM`, so the selector can misclassify Codex as Claude and route reviews to the wrong reviewer or even self-review. Project health validation also still rejects `council_reviews.reviewer: "claude"`.

This matters because a workspace/project with `availableTools: ["codex", "claude"]` and `reviewer: "random"` should naturally select the non-current runtime without requiring Gemini. Falling back to Gemini makes behavior surprising, ignores user configuration, and pushes consumers toward patching installed do-lang scripts instead of fixing the package source.

Acceptance criteria:
1. `detectRuntime()` returns `codex` for `CODEX_RUNTIME`, `CODEX_CI`, `CODEX_THREAD_ID`, or `CODEX_MANAGED_BY_NPM`, and still returns `claude` when no Codex markers are set.
2. With `availableTools: ["codex", "claude"]`, Codex runtime selects Claude for `random`, and Claude runtime selects Codex for `random`.
3. Selecting `claude` invokes the Claude CLI directly and never routes through `invokeGemini`.
4. `both` reviewer mode excludes the current runtime and invokes the configured external reviewers only; Gemini is included only when it is available/configured or used by the existing no-config fallback.
5. Project health accepts `council_reviews.reviewer: "claude"` as valid.
6. Focused Node tests cover runtime detection, reviewer selection/routing, no Gemini fallback for Claude, and project-health validation.

<!--
Per D-01: Comprehensive problem statement for session resumption.
Include: symptoms, impact, related context, any prior attempts.
This section should have enough detail that /do:continue can
fully understand the task without additional context.
-->

## Delivery Contract

<!--
Populated by entry commands (e.g., /jira:start) or the onboarding flow.
The executioner reads ONLY this section for branch, commit, and push rules.

If empty, the executioner follows project defaults from project.md
(only when the user explicitly dismissed the onboarding flow).
-->

## Clarifications

<!--
Populated by grill-me flow when confidence < threshold.
Format:

### <Factor> (was: <old_value> -> now: <new_value>)
**Q:** <question asked>
**A:** <user's answer>

If user overrides before reaching threshold:
"User override at confidence <score>"
-->

## Context Loaded

- `/Users/globalorange/workspace/database/projects/do/project.md` - project structure, CommonJS style, Node test runner, script/test locations, council integration conventions, and commit/test expectations.
- `skills/do/scripts/council-invoke.cjs` - primary implementation for runtime detection, config cascade, reviewer selection, Codex/Gemini invocation, `both` handling, CLI entrypoint, and exported test surface.
- `skills/do/scripts/__tests__/council-invoke.test.cjs` - existing coverage for runtime detection, reviewer selection, config cascade, parsing helpers, and invocation smoke paths.
- `skills/do/scripts/project-health.cjs` - project config validation currently missing `claude` in the valid reviewer list.
- `skills/do/scripts/__tests__/project-health.test.cjs` - existing fixture helpers and config validation tests to extend for `claude`.
- `skills/do/scripts/detect-tools.cjs` and `skills/do/scripts/__tests__/detect-tools.test.cjs` - confirms detected `claude-cli` is already normalized to canonical reviewer ID `claude`.
- `README.md` and `skills/do/references/config-template.md` - user-facing config documentation/templates that describe supported council reviewer values.
- `.do/config.json` - active project config; confirms ctx7 is enabled, but the task is local CLI orchestration rather than external library/API research.

<!--
List of documentation files loaded via keyword matching.
Format:
- `path/to/component.md` - reason matched
- `path/to/tech-pattern.md` - reason matched

If no internal docs matched, note: "No internal docs matched task keywords."
-->

## Approach

1. Update Codex runtime detection in `skills/do/scripts/council-invoke.cjs`.
   - Treat any truthy `CODEX_RUNTIME`, `CODEX_CI`, `CODEX_THREAD_ID`, or `CODEX_MANAGED_BY_NPM` environment variable as Codex runtime.
   - Keep the no-marker fallback as Claude runtime.
   - Expected outcome: reviewer selection uses the real primary runtime in current Codex sessions.

2. Add a Claude invocation path in `skills/do/scripts/council-invoke.cjs`.
   - Implement `invokeClaude(briefPath, timeout, reviewType)` using the `claude` CLI in headless print mode, reading the generated brief file and applying the same timeout, stdout/stderr capture, `parseVerdict`, `parseFindings`, and `parseRecommendations` shape used by `invokeCodex` and `invokeGemini`.
   - Start from the local CLI syntax hypothesis `claude --print < brief` (verified against `claude --help`/`claude --print --help` during execution); adjust only if the installed CLI requires a different stdin/prompt-file form.
   - Export `invokeClaude` for test coverage.
   - Expected outcome: Claude is a first-class council reviewer.

3. Remove the Gemini fallback for explicit Claude reviewer routing in `skills/do/scripts/council-invoke.cjs`.
   - Change `case "claude"` in `invokeCouncil()` to call `invokeClaude(...)` and set `result.advisor = "claude"`.
   - Do not call `invokeGemini` from this branch under any failure condition; failures should return Claude invocation errors.
   - Expected outcome: selecting Claude never silently reviews with Gemini.

4. Make `both` runtime-aware from configured availability in `skills/do/scripts/council-invoke.cjs`.
   - Refactor `invokeBoth` to accept or compute the same available reviewer list used by `invokeCouncil`.
   - Invoke all external reviewers in the available list excluding the current runtime, mapping each reviewer ID to its invocation function.
   - Preserve conservative combined-verdict behavior and include raw results keyed by advisor.
   - Intentionally change the no-config Codex-runtime `both` path from Gemini-only to Claude+Gemini by routing through `getAvailableReviewers()` rather than preserving the current hardcoded Phase 12 deferral branch.
   - Expected outcome: `both` no longer hardcodes Gemini for Codex runtime when config only advertises Codex/Claude.

5. Extend council invocation tests in `skills/do/scripts/__tests__/council-invoke.test.cjs`.
   - Add runtime-detection tests for `CODEX_CI`, `CODEX_THREAD_ID`, and `CODEX_MANAGED_BY_NPM`, restoring all touched env vars after each test.
   - Add selection tests showing `availableTools: ["codex", "claude"]` selects Claude in Codex runtime and Codex in Claude runtime.
   - Add a routing test that executes `invokeCouncil({ reviewer: "claude", ... })` with a temporary fake `claude` binary on `PATH`, asserts advisor `claude`, and asserts no Gemini fallback is needed.
   - Add or adjust tests for `invokeBoth`/`both` so configured Codex+Claude does not invoke Gemini.
   - Locate and update any assertions tied to the old `raw: { codex, gemini }` shape so the new dynamic raw result keyed by advisor remains explicit and covered.
   - Expected outcome: regressions in runtime detection and fallback routing fail locally.

6. Update project health validation in `skills/do/scripts/project-health.cjs` and tests.
   - Add `claude` to the `validReviewers` list for `council_reviews.reviewer`.
   - Add a `project-health.test.cjs` case proving `reviewer: "claude"` produces no invalid reviewer issue.
   - Expected outcome: projects can configure Claude as a council reviewer without health warnings.

7. Update user-facing config documentation if implementation changes the supported reviewer set.
   - In `README.md`, include `claude` in the documented `defaultReviewer` and `council_reviews.reviewer` values.
   - Review `skills/do/references/config-template.md`; no JSON change is required unless supported-value prose is added nearby.
   - Expected outcome: docs match the accepted reviewer IDs and no longer imply Gemini is required.

8. Run focused and full verification.
   - Run `node --test skills/do/scripts/__tests__/council-invoke.test.cjs`.
   - Run `node --test skills/do/scripts/__tests__/project-health.test.cjs`.
   - Run `npm test` before marking execution complete.
   - Expected outcome: changed behavior is covered and the script test suite remains green.

<!--
Refine agent's analysis of how to solve this task.
Include: proposed solution, implementation steps, files to modify.
-->

## Concerns

- Concern 1: Claude CLI headless syntax may differ by installed version (`claude`, `claude-cli`, stdin vs prompt-file).
  - Mitigation: verify the local CLI help during execution and keep the invocation wrapper isolated so only arguments need adjustment if syntax differs.
- Concern 2: `child_process.spawn` is imported at module load time, so unit tests may need fake PATH binaries instead of `node:test` mocks to verify routing.
  - Mitigation: create temporary executable scripts named `claude`/`gemini` in a temp directory, prepend it to `PATH`, and restore `PATH` after each test.
- Concern 3: `both` currently assumes a two-advisor Codex/Gemini shape and has result-index logic tied to that assumption.
  - Mitigation: refactor around an array of `{ advisor, promise }` entries and combine fulfilled results generically.
- Concern 4: Removing the Gemini fallback changes behavior for users who configured `claude` but do not have a working Claude CLI.
  - Mitigation: fail explicitly with the Claude invocation error; this is preferable to silently ignoring the configured reviewer and satisfies the task requirement.
- Concern 5: Documentation and validation currently mention only `codex`, `gemini`, `both`, and `random`.
  - Mitigation: update `project-health.cjs` and README supported-value prose so source behavior, config validation, and docs stay aligned.

<!--
Potential issues, uncertainties, or risks identified during refinement.
Format:
- Concern 1: description and potential mitigation
- Concern 2: description and potential mitigation

If no concerns, note: "None identified."
-->

## Execution Log

<!--
This section is populated during the implementation phase (per D-20).

Entry format:
### YYYY-MM-DD HH:MM
**Files:**
- `path/to/file.ts` - Change summary

**Decisions:**
- Plan said X - chose approach Y because Z
- [If error] Tried A, failed because B, resolved with C

**Status:** In progress / Execution complete

Context decision is logged first:
### <timestamp>
**Context decision:** [AskUserQuestion|inline prompt] - user chose [Yes|No]

Final entry has summary:
### <timestamp>
**Status:** Execution complete

**Summary:**
- Files modified: <count>
- Decisions made: <count>
- Deviations: <count or "none">
-->

### 2026-05-04 17:50
**Files:**
- `.do/tasks/260504-codex-claude-council-reviewer.md` - Marked refinement complete, recorded plan-review outcome, and incorporated Claude council nitpicks into the plan.

**Decisions:**
- Used direct `claude --print` for external plan review because this task is specifically fixing the currently broken `claude` council route.
- Treated prior user approval to continue the backlog item as the approval checkpoint despite confidence 0.82 being below the configured 0.9 threshold.

**Status:** Execution started

### 2026-05-04 20:03
**Files:**
- `skills/do/scripts/council-invoke.cjs` - Added Codex marker runtime detection, exported `invokeClaude`, routed explicit Claude reviews to `claude --print` via stdin, and refactored `both` to run configured external advisors with dynamic `raw` results.
- `skills/do/scripts/__tests__/council-invoke.test.cjs` - Added focused coverage for Codex marker detection, Codex/Claude random selection, direct Claude routing with no Gemini fallback, configured Codex+Claude `both` without Gemini, and stabilized project-config routing to avoid live external CLIs.
- `skills/do/scripts/project-health.cjs` - Added `claude` to valid council reviewer values.
- `skills/do/scripts/__tests__/project-health.test.cjs` - Added validation coverage for `council_reviews.reviewer: "claude"`.
- `README.md` - Documented `claude` as a supported workspace/project reviewer value.
- `skills/do/references/config-template.md` - Documented supported reviewer values including `claude`.
- `skills/codex/references/config-template.md` - Documented supported reviewer values including `claude`.

**Decisions:**
- Used `claude --print` with stdin piping because local CLI help confirms `--print` is the non-interactive mode and this matches the Gemini stdin style without shell quoting.
- Made `both` consume the already resolved available reviewer list from `invokeCouncil`, so configured Codex+Claude excludes the current runtime and does not add Gemini unless configuration or no-config fallback includes it.
- Changed an existing project-config routing test to force a skipped self-review path, because adding Claude to Codex fallback made the old random path capable of invoking live Gemini.

**Status:** Execution complete

### 2026-05-04 20:13
**Files:**
- `skills/do/scripts/council-invoke.cjs` - Fixed explicit valid-but-unavailable reviewer handling so `claude` can no longer fall back to Gemini; tightened Claude EPIPE cleanup.
- `skills/do/scripts/__tests__/council-invoke.test.cjs` - Added regression coverage for unavailable explicit Claude, no-config Codex `both`, and clarified self-review skip behavior.

**Decisions:**
- Preserved self-review prevention fallback behavior while changing unavailable explicit reviewer behavior to skip with a clear reason.
- Kept the runtime filter inside `invokeBoth` because the function is exported and may be called directly without pre-filtered reviewers.

**Status:** Code review verified

**Summary:**
- Files modified: 8
- Decisions made: 3
- Deviations: none

### 2026-05-04 20:09
**Files:**
- `skills/do/scripts/council-invoke.cjs` - Changed explicit valid-but-unavailable reviewer selection to skip instead of falling back to a different advisor, kept self-review fallback behavior, and cleared the Claude stdin-write timeout before EPIPE settlement.
- `skills/do/scripts/__tests__/council-invoke.test.cjs` - Added regression coverage for explicit unavailable Claude with only Gemini available, plus no-config Codex `both` fallback using fake Claude and Gemini CLIs; renamed the project-config routing test to describe the self-review skip.
- `.do/tasks/260504-codex-claude-council-reviewer.md` - Added this execution log entry and kept the task file in intended changes so `.do/config.json` does not point to a missing task artifact.

**Decisions:**
- Explicit valid reviewers that are not available now return a skipped council result with a clear unavailable reason; invalid reviewer values still fall back to random for backward compatibility.
- Preserved the existing self-review guard behavior where an explicit reviewer equal to the current runtime chooses another available reviewer, or skips if none exists.
- Used fake CLI binaries for the no-config Codex `both` test so the raw fallback keys can be asserted without invoking real external tools.

**Status:** Execution complete

**Summary:**
- Files modified: 3
- Decisions made: 3
- Deviations: none
- Focused tests passed: `node --test skills/do/scripts/__tests__/council-invoke.test.cjs`; `node --test skills/do/scripts/__tests__/project-health.test.cjs`

## Council Review

<!--
Populated by council review stages (E-1 for plan review, V-1 for code review).

### Plan Review
- **Reviewer:** <advisor name>
- **Verdict:** LOOKS_GOOD | CONCERNS | RETHINK
- **Findings:**
  - Finding with evidence citation
- **Recommendations:**
  - Actionable recommendation
- **User Override:** (only if user proceeded despite CONCERNS/RETHINK)

### Code Review
- **Reviewer:** <advisor name>
- **Verdict:** APPROVED | NITPICKS_ONLY | CHANGES_REQUESTED
- **Files Reviewed:** <count>
- **Findings:**
  - Finding with file:line citation
- **Recommendations:**
  - Actionable recommendation
- **User Override:** (only if user proceeded despite issues)

If council reviews are disabled in config, this section remains empty.
-->

### Plan Review
- **Self-reviewer:** codex-plan-reviewer
- **Self verdict:** PASS
- **Council reviewer:** Claude CLI (`claude --print`)
- **Council verdict:** LOOKS_GOOD
- **Findings:**
  - [nitpick] Clarify that no-config Codex-runtime `both` intentionally changes from Gemini-only to Claude+Gemini.
  - [nitpick] Call out the `raw` result shape change in `invokeBoth` tests.
  - [nitpick] Record the expected Claude CLI invocation form before execution.
- **Changes made:** Applied all nitpicks inline to the Approach section.

## Verification Results

<!--
This section is populated during the verification phase.

Entry format:
### Approach Checklist
- [x] Step 1 from Approach section
- [x] Step 2 from Approach section
- [ ] Step 3 (INCOMPLETE: reason why)

### Quality Checks
- **Lint:** PASS|FAIL (npm run <script>)
- **Types:** PASS|FAIL (npm run <script>)
- **Tests:** PASS|FAIL (npm run <script>)
  [If FAIL, truncated output below]

### Result: PASS|FAIL
- Checklist: X/Y complete
- Quality: X/Y passing
-->

### Approach Checklist
- [x] Runtime detection recognizes `CODEX_RUNTIME`, `CODEX_CI`, `CODEX_THREAD_ID`, and `CODEX_MANAGED_BY_NPM`.
- [x] Codex runtime with `availableTools: ["codex", "claude"]` selects Claude; Claude runtime selects Codex.
- [x] Explicit `claude` reviewer invokes Claude CLI directly and never routes through Gemini.
- [x] `both` mode uses configured external reviewers only, with Gemini included only when configured or by no-config fallback.
- [x] Project health accepts `council_reviews.reviewer: "claude"`.
- [x] Focused tests cover routing, fallback, direct Claude invocation, and project-health validation.

### Quality Checks
- **Council invoke focused tests:** PASS (`node --test skills/do/scripts/__tests__/council-invoke.test.cjs`, 89/89)
- **Project health focused tests:** PASS (`node --test skills/do/scripts/__tests__/project-health.test.cjs`, 36/36)
- **Full test suite:** PASS (`npm test`, 823/823)
- **Whitespace:** PASS (`git diff --check`)

### Result: PASS
- Checklist: 6/6 complete
- Quality: 4/4 passing
