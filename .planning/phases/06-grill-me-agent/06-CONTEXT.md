# Phase 6: Grill-Me Agent - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement grill-me logic within `/do:continue` that triggers when task confidence is below threshold. Forces targeted clarification to fill gaps identified during refinement. Runs as inline skill logic, not a separate agent.

**Delivers:**
- Grill-me flow in `/do:continue` (SKILL.md extension)
- Targeted questioning based on lowest confidence factor
- Confidence recalculation after each answer
- Task markdown update with Clarifications section
- User override option after each question

</domain>

<decisions>
## Implementation Decisions

### Questioning Strategy
- **D-13:** Target lowest confidence factor first, then proceed to next weakest. Efficient, focused questioning.

### Question Format
- **D-14:** Inline text prompts — plain text questions with typed answers. Consistent with Phase 2-5 interactive pattern. No AskUserQuestion (bug documented in CLAUDE.md).

### Loop Termination
- **D-15:** Stop when confidence ≥ `auto_grill_threshold` (from config), but offer "Proceed anyway" after each question for user override. Natural completion with escape hatch.

### Answer Integration
- **D-16:** New "Clarifications" section in task markdown (between Problem Statement and Approach). Format is Q&A pairs showing: question asked, user's answer, and which confidence factor it addresses with before/after values.

Example format:
```markdown
## Clarifications

### Scope (was: -0.15 → now: -0.05)
**Q:** Which specific form fields need validation fixes?
**A:** Only the email and password fields on the login form. Registration form is out of scope.

### Context (was: -0.10 → now: 0.00)
**Q:** Is there an existing validation utility to extend?
**A:** Yes, use src/utils/validators.ts — it already has email regex.
```

### Implementation Approach
- **D-17:** Grill-me is NOT a separate agent file — it's inline logic within `/do:continue` in SKILL.md. When `/do:continue` is called on a task with `stage: refinement` and confidence < threshold, it runs the grilling flow. **MUST use /skill-creator** to modify SKILL.md per project CLAUDE.md requirement.

### Claude's Discretion
- Exact wording of grill questions (should be specific to the weak factor)
- How much confidence boost per clarification (reasonable heuristic)
- Whether to ask compound questions or single-factor questions
- Formatting details within the Clarifications section

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Prior Phase Context
- `.planning/phases/05-task-creation-refine-agent/05-CONTEXT.md` — D-04 through D-06: confidence model, threshold config, factor breakdown
- `.planning/phases/03-project-setup/03-CONTEXT.md` — config.json schema with `auto_grill_threshold` field

### Existing Implementation
- `skills/do/SKILL.md` — Current skill file; `/do:continue` section needs to be added/extended
- `skills/do/references/task-template.md` — Task markdown template; Clarifications section pattern
- `skills/do/scripts/load-task-context.cjs` — Context loading pattern for reference

### Project Constraints
- `.planning/PROJECT.md` — Flat hierarchy constraint, /skill-creator requirement
- `./CLAUDE.md` — Skill creation MUST use /skill-creator

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `load-task-context.cjs` — Pattern for reading config and task files
- `task-template.md` — Template pattern; needs Clarifications section added
- SKILL.md `/do:task` Step 5 — Confidence calculation logic to reuse/reference

### Established Patterns
- Interactive inline prompts (consistent with Phase 2-5)
- YAML frontmatter updates for stage transitions
- Config reading for threshold values

### Integration Points
- `/do:continue` reads task file from `.do/tasks/<active_task>`
- Config `auto_grill_threshold` determines trigger
- Task markdown gets new Clarifications section
- Stage transitions: `refinement` → `grilling` (during) → `execution` (after)

</code_context>

<specifics>
## Specific Ideas

- Confidence recalculation should show delta: "Confidence: 0.72 → 0.85 (+0.13)"
- After each answer, show: updated confidence, factors improved, offer "Continue" or "Proceed anyway"
- If user chooses "Proceed anyway" below threshold, note this in Clarifications: "User override at confidence 0.78"
- Grill questions should be specific: "Which API endpoint returns user data?" not "Can you clarify the scope?"

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 06-grill-me-agent*
*Context gathered: 2026-04-13 via discuss-phase*
