---
id: backlog-remove-codex-support
created: 2026-04-15T00:00:00Z
updated: 2026-04-15T00:00:00Z
description: "Remove Codex support — deploy to ~/.claude/ only"

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

# Remove Codex support

## Problem Statement

Supporting both Claude Code and Codex CLI eats too many tokens. The dual-location install path (copying to both `~/.claude/` and `~/.codex/`) and the Codex-specific runtime branches in council-invoke.cjs, stage-execute, stage-verify add complexity and token cost for negligible benefit. Focus entirely on Claude Code (`~/.claude/`).

**Scope:**
- `bin/postinstall.js` — remove `~/.codex/` copy logic
- `skills/do/scripts/council-invoke.cjs` — remove Codex runtime path (`invokeCodex`, PLUGIN_ROOT, codex null branches in invokeBoth)
- `skills/do/scripts/detect-tools.cjs` — remove codex detection
- `agents/` — remove any Codex-specific branching in agent instructions
- `codex/` directory — can be deleted or archived
- `project.md` + database docs — update to reflect Claude-only support
