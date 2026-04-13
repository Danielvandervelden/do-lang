# Phase 6: Grill-Me Agent - Research

**Researched:** 2026-04-13
**Domain:** Interactive clarification flow within skill logic
**Confidence:** HIGH

## Summary

Phase 6 implements grill-me logic within `/do:continue` that triggers when a task's confidence is below the configured threshold (`auto_grill_threshold`). This is NOT a separate agent file but inline skill logic in SKILL.md that asks targeted questions about the weakest confidence factor, updates the task markdown with clarifications, and recalculates confidence after each answer.

The implementation follows established patterns from Phases 2-5: inline prompts (not AskUserQuestion due to documented bug), YAML frontmatter state management, and config.json for threshold values. The key addition is a new "Clarifications" section in the task markdown template that stores Q&A pairs with before/after confidence values.

**Primary recommendation:** Implement grill-me as a conditional branch in `/do:continue` that detects `stage: refinement` + confidence below threshold, then loops through targeted questions until confidence meets threshold or user overrides.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-13:** Target lowest confidence factor first, then proceed to next weakest. Efficient, focused questioning.
- **D-14:** Inline text prompts — plain text questions with typed answers. Consistent with Phase 2-5 interactive pattern. No AskUserQuestion (bug documented in CLAUDE.md).
- **D-15:** Stop when confidence >= `auto_grill_threshold` (from config), but offer "Proceed anyway" after each question for user override. Natural completion with escape hatch.
- **D-16:** New "Clarifications" section in task markdown (between Problem Statement and Approach). Format is Q&A pairs showing: question asked, user's answer, and which confidence factor it addresses with before/after values.
- **D-17:** Grill-me is NOT a separate agent file — it's inline logic within `/do:continue` in SKILL.md. When `/do:continue` is called on a task with `stage: refinement` and confidence < threshold, it runs the grilling flow. **MUST use /skill-creator** to modify SKILL.md per project CLAUDE.md requirement.

### Claude's Discretion
- Exact wording of grill questions (should be specific to the weak factor)
- How much confidence boost per clarification (reasonable heuristic)
- Whether to ask compound questions or single-factor questions
- Formatting details within the Clarifications section

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TS-07 | If confidence < 0.9, spawns grill-me agent for clarification | Inline logic in `/do:continue` triggers when confidence < `auto_grill_threshold`; targets lowest factor first per D-13 |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | >= 18 | Script execution | Consistent with existing scripts |
| js-yaml | 4.1.0 | YAML frontmatter parsing | Already used pattern in Phase 5 |

### Supporting
No additional libraries needed. Implementation is skill markdown logic + optional helper script for confidence recalculation.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline skill logic | Separate agent file | Decision D-17 explicitly forbids separate agent; inline keeps flat hierarchy |
| Plain text prompts | AskUserQuestion | Bug documented in CLAUDE.md; inline prompts match Phase 2-5 pattern |

**Installation:**
No new packages needed.

## Architecture Patterns

### Recommended Project Structure
```
skills/do/
  SKILL.md                          # Extended with /do:continue grill-me logic
  references/
    task-template.md                # Updated with Clarifications section placeholder
  scripts/
    load-task-context.cjs           # Existing - reusable for context
    recalc-confidence.cjs           # NEW (optional) - confidence recalculation helper
```

### Pattern 1: Grill-Me Flow in /do:continue
**What:** Conditional branch in `/do:continue` that runs when task is in refinement stage with low confidence
**When to use:** User calls `/do:continue` on an active task with `stage: refinement` and `confidence.score < auto_grill_threshold`
**Example:**
```markdown
## /do:continue

Resume the active task from its current state.

### Stage Detection

**Step 1: Load active task**

Read `.do/config.json` to get `active_task`.
If no active task, display: "No active task. Run /do:task to create one."

Read task file at `.do/tasks/<active_task>`.
Parse YAML frontmatter for `stage` and `confidence`.

**Step 2: Route by stage**

| Stage | Confidence | Route |
|-------|------------|-------|
| refinement | < threshold | Run grill-me flow (see below) |
| refinement | >= threshold | Transition to execution (Phase 7) |
| grilling | any | Resume grill-me flow |
| execution | any | Resume execution (Phase 7) |
| verification | any | Resume verification (Phase 8) |

### Grill-Me Flow (when stage is refinement and confidence < threshold)

**Step G1: Identify weakest factor**

Read `confidence.factors` from frontmatter.
Find factor with largest deduction (most negative value).
If multiple tied, use priority: context > scope > complexity > familiarity.

**Step G2: Generate targeted question**

Based on the weakest factor, generate a specific question:

| Factor | Example Question Pattern |
|--------|-------------------------|
| context | "What existing component/pattern should this use? Any docs I should read?" |
| scope | "Which specific files/functions need modification? Any out-of-scope areas?" |
| complexity | "How do these systems interact? Any dependencies I should know?" |
| familiarity | "Has similar work been done before? Any reference implementations?" |

Display question to user inline.

**Step G3: Wait for user response**

Options:
- User provides answer
- User types "skip" or "Proceed anyway" to override

**Step G4: Update task markdown**

Add to Clarifications section (create if missing):

```markdown
## Clarifications

### <Factor> (was: <old_value> -> now: <new_value>)
**Q:** <question asked>
**A:** <user's answer>
```

**Step G5: Recalculate confidence**

Apply boost to the factor based on answer quality:
- Specific answer with file/component names: +0.05 to +0.10
- General clarification: +0.03 to +0.05
- Skip/override: +0.00 (no boost)

Update `confidence.score` and `confidence.factors.<factor>` in frontmatter.
Update `updated` timestamp.

**Step G6: Check threshold or loop**

If confidence.score >= auto_grill_threshold:
  - Update `stage: execution` (or keep refinement if execution not implemented yet)
  - Display: "Confidence: <score> - Ready for implementation."
Else:
  - Display: "Confidence: <score> -> <new_score> (+<delta>)"
  - Display: "<factor> improved. Next weakest: <next_factor>"
  - Return to Step G1

User can type "Proceed anyway" at any prompt to skip remaining questions.
If user overrides, add note: "User override at confidence <score>"
```

### Pattern 2: Clarifications Section Format
**What:** Structured Q&A section in task markdown for grill-me results
**When to use:** After each grill-me question is answered
**Example:**
```markdown
## Clarifications

### Scope (was: -0.15 -> now: -0.05)
**Q:** Which specific form fields need validation fixes?
**A:** Only the email and password fields on the login form. Registration form is out of scope.

### Context (was: -0.10 -> now: 0.00)
**Q:** Is there an existing validation utility to extend?
**A:** Yes, use src/utils/validators.ts — it already has email regex.
```

### Pattern 3: Confidence Recalculation
**What:** Heuristic for boosting confidence after clarification
**When to use:** After user provides an answer to a grill question
**Example logic:**
```javascript
function calculateBoost(factor, answer) {
  if (!answer || answer.toLowerCase() === 'skip') return 0;
  
  // Specific answer indicators
  const hasPath = /\/|\\|\.(?:ts|js|tsx|jsx|md|json)/.test(answer);
  const hasComponent = /[A-Z][a-z]+(?:[A-Z][a-z]+)+/.test(answer); // PascalCase
  const hasSpecificTerms = /(?:src|lib|utils|hooks|components|api|endpoint)/.test(answer.toLowerCase());
  
  const specificity = [hasPath, hasComponent, hasSpecificTerms].filter(Boolean).length;
  
  // Base boost + specificity bonus
  const boost = 0.03 + (specificity * 0.02); // 0.03 to 0.09
  return Math.min(boost, 0.10); // Cap at 0.10
}
```

### Anti-Patterns to Avoid
- **Separate agent file:** Decision D-17 explicitly requires inline skill logic. Do not create `agents/grill-me.md` or similar.
- **AskUserQuestion:** Bug documented in workspace CLAUDE.md. Use inline text prompts only.
- **Blanket questions:** "Can you clarify the scope?" is too vague. Questions must be targeted to the specific weak factor.
- **Auto-determination of question quality:** Let the heuristic be simple; don't over-engineer answer parsing.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML parsing | String manipulation | js-yaml or simple regex | Frontmatter is structured; use proper tools |
| Task file location | Path guessing | config.json `active_task` | Single source of truth for active task |
| Threshold value | Hardcoded 0.9 | config.json `auto_grill_threshold` | User-configurable per D-06 |

**Key insight:** The grill-me flow reuses existing infrastructure (config.json, task markdown, YAML frontmatter). No new state management patterns needed.

## Common Pitfalls

### Pitfall 1: Forgetting to Update `updated` Timestamp
**What goes wrong:** Task markdown `updated` field stays stale after clarifications
**Why it happens:** Easy to forget when updating only confidence and clarifications
**How to avoid:** Always update `updated: <ISO-8601>` in frontmatter when writing any change
**Warning signs:** Task file shows old timestamp despite recent grill-me activity

### Pitfall 2: Negative Confidence Values
**What goes wrong:** Confidence score drops below 0 due to over-deduction
**Why it happens:** Factors are deductions from 1.0; boosting a factor might not account for floor
**How to avoid:** Ensure factor values are capped (e.g., -0.20 to 0.00 range); recalc score = 1.0 + sum(factors)
**Warning signs:** `confidence.score` shows negative or >1.0 values

### Pitfall 3: Infinite Grill Loop
**What goes wrong:** User stuck answering questions forever
**Why it happens:** Each answer gives minimal boost; threshold never reached
**How to avoid:** Enforce minimum boost per answer (0.03) or offer override prominently after 3+ questions
**Warning signs:** Same factor keeps being targeted; confidence barely moves

### Pitfall 4: Stage Transition Confusion
**What goes wrong:** Task stuck in wrong stage after grilling completes
**Why it happens:** Forgetting to update `stage` in frontmatter when confidence meets threshold
**How to avoid:** Explicit stage transition: `stage: refinement` -> `stage: execution` when threshold met
**Warning signs:** `/do:continue` keeps running grill-me even after confidence is high

### Pitfall 5: Missing Clarifications Section in Template
**What goes wrong:** Grill-me tries to append to non-existent section
**Why it happens:** task-template.md doesn't have Clarifications placeholder
**How to avoid:** Update task-template.md with `## Clarifications` placeholder (commented or empty)
**Warning signs:** Clarifications appended at wrong location in task markdown

## Code Examples

Verified patterns from existing codebase:

### Reading Config and Task File
```javascript
// From load-task-context.cjs pattern
function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

// Load config
const config = readJsonSafe('.do/config.json');
const threshold = config?.auto_grill_threshold ?? 0.9;
const activeTask = config?.active_task;

// Load task
const taskPath = `.do/tasks/${activeTask}`;
const taskContent = fs.readFileSync(taskPath, 'utf-8');
// Parse YAML frontmatter (between --- delimiters)
```

### Updating YAML Frontmatter
```javascript
// Pattern: Read, modify, write
const yaml = require('js-yaml');

function updateTaskFrontmatter(taskPath, updates) {
  const content = fs.readFileSync(taskPath, 'utf-8');
  const [, frontmatterRaw, ...bodyParts] = content.split('---\n');
  const frontmatter = yaml.load(frontmatterRaw);
  
  // Apply updates
  Object.assign(frontmatter, updates);
  frontmatter.updated = new Date().toISOString();
  
  // Reconstruct
  const newContent = `---\n${yaml.dump(frontmatter)}---\n${bodyParts.join('---\n')}`;
  fs.writeFileSync(taskPath, newContent);
}
```

### Inline Prompt Pattern (from SKILL.md)
```markdown
**Step G2: Ask targeted question**

Based on the weakest factor (<factor>), display:

```
Confidence: <score> (threshold: <threshold>)
Weakest factor: <factor> (<value>)

<targeted question based on factor>

Enter your answer, or type "Proceed anyway" to skip:
```

Wait for user response.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate agent files | Inline skill logic | D-17 (Phase 6) | Flat hierarchy maintained |
| AskUserQuestion | Inline text prompts | Phase 2-5 | Avoids documented bug |

**Deprecated/outdated:**
- AskUserQuestion in skills — documented bug in workspace CLAUDE.md causes silent failures after skill load

## Open Questions

1. **Confidence boost calibration**
   - What we know: Heuristic should give 0.03-0.10 boost based on answer specificity
   - What's unclear: Optimal calibration for real-world tasks
   - Recommendation: Start with simple heuristic, tune based on usage patterns

2. **Stage transition timing**
   - What we know: When confidence >= threshold, task is ready for execution
   - What's unclear: Should stage change to `execution` immediately or wait for Phase 7 implementation?
   - Recommendation: Keep `stage: refinement` with `stages.refinement: complete`, add note "Ready for execution (Phase 7)"

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js test runner (native) |
| Config file | None required for Phase 6 |
| Quick run command | `node --test skills/do/scripts/__tests__/*.test.cjs` |
| Full suite command | `node --test skills/do/scripts/__tests__/` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TS-07-a | Confidence < threshold triggers grill-me | manual | N/A — skill behavior | N/A |
| TS-07-b | Targeted questions about weak factors | manual | N/A — skill behavior | N/A |
| TS-07-c | Task markdown updated with clarifications | manual | N/A — skill behavior | N/A |
| TS-07-d | Confidence recalculated after grilling | unit | `node --test scripts/__tests__/recalc-confidence.test.cjs` | Wave 0 |
| TS-07-e | Loop until threshold or override | manual | N/A — skill behavior | N/A |

### Sampling Rate
- **Per task commit:** Manual verification of skill behavior
- **Per wave merge:** Full skill walkthrough with test task
- **Phase gate:** Create task with low confidence, verify grill-me triggers and completes

### Wave 0 Gaps
- [ ] `skills/do/scripts/__tests__/recalc-confidence.test.cjs` — if helper script created
- [ ] `skills/do/references/task-template.md` — needs Clarifications section placeholder

## Sources

### Primary (HIGH confidence)
- `.planning/phases/06-grill-me-agent/06-CONTEXT.md` — Locked decisions D-13 through D-17
- `.planning/phases/05-task-creation-refine-agent/05-CONTEXT.md` — Confidence model D-04 through D-06
- `.planning/phases/03-project-setup/03-CONTEXT.md` — config.json schema with `auto_grill_threshold`
- `skills/do/SKILL.md` — Current implementation patterns, `/do:task` structure
- `skills/do/references/task-template.md` — Existing template to extend

### Secondary (MEDIUM confidence)
- `.planning/research/skills-patterns.md` — Inline prompt patterns, AskUserQuestion avoidance
- `.planning/research/state-management.md` — YAML frontmatter state patterns

### Tertiary (LOW confidence)
- None — all research based on existing codebase and locked decisions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies; uses existing patterns
- Architecture: HIGH - Clear decisions from CONTEXT.md; follows Phase 5 patterns
- Pitfalls: HIGH - Based on existing implementation experience in Phase 5

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (30 days — stable domain, locked decisions)
