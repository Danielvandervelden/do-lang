---
name: stage-phase-exit
description: "Render-only handoff artefact writer for /do:project phase complete. Reads wave/phase/project frontmatter, renders handoff.md from handoff-template.md. Does NOT call project-state.cjs. Does NOT mutate any frontmatter."
---

# Phase Exit Stage

This reference file is invoked by `skills/codex/project.md` `phase complete` **after** the state transition has completed (i.e., after β has set the completed phase to `status: completed`, cleared `active_wave` and `active_phase`, and appended to `changelog.md`).

**This stage is read-only.** It renders `handoff.md` from `handoff-template.md` using structured frontmatter reads only. It does NOT call `project-state.cjs` and does NOT mutate any frontmatter.

**Caller contract:**
- Receives `<active_project>` — the project slug.
- Receives `<completed_phase_slug>` — the slug of the phase that was just completed. This is captured from the precondition check's `activePhase` variable BEFORE step 3 clears `active_phase` in β's `phase complete` flow.

---

## PE-1: Read State

Read the following files:

1. **`project.md`** — `.do/projects/<active_project>/project.md` frontmatter: `slug`, `status`.
2. **`phase.md`** (completed phase) — `.do/projects/<active_project>/phases/<completed_phase_slug>/phase.md` frontmatter: `phase_slug`, `status`, `scope`, `backlog_item`, `unresolved_concerns[]` (if present), `discovered_followups[]` (if present).
3. **All `wave.md` files** within the completed phase — walk `.do/projects/<active_project>/phases/<completed_phase_slug>/waves/` and read each leaf `wave.md` directly (NOT from `phase.md.waves[]`, which is scaffold-seeded and not synced):

   ```bash
   node -e "
   const fs = require('fs'), path = require('path');
   const { execSync } = require('child_process');
   const wavesDir = '.do/projects/<active_project>/phases/<completed_phase_slug>/waves';
   if (!fs.existsSync(wavesDir)) { console.log(JSON.stringify([])); process.exit(0); }
   const fmRead = (f) => JSON.parse(execSync('node ~/.codex/skills/do/scripts/update-task-frontmatter.cjs read \"' + f + '\"', { encoding: 'utf8' }));
   const waves = fs.readdirSync(wavesDir)
     .filter(d => fs.statSync(path.join(wavesDir, d)).isDirectory())
     .map(slug => {
       const wPath = path.join(wavesDir, slug, 'wave.md');
       if (!fs.existsSync(wPath)) return null;
       const data = fmRead(wPath);
       return {
         slug,
         status: data.status,
         scope: data.scope,
         wave_summary: data.wave_summary || null,
         modified_files: data.modified_files || [],
         unresolved_concerns: data.unresolved_concerns || [],
         discovered_followups: data.discovered_followups || []
       };
     })
     .filter(Boolean)
     .sort((a, b) => a.slug.localeCompare(b.slug));
   console.log(JSON.stringify(waves));
   "
   ```

4. **`changelog.md`** — `.do/projects/<active_project>/changelog.md` — read the full file. Needed in PE-2 to find last-reason entries for abandoned/blocked waves.

---

## PE-2: Collect Handoff Inputs

From the wave data collected in PE-1, build the four content buckets:

### `## What Shipped`

For each wave with `status: completed`:
- One line from `wave_summary` frontmatter field (written by codex-verifier at wave completion).
- If `wave_summary` is null or empty: one line `"<wave_slug> — (wave summary not set)"`.

Format: one bullet per completed wave, e.g.:
```
- **<wave_slug>:** <wave_summary>
```

### `## What Remains`

Three sub-buckets:

1. **Abandoned or blocked waves** — for each wave with `status: abandoned` or `status: blocked`:
   - Row: `- **<wave_slug>** (status: <status>): <last changelog reason>`
   - "Last changelog reason": scan `changelog.md` for the most recent entry matching `abandon:wave:<wave_slug>` or `blocked:wave:<wave_slug>` and extract the reason text after the last colon. If no entry found: `(no reason recorded)`.

2. **Out-of-scope waves** — for each wave with `scope: out_of_scope`:
   - Row: `- **<wave_slug>** — deferred (out of scope)`

3. **Future-wave follow-ups** — for each wave's `discovered_followups[]` entries where `promote == wave`:
   - Row: `- **Follow-up** from wave `<wave_slug>`: <title> — <body>`

If all three sub-buckets are empty, write: "No deferred work."

### `## Open Decisions`

Concatenation of all wave `unresolved_concerns[]` arrays, grouped by severity (blocking first, then warning, then info).

Format per concern:
```
- **Decision:** <title>
  **Severity:** <severity>
  **Context:** <body>
  *(from wave: <wave_slug>)*
```

If empty: "No open decisions."

### `## Files of Record`

Union of every wave's `modified_files[]` arrays, deduplicated and sorted alphabetically, **plus** the project's `project.md` and the completed `phase.md`.

Format: one bullet per path, e.g.:
```
- .do/projects/<active_project>/project.md
- .do/projects/<active_project>/phases/<completed_phase_slug>/phase.md
- <modified_file_path>
- <modified_file_path>
```

---

## PE-3: Detect Terminal Phase

Determine whether `<completed_phase_slug>` is the final in-scope phase.

**NOTE: Do NOT read `project.md`'s `phases[]` array for this control-flow decision.**
`phases[]` is a scaffold-seeded parent index that is not synced by `project-state.cjs` — β's
Authoritative state reads doctrine prohibits using it for control-flow decisions.
Terminal detection IS a control-flow decision, so we walk leaf files.
This is a deliberate deviation from the verbatim scope quote ("read project.md's phases[] array")
in the orchestrator spec; the Authoritative state reads doctrine takes precedence.

Walk the `phases/` folder, read each `phase.md` leaf file directly, and find the first in-scope phase that sorts AFTER `<completed_phase_slug>` lexically:

```bash
NEXT_PHASE=$(node -e "
const fs = require('fs'), path = require('path');
const { execSync } = require('child_process');
const phasesDir = '.do/projects/<active_project>/phases';
const completedSlug = '<completed_phase_slug>';
const fmRead = (f) => JSON.parse(execSync('node ~/.codex/skills/do/scripts/update-task-frontmatter.cjs read \"' + f + '\"', { encoding: 'utf8' }));
const phases = fs.readdirSync(phasesDir)
  .filter(d => fs.statSync(path.join(phasesDir, d)).isDirectory())
  .map(slug => {
    const phPath = path.join(phasesDir, slug, 'phase.md');
    if (!fs.existsSync(phPath)) return null;
    const data = fmRead(phPath);
    return { slug, status: data.status, scope: data.scope };
  })
  .filter(Boolean)
  .sort((a, b) => a.slug.localeCompare(b.slug));
const next = phases.find(p => p.scope === 'in_scope' && p.slug.localeCompare(completedSlug) > 0);
process.stdout.write(next ? next.slug : '');
")
```

- **If `NEXT_PHASE` is non-empty:** non-terminal phase. Render `## Next Phase Entry Prompt` section (see PE-5).
- **If `NEXT_PHASE` is empty:** terminal phase. Render `## Project Completion Hint` section instead (see PE-5).

---

## PE-4: Check for Backlog-Promotion Follow-ups

Collect all `discovered_followups[]` entries across all waves where `promote == backlog`.

Count them as `N`.

If `N > 0`, prepare the reminder line for appending at the end of `handoff.md`:
```
<N> follow-ups flagged for backlog promotion; run `/do:backlog add` for each.
```

If `N == 0`, no reminder is needed.

---

## PE-5: Read Template and Render `handoff.md`

Read `handoff-template.md`:

```bash
cat skills/do/references/handoff-template.md
# or installed path:
# cat ~/.codex/skills/do/references/handoff-template.md
```

Slot-fill all sections with content from PE-2:
- Replace `{{PHASE_SLUG}}` with `<completed_phase_slug>`.
- Replace `{{WHAT_SHIPPED}}` with the `## What Shipped` content.
- Replace `{{WHAT_REMAINS}}` with the `## What Remains` content.
- Replace `{{OPEN_DECISIONS}}` with the `## Open Decisions` content.
- Replace `{{FILES_OF_RECORD}}` with the `## Files of Record` content.

**Conditional final section (terminal-phase detection from PE-3):**

**Non-terminal phase (NEXT_PHASE is non-empty):**
- Replace `{{NEXT_PHASE_ENTRY_PROMPT}}` with the following copy-paste-ready string:
  ```
  Resume project <active_project> at phase <NEXT_PHASE>.
  Read these files first, in order:
    1. .do/projects/<active_project>/project.md
    2. .do/projects/<active_project>/phases/<completed_phase_slug>/handoff.md
    3. .do/projects/<active_project>/phases/<NEXT_PHASE>/phase.md
  Then run: /do:project resume
  ```
- Strip the commented-out `## Project Completion Hint` block from the template (the `<!-- ## Project Completion Hint ... -->` block at the end of the template).

**Terminal phase (NEXT_PHASE is empty):**
- Replace the `## Next Phase Entry Prompt` heading and `{{NEXT_PHASE_ENTRY_PROMPT}}` slot (and its surrounding comment block) with:
  ```markdown
  ## Project Completion Hint

  This was the final phase. Run `/do:project complete` to finalise the project.
  ```
- Remove the original `{{NEXT_PHASE_ENTRY_PROMPT}}` slot.

If `N > 0` (from PE-4), append the backlog-promotion reminder line at the end of the rendered content:
```
<N> follow-ups flagged for backlog promotion; run `/do:backlog add` for each.
```

Write the rendered content to:
```
.do/projects/<active_project>/phases/<completed_phase_slug>/handoff.md
```

(Atomic write: temp file + rename to avoid partial writes.)

---

## PE-6: Return COMPLETE

Display:
```
Handoff artefact rendered: .do/projects/<active_project>/phases/<completed_phase_slug>/handoff.md
```

Return **COMPLETE**.

---

## Files

- **Template:** `@references/handoff-template.md` — Source template (owned by Task α; not modified here)
- **Output:** `.do/projects/<active_project>/phases/<completed_phase_slug>/handoff.md`
- **Inputs (read-only):**
  - `.do/projects/<active_project>/project.md`
  - `.do/projects/<active_project>/phases/<completed_phase_slug>/phase.md`
  - `.do/projects/<active_project>/phases/<completed_phase_slug>/waves/*/wave.md` (all leaf files)
  - `.do/projects/<active_project>/changelog.md`
