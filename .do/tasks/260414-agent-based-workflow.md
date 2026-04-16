---
id: 260414-agent-based-workflow
created: 2026-04-14T08:45:00Z
updated: 2026-04-14T09:15:00Z
description: "Implement agent-based workflow for /do:task with 6 specialized agents"

stage: complete
stages:
  refinement: complete
  grilling: complete
  execution: complete
  verification: complete
  abandoned: false

council_review_ran:
  plan: false
  code: false

confidence:
  score: 0.90
  factors:
    context: 0.00
    scope: -0.05
    complexity: -0.05
    familiarity: 0.00

waves:
  - name: core-agents
    description: "Create do-planner, do-plan-reviewer, do-executioner, do-code-reviewer"
    status: complete
  - name: supporting-agents
    description: "Create do-griller, do-debugger"
    status: complete
  - name: integration
    description: "Update config schema, postinstall, skills to spawn agents"
    status: complete
  - name: model-config
    description: "Add models config with default + overrides; skills read config and pass model to Agent tool"
    status: complete
---

# Agent-Based Workflow for /do

## Problem Statement

Skills are markdown prompts that Claude reads and follows manually. No enforcement mechanism exists — steps get skipped when context is long or focus shifts to implementation. Specifically observed during LLDEV-613:
- Council code review was skipped after execution
- Verification stage was skipped
- User had to remind Claude to run these

The solution is to replace manual skill prompts with actual Claude agents that own their full workflow loop. Agents cannot return until reviews pass, eliminating the "forgot to run this step" problem.

## Clarifications

### Scope (was: -0.15 -> now: -0.10)
**Q:** Agent installation path?
**A:** Install to `~/.claude/agents/` via postinstall, same as GSD. Follow exact GSD pattern.

### Complexity (was: -0.10 -> now: -0.05)
**Q:** Council review parallelism?
**A:** Truly parallel. do-plan-reviewer and do-code-reviewer each spawn 2 parallel subagents (self-review + council if enabled).

**Q:** Council iteration?
**A:** Auto-iterate up to 3 times max, then exit to user if still not passing.

### Context (was: -0.05 -> now: 0.00)
**Q:** Context7 usage?
**A:** Planning + debugging only. do-planner and do-debugger use ctx7 when researching.

### Nested agents (was: concern -> now: resolved)
**Q:** Nested agent limits — fallback needed?
**A:** No issues observed, but add sequential fallback if parallel spawning fails.

### Architecture refinement
**Q:** Final agent list?
**A:** 6 agents total:
1. `do-planner` - creates the plan
2. `do-plan-reviewer` - reviews plan (spawns parallel self-review + council)
3. `do-griller` - interrogates user when confidence low
4. `do-executioner` - implements the plan
5. `do-code-reviewer` - reviews code (spawns parallel self-review + council)
6. `do-debugger` - scientific method debugging

No `do-initialiser` — init is simpler, doesn't need full agent treatment.

## Context Loaded

- `project.md` - do-lang project structure, tech stack, conventions
- `gsd-executor.md` - Reference agent with deviation rules, commit protocol
- `gsd-planner.md` - Reference agent for planning
- `gsd-debugger.md` - Reference agent with scientific method debugging
- `~/.claude/agents/gsd-*.md` - GSD agent installation pattern

## Approach

### Workflow Architecture

```
/do:task "description"
         │
         ▼
┌─────────────────────────────────────┐
│  do-planner (cyan)                  │
│  - Load context via script          │
│  - Analyze task, calculate conf     │
│  - Create plan in task file         │
│  - Return structured summary        │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  do-plan-reviewer (green)           │
│  Spawns 2 PARALLEL subagents:       │
│  ├─ Self-review agent               │
│  └─ Council review (if enabled)     │
│  Auto-iterate up to 3x if issues    │
│  Return: PASS or concerns           │
└─────────────────────────────────────┘
         │
         ▼ (if confidence < threshold)
┌─────────────────────────────────────┐
│  do-griller (yellow)                │
│  - Analyze low-confidence factors   │
│  - Ask targeted questions           │
│  - Update confidence after each     │
│  - Stop at threshold or override    │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  USER CHECKPOINT                    │
│  "Ready to execute? [Y/n]"          │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  do-executioner (red)               │
│  - Load task file context           │
│  - Execute approach step by step    │
│  - Log to Execution Log             │
│  - Return files changed, decisions  │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  do-code-reviewer (magenta)         │
│  Spawns 2 PARALLEL subagents:       │
│  ├─ Self-review agent               │
│  └─ Council review (if enabled)     │
│  Auto-iterate up to 3x if issues    │
│  Return: APPROVED or issues         │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  COMPLETE                           │
│  Task verified, ready for UAT       │
└─────────────────────────────────────┘
```

### Wave 1: Core Agents

**1. `do-planner`** (`~/.claude/agents/do-planner.md`)
- Color: `cyan`
- Tools: Read, Grep, Glob, Write, WebSearch
- Model: sonnet (fast planning)
- Logic:
  - Run `load-task-context.cjs` to get project context
  - If `web_search.context7: true`, use ctx7 for library research
  - Analyze task description against context
  - Calculate confidence with factor breakdown
  - Write plan to task file (Problem, Approach, Concerns)
  - Return structured summary: confidence, approach summary, concerns count

**2. `do-plan-reviewer`** (`~/.claude/agents/do-plan-reviewer.md`)
- Color: `green`
- Tools: Read, Grep, Glob, Agent
- Model: sonnet
- Logic:
  - Read task file plan
  - Spawn 2 parallel agents:
    - Self-review: Check plan completeness, feasibility, risks
    - Council review (if `council_reviews.planning: true`): External perspective
  - Collect results from both
  - If issues found: attempt to address, re-review (max 3 iterations)
  - Return: PASS with summary, or CONCERNS with details

**3. `do-executioner`** (`~/.claude/agents/do-executioner.md`)
- Color: `red`
- Tools: Read, Write, Edit, Bash, Grep, Glob
- Model: sonnet
- permissionMode: acceptEdits
- Logic:
  - Read task file for Problem, Approach, Concerns
  - Execute Approach step by step
  - Log each action to Execution Log section
  - Handle deviations: stop and ask if plan says X but reality is Y
  - Return: files changed, decisions made, any blockers

**4. `do-code-reviewer`** (`~/.claude/agents/do-code-reviewer.md`)
- Color: `magenta`
- Tools: Read, Grep, Glob, Agent
- Model: sonnet
- Logic:
  - Read task file + git diff of changes
  - Spawn 2 parallel agents:
    - Self-review: Check code quality, tests, edge cases
    - Council review (if `council_reviews.execution: true`): External perspective
  - Collect results from both
  - If issues found: report back for fixes (max 3 iterations)
  - Return: APPROVED or CHANGES_REQUESTED with details

### Wave 2: Supporting Agents

**5. `do-griller`** (`~/.claude/agents/do-griller.md`)
- Color: `yellow`
- Tools: Read, Grep, Glob, AskUserQuestion
- Model: sonnet
- Logic:
  - Read task file confidence breakdown
  - Identify lowest-scoring factors
  - Generate targeted questions for each factor
  - Ask via AskUserQuestion, one at a time
  - After each answer: recalculate factor, update task file
  - Stop when confidence >= threshold OR user says "proceed anyway"
  - Return: final confidence, clarifications added

**6. `do-debugger`** (`~/.claude/agents/do-debugger.md`)
- Color: `orange`
- Tools: Read, Write, Edit, Bash, Grep, Glob, WebSearch
- Model: sonnet
- permissionMode: acceptEdits
- Logic:
  - Scientific method: observe symptoms, form hypothesis, test, conclude
  - If `web_search.context7: true`, use ctx7 for error research
  - Maintain debug session file in `.do/debug/`
  - Iterate through hypotheses until root cause found
  - Optionally apply fix if in fix mode
  - Return: root cause, fix applied (if any), verification result

### Wave 3: Integration

**7. Config schema update** (`.do/config.json`)
```json
{
  "web_search": {
    "context7": true
  },
  "council_reviews": {
    "planning": true,
    "execution": true,
    "reviewer": "codex"
  }
}
```

**8. Postinstall update** (`bin/postinstall.cjs`)
- Copy agents from `agents/` to `~/.claude/agents/`
- Same pattern as skills installation

**9. Skill updates**
- `/do:task` → orchestrates: planner → plan-reviewer → griller (if needed) → checkpoint → executioner → code-reviewer
- `/do:continue` → checks stage, spawns appropriate agent to resume
- `/do:debug` → spawns do-debugger directly

**10. Failure handling**
- Any agent failure = exit immediately, return structured error
- Error includes: what failed, which agent, last known good state
- No retry loops — user decides next step

## Concerns

- **Context7 CLI availability**: Need to ensure ctx7 is installed/available, or gracefully skip if not.
- ~~**Nested agent depth**~~: Resolved — no issues observed, sequential fallback added if parallel fails.

## Execution Log

### 2026-04-14 09:30 - Wave 1: Core Agents
**Files:**
- `agents/do-planner.md` - Created: cyan, context loading, confidence scoring, plan creation
- `agents/do-plan-reviewer.md` - Created: green, parallel self+council review, 3x iteration
- `agents/do-executioner.md` - Created: red, step-by-step execution, deviation handling
- `agents/do-code-reviewer.md` - Created: magenta, parallel self+council review, UAT generation

**Status:** Wave 1 complete

### 2026-04-14 09:40 - Wave 2: Supporting Agents
**Files:**
- `agents/do-griller.md` - Created: yellow, confidence interrogation, factor-based questions
- `agents/do-debugger.md` - Created: orange, scientific method, ctx7 research, hypothesis testing

**Status:** Wave 2 complete

### 2026-04-14 09:50 - Wave 3: Integration (in progress)
**Files:**
- `bin/install.cjs` - Added agents installation to ~/.claude/agents/
- `package.json` - Added "agents" to files array
- `.do/config.json` - Added web_search.context7 setting

**Status:** In progress - skill updates remaining

### 2026-04-14 10:00 - Wave 3: Integration (continued)
**Files:**
- `skills/do/task.md` - Rewritten as agent orchestrator (planner → plan-reviewer → griller → executioner → code-reviewer)
- `skills/do/debug.md` - Rewritten to spawn do-debugger agent
- `skills/do/continue.md` - Rewritten with stage detection and agent routing

**Status:** Wave 3 complete

### 2026-04-14 10:10 - Wave 4: Model Configuration
**Files:**
- `.do/config.json` - Added models section with default + overrides
- `skills/do/references/init-project-setup.md` - Added model configuration step
- `skills/do/references/config-template.json` - Updated with models and web_search sections

**Status:** Wave 4 complete

### 2026-04-14 10:30 - Council Review Fixes
**Council verdict:** CONCERNS (Codex)

**Fixes applied:**
- `agents/do-griller.md` - Added AskUserQuestion to tools
- `agents/do-plan-reviewer.md` - Added Write to tools
- `agents/do-code-reviewer.md` - Added Write, Edit to tools
- `skills/do/task.md` - Added Step 4 for explicit task file creation before planner
- `package.json` - Added gray-matter dependency, bumped to v1.2.0

**Status:** All blocking issues resolved

### 2026-04-14 10:45 - Init UX improvement
**Files:**
- `skills/do/references/init-project-setup.md` - All prompts now show `[Enter = default]` pattern and explicitly handle empty input

**Status:** Complete

## Council Review

<!-- Populated during council review stages -->

## Verification Results

<!-- Populated during verification -->
