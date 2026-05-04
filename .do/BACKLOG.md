# /do Backlog

## Ideas

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

### Execution metrics and pipeline analytics
**id:** execution-metrics

**Problem:** The entire pipeline (5-7 agent spawns, multiple review rounds) has zero tracking of success/failure rates, execution times, iteration counts, or pipeline bottlenecks. Every task creates a rich execution log in its markdown file, but this data is never aggregated. Without metrics, you can't answer "which agent is my bottleneck?" or "what's my first-pass success rate?"

**Fix:** Add a `.do/metrics.jsonl` append-only log. Each pipeline completion appends one line: `{task_id, started, completed, agents_spawned, iterations, verdict_history, files_modified_count}`. Add a `/do:metrics` command to summarize trends. Keep it simple — one JSONL line per task, no external dependencies. Optionally add per-agent token/time estimates to task file frontmatter.

---

### /do:continue — skip context reload when context is demonstrably fresh
**id:** continue-skip-reload

**Problem:** `resume-preamble.md` Step R0.2 says "Since Claude cannot reliably introspect its context window, always proceed to R0.3" — meaning `load-task-context.cjs` runs unconditionally on every `/do:continue`. This re-reads `project.md` + all matched docs even immediately after a `/do:task` where the planner just loaded them in the same session. The workaround note ("Skip reload ONLY IF context was explicitly loaded earlier in this conversation") is aspirational — in practice it's always skipped due to the override.

**Before implementing:** Verify whether this is actually causing noticeable token waste in real sessions. Check if Claude's context window does reliably contain prior load-task-context output after a plan stage. If the "always reload" behavior is intentional and the cost is low, this may not be worth the added complexity.

**Potential fix:** Add a `--no-reload` flag to the `/do:continue` invocation that the orchestrator can pass when it knows context is fresh (e.g., immediately after plan approval before handing off to execution). Alternatively, detect whether the task description appears verbatim in the current conversation to short-circuit the reload. Keep the unconditional reload as the safe default.

**Scope:** `skills/do/references/resume-preamble.md` + potentially `skills/do/continue.md` and `skills/do/task.md` for flag threading.

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

### Agent-behavior integration test harness — end-to-end do-executioner / do-verifier testing
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

### Fast-path FE-2 context scan should keyword-match project docs
**id:** fast-exec-keyword-context

**Problem:** The fast-path's FE-2 "Quick Context Scan" only spot-checks the target files mentioned in the task description. It does not do keyword → doc matching (e.g., `useSelector` → `store-state.md`, `useForm` → `forms.md`, `api` → `api-layer.md`). The full planner does this via `load-task-context.cjs`, but the fast path skips the planner entirely. This means executioners on fast-path tasks miss project conventions documented in topic files and fall back to generic patterns (e.g., using `useSelector` instead of the project's `useAppSelector` wrapper).

**Impact:** Recurring review feedback for convention violations that are clearly documented in the project database. The whole point of the database docs is to prevent this — but they're only loaded on the full pipeline path.

**Fix:** In `stage-fast-exec.md` FE-2, add a lightweight keyword → doc mapping step:
1. Scan the task description for domain keywords (configurable per-project or via a standard mapping: `useSelector|useDispatch|Redux|slice|store` → `store-state.md`, `useForm|react-hook-form|validation` → `forms.md`, `api|query|mutation|endpoint` → `api-layer.md`, `route|layout|navigate` → `routing-layouts.md`, etc.)
2. For each matched doc, load it and append to the Context Loaded section
3. Keep it fast — this is keyword matching, not deep analysis. The mapping can live in `project.md` or `.do/config.json` as a `context_keywords` table
4. Consider reusing `load-task-context.cjs` with the task description (currently broken on fast-path — see backlog item `fast-exec-load-context-arg`)

**Scope:** `skills/do/references/stage-fast-exec.md` FE-2 section. Potentially `scripts/load-task-context.cjs` if reuse is feasible.

---

### /do:optimise fails at workspace level — checks .do/config.json but workspace uses .do-workspace.json
**id:** optimise-workspace-init
**Problem:** Step 1 of `optimise.md` checks for `.do/config.json` only. Workspace-level init (`/do:init` at workspace root) creates `.do-workspace.json` instead. Running `/do:optimise` at `~/workspace` reports "not initialized" and aborts, even though the workspace has `.do-workspace.json` and `.do/tasks/`.
**Fix:** 1. `optimise.md` Step 1: check for both `.do/config.json` AND `.do-workspace.json` — if either exists, treat as initialized and read the appropriate config. 2. `optimise-target.cjs` `gatherProjectContext` (line 365): also check `.do-workspace.json` as a context file candidate.
---

### project-scaffold.cjs overwrites phase.md and project.md frontmatter when seeding waves
**id:** scaffold-frontmatter-overwrite
**Problem:** When `project-scaffold.cjs` seeds waves into a phase, it overwrites both `phase.md` and `project.md` frontmatter, stripping most fields that were already populated. After running the scaffold for Phase 00 waves, both files had to be manually restored. The scaffold should only update the fields it owns (e.g., `waves[]` array, `active_wave`) without touching other frontmatter fields.
**Fix:** Change the scaffold's frontmatter write logic to merge new fields into existing frontmatter rather than replacing the entire frontmatter block. Use a read-modify-write pattern: parse existing frontmatter with gray-matter, merge scaffold-owned fields, re-stringify. Audit for the same bug in other scaffold operations (phase seeding into project.md, etc.).
---

### Research de-duplication strategy for Claude/Codex skill files
**id:** skill-dedup-research
**Problem:** do-lang is growing beyond a personal project, making the maintenance cost of duplicating skill/agent `.md` files across Claude and Codex targets a real concern. The `Agent(...)` call blocks are the only platform-specific parts of reference files — the rest of the prose logic is identical across both skill sets.
**Fix:** Evaluate two approaches: (1) shared reference files + template build step with `{{SPAWN_AGENT planner}}` markers expanding to platform-specific syntax at install time; (2) accepting markdown duplication with a manual sync discipline and tooling to diff the two sets. Make a proper architectural decision before the file count grows further.
---

### /do:project complete should offer commit, push, release, tag, and update flow
**id:** project-complete-release-prompt
**Problem:** After `/do:project complete`, the project state is archived but the user still has to remember the operational release steps manually: commit the feature branch, push it, tag/release/publish if appropriate, and run `/do:update` to refresh installed skills. This is easy to forget because completion feels like the end of the workflow even though the shipped package is not updated yet.

**Fix:** Add a post-completion prompt to the `/do:project complete` flow asking whether the user wants to commit and push the completed feature, then release/tag/publish and run `/do:update`. If accepted, route into the existing release workflow rather than reimplementing release logic inside `/do:project`.
---
