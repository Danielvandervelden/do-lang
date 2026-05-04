---
project_schema_version: 1
project_slug: skill-tree-dedup
phase_slug: 01-00-audit-and-baseline
wave_slug: 03-03-03-codex-skill-registry-wrappers
title: 'Wave 03: Codex Skill Registry Wrappers'
created: '2026-05-04T15:35:56.672Z'
updated: '2026-05-04T17:35:09.776Z'
status: completed
scope: in_scope
pre_abandon_status: null
backlog_item: null
parent_project: skill-tree-dedup
parent_phase: 01-00-audit-and-baseline
stage: verified
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
  score: 0.86
  factors:
    context: 0.95
    scope: 0.85
    complexity: 0.78
    familiarity: 0.88
modified_files:
  - bin/install.cjs
  - .do/projects/skill-tree-dedup/scripts/baseline-snapshot.cjs
  - .do/projects/skill-tree-dedup/codex-skill-registry-baseline.json
  - skills/do/scripts/__tests__/install-codex.test.cjs
  - skills/do/scripts/__tests__/install-package-contract.test.cjs
  - >-
    .do/projects/skill-tree-dedup/phases/01-00-audit-and-baseline/waves/03-03-03-codex-skill-registry-wrappers/wave.md
unresolved_concerns: []
discovered_followups:
  - >-
    Council reviewer bug surfaced during plan review; track and handle through
    backlog outside Wave 03.
wave_summary: >-
  Installed generated Codex wrapper SKILL.md entry points while preserving the
  shared runtime tree and frozen baselines.
---

# Wave 03: Codex Skill Registry Wrappers

## Problem Statement

During Wave 02, a live Codex install exposed a compatibility gap in the frozen
v1.19.0 Codex baseline: Codex only lists `$...` skills when each skill is
installed as its own directory containing a `SKILL.md` file. `installCodex()`
currently copies the Codex-flavored workflow markdown files into one folder,
`~/.codex/skills/do/`, with files such as `project.md`, `task.md`, `fast.md`,
and `quick.md`. That puts the workflow content on disk, but it is not registered
in Codex's skill picker.

The observable symptom is that a fresh Codex session shows unrelated registered
skills such as `$db-scan-project`, but does not show `$do`, `$do-project`,
`$do-task`, `$do-fast`, `$do-quick`, or the other do-lang entry points. A manual
local hotfix confirmed the required install shape:

- `~/.codex/skills/do/SKILL.md`
- `~/.codex/skills/do-project/SKILL.md`
- `~/.codex/skills/do-task/SKILL.md`
- `~/.codex/skills/do-fast/SKILL.md`
- `~/.codex/skills/do-quick/SKILL.md`
- `~/.codex/skills/do-continue/SKILL.md`
- `~/.codex/skills/do-debug/SKILL.md`
- `~/.codex/skills/do-init/SKILL.md`
- `~/.codex/skills/do-scan/SKILL.md`
- `~/.codex/skills/do-update/SKILL.md`
- `~/.codex/skills/do-optimise/SKILL.md`
- `~/.codex/skills/do-backlog/SKILL.md`
- `~/.codex/skills/do-abandon/SKILL.md`

Each wrapper should be thin: it should describe the Codex skill and point the
orchestrator at the corresponding installed workflow file under
`~/.codex/skills/do/<command>.md`. The existing workflow files and scripts should
remain installed in `~/.codex/skills/do/` so all path references such as
`~/.codex/skills/do/scripts/project-state.cjs` keep working.

This is a compatibility fix discovered by the baseline work. It changes Codex
install output shape, so Wave 03 must preserve the frozen
`.do/projects/skill-tree-dedup/baseline-codex.json` artifact exactly as-is and
record the new expected Codex output in an intentional post-baseline fixture:
`.do/projects/skill-tree-dedup/codex-skill-registry-baseline.json`.

<!--
Per D-01: Comprehensive problem statement for session resumption.
Include: symptoms, impact, related context, any prior attempts.
This section should have enough detail that /do:project resume can
fully understand the wave without additional context.
-->

## Delivery Contract

- **Branch:** `feat/skill-tree-dedup-phase00-wave01` (continue on the current project branch)
- **Commit prefix:** `fix` or `feat` (installer compatibility fix; choose based on final scope)
- **Push:** Do not auto-push. The user reviews and commits manually.

## Approach

1. Confirm Codex skill registration behavior from the local install layout:
   - Registered skills live at `~/.codex/skills/<skill-name>/SKILL.md`.
   - Plain markdown files under `~/.codex/skills/do/*.md` are not independently registered in the `$` picker.
   - The existing `db-scan-project` and Jira skills are examples of the wrapper shape.

2. Update `bin/install.cjs` so `installCodex()` installs both:
   - The current workflow/runtime tree at `~/.codex/skills/do/`:
     - copied from `skills/codex/`
     - scripts copied from `skills/do/scripts/`
   - Registered Codex wrapper skills:
     - `~/.codex/skills/do/SKILL.md`
     - `~/.codex/skills/do-project/SKILL.md`
     - one wrapper per Codex entry workflow

3. Use an in-code wrapper table in `bin/install.cjs`:
   - Generate wrappers from a small explicit table in `install.cjs` for this compatibility fix. This avoids creating another duplicated source tree before the dedup build system exists.
   - Do not add source wrapper files under `skills/codex/` or `skills/codex/references/`.
   - Later consolidation phases can move wrapper generation into the canonical build pipeline if needed.
   - Wrapper content should be stable, minimal, and explicit. Do not copy the full workflow markdown into each wrapper.

4. Wrapper naming contract:
   - `skills/codex/do.md` registers as `$do`
   - `skills/codex/project.md` registers as `$do-project`
   - `skills/codex/task.md` registers as `$do-task`
   - `skills/codex/fast.md` registers as `$do-fast`
   - `skills/codex/quick.md` registers as `$do-quick`
   - `skills/codex/continue.md` registers as `$do-continue`
   - `skills/codex/debug.md` registers as `$do-debug`
   - `skills/codex/init.md` registers as `$do-init`
   - `skills/codex/scan.md` registers as `$do-scan`
   - `skills/codex/update.md` registers as `$do-update`
   - `skills/codex/optimise.md` registers as `$do-optimise`
   - `skills/codex/backlog.md` registers as `$do-backlog`
   - `skills/codex/abandon.md` registers as `$do-abandon`

5. Add or update tests around Codex install output:
   - Run `installCodex()` with a stubbed `os.homedir()` temp directory.
   - Assert all wrapper `SKILL.md` files exist.
   - Assert the existing runtime files still exist under `~/.codex/skills/do/`.
   - Assert wrapper content references the correct workflow file, e.g. `~/.codex/skills/do/project.md`.
   - Assert wrappers do not contain unresolved template markers.
   - Place test changes under `skills/do/scripts/__tests__/*`, matching the existing test location.

6. Baseline handling:
   - Preserve `.do/projects/skill-tree-dedup/baseline-codex.json` byte-for-byte; never regenerate, update, or supersede it in this wave.
   - Update `.do/projects/skill-tree-dedup/scripts/baseline-snapshot.cjs` before taking the Wave 03 snapshot so it supports explicit alternate output paths, for example:
     - `--codex-output .do/projects/skill-tree-dedup/codex-skill-registry-baseline.json`
     - `--claude-output <temp-dir>/baseline-claude.json`
   - The script must fail fast if an explicit output path resolves to either frozen baseline file unless the caller also provides an intentional overwrite flag that Wave 03 does not use.
   - Do not run the current default `baseline-snapshot.cjs` command after implementation, because its default outputs are the frozen `baseline-claude.json` and `baseline-codex.json` files.
   - Deterministic safe procedure:
     - Record the pre-run hash and byte size of `.do/projects/skill-tree-dedup/baseline-codex.json`.
     - Run `baseline-snapshot.cjs` with explicit alternate outputs so Codex writes only to `.do/projects/skill-tree-dedup/codex-skill-registry-baseline.json` and Claude writes only to a temp file.
     - Recompute the frozen `.do/projects/skill-tree-dedup/baseline-codex.json` hash and byte size and confirm both values are unchanged.
     - Compare the temp Claude snapshot against frozen `.do/projects/skill-tree-dedup/baseline-claude.json` and confirm byte identity.
     - Re-run the same explicit Codex snapshot command and confirm `.do/projects/skill-tree-dedup/codex-skill-registry-baseline.json` is byte-identical to the prior run.
   - Add `.do/projects/skill-tree-dedup/codex-skill-registry-baseline.json` as the intentional post-baseline fixture for the new Codex wrapper output.
   - Verify the new Codex fixture against frozen `.do/projects/skill-tree-dedup/baseline-codex.json` with a JSON-aware comparison:
     - zero removals
     - zero hash changes for every file path that existed in the frozen baseline
     - additions are only registered wrapper `SKILL.md` entries for the expected Codex skills
     - every added wrapper path has the shape `<skill-name>/SKILL.md`

7. Verify manually after implementation:
   - Run the relevant Node tests.
   - Run the Codex install path in a temp home and inspect the generated tree.
   - Optionally install locally and restart Codex to confirm `$do`, `$do-project`, and `$do-task` appear in the picker.

<!--
Proposed solution and implementation steps.
Include: proposed solution, files to modify, key decisions.
-->

## Concerns

- **Baseline conflict:** Phase 00 was originally scoped as audit/baseline only. This wave intentionally records a discovered compatibility fix that changes Codex install output. The implementation must preserve the original baseline artifact or explicitly document any superseding fixture.
- **Generated-output future:** The dedup project will later make `skills/codex/` generated output. Avoid a wrapper-source design that creates more long-lived duplicated files before the canonical build step exists.
- **Skill vs command naming:** Claude uses `/do:project`; Codex skill picker uses `$do-project`. Wrappers must use hyphenated skill names while pointing to the existing colon-style workflow content.
- **Path stability:** Existing Codex workflow files reference `~/.codex/skills/do/scripts/*.cjs`. Keep the runtime tree under `~/.codex/skills/do/` intact.
- **Install overwrite behavior:** Reinstalling should replace stale wrapper content cleanly without deleting unrelated user skills.
- **Out-of-scope review tooling bug:** The council reviewer bug mentioned during plan review must not be fixed in Wave 03. Track it through backlog separately.

<!--
Potential issues, uncertainties, or risks identified during refinement.
Format:
- Concern 1: description and potential mitigation
-->

## Execution Log

<!--
Populated during implementation (codex-executioner writes here).

Entry format:
### YYYY-MM-DD HH:MM
**Files:**
- `path/to/file.ts` - Change summary

**Decisions:**
- Plan said X — chose approach Y because Z

**Status:** In progress / Execution complete
-->

### 2026-05-04 18:37 - Execution started

**Status:** In progress
**Steps:** 0/7 complete

### 2026-05-04 18:37 - Steps 1-4: Codex wrapper installer

**Files:**

- `bin/install.cjs` - Added an explicit Codex wrapper table and generated registered `SKILL.md` wrapper directories while preserving the runtime tree under `~/.codex/skills/do/` and Codex agents under `~/.codex/agents/`.

**Decisions:**

- Kept wrapper content thin and generated in-code so no source wrapper files were added under `skills/codex/`.
- Used hyphenated Codex skill names such as `do-project` while pointing each wrapper to the existing workflow file such as `~/.codex/skills/do/project.md`.

**Status:** Complete

### 2026-05-04 18:37 - Step 5: Installer regression tests

**Files:**

- `skills/do/scripts/__tests__/install-codex.test.cjs` - Added a temp-home `installCodex()` test covering wrapper existence, runtime file preservation, workflow references, agent install, and unresolved-template marker checks.
- `bin/install.cjs` - Added a narrow filter so installer-specific `__tests__/install-*` files are not installed as runtime scripts.

**Decisions:**

- Plan said to add tests under `skills/do/scripts/__tests__/*`; because that directory is copied into the Codex runtime tree, excluding installer-specific tests from runtime install was necessary to keep the new Codex fixture add-only against the frozen baseline.

**Status:** Complete

### 2026-05-04 18:37 - Step 6: Safe baseline fixture

**Files:**

- `.do/projects/skill-tree-dedup/scripts/baseline-snapshot.cjs` - Added `--claude-output`, `--codex-output`, and `--allow-frozen-overwrite`; default frozen-baseline writes now fail fast.
- `.do/projects/skill-tree-dedup/codex-skill-registry-baseline.json` - Generated the deterministic post-baseline Codex fixture with registered wrapper `SKILL.md` additions.

**Decisions:**

- Did not use `--allow-frozen-overwrite` during Wave 03.
- Preserved `.do/projects/skill-tree-dedup/baseline-claude.json` and `.do/projects/skill-tree-dedup/baseline-codex.json` byte-for-byte.

**Status:** Complete

### 2026-05-04 18:37 - Step 7: Verification

**Files:**

- `bin/install.cjs` - Formatted with Prettier.
- `.do/projects/skill-tree-dedup/scripts/baseline-snapshot.cjs` - Formatted with Prettier.
- `skills/do/scripts/__tests__/install-codex.test.cjs` - Formatted with Prettier.
- `.do/projects/skill-tree-dedup/phases/01-00-audit-and-baseline/waves/03-03-03-codex-skill-registry-wrappers/wave.md` - Logged execution and verification handoff.

**Decisions:**

- Loaded `agents/codex-executioner.md` after the user contract update and followed its execution-log, quality-check, and handoff requirements.
- Advanced `stage` to `verification` and `stages.execution` to `complete` per the executioner handoff contract, while leaving `status: in_progress` and not marking the wave completed.

**Verification:**

- `node --test skills/do/scripts/__tests__/install-codex.test.cjs` - PASS.
- `npm test` - PASS, 809 tests.
- `npx prettier --write bin/install.cjs .do/projects/skill-tree-dedup/scripts/baseline-snapshot.cjs skills/do/scripts/__tests__/install-codex.test.cjs` - PASS.
- `node .do/projects/skill-tree-dedup/scripts/baseline-snapshot.cjs` - Expected FAIL; refused frozen baseline overwrite before writing.
- Alternate-output snapshot with temp Claude output and Codex fixture output - PASS; Claude temp output matched frozen baseline and repeat Codex fixture generation was byte-identical.
- JSON-aware Codex fixture comparison - PASS; 13 additions, 0 removals, 0 existing-file hash changes, 0 unexpected additions.
- Frozen baseline hashes/sizes unchanged: `baseline-claude.json` SHA-256 `5686ff343ab5ba64dab296efc484f96ad1ab583f2d63deefb16098b62744e9da`, 17715 bytes; `baseline-codex.json` SHA-256 `c44acb2ede98331e5ecba75e97b752a3bd0b2ddad567dffedc68a865540509f5`, 17431 bytes.

**Status:** Execution complete

### 2026-05-04 18:49 - Code review iteration 1 fix

**Files:**

- `bin/install.cjs` - Reused the installer-test exclusion filter for the Claude runtime copy so `skills/do/scripts/__tests__/install-*` files are not installed under `.claude/commands/do/`.
- `skills/do/scripts/__tests__/install-codex.test.cjs` - Added assertions that installer-specific tests are absent from both Codex and Claude runtime output while preserving runtime scripts and Codex wrappers.
- `.do/projects/skill-tree-dedup/codex-skill-registry-baseline.json` - Regenerated the intentional Codex wrapper fixture after the installer filter change.

**Decisions:**

- Chose the least disruptive fix: keep the test in the planned `skills/do/scripts/__tests__/` location and filter installer-specific tests from both runtime installers.
- Preserved Codex wrapper behavior as an add-only fixture change against the frozen Codex baseline.

**Verification:**

- `node --test skills/do/scripts/__tests__/install-codex.test.cjs` - PASS, 2 tests.
- Alternate-output snapshot check - PASS; temp Claude snapshot was byte-identical to `.do/projects/skill-tree-dedup/baseline-claude.json`.
- Repeat Codex fixture generation - PASS; `.do/projects/skill-tree-dedup/codex-skill-registry-baseline.json` was byte-identical across repeated explicit-output runs.
- JSON-aware Codex fixture comparison - PASS; 13 additions, 0 removals, 0 existing-file hash changes, 0 unexpected additions, 0 bad-shape additions.
- Frozen baseline hashes/sizes unchanged: `baseline-claude.json` SHA-256 `5686ff343ab5ba64dab296efc484f96ad1ab583f2d63deefb16098b62744e9da`, 17715 bytes; `baseline-codex.json` SHA-256 `c44acb2ede98331e5ecba75e97b752a3bd0b2ddad567dffedc68a865540509f5`, 17431 bytes.
- `npm test` - PASS, 810 tests.

**Status:** Execution complete

## Verification Results

### Approach Checklist

- [x] Confirmed the Codex registration behavior requires `~/.codex/skills/<skill-name>/SKILL.md` wrapper directories while plain workflow markdown under `~/.codex/skills/do/*.md` remains runtime content.
- [x] Verified `installCodex()` installs the runtime tree at `~/.codex/skills/do/`, runtime scripts, Codex agents, and registered wrapper skill directories.
- [x] Verified wrappers are generated from an explicit in-code table in `bin/install.cjs` with no added source wrapper files under `skills/codex/` or `skills/codex/references/`.
- [x] Verified wrapper names map to the expected workflow files, including `$do-project` to `~/.codex/skills/do/project.md`.
- [x] Verified installer regression tests cover wrapper existence, runtime preservation, workflow references, unresolved-template marker absence, and installer-test exclusion from runtime trees.
- [x] Verified `baseline-snapshot.cjs` supports alternate output paths, refuses protected frozen baseline outputs, and was used without `--allow-frozen-overwrite`.
- [x] Verified the Codex skill registry fixture is add-only against the frozen Codex baseline, with 13 expected wrapper `SKILL.md` additions, zero removals, and zero existing-file hash changes.
- [x] Verified the Codex install path in a temp home and inspected the generated runtime tree, wrappers, workflow references, and agents.

### Quality Checks

- **Tests:** PASS (`npm test`) - 810 tests passed.
- **Lint:** Not configured in `package.json`.
- **Types:** Not configured in `package.json`.

### Baseline and Fixture Checks

- **Frozen baseline protection:** PASS (`node .do/projects/skill-tree-dedup/scripts/baseline-snapshot.cjs` refused the default frozen Claude output before writing).
- **Explicit Codex frozen output protection:** PASS (`--codex-output .do/projects/skill-tree-dedup/baseline-codex.json` exited 1 without writing).
- **Alternate-output snapshot:** PASS; temp Claude output matched `.do/projects/skill-tree-dedup/baseline-claude.json`, generated Codex output matched `.do/projects/skill-tree-dedup/codex-skill-registry-baseline.json`, and repeat Codex generation was byte-identical.
- **Frozen baseline hashes/sizes:** PASS; `baseline-claude.json` remains SHA-256 `5686ff343ab5ba64dab296efc484f96ad1ab583f2d63deefb16098b62744e9da`, 17715 bytes; `baseline-codex.json` remains SHA-256 `c44acb2ede98331e5ecba75e97b752a3bd0b2ddad567dffedc68a865540509f5`, 17431 bytes.
- **Codex fixture comparison:** PASS; frozen files `108`, current files `121`, additions `13`, removals `0`, existing-file hash changes `0`, unexpected additions `0`, missing expected additions `0`, bad-shape additions `0`.

### UAT Readiness

- [x] Temp-home Codex install confirms `$do`, `$do-project`, and `$do-task` wrappers are generated in the expected registered skill shape.
- [x] Temp-home Codex install confirms runtime workflow files and scripts remain under `~/.codex/skills/do/`.
- [x] Temp-home Codex install confirms installer-specific tests are absent from runtime output.
- [ ] Optional human UAT: install locally, restart Codex, and confirm `$do`, `$do-project`, and `$do-task` appear in the picker.

### Result: PASS

- Checklist: 8/8 complete.
- Quality: 1/1 configured checks passing.
- UAT readiness: ready; optional picker confirmation remains a manual local check.

## Clarifications

<!--
Populated by codex-griller during per-wave confidence rescue when confidence is below threshold.
Format:
### Q1: <question>
<answer>
-->

## Review Notes

<!--
Populated by codex-plan-reviewer and codex-code-reviewer.
-->

### Plan Review Iteration 1

**Self-review summary:**

- Blocker: baseline handling allowed ambiguity around updating `baseline-codex.json`, despite Wave 02 and phase docs freezing baseline artifacts.
- Nitpick: `modified_files` pointed at `skills/codex/scripts/__tests__/*`, but tests live under `skills/do/scripts/__tests__/*`.

**Council summary:**

- Confirmed the test location mismatch.
- Requested an explicit in-code wrapper table in `bin/install.cjs`, with no new source wrapper files under `skills/codex/` or `skills/codex/references/`.
- Required deterministic baseline verification: run `baseline-snapshot.cjs`, prove Claude baseline output is byte-identical, and prove Codex changes are add-only wrapper `SKILL.md` files with no removals or existing-file hash changes.
- Noted a council reviewer bug that is outside Wave 03 scope and belongs in backlog.

**Changes made to this wave plan:**

- Removed `baseline-codex.json` from `modified_files` and made preservation of the frozen Codex baseline mandatory.
- Added `codex-skill-registry-baseline.json` as the intentional post-baseline Codex fixture.
- Corrected test file scope to `skills/do/scripts/__tests__/*`.
- Chose the in-code wrapper table approach in `bin/install.cjs` and removed planned source wrapper files from scope.
- Added deterministic baseline verification requirements and moved the council reviewer bug to follow-up/backlog scope.

### Plan Review Iteration 2

**Self-review summary:**

- Concern: Step 6 still allowed an unsafe interpretation because the current `baseline-snapshot.cjs` writes directly to frozen `baseline-claude.json` and `baseline-codex.json` by default.
- Required a deterministic procedure or script change before any Wave 03 snapshot is generated.

**Council summary:**

- Claude council verdict: LOOKS_GOOD.
- No additional concerns beyond the self-review blocker.

**Changes made to this wave plan:**

- Added `.do/projects/skill-tree-dedup/scripts/baseline-snapshot.cjs` to `modified_files`.
- Required `baseline-snapshot.cjs` to support explicit alternate output paths and fail fast on accidental frozen-baseline overwrite attempts.
- Replaced the ambiguous "run baseline-snapshot.cjs" instruction with a safe procedure that preserves frozen `baseline-codex.json` byte-for-byte.
- Required deterministic generation of `.do/projects/skill-tree-dedup/codex-skill-registry-baseline.json` by proving repeat runs are byte-identical.
- Made the Codex fixture comparison explicit: add-only wrapper `SKILL.md` entries, zero removals, and zero existing-file hash changes.

### Plan Review Iteration 3

**Self-review summary:**

- CONCERNS — remaining blocker: `modified_files` still lists the frozen
  `.do/projects/skill-tree-dedup/baseline-codex.json` artifact even though the
  plan now requires that file to remain read/hash-only and byte-for-byte
  unchanged.

**Council summary:**

- Claude council verdict: LOOKS_GOOD.
- No findings.

**Status:**

- MAX ITERATIONS reached for plan review (3/3). The only outstanding issue is
  the stale `modified_files` entry for `baseline-codex.json`.

**Options:**

1. Proceed anyway and rely on the body text's preservation guard.
2. Revise the wave plan manually by removing `baseline-codex.json` from
   `modified_files`, then re-run plan review.
3. Abandon this wave.

### Code Review Iteration 1

**Self-review summary:**

- Blocker: `installClaudeCode()` still copied all of `skills/do/`, which meant the installer-specific `skills/do/scripts/__tests__/install-codex.test.cjs` would be installed under `.claude/commands/do/scripts/__tests__/` and make fresh Claude alternate snapshots differ from the frozen baseline.

**Council summary:**

- Claude council verdict: APPROVED.
- No council blockers.

**Changes made after code review:**

- Applied the runtime installer-test exclusion to the Claude copy path as well as the Codex scripts copy path.
- Extended the installer test to assert that `install-codex.test.cjs` is absent from both temp runtime trees.
- Re-ran the alternate-output snapshot checks; temp Claude output is byte-identical to the frozen baseline and the Codex fixture remains add-only wrapper `SKILL.md` entries.

## Council Review

<!--
Populated by council review stages.

### Plan Review
- **Reviewer:** <advisor name>
- **Verdict:** LOOKS_GOOD | CONCERNS | RETHINK

### Code Review
- **Reviewer:** <advisor name>
- **Verdict:** APPROVED | NITPICKS_ONLY | CHANGES_REQUESTED
-->
