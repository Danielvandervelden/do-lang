# Phase 11: AI Council Integration - Research

**Researched:** 2026-04-13
**Domain:** Multi-model AI advisory reviews for task plans and implementations
**Confidence:** HIGH

## Summary

This phase integrates bidirectional AI council reviews into the `/do:task` workflow. The council reviews task plans after the refinement/grilling stage completes and reviews implementations after execution completes. Reviews are configurable per-project via `.do/config.json` and support multiple advisor models (Codex, Gemini) with runtime detection to prevent self-review.

The existing GSD council patterns provide a proven foundation: `codex-companion.mjs` for Codex invocation, `gemini` CLI for Gemini, file-path-based briefings (not inline content), parallel process execution with PID tracking, and structured verdict responses (LOOKS_GOOD, CONCERNS, RETHINK for plans; APPROVED, NITPICKS_ONLY, CHANGES_REQUESTED for code). The `do` package will adapt these patterns into self-contained scripts rather than depending on GSD commands.

**Primary recommendation:** Create `council-invoke.cjs` in `skills/do/scripts/` that handles advisor invocation, output capture, timeout management, and result parsing. Add `stage-council-plan.md` and `stage-council-code.md` reference files that orchestrate the review flow. Modify `stage-execute.md` and `stage-verify.md` to conditionally trigger council reviews based on config.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-33:** Plan review triggers after refinement/grilling stage completes, before execution
- **D-34:** Code review triggers after execution stage completes, before verification marks complete
- **D-35:** Both review points are toggleable via `.do/config.json` (`council_reviews.planning`, `council_reviews.execution`)
- **D-36:** Council invocation scripts live in `skills/do/scripts/` (e.g., `council-invoke.cjs`) — no dependency on GSD
- **D-37:** Scripts call external tools: `codex-companion.mjs` (from codex plugin) and `gemini` CLI (system-installed)
- **D-38:** `do` package is self-contained — orchestration logic lives in `do`, not in `~/.claude/get-shit-done/` or `~/.claude/commands/council/`
- **D-39:** `council_reviews.reviewer` config option with values: `"claude"`, `"codex"`, `"gemini"`, `"random"`, `"both"`
- **D-40:** Runtime detection prevents self-review — if `reviewer` matches current runtime, fall back to random
- **D-41:** Random selection uses: `python3 -c "import random; print('codex' if random.random() > 0.5 else 'gemini')"`
- **D-42:** Available reviewers depend on runtime:
  - In Claude Code: Codex and Gemini available
  - In Codex (Phase 12): Claude and Gemini available
- **D-43:** When `"both"` is selected, spawn two parallel processes (Codex + Gemini), synthesize results after both complete
- **D-44:** Briefing uses file paths, not inline content — advisors read files themselves (token-efficient)
- **D-45:** Briefing template at `references/council-brief.md` with placeholders (matches existing template patterns)
- **D-46:** Briefing template explains: what to evaluate, task markdown path, project.md path, files modified (for code review)

### Claude's Discretion
- Exact briefing template wording and structure
- How to synthesize results when both advisors are used
- Timeout values for advisor processes
- Error handling when an advisor fails or times out
- Format of council results section in task markdown

### Deferred Ideas (OUT OF SCOPE)
- **Phase 13: Workspace Customization** — Available AI CLIs detection during `/do:init`, `do-workspace.json` for cross-project settings
- **Future Enhancements** — Council for complex debugging, advisor preference learning
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| F-01 | Council reviews task plan before implementation (configurable) | Triggers after refinement/grilling (D-33), config toggle (D-35), briefing template (D-44-46), verdicts from existing GSD patterns |
| F-02 | Council reviews implementation after execution (configurable) | Triggers after execution (D-34), config toggle (D-35), code review verdicts (APPROVED/NITPICKS_ONLY/CHANGES_REQUESTED) from GSD council |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js child_process | Built-in | Spawn advisor CLI processes | Native, no dependencies |
| fs/promises | Built-in | Read/write briefing files, output capture | Native async I/O |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| codex-companion.mjs | 1.0.1 (plugin) | Invoke Codex tasks via structured API | Plan/code review with Codex |
| gemini CLI | 0.35.3 (system) | Invoke Gemini in plan/read-only mode | Plan/code review with Gemini |

### External Dependencies

| Tool | Path | Purpose | Invocation |
|------|------|---------|------------|
| codex-companion.mjs | `~/.claude/plugins/cache/openai-codex/codex/1.0.1/scripts/codex-companion.mjs` | Headless Codex invocation | `node <path> task --wait --prompt-file <brief>` |
| gemini | System PATH | Headless Gemini invocation | `cat <brief> \| gemini --prompt - --include-directories <workspace> --approval-mode plan -o text` |

**Installation:** No npm dependencies needed. Scripts use Node.js built-ins and shell calls to external CLIs.

**Version verification:** 
- codex-companion.mjs: 1.0.1 (verified via plugin cache structure)
- gemini CLI: 0.35.3 (verified via `gemini --version`)
- codex CLI: 0.118.0 (verified via `codex --version`)

## Architecture Patterns

### Recommended Project Structure

```
skills/do/
  scripts/
    council-invoke.cjs      # Core invocation logic (NEW)
  references/
    council-brief.md        # Briefing template (NEW)
    stage-execute.md        # Add council plan review trigger (MODIFY)
    stage-verify.md         # Add council code review trigger (MODIFY)
    task-template.md        # Add Council Review section (MODIFY)
```

### Pattern 1: Council Invocation Script

**What:** Self-contained Node.js script that handles advisor selection, runtime detection, process spawning, timeout management, and result parsing.

**When to use:** Called from stage reference files when council review is needed.

**Interface:**
```javascript
// council-invoke.cjs --type plan|code --task-file <path> [--reviewer <value>]
// Returns JSON: { advisor: string, verdict: string, findings: string[], recommendations: string[], raw: string }
```

**Example:**
```javascript
// Source: Adapted from GSD council patterns in ~/workspace/database/shared/council.md
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PLUGIN_ROOT = path.join(process.env.HOME, '.claude/plugins/cache/openai-codex/codex/1.0.1');
const CODEX_COMPANION = path.join(PLUGIN_ROOT, 'scripts/codex-companion.mjs');

// Runtime detection (per D-40)
const CURRENT_RUNTIME = process.env.CODEX_RUNTIME ? 'codex' : 'claude';

// Available reviewers exclude self (per D-42)
const AVAILABLE_REVIEWERS = ['codex', 'gemini'].filter(r => {
  if (CURRENT_RUNTIME === 'claude') return r !== 'claude';
  if (CURRENT_RUNTIME === 'codex') return r !== 'codex';
  return true;
});

function selectReviewer(configuredReviewer) {
  if (configuredReviewer === 'random') {
    const idx = Math.floor(Math.random() * AVAILABLE_REVIEWERS.length);
    return AVAILABLE_REVIEWERS[idx];
  }
  if (configuredReviewer === 'both') {
    return 'both';
  }
  if (AVAILABLE_REVIEWERS.includes(configuredReviewer)) {
    return configuredReviewer;
  }
  // Fallback to random if configured reviewer not available
  return selectReviewer('random');
}
```

### Pattern 2: File-Path Briefing Template

**What:** Markdown template with placeholders for task path, project.md path, and files modified. Advisors read files themselves.

**When to use:** All council reviews to minimize brief size and let advisors have full filesystem access.

**Example:**
```markdown
# Council Brief: {{REVIEW_TYPE}} Review

## CRITICAL RULES
- **DO NOT modify, create, or delete any files.** This is a READ-ONLY review.
- **You MUST cite evidence.** Reference specific file paths, line numbers, or code patterns.

## Project
- Name: {{PROJECT_NAME}}
- Workspace: {{WORKSPACE_PATH}}

## Task
Read this task file for full context:
{{TASK_FILE_PATH}}

## Project Context
Read this file for project conventions:
{{PROJECT_MD_PATH}}

{{#if IS_CODE_REVIEW}}
## Files Modified
These files were changed during execution. Review them for quality:
{{FILES_MODIFIED}}
{{/if}}

## Your Assessment
{{ASSESSMENT_INSTRUCTIONS}}

## Response Format
### Verdict
{{VERDICT_OPTIONS}}

### Key Findings
- [Finding — cite the file/line that supports this]

### Recommendations
- [Specific, actionable recommendation]
```

### Pattern 3: Parallel Advisor Execution

**What:** When `reviewer: "both"`, spawn Codex and Gemini as parallel background processes, wait for both, synthesize results.

**When to use:** Full council reviews where multiple perspectives are valuable.

**Example:**
```javascript
// Source: Adapted from GSD council review-plan.md Step 6
async function runBothAdvisors(briefPath, timeout) {
  const codexPromise = runAdvisor('codex', briefPath, timeout);
  const geminiPromise = runAdvisor('gemini', briefPath, timeout);
  
  const [codexResult, geminiResult] = await Promise.allSettled([codexPromise, geminiPromise]);
  
  return synthesizeResults(codexResult, geminiResult);
}

function synthesizeResults(codexResult, geminiResult) {
  // Agreement zones: both have same verdict
  // Disagreement zones: different verdicts
  // Unique insights: findings only one raised
  // Final verdict: weighted by agreement
}
```

### Anti-Patterns to Avoid

- **Inline content in briefs:** Never paste file contents into the brief. Advisors have filesystem access — give them paths. This is critical for token efficiency (per D-44).
- **Spawning nested agents:** Council scripts are invoked via Bash, not as Claude Agent calls. The flat hierarchy constraint (PROJECT.md) prohibits agent spawning.
- **Blocking on council results:** Council is advisory only — never block task progression on council verdict. Log results, Claude evaluates, proceeds.
- **Depending on GSD commands:** Per D-38, do not call `/council:ask-codex` or `/council:review-plan`. Adapt the patterns into self-contained scripts.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Codex invocation | Raw `codex exec` calls | `codex-companion.mjs` | Handles output budget, timeouts, process lifecycle |
| Process timeout | Manual setInterval polling | Background kill timer pattern | Proven pattern from GSD council |
| Verdict parsing | Regex parsing of freeform text | Structured response format + sentiment fallback | Advisors don't always follow format |
| Random selection | Math.random() | Python random.random() | Per D-41, use Python for consistency |

**Key insight:** The GSD council patterns have already solved the hard problems — process lifecycle, timeout management, output capture, rate limit retries for Gemini. Adapt these patterns, don't reinvent.

## Common Pitfalls

### Pitfall 1: AskUserQuestion After Skill Load

**What goes wrong:** AskUserQuestion fails silently in the same response turn as a Skill load.
**Why it happens:** Known Claude Code bug documented in project's CLAUDE.md.
**How to avoid:** Use inline text prompts for any user interaction in council flows. Never use AskUserQuestion.
**Warning signs:** Empty/undefined responses from AskUserQuestion calls.

### Pitfall 2: Shell Argument Expansion

**What goes wrong:** Brief content with special characters ($, `, ", etc.) breaks when passed as shell arguments.
**Why it happens:** Shell metacharacter interpretation.
**How to avoid:** Always write briefs to temp files, pass file paths. Use `--prompt-file` for Codex, stdin pipe for Gemini.
**Warning signs:** Truncated or garbled advisor input.

### Pitfall 3: Gemini Rate Limits

**What goes wrong:** Gemini returns 429 errors, breaking the review flow.
**Why it happens:** Free tier rate limits.
**How to avoid:** Implement retry with exponential backoff (5s, 10s). Pattern from GSD council ask-gemini.md.
**Warning signs:** Empty output files, error logs mentioning "429", "rate.limit", "quota".

### Pitfall 4: Empty Output Misclassified as Success

**What goes wrong:** Advisor process exits 0 but produces no output — treated as success.
**Why it happens:** Internal advisor errors don't always set exit code.
**How to avoid:** Always check output file is non-empty (`[ -s "$OUTFILE" ]`).
**Warning signs:** Council results section with empty findings.

### Pitfall 5: Self-Review in Cross-Runtime Scenarios

**What goes wrong:** Claude reviewing its own code, or Codex reviewing its own code.
**Why it happens:** Runtime detection not implemented or misconfigured.
**How to avoid:** Per D-40, detect runtime via `CODEX_RUNTIME` env var. Filter available reviewers accordingly.
**Warning signs:** Reviews with no actionable feedback, circular validation.

## Code Examples

Verified patterns from GSD council implementation:

### Codex Invocation via Companion Script

```javascript
// Source: ~/.claude/commands/council/ask-codex.md
const { spawn } = require('child_process');
const PLUGIN_ROOT = `${process.env.HOME}/.claude/plugins/cache/openai-codex/codex/1.0.1`;

async function invokeCodex(briefPath) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [
      `${PLUGIN_ROOT}/scripts/codex-companion.mjs`,
      'task',
      '--wait',
      '--prompt-file', briefPath
    ], { stdio: ['inherit', 'pipe', 'pipe'] });
    
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => stdout += d);
    proc.stderr.on('data', (d) => stderr += d);
    
    proc.on('close', (code) => {
      if (code === 0 && stdout.trim()) {
        resolve({ success: true, output: stdout });
      } else {
        resolve({ success: false, error: stderr || 'Empty output' });
      }
    });
  });
}
```

### Gemini Invocation with Retry

```bash
# Source: ~/.claude/commands/council/ask-gemini.md
MAX_RETRIES=2
ATTEMPT=0
TIMEOUT_SECS=90

while [ $ATTEMPT -le $MAX_RETRIES ]; do
  > "$OUTFILE"; > "$ERR_FILE"
  
  cat "$BRIEF_FILE" | gemini \
    --prompt - \
    --include-directories "$WORKSPACE" \
    --approval-mode plan \
    -o text > "$OUTFILE" 2>"$ERR_FILE" &
  GEMINI_PID=$!
  
  ( sleep $TIMEOUT_SECS && kill $GEMINI_PID 2>/dev/null ) &
  TIMER_PID=$!
  
  wait $GEMINI_PID 2>/dev/null
  EXIT_CODE=$?
  kill $TIMER_PID 2>/dev/null
  
  if [ $EXIT_CODE -eq 0 ] && [ -s "$OUTFILE" ]; then
    break
  fi
  
  if grep -qi "429\|rate.limit\|quota" "$ERR_FILE" 2>/dev/null; then
    ATTEMPT=$((ATTEMPT + 1))
    if [ $ATTEMPT -le $MAX_RETRIES ]; then
      BACKOFF=$((5 * (2 ** (ATTEMPT - 1))))
      sleep $BACKOFF
    fi
  else
    break
  fi
done
```

### Verdict Parsing with Sentiment Fallback

```javascript
// Source: ~/.claude/commands/council/review-plan.md Step 7
function parseVerdict(response) {
  // First, try structured format
  const verdictMatch = response.match(/###\s*Verdict\s*\n+(\w+)/i);
  if (verdictMatch) {
    const verdict = verdictMatch[1].toUpperCase();
    if (['LOOKS_GOOD', 'CONCERNS', 'RETHINK', 'APPROVED', 'NITPICKS_ONLY', 'CHANGES_REQUESTED'].includes(verdict)) {
      return verdict;
    }
  }
  
  // Fallback to sentiment analysis
  const lower = response.toLowerCase();
  if (lower.includes('rethink') || lower.includes('fundamentally') || lower.includes('wrong approach')) {
    return 'RETHINK';
  }
  if (lower.includes('concern') || lower.includes('risk') || lower.includes('issue') || lower.includes('problem')) {
    return 'CONCERNS';
  }
  if (lower.includes('looks good') || lower.includes('solid') || lower.includes('well-structured')) {
    return 'LOOKS_GOOD';
  }
  
  return 'CONCERNS'; // Default to cautious
}
```

### Council Results Section Format

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

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single model reviews | Multi-model council | GSD council integration | Diverse perspectives catch more issues |
| Inline content briefs | File-path briefs | GSD optimization | Reduces brief size, advisors have full context |
| Sequential advisor calls | Parallel execution | GSD milestone mode | Faster reviews, no serial bottleneck |

**Deprecated/outdated:**
- Raw `codex exec` calls: Use `codex-companion.mjs` instead (handles output budget exhaustion)
- `--timeout` flag for Gemini: macOS doesn't have `timeout` command, use background kill timer

## Open Questions

1. **Timeout Values**
   - What we know: GSD uses 180s floor, scaling with files_modified
   - What's unclear: Optimal timeout for task-level reviews (smaller scope than milestone plans)
   - Recommendation: Start with 90s for single-file tasks, 180s for multi-file

2. **Council Results Persistence**
   - What we know: GSD logs to `~/workspace/database/projects/{project}/council/`
   - What's unclear: Should `do` log there too, or only in task markdown?
   - Recommendation: Primary in task markdown (per D-46), optional database log for audit trail

3. **Autonomy Level**
   - What we know: GSD council is advisory-only, Claude evaluates and applies fixes
   - What's unclear: Should `do` auto-apply NITPICKS_ONLY fixes?
   - Recommendation: Per PROJECT.md flat hierarchy, Claude evaluates inline — no additional agent spawning

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| codex-companion.mjs | Council invocation | Yes | 1.0.1 | None (skip Codex reviews) |
| gemini CLI | Council invocation | Yes | 0.35.3 | None (skip Gemini reviews) |
| Python 3 | Random selection (D-41) | Yes | 3.x | JavaScript Math.random() |
| Node.js | Script execution | Yes | 22.x | Required |

**Missing dependencies with no fallback:**
- None identified

**Missing dependencies with fallback:**
- If Codex plugin missing: Skip Codex reviews, log warning
- If Gemini CLI missing: Skip Gemini reviews, log warning

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (node:test) |
| Config file | None (use node --test) |
| Quick run command | `node --test skills/do/scripts/__tests__/council-invoke.test.cjs` |
| Full suite command | `node --test skills/do/scripts/__tests__/*.test.cjs` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| F-01 | Plan review triggers after refinement, uses config toggle | unit | `node --test skills/do/scripts/__tests__/council-invoke.test.cjs -x` | Wave 0 |
| F-01 | Briefing template populates correctly | unit | `node --test skills/do/scripts/__tests__/council-invoke.test.cjs -x` | Wave 0 |
| F-02 | Code review triggers after execution, uses config toggle | unit | `node --test skills/do/scripts/__tests__/council-invoke.test.cjs -x` | Wave 0 |
| F-02 | Results written to task markdown | integration | Manual verification | Wave 0 |

### Sampling Rate

- **Per task commit:** `node --test skills/do/scripts/__tests__/council-invoke.test.cjs`
- **Per wave merge:** Full test suite
- **Phase gate:** Manual verification of F-01 and F-02 acceptance criteria

### Wave 0 Gaps

- [ ] `skills/do/scripts/__tests__/council-invoke.test.cjs` — covers runtime detection, reviewer selection, output parsing
- [ ] Mock Codex/Gemini responses for deterministic testing

## Sources

### Primary (HIGH confidence)

- `~/workspace/database/shared/council.md` — Existing GSD council patterns, CLI invocations, verdict definitions
- `~/.claude/commands/council/ask-codex.md` — Codex invocation via companion script
- `~/.claude/commands/council/ask-gemini.md` — Gemini invocation with retry/backoff
- `~/.claude/commands/council/review-plan.md` — Full orchestration pattern, brief template, verdict parsing

### Secondary (MEDIUM confidence)

- `.planning/phases/11-ai-council-integration/11-CONTEXT.md` — User decisions D-33 through D-46
- `skills/do/references/stage-execute.md` — Current execution flow (integration point)
- `skills/do/references/stage-verify.md` — Current verification flow (integration point)

### Tertiary (LOW confidence)

- None — all patterns verified against existing GSD implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Uses existing proven patterns from GSD council
- Architecture: HIGH — Adapts verified patterns, decisions locked in CONTEXT.md
- Pitfalls: HIGH — Documented from GSD council operational experience

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (30 days — stable domain, advisor CLIs may update)
