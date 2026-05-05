---
name: resume-preamble-project
description: "Per-file context reload for /do:project resume. Project-pipeline sibling of resume-preamble.md. Implements R0.1p–R0.6p per orchestrator §7.5. Invoked once per target file (project.md → phase.md → wave.md) by stage-project-resume.md."
---

# Resume Preamble — Project Pipeline

This reference file provides the per-file context reload logic for `/do:project resume`. It is the project-pipeline sibling of `resume-preamble.md` (which remains task-pipeline-only — not modified by Task γ).

**Duplication accepted per orchestrator O-29:** this file parallels `resume-preamble.md`'s structure but adapts every step to the project pipeline. Do not modify `resume-preamble.md` to unify them.

---

## Caller Contract

`stage-project-resume.md` invokes this file **once per target file** in the following order:
1. `project.md` (always)
2. `phase.md` (if an active phase exists)
3. `wave.md` (if an active wave exists)

Each invocation receives two inputs:
- `<target-file-path>` — absolute or repo-relative path to the target `.md` file
- `<target-file-type>` — one of `project` | `phase` | `wave`

If any invocation **STOPs** (user chose option 2 in the stale-reference prompt, or declined the resume confirmation), the entire `/do:project resume` stops. Do NOT proceed to the next nested invocation.

---

## Step R0p — Resume Check (project pipeline)

Run this at the start of each invocation, before any stage-specific logic.

---

### Step R0.1p — Load target-file markdown

Read the target file from `<target-file-path>`.

Parse YAML frontmatter. Fields differ per `<target-file-type>`:

- **`project`:** `project_schema_version`, `slug`, `id`, `title`, `status`, `active_phase`, `confidence`, `phases[]`, `council_review_ran.project_plan`, `database_entry` (optional).
- **`phase`:** `project_schema_version`, `project_slug`, `phase_slug`, `status`, `scope`, `active_wave`, `waves[]`, `entry_context[]`, `confidence`, `council_review_ran.plan`, `backlog_item`.
- **`wave`:** `project_schema_version`, `project_slug`, `phase_slug`, `wave_slug`, `status`, `scope`, `stage`, `stages`, `confidence`, `council_review_ran.plan`, `council_review_ran.code`, `modified_files`, `unresolved_concerns`, `discovered_followups`, `wave_summary`, `backlog_item`.

Extract from markdown body (sections differ per type):
- **`project`:** `## Vision`, `## Target Users`, `## Non-Goals`, `## Success Criteria`, `## Constraints`, `## Risks`, `## Phase Plan`.
- **`phase`:** `## Goal`, `## Entry Criteria`, `## Exit Criteria`, `## Wave Plan`, `## Concerns`, `## Review Notes`, `## Exit Summary`.
- **`wave`:** `## Problem Statement`, `## Approach`, `## Concerns`, `## Execution Log` (parse last entry: `### YYYY-MM-DD HH:MM`), `## Verification Results`, `## Review Notes`, `## Council Review`.

Derive the project-level slug for use in subsequent steps:
- `project` target: slug from `project.md` frontmatter field `slug`.
- `phase` target: `project_slug` frontmatter field.
- `wave` target: `project_slug` frontmatter field.

---

### Step R0.2p — Detect context state

Same conservative heuristic as the task-pipeline `resume-preamble.md` R0.2: Claude cannot reliably introspect its context window, so **always proceed to R0.3p**.

**Skip reload ONLY if:**
- Context was explicitly loaded earlier in this conversation (e.g., user ran `/do:project new` or a prior `/do:project resume` in the same session).
- The current conversation already contains references to this target file's specific details.

Second and third invocations (for `phase.md`, `wave.md`) are **additive** — the project context from the first invocation is already in-session. Reads in R0.3p for those invocations are supplemental, not full reloads. When in doubt, proceed.

---

### Step R0.3p — Reload context (project-native)

This step replaces the task-pipeline's `load-task-context.cjs` invocation. The project pipeline does not use keyword-based context matching — all context is structured on disk.

Read, in order:

1. **Always:** the target file itself (already read in R0.1p — no re-read needed).

2. **If `<target-file-type>` == `project`:**
   - Re-read body sections: `## Vision`, `## Target Users`, `## Non-Goals`, `## Success Criteria`, `## Constraints`, `## Risks`, `## Phase Plan` to reload project-level intent.
   - If `database_entry` frontmatter field is non-null, read that database project.md file to reload broader project context.

3. **If `<target-file-type>` == `phase`:**
   - Read each path listed in `entry_context[]` frontmatter array in order. Typical entries: `project.md`, `phase.md`, `handoff.md` (from the previous phase, if one exists).
   - If `backlog_item` is non-null, optionally read the backlog entry (non-blocking — if gone, note it but do not stale-fail).

4. **If `<target-file-type>` == `wave`:**
   - Read the parent phase's `phase.md` (focusing on `## Wave Plan` section for this wave's entry context).
   - Read the previous phase's `handoff.md` if one exists.
   - Read `project.md`'s `## Constraints` and `## Risks` sections for cross-cutting awareness.

5. **Changelog (always, at project scope):**
   - Read the last 10 entries of `.do/projects/<project_slug>/changelog.md`.
   - The `<project_slug>` is always the project-level slug derived in R0.1p — one changelog per project, not per phase or wave.
   - This informs R0.5p's "last action" rendering.

For each path resolved above:
- Check if the file exists.
- If missing, add to `stale_refs` list with a note about which field or section pointed at it (e.g., `"phase.md entry_context[] path 2"`).
- If exists, read the file to reload context.

**No keyword matching, no fuzzy path matching.** All paths come directly from frontmatter fields or the known folder layout. This is stricter than the task pipeline's keyword-based loading.

---

### Step R0.4p — Handle stale references

If `stale_refs` is non-empty, display blocking prompt:

```
Referenced doc(s) not found:
- <path1> (pointed at by <field/section>)
- <path2> (pointed at by <field/section>)

Options:
1. Continue without them (<target-file-type>.md has enough context to resume)
2. Stop and locate the docs

Enter 1 or 2:
```

Wait for user response:

- **If "1":**
  - Append a line to `.do/projects/<project_slug>/changelog.md`. The log-line label qualifies the target by full slug path per `<target-file-type>`:
    - `project` target: `<timestamp>  project:<project_slug>  resume  reason: continued without missing docs: [<path1>, <path2>]`
    - `phase` target: `<timestamp>  phase:<project_slug>/<phase_slug>  resume  reason: continued without missing docs: [<path1>, <path2>]`
    - `wave` target: `<timestamp>  wave:<project_slug>/<phase_slug>/<wave_slug>  resume  reason: continued without missing docs: [<path1>, <path2>]`
  - Continue to R0.5p.

- **If "2":**
  - Display: "Locate the missing docs, then run `/do:project resume` again."
  - **STOP** — do not proceed to R0.5p; do not call the next nested preamble invocation.

---

### Step R0.5p — Display resume summary

Determine "last action" based on `<target-file-type>` and the target file's current `status` / `stage` field:

| Target file type | Status / stage | Last action source |
|---|---|---|
| `project` | `intake` | Last Q&A pair from most recent `.do/projects/<slug>/intake/session-*.md`, or "Intake not started" |
| `project` | `planning` | "Project plan in review" + last `council_review_ran.project_plan` state |
| `project` | `in_progress` (has `active_phase`) | Last entry from `.do/projects/<slug>/changelog.md` (top-level project activity summary) |
| `project` | `in_progress` (`active_phase: null`, every in-scope phase `completed`) | "Project complete pending — all in-scope phases done. Run `/do:project complete` to finalise." |
| `project` | `blocked` | Last changelog entry with reason field |
| `project` | `completed` / `abandoned` | Terminal — should not normally reach R0.5p for these states |
| `phase` | `planning` | "Phase plan in review" + last `council_review_ran.plan` state |
| `phase` | `in_progress` | Last changelog entry scoped to `phase:<project_slug>/<phase_slug>` |
| `phase` | `blocked` | Last changelog entry for this phase with reason |
| `phase` | `completed` | "Phase complete" + `handoff.md` path if rendered |
| `wave` | `planning` | "Wave plan in review" + last `council_review_ran.plan` state |
| `wave` | `in_progress` + stage == `execution` | Summary from last Execution Log entry on `wave.md` (Files + Status), or "Execution not started" |
| `wave` | `in_progress` + stage == `verification` | "Verification in progress" + `stages.verification` status |
| `wave` | `blocked` | Last changelog entry for this wave with reason |
| `wave` | `completed` | `wave_summary` frontmatter field (one-sentence summary) |

Display resume summary:

```
Resuming: <project-slug> / <phase-slug?> / <wave-slug?> (<target-file-type> stage: <status>)
Last action: <summary from table>

Continue? (yes/no)
```

Wait for user confirmation:

- **If "yes" or "y":** Continue to R0.6p.
- **If "no" or "n":** Display: "Paused. Run `/do:project resume` when ready." and **STOP**.

---

### Step R0.6p — Mid-execution progress check (wave-scope only)

**Only applies when `<target-file-type>` == `wave`** AND the wave is at `stage: execution` AND its `## Execution Log` has at least one entry AND the last entry's Status is NOT "Execution complete".

For `project` and `phase` target types, this step is a **no-op** — those target files do not carry an Execution Log (they carry plan / changelog rollup instead). Proceed directly to stage-specific logic.

#### Step R0.6.1p — Parse Approach into steps

Read the wave.md `## Approach` section and extract discrete steps:
1. Look for numbered lists: `1.`, `2.`, `3.` patterns
2. Look for bullet points: `- ` or `* ` patterns
3. Convert each to a tracked item

#### Step R0.6.2p — Match completed work to steps

Parse the wave.md `## Execution Log`'s `**Files:**` entries AND the `modified_files[]` frontmatter array to identify completed work.

The `modified_files[]` frontmatter array is authoritative (written by codex-executioner at end of execution); the `## Execution Log` body section is human-readable and used as supplemental context.

Match file paths and change summaries to approach steps using heuristics:
- File path matches step description
- Change summary matches step intent
- Explicit "completed" or "done" in log entry

#### Step R0.6.3p — Display progress checklist

```
Wave execution paused. Progress so far:
- [x] <completed step from approach, matched to modified_files[]>
- [x] <another completed item>
- [ ] <remaining step from approach>

Continue from here? (yes/no)
```

Wait for user confirmation:

- **If "yes" or "y":** Skip any wave-level context-clear decision; continue from `stage-wave-exec.md` for remaining items.
- **If "no" or "n":** Display: "Paused. Run `/do:project resume` when ready." and **STOP**.

---

## Files

- **Target file:** one of `.do/projects/<slug>/project.md` / `.do/projects/<slug>/phases/<p>/phase.md` / `.do/projects/<slug>/phases/<p>/waves/<w>/wave.md`
- **Project changelog:** `.do/projects/<slug>/changelog.md`
- **Phase handoff:** `.do/projects/<slug>/phases/<p>/handoff.md` (only if the phase is past its handoff render)
- **Intake sessions:** `.do/projects/<slug>/intake/session-*.md` (project scope only)
- **Database project.md** (optional): pointed at by `project.md` `database_entry` frontmatter field

**Not referenced:** `load-task-context.cjs` (task-pipeline primitive; replaced by structured reads above), `.do/tasks/<file>.md` (task-pipeline surface; isolated per §10), `/do:continue` (task-pipeline command; project pipeline uses `/do:project resume` per §7 step 8).
