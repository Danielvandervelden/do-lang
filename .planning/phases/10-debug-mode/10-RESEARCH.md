# Phase 10: Debug Mode - Research

**Researched:** 2026-04-13
**Domain:** Debugging workflow, session state management, scientific method patterns
**Confidence:** HIGH

## Summary

Phase 10 implements `/do:debug` as a structured debugging workflow separate from task execution. The implementation closely mirrors the existing task workflow patterns (YAML frontmatter, stage-based routing, inline prompts) but adapts them for a debugging-specific lifecycle: gathering symptoms, investigating hypotheses, fixing, and verifying.

The GSD debug pattern (`~/.claude/get-shit-done/templates/DEBUG.md`) provides the canonical template structure with section rules (OVERWRITE vs APPEND-only) that prevent re-investigating dead ends after `/clear`. The user's decisions (D-40 through D-49) specify the exact behavior: one file per session, rich frontmatter for resume, scientific method flow, user confirmation before marking resolved, and optional task linking.

**Primary recommendation:** Implement debug mode by adapting existing task patterns (resume-preamble.md, stage reference files, config.json active tracking) for the debug-specific lifecycle, using `.do/debug/` for session storage with the GSD DEBUG.md template structure.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Session Structure:**
- **D-40:** One file per session -- `.do/debug/YYMMDD-<slug>.md` format, mirrors task pattern
- **D-41:** Rich state frontmatter for machine-parseable resume:
  ```yaml
  status: gathering | investigating | fixing | verifying | awaiting_human_verify | resolved
  trigger: "verbatim user input"
  created: [ISO timestamp]
  updated: [ISO timestamp]
  current_hypothesis: [active theory being tested]
  task_ref: [optional link to active task]
  ```

**Scientific Method Flow:**
- **D-42:** Adopt GSD debug pattern -- iterative loop with elimination tracking. One hypothesis at a time: form -> test -> confirm/reject -> repeat or conclude.
- **D-43:** Section structure with clear update rules:
  - **Current Focus** (OVERWRITE) -- hypothesis, test, expecting, next_action. Always reflects NOW.
  - **Symptoms** (IMMUTABLE after gathering) -- expected, actual, errors, reproduction, started.
  - **Eliminated** (APPEND only) -- disproved hypotheses with evidence. Prevents re-exploring dead ends after `/clear`.
  - **Evidence** (APPEND only) -- facts discovered during investigation.
  - **Resolution** (OVERWRITE) -- root_cause, fix, verification, files_changed.
- **D-44:** User confirms fix before marking resolved -- after self-verification passes, status moves to `awaiting_human_verify` and prompts user. Only mark `resolved` after explicit confirmation.

**Session Lifecycle:**
- **D-45:** One active debug session at a time -- focus on one bug. Matches `/do:task` constraint pattern.
- **D-46:** Block with status when running `/do:debug` with active session:
  ```
  Active debug: YYMMDD-slug.md (status: investigating)
  Current hypothesis: [from file]
  
  Options:
  - Continue -- Resume this session
  - Close -- Mark as abandoned, start fresh
  - Force new -- Keep this session, start another (override constraint)
  ```
- **D-47:** Resume summary after `/clear` -- display current hypothesis + last evidence + next_action from debug file, then ask to continue. Matches Phase 9 pattern (D-35).

**Task Integration:**
- **D-48:** Optional `task_ref` field in frontmatter -- links debug session to an active task. Independent by default.
- **D-49:** On resolution, offer to append findings -- prompt: "Copy root cause + fix to task context?" User decides whether to sync. Preserves task document as source of truth.

### Claude's Discretion
- Debug slug generation from trigger text
- Exact wording of symptom gathering questions
- How to format resume summary (which evidence entries to show)
- Whether to suggest likely hypotheses based on symptoms

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TS-12 | `/do:debug` provides structured debugging for issues | GSD DEBUG.md template provides exact section structure; D-40 through D-49 specify lifecycle and UX |
| TS-12.1 | Scientific method: hypothesis -> test -> confirm/reject | D-42 specifies iterative loop; GSD template has `<lifecycle>` section with exact flow |
| TS-12.2 | Creates debug session in `.do/debug/` | D-40 specifies filename format `YYMMDD-<slug>.md` |
| TS-12.3 | Documents debugging steps and findings | D-43 specifies section structure with APPEND-only Evidence and Eliminated |
| TS-12.4 | Separate from task workflow (can run independently) | D-48 makes task_ref optional; session lifecycle is self-contained |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | 22.x | Runtime for scripts | Engine already specified in package.json (>=16.7.0); Node test runner available |
| fs/path | built-in | File operations | Standard Node.js modules for debug file management |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| yaml | N/A | Frontmatter parsing | Not needed -- existing scripts use JSON.parse and manual parsing |
| node:test | built-in | Testing | Established pattern from load-task-context.test.cjs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual YAML parsing | `js-yaml` package | Extra dependency; manual approach works for simple frontmatter |
| Dedicated debug folder | Reuse `.do/tasks/` | Separate folder makes debug sessions distinct from tasks; cleaner |

**Installation:**
No additional packages required. Uses Node.js built-in modules only.

## Architecture Patterns

### Recommended Project Structure
```
.do/
  config.json          # Add active_debug field
  tasks/               # Existing task storage
  debug/               # NEW: Debug session storage
    YYMMDD-slug.md     # Active/historical sessions
```

### Pattern 1: Session State File
**What:** Single markdown file with YAML frontmatter tracking full debug state
**When to use:** Every debug session
**Example:**
```yaml
---
status: investigating
trigger: "Login form shows 'undefined' error on submit"
created: 2026-04-13T10:30:00Z
updated: 2026-04-13T11:45:00Z
current_hypothesis: "API response shape mismatch"
task_ref: null
---

## Current Focus

hypothesis: API response has nested error object, code expects flat string
test: Console.log API response in onSubmit handler
expecting: If nested, we'll see {error: {message: "..."}} instead of {error: "..."}
next_action: Add console.log and reproduce

## Symptoms

expected: Form submits successfully or shows error message
actual: Shows "undefined" instead of error text
errors: TypeError: Cannot read property 'message' of undefined
reproduction: Fill form with invalid data, click submit
started: After API v2 migration yesterday

## Eliminated

- hypothesis: Network failure causes undefined
  evidence: Network tab shows 200 response with valid JSON
  timestamp: 2026-04-13T11:00:00Z

## Evidence

- timestamp: 2026-04-13T10:45:00Z
  checked: Browser console during form submit
  found: API returns {error: {code: "INVALID", message: "Bad email"}}
  implication: Response shape changed, frontend expects error as string

## Resolution

root_cause: 
fix: 
verification: 
files_changed: []
```

### Pattern 2: Active Session Blocking
**What:** Check config.json for `active_debug` before starting new session
**When to use:** Every `/do:debug` invocation
**Example:**
```javascript
// In debug-start.cjs or inline in skill
const config = JSON.parse(fs.readFileSync('.do/config.json'));
if (config.active_debug) {
  const debugFile = fs.readFileSync(`.do/debug/${config.active_debug}`);
  // Display blocking prompt with options
}
```

### Pattern 3: Section Update Rules
**What:** Explicit rules for how each section can be modified
**When to use:** Every debug file update
**Rules from D-43:**

| Section | Rule | Implementation |
|---------|------|----------------|
| Frontmatter (status, updated, current_hypothesis) | OVERWRITE | Replace on each status change |
| Frontmatter (trigger, created) | IMMUTABLE | Never modify after creation |
| Current Focus | OVERWRITE | Replace entirely on each hypothesis |
| Symptoms | IMMUTABLE after gathering | Write once during gathering phase |
| Eliminated | APPEND only | Add entries, never remove |
| Evidence | APPEND only | Add entries, never remove |
| Resolution | OVERWRITE | Update as understanding evolves |

### Anti-Patterns to Avoid
- **Removing evidence entries:** Evidence section is APPEND-only to preserve investigation trail
- **Re-investigating eliminated hypotheses:** After `/clear`, Claude must read Eliminated section first
- **Auto-resolving without user confirmation:** D-44 requires explicit user confirmation

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Debug file template | Inline string concatenation | `debug-template.md` reference file | Consistent structure, easier to update |
| Resume logic | Duplicate code per status | Adapt `resume-preamble.md` pattern | Phase 9 already solved this for tasks |
| Status routing | Complex if/else chains | Stage reference pattern from task workflow | Proven, testable approach |
| Slug generation | Custom regex | Reuse task slug pattern from /do:task | Already handles edge cases |

**Key insight:** Debug mode parallels task mode closely. Reuse patterns from Phases 5-9 (task creation, resume, verification) rather than inventing new approaches.

## Common Pitfalls

### Pitfall 1: Forgetting Eliminated After /clear
**What goes wrong:** After context reset, Claude re-investigates hypotheses already disproved
**Why it happens:** Conversation context is lost; debug file is the only memory
**How to avoid:** Resume flow MUST read Eliminated section first and display it in summary
**Warning signs:** Same hypothesis appears twice in Evidence or Current Focus

### Pitfall 2: Marking Resolved Without User Confirmation
**What goes wrong:** Bug is marked resolved but user finds it still broken
**Why it happens:** Self-verification passed but didn't test all edge cases
**How to avoid:** D-44 specifies `awaiting_human_verify` status before `resolved`
**Warning signs:** Skipped the "Does this fix your issue?" prompt

### Pitfall 3: Unbounded Evidence Growth
**What goes wrong:** Evidence section becomes huge, wasting tokens on resume
**Why it happens:** Each investigation adds entries without curation
**How to avoid:** Per GSD template `<size_constraint>`: keep entries 1-2 lines; if 10+ entries, check if going in circles
**Warning signs:** Evidence section exceeds 20 entries

### Pitfall 4: Not Preserving Current Focus on Updates
**What goes wrong:** Resume shows stale hypothesis after interruption
**Why it happens:** Updated Evidence but forgot to update Current Focus
**How to avoid:** ALWAYS update Current Focus when changing status or moving to next hypothesis
**Warning signs:** Current Focus doesn't match latest Evidence entry

## Code Examples

Verified patterns from existing implementation:

### Debug File Creation
```javascript
// Source: Adapted from task-template.md pattern
const debug = {
  frontmatter: {
    status: 'gathering',
    trigger: userInput,  // D-41: verbatim user input
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    current_hypothesis: null,
    task_ref: config.active_task || null  // D-48: optional link
  },
  body: `## Current Focus

hypothesis: 
test: 
expecting: 
next_action: gather symptoms

## Symptoms

expected: 
actual: 
errors: 
reproduction: 
started: 

## Eliminated

## Evidence

## Resolution

root_cause: 
fix: 
verification: 
files_changed: []`
};
```

### Status Transition Flow
```javascript
// Source: GSD DEBUG.md <lifecycle> section
const STATUS_TRANSITIONS = {
  'gathering': ['investigating'],
  'investigating': ['fixing', 'verifying'],  // Can go to fixing if root cause found, or verifying if fix applied
  'fixing': ['verifying'],
  'verifying': ['investigating', 'awaiting_human_verify'],  // Back to investigating if verification fails
  'awaiting_human_verify': ['resolved', 'investigating'],
  'resolved': []  // Terminal state
};

function canTransition(from, to) {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}
```

### Active Session Check
```javascript
// Source: Adapted from /do:task active task blocking (D-11)
function checkActiveDebug(configPath) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (config.active_debug) {
    const debugPath = path.join(path.dirname(configPath), 'debug', config.active_debug);
    if (fs.existsSync(debugPath)) {
      const content = fs.readFileSync(debugPath, 'utf8');
      const frontmatter = parseYamlFrontmatter(content);
      return {
        active: true,
        file: config.active_debug,
        status: frontmatter.status,
        hypothesis: frontmatter.current_hypothesis
      };
    }
    // Stale reference
    return { active: false, stale: config.active_debug };
  }
  return { active: false };
}
```

### Resume Summary Display
```javascript
// Source: Adapted from resume-preamble.md (D-35, D-47)
function displayResumeSummary(debugFile) {
  const { frontmatter, sections } = parseDebugFile(debugFile);
  
  console.log(`Resuming debug: ${path.basename(debugFile)} (status: ${frontmatter.status})`);
  
  if (frontmatter.current_hypothesis) {
    console.log(`Current hypothesis: ${frontmatter.current_hypothesis}`);
  }
  
  // Show last evidence entry
  const lastEvidence = sections.evidence.slice(-1)[0];
  if (lastEvidence) {
    console.log(`Last finding: ${lastEvidence.found}`);
  }
  
  // Show next action from Current Focus
  const nextAction = sections.currentFocus.next_action;
  if (nextAction) {
    console.log(`Next action: ${nextAction}`);
  }
  
  console.log('\nContinue? (yes/no)');
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Ad-hoc debugging in conversation | Structured debug files with state | GSD implementation | Prevents going in circles after /clear |
| Single investigation thread | Scientific method with elimination tracking | GSD debug pattern | Faster root cause identification |
| Auto-resolve after fix | Require user verification | D-44 (this phase) | Prevents false positives |

**Deprecated/outdated:**
- Implicit context carryover: Cannot rely on conversation memory after `/clear`

## Open Questions

1. **Archive Location**
   - What we know: D-40 specifies `.do/debug/YYMMDD-slug.md` naming
   - What's unclear: Should resolved sessions move to `.do/debug/resolved/` or stay in place?
   - Recommendation: Stay in place initially (simpler); archive can be added later if folder gets cluttered

2. **Multiple Evidence Items Per Investigation**
   - What we know: Evidence is APPEND-only
   - What's unclear: Should multiple related findings from one investigation be grouped or separate entries?
   - Recommendation: Separate entries with same timestamp; easier to parse programmatically

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (node:test) |
| Config file | None needed -- uses Node built-in |
| Quick run command | `node --test skills/do/scripts/__tests__/*.test.cjs` |
| Full suite command | `node --test skills/do/scripts/__tests__/*.test.cjs` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TS-12.1 | Scientific method flow: status transitions | unit | `node --test skills/do/scripts/__tests__/debug-*.test.cjs -x` | Wave 0 |
| TS-12.2 | Debug file creation in .do/debug/ | unit | `node --test skills/do/scripts/__tests__/debug-*.test.cjs -x` | Wave 0 |
| TS-12.3 | Section update rules (APPEND vs OVERWRITE) | unit | `node --test skills/do/scripts/__tests__/debug-*.test.cjs -x` | Wave 0 |
| TS-12.4 | Independent of task workflow | integration | Manual: run /do:debug without active task | Manual |

### Sampling Rate
- **Per task commit:** `node --test skills/do/scripts/__tests__/*.test.cjs`
- **Per wave merge:** `node --test skills/do/scripts/__tests__/*.test.cjs`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `skills/do/scripts/__tests__/debug-session.test.cjs` -- covers TS-12.1, TS-12.2, TS-12.3
- [ ] Test utilities for parsing debug file frontmatter and sections

## Sources

### Primary (HIGH confidence)
- `~/.claude/get-shit-done/templates/DEBUG.md` -- GSD debug template with section rules and lifecycle
- `~/.claude/get-shit-done/templates/debug-subagent-prompt.md` -- Debug agent prompt pattern
- `.planning/phases/10-debug-mode/10-CONTEXT.md` -- User decisions D-40 through D-49

### Secondary (MEDIUM confidence)
- `.planning/phases/09-task-resume/09-CONTEXT.md` -- Resume patterns (D-33 through D-39)
- `skills/do/SKILL.md` -- Existing routing and blocking patterns
- `skills/do/references/resume-preamble.md` -- Shared resume logic to adapt

### Tertiary (LOW confidence)
- None -- all patterns are from existing codebase or user decisions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies needed; uses existing Node.js patterns
- Architecture: HIGH - Closely mirrors task workflow patterns already implemented
- Pitfalls: HIGH - GSD DEBUG.md template explicitly documents common mistakes

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (30 days - stable domain, no external dependencies)
