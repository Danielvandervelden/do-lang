---
name: stage-wave-verify
description: "Wave verification block for /do:project. Spawns <<DO:AGENT_PREFIX>>-verifier against wave.md. Project-aware failure paths (retry/debug/abandon wave/out_of_scope). Does NOT reference /do:task or active_task."
---

<<DO:IF CODEX>>
**Agent authorization:** The caller workflow has authorized spawning <<DO:AGENT_PREFIX>>-verifier
referenced in this file. Spawn it as a subagent — do NOT execute its work inline. If
spawning fails, STOP and report; do not fall back to inline execution.

<<DO:ENDIF>>
# Wave Verification Stage

This reference file is loaded by `skills/project.md` `wave next` after `stage-wave-code-review.md` returns VERIFIED. It spawns `<<DO:AGENT_PREFIX>>-verifier` against the wave's `wave.md` file and handles project-aware failure paths.

**Caller contract:** The caller provides `<wave_path>` = abs path to `wave.md`, `<active_project>` slug, `<phase_slug>`, and `<wave_slug>`. When this stage returns PASS + UAT confirmed, wave status is set to `completed` via `project-state.cjs`, `active_wave` is cleared from `phase.md`, changelog is appended, and backlog cleanup fires if applicable. On failure, the stage presents four project-aware options — retry / debug / abandon wave / mark out_of_scope — and surfaces them to the user. This stage does NOT use `/do:task` or `/do:continue`.

---

## WV-0: Resume Guard

Check if wave verification already completed:

```bash
node <<DO:SCRIPTS_PATH>>/update-task-frontmatter.cjs check '<wave_path>' status==completed
```

**If wave already `completed` (exit 1):** Skip this stage. Return control to caller.

---

## WV-1: Spawn <<DO:AGENT_PREFIX>>-verifier

<<DO:IF CLAUDE>>
```javascript
Agent({
  description: "Verify wave implementation",
  subagent_type: "<<DO:AGENT_PREFIX>>-verifier",
  model: "<models.overrides.verifier || models.overrides.code_reviewer || models.default>",
  prompt: `
Run verification flow for this wave.

Target file: <wave_path>

The target file is a wave.md for a /do:project wave. It has the same Approach,
Execution Log, and Verification Results sections as a task file. Run the full
verification: approach checklist, quality checks, and UAT.

At the end of verification, if the target file's frontmatter has an
\`unresolved_concerns: []\` array, write any concerns you cannot close using the
{title, body, severity} shape. If it has a \`discovered_followups: []\` array,
append discoveries using the {title, body, promote} shape. If it has a
\`wave_summary\` key, write a one-sentence summary of what shipped.

These writes are frontmatter-presence-gated — only write if the arrays/keys exist.
`
})
```
<<DO:ENDIF>>
<<DO:IF CODEX>>
Spawn the <<DO:AGENT_PREFIX>>-verifier subagent with model `<models.overrides.verifier || models.overrides.code_reviewer || models.default>` and the description "Verify wave implementation". Pass the following prompt:

Run verification flow for this wave.

Target file: <wave_path>

The target file is a wave.md for a /do:project wave. It has the same Approach,
Execution Log, and Verification Results sections as a task file. Run the full
verification: approach checklist, quality checks, and UAT.

At the end of verification, if the target file's frontmatter has an
`unresolved_concerns: []` array, write any concerns you cannot close using the
{title, body, severity} shape. If it has a `discovered_followups: []` array,
append discoveries using the {title, body, promote} shape. If it has a
`wave_summary` key, write a one-sentence summary of what shipped.

These writes are frontmatter-presence-gated — only write if the arrays/keys exist.
<<DO:ENDIF>>

Handle result:

---

## WV-2: Handle Verifier Result

### If PASS (UAT confirmed)

<<DO:IF CODEX>>
**Codex cleanup:** The <<DO:AGENT_PREFIX>>-verifier subagent has completed and its output has been fully consumed. Close (dismiss) the <<DO:AGENT_PREFIX>>-verifier subagent now to free the thread slot before proceeding to WV-3.
<<DO:ENDIF>>

Proceed to WV-3 (success path).

### If FAIL (quality check failure, incomplete checklist, or UAT failed)

Present project-aware failure options:

```
Wave verification failed.

Options:
1. Retry — re-run <<DO:AGENT_PREFIX>>-verifier against the updated wave (describe what was fixed)
2. Debug — spawn /do:debug to investigate the failure
3. Abandon wave — mark wave abandoned (`/do:project wave abandon <slug>`)
4. Mark out of scope — set wave scope to out_of_scope (deferred, does not count toward phase completion)

Choose option (1-4):
```

Wait for user response:

<<DO:IF CODEX>>
**Codex cleanup:** The <<DO:AGENT_PREFIX>>-verifier subagent has completed and its output has been fully consumed. Close (dismiss) the <<DO:AGENT_PREFIX>>-verifier subagent now to free the thread slot before executing the chosen failure path.
<<DO:ENDIF>>

- **Option 1 (Retry):** Ask "What was fixed?" — log answer in `wave.md` Execution Log as a deviation note, then return to WV-1 and re-spawn <<DO:AGENT_PREFIX>>-verifier.
- **Option 2 (Debug):** Display: "Run `/do:debug` to investigate. After debugging, return to this wave by re-invoking `/do:project wave next`."
- **Option 3 (Abandon wave):**
  - Call `project-state.cjs abandon wave <phase_slug>/<wave_slug> --project <active_project>`
  - Append changelog: `<ISO> abandon:wave:<wave_slug>: verification-failed`
  - Display: "Wave `<wave_slug>` abandoned. Run `/do:project wave next` to start the next planning wave, or `/do:project wave new <slug>` to create a replacement."
- **Option 4 (Out of scope):** The authoritative state machine forbids `in_scope → out_of_scope` while the wave is `in_progress`. This option therefore takes TWO legal transitions on the `wave.md` leaf file via `project-state.cjs`. Phase-completion checks read leaf files directly (see `skills/project.md` §Authoritative state reads), so no parent-index dual-write is needed. Run in order:
  1. **Transition wave status `in_progress → blocked`** (legal per `project-state-machine.md` §(c)):
     ```bash
     node <<DO:SCRIPTS_PATH>>/project-state.cjs set wave <phase_slug>/<wave_slug> status=blocked --project <active_project>
     ```
  2. **Transition wave scope `in_scope → out_of_scope`** (now legal because status is `blocked`):
     ```bash
     node <<DO:SCRIPTS_PATH>>/project-state.cjs set wave <phase_slug>/<wave_slug> scope=out_of_scope --project <active_project>
     ```
     (The mutation form is the unified `<status=X|scope=X>` positional arg — no separate `--scope` flag exists. `opSet`'s `SCOPE_TRANSITIONS` table enforces the `in_scope → out_of_scope` guard against the wave's current status, which is why step 1 transitioned to `blocked` first.)
  3. **Clear `active_wave` in `phase.md`** (atomic temp-file + rename) so the phase is no longer pointed at the now-out-of-scope wave.
  4. **Append changelog:**
     ```
     <ISO> status-change:wave:<wave_slug>: in_progress -> blocked (verification-failed, pre-out-of-scope)
     <ISO> scope-change:wave:<wave_slug>: in_scope -> out_of_scope (verification-failed)
     ```
  5. Display: "Wave `<wave_slug>` marked out of scope (status: blocked). It will not count toward phase completion. Run `/do:project wave next` to continue."

---

## WV-3: Success Path — Advance Wave State

1. **Set wave `completed`:**
   ```bash
   node <<DO:SCRIPTS_PATH>>/project-state.cjs set wave <phase_slug>/<wave_slug> status=completed --project <active_project>
   ```

2. **Clear `active_wave` in `phase.md`** (atomic temp-file + rename):
   ```bash
   node <<DO:SCRIPTS_PATH>>/update-task-frontmatter.cjs set '.do/projects/<active_project>/phases/<phase_slug>/phase.md' active_wave=null
   ```

3. **Append changelog:**
   ```
   <ISO> complete:wave:<wave_slug>  in_progress -> completed  reason: /do:project wave next verify pass
   ```

4. **Backlog cleanup:** read `wave.md` `backlog_item`. If non-null:
   - Invoke `/do:backlog done <id>`. Log: "Removed backlog item `<id>` from BACKLOG.md."

5. **Display completion:**
   ```
   Wave `<wave_slug>` complete.

   Run `/do:project wave next` to start the next planning wave, or
   `/do:project phase complete` if all in-scope waves are done.
   ```

6. Return control to caller.
