# Phase 9: Task Resume - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Ensure `/do:continue` reliably resumes work from any task state, especially after `/clear` when conversation context is lost. This phase enhances the existing `/do:continue` implementation with robust context reconstruction and clear resume UX.

**Delivers:**
- Context reload logic with post-/clear detection
- Resume summary display before proceeding
- Execution Log parsing for mid-execution resume
- Stale reference handling with user confirmation
- Updates to stage reference files (stage-grill.md, stage-execute.md, stage-verify.md)

**Note:** Core `/do:continue` routing already exists from Phases 5-8. This phase adds robustness and UX polish.

</domain>

<decisions>
## Implementation Decisions

### Context Reload Scope
- **D-33:** Always re-read project.md + all docs listed in "Context Loaded" section after `/clear`. Ensures full context is available even when conversation history is lost.
- **D-34:** Use heuristic to detect if context needs reloading — only reload after `/clear`, not on every `/do:continue`. Heuristic: check if task description is already in conversation context.

### Resume State Display
- **D-35:** Always show resume summary before proceeding. User should know exactly where they are before work continues.
- **D-36:** Summary includes: task name + current stage, last action from Execution Log (or last Q&A from grill-me). Does NOT include confidence breakdown or next step preview — keep it focused.

**Resume summary format:**
```
Resuming: <task-slug> (stage: <stage>)
Last action: <summary from last log entry>

Continue? (yes/no)
```

### Mid-Execution Resume
- **D-37:** Parse Execution Log to determine resume point. Read last entry's "Status" and "Files" to understand what was completed.
- **D-38:** Show summary of completed work, ask user to confirm before continuing. Format:
```
Execution paused. Progress so far:
- [x] <completed file/action from log>
- [x] <another completed item>
- [ ] <remaining from Approach>

Continue from here? (yes/no)
```

### Stale Reference Handling
- **D-39:** Block and ask user when referenced docs are missing. Don't silently skip — the missing doc might be critical.

**Stale reference prompt:**
```
Referenced doc not found: <path>

Options:
1. Continue without it (task markdown has context)
2. Stop and locate the doc

Enter 1 or 2:
```

### Claude's Discretion
- Exact heuristic for detecting post-/clear state (e.g., grep conversation for task ID)
- How to summarize last Execution Log entry in one line
- Whether to group multiple missing docs into one prompt or ask about each

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Prior Phase Context
- `.planning/phases/05-task-creation-refine-agent/05-CONTEXT.md` — D-01: Comprehensive problem statements for session resumption
- `.planning/phases/07-context-decision-implementation/07-CONTEXT.md` — D-19: Conditional reference file loading by stage; D-20: Execution Log format
- `.planning/phases/08-verification-agent/08-CONTEXT.md` — D-32: Context-aware handoff pattern

### Existing Implementation
- `skills/do/SKILL.md` — `/do:continue` routing table and stage detection logic
- `skills/do/references/stage-grill.md` — Grill-me flow (needs context reload addition)
- `skills/do/references/stage-execute.md` — Execution flow with Step E1 "Load Task Context" (needs enhancement)
- `skills/do/references/stage-verify.md` — Verification flow with Step V0 "Load Task Context" (needs enhancement)
- `skills/do/references/task-template.md` — Task markdown structure with "Context Loaded" section
- `skills/do/scripts/load-task-context.cjs` — Context loading script (may need re-use)

### Project Constraints
- `.planning/PROJECT.md` — Token efficiency core value, flat hierarchy constraint
- `.planning/REQUIREMENTS.md` — TS-11 acceptance criteria for task resume

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `load-task-context.cjs` — Already loads project.md and matched docs; can be called on resume
- Stage reference files — Have "Load Task Context" steps that can be enhanced
- Execution Log parsing pattern — Already used in stage-verify.md Step V2

### Established Patterns
- YAML frontmatter for stage tracking (`stage:`, `stages.<stage>:`)
- Inline text prompts for user interaction (consistent across all phases)
- "Context Loaded" section in task markdown lists all matched doc paths

### Integration Points
- `/do:continue` reads `active_task` from config.json → loads task markdown → routes to stage file
- Stage files read task markdown sections → should also re-read database docs after /clear
- `load-task-context.cjs` can be called at resume time, not just task creation time

</code_context>

<specifics>
## Specific Ideas

- Post-/clear detection heuristic: Check if task `description` field from frontmatter appears in recent conversation. If not found, assume /clear was run.
- Resume summary should be displayed BEFORE any stage-specific logic runs
- Consider adding a "Step R0: Resume Check" to the top of each stage file, or a shared preamble in SKILL.md
- Execution Log "Status" field values: "In progress" (incomplete), "Execution complete" (done) — use these to detect resume point
- When multiple docs are missing, batch them into one prompt: "These docs not found: [list]. Continue anyway?"

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-task-resume*
*Context gathered: 2026-04-13 via discuss-phase*
