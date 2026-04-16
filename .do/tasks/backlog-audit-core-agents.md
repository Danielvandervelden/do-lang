---
id: backlog-audit-core-agents
created: 2026-04-15T00:00:00Z
updated: 2026-04-15T00:00:00Z
description: "Run /do:optimise on do-code-reviewer, do-planner, do-executioner and apply findings via /skill-creator"

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

# Audit core agents with /do:optimise

Run `/do:optimise --effort high` on the three core workflow agents and apply findings via `/skill-creator`.

## Targets (in order)

1. `agents/do-code-reviewer.md`
2. `agents/do-planner.md`
3. `agents/do-executioner.md`

## Goal

See if the auditor surfaces improvements to agent instructions that make the workflow produce better output — tighter plans, more accurate code review, less executor drift.

## Process

For each agent:
1. `/do:optimise agents/<agent>.md --effort high`
2. Review findings
3. Apply via `/skill-creator` (not direct edits — skill-creator ensures proper formatting and conventions)
4. Release new version

## Prerequisites

- `/do:optimise` improvements applied first (backlog-optimise-improvements.md) — run the better auditor, not the current one
- `/do:fast` built — so agent improvements can use the fast path if findings are small

## Notes

These are the highest-leverage files in the system. Improvements here compound across every task run.
