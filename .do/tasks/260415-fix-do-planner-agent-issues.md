---
id: 260415-fix-do-planner-agent-issues
created: 2026-04-15T16:59:48.000Z
updated: 2026-04-15T17:45:00.000Z
description: >-
  Fix do-planner.md issues surfaced by optimise audit: add Edit tool, fix
  spawner docs, fix CRITICAL label, add Edit guidance to confidence write-back,
  add maxTurns: 30, and add council_review_ran protection rule
stage: complete
stages:
  refinement: complete
  grilling: complete
  execution: complete
  verification: complete
  abandoned: false
council_review_ran:
  plan: true
  code: true
confidence:
  score: 0.97
  factors:
    context: -0.0
    scope: -0.0
    complexity: -0.0
    familiarity: -0.03
---

# Fix do-planner.md issues

## Problem Statement

The `/do:optimise` audit surfaced six issues in `agents/do-planner.md` ranging from missing tool declarations to inaccurate spawner documentation. These issues cause:

1. **Missing Edit tool** — planner updates existing task files (confidence write-back, plan sections) but only has Write in its tool list, forcing full-file overwrites instead of surgical edits.
2. **Inaccurate spawner documentation** — says "Spawned by `/do:task` orchestrator" but planner is also spawned by `/do:continue` (stage routing, refinement in_progress) and by `stage-plan-review.md` PR-5 ITERATE loop (revision instructions with a different prompt shape).
3. **Misuse of CRITICAL label** — "CRITICAL: Mandatory Initial Read" is immediately followed by a conditional ("If the prompt contains..."). CRITICAL labels should mark unconditional requirements.
4. **No Edit guidance for confidence write-back** — Step 4 tells planner to write confidence back to frontmatter but doesn't say to use Edit for surgical patching, risking full-file rewrite of a partially-filled task file.
5. **No maxTurns cap** — planner has no turn limit, risking runaway sessions during context loading or ctx7 research.
6. **No council_review_ran protection rule** — planner could accidentally modify `council_review_ran` fields owned by the orchestrator/review stages.

**Acceptance criteria:**
- `Edit` appears in `tools:` frontmatter
- `maxTurns: 30` appears in frontmatter
- `<role>` section lists all three spawners with a note about prompt shape differences
- The CRITICAL label on line 17 is either removed or the instruction is made unconditional
- Step 4 includes explicit Edit tool guidance for confidence write-back
- An explicit rule forbids modifying `council_review_ran`

## Clarifications

None needed. All six issues are clearly specified with concrete locations in the file.

## Context Loaded

- `database/projects/do/project.md` — project overview, agent list, task flow diagram confirming planner's role and spawners
- `agents/do-planner.md` — the file to modify, read in full (159 lines)
- `skills/do/references/stage-plan-review.md` — confirms PR-5 ITERATE loop spawns do-planner with revision instructions prompt
- `skills/do/continue.md` — confirms line 109/119-135 spawns do-planner for refinement stage routing
- `agents/do-executioner.md` (frontmatter) — pattern reference: uses `Edit` in tools list alongside Write
- `agents/do-debugger.md` (frontmatter) — pattern reference for tool lists
- All other agent frontmatters — confirmed no agent currently uses `maxTurns`

## Approach

All changes target a single file: `agents/do-planner.md`

### Step 1: Add `Edit` to the `tools:` frontmatter list

**File:** `agents/do-planner.md` line 4
**Change:** `tools: Read, Grep, Glob, Write, Bash` → `tools: Read, Grep, Glob, Write, Edit, Bash`
**Why:** Planner updates existing task files. Edit enables surgical patching instead of full-file Write.
**Pattern:** do-executioner uses `tools: Read, Write, Edit, Bash, Grep, Glob`

### Step 2: Add `maxTurns: 30` to frontmatter

**File:** `agents/do-planner.md` frontmatter block
**Change:** Add `maxTurns: 30` after the `permissionMode` line (before the closing `---`)
**Why:** Prevents runaway planner sessions. 30 turns is generous for context loading + ctx7 + plan writing.

### Step 3: Update spawner documentation in `<role>` section

**File:** `agents/do-planner.md` lines 10-18
**Change:** Replace the single "Spawned by `/do:task` orchestrator." line with a list of all three spawners:
```
Spawned by:
- `/do:task` — fresh planning with task description and config
- `/do:continue` — resume planning when stage is refinement + in_progress
- `stage-plan-review.md` PR-5 ITERATE — revision with reviewer feedback (different prompt shape: includes reviewer findings, asks to revise Approach/Concerns only)
```

### Step 4: Fix CRITICAL label on conditional instruction

**File:** `agents/do-planner.md` lines 17-18
**Change:** Make the instruction unconditional by removing the "If" conditional. Change to:
```
**CRITICAL: Mandatory Initial Read**
Read every file listed in the `<files_to_read>` block of the prompt before performing any other actions. If no `<files_to_read>` block is present, skip this step.
```
This preserves the CRITICAL label (it IS critical when the block exists) while making the instruction structure unconditional — "do X, unless Y" rather than "if Y, do X".

### Step 5: Add Edit tool guidance to Step 4 confidence write-back

**File:** `agents/do-planner.md` line 78 (end of Step 4 section)
**Change:** After the existing line "Write the calculated confidence score and factor deductions back to the task file's YAML frontmatter under `confidence.score` and `confidence.factors.*`.", add:
```
Use the Edit tool to patch only the confidence lines. Do not rewrite the entire file.
```

### Step 6: Add council_review_ran protection rule

**File:** `agents/do-planner.md` — add to `<role>` section or as a new constraint block
**Change:** Add explicit rule: "Never modify `council_review_ran` — the orchestrator owns this field."
**Placement:** Inside the `<role>` block after the spawner documentation, as a standalone constraint. This is where role-level invariants belong.

## Concerns

1. **Risk: maxTurns value too low for ctx7 research** — If context7 lookups are enabled and a task involves multiple libraries, 30 turns may be tight. **Mitigation:** The agent already caps ctx7 at 3 commands. 30 turns covers: ~5 for context loading, ~3 for ctx7, ~5 for analysis, ~5 for plan writing, ~5 for confidence write-back and summary, leaving ~7 buffer. Sufficient.

2. **Risk: First agent to use maxTurns — no pattern to follow** — Confirmed via search that `maxTurns` is a valid Claude Code agent frontmatter field (documented in Claude Code docs). **Mitigation:** Simple integer field, low risk of syntax error.

3. **Risk: CRITICAL label change could weaken instruction adherence** — Rewording "If X, do Y" to "Do Y, unless not X" changes emphasis. **Mitigation:** The CRITICAL label is preserved, and the unconditional framing ("Read every file... before performing any other actions") is actually stronger than the conditional framing.

## Execution Log

### 2026-04-15 17:05 - Execution started
**Status:** In progress
**Steps:** 0/6 complete

### 2026-04-15 17:08 - Step 1: Add Edit to tools frontmatter
**Files:**
- `agents/do-planner.md` — changed `tools: Read, Grep, Glob, Write, Bash` to `tools: Read, Grep, Glob, Write, Edit, Bash`

**Status:** Complete

### 2026-04-15 17:08 - Step 2: Add maxTurns: 30 to frontmatter
**Files:**
- `agents/do-planner.md` — added `maxTurns: 30` after `permissionMode: acceptEdits`

**Status:** Complete

### 2026-04-15 17:08 - Step 3: Update spawner documentation in role section
**Files:**
- `agents/do-planner.md` — replaced single spawner line with list of all three spawners (do:task, do:continue, stage-plan-review PR-5 ITERATE)

**Decisions:**
- council_review_ran protection rule (Step 6) co-located here as a standalone constraint immediately after spawner list, inside the role block where role-level invariants belong

**Status:** Complete

### 2026-04-15 17:08 - Step 4: Fix CRITICAL label on conditional instruction
**Files:**
- `agents/do-planner.md` — rewrote CRITICAL instruction from conditional "If the prompt contains..." to unconditional "Read every file... If no block is present, skip this step."

**Status:** Complete

### 2026-04-15 17:08 - Step 5: Add Edit tool guidance to Step 4 confidence write-back
**Files:**
- `agents/do-planner.md` — appended "Use the Edit tool to patch only the confidence lines. Do not rewrite the entire file." to the Step 4 write-back sentence

**Status:** Complete

### 2026-04-15 17:08 - Step 6: Add council_review_ran protection rule
**Decisions:**
- Placed inside role block immediately after spawner list (Step 3 above). No separate edit needed.

**Status:** Complete

### 2026-04-15 17:08 - Execution complete
**Status:** Complete
**Summary:**
- Steps completed: 6/6
- Files modified: 1 (agents/do-planner.md)
- Deviations: 1 minor (Steps 3 and 6 combined into a single edit — council_review_ran rule placed inline in role block as planned)

### 2026-04-15 - Code Review Fix: frontmatter description updated
**Files:**
- `agents/do-planner.md` line 3 — updated `description` from "Spawned by /do:task orchestrator..." to "Task planner for the do-lang workflow. Spawned by /do:task, /do:continue, and stage-plan-review ITERATE. Loads project context, calculates confidence, and writes a structured plan to the task file."

**Decisions:**
- Issue 2 (WebSearch): git diff confirms original tools list was `Read, Grep, Glob, Write, Bash` — WebSearch was never present. No restoration needed.

**Status:** Complete

## Council Review

## Verification Results

### Approach Checklist
- [x] Step 1: Add `Edit` to the `tools:` frontmatter list — line 4: `tools: Read, Grep, Glob, Write, Edit, Bash`
- [x] Step 2: Add `maxTurns: 30` to frontmatter — line 8: `maxTurns: 30`
- [x] Step 3: Update spawner documentation in `<role>` section — lines 14-17 list all three spawners with prompt shape note
- [x] Step 4: Fix CRITICAL label on conditional instruction — lines 23-24 unconditional form present
- [x] Step 5: Add Edit tool guidance to Step 4 confidence write-back — line 84 ends with Edit tool instruction
- [x] Step 6: Add council_review_ran protection rule — line 21: "Never modify `council_review_ran`"

### Quality Checks
- **No quality check scripts found in package.json** (only `postinstall` present — no lint, typecheck, or test scripts)

### UAT
- [x] `tools:` line includes `Edit` alongside Write, Read, Grep, Glob, Bash
- [x] `maxTurns: 30` present in frontmatter
- [x] `<role>` section lists all three spawners with prompt shape note for PR-5 ITERATE
- [x] CRITICAL instruction is unconditional ("Read every file... If no block is present, skip this step.")
- [x] Step 4 confidence write-back includes "Use the Edit tool to patch only the confidence lines."
- [x] "Never modify `council_review_ran`" rule present in role block
- [x] `description` frontmatter reflects all three spawners

### Result: PASS
- Checklist: 6/6 complete
- Quality: N/A (no scripts)
- UAT: 7/7 pass
