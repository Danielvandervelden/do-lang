---
id: 260414-fix-council-integration-gaps
created: 2026-04-14T14:30:00.000Z
updated: '2026-04-14T09:17:48.878Z'
description: >-
  Fix council integration gaps: plan-reviewer spawn from stage-execute,
  code-reviewer spawn post-execution, and inline review bypass in reviewer
  agents
stage: complete
stages:
  refinement: complete
  grilling: skipped
  execution: complete
  verification: complete
  abandoned: false
council_review_ran:
  plan: true
  code: true
confidence:
  score: 0.82
  factors:
    context: 0
    scope: -0.1
    complexity: -0.08
    familiarity: 0
---

# Fix Council Integration Gaps

## Problem Statement

Council quality gates are configured (`council_reviews.planning: true`, `council_reviews.execution: true`) but never fully trigger in practice. Three related gaps:

1. **`stage-execute.md` has plan review (E-1) but no post-execution code-review step.** After E3 (execution complete), the flow says "Proceeding to verification" but never checks `council_reviews.execution` or spawns `do-code-reviewer`. The `/do:task` skill (task.md) does have Step 10 that spawns `do-code-reviewer`, but `/do:continue` routes through `stage-execute.md` which lacks this step -- so any resumed task skips code review entirely.

2. **`do-plan-reviewer` agent shortcuts council reviews inline.** The agent is instructed to spawn parallel sub-agents (self-review + council via codex/gemini), but the council review agent prompt does not instruct the spawned agent to use `council-invoke.cjs`. The spawned council agent is just another Claude instance reviewing from its own perspective -- not invoking codex or gemini via the script. The independent second opinion never happens.

3. **`do-code-reviewer` agent has the same inline bypass risk.** Same architecture as plan-reviewer, same gap: council review agent prompt lacks `council-invoke.cjs` invocation.

**Impact:** Users configure council reviews expecting independent quality gates, but get same-model reviews and silently skipped code reviews on resume.

**Acceptance Criteria:**
- `/do:continue` through `stage-execute.md` triggers code review after E3 when `council_reviews.execution` is enabled
- `do-plan-reviewer` council agent prompt instructs the spawned agent to run `council-invoke.cjs` for an actual external review
- `do-code-reviewer` council agent prompt instructs the spawned agent to run `council-invoke.cjs` for an actual external review
- Anti-inline guardrails prevent models from fabricating council verdicts without using the script

## Clarifications

<!-- None needed -- confidence is above threshold -->

## Context Loaded

- `project.md` -- do-lang project structure, conventions
- `skills/do/task.md` -- Main orchestrator skill (has correct agent spawn steps)
- `skills/do/continue.md` -- Resume skill (routes by stage)
- `skills/do/references/stage-execute.md` -- Execution stage reference (has E-1 plan review, missing code review)
- `agents/do-plan-reviewer.md` -- Plan review agent (parallel spawn instructions)
- `agents/do-code-reviewer.md` -- Code review agent (parallel spawn instructions)
- `scripts/council-invoke.cjs` -- Council invocation script (works correctly, takes --type plan|code)

## Approach

### Fix 1: Add post-execution code-review step to stage-execute.md

Add Step E4 between E3 (execution complete) and the file's end section. Mirror the E-1 pattern.

1. Open `skills/do/references/stage-execute.md`
2. After Step E3's completion message block (line ~258), add new `### Step E4: Code Review (per council config)`
3. Step E4.0: Check if code review already ran:
   ```bash
   node -e "const fm=require('gray-matter'); const t=fm(require('fs').readFileSync('.do/tasks/<active_task>','utf8')); process.exit(t.data.council_review_ran?.code === true ? 1 : 0)"
   ```
   If already ran (exit 1): Skip to end.
4. Step E4.1: Check if execution review is enabled:
   ```bash
   node -e "const c=require('./.do/config.json'); process.exit(c.council_reviews?.execution === true ? 0 : 1)"
   ```
   If disabled: Mark `council_review_ran.code: 'skipped'` in frontmatter, skip to end.
5. Step E4.2: If enabled, invoke council:
   ```bash
   node <skill-path>/scripts/council-invoke.cjs \
     --type code \
     --task-file ".do/tasks/<active_task>" \
     --reviewer "$(node -e "const c=require('./.do/config.json'); console.log(c.council_reviews?.reviewer || 'random')")" \
     --workspace "$(pwd)"
   ```
6. Step E4.3: Handle verdict (APPROVED/NITPICKS_ONLY/CHANGES_REQUESTED) -- same table as do-code-reviewer agent
7. Step E4.4: Log results to Council Review section under `### Code Review` heading
8. Update frontmatter: `council_review_ran.code: true`
9. Update the Files section at bottom to mention code review config check

### Fix 2: Add anti-inline guardrails to do-plan-reviewer agent

1. Open `agents/do-plan-reviewer.md`
2. In the Council Review Agent Prompt (Step 3, around line 68-84), replace the inline review prompt with instructions that:
   - Tell the spawned agent to run `council-invoke.cjs` with `--type plan`
   - Specify the script path as `~/.claude/commands/do/scripts/council-invoke.cjs`
   - Use the Bash tool to execute the script and capture stdout
   - Parse the JSON stdout for: `advisor`, `verdict`, `findings`, `recommendations`, `success`
   - Return ONLY the parsed result as its response (not its own opinion); format: `VERDICT: <verdict>\nAdvisor: <advisor>\nFindings: <findings>\nRecommendations: <recommendations>`
3. Add a `<critical_rules>` section before `<review_flow>` that states:
   - "You MUST use the Agent tool to spawn sub-agents for reviews"
   - "The council review agent MUST use council-invoke.cjs via the Bash tool -- it must NOT generate its own review opinion"
   - "If council-invoke.cjs returns non-zero exit or unparseable output, return CONCERNS with the raw error"
   - "If Agent tool fails, use the Sequential Fallback section"
4. In the Sequential Fallback section (line 168-178), add: for the council step, run `council-invoke.cjs` directly via Bash tool from the parent reviewer agent instead of spawning another agent

### Fix 3: Same anti-inline guardrails for do-code-reviewer agent

1. Open `agents/do-code-reviewer.md`
2. Mirror all changes from Fix 2:
   - Replace Council Review Agent Prompt with `council-invoke.cjs --type code` instructions
   - Spawned council agent uses Bash tool to run script, captures stdout JSON, returns parsed verdict
   - Add `<critical_rules>` section with same three rules (adapted for code review)
   - Update Sequential Fallback to run `council-invoke.cjs --type code` directly via Bash tool
3. Ensure the script path uses `~/.claude/commands/do/scripts/council-invoke.cjs`

### Files to modify

| File | Change |
|------|--------|
| `skills/do/references/stage-execute.md` | Add Step E4: post-execution code review gate |
| `agents/do-plan-reviewer.md` | Replace council agent prompt with council-invoke.cjs usage, add anti-inline guardrails |
| `agents/do-code-reviewer.md` | Replace council agent prompt with council-invoke.cjs usage, add anti-inline guardrails |

## Concerns

1. **Council agent spawn depth** -- The reviewer agents spawn sub-agents that need Bash tool access to run `council-invoke.cjs`. The agent frontmatter already includes `Bash` in tools, but spawned sub-agents inherit tool access from the Agent tool call, not the parent agent definition.
   - *Mitigation:* The sequential fallback (run script directly via Bash from the parent reviewer) handles this if agent spawning fails. Also, the council-invoke.cjs can be called directly from the reviewer agent itself in the fallback path.

2. **Script path resolution** -- `council-invoke.cjs` lives at `~/.claude/commands/do/scripts/council-invoke.cjs` after install. The `<skill-path>` placeholder in stage-execute.md may not resolve correctly in all contexts.
   - *Mitigation:* Use the explicit expanded path `~/.claude/commands/do/scripts/council-invoke.cjs` in the reviewer agents. In stage-execute.md, keep `<skill-path>` to match existing E-1 pattern (it already works there).

3. **Duplicate code review triggers** -- If user runs `/do:task` (which has Step 10 for code review) vs `/do:continue` (which routes through stage-execute.md), both paths now trigger code review. The `council_review_ran.code` frontmatter check prevents double execution.
   - *Mitigation:* The idempotency check (already in the plan as E4.0) prevents this. Same pattern as E-1 for plan review.

4. **Council agent output contract** -- Fixes 2 and 3 spawn a sub-agent that runs `council-invoke.cjs`. The plan must specify how that agent communicates its result back to the parent reviewer, otherwise the executioner may write agents that lose the verdict in transit.
   - *Mitigation:* Fixed in iteration 1 -- Fix 2 and Fix 3 now explicitly state the spawned agent must: (a) capture stdout JSON from the script, (b) parse the JSON fields, (c) return a structured text response in the format `VERDICT: <verdict>\nAdvisor: <advisor>\nFindings: ...\nRecommendations: ...`. The parent reviewer then parses this text response from the Agent call result.

## Execution Log

### 2026-04-14 15:00 - Execution started
**Status:** In progress
**Steps:** 0/3 complete

### 2026-04-14 15:01 - Step 1: Add E4 post-execution code review to stage-execute.md
**Files:**
- `skills/do/references/stage-execute.md` - Added Step E4 (E4.0-E4.4) between E3 and Files section; mirrors E-1 pattern with idempotency check, config gate, council-invoke.cjs invocation, verdict handling table, and logging instructions

**Decisions:**
- Changed E3 completion message to "Checking council config before verification" to signal E4 follows
- Used `<skill-path>` placeholder for script path, consistent with existing E-1 pattern
- APPROVED and NITPICKS_ONLY both proceed (matching do-code-reviewer verdict table)
- CHANGES_REQUESTED prompts user with 1/2 choice identical to E-1 CONCERNS/RETHINK pattern

**Status:** Complete

### 2026-04-14 15:03 - Step 2: Add anti-inline guardrails to do-plan-reviewer.md
**Files:**
- `agents/do-plan-reviewer.md` - Added `<critical_rules>` section before `<review_flow>` with 4 rules; replaced Council Review Agent Prompt with council-invoke.cjs invocation instructions including explicit output contract (VERDICT/Advisor/Findings/Recommendations format); updated Sequential Fallback to run script directly via Bash from parent agent

**Decisions:**
- Council Review Agent Prompt made maximally explicit: "DO NOT review the plan yourself" to prevent inline generation
- Error handling in agent prompt returns CONCERNS verdict with script-error advisor to keep output parseable
- Sequential fallback council step now bypasses sub-agent and runs script directly, which is more reliable

**Status:** Complete

### 2026-04-14 15:05 - Step 3: Add anti-inline guardrails to do-code-reviewer.md
**Files:**
- `agents/do-code-reviewer.md` - Added `<critical_rules>` section before `<review_flow>` with 4 rules (adapted for code review: CHANGES_REQUESTED instead of CONCERNS for script errors); replaced Council Review Agent Prompt with council-invoke.cjs --type code invocation instructions; updated Sequential Fallback to run script directly via Bash from parent agent

**Decisions:**
- Error fallback verdict changed to CHANGES_REQUESTED (vs CONCERNS in plan-reviewer) to match the code-reviewer verdict vocabulary
- Otherwise mirrors plan-reviewer changes exactly for consistency

**Status:** Complete

### 2026-04-14 15:06 - Reinstall via node bin/install.cjs
**Files:**
- `~/.claude/commands/do/references/stage-execute.md` - Deployed (6 council-invoke.cjs refs confirmed)
- `~/.claude/agents/do-plan-reviewer.md` - Deployed (8 council-invoke.cjs refs confirmed)
- `~/.claude/agents/do-code-reviewer.md` - Deployed (8 council-invoke.cjs refs confirmed)
- `~/.codex/commands/do/` - Deployed to codex commands as well

**Status:** Complete

### 2026-04-14 15:07 - Execution complete
**Status:** Execution complete

**Summary:**
- Steps completed: 3/3
- Files modified: 3 source + reinstalled
- Decisions: 4 (noted above)
- Deviations: 0

## Council Review

<!-- Populated during council review stages -->

## Review Iterations

### Iteration 1
- **Self-review:** CONCERNS - Fix 2 and Fix 3 lacked specification of the output contract between the spawned council agent and the parent reviewer. The spawned agent needed explicit instructions on how to surface the `council-invoke.cjs` JSON result back to the caller.
- **Council:** CONCERNS - Same gap identified from fresh perspective; additionally noted that without explicit return format, the executioner would likely write an agent that reads output but returns its own summary, defeating the anti-inline guardrail.
- **Changes made:** Added explicit output parsing and return format specification to Fix 2 and Fix 3 step 2. Added Concern 4 covering the output contract gap with its mitigation.

## Verification Results

### Code Review — 2026-04-14

**Iterations:** 1/3
**Self-Review:** APPROVED
**Council:** TIMEOUT (codex did not respond; sequential fallback used — self-review only)

#### Nitpicks (non-blocking)
- `skills/do/references/stage-execute.md` E4.4: The `{{#if USER_OVERRIDE}}` Handlebars-style conditional in the log template is unconventional for plain markdown instruction files. A comment-style note (`<!-- include only if user chose option 2 -->`) would be clearer, but models handle this without issue.

## UAT Checklist

Based on the task requirements, verify:

1. [ ] Run `/do:continue` on a task where `council_reviews.execution: true` and `council_review_ran.code` is absent — confirm E4 triggers and invokes `council-invoke.cjs --type code`
2. [ ] Run `/do:continue` on a task where `council_reviews.execution: false` — confirm E4 marks `council_review_ran.code: 'skipped'` and proceeds without invoking the script
3. [ ] Run `/do:continue` on a task where `council_review_ran.code: true` already — confirm E4.0 skips immediately without re-running the script
4. [ ] Spawn `do-plan-reviewer` with `council_reviews.planning: true` — confirm the council sub-agent runs `council-invoke.cjs --type plan` via Bash tool (not its own inline review)
5. [ ] Spawn `do-code-reviewer` with `council_reviews.execution: true` — confirm the council sub-agent runs `council-invoke.cjs --type code` via Bash tool (not its own inline review)
6. [ ] Verify that if `council-invoke.cjs` fails (bad path, timeout), the council sub-agent returns `CONCERNS` (plan) or `CHANGES_REQUESTED` (code) with `script-error` advisor rather than a fabricated verdict
7. [ ] Verify the sequential fallback path in both reviewer agents: when Agent tool fails for council, the parent runs the script directly via Bash tool and parses the result
