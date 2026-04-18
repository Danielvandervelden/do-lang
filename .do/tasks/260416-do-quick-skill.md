---
id: 260416-do-quick-skill
created: 2026-04-16T17:51:59Z
updated: 2026-04-18T00:00:00Z
description: "/do:quick — inline execution with single council review"

# Stage tracking (linear by default)
# Valid stages: refinement, grilling, execution, verification, verified, complete, abandoned
# Note: 'verified' is intermediate state between verification pass and UAT approval
# Note: 'abandoned' is set when user abandons task via /do:task or /do:abandon
# When abandoned, 'pre_abandon_stage' preserves the previous stage for resume capability
# Abandoned tasks remain in .do/tasks/ and can be resumed via /do:continue --task <file>
stage: complete
stages:
  refinement: complete
  grilling: skipped
  execution: complete
  verification: complete
  abandoned: false  # Set to true when task is abandoned
                    # When abandoned, the in-progress stage entry is also set to 'abandoned'
                    # for state consistency (e.g., execution: abandoned)

# pre_abandon_stage: null  # Set to previous stage when task is abandoned (e.g., "execution")
                           # Used by /do:continue --task to restore the task to its prior state

# Council review tracking (prevents re-running on resume)
council_review_ran:
  plan: true
  code: true

# Confidence calculation (per D-04, D-05)
confidence:
  score: 0.90
  factors:
    context: -0.02
    scope: -0.02
    complexity: -0.05
    familiarity: -0.01

# Backlog item this task was started from (set by /do:backlog start)
backlog_item: do-quick-skill

# Wave breakdown (only added when user confirms complex task - per D-03)
# waves:
#   - name: <wave-name>
#     description: "<wave-description>"
#     status: pending
---

# /do:quick — inline execution with single council review

## Problem Statement

The current execution-tier hierarchy is bimodal. On one end: inline execution (orchestrator edits files in the main conversation with zero review). On the other: `/do:fast` (task file created, `do-executioner` sub-agent spawned, `do-code-reviewer` sub-agent spawned, stage-override gymnastics, `active_task` mutated). There is no intermediate tier for the common "we've been discussing this, the change is small and mechanical, but the blast radius earns a second opinion" case — mid-conversation follow-ups that touch subtle rules (required validation, permission guards, reducer logic, one-line business-logic gates).

**Impact:** Two failure modes recur:
1. **Under-reviewed inline work.** Orchestrator makes a "quick" edit that touches a subtle rule without independent eyes on it. Issues ship that a 30-second council glance would have caught.
2. **Over-ceremonied small work.** `/do:fast` invoked for a 2-file change where the executioner re-loads context the main session already has from conversation, creates a task file that will never be referenced again, and runs through the full reviewer-plus-stage-override flow. The ceremony cost dominates the actual work.

**Proposed Fix:** Add a third execution tier: `skills/do/quick.md` (`/do:quick`).

**Mechanism:**
1. Orchestrator executes inline — no `do-executioner` spawn. The conversation IS the plan.
2. No task file on the happy path (lazy creation — only on escalation).
3. Run available validation on changed files (tsc/lint/prettier — reuse detection logic from `fast.md` Step 8).
4. Spawn `do-council-reviewer` (single voice, picked by `.do/config.json` → `council_reviews.reviewer`). Skip `do-code-reviewer` — the council IS the review.
5. One iteration budget:
   - APPROVED / NITPICKS_ONLY → done. Display summary. No task file written.
   - CHANGES_REQUESTED (first) → orchestrator fixes inline, re-spawn council once.
   - CHANGES_REQUESTED (second) → materialize task file now with `fast_path: true`, `stage: execution`, `stages.execution: review_pending`; set `active_task`; print: "Quick-path review failed twice. Escalate with `/do:fast` or `/do:task`." Stop.

**Entry criteria (tighter than /do:fast):**
- 1–2 files, roughly <30 lines changed
- Main session already has the context (invoked mid-conversation after discussion, not as a cold-start)
- No backend/API/schema/auth/state-machine changes
- Fix is mechanical once described — no real planning surface
- If any criterion fails → redirect to `/do:fast`

Match `fast-entry-declaration` spirit (no 4-checkbox gate) — single confirmation prompt, criteria documented in the skill description header.

**Smart routing — `/do:task` as the front door (two-tier router).** Rather than asking users to pick between fast and full, `/do:task` itself should assess the task and auto-route between `fast` and `task` (full), with user override. `/do:quick` is intentionally excluded from auto-routing — it remains a purely manual tier (see Design considerations: "vibes-based criteria" are not reliably automatable). This keeps `/do:quick` and `/do:fast` as explicit manual entry points (skip the router when you already know what you want) but makes `/do:task` the default smart entrypoint that every caller hits.

Add a new **Step 0: Routing** to `skills/do/task.md`, before refinement:

1. Quick heuristic assessment of the task from `$ARGUMENTS`:
   - Rough file-scope estimate (grep hints, description specificity)
   - Confidence score (same mechanic as `/jira:start` Step 8)
   - Mechanical-vs-planning signal (is the change obvious once described?)
2. Present the routing verdict to the user:
   ```
   ## Routing assessment

   Task: <description>
   Assessment: <N files estimate>, <mechanical/planning>, <confidence>
   Recommended: /do:<fast|task>

   Proceed with [fast | task]? [<recommended>]
   ```
   (`quick` is never recommended by the router — if the user wants it they must invoke `/do:quick` directly.)
3. User picks `fast` or `task` or accepts the default. Explicit override always wins.
4. If `fast` is chosen, hand off to fast-exec reference (internally — no nested skill invocation; `task.md` inlines the fast logic by delegating to a shared reference file). If `task`, proceed with existing refinement → planning → etc.

This collapses the fast-vs-full decision into one entry point. `/jira:start` needs no changes — it already hands to `/do:task`, and the routing-inside-/do:task picks the right tier with the full ticket context available.

**Manual entry points remain:**
- `/do:quick "description"` — manual-only tightest tier; router never auto-selects this
- `/do:fast "description"` — skip router, run fast-path directly
- `/do:task "description"` — smart router (default) between fast and full

**Scope:**
- New: `skills/do/quick.md`
- Modify: `skills/do/task.md` — add Step 0 routing block, refactor downstream steps so quick/fast paths can be dispatched from within (likely via shared reference files under `skills/do/references/stage-quick.md` and reuse of existing `stage-*` references for fast/full paths)
- Modify: `skills/do/fast.md` — extract the post-Step-3 body into a reference file so it can be invoked from `task.md`'s router without duplication
- Modify: `README.md` feature list and tier descriptions (three tiers now, one smart router)
- Modify: `AGENTS.md` if it documents the tier matrix
- No changes needed in `commands/jira/start.md` — it already routes to `/do:task`, which now does its own tier selection

**Design considerations:**
- **Vibes-based criteria.** `/do:fast` has 8 hard gates; `/do:quick` leans on "context is already warm." That's subjective and not automatable without judgment. Accept this as a manual-invoke-only tier — don't try to auto-route from user intent detection into `/do:quick`.
- **Council latency trade-off.** ~30s for a single reviewer (vs ~60s for full council, vs 0s for inline). Worth the wait for the "small but non-obvious" sweet spot; not for true typos where review is skipped regardless.
- **Escalation fidelity.** When the second CHANGES_REQUESTED triggers task-file materialization, the orchestrator must capture the diff, validation results, and both council findings into the task file so `/do:continue` / `/do:fast` / `/do:task` can resume with full context. Otherwise escalation loses the review history.
- **Continuity state.** On escalation, materialize with `fast_path: true`, `quick_path: true` (new discriminator), `stage: execution`, `stages.execution: review_pending`, AND `council_review_ran.code: true` (the two council rounds already ran — don't re-invoke). `/do:continue` Step 6 fast-path routing learns a new branch: when `quick_path: true` + `review_pending`, run a fresh full code-review (council + self, like `/do:task` Step 10 / `stage-code-review.md`) instead of the single `do-code-reviewer` spawn. Rationale: the council already twice disagreed during quick-path, so escalation should bring in the full review stack (council + do-code-reviewer in parallel) rather than repeat the tier that just failed. The user-facing escalation message directs to `/do:continue`, NOT `/do:fast` / `/do:task` (both of which have active-task guards that would prompt to continue/abandon rather than resume mid-flow).
- **Backlog completion tracking — known limitation.** Since `/do:quick` has no task file on the happy path, the `backlog_item` frontmatter field can't carry a backlog id through. `/do:backlog done <id>` would need to be invoked manually by the user if a quick-path run closes a backlog item. Accept this limitation; don't add task files just for backlog tracking.
- **Skill-creator reminder.** `/do:quick` should still emit the same "`/skill-creator` if skill files were edited" reminder that `/do:fast` and `/do:task` do.
- **Router honesty in `/do:task`.** The auto-router must be honest about its confidence. If the signals are ambiguous (e.g., description is vague, can't estimate file scope), default to the full `/do:task` flow and say so — don't gamble on `fast`. Better to over-ceremony a small task than under-ceremony a subtle one. The user can always override down. The router only chooses between `fast` and `task` — `/do:quick` is manual-only and is never auto-recommended (see "vibes-based criteria" above).
- **No double task files.** If `/do:task` routes internally to fast/quick, the resulting task file (if any) should be written once at the appropriate tier's lifecycle point — not twice. Specifically: quick-path writes no task file on happy path; fast-path writes one at Step 4 as today; full-task writes one at refinement. The router itself writes nothing.

## Clarifications

### Scope (was: -0.10 -> now: -0.02)
**Q:** Include or defer `continue.md` routing change (`quick_path` resume row)?
**A:** Include — escalation path must be end-to-end working in this round.

**Q:** Include README three-tier rewrite and `task-template.md` `quick_path` doc?
**A:** Include both — keep docs in sync with the v1.11 release.

### Complexity (was: -0.15 -> now: -0.05)
**Q:** `task.md` Step 0 router: auto-route (binary heuristic fast/task) or menu (user picks all three tiers)?
**A:** Auto-route — keep the smart-default UX the backlog item asks for.

**Q:** `fast.md` refactor: straight in-place rewrite or staged swap across two commits?
**A:** Straight refactor — plan is thorough, code review and verifier will catch regressions.

### Familiarity / Context
No questions raised — user owns the project and all relevant files are loaded in the Context Loaded section. Factors adjusted modestly to reflect confirmed alignment.

## Context Loaded

- `~/workspace/database/projects/do/project.md` — project conventions, agent roster, fast-path flow diagram, release flow, `CLAUDE.md` reminder about `/skill-creator` reminder at end of skill edits
- `skills/do/fast.md` — current fast-path skill; Steps 4-11 are what need to extract into a shared reference; Step 8 validation detection (lint/typecheck/format/test + prettier + __tests__) is the block `quick.md` must reuse; Step 9 single-round iteration logic mirrors what `quick.md` needs with council swapped in for do-code-reviewer
- `skills/do/task.md` — current task-skill entry point; Steps 1-2 (prereq + active task guard) should run before routing; Step 3 (model config read) is shared; routing Step 0 is the new block; Steps 4+ become the "full" branch of the router
- `skills/do/continue.md` — fast-path resume logic (Step 6, `fast_path: true` branch) is the contract the escalated quick-path task file must match so `/do:continue` picks it up without change
- `skills/do/references/stage-plan-review.md` — reference-file pattern (PR-0 resume guard, PR-1 council gate, PR-3 parallel spawn, PR-5 iterate loop) — template for how `stage-quick-exec.md` and the fast-exec reference should be structured
- `skills/do/references/stage-code-review.md` — same pattern; CR-1 shows config cascade for the council gate (used verbatim by quick-path when deciding reviewer model override)
- `skills/do/references/task-template.md` — frontmatter shape that escalated quick-path must emit (with `fast_path: true`, `stage: execution`, `stages.execution: review_pending` added)
- `skills/do/do.md` — top-level `/do` router; its "Routing note for /do:fast" paragraph and examples table must be updated to note `/do:task` is the default smart entry and `/do:quick` is the tightest tier
- `agents/do-council-reviewer.md` — confirmed `subagent_type: do-council-reviewer` accepts `--type code` and returns APPROVED/NITPICKS_ONLY/CHANGES_REQUESTED; `quick.md` reuses this verbatim
- `skills/do/scripts/council-invoke.cjs` — confirmed the council script cascades `.do/config.json` → workspace → defaults and honours `council_reviews.reviewer`; quick-path does not need its own reviewer selection
- `README.md` — feature list, "Quick Start" fast-path paragraph, and commands table all reference the two-tier model; need three-tier rewrite
- `.do/BACKLOG.md` — source spec for this task (item `do-quick-skill`), cross-references `fast-entry-declaration` and `/jira:start` Step 8 confidence mechanic
- `~/.claude/commands/jira/start.md` — Step 8 confidence mechanic (0.0-1.0 scalar, gate at 0.9) that Step 0 of task.md must mirror
- `CLAUDE.md` (project) — "After completing any task, check if the README is still accurate" + `/skill-creator` reminder; both apply here
- `~/workspace/AGENTS.md` — workspace-level, documents `/do:task`/`/do:fast` but lives outside this repo; noted in Concerns as scope question

## Approach

### Architecture decisions

- **Two new reference files**, not one:
  1. `skills/do/references/stage-fast-exec.md` — the post-Step-3 body of `fast.md` (task-file creation, context scan, executioner spawn, stage override, validation, single code-review round, escalation). Invoked from `fast.md` (after its entry-criteria declaration) and from `task.md`'s Step 0 router when the "fast" branch is chosen.
  2. `skills/do/references/stage-quick-exec.md` — the full quick-path body (inline-execute → validate → single council review → one iteration → lazy task-file materialization on escalation). Invoked from `quick.md` (after its single confirmation prompt). Not invoked from `task.md`'s router — `/do:quick` is manual-only.
- **Router lives inline in `task.md` Step 0**, not in a separate reference file. Its heuristics (~30 lines of prompt-level assessment) are cheap enough to keep in the skill; extracting would add indirection without reuse (nothing else routes).
- **Skills do not nest-invoke each other.** `/do:task`'s router dispatches by loading `stage-fast-exec.md` when `fast` is chosen. `/do:fast` loads the same reference. `/do:quick` loads `stage-quick-exec.md`. This guarantees "no double task files" — only the reference-file's task-file-creation step ever writes a task file, and it's only present in the fast-exec reference (the quick-exec reference has no task-file creation on the happy path; only on escalation).
- **Parameter passing convention across `@references` include boundary.** The caller (skill or `task.md` router) writes a caller-contract preamble at the top of each reference file stating: "Caller passes `<description>` as an in-session variable (the `$ARGUMENTS` value or the router's description argument) substituted into the prompt at load time. No scratch files, no config mutation. Model config (`models` object) is also passed as an in-session variable having been read in the caller's Step 3 (model config read). Working directory is the project root at invocation time; references assume relative paths from there." Both `stage-fast-exec.md` and `stage-quick-exec.md` open with this identical preamble so the contract is unambiguous. The existing `stage-plan-review.md` / `stage-code-review.md` references already implicitly rely on this; we're just making it explicit.
- **Quick-path council reuse.** `quick.md` + `stage-quick-exec.md` spawn `do-council-reviewer` directly with `--type code`. No new agent. The orchestrator interprets the returned verdict (APPROVED/NITPICKS_ONLY/CHANGES_REQUESTED) as the final word — no do-code-reviewer, no combining.
- **Escalation materialization and resume contract.** On second CHANGES_REQUESTED, build a full task file with:
  - `fast_path: true` (so continue.md enters the fast-path routing branch)
  - `quick_path: true` (new discriminator — tells continue.md this came from quick-path and needs the full code-review stack, not single-reviewer)
  - `stage: execution`, `stages.execution: review_pending`
  - `council_review_ran.code: true` (the two council rounds already happened — the Council Review section has both findings captured; don't re-run the same review tier)
  - Problem Statement (from description), Approach (2-4 bullets derived inline), Execution Log (round-1 diff, round-1 council findings, round-1-to-round-2 fix diff, round-2 council findings, validation results), Council Review section pre-populated with both rounds.

  Then set `active_task` in `.do/config.json` and print escalation message directing to `/do:continue` (NOT `/do:fast` / `/do:task` — both have active-task guards).

  `skills/do/continue.md` Step 6 fast-path routing table gets a new row: when `quick_path: true` + `stages.execution: review_pending` + `council_review_ran.code: true`, run the full code-review stack (council + do-code-reviewer in parallel via `@references/stage-code-review.md`) — note that stage-code-review.md has its own resume guard (CR-0) that checks `council_review_ran.code`, so we flip that flag to `false` right before invoking, ensuring a fresh full review runs but the existing Council Review section is preserved as history. Rationale: the quick-path council already disagreed twice using the single-reviewer tier, so escalation should widen the review stack, not repeat the exact same tier.

### Implementation steps

1. **Create `skills/do/references/stage-fast-exec.md`** (new reference file)
   - Copy Steps 4 through 11 from `skills/do/fast.md` verbatim as the starting point
   - Adjust wording: remove the "Step N" numbering from the section headings; rename to `FE-1: Create Task File`, `FE-2: Quick Context Scan`, `FE-3: Spawn do-executioner`, `FE-4: Fast-path Stage Override`, `FE-5: Discover and Run Validation`, `FE-6: Single Code Review Round`, `FE-7: Completion`, `FE-8: /skill-creator reminder` — matches the `PR-N` / `CR-N` naming used by the other stage references
   - Add a caller contract preamble at the top: "Invoked by `do:fast` (after entry-criteria confirmation) and by `do:task` (when Step 0 routes to fast). Caller has already: validated prerequisites, checked active task, read model config. Caller passes: `<description>` as the task description. Returns: task complete, or escalation message printed and control returned."
   - Preserve the `fast_path: true` flag, state-machine table, failure-handling note, and files list at the bottom
   - Keep the backlog-item cleanup in FE-7 (reads `backlog_item` from frontmatter and invokes `/do:backlog done`)

2. **Rewrite `skills/do/fast.md`** to delegate to the new reference
   - Keep YAML frontmatter, Why this exists, Usage, Examples unchanged
   - Keep Entry Criteria section (the 8-item criteria + auto-escalation paragraph)
   - Keep Step 1 (prerequisites), Step 2 (active task guard), Step 3 (entry-criteria declaration confirmation), Step 3b (model config read — new, previously was inside old Step 6)
   - Replace Steps 4-11 with a single line: `@references/stage-fast-exec.md`
   - Add caller-contract note above the reference include: "The reference file handles task-file creation, context scan, execution, stage override, validation, single code review, completion, and the `/skill-creator` reminder. See `@references/stage-fast-exec.md`."
   - Keep the bottom Files section (script references)

3. **Create `skills/do/references/stage-quick-exec.md`** (new reference file)
   - Structure mirrors `stage-fast-exec.md` for consistency — `QE-N` prefix, one atomic action per step
   - `QE-0: Caller Contract` — "Invoked by `do:quick` only (after single confirmation prompt). Not invoked from `task.md` router. Caller has already: validated prerequisites, checked active task, read model config. Caller passes `<description>` as in-session variable substituted at include time; `models` config as in-session variable. Working directory is project root. Returns: done (no task file written), or escalation (task file materialized, active_task set, message printed)."
   - `QE-1: Pre-execution snapshot` — capture `git diff --stat` and changed-file list from HEAD as baseline. Store as in-session `quick_baseline_sha` (`git rev-parse HEAD`).
   - `QE-2: Execute inline` — orchestrator makes the change directly using Read/Edit/Write in the main conversation. No `do-executioner` spawn. Prompt-level instruction; no command to run.
   - `QE-3: Capture round-1 diff` — `git diff <quick_baseline_sha>` to produce the round-1 diff. Store as in-session `quick_diff_r1`.
   - `QE-4: Run validation` — reuse the exact detection logic from `stage-fast-exec.md` FE-5 (`node -e` package.json scan for lint/typecheck/format/test + prettier + __tests__ proximity check). Copy the block verbatim; factor out later if a third consumer appears. Store results in in-session `quick_validation`.
   - `QE-5: Write transient task file for council` — write `.do/tasks/.quick-transient.md` containing: description, `quick_diff_r1`, validation results, a header tag `"quick-path transient — do not resume"`. Rationale: `do-council-reviewer` + `council-invoke.cjs` contract is "read task file"; changing that agent's contract is out of scope. Dot-prefix avoids colliding with real task slugs. (See Concerns for glob-exclusion check.)
   - `QE-6: Spawn round-1 council review` — invoke `do-council-reviewer` with `--type code` pointing at `.do/tasks/.quick-transient.md`. Capture the returned verdict and findings as `quick_council_r1`.
   - `QE-7: Interpret verdict`
     - APPROVED or NITPICKS_ONLY → proceed to QE-13 (happy-path completion).
     - CHANGES_REQUESTED → proceed to QE-8 (inline fix round).
   - `QE-8: Apply round-1 fix inline` — orchestrator reads the round-1 findings from `quick_council_r1` and applies the requested changes directly via Read/Edit/Write. Prompt-level instruction only.
   - `QE-9: Capture round-2 diff` — `git diff <quick_baseline_sha>` again. Store as in-session `quick_diff_r2`. Also capture round-1-to-round-2 delta `git diff` (r1 HEAD → current) for escalation fidelity.
   - `QE-10: Update transient for round-2 council` — overwrite `.do/tasks/.quick-transient.md` with updated diff, validation re-run (re-execute QE-4 logic), round-1 findings appended as history, and "round 2 of 2" marker.
   - `QE-11: Spawn round-2 council review` — invoke `do-council-reviewer` again against the transient file. Capture as `quick_council_r2`.
   - `QE-12: Interpret round-2 verdict`
     - APPROVED or NITPICKS_ONLY → proceed to QE-13 (happy-path completion).
     - CHANGES_REQUESTED → proceed to QE-14 (escalation). (One iteration budget exhausted.)
   - `QE-13: Happy-path completion` — delete `.do/tasks/.quick-transient.md`, print a summary to the user (files touched, validation status, verdict), return control. No task file is written.
   - `QE-14: Escalation — capture findings bundle` — assemble in-session bundle of: `quick_diff_r1`, `quick_diff_r2`, round-1-to-round-2 delta, `quick_validation` (both runs), `quick_council_r1` (full findings), `quick_council_r2` (full findings). This is the "escalation fidelity" requirement.
   - `QE-15: Escalation — compose task content` — generate a slug from description (same logic as fast/task); compose Problem Statement (description, 1-3 sentences), Approach (2-4 bullets derived from what was executed inline), Execution Log entry (timestamp, all files changed, round-1 decisions, round-1 fix decisions, both validation runs), Council Review section (both rounds, formatted per existing template).
   - `QE-16: Escalation — write task file` — write the full task file at `.do/tasks/<YYMMDD>-<slug>.md` via `@references/task-template.md`, with frontmatter including: `stage: execution`, `stages.execution: review_pending` (all others `skipped`), `fast_path: true`, `quick_path: true`, `council_review_ran: { plan: skipped, code: true }` (preserves the two-round history — will be flipped to `false` by `/do:continue` when it intentionally re-invokes the full stack).
   - `QE-17: Escalation — mutate config` — update `.do/config.json` to set `active_task` to the new filename (single atomic node script, same pattern as `stage-fast-exec.md` FE-1).
   - `QE-18: Escalation — cleanup transient` — delete `.do/tasks/.quick-transient.md`.
   - `QE-19: Escalation — user message` — print exactly: `"Quick-path review failed twice. The task has been materialized at .do/tasks/<filename> with both council rounds preserved in the Council Review section. Run /do:continue to resume with the full code-review stack (council + code-reviewer in parallel). Do NOT use /do:fast or /do:task — both have active-task guards that will prompt to continue/abandon rather than resume mid-flow."` Stop. Do NOT auto-invoke anything.
   - `QE-20: /skill-creator reminder` — same as fast (only reached on happy-path return, not escalation).

4. **Create `skills/do/quick.md`** (new skill)
   - YAML frontmatter: `name: do:quick`, description explains the tightest tier, argument-hint `"brief description"`, `allowed-tools` same as `/do:fast`
   - "Why this exists" — short paragraph on the bimodal-tier gap (under-reviewed inline vs over-ceremonied fast)
   - "Usage" with 2-3 examples of genuinely-quick mid-conversation tasks (e.g., `/do:quick "add the null-check we just discussed in parseToken"`, `/do:quick "wire the permission guard on the Admin reducer we sketched"`)
   - "Entry criteria" section — documents the 4 criteria from the spec **in prose, not as an interactive checkbox gate**. Matches `fast-entry-declaration` spirit.
   - "Confirmation" — single prompt: "This looks like a quick-path task (1-2 files, mechanical, context already warm). Proceed? [Y/n]". If user hesitates or says no, redirect to `/do:fast`.
   - Step 1: prerequisites (`check-database-entry.cjs --message`)
   - Step 2: active task guard (`task-abandon.cjs check`)
   - Step 3: model config read (same `node -e` block)
   - Step 4: `@references/stage-quick-exec.md`
   - Files section at bottom

5. **Add Step 0 routing to `skills/do/task.md`**
   - Insert a new section between "Workflow" and "Step 1: Check Prerequisites" titled `## Step 0: Smart Routing`
   - Header note: "Manual entry via `/do:quick` or `/do:fast` skips this step entirely. This router chooses only between `fast` and the full task pipeline — `/do:quick` is manual-only and never auto-recommended here."
   - Heuristic assessment block (prose, prompt-level — no new script):
     1. **File scope estimate** — use a couple of `Grep` or `Glob` calls only if the description mentions specific filenames or components; otherwise rate as "unclear". Target buckets: 1-3 files / 3+ files / unclear.
     2. **Mechanical-vs-planning signal** — yes/no judgment: can the change be described in 1-2 sentences without branching decisions? Presence of "and", "also", "plus" ≥ 2 times → planning; presence of comparative decisions ("either X or Y") → planning.
     3. **Confidence score** — 0.0-1.0 scalar mirroring `/jira:start` Step 8. Include the same considerations (business logic clarity, affected files known, edge-case risk). Store as in-session variable; do NOT write to a task file (no task file exists yet).
   - Decision matrix (in table form in the skill):
     | Files | Mechanical | Confidence | Recommend |
     |-------|------------|------------|-----------|
     | 1-3 | yes | ≥ 0.8 | `fast` |
     | any | no | any | `task` |
     | any | any | < 0.8 | `task` (router honesty — default to full when unsure) |
     | unclear | any | any | `task` |
   - Present assessment block (prose format — "## Routing assessment" with task, assessment, recommended, prompt); the prompt enumerates only `fast` and `task` choices.
   - Prompt user with `AskUserQuestion` offering two choices: `fast` / `task`, with recommended as default.
   - Branch on user choice:
     - `fast` → run Step 1-3 (prereq, active task, model config), then `@references/stage-fast-exec.md` with `<description>` and `models` passed as in-session variables per the caller-contract preamble; STOP (do not fall through to Step 4).
     - `task` → continue normally to Step 1 (which already runs) → Step 4 creates the task file → full pipeline.
   - Note: "If the user wants the quick tier, they should invoke `/do:quick "description"` directly — the router does not auto-route there (see design consideration: vibes-based criteria)."
   - **Important:** the existing Steps 1-12 remain for the `task` branch. The router just precedes them and early-exits for `fast`. No double task files because: fast path's reference writes one at its FE-1; full path writes one at task.md's Step 4 — each path writes at most once, in its own lifecycle.

6. **Update `skills/do/do.md`** (top-level router)
   - Commands table: rename `/do:fast` description to mention it's the mid tier, add `/do:quick` row for the tightest tier
   - Add routing examples for quick phrasing: "the null check we discussed", "same one-liner fix as before", "wire the guard we sketched" → `/do:quick`
   - Update the "Routing note for `/do:fast`" paragraph to mention `/do:task` is the smart-routing default and `/do:quick`/`/do:fast` are explicit-skip-router manual entries
   - Mention that ambiguous intent still goes to `/do:task` (which does its own tier selection internally)

7. **Update `README.md`**
   - "Quick Start" section: rewrite the fast-path paragraph to present three tiers (one smart router + two explicit skip-router tiers). Add a sentence: "Use `/do:quick` for mid-conversation follow-ups where context is already warm and the change is 1-2 files of mechanical work — a single council voice reviews the diff in place."
   - Commands table: add `/do:quick` row, keep `/do:fast` but clarify it's the middle tier
   - Features / agent pipeline section: no structural change needed (council-reviewer already listed)

8. **`AGENTS.md` scope question — resolve**
   - Project has no local `AGENTS.md`. The workspace-level `~/workspace/AGENTS.md` is out of scope (lives outside this package; user edits it separately; not included in the npm package).
   - Resolution: no AGENTS.md change in this task. Note in completion message that the workspace-level file may want updating by the user.

9. **Update `skills/do/continue.md` Step 6 routing to handle quick-path escalation**
   - Extend the Step 2 extraction script to also read `quick_path` from the frontmatter alongside `fast_path`.
   - Extend the "Fast-path guard" check: `fast_path === true` enters the fast-path branch as today; within that branch, discriminate by `quick_path`.
   - Add a new row to the Fast-path routing table:
     | Stage | Sub-condition | Action |
     | `execution` | `stages.execution: review_pending` AND `quick_path: true` | Run **full code-review stack** (council + do-code-reviewer in parallel) via `@references/stage-code-review.md` — NOT the single-reviewer fast-code-review round. |
   - Add a new subsection titled "Quick-path escalation resume" immediately after the "Fast code review round" block:
     - Before invoking `@references/stage-code-review.md`, flip `council_review_ran.code` from `true` back to `false` in the task file. Rationale: the flag was set to `true` at escalation time to preserve the two-round history as "done by quick-path tier", but the whole point of escalation is to re-run with the wider tier. The CR-0 resume guard in `stage-code-review.md` checks this flag and would skip the review otherwise.
     - Do NOT delete the existing Council Review section — it contains both round-1 and round-2 findings from quick-path, preserved as history. `stage-code-review.md` appends new findings; it does not overwrite.
     - After `stage-code-review.md` returns:
       - VERIFIED → mark `council_review_ran.code: true`, set `stage: verification`, spawn do-verifier (same as the normal fast-path post-review).
       - ITERATE → stage-code-review.md owns the loop (CR-5). Do NOT handle manually.
       - MAX_ITERATIONS → show to user, stop (same as normal flow).
   - Retain the existing fast-code-review single-reviewer row for `fast_path: true` + `quick_path: false`/absent.
   - Grep `continue.md` for any other references to `fast_path` to ensure the discriminator is consistently applied.

10. **Post-implementation reminders**
    - Print the `/skill-creator` reminder at end of implementation (per project CLAUDE.md — skill files are being created/heavily edited).
    - Print the README accuracy check reminder (per project CLAUDE.md post-task rule).

<!--
Refine agent's analysis of how to solve this task.
Include: proposed solution, implementation steps, files to modify.
-->

## Concerns

- **Transient task file for council review (QE-5).** `do-council-reviewer` and `council-invoke.cjs` both require a task-file path — the council script reads the file to build its prompt. Quick-path has no task file on the happy path. Mitigation: write a sentinel `.do/tasks/.quick-transient.md` (dot-prefixed so it doesn't collide with real task slugs) containing description + diff + validation results, pass it to the council, then delete it. The cost is one extra file write + delete per quick-path invocation. Alternative rejected: changing `do-council-reviewer` to accept inline context would require modifying `council-invoke.cjs` and the agent — out of scope. **Open question for reviewer/executioner:** confirm the dot-prefix convention doesn't break any glob-based task enumeration in `task-abandon.cjs check` or `/do:continue`. If it does, fall back to a non-dot name like `.do/tasks/_quick_transient.md` plus explicit exclusion in those scripts.

- **Router heuristics are prompt-level judgment ("vibes") — RESOLVED.** Addressed in iteration 1 by removing `quick` from router recommendations (manual-only tier). The router now only decides between `fast` and `task`, a narrower binary judgment. The "Router honesty" rule still applies: default to `task` (full) when signals are ambiguous.

- **Escalation fidelity — diff capture timing.** QE-14 assembles the escalation bundle. Both round-1 diff (captured at QE-3) and round-2 diff (captured at QE-9) are preserved, plus the round-1-to-round-2 delta. Both validation runs are captured. Both council findings are preserved in the Council Review section. This directly addresses the "escalation fidelity" design consideration.

- **Escalation resume path contract — RESOLVED.** Addressed in iteration 1. The escalated task file now carries `quick_path: true` as a discriminator, `council_review_ran.code: true` (preserving history — flipped to `false` by continue.md before re-invoking the full stack), and the user is directed to `/do:continue` (not `/do:fast` or `/do:task`, both of which have active-task guards). `skills/do/continue.md` Step 6 gains a new routing row that recognises `quick_path: true` + `review_pending` and invokes the full code-review stack (`@references/stage-code-review.md`) rather than the single-reviewer fast round. This avoids both (a) the active-task-guard roadblock and (b) the "same tier that failed twice runs a third time" anti-pattern.

- **Parameter passing across `@references` boundary — RESOLVED.** Addressed in iteration 1 via an explicit caller-contract preamble at the top of both `stage-fast-exec.md` and `stage-quick-exec.md`: `<description>` and `models` are passed as in-session variables substituted at include time. No scratch files, no config-based handoff. The preamble is stated once per reference file and referenced from the Approach architecture-decisions section.

- **QE-5..QE-7 atomicity — RESOLVED.** Addressed in iteration 1. The previous triple-step block has been split into QE-5 through QE-20, each with a single atomic action: transient-file write, council spawn round-1, verdict interpretation, inline fix, round-2 diff capture, transient update, council spawn round-2, round-2 verdict interpretation, happy-path completion, and the 6 escalation sub-steps (bundle assembly, content composition, task file write, config mutation, transient cleanup, user message). Executor ordering is now unambiguous.

- **No-double-task-files invariant.** If `/do:task` routes to `fast`, task.md Step 0 must NOT fall through to Step 4 (which also writes a task file). Mitigation: explicit STOP after the reference include, documented in the skill. Reviewer should verify the control flow isn't accidentally chained. (Simplified: router only chooses `fast` or `task` now; `quick` is not reachable from this router, removing one branch.)

- **Fast-path extraction — preserving numbered cross-references.** The existing `fast.md` Step 7 mentions "re-run Step 7" in its logic (CHANGES_REQUESTED re-exec loop re-overrides the stage). When those steps move into `stage-fast-exec.md` and get renamed to `FE-N`, all internal cross-references must be updated. Mitigation: grep for "Step N" within the extracted block before committing and rewrite to `FE-N`. Also check if `continue.md` Step 6 fast-code-review-round section cites any "Step N from fast.md" — if so, update to cite the reference file instead.

- **New — continue.md routing regression risk.** Extending continue.md Step 6 to discriminate on `quick_path` must not break existing fast-path-only resume flows. Mitigation: the new row is guarded on `quick_path: true`; the existing `fast_path: true` + `quick_path` absent/false row is preserved verbatim. Add an integration-level check during implementation: resume an existing fast-path task (without `quick_path`) to confirm it still hits the single-reviewer branch.

- **New — `council_review_ran.code` flag semantics shift.** This plan introduces a subtle double-meaning: in the escalated quick-path task file, `council_review_ran.code: true` initially means "the two quick-path council rounds ran" (history), but continue.md flips it to `false` before invoking the full stack. Mitigation: document this flip explicitly in continue.md's quick-path subsection with a one-line comment. Executor must not skip the flip — the CR-0 resume guard would otherwise bypass the full review. Reviewer should flag if the flip is missing.

- **New — `quick_path` discriminator must be added to task-template.md frontmatter docs.** The task template reference file should document `quick_path: true | false | absent` as a known optional frontmatter field so future readers know it's not a typo. Add a one-liner in `@references/task-template.md`'s frontmatter section alongside `fast_path`. This is an implementation detail, captured here so the executioner includes it.

- **Backlog tracking on quick-path.** Spec explicitly accepts this as a known limitation: no task file on happy path means no `backlog_item` field to carry through. Mitigation: doc the limitation in `quick.md`'s "Why this exists" section and mention that `/do:backlog done <id>` must be called manually if the quick-path run closes a backlog item. Do not silently materialize a task file just for backlog tracking.

- **Router's confidence calculation vs planner's.** task.md's Step 0 uses the `/jira:start` Step 8 single-scalar 0.9 gate. The full `/do:task` pipeline (Step 7) uses `do-planner`'s 4-factor confidence (context/scope/complexity/familiarity) against `auto_grill_threshold`. These are two different confidence mechanisms. Mitigation: explicit in the router's prompt text that Step 0's confidence is a routing heuristic only — if routed to full, the planner runs its own calculation which supersedes. Include a comment in the skill to prevent future confusion.

- **ctx7 not needed.** Task is entirely about skill/reference editing and prompt-level routing — no external libraries involved. Skip ctx7 research (done).

- **AGENTS.md scope.** Project has no local AGENTS.md. Workspace-level `~/workspace/AGENTS.md` documents `/do:task` and `/do:fast` but is outside this package. Mitigation: exclude from this task's scope; note in completion that the user may want to update the workspace-level file separately.

- **README "Agent Pipeline" diagram.** The README's full-task flow diagram is accurate for the full tier but doesn't show fast/quick. Mitigation: leave the diagram as-is (it specifically describes `/do:task`'s pipeline) and add a separate short table or paragraph explaining the three tiers without a diagram. Over-diagramming three parallel flows would bloat the README.

<!--
Potential issues, uncertainties, or risks identified during refinement.
Format:
- Concern 1: description and potential mitigation
- Concern 2: description and potential mitigation

If no concerns, note: "None identified."
-->

## Review Iterations

### Iteration 1
- **Self-review:** CONCERNS
  - Feasibility: `continue.md` escalation contract mismatch — plan claims no change needed, but `continue.md` Step 6 fast-path routing hard-codes `do-code-reviewer` spawn for `review_pending`, not council. Escalated quick task resumes into wrong review machinery.
  - Completeness: After escalation, `council_review_ran.code` remains `false` so `/do:continue` runs a third review cycle, discarding the two council rounds already captured in the Execution Log.
  - Completeness: No parameter-passing spec for `<description>` across the `@references/stage-*-exec.md` include boundary when dispatched from `task.md` router.
  - Atomicity: QE-5 through QE-7 bundle ~8 distinct actions (write transient, spawn council, parse verdict, branch, inline-fix, re-spawn, assemble escalation, mutate config) — ordering ambiguity for executor.
- **Council (codex):** CONCERNS
  - Escalation resume path broken: `/do:fast` and `/do:task` both have active-task guards that block resume; `/do:continue` with `fast_path: true` + `review_pending` runs `do-code-reviewer` only, not council. User-facing escalation message should point to `/do:continue`, not `/do:fast` / `/do:task`.
  - Routing design internally contradictory: design considerations say `/do:quick` is "manual-invoke-only" and "don't try to auto-route," but proposed Step 0 router auto-recommends it.
- **Changes made:** (1) Fixed escalation resume contract: added `quick_path: true` discriminator to escalated task frontmatter; directed user-facing escalation message to `/do:continue` (not `/do:fast`/`/do:task` which have active-task guards); added a new row to `continue.md` Step 6 fast-path routing that recognises `quick_path: true` + `review_pending` and invokes the full code-review stack (`@references/stage-code-review.md`) rather than the single-reviewer fast round; preserved council findings by setting `council_review_ran.code: true` at escalation time and having continue.md flip it to `false` before the wider re-review. (2) Resolved routing contradiction by making the `/do:task` Step 0 router a binary `fast`-vs-`task` decision only — `/do:quick` is manual-only, never auto-recommended; updated the design-considerations "Router honesty" note to match and dropped the `quick` row from the decision matrix. (3) Documented parameter-passing convention: both reference files open with an explicit caller-contract preamble stating `<description>` and `models` are passed as in-session variables at include time. (4) Split the bundled QE-5..QE-7 block into 16 atomic sub-steps (QE-5..QE-20) covering transient write, two council spawns, two verdict-interpretation steps, inline fix, diff captures, and the 6 escalation sub-steps (bundle, compose, write task file, mutate config, cleanup transient, user message). Added three new concerns: continue.md routing regression risk, the `council_review_ran.code` flag flip semantics, and the need to document `quick_path` in `task-template.md`. Confidence unchanged at 0.65 — scope net-identical (one new routing row in continue.md roughly offsets the simpler binary router).

### Iteration 2
- **Self-review:** PASS — all 5 criteria met; 4 prior CONCERNS genuinely resolved; 3 new concerns have adequate mitigations; feasibility verified against `continue.md`, `fast.md`, `do-council-reviewer.md`, `task-abandon.cjs`, and `stage-code-review.md`.
- **Council (gemini):** LOOKS_GOOD — escalation/resume path robustly designed; `stage-fast-exec.md` reuse is sound; Concerns section thorough. Single recommendation: during implementation, verify the `.quick-transient.md` sentinel doesn't trip task enumeration elsewhere.
- **Combined verdict:** APPROVED. Plan review complete.

## Execution Log

### 2026-04-16 18:00 - Execution started
**Status:** Complete
**Steps:** 10/10 complete

**Pre-execution checks:**
- `task-abandon.cjs` confirmed safe: only reads `active_task` from config by exact path, no glob enumeration
- `project-health.cjs` only checks if `.do/tasks/` folder exists (no file glob)
- Transient dot-prefix `.do/tasks/.quick-transient.md` is safe to use

### 2026-04-16 18:30 - Steps 1-10 Complete
**Files:**
- `skills/do/references/stage-fast-exec.md` — created; Steps 4-11 from fast.md extracted and renamed FE-1 through FE-8
- `skills/do/fast.md` — rewritten; Steps 4-11 replaced with `@references/stage-fast-exec.md` delegate; Step 3b (model config read) added explicitly
- `skills/do/references/stage-quick-exec.md` — created; 20 atomic steps QE-0 through QE-20 covering inline execution, two council rounds, escalation path
- `skills/do/quick.md` — created; new skill with confirmation prompt, 4 prose entry criteria, Steps 1-4 including `@references/stage-quick-exec.md` delegate
- `skills/do/task.md` — Step 0 Smart Routing block added; binary fast/task router with heuristic assessment, decision matrix, and STOP guard after fast-path to prevent double task files
- `skills/do/do.md` — sub-commands table updated with `/do:quick` row; routing examples added for quick phrasing; routing note updated to explain three-tier structure
- `README.md` — three-tier rewrite of "Run a task" section; commands table updated with `/do:quick` row
- `skills/do/continue.md` — Step 6 fast-path guard updated to extract `quick_path`; new routing row for `quick_path: true` + `review_pending`; Quick-path escalation resume subsection added with `council_review_ran.code` flip logic
- `skills/do/references/task-template.md` — `fast_path` and `quick_path` documented as optional frontmatter fields with full semantics

**Decisions:**
- Step 8 (AGENTS.md): No local AGENTS.md in repo; workspace-level `~/workspace/AGENTS.md` is out of scope per plan. No change made.
- `fast.md` escalation wording: plan said "auto-escalation during execution (Steps 6-8)" but those step numbers no longer exist after refactor; updated to say "during execution" without step numbers.
- `continue.md` stage override: set `stages.execution: 'complete'` alongside flipping `council_review_ran.code: false` so `stage-code-review.md` is invoked via its normal entry condition (execution complete → code review).

**Deviations:** 1 minor (fast.md escalation step-number references removed; step numbers no longer valid after refactor)

**Status:** Execution complete

**Summary:**
- Files modified: 9
- Decisions made: 3
- Deviations: 1 minor

## Council Review

### Plan Review
- **Iteration 1:** Self = CONCERNS, Council (codex) = CONCERNS → ITERATE (revised)
- **Iteration 2:** Self = PASS, Council (gemini) = LOOKS_GOOD → **APPROVED**
- See `## Review Iterations` above for full findings.

### Code Review
- **Self-review (do-code-reviewer):** NITPICKS_ONLY — 3 non-blocking issues, all fixed inline before verifier handoff:
  1. `skills/do/continue.md:131` — stale cross-reference to "Step 9 of fast.md"; fixed to point at `FE-6` in `@references/stage-fast-exec.md`.
  2. `skills/do/task.md:104` — "Run Steps 1-3b" referenced a nonexistent step 3b; reworded to "Run Steps 1-3 below … Skip Step 4".
  3. `skills/do/continue.md:163` — redundant state-mutation instructions that duplicated what `stage-code-review.md` CR-5 already does; rewritten to delegate to CR-5.
- **Council (gemini):** APPROVED — "implementation shows excellent fidelity to the plan; all 9 files correctly updated; escalation path implemented as designed. No recommendations."
- **Combined:** VERIFIED (log nitpicks, no iteration needed).

## Verification Results

### Approach Checklist
- [x] 1. Created `skills/do/references/stage-fast-exec.md` — Steps 4-11 from fast.md extracted, renamed FE-1 through FE-8, caller-contract preamble added
- [x] 2. Rewrote `skills/do/fast.md` — Steps 4-11 replaced with `@references/stage-fast-exec.md` delegate; Step 3b (model config read) added explicitly
- [x] 3. Created `skills/do/references/stage-quick-exec.md` — 20 atomic steps QE-0 through QE-20 covering inline execution, two council rounds, escalation path
- [x] 4. Created `skills/do/quick.md` — new skill with confirmation prompt, 4 prose entry criteria, Steps 1-4 including `@references/stage-quick-exec.md` delegate
- [x] 5. Added Step 0 Smart Routing to `skills/do/task.md` — binary fast/task router with heuristic assessment, decision matrix, STOP guard after fast-path
- [x] 6. Updated `skills/do/do.md` — sub-commands table with `/do:quick` row, routing examples for quick phrasing, three-tier routing note
- [x] 7. Updated `README.md` — three-tier rewrite of "Run a task" section, `/do:quick` row in commands table
- [x] 8. No local AGENTS.md — workspace-level file excluded from scope per plan
- [x] 9. Updated `skills/do/continue.md` — Step 6 fast-path guard reads `quick_path`, new routing row for `quick_path: true` + `review_pending`, Quick-path escalation resume subsection with `council_review_ran.code` flip logic
- [x] Code-review nitpick 1: `continue.md:131` references `FE-6` in `stage-fast-exec.md` (not "Step 9 of fast.md")
- [x] Code-review nitpick 2: `task.md:104` says "Run Steps 1-3 below ... Skip Step 4" (not "Run Steps 1-3b")
- [x] Code-review nitpick 3: `continue.md:163` VERIFIED branch delegates to `stage-code-review.md` CR-5 (no duplicate state mutations)
- [x] `skills/do/references/task-template.md` — `fast_path` and `quick_path` documented as optional frontmatter fields with full semantics

### Quality Checks
- **Tests:** PASS (npm test) — 162/162 passing

No lint or typecheck scripts in package.json.

### Result: PASS
- Checklist: 13/13 complete
- Quality: 1/1 passing

### UAT
Generated checklist:
1. [ ] `/do:quick` happy path — invoke skill, confirm prompt, execute inline, council returns APPROVED or NITPICKS_ONLY, summary printed, no task file written
2. [ ] `/do:quick` escalation path — council returns CHANGES_REQUESTED twice; task file materialized at `.do/tasks/<slug>.md` with `fast_path: true`, `quick_path: true`, `council_review_ran.code: true`; escalation message printed directing to `/do:continue`
3. [ ] `/do:task` Step 0 router — router recommends `fast` for a 1-3 file mechanical task with confidence ≥ 0.8
4. [ ] `/do:task` Step 0 router — router recommends `task` for a vague or multi-concern description (router honesty)
5. [ ] `/do:fast` unchanged behavior — entry criteria check still works, delegates to `@references/stage-fast-exec.md` after Step 3b without regression
6. [ ] `/do:continue` quick-path escalation resume — task with `quick_path: true` + `stages.execution: review_pending` triggers `council_review_ran.code` flip to `false` and invokes full code-review stack
7. [ ] `task-template.md` — `quick_path` field documented in frontmatter comments, visible alongside `fast_path`

User response: yes — all 7 UAT items confirmed on 2026-04-18

## Remaining Actions

1. **`/skill-creator` review** — 4 new/heavily-edited skill files need polish:
   - `skills/do/quick.md` (new)
   - `skills/do/references/stage-quick-exec.md` (new)
   - `skills/do/references/stage-fast-exec.md` (new)
   - `skills/do/fast.md` (rewritten)
   - `skills/do/task.md` (Step 0 added)
   - `skills/do/do.md` (routing examples added)
   - `skills/do/continue.md` (quick-path escalation route added)
2. **Backlog cleanup** — remove `do-quick-skill` from `.do/BACKLOG.md` `## Ideas` section
3. **Workspace AGENTS.md** — optionally update `~/workspace/AGENTS.md` to document the three-tier model
4. **Commit & release** — bump version in package.json, commit, tag, publish
5. **`project.md` update** — update `~/workspace/database/projects/do/project.md` (version, features section, fast-path flow diagram)
