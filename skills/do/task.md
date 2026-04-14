---
name: do:task
description: "Start a new piece of work with structured refinement. Use when the user wants to build something, fix something, add a feature, or accomplish a coding task. Triggers on 'I need to...', 'let's build...', 'add a feature for...', 'implement...', or any clear task description. Creates a task file with confidence scoring and context loading."
argument-hint: "\"description of what you want to accomplish\""
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

# /do:task

Create a new task with structured refinement — loads context, calculates confidence, and prepares for execution.

## Why this exists

Jumping straight into code without understanding the task leads to rework. This skill front-loads the thinking: What context do we need? How confident are we? What's the approach? If confidence is low, it asks clarifying questions before execution starts. The result is a task file that captures everything needed to execute — and resume — the work.

## Usage

```
/do:task "description of what you want to accomplish"
```

**Examples:**
- `/do:task "add user authentication with JWT"`
- `/do:task "fix the 500 error on POST /orders"`
- `/do:task "refactor the payment module to use the new API"`

## Prerequisites

1. **Workspace initialized** — `.do-workspace.json` exists
2. **Project initialized** — `.do/config.json` exists
3. **Database entry exists** — `project.md` exists for this project

## Refinement Process

**Step 1: Check prerequisites**

```bash
node <skill-path>/scripts/check-database-entry.cjs --message
```

**Step 2: Check for active task**

```bash
node <skill-path>/scripts/task-abandon.cjs check --config .do/config.json
```

If active task exists, offer options: continue it, abandon it, or cancel.

**Step 3: Load context**

```bash
node <skill-path>/scripts/load-task-context.cjs "<task-description>"
```

Reads project.md and any matched component/tech/feature docs.

**Step 4: Analyze task**

With loaded context, identify:
- What systems/components it touches
- Potential implementation approach
- Concerns or uncertainties
- Similar patterns in codebase

**Step 5: Calculate confidence**

Starting from 1.0, apply deductions:

| Factor | Deduction | When |
|--------|-----------|------|
| context | -0.1 to -0.2 | Missing docs the task needs |
| scope | -0.05 to -0.15 | Spans multiple files/systems |
| complexity | -0.05 to -0.15 | Multiple integration points |
| familiarity | -0.05 to -0.1 | No similar patterns found |

Display transparently:
```
Confidence: 0.72 (context: -0.10, scope: -0.10, complexity: -0.08, familiarity: 0.00)
```

**Step 6: Wave breakdown**

Ask if task should be split into waves (for complex multi-part work) or executed as single unit.

**Step 7: Create task file**

Generate `YYMMDD-<slug>.md` using @references/task-template.md with:
- Problem statement
- Approach
- Concerns
- Confidence breakdown
- Wave definitions (if any)

Write to `.do/tasks/`

**Step 8: Update config**

Set `active_task` in `.do/config.json`

**Step 9: Display summary**

```
Task created: .do/tasks/<filename>

Confidence: <score> (<breakdown>)
{If below threshold:} -> Grill-me will ask clarifying questions

Context loaded: project.md, <matched docs>
Problem: <1-line summary>
Approach: <1-line summary>

Next: Run /do:continue to proceed
```

## Files

- **Context loading:** @scripts/load-task-context.cjs
- **Task template:** @references/task-template.md
- **Gate script:** @scripts/check-database-entry.cjs
