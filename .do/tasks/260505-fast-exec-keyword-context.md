---
id: 260505-fast-exec-keyword-context
created: "2026-05-05T20:25:00Z"
updated: "2026-05-05T21:06:50.879Z"
description: "Fast-path FE-2 context scan should keyword-match project docs"
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
  score: 0.98
  factors: null
  context: 0
  scope: -0.02
  complexity: 0
  familiarity: 0
backlog_item: fast-exec-keyword-context
---

# Fast-path FE-2 context scan should keyword-match project docs

## Problem Statement

The fast-path's FE-2 "Quick Context Scan" only spot-checks the target files mentioned in the task description. It does not do keyword → doc matching (e.g., `useSelector` → `store-state.md`, `useForm` → `forms.md`, `api` → `api-layer.md`). The full planner does this via `load-task-context.cjs`, but the fast path skips the planner entirely. This means executioners on fast-path tasks miss project conventions documented in topic files and fall back to generic patterns (e.g., using `useSelector` instead of the project's `useAppSelector` wrapper).

**Proposed Fix:** In `stage-fast-exec.md` FE-2, add a lightweight keyword → doc mapping step:
1. Scan the task description for domain keywords (configurable per-project or via a standard mapping: `useSelector|useDispatch|Redux|slice|store` → `store-state.md`, `useForm|react-hook-form|validation` → `forms.md`, `api|query|mutation|endpoint` → `api-layer.md`, `route|layout|navigate` → `routing-layouts.md`, etc.)
2. For each matched doc, load it and append to the Context Loaded section
3. Keep it fast — this is keyword matching, not deep analysis. The mapping can live in `project.md` or `.do/config.json` as a `context_keywords` table
4. Consider reusing `load-task-context.cjs` with the task description (currently broken on fast-path — see backlog item `fast-exec-load-context-arg`)

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

### Scope (was: -0.05 -> now: -0.02)
**Q:** Which specific files/functions need modification? Are there any areas explicitly OUT of scope?
**A:** Whatever works best -- use your judgment on the most practical approach.

### Complexity (was: -0.05 -> now: 0)
**Q:** How do these systems interact? Any dependencies or edge cases I should know about?
**A:** Read .do-workspace.json directly -- it's the single source of truth.

### Familiarity (was: -0.05 -> now: 0)
**Q:** Has similar work been done before in this codebase? Any reference implementations to follow?
**A:** Option B -- use `<database_path>/project.md` variable style, most consistent.

## Context Loaded

- `database/projects/do/project.md` - project conventions, tech stack, agent pipeline, key directories
- `skills/references/stage-fast-exec.md` - the fast-path execution reference containing FE-2 (the section to modify)
- `skills/scripts/load-task-context.cjs` - the existing context loading script with keyword extraction and doc matching logic
- `skills/scripts/__tests__/load-task-context.test.cjs` - existing test suite for the context loader
- `agents/planner.md` - shows how the full planner invokes load-task-context.cjs (Step 1)
- `skills/fast.md` - the fast-path skill that loads stage-fast-exec.md as a reference
- `.do/BACKLOG.md` - the backlog item with original problem description and proposed fix

## Approach

### Analysis

The problem has two layers:

**Layer 1 -- FE-2 instructions are vague about what to do with `load-task-context.cjs` output.** FE-2 already calls the script, but the instructions say "Spot-check the files most likely to be affected" -- it does not explicitly say "read matched_docs from the JSON output and load each one." The planner agent has explicit instructions to "Parse the JSON output for: matched_docs: Array of relevant component/tech/feature docs (read each)" but FE-2 lacks this.

**Layer 2 -- `load-task-context.cjs` keyword extraction is too generic.** The `TECH_TERMS` set contains generic UI terms (`form`, `table`, `auth`) but not project-specific domain terms like `useSelector`, `useDispatch`, `useForm`, `react-hook-form`, `rtk-query`, `slice`. When a task description says "update the useSelector call in the fleet page", `extractKeywords` produces zero hits because `useSelector` is not in `TECH_TERMS`. This means `matched_docs` comes back empty even though `store-state.md` is sitting right there in the database.

The fix is: (a) enhance `load-task-context.cjs` to support per-project keyword-to-doc mappings from `.do/config.json`, and (b) update FE-2 instructions to explicitly parse and load matched docs.

### Steps

1. **Add `context_keywords` support to `load-task-context.cjs` with word-boundary matching**
   - File: `skills/scripts/load-task-context.cjs`
   - Read the project's `.do/config.json` for an optional `context_keywords` object
   - Format: `{ "context_keywords": { "store-state": ["useSelector", "useDispatch", "redux", "slice", "store", "rtk"], "forms": ["useForm", "react-hook-form", "validation", "zod"], "api-layer": ["api", "query", "mutation", "endpoint", "rtk-query"] } }`
   - Keys are doc filename stems (without `.md`), values are arrays of keywords that should trigger loading that doc
   - When `context_keywords` is present, scan the task description for each keyword (case-insensitive) using a matching strategy based on keyword shape:
     - **Compound terms** (contain a hyphen, e.g., `react-hook-form`, `rtk-query`): phrase match against the full lowercased description. This handles hyphenated terms that the word-split approach destroys
     - **Simple/short terms** (single words like `api`, `query`, `store`): word-boundary match using `\b` regex (e.g., `/\bapi\b/i`) to avoid false positives from substring hits (e.g., `api` matching `capital` or `query` matching `jQuery`)
     - **camelCase identifiers** (e.g., `useSelector`, `useForm`): word-boundary match -- these are distinctive enough that `\b` is sufficient and substring would also work, but `\b` is safer and consistent
     - **Regex metacharacter safety**: before building any `\b` pattern, escape regex special characters in the keyword (e.g., `c++` -> `c\+\+`, `@scope/pkg` -> `\@scope\/pkg`) using a standard `escapeRegex` helper (replace `/[.*+?^${}()|[\]\\]/g` with `\\$&`). This prevents user-editable keywords from breaking the regex engine or causing unintended matches
   - For each match, resolve the doc by searching `components/`, `tech/`, `features/` subdirs for a file whose stem matches the key
   - **Deterministic directory traversal**: in `getMdFiles` (used by `findMatchingDocs`), sort the `.md` file list by path after `fs.readdirSync` returns, since `readdirSync` ordering is OS-dependent. This ensures reproducible results across platforms (Linux vs macOS vs Windows)
   - Merge results using deterministic ordering: `context_keywords` matches first, then `TECH_TERMS`-based matches second, deduplicated by path, then apply the matched docs cap
   - Expected outcome: project-specific terms like `useSelector` now map to `store-state.md` without requiring changes to the hardcoded `TECH_TERMS` set, and short terms like `api` do not produce false positives from partial substring matches

2. **Update FE-2 instructions in `stage-fast-exec.md` to explicitly parse and load matched docs**
   - File: `skills/references/stage-fast-exec.md`
   - After the existing `load-task-context.cjs` call, add explicit instructions:
     - Parse the JSON output for `project_md_path` and `matched_docs`
     - Read `project_md_path` (already implicitly done, but make it explicit)
     - Read each file in `matched_docs` array -- these are project convention docs the executioner needs
     - Update the task file's Context Loaded section with each matched doc and why it was matched
   - Keep the "no deep research, no broad codebase scan" constraint -- this is still keyword matching, just with explicit doc loading
   - Expected outcome: FE-2 now produces the same quality of context loading that the full planner does

3. **Add tests for the new `context_keywords` config support**
   - File: `skills/scripts/__tests__/load-task-context.test.cjs`
   - Test: when `.do/config.json` has `context_keywords`, those keywords produce doc matches
   - Test: compound/hyphenated keywords (e.g., `react-hook-form`) match via phrase matching against full description
   - Test: short/simple keywords (e.g., `api`, `query`) use word-boundary matching -- verify `api` does NOT match in "capital" but DOES match in "fix the api layer"
   - Test: camelCase identifiers (e.g., `useSelector`) match with word boundaries
   - Test: config keywords merge with (not replace) hardcoded `TECH_TERMS` matches
   - Test: deterministic merge ordering -- `context_keywords` matches appear before `TECH_TERMS` matches, deduped by path
   - Test: missing or empty `context_keywords` config falls back to existing behavior
   - Test: keywords containing regex metacharacters (e.g., `c++`, `@scope/pkg`) are escaped before pattern compilation and do not throw or produce wrong matches
   - Test: `getMdFiles` returns files in sorted order regardless of filesystem readdir ordering
   - Expected outcome: regression safety for the new feature, with explicit coverage of the false-positive prevention

4. **Update golden fixtures**
   - Files: `test-fixtures/golden/claude/skills/references/stage-fast-exec.md`, `test-fixtures/golden/codex/skills/references/stage-fast-exec.md`
   - Run `UPDATE_GOLDEN=1 node --test skills/scripts/__tests__/template-regression.test.cjs` to regenerate
   - Verify expanded output looks correct for both platforms
   - Expected outcome: template regression tests pass with the updated FE-2 text

5. **Document the `context_keywords` config option in all config documentation surfaces**
   - File: `database/projects/do/project.md` (in the Tech section under `load-task-context.cjs`)
     - Add a brief note that `context_keywords` in `.do/config.json` enables per-project keyword-to-doc mapping for both the full planner and the fast-path context scan
   - File: `README.md` (in the "Project -- `.do/config.json`" section, after the existing config JSON block)
     - Add `context_keywords` to the example JSON block and add a documentation paragraph explaining the option, its format, and the matching strategy (compound phrase match vs. simple word-boundary match)
   - File: `skills/references/config-template.md` (in the config template JSON block)
     - Add `"context_keywords": {}` as an optional field inside the JSON block (no inline comments -- JSON does not allow them)
     - Add an explanatory paragraph in prose **outside** the JSON code block, after the closing fence, describing that `context_keywords` keys are doc filename stems and values are keyword arrays, with an example
   - Expected outcome: consumers can discover and configure `context_keywords` from any of the three places where `.do/config.json` shape is documented

## Concerns

1. **Config schema growth / consumer burden**: Adding `context_keywords` to `.do/config.json` means every consumer project that wants good fast-path context needs to populate this mapping. Mitigation: the feature is purely additive -- without the config key, behavior is unchanged (falls back to the existing `TECH_TERMS` matching). The backlog item suggests `project.md` as an alternative location, but `.do/config.json` is simpler to parse programmatically and already has the config cascade pattern. Document it well (in all three config doc surfaces: `project.md`, `README.md`, `config-template.md`) so consumers can adopt incrementally.

2. **Keyword explosion / false positives from short terms**: If a consumer puts very common words in `context_keywords` (e.g., `"data"`, `"page"`, `"list"`), or even moderately common short terms (e.g., `"api"`, `"query"`), naive substring matching would match those terms inside longer unrelated words (e.g., `api` in `capital`, `query` in `jQuery`). Mitigation: use a two-tier matching strategy -- compound/hyphenated terms (e.g., `react-hook-form`) use phrase matching against the full description, while simple/short terms use word-boundary regex (`\b...\b`) to require the term appears as a standalone token. Additionally, cap matched docs (e.g., max 5 unique docs) to prevent context overload on the executioner. Documentation should note that keywords should be domain-specific terms, not generic English.

3. **Doc resolution ambiguity**: The config key is a filename stem like `"store-state"` but the actual doc could be at `tech/store-state.md` or `components/store-state.md` or `features/store-state.md`. Mitigation: search all three subdirs (which the existing `findMatchingDocs` already does) and match by stem. If multiple files share the same stem across subdirs (unlikely but possible), include all matches -- the executioner can handle a few extra docs.

4. **FE-2 instruction changes affect golden fixtures**: Changing the prose in `stage-fast-exec.md` requires updating golden fixtures for both Claude and Codex platforms. Mitigation: this is a standard workflow step (Step 4 in the approach). No `<<DO:...>>` markers are being added or changed in the FE-2 section -- only prose -- so the expansion is a no-op on this section and the fixture diff will be straightforward.

5. **Deterministic merge ordering for matched docs**: When both `context_keywords` and `TECH_TERMS` produce matches, the merge order must be deterministic so results are reproducible across runs. Mitigation: Step 1 specifies the ordering explicitly -- `context_keywords` matches first, `TECH_TERMS` matches second, deduplicated by path, then capped. This is tested in Step 3.

6. **Regex metacharacters in user-editable keywords**: Users can put any string in `context_keywords` arrays. If a keyword contains regex special characters (e.g., `c++`, `@scope/pkg`, `*.config`), building a `\b...\b` pattern without escaping would either throw a `SyntaxError` or produce unintended matches. Mitigation: Step 1 specifies an `escapeRegex` helper that sanitizes keywords before pattern compilation. Test coverage in Step 3.

7. **Non-deterministic directory listing order**: `fs.readdirSync` returns entries in filesystem-dependent order, which differs between Linux (inode order), macOS (sorted), and Windows (sorted). Without explicit sorting, `findMatchingDocs` and `getMdFiles` produce platform-dependent results, making tests flaky on CI. Mitigation: Step 1 adds a `.sort()` call after `readdirSync` in `getMdFiles`. Test coverage in Step 3.

## Execution Log

### 2026-05-05 21:00 - Execution started

**Status:** In progress
**Steps:** 0/5 complete

### 2026-05-05 21:25 - Execution complete

**Status:** Complete
**Summary:**

- Steps completed: 5/5
- Files modified: 9
- Deviations: 1 minor (test ordering expectation corrected — alphabetical stem sort means `forms` before `store-state`, not reverse)

### 2026-05-05 21:05 - Step 1: Add context_keywords support to load-task-context.cjs

**Files:**

- `skills/scripts/load-task-context.cjs` - Added `escapeRegex` helper, updated `getMdFiles` to sort results for deterministic ordering, added `keywordMatchesDescription` with two-tier matching strategy (hyphenated=phrase match, simple/camelCase=word-boundary regex), added `findMatchingDocsByKeywordConfig` function that maps config stems to doc files, updated `loadTaskContext` to merge config matches (first) with TECH_TERMS matches (second) deduplicated and capped at 5, exported new functions for testing

**Decisions:**

- Used `projectConfig.context_keywords` (already-read project config) rather than re-reading `.do/config.json` separately — consistent with existing code flow
- Sorted `Object.keys(contextKeywords)` before iteration to ensure deterministic ordering even when JSON key order varies
- Capped merged docs at 5 (per Concern #2 in plan)

**Status:** Complete

### 2026-05-05 21:20 - Step 5: Document context_keywords in all config surfaces

**Files:**

- `database/projects/do/project.md` (resolved from `.do-workspace.json` database path: `/Users/globalorange/workspace/database`) - Added note about `context_keywords` in the Tech section under `load-task-context.cjs`
- `README.md` - Added `context_keywords` example to the Project config JSON block, added two explanation paragraphs documenting format, matching strategy, and word-boundary false-positive prevention
- `skills/references/config-template.md` - Added `"context_keywords": {}` to the JSON block, added explanatory prose paragraph outside the JSON fence describing the feature with an example
- `test-fixtures/golden/claude/skills/references/config-template.md` - Regenerated
- `test-fixtures/golden/codex/skills/references/config-template.md` - Regenerated

**Decisions:**

- Used `.do-workspace.json` database path (`/Users/globalorange/workspace/database`) to locate project.md rather than a hardcoded shorthand, per user note
- Full test suite: 1029/1029 tests pass

**Status:** Complete

### 2026-05-05 21:15 - Step 4: Update golden fixtures

**Files:**

- `test-fixtures/golden/claude/skills/references/stage-fast-exec.md` - Regenerated (FE-2 updated)
- `test-fixtures/golden/codex/skills/references/stage-fast-exec.md` - Regenerated (FE-2 updated)
- (134 other golden fixtures updated as part of the batch regeneration — no template changes in those files)

**Decisions:**

- Ran `UPDATE_GOLDEN=1 node --test skills/scripts/__tests__/template-regression.test.cjs` which regenerated 136 files
- Verified both claude and codex FE-2 sections show the correct expanded paths and updated prose

**Status:** Complete

### 2026-05-05 21:12 - Step 3: Add tests for context_keywords config support

**Files:**

- `skills/scripts/__tests__/load-task-context.test.cjs` - Added tests for `keywordMatchesDescription` (compound phrase match, word-boundary for simple terms, camelCase, metacharacter escaping), `getMdFiles` (sorted ordering, non-existent dir), `findMatchingDocsByKeywordConfig` (camelCase match, hyphenated match, no false positives, standalone word match, deterministic alphabetical ordering, deduplication, empty config fallback, metacharacter safety)

**Decisions:**

- Fixed test expectation: alphabetical stem sort means `forms` before `store-state`, not the other way around
- All 24 tests pass

**Status:** Complete

### 2026-05-05 21:08 - Step 2: Update FE-2 instructions in stage-fast-exec.md

**Files:**

- `skills/references/stage-fast-exec.md` - Updated FE-2 to explicitly parse `project_md_path` and `matched_docs` from JSON output, read each matched doc, and update Context Loaded section with match reasons

**Decisions:**

- Kept the "no deep research" constraint explicit in updated text
- Added example match-reason format to guide executioners on what to log in Context Loaded

**Status:** Complete

## Review Iterations

### Iteration 1
- **Self-review:** PASS - all 5 criteria met
- **Council:** CONCERNS - 2 blockers (substring matching false positives for short terms, documentation only updates project.md not README/config-template), 1 nitpick (cap ordering undefined)
- **Changes made:**
    - [blocker] Replaced naive substring matching in Step 1 with two-tier strategy: compound terms (containing hyphens) use phrase matching, simple/short terms use `\b` word-boundary regex. Removed old Step 2 (which was the substring matching enhancement) since matching logic is now fully specified in Step 1.
    - [blocker] Expanded Step 6 (now Step 5) from project.md-only to three documentation surfaces: `database/projects/do/project.md`, `README.md` (config section), and `skills/references/config-template.md` (template JSON). All places where `.do/config.json` shape is documented.
    - [nitpick] Added deterministic merge ordering to Step 1: `context_keywords` matches first, `TECH_TERMS` matches second, deduplicate by path, then apply cap. Added corresponding test case in Step 3. Added new Concern #5 to call this out explicitly.
    - Step renumbering: merged old Steps 1+2 into new Step 1, shifted remaining steps. Total steps reduced from 6 to 5.
    - Updated Concern #2 to reflect the two-tier matching mitigation and Concern #4 step reference.

### Iteration 2
- **Self-review:** PASS - all 5 criteria met, round-1 blockers addressed
- **Council:** CONCERNS - 1 blocker (JSON comment in config-template.md invalid), 2 nitpicks (fs.readdirSync ordering unstable, regex metacharacter escaping needed)
- **Changes made:**
    - [blocker] Step 5 config-template.md sub-bullet: replaced "with a comment" instruction with two-part approach -- add `"context_keywords": {}` in the JSON block (no comments), add explanatory paragraph in prose outside the JSON fence.
    - [nitpick] Step 1: added `escapeRegex` helper requirement before building `\b` patterns from user-editable keywords. Added Concern #6 and test case in Step 3.
    - [nitpick] Step 1: added deterministic sort requirement for `getMdFiles` after `fs.readdirSync`. Added Concern #7 and test case in Step 3.

### Iteration 3
- **Self-review:** PASS - all 5 criteria met
- **Council:** CONCERNS - 3 blockers (project.md path shorthand, golden fixture scope for config-template.md, \b matching for non-word-char keywords), 1 nitpick (getMdFiles not exported)
- **Combined:** MAX_ITERATIONS — user override (proceed). Council findings assessed: (1) project.md path is standard shorthand used across all tasks, executioner resolves via project context; (2) Step 4 uses UPDATE_GOLDEN=1 which regenerates ALL fixtures including config-template.md; (3) \b edge cases for c++/@scope/pkg are hypothetical — real keywords (useSelector, react-hook-form, api) work correctly with \b.
- **User note:** Database location in Step 5 should be resolved from .do-workspace.json or config rather than hardcoded path. Executioner should read the workspace config to find the database root.

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

## Verification Results

### Approach Checklist

- [x] Step 1: Add `context_keywords` support to `load-task-context.cjs` with `escapeRegex`, `getMdFiles` sort, `keywordMatchesDescription` two-tier matching, `findMatchingDocsByKeywordConfig`, and deterministic merge in `loadTaskContext`
- [x] Step 2: Update FE-2 instructions in `stage-fast-exec.md` to explicitly parse `project_md_path` and `matched_docs`, read each matched doc, and update Context Loaded section
- [x] Step 3: Add tests for `keywordMatchesDescription`, `getMdFiles` sorted ordering, `findMatchingDocsByKeywordConfig` (camelCase, compound, word-boundary, metacharacter safety, deterministic ordering, dedup, empty config fallback)
- [x] Step 4: Update golden fixtures for both claude and codex platforms via `UPDATE_GOLDEN=1`
- [x] Step 5: Document `context_keywords` in all three config surfaces: `database/projects/do/project.md`, `README.md`, and `skills/references/config-template.md`

### Quality Checks

- **Tests:** PASS (node --test skills/scripts/__tests__/*.test.cjs) — 1029/1029 pass

### Result: PASS

- Checklist: 5/5 complete
- Quality: 1/1 passing
