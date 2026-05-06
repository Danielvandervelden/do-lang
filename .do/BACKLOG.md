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

---

### Executioner should advance task metadata after successful execution
**id:** executioner-advance-task-stage

**Problem:** In the Codex `/do:task` flow, `codex-executioner` can complete implementation and verification checks but leave the task frontmatter unchanged at `stage: refinement` / `stages.execution: pending`. The orchestrator then has to repair the task file manually before code review can run.

**Impact:** `/do:continue` can route to the wrong stage after execution, especially after a context clear or interruption. This creates stale task state, duplicate planning/execution risk, and manual metadata edits that should be owned by the workflow.

**Fix:** Update the executioner/orchestrator contract so a successful execution pass reliably records completion in task metadata. Options: (1) make `codex-executioner` set `stage: execution` and `stages.execution: complete` before returning success; or (2) make the orchestrator stage wrapper update those fields immediately after the executioner returns successfully. Add a regression test or fixture scan that catches successful execution handoffs without a task-stage advancement.

---

### Broaden fast-path criteria for mechanical shared-utility refactors
**id:** broaden-fast-path-criteria
**Problem:** `/do:fast` currently requires a very small surface area (1-3 files) and excludes shared abstractions/utilities. That is too narrow for bounded mechanical refactors where an existing shared utility is reused across several consumers. Example: consolidating duplicate FleetLinq `buildCarLabel` helpers into the existing `formatCarString` utility touched 5 files, had focused tests, and no API/schema/auth/routing/state risk, but the current criteria forced full `/do:task` even though the work was fast-path in spirit.
**Fix:** Adjust `/do:fast` eligibility to allow mechanical edits to existing shared utilities/components when the contract is not materially changing, the affected consumers are bounded (for example up to ~6 files), focused tests exist or can be added, and there is no API/schema/auth/routing/state/business-logic uncertainty. Keep full `/do:task` for new shared abstractions, broad shared behavior changes, generated/API fallout, unclear product behavior, or large/exploratory refactors. Update the router decision matrix and fast workflow entry criteria together so they agree.
---
