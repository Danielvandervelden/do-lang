---
name: council-brief-code
description: Briefing template for code reviews. Uses placeholders for task-specific values.
---

# Council Brief: Code Review

## CRITICAL RULES
- **DO NOT modify, create, or delete any files.** This is a READ-ONLY review.
- **You MUST cite evidence.** Reference specific file paths, line numbers, or code patterns.
- **Focus on the delta.** Only evaluate what changed, not the entire codebase.

## Context
- **Workspace:** {{WORKSPACE}}

## Task
Read this task file for full context:
```
{{TASK_FILE}}
```

**Task content:**
{{TASK_CONTENT}}

The task file contains:
- Problem Statement — what is being solved
- Approach — how it was planned to be solved
- Concerns — risks and uncertainties
- Clarifications — user answers from grilling (if any)
- Execution Log — what was actually done

## Files Modified
These files were changed during execution. Review them for quality:
{{FILES_MODIFIED}}

## Your Assessment: Code Review

Compare the **Execution Log** against the **Approach**:

1. **Implementation Fidelity** — Did the implementation follow the plan?
2. **Code Quality** — Follows project conventions? Readable? Maintainable?
3. **Completeness** — Are all steps from Approach completed?
4. **Concerns Addressed** — Were the identified Concerns handled appropriately?

### Verdict
Return ONE of:
- **APPROVED** — Code is correct and follows conventions
- **NITPICKS_ONLY** — Minor style issues, no functional problems
- **CHANGES_REQUESTED** — Material issues found in implementation

## Response Format

### Verdict
[Your verdict — EXACTLY one of the options above]

### Key Findings
- [Finding 1 — cite file:line or pattern]
- [Finding 2 — cite evidence]

### Recommendations
- [Specific, actionable recommendation]
- [Another recommendation if needed]
