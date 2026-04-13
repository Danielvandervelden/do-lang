# State Management Patterns from GSD

**Researched:** 2026-04-13

## GSD `.planning/` Structure

```
.planning/
  STATE.md           # Living memory - position, progress, decisions
  PROJECT.md         # Requirements, constraints, key decisions
  ROADMAP.md         # Phases with [ ]/[x] checkboxes, progress table
  HANDOFF.json       # Machine-readable pause state (deleted after resume)
  phases/
    01-name/
      01-01-PLAN.md       # Task plan with YAML frontmatter
      01-01-SUMMARY.md    # Completion record (existence = done)
      .continue-here.md   # Mid-plan checkpoint (deleted after resume)
```

## STATE.md Pattern

Central state file (~100 lines max) with sections:

```markdown
## Current Position
Phase: [X] of [Y] ([Phase name])
Plan: [A] of [B] in current phase
Status: [Ready to plan / Planning / Ready to execute / In progress / Phase complete]
Last activity: [YYYY-MM-DD] - [What happened]
Progress: [##########] 100%

## Session Continuity
Last session: [YYYY-MM-DD HH:MM]
Stopped at: [Description of last completed action]
Resume file: [Path to .continue-here*.md if exists, otherwise "None"]
```

**Key insight:** Status is derived from artifact existence (PLAN exists but no SUMMARY = "In progress"), not stored as explicit enum.

## YAML Frontmatter Fields

From `.continue-here.md`:
```yaml
phase: 02-auth
task: 3
total_tasks: 7
status: in_progress  # in_progress | blocked | almost_done
last_updated: 2025-01-15T14:30:00Z
```

From `SUMMARY.md` (completion record):
```yaml
phase: 01-foundation
plan: 02
duration: 28min
completed: 2025-01-15
requirements-completed: [REQ-01, REQ-02]
```

## Detecting Task States

GSD uses **file existence** as primary state indicator:

| Condition | Meaning |
|-----------|---------|
| PLAN exists, no SUMMARY | In progress or not started |
| PLAN + SUMMARY exist | Plan complete |
| .continue-here.md exists | Mid-execution pause point |
| HANDOFF.json exists | Explicit pause with context |
| No PLAN files | Phase not yet planned |

**Detecting "active" vs "abandoned":**
- Active: Recent `last_updated` in frontmatter OR recent git commits
- Abandoned: No activity + no `.continue-here.md` = needs human decision

## HANDOFF.json (Machine-Readable Pause)

```json
{
  "version": "1.0",
  "timestamp": "2025-01-15T14:30:00Z",
  "phase": "02",
  "plan": 1,
  "task": 3,
  "total_tasks": 7,
  "status": "paused",
  "completed_tasks": [
    {"id": 1, "name": "Setup", "status": "done", "commit": "abc123"},
    {"id": 3, "name": "Auth", "status": "in_progress", "progress": "routes done"}
  ],
  "remaining_tasks": [
    {"id": 4, "name": "Tests", "status": "not_started"}
  ],
  "blockers": [
    {"description": "API key missing", "type": "human_action", "blocking": true}
  ],
  "next_action": "Add STRIPE_KEY to .env, then run task 4"
}
```

**One-shot artifact:** Deleted after successful resume.

## `/clear` -> `/do:continue` Flow

GSD handles this via:

1. **STATE.md** - Persists across sessions, gives high-level position
2. **HANDOFF.json** - Explicit "I paused here" with exact task/blocker
3. **.continue-here.md** - Human-readable context for the exact resumption point
4. **File existence checks** - PLAN without SUMMARY = incomplete work

Resume workflow:
1. Read STATE.md for project context
2. Check HANDOFF.json for structured pause state
3. Check .continue-here.md for mid-task context
4. Detect incomplete work (PLAN exists, SUMMARY missing)
5. Present "where we are" and route to next action

## Adaptation for `do`

Recommended `.do/tasks/{id}.md` structure:

```yaml
---
id: task-001
created: 2025-01-15T10:00:00Z
updated: 2025-01-15T14:30:00Z

# Stage tracking
stages:
  refinement: complete    # pending | in_progress | complete
  grilling: complete
  execution: in_progress
  verification: pending

# Execution state (only when execution in_progress)
execution:
  current_step: 3
  total_steps: 7
  last_action: "Created auth routes"

# Blockers (if any)
blockers:
  - type: human_action
    description: "Need API key"
    blocking: true
---

# Task Title

[Task content...]
```

**Key differences from GSD:**
- GSD has phases/plans/tasks hierarchy; `do` has flat task files
- GSD uses file existence (PLAN vs SUMMARY); `do` uses explicit `stages` enum
- GSD spans sessions/milestones; `do` is per-task lifecycle

**Detection logic for `/do:continue`:**
1. Check `config.json` for `active_task`
2. Read task file, check `stages` for first non-complete stage
3. If `execution.current_step` exists, resume mid-execution
4. Present context and continue
