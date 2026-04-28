---
id: 260428-fix-three-backlog-bug-items
created: 2026-04-28T00:00:00.000Z
updated: 2026-04-28T06:54:04.000Z
description: "Fix three backlog bug items: (1) fast-exec-load-context-arg: stage-fast-exec.md FE-2 calls load-task-context.cjs without the description argument, causing \"No task description provided\" errors; (2) yaml-frontmatter-parsing: exclude_paths written with double-escaped quotes breaks YAML parsing, and @scripts/ prefix doesn't resolve from consumer projects; (3) json-reference-skill: /do:init references @references/config-template.json but skill system only loads .md files, causing \"Unknown skill\" errors."
related: []

# Stage tracking (linear by default)
# Valid stages: refinement, grilling, execution, verification, verified, complete, abandoned
stage: complete
stages:
  refinement: complete
  grilling: complete
  execution: complete
  verification: complete
  abandoned: false

# Council review tracking (prevents re-running on resume)
council_review_ran:
  plan: true
  code: false

# Confidence calculation (per D-04, D-05)
confidence:
  score: 0.98
  factors:
    context: 0.0
    scope: 0.0
    complexity: 0.0
    familiarity: 0.0

# Backlog item this task was started from (set by /do:backlog start)
backlog_item: null
---

# Fix Three Backlog Bug Items

## Problem Statement

Three independent bug reports surfaced from real-world usage of `/do:fast`, `/do:continue`, and `/do:init`. Each one is small in surface area but blocks the affected flow on first run, forcing the user (or agent) to discover the workaround before the workflow can proceed.

**Bug 1 — fast-exec-load-context-arg**

`skills/do/references/stage-fast-exec.md` FE-2 (lines 86-92) shows:

```bash
node ~/.claude/commands/do/scripts/load-task-context.cjs
```

`load-task-context.cjs` requires the task description as the first positional argument (it uses it for keyword extraction against `TECH_TERMS`). Calling it with no arguments hits the CLI guard at lines 506-515 and exits with `{"error":"No task description provided"}` and exit code 2. The fast-path orchestrator then fails its quick context scan on first try.

The caller-contract preamble (line 10) already says `<description>` is an in-session variable available at this stage, so the fix is to pass it through.

**Bug 2 — yaml-frontmatter-parsing**

Two distinct issues bundled together because they both surface during `/do:continue` reading task frontmatter via `update-task-frontmatter.cjs`:

2a. **YAML parsing failure on `exclude_paths`** — `task.md` Step 4 / `stage-fast-exec.md` FE-1 instruct the orchestrator to "populate the `delivery:` frontmatter fields" but provide no concrete YAML rendering for array values. When the orchestrator stringifies `exclude_paths` from the JSON delivery contract, it ends up as `exclude_paths: "[\".do/\"]"` in the task file. gray-matter then chokes on the embedded escapes with `Error: can not read an implicit mapping pair; a colon is missed`. This blocks any subsequent `update-task-frontmatter.cjs` read/write operation on the task. The templates (`task-template.md` line 63, `wave-template.md` line 43) show the correct syntax `exclude_paths: [".do/"]` only inside commented-out blocks, which the writer ignores.

2b. **`@scripts/` path prefix doesn't resolve from consumer projects** — Roughly 41 sites across `skills/do/` (continue.md, task.md, fast.md, project.md and many `references/stage-*.md` files) use `node @scripts/<name>.cjs ...`. This `@<dir>/` syntax is a do-lang internal convention, not a Node.js or shell feature. It happens to work when an editor/agent's skill loader pre-substitutes the path, but when a real shell receives the literal command from a consumer project (e.g., leaselinq-frontend), `node` tries to load a file at `./@scripts/<name>.cjs` and fails with `MODULE_NOT_FOUND`. Sibling skills (`debug.md`, `abandon.md`, `project.md`, `scan.md`) already use the correct absolute pattern `node ~/.claude/commands/do/scripts/<name>.cjs`, so the codebase has both conventions in flight.

**Bug 3 — json-reference-skill**

`skills/do/init.md` line 91 and `skills/do/references/init-project-setup.md` line 127 reference `@references/config-template.json`. Claude Code's skill loader only registers `.md` files as `do:references:<name>` skills, so invoking `do:references:config-template.json` fails with `Unknown skill`. During `/do:init` in go-ai-reviewer-github-app the operator had to locate the file via `find` and read it directly — defeating the self-contained `@references/` convention.

**Acceptance criteria**

- AC1 — `stage-fast-exec.md` FE-2 calls `load-task-context.cjs "<description>"` and the script exits 0 on first invocation.
- AC2a — Task and wave files written from a delivery contract contain valid YAML for `exclude_paths` (array form `[".do/"]`, not a stringified JSON blob). `update-task-frontmatter.cjs read` succeeds against such a file.
- AC2b — Skill files no longer rely on the unresolved `@scripts/` prefix in `node` invocations. Either the prefix is replaced with the working absolute path, or the skill explicitly defines the resolution rule and a single canonical mechanism is used everywhere.
- AC3 — `/do:init` project setup loads the config template via a mechanism that works through the regular skill/reference loader (no `Unknown skill` errors on `.json`).
- AC4 — Existing tests (`scripts/__tests__/`) still pass; any new structural test ensures the fixed conventions stay in place.

## Delivery Contract

<!--
Populated by entry commands (e.g., /jira:start) or the onboarding flow.
The executioner reads ONLY this section for branch, commit, and push rules.

If empty, the executioner follows project defaults from project.md
(only when the user explicitly dismissed the onboarding flow).
-->

## Clarifications

### Scope (was: -0.10 -> now: 0.0)

**Q:** Should `wave-template.md` and `delivery-onboarding.md` also be fixed in this task if the audit (step 4) finds them vulnerable, or deferred to a follow-up?
**A:** Fix them in this task if the audit finds them vulnerable -- same pass as `task.md` and `stage-fast-exec.md`. Concern C8 is resolved in-scope.

### Context (was: -0.05 -> now: 0.0)

**Q:** For Bug 3, should `config-template.json` be deleted in this task or left as a transition safety net?
**A:** Delete `config-template.json`; the `.md` wrapper is the sole source of truth. The C4 hedge ("leave in place during transition") is superseded.

### Complexity (was: -0.05 -> now: 0.0)

**Q:** For the `@scripts/` rewrite (~41 occurrences), should each file get individual Edit calls or a scripted batch replacement?
**A:** Either approach -- pick whatever is more reliable. Individual replace_all calls per file chosen (most auditable).

## Context Loaded

- `~/workspace/database/projects/do/project.md` — do-lang tech stack, key directories, agent pipeline, release flow. Confirms `skills/do/scripts/` is the script home and `skills/do/references/` holds `@references/...` reference files.
- `.do/BACKLOG.md` (lines 113-170) — original problem statements for `fast-exec-load-context-arg`, `yaml-frontmatter-parsing`, and `json-reference-skill`. Each item carries its own suggested fix to compare against.
- `skills/do/references/stage-fast-exec.md` — FE-1 (delivery contract rendering), FE-2 (broken `load-task-context.cjs` call site), FE-4 (one of the `@scripts/` consumers). All three bugs touch this file.
- `skills/do/scripts/load-task-context.cjs` — confirms the CLI signature: `description` is the required first positional arg; missing arg produces the exact "No task description provided" error from the bug report.
- `skills/do/init.md` and `skills/do/references/init-project-setup.md` — the `@references/config-template.json` consumer site and the Step 6 instruction to "Create config.json from @references/config-template.json".
- `skills/do/references/config-template.json` — the template that is currently unreachable via the `@references/...` skill convention.
- `skills/do/references/task-template.md` and `wave-template.md` — show the correct YAML array syntax `exclude_paths: [".do/"]` inside commented-out blocks.
- `skills/do/references/delivery-contract.md` — defines the contract schema and the rendered `## Delivery Contract` markdown section. Shows the canonical `exclude_paths` example so the fix can mirror it.
- `skills/do/references/delivery-onboarding.md` — checks for any other places where `delivery_contract` fields get serialised into YAML.
- `skills/do/scripts/update-task-frontmatter.cjs` — confirms gray-matter is the parser used for reads and the fallback serializer (lines 145-177) does not produce the broken double-escaped form, so the failure originates from the LLM-driven YAML write in `task.md` Step 4 and `stage-fast-exec.md` FE-1, not from this script.
- `skills/do/scripts/validate-delivery-contract.cjs` — proves the upstream contract object holds `exclude_paths` as a real array; the corruption happens at the YAML write boundary, not earlier.
- `skills/do/task.md` (Step 4 / lines 86-104) and `skills/do/scripts/__tests__/delivery-contract-structural.test.cjs` — entry points where YAML is constructed and where structural tests are wired.
- `bin/install.cjs` — confirms postinstall copies `skills/do/` to `~/.claude/commands/do/` and `agents/` to `~/.claude/agents/`. This is what makes `node ~/.claude/commands/do/scripts/<name>.cjs` the universally working invocation across consumer projects.
- All `node @scripts/...` and `node ~/.claude/commands/do/scripts/...` usages across `skills/do/` — surveyed via grep to scope the bug-2b rewrite (~41 occurrences vs. ~15 already-correct ones).
- `~/workspace/database/__index__.md` — confirms project location and that no Jira ticket is needed (personal project).

ctx7 was not invoked: the bugs are all in do-lang internals (no external library API surface to look up).

## Approach

The work splits into three independent bug fixes that share no code surface but live in the same skills tree, so they can be sequenced in one task with a single round of validation at the end.

### Bug 1 — fast-exec-load-context-arg (single-line doc fix)

1. **Edit `skills/do/references/stage-fast-exec.md` FE-2 (line 91).** Change the bash block from:
   ```bash
   node ~/.claude/commands/do/scripts/load-task-context.cjs
   ```
   to:
   ```bash
   node ~/.claude/commands/do/scripts/load-task-context.cjs "<description>"
   ```
   Add a one-sentence note above the block: "`<description>` is the in-session variable from the caller contract (see preamble)." This matches the convention already used in `skills/do/task.md` and the description-substitution pattern in FE-1.
   - Expected outcome: fast-path quick context scan returns the matched-docs JSON on first run.

### Bug 2a — yaml-frontmatter-parsing for `exclude_paths`

The fix is on the writer side, not the parser. The orchestrator currently has no concrete YAML rendering example for the `delivery:` frontmatter block — just "populate the `delivery:` frontmatter fields." We add an explicit, copy-pasteable rendering with array literal syntax.

2. **Add an explicit YAML rendering block to `skills/do/task.md` Step 4** (the section that talks about threading `delivery_contract` into the task file, near lines 86-104). Insert a new "Rendered `delivery:` frontmatter (when non-null)" subsection right above or alongside the existing "Rendered `## Delivery Contract` format" block. Show:
   ```yaml
   delivery:
     branch: <delivery_contract.branch>
     commit_prefix: <delivery_contract.commit_prefix>
     push_policy: <delivery_contract.push_policy>
     pr_policy: <delivery_contract.pr_policy>
     stop_after_push: <delivery_contract.stop_after_push>
     exclude_paths: <delivery_contract.exclude_paths as YAML array, e.g. [".do/"]>
   ```
   Add a one-line guard: "Render `exclude_paths` as a YAML flow-array (`[\".do/\"]`), never as a JSON-stringified value. Quotes around path strings stay single-level — no `\"` escapes."
   - Expected outcome: orchestrator-written YAML parses cleanly with gray-matter and the inline fallback in `update-task-frontmatter.cjs`.

3. **Mirror the same rendering instruction into `skills/do/references/stage-fast-exec.md` FE-1** (right next to the existing "Delivery contract threading" block at lines 42-55). Single source of truth would be ideal, but both skills currently duplicate the markdown rendering, so we duplicate the YAML rendering too (consistent with the existing pattern). Optionally factor the shared rendering into `delivery-contract.md` and reference it from both — keep this optional to limit scope; recommend in concerns.

4. **Audit the other `delivery:` writers** for the same risk: search `skills/do/references/` and `skills/do/` for sites that synthesise `delivery:` YAML (e.g., `delivery-onboarding.md`, `wave-template.md`). Add the same array-literal note where missing. Templates already use the correct form in commented-out blocks, so the audit is mainly a guard against regression — flag anything inconsistent in the Concerns section if found.

5. **Add a structural test in `skills/do/scripts/__tests__/`** that asserts the YAML guidance is present in `task.md` and `stage-fast-exec.md`. Reuse the pattern from `delivery-contract-structural.test.cjs`. The test should grep the file content for the array-literal example (e.g., `exclude_paths: [".do/"]`) appearing in a non-commented block. This keeps the fix from silently regressing.
   - Expected outcome: the structural test fails before the fix and passes after.

### Bug 2b — `@scripts/` prefix doesn't resolve from consumer projects

This is an underlying convention bug, not a path resolver. Decision: replace `node @scripts/<name>.cjs` with `node ~/.claude/commands/do/scripts/<name>.cjs` everywhere in `skills/do/`. Rationale:
- The install script (`bin/install.cjs`) guarantees `~/.claude/commands/do/scripts/` exists for every install.
- ~15 sibling skill calls already use the absolute pattern; we're aligning the codebase rather than introducing a new convention.
- A runtime resolver would add complexity for zero gain — the absolute path always works because of postinstall.

6a. **Survey: enumerate all `@scripts/` invocations.** Run:
    ```bash
    grep -rn "node @scripts/" skills/do/
    ```
    Record the exact file list and line numbers (~41 occurrences expected). This list is the authoritative scope for the replacement — do not edit files not on it.

6b. **Replace per file.** For each file from step 6a, use `replace_all` with the exact left-anchor `node @scripts/` → `node ~/.claude/commands/do/scripts/`. Files known to be affected: `skills/do/continue.md`, `skills/do/task.md`, `skills/do/fast.md`, `skills/do/project.md`, `skills/do/optimise.md`, and the `references/stage-*.md` set (stage-execute.md, stage-code-review.md, stage-verify.md, stage-grill.md, stage-plan-review.md, stage-project-intake.md, stage-project-resume.md, stage-wave-*.md, stage-phase-*.md, etc.). After edits, re-run the grep and assert zero matches.
   - Expected outcome: zero `node @scripts/` occurrences remain; existing absolute-path callers are unchanged.

7. **Keep `@scripts/` in non-`node` documentation contexts** (e.g., the "Scripts: @scripts/foo.cjs" lists at the bottom of skill files). These are doc references, not shell commands, and removing them would noise the diff. Add a one-line clarification in `skills/do/do.md` (or wherever the convention is documented) that `@scripts/` is a documentation shorthand, while `node` invocations must use the absolute `~/.claude/commands/do/scripts/<name>.cjs` form.
   - Expected outcome: clear single rule for future contributors and agents — "in shell, use absolute; in prose, `@scripts/` is fine".

8. **Add a structural test** that greps `skills/do/**/*.md` for the pattern `node @scripts/` and asserts zero matches. This is a one-shot regression guard that costs almost nothing.

### Bug 3 — json-reference-skill (`config-template.json` not loadable)

Pick the `.md` wrapper approach from the backlog item (it has zero skill-loader changes and zero install-script changes).

9. **Create `skills/do/references/config-template.md`** containing the JSON content of the existing `config-template.json` inside a fenced block:
   ````markdown
   ---
   name: config-template
   description: "Template for .do/config.json. Used by /do:init project setup."
   ---

   # Project Config Template

   Copy the JSON below into `.do/config.json`. Substitute `{{PROJECT_NAME}}` with the confirmed project name and apply user choices for council, models, threshold, and database fields.

   ```json
   <verbatim copy of the existing config-template.json content>
   ```
   ````
   Keep the JSON identical to the current `config-template.json` so consumers see the same template.
   - Expected outcome: `do:references:config-template` resolves cleanly.

9b. **Sweep for other `.json` references in the `@references/` namespace** before touching any files:
    ```bash
    grep -rn "@references/.*\.json" skills/do/
    ```
    Confirm the only hits are `init.md` and `init-project-setup.md`. If other files are found, add them to the update list in step 10 before proceeding.

10. **Update consumer references.**
    - `skills/do/init.md` line 91: change `@references/config-template.json` to `@references/config-template.md`.
    - `skills/do/references/init-project-setup.md` line 127: change `Create config.json from @references/config-template.json:` to `Create config.json from the JSON block in @references/config-template.md:` and add a one-line note: "Read the `.md` wrapper, copy the fenced JSON block, then apply the substitutions below."

11. **Migrate the structural test and remove the legacy JSON file.**
    - Update `delivery-contract-structural.test.cjs` (lines 197-235) to read the JSON fenced block from `config-template.md` instead of reading `config-template.json` directly. Extract the JSON between the triple-backtick fences and parse it — same assertions, new source.
    - Delete `skills/do/references/config-template.json`. The `.md` wrapper is now the sole source of truth.
    - Expected outcome: `do:references:config-template` resolves cleanly; structural test passes against the `.md` wrapper; no file-not-found for `.json` (deleted).

### Validation

12. Run the existing test suite: `node --test skills/do/scripts/__tests__/`. Confirm no regressions and that newly added structural tests pass.

13. Manual smoke test (no real shell required — pattern check):
    - Verify `stage-fast-exec.md` FE-2 call now contains `"<description>"`.
    - `grep -rn "node @scripts/" skills/do/` returns zero matches.
    - `grep "exclude_paths:" skills/do/task.md skills/do/references/stage-fast-exec.md` returns the array-literal example outside commented blocks.
    - `do:references:config-template` skill is now `.md`-resolvable (file exists with frontmatter).

14. **Update `database/projects/do/project.md`** if any user-facing convention changed. The `@scripts/` shell-vs-prose split is convention-level — append a short bullet under "Conventions" capturing the rule. Skip if it duplicates content elsewhere.

## Concerns

- **C1 — Scope of `@scripts/` rewrite is large but mechanical.** ~41 occurrences across many files. Risk: missing a site, or an Edit replace_all clobbering a sibling reference. Mitigation: enumerate via `grep -rn "node @scripts/" skills/do/` before and after, assert zero matches at the end. Use `replace_all` per file with exact `node @scripts/` left-anchor — the prose-context references like `@scripts/foo.cjs` (no `node ` prefix) remain intact.

- **C2 — Convention split for `@scripts/` (shell-must-be-absolute vs. prose-may-be-shorthand) is a footgun for future contributors.** Mitigation: document the split explicitly in one place (proposed: `skills/do/do.md` plus the structural test in step 8 that fails if shell `node @scripts/` is reintroduced). Open question: should we remove the `@scripts/` shorthand from prose too for absolute consistency? Keeping it preserves brevity in doc-tables; removing it eliminates ambiguity. Recommend: keep prose shorthand, document, lock with test.

- **C3 — Bug 2a fix is doc-only — relies on the LLM orchestrator following the rendering example.** There's no machine-enforced contract that the YAML written into a task file is valid until `update-task-frontmatter.cjs` later tries to parse it. Mitigation: the structural test (step 5) ensures the example stays in the docs; for stronger enforcement we could add a write-time validator (a tiny helper that takes the delivery contract object, emits valid YAML, and is called from a Bash one-liner). That would expand scope and likely belongs to a follow-up task — flag in `discovered_followups[]`.

- **C4 — `config-template.json` may be referenced by external tooling or earlier task files.** Quick repo grep already shows the only readers are `delivery-contract-structural.test.cjs` (internal) and the two skill docs we are updating. Mitigation: leave the file in place during the transition (option (a) in step 11) so any unknown caller still works; the `.md` wrapper becomes the documented entry point. Re-evaluate deletion in a follow-up task once the new convention has bedded in.

- **C5 — Editing 60 skill files invalidates installed copies in `~/.claude/commands/do/`.** Users won't pick up the fix until they run `npm install -g @danielvandervelden/do-lang` or `/do:update`. Mitigation: this is the standard release flow for the package; bump version and publish per `project.md` "Release Flow". Note in the release notes which install behavior changed.

- **C6 — The `<description>` substitution in `stage-fast-exec.md` FE-2 must match the existing convention used elsewhere.** The caller-contract preamble defines `<description>` as the in-session variable. Other `<description>` references inside this same file use the angle-bracket form (FE-1 uses it via shell substitution). The fix is purely consistent with that pattern — low risk, but worth a glance during implementation to confirm the executioner reads `<description>` correctly when the prompt is rendered.

- **C7 — Risk of breaking abandoned/legacy task files.** Tasks already on disk with `exclude_paths: "[\".do/\"]"` will continue to fail YAML parsing even after the fix. Mitigation: out of scope for this bug; the fix is forward-only. Document in release notes that any task file with the broken YAML must be hand-edited or abandoned. Optional follow-up: add a heal command to `update-task-frontmatter.cjs` that detects and rewrites the broken form.

- **C8 — Frontmatter writers may not be the only YAML producer for delivery fields.** `delivery-onboarding.md` and `wave-template.md` could spawn similar issues. The audit step (step 4) is intended to catch this, but the bug report explicitly mentions only the task-file path. Mitigation: scope-limit to task-file YAML for the fix, capture wave-file as a follow-up if found vulnerable. Will add to `discovered_followups[]` if confirmed.

## Execution Log

### 2026-04-28 00:00 - Execution started

**Status:** In progress
**Steps:** 0/14 complete

### 2026-04-28 00:05 - Steps 1-14: All steps executed

**Step 1 — Bug 1: Fix load-task-context.cjs call in FE-2**

**Files:**
- `skills/do/references/stage-fast-exec.md` — Added `<description>` argument to `load-task-context.cjs` call in FE-2; added one-sentence note above the block per plan.

**Status:** Complete

---

**Step 2 — Bug 2a: Add YAML rendering block to task.md**

**Files:**
- `skills/do/task.md` — Added "Rendered `delivery:` frontmatter (when non-null)" subsection with array-literal `exclude_paths: [".do/"]` example and guard note against JSON-stringified form.

**Status:** Complete

---

**Step 3 — Bug 2a: Mirror rendering instruction into stage-fast-exec.md FE-1**

**Files:**
- `skills/do/references/stage-fast-exec.md` — Added same `delivery:` frontmatter YAML block and `exclude_paths` guard note to the Delivery contract threading section.

**Status:** Complete

---

**Step 4 — Bug 2a: Audit other delivery writers**

Checked `delivery-onboarding.md` and `wave-template.md`:
- `wave-template.md` already uses the correct commented-out array form `exclude_paths: [".do/"]`.
- `delivery-onboarding.md` does not produce YAML with `exclude_paths` — it only marks `onboarded`/`dismissed` in config.json.

**Decisions:**
- No changes needed to either file. Audit clean.

**Status:** Complete

---

**Step 5 — Bug 2a: Structural test for YAML guidance**

**Files:**
- `skills/do/scripts/__tests__/bug-fix-structural.test.cjs` — Created new test file with Bug 1, 2a, 2b, and 3 structural assertions.

**Status:** Complete

---

**Steps 6a/6b — Bug 2b: Survey and replace @scripts/ invocations**

Survey found 16 occurrences across 16 files (including the test file itself). Replaced `node @scripts/` → `node ~/.claude/commands/do/scripts/` in all 15 skill `.md` files.

**Files:**
- `skills/do/continue.md`
- `skills/do/task.md`
- `skills/do/references/stage-project-intake.md`
- `skills/do/references/stage-project-resume.md`
- `skills/do/references/stage-wave-plan-review.md`
- `skills/do/references/stage-wave-verify.md`
- `skills/do/references/stage-wave-code-review.md`
- `skills/do/references/stage-phase-exit.md`
- `skills/do/references/stage-execute.md`
- `skills/do/references/stage-project-complete.md`
- `skills/do/references/stage-code-review.md`
- `skills/do/references/stage-wave-exec.md`
- `skills/do/references/stage-project-plan-review.md`
- `skills/do/references/stage-fast-exec.md`
- `skills/do/references/stage-plan-review.md`
- `skills/do/references/stage-phase-plan-review.md`

Post-replacement `grep -rn "node @scripts/" --include="*.md"` returned zero matches.

**Status:** Complete

---

**Step 7 — Bug 2b: Document @scripts/ convention in do.md**

**Files:**
- `skills/do/do.md` — Added "Conventions / @scripts/ path shorthand" section explaining shell must use absolute path while prose may use shorthand.

**Status:** Complete

---

**Step 8 — Structural test for @scripts/ regression (included in bug-fix-structural.test.cjs)**

Already covered in step 5 — the test file created there includes the `grep --include="*.md"` zero-match assertion for Bug 2b.

**Status:** Complete

---

**Step 9 — Bug 3: Create config-template.md**

**Files:**
- `skills/do/references/config-template.md` — New file with frontmatter (name, description) and verbatim JSON block from former config-template.json.

**Status:** Complete

---

**Step 9b — Bug 3: Sweep for other @references/*.json patterns**

`grep -rn "@references/.*\.json" skills/do/` returned exactly two hits: `init.md` line 91 and `init-project-setup.md` line 127. No additional files found.

**Status:** Complete

---

**Step 10 — Bug 3: Update consumer references**

**Files:**
- `skills/do/init.md` — Changed `@references/config-template.json` → `@references/config-template.md`.
- `skills/do/references/init-project-setup.md` — Changed reference to `config-template.md`; added note about reading the `.md` wrapper and copying the fenced JSON block.

**Status:** Complete

---

**Step 11 — Bug 3: Migrate structural test and delete JSON file**

**Files:**
- `skills/do/scripts/__tests__/delivery-contract-structural.test.cjs` — Updated `config-template.json` describe block to read from `config-template.md` fenced JSON block instead of the JSON file directly. Same assertions, new source.
- `skills/do/references/config-template.json` — Deleted.

**Status:** Complete

---

**Step 12 — Validation: Full test suite**

Ran `node --test 'skills/do/scripts/__tests__/*.test.cjs'`. Result: 804 tests, 186 suites, 0 failures.

**Status:** Complete

---

**Step 13 — Smoke tests (pattern checks)**

- `stage-fast-exec.md` FE-2: `load-task-context.cjs "<description>"` — CONFIRMED
- `grep -rn "node @scripts/" --include="*.md"`: ZERO MATCHES
- `grep "exclude_paths:" task.md stage-fast-exec.md`: array-literal form present in both — CONFIRMED
- `config-template.md` exists with frontmatter; `config-template.json` deleted — CONFIRMED

**Status:** Complete

---

**Step 14 — Update database/projects/do/project.md**

**Files:**
- `database/projects/do/project.md` — Added `@scripts/ path convention` subsection under Conventions.

**Status:** Complete

---

### 2026-04-28 01:00 - Execution complete

**Status:** Complete
**Summary:**
- Steps completed: 14/14
- Files modified: 21 (15 skill .md files, 2 new files, 2 test files updated, 1 test file created, 1 file deleted, 1 database file updated)
- Deviations: 1 minor (auto-fixed)

**Minor deviation:** The test for "FE-2 does not call load-task-context.cjs without arguments" was initially too broad (matched prose mentions, not just shell commands). Fixed by limiting the check to lines starting with `node ` in the shell command context.

## Council Review

### Plan Review

#### Iteration 1

**do-plan-reviewer verdict:** CONCERNS
- [blocker] Step 11 option (a) vs (b) was ambiguous — executor needed a firm decision.
- [blocker] No explicit grep sweep for other `@references/*.json` patterns before step 10.
- [nitpick] ~60 count vs actual ~41 occurrences.
- [nitpick] Step 6 should be split into survey + replace sub-steps.
- [nitpick] AC language doesn't confirm structural test fails pre-fix.

**do-council-reviewer (gemini) verdict:** LOOKS_GOOD (nitpicks only)

**Inline patches applied:**
- Step 11 rewritten to commit firmly to option (a): migrate structural test + delete `config-template.json`
- Step 9b added: explicit `grep -rn "@references/.*\.json" skills/do/` sweep before step 10
- Step 6 split into 6a (survey/enumerate) and 6b (replace per file)
- ~60 occurrence count corrected to ~41 throughout

#### Iteration 2

**do-plan-reviewer verdict:** PASS — blockers resolved, all 4 ACs map 1:1 to steps, no dangling gaps.

**do-council-reviewer (gemini) verdict:** LOOKS_GOOD (nitpicks only) — plan thorough and ready for execution.

**Combined verdict: APPROVED**

## Verification Results

### Approach Checklist

- [x] Step 1 — Edit `stage-fast-exec.md` FE-2: pass `"<description>"` to `load-task-context.cjs` with explanatory note
- [x] Step 2 — Add YAML rendering block with `exclude_paths: [".do/"]` and guard note to `task.md` Step 4
- [x] Step 3 — Mirror same YAML rendering block and guard note into `stage-fast-exec.md` FE-1
- [x] Step 4 — Audit `delivery-onboarding.md` and `wave-template.md` for `exclude_paths` YAML risk (clean — no changes needed)
- [x] Step 5 — Create `bug-fix-structural.test.cjs` covering Bug 1, 2a, 2b, and 3 assertions
- [x] Step 6a — Survey: enumerate all `node @scripts/` invocations (found 16 across 15 `.md` files + test file)
- [x] Step 6b — Replace all `node @scripts/` → `node ~/.claude/commands/do/scripts/` in 15 skill `.md` files; post-grep returns zero matches
- [x] Step 7 — Document `@scripts/` shell-vs-prose convention in `skills/do/do.md`
- [x] Step 8 — Structural test for `node @scripts/` regression guard (included in `bug-fix-structural.test.cjs`)
- [x] Step 9 — Create `skills/do/references/config-template.md` with frontmatter and verbatim JSON block
- [x] Step 9b — Sweep for other `@references/*.json` patterns (only `init.md` and `init-project-setup.md` found)
- [x] Step 10 — Update `init.md` and `init-project-setup.md` to reference `config-template.md`
- [x] Step 11 — Migrate `delivery-contract-structural.test.cjs` to read from `config-template.md`; delete `config-template.json`
- [x] Step 12 — Run existing test suite: 804 tests, 0 failures
- [x] Step 13 — Smoke tests: FE-2 has `"<description>"`, zero `node @scripts/` matches, array-literal in both files, `config-template.md` exists, `.json` deleted
- [x] Step 14 — Update `database/projects/do/project.md` with `@scripts/` path convention subsection

### Quality Checks

- **Tests:** PASS (node --test 'skills/do/scripts/__tests__/*.test.cjs') — 804 tests, 186 suites, 0 failures

### Result: PASS

- Checklist: 16/16 complete
- Quality: Tests passing (804/804)
- Note: Two code review nitpicks carried as follow-ups (non-blocking per reviewer): (1) Bug 2a structural test uses raw substring match at `bug-fix-structural.test.cjs:85`; (2) stale header comment in `delivery-contract-structural.test.cjs:12`
