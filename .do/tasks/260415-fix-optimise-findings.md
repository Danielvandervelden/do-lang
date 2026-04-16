---
id: 260415-fix-optimise-findings
created: 2026-04-15T00:00:00Z
updated: 2026-04-15T17:00:00Z
description: "Fix all issues surfaced by /do:optimise in agents/do-planner.md and skills/do/scripts/council-invoke.cjs"

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
  score: 0.82
  factors:
    context: -0.03
    scope: -0.05
    complexity: -0.05
    familiarity: -0.05
---

# Fix /do:optimise findings

## Problem Statement

The `/do:optimise` audit surfaced 17 issues across two files: `agents/do-planner.md` (7 issues) and `skills/do/scripts/council-invoke.cjs` (10 issues). These range from incorrect tool usage (ctx7 invoked via WebSearch instead of Bash), potential null-pointer dereferences, security concerns (stdin inheritance, shell-out to Python), hardcoded paths/versions, and missing agent metadata.

**Why it matters:** The planner agent bugs mean ctx7 documentation lookups silently fail or never fire (wrong tool, wrong boolean check). The council-invoke.cjs bugs risk runtime crashes (null dereference in invokeBoth), zombie processes (setTimeout/proc.kill without proper cleanup), and brittleness (hardcoded plugin version, process.env.HOME on non-Unix).

**Acceptance criteria:**
1. `agents/do-planner.md` -- all 7 issues resolved (WebSearch removed, ctx7 uses Bash, boolean check uses `!== false`, confidence writeback instruction added, permissionMode added, ctx7 budget cap defined, description is trigger-oriented)
2. `agents/do-debugger.md` -- same ctx7 boolean check fixed (line 107)
3. `skills/do/scripts/council-invoke.cjs` -- all 10 issues resolved
4. No functional regressions -- existing exports, CLI interface, and verdict parsing unchanged

## Clarifications

None needed. All issues are well-specified by the optimise audit with line numbers and clear descriptions.

## Context Loaded

- `database/projects/do/project.md` -- project structure, tech stack, agent roles, conventions
- `agents/do-planner.md` -- primary target file (7 issues)
- `agents/do-debugger.md` -- secondary target (same ctx7 boolean bug at line 107)
- `skills/do/scripts/council-invoke.cjs` -- primary target file (10 issues)
- `agents/do-executioner.md` -- frontmatter pattern reference (has permissionMode: acceptEdits)
- `agents/do-griller.md` -- confidence writeback pattern reference (line 101-103)
- `agents/do-verifier.md` -- frontmatter update pattern reference
- `skills/do/optimise.md` -- canonical ctx7 check: `c.web_search?.context7 !== false` (line 55)
- All agent descriptions -- compared for "trigger-oriented" style

## Approach

### Part A: agents/do-planner.md

**1. Remove WebSearch from tools list (line 4)**
- File: `agents/do-planner.md`
- Change `tools: Read, Grep, Glob, Write, WebSearch, Bash` to `tools: Read, Grep, Glob, Write, Bash`
- Expected: planner no longer lists a tool it should not use

**2. Add permissionMode frontmatter key (line 7)**
- File: `agents/do-planner.md`
- Add `permissionMode: acceptEdits` after `color: cyan` in frontmatter
- Pattern: matches do-executioner.md and do-debugger.md frontmatter

**3. Make description trigger-oriented (line 3)**
- File: `agents/do-planner.md`
- Current: `Creates task plans with context loading, confidence scoring, and structured approach. Spawned by /do:task orchestrator.`
- Change to: `Spawned by /do:task orchestrator. Loads context, calculates confidence, and writes a structured plan to the task file.`
- Rationale: other agents lead with their trigger/spawn context (e.g., do-verifier: "Verifies executed tasks...Spawned after do-code-reviewer completes")

**4. Fix ctx7 boolean check (line 40)**
- File: `agents/do-planner.md`
- Change `c.web_search?.context7 === true` to `c.web_search?.context7 !== false`
- Matches canonical check in `skills/do/optimise.md` line 55 (enabled-by-default semantics)

**5. Fix ctx7 invocation -- use Bash instead of WebSearch (line 45)**
- File: `agents/do-planner.md`
- Change step 2 line from `Use WebSearch with ctx7 pattern: ...` to `Use Bash to run: ...`
- ctx7 is a CLI tool (npx), not a web search query

**6. Add ctx7 budget cap (Step 2 section)**
- File: `agents/do-planner.md`
- Add instruction after the ctx7 steps: `Limit: maximum 3 ctx7 commands per task (1 library lookup + up to 2 doc fetches).`
- Prevents unbounded ctx7 usage

**7. Add confidence writeback instruction (after Step 4)**
- File: `agents/do-planner.md`
- After the confidence calculation table (around line 73), add a step: "Write the calculated confidence score and factor deductions back to the task file's YAML frontmatter under `confidence.score` and `confidence.factors.*`"
- Pattern: matches do-griller.md line 101 ("Update the confidence score in frontmatter")

### Part B: agents/do-debugger.md (related fix)

**8. Fix ctx7 boolean check (line 107)**
- File: `agents/do-debugger.md`
- Same change as step 4: `=== true` to `!== false`

### Part C: skills/do/scripts/council-invoke.cjs

**9. Replace process.env.HOME with os.homedir() (line 27)**
- File: `skills/do/scripts/council-invoke.cjs`
- Change `process.env.HOME` to `os.homedir()` on line 27
- `os` is already imported on line 23; `os.homedir()` is cross-platform

**10. Remove hardcoded version from PLUGIN_ROOT (lines 26-29)**
- File: `skills/do/scripts/council-invoke.cjs`
- Replace the hardcoded `"1.0.1"` with a dynamic version lookup using a semver-safe numeric comparator:
  ```js
  const versionDir = path.join(os.homedir(), '.claude/plugins/cache/openai-codex/codex/');
  let codexVersion = '1.0.1'; // fallback
  try {
    const versions = fs.readdirSync(versionDir)
      .filter(d => /^\d+\.\d+\.\d+$/.test(d))
      .sort((a, b) => {
        const pa = a.split('.').map(Number);
        const pb = b.split('.').map(Number);
        for (let i = 0; i < 3; i++) { if (pa[i] !== pb[i]) return pa[i] - pb[i]; }
        return 0;
      });
    if (versions.length) codexVersion = versions[versions.length - 1];
  } catch { /* directory doesn't exist, use fallback */ }
  const PLUGIN_ROOT = path.join(versionDir, codexVersion);
  ```
- The `.sort()` uses a numeric semver comparator that splits on `.` and compares each segment as an integer, so `1.0.10` correctly sorts after `1.0.9` (unlike plain lexicographic sort)
- Wrap in try/catch so it falls back to `"1.0.1"` if the directory doesn't exist or is empty
- Note: `PLUGIN_ROOT` is exported in `module.exports` -- the variable name and export must stay the same

**11. Replace Python random selection with pure JS (line 204)**
- File: `skills/do/scripts/council-invoke.cjs`
- Remove the Python shell-out in `selectRandomReviewer()` entirely
- The JS fallback (`Math.floor(Math.random() * available.length)`) is already present and sufficient
- Eliminates dependency on Python being installed, removes shell injection surface

**12. Add @returns JSDoc on resolveConfig (line ~93)**
- File: `skills/do/scripts/council-invoke.cjs`
- Add `@returns {Object} Resolved config with availableTools, defaultReviewer, council_reviews` to the existing JSDoc block

**13. Fix stdin inheritance in invokeCodex (line 391)**
- File: `skills/do/scripts/council-invoke.cjs`
- Change `stdio: ["inherit", "pipe", "pipe"]` to `stdio: ["ignore", "pipe", "pipe"]` in the `invokeCodex` spawn call
- Codex companion should not read from the parent terminal's stdin

**14. Document `--approval-mode 'plan'` as intentional in invokeGemini (line 470)**
- File: `skills/do/scripts/council-invoke.cjs`
- This is a comment-only change, no functional edit
- Add an inline comment above or beside the `"plan"` argument on line 470 explaining this is intentional: `// "plan" mode is intentional for all review types -- Gemini should analyze/propose, never auto-execute`
- The `--approval-mode "plan"` value is correct for council reviews because Gemini should only read and report, never modify files, regardless of whether the review type is "plan" or "code"

**15. Fix null-pointer dereference in invokeBoth (lines 635, 637, 642)**
- File: `skills/do/scripts/council-invoke.cjs`
- When `codex` is null (Gemini-only runtime path, line 599), lines 635, 637, and 642 access `codex.findings`, `codex.recommendations`, and `codex.success` without null checks
- `codex` is set to `null` at lines 592-599 when Codex is not in the advisor list. Accessing `null.success` on line 642 throws `TypeError: Cannot read properties of null` before the `||` operator can short-circuit -- the left operand must be fully evaluated first
- Apply optional chaining to all three lines:
  - Line 635: `[...(codex?.findings || []), ...(gemini.findings || [])]`
  - Line 637: `[...(codex?.recommendations || []), ...(gemini.recommendations || [])]`
  - Line 642: `success: codex?.success || gemini.success`

**16. Log claude-to-gemini fallback to stderr (line 757-762)**
- File: `skills/do/scripts/council-invoke.cjs`
- In the `case "claude":` branch (lines 758-762), the code silently falls back to Gemini
- Add a `process.stderr.write` call to log the fallback: `process.stderr.write('council: claude reviewer not available, falling back to gemini\n');`
- Do NOT change the `result.advisor = "gemini"` value -- this preserves the observable contract that `do-council-reviewer.md` (lines 57-69) and the CLI output (lines 831-833) depend on
- The stderr log gives operators visibility into the fallback without breaking consumers that parse the JSON output on stdout

**17. Add getArg validation for flag-like next tokens (around line 812)**
- File: `skills/do/scripts/council-invoke.cjs`
- Current `getArg` returns `args[idx + 1]` without checking if it starts with `--`
- Add check: `return idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith('--') ? args[idx + 1] : null;`

**18. Replace setTimeout/proc.kill with AbortController (invokeCodex + runGeminiOnce)**
- File: `skills/do/scripts/council-invoke.cjs`
- Current pattern: `setTimeout(() => { proc.kill(); ... }, timeout)` risks zombie processes if the timer fires but kill doesn't fully terminate the process tree
- Replace with `AbortController` + `signal` option on `spawn()`:
  ```js
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeout);
  const proc = spawn(..., { signal: ac.signal, ... });
  ```
- `AbortController` with spawn `signal` is available in Node 16+ and handles cleanup more reliably
- Apply to both `invokeCodex` (line ~391) and `runGeminiOnce` (line ~462)

### Part D: Regression Verification

**19. Verify no functional regressions**
- After all changes are applied, run these smoke tests:
  1. `node skills/do/scripts/council-invoke.cjs --help` -- should print usage text and exit 0
  2. `node skills/do/scripts/council-invoke.cjs` (no args) -- should fail gracefully with JSON error on stderr and exit 1
  3. `node -e "const m = require('./skills/do/scripts/council-invoke.cjs'); console.log(Object.keys(m).join(', '))"` -- verify exported function names are unchanged: `detectRuntime, selectReviewer, getAvailableReviewers, selectRandomReviewer, parseVerdict, parseFindings, parseRecommendations, invokeCodex, invokeGemini, invokeBoth, invokeCouncil, findWorkspaceConfig, loadWorkspaceConfig, resolveConfig, PLUGIN_ROOT, CODEX_COMPANION, DEFAULT_TIMEOUT, GEMINI_MAX_RETRIES, VALID_REVIEWERS, PLAN_VERDICTS, CODE_VERDICTS, ALL_VERDICTS`
  4. `node -e "const m = require('./skills/do/scripts/council-invoke.cjs'); console.log(typeof m.PLUGIN_ROOT)"` -- verify PLUGIN_ROOT is still a string (not undefined from failed version detection)
  5. Verify `invokeBoth` handles null codex path by reading the code to confirm `codex?.findings`, `codex?.recommendations`, and `codex?.success` on lines 635, 637, and 642
  6. Verify verdict string constants are unchanged (grep for the LOOKS_GOOD/APPROVED/CONCERNS/etc arrays)

## Concerns

1. **PLUGIN_ROOT dynamic version detection (step 10):** If the codex plugin directory structure changes, the dynamic lookup could break. Mitigation: try/catch with hardcoded `"1.0.1"` fallback. The `PLUGIN_ROOT` constant is exported -- the value changes but the type (string) stays the same. The sort uses a numeric semver comparator to correctly handle multi-digit version segments (e.g., `1.0.10` > `1.0.9`).

2. **AbortController spawn signal compatibility (step 18):** The `signal` option on `child_process.spawn` requires Node.js 16+. The project targets Node 18+ per project.md, so this is safe.

3. **Scope across 3 files:** Changes span agents/do-planner.md, agents/do-debugger.md, and skills/do/scripts/council-invoke.cjs. All changes are independent of each other, reducing cross-file risk. Mitigation: each fix is atomic and testable in isolation.

4. **council-invoke.cjs exports unchanged:** Steps 9-18 must not change the module.exports surface or the CLI argument interface. Mitigation: step 19 explicitly verifies exported names (including VALID_REVIEWERS, PLAN_VERDICTS, CODE_VERDICTS, ALL_VERDICTS) and PLUGIN_ROOT type.

## Review Iterations

### Iteration 1
- **Self-review:** CONCERNS
- **Council (codex):** CONCERNS
- **Combined verdict:** ITERATE

**Self-review findings:**
1. Step 14 (Gemini `--approval-mode`) is self-contradicting -- heading says "fix" but body concludes "keep 'plan' with a comment". Rewrite as "Document `--approval-mode 'plan'` as intentional" -- comment-only change, no functional edit.
2. Step 15 (null-pointer fix) -- optional chaining only needed on lines 635 (`codex.findings`) and 637 (`codex.recommendations`). Line 642 (`codex.success`) is already null-safe via `||` short-circuit semantics -- do NOT apply optional chaining there.
3. Step 10 (PLUGIN_ROOT version detection) -- "scan directory" is too vague. Concrete algorithm needed: `fs.readdirSync(versionDir).filter(d => /^\d+\.\d+\.\d+$/.test(d)).sort().pop()` with hardcoded fallback.
4. Step 14 title conflicts with body -- causes executor confusion about whether to change `"plan"` to a dynamic value.

**Council findings:**
1. Step 14 -- behavior decision, not a bug fix. Keep `--approval-mode "plan"` for all review types (it's correct for read-only council review), document explicitly.
2. Step 16 (advisor field change) -- risks observable contract change. `advisor` value is parsed by `do-council-reviewer.md` (lines 57-69) and printed directly to CLI (lines 831-833). Changing to `"gemini (claude fallback)"` is a contract change. Instead: log fallback to stderr only, keep `advisor: "gemini"` value unchanged.
3. Missing explicit regression verification step in Approach -- add smoke test for CLI (--help, required-arg failure), invokeBoth null path, and exported names/verdict parsing.

**Changes made in revision:**
1. Step 14: Rewrote heading to "Document `--approval-mode 'plan'` as intentional in invokeGemini" and body to describe a comment-only change. Removed all language about changing the value dynamically.
2. Step 15: Scoped optional chaining to lines 635 and 637 only. Explicitly stated NOT to apply to line 642. Added concern #3 noting line 642 is technically unsafe but excluded per review guidance.
3. Step 10: Replaced vague "scan the directory" with concrete algorithm using `fs.readdirSync`, semver regex filter, `.sort()`, and `versions[versions.length - 1]` with try/catch and `"1.0.1"` fallback.
4. Step 16: Changed from modifying `advisor` value to adding `process.stderr.write` logging. Explicitly stated NOT to change `result.advisor = "gemini"`. Explained why (observable contract with do-council-reviewer.md and CLI output).
5. Added Step 19: Regression verification with 6 concrete smoke tests covering --help, missing args, exported names, PLUGIN_ROOT type, optional chaining verification, and verdict string constants.

### Iteration 2
- **Self-review:** PASS
- **Council (codex):** CONCERNS
- **Combined verdict:** ITERATE

**Council findings:**
1. Step 15 (null-pointer fix) -- Line 642 `codex.success || gemini.success` IS a real null dereference. `codex` is confirmed set to `null` at line 592-599, and `null.success` throws before `||` can short-circuit. Step 15 must also fix line 642 with `codex?.success`.
2. Step 10 (PLUGIN_ROOT version detection) -- Plain `.sort()` is lexicographic, not semver-safe. `1.0.10` sorts before `1.0.9`. Replace with numeric semver comparison (split on `.`, compare each segment as integer).
3. Step 19 (regression verification) -- Exported surface is incomplete. The module also exports `VALID_REVIEWERS`, `PLAN_VERDICTS`, `CODE_VERDICTS`, `ALL_VERDICTS` (lines 842-871). The smoke test must verify these too.

**Changes made:** Revised Step 15 to include line 642 (`codex?.success`), corrected the explanation of why `null.success` throws before `||` short-circuits, and removed the old Concern #3 that incorrectly deferred this fix. Revised Step 10 to use a numeric semver comparator (`split('.').map(Number)` with segment-by-segment comparison) instead of plain lexicographic `.sort()`. Revised Step 19 smoke test #3 to include all 21 exports: added `VALID_REVIEWERS`, `PLAN_VERDICTS`, `CODE_VERDICTS`, `ALL_VERDICTS` to the expected list, and updated smoke test #5 to verify `codex?.success` on line 642 alongside lines 635/637. Updated Concern #1 to mention the semver-safe sort. Updated Concern #4 to mention the additional constant exports.

### Iteration 3
- **Self-review:** PASS
- **Council (codex):** CONCERNS
- **Combined verdict:** ITERATE → MAX_ITERATIONS (3/3), user chose to proceed

**Council findings:**
1. Concern 2 rationale incorrect -- plan cites "Node 18+" but `package.json` engine floor is `>=16.7.0`. AbortController is still safe (added in Node 15.4) but rationale needs correction.
2. Step 18 underspecified -- AbortController swap must preserve `{ success: false, error: "Timeout", output: "" }` result shape, clear timers on all exit paths, and guard against double-resolution after abort.
3. Coverage otherwise strong -- all other fixes correct and well-specified.

**Changes made:** N/A — MAX_ITERATIONS reached, user chose to proceed. Executor to address concerns inline during implementation.

## Execution Log

### 2026-04-15 16:00 - Execution started
**Status:** In progress
**Steps:** 0/19 complete

### 2026-04-15 16:10 - Steps 1-7: agents/do-planner.md
**Files:**
- `agents/do-planner.md` - Removed WebSearch from tools list; added permissionMode: acceptEdits; updated description to trigger-oriented style; fixed ctx7 boolean check to `!== false`; changed ctx7 invocation from WebSearch to Bash; added ctx7 3-command budget cap; added confidence writeback instruction to Step 4

**Decisions:**
- Steps 1-7 applied in order with no deviations; file verified by reading it back

**Status:** Complete

### 2026-04-15 16:11 - Step 8: agents/do-debugger.md
**Files:**
- `agents/do-debugger.md` - Fixed ctx7 boolean check `=== true` → `!== false` (line 107)

**Status:** Complete

### 2026-04-15 16:12 - Steps 9-10: PLUGIN_ROOT dynamic version detection
**Files:**
- `skills/do/scripts/council-invoke.cjs` - Replaced `process.env.HOME` with `os.homedir()`, replaced hardcoded `1.0.1` version with dynamic semver-safe directory scan with `"1.0.1"` fallback in try/catch

**Status:** Complete

### 2026-04-15 16:13 - Step 11: Remove Python random selection
**Files:**
- `skills/do/scripts/council-invoke.cjs` - Removed Python shell-out (`python3 -c "..."`) from `selectRandomReviewer()`, kept pure JS `Math.random()` path; removed `execSync` from imports (now unused)

**Status:** Complete

### 2026-04-15 16:14 - Step 12: Add @returns JSDoc on resolveConfig
**Files:**
- `skills/do/scripts/council-invoke.cjs` - Updated existing `@returns {Object} Resolved config` to `@returns {Object} Resolved config with availableTools, defaultReviewer, council_reviews`

**Decisions:**
- `@returns` line already existed, updated it rather than adding a duplicate

**Status:** Complete

### 2026-04-15 16:15 - Step 13: Fix stdin inheritance in invokeCodex
**Files:**
- `skills/do/scripts/council-invoke.cjs` - Changed `stdio: ["inherit", "pipe", "pipe"]` to `stdio: ["ignore", "pipe", "pipe"]`

**Status:** Complete

### 2026-04-15 16:16 - Step 14: Document --approval-mode 'plan' as intentional
**Files:**
- `skills/do/scripts/council-invoke.cjs` - Added inline comment above `"plan"` in `runGeminiOnce` spawn args explaining intentionality

**Status:** Complete

### 2026-04-15 16:17 - Step 15: Fix null-pointer dereference in invokeBoth
**Files:**
- `skills/do/scripts/council-invoke.cjs` - Applied optional chaining to `codex?.findings`, `codex?.recommendations`, and `codex?.success` on the three affected lines (635, 637, 642 in original)

**Status:** Complete

### 2026-04-15 16:18 - Step 16: Log claude-to-gemini fallback to stderr
**Files:**
- `skills/do/scripts/council-invoke.cjs` - Added `process.stderr.write(...)` in `case "claude":` branch; `result.advisor = "gemini"` unchanged

**Status:** Complete

### 2026-04-15 16:19 - Step 17: Add getArg validation for flag-like next tokens
**Files:**
- `skills/do/scripts/council-invoke.cjs` - Updated `getArg` to check `!args[idx + 1].startsWith("--")` before returning the next arg

**Status:** Complete

### 2026-04-15 16:20 - Step 18: Replace setTimeout/proc.kill with AbortController
**Files:**
- `skills/do/scripts/council-invoke.cjs` - Both `invokeCodex` and `runGeminiOnce` converted to use `AbortController` + `signal` on spawn; added `settled`/`settle()` guard against double-resolution; `clearTimeout` on all non-timeout exit paths; `AbortError` suppressed in `proc.on("error")` since timeout already settled

**Decisions:**
- Per plan note: preserved `{ success: false, error: "Timeout", output: "" }` shape; timers cleared on close and error paths; AbortError from the signal is expected and suppressed to avoid double-settle

**Status:** Complete

### 2026-04-15 16:21 - Step 19: Regression verification
**Smoke tests run:**
1. `--help` exits 0 with usage text -- PASS
2. No args outputs JSON error on stderr, exits 1 -- PASS
3. Exported names match expected 21 exports (detectRuntime, selectReviewer, getAvailableReviewers, selectRandomReviewer, parseVerdict, parseFindings, parseRecommendations, invokeCodex, invokeGemini, invokeBoth, invokeCouncil, findWorkspaceConfig, loadWorkspaceConfig, resolveConfig, PLUGIN_ROOT, CODEX_COMPANION, DEFAULT_TIMEOUT, GEMINI_MAX_RETRIES, VALID_REVIEWERS, PLAN_VERDICTS, CODE_VERDICTS, ALL_VERDICTS) -- PASS
4. `typeof PLUGIN_ROOT` is `"string"` -- PASS
5. `codex?.findings`, `codex?.recommendations`, `codex?.success` verified in source -- PASS
6. PLAN_VERDICTS/CODE_VERDICTS/ALL_VERDICTS/VALID_REVIEWERS constants unchanged -- PASS

**Status:** Complete

### 2026-04-15 16:22 - Execution complete
**Status:** Complete
**Summary:**
- Steps completed: 19/19
- Files modified: 3 (agents/do-planner.md, agents/do-debugger.md, skills/do/scripts/council-invoke.cjs)
- Deviations: 1 minor (resolveConfig already had @returns, updated it; execSync import removed as unused after step 11)
- Blocking deviations: 0

## Council Review

**Verdict:** VERIFIED (NITPICKS_ONLY + NITPICKS_ONLY)

**Nitpick (both reviewers, non-blocking):**
- `skills/do/scripts/council-invoke.cjs:207` — JSDoc still reads "Select a random reviewer using Python (per D-41)" after step 11 removed the Python shell-out. Should read "Select a random reviewer from available options." (D-41 reference dropped). Fix during verification or as follow-up.

## Verification Results

### Approach Checklist
- [x] 1. Remove WebSearch from tools list (agents/do-planner.md line 4)
- [x] 2. Add permissionMode: acceptEdits frontmatter key (agents/do-planner.md)
- [x] 3. Make description trigger-oriented (agents/do-planner.md line 3)
- [x] 4. Fix ctx7 boolean check `=== true` → `!== false` (agents/do-planner.md)
- [x] 5. Fix ctx7 invocation — use Bash instead of WebSearch (agents/do-planner.md)
- [x] 6. Add ctx7 budget cap of 3 commands (agents/do-planner.md)
- [x] 7. Add confidence writeback instruction after Step 4 (agents/do-planner.md)
- [x] 8. Fix ctx7 boolean check `=== true` → `!== false` (agents/do-debugger.md line 107)
- [x] 9. Replace process.env.HOME with os.homedir() (council-invoke.cjs)
- [x] 10. Remove hardcoded version from PLUGIN_ROOT — dynamic semver-safe scan with fallback (council-invoke.cjs)
- [x] 11. Remove Python random selection — pure JS Math.random() path; execSync removed (council-invoke.cjs)
- [x] 12. Add @returns JSDoc on resolveConfig (council-invoke.cjs)
- [x] 13. Fix stdin inheritance: `"inherit"` → `"ignore"` in invokeCodex (council-invoke.cjs)
- [x] 14. Document `--approval-mode "plan"` as intentional in runGeminiOnce (council-invoke.cjs)
- [x] 15. Fix null-pointer dereference in invokeBoth: codex?.findings, codex?.recommendations, codex?.success (council-invoke.cjs)
- [x] 16. Log claude-to-gemini fallback to stderr; result.advisor = "gemini" unchanged (council-invoke.cjs)
- [x] 17. Add getArg validation for flag-like next tokens (council-invoke.cjs)
- [x] 18. Replace setTimeout/proc.kill with AbortController in invokeCodex + runGeminiOnce (council-invoke.cjs)
- [x] 19. Regression verification smoke tests (6/6 passed)

**Nitpick fix (pre-verification):**
- [x] Updated JSDoc on selectRandomReviewer from "Select a random reviewer using Python (per D-41)" to "Select a random reviewer from available options." (council-invoke.cjs:207)

### Quality Checks
No lint, typecheck, or test scripts found in package.json — skipped.

**Regression smoke tests (Step 19):**
- **--help:** PASS (exits 0, prints usage)
- **No args:** PASS (exits 1, JSON error on stderr)
- **Exported names (21):** PASS (detectRuntime, selectReviewer, getAvailableReviewers, selectRandomReviewer, parseVerdict, parseFindings, parseRecommendations, invokeCodex, invokeGemini, invokeBoth, invokeCouncil, findWorkspaceConfig, loadWorkspaceConfig, resolveConfig, PLUGIN_ROOT, CODEX_COMPANION, DEFAULT_TIMEOUT, GEMINI_MAX_RETRIES, VALID_REVIEWERS, PLAN_VERDICTS, CODE_VERDICTS, ALL_VERDICTS)
- **PLUGIN_ROOT type:** PASS (string)
- **Optional chaining in invokeBoth:** PASS (codex?.findings, codex?.recommendations, codex?.success confirmed in source)
- **Verdict constants unchanged:** PASS (PLAN_VERDICTS, CODE_VERDICTS, ALL_VERDICTS, VALID_REVIEWERS verified)

### Result: PASS
- Checklist: 19/19 complete + nitpick fixed
- Quality: No scripts to run; 6/6 smoke tests passing

### UAT
All 6 UAT checks passed by user on 2026-04-15.
- [x] agents/do-planner.md: WebSearch removed, ctx7 uses Bash, boolean check is `!== false`
- [x] agents/do-planner.md: permissionMode: acceptEdits present, description is trigger-oriented
- [x] agents/do-planner.md: ctx7 budget cap (3 commands) and confidence writeback instruction present
- [x] agents/do-debugger.md: ctx7 boolean check is `!== false`
- [x] council-invoke.cjs: all 10 fixes applied (os.homedir, dynamic PLUGIN_ROOT, no Python, JSDoc, stdin ignore, approval-mode comment, null-safe invokeBoth, stderr fallback log, getArg guard, AbortController)
- [x] Regression smoke tests: 6/6 pass (--help, no-args, 21 exports, PLUGIN_ROOT type, optional chaining, verdict constants)
