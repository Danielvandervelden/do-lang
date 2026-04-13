# Phase 7: Context Decision & Implementation - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement the context clear decision and task execution flow within `/do:continue`. After grill-me completes (or if confidence was already >= threshold), prompt user about clearing context, then execute the task following the documented approach.

**Delivers:**
- Context clear prompt (hybrid: AskUserQuestion with inline fallback)
- Conditional reference file loading based on stage
- `references/stage-execute.md` — execution flow
- Refactor grill-me into `references/stage-grill.md`
- Execution logging in task markdown (files + decisions)
- Stage transitions: `execution → verification`

**Architectural change:** Phase 7 introduces conditional reference loading. SKILL.md becomes a router that loads stage-specific files.

</domain>

<decisions>
## Implementation Decisions

### Context Clear Method
- **D-18:** Hybrid context clear prompt — try AskUserQuestion first ("Clear context before implementation?"), if empty/fails, fall back to inline text prompt. Log which method succeeded. This addresses the documented AskUserQuestion bug while honoring TS-08.

### Implementation Structure
- **D-19:** Conditional reference files — SKILL.md routes based on `stage` from task frontmatter, then reads the appropriate reference file:
  - `stage: refinement` + `stages.grilling: in_progress/pending` → `references/stage-grill.md`
  - `stage: refinement` + ready for execution → `references/stage-execute.md`
  - `stage: execution` → `references/stage-execute.md`
  - `stage: verification` → `references/stage-verify.md` (Phase 8)
  
  **Refactor required:** Move existing grill-me flow from SKILL.md into `references/stage-grill.md`. SKILL.md keeps only routing logic and shared utilities.

### Execution Logging
- **D-20:** Execution log format in task markdown:
  ```markdown
  ## Execution Log
  
  ### YYYY-MM-DD HH:MM
  **Files:**
  - `path/to/file.ts` — Change summary
  
  **Decisions:**
  - Plan said X — chose approach Y because Z
  - [If error] Tried A, failed because B, resolved with C
  
  **Status:** Wave N complete / In progress
  ```

### Error/Deviation Handling
- **D-21:** Stop and ask user on ANY deviation from plan. No autonomous resolution. Format:
  ```
  Plan said: [original instruction]
  Issue: [what happened]
  
  Options:
  1. [Alternative A]
  2. [Alternative B]
  3. Pause and investigate
  ```
  User must confirm before proceeding. Log the decision in execution log.

### Stage Transitions
- **D-22:** After execution completes:
  - Update `stage: verification`
  - Update `stages.execution: complete`
  - Update `stages.verification: in_progress`
  - Display: "Execution complete. Proceeding to verification. (Phase 8 - not yet implemented)"

### Claude's Discretion
- Exact wording of context clear prompt options
- How to detect if AskUserQuestion succeeded vs failed
- Formatting of execution log entries
- How to chunk execution into logical entries (per file? per wave? per decision?)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Prior Phase Context
- `.planning/phases/05-task-creation-refine-agent/05-CONTEXT.md` — D-01 through D-12: task markdown structure, confidence model, context loading
- `.planning/phases/06-grill-me-agent/06-CONTEXT.md` — D-13 through D-17: grill-me flow that will be refactored into reference file

### Existing Implementation
- `skills/do/SKILL.md` — Current skill file; `/do:continue` section needs refactoring into router + reference files
- `skills/do/references/task-template.md` — Task markdown template; Execution Log section already exists

### Project Constraints
- `.planning/PROJECT.md` — Flat hierarchy constraint, token efficiency core value
- `.planning/REQUIREMENTS.md` — TS-08 (context clear), TS-09 (implementation) acceptance criteria
- `./CLAUDE.md` — Note: v1 can write skills directly, polish pass with /skill-creator later

### Research
- `.planning/research/skills-patterns.md` — Reference file loading patterns, inline prompt patterns

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `load-task-context.cjs` — Pattern for reading config and task files
- `task-template.md` — Template with Execution Log placeholder
- SKILL.md `/do:continue` routing table — becomes the router core

### Established Patterns
- YAML frontmatter stage tracking
- Inline text prompts (grill-me pattern from D-14)
- `stages.<stage>: in_progress/complete` substatus tracking

### Integration Points
- `/do:continue` reads `stage` from task frontmatter → routes to reference file
- Reference files update task markdown and frontmatter
- Execution log appended to task markdown body
- `stages.execution` transitions trigger verification stage (Phase 8)

</code_context>

<specifics>
## Specific Ideas

- AskUserQuestion fallback detection: if response is empty string or undefined after call, switch to inline prompt
- Reference file naming: `stage-grill.md`, `stage-execute.md`, `stage-verify.md` (consistent pattern)
- SKILL.md router should be <100 lines after refactor
- Execution log entries should be atomic — one entry per significant action, not one giant dump at the end
- Consider a "dry run" display before actual execution: "About to modify these files: [list]. Proceed?"

</specifics>

<deferred>
## Deferred Ideas

- **Verification stage** — Phase 8 implements `stage-verify.md`
- **Wave-based execution with per-wave logging** — Could add wave headers to execution log when task has waves
- **Rollback on failure** — Git-based rollback if execution fails partway through

</deferred>

---

*Phase: 07-context-decision-implementation*
*Context gathered: 2026-04-13 via discuss-phase*
