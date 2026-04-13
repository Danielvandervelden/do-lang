# Codex CLI Integration Patterns

**Researched:** 2026-04-13  
**Confidence:** HIGH (based on working implementations in `~/.claude/` and `~/.codex/`)

## 1. Custom Commands/Skills in Codex CLI

Codex uses two mechanisms:

**Commands** (`~/.codex/commands/`): Markdown files with YAML frontmatter. Structure mirrors Claude Code:
```yaml
---
name: council:ask-claude
description: Consult Anthropic Claude headlessly
argument-hint: "<prompt>"
allowed-tools:
  - Bash
  - Read
  - Write
---
```

**Agents** (`~/.codex/agents/`): Paired `.md` + `.toml` files. The TOML registers the agent in `config.toml`:
```toml
[agents.gsd-executor]
description = "Executes GSD plans..."
config_file = "agents/gsd-executor.toml"
```

## 2. Syntax Differences: Claude Code vs Codex

| Aspect | Claude Code | Codex CLI |
|--------|-------------|-----------|
| Commands location | `~/.claude/commands/` | `~/.codex/commands/` |
| Agents location | N/A (uses Agent tool) | `~/.codex/agents/` (paired .md/.toml) |
| Agent registration | Inline via Agent tool | `config.toml` `[agents.*]` sections |
| Instructions file | `CLAUDE.md` | `AGENTS.md` (same purpose) |
| Headless mode | `claude -p` (print mode) | `codex exec` |
| Tools syntax | `--allowedTools Read,Bash` | Similar (inferred from context) |

## 3. Spawning Codex from Claude Code

Use the **codex-companion.mjs** wrapper (not raw `codex exec`):

```bash
PLUGIN_ROOT="$HOME/.claude/plugins/cache/openai-codex/codex/1.0.1"

# General task (reviews, questions, implementation)
node "${PLUGIN_ROOT}/scripts/codex-companion.mjs" task \
  --wait --prompt-file "$BRIEF_FILE"

# Code review (native mode, more focused)
node "${PLUGIN_ROOT}/scripts/codex-companion.mjs" review \
  --base main --wait

# Adversarial review (challenges design)
node "${PLUGIN_ROOT}/scripts/codex-companion.mjs" adversarial-review \
  --base main --wait
```

**Key flags:**
- `--wait`: Synchronous execution, returns result to stdout
- `--background`: Async, use `status`/`result` to poll
- `--write`: Allow file modifications (default for rescue)
- `--resume-last`: Continue previous Codex session
- `--model gpt-5.4` / `--model gpt-5.3-codex-spark`: Model selection
- `--effort <none|minimal|low|medium|high|xhigh>`: Reasoning effort

## 4. Spawning Claude from Codex

Use the `claude` CLI in print mode:

```bash
cat "$PROMPT_FILE" | claude -p --allowedTools Read,Bash,Glob,Grep > "$OUTFILE" 2>"$ERR_FILE" &
CLAUDE_PID=$!

# Timeout pattern
( sleep 90 && kill $CLAUDE_PID 2>/dev/null ) &
TIMER_PID=$!
wait $CLAUDE_PID 2>/dev/null
kill $TIMER_PID 2>/dev/null
```

The skill `/council:ask-claude` in `~/.codex/commands/council/` implements this pattern.

## 5. AGENTS.md Purpose

`AGENTS.md` is Codex's equivalent of `CLAUDE.md`. Lives in repo root. Contains:
- Workspace instructions (git conventions, formatting)
- Tool preferences (`apply_patch` for edits, `rg` for search)
- Context loading rules (database paths)
- Workflow conventions

Both files should stay aligned. When in doubt, follow the stricter rule.

## 6. Writing Cross-Runtime Skills

**Pattern:** Write skill logic as runtime-agnostic markdown, with CLI invocation handled by wrapper scripts.

```
my-skill/
  SKILL.md           # Shared logic (both runtimes read this)
  claude-adapter.md  # Claude Code command wrapper
  codex-adapter.md   # Codex command wrapper
```

**Best practices:**
1. Use stdin/files for prompts (avoid shell escaping hell)
2. Use temp files for large payloads (ARG_MAX limits)
3. Include timeout + kill patterns for headless calls
4. Return raw output (orchestrator handles synthesis)
5. Check for tool availability before invoking

## Bidirectional Council Pattern

The existing council implementation (`~/workspace/database/shared/council.md`) demonstrates the pattern:

1. **Claude reviews Codex work**: Call `codex-companion.mjs review` with `--base main`
2. **Codex reviews Claude work**: Call `claude -p` with diff context

Both use the same brief template: project path, file paths to review, evaluation criteria. The advisor reads files itself rather than receiving content in the prompt.

## Key Implementation Files

- `/council:ask-codex`: `~/.claude/commands/council/ask-codex.md`
- `/council:ask-claude` (Codex-side): `~/.codex/commands/council/ask-claude.md`
- `/codex:rescue`: `~/.claude/plugins/cache/openai-codex/codex/1.0.1/agents/codex-rescue.md`
- Companion script: `~/.claude/plugins/cache/openai-codex/codex/1.0.1/scripts/codex-companion.mjs`
- Council docs: `~/workspace/database/shared/council.md`
