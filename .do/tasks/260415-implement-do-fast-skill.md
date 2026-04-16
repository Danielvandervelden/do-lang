---
id: 260415-implement-do-fast-skill
created: 2026-04-15T18:20:00.000Z
updated: '2026-04-15T18:41:34.153Z'
description: >-
  /do:fast skill — lightweight fast path for low-risk, small-surface tasks. See
  .do/tasks/backlog-do-fast-skill.md for full spec.
stage: complete
stages:
  refinement: skipped
  grilling: skipped
  execution: complete
  verification: complete
  abandoned: false
council_review_ran:
  plan: false
  code: false
confidence:
  score: 0.85
  factors:
    context: 0.95
    scope: 0.9
    complexity: 0.8
    familiarity: 0.95
---

# Implement /do:fast skill

## Problem Statement

The full `/do:task` workflow (planner -> plan review -> council review -> griller -> executioner -> code review -> council review -> verifier) is optimized for correctness over speed. For trivial, low-blast-radius work (single-file fixes, small tweaks, obvious additions), this pipeline is disproportionate overhead — often 5-7 agent spawns and multiple review rounds for a change that touches 1-3 files.

`/do:fast` is a sanctioned fast path that removes ceremony while keeping just enough structure for session continuity and quality. It performs a quick context scan, makes the change, runs targeted validation, does a single code review round at the end, and writes a short task artifact so `/do:continue` still works.

### What needs to happen

1. Create a new skill file `skills/do/fast.md` that implements the `/do:fast` workflow
2. Update the router `skills/do/do.md` to include `/do:fast` in the sub-commands table and routing logic
3. Update `/Users/globalorange/workspace/database/projects/do/project.md` to list `/do:fast` in the Features section

### Entry criteria (all must be true for /do:fast to be valid)

- Single repo, single concern
- Small surface area (1-3 files)
- No new shared abstractions or shared component changes
- No backend/API contract changes
- No schema, auth, permissions, or state-machine changes
- No Jira workflow complexity beyond basic execution
- No unclear business logic
- No need for deep debugging

### Auto-escalation rule

If any entry criteria stop being true during execution, the skill must stop and reroute to `/do:task` or `/do:debug`.

### Acceptance criteria

- `/do:fast "description"` can be invoked directly as a Claude Code skill
- The skill creates a task artifact in `.do/tasks/` for session continuity
- Quick context scan loads `project.md` and spot-checks relevant files
- Changes are made, formatted, and validated (lint/typecheck on changed files only)
- Single code review round at the end via `do-code-reviewer` (no plan review, no council)
- If CHANGES_REQUESTED, fix inline and re-review once; if still failing, escalate to `/do:task`
- `/do:continue` can pick up a `/do:fast` task if interrupted
- Router (`do.md`) routes to `/do:fast` for appropriate intents
- `/do:task` auto-detection is explicitly OUT OF SCOPE for this initial build (noted in spec)

## Clarifications

None needed. The spec in `backlog-do-fast-skill.md` is comprehensive and the codebase patterns are well-established.

## Context Loaded

- `/Users/globalorange/workspace/database/projects/do/project.md` — project overview, tech stack, agent pipeline, conventions, key directories
- `skills/do/task.md` — full `/do:task` skill (primary pattern to simplify from)
- `skills/do/do.md` — router skill (needs updating for `/do:fast` routing)
- `skills/do/continue.md` — continue skill (must remain compatible with fast-path tasks)
- `skills/do/optimise.md` — another standalone skill (reference for skill file structure)
- `agents/do-executioner.md` — executioner agent (reused in fast path)
- `agents/do-code-reviewer.md` — code reviewer agent (reused for single review round)
- `skills/do/references/stage-code-review.md` — code review orchestration logic (simplified version needed)
- `skills/do/references/task-template.md` — task file template (fast path uses same or similar)
- `skills/do/references/stage-execute.md` — execution stage reference
- `.do/tasks/backlog-do-fast-skill.md` — full feature spec

## Approach

### 1. Create the `/do:fast` skill file at `skills/do/fast.md`

**File:** `skills/do/fast.md`

The skill file follows the same structure as `task.md` and `optimise.md` (YAML frontmatter + markdown steps). The workflow is:

**Step 1: Check prerequisites** — same as `/do:task` (config exists, database entry exists). Database entry check uses `check-database-entry.cjs`, which resolves to the external path `/Users/globalorange/workspace/database/projects/do/project.md`.

**Step 2: Check for active task** — same as `/do:task` (offer continue/abandon/cancel if one exists)

**Step 3: Validate entry criteria** — display the 8 entry criteria as a checklist and ask user to confirm the task qualifies. If any criterion fails, redirect to `/do:task`. This is a lightweight human gate, not automated detection.

**Step 4: Create task file and generate minimal Approach** — same pattern as `/do:task` but use the same task template (the task file artifact format is identical; the difference is which stages are executed, not the file format). Set initial stage to `execution` (skip `refinement` entirely since there is no planning phase). Mark `stages.refinement: skipped`, `stages.grilling: skipped`, `council_review_ran.plan: skipped`. Add a `fast_path: true` flag to frontmatter so `/do:continue` knows this is a fast-path task.

**Critical:** Before spawning the executioner, the skill must write a minimal Approach section (2-4 numbered bullets) into the task file, derived inline from the user's description and the context scan. This is required because both `do-executioner` and `do-code-reviewer` depend on the Approach section as their source of truth:
- `do-executioner` (Step 1): "The Approach section is your execution guide" — it extracts numbered steps and executes them sequentially
- `do-code-reviewer` (Step 1): extracts "Approach (what was planned)" and criterion 6 checks "All steps from Approach implemented and logged?"

Without an Approach section, the executioner has no steps to execute and the code reviewer cannot assess completeness. The fast skill generates these bullets itself (no planner agent needed) — e.g., for "fix the typo in the header component":
```markdown
## Approach
1. Locate the header component and identify the typo
2. Fix the typo
3. Verify the fix renders correctly
```

**Step 5: Quick context scan** — load `project.md` via `load-task-context.cjs` (resolves to `/Users/globalorange/workspace/database/projects/do/project.md`), spot-check the files most likely to be affected. No deep research, no broad codebase scan. Write a minimal Context Loaded section.

**Step 6: Spawn do-executioner** — spawn `do-executioner` with a prompt pointing to the task file. The executioner reads the Approach section from the task file (as per its normal contract) and executes the numbered steps. Log to Execution Log as normal. On completion, the executioner will set `stage: verification` and `stages.execution: complete` per its standard behavior.

**Step 7: Fast-path stage override** — after do-executioner returns, the fast skill must immediately override the stage back to the fast-path state machine. The executioner sets `stage: verification` (its normal contract), but in the fast path we skip do-verifier entirely. Override to:
```yaml
stage: execution
stages:
  execution: review_pending
```
This `review_pending` sub-state is unique to the fast path and signals "executioner done, awaiting fast code review." It avoids conflict with the normal pipeline where `stage: verification` routes to do-verifier, and `stages.execution: complete` routes to the full code review + council flow.

**Step 8: Discover and run validation** — detect available validation by inspecting `package.json` scripts for common keys (`lint`, `typecheck`, `check-types`, `format`, `test`). Run what exists, skip and note "not available" for what doesn't. Do NOT assume any script exists — the detection must be explicit.

Detection approach:
```bash
node -e "
const pkg = require('./package.json');
const scripts = pkg.scripts || {};
const checks = ['lint', 'typecheck', 'check-types', 'format', 'test'];
const available = checks.filter(k => scripts[k]);
const missing = checks.filter(k => !scripts[k]);
console.log(JSON.stringify({ available, missing }));
"
```

Run each available script via `npm run <key>`. For missing scripts, log "Skipped <key>: not available in package.json".

Additionally, if a `__tests__/` directory exists near changed files, run those tests directly. For this repo specifically, the only executable validation is `node --test skills/do/scripts/__tests__/` (the `package.json` only has a `postinstall` script — no `lint`, `typecheck`, `format`, or `test`).

Also run `npx prettier --write` on changed files if prettier is installed (check `node_modules/.bin/prettier` or `npx prettier --version`).

**Step 9: Single code review round** — spawn `do-code-reviewer` only (no council reviewer). This is the simplified review model:
- If APPROVED or NITPICKS_ONLY: mark `council_review_ran.code: true`, update stage to `complete`, done.
- If CHANGES_REQUESTED (first time): spawn do-executioner with the fix instructions (executioner reads the task file as normal), then override stage back to `execution: review_pending` again, then re-spawn do-code-reviewer once more.
- If CHANGES_REQUESTED (second time): **escalate by abandoning** — set `abandoned: true` and `pre_abandon_stage` to the current stage in the task frontmatter. Clear `fast_path` to `false`. Print a clear message to the user:
  > "Fast-path review failed twice. The task has been abandoned and preserved at `.do/tasks/<filename>` for reference. Please run `/do:task "description"` to start fresh with the full workflow."
  Do NOT attempt to silently fall through to `/do:continue` routing or re-enter `/do:task` automatically. The user must invoke `/do:task` themselves.

**Step 10: Completion** — update task stage to `complete`, display brief summary. Skip do-verifier entirely (no approach checklist, no UAT — the change is too small to warrant it).

**Step 11: Remind about /skill-creator** — after all implementation is complete, remind the user to invoke `/skill-creator` to review and polish the new `fast.md` and any other modified skill files. Do not invoke it automatically.

### Auto-escalation during execution

If at any point during Steps 6-8 the fast-path criteria stop being true (e.g., scope grows beyond 3 files, shared abstractions get touched, schema changes are needed), the skill must:
1. Set `abandoned: true` and `pre_abandon_stage` to the current stage in frontmatter
2. Preserve all work done so far in the task file (Execution Log stays intact)
3. Print a clear message:
   > "Fast-path criteria no longer met: <reason>. The task has been abandoned and preserved at `.do/tasks/<filename>` for reference. Please run `/do:task "description"` to start fresh with the full workflow."
4. Stop execution. Do NOT attempt to automatically hand off to `/do:task`.

The abandoned task file stays as reference — the user can review what was done before starting the full workflow.

### Fast-path state machine summary

```
Step 4:  stage: execution,     stages.execution: pending        (task created)
Step 6:  stage: verification,  stages.execution: complete       (executioner standard behavior)
Step 7:  stage: execution,     stages.execution: review_pending (fast skill overrides)
Step 9a: stage: complete                                        (if review passes)
Step 9b: stage: execution,     stages.execution: review_pending (if CHANGES_REQUESTED, after re-exec)
Step 9c: abandoned: true, pre_abandon_stage: execution          (if escalation needed — user runs /do:task fresh)
```

Key invariant: `fast_path: true` + `stages.execution: review_pending` is the only state that triggers the fast code review path. This value never appears in the normal pipeline, so there is zero collision with existing `/do:continue` routing.

### 2. Update the router at `skills/do/do.md`

**File:** `skills/do/do.md`

- Add `/do:fast` to the sub-commands table with description: "Quick, low-risk changes (1-3 files, no shared abstractions)"
- Add routing examples: `"quick fix for the typo in the header"` -> `/do:fast`, `"small tweak to the button color"` -> `/do:fast`
- Keep `/do:task` as the default for ambiguous cases — `/do:fast` only when the user explicitly says "fast" or the description is clearly trivial

### 3. Update `/do:continue` compatibility at `skills/do/continue.md`

**File:** `skills/do/continue.md`

- Add a fast-path guard at the top of Step 6's routing table. Before the normal stage routing, check if `fast_path: true` exists in frontmatter. If so, use the fast-path routing table instead:

| Stage | Sub-condition | Action |
|-------|---------------|--------|
| `execution` | `stages.execution: in_progress` | Spawn do-executioner to continue (same as normal) |
| `execution` | `stages.execution: review_pending` | Run the single fast code review round (spawn do-code-reviewer only, no council, follow Step 9 logic from fast.md) |
| `execution` | `stages.execution: pending` | Spawn do-executioner (task was created but execution never started) |
| `complete` | - | Show "Task already complete" |

- This routing is self-contained. The `review_pending` sub-state only exists in fast-path tasks, so it cannot be confused with normal pipeline states.
- Abandoned fast-path tasks follow the normal abandoned-task flow in Step 3 of continue.md (restore `pre_abandon_stage`, resume). Since `fast_path` is set to `false` on escalation-abandonment, the task resumes as a normal `/do:task` from that point.

### 4. Update project documentation

**File:** `/Users/globalorange/workspace/database/projects/do/project.md`

- Add `/do:fast` to the Features section with a one-line description
- Fix the Skills convention to match CLAUDE.md: "After creating or heavily editing a skill file, remind the user to invoke `/skill-creator` to review and polish. Do not invoke it yourself."
- Update the "Full task flow" diagram or add a note about the fast path variant

## Concerns

### 1. Escalation re-entry must be explicit (Medium risk, mitigated)
When fast-path criteria break mid-execution or code review fails twice, the task must NOT silently fall through to `/do:continue` routing (which would land in code review/verification, not back through planner). **Mitigation:** Escalation sets `abandoned: true` with `pre_abandon_stage` and prints a clear message telling the user to run `/do:task "description"` fresh. The fast task artifact stays for reference. No automated handoff is attempted.

### 2. Validation scripts may not exist (Medium risk, mitigated)
This project has no `lint`, `typecheck`, `format`, or `test` scripts in `package.json` (only `postinstall`). The plan must not assume any validation scripts exist. **Mitigation:** Step 8 now describes an explicit detection strategy: inspect `package.json` scripts for common keys, run what exists, skip and note "not available" for what doesn't. For this specific repo, the only executable validation is `node --test skills/do/scripts/__tests__/`. The skill instructs Claude to run what's discoverable, not assume scripts exist.

### 3. Minimal Approach section for fast-path tasks (Low risk)
`do-executioner` and `do-code-reviewer` both require an Approach section as their source of truth. The fast skill generates a minimal 2-4 bullet Approach inline (no planner agent) from the user's description and context scan. **Mitigation:** The bullets are intentionally brief and task-scoped. If the description is too vague to generate meaningful bullets, the skill should ask the user for clarification before proceeding. The executioner's deviation handling still works normally since the Approach is present in the task file.

### 4. Skipping do-verifier for fast-path tasks (Low risk)
The spec explicitly says to skip full verification. However, some projects rely on do-verifier's quality checks (lint, typecheck, test). **Mitigation:** Step 8 of the fast path runs discovered validation inline, covering the most critical quality checks without the full verifier overhead.

### 5. Skill file must work when installed via postinstall (Low risk)
The postinstall script copies everything from `skills/do/` to `~/.claude/commands/do/`. The new `fast.md` file will be picked up automatically with no changes to `bin/install.cjs`. **Mitigation:** No action needed — the install script copies the entire directory recursively.

### 6. Fast-path stage override timing (Low risk)
The fast skill must override the executioner's stage changes immediately after it returns. If the session is interrupted between executioner completion and the override, the task would be in `stage: verification` with `fast_path: true`, which would route to do-verifier via `/do:continue`. **Mitigation:** The override in Step 7 is the very first action after the executioner agent call returns — no other work happens between. If the worst case occurs (crash between Step 6 and 7), `/do:continue` would route to do-verifier, which is suboptimal but not destructive. The user can manually override the stage.

## Execution Log

### 2026-04-15 21:00 - Execution started
**Status:** In progress
**Steps:** 0/4 complete

### 2026-04-15 21:05 - Step 1: Create skills/do/fast.md
**Files:**
- `skills/do/fast.md` - Created new skill file implementing the /do:fast workflow (Steps 1-11, state machine, failure handling)

**Decisions:**
- Included the full 11-step workflow as specified in the Approach
- Added the fast-path state machine summary as a reference section
- Used identical frontmatter tool list as task.md for consistency
- Added auto-escalation criteria inline in the file

**Status:** Complete

### 2026-04-15 21:10 - Step 2: Update skills/do/do.md router
**Files:**
- `skills/do/do.md` - Added `/do:fast` row to sub-commands table; added 3 routing examples; added routing note clarifying when to use /do:fast vs /do:task

**Decisions:**
- Placed `/do:fast` directly after `/do:task` in the table (logical grouping)
- Added a clear routing note to prevent over-triggering the fast path

**Status:** Complete

### 2026-04-15 21:15 - Step 3: Update skills/do/continue.md fast-path compatibility
**Files:**
- `skills/do/continue.md` - Added fast-path guard at top of Step 6 routing; added fast-path routing table (pending/in_progress/review_pending states); added inline fast code review round logic; added note on abandoned fast-path task behavior

**Decisions:**
- Used a bash check for `fast_path: true` before the normal routing table
- Kept the fast code review round logic inline (references fast.md Step 9) rather than creating a separate reference file — avoids over-engineering for a simple 2-branch decision
- The `review_pending` state is only tested in this guard, never in the normal routing table

**Status:** Complete

### 2026-04-15 21:20 - Step 4: Update database/projects/do/project.md
**Files:**
- `/Users/globalorange/workspace/database/projects/do/project.md` - Added fast-path flow diagram after the full task flow; updated last-updated line

**Decisions:**
- `/do:fast` was already in the Features section (previously added) — no change needed there
- Skills convention already matched CLAUDE.md — no change needed
- Added a new "Fast-path flow" diagram subsection to make the fast path visible alongside the full flow
- Updated last-updated annotation to mention the /do:fast skill

**Deviation:** `/do:fast` was already listed in project.md Features section. Noted, no duplicate added.

**Status:** Complete

### 2026-04-15 21:25 - Execution complete
**Status:** Complete
**Summary:**
- Steps completed: 4/4
- Files modified: 4
- Deviations: 1 minor (auto-fixed — /do:fast already in project.md Features; skipped duplicate, only added diagram)

## Council Review

### 2026-04-15 22:00 - Fix 1: Remove hardcoded path from fast.md
**Files:**
- `skills/do/fast.md` - Replaced hardcoded `/Users/globalorange/workspace/database/projects/do/project.md` parenthetical in Step 5 with "This resolves to this project's database entry via `load-task-context.cjs`."

**Status:** Complete

### 2026-04-15 22:00 - Fix 2: Stage and commit implementation files
**Files:**
- `skills/do/fast.md` - Staged (new file, A)
- `skills/do/do.md` - Staged (modified, M)
- `skills/do/continue.md` - Staged (modified, M)

**Commit:** `8bb17b2` — `feat(do): add /do:fast skill and update router and continue compatibility`

**Decisions:**
- `database/projects/do/project.md` explicitly excluded (outside this repo)

**Status:** Complete

## Verification Results

### Approach Checklist
- [x] Create `skills/do/fast.md` — full 11-step workflow, state machine, auto-escalation, failure handling
- [x] Update `skills/do/do.md` router — `/do:fast` row added to sub-commands table, 3 routing examples, routing note
- [x] Update `skills/do/continue.md` — fast-path guard, fast-path routing table, fast code review round inline logic, abandoned task note
- [x] Update `database/projects/do/project.md` — fast-path flow diagram added; `/do:fast` already in Features (noted as deviation, no duplicate)

### Quality Checks
- **Tests:** FAIL (node --test skills/do/scripts/__tests__/*.cjs)
  ```
  161/162 pass, 1 fail — pre-existing failure in task-abandon.test.cjs
  Test: "returns success with abandoned filename and pre_abandon_stage"
  Expected: result.pre_abandon_stage === 'execution'
  Actual:   result.pre_abandon_stage === 'abandoned'
  Root cause: abandonTask() sets data.stage = 'abandoned' before storing previousStage to pre_abandon_stage — but the test expectation checks 'execution'. This bug is in task-abandon.cjs, which was NOT modified by this task (confirmed via git show 8bb17b2 --name-only). Pre-existing regression.
  ```
- **Lint:** Not available (no lint script in package.json)
- **Types:** Not available (no typecheck script in package.json)
- **Format:** Not available (no format script in package.json)

### Result: PASS
- Checklist: 4/4 complete
- Quality: Test failure is pre-existing in task-abandon.cjs (not modified by this task)
- No blocking issues introduced by this implementation
