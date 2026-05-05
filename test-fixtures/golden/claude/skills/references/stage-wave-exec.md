---
name: stage-wave-exec
description: "Wave execution block for /do:project. Spawns do-executioner against wave.md. Project-pipeline analogue of stage-execute.md — does NOT reference /do:task or active_task."
---

# Wave Execution Stage

This reference file is loaded by `skills/project.md` `wave next` after `stage-wave-plan-review.md` returns APPROVED. It spawns `do-executioner` against the wave's `wave.md` file.

**Caller contract:** The caller provides `<wave_path>` = abs path to `wave.md`. When this stage returns COMPLETE, `wave.md` has been updated with a full Execution Log, `modified_files[]` and `discovered_followups[]` have been written to frontmatter (if executioner wrote them), and `wave.md` `stages.execution: complete` has been set. Continue to `stage-wave-code-review.md`. If BLOCKED or FAILED, stop and surface to user.

---

## WE-0: Resume Guard

Check if wave execution already completed:

```bash
node ~/.claude/commands/do/scripts/update-task-frontmatter.cjs check '<wave_path>' stages.execution==complete
```

**If already completed (exit 1):** Skip this stage. Return control to caller (proceed to `stage-wave-code-review.md`).

---

## WE-1: Update Wave Status to In-Progress

Update `wave.md` frontmatter:
```yaml
stage: execution
stages:
  execution: in_progress
updated: <ISO timestamp>
```

---

## WE-2: Spawn do-executioner

```javascript
Agent({
  description: "Execute wave plan",
  subagent_type: "do-executioner",
  model: "<models.overrides.executioner || models.default>",
  prompt: `
Execute the plan in this target file.

Target file: <wave_path>

The target file is a wave.md for a /do:project wave — it has the same Approach,
Concerns, and Execution Log sections as a task file. Follow the Approach section
step by step. Log each action to the Execution Log. Handle deviations appropriately.

At the end of execution, if the target file's frontmatter has a \`modified_files: []\`
array, write the canonical repo-relative list of files you modified into it.
If the frontmatter has a \`discovered_followups: []\` array, append any discoveries
using the {title, body, promote} shape.

Return summary when complete.
`
})
```

Handle result:
- **COMPLETE**: Continue to WE-3
- **BLOCKED**: Surface blocker to user:
  ```
  Wave execution blocked at step <N>.

  Blocker: <description>

  Options:
  1. Resolve blocker and re-invoke `/do:project wave next`
  2. Abandon wave (`/do:project wave abandon <slug>`)
  3. Mark out of scope. Run the same state-machine-legal two-step used by `stage-wave-verify.md` Option 4 (leaf-only writes — the phase-completion check reads `wave.md` directly per `skills/project.md` §Authoritative state reads):
     a. Transition wave status `in_progress → blocked`:
        `project-state.cjs set wave <phase_slug>/<wave_slug> status=blocked --project <active_project>`
     b. Transition wave scope `in_scope → out_of_scope` (now legal because status is `blocked`):
        `project-state.cjs set wave <phase_slug>/<wave_slug> scope=out_of_scope --project <active_project>`
     c. Clear `active_wave` in `phase.md` (atomic temp-file + rename).
     d. Append two changelog lines (status-change then scope-change).
     Do NOT hand-edit `wave.md` — it bypasses the state-machine guards in `project-state.cjs`.

  Awaiting user decision.
  ```
- **FAILED**: Surface error and last good state to user

---

## WE-3: Verify Execution Complete

```bash
node ~/.claude/commands/do/scripts/update-task-frontmatter.cjs read '<wave_path>' stages.execution
```

If `stages.execution` is `complete`, proceed to WE-4. If not, the executioner may have stopped mid-run.

If do-executioner set `stages.execution: complete`, proceed to WE-4.
If execution stage is not `complete`, the executioner may have stopped mid-run — surface state to user and ask how to proceed.

---

## WE-4: Return Control

Wave execution stage complete. Return control to caller — proceed to `stage-wave-code-review.md`.
