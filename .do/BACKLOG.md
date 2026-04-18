# /do Backlog

## Completed

### Council Review Architecture Refactor

**Completed:** 2026-04-14

**Problem:** Models consistently ignored agent-spawning instructions in do-plan-reviewer and do-code-reviewer, performing council reviews inline instead of spawning sub-agents. The external reviewer (codex/gemini) never actually ran.

**Solution:** Moved parallel spawning responsibility to the orchestrator level (Design B):
- New `do-council-reviewer` agent: thin wrapper around council-invoke.cjs
- Simplified do-plan-reviewer and do-code-reviewer to self-review only
- Orchestrator (task.md/continue.md) owns the iteration loop: spawn reviewers → filter findings → pass fixes to executioner/planner → re-spawn (up to 3 cycles)
- Fixed stage handoff: verification stage now runs before marking verified
- Fixed council-invoke.cjs timeout: 90s → 180s (Codex reviews take ~90-120s)

**Also resolved these backlog items:**
- `/do:task` missing plan-reviewer spawn step (now Step 6)
- Execution stage missing code-reviewer spawn step (now Step 10)
- `do-plan-reviewer` running reviews inline (council logic removed, orchestrator spawns)

### Agent-Based Workflow Refactor

**Completed:** 2026-04-14 (v1.2.0)

**Problem:** Skills are markdown prompts that get skipped when context is long. Council reviews and verification stages were being forgotten.

**Solution:** Implemented 6 specialized agents that own their full workflow loops. Initial set; agents and colors have since evolved (see later entries).

**Key features:**
- Agents can't skip steps — they own their full loop
- Parallel reviews (self + council) for speed
- Auto-iterate up to 3x if reviews find issues
- Model configuration per-agent in `.do/config.json`
- ctx7 integration for planner and debugger research
- Installed to `~/.claude/agents/` via postinstall

### do-verifier Agent + Quality Check Extraction

**Completed:** 2026-04-15 (v1.6.0)

**Problem:** do-executioner was running quality checks and UAT inline, making it bloated and easy to skip in long sessions.

**Solution:** Extracted verification into a dedicated `do-verifier` agent (silver). Removed quality checks from do-executioner. Wired do-verifier into `task.md` and `continue.md` routing.

### Harden do-code-reviewer Parallel Spawning

**Completed:** 2026-04-15 (v1.6.1)

**Problem:** do-code-reviewer was still performing council reviews inline instead of spawning do-council-reviewer as a parallel agent.

**Solution:** Added critical rule enforcement and parallel spawn instructions to do-code-reviewer.

### /do:update Skill

**Completed:** 2026-04-15 (v1.7.0)

**Problem:** No built-in way to check or update the installed do-lang version.

**Solution:** Added `/do:update` skill that checks the published version against the installed version and runs `npm install -g` (not `npm update -g`) to ensure postinstall fires on update.

### /do:optimise — Multi-Source Best-Practices Auditor

**Completed:** 2026-04-15 (v1.9.0, pending release)

**Problem:** Existing review stages (plan review, code review) check plan fitness and code correctness but don't systematically verify whether implementations follow current best practices for the specific technology involved.

**Solution:** Standalone skill (`skills/do/optimise.md`) backed by `optimise-target.cjs`. Accepts any target (project, file, agent, skill, script) and `--effort low|medium|high` flag. Multi-source research: ctx7 docs + peer file comparison + web search (high only). Produces a structured report with severity levels (critical/warning/suggestion), file:line references, quoted source lines, concrete fix descriptions, and source citations. Optional save to `.do/optimise/<slug>-<date>.md`.

### Orchestrator-Level Parallel Review Spawning

**Completed:** 2026-04-15 (v1.8.0)

**Problem:** Reviewer agents (do-plan-reviewer, do-code-reviewer) were supposed to internally spawn self-review + council in parallel, but sub-agents silently skipped it. Patching each agent was whack-a-mole.

**Solution:** Moved parallelism to the orchestrator. `task.md` and `continue.md` now spawn `do-plan-reviewer` + `do-council-reviewer` in a single message at Step 6, and `do-code-reviewer` + `do-council-reviewer` in a single message at Step 10. Reviewer agents stripped to self-review only (no Agent tool needed). New `stage-plan-review.md` and `stage-code-review.md` reference files own the full review block including iteration loop.

### Remove Redundant Verification Quality Checks

**Completed:** 2026-04-15 (v1.8.0, partial — accepted as done)

**Problem:** `do-verifier` was re-running tsc/lint/prettier after code review had already confirmed them passing.

**Solution (shipped):** Removed V-1 (inline council code review) from `stage-verify.md` — council code review now runs exclusively in `stage-code-review.md`. Remaining ask (skip V3-V4 quality pipeline checks when `council_review_ran.code` is set) deferred indefinitely — low ROI given council review only runs on opt-in configs.

### Remove Codex Runtime Support

**Completed:** 2026-04-15 (d21f449)

**Problem:** Supporting both Claude Code and Codex CLI added token overhead and dual-location install complexity with negligible benefit.

**Solution:** Removed `~/.codex/` copy logic from `bin/postinstall.js`, removed Codex runtime path (`invokeCodex`, PLUGIN_ROOT, codex null-branches) from `council-invoke.cjs`, removed codex detection from `detect-tools.cjs`, deleted `codex/` directory. do-lang is now Claude Code only.

### Audit Core Agents with /do:optimise

**Completed:** 2026-04-15 (32ee4de, a6bd10a)

**Problem:** Core workflow agents had accumulated instruction debt — wrong tool references, missing guards, misleading tool lists.

**Solution:** Ran `/do:optimise` on `do-planner` and `do-debugger`; applied findings. do-planner: removed WebSearch, added permissionMode, fixed ctx7 invocation to use Bash, added confidence writeback, 3-command budget cap. do-debugger: ctx7 `!==false` check. council-invoke.cjs: EPIPE guard, semver-safe PLUGIN_ROOT, pure-JS random, AbortController double-resolution guard.

### /do:quick — Inline Execution with Single Council Review

**Completed:** 2026-04-16 (v1.11.0)

**Problem:** The execution-tier hierarchy was bimodal: inline edits (zero review) or `/do:fast` (task file + sub-agent spawns). No intermediate tier for mid-conversation follow-ups where context is warm and the change is mechanical but non-obvious enough to warrant a second opinion.

**Solution:** Added `/do:quick` as a third execution tier:
- Orchestrator executes inline (no sub-agent spawn)
- No task file on the happy path (lazy materialization only on escalation)
- Single council reviewer checks the diff (~30s)
- One iteration budget; second CHANGES_REQUESTED escalates to materialized task with `fast_path: true` + `quick_path: true`
- Entry criteria: 1-2 files, warm context, mechanical change, no schema/auth/API
- `/do:task` Step 0 Smart Routing added (binary fast/task auto-router — `/do:quick` is manual-only)
- Extracted `stage-fast-exec.md` reference from `fast.md` for reuse
- Added quick-path escalation resume route to `/do:continue` Step 6

---

## Ideas

(Add future backlog items below)

### Agent compound learning — capture reviewer patterns to reduce iteration loops
**id:** agent-compound-learning

**Problem:** β's code review loop ran 21 iterations. Many findings were pattern-level mistakes that recurred across iterations: template-section name mismatches (iter 19), missing template sections (iter 20), shared-agent terminology drift (iter 17), parent-index staleness (iter 16). The planner and executioner have no mechanism to learn from past reviewer/council findings, so they repeat the same classes of errors on every new task.

**Impact:** Each avoidable iteration costs ~5-10 minutes of agent time + context tokens. Over a large task like β, pattern-level mistakes that could have been avoided on first pass consumed significant review budget. The council and self-reviewer effectively re-discover the same lesson each time.

**Fix:** Ship a `lessons-learned.md` (or structured equivalent) that accumulates reviewer findings categorized by pattern type (template-contract alignment, shared-agent terminology, state-reads architecture, section-naming). Planner and executioner load this as context when starting work. Key design decisions:
1. **Capture mechanism:** After each ITERATE cycle, the orchestrator extracts the pattern category and appends a one-liner to `lessons-learned.md`
2. **Staleness guard:** Lessons reference specific files/sections — if those are deleted/renamed, the lesson is auto-pruned or flagged
3. **Context budget:** Cap at ~50 lessons; older ones compress or archive. Tradeoff: loading past mistakes costs tokens, stale lessons could mislead

**Open questions:**
- Per-project or workspace-global? Project-specific patterns (template names) vs. universal patterns (always check template-stage contract alignment)
- Should council findings auto-promote to lessons, or require human curation?
- Is a structured file better than a memory-system entry? (Memory is cross-conversation but not agent-loadable as context)

---

### Auto-invoke /do:debug from do-executioner when bugs are encountered
**id:** auto-debug-executioner

**Problem:** AGENTS.md says "when you encounter a bug during implementation, invoke `/do:debug` immediately" — but the `do-executioner` agent has no mechanism to detect when it's hit a bug vs. a simple deviation, and no instructions to spawn `do-debugger` as a sub-agent. Currently bugs only get debugged if the user manually reports them and invokes `/do:debug`.

**Impact:** When execution hits a runtime bug (e.g., wrong request sent, component not rendering, event bubbling issue), the executor either tries to fix it ad-hoc (going in circles) or reports it as a completed step without noticing the problem. The structured scientific-method debugging (hypothesis → test → confirm/reject) is bypassed.

**Fix:** Add to `do-executioner` agent instructions:
1. Define what constitutes a "bug" during execution: unexpected runtime behavior after a step is implemented (not a type error or lint failure — those are just fix-and-continue)
2. When a bug is detected, the executor should: pause execution, spawn `do-debugger` as a sub-agent with the symptom description, wait for the fix, then resume execution
3. The debug session should be linked to the active task automatically
4. Consider a complexity/time heuristic: if the executor has tried 2+ fixes for the same issue without success, that's the trigger to escalate to the debugger rather than continuing ad-hoc

---


### /do:backlog — backlog management for any do-lang project
**id:** backlog-skill

**Idea:** A command that makes backlog-driven development a first-class citizen in the do-lang workflow. Every project that runs `/do:init` gets a `.do/BACKLOG.md` automatically. `/do:backlog` is the interface for managing it.

**Usage (proposed):**
```
/do:backlog                          # Show all backlog items (ideas + completed)
/do:backlog add "description"        # Add a new idea interactively
/do:backlog start                    # Pick an item and turn it into a /do:task
/do:backlog done                     # Move the active task's backlog item to Completed
```

**How it would work:**

`/do:backlog` (list): Read `.do/BACKLOG.md` and display a clean summary — item titles, one-line descriptions, grouped by Ideas vs Completed.

`/do:backlog add`: Interview the user (inline prompt, no agent needed) to capture:
- Title
- Problem / motivation
- Proposed fix / approach (optional — can be vague at this stage)
- Impact (why it matters)
Append to the `## Ideas` section in the same structured format.

`/do:backlog start`: Show numbered list of ideas, user picks one, skill creates a task file pre-seeded with the backlog item's problem statement and proposed approach, then hands off to `/do:task` flow. Marks the item as `in_progress` in BACKLOG.md.

`/do:backlog done`: Moves the in-progress item to `## Completed` with a completion date. Intended to be called after `/do:task` completes.

**Why it's useful:** Right now BACKLOG.md exists but is manually managed — there's no command to add items or promote them to tasks. Projects that adopt do-lang don't know the backlog exists unless they stumble on the file. Making it a visible command (`/do:backlog`) establishes the pattern: ideas go in the backlog, tasks come from the backlog.

**Design considerations:**
- `/do:init` should mention BACKLOG.md in its completion message and suggest `/do:backlog add` as a next step
- The `start` flow should pre-fill the task file from the backlog item to avoid re-typing context
- `done` should be optional — completing a task doesn't always map to a single backlog item
- Consider fuzzy search / filtering for projects with large backlogs

---

### Add "revise and re-execute" loop to /do:task workflow
**id:** revise-reexecute-loop

**Problem:** After code review or user feedback, there's no structured way to update the task file with changes and re-execute. The user has to manually ask to update the task file, then manually ask to spawn the executor again. This "user requests changes → update task → re-execute" cycle is a natural part of any task workflow but isn't represented in the skill.

**Impact:** Every revision requires the user to manually orchestrate what should be an automatic loop. The workflow breaks out of the structured /do system into ad-hoc conversation, losing the benefits of task file tracking and execution logging.

**Fix:** Add a revision stage to the /do:task lifecycle:
1. After code review (or user feedback at any point), allow amendments to the task file under a `## Post-Review Revision` section
2. The revision should be structured (numbered steps, file paths, concrete changes) just like the original approach
3. Re-spawn `do-executioner` with the revision steps only (not the full plan)
4. Log the revision execution in the task file's execution log
5. Consider a `/do:revise` command or integrating into `/do:continue` stage detection

---

### /do:fast — replace 8-item criteria checklist with a declaration
**id:** fast-entry-declaration

**Problem:** `fast.md` Step 3 presents an 8-checkbox "entry criteria check" to the user before every fast-path task. This adds friction to what is supposed to be the quick path — anyone invoking `/do:fast "fix typo"` already knows it qualifies. The routing logic in `do.md` already filters tasks toward `/do:fast` only when they're clearly trivial; the checklist is a second gate on top of a gate that already ran.

**Impact:** The fast path feels slower than it should for genuinely simple tasks. Users who are already familiar with the criteria still see the full checklist every time.

**Fix:** Replace the interactive 8-item checklist with a concise declaration in the skill description (e.g., "Fast-path is for tasks touching 1-3 files with no schema/auth/API changes. If you're unsure, use `/do:task`."), then just ask a single confirmation: "This looks like a fast-path task — proceed? [Y/n]". If the user hesitates, redirect to `/do:task`. The criteria don't need to be enumerated every run — they should live in the skill header/description as permanent context.

**Scope:** `skills/do/fast.md` Step 3 only. Single-file change.

---

### test-check-database-entry-empty — test coverage for 100-byte empty detection

**id:** test-check-database-entry-empty

**Problem:** `scripts/check-database-entry.cjs` has a "100-byte empty file" detection path that is not covered by tests. The logic was added/changed during a recent task but no unit test was written for it.

**Fix:** Add a test in `scripts/__tests__/` that creates a stub file under 100 bytes and asserts `check-database-entry.cjs` treats it as empty/missing.

---

### test-task-abandon-deep-clone — test coverage for task-abandon.cjs deep-clone fix

**id:** test-task-abandon-deep-clone

**Problem:** `scripts/task-abandon.cjs` received a deep-clone bug fix (gray-matter cache mutation) in a recent task but no unit test was written for the mutation-free path.

**Fix:** Add a test in `scripts/__tests__/` that calls the abandon logic twice on the same task file and asserts the frontmatter of the original file object is not mutated by the second call.

---

### /do:continue — skip context reload when context is demonstrably fresh
**id:** continue-skip-reload

**Problem:** `resume-preamble.md` Step R0.2 says "Since Claude cannot reliably introspect its context window, always proceed to R0.3" — meaning `load-task-context.cjs` runs unconditionally on every `/do:continue`. This re-reads `project.md` + all matched docs even immediately after a `/do:task` where the planner just loaded them in the same session. The workaround note ("Skip reload ONLY IF context was explicitly loaded earlier in this conversation") is aspirational — in practice it's always skipped due to the override.

**Before implementing:** Verify whether this is actually causing noticeable token waste in real sessions. Check if Claude's context window does reliably contain prior load-task-context output after a plan stage. If the "always reload" behavior is intentional and the cost is low, this may not be worth the added complexity.

**Potential fix:** Add a `--no-reload` flag to the `/do:continue` invocation that the orchestrator can pass when it knows context is fresh (e.g., immediately after plan approval before handing off to execution). Alternatively, detect whether the task description appears verbatim in the current conversation to short-circuit the reload. Keep the unconditional reload as the safe default.

**Scope:** `skills/do/references/resume-preamble.md` + potentially `skills/do/continue.md` and `skills/do/task.md` for flag threading.

---

### do-griller — include project root in spawn prompt so it doesn't search for task files

**id:** griller-missing-project-root

**Problem:** `do-griller` was observed running `find /Users/globalorange -name "260416-do-backlog-skill.md"` because it didn't know where to find the task file. The orchestrator passes `Task file: .do/tasks/<filename>` (relative path) without a project root, so the griller can't resolve it and falls back to a filesystem search.

**Fix:** Two changes: (1) All griller spawn prompts in `task.md`, `continue.md`, and any reference files must include `Project root: <cwd>` alongside the task file path. (2) Add an instruction to `agents/do-griller.md` to always read the task file using the path provided — never search for it with `find`.

---

### do-griller — ask all questions upfront instead of one at a time

**id:** griller-ask-all-at-once

**Problem:** `do-griller` currently asks one question per spawn — the orchestrator relays Q1, the user answers, the orchestrator re-spawns the griller for Q2, etc. Each round costs ~16k tokens and ~40s. For 3 questions that's ~48k tokens and ~2 minutes wasted in back-and-forth.

**Fix:** `agents/do-griller.md` `<grilling_philosophy>` explicitly says "**One question at a time.**" — change this to "**Ask all questions at once.**" and update Step 3 (`Ask Questions`) to present all questions in a single numbered list. The user answers all in one message. If answers raise new questions, ask all new questions in the next spawn (again, all at once). Never present one question and wait — always batch everything you have.

---

### Review findings classifier — blockers re-spawn planner, nitpicks go inline
**id:** review-findings-classifier

**Problem:** `stage-plan-review.md` (and `stage-code-review.md` by analogy) treats every non-PASS verdict the same — any CONCERN returned by self-reviewer or council triggers a full `do-planner` / `do-executioner` re-spawn. That's ~45k opus tokens and ~3 minutes per round. In a healthy iteration, late rounds surface nitpicks (example-text corrections, missing one-line clarifications, fix-text wording) that a one-line Edit tool call would resolve. Observed live during Task α plan review: across 4 iterations, ~6 of ~12 findings were nitpicks that cost full planner spawns. The reviewers are doing the right thing — they're finding real residuals — but the response is over-sized for the severity.

**Fix:** Extend `stage-plan-review.md` (and `stage-code-review.md`) with a finding-classification step BEFORE the ITERATE branch. Each reviewer finding gets a severity tag:
- **blocker** — scope gap, unassigned responsibility, contradicts authoritative source, or a design-level ambiguity. Requires planner/executioner re-spawn with a structured patch brief.
- **nitpick** — doc-text wording, missing example, typo, one-line clarification, or a fix that demonstrably changes no code path. Handle inline via Edit tool; log the inline patch in a dedicated "Review Iterations — Inline Patches" subsection.

If the set of findings is all-nitpick: PASS the stage after inline application, no re-spawn. If any finding is a blocker: re-spawn planner with all findings (nitpicks included — the planner can batch them into the same patch pass). Keep the 3-iteration cap; nitpick-only passes don't count against it.

Classification could be done by the orchestrator reading each finding's severity (reviewers already produce severity-ish language), or by adding an explicit `severity: blocker | nitpick` field to the reviewer output contract. Latter is cleaner but requires prompt changes in both `do-plan-reviewer.md` and the council-invoke codex prompt. Former is zero-config but relies on orchestrator judgment.

Secondary surfaces to review once the core logic lands: `stage-code-review.md` (same pattern), `task.md` Step 6 + Step 10 (reference the new classification), possibly the `do-plan-reviewer` / `do-code-reviewer` output contracts (if explicit severity tagging is adopted).

Scope: primarily `skills/do/references/stage-plan-review.md` + `skills/do/references/stage-code-review.md`, with optional reviewer-output-contract updates. Ship with tests covering: all-PASS (no-op), all-nitpick (inline + pass), mixed (re-spawn with full brief), all-blocker (re-spawn with full brief).

---


### Agent-behavior integration test harness — end-to-end `do-executioner` / `do-verifier` testing
**id:** agent-behavior-harness

**Problem:** Task β shipped `skills/do/scripts/__tests__/agent-frontmatter-gates.test.cjs` to lock down the frontmatter-presence-gated write contract for `do-executioner` and `do-verifier` (fields: `modified_files[]`, `discovered_followups[]`, `unresolved_concerns[]`, `wave_summary`, `active_task` clear gate). The tests are **spec-tests**: they exercise helper functions that reimplement the documented gate logic from the agent markdown. They do not actually run the agents against real fixture files, because agents are prose prompts, not executable code.

This is honest and sufficient as a drift-check against the helper — but the original task β AC #11 asked for "behavioural tests" which these are not, strictly speaking. A real harness would spawn `do-executioner` / `do-verifier` in a fixture workspace, let each agent touch a prepared target file (task / phase / wave), and diff the result against a golden snapshot.

**Fix:** Build an agent-behavior integration test harness. Scope sketch:
- Fixture workspace generator (`mkdtempSync` based — same pattern as existing unit tests).
- Harness runner: spawn a named agent with a deterministic prompt, capture the resulting file state.
- Golden-snapshot diff model: record the expected post-state in a fixture file, compare the agent's actual output.
- CI-viability note: agent spawning costs tokens + time; either stub the model layer (fast, no-token) or run the real agent behind a `CI_INTEGRATION=1` flag (slow, accurate).

Secondary: once the harness exists, back-fill coverage for the β frontmatter-presence-gated write contract (replace or supplement `agent-frontmatter-gates.test.cjs` with real agent invocations) and extend to other agent specs (planner, griller, code-reviewer).

Scope: new file `skills/do/scripts/lib/agent-harness.cjs` + a `__tests__/integration/` folder. Ship with one reference integration test exercising `do-executioner`'s `modified_files[]` write gate end-to-end. Flagged behind a CI env var so the unit-test suite stays fast.

---
