---
id: 260505-skill-agent-file-consolidation
created: "2026-05-05T00:00:00Z"
updated: "2026-05-05T15:22:13.447Z"
description: "Consolidate duplicated skill/agent markdown files into single source templates with platform markers, expanded at install time by bin/install.cjs"
related: []
stage: complete
stages:
  refinement: complete
  grilling: complete
  execution: complete
  verification: complete
  abandoned: false
council_review_ran:
  plan: true
  code: true
confidence:
  score: 0.93
  factors: null
  context: -0.03
  scope: -0.02
  complexity: -0.01
  familiarity: -0.01
backlog_item: skill-dedup-research
---

# Skill/Agent File Consolidation

## Problem Statement

The do-lang repo maintains 136 markdown files (60 skills + 60 codex skills + 8 do-agents + 8 codex-agents) where each skill/agent exists as two nearly-identical copies -- one for Claude Code and one for Codex. The differences between copies fall into five categories: (1) agent name prefix (`do-` vs `codex-`), (2) script paths (`~/.claude/commands/do/scripts/` vs `~/.codex/skills/do/scripts/`), (3) agent spawn syntax (Claude uses `Agent({...})` JS blocks; Codex uses prose instructions), (4) `- Agent` in the allowed-tools YAML list (Claude only), and (5) Agent Authorization blocks (Codex only, content varies per file). Twenty reference files are 100% identical across platforms.

This duplication creates a maintenance burden: every content change to a skill or agent must be made twice, and drift between copies has already occurred. The goal is to collapse each pair into a single "template" source file containing platform markers, and have `bin/install.cjs` expand these markers at install time to produce the platform-specific output files.

**Why it matters:** Halves the number of markdown files to maintain (136 -> ~68 templates), eliminates drift risk, and simplifies future skill/agent authoring.

**Acceptance criteria:**
- A single `skills/` directory (replacing `skills/do/` and `skills/codex/`) contains template files with platform markers
- A single `agents/` directory contains template agent files with platform markers
- `bin/install.cjs` expands markers to produce functionally identical output to what currently exists for both Claude Code and Codex installs (source-path references like `skills/do/do.md` in markdown prose are intentionally updated to reflect the new layout — golden fixtures capture the expected post-migration output, not the pre-migration output)
- Existing tests pass (updated to match new source layout)
- A new test validates that template expansion for both platforms produces output byte-identical to committed golden fixtures (golden fixtures capture expected post-migration output with updated source paths)
- 20 identical reference files have no markers at all (they just copy as-is)
- `package.json` `files` field updated if source directory names change
- scripts/ and __tests__/ remain unchanged (not templates)

## Delivery Contract

<!-- No delivery contract — dismissed during onboarding. Executioner uses project defaults. -->

## Clarifications

### Scope (was: -0.15 -> now: -0.05)

**Q:** How will the ~48 diff files get converted to templates? Manual editing, auto-generation script, or something else?
**A:** Auto-generation script inserts <<DO:...>> markers; golden test catches mismatches. A script reads both platform files, identifies diff regions, and inserts markers automatically. Manual review follows.

**Q:** For the 6 high-touch structural tests that scan both `skills/do/` and `skills/codex/` trees, should they scan `skills/` (templates) and verify source structure, or expand templates and verify the expansion output?
**A:** Rewrite structural tests to verify expansion output against goldens. Structural tests compare the expanded content against committed golden fixtures rather than scanning the source template tree.

### Complexity (was: -0.14 -> now: -0.04)

**Q:** The golden snapshot script (step 3) applies source-path rewrites (e.g., `skills/do/do.md` -> `skills/do.md`) to the current output files before committing as goldens. Should the snapshot script handle these path rewrites mechanically, or should the templates encode the correct paths and the expansion engine produce them naturally?
**A:** Approach A chosen (user deferred to best judgment): snapshot script handles path rewrites mechanically as a post-processing step, consistent with the auto-generation approach in Q1. No extra tooling needed.

**Q:** The task has 15 steps across 5 phases, to be done across multiple sessions. Which execution model: single session end-to-end, phased across sessions with checkpoints, or feature-branch with sub-PRs?
**A:** Phased across multiple sessions with explicit checkpoints. Each checkpoint must be verified to confirm everything is working correctly. Tests for file generation must be added at each checkpoint to ensure files are generated properly (not just at the end).

### Auto-generation scope (was: scope -0.05 + complexity -0.04 -> now: scope -0.02, complexity -0.01)

**Q:** The auto-generation script identifies diff regions and inserts markers. Does it handle all 5 diff categories automatically (agent name prefix, script paths, spawn syntax, `- Agent` tool list, Agent Authorization blocks), or are some categories handled manually?
**A:** Handle all 5 categories automatically; manual review catches mistakes. User confirmed this makes sense because spawn syntax diffs follow consistent patterns (Agent({...}) code fences vs "Spawn the codex-..." prose paragraphs) and the golden regression test catches any misses.

### Checkpoint test gate strategy (was: familiarity -0.03 -> now: -0.01)

**Q:** The task is phased across multiple sessions with checkpoints. What does "verified" mean at each checkpoint -- does `npm test` need to pass fully (including the golden regression test), or only the tests relevant to the completed phase?
**A:** npm test passes at each checkpoint (existing + new phase tests green), golden regression test allowed to fail until Phase 3 templates exist.

## Context Loaded

- `database/projects/do/project.md` -- project conventions, directory layout, agent pipeline, release flow, install details
- `bin/install.cjs` -- current installer: `installClaudeCode()`, `installCodex()`, file copy logic, SKILL.md wrapper generation, `shouldInstallRuntimeScriptFile` filter
- `skills/do/scripts/__tests__/install-package-contract.test.cjs` -- integration test: packs tarball, runs install, asserts file presence and wrapper content
- `skills/do/scripts/__tests__/install-codex.test.cjs` -- unit test: `installCodex()`/`installClaudeCode()` assertions for runtime tree, agents, wrappers, test exclusion
- `CLAUDE.md` (repo root) -- conventional commits, branch naming, skill-creator reminder
- Representative diffs of all five difference categories across skills and agents

## Approach

### Directory Layout (resolved)

The final directory structure after migration:

```
skills/
  task.md              # skill templates (top-level, no subdirectory)
  continue.md
  debug.md
  ...                  # 13 skill templates total
  references/          # reference templates (47 files)
    task-template.md
    stage-execute.md
    ...
  scripts/             # NOT templates, copied as-is (moved from skills/do/scripts/)
    __tests__/         # all 24 test files
    load-task-context.cjs
    ...
agents/
  planner.md           # agent templates, bare role names (8 files)
  executioner.md
  ...
bin/
  install.cjs          # updated to use expansion engine
  expand-templates.cjs # NEW: expansion engine
```

Key decisions:
- Skill templates live directly in `skills/` (no `templates/` subdirectory) -- after `skills/do/` and `skills/codex/` are removed, there is no ambiguity
- Reference templates live at `skills/references/` (not `skills/templates/references/`)
- Scripts move from `skills/do/scripts/` to `skills/scripts/` -- one level up, still under `skills/`
- Agent templates use bare role names (`planner.md`, not `do-planner.md`) -- the installer prepends the platform prefix when writing output filenames

### Marker Syntax (resolved -- namespaced to avoid collision)

Existing files already use `{{TASK_ID}}`, `{{VISION_ANSWER}}`, `{{#if USER_OVERRIDE}}`, `{{#if BELOW_THRESHOLD}}`, etc. as runtime placeholders for scripts and templates. The expansion engine MUST NOT collide with these.

**All platform markers use the `<<DO:...>>` delimiter family:**

- **Simple substitution**: `<<DO:AGENT_PREFIX>>` expands to `do` or `codex`
- **Script path**: `<<DO:SCRIPTS_PATH>>` expands to `~/.claude/commands/do/scripts` or `~/.codex/skills/do/scripts`
- **Platform-conditional blocks** (multi-line):
  ```
  <<DO:IF CLAUDE>>
  ...claude-only content...
  <<DO:ENDIF>>

  <<DO:IF CODEX>>
  ...codex-only content...
  <<DO:ENDIF>>
  ```
- **Platform-specific inline text** (single-line shorthand for platform-only instructions):
  ```
  <<DO:CLAUDE:Use the Agent tool to spawn subagents>>
  <<DO:CODEX:Use spawn_agent to spawn subagents>>
  ```
  On the matching platform, expands to just the text after the second colon. On the other platform, the entire marker (including the line) is stripped. This is syntactic sugar for single-line `<<DO:IF ...>>...<<DO:ENDIF>>` blocks — use it for inline platform-specific instructions, behavioral notes, or short prose differences. Use the block form for multi-line content.

The expansion engine recognizes ONLY patterns matching `<<DO:...>>`. All `{{...}}` text passes through verbatim, untouched. Unknown `<<DO:...>>` markers cause an error (fail-fast, not silent passthrough).

**Convention for future do-lang development:** When adding new skills, agents, or features, always use the template markers. Write the template once in `skills/` or `agents/`, and use `<<DO:CLAUDE:...>>` / `<<DO:CODEX:...>>` inline markers for platform-specific behavioral instructions. This replaces the old workflow of writing the same file twice.

### Phase 1: Build the expansion engine and its tests

1. **Create `bin/expand-templates.cjs`** implementing the expansion engine.
   - Exports `expandTemplate(content, platform)` where platform is `"claude"` or `"codex"`. Returns the expanded string.
   - Exports `expandFile(srcPath, destPath, platform)` for file-level convenience.
   - **Implementation: token scanner + stack parser** (not regex-only). Scan the input for `<<DO:...>>` tokens; use a stack to track open `IF` blocks and match them to `ENDIF`. This handles nested conditionals correctly and produces clear error messages for unclosed `IF` or unmatched `ENDIF`.
   - Simple substitution markers (`<<DO:AGENT_PREFIX>>`, `<<DO:SCRIPTS_PATH>>`) are replaced inline during the scan pass.
   - `<<DO:IF CLAUDE>>...<<DO:ENDIF>>` -> include block for Claude, strip for Codex (and vice versa for `<<DO:IF CODEX>>`). Blocks may be nested.
   - `<<DO:CLAUDE:text>>` / `<<DO:CODEX:text>>` -> inline platform-specific text. On matching platform, expands to `text`. On other platform, the entire line containing the marker is removed (to avoid blank lines). If the marker is mid-line (not the whole line), only the marker itself is removed, not the surrounding text.
   - Any unrecognized `<<DO:...>>` token throws an error.
   - All `{{...}}` content passes through unchanged (the scanner ignores anything not matching `<<DO:...>>`).
   - Preserves all whitespace, trailing newlines, and line endings exactly. Comparison is strict byte-identical — no line ending normalization.

   File: `bin/expand-templates.cjs`
   Expected outcome: Module exports both functions, handles all marker types.

2. **Write unit tests for the expansion engine** before building templates. Cover:
   - All three marker types (substitution, path, conditional)
   - `{{...}}` passthrough -- verify that `{{TASK_ID}}`, `{{#if BELOW_THRESHOLD}}`, `{{/if}}` etc. survive expansion unchanged
   - Nested conditionals
   - Markers inside code fences
   - Markers at file start/end
   - Unknown `<<DO:FOOBAR>>` raises an error
   - Empty conditional blocks
   - Adjacent conditional blocks (`<<DO:IF CLAUDE>>...<<DO:ENDIF>><<DO:IF CODEX>>...<<DO:ENDIF>>`)
   - Unclosed `<<DO:IF CLAUDE>>` without `<<DO:ENDIF>>` raises error
   - Unmatched `<<DO:ENDIF>>` without open `IF` raises error
   - Invalid platform in `<<DO:IF FOOBAR>>` raises error
   - Inline platform text: `<<DO:CLAUDE:some text>>` expands on claude, stripped on codex (and vice versa)
   - Inline platform text as whole line: entire line removed on non-matching platform (no blank line left)
   - Inline platform text mid-line: only marker removed, surrounding text preserved
   - Invalid platform in inline marker `<<DO:FOOBAR:text>>` raises error

   File: `skills/do/scripts/__tests__/expand-templates.test.cjs` (written to the current location in Phase 1; step 8's directory move relocates it to `skills/scripts/__tests__/` naturally)
   Expected outcome: Tests pass with `node --test`.

### Phase 2: Create golden regression fixtures (committed permanently)

3. **Generate golden output snapshots** for both platforms. Write a one-time script `bin/snapshot-golden.cjs` that reads every current Claude Code and Codex output file (skills + agents), applies source-path updates (replacing `skills/do/` references in markdown prose with the new layout paths), and writes them into a committed fixture directory.

   The golden fixtures capture the **expected post-migration output** — not the pre-migration files verbatim. This means source-path references like `skills/do/do.md` in markdown prose are updated to `skills/do.md` in the golden files. The expansion engine's `<<DO:...>>` markers handle platform-specific differences; the golden snapshot script handles source-path modernization.

   The golden fixtures are committed to the repo permanently at `test-fixtures/golden/claude/` and `test-fixtures/golden/codex/` (top-level, outside `skills/` to avoid being packaged via `package.json` `files: ["skills"]`). They serve as the byte-identical acceptance gate: template expansion for platform X must produce output that matches golden/X exactly.

   File: `bin/snapshot-golden.cjs` (one-time generation script, removed after fixtures committed)
   Expected outcome: `test-fixtures/golden/claude/` and `test-fixtures/golden/codex/` trees committed. Not included in npm package.

4. **Write a regression test** that expands every template for both platforms and diffs against the committed golden fixtures. Each template file is expanded for `"claude"` and `"codex"`, and the output is compared byte-for-byte against the corresponding golden file.

   This test is the primary acceptance gate and remains in the test suite permanently. When templates are later updated intentionally, the golden fixtures are updated in the same commit.

   File: `skills/scripts/__tests__/template-regression.test.cjs`
   Expected outcome: Test fails initially (no templates yet), harness ready.

### Phase 3: Create templates from current files

5. **Create agent templates** in `agents/`. For each of the 8 agent pairs, produce one template file using bare role names. Replace:
   - `do-planner` / `codex-planner` occurrences with `<<DO:AGENT_PREFIX>>-planner` (and similarly for all roles)
   - Script paths with `<<DO:SCRIPTS_PATH>>`
   - `- Agent` in tools list: wrap in `<<DO:IF CLAUDE>>...<<DO:ENDIF>>`
   - Agent Authorization blocks: wrap in `<<DO:IF CODEX>>...<<DO:ENDIF>>`
   - Agent spawn syntax: `<<DO:IF CLAUDE>>...<<DO:ENDIF>>` for `Agent({...})` blocks, `<<DO:IF CODEX>>...<<DO:ENDIF>>` for prose instructions

   Files: `agents/planner.md`, `agents/executioner.md`, `agents/code-reviewer.md`, `agents/council-reviewer.md`, `agents/debugger.md`, `agents/griller.md`, `agents/plan-reviewer.md`, `agents/verifier.md`
   Expected outcome: 8 template files replace 16 agent files.

6. **Create skill templates** in `skills/` (top-level). For each of the 13 top-level skill pairs, produce one template. Replace:
   - Agent name references with `<<DO:AGENT_PREFIX>>-<role>`
   - Script paths with `<<DO:SCRIPTS_PATH>>`
   - `- Agent` in allowed-tools YAML: wrap in `<<DO:IF CLAUDE>>...<<DO:ENDIF>>`
   - Agent Authorization blocks: wrap in `<<DO:IF CODEX>>...<<DO:ENDIF>>`
   - Agent spawn syntax: `<<DO:IF CLAUDE>>...<<DO:ENDIF>>` for `Agent({...})` blocks, `<<DO:IF CODEX>>...<<DO:ENDIF>>` for prose spawn instructions. Where context differs only in agent names (not structure), use `<<DO:AGENT_PREFIX>>` substitution and keep a single copy.

   Files: `skills/task.md`, `skills/continue.md`, `skills/debug.md`, etc. (13 files)
   Expected outcome: 13 template files replace 26 top-level skill files.

7. **Create reference templates** in `skills/references/`. For the 20 identical files, copy as-is (no markers). For the 27 files with diffs, apply the same marker patterns as step 6. The Agent Authorization notes in reference files are Codex-only and vary per file -- each gets its own `<<DO:IF CODEX>>...<<DO:ENDIF>>` block.

   Files: `skills/references/*.md` (47 files)
   Expected outcome: 47 template reference files replace 94 reference files.

8. **Relocate `scripts/` and `__tests__/`** -- move `skills/do/scripts/` to `skills/scripts/`. This is the concrete decision: scripts live at `skills/scripts/`, one level up from the old `skills/do/scripts/`. These are NOT templates; they are copied as-is during install. The `__tests__/` directory stays nested at `skills/scripts/__tests__/`.

   File: directory restructure (rename `skills/do/scripts/` to `skills/scripts/`)
   Expected outcome: Scripts remain in the package at a well-defined path. All downstream references use `skills/scripts/`.

8b. **Update ALL scripts and source files that reference `skills/do/` paths.** After the directory move, every `skills/do/` reference in the repo must be updated — functional path construction AND comment-only references. Known files with functional path breakage:
   - `council-gate.cjs` — dev-mode path resolves `skills/do/scripts/council-invoke.cjs`
   - `council-invoke.cjs` — `__dirname`-relative `../references/...` paths (lines ~1035-1036)
   - `optimise-target.cjs` — scans `skills/do/*.md`, `skills/do/scripts/*.cjs`, `skills/do/references/*.md`, `agents/do-*.md` for file listing and peer patterns; emits `skills/do/` prefixed paths in output
   - `project-scaffold.cjs` — `path.resolve(__dirname, '..', 'references')` (line ~162)

   Files with comment-only `skills/do` references (still update for consistency):
   - `project-resume.cjs`
   - `project-state.cjs`
   - `validate-delivery-contract.cjs`

   For each file: update all `skills/do/` references to `skills/` (one level flatter). For `__dirname`-relative paths (`../references/`), verify the new relative depth — since both `scripts/` and `references/` move up one level together, `../references/` remains correct.

   Also grep for any other `.cjs` files referencing `skills/do` that weren't enumerated above, and fix those too.

   Files: `skills/scripts/council-gate.cjs`, `skills/scripts/council-invoke.cjs`, `skills/scripts/optimise-target.cjs`, `skills/scripts/project-scaffold.cjs`, `skills/scripts/project-resume.cjs`, `skills/scripts/project-state.cjs`, `skills/scripts/validate-delivery-contract.cjs`, and any others found via grep
   Expected outcome: Zero occurrences of `skills/do/` remain in any `.cjs` file. Runtime scripts resolve paths correctly from the new `skills/scripts/` location.

### Phase 4: Update the installer

9. **Rewrite `bin/install.cjs`** to use the template expansion engine instead of copying from separate source trees. Key changes:
   - Import `expandTemplate` from `./expand-templates.cjs`
   - `installClaudeCode()`: iterate `skills/*.md`, `skills/references/*.md`, and `agents/*.md` template files; call `expandTemplate(content, "claude")`; write to `~/.claude/commands/do/` and `~/.claude/agents/`
   - `installCodex()`: same iteration; call `expandTemplate(content, "codex")`; write to `~/.codex/skills/do/` and `~/.codex/agents/`
   - Agent output filenames: `{prefix}-{role}.md` (e.g., `do-planner.md` for Claude, `codex-planner.md` for Codex) -- derived from template filename + platform
   - Scripts: copy from `skills/scripts/` as-is (no expansion). Update `shouldInstallRuntimeScriptFile` filter to exclude the entire `__tests__/` directory (not just `install-*` prefixed files) — prevents new test files like `template-regression.test.cjs` and `expand-templates.test.cjs` from being copied to user runtime trees
   - SKILL.md wrapper generation: unchanged
   - Interactive prompt: unchanged
   - Exports: still export `installClaudeCode` and `installCodex`

   File: `bin/install.cjs`
   Expected outcome: Both install functions produce identical output to current behavior.

10. **Update `package.json`**: The `files` field already includes `"skills"`, `"agents"`, and `"bin"`, so the top-level glob covers the new layout. Update the `test` script path from `skills/do/scripts/__tests__/*.test.cjs` to `skills/scripts/__tests__/*.test.cjs`.

    File: `package.json`
    Expected outcome: `npm pack` includes all templates, scripts, agents, and bin. `npm test` finds the test files.

### Phase 5: Update ALL test files and validate

11. **Update all 24 test files** to reflect the new source directory layout. Every test file currently under `skills/do/scripts/__tests__/` moves to `skills/scripts/__tests__/` and contains hardcoded references to `skills/do` or `skills/codex` source paths. The complete list of files requiring path updates:

    **High-touch files** (3+ path references, likely need logic changes too):
    - `optimise-target.test.cjs` (8 refs)
    - `delivery-contract-structural.test.cjs` (7 refs)
    - `bug-fix-structural.test.cjs` (7 refs)
    - `task-workflow-structural.test.cjs` (4 refs)
    - `beta-skill-structural.test.cjs` (4 refs)
    - `optimization-guard.test.cjs` (3 refs)

    **Medium-touch files** (2 path references):
    - `project-scaffold.test.cjs`
    - `project-lifecycle-roundtrip.test.cjs`
    - `council-invoke.test.cjs`

    **Low-touch files** (1 path reference each):
    - `install-codex.test.cjs`
    - `install-package-contract.test.cjs`
    - `agent-frontmatter-gates.test.cjs`
    - `beta-backlog-integration.test.cjs`
    - `check-database-entry.test.cjs`
    - `debug-session.test.cjs`
    - `detect-tools.test.cjs`
    - `load-task-context.test.cjs`
    - `project-health.test.cjs`
    - `project-resume.test.cjs`
    - `project-state.test.cjs`
    - `stage-decision.test.cjs`
    - `task-abandon.test.cjs`
    - `validate-delivery-contract.test.cjs`
    - `validate-slug.test.cjs`

    For each file:
    - Update `path.join(ROOT, 'skills', 'do', ...)` to `path.join(ROOT, 'skills', ...)`
    - Update `path.join(ROOT, 'skills', 'codex', ...)` references where they exist (structural tests that scan both trees)
    - Update relative `require()` paths if directory depth changed
    - Structural tests that enumerate files in `skills/do/` and `skills/codex/` need to scan `skills/` (templates) instead, and may need to verify expansion output rather than source files directly

    Files: all 24 test files in `skills/scripts/__tests__/`
    Expected outcome: `npm test` passes with all 24 tests green.

12. **Run the golden regression test** (step 4) to confirm template expansion produces byte-identical output for both platforms.

    Expected outcome: All diffs are zero. This is the acceptance gate.

13. **Remove old source directories**: delete `skills/do/` (now empty -- markdown moved to `skills/`, scripts moved to `skills/scripts/`), `skills/codex/` (entirely replaced by templates), and the 16 individual prefixed agent files in `agents/` (replaced by 8 bare-name templates).

    Expected outcome: Repo has ~68 template files + 8 agent templates instead of 136 duplicated files + 16 agents.

14. **Update README.md and project.md** with the new source layout. Specifically:
    - Update the test runner command (`node --test skills/do/scripts/__tests__/*.test.cjs` -> `node --test skills/scripts/__tests__/*.test.cjs`)
    - Update any directory layout descriptions that reference `skills/do/`, `skills/codex/`, or `agents/do-*.md`/`agents/codex-*.md`
    - Update `database/projects/do/project.md` Key Directories table

    Files: `README.md`, `database/projects/do/project.md`
    Expected outcome: Documentation accurately reflects the new source layout.

15. **Remove the one-time snapshot script** (`bin/snapshot-golden.cjs`). The golden fixtures at `test-fixtures/golden/` remain committed and the regression test (step 4) remains permanent.

    Files: remove `bin/snapshot-golden.cjs` only
    Expected outcome: Permanent test suite validates template correctness via committed golden fixtures. Future template changes require updating golden fixtures in the same commit (test failure enforces this).

## Concerns

### Risk 1: Agent spawn syntax is structurally different, not just a string swap
**Severity:** High
**Detail:** Claude Code uses fenced JavaScript `Agent({...})` blocks while Codex uses prose ("Spawn the codex-planner subagent with model..."). These are not simple prefix swaps -- the surrounding markdown structure differs (code fence vs paragraph, JS object syntax vs natural language). Each spawn site needs a `<<DO:IF CLAUDE>>...<<DO:ENDIF>><<DO:IF CODEX>>...<<DO:ENDIF>>` pair, and there are ~20 spawn sites across all files.
**Mitigation:** The shared content (prompt text inside each spawn) is identical between platforms -- only the wrapper differs. Factor the template so the prompt content appears once, with only the spawn-instruction wrapper being conditional. The golden regression test (step 4/12) catches any expansion mismatch byte-for-byte.

### Risk 2: Agent Authorization blocks vary per file
**Severity:** Medium
**Detail:** Each Codex skill/reference file has a unique authorization table listing the specific agents that file is allowed to spawn. These are not formulaic -- they name different agents and have different prose context.
**Mitigation:** Each template keeps its own `<<DO:IF CODEX>>...<<DO:ENDIF>>` block with the file-specific authorization content. This is not DRY-able across files and that is acceptable -- the goal is deduplication across platforms, not across files.

### Risk 3: Byte-identical output is hard to guarantee
**Severity:** Medium
**Detail:** Whitespace, trailing newlines, and line ending differences between the template expansion and the original files could cause false regression failures or mask real differences.
**Mitigation:** Golden fixtures committed from current files serve as the ground truth. The expansion engine preserves all whitespace exactly. Comparison is strict byte-identical (no line ending normalization) — the golden fixtures capture the exact bytes the current files produce, and the engine must reproduce them exactly. The golden regression test runs early (Phase 2) and iterates on the expansion engine before creating all templates.

### Risk 4: Large scope -- 68 files to template-ize plus 24 test files
**Severity:** High (upgraded from Medium)
**Detail:** Each of the ~48 files with diffs needs marker insertion, and all 24 test files need path updates. This is the largest risk factor for the task.
**Mitigation:** (a) Automate initial template creation: write a script that reads both platform files, identifies diff regions, and inserts `<<DO:...>>` markers. Then manually review each template. (b) For test files, batch the low-touch files (15 files, 1 ref each) as a mechanical find-and-replace pass, then handle the 6 high-touch files individually. (c) The golden regression test validates correctness end-to-end.

### Risk 5: Test file paths change when scripts/ moves
**Severity:** Medium (upgraded from Low)
**Detail:** All 24 test files under `skills/do/scripts/__tests__/` use relative paths like `require("../../../../bin/install.cjs")`. When scripts move to `skills/scripts/`, the relative depth to `bin/` changes (from 4 levels up to 3 levels up). Additionally, `package.json`'s `test` script path must change.
**Mitigation:** Step 11 explicitly handles all 24 files with a categorized update plan. The `package.json` test path is updated in step 10. Run `npm test` as the final validation gate.

### Risk 6: Downstream consumers who pin specific file paths
**Severity:** Low
**Detail:** If any external tooling or documentation references `skills/do/` or `skills/codex/` source paths (not install paths), those references break.
**Mitigation:** Install paths (`~/.claude/commands/do/`, `~/.codex/skills/do/`) are unchanged. Source paths are internal to the package. Check README and project.md for references to update.

### Risk 8: Runtime scripts and markdown files hardcode `skills/do/` source paths
**Severity:** Medium
**Detail:** Several runtime scripts (`council-gate.cjs`, `council-invoke.cjs`, `optimise-target.cjs`, `project-scaffold.cjs`) contain functional `skills/do/` path references that break at runtime. Additional scripts have comment-only references. Some markdown skill files also reference `skills/do/` paths in prose (e.g., `skills/do/do.md` in file-reference tables).
**Mitigation:** Step 8b handles all `.cjs` files (functional + comments). The golden snapshot script (step 3) handles markdown prose path updates. The `__dirname`-relative paths in `council-invoke.cjs` and `project-scaffold.cjs` (`../references/`) remain correct because both `scripts/` and `references/` move up one level together.

### Risk 7: Golden fixture maintenance burden
**Severity:** Low
**Detail:** Committed golden fixtures mean every future template content change requires updating the golden files in the same commit.
**Mitigation:** This is intentional -- it enforces that template changes are verified against expected output. A helper script or test flag (e.g., `UPDATE_GOLDEN=1 npm test`) can regenerate golden fixtures from current templates, reducing the manual burden to a single command.

## Execution Log

### 2026-05-05 14:30 - Execution started

**Status:** In progress
**Steps:** 0/4 complete (Phase 1-2 only)

**Baseline:** 829 tests, 0 failures (node --test skills/do/scripts/__tests__/*.test.cjs)

### 2026-05-05 15:10 - Step 1: Create bin/expand-templates.cjs

**Files:**

- `bin/expand-templates.cjs` - Expansion engine with token scanner + stack parser. Exports `expandTemplate(content, platform)` and `expandFile(srcPath, destPath, platform)`. Handles all marker types: `<<DO:AGENT_PREFIX>>`, `<<DO:SCRIPTS_PATH>>`, `<<DO:IF CLAUDE/CODEX>>...<<DO:ENDIF>>`, `<<DO:CLAUDE:text>>` / `<<DO:CODEX:text>>`. All `{{...}}` passes through verbatim. Unknown markers throw.

**Decisions:**

- Token scanner uses regex `<<DO:([^>]*)>>` to split input into TEXT and marker tokens
- Stack parser tracks nested IF blocks; throws on unclosed IF or unmatched ENDIF
- Inline whole-line strip: uses `eatLinePrefix` + `eatLeadingNewline` instruction objects in the parts array, resolved in a post-processing pass
- `<<DO:...>>` cannot be nested inside inline marker text (e.g., `<<DO:CODEX:text with <<DO:AGENT_PREFIX>>` would not work) — the regex ends at first `>` sequence. This is a known limitation; the spec doesn't require nesting.

**Status:** Complete

### 2026-05-05 15:30 - Step 2: Write unit tests for expansion engine

**Files:**

- `skills/do/scripts/__tests__/expand-templates.test.cjs` - 48 tests covering all marker types, passthrough, nested conditionals, code fences, file boundaries, error cases, whitespace preservation, and combined scenarios.

**Decisions:**

- Fixed test expectations for trailing-newline edge cases: the `\n` before a stripped IF block or inline marker belongs to the preceding content line, so it's preserved when the block is stripped. Updated 2 tests to reflect this correct behavior.
- Updated ROOT path from 5 levels up to 4 levels up (file is 4 dirs deep from repo root: `skills/do/scripts/__tests__/`).
- Removed test case that nested `<<DO:AGENT_PREFIX>>` inside an inline `<<DO:CODEX:...>>` marker — this is not supported by the scanner and not required by the spec. Replaced with a literal text inline marker.

**Status:** Complete (48/48 pass)

### 2026-05-05 15:45 - Step 3: Generate golden output snapshots

**Files:**

- `bin/snapshot-golden.cjs` - One-time script that reads all Claude Code and Codex source files (skills + agents), applies source-path rewrites, and writes golden fixtures.
- `test-fixtures/golden/claude/` - 68 files (13 skills + 47 references + 8 agents)
- `test-fixtures/golden/codex/` - 68 files (same structure)

**Decisions:**

- Source-path rewrite rules applied: `skills/do/` -> `skills/`, `skills/codex/` -> `skills/`, `skills/do/references/` -> `skills/references/`, `skills/codex/references/` -> `skills/references/`, `agents/do-role.md` -> `agents/role.md`, `agents/codex-role.md` -> `agents/role.md`
- Agent golden files use bare role names (e.g. `planner.md`) since templates will use bare names and the installer prepends the prefix
- Golden files verify rewrites applied: no `skills/do/` references remain in any golden file

**Status:** Complete

### 2026-05-05 15:55 - Step 4: Write regression test harness

**Files:**

- `skills/scripts/__tests__/template-regression.test.cjs` - Permanent regression test that expands every template for both platforms and compares byte-for-byte against golden fixtures. Includes UPDATE_GOLDEN=1 mode for regenerating fixtures.

**Decisions:**

- Created `skills/scripts/__tests__/` directory early (Phase 3 step 8 will move `skills/do/scripts/` here; the empty dir is fine in the interim)
- ROOT path: 3 levels up from `skills/scripts/__tests__/` (correct for this file's permanent location)
- `listMdRelative` skips `do/` and `codex/` subdirectories so it only finds post-migration template files (not pre-migration platform directories)
- Agent templates filter out `do-*` and `codex-*` prefixed files so only bare-role templates are tested
- Phase 2 behavior: test fails with clear "No template files found" message — exactly as specified in checkpoint gate

### 2026-05-05 16:00 - Phase 1-2 execution complete

**Status:** Checkpoint reached
**Summary:**

- Steps completed: 4/4 (Phase 1 + Phase 2)
- Files created: 6 (bin/expand-templates.cjs, bin/snapshot-golden.cjs, skills/do/scripts/__tests__/expand-templates.test.cjs, skills/scripts/__tests__/template-regression.test.cjs, test-fixtures/golden/claude/ tree, test-fixtures/golden/codex/ tree)
- Deviations: 3 minor (auto-fixed)
  - Path depth in expand-templates.test.cjs (4 levels, not 5)
  - Path depth in template-regression.test.cjs (3 levels, not 4 initially)
  - Test expectation for trailing newlines (behavior is correct, expectations adjusted)

**Checkpoint gate:**

- `node --test skills/do/scripts/__tests__/*.test.cjs` -> 877 tests, 877 pass, 0 fail
- Regression test runnable, fails with "No template files found" (expected at Phase 2)

### 2026-05-05 17:30 - Phase 3 execution started

**Status:** In progress
**Steps:** 4/8b complete (Phase 1-2 done, Phase 3 in progress)

### 2026-05-05 18:15 - Steps 5, 6, 7: Create all templates (agents, skills, references)

**Files:**

- `agents/planner.md`, `agents/executioner.md`, `agents/code-reviewer.md`, `agents/council-reviewer.md`, `agents/debugger.md`, `agents/griller.md`, `agents/plan-reviewer.md`, `agents/verifier.md` - 8 agent templates with bare role names
- `skills/task.md`, `skills/continue.md`, `skills/debug.md`, `skills/do.md`, `skills/fast.md`, `skills/quick.md`, `skills/project.md`, `skills/abandon.md`, `skills/backlog.md`, `skills/scan.md`, `skills/update.md`, `skills/optimise.md`, `skills/init.md` - 13 skill templates (init.md has no markers, identical between platforms)
- `skills/references/*.md` - 47 reference templates (20 identical, 27 with markers)
- `bin/generate-templates.cjs` - One-time auto-generation script that reads golden fixtures, normalizes both platform files, diffs, and inserts `<<DO:...>>` markers
- `bin/expand-templates.cjs` - Engine fix: inactive IF blocks no longer emit `eatLeadingNewline`, preventing newline consumption from content after the block

**Decisions:**

- Built an auto-generation script (`bin/generate-templates.cjs`) rather than manual template creation. It reads both golden fixtures, normalizes platform-specific strings (prefix, paths, text subs), marks Agent spawn blocks to prevent LCS cross-matching, diffs remaining differences, and wraps them in IF blocks.
- Fixed a bug in the expansion engine where inactive IF blocks consumed an extra newline. The IF marker's `eatLeadingNewline` instruction was "reaching past" the inactive block to eat from content after the ENDIF. Fix: only emit `eatLeadingNewline` from IF when the block is active.
- All 5 diff categories handled automatically: (1) agent prefix substitution, (2) script path substitution, (3) Agent spawn syntax as IF CLAUDE/IF CODEX blocks, (4) `- Agent` in tools list as IF CLAUDE, (5) Agent Authorization blocks as IF CODEX.
- Platform text differences (Claude Code/Codex, agent/subagent spawning, etc.) normalized using `<<NORM:...>>` temporary markers, then denormalized to `<<DO:CLAUDE:text>><<DO:CODEX:text>>` inline markers.
- Trailing block boundary fix: when LCS misaligns blank lines at file boundaries with IF blocks, post-processing adjusts blank line placement inside/outside blocks to ensure both platforms expand correctly.

**Verification:** All 68 templates verified: `expandTemplate(template, "claude")` matches golden/claude exactly, `expandTemplate(template, "codex")` matches golden/codex exactly. Zero mismatches.

**Status:** Complete

### 2026-05-05 18:45 - Step 8: Relocate scripts/ directory

**Files:**

- `skills/scripts/` - Copied all runtime scripts, __tests__/, and lib/ from `skills/do/scripts/`
- `skills/scripts/__tests__/` - Now contains 26 test files (25 original + 1 regression test from Phase 2)

**Decisions:**

- Used cp (not mv) since the old `skills/do/scripts/` still needs to exist for the original test suite (the old tests use relative paths that point 4 levels up to find `bin/`). Phase 5 will update test paths and remove the old directory.
- Merged `skills/scripts/__tests__/` (had `template-regression.test.cjs` from Phase 2) with the 25 existing test files.

**Status:** Complete

### 2026-05-05 19:00 - Step 8b: Update runtime script path references

**Files:**

- `skills/scripts/council-gate.cjs` - `skills/do/scripts/council-invoke.cjs` -> `skills/scripts/council-invoke.cjs` (dev-mode path)
- `skills/scripts/optimise-target.cjs` - Updated 13 occurrences: `skills/do/scripts/`, `skills/do/`, `skills/do/references/` -> `skills/scripts/`, `skills/`, `skills/references/` (functional paths + output strings + comments)
- `skills/scripts/project-scaffold.cjs` - Updated 2 comments: `skills/do/references/` -> `skills/references/`, `skills/do/scripts/` -> `skills/scripts/` (relative `../references/` path unchanged -- correct since both dirs moved up one level together)
- `skills/scripts/project-resume.cjs` - Comment-only: `skills/do/project.md` -> `skills/project.md`
- `skills/scripts/project-state.cjs` - Comment-only: `skills/do/scripts/debug-session.cjs` -> `skills/scripts/debug-session.cjs`
- `skills/scripts/validate-delivery-contract.cjs` - Comment-only: `skills/do/scripts/lib/validate-slug.cjs` -> `skills/scripts/lib/validate-slug.cjs`, `skills/do/references/delivery-contract.md` -> `skills/references/delivery-contract.md`
- `skills/scripts/lib/validate-slug.cjs` - Comment-only: `skills/do/scripts/task-abandon.cjs` -> `skills/scripts/task-abandon.cjs`
- `bin/expand-templates.cjs` - Engine fix: inactive IF blocks no longer emit `eatLeadingNewline` (functional fix for template expansion correctness)

**Decisions:**

- `council-invoke.cjs` relative `../references/` paths at lines 1035-1036 are UNCHANGED -- they remain correct because both `scripts/` and `references/` moved up one level together.
- Install paths (`~/.claude/commands/do/scripts/`, `~/.codex/skills/do/scripts/`) are NOT touched -- these are user-facing install locations, not source repo paths.
- `bin/install.cjs` references to `skills/do/` left for Phase 4 (installer rewrite).
- Test files (`__tests__/*.test.cjs`) have `skills/do` references but are left for Phase 5 (Step 11).

**Verification:** Zero occurrences of `skills/do` remain in any runtime `.cjs` file (excluding install paths and test files).

**Status:** Complete

### 2026-05-05 19:05 - Phase 3 execution complete

**Status:** Checkpoint reached
**Summary:**

- Steps completed: 4 (steps 5, 6, 7, 8, 8b -- Phase 3)
- Files created: 68 templates (8 agents + 13 skills + 47 references) + 1 generator script
- Files modified: 8 runtime scripts (path updates) + 1 engine fix
- Deviations: 1 minor (engine fix for inactive IF block newline handling -- discovered during template verification)

**Checkpoint gate:**

- `node --test skills/do/scripts/__tests__/*.test.cjs` -> 877 tests, 877 pass, 0 fail (existing tests from original location)
- `node --test skills/scripts/__tests__/template-regression.test.cjs` -> 137 tests, 137 pass, 0 fail (all templates expand correctly for both platforms)
- `node --test skills/do/scripts/__tests__/expand-templates.test.cjs` -> 48 tests, 48 pass, 0 fail (engine unit tests still pass after fix)

### 2026-05-05 20:00 - Phase 4-5 execution started

**Status:** In progress
**Steps:** 8b/15 complete (Phases 1-3 done, Phases 4-5 in progress)

### 2026-05-05 21:30 - Steps 9-15: Phases 4-5 complete

**Files:**

- `bin/install.cjs` - Rewritten to use `expandTemplate()` from expand-templates.cjs. `listMdFiles()` helper iterates `skills/*.md`, `skills/references/*.md`, `agents/*.md` (bare names only). Expands for "claude" or "codex". Agent output filenames: `{prefix}-{role}.md`. `shouldInstallRuntimeScriptFile` widened to exclude entire `__tests__/` directory (not just `install-*` prefix). Scripts copied from `skills/scripts/` as-is.
- `package.json` - Test script path updated from `skills/do/scripts/__tests__/` to `skills/scripts/__tests__/`
- `skills/scripts/__tests__/` - All 26 test files updated:
  - ROOT paths: 4 levels deep → 3 levels deep (files moved from `skills/do/scripts/__tests__/` to `skills/scripts/__tests__/`)
  - `skills/do/` → `skills/` path references in all constants
  - `skills/do/scripts/` → `skills/scripts/` constants
  - `require("../../../../bin/")` → `require("../../../bin/")`
  - Added `expandTemplate` + `readExpanded()` helper to 5 structural/guard tests for correct template content checking
  - Agent file references updated: `do-*.md` → bare role names (`verifier.md`, `executioner.md`, etc.)
  - Comment-only `Run: node --test skills/do/...` → `skills/...` across all files
  - `install-package-contract.test.cjs`: checks for `skills/project.md` and `agents/executioner.md` instead of old paths
- `skills/do/` (entire directory) - Removed (markdown moved to `skills/`, scripts copied to `skills/scripts/` in Phase 3)
- `skills/codex/` (entire directory) - Removed (entirely replaced by templates)
- `agents/do-*.md` (8 files) - Removed (replaced by bare template names)
- `agents/codex-*.md` (8 files) - Removed (replaced by bare template names)
- `README.md` - Test runner command updated to `skills/scripts/__tests__/`
- `database/projects/do/project.md` - Key Directories table and path references updated
- `bin/snapshot-golden.cjs` - Removed (one-time generation script)
- `bin/generate-templates.cjs` - Removed (one-time generation script)

**Decisions:**

- For structural tests reading markdown source files with `<<DO:...>>` markers, added `readExpanded(filePath)` helper that calls `expandTemplate(content, 'claude')` before content checks. This ensures tests check expanded content (what users see after install), not raw template markers.
- `optimization-guard.test.cjs`: agent file references updated from `do-verifier.md`/`do-executioner.md` to `verifier.md`/`executioner.md` (bare names). `requiredAgents` array uses bare names.
- `task-workflow-structural.test.cjs`: `TASK_AGENT_FILES` updated to bare names (`plan-reviewer.md`, `code-reviewer.md`, `council-reviewer.md`).
- `delivery-contract-structural.test.cjs`: `do-executioner.md` reference updated to `executioner.md`.
- `bug-2b` test in `bug-fix-structural.test.cjs`: `SKILLS_DIR` now points to `skills/` (top-level), so grep correctly searches template files for `node @scripts/` occurrences.
- `optimise-target.test.cjs`: test data strings like `skills/do/scan.md` and `skills/do/scripts/my-helper.cjs` retained as test data (they're fixture strings passed to `detectTargetType`, not filesystem paths).

**Verification:**

- `npm test`: 1014 tests, 0 failures
- Golden regression test: 137 tests, 137 pass
- `install-package-contract.test.cjs`: npm pack + postinstall integration test passes

**Status:** Complete

### 2026-05-05 21:30 - Execution complete

**Status:** Complete
**Summary:**

- Steps completed: 15/15 (all phases)
- Files modified: 30+
- Files removed: ~35 (skills/do/, skills/codex/, 16 prefixed agents, 2 one-time scripts)
- Deviations: 2 minor (auto-fixed)
  - Structural tests needed `readExpanded()` for template files (not plain `read()`)
  - Agent file references in test constants needed bare names not `do-`/`codex-` prefixed names

### 2026-05-05 22:00 - Code review fixes applied

**Status:** Complete
**Summary:**

- Steps completed: 6 fixes (2 blockers x 3 files each, 1 blocker in script, 3 nitpicks)
- Files modified: 10

**Files:**

- `skills/references/classify-findings.md` - Fixed stale dev-mode path (blocker 1): `skills/do/scripts/council-invoke.cjs` -> `skills/scripts/council-invoke.cjs`
- `test-fixtures/golden/claude/skills/references/classify-findings.md` - Updated golden to match template fix
- `test-fixtures/golden/codex/skills/references/classify-findings.md` - Updated golden to match template fix
- `skills/references/stage-plan-review.md` - Fixed stale dev-mode path (blocker 2): `skills/do/scripts/stage-decision.cjs` -> `skills/scripts/stage-decision.cjs`
- `test-fixtures/golden/claude/skills/references/stage-plan-review.md` - Updated golden to match template fix
- `test-fixtures/golden/codex/skills/references/stage-plan-review.md` - Updated golden to match template fix
- `skills/scripts/optimise-target.cjs` - Fixed stale agent source layout (blocker 3): heuristic updated from `do-*.md` prefix check to bare `agents/*.md`; peer patterns updated from `agents/do-*.md` to `agents/*.md` (two occurrences)
- `skills/scripts/__tests__/delivery-contract-structural.test.cjs` - Fixed error message string: `skills/do/references/` -> `skills/references/` (nitpick 4)
- `skills/scripts/__tests__/project-lifecycle-roundtrip.test.cjs` - Fixed comment: `skills/do/project.md` -> `skills/project.md` (nitpick 5)
- `skills/scripts/__tests__/template-regression.test.cjs` - Removed two stale `bin/snapshot-golden.cjs` references from comment block and error string (nitpick 6)

**Deviations:** None

**Verification:** `npm test` -> 1014 tests, 0 failures

## Council Review

## Verification Results

### Approach Checklist

- [x] Step 1: Create `bin/expand-templates.cjs` — expansion engine with token scanner + stack parser
- [x] Step 2: Write unit tests for expansion engine (`skills/scripts/__tests__/expand-templates.test.cjs`, 48 tests)
- [x] Step 3: Generate golden output snapshots — `test-fixtures/golden/claude/` and `test-fixtures/golden/codex/` committed (68 files each), `bin/snapshot-golden.cjs` one-time script created
- [x] Step 4: Write regression test harness (`skills/scripts/__tests__/template-regression.test.cjs`)
- [x] Step 5: Create 8 agent templates in `agents/` with bare role names
- [x] Step 6: Create 13 skill templates in `skills/` at top-level
- [x] Step 7: Create 47 reference templates in `skills/references/`
- [x] Step 8: Relocate `skills/do/scripts/` to `skills/scripts/`
- [x] Step 8b: Update all runtime script path references — zero `skills/do/` in any `.cjs` file (excluding install paths and test files)
- [x] Step 9: Rewrite `bin/install.cjs` to use `expandTemplate()` engine
- [x] Step 10: Update `package.json` — test script path updated, `files` field covers new layout
- [x] Step 11: Update all 26 test files to new source layout
- [x] Step 12: Run golden regression test — 137 tests, 137 pass
- [x] Step 13: Remove old source directories (`skills/do/`, `skills/codex/`, 16 prefixed agent files)
- [x] Step 14: Update `README.md` and `database/projects/do/project.md` with new layout
- [x] Step 15: Remove `bin/snapshot-golden.cjs` one-time script (and `bin/generate-templates.cjs`)

### Quality Checks

- **Tests:** PASS (npm run test) — 1014 tests, 0 failures
- **Golden Regression:** PASS (node --test skills/scripts/__tests__/template-regression.test.cjs) — 137 tests, 0 failures

### Result: PASS
- Checklist: 16/16 complete
- Quality: All checks passing
