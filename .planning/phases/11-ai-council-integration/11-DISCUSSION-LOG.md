# Phase 11: AI Council Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-13
**Phase:** 11-ai-council-integration
**Areas discussed:** Integration points, Invocation method, Bidirectional pattern, Config & briefing

---

## Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Integration points | Where in the /do:task flow? After refinement (plan review), after execution (code review), or both? | |
| Invocation method | Reuse existing council skills (codex-companion.mjs, gemini CLI) or build do-specific invocation? | |
| Bidirectional pattern | How does 'Claude reviews Codex, Codex reviews Claude' work? Runtime detection? Always opposite model? | |
| Config & briefing | What goes in council_reviews config? What context gets sent in the briefing template? | |

**User's choice:** All four areas selected

**Notes:** User also suggested: "Maybe add Gemini? Phase 13 we wanted to do a do.workspace file. During /do:init, ask the user what AI CLIs they have available so council can look what's available and ask which ones to use."

---

## Integration Points

| Option | Description | Selected |
|--------|-------------|----------|
| Both stages (Recommended) | Plan review after refinement/grilling, code review after execution. Matches GSD pattern. | |
| Code review only | Skip plan review, only review implementation. Faster for small tasks. | |
| User chooses per-task | Ask during /do:task whether to include council for this specific task. | |

**User's choice:** Both stages, but configurable per-project via `.do/config.json`

**Notes:** "That's in the project configuration, right? Should be in <project>/.do/config.json. But yes plan review and after execution but these should be configurable per project."

---

## Invocation Method

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse existing (Recommended) | Call codex-companion.mjs and gemini CLI directly. Less code, already proven to work. | |
| Do-specific wrappers | Create scripts/council-codex.cjs, scripts/council-gemini.cjs. More control, but duplicates work. | |
| Abstract adapter | Single scripts/council-invoke.cjs that routes to available advisors. Future-proofs for more models. | |

**User's choice:** Reuse the approach, but include scripts in the `do` package itself

**Notes:** "We can use it, just make sure that this is in OUR package because we're going to remove GSD after this. We shouldn't be dependent on GSD for doing this obviously."

---

## Bidirectional Pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Always use Codex as reviewer | Simple: Claude executes, Codex reviews. Defer Codex->Claude until Phase 12 (Codex Adapter). | |
| Track executor in task markdown | Task records which runtime executed. Reviewer = opposite runtime. Works when Codex support lands. | |
| User selects reviewer | Ask during task creation which advisor should review. More control, more friction. | |

**User's choice:** Config-based selection with 5 options: claude, codex, gemini, random, both

**Notes:** "Auto AI review should be a boolean flag set in project config.json and WHICH ai to use should use one out of 4 options: claude, codex, gemini or random. We shouldn't be able to select the one we're using to build. If that one's selected we should do random instead. And random should be: use python to generate a random number between 0 and 1 and if it's > 0.50 use one and if less the other."

User later added: "Can we add 'both' also? We should be spawning 2 subagents in parallel if that happens so they can review both at the same time."

---

## Config & Briefing

| Option | Description | Selected |
|--------|-------------|----------|
| Paths only (Recommended) | Send task markdown path + project.md path. Advisors read files themselves. Token-efficient. | |
| Task summary inline | Include problem statement and approach in briefing. Faster for advisor but costs tokens. | |
| Full task content | Paste entire task markdown into briefing. No file reads needed but expensive. | |

**User's choice:** Paths only

**Notes:** "Paths seems good. We can have a template explaining what they are supposed to do and where they can find the task documentation."

### Briefing Template Location

| Option | Description | Selected |
|--------|-------------|----------|
| references/council-brief.md (Recommended) | Single template file with placeholders. Same pattern as task-template.md. | |
| Separate plan/code templates | references/council-plan-brief.md and council-code-brief.md. More specific but more files. | |
| Inline in stage files | Embed briefing template directly in stage-execute.md and new council stage. Less indirection. | |

**User's choice:** references/council-brief.md (Recommended)

---

## Claude's Discretion

- Exact briefing template wording and structure
- How to synthesize results when both advisors are used
- Timeout values for advisor processes
- Error handling when an advisor fails or times out
- Format of council results section in task markdown

---

## Deferred Ideas

- **Available AI CLIs detection** — During /do:init, detect installed AI tools (Phase 13: Workspace Customization)
- **do-workspace.json** — Workspace-level config file for cross-project settings (Phase 13)
