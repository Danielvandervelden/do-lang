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

---

## Ideas

(Add future backlog items below)

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

### /do:quick — inline execution with single council review
**id:** do-quick-skill

**Problem:** The current execution-tier hierarchy is bimodal. On one end: inline execution (orchestrator edits files in the main conversation with zero review). On the other: `/do:fast` (task file created, `do-executioner` sub-agent spawned, `do-code-reviewer` sub-agent spawned, stage-override gymnastics, `active_task` mutated). There is no intermediate tier for the common "we've been discussing this, the change is small and mechanical, but the blast radius earns a second opinion" case — mid-conversation follow-ups that touch subtle rules (required validation, permission guards, reducer logic, one-line business-logic gates).

**Impact:** Two failure modes recur:
1. **Under-reviewed inline work.** Orchestrator makes a "quick" edit that touches a subtle rule without independent eyes on it. Issues ship that a 30-second council glance would have caught.
2. **Over-ceremonied small work.** `/do:fast` invoked for a 2-file change where the executioner re-loads context the main session already has from conversation, creates a task file that will never be referenced again, and runs through the full reviewer-plus-stage-override flow. The ceremony cost dominates the actual work.

**Fix:** Add a third execution tier: `skills/do/quick.md` (`/do:quick`).

**Mechanism:**
1. Orchestrator executes inline — no `do-executioner` spawn. The conversation IS the plan.
2. No task file on the happy path (lazy creation — only on escalation).
3. Run available validation on changed files (tsc/lint/prettier — reuse detection logic from `fast.md` Step 8).
4. Spawn `do-council-reviewer` (single voice, picked by `.do/config.json` → `council_reviews.reviewer`). Skip `do-code-reviewer` — the council IS the review.
5. One iteration budget:
   - APPROVED / NITPICKS_ONLY → done. Display summary. No task file written.
   - CHANGES_REQUESTED (first) → orchestrator fixes inline, re-spawn council once.
   - CHANGES_REQUESTED (second) → materialize task file now with `fast_path: true`, `stage: execution`, `stages.execution: review_pending`; set `active_task`; print: "Quick-path review failed twice. Escalate with `/do:fast` or `/do:task`." Stop.

**Entry criteria (tighter than /do:fast):**
- 1–2 files, roughly <30 lines changed
- Main session already has the context (invoked mid-conversation after discussion, not as a cold-start)
- No backend/API/schema/auth/state-machine changes
- Fix is mechanical once described — no real planning surface
- If any criterion fails → redirect to `/do:fast`

Match `fast-entry-declaration` spirit (no 4-checkbox gate) — single confirmation prompt, criteria documented in the skill description header.

**Smart routing — `/do:task` as the front door.** Rather than asking users to pick the tier, `/do:task` itself should assess the task and auto-route to the appropriate tier, with user override. This keeps `/do:quick` and `/do:fast` as explicit manual entry points (skip the router when you already know what you want) but makes `/do:task` the default smart entrypoint that every caller hits.

Add a new **Step 0: Routing** to `skills/do/task.md`, before refinement:

1. Quick heuristic assessment of the task from `$ARGUMENTS`:
   - Rough file-scope estimate (grep hints, description specificity)
   - Confidence score (same mechanic as `/jira:start` Step 8)
   - Mechanical-vs-planning signal (is the change obvious once described?)
   - Context warmth (is this mid-conversation follow-up or cold-start?)
2. Present the routing verdict to the user:
   ```
   ## Routing assessment

   Task: <description>
   Assessment: <N files estimate>, <mechanical/planning>, <confidence>
   Recommended: /do:<tier>

   Proceed with [quick | fast | task]? [<recommended>]
   ```
3. User picks any tier or accepts the default. Explicit override always wins.
4. If `quick` or `fast` is chosen, hand off to the respective skill's flow (internally — no nested skill invocation; `task.md` inlines the fast/quick logic by delegating to shared reference files). If `task`, proceed with existing refinement → planning → etc.

This collapses the tier decision into one entry point. `/jira:start` needs no changes — it already hands to `/do:task`, and the routing-inside-/do:task picks the right tier with the full ticket context available.

**Manual entry points remain:**
- `/do:quick "description"` — skip router, run quick-path directly (for when the user has already decided)
- `/do:fast "description"` — skip router, run fast-path directly
- `/do:task "description"` — smart router (default)

**Scope:**
- New: `skills/do/quick.md`
- Modify: `skills/do/task.md` — add Step 0 routing block, refactor downstream steps so quick/fast paths can be dispatched from within (likely via shared reference files under `skills/do/references/stage-quick.md` and reuse of existing `stage-*` references for fast/full paths)
- Modify: `skills/do/fast.md` — extract the post-Step-3 body into a reference file so it can be invoked from `task.md`'s router without duplication
- Modify: `README.md` feature list and tier descriptions (three tiers now, one smart router)
- Modify: `AGENTS.md` if it documents the tier matrix
- No changes needed in `commands/jira/start.md` — it already routes to `/do:task`, which now does its own tier selection

**Design considerations:**
- **Vibes-based criteria.** `/do:fast` has 8 hard gates; `/do:quick` leans on "context is already warm." That's subjective and not automatable without judgment. Accept this as a manual-invoke-only tier — don't try to auto-route from user intent detection into `/do:quick`.
- **Council latency trade-off.** ~30s for a single reviewer (vs ~60s for full council, vs 0s for inline). Worth the wait for the "small but non-obvious" sweet spot; not for true typos where review is skipped regardless.
- **Escalation fidelity.** When the second CHANGES_REQUESTED triggers task-file materialization, the orchestrator must capture the diff, validation results, and both council findings into the task file so `/do:continue` / `/do:fast` / `/do:task` can resume with full context. Otherwise escalation loses the review history.
- **Continuity state.** On escalation, materialize with `fast_path: true`, `stage: execution`, `stages.execution: review_pending` — same shape as `fast.md` post-exec — so `/do:continue` picks it up without new routing logic.
- **Backlog completion tracking — known limitation.** Since `/do:quick` has no task file on the happy path, the `backlog_item` frontmatter field can't carry a backlog id through. `/do:backlog done <id>` would need to be invoked manually by the user if a quick-path run closes a backlog item. Accept this limitation; don't add task files just for backlog tracking.
- **Skill-creator reminder.** `/do:quick` should still emit the same "`/skill-creator` if skill files were edited" reminder that `/do:fast` and `/do:task` do.
- **Router honesty in `/do:task`.** The auto-router must be honest about its confidence. If the signals are ambiguous (e.g., description is vague, can't estimate file scope), default to the full `/do:task` flow and say so — don't gamble on quick/fast. Better to over-ceremony a small task than under-ceremony a subtle one. The user can always override down.
- **No double task files.** If `/do:task` routes internally to fast/quick, the resulting task file (if any) should be written once at the appropriate tier's lifecycle point — not twice. Specifically: quick-path writes no task file on happy path; fast-path writes one at Step 4 as today; full-task writes one at refinement. The router itself writes nothing.
