---
name: council-brief-plan
description: Briefing template for plan reviews. Uses placeholders for task-specific values.
---

# Council Brief: Plan Review

## CRITICAL RULES
- **DO NOT modify, create, or delete any files.** This is a READ-ONLY review.
- **You MUST cite evidence.** Reference specific file paths, line numbers, or code patterns.
- **Focus on the delta.** Only evaluate what changed, not the entire codebase.

## Project
- **Name:** {{PROJECT_NAME}}
- **Workspace:** {{WORKSPACE_PATH}}
- **Project docs:** {{PROJECT_MD_PATH}}

## Task
Read this task file for full context:
```
{{TASK_FILE_PATH}}
```

The task file contains:
- Problem Statement — what is being solved
- Approach — how it should be solved
- Concerns — risks and uncertainties
- Clarifications — user answers from grilling (if any)

## Your Assessment: Plan Review

Evaluate the **Approach** section against:

1. **Requirement Coverage** — Does the approach address the full Problem Statement?
2. **Technical Soundness** — Is the approach correct for this tech stack?
3. **Risk Identification** — Are the Concerns comprehensive? Any blind spots?
4. **Scope Appropriateness** — Is this achievable in a single task, or should it be split?

### Verdict
Return ONE of:
- **LOOKS_GOOD** — Plan is solid, proceed to implementation
- **CONCERNS** — Material issues but salvageable with revisions
- **RETHINK** — Fundamental problems, approach needs reworking

## Response Format

### Verdict
[Your verdict — EXACTLY one of the options above]

### Key Findings
- [Finding 1 — cite file:line or pattern]
- [Finding 2 — cite evidence]

### Recommendations
- [Specific, actionable recommendation]
- [Another recommendation if needed]
