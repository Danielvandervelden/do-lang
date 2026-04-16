---
id: 260415-apply-do-optimise-audit-findi
created: 2026-04-15T00:00:00.000Z
updated: '2026-04-15T17:00:00.000Z'
description: >-
  Apply /do:optimise audit findings to skills/do/optimise.md and
  optimise-target.cjs — fix ctx7 budget model (new caps: low=3, medium=5,
  high=10, curiosity-driven), remove redundant mkdir, add failure handling
  section, fix Glob path in Step 5, add secondary ctx7 query for skill/agent
  targets
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
    context: 0
    scope: -0.05
    complexity: -0.05
    familiarity: 0
---

# Apply /do:optimise audit findings

## Problem Statement

The `/do:optimise` skill and its companion script `optimise-target.cjs` were audited using `/do:optimise --effort high`. The audit identified 5 findings (2 warnings, 3 suggestions) that need to be applied back to the source files. These are concrete, line-referenced fixes — not speculative improvements.

**What needs to change:**

1. **W1 — ctx7 budget model contradiction** (`optimise.md:40` vs `:117`): The effort table says "max 2 calls" for low effort, but the Step 4 narrative says "hard cap: 1 library + max 2 docs = 3 total". Both are wrong. New model: effort-based caps (low=3, medium=5, high=10) where the budget is a ceiling not a target. Follow the research thread if warranted; stop early when confident.
2. **W2 — Redundant mkdir** (`optimise.md:262-263`): `mkdir -p .do/optimise` is unnecessary because the Write tool creates parent directories automatically. Remove it.
3. **S1 — Missing secondary ctx7 query for skill/agent targets** (`optimise-target.cjs:516-523`): The secondary family derivation block skips when `primaryFamily='claude-code'` because it only checks `nodejs` and `npm`. At medium/high effort, skill/agent targets should get a second ctx7 query for Claude Code agent orchestration patterns.
4. **S2 — Missing failure handling section** (`optimise.md`, after line 266): Peer skill file `task.md` has a `## Failure Handling` section. This skill has none. Add one covering: script error, ctx7 unavailable, WebSearch unavailable, Write failure.
5. **S3 — Glob path parameter missing** (`optimise.md:148`): `Glob("<pattern>")` doesn't specify the `path` parameter, causing silent failure when CWD is not the project root. Change to `Glob("<pattern>", path: "<project_root>")`.

**Acceptance criteria:**
- All 5 findings are applied as described
- No behavioral regressions — the skill reads correctly end-to-end
- Budget model is internally consistent between the effort table, the Step 4 narrative, and the JSDoc in `deriveResearchQueries`
- Existing tests in `__tests__/optimise-target.test.cjs` updated with assertions for S1 secondary query behavior
- Existing effort-level tests (lines 315-373) remain valid after S1 changes

## Clarifications

None needed — all findings are concrete with exact locations and fixes specified by the audit.

## Context Loaded

- `database/projects/do/project.md` — project conventions, directory structure, skill authoring rules
- `skills/do/optimise.md` — the skill file being modified (full read, 271 lines)
- `skills/do/scripts/optimise-target.cjs` — the script being modified (full read, 728 lines)
- `skills/do/scripts/__tests__/optimise-target.test.cjs:315-402` — existing `deriveResearchQueries` tests covering effort levels and query content
- `skills/do/task.md:265-280` — peer failure handling section used as reference for S2

## Approach

### 1. Fix ctx7 budget model in effort table (W1, part A — optimise.md:39-43)

**File:** `skills/do/optimise.md`
**Lines:** 39-43 (effort table)

Replace the "Research" column values with new budget caps:
- `low`: `ctx7 only (max 3 calls). No fallback if ctx7 unavailable.`
- `medium` (default): `ctx7 + peer file comparison (max 5 calls). WebSearch fallback if ctx7 fails.`
- `high`: `ctx7 + peer files + WebSearch (max 10 calls). WebSearch fallback if ctx7 fails.`

### 2. Fix ctx7 budget model in Step 4 narrative (W1, part B — optimise.md:117)

**File:** `skills/do/optimise.md`
**Lines:** 115-119 (Step 4 heading and opening paragraph)

Context: Line 115 is `## Step 4: Research — ctx7 Best Practices`, line 116 is blank, line 117 is the hard-cap sentence, line 118 is blank, line 119 starts `For each entry in ctx7_queries`.

Replace line 117 (the "hard cap" sentence) with the new budget philosophy:

```
Follow the ctx7 budget policy — per-effort caps: low=3, medium=5, high=10 total calls (library + docs combined). The budget is a ceiling, not a target: follow the research thread if it warrants more calls, stop early when confident.
```

Lines 115-116 and 118-119 remain unchanged.

### 3. Fix Glob path parameter in Step 5 (S3 — optimise.md:148)

**File:** `skills/do/optimise.md`
**Line:** 148

Change the Glob call from:
```
Glob("<pattern>")
```
to:
```
Glob("<pattern>", path: "<project_root>")
```

Add a note: "Use the directory containing `.do/config.json` as `<project_root>` — this ensures correct results regardless of CWD."

### 4. Remove redundant mkdir in Step 10 (W2 — optimise.md:261-263)

**File:** `skills/do/optimise.md`
**Lines:** 260-263 (the numbered step 4 with the mkdir bash block)

Remove step 4 (`mkdir -p .do/optimise`) entirely and renumber step 5 to 4. The Write tool handles directory creation.

### 5a. Fix "Proceed to Step 5" contradiction (S2 prerequisite — optimise.md:135)

**File:** `skills/do/optimise.md`
**Line:** 135

The current text says that when ctx7 fails at low effort, the agent should "Proceed to Step 5". But Step 5 (Peer File Comparison) says "Skip entirely if `effort = low`." This is contradictory. Fix line 135 to say "Proceed to Step 6" instead. The corrected sentence:

```
- If `effort = low`: Stop ctx7 research. Note "ctx7 unavailable — run `npx ctx7@latest login` for higher limits" in Sources Consulted. Proceed to Step 6 using model knowledge and file structure analysis only. Do NOT invoke WebSearch.
```

### 5b. Add Failure Handling section (S2 — optimise.md)

**File:** `skills/do/optimise.md`
**Location:** Between the `---` after Step 10 and `## Files`

Insert a `## Failure Handling` section modeled after `task.md:271-279`, covering:
- **Script error** (optimise-target.cjs exits non-zero): Show the error field from JSON output. Do not proceed.
- **ctx7 unavailable** (quota error or ctx7_enabled=false): Already covered in Step 4 fallback rules — cross-reference those. No automatic retry.
- **WebSearch unavailable**: Note findings as "unconfirmed by web sources" in the report. Proceed with ctx7 and peer findings only.
- **Write failure** (Step 10 save): Report the error to user. The report content was already displayed in Step 9, so no data is lost.

### 6. Add secondary ctx7 query for skill/agent targets (S1 — optimise-target.cjs:589)

**File:** `skills/do/scripts/optimise-target.cjs`
**Insertion point:** After line 589 (after the existing secondary query push block at lines 581-589)

The existing code structure in `deriveResearchQueries` is:
- Lines 530-538: Secondary family **derivation** (sets `secondaryFamily`/`secondaryLibrary`)
- Lines 541-578: Primary query **push** to `ctx7_queries`
- Lines 581-589: Existing secondary query **push** to `ctx7_queries` (guarded by `secondaryLibrary`)

The new block MUST go after line 589, not after line 538. Inserting after 538 would place the secondary-docs query before the primary query push, breaking the existing test contract (line 385 asserts `ctx7_queries[0]` is the skill-specific primary).

Add after line 589:

```javascript
  // Secondary ctx7 query for skill/agent targets at medium/high effort
  // (the secondary derivation block above never sets secondaryLibrary for
  // claude-code primary, so this is the only secondary path for these types)
  if (effort !== 'low' && (type === 'agent' || type === 'skill')) {
    ctx7_queries.push({
      technology_family: 'claude-code',
      library_name: 'claude-code',
      question: 'Claude Code agent orchestration, subagent spawning, and parallel dispatch patterns',
      budget_slot: 'secondary-docs',
    });
  }
```

Note: The `!secondaryLibrary` guard from the previous plan revision has been removed. Analysis of the code confirms that `secondaryLibrary` is NEVER set when `type === 'agent' || type === 'skill'` because the secondary derivation block (lines 531-538) only checks for `nodejs`/`npm` families, and agent/skill types always set `primaryFamily = 'claude-code'`. A guard for a condition that cannot occur adds dead code. The type gate (`type === 'agent' || type === 'skill'`) is the correct and sufficient guard.

### 7. Update tests for secondary ctx7 query (S1 — optimise-target.test.cjs)

**File:** `skills/do/scripts/__tests__/optimise-target.test.cjs`
**Location:** After the existing `deriveResearchQueries — ctx7 query content` describe block (around line 402)

Add a new describe block with 4 test cases:

```javascript
describe('deriveResearchQueries — secondary Claude Code query for skill/agent', () => {
  test('agent at medium effort gets secondary claude-code ctx7 query', () => {
    const { ctx7_queries } = deriveResearchQueries('agent', ['claude-code'], 'medium');
    const secondary = ctx7_queries.find(q => q.budget_slot === 'secondary-docs');
    assert.ok(secondary, 'should have a secondary-docs query');
    assert.strictEqual(secondary.library_name, 'claude-code');
  });

  test('skill at high effort gets secondary claude-code ctx7 query', () => {
    const { ctx7_queries } = deriveResearchQueries('skill', ['claude-code'], 'high');
    const secondary = ctx7_queries.find(q => q.budget_slot === 'secondary-docs');
    assert.ok(secondary, 'should have a secondary-docs query');
    assert.strictEqual(secondary.library_name, 'claude-code');
  });

  test('agent at low effort does NOT get secondary claude-code ctx7 query', () => {
    const { ctx7_queries } = deriveResearchQueries('agent', ['claude-code'], 'low');
    const secondary = ctx7_queries.find(q => q.budget_slot === 'secondary-docs');
    assert.strictEqual(secondary, undefined, 'no secondary query at low effort');
  });

  test('script type does NOT get secondary claude-code ctx7 query', () => {
    const { ctx7_queries } = deriveResearchQueries('script', ['nodejs'], 'medium');
    const secondary = ctx7_queries.find(q => q.budget_slot === 'secondary-docs' && q.library_name === 'claude-code');
    assert.strictEqual(secondary, undefined, 'script type should not get claude-code secondary');
  });
});
```

These tests cover:
- Positive case: agent at medium effort gets the secondary query
- Positive case: skill at high effort gets the secondary query
- Negative case: low effort does not get the secondary query
- Negative case: script type does not get the secondary query

The previous 5th test case (`!secondaryLibrary` guard test) has been removed. Analysis of the code shows that `secondaryLibrary` is never set when `type === 'agent' || type === 'skill'`, making the guard unreachable and therefore untestable. The 4 remaining tests cover all meaningful code paths.

### 8. Update JSDoc budget comment in deriveResearchQueries (W1, part C — optimise-target.cjs:496-503)

**File:** `skills/do/scripts/optimise-target.cjs`
**Lines:** 496-503 (JSDoc block for `deriveResearchQueries`)

Update the budget policy comment to match the new model:

```
 * Budget policy (ceiling, not target — stop early when confident):
 *   low:    max 3 total calls (library + docs)
 *   medium: max 5 total calls (library + docs)
 *   high:   max 10 total calls (library + docs, depth from peer files + web)
```

### 9. Verify internal consistency

After all edits, re-read both files and run the test suite to confirm:
- The effort table (Step 1), Step 4 narrative (Step 2), and JSDoc (Step 8) all say the same caps: low=3, medium=5, high=10
- The Glob call in Step 5 includes path parameter
- The mkdir is gone from Step 10
- The failure handling section exists between Step 10 and ## Files
- Line 135 says "Proceed to Step 6" (not Step 5)
- The secondary ctx7 query fires for skill/agent at medium/high effort
- Existing effort-level tests (lines 315-373) remain valid — S1 adds a secondary query but does not change primary query behavior or peer/web arrays, so existing assertions still hold
- All new and existing tests pass: `node --test skills/do/scripts/__tests__/optimise-target.test.cjs`

## Concerns

1. **Risk: Budget numbers may need tuning** — The new caps (3/5/10) were chosen during the audit but haven't been validated in practice.
   **Mitigation:** These are ceilings, not targets. The "stop early when confident" philosophy means real usage will typically stay well under the cap. Caps can be adjusted later based on experience.

2. **Risk: Test assertions depend on internal structure** — The new tests in Step 7 check for `budget_slot === 'secondary-docs'` which couples tests to the internal field name.
   **Mitigation:** This is the same pattern used by existing tests (e.g., checking `library_name` and `question` fields). If the field name changes, both code and tests need updating together, which is the expected behavior.

## Execution Log

### 2026-04-15 16:30 - Execution started
**Status:** In progress
**Steps:** 0/9 complete

### 2026-04-15 16:35 - Step 1: Fix ctx7 budget model in effort table (W1 part A)
**Files:**
- `skills/do/optimise.md` — Updated Research column: low=max 3, medium=max 5, high=max 10 calls

**Status:** Complete

### 2026-04-15 16:35 - Step 2: Fix ctx7 budget model in Step 4 narrative (W1 part B)
**Files:**
- `skills/do/optimise.md:117` — Replaced hard-cap sentence with per-effort ceiling philosophy (low=3, medium=5, high=10)

**Status:** Complete

### 2026-04-15 16:36 - Step 3: Fix Glob path parameter in Step 5 (S3)
**Files:**
- `skills/do/optimise.md:148` — Changed `Glob("<pattern>")` to `Glob("<pattern>", path: "<project_root>")`, added note about using `.do/config.json` directory as project_root

**Status:** Complete

### 2026-04-15 16:36 - Step 4: Remove redundant mkdir in Step 10 (W2)
**Files:**
- `skills/do/optimise.md` — Removed step 4 (mkdir -p .do/optimise bash block), renumbered step 5→4 and step 6→5

**Status:** Complete

### 2026-04-15 16:36 - Step 5a: Fix "Proceed to Step 5" contradiction
**Files:**
- `skills/do/optimise.md:135` — Changed "Proceed to Step 5" to "Proceed to Step 6" for ctx7 failure at low effort

**Status:** Complete

### 2026-04-15 16:37 - Step 5b: Add Failure Handling section (S2)
**Files:**
- `skills/do/optimise.md` — Inserted ## Failure Handling section between Step 10 and ## Files, covering: script error, ctx7 unavailable, WebSearch unavailable, Write failure

**Status:** Complete

### 2026-04-15 16:37 - Step 6: Add secondary ctx7 query for skill/agent targets (S1)
**Files:**
- `skills/do/scripts/optimise-target.cjs` — Inserted secondary claude-code ctx7 query block after line 589 (after existing secondaryLibrary push), guarded by `effort !== 'low' && (type === 'agent' || type === 'skill')`

**Status:** Complete

### 2026-04-15 16:38 - Step 7: Update tests for secondary ctx7 query
**Files:**
- `skills/do/scripts/__tests__/optimise-target.test.cjs` — Added new describe block with 4 test cases: positive (agent/medium, skill/high), negative (agent/low, script/medium)

**Status:** Complete

### 2026-04-15 16:38 - Step 8: Update JSDoc budget comment (W1 part C)
**Files:**
- `skills/do/scripts/optimise-target.cjs:495-498` — Updated JSDoc to "ceiling, not target" model with low=3, medium=5, high=10

**Status:** Complete

### 2026-04-15 16:39 - Step 9: Verify internal consistency + run tests
**Verification:**
- Effort table (Step 1): low=3, medium=5, high=10 — consistent
- Step 4 narrative (Step 2): same caps — consistent
- JSDoc (Step 8): same caps — consistent
- Glob in Step 5 includes path parameter — confirmed
- mkdir removed from Step 10 — confirmed
- Failure Handling section exists — confirmed
- Line 135 says "Proceed to Step 6" — confirmed
- Secondary ctx7 query fires for skill/agent at medium/high — confirmed

**Test results:** 51 tests, 51 pass, 0 fail (20 suites)

**Status:** Complete

### 2026-04-15 16:40 - Execution complete
**Status:** Complete
**Summary:**
- Steps completed: 9/9
- Files modified: 3 (optimise.md, optimise-target.cjs, optimise-target.test.cjs)
- Deviations: 0 minor / 0 blocking

## Council Review

### Plan review (Codex, 2026-04-15)

Feedback applied:
1. Added Step 7 — update existing test file with assertions for S1 secondary query behavior (positive cases for agent/skill at medium/high, negative cases for low effort and script type, guard condition for secondaryLibrary already set).
2. Updated Step 5 (S2) to include Part A fixing the "Proceed to Step 5" contradiction at `optimise.md:135` — changed to "Proceed to Step 6".
3. Removed stale Concern 1 about skill-creator CLAUDE.md constraint (now resolved — Edit tool is permitted). Removed stale Concern 2 about "no existing tests" (tests exist at `optimise-target.test.cjs:315-402`).
4. Updated acceptance criteria to include test coverage requirement.
5. Updated Context Loaded to include the existing test file.
6. Updated `council_review_ran.plan` to `true`.

### Plan review round 2 (Codex, 2026-04-15)

Feedback applied:
1. **S1 insertion point corrected (must-fix):** Moved the new secondary query block from after line 538 (secondary derivation) to after line 589 (existing secondary query push). This preserves the `ctx7_queries[0]` == primary query invariant that existing tests at line 385 depend on. Added detailed comment explaining the code structure (derivation at 530-538, primary push at 541-578, secondary push at 581-589) so the executioner knows exactly where to insert.
2. **Removed untestable 5th test case (must-fix):** The `!secondaryLibrary` guard test was removed because analysis confirms `secondaryLibrary` is never set when `type === 'agent' || type === 'skill'` (the secondary derivation only fires for nodejs/npm families). The guard itself was also removed from the new code block — it would be dead code. Test count reduced from 5 to 4 covering all meaningful paths.
3. **Split Step 5 into 5a and 5b (minor):** Step 5a fixes the "Proceed to Step 5" -> "Step 6" contradiction at line 135. Step 5b adds the Failure Handling section. Each edit is now atomic.
4. **Added existing-test validity note to Step 9 (minor):** Step 9 now explicitly notes that existing effort-level tests (lines 315-373) remain valid after S1 changes, since the new secondary query does not alter primary query behavior or peer/web arrays.
5. **Added surrounding lines context to Step 2 (minor):** Step 2 now describes lines 115-119 so the executioner has full context around the line 117 edit target.

## Verification Results

### Approach Checklist
- [x] Step 1: Fix ctx7 budget model in effort table (W1 part A) — low=max 3, medium=max 5, high=max 10 in optimise.md:41-43
- [x] Step 2: Fix ctx7 budget model in Step 4 narrative (W1 part B) — ceiling philosophy sentence at optimise.md:117
- [x] Step 3: Fix Glob path parameter in Step 5 (S3) — `Glob("<pattern>", path: "<project_root>")` at optimise.md:148
- [x] Step 4: Remove redundant mkdir in Step 10 (W2) — bash block gone, steps renumbered
- [x] Step 5a: Fix "Proceed to Step 5" contradiction — now "Proceed to Step 6" at optimise.md:135
- [x] Step 5b: Add Failure Handling section (S2) — section exists between Step 10 and ## Files
- [x] Step 6: Add secondary ctx7 query for skill/agent targets (S1) — block at optimise-target.cjs:591-601 gated by `effort !== 'low' && (type === 'agent' || type === 'skill')`
- [x] Step 7: Update tests for secondary ctx7 query — 4-test describe block added to optimise-target.test.cjs:404-430
- [x] Step 8: Update JSDoc budget comment (W1 part C) — ceiling model at optimise-target.cjs:494-498
- [x] Step 9: Verify internal consistency + run tests — 51/51 tests pass

### Quality Checks
No quality check scripts found in package.json (only `postinstall` defined). Tests run manually per UAT instructions.

- **Tests:** PASS (node --test skills/do/scripts/__tests__/optimise-target.test.cjs) — 51 tests, 51 pass, 0 fail, 20 suites

### Result: PASS
- Checklist: 10/10 complete
- Quality: No scripts to run (tests verified manually — 51/51 pass)
- Blocking issues: None
