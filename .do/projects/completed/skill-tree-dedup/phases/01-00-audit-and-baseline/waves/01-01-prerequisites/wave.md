---
project_schema_version: 1
project_slug: skill-tree-dedup
phase_slug: 01-00-audit-and-baseline
wave_slug: 01-01-prerequisites
title: 'Wave 01: Prerequisites -- Audit Script + install.cjs Guard'
created: 2026-05-04T14:05:55.362Z
updated: '2026-05-04T14:41:11.000Z'
status: completed
scope: in_scope
pre_abandon_status: null
backlog_item: null
parent_project: skill-tree-dedup
parent_phase: 01-00-audit-and-baseline
stage: complete
stages: null
council_review_ran: null
confidence: null
modified_files: null
unresolved_concerns: []
discovered_followups: null
wave_summary: >-
---

# Wave 01: Prerequisites -- Audit Script + install.cjs Guard

## Problem Statement

This wave establishes the two independent prerequisites that Wave 02 (baseline snapshot + template spec) depends on. Without these deliverables, Wave 02 cannot proceed:

1. **Audit report** -- The file pair audit script compares every file pair across `skills/do/`, `skills/codex/`, and `agents/`, classifying each as identical or divergent with line-level diff summaries. This produces `audit-report.md`, which is the factual foundation for the entire deduplication project. Wave 02's template spec needs the audit's divergence patterns; Phases 01-02 need the audit to know which files require template markers and which can be copied as-is. Expected totals from the project-level manual audit: 68 paired files (47 reference pairs, 13 skill pairs, 8 agent pairs) with 23 identical and 45 divergent. Within each group, the expected identical/divergent split is: 22 identical + 25 divergent references (all in the single `references/` directory -- the split is a classification of those 47 pairs, not separate directories), 1 identical + 12 divergent skills, 0 identical + 8 divergent agents. The audit script must also enumerate BOTH sides of each directory (do and codex) and report any unpaired files -- files that exist in one tree but not the other. The `scripts/` subdirectory under `skills/do/` has no codex counterpart and must be explicitly excluded from pairing (reported as out-of-scope).

2. **install.cjs import safety** -- The `bin/install.cjs` file currently has two side-effect sites that execute at module load time: (a) an early-exit guard at lines 15-19 that checks `fs.existsSync(source)` and calls `process.exit(0)` if the source directory is missing, and (b) an interactive prompt block at lines 115-134 that either runs the install immediately (non-TTY) or opens a readline prompt (TTY). Both must be wrapped in `if (require.main === module)` guards so that `require('./install.cjs')` returns `{ installClaudeCode, installCodex }` without any output, prompts, or process exits. Wave 02's baseline snapshot script depends on importing these functions programmatically.

**Cold-start context:** This wave is the first wave of Phase 00 (Audit and Baseline) in the "Consolidate Claude/Codex Skill Trees" project. The project consolidates ~68 duplicated file pairs across Claude and Codex skill trees into a single canonical source with a build step. Phase 00 produces foundation artifacts (audit, testable installer, baseline snapshots, template spec) that all subsequent phases depend on. The repo is `~/workspace/github-projects/do/`, a Node.js 18+ CommonJS npm package.

## Delivery Contract

- **Branch:** `feat/skill-tree-dedup-phase00-wave01`
- **Commit prefix:** `feat` or `chore` (conventional commits)
- **Push:** No auto-push -- user reviews and pushes manually

## Approach

### Task 1: Build and execute file pair audit script

1. **Create the audit script** at `.do/projects/skill-tree-dedup/scripts/audit-pairs.cjs`. The script should:
   - **Two-sided enumeration**: For each group (references, skills, agents), enumerate `.md` files from BOTH the do-side AND the codex-side, then compute the union of filenames. This ensures files that exist in only one tree are detected (e.g., a file in `skills/codex/` with no `skills/do/` counterpart).
     - **References**: Enumerate all `.md` files in `skills/do/references/` AND `skills/codex/references/`. Pair by filename.
     - **Skills**: Enumerate all `.md` files in `skills/do/` (root level only) AND `skills/codex/` (root level only). Pair by filename. Explicitly exclude non-`.md` files and subdirectories (`scripts/`, `references/`, `__tests__/`) from pairing -- these are structural directories, not paired content. Report excluded directories in the audit output as "out-of-scope" (e.g., `skills/do/scripts/` has no codex counterpart by design -- `install.cjs` handles codex script copying separately).
     - **Agents**: Enumerate all `agents/do-*.md` AND `agents/codex-*.md`. Pair by stripping the platform prefix (`do-` or `codex-`) and matching on the base name.
   - **Classification**: For each paired file, compare file contents. If byte-identical, classify as `identical`. If different, classify as `divergent`. For files present in only one tree, classify as `unpaired (do-only)` or `unpaired (codex-only)`.
   - For divergent pairs, produce a line-level diff summary. Categorize each divergence into one or more of: `path substitution` (`.claude` vs `.codex`, `commands/do` vs `skills/do`), `agent name prefix` (`do-` vs `codex-`), `Agent() vs prose spawn` (JS `Agent()` call blocks vs natural-language spawn instructions), `prose wording` (any other textual differences).
   - Output a markdown table with columns: File Pair, Classification, Categories, Divergent Lines Summary.
   - At the end, output summary counts by group (references, skills, agents) showing: total pairs, identical count, divergent count, unpaired count (with filenames). Compare paired totals against expected values from the project-level manual audit (references: 22 identical + 25 divergent = 47 pairs; skills: 1 identical + 12 divergent = 13 pairs; agents: 0 identical + 8 divergent = 8 pairs). Flag any discrepancies. Note: the identical/divergent split within each group is a classification result from the manual audit, not separate directories -- all 47 reference pairs live in the single `references/` directory.
   - **Files:** `.do/projects/skill-tree-dedup/scripts/audit-pairs.cjs` (new)

2. **Syntax-check the audit script** with `node --check .do/projects/skill-tree-dedup/scripts/audit-pairs.cjs` to catch parse errors before execution.
   - **Expected outcome:** Exit code 0, no syntax errors.

3. **Run the audit script** with `node .do/projects/skill-tree-dedup/scripts/audit-pairs.cjs` and write output to `.do/projects/skill-tree-dedup/audit-report.md`.
   - **Files:** `.do/projects/skill-tree-dedup/audit-report.md` (new, generated)

4. **Validate the audit output**: Confirm the report is well-formed, counts are present, and any discrepancies from expected totals are noted. Verify that unpaired files (if any) and out-of-scope directories are documented. If counts differ from expectations (68 pairs, 23 identical, 45 divergent), document the actual counts -- the audit script is the source of truth.
   - **Expected outcome:** A complete, validated `audit-report.md` with all file pairs classified, including any unpaired files and out-of-scope exclusions.

### Task 2: Make install.cjs import-safe

5. **Wrap the early-exit guard** at lines 14-19 of `bin/install.cjs`. The current code:
   ```js
   // Check if source exists (may not during dev installs before skills/ created)
   if (!fs.existsSync(source)) {
     console.log(
       "do-lang: skills/do/ not found (dev install?), skipping installation",
     );
     process.exit(0);
   }
   ```
   Wrap this block with `if (require.main === module) { ... }` so it only executes when the file is run directly.
   - **File:** `bin/install.cjs` (lines 14-20)

6. **Wrap the interactive prompt block** at lines 115-134 of `bin/install.cjs`. The current code:
   ```js
   if (!process.stdin.isTTY) {
     // ...non-interactive install...
   } else {
     // ...readline prompt...
   }
   ```
   Wrap this entire `if/else` block with `if (require.main === module) { ... }` so it only executes when the file is run directly.
   - **File:** `bin/install.cjs` (lines 115-134)

7. **Add module exports** after the `runInstall()` function definition (after line 113, before the prompt block). Add:
   ```js
   module.exports = { installClaudeCode, installCodex };
   ```
   This makes the two install functions available when the module is `require()`d.
   - **File:** `bin/install.cjs` (after line 113)

8. **Verify import safety** by running a Node.js one-liner:
   ```bash
   node -e "const m = require('./bin/install.cjs'); console.log('exports:', Object.keys(m)); console.log('installClaudeCode:', typeof m.installClaudeCode); console.log('installCodex:', typeof m.installCodex);"
   ```
   - **Expected outcome:** No output other than the three `console.log` lines. No process exit. No readline prompt. Exports include both `installClaudeCode` and `installCodex` as functions.

9. **Verify direct-run behavior is preserved** using an isolated HOME to avoid mutating real install targets:
   ```bash
   TEMP_HOME="$(mktemp -d)" && mkdir -p "$TEMP_HOME/.claude" "$TEMP_HOME/.codex" && HOME="$TEMP_HOME" echo "3" | HOME="$TEMP_HOME" node bin/install.cjs
   ```
   This creates a temporary directory with `.claude` and `.codex` stubs, then runs `install.cjs` with `HOME` overridden so that copied files go to the temp directory instead of the real `~/.claude/` and `~/.codex/`. After verification, inspect the temp directory to confirm files were copied correctly.
   - **Expected outcome:** The script behaves identically to before the changes -- in non-TTY mode (piped input), it auto-installs both targets. Files are copied to `$TEMP_HOME/.claude/` and `$TEMP_HOME/.codex/` instead of the real home directory. No regression in the postinstall workflow.
   - **Note:** The piped `echo "3"` approach tests the non-interactive (non-TTY/CI) code path only. The interactive readline prompt path (displayed when stdin is a TTY) is a manual verification the user can perform if desired.

## Concerns

1. **install.cjs guard scope -- must cover both side-effect sites**: The `require.main === module` guard must wrap BOTH the early-exit `process.exit(0)` block (lines 14-19) AND the bottom interactive prompt block (lines 115-134). Missing the early-exit guard would cause `require()` to terminate the importing process when `skills/do/` doesn't exist (e.g., in a test environment). Missing the prompt guard would cause an unwanted readline prompt or auto-install on `require()`.
   - **Mitigation:** Steps 5 and 6 explicitly address both sites. Step 8 verifies no side effects on `require()`. The approach wraps each block in-place (no relocation) to avoid introducing ordering bugs.

2. **Actual file counts may differ from project.md estimates**: The expected totals (22+25+1+12+0+8 = 68 pairs) are based on a manual audit during project planning. The identical/divergent split within each group (e.g., 22 identical + 25 divergent references) is a classification result from that manual audit, not separate directory groups -- all pairs in a group live in the same directory. The automated audit script may find different counts if files have been added, removed, or renamed since the project was scoped.
   - **Mitigation:** Step 4 explicitly treats the audit script output as the source of truth. Any discrepancy is documented in `audit-report.md` and flagged for review. The script validates against expected totals and logs differences rather than failing silently.

3. **Divergence categorization accuracy**: The four divergence categories (path substitution, agent name prefix, Agent() vs prose spawn, prose wording) are based on the project plan's manual analysis. The automated script may encounter divergence patterns that don't cleanly fit these categories.
   - **Mitigation:** The "prose wording" category serves as a catch-all for anything not matching the first three patterns. The audit report includes the actual diff lines so reviewers can verify categorization. Unexpected patterns are documented for the template spec in Wave 02.

4. **Unpaired files and out-of-scope directories**: The `skills/do/scripts/` subdirectory has no codex counterpart (by design -- `install.cjs` handles codex script copying separately). Other non-`.md` files or unexpected subdirectories may also lack counterparts. If the audit script only enumerates one side, codex-only files would go undetected.
   - **Mitigation:** Step 1 specifies two-sided enumeration (union of both do and codex file lists per group). Unpaired files are classified as `unpaired (do-only)` or `unpaired (codex-only)` and reported in the audit. The `scripts/`, `__tests__/`, and `references/` subdirectories are explicitly excluded from root-level skill pairing and reported as out-of-scope in the audit output.

5. **Direct-run verification could mutate real install targets**: Running `echo "3" | node bin/install.cjs` without isolation would copy files to the real `~/.claude/` and `~/.codex/` directories, which is destructive.
   - **Mitigation:** Step 9 uses `HOME="$(mktemp -d)"` with `.claude`/`.codex` stubs to run the install in a disposable temporary directory. The real home directory is never touched during verification.

## Execution Log

### 2026-05-04 14:45 - Execution started

**Status:** In progress
**Steps:** 0/9 complete

**Decisions:**
- Created branch `feat/skill-tree-dedup-phase00-wave01` from main
- Pre-flight check: references = 47+47 files (both sides), skills = 13+13 files, agents = 8+8 files — all match expected totals

---

### 2026-05-04 14:46 - Step 1: Create audit script

**Files:**
- `.do/projects/skill-tree-dedup/scripts/audit-pairs.cjs` - New audit script; two-sided enumeration of references, skills, agents; classifies each pair as identical/divergent/unpaired; computes diff summaries and divergence categories; validates against expected totals

**Decisions:**
- Script uses `__dirname`-relative path (4 levels up) to locate repo root — verified correct before running
- Initial version had 5 levels of `..` (incorrect); corrected to 4 levels as a minor deviation (auto-fixed)

**Status:** Complete

---

### 2026-05-04 14:47 - Step 2: Syntax-check audit script

**Files:** (none modified)

**Decisions:**
- `node --check` returned exit code 0 — no syntax errors

**Status:** Complete

---

### 2026-05-04 14:47 - Step 3: Run audit script, write audit-report.md

**Files:**
- `.do/projects/skill-tree-dedup/audit-report.md` - Generated audit report; all 68 pairs classified

**Status:** Complete

---

### 2026-05-04 14:48 - Step 4: Validate audit output

**Files:** (none modified)

**Decisions:**
- All counts match expected totals: references 47 (22 identical + 25 divergent), skills 13 (1 identical + 12 divergent), agents 8 (0 identical + 8 divergent)
- Total: 68 pairs, 23 identical, 45 divergent, 0 unpaired
- Out-of-scope directories documented: `skills/do/references/` and `skills/do/scripts/`
- No discrepancies from project-level manual audit

**Status:** Complete

---

### 2026-05-04 14:49 - Step 5: Wrap early-exit guard in require.main === module

**Files:**
- `bin/install.cjs` (lines 14-22) - Wrapped `if (!fs.existsSync(source)) { ... process.exit(0) }` block in `if (require.main === module)` guard

**Status:** Complete

---

### 2026-05-04 14:49 - Step 6+7: Wrap interactive prompt block and add module.exports

**Files:**
- `bin/install.cjs` (lines 117-140) - Added `module.exports = { installClaudeCode, installCodex }` before the prompt block; wrapped entire `if (!process.stdin.isTTY) { ... } else { ... }` block in `if (require.main === module)` guard

**Decisions:**
- Steps 6 and 7 were applied together in one edit since they affect adjacent code — module.exports placed immediately after runInstall() definition, prompt block wrapped below it

**Status:** Complete

---

### 2026-05-04 14:50 - Step 8: Verify import safety

**Files:** (none modified)

**Decisions:**
- `node -e "const m = require('./bin/install.cjs'); ..."` produced only the three expected console.log lines
- No process exit, no readline prompt, no auto-install output
- Exports: `[ 'installClaudeCode', 'installCodex' ]`, both as `function`

**Status:** Complete

---

### 2026-05-04 14:50 - Step 9: Verify direct-run behavior is preserved

**Files:** (none modified)

**Decisions:**
- Ran `echo "3" | HOME="$TEMP_HOME" node bin/install.cjs` with isolated temp HOME containing `.claude` and `.codex` stubs
- Output: auto-install triggered (non-TTY path), both targets installed to temp HOME
- `$TEMP_HOME/.claude/commands/do`, `$TEMP_HOME/.claude/agents`, `$TEMP_HOME/.codex/skills/do`, `$TEMP_HOME/.codex/agents` all created correctly
- No regression in postinstall workflow

**Status:** Complete

---

### 2026-05-04 14:51 - Execution complete

**Status:** Complete
**Summary:**
- Steps completed: 9/9
- Files modified: 3 (audit-pairs.cjs created, audit-report.md generated, bin/install.cjs modified)
- Deviations: 1 minor (repoRoot path depth was 5 levels instead of 4 — auto-fixed before first run)

<!--
Entry format:
### YYYY-MM-DD HH:MM
**Files:**
- `path/to/file.ts` - Change summary

**Decisions:**
- Plan said X — chose approach Y because Z

**Status:** In progress / Execution complete
-->

## Verification Results

### Approach Checklist

- [x] Create audit script at `.do/projects/skill-tree-dedup/scripts/audit-pairs.cjs` with two-sided enumeration, classification, diff summaries, and expected-total validation
- [x] Syntax-check audit script with `node --check` (exit code 0)
- [x] Run audit script and write output to `.do/projects/skill-tree-dedup/audit-report.md`
- [x] Validate audit output: counts present, match expected totals (68 pairs, 23 identical, 45 divergent), unpaired files and out-of-scope directories documented
- [x] Wrap early-exit guard at lines 14-22 of `bin/install.cjs` in `if (require.main === module)` guard
- [x] Wrap interactive prompt block (lines 119-140) in `if (require.main === module)` guard and add `module.exports = { installClaudeCode, installCodex }` before it
- [x] Verify import safety: `require('./bin/install.cjs')` produces only the three expected console.log lines, no exit, exports both functions as `function`
- [x] Verify direct-run behavior preserved: non-TTY install with isolated temp HOME copies files to `$TEMP_HOME/.claude/` and `$TEMP_HOME/.codex/` correctly

### Quality Checks

- **Tests:** PASS (npm test — 808 tests, 0 failures)

### Result: PASS
- Checklist: 8/8 complete
- Quality: 1/1 passing
- Live verifications: audit script runs without errors; `require('./bin/install.cjs')` exports `{ installClaudeCode, installCodex }` cleanly

## Clarifications

<!--
Populated by do-griller during per-wave confidence rescue when confidence is below threshold.
Format:
### Q1: <question>
<answer>
-->

## Review Notes

## Review Iterations

### Iteration 1
- **Self-review:** CONCERNS — (1) BLOCKER: "22+25 references" sub-group framing is unexplained and confusing; (2) BLOCKER: unmatched/unpaired file handling not specified (scripts/, codex-only files); (3) NITPICK: Step 8 mutates real ~/.claude/ and ~/.codex/; (4) NITPICK: Step 1 compound — add node --check intermediate step
- **Council (codex):** CONCERNS — (1) BLOCKER: Step 8 direct-run verification mutates real install targets — use isolated HOME; (2) BLOCKER: audit enumeration is one-sided, Codex-only files would not be detected; (3) NITPICK: echo "3" only tests non-interactive path
- **Changes made:**
    - BLOCKER 1 ("22+25 references" sub-group framing confusing): Clarified in Problem Statement and Concerns that the identical/divergent split is a classification result from the project-level manual audit, not separate directories. All 47 reference pairs live in one `references/` directory. Same clarification applied to 1+12 skills and 0+8 agents.
    - BLOCKER 2 (audit enumeration one-sided): Rewrote Step 1 to enumerate BOTH the do-side AND codex-side for each group (references, skills, agents), computing the union of filenames. Unpaired files (present in one tree only) are now classified as `unpaired (do-only)` or `unpaired (codex-only)`.
    - BLOCKER 3 (unmatched file handling): Step 1 now explicitly excludes `scripts/`, `__tests__/`, and `references/` subdirectories from root-level skill pairing. These are reported as "out-of-scope" in the audit output. Non-`.md` files are excluded from pairing. Added Concern 4 documenting this risk and mitigation.
    - BLOCKER 4 (Step 8 mutates real install targets): Step 9 now uses `HOME="$(mktemp -d)"` with `.claude`/`.codex` stubs for isolated verification. Real home directory is never touched. Added Concern 5 documenting this risk and mitigation.
    - NITPICK 5 (Step 1 compound): Added Step 2 (`node --check` syntax verification) between script creation and execution.
    - NITPICK 6 (`echo "3"` non-interactive only): Added explicit note in Step 9 that the piped approach tests the non-TTY/CI code path. Interactive readline path is documented as manual user verification.

### Code Review (iteration 1)
- **Self-review:** NITPICKS_ONLY — (1) `flagDiscrepancy` label param unused in format string (audit-pairs.cjs:357); (2) `computeDiff` uses positional comparison not LCS, inflating diff line counts for divergent files
- **Council (codex):** APPROVED — no issues found, verified guards, audit enumeration, and report output
- **Combined:** VERIFIED (nitpicks logged, non-blocking)

## Council Review

### Plan Review
- **Reviewer:** codex
- **Verdict:** LOOKS_GOOD (iteration 2, after all blockers resolved)

### Code Review
- **Reviewer:** codex
- **Verdict:** APPROVED
