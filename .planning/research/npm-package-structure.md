# npm Package Structure for Claude Code Skills

**Researched:** 2026-04-13
**Confidence:** HIGH (official docs + real package analysis)

## Key Finding: Skills vs Commands

Claude Code has merged custom commands into **skills**. Both work:
- `.claude/commands/deploy.md` (legacy)
- `.claude/skills/deploy/SKILL.md` (preferred)

Skills add: directory for supporting files, frontmatter config, auto-invocation by Claude.

## Directory Structure

### Target Installation Layout

```
~/.claude/
├── skills/              # User skills (recommended)
│   └── do/
│       ├── SKILL.md     # Entry point
│       └── workflows/   # Supporting files
└── commands/            # Legacy commands (still works)
    └── do.md
```

### Package Source Layout

```
do/
├── package.json
├── bin/
│   └── install.cjs      # postinstall script
├── skills/
│   └── do/
│       ├── SKILL.md
│       └── ...
└── commands/            # Optional legacy support
    └── do.md
```

## package.json Configuration

```json
{
  "name": "do-lang",
  "version": "0.1.0",
  "description": "Token-efficient meta programming language for Claude Code",
  "files": ["skills", "commands", "bin"],
  "scripts": {
    "postinstall": "node bin/install.cjs"
  },
  "bin": {
    "do-install": "bin/install.cjs"
  },
  "keywords": ["claude-code", "skills", "ai", "meta-programming"]
}
```

### postinstall Script Pattern

```javascript
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');

const source = path.join(__dirname, '..', 'skills');
const target = path.join(os.homedir(), '.claude', 'skills');

// Ensure target exists
fs.mkdirSync(target, { recursive: true });

// Copy skills
fs.cpSync(source, target, { recursive: true });

console.log('do skills installed to ~/.claude/skills/');
```

## GSD Reference Analysis

GSD (v1.30.0) at `~/.claude/get-shit-done/`:

```
get-shit-done/
├── VERSION              # Simple version file
├── bin/                 # CLI tools
│   └── gsd-tools.cjs
├── commands/            # Legacy command stubs
│   └── gsd/
│       └── workstreams.md
├── workflows/           # Main content
├── references/
└── templates/
```

GSD uses a **custom installer** (not npm postinstall). Commands reference workflows via `@$HOME/.claude/get-shit-done/workflows/...` in execution_context.

## SKILL.md Frontmatter

```yaml
---
name: do
description: Token-efficient task execution with semantic compression
argument-hint: "[task description]"
allowed-tools: Read Write Bash Grep Glob Agent
context: fork          # Run in subagent (optional)
agent: general-purpose # Which subagent type
disable-model-invocation: true  # User-only invocation
---
```

Key fields:
- `name`: Becomes `/name` command
- `description`: Claude uses for auto-invocation decisions
- `allowed-tools`: Pre-approved tools during skill execution
- `context: fork`: Run in isolated subagent
- `disable-model-invocation`: Prevent Claude auto-triggering

## yalc Workflow for Local Development

**Install:**
```bash
npm i -g yalc
```

**In package directory:**
```bash
yalc publish              # Publish to local store (~/.yalc/)
yalc push                 # Publish + update all linked projects
yalc push --changed       # Only if files changed
```

**In test project:**
```bash
yalc add do-lang          # Install from local store
yalc update               # Pull latest
yalc remove do-lang       # Clean up
```

**Files created:**
- `~/.yalc/` - Local package store
- `.yalc/` - Package copy in consuming project
- `yalc.lock` - Version tracking

**Dev workflow:**
1. Edit package source
2. Run `yalc push` (auto-updates all linked projects)
3. Test in Claude Code
4. Repeat

## Versioning and Releases

**Semantic versioning:**
```bash
npm version patch   # 0.1.0 -> 0.1.1
npm version minor   # 0.1.0 -> 0.2.0
npm version major   # 0.1.0 -> 1.0.0
```

**Release workflow:**
```bash
npm version patch
npm publish
```

**For pre-releases:**
```bash
npm version prerelease --preid=beta  # 0.1.0-beta.0
npm publish --tag beta
```

## Recommended Structure for "do"

```
do/
├── package.json
├── bin/
│   └── install.cjs           # postinstall: copies to ~/.claude/
├── skills/
│   └── do/
│       ├── SKILL.md          # Main entry point
│       ├── syntax.md         # do-lang syntax reference
│       ├── examples/         # Example programs
│       └── templates/        # Code templates
└── lib/                      # Optional: shared utilities
```

**Installation flow:**
1. User runs `npm i -g do-lang`
2. postinstall copies `skills/` to `~/.claude/skills/`
3. User restarts Claude Code
4. `/do` command available

## Sources

- [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills)
- [yalc GitHub](https://github.com/wclr/yalc)
- GSD package analysis at `~/.claude/get-shit-done/`
