---
id: backlog-optimise-improvements
created: 2026-04-15T00:00:00Z
updated: 2026-04-15T00:00:00Z
description: "Apply /do:optimise audit findings to skills/do/optimise.md and optimise-target.cjs"

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

# Improve /do:optimise

Findings from auditing `skills/do/optimise.md` with `/do:optimise --effort high` (2026-04-15).

## Changes

### 1. Redesign ctx7 budget model (W1 + S1 + user direction)

**Current model:** Fixed caps (low=2, medium=3, high=3), queries run in predetermined order.

**New model:** Larger ceilings, curiosity-driven depth — use what's needed to reach accurate conclusions, stop early if confident.

| Effort | Budget cap |
|--------|-----------|
| `low`  | max 3 calls |
| `medium` | max 5 calls |
| `high` | max 10 calls |

**Key philosophy change:**
- Budget is a ceiling, NOT a target. Don't pad to hit the limit.
- If an initial result raises new questions, it's valid to go deeper.
- Stop when the conclusions are accurate and well-grounded.
- The goal is quality of findings, not exhaustion of the budget.

**Files to update:**
- `skills/do/optimise.md:117` — Replace fixed "hard cap: 1 library + max 2 docs" with per-effort table and the curiosity-driven philosophy
- `skills/do/optimise.md:40` — Update effort table "Token cost" column to reflect new caps
- `skills/do/scripts/optimise-target.cjs:495–503` — Update budget comment to reflect new caps
- `skills/do/scripts/optimise-target.cjs:516–523` — Add secondary ctx7 query for skill/agent targets at medium/high effort (S1 fix)

### 2. Remove redundant `mkdir -p` in Step 10 (W2)

`skills/do/optimise.md:264` — Remove `mkdir -p .do/optimise` bash block. Write tool creates parent dirs.

### 3. Add `## Failure Handling` section (S2)

Add after Step 10. Cover: script error, ctx7 unavailable, WebSearch unavailable, Write failure.

Pattern from `skills/do/task.md:271–278`.

### 4. Fix Glob path in Step 5 (S3)

`skills/do/optimise.md:149` — Change `Glob("<pattern>")` to explicitly pass `path: <project_root>`.

Add note: "Use the project root (same dir as `.do/config.json`) as the path parameter."

Evidence: Glob returned no results during this audit until explicit path was passed.

## Execution

Use `/do:task` for all changes. `/do:fast` doesn't exist yet.
