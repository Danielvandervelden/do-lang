---
id: 260505-codex-entry-agent-authorizatio
created: "2026-05-05T12:00:00Z"
updated: "2026-05-05T13:24:04.319Z"
description: "Codex entry workflows should explicitly authorize their internal agents — update Codex-facing do workflow and entry-command docs so invoking the workflow explicitly authorizes the named internal do agents. Add authorization language to /do:task, /do:continue, /do:fast, and Jira handoff docs. Add a guardrail: if Codex cannot spawn agents, stop and report instead of falling back to inline execution."
related: []
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
  score: 0.95
  factors: null
  context: 0
  scope: -0.05
  complexity: 0
  familiarity: 0
backlog_item: codex-entry-agent-authorization
---

# Codex Entry Agent Authorization

## Problem Statement

Codex has a platform-level guard on `spawn_agent` that only allows agent spawning when the user's message explicitly asks for subagents, delegation, or parallel agent work. The `/do:task`, `/do:continue`, `/do:fast`, `/do:quick`, and `/do:debug` workflows internally require spawning named agents (codex-planner, codex-plan-reviewer, codex-council-reviewer, codex-griller, codex-executioner, codex-code-reviewer, codex-verifier, codex-debugger), but the skill file docs never state that invoking the workflow constitutes explicit authorization for those agents.

As a result, Codex resolves the conflict by silently falling back to inline implementation -- it says it is taking the normal/full do flow but actually executes everything in the main conversation. This bypasses review gates, skips the structured pipeline, creates partial inline edits, and breaks the command contract. Users have to know magic phrasing ("use subagents", "delegate to agents") to force the intended pipeline.

**What needs to change:**

1. Every Codex entry-point skill file (`task.md`, `continue.md`, `fast.md`, `quick.md`, `debug.md`) needs an explicit authorization preamble that tells Codex: "By invoking this workflow, the user has explicitly authorized spawning the named internal agents listed below."
2. The main router (`do.md`) needs the same authorization language so that routing from `/do` to sub-commands carries the authorization forward.
3. Reference files that spawn agents (`stage-plan-review.md`, `stage-code-review.md`, `stage-fast-exec.md`, `stage-quick-exec.md`) need a matching authorization reminder so Codex sees the authorization at spawn-time, not just at entry-time.
4. A guardrail must be added: if Codex cannot spawn agents (the platform guard blocks it despite the authorization language), the workflow must STOP and report the failure rather than falling back to inline execution.

**Acceptance criteria:**

- Every Codex entry-point skill file contains an "Agent Authorization" section that names every agent the workflow may spawn
- Reference files that perform spawns contain a shorter authorization reminder
- A "No Inline Fallback" guardrail is present in every file that spawns agents, instructing Codex to stop and report if spawning fails rather than executing inline
- The `do.md` router carries authorization language for all sub-commands it may route to
- No changes to Claude Code skill files (only `skills/codex/` and its `references/`)

## Delivery Contract

<!-- Empty — user dismissed onboarding, using project defaults -->

## Clarifications

### Scope (was: -0.13 -> now: -0.05)
**Q:** Should the executor follow strict placement rules for authorization blocks or adapt per-file?
**A:** Adaptive/pragmatic — read each file and place the block where it makes most sense for the agent to see and follow it. It all needs to make sense and be logical.

### Scope (was: -0.13 -> now: -0.05)
**Q:** How much of the stage-execute.md E4 fallback language to preserve vs. replace?
**A:** Full replacement (option B) — delete the existing E4 fallback language entirely and write fresh language that matches the guardrail. User wants to invoke /skill-creator after the task is done to polish.

### Complexity (was: -0.05 -> now: 0.00)
**Q:** How should authorization-forwarding notes appear in delivery files?
**A:** Whatever format integrates best with each file's existing structure — executor's judgment.

## Context Loaded

- `~/workspace/database/projects/do/project.md` -- do-lang project overview, agent list, execution tiers, directory structure, conventions
- `skills/codex/task.md` -- Codex /do:task entry-point skill; spawns codex-planner, codex-griller, codex-executioner, codex-verifier; loads stage-plan-review.md and stage-code-review.md
- `skills/codex/continue.md` -- Codex /do:continue entry-point skill; routes by stage, spawns all agents depending on resume point
- `skills/codex/fast.md` -- Codex /do:fast entry-point skill; loads stage-fast-exec.md which spawns codex-executioner and codex-code-reviewer
- `skills/codex/quick.md` -- Codex /do:quick entry-point skill; loads stage-quick-exec.md which spawns codex-council-reviewer
- `skills/codex/debug.md` -- Codex /do:debug entry-point skill; spawns codex-debugger
- `skills/codex/do.md` -- Codex router; routes to sub-commands based on intent; lists 12 sub-commands, 6 of which spawn agents
- `skills/codex/project.md` -- Codex /do:project entry-point skill; multi-phase project orchestration; spawns all agents via stage references (intake, plan review, wave exec, wave code review, wave verify, phase transition)
- `skills/codex/init.md` -- Codex /do:init; no agent spawns (confirmed)
- `skills/codex/scan.md` -- Codex /do:scan; no agent spawns (confirmed)
- `skills/codex/abandon.md` -- Codex /do:abandon; no agent spawns (confirmed)
- `skills/codex/update.md` -- Codex /do:update; no agent spawns (references codex-*.md only in health check, not spawn)
- `skills/codex/optimise.md` -- Codex /do:optimise; no agent spawns (references agent path in examples only)
- `skills/codex/backlog.md` -- Codex /do:backlog; no agent spawns (mentions codex-executioner in feature flag description only)
- `skills/codex/references/stage-plan-review.md` -- spawns codex-plan-reviewer, codex-council-reviewer, codex-planner (on ITERATE)
- `skills/codex/references/stage-code-review.md` -- spawns codex-code-reviewer, codex-council-reviewer, codex-executioner (on ITERATE)
- `skills/codex/references/stage-fast-exec.md` -- spawns codex-executioner, codex-code-reviewer
- `skills/codex/references/stage-quick-exec.md` -- spawns codex-council-reviewer
- `skills/codex/references/stage-project-intake.md` -- spawns codex-griller (Pass 1, Pass 2, re-grill), codex-planner (PI-6 curate)
- `skills/codex/references/stage-project-plan-review.md` -- spawns codex-plan-reviewer, codex-council-reviewer, codex-planner (ITERATE)
- `skills/codex/references/stage-phase-plan-review.md` -- spawns codex-planner (curate), codex-plan-reviewer, codex-council-reviewer, codex-planner (ITERATE)
- `skills/codex/references/stage-wave-plan-review.md` -- spawns codex-planner (curate), codex-plan-reviewer, codex-council-reviewer, codex-planner (ITERATE)
- `skills/codex/references/stage-wave-exec.md` -- spawns codex-executioner
- `skills/codex/references/stage-wave-code-review.md` -- spawns codex-code-reviewer, codex-council-reviewer, codex-executioner (ITERATE)
- `skills/codex/references/stage-wave-verify.md` -- spawns codex-verifier
- `skills/codex/references/stage-phase-transition.md` -- spawns codex-griller (per-phase re-grill)
- `skills/codex/references/stage-project-complete.md` -- no agent spawns (confirmed)
- `skills/codex/references/stage-project-resume.md` -- no agent spawns (delegates to other stage references)
- `skills/codex/references/delivery-contract.md` -- mentions /jira:start as example caller; no agent spawns; needs authorization-forwarding language in Entry Command Integration Checklist
- `skills/codex/references/delivery-onboarding.md` -- mentions /jira:start as example entry command; no agent spawns; needs authorization-forwarding note in After Any Option section
- `skills/codex/references/stage-execute.md` -- loaded by /do:continue for execution; E4 contains contradictory inline-fallback language that must be rewritten to match no-inline-fallback guardrail
- `skills/codex/references/task-template.md` -- mentions /jira:start in comments; no agent spawns
- `agents/codex-planner.md` -- agent definition (frontmatter structure, role, tools)
- `skills/do/task.md` -- Claude Code equivalent (has `Agent` in allowed-tools; Codex does not use this mechanism)

## Approach

### Authorization language design

Two blocks will be added across files:

**Full authorization block** (for entry-point skill files) -- placed immediately after the YAML frontmatter closing `---` and the `# /do:*` heading, before "## Why this exists":

```markdown
## Agent Authorization

By invoking this workflow, the user explicitly authorizes spawning the following
internal agents. These agents are integral to the workflow contract and MUST be
spawned as subagents -- they are not optional.

| Agent | Role |
|-------|------|
| codex-planner | ... |
| ... | ... |

**No inline fallback:** If agent spawning is unavailable or blocked, STOP
immediately and report: "Cannot spawn required agents. This workflow requires
subagent spawning to function correctly. Please ensure agent spawning is enabled
and retry." Do NOT fall back to inline execution -- inline execution bypasses
review gates and breaks the workflow contract.
```

**Short authorization reminder** (for reference files that perform spawns) -- placed at the top of the file, after the description frontmatter block:

```markdown
**Agent authorization:** The caller workflow has authorized spawning all agents
referenced in this file. Spawn them as subagents -- do NOT execute their work
inline. If spawning fails, STOP and report; do not fall back to inline execution.
```

### Steps

1. **Add full authorization block to `skills/codex/task.md`**
   - Insert after `# /do:task` heading, before `## Why this exists`
   - List agents: codex-planner, codex-plan-reviewer, codex-council-reviewer, codex-griller, codex-executioner, codex-code-reviewer, codex-verifier
   - Include the no-inline-fallback guardrail

2. **Add full authorization block to `skills/codex/continue.md`**
   - Insert after `# /do:continue` heading, before `## Why this exists`
   - List agents: codex-planner, codex-plan-reviewer, codex-council-reviewer, codex-griller, codex-executioner, codex-code-reviewer, codex-verifier (all agents, since continue can resume at any stage)
   - Include no-inline-fallback guardrail

3. **Add full authorization block to `skills/codex/fast.md`**
   - Insert after `# /do:fast` heading, before `## Why this exists`
   - List agents: codex-executioner, codex-code-reviewer (the two agents the fast path spawns)
   - Include no-inline-fallback guardrail

4. **Add full authorization block to `skills/codex/quick.md`**
   - Insert after `# /do:quick` heading, before `## Why this exists`
   - List agents: codex-council-reviewer (only agent quick path spawns; inline execution is by design for quick, but council review IS a subagent)
   - Include no-inline-fallback guardrail (scoped to the council spawn, not the inline execution which is intentional)

5. **Add full authorization block to `skills/codex/debug.md`**
   - Insert after `# /do:debug` heading, before `## Why this exists`
   - List agents: codex-debugger
   - Include no-inline-fallback guardrail

6. **Add full authorization block to `skills/codex/project.md`**
   - Insert after `# /do:project` heading, before `## Why this exists`
   - List agents: codex-planner, codex-plan-reviewer, codex-council-reviewer, codex-griller, codex-executioner, codex-code-reviewer, codex-verifier (all agents -- project orchestrates full pipelines per wave plus intake grilling and phase plan review)
   - Include no-inline-fallback guardrail

7. **Add scoped authorization forwarding to `skills/codex/do.md`**
   - Insert after `# /do` heading, before the `Token-efficient task execution` description line
   - Add a section stating: routing to agent-spawning sub-commands carries implicit agent authorization
   - **Scope explicitly to the sub-commands that spawn agents:** `/do:task`, `/do:continue`, `/do:fast`, `/do:quick`, `/do:debug`, `/do:project`
   - **Explicitly exclude non-agent sub-commands:** state that `/do:init`, `/do:scan`, `/do:abandon`, `/do:update`, `/do:optimise`, and `/do:backlog` do NOT require agent spawning and this authorization section does not apply to them
   - List the full agent union: codex-planner, codex-plan-reviewer, codex-council-reviewer, codex-griller, codex-executioner, codex-code-reviewer, codex-verifier, codex-debugger
   - Include the no-inline-fallback guardrail scoped to the agent-spawning sub-commands only

8. **Add short authorization reminder to `skills/codex/references/stage-plan-review.md`**
   - Insert after the frontmatter closing `---`, before `# Plan Review Stage`
   - Reminder that spawning codex-plan-reviewer, codex-council-reviewer, and codex-planner (ITERATE) is authorized
   - No-inline-fallback reminder

9. **Add short authorization reminder to `skills/codex/references/stage-code-review.md`**
   - Insert after the frontmatter closing `---`, before `# Code Review Stage`
   - Reminder that spawning codex-code-reviewer, codex-council-reviewer, and codex-executioner (ITERATE) is authorized
   - No-inline-fallback reminder

10. **Add short authorization reminder to `skills/codex/references/stage-fast-exec.md`**
    - Insert after the frontmatter closing `---`, before `# Fast Execution Stage`
    - Reminder that spawning codex-executioner and codex-code-reviewer is authorized
    - No-inline-fallback reminder

11. **Add short authorization reminder to `skills/codex/references/stage-quick-exec.md`**
    - Insert after the frontmatter closing `---`, before `# Quick Execution Stage`
    - Reminder that spawning codex-council-reviewer is authorized
    - No-inline-fallback reminder (noting that QE-2 inline execution is intentional and NOT a fallback violation)

12. **Add short authorization reminder to project pipeline reference files**
    - `skills/codex/references/stage-project-intake.md` -- spawns codex-griller (Pass 1, Pass 2, re-grill), codex-planner (PI-6 curate)
    - `skills/codex/references/stage-project-plan-review.md` -- spawns codex-plan-reviewer, codex-council-reviewer, codex-planner (ITERATE)
    - `skills/codex/references/stage-phase-plan-review.md` -- spawns codex-planner (curate), codex-plan-reviewer, codex-council-reviewer, codex-planner (ITERATE)
    - `skills/codex/references/stage-wave-plan-review.md` -- spawns codex-planner (curate), codex-plan-reviewer, codex-council-reviewer, codex-planner (ITERATE)
    - `skills/codex/references/stage-wave-exec.md` -- spawns codex-executioner
    - `skills/codex/references/stage-wave-code-review.md` -- spawns codex-code-reviewer, codex-council-reviewer, codex-executioner (ITERATE)
    - `skills/codex/references/stage-wave-verify.md` -- spawns codex-verifier
    - `skills/codex/references/stage-phase-transition.md` -- spawns codex-griller (per-phase re-grill)
    - Insert the short authorization reminder after each file's frontmatter closing `---`, before the first heading

13. **Fix contradictory inline-fallback language in `skills/codex/references/stage-execute.md` E4**
    - The E4 note currently says: "E4 remains as the inline fallback path for environments where subagent spawning is unavailable."
    - This directly contradicts the no-inline-fallback guardrail being added by this task. The whole point of the guardrail is to prevent silent inline fallback.
    - **Action:** Rewrite the E4 note to remove the inline-fallback framing. Replace with language that says: E4 is the legacy single-agent code review path; in the orchestrated pipeline, code review is handled via `stage-code-review.md`. If subagent spawning is unavailable, the workflow must STOP and report -- do NOT use E4 as a fallback.
    - Also add the short authorization reminder to the top of stage-execute.md (it is loaded by `/do:continue` and references council invoke scripts, which are not agent spawns but the file is in the execution pipeline alongside files that do spawn agents -- the reminder reinforces the contract).

14. **Add authorization-forwarding language to `skills/codex/references/delivery-contract.md`**
    - This file is a Codex-side reference loaded by `task.md`. Its "Entry Command Integration Checklist" section describes how to wire entry commands (e.g., `/jira:start`) to pass `--delivery` to `/do:task`.
    - While it does not spawn agents itself, it is the closest Codex-side "Jira handoff doc" -- it defines the interface between entry commands and `/do:task`.
    - **Action:** Add an "Authorization Forwarding" note to the "Entry Command Integration Checklist" section stating: entry commands that route to `/do:task` or `/do:fast` inherit the agent authorization declared in those skill files. The entry command itself does not need to declare agent authorization -- it is carried by the target workflow. If the entry command invokes `/do:task`, the agents listed in `task.md`'s Agent Authorization section are automatically authorized.

15. **Add authorization-forwarding language to `skills/codex/references/delivery-onboarding.md`**
    - This file is loaded by `task.md` (Step -1) and `fast.md` (Step 0) during the one-time onboarding flow. It references `/jira:start` as an example entry command and describes wiring entry commands to pass `--delivery` to `/do:task`.
    - **Action:** Add a brief note in the "After Any Option" section stating: after onboarding completes, control returns to the caller (`task.md` or `fast.md`), which carries its own agent authorization. No additional authorization is needed from the onboarding flow -- the caller's authorization covers all downstream agent spawns.

## Concerns

1. **Codex platform guard may not respect doc-level authorization language.**
   - *Risk:* The platform guard may look for specific phrasing in the user's original message, not in skill file content. If so, the authorization blocks will have no effect and the user still needs magic phrasing.
   - *Mitigation:* The authorization blocks use strong, unambiguous language ("explicitly authorizes spawning") that maps to Codex's expected trigger phrases. The YAML description field on each skill already names agents. If the doc-level approach does not work, a follow-up could explore the YAML frontmatter `allowed-tools` or a Codex-specific `authorized-agents` field -- but that would be a separate investigation.

2. **Token overhead from authorization blocks across 22 files.**
   - *Risk:* Adding authorization language to 22 files (7 entry-points + 15 reference files) increases prompt token consumption, especially for `/do:project` which loads many reference files in sequence.
   - *Mitigation:* The full authorization block is ~8-10 lines; the short reminder is ~3 lines. At ~30 tokens per line, this adds roughly 500-700 tokens across all files loaded in a single session. This is negligible compared to the workflow content itself (each skill file is 200-400 lines). In the worst case (`/do:project wave next`), ~5 reference files load sequentially, adding ~150 tokens total from reminders.

3. **Quick-path ambiguity between intentional inline execution and forbidden inline fallback.**
   - *Risk:* `/do:quick` intentionally executes inline (QE-2), so a blanket "no inline fallback" guardrail could confuse the model.
   - *Mitigation:* The quick-path authorization block explicitly scopes the no-inline-fallback guardrail to the council review spawn only, and notes that QE-2 inline execution is by design.

4. **Reference files loaded via @reference may not be visible at authorization-check time.**
   - *Risk:* Codex evaluates the platform guard at spawn-time. If the reference file (e.g., stage-plan-review.md) is lazy-loaded, the authorization reminder may arrive too late.
   - *Mitigation:* The primary authorization lives in the entry-point skill file, which IS loaded at invocation time. The reference file reminders are defense-in-depth. If the entry-point authorization works, the reference reminders are belt-and-suspenders.

5. **Router authorization must not block non-agent sub-commands.**
   - *Risk:* Over-broad authorization language in `do.md` (e.g., "all `/do:*` sub-commands require subagent spawning") could incorrectly prevent `/do:init`, `/do:scan`, `/do:abandon`, `/do:update`, `/do:optimise`, and `/do:backlog` from executing, since these commands operate entirely inline without agents.
   - *Mitigation:* Step 7 explicitly scopes the authorization to only the 6 agent-spawning sub-commands (`task`, `continue`, `fast`, `quick`, `debug`, `project`) and includes an explicit exclusion list naming the 6 non-agent sub-commands. The guardrail language will state that non-agent sub-commands proceed normally without agent authorization.

6. **stage-execute.md E4 contradicts the no-inline-fallback guardrail.**
   - *Risk:* The existing E4 note explicitly says it is "the inline fallback path for environments where subagent spawning is unavailable." If left unchanged, this gives Codex explicit permission to bypass the orchestrated pipeline and execute code review inline -- exactly the behavior this task is designed to prevent.
   - *Finding:* This is a pre-existing design artifact from before the orchestrated pipeline was mature. The language was written when inline execution was the only option; now that `stage-code-review.md` handles the orchestrated path, E4's fallback framing is outdated and harmful.
   - *Mitigation:* Step 13 rewrites the E4 note to remove the inline-fallback framing and replace it with a stop-and-report instruction consistent with the guardrail. The rewrite preserves E4's documentation of what the inline path does (for historical reference) but explicitly marks it as NOT a fallback and NOT to be used when subagent spawning fails.

7. **Delivery contract reference files are Codex-side Jira handoff docs.**
   - *Risk:* `delivery-contract.md` and `delivery-onboarding.md` are loaded by Codex `task.md` and `fast.md`. They describe how entry commands (e.g., `/jira:start`) wire into `/do:task`. Without authorization-forwarding language, there is a gap in the authorization chain: the entry command integration checklist tells implementers how to pass `--delivery` but says nothing about agent authorization flowing through that same path.
   - *Finding:* These files do not spawn agents themselves, but they ARE the interface specification between entry commands and the agent-spawning workflows. Adding authorization-forwarding language closes the gap.
   - *Mitigation:* Steps 14-15 add scoped authorization-forwarding notes to both files, clarifying that agent authorization is carried by the target workflow (`task.md` or `fast.md`), not by the entry command or the delivery contract itself. This is lightweight (2-3 lines per file) and avoids over-engineering while making the authorization chain explicit.

## Execution Log

### 2026-05-05 14:30 - Execution started

**Status:** In progress
**Steps:** 0/15 complete

### 2026-05-05 14:45 - Step 1: Add full authorization block to task.md

**Files:**

- `skills/codex/task.md` - Inserted Agent Authorization section (7 agents, no-inline-fallback guardrail) after `# /do:task` heading, before `## Why this exists`

**Status:** Complete

### 2026-05-05 14:46 - Step 2: Add full authorization block to continue.md

**Files:**

- `skills/codex/continue.md` - Inserted Agent Authorization section (7 agents, full set since continue can resume any stage, no-inline-fallback guardrail) after `# /do:continue` heading

**Status:** Complete

### 2026-05-05 14:47 - Step 3: Add full authorization block to fast.md

**Files:**

- `skills/codex/fast.md` - Inserted Agent Authorization section (codex-executioner, codex-code-reviewer, no-inline-fallback guardrail) after `# /do:fast` heading

**Status:** Complete

### 2026-05-05 14:48 - Step 4: Add full authorization block to quick.md

**Files:**

- `skills/codex/quick.md` - Inserted Agent Authorization section (codex-council-reviewer only; added explicit note that QE-2 inline execution is by design, not a fallback violation; no-inline-fallback guardrail scoped to council spawn) after `# /do:quick` heading

**Status:** Complete

### 2026-05-05 14:49 - Step 5: Add full authorization block to debug.md

**Files:**

- `skills/codex/debug.md` - Inserted Agent Authorization section (codex-debugger, no-inline-fallback guardrail) after `# /do:debug` heading

**Status:** Complete

### 2026-05-05 14:50 - Step 6: Add full authorization block to project.md

**Files:**

- `skills/codex/project.md` - Inserted Agent Authorization section (7 agents — full set since project orchestrates all pipeline stages across phases and waves, no-inline-fallback guardrail) after `# /do:project` heading

**Status:** Complete

### 2026-05-05 14:51 - Step 7: Add scoped authorization forwarding to do.md

**Files:**

- `skills/codex/do.md` - Inserted Agent Authorization (agent-spawning sub-commands only) section after `# /do` heading; table maps 6 agent-spawning sub-commands to their authorized agent lists; explicit exclusion list for 6 non-agent sub-commands; no-inline-fallback guardrail scoped to agent-spawning routes only

**Status:** Complete

### 2026-05-05 14:52 - Step 8: Short authorization reminder to stage-plan-review.md

**Files:**

- `skills/codex/references/stage-plan-review.md` - Inserted short authorization reminder (codex-plan-reviewer, codex-council-reviewer, codex-planner on ITERATE) before `# Plan Review Stage` heading

**Status:** Complete

### 2026-05-05 14:53 - Step 9: Short authorization reminder to stage-code-review.md

**Files:**

- `skills/codex/references/stage-code-review.md` - Inserted short authorization reminder (codex-code-reviewer, codex-council-reviewer, codex-executioner on ITERATE) before `# Code Review Stage` heading

**Status:** Complete

### 2026-05-05 14:54 - Step 10: Short authorization reminder to stage-fast-exec.md

**Files:**

- `skills/codex/references/stage-fast-exec.md` - Inserted short authorization reminder (codex-executioner, codex-code-reviewer) before `# Fast Execution Stage` heading

**Status:** Complete

### 2026-05-05 14:55 - Step 11: Short authorization reminder to stage-quick-exec.md

**Files:**

- `skills/codex/references/stage-quick-exec.md` - Inserted short authorization reminder (codex-council-reviewer; noted QE-2 inline execution is intentional) before `# Quick Execution Stage` heading

**Status:** Complete

### 2026-05-05 14:56 - Step 12: Short authorization reminders to project pipeline reference files

**Files:**

- `skills/codex/references/stage-project-intake.md` - Short reminder (codex-griller, codex-planner)
- `skills/codex/references/stage-project-plan-review.md` - Short reminder (codex-plan-reviewer, codex-council-reviewer, codex-planner on ITERATE)
- `skills/codex/references/stage-phase-plan-review.md` - Short reminder (codex-planner curate, codex-plan-reviewer, codex-council-reviewer, codex-planner on ITERATE)
- `skills/codex/references/stage-wave-plan-review.md` - Short reminder (codex-planner curate, codex-plan-reviewer, codex-council-reviewer, codex-planner on ITERATE)
- `skills/codex/references/stage-wave-exec.md` - Short reminder (codex-executioner)
- `skills/codex/references/stage-wave-code-review.md` - Short reminder (codex-code-reviewer, codex-council-reviewer, codex-executioner on ITERATE)
- `skills/codex/references/stage-wave-verify.md` - Short reminder (codex-verifier)
- `skills/codex/references/stage-phase-transition.md` - Short reminder before first heading (no YAML frontmatter — placed before `# Stage: Phase Transition` per council review nitpick)

**Status:** Complete

### 2026-05-05 14:57 - Step 13: Fix stage-execute.md E4 + add authorization note

**Files:**

- `skills/codex/references/stage-execute.md` - Added authorization note at top (before `# Execution Stage`); rewrote E4 note: deleted "inline fallback path for environments where subagent spawning is unavailable" framing entirely; replaced with language stating E4 is the legacy single-agent path, NOT a fallback when spawning fails, and that new work uses stage-code-review.md

**Decisions:**

- Preserved E4's documentation of what it does (legacy single-agent council invoke) while removing the inline-fallback framing; old phrase confirmed gone via rg check

**Status:** Complete

### 2026-05-05 14:58 - Step 14: Authorization-forwarding language to delivery-contract.md

**Files:**

- `skills/codex/references/delivery-contract.md` - Added "Authorization Forwarding" subsection to the Entry Command Integration Checklist section; states entry commands inherit authorization from the target workflow (task.md or fast.md); no additional authorization needed from entry commands themselves

**Status:** Complete

### 2026-05-05 14:59 - Step 15: Authorization-forwarding language to delivery-onboarding.md

**Files:**

- `skills/codex/references/delivery-onboarding.md` - Added authorization forwarding note to "After Any Option" section; states that once control returns to the caller, the caller's Agent Authorization section governs all downstream spawns; onboarding flow itself spawns no agents

**Status:** Complete

### 2026-05-05 15:00 - Verification checks

**Verified:**
- All 16 files with "Spawn the codex-" patterns have authorization coverage (rg check passed)
- Old phrase "inline fallback path for environments where subagent spawning is unavailable" is gone from all codex skill files (rg returned no results)
- 22 files total confirmed with authorization language (rg -l check on "Agent [Aa]uthorization")

**Status:** Complete

### 2026-05-05 15:01 - Execution complete

**Status:** Complete
**Summary:**

- Steps completed: 15/15
- Files modified: 22
- Deviations: 1 minor (stage-phase-transition.md has no YAML frontmatter — inserted before first heading per council review nitpick; handled correctly)

## Council Review

## Verification Results

### Approach Checklist

- [x] Step 1: Add full authorization block to `skills/codex/task.md`
- [x] Step 2: Add full authorization block to `skills/codex/continue.md`
- [x] Step 3: Add full authorization block to `skills/codex/fast.md`
- [x] Step 4: Add full authorization block to `skills/codex/quick.md` (QE-2 scoped guardrail present)
- [x] Step 5: Add full authorization block to `skills/codex/debug.md`
- [x] Step 6: Add full authorization block to `skills/codex/project.md`
- [x] Step 7: Add scoped authorization forwarding to `skills/codex/do.md`
- [x] Step 8: Short authorization reminder to `skills/codex/references/stage-plan-review.md`
- [x] Step 9: Short authorization reminder to `skills/codex/references/stage-code-review.md`
- [x] Step 10: Short authorization reminder to `skills/codex/references/stage-fast-exec.md`
- [x] Step 11: Short authorization reminder to `skills/codex/references/stage-quick-exec.md` (QE-2 note present)
- [x] Step 12: Short authorization reminders to all 8 project pipeline reference files (stage-project-intake, stage-project-plan-review, stage-phase-plan-review, stage-wave-plan-review, stage-wave-exec, stage-wave-code-review, stage-wave-verify, stage-phase-transition)
- [x] Step 13: Fix `skills/codex/references/stage-execute.md` E4 + add authorization note (old inline-fallback phrase removed, E4 rewritten to NOT-a-fallback language)
- [x] Step 14: Authorization-forwarding language to `skills/codex/references/delivery-contract.md`
- [x] Step 15: Authorization-forwarding language to `skills/codex/references/delivery-onboarding.md`

### Quality Checks

- **Tests:** PASS (npm run test) — 829 tests, 0 failures

No lint or type-check scripts configured (markdown/JS project).

### Result: PASS
- Checklist: 15/15 complete
- Quality: 1/1 passing (tests)
- Files with authorization language: 22 (confirmed via rg)
- Old contradictory phrase "inline fallback path for environments where subagent spawning is unavailable": removed (rg returned no results)
