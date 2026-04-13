# Claude Code Skills/Commands Patterns

**Researched:** 2026-04-13
**Source:** GSD implementation at `~/.claude/get-shit-done/`

## 1. Skill File Anatomy

Skills live in `workflows/` (orchestrators) and agents in `~/.claude/agents/` (spawnable workers).

### Workflow Structure (Orchestrators)

```markdown
<purpose>
[What the skill does - 1-3 sentences]
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<available_agent_types>
- gsd-executor - Executes plan tasks
- gsd-planner - Creates detailed plans
- gsd-verifier - Verifies phase completion
</available_agent_types>

<process>
**Step 1: Parse arguments**
...

**Step 2: Initialize**
```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init quick "$DESCRIPTION")
```
...
</process>

<success_criteria>
- [ ] Checkbox-style completion gates
</success_criteria>
```

### Agent Structure (Workers)

Agents use YAML frontmatter:

```yaml
---
name: gsd-executor
description: Executes GSD plans with atomic commits...
tools: Read, Write, Edit, Bash, Grep, Glob
permissionMode: acceptEdits
color: yellow
---
```

Followed by `<role>`, `<execution_flow>`, `<deviation_rules>` sections.

## 2. Referencing Templates and Skills

### @ Syntax for File References

```markdown
<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@src/path/to/relevant.ts
</context>
```

Templates live in `templates/` and provide output format specs (PLAN.md, SUMMARY.md, STATE.md).

## 3. Spawning Agents

### Task() Syntax

```javascript
Task(
  prompt="<research_context>...</research_context>",
  subagent_type="gsd-project-researcher",
  model="{researcher_model}",
  description="Stack research"
)
```

### Parallel Spawning

Multiple `Task()` calls in a single step execute in parallel. GSD uses wave-based execution - independent plans run simultaneously, dependent ones wait.

### Agent Skills Loading

```bash
AGENT_SKILLS=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" agent-skills gsd-executor 2>/dev/null)
```

Then inject `${AGENT_SKILLS}` into the prompt.

## 4. AskUserQuestion Patterns

### Basic Structure

```javascript
AskUserQuestion(
  header: "Quick Task",      // Max 12 chars
  question: "What do you want to do?",
  options: [
    { label: "Option A", description: "What this means" },
    { label: "Option B", description: "What this means" },
    { label: "Other", description: "Let me explain" }
  ],
  multiSelect: false,
  followUp: null
)
```

### Key Rules

1. **Headers max 12 characters** - validation rejects longer
2. **2-4 options ideal** - not too many
3. **Freeform rule**: If user selects "Other" and wants to explain, switch to plain text - do NOT use AskUserQuestion
4. **Concrete options**: Not "Technical/Business/Other" but specific choices

## 5. State Management

### STATE.md as Living Memory

- Read first in every workflow
- Updated after every significant action
- Contains: current position, accumulated context, session continuity
- Keep under 100 lines (digest, not archive)

### Config for Ephemeral State

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-set workflow._auto_chain_active false
```

### Directory-Based State

```
.planning/
  PROJECT.md      # Project identity
  ROADMAP.md      # Phase structure
  STATE.md        # Current position
  config.json     # Settings
  phases/
    01-setup/
      01-01-PLAN.md
      01-01-SUMMARY.md
  quick/
    Q001-add-button/
```

## 6. Patterns to Adopt

1. **Orchestrator/Worker split**: Workflows coordinate, agents execute
2. **@ references**: Clean way to inject context
3. **`<files_to_read>` blocks**: Mandatory initial reads
4. **Structured returns**: Success/blocked messages with predictable format
5. **Deviation rules**: Auto-fix bugs, auto-add critical functionality, ask about architectural changes
6. **Checkpoints**: `checkpoint:human-verify`, `checkpoint:decision` for interaction points

## 7. Patterns to Improve

1. **Template bloat**: GSD templates are 200-600 lines. "do" should be leaner.
2. **Init ceremony**: Every workflow runs `gsd-tools.cjs init`. Consider simpler state discovery.
3. **Agent proliferation**: 16+ agent types. Consolidate where possible.
4. **Implicit dependencies**: Wave/depends_on requires parsing frontmatter. Make explicit.
