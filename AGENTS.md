# AGENTS.md — do-lang contributor guide

Instructions for AI coding assistants working in this repository. Read this before making any changes.

## What this repo is

do-lang is a token-efficient meta programming language for Claude Code and Codex. It ships as an npm package (`@danielvandervelden/do-lang`) that installs skill files, agent definitions, reference docs, and runtime scripts to the user's `~/.claude/` and/or `~/.codex/` directories. Users invoke these as `/do:task`, `/do:debug`, etc.

## Repository layout

```
do/
├── agents/              ← Agent templates (bare role names: planner.md, executioner.md, ...)
├── bin/
│   ├── install.cjs      ← Postinstall installer (template expansion + file copy)
│   └── expand-templates.cjs  ← Template expansion engine (token scanner + stack parser)
├── skills/
│   ├── *.md             ← Skill templates (task.md, continue.md, fast.md, ...)
│   ├── references/      ← Reference templates loaded on demand by skills/agents
│   └── scripts/         ← Runtime scripts (CommonJS .cjs) — copied as-is, not expanded
│       └── __tests__/   ← Test files (excluded from install)
├── test-fixtures/
│   └── golden/          ← Committed golden fixtures for regression testing
│       ├── claude/      ← Expected expansion output for Claude platform
│       └── codex/       ← Expected expansion output for Codex platform
├── .do/                 ← do-lang's own planning artifacts (uses itself)
├── CLAUDE.md            ← Claude Code-specific instructions (extends this file)
├── README.md            ← User-facing documentation
└── package.json
```

### Key distinction: templates vs installed files

Files in `skills/`, `skills/references/`, and `agents/` are **templates** — they contain `<<DO:...>>` platform markers that get expanded at install time. Users never see these files directly. What users see are the **installed files** at `~/.claude/commands/do/` or `~/.codex/skills/do/`, which are the expanded output.

Files in `skills/scripts/` are **not templates** — they're plain CommonJS scripts copied as-is to both platforms.

## The template system

### Why templates exist

do-lang targets two AI platforms: Claude Code and Codex. These platforms differ in agent spawn syntax, tool names, script paths, and agent naming conventions. Before templates, every skill and agent file existed as two near-identical copies — one per platform — creating 136 files with constant drift risk. Templates collapse each pair into a single source file.

### Marker syntax

All markers use `<<DO:...>>` delimiters (chosen to avoid collision with runtime placeholders like `{{TASK_ID}}`).

**Simple substitutions** — replaced with a platform-specific value:

| Marker | Claude output | Codex output |
|--------|--------------|-------------|
| `<<DO:AGENT_PREFIX>>` | `do` | `codex` |
| `<<DO:SCRIPTS_PATH>>` | `~/.claude/commands/do/scripts` | `~/.codex/skills/do/scripts` |

**Conditional blocks** — include/exclude entire sections:

```markdown
<<DO:IF CLAUDE>>
```javascript
Agent({
  subagent_type: "do-planner",
  ...
})
```
<<DO:ENDIF>>
<<DO:IF CODEX>>
Spawn the codex-planner subagent with the following prompt:
...
<<DO:ENDIF>>
```

Conditional blocks can be nested. The expansion engine uses a stack parser, so `<<DO:IF CLAUDE>>` inside another `<<DO:IF CLAUDE>>` works correctly.

**Inline text markers** — platform-specific text within a single line:

```markdown
This workflow requires <<DO:CLAUDE:agent spawning>><<DO:CODEX:subagent spawning>> to function.
```

Expands to "agent spawning" on Claude, "subagent spawning" on Codex. When both markers are on the same line, the inactive one is removed (not the whole line).

### Rules for writing templates

1. **Every `<<DO:IF ...>>` must have a matching `<<DO:ENDIF>>`** — unmatched blocks cause a parse error at expansion time
2. **Unknown markers throw an error** — the engine is fail-fast; typos like `<<DO:AGENT_PRFX>>` won't silently pass through
3. **`{{...}}` passes through unchanged** — runtime placeholders like `{{TASK_ID}}`, `{{CREATED_AT}}` are not template markers
4. **Frontmatter is expanded too** — YAML frontmatter can contain markers (commonly used for the `- Agent` tool in `allowed-tools`)
5. **Reference files that are identical across platforms need no markers** — they're just plain markdown that gets expanded (a no-op) and copied

### How expansion works (bin/expand-templates.cjs)

The engine has two phases:

1. **Scanner** — tokenizes the input into TEXT, AGENT_PREFIX, SCRIPTS_PATH, IF, ENDIF, and INLINE tokens
2. **Stack parser** — walks tokens with a stack tracking active/inactive conditional depth. Active blocks emit their content; inactive blocks are suppressed. AGENT_PREFIX and SCRIPTS_PATH tokens are replaced with the platform-specific value.

The expansion function signature: `expandTemplate(content, platform)` where platform is `"claude"` or `"codex"`.

## The installer (bin/install.cjs)

Runs as the npm postinstall hook. It:

1. Prompts the user for install target (Claude Code, Codex, or both)
2. For each target platform:
   - Iterates `skills/*.md` templates → expands for the platform → writes to the install directory
   - Iterates `skills/references/*.md` → same expansion → writes to `references/` subdirectory
   - Iterates `agents/*.md` templates → expands → writes with platform prefix (`do-planner.md` for Claude, `codex-planner.md` for Codex)
   - Copies `skills/scripts/` as-is (no expansion), excluding `__tests__/`
3. For Codex only: generates `SKILL.md` wrapper files that register each skill in Codex's `$` picker

### Install paths (these must not change)

| Platform | Skills | Agents | Scripts |
|----------|--------|--------|---------|
| Claude Code | `~/.claude/commands/do/` | `~/.claude/agents/` | `~/.claude/commands/do/scripts/` |
| Codex | `~/.codex/skills/do/` | `~/.codex/agents/` | `~/.codex/skills/do/scripts/` |

### Agent file naming

Templates use bare role names: `planner.md`, `executioner.md`, `code-reviewer.md`, etc. The installer adds the platform prefix at write time:
- Claude: `do-planner.md`, `do-executioner.md`, ...
- Codex: `codex-planner.md`, `codex-executioner.md`, ...

## Creating a new skill

1. **Create the template** at `skills/<name>.md` with YAML frontmatter:
   ```yaml
   ---
   name: do:<name>
   description: "What this skill does"
   argument-hint: '"description"'
   allowed-tools:
     - Read
     - Write
     - Edit
     - Bash
     - Glob
     - Grep
   <<DO:IF CLAUDE>>
     - Agent
   <<DO:ENDIF>>
     - AskUserQuestion
   ---
   ```
   The `- Agent` tool is Claude-only (Codex uses prose-based spawn instructions instead).

2. **Add Codex Agent Authorization** — Codex requires an explicit authorization block listing which agents the skill will spawn. Place it after the title, wrapped in a conditional:
   ```markdown
   <<DO:IF CODEX>>
   ## Agent Authorization
   | Agent | Role |
   |-------|------|
   | <<DO:AGENT_PREFIX>>-planner | Creates the plan |
   ...
   <<DO:ENDIF>>
   ```

3. **Write agent spawn blocks** — use conditional blocks for the platform-specific syntax:
   ```markdown
   <<DO:IF CLAUDE>>
   ```javascript
   Agent({
     subagent_type: "<<DO:AGENT_PREFIX>>-planner",
     model: "<models.overrides.planner || models.default>",
     prompt: `...`
   })
   ```
   <<DO:ENDIF>>
   <<DO:IF CODEX>>
   Spawn the <<DO:AGENT_PREFIX>>-planner subagent with model `...` and prompt:
   ...
   <<DO:ENDIF>>
   ```

4. **Reference scripts** using `<<DO:SCRIPTS_PATH>>` in bash blocks:
   ```bash
   node <<DO:SCRIPTS_PATH>>/check-database-entry.cjs --message
   ```

5. **Add a Files section** at the bottom listing referenced scripts and reference files using the `@scripts/` and `@references/` shorthand:
   ```markdown
   ## Files
   - **Task template:** @references/task-template.md
   - **Gate script:** @scripts/check-database-entry.cjs
   ```

6. **Update the golden fixtures** — run `UPDATE_GOLDEN=1 node --test skills/scripts/__tests__/template-regression.test.cjs` to regenerate fixtures, then verify the expanded output looks correct for both platforms

7. **Update `bin/install.cjs`** — if the new skill needs a Codex wrapper (most do), add an entry to the `codexWrapperSkills` array

8. **Remind the user** to run `/skill-creator` to review and polish the skill (do not invoke it yourself)

## Creating a new agent

1. **Create the template** at `agents/<role>.md` (bare role name, no prefix)
2. Use the same `<<DO:...>>` markers for platform-specific content
3. The installer automatically generates the prefixed output filenames (`do-<role>.md` / `codex-<role>.md`)
4. Update golden fixtures after creation

## Creating a new reference file

1. **Create at `skills/references/<name>.md`**
2. If the content is identical across platforms (no markers needed), it's still processed by the expansion engine — this is a no-op but keeps the pipeline uniform
3. Skills load references using `@references/<name>.md` syntax — the runtime resolves this to the installed path

## Creating a new runtime script

1. **Create at `skills/scripts/<name>.cjs`** (CommonJS, `.cjs` extension)
2. Scripts are copied as-is — no template expansion
3. Add tests in `skills/scripts/__tests__/<name>.test.cjs`
4. The `__tests__/` directory is excluded from installation by the `shouldInstallRuntimeScriptFile` filter

## Testing

### Test runner

```bash
npm test
# or equivalently:
node --test skills/scripts/__tests__/*.test.cjs
```

### Test categories

**Golden regression tests** (`template-regression.test.cjs`):
- Expands every template for both platforms and compares against committed golden fixtures in `test-fixtures/golden/`
- This is the primary guard against template expansion bugs
- Update goldens: `UPDATE_GOLDEN=1 node --test skills/scripts/__tests__/template-regression.test.cjs`

**Structural tests** (various `*-structural.test.cjs`):
- Verify skill/agent files have required frontmatter fields, sections, and reference syntax
- Check that referenced scripts and files exist on disk
- Use `readExpanded(filePath)` helper to test the expanded output (what users see), not the raw template markers

**Unit tests** (per-script):
- Each runtime script in `skills/scripts/` has a corresponding test file
- Test the script's logic directly (config reading, task parsing, council invocation, etc.)

**Integration tests** (`install-package-contract.test.cjs`):
- Runs `npm pack` + postinstall to verify the full install flow

### Test conventions

- All tests use Node.js built-in test runner (`node:test`)
- `ROOT` constant points to the repo root (3 levels up from `skills/scripts/__tests__/`)
- Template source files are at `path.join(ROOT, 'skills', '<file>.md')` and `path.join(ROOT, 'agents', '<role>.md')`
- When testing content users see, use the `readExpanded()` helper (reads template, expands for a platform) rather than reading the raw template

### Path conventions in tests

- **Source paths** (repo layout): `skills/<name>.md`, `skills/references/<name>.md`, `agents/<role>.md`
- **Install paths** (user machine): `~/.claude/commands/do/<name>.md`, `~/.claude/agents/do-<role>.md`
- **Script shorthand** in prose/docs: `@scripts/<name>.cjs` (not a real path — resolves to the install path at runtime)

## Conventions

### Git
- Conventional commits required (commitlint configured)
- Prefixes: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`
- Branch naming: `feat/<description>`, `fix/<description>`, `chore/<description>`
- Never commit directly to main — use branches

### Code style
- CommonJS modules (`.cjs` extension for all scripts)
- JSDoc comments for exported functions
- No TypeScript — plain JavaScript throughout

### Post-task checklist
- Run `npm test` — all tests must pass
- If templates changed: update golden fixtures and verify expanded output
- If the change affects features, install paths, or the agent pipeline: flag README.md for update
- If a skill was created or heavily edited: remind the user to run `/skill-creator`

## What NOT to do

- **Never edit installed files directly** — `~/.claude/commands/do/`, `~/.codex/skills/do/`, `~/.claude/agents/`, `~/.codex/agents/` are all generated output. Edit the source templates in this repo instead.
- **Never add platform-specific source files** — no `skills/do/` or `skills/codex/` directories. All platform differences go through `<<DO:...>>` markers in a single template.
- **Never change install paths** — the paths where files are installed (`~/.claude/commands/do/scripts/`, etc.) are part of the public contract. Changing them breaks all existing installs.
- **Never skip tests** — `npm test` must be green before any release.
