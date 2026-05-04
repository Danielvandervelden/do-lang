---
name: stage-phase-plan-review
description: "Phase plan review block for /do:project. Council gate check, parallel reviewer spawning (when enabled), verdict combination, iteration loop via codex-planner, wave-seeding hook, and escalation rules. Target file: phase.md."
---

# Phase Plan Review Stage

This reference file is loaded by `skills/codex/project.md` when a phase enters planning (after `phase new` or after the per-phase re-grill). It encodes the full plan review logic for `phase.md` including wave-seeding on approval.

**Caller contract:** The caller provides `<phase_path>` = abs path to `phase.md`, `<active_project>` slug, and `<phase_slug>`. When this stage returns APPROVED, up to five writes have landed: (1) `council_review_ran.plan: true` in `phase.md`'s frontmatter, (2) all in-scope wave folders seeded via `project-scaffold.cjs wave`, (3) **idempotent project-level promotion** `project: planning → in_progress` via `project-state.cjs set project ... status=in_progress` IFF `project.md.status === 'planning'` (skipped on subsequent phase approvals since it's already `in_progress`), (4) phase `status: planning → in_progress` via `project-state.cjs set phase ... status=in_progress`, and (5) `active_phase: <phase_slug>` set atomically on `project.md`. Write (3) is the single authoritative project activation point — without it `/do:project complete` would hard-fail because α's state machine only allows `project: in_progress → completed`. Return control to caller. If ESCALATE or MAX_ITERATIONS, stop and present to the user.

**Non-hijack skip path (iter 11/12):** If another phase already owns `project.md.active_phase` when this stage runs (triggered by `/do:project phase new` planning a future phase during an in-progress phase), PR-5 step 1's guard is the FIRST step in the APPROVED branch and exits immediately — NONE of writes (1)-(5) land (including `council_review_ran.plan` and wave seeding). All writes are deferred until `/do:project phase complete` on the currently-active phase later clears `active_phase` and re-invokes this stage for the now-becoming-active phase. On re-entry: PR-0's resume guard passes (flag still false), review re-runs idempotently, the non-hijack guard passes (pointer is null after phase-complete cleared it), and writes (1)-(5) land. The cost is one redundant review pass per deferred phase.

---

## PR-0: Resume Guard

Check if phase plan review already ran:

```bash
node ~/.codex/skills/do/scripts/update-task-frontmatter.cjs check '<phase_path>' council_review_ran.plan
```

**If already ran (exit 1):** Skip this entire stage. Return control to caller immediately.

---

## PR-1: Council Gate Check

```bash
node ~/.codex/skills/do/scripts/council-gate.cjs project.phase_plan planning
```

Store result as `council_enabled` (enabled/disabled).

---

## PR-2: Initialize Iteration Counter

Set `review_iterations = 0` (in-session variable, not persisted).

---

## PR-2b: Initial Plan Curation (idempotent)

Check if `phase.md` body still contains scaffold placeholders:

```bash
node ~/.codex/skills/do/scripts/update-task-frontmatter.cjs read-body '<phase_path>' | grep -q '{{[A-Z_]*}}'
# exit 0 = placeholders found, exit 1 = no placeholders
```

**If no placeholders (exit 1):** Skip to PR-3 — body is already curated (manual edit, re-entry, or `--from-backlog` already filled all sections).

**If placeholders remain (exit 0):** Spawn codex-planner to curate the phase body from project context before reviewers see it:

Spawn the codex-planner subagent with model `<models.overrides.planner || models.default>` and the description "Curate phase plan from project context". Pass the following prompt:

Curate the phase plan body sections from the project context.

Target file: <phase_path>
Project file: .do/projects/<active_project>/project.md

Read the project's Vision, Phase Plan, and any existing Goal content in the target file
(may be pre-seeded from a backlog entry via --from-backlog). Fill in the phase body sections:

- Replace `# {{TITLE}}` H1 with a descriptive phase title
- ## Goal — what this phase accomplishes (one paragraph; preserve existing content if non-placeholder)
- ## Entry Criteria — what must be true before this phase starts (bullet list)
- ## Exit Criteria — what must be true for completion (bullet list)
- ## Wave Plan — ordered list of waves (format: Wave NN — <slug>: <one-line goal>)
- ## Concerns — potential blockers or risks (numbered list)

Write the phase title to frontmatter field `title`.
Calculate confidence and write to frontmatter.
Do NOT change status, scope, or other metadata fields.

Return summary of sections populated.

**Wait for codex-planner to complete before proceeding to PR-3.** Reviewers must see curated content, not scaffold placeholders — sending reviewers against a template with `{{GOAL}}` / `{{WAVE_PLAN}}` markers would cause an automatic RETHINK verdict on every first pass.

---

## PR-3: Spawn Reviewers

### PR-3a: If council enabled

In a single response, spawn BOTH of the following subagents (parallel dispatch — do NOT wait between them):

Spawn the codex-plan-reviewer subagent with model `<models.overrides.plan_reviewer || models.default>` and the description "Self-review phase plan". Pass the following prompt:

Review the phase plan in this target file.

Target file: <phase_path>

Read the target file, evaluate the phase plan against the 5 criteria
(Clarity, Completeness, Feasibility, Atomicity, Risks), and return PASS,
CONCERNS, or RETHINK with evidence. Focus on: goal clarity, wave list
feasibility (soft cap: >10 files or confidence <0.5 → split or promote),
acceptance criteria measurability, dependency risks.

Spawn the codex-council-reviewer subagent with model `<models.overrides.plan_reviewer || models.default>` and the description "Council review phase plan". Pass the following prompt:

Run council review for this phase plan.

Target file: <phase_path>
Review type: plan
Workspace: <pwd>

Run council-invoke.cjs --type plan --task-file "<phase_path>" --workspace "<pwd>"
and return the structured verdict.

Wait for BOTH subagents to complete before proceeding to PR-4.

### PR-3b: If council disabled

Spawn the codex-plan-reviewer subagent with model `<models.overrides.plan_reviewer || models.default>` and the description "Self-review phase plan (council disabled)". Pass the following prompt:

Review the phase plan in this target file.

Target file: <phase_path>

Read the target file, evaluate the phase plan against the 5 criteria
(Clarity, Completeness, Feasibility, Atomicity, Risks), and return PASS,
CONCERNS, or RETHINK with evidence.

Apply single-review fallback in PR-4b (skip PR-4a).

---

## PR-4: Combine Verdicts

### PR-4a: Two-reviewer combination (council enabled)

| Self-Review | Council | Combined |
|-------------|---------|----------|
| PASS | LOOKS_GOOD | **APPROVED** |
| PASS | CONCERNS | **ITERATE** |
| PASS | RETHINK | **ITERATE** |
| CONCERNS | LOOKS_GOOD | **ITERATE** |
| CONCERNS | CONCERNS | **ITERATE** |
| CONCERNS | RETHINK | **ESCALATE** |
| RETHINK | any | **ESCALATE** |

### PR-4b: Single-reviewer fallback (council disabled)

| Self-Review | Combined |
|-------------|----------|
| PASS | **APPROVED** |
| CONCERNS | **ITERATE** |
| RETHINK | **ESCALATE** |

---

## PR-5: Handle Combined Verdict

### If APPROVED

1. **Phase-pointer non-hijack guard (FIRST — gates all subsequent writes):** This must be the very first step so that none of writes 2-6 leak onto a future phase whose promotion is deferred. Read `project.md.active_phase`. If another phase is already active (`active_phase` is set to a different, non-null slug), this plan-review was triggered by `/do:project phase new` during an in-progress phase (planning a future phase while the current one is still active). In that case log to changelog, `exit 0`, and let `/do:project phase complete` on the currently-active phase be what re-invokes this stage for the now-becoming-active phase. On re-entry: PR-0 passes (flag still false because we wrote nothing), review re-runs idempotently, this guard passes (pointer is null after phase-complete cleared it), and steps 2-7 land. Cost: one redundant review pass per deferred phase. Benefit: no state leaks and no complex resume guard.

   ```bash
   CURRENT_ACTIVE_PHASE=$(node ~/.codex/skills/do/scripts/update-task-frontmatter.cjs read '.do/projects/<active_project>/project.md' active_phase | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).active_phase || '')")

   if [ -n "$CURRENT_ACTIVE_PHASE" ] && [ "$CURRENT_ACTIVE_PHASE" != "<phase_slug>" ]; then
     # Another phase is currently active — this is a future-phase-plan-review
     # from `phase new` during an in-progress phase. Skip ALL subsequent writes
     # (including council_review_ran.plan, wave seeding, project+phase promotion,
     # active_phase pointer). Waves will be seeded when phase-complete re-invokes.
     echo "$(date -Iseconds) plan-approved-for-future-phase:<phase_slug>  active_phase=$CURRENT_ACTIVE_PHASE remains (no hijack; all writes deferred until phase-complete re-invokes stage)" \
       >> .do/projects/<active_project>/changelog.md
     # Return control to caller without executing steps 2-7.
     exit 0
   fi
   # Else: active_phase is null (first phase approval, or phase-complete just cleared it)
   # or equals <phase_slug> (idempotent re-approval on the currently-owned phase).
   # Proceed to steps 2-7.
   ```

2. Update `phase.md` frontmatter:
   ```yaml
   council_review_ran:
     plan: true
   ```

3. **Wave-seeding hook (§6 step 1a):** for each wave listed in `phase.md`'s `## Wave Plan` section (or `waves[]` frontmatter), call `project-scaffold.cjs wave` to create the wave folder and `wave.md` if it does not already exist:
   ```bash
   # For each wave slug in the phase plan:
   node ~/.codex/skills/do/scripts/project-scaffold.cjs wave <active_project> <phase_slug> <wave_slug>
   ```
   Skip any wave that already has a folder. Append changelog entry per wave seeded.

4. **Promote project to `in_progress` (first-phase-approval gate, idempotent):** read `project.md` status. If it is still `planning`, promote it now — this is the single authoritative place the project transitions out of `planning`, without which `/do:project complete` will hard-fail later (α's state machine only allows `project: in_progress → completed`). On the 2nd, 3rd, Nth phase approval the project is already `in_progress`, so this step **must be a true shell no-op** (exit 0, no promotion call, no changelog write).

   ```bash
   CURRENT_STATUS=$(node ~/.codex/skills/do/scripts/update-task-frontmatter.cjs read '.do/projects/<active_project>/project.md' status | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).status || '')")

   if [ "$CURRENT_STATUS" = "planning" ]; then
     node ~/.codex/skills/do/scripts/project-state.cjs set project <active_project> status=in_progress
     # Append changelog ONLY when the transition fired:
     echo "$(date -Iseconds) status-change:project:<active_project>: planning -> in_progress (reason: first phase approved — stage-phase-plan-review)" \
       >> .do/projects/<active_project>/changelog.md
   fi
   # Any other status: silent no-op. Exit 0 regardless — do NOT use && chaining,
   # which would propagate the skip-path as a shell failure and break non-first
   # phase approvals.
   ```

5. **Promote phase to `in_progress` (planning → in_progress gate):** now that the plan is approved, the in-scope wave folders are seeded, AND the phase-pointer guard confirmed no other phase currently owns the pointer, transition the phase status so execution can begin:
   ```bash
   node ~/.codex/skills/do/scripts/project-state.cjs set phase <phase_slug> status=in_progress --project <active_project>
   ```
   This satisfies the `/do:project phase complete` and `/do:project wave next` contracts in `skills/codex/project.md`, which both rely on this stage reference to perform the `planning → in_progress` transition after plan approval. Append changelog:
   ```
   <ISO> status-change:phase:<phase_slug>: planning -> in_progress (stage-phase-plan-review approved)
   ```

6. **Activate phase pointer on project.md:** `/do:project wave new` and `/do:project wave next` both read `active_phase` from `project.md` to know which phase to target. After this approval is the moment that pointer becomes authoritative. Atomic temp-file + rename on `project.md`:
   ```bash
   node ~/.codex/skills/do/scripts/update-task-frontmatter.cjs set '.do/projects/<active_project>/project.md' 'active_phase=<phase_slug>'
   ```
   Append changelog:
   ```
   <ISO> activate:active_phase:project:<active_project>  phase:<phase_slug>  reason: stage-phase-plan-review approved
   ```
   This closes the otherwise-silent gap where `project-scaffold.cjs project` initialises `active_phase: null` and no earlier step in the phase new → plan review flow sets it. Without this write, `wave new` and `wave next` would find `active_phase: null` and fail.

7. Return control to caller.

### If ITERATE (and review_iterations < 3)

1. Increment `review_iterations`
2. Compile combined findings
3. Log iteration in `phase.md`:
   ```markdown
   ## Review Iterations

   ### Iteration <N>
   - **Self-review:** <verdict> - <summary>
   - **Council:** <verdict> - <summary> (or "disabled")
   - **Changes made:** (pending — codex-planner will revise)
   ```
4. Spawn codex-planner with reviewer feedback:

   Spawn the codex-planner subagent with model `<models.overrides.planner || models.default>` and the description "Revise phase plan based on review feedback". Pass the following prompt:

   Revise the phase plan based on review feedback.

   Target file: <phase_path>
   Reviewer feedback: <combined findings from self-review and council>

   Update the Goal, Entry Criteria, Exit Criteria, Wave Plan, and/or Concerns
   sections to address the issues. Do not change the phase slug or frontmatter
   metadata (status, scope, project_schema_version, etc.).
   Return a summary of changes made.

5. Wait for codex-planner to complete
6. Update iteration log with "Changes made: <planner summary>"
7. Return to PR-3 and re-spawn reviewers

### If ITERATE (and review_iterations = 3)

```markdown
## PHASE PLAN REVIEW: MAX ITERATIONS

**Iterations:** 3/3
**Status:** Could not resolve all concerns after 3 attempts

### Outstanding Issues
<list remaining concerns from latest reviewer feedback>

### Options
1. Proceed anyway (acknowledge risks)
2. Revise phase plan manually and re-invoke
3. Abandon phase (`/do:project phase abandon <slug>`)
```

Stop and await user decision.

### If ESCALATE

```markdown
## PHASE PLAN REVIEW: NEEDS USER INPUT

**Self-Review:** <verdict>
**Council:** <verdict> (or "disabled")

### Critical Issues
<list the RETHINK-level concerns with evidence>

### Reviewer Recommendations
<list suggestions from reviewers>

User decision required before proceeding.
```

Stop and await user decision.
