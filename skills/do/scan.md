---
name: do:scan
description: "Create a database entry for a project by scanning its codebase. Use when setting up a new project for the /do workflow, documenting an existing codebase, or when project.md doesn't exist yet. Triggers on 'scan this project', 'document this codebase', 'set up database entry', 'what's in this repo'. Detects tech stack, conventions, and structure automatically."
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

# /do:scan

Scan a project's codebase and create a database entry with tech stack, structure, and conventions.

## Why this exists

Tasks need context. The database entry (`project.md`) captures what a project is, what tech it uses, and where things live — so every `/do:task` can load relevant context automatically. Without this, you're either guessing or re-reading the same files every session.

## Usage

```
/do:scan
```

Run from the project root. Two modes available:
1. **Auto-scan** — Infer everything from codebase, edit project.md after
2. **Interview** — Walk through questions to fill in details

## Prerequisites

- Workspace initialized (`/do:init` completed)
- In a project directory (has `.git/`, `package.json`, or `requirements.txt`)
- Project has `.do/` folder

## Auto-Scan Mode

**Step 1: Scan codebase**

```bash
node ~/.claude/commands/do/scripts/scan-project.cjs <project-path>
```

Detects frameworks, libraries, testing tools, conventions, and directory structure.

If monorepo detected, warn and ask to continue.

**Step 2: Create database folders**

```bash
mkdir -p <database>/projects/<project-name>/{components,tech,features}
```

Copy README templates from @references/ to each subfolder.

**Step 3: Generate project.md**

Using @references/project-template.md, fill in:
- Project name and path
- Detected tech stack (frameworks, UI, state, routing, testing, etc.)
- Key directories with descriptions
- Detected conventions (commit prefixes from git history)

Write to `<database>/projects/<project-name>/project.md`

**Step 4: Update index**

Add entry to `<database>/__index__.md` under `# Projects`:
```markdown
## <Project Name>
- Project folder: <path>
- Database folder: <database>/projects/<project-name>
```

**Step 5: Mark complete**

Set `database_entry: true` in `.do/config.json`

**Step 6: Display summary**

Show what was created, what was detected, and next steps (edit project.md, add component docs).

## Interview Mode

Same as auto-scan but asks for:
1. Project name confirmation
2. Brief description
3. Main purpose
4. Production URL
5. Test/staging URL

Merges user input with detected data.

## Files

- **Detection script:** @scripts/scan-project.cjs
- **Templates:** @references/project-template.md, @references/component-readme.md, @references/tech-readme.md, @references/features-readme.md
