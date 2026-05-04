---
project_schema_version: 1
project_slug: skill-tree-dedup
phase_slug: 01-00-audit-and-baseline
title: "Phase 00: Audit and Baseline"
created: "2026-05-04T13:56:25.265Z"
updated: "2026-05-04T17:18:13.334Z"
status: completed
scope: in_scope
active_wave: null
pre_abandon_status: null
backlog_item: null
council_review_ran: null
confidence: null
waves: null
entry_context: []
exit_summary: null
---

# Phase 00: Audit and Baseline

## Goal

Establish the factual foundation for the entire deduplication project. This phase produces four artifacts that every subsequent phase depends on: a complete audit classifying all 68 file pairs as identical or divergent (with line-level diff summaries), a testable `install.cjs` that exports its install functions without side effects, a SHA-256 baseline snapshot of both platform install outputs at v1.19.0 (the regression target for all future phases), and a template syntax specification that defines the ERB-style markers used throughout consolidation. No files are moved or restructured in this phase -- only audit artifacts and installer testability scaffolding, enabling safe, verifiable changes in Phases 01-03.

## Entry Criteria

- Project plan (`project.md`) is reviewed and approved with all blockers resolved through iteration 4
- The `do` repository is on the `main` branch at v1.19.0 (or current HEAD). Working tree may have untracked `.do/` project management files — only `skills/`, `agents/`, `bin/`, and `package.json` must be clean.
- Both `skills/do/` and `skills/codex/` directories contain hand-maintained originals (no files have been moved to `_source/` yet)
- All 68 file pairs (47 reference, 13 skill, 8 agent) are present in their current locations
- `bin/install.cjs` is in its current form (no `require.main` guard yet)

## Exit Criteria

- `audit-report.md` exists in the project folder, classifying all 68 file pairs as `identical` or `divergent`, with divergence categories (path substitution, agent name prefix, Agent() vs prose spawn, prose wording) annotated per divergent pair
- Audit counts match expected totals: 22 identical + 25 divergent references, 1 identical + 12 divergent skills, 0 identical + 8 divergent agents (or documented corrections if actual counts differ)
- `bin/install.cjs` exports `{ installClaudeCode, installCodex }` when `require()`d without triggering prompts, process exits, or any side effects
- `bin/install.cjs` behaves identically to its pre-change behavior when run directly (`node bin/install.cjs` or as postinstall)
- `baseline-claude.json` and `baseline-codex.json` exist in the project folder, each containing a complete file listing with relative paths and SHA-256 hashes of every installed file
- Baseline captures are reproducible: running the baseline script twice *in Phase 00, before any files are moved* produces identical JSON output. Baseline JSONs are frozen artifacts — once captured, they must not be regenerated in later phases. Each JSON includes `version` (from package.json) and `gitCommit` (current HEAD SHA) for traceability.
- `template-spec.md` exists in the project folder, documenting ERB-style delimiter syntax (`<%= VAR %>` for substitution, `<% if platform %>...<% endif %>` for conditionals), listing all variable names to be used, and confirming no collision with existing `{{...}}` Mustache-style placeholders in reference files

## Wave Plan

- **Wave 01 -- prerequisites**: File pair audit + install.cjs testability. The audit script compares all 68 file pairs and produces `audit-report.md`. In parallel, the `require.main === module` guard is added to `install.cjs` so it can be imported without side effects. These two deliverables are independent of each other but both are prerequisites for Wave 02.
  - Task 1: Build and execute audit script that compares every file pair across `skills/do/`, `skills/codex/`, and `agents/`, classifying each as identical or divergent with line-level diff summaries. Agent pairs use prefix matching (`do-<name>.md` ↔ `codex-<name>.md`). Output format: markdown table with columns (file pair, categories (comma-separated if multiple), divergent lines summary). Validate counts against expected totals.
  - Task 2: Make `bin/install.cjs` import-safe by wrapping TWO separate side-effect sites in-place with `if (require.main === module)` guards: (a) the module-top `fs.existsSync(source)` + `process.exit(0)` block (lines ~15-20), and (b) the bottom `process.stdin.isTTY` / readline interactive block (lines ~115-134). Guard both sites in place (no relocation — wrapping is simpler and avoids ordering bugs). Add `module.exports = { installClaudeCode, installCodex }` after the function definitions. Verify by `require()`ing the module in a Node REPL and confirming no output, no exit, and correct exports.

- **Wave 02 -- baseline-and-spec**: Baseline snapshot + template marker design. Depends on Wave 01 because the baseline script needs the testable `install.cjs` exports, and the template spec needs the audit report to enumerate divergence patterns.
  - Task 3: Build baseline snapshot script that imports `install.cjs`, stubs `os.homedir()` to a temp directory, creates `.claude` and `.codex` directory stubs, calls both install functions, and records file listings with SHA-256 hashes plus `version` and `gitCommit` metadata to `baseline-claude.json` and `baseline-codex.json`. These are frozen artifacts — not to be regenerated in later phases.
  - Task 4: Write `template-spec.md` defining ERB-style syntax, listing all template variables (`PLATFORM_PATH`, `AGENT_PREFIX`, platform conditionals), with examples drawn from actual divergence patterns found in the audit

- **Wave 03 -- Codex skill registry wrappers**: Post-baseline compatibility fix discovered during Wave 02. Codex requires registered `$skills` to be installed as `~/.codex/skills/<skill-name>/SKILL.md`; the current `installCodex()` only copies workflow markdown files into `~/.codex/skills/do/`, which leaves `$do`, `$do-project`, `$do-task`, and related entry points invisible in a fresh Codex session. This wave updates the Codex install output to add thin wrapper `SKILL.md` directories while preserving the existing `~/.codex/skills/do/` runtime tree for workflow files and scripts. Treat this as an intentional post-baseline Codex compatibility delta, not as a silent mutation of the frozen v1.19.0 baseline.

## Concerns

1. **install.cjs guard scope** -- The `require.main === module` guard must wrap not just the TTY prompt block but also the early-exit `process.exit(0)` at line 19 and the `fs.existsSync(source)` check. Missing any side effect causes the baseline script to fail or exit prematurely.
   - Mitigation: Audit every line of `install.cjs` for side effects before writing the guard. Test by requiring the module in a Node REPL and confirming no output or exit.

2. **Baseline reproducibility with filesystem ordering** -- `fs.readdirSync` does not guarantee consistent ordering across platforms. If the baseline script records files in non-deterministic order, hash comparison in later phases may produce false negatives.
   - Mitigation: Sort file listings alphabetically before writing to JSON. Include a deterministic serialization step (`JSON.stringify` with sorted keys).

3. **Actual file counts may differ from project.md estimates** -- The project.md states 22+25+1+12+0+8 = 68 pairs based on a manual audit. The automated audit script may find different counts if files have been added or removed since the project was scoped.
   - Mitigation: The audit script should be the source of truth. If counts differ, update `audit-report.md` with actual findings and flag the discrepancy for review before proceeding.

4. **os.homedir() stubbing in baseline script** -- Overriding `os.homedir()` after `install.cjs` has already captured `os` module references may not take effect if install functions cache the value.
   - Mitigation: Inspect `install.cjs` to confirm `os.homedir()` is called at invocation time (inside functions), not at module load time. The current code calls it inside `installClaudeCode()` and `installCodex()`, so stubbing before calling those functions will work.

5. **Template spec completeness** -- The spec must cover all divergence patterns found in the audit. If the audit reveals patterns not anticipated by the project plan (beyond path substitution, agent prefix, Agent() blocks, prose wording), the spec needs to accommodate them.
   - Mitigation: The spec is written after the audit (Wave 02 depends on Wave 01). Any unexpected patterns are documented and escalated before Phase 01 begins.

## Clarifications

<!--
Populated by do-griller during per-phase re-grill when confidence is below threshold.
Format:
### Q1: <question>
<answer>
-->

## Review Notes

<!--
Populated by do-plan-reviewer and do-council-reviewer during phase-plan review.
-->

## Exit Summary

<!--
Populated at phase completion (stage-phase-exit.md renders this via handoff.md).
One paragraph: what shipped, what was deferred, handoff to next phase.
-->
