# Phase 10: Debug Mode - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement `/do:debug` command that provides a structured debugging workflow separate from task execution. Users can investigate bugs using a scientific method approach with hypothesis tracking, evidence accumulation, and elimination of dead ends.

**Delivers:**
- `/do:debug` skill entry point
- Debug session tracking in `.do/debug/`
- Scientific method workflow: gathering → investigating → fixing → verifying → resolved
- Session resume after `/clear` with full context reconstruction
- Optional task linking with findings sync

</domain>

<decisions>
## Implementation Decisions

### Session Structure
- **D-40:** One file per session — `.do/debug/YYMMDD-<slug>.md` format, mirrors task pattern. Easy to track multiple historical sessions.
- **D-41:** Rich state frontmatter for machine-parseable resume:
  ```yaml
  status: gathering | investigating | fixing | verifying | awaiting_human_verify | resolved
  trigger: "verbatim user input"
  created: [ISO timestamp]
  updated: [ISO timestamp]
  current_hypothesis: [active theory being tested]
  task_ref: [optional link to active task]
  ```

### Scientific Method Flow
- **D-42:** Adopt GSD debug pattern — iterative loop with elimination tracking. One hypothesis at a time: form → test → confirm/reject → repeat or conclude.
- **D-43:** Section structure with clear update rules:
  - **Current Focus** (OVERWRITE) — hypothesis, test, expecting, next_action. Always reflects NOW.
  - **Symptoms** (IMMUTABLE after gathering) — expected, actual, errors, reproduction, started.
  - **Eliminated** (APPEND only) — disproved hypotheses with evidence. Prevents re-exploring dead ends after `/clear`.
  - **Evidence** (APPEND only) — facts discovered during investigation.
  - **Resolution** (OVERWRITE) — root_cause, fix, verification, files_changed.
- **D-44:** User confirms fix before marking resolved — after self-verification passes, status moves to `awaiting_human_verify` and prompts user. Only mark `resolved` after explicit confirmation.

### Session Lifecycle
- **D-45:** One active debug session at a time — focus on one bug. Matches `/do:task` constraint pattern.
- **D-46:** Block with status when running `/do:debug` with active session:
  ```
  Active debug: YYMMDD-slug.md (status: investigating)
  Current hypothesis: [from file]
  
  Options:
  - Continue — Resume this session
  - Close — Mark as abandoned, start fresh
  - Force new — Keep this session, start another (override constraint)
  ```
- **D-47:** Resume summary after `/clear` — display current hypothesis + last evidence + next_action from debug file, then ask to continue. Matches Phase 9 pattern (D-35).

### Task Integration
- **D-48:** Optional `task_ref` field in frontmatter — links debug session to an active task. Independent by default.
- **D-49:** On resolution, offer to append findings — prompt: "Copy root cause + fix to task context?" User decides whether to sync. Preserves task document as source of truth.

### Claude's Discretion
- Debug slug generation from trigger text
- Exact wording of symptom gathering questions
- How to format resume summary (which evidence entries to show)
- Whether to suggest likely hypotheses based on symptoms

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### GSD Debug Pattern (source of truth)
- `~/.claude/get-shit-done/templates/DEBUG.md` — GSD's debug file template with section rules and lifecycle. MUST follow this structure.
- `~/.claude/get-shit-done/templates/debug-subagent-prompt.md` — GSD's debug agent prompt pattern

### Prior Phase Context
- `.planning/phases/05-task-creation-refine-agent/05-CONTEXT.md` — D-01: Comprehensive problem statements; D-11/D-12: Active task blocking pattern
- `.planning/phases/07-context-decision-implementation/07-CONTEXT.md` — D-19: Conditional reference file loading by stage
- `.planning/phases/09-task-resume/09-CONTEXT.md` — D-35: Resume summary pattern; D-39: Missing reference handling

### Existing Implementation
- `skills/do/SKILL.md` — Main skill file; `/do:debug` routing to be added
- `skills/do/references/stage-*.md` — Pattern for stage-specific reference files
- `skills/do/references/task-template.md` — Template pattern to mirror for debug-template.md

### Project Constraints
- `.planning/PROJECT.md` — Token efficiency core value, flat hierarchy constraint
- `.planning/REQUIREMENTS.md` — TS-12 acceptance criteria for debug mode

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Stage reference file pattern (`stage-grill.md`, `stage-execute.md`, `stage-verify.md`) — debug could use `stage-debug.md` or status-based routing
- `resume-preamble.md` — Shared resume logic that can be adapted for debug resume
- Template file pattern in `references/` — debug-template.md for session structure

### Established Patterns
- YAML frontmatter for machine-parseable state
- Inline text prompts for user interaction (not AskUserQuestion)
- Status-based routing in SKILL.md
- APPEND vs OVERWRITE section rules (from GSD debug pattern)

### Integration Points
- `.do/config.json` could track `active_debug` similar to `active_task`
- Debug findings can sync to task via `task_ref` field
- SKILL.md routing table needs `/do:debug` entry

</code_context>

<specifics>
## Specific Ideas

- Debug file naming: `YYMMDD-<slug>.md` where slug is kebab-cased from first few words of trigger
- Status flow: `gathering → investigating → fixing → verifying → awaiting_human_verify → resolved`
- Resume detection: Check if `trigger` field appears in conversation context; if not, assume `/clear` was run
- Archive resolved sessions: Move to `.do/debug/resolved/` on completion (optional, could just leave in place)
- Symptom gathering: Ask targeted questions like GSD does — expected, actual, errors, reproduction, when it started
- Evidence format: Keep entries brief — `checked: X, found: Y, implication: Z` (one line each)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-debug-mode*
*Context gathered: 2026-04-13 via discuss-phase*
