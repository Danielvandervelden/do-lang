# Phase 11: AI Council Integration - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Integrate bidirectional AI council reviews into the `/do:task` workflow. Council reviews task plans after refinement and implementations after execution. Reviews are configurable per-project and support multiple advisor models (Codex, Gemini, Claude) with automatic self-review prevention.

**Delivers:**
- Council review integration at two points: plan review (after refinement) and code review (after execution)
- Per-project configuration via `.do/config.json` (`council_reviews.*`)
- Advisor invocation scripts self-contained in `skills/do/scripts/`
- Briefing template system for consistent reviews
- Runtime detection to prevent self-review
- Parallel advisor execution when "both" is selected

</domain>

<decisions>
## Implementation Decisions

### Integration Points
- **D-33:** Plan review triggers after refinement/grilling stage completes, before execution
- **D-34:** Code review triggers after execution stage completes, before verification marks complete
- **D-35:** Both review points are toggleable via `.do/config.json` (`council_reviews.planning`, `council_reviews.execution`)

### Invocation & Dependencies
- **D-36:** Council invocation scripts live in `skills/do/scripts/` (e.g., `council-invoke.cjs`) — no dependency on GSD
- **D-37:** Scripts call external tools: `codex-companion.mjs` (from codex plugin) and `gemini` CLI (system-installed)
- **D-38:** `do` package is self-contained — orchestration logic lives in `do`, not in `~/.claude/get-shit-done/` or `~/.claude/commands/council/`

### Reviewer Selection
- **D-39:** `council_reviews.reviewer` config option with values: `"claude"`, `"codex"`, `"gemini"`, `"random"`, `"both"`
- **D-40:** Runtime detection prevents self-review — if `reviewer` matches current runtime, fall back to random
- **D-41:** Random selection uses: `python3 -c "import random; print('codex' if random.random() > 0.5 else 'gemini')"`
- **D-42:** Available reviewers depend on runtime:
  - In Claude Code: Codex and Gemini available
  - In Codex (Phase 12): Claude and Gemini available
- **D-43:** When `"both"` is selected, spawn two parallel processes (Codex + Gemini), synthesize results after both complete

### Briefing Template
- **D-44:** Briefing uses file paths, not inline content — advisors read files themselves (token-efficient)
- **D-45:** Briefing template at `references/council-brief.md` with placeholders (matches existing template patterns)
- **D-46:** Briefing template explains: what to evaluate, task markdown path, project.md path, files modified (for code review)

### Claude's Discretion
- Exact briefing template wording and structure
- How to synthesize results when both advisors are used
- Timeout values for advisor processes
- Error handling when an advisor fails or times out
- Format of council results section in task markdown

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### External Documentation
- `~/workspace/database/shared/council.md` — Existing GSD council patterns, CLI invocations, verdict definitions, brief template approach

### Prior Phase Context
- `.planning/phases/05-task-creation-refine-agent/05-CONTEXT.md` — D-01 through D-12: task markdown structure, stage tracking
- `.planning/phases/07-context-decision-implementation/07-CONTEXT.md` — D-18 through D-22: stage transitions, execution flow
- `.planning/phases/08-verification-agent/08-CONTEXT.md` — D-23 through D-32: verification flow, quality checks, completion gating

### Existing Implementation
- `skills/do/SKILL.md` — Current skill file; council hooks into routing table
- `skills/do/references/stage-execute.md` — Execution stage; council code review triggers after this
- `skills/do/references/stage-verify.md` — Verification stage; follows council code review
- `skills/do/references/task-template.md` — Task markdown; may need Council Results section

### Project Constraints
- `.planning/PROJECT.md` — Flat hierarchy constraint (council calls must not spawn nested agents), token efficiency core value
- `.planning/REQUIREMENTS.md` — F-01 (plan review), F-02 (implementation review) acceptance criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `stage-execute.md`, `stage-verify.md` — Stage reference file pattern for council stages
- `task-template.md` — Template with placeholders pattern for briefing template
- Existing GSD council invocation patterns (codex-companion.mjs, gemini CLI) — adapt, don't depend

### Established Patterns
- YAML frontmatter stage tracking (`stage:`, `stages.<stage>:`)
- File paths in templates, not inline content
- Parallel process execution with PID tracking and timeout kill timers
- JSON config files with boolean toggles

### Integration Points
- `.do/config.json` gains `council_reviews` section: `planning`, `execution`, `reviewer`
- Task markdown gains Council Results section (after Execution Log, before Verification Results)
- `stage-execute.md` triggers council code review before transitioning to verification
- New logic needed after refinement/grilling to trigger council plan review

</code_context>

<specifics>
## Specific Ideas

### Config Schema Addition
```json
{
  "council_reviews": {
    "planning": true,
    "execution": true,
    "reviewer": "random"
  }
}
```

### Council Results Section in Task Markdown
```markdown
## Council Review

### Plan Review
- **Reviewer:** Codex
- **Verdict:** LOOKS_GOOD
- **Notes:** Plan covers all requirements. Consider adding error handling for edge case X.

### Code Review
- **Reviewer:** Gemini
- **Verdict:** APPROVED
- **Notes:** Implementation follows conventions. Minor suggestion: extract utility function.
```

### Runtime Detection
```javascript
// Detect which runtime we're in
const CURRENT_RUNTIME = process.env.CODEX_RUNTIME ? 'codex' : 'claude';

// Get available reviewers (exclude self)
const AVAILABLE_REVIEWERS = ['claude', 'codex', 'gemini'].filter(r => r !== CURRENT_RUNTIME);
```

</specifics>

<deferred>
## Deferred Ideas

### Phase 13: Workspace Customization
- **Available AI CLIs detection** — During `/do:init`, ask user what AI CLIs they have installed (codex, gemini, claude-cli, etc.) so council can dynamically detect available advisors
- **do-workspace.json** — Workspace-level config file for cross-project settings including available AI tools

### Future Enhancements
- **Council for complex debugging** — Invoke council during `/do:debug` for second opinions on hypotheses
- **Advisor preference learning** — Track which advisor gives better feedback over time, weight selection accordingly

</deferred>

---

*Phase: 11-ai-council-integration*
*Context gathered: 2026-04-13 via discuss-phase*
