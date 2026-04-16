---
id: backlog-do-fast-skill
created: 2026-04-15T00:00:00Z
updated: 2026-04-15T00:00:00Z
description: "Add /do:fast skill — lightweight fast path for low-risk, small-surface tasks"

stage: backlog
stages:
  refinement: pending
  grilling: pending
  execution: pending
  verification: pending
  abandoned: false

council_review_ran:
  plan: false
  code: false
---

# /do:fast skill

## Problem Statement

The current `/do:task` workflow is optimized for correctness over speed. For trivial, low-blast-radius work (single-file fixes, small tweaks, obvious additions) the full plan → plan review → grill → execute → code review → verify pipeline is disproportionate overhead.

`/do:fast` is a sanctioned fast path that removes ceremony while keeping just enough structure for session continuity and quality.

## Entry Criteria (ALL must be true)

- Single repo, single concern
- Small surface area (1–3 files)
- No new shared abstractions or shared component changes
- No backend/API contract changes
- No schema, auth, permissions, or state-machine changes
- No Jira workflow complexity beyond basic execution
- No unclear business logic
- No need for deep debugging

**Auto-escalation:** If any of the above stop being true during execution, stop and reroute to `/do:task` or `/do:debug`.

## What /do:fast does

1. Quick repo/context scan (load project.md, spot-check relevant files)
2. Check existing patterns before building
3. Make the change
4. Format changed files
5. Run targeted validation (lint/typecheck on changed files only)
6. **Single combined review round** — one code review pass after all changes are done (no plan review, no parallel council round during planning)
7. Write a short artifact/summary to `.do/tasks/` so `/do:continue` still works

## What it skips

- Full planning ceremony and plan review
- Heavyweight database checks on every run
- Broad codebase research
- Full multi-phase execution structure
- Exhaustive database maintenance (unless something genuinely new was discovered)

## Review model

Single review round at the end (post-implementation only):
- Spawn do-code-reviewer once all changes are done
- No plan review, no council during planning
- If CHANGES_REQUESTED → fix inline, re-review once
- If still failing → escalate to `/do:task`

## Usage modes

1. **Direct invocation** — user calls `/do:fast "description"` intentionally for work they know is small
2. **Auto-detection from `/do:task`** — after do-planner completes, if the task meets fast-path entry criteria, `/do:task` prompts:
   > "This looks like a quick, low-risk change. Use `/do:fast` instead of the full workflow? [Y/n]"
   If yes → hand off to `/do:fast`. If no → continue with full `/do:task` pipeline as normal.

Both paths run the same `/do:fast` skill. The `/do:task` wire-up is just a cost-saving helper — it doesn't replace or restrict direct invocation.

## Notes

- Codex suggested this after reviewing the workflow (2026-04-15)
- The "single review at the end" design is intentional — avoid paying double review cost (plan + code) for trivial work
- `/do:task` auto-detection is a follow-on feature, not part of the initial `/do:fast` build
