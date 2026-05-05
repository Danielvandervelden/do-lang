# Handoff: Skill/Agent File Consolidation

## Task

- **Task file:** `.do/tasks/260505-skill-agent-file-consolidation.md`
- **Backlog item:** `skill-dedup-research`
- **Repo:** `~/workspace/github-projects/do/`
- **Stage:** `execution` (in_progress)
- **Confidence:** 0.93

## What this task does

Consolidates 136 duplicated markdown files (skills + agents, one set per platform) into ~68 single-source templates with `<<DO:...>>` platform markers, expanded at install time by `bin/install.cjs`.

## Current status: Phase 3 complete, Phases 4-5 remain

### Completed phases

**Phase 1 (expansion engine):**
- `bin/expand-templates.cjs` — token scanner + stack parser, handles 4 marker types
- `skills/do/scripts/__tests__/expand-templates.test.cjs` — 48 unit tests, all pass
- Marker types: `<<DO:AGENT_PREFIX>>`, `<<DO:SCRIPTS_PATH>>`, `<<DO:IF CLAUDE/CODEX>>...<<DO:ENDIF>>`, `<<DO:CLAUDE:text>>` / `<<DO:CODEX:text>>`

**Phase 2 (golden fixtures):**
- `bin/snapshot-golden.cjs` — one-time generator (to be removed in step 15)
- `test-fixtures/golden/{claude,codex}/` — 68 files each, committed permanently
- `skills/scripts/__tests__/template-regression.test.cjs` — 137 tests, all pass

**Phase 3 (templates + restructure):**
- 8 agent templates in `agents/` (bare role names: `planner.md`, `executioner.md`, etc.)
- 13 skill templates in `skills/` (top-level: `task.md`, `continue.md`, etc.)
- 47 reference templates in `skills/references/`
- `skills/scripts/` — copied from `skills/do/scripts/` (old dir still exists, removed in Phase 5)
- `bin/generate-templates.cjs` — one-time auto-generation script (can be removed)
- Runtime scripts updated: `council-gate.cjs`, `optimise-target.cjs`, `project-scaffold.cjs`, etc. — all `skills/do/` source-repo paths → `skills/`
- Expansion engine bugfix: inactive IF blocks no longer eat newlines past ENDIF

### Remaining: Phase 4 (steps 9-10) and Phase 5 (steps 11-15)

**Phase 4: Update the installer**

- **Step 9:** Rewrite `bin/install.cjs` to use `expandTemplate()` instead of copying from two source trees
  - Import `expandTemplate` from `./expand-templates.cjs`
  - `installClaudeCode()`: iterate `skills/*.md`, `skills/references/*.md`, `agents/*.md` templates → expand for "claude" → write to `~/.claude/commands/do/` and `~/.claude/agents/`
  - `installCodex()`: same → expand for "codex" → write to `~/.codex/skills/do/` and `~/.codex/agents/`
  - Agent output filenames: `{prefix}-{role}.md` (e.g., `do-planner.md` for claude)
  - Scripts: copy from `skills/scripts/` as-is. **Update `shouldInstallRuntimeScriptFile`** to exclude entire `__tests__/` directory (not just `install-*` prefixed files)
  - SKILL.md wrapper generation: unchanged
  - Keep exports `installClaudeCode` and `installCodex`

- **Step 10:** Update `package.json`
  - Test script path: `skills/do/scripts/__tests__/*.test.cjs` → `skills/scripts/__tests__/*.test.cjs`
  - `files` field already includes `"skills"`, `"agents"`, `"bin"` — should cover new layout

**Phase 5: Update tests, validate, clean up**

- **Step 11:** Update ALL 24 test files (now at `skills/scripts/__tests__/`)
  - Update `path.join(ROOT, 'skills', 'do', ...)` → `path.join(ROOT, 'skills', ...)`
  - Update `path.join(ROOT, 'skills', 'codex', ...)` where they exist
  - Update relative `require()` paths (depth changes from 4 to 3 levels up to reach `bin/`)
  - 6 high-touch, 3 medium-touch, 15 low-touch (see task file step 11 for full list)
  - Structural tests that scanned both platform trees should be rewritten to verify expansion output against goldens

- **Step 12:** Run golden regression test — must pass (all templates match goldens byte-for-byte)

- **Step 13:** Remove old source directories
  - Delete `skills/do/` (markdown moved to `skills/`, scripts already at `skills/scripts/`)
  - Delete `skills/codex/` (entirely replaced by templates)
  - Delete 16 prefixed agent files (`agents/do-*.md`, `agents/codex-*.md`)

- **Step 14:** Update README.md and `database/projects/do/project.md`
  - Test runner command path
  - Directory layout descriptions
  - Key Directories table

- **Step 15:** Remove one-time scripts (`bin/snapshot-golden.cjs`, `bin/generate-templates.cjs`)

## Key files to know

| File | Purpose |
|------|---------|
| `.do/tasks/260505-skill-agent-file-consolidation.md` | Full task plan + execution log |
| `bin/expand-templates.cjs` | Expansion engine (token scanner + stack parser) |
| `bin/install.cjs` | Installer — needs rewrite in step 9 |
| `skills/scripts/__tests__/template-regression.test.cjs` | Golden regression test (137 tests) |
| `test-fixtures/golden/{claude,codex}/` | Committed golden fixtures (68 files each) |

## Verification commands

```bash
# Existing tests (old path, still works until Phase 5)
node --test skills/do/scripts/__tests__/*.test.cjs

# Regression test (templates vs goldens)
node --test skills/scripts/__tests__/template-regression.test.cjs

# After Phase 5 (new unified path)
node --test skills/scripts/__tests__/*.test.cjs
```

## Important constraints

- **Install paths must NOT change:** `~/.claude/commands/do/scripts/`, `~/.codex/skills/do/scripts/` stay as-is
- **Source-repo paths DID change:** `skills/do/` → `skills/`, `agents/do-*` → `agents/{role}.md`
- **`skills/do/scripts/` was copied (not moved)** — old dir still exists for test compatibility. Remove in step 13.
- **`shouldInstallRuntimeScriptFile` filter must be widened** in step 9 to exclude all `__tests__/` files, not just `install-*`
- **No auto-commits** — user commits manually
- **Phased with checkpoints** — `npm test` green at each phase boundary

## How to continue

```
/do:continue
```

The task file has full execution log and remaining steps. Phase 4 is next.
