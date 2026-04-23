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

### stage-fast-exec.md: load-task-context.cjs invocation missing description argument
**id:** fast-exec-load-context-arg

**Problem:** `stage-fast-exec.md` FE-2 shows `node ~/.claude/commands/do/scripts/load-task-context.cjs` without passing the task description as an argument. The script requires a description string for keyword matching and exits with `"No task description provided"` when called bare. This causes agents to fail on first try, then have to guess that a description argument is needed.

**Fix:** Update `stage-fast-exec.md` FE-2 to show the description argument explicitly:
```bash
node ~/.claude/commands/do/scripts/load-task-context.cjs "<description>"
```
Where `<description>` is the in-session variable already available from the caller contract. One-line fix in the reference file.

---

### ~~Rewrite do-lang agent interactions to use AskUserQuestion~~
**id:** ask-user-question-rewrite
**Status:** DONE (2026-04-23) — task file: `.do/tasks/260423-ask-user-question-rewrite.md`

**Scope:** All agent definitions in `agents/`, orchestrator skills in `skills/do/`, and reference files in `skills/do/references/`.

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


