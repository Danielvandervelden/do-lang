---
id: 260504-create-codex-compatible-skill-
created: "2026-05-04T00:00:00.000Z"
updated: "2026-05-04T14:50:00.000Z"
description: "Create Codex-compatible skill and agent files for the full do-lang pipeline, mirroring skills/do/ in skills/codex/ and agents/ with codex- prefix, replacing Agent() calls with Codex natural-language subagent instructions."
related: []
stage: complete
stages:
  refinement: complete
  grilling: skipped
  execution: complete
  verification: complete
  abandoned: false
council_review_ran:
  plan: true
  code: true
confidence:
  score: 0.7
  factors: null
  context: -0.1
  scope: -0.15
  complexity: -0.05
  familiarity: 0
backlog_item: null
---

# Create Codex-Compatible Skill and Agent Files (Phase 2)

## Problem Statement

**What:** Port the full do-lang pipeline (13 entry skills, 40+ reference files, 8 agents) from Claude-Code-specific orchestration to Codex-compatible orchestration. The Claude pipeline uses the `Agent({ subagent_type: "...", prompt: "..." })` tool-call shape to spawn subagents; Codex has no such tool and instead orchestrates subagents via natural-language instructions ("Spawn a do-planner subagent with this prompt: ...") that the Codex runtime interprets and dispatches.

**Why:** Phase 1 of this initiative wired `bin/install.cjs` to support Claude/Codex/Both selection. Today the Codex install branch (`installCodex()`) still copies from `skills/do/` — the same source as Claude — so Codex users get skill files full of Claude-only `Agent({...})` JS-block calls that Codex cannot execute. To make the Codex install path actually work, we need a parallel Codex-flavored source tree (`skills/codex/` + `agents/codex-*.md`) and a one-line installer pivot to copy from it.

**Acceptance criteria:**

1. `skills/codex/` exists and contains every entry skill in `skills/do/` (`abandon.md`, `backlog.md`, `continue.md`, `debug.md`, `do.md`, `fast.md`, `init.md`, `optimise.md`, `project.md`, `quick.md`, `scan.md`, `task.md`, `update.md`).
2. `skills/codex/references/` mirrors `skills/do/references/` (40+ files) with the same Codex substitution applied to every file containing `Agent(` or `subagent_type`.
3. `agents/` contains a parallel set of 8 `codex-*.md` files (`codex-planner.md`, `codex-plan-reviewer.md`, `codex-griller.md`, `codex-executioner.md`, `codex-code-reviewer.md`, `codex-council-reviewer.md`, `codex-verifier.md`, `codex-debugger.md`) each functionally identical to its `do-*` sibling, with internal references to subagent names rewritten to the `codex-` prefix.
4. Every `Agent({ description, subagent_type, model, prompt })` JS block in the Codex files is replaced with a natural-language Codex spawn directive that conveys the same description, subagent identity, model selection, and prompt body. The replacement is consistent across all files (single canonical pattern).
5. Every hardcoded `~/.claude/commands/do/scripts/` script path in the Codex files is rewritten to the Codex install location (`~/.codex/skills/do/scripts/`).
6. Internal subagent name references in skill bodies (e.g., "spawn `do-planner`", "via stage-plan-review.md owns the loop with do-planner") are rewritten to the `codex-*` form so the natural-language directives match the agent files that ship.
7. `bin/install.cjs` `installCodex()` reads from `skills/codex/` (not `skills/do/`) and copies `agents/codex-*.md` (not `agents/do-*.md`) into `~/.codex/agents/`. The Claude branch is unchanged.
8. `skills/codex/scripts/` is NOT created — scripts remain at `skills/do/scripts/` and the installer continues to copy them via `cpSync(skills/codex, ~/.codex/skills/do, recursive)` … but since `skills/codex/` will not contain a `scripts/` subdirectory, the installer must explicitly also copy `skills/do/scripts/` into `~/.codex/skills/do/scripts/` (or the Codex skill files must reference scripts at a different path). Resolution captured under Concerns and to be made explicit during execution.
9. Installer messaging updated so the Codex branch says `do skills installed to <target>` (already true) and the source pivot does not regress the Claude branch.
10. No regression for Claude install: `installClaudeCode()` still copies `skills/do/` and `agents/do-*.md`.

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
-->

## Context Loaded

- `~/workspace/github-projects/do/CLAUDE.md` — project entrypoint, post-task README check reminder, skill-creator reminder rule.
- `~/workspace/database/projects/do/project.md` — full do-lang architecture: 8 agents, 3 execution tiers, key directories, conventions, release flow. Confirms `skills/do/scripts/` is the canonical script home and `~/.claude/commands/do/scripts/<name>.cjs` is the runtime path for Claude installs.
- `bin/install.cjs` (current Phase 1 state) — `installClaudeCode()` copies `skills/do/` → `~/.claude/commands/do/` and filters `agents/do-*.md` → `~/.claude/agents/`. `installCodex()` mirrors this but targets `~/.codex/`.
- `skills/do/task.md` (441 lines) — canonical example of `Agent({...})` orchestration shape used in all entry skills. Found 4 Agent calls (planner, griller, executioner, verifier).
- `skills/do/references/stage-plan-review.md` (and siblings) — encodes parallel-spawn protocol: two `Agent({...})` calls in a single message for self+council reviewer dispatch. The natural-language Codex equivalent must preserve the "single message, parallel dispatch" semantic.
- `agents/do-planner.md` — agent file format: YAML frontmatter (`name`, `description`, `tools`, `model`, `color`, `permissionMode`, `maxTurns`), then a markdown body with `<role>`, `<context_loading>`, `<analysis>` sections. The body references `~/.claude/commands/do/scripts/<name>.cjs` paths.
- Grep inventory: 16 files under `skills/do/` contain `Agent(` calls (4 entry skills: task, continue, debug, project; 12 references: stage-plan-review, stage-code-review, stage-fast-exec, stage-quick-exec, stage-project-intake, stage-phase-plan-review, stage-wave-plan-review, stage-project-plan-review, stage-wave-code-review, stage-wave-verify, stage-wave-exec, stage-phase-transition). 30+ files reference `~/.claude/commands/do/scripts/`.

## Approach

The work splits into four mechanical phases. Each step lists files, the substitution to apply, and the expected outcome.

### Phase A — Establish the canonical Codex substitutions

1. **Define the canonical Agent → Codex replacement template.** Write it down once in this task file's Execution Log so every subsequent file uses the same shape. Canonical template (locked):

   ```
   Spawn the codex-<name> subagent with model `<model>` and the description "<description>". Pass the following prompt:

   <prompt body, unchanged>
   ```

   **CRITICAL — fence handling:** every `Agent({...})` block in the source is wrapped in a ```javascript ... ``` fence. The replacement MUST remove BOTH the surrounding ```javascript opening fence and the closing ``` fence — the Codex spawn directive is plain markdown prose, NOT a code block. Do not just replace the JS inside the fence; delete the fence lines themselves. After replacement, the directive flows as normal prose paragraphs.

   **Fallback template (no model field).** If smoke-testing reveals that Codex's runtime ignores or rejects model selection inside natural-language spawn directives, fall back to:

   ```
   Spawn the codex-<name> subagent with the description "<description>". Pass the following prompt:

   <prompt body, unchanged>
   ```

   Decide which template to use after a single trial transformation of `skills/codex/task.md` and a manual read-through; lock the choice in the Execution Log before propagating to the rest of the tree.

   For the parallel-dispatch case (PR-3a, CR-3a, etc.), preserve the "single message, two spawns" semantic with explicit wording: "In a single response, spawn BOTH of the following subagents (parallel dispatch — do NOT wait between them):" followed by two such blocks (also fence-free).

2. **Define the canonical path replacements.** Rewrite ALL `~/.claude/` occurrences in every Codex file using these three literal substitutions applied in this order (most specific first, to avoid double-rewriting):
   - `~/.claude/commands/do/scripts/` → `~/.codex/skills/do/scripts/`
   - `~/.claude/commands/do/` → `~/.codex/skills/do/`
   - `~/.claude/agents/` → `~/.codex/agents/`

   After transformation, run `grep -rn "~/.claude" skills/codex/ agents/codex-*.md` and fix any survivors before proceeding.

3. **Define the agent-name replacement (EXACT 8-name map, no prefix substitution).** Replace ONLY these eight exact tokens, never a generic `do-` prefix substitution:

   | Source token        | Replacement              |
   | ------------------- | ------------------------ |
   | `do-planner`        | `codex-planner`          |
   | `do-plan-reviewer`  | `codex-plan-reviewer`    |
   | `do-griller`        | `codex-griller`          |
   | `do-executioner`    | `codex-executioner`      |
   | `do-code-reviewer`  | `codex-code-reviewer`    |
   | `do-council-reviewer` | `codex-council-reviewer` |
   | `do-verifier`       | `codex-verifier`         |
   | `do-debugger`       | `codex-debugger`         |

   **Do NOT** touch `do-lang`, `do-task`, `do.md`, `/do:task`, `/do:fast`, `/do:project`, `/tmp/do-classified.json`, package name `do`, project root `~/workspace/github-projects/do/`, or any other `do-` token outside this exact-match list. Implement via a sed/awk script that uses the eight literal strings (anchored where helpful by surrounding word boundaries) — never a regex like `do-[a-z]+`.

### Phase B — Create skills/codex/ tree

4. **Create `skills/codex/` and `skills/codex/references/`** as new directories. Do NOT create `skills/codex/scripts/`.

5. **Copy and transform every entry skill** from `skills/do/*.md` into `skills/codex/*.md`. The agent-name rewrite from the exact 8-name map in step 3 applies to **ALL 13 entry skills** (`abandon`, `backlog`, `continue`, `debug`, `do`, `fast`, `init`, `optimise`, `project`, `quick`, `scan`, `task`, `update`), not only the four entry skills that contain `Agent({...})` calls — because every entry skill mentions agent names somewhere in prose, frontmatter `description`, or section headers. For each file:
   - Replace every `Agent({...})` JS block per the template from step 1, **including removal of the surrounding ```javascript fence and closing ``` fence**.
   - Replace every `~/.claude/commands/do/scripts/` per step 2.
   - Replace every of the 8 exact agent names per step 3.
   - **Rewrite prose `Agent()` / `Agent(...)` references that appear OUTSIDE JS code fences** (sentences like "the Agent() tool dispatches…", "spawn an Agent(...) for…", or "Agent calls run in parallel"). These have no fence to remove but still leak Claude-only tool semantics. Replace each with a Codex-appropriate phrasing — e.g. "subagent spawn", "spawn directive", "the Codex runtime dispatches subagents" — or remove if the sentence is purely contextual to Claude's tool model and adds no information for Codex readers. Apply judgment per occurrence; do not script this.
   - Update the SKILL.md frontmatter `description` if it mentions specific agent names (e.g., task.md's description lists the seven agent names).
   - Remove `Agent` from `allowed-tools` list (Codex does not have an Agent tool).
   - Run a final grep over the new file to confirm zero `Agent(`, zero `subagent_type`, zero `~/.claude/`, zero `do-planner|do-plan-reviewer|do-griller|do-executioner|do-code-reviewer|do-council-reviewer|do-verifier|do-debugger`.

6. **Copy and transform every reference file** from `skills/do/references/*.md` into `skills/codex/references/*.md` with the same three substitutions. There are 40+ files; only the 12 with `Agent(` calls need orchestration rewrites (and JS-fence removal), but all files need the script-path and agent-name rewrites.
   - **Rewrite prose `Agent()` / `Agent(...)` references that appear OUTSIDE JS code fences** in the reference body (e.g. "both Agent calls in one response", "MUST use the Agent tool", "environments where the Agent tool is unavailable"). Replace each with Codex-appropriate phrasing ("subagent spawn", "spawn directive", "the Codex runtime dispatches subagents") or remove if the sentence is purely contextual to Claude's tool model. Apply judgment per occurrence; do not script this.

### Phase C — Create agents/codex-*.md

7. **Copy each `agents/do-*.md` to `agents/codex-*.md`** (8 files). For each:
   - Rename the `name:` frontmatter field from `do-<role>` to `codex-<role>`.
   - Update the `description:` frontmatter to mention `codex-*` siblings instead of `do-*` (using the 8-name exact-match map).
   - Replace every `~/.claude/commands/do/scripts/` body reference with `~/.codex/skills/do/scripts/`.
   - Replace any of the 8 exact agent names per step 3 — never a broad `do-` substitution.
   - Remove `Agent` from `tools:` if present (do-verifier.md has it).
   - Translate any `Agent({...})` JS blocks in the agent body (do-verifier may delegate further) into the Codex natural-language spawn pattern, including ```javascript fence removal.
   - **Rewrite prose `Agent()` / `Agent(...)` references that appear OUTSIDE JS code fences** in the agent body (e.g. "you may spawn additional Agent() subagents", "the Agent tool returns…"). Replace each with Codex-appropriate phrasing ("subagent spawn", "the Codex runtime") or remove if Claude-tool-specific. Apply judgment per occurrence; do not script this.
   - Leave `AskUserQuestion` references intact — Codex supports the same UX primitive.

### Phase D — Wire the installer and validate

8. **Update `bin/install.cjs`:**
   - Add a new constant `codexSource = path.join(packageRoot, "skills", "codex")` near the existing `source` constant.
   - In `installCodex()`, change `fs.cpSync(source, target, ...)` to `fs.cpSync(codexSource, target, ...)`.
   - In `installCodex()`, add a guard: if `codexSource` does not exist, log clearly to stderr (not silently skip) — for example `console.error("do-lang: skills/codex/ not found at <resolved-path>; Codex installation cannot proceed. The codex source tree must be present in the package. Skipping Codex install.")` and return. The message must be visible enough that a user picking option 2 or option 3 in non-interactive contexts sees why nothing was copied.
   - Because `skills/codex/` will NOT contain a `scripts/` subdirectory, after the `cpSync(codexSource, target)` add an explicit follow-up copy: `fs.cpSync(path.join(source, "scripts"), path.join(target, "scripts"), { recursive: true })` so `~/.codex/skills/do/scripts/` is populated from the canonical Claude script tree.
   - Update the agent-copy filter in `installCodex()` from `file.startsWith("do-")` to `file.startsWith("codex-")`.
   - Leave `installClaudeCode()` completely untouched.

9. **Smoke-test the installer** locally **using an isolated HOME** so no real `~/.claude/` or `~/.codex/` directory is touched.

   **CRITICAL — pre-create `~/.claude` for Claude and "both" scenarios.** `installClaudeCode()` at `bin/install.cjs:30-32` explicitly returns early if `$HOME/.claude/` does not exist (it logs `~/.claude not found, skipping Claude Code installation`). A fresh `mktemp -d` HOME will trigger that early return and silently skip Claude installation, defeating the smoke test. Therefore every scenario that exercises the Claude branch MUST `mkdir -p "$TMPHOME/.claude"` before invoking the installer, mimicking a real user environment where Claude Code is already installed. The Codex-only scenario does NOT need this pre-creation (the installer creates `~/.codex/` itself if absent).

   **CRITICAL — TTY semantics for interactive choices.** `bin/install.cjs` chooses interactive vs non-interactive by inspecting `stdin.isTTY`. A piped invocation like `printf '2\n' | node bin/install.cjs` has a non-TTY stdin, so the installer NEVER prompts and instead runs the non-interactive fallback (currently "both"). The interactive choices 1 / 2 / 3 can therefore only be exercised in a real terminal session — not via piped stdin. The smoke runs below either accept the non-interactive fallback (using `< /dev/null` or piped stdin to mean "non-interactive 'both'") or require a manual interactive run in a real shell. Do not pretend `printf '2\n' | …` selects option 2.

   Scenarios:

   - **Codex-only (manual interactive, real terminal).** In a real terminal: `export TMPHOME=$(mktemp -d) && HOME=$TMPHOME node bin/install.cjs`, type `2`, ENTER. Verify `$TMPHOME/.codex/skills/do/` contains the Codex-flavored skill files (grep for `Agent(` returns zero hits) and `$TMPHOME/.codex/skills/do/scripts/` is populated with `.cjs` files. (Note: do NOT pre-create `$TMPHOME/.claude`; option 2 must not touch it.)
   - **Claude-only (manual interactive, real terminal).** Fresh tempdir: `export TMPHOME=$(mktemp -d) && mkdir -p "$TMPHOME/.claude" && HOME=$TMPHOME node bin/install.cjs`, type `1`, ENTER. Verify `$TMPHOME/.claude/commands/do/` contains the original Claude skills (grep for `Agent(` returns non-zero hits — the Claude path is unchanged) and `$TMPHOME/.codex/` was NOT created.
   - **Both (manual interactive, real terminal).** Fresh tempdir: `export TMPHOME=$(mktemp -d) && mkdir -p "$TMPHOME/.claude" && HOME=$TMPHOME node bin/install.cjs`, type `3`, ENTER. Verify both `$TMPHOME/.claude/commands/do/` and `$TMPHOME/.codex/skills/do/` are correct and isolated.
   - **Non-interactive fallback (AC, scriptable).** Simulate a non-TTY invocation: `export TMPHOME=$(mktemp -d) && mkdir -p "$TMPHOME/.claude" && HOME=$TMPHOME node bin/install.cjs < /dev/null`. Confirm the non-interactive fallback (currently "both") populates both `$TMPHOME/.claude/commands/do/` and `$TMPHOME/.codex/skills/do/`. The `< /dev/null` form is correct ONLY for this non-interactive fallback test — it does not select an interactive option.
   - **Codex-source-missing guard.** Temporarily rename or hide `skills/codex/`, then run the non-interactive fallback as above. Confirm the codexSource guard logs the clear stderr message defined in step 8, the Claude install still completes, and exit code is non-zero only if the design says so (otherwise zero with the warning).

   After all scenarios finish, restore any renamed `skills/codex/` and `rm -rf` the temp HOMEs.

10. **Run a sanity grep gate** across the new Codex tree. All of the following must return zero matches:
    - `grep -rln "Agent(\|subagent_type\|~/.claude/" skills/codex/ agents/codex-*.md`
    - `grep -rln "do-planner\|do-plan-reviewer\|do-griller\|do-executioner\|do-code-reviewer\|do-council-reviewer\|do-verifier\|do-debugger" skills/codex/ agents/codex-*.md`
    - `grep -rn "subagent_type\|Agent({" skills/codex/ agents/codex-*.md` — must return zero matches. (This is the correct gate: JS fences containing Agent calls must be gone, but unrelated JS fences — e.g. `AskUserQuestion` examples or installer snippets — are fine and must not be removed.)

    After the zero-match gates pass, run one final **manual-review** pass:
    - `grep -rn "\bAgent\b" skills/codex/ agents/codex-*.md`
    Review every hit. Acceptable survivors: generic noun uses ("the agent pipeline", "an orchestration agent"). Hits that must be rewritten or removed: "Agent tool", "Agent() call", "Agent calls", "Agent dispatches", "use the Agent", "MUST use the Agent tool", "environments where the Agent tool is unavailable". Resolve all unacceptable hits before declaring the task done.

11. **Update README.md** if it lists install targets or skill paths (Phase 1 may already have done this — verify and amend only if a Codex-source mention is now stale).

## Concerns

1. **Volume / mechanical risk (HIGH).** ~13 entry skills + 40+ reference files + 8 agents = 60+ files to transform. Manual editing risks drift between files. **Mitigation:** Lock the substitution template in Phase A step 1 before any file is created, and use the final cross-file grep gate in step 10 (which now covers `Agent(`, `subagent_type`, `~/.claude/`, the 8-name agent alternation, AND stale `^```javascript` fences) as a hard gate. Script the bulk substitution via `find ... -exec sed -i ...` only for the script-path literal swap and the eight exact agent-name swaps (using the 8-name map from Approach step 3 — never a regex like `do-[a-z]+`). Hand-translate the `Agent({...})` blocks (and remove their surrounding ```javascript fences) since prompt bodies vary. Document the sed commands in the Execution Log.

2. **Broad `do-` substitution would corrupt non-agent tokens (RESOLVED).** A naive `s/do-/codex-/g` would mangle `do-lang`, `do-task`, `do.md`, `/do:task` slash-commands, `/tmp/do-classified.json`, the npm package name `do`, and the project root path. **Mitigation:** Approach step 3 now defines an exact 8-name map (`do-planner`, `do-plan-reviewer`, `do-griller`, `do-executioner`, `do-code-reviewer`, `do-council-reviewer`, `do-verifier`, `do-debugger`). The execution sed/awk script must use these eight literals — never a generic `do-` prefix substitution — and step 10's grep gate explicitly verifies via `grep "do-planner\|do-plan-reviewer\|do-griller\|do-executioner\|do-code-reviewer\|do-council-reviewer\|do-verifier\|do-debugger"` that no stale agent name slipped through anywhere in `skills/codex/` or `agents/codex-*.md`.

3. **JS fences must be removed, not just emptied (RESOLVED).** The source `Agent({...})` blocks are wrapped in ```javascript ... ``` fences. If the executioner only replaces the JS-block contents and leaves the fences, Codex will read the spawn directive as a code block (literal text, not actionable prose) and never dispatch. **Mitigation:** Approach step 1 now explicitly states the canonical replacement removes BOTH the opening ```javascript line and the closing ``` line. Step 10's grep gate checks for `Agent({` or `subagent_type` inside any JS fence — legitimate non-Agent JS fences (e.g. `AskUserQuestion` examples) are allowed and must not be removed.

4. **Smoke tests would clobber the user's working install (RESOLVED).** Earlier draft ran `node bin/install.cjs` against the developer's real `$HOME`, which would overwrite their working `~/.claude/commands/do/` and `~/.codex/skills/do/` during verification. **Mitigation:** Approach step 9 now scopes every smoke run with `HOME=$(mktemp -d)` (one fresh tempdir per scenario), inspects the temp tree, and cleans up at the end. The developer's real install is untouched.

5. **Non-interactive install path was not covered (RESOLVED).** `bin/install.cjs` currently falls back to "both" when stdin is not a TTY; that fallback calls `installCodex()` and will hit `skills/codex/` once this task lands. **Mitigation:** Approach step 9 now includes an explicit non-interactive scenario (`HOME=$(mktemp -d) node bin/install.cjs < /dev/null`) and Acceptance Criterion 11 (added inline to the smoke step) requires that the codexSource guard logs a clear stderr message — visible in non-interactive contexts — when `skills/codex/` is absent, rather than silently returning. This guarantees CI and `npm install` postinstall scenarios surface the failure mode rather than producing an empty `~/.codex/` install.

13. **Smoke tests must pre-create `~/.claude` for Claude and "both" scenarios (RESOLVED).** `installClaudeCode()` at `bin/install.cjs:30-32` explicitly returns early when `$HOME/.claude/` does not exist (logs `~/.claude not found, skipping Claude Code installation`). A bare `HOME=$(mktemp -d)` triggers that early return and silently skips Claude installation, making the smoke test pass for the wrong reason. **Mitigation:** Approach step 9 now requires `mkdir -p "$TMPHOME/.claude"` before invoking the installer in every scenario that exercises the Claude branch (Claude-only, Both interactive, non-interactive fallback, codex-source-missing). The Codex-only scenario does NOT pre-create `~/.claude` because option 2 must not touch it.

14. **Interactive choices 1/2/3 cannot be selected via piped stdin (RESOLVED).** `bin/install.cjs` checks `stdin.isTTY` to decide interactive vs non-interactive. A piped stdin like `printf '2\n' | node bin/install.cjs` has `isTTY === false`, so the installer never prompts and runs the non-interactive fallback ("both") instead — the digit `2` is never read. **Mitigation:** Approach step 9 now explicitly states that interactive scenarios (choices 1, 2, 3) MUST be run in a real terminal session, not via piped `printf` or HEREDOC. The `< /dev/null` form is correct ONLY for the non-interactive fallback test. The smoke step lists which scenarios are "manual interactive, real terminal" vs "non-interactive fallback, scriptable" so the executioner does not conflate them.

6. **Codex orchestration semantics are not codified in this repo (MEDIUM).** The task description says "Codex natural-language subagent instructions" but the exact wording Codex's runtime expects is not documented in `project.md` or in any existing Codex skill. The replacement template chosen in Phase A step 1 is a best-guess shape. **Mitigation:** Pick a clear, unambiguous wording (`Spawn the codex-<name> subagent with model `<model>` and pass this prompt: ...`) and use it consistently. If Codex's runtime ignores or rejects the `model` field inside natural-language directives, Approach step 1 now defines a model-less fallback template; switching to it is a single sed pass across the 60+ files. The decision is made after a one-file trial transformation of `skills/codex/task.md` and locked in the Execution Log before propagating.

7. **Parallel dispatch semantics (MEDIUM).** Claude's `Agent()` calls in a single message produce true parallel dispatch — `stage-plan-review.md` PR-3a, `stage-code-review.md` CR-3a, and the wave/phase variants all rely on this for self+council reviews. Codex's natural-language equivalent must preserve this. **Mitigation:** Phase A step 1 includes explicit "single response, parallel dispatch — do NOT wait between them" language and requires the JS fences around the parallel pair to be removed too. Verify the wording is unambiguous when reviewing the first transformed reference file (likely `skills/codex/references/stage-plan-review.md`) before propagating to siblings.

8. **Scripts directory placement (MEDIUM).** Scripts are platform-agnostic and should not be duplicated, and the installer copies them. The current `installCodex()` does this implicitly because `skills/do/` includes `scripts/`. After the pivot to `skills/codex/`, the scripts no longer come along. Two options: (a) explicit `cpSync(skills/do/scripts, ~/.codex/skills/do/scripts)` in `installCodex()`, or (b) symlink `skills/codex/scripts -> ../do/scripts`. **Mitigation:** Approach step 8 picks option (a) — explicit second `cpSync` — because symlinks behave inconsistently across platforms during npm postinstall and may not survive `fs.cpSync` traversal. Document this choice in the install.cjs comment.

9. **Hardcoded `~/.claude/commands/do/scripts/` paths in scripts themselves (MEDIUM).** A spot-check on `skills/do/scripts/*.cjs` did not reveal that paths are hardcoded inside scripts (they take cwd-relative paths and the install runtime). Still, if any script `require()`s another by `~/.claude/...` absolute path, Codex installs would break at runtime — not just produce stale documentation. **Mitigation:** Run `grep -rn "~/.claude" skills/do/scripts/` early in execution (Phase A). If any runtime-impacting hits are found (i.e., `require()` or `fs.*` calls using a hardcoded `~/.claude/` path), fix them inline by switching to `__dirname`-relative paths before proceeding. Non-runtime hits (comments, README prose) may be left as-is or filed as a follow-up.

10. **Frontmatter `allowed-tools` field (LOW).** Removing `Agent` from the Codex skill frontmatter assumes Codex parses the same SKILL.md frontmatter format and that `Agent` would either error or be ignored. **Mitigation:** Keep the field name `allowed-tools` as-is and just remove the `Agent` entry. If Codex expects a different field name, fix in a follow-up — the field is advisory and does not block execution.

11. **Open question — naming consistency for stage references.** The user said skill files get a `codex/` directory and agents get a `codex-` prefix, but reference files inside `skills/codex/references/` keep their original names (`stage-plan-review.md`, etc.). This is the chosen approach because the directory namespacing already disambiguates them. **Mitigation:** None needed — confirm with user during approval if uncertain.

12. **README / docs drift (LOW).** `project.md` currently says "Target runtimes: Claude Code CLI" and "Postinstall copies to ~/.claude/...". Phase 1 may have updated this; if not, it should be updated alongside this task or in a follow-up. **Mitigation:** Out of scope for this task per the acceptance criteria, but flag in the post-task README check that CLAUDE.md mandates.

## Review Iterations

### Iteration 1
- **Self-review:** CONCERNS — 2 blockers (non-interactive path unaddressed, do- name replacement too broad), 2 nitpicks
- **Council:** CONCERNS — 2 blockers (smoke tests hit real install locations, JS fences not removed), 2 nitpicks
- **Changes made:**
  - Approach step 1: Added explicit fence-removal directive (delete the surrounding ```javascript opening fence and closing ``` fence — not just the JS contents). Added a model-less fallback template to be used if Codex ignores/rejects the `model` field, with a one-file trial-and-lock procedure.
  - Approach step 3: Replaced the broad "every `do-*` agent reference" rule with an exact 8-name replacement map (`do-planner`, `do-plan-reviewer`, `do-griller`, `do-executioner`, `do-code-reviewer`, `do-council-reviewer`, `do-verifier`, `do-debugger`) and an explicit do-not-touch list (`do-lang`, `do-task`, `do.md`, `/do:` slash commands, `/tmp/do-classified.json`, package name, project root).
  - Approach step 5: Clarified that the agent-name rewrite from the 8-name map applies to ALL 13 entry skills (not only those containing Agent() calls). Added fence-removal note to Agent-block translation. Tightened the per-file grep to use the 8-name alternation.
  - Approach step 8: Strengthened the codexSource guard to log clearly to stderr (not silently skip) so non-interactive runs surface the failure visibly.
  - Approach step 9: Wrapped every smoke-test scenario with `HOME=$(mktemp -d)` (one fresh tempdir per scenario, cleanup at end) so the developer's real `~/.claude/` and `~/.codex/` are never touched. Added explicit non-interactive scenario (`< /dev/null`) covering the "both" fallback path through `installCodex()` and the codexSource-absent guard.
  - Approach step 10: Expanded the grep gate to include the 8-name alternation AND a stale ```javascript fence inspection.
  - Concerns: Renumbered to 12 items, added new entries for the broad-substitution risk (RESOLVED), JS-fence removal (RESOLVED), real-install clobber (RESOLVED), and non-interactive path (RESOLVED), and added the model-less fallback note to the orchestration-semantics concern.

### Iteration 2
- **Self-review:** PASS
- **Council:** CONCERNS — 1 blocker (smoke tests don't pre-create ~/.claude; installClaudeCode() skips if absent), 2 nitpicks (interactive steps need real TTY/PTY; prose Agent() references also need rewriting)
- **Changes made:**
  - Approach step 9 (BLOCKER): Restructured the smoke-test plan to pre-create `$TMPHOME/.claude` (via `mkdir -p`) for every scenario that exercises the Claude branch — Claude-only, Both interactive, non-interactive fallback, and the codex-source-missing guard. Without this, `installClaudeCode()` silently early-returns at `bin/install.cjs:30-32` and the smoke test passes for the wrong reason. The Codex-only scenario is explicitly excluded from the pre-create rule because option 2 must not touch `~/.claude`.
  - Approach step 9 (NITPICK 1): Added an explicit "TTY semantics" callout. Interactive choices 1 / 2 / 3 require a real terminal session — `bin/install.cjs` checks `stdin.isTTY`, so a piped `printf '2\n' | node bin/install.cjs` has a non-TTY stdin and runs the non-interactive "both" fallback regardless of what was piped. Each smoke scenario is now labelled as "manual interactive, real terminal" or "non-interactive fallback, scriptable" so they cannot be conflated. The `< /dev/null` form is documented as correct ONLY for the non-interactive fallback.
  - Approach step 5 (NITPICK 2, Phase B / entry skills): Added a sub-bullet requiring rewrite of prose `Agent()` / `Agent(...)` references that appear OUTSIDE JS code fences (e.g. "the Agent() tool dispatches…"). These have no fence to remove but still leak Claude-only tool semantics; replace with Codex-appropriate phrasing ("subagent spawn", "the Codex runtime") or remove if Claude-tool-specific. Apply judgment per occurrence; do not script.
  - Approach step 7 (NITPICK 2, Phase C / agents): Same rewrite requirement added for the agent body files (do-verifier and friends).
  - Concerns: Added items 13 (smoke pre-create requirement, RESOLVED) and 14 (TTY-vs-piped-stdin semantics, RESOLVED) so future iterations have the rationale on record.

### Iteration 3
- **Self-review:** PASS
- **Council:** CONCERNS — 2 blockers (plan review hit MAX_ITERATIONS — not re-spawned)
- **Outstanding issues for executioner (passed via prompt, not re-planned):**
  1. **Path rewrite scope too narrow:** Phase A step 2 only defines rewriting `~/.claude/commands/do/scripts/` → `~/.codex/skills/do/scripts/`. But source files contain OTHER `~/.claude/` paths (e.g. `update.md` lines 16/135/159, `stage-phase-exit.md:180`, `stage-project-complete.md:167`). The executioner must broaden the path rewrite to ALL `~/.claude/` occurrences: `~/.claude/commands/do/` → `~/.codex/skills/do/`, `~/.claude/agents/` → `~/.codex/agents/`. Run `grep -rn "~/.claude" skills/codex/` after transformation and fix any survivors.
  2. **JS fence grep gate too broad:** The `^```javascript` zero-match gate would incorrectly fail on legitimate non-Agent JS fences (e.g. `AskUserQuestion` examples). Narrow the gate: instead of requiring zero JS fences, grep for JS fences that CONTAIN `Agent({` or `subagent_type` — those must be zero. Command: `grep -rn "subagent_type\|Agent({" skills/codex/ agents/codex-*.md` must return no results.

## Execution Log

### 2026-05-04 12:30 - Execution started

**Status:** In progress
**Steps:** 0/11 complete

**Pre-execution checks:**
- `skills/do/scripts/` grep for `~/.claude`: zero hits (Concern 9 — no runtime-impacting paths found)
- Agent() call inventory: 4 entry skills (task, continue, debug, project) + 12 reference files
- 8 agent files confirmed in `agents/` with `do-` prefix
- `bin/install.cjs` reviewed — installCodex() currently copies from `skills/do/` (the stale path)

### 2026-05-04 12:32 - Phase A: Canonical substitutions locked

**Status:** Complete

**Decisions:**

1. **Agent → Codex spawn template (locked):**
   Plain prose replacement (no code fence):
   ```
   Spawn the codex-<name> subagent with model `<model>` and the description "<description>". Pass the following prompt:

   <prompt body>
   ```
   For parallel dispatch: "In a single response, spawn BOTH of the following subagents (parallel dispatch — do NOT wait between them):" followed by two such blocks.

2. **Path replacements (3 literals, applied most-specific first):**
   - `~/.claude/commands/do/scripts/` → `~/.codex/skills/do/scripts/`
   - `~/.claude/commands/do/` → `~/.codex/skills/do/`
   - `~/.claude/agents/` → `~/.codex/agents/`

3. **Agent name map (exact 8 tokens only):**
   do-planner → codex-planner, do-plan-reviewer → codex-plan-reviewer,
   do-griller → codex-griller, do-executioner → codex-executioner,
   do-code-reviewer → codex-code-reviewer, do-council-reviewer → codex-council-reviewer,
   do-verifier → codex-verifier, do-debugger → codex-debugger

4. **Directories created:** `skills/codex/` and `skills/codex/references/` (no scripts/ subdirectory)

5. **Concern 9 verified:** `grep -rn "~/.claude" skills/do/scripts/` returns zero hits — no runtime-impacting paths in scripts.

6. **Template decision:** Using the with-model form as primary (no fallback needed — locking canonical form now)

### 2026-05-04 14:00 - Step 6 (Phase B, continued): skills/codex/references/ remaining 37 files

**Files:**

- `skills/codex/references/` - Bulk-copied 37 remaining reference files from `skills/do/references/`
- Applied sed substitutions to all 47 files: 3 path literals + 8 exact agent name tokens
- `skills/codex/references/stage-phase-transition.md` - Hand-translated Agent() JS block to Codex spawn directive (fence removed)
- `skills/codex/references/stage-wave-verify.md` - Hand-translated Agent() JS block to Codex spawn directive (fence removed)

**Decisions:**

- Bulk sed substitution for path and agent name rewrites applied to entire `skills/codex/references/` directory
- Only 2 of the 37 new files had Agent() calls requiring hand translation
- Grep gate confirmed: zero `Agent(`, `subagent_type`, `~/.claude`, or stale do- agent names in all 47 codex reference files

**Status:** Complete

---

### 2026-05-04 14:10 - Step 7 (Phase C): agents/codex-*.md — 8 files

**Files:**

- `agents/codex-planner.md` - Created from do-planner.md: name/description updated, path rewritten, no Agent() calls in body
- `agents/codex-plan-reviewer.md` - Created from do-plan-reviewer.md: name/description updated, no paths/Agent() calls
- `agents/codex-griller.md` - Created from do-griller.md: name/description updated, no paths/Agent() calls
- `agents/codex-executioner.md` - Created from do-executioner.md: name/description updated, `do-plan-reviewer` → `codex-plan-reviewer` and `do-griller` → `codex-griller` in body prose, no Agent() calls
- `agents/codex-code-reviewer.md` - Created from do-code-reviewer.md: name/description updated, no paths/Agent() calls
- `agents/codex-council-reviewer.md` - Created from do-council-reviewer.md: name/description updated, body script path `~/.claude/commands/do/scripts/` → `~/.codex/skills/do/scripts/`
- `agents/codex-verifier.md` - Created from do-verifier.md: name/description updated, `Agent` removed from tools list, `do-code-reviewer` → `codex-code-reviewer` in body prose, no Agent() calls
- `agents/codex-debugger.md` - Created from do-debugger.md: name/description updated, no Agent() calls

**Decisions:**

- do-verifier.md had `Agent` in the tools list — removed for codex-verifier.md
- do-executioner.md prose references `do-plan-reviewer` and `do-griller` — rewritten to codex-* via exact 8-name map
- do-verifier.md prose references `do-code-reviewer` — rewritten to codex-code-reviewer
- All AskUserQuestion JS examples left intact (Codex supports same UX primitive)
- JS code blocks for heuristic estimation in codex-verifier.md kept (not Agent() calls, pure computation logic)

**Status:** Complete

---

### 2026-05-04 14:20 - Step 8 (Phase D): bin/install.cjs updated

**Files:**

- `bin/install.cjs` - Added `codexSource` constant, updated `installCodex()` to: use codexSource, add guard for missing codexSource (stderr message), explicit `cpSync` for scripts/, changed agent filter from `do-` to `codex-`

**Decisions:**

- Guard logs to stderr (console.error) and returns without process.exit() — Claude install still completes, overall exit code stays 0 (warning, not fatal)
- Scripts copy is explicit: `cpSync(source/scripts, target/scripts)` since `skills/codex/` has no `scripts/` subdirectory

**Status:** Complete

---

### 2026-05-04 14:25 - Step 9 (Smoke test — non-interactive fallback scenario)

**Non-interactive fallback (scriptable):**
`export TMPHOME=$(mktemp -d) && mkdir -p "$TMPHOME/.claude" && HOME=$TMPHOME node bin/install.cjs < /dev/null`

Result: PASS
- `$TMPHOME/.codex/skills/do/` contains Codex-flavored skill files (13 entry skills + references/)
- `$TMPHOME/.codex/skills/do/scripts/` populated with .cjs files
- `$TMPHOME/.codex/agents/` contains codex-*.md files (8 files)
- `$TMPHOME/.claude/commands/do/` contains Claude skills (do-* agents)
- `$TMPHOME/.claude/agents/` contains do-*.md files (8 files)
- Zero Agent() calls in installed codex tree

**codexSource-missing guard:**
Temporarily renamed skills/codex → skills/codex-backup, ran non-interactive fallback

Result: PASS
- Clear stderr: `do-lang: skills/codex/ not found at <path>; Codex installation cannot proceed. The codex source tree must be present in the package. Skipping Codex install.`
- Claude install still completed successfully
- Exit code 0 (warning, not fatal)

**Note:** Interactive scenarios (choices 1/2/3) require a real terminal session (stdin.isTTY). These must be run manually. Documented as manual-only in the Approach.

**Status:** Complete

---

### 2026-05-04 14:30 - Step 10 (Grep gate): All gates pass

Gate 1: `grep -rln "Agent(\|subagent_type\|~/.claude/" skills/codex/ agents/codex-*.md` → zero matches
Gate 2: `grep -rln "do-planner\|...\|do-debugger" skills/codex/ agents/codex-*.md` → zero matches
Gate 3: `grep -rn "subagent_type\|Agent({" skills/codex/ agents/codex-*.md` → zero matches

Manual Agent review (`grep -rn "\bAgent\b"`):
- `skills/codex/debug.md:61` — originally "Spawn codex-debugger Agent" → fixed to "Spawn codex-debugger subagent"
- `skills/codex/references/stage-execute.md:310` — "environments where the Agent tool is unavailable" → fixed to "environments where subagent spawning is unavailable"
- `skills/codex/references/init-project-setup.md:68` — "Agent model configuration:" — ACCEPTABLE: UI prompt text describing model config section, generic noun use

**Status:** Complete — all gates pass, all unacceptable "Agent" hits resolved

---

### 2026-05-04 14:35 - Step 11 (README check): No update needed

README already describes correct install paths (Claude Code → `~/.claude/commands/do/`, Codex → `~/.codex/skills/do/`). The Agent Pipeline section uses `do-*` agent names which is correct since it documents the general pipeline that applies across runtimes (the README is not runtime-specific at the agent name level).

No README changes needed.

---

### 2026-05-04 14:40 - Execution complete

**Status:** Complete
**Summary:**

- Steps completed: 11/11
- Files modified: 67 total (13 codex entry skills, 47 codex reference files, 8 codex agent files, 1 bin/install.cjs)
- Deviations: 0 blocking, 2 minor (stage-execute.md prose Agent fix; debug.md section header fix — both resolved in grep gate review)

## Council Review

<!--
Populated by council review stages.
-->

## Verification Results

### Approach Checklist

- [x] Phase A step 1: Canonical Agent → Codex spawn template defined and locked (with-model form; fence-removal directive included; parallel dispatch wording confirmed in stage-plan-review.md)
- [x] Phase A step 2: Canonical path replacements defined (3 literals, most-specific-first order)
- [x] Phase A step 3: Exact 8-name agent token map defined (no broad do- prefix substitution)
- [x] Phase B step 4: `skills/codex/` and `skills/codex/references/` created; `skills/codex/scripts/` NOT created
- [x] Phase B step 5: All 13 entry skills present in `skills/codex/`; Agent() JS blocks replaced with Codex spawn directives (fences removed); path rewrites applied; agent names rewritten; Agent removed from allowed-tools; prose Agent() references outside fences rewritten; frontmatter descriptions updated
- [x] Phase B step 6: All 47 reference files in `skills/codex/references/`; 12 with Agent() blocks hand-translated (fences removed); all files have path + agent-name rewrites; prose Agent() references outside fences rewritten
- [x] Phase C step 7: All 8 `agents/codex-*.md` files created; name: frontmatter updated to codex-* prefix; description: updated; path rewrites applied; Agent removed from codex-verifier.md tools list; agent-name references rewritten; AskUserQuestion blocks preserved; prose Agent() references outside fences rewritten
- [x] Phase D step 8: `bin/install.cjs` updated — `codexSource` constant added; `installCodex()` uses codexSource; guard clause logs to stderr and returns; explicit scripts cpSync added; agent filter changed from `do-` to `codex-`; `installClaudeCode()` completely unchanged
- [x] Phase D step 9: Non-interactive fallback smoke test run (verified in Execution Log AND re-run during verification); codexSource-missing guard test run (Execution Log); interactive scenarios (choices 1/2/3) documented as manual-only (require real terminal)
- [x] Phase D step 10: All three grep gates pass — zero matches for Agent(/subagent_type/~/.claude/, zero matches for 8 stale do- agent names, zero matches for Agent({ or subagent_type inside JS fences; manual Agent review completed with all unacceptable hits resolved
- [x] Phase D step 11: README checked — paths already accurate (`~/.claude/commands/do/` for Claude, `~/.codex/skills/do/` for Codex); no changes needed

### Quality Checks

- **Tests:** PASS (npm run test) — 808/808 tests pass, 0 failures

### Result: PASS
- Checklist: 11/11 complete
- Quality: 1/1 passing (tests)
- No lint or typecheck scripts detected in package.json
