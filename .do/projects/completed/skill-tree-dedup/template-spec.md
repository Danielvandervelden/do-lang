# Template Syntax Specification

_Version: 1.0.0 — grounded in `divergence-catalog.json` generated 2026-05-04_

This document defines the ERB-style template syntax that will be used throughout
Phases 01-03 to annotate divergent skill/reference/agent files for build-time
platform substitution. Every template variable defined here traces directly back
to a `distinctPaths` or `distinctPrefixes` entry in `divergence-catalog.json`.

---

## 1. Delimiter Syntax

### 1.1 Variable substitution

```
<%= VARIABLE_NAME %>
```

Used when a single string value differs between platforms. The build script
substitutes the platform-specific value at build time.

**Example:**

```
node <%= PLATFORM_PATH %>/scripts/council-invoke.cjs \
```

Becomes, for Claude:

```
node ~/.claude/commands/do/scripts/council-invoke.cjs \
```

And for Codex:

```
node ~/.codex/skills/do/scripts/council-invoke.cjs \
```

### 1.2 Conditional blocks

```
<% if claude %>
...Claude-specific content...
<% endif %>
<% if codex %>
...Codex-specific content...
<% endif %>
```

Used when the two platforms have structurally different content that cannot be
expressed as a simple variable substitution (e.g., JavaScript `Agent()` call
blocks vs. natural-language "Spawn the codex-..." instructions).

### 1.3 Delimiter choice rationale

ERB-style delimiters (`<%` / `%>`) were chosen because:

- They do **not** appear anywhere in the current `skills/`, `agents/`, or
  `references/` files (grep-verified — see Section 4: Collision Analysis).
- They do **not** conflict with `{{PLACEHOLDER}}` Mustache-style markers already
  used in reference/template files (e.g., `{{TASK_ID}}`, `{{TITLE}}`,
  `{{VISION}}`). Those markers are document-level placeholders for content
  filled in at session time; ERB delimiters are build-time substitution markers.
- The `<%=` / `<% if` / `<% endif %>` forms are visually distinct from both
  Markdown syntax and the existing `<...>` angle-bracket conventions used for
  dynamic values like `<models.default>`.

---

## 2. Variable Catalog

Every variable below traces to an entry in `divergence-catalog.json`
`summary.path_substitution.distinctPaths` or
`summary.agent_name_prefix.distinctPrefixes`.

### 2.1 `PLATFORM_PATH`

| | Value |
|---|---|
| **Claude** | `~/.claude/commands/do` |
| **Codex** | `~/.codex/skills/do` |
| **Catalog source** | `distinctPaths` entries: base install path, scripts subdir |

The base platform-specific install path. Covers two tilde path variants:

| Variant | Claude form | Codex form |
|---|---|---|
| Base | `~/.claude/commands/do/` | `~/.codex/skills/do/` |
| Scripts subdir | `~/.claude/commands/do/scripts/` | `~/.codex/skills/do/scripts/` |

The scripts subdir form is expressed as `<%= PLATFORM_PATH %>/scripts/` in
templates.

**Usage:** 31 pairs / 202 changed-line matches.

### 2.1a `PLATFORM_PATH_SHELL`

| | Value |
|---|---|
| **Claude** | `${HOME}/.claude/commands/do` |
| **Codex** | `${HOME}/.codex/skills/do` |
| **Catalog source** | `distinctPaths` entry: shell variable variant (`variable: "PLATFORM_PATH_SHELL"`) |

The shell-expansion variant of the platform install path. `~` and `${HOME}` are
**not** interchangeable in all shell contexts: `~` undergoes tilde expansion
(POSIX sh), which is suppressed inside double-quoted strings, while `${HOME}` is
a parameter expansion that works inside double quotes. The `do-council-reviewer`
and `codex-council-reviewer` agents use `${HOME}` in a bash assignment inside a
heredoc:

```bash
SCRIPT="${HOME}/.claude/commands/do/scripts/council-invoke.cjs"
```

Because these lines appear inside a double-quoted string, `~` would **not** expand
correctly. Therefore this variant requires its own distinct template variable.

**Template usage:**

```bash
SCRIPT="<%= PLATFORM_PATH_SHELL %>/scripts/council-invoke.cjs"
```

Where `PLATFORM_PATH_SHELL` resolves to `${HOME}/.claude/commands/do` (Claude)
or `${HOME}/.codex/skills/do` (Codex). The resulting line after build-time
substitution is:

```bash
# Claude:
SCRIPT="${HOME}/.claude/commands/do/scripts/council-invoke.cjs"
# Codex:
SCRIPT="${HOME}/.codex/skills/do/scripts/council-invoke.cjs"
```

**Usage:** 1 pair (agents/council-reviewer.md), 2 lines.

### 2.1b `PLATFORM_PATH_DISPLAY`

| | Value |
|---|---|
| **Claude** | `/Users/<user>/.claude/commands/do` |
| **Codex** | `/Users/<user>/.codex/skills/do` |
| **Catalog source** | `distinctPaths` entry: display path variant (`variable: "PLATFORM_PATH_DISPLAY"`) |

The display-only variant of the platform install path. It appears in user-facing
status/output examples such as `update.md` success text, where the source files
use the literal `/Users/<user>/...` form rather than a shell- or tilde-expanded
runtime path.

This variable is intentionally separate from `PLATFORM_PATH`: `/Users/<user>/...`
is a rendered example path, while `~/.claude/...` and `~/.codex/...` are shell
and documentation paths.

**Usage:** 1 pair (skills/update.md), 2 lines.

### 2.2 `PLATFORM_AGENTS_PATH`

| | Value |
|---|---|
| **Claude** | `~/.claude/agents` |
| **Codex** | `~/.codex/agents` |
| **Catalog source** | `distinctPaths` entry: agents install path |

The platform-specific agents install directory. Found in path_substitution lines
referencing where agent `.md` files are installed.

**Usage:** 1 pair (skills/update.md), 4 lines.

### 2.2a `PLATFORM_AGENTS_PATH_DISPLAY`

| | Value |
|---|---|
| **Claude** | `/Users/<user>/.claude/agents` |
| **Codex** | `/Users/<user>/.codex/agents` |
| **Catalog source** | `distinctPaths` entry: display agents path variant (`variable: "PLATFORM_AGENTS_PATH_DISPLAY"`) |

The display-only variant of the platform agents install directory. It appears in
user-facing output examples and should not be collapsed into
`PLATFORM_AGENTS_PATH`, because the literal `/Users/<user>/...` form has a
different purpose from the tilde path used in install references.

**Usage:** 1 pair (skills/update.md), 2 lines.

### 2.3 `PLATFORM_SKILLS_DIR`

| | Value |
|---|---|
| **Claude** | `skills/do` |
| **Codex** | `skills/codex` |
| **Catalog source** | `distinctPaths` entry: "source skills directory reference" |

The relative source skills directory. Appears in documentation references like
`skills/do/project.md` vs `skills/codex/project.md`. Used when referencing the
source tree (not the installed output path).

**Example:**

```
This reference file is loaded by `<%= PLATFORM_SKILLS_DIR %>/project.md`.
```

**Usage:** 14 pairs / 32 changed-line matches.

### 2.4 `AGENT_PREFIX`

| | Value |
|---|---|
| **Claude** | `do` |
| **Codex** | `codex` |
| **Catalog source** | `distinctPrefixes`: all 8 agent name pairs |

The platform-specific agent name prefix. All 8 agent pairs use this prefix:

| Pair |
|---|
| `do-planner` / `codex-planner` |
| `do-executioner` / `codex-executioner` |
| `do-griller` / `codex-griller` |
| `do-verifier` / `codex-verifier` |
| `do-code-reviewer` / `codex-code-reviewer` |
| `do-plan-reviewer` / `codex-plan-reviewer` |
| `do-council-reviewer` / `codex-council-reviewer` |
| `do-debugger` / `codex-debugger` |

**Used in 36 pairs / 283 lines** — the most widely distributed variable.

**Example:**

```
Spawned after `<%= AGENT_PREFIX %>-plan-reviewer` passes and user approves execution.
```

For a complete agent name (e.g., in a frontmatter `name:` field):

```
name: <%= AGENT_PREFIX %>-council-reviewer
```

---

## 3. Conditional Blocks: Agent() vs Prose Spawn

**16 pairs / 456 lines** contain `agent_spawn_block` divergences — the highest
line count of any single pattern category (larger even than the combined
path_substitution line count of 242).

Claude Code uses JavaScript `Agent({...})` call syntax; Codex uses natural-
language "Spawn the codex-..." prose instructions. These are structurally
incompatible and cannot be expressed as variable substitution — they require
conditional blocks.

### 3.1 Conditional syntax

```
<% if claude %>
Agent({
  description: "Self-review plan",
  subagent_type: "<%= AGENT_PREFIX %>-plan-reviewer",
  model: "<models.overrides.plan_reviewer || models.default>",
  prompt: `
...prompt body...
`
})
<% endif %>
<% if codex %>
Spawn the <%= AGENT_PREFIX %>-plan-reviewer subagent with model `<models.overrides.plan_reviewer || models.default>` and the description "Self-review plan". Pass the following prompt:

...prompt body...
<% endif %>
```

### 3.2 Detection markers (for build tooling)

Claude-side spawn block: starts with `Agent({`, contains `subagent_type:` and
`prompt:`, ends with `})`.

Codex-side spawn block: starts with `Spawn the codex-...`, continues through
the prompt body block.

### 3.3 Files with spawn block divergences (16 pairs)

| File | Spawn lines |
|---|---|
| references/stage-plan-review.md | 36 |
| references/stage-phase-plan-review.md | 56 |
| references/stage-project-plan-review.md | 38 |
| references/stage-wave-plan-review.md | 49 |
| references/stage-code-review.md | 36 |
| references/stage-wave-code-review.md | 36 |
| references/stage-fast-exec.md | 28 |
| references/stage-project-intake.md | 28 |
| references/stage-wave-exec.md | 11 |
| references/stage-phase-transition.md | 9 |
| references/stage-quick-exec.md | 9 |
| references/stage-wave-verify.md | 12 |
| skills/continue.md | 37 |
| skills/debug.md | 19 |
| skills/task.md | 40 |
| skills/project.md | 12 |

---

## 4. Collision Analysis

### 4.1 ERB opening delimiter `<%`

```bash
grep -r '<%' skills/ agents/
# (no output)
```

No existing files contain `<%`. Safe to use as opening delimiter.

### 4.2 ERB closing delimiter `%>`

```bash
grep -r '%>' skills/ agents/
# (no output)
```

No existing files contain `%>`. Safe to use as closing delimiter.

### 4.3 Mustache-style `{{...}}` placeholders

Existing files **do** use `{{PLACEHOLDER}}` notation for document-level content
slots (e.g., `{{TASK_ID}}`, `{{TITLE}}`, `{{VISION}}`, `{{PLACEHOLDER}}`).
These appear in template/scaffold reference files and are filled in at session
time by the orchestrator agent.

ERB-style `<%= ... %>` does **not** conflict with `{{...}}` because:
- Different delimiter pairs: `<%` vs `{{`
- Different semantic layer: ERB = build-time static substitution; `{{...}}` =
  session-time dynamic content
- Both can coexist in the same file without ambiguity

---

## 5. Prose Wording Divergences

**21 pairs / 170 lines** contain `prose_wording` changes — catch-all differences
not classified as path substitution, agent prefix, or spawn block.

### 5.1 Mechanically templateable prose patterns

Some prose wording differences are systematic and can be expressed with the
existing variables:

| Pattern | Claude form | Codex form | Template |
|---|---|---|---|
| Tool list | `Agent, AskUserQuestion` | `AskUserQuestion` | `<% if claude %>Agent, <% endif %>AskUserQuestion` |
| Agent reference | `do-verifier` | `codex-verifier` | `<%= AGENT_PREFIX %>-verifier` |
| Spawn instruction preamble | "both Agent calls in one response" | "both of the following subagents" | covered by `<% if claude/codex %>` block |
| Description text | "using do-debugger" | "using codex-debugger" | `<%= AGENT_PREFIX %>-debugger` |

### 5.2 Manual review required during consolidation

The following prose wording patterns appear in the catalog but are **not**
mechanically templateable with the defined variables. They require manual review
and author judgment during Phase 01-03 consolidation:

1. **Code-block-embedded path references** (1 instance in stage-plan-review.md,
   lineNum 185): `const installedPath = path.join(require('os').homedir(), '.claude/commands/do/scripts/stage-decision.cjs')` —
   uses JS `os.homedir()` concatenation rather than a tilde-prefixed literal.
   The template variable approach does not apply here; the build script must
   handle this pattern explicitly or the consolidation author must restructure
   the code snippet.

2. **Explanatory rewording** (multiple files): Sentences like "Store result for
   agent spawning" (Claude) vs "Store result for subagent spawning" (Codex),
   or "In the Claude Code agent path" (Claude) vs "In the orchestrated pipeline
   path" (Codex). These are contextual rewrites, not mechanical substitutions.
   During consolidation, the author should choose a platform-neutral phrasing or
   use `<% if claude/codex %>` blocks.

3. **Tools list differences** (skills files): Claude skill files list `Agent` as
   an available tool; Codex files omit it (Codex uses prose spawn instructions
   instead). This maps to `<% if claude %>- Agent<% endif %>` in the YAML
   frontmatter `tools:` list.

4. **Structural differences in skill file preamble** (backlog.md, continue.md,
   fast.md, quick.md): These files have substantially different document
   structure (not just individual line differences). The consolidation author
   must manually review these files and decide whether to use conditional blocks
   or maintain separate source files for them.

---

## 6. Build-Time Resolution

A future build script (`scripts/build.cjs`, to be created in Phase 01) will:

1. Read canonical source files from `_source/` directory (single source of
   truth for consolidated files).
2. For each target platform (`claude`, `codex`), substitute all template
   variables with their platform-specific values.
3. Apply `<% if claude/codex %>...<% endif %>` conditional blocks by including
   only the matching platform's content and stripping the delimiters.
4. Write resolved output to:
   - `skills/do/` (Claude platform)
   - `skills/codex/` and `agents/codex-*.md` (Codex platform)
   - `agents/do-*.md` (Claude platform agents)
5. The regression target for correctness is `baseline-claude.json` and
   `baseline-codex.json` (captured in Wave 02). After a build, running
   `baseline-snapshot.cjs` must produce SHA-256 hashes that match the baseline
   for all non-template-divergent files.

---

## 7. Coverage Cross-Reference

This table confirms that every entry in `divergence-catalog.json`'s `summary`
section maps to a template mechanism defined in this spec.

| Catalog summary entry | Pairs | Lines | Template mechanism |
|---|---|---|---|
| `path_substitution` (base/scripts path, tilde) | 31 | 202 | `<%= PLATFORM_PATH %>` |
| `path_substitution` (shell `${HOME}` variant) | 1 | 2 | `<%= PLATFORM_PATH_SHELL %>` |
| `path_substitution` (display path variant) | 1 | 2 | `<%= PLATFORM_PATH_DISPLAY %>` |
| `path_substitution` (agents path, tilde) | 1 | 4 | `<%= PLATFORM_AGENTS_PATH %>` |
| `path_substitution` (display agents path variant) | 1 | 2 | `<%= PLATFORM_AGENTS_PATH_DISPLAY %>` |
| `path_substitution` (skills dir ref) | 14 | 32 | `<%= PLATFORM_SKILLS_DIR %>` |
| `agent_name_prefix` | 36 | 283 | `<%= AGENT_PREFIX %>` |
| `agent_spawn_block` | 16 | 456 | `<% if claude/codex %>` conditional blocks |
| `prose_wording` (mechanically templateable) | 21 | 170 | `<%= AGENT_PREFIX %>` + `<% if claude/codex %>` |
| `prose_wording` (manual review required) | included above | included above | Documented in Section 5.2 |
| `unclassified` | 0 | 0 | N/A (all lines classified) |

**No `distinctPaths` or `distinctPrefixes` entry in the catalog is left without
a corresponding template variable.**
