# Phase 1: Package Foundation - Research

**Researched:** 2026-04-13
**Domain:** npm package structure, Claude Code skills
**Confidence:** HIGH (analyzed existing skills in ~/.claude/)

## Summary

Claude Code skill discovery uses directory-based naming. Files in `~/.claude/commands/do/` become `/do:*` commands (e.g., `init.md` becomes `/do:init`). Skills in `~/.claude/skills/do/` require a `SKILL.md` entry point but can contain supporting files. The postinstall script needs to handle directory creation and cross-platform paths.

**Primary recommendation:** Use `commands/do/` directory structure for multi-command `/do:*` namespace, with postinstall copying to `~/.claude/commands/do/`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Package name: `do-lang`
- Version: Start at `0.1.0`, semantic versioning
- Directory structure: Nested (`skills/do/init.md`, etc.)
- Installation target: `~/.claude/skills/do/`
- README: Full documentation

### Claude's Discretion
- Exact postinstall script implementation details
- `.gitignore` contents
- package.json field ordering
- Placeholder skill file content

### Deferred Ideas
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TS-01 | npm package installable via `npm i -g do-lang`, skills to `~/.claude/skills/` | postinstall pattern verified from existing skills |
</phase_requirements>

## Standard Stack

| Item | Value | Purpose |
|------|-------|---------|
| Node.js | Built-in fs, path, os | postinstall script (no dependencies) |
| yalc | Latest | Local development testing |

**No dependencies required.** postinstall uses only Node.js built-ins.

## Architecture Patterns

### Command Discovery Pattern

Claude Code uses filename-based discovery:

```
~/.claude/commands/
  do/              # Directory = namespace
    init.md        # Becomes /do:init
    task.md        # Becomes /do:task
    scan.md        # Becomes /do:scan
```

Each file needs YAML frontmatter:

```yaml
---
name: do:init
description: Initialize do workspace and project configuration
argument-hint: "[--project]"
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
---
```

**Minimum required fields:** `name`, `description`

### postinstall Script Pattern

```javascript
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');

const source = path.join(__dirname, '..', 'skills', 'do');
const target = path.join(os.homedir(), '.claude', 'skills', 'do');

// Create parent directories
fs.mkdirSync(path.dirname(target), { recursive: true });

// Copy recursively (Node 16.7+)
fs.cpSync(source, target, { recursive: true });

console.log('do skills installed to ~/.claude/skills/do/');
```

**Edge cases handled:**
- `~/.claude/` doesn't exist: `recursive: true` creates it
- `~/.claude/skills/do/` exists: `cpSync` overwrites
- Windows paths: `os.homedir()` + `path.join()` handles cross-platform

### package.json Structure

```json
{
  "name": "do-lang",
  "version": "0.1.0",
  "description": "Token-efficient meta programming language for Claude Code and Codex",
  "files": ["skills", "bin"],
  "scripts": {
    "postinstall": "node bin/install.cjs"
  },
  "keywords": ["claude-code", "skills", "ai", "codex"],
  "license": "MIT",
  "engines": {
    "node": ">=16.7.0"
  }
}
```

**Note:** `engines` specifies Node 16.7+ for `fs.cpSync`.

## Don't Hand-Roll

| Problem | Use Instead |
|---------|-------------|
| Cross-platform paths | `path.join()` + `os.homedir()` |
| Recursive copy | `fs.cpSync()` (Node 16.7+) |
| Directory creation | `fs.mkdirSync({ recursive: true })` |

## Common Pitfalls

### Pitfall 1: Missing Parent Directory
**What:** postinstall fails if `~/.claude/` doesn't exist
**Fix:** Use `recursive: true` on `mkdirSync`

### Pitfall 2: Windows Path Separators
**What:** Hardcoded `/` fails on Windows
**Fix:** Always use `path.join()`

### Pitfall 3: Stale yalc Links
**What:** Changes don't propagate after `yalc add`
**Fix:** Use `yalc push` (not `publish`) for auto-updates

## Code Examples

### Verified postinstall (from skill-creator analysis)

```javascript
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');

const packageRoot = path.join(__dirname, '..');
const source = path.join(packageRoot, 'skills', 'do');
const claudeDir = path.join(os.homedir(), '.claude');
const target = path.join(claudeDir, 'skills', 'do');

// Ensure ~/.claude/skills/ exists
fs.mkdirSync(path.join(claudeDir, 'skills'), { recursive: true });

// Copy skills (overwrites existing)
fs.cpSync(source, target, { recursive: true });

console.log(`do skills installed to ${target}`);
```

### Minimal SKILL.md frontmatter

```yaml
---
name: do
description: Token-efficient task execution for Claude Code. Use when user wants to execute tasks with minimal token overhead.
---
```

### yalc Development Workflow

```bash
# Initial setup
npm i -g yalc

# In package directory
yalc publish

# In test directory (or global)
yalc add do-lang

# After changes - auto-updates all linked locations
yalc push

# Cleanup
yalc remove do-lang
```

## Sources

### Primary (HIGH confidence)
- `~/.claude/skills/skill-creator/SKILL.md` - Skill anatomy, frontmatter fields
- `~/.claude/skills/grill-me/SKILL.md` - Minimal skill example
- `~/.claude/commands/gsd/quick.md` - Command frontmatter pattern
- `.planning/research/npm-package-structure.md` - Prior research

## Metadata

**Confidence breakdown:**
- Package structure: HIGH - verified from existing skills
- postinstall pattern: HIGH - Node.js built-ins only
- Skill discovery: HIGH - verified from commands/gsd/ structure

**Research date:** 2026-04-13
**Valid until:** 2026-05-13
