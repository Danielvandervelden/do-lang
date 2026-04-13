# do-lang

[![npm version](https://img.shields.io/npm/v/do-lang.svg)](https://www.npmjs.com/package/do-lang)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Token-efficient meta programming language for Claude Code and Codex.

## What is do?

**do** solves the context bloat problem in AI-assisted development.

Modern AI coding assistants often spawn nested subagents that burn through tokens rapidly. A task that should cost $0.50 can spiral to $5+ when agents spawn agents spawn agents. **do** provides structured workflows with a flat agent hierarchy:

- **Flat hierarchy**: Orchestrator coordinates single agents per phase (no nesting)
- **Token efficiency**: Every architectural decision minimizes token usage
- **State persistence**: Progress saved in project `.do/` folder
- **Quality gates**: Planning, verification, and debugging without the overhead

## Installation

Install globally via npm:

```bash
npm i -g do-lang
```

This copies the do skills to `~/.claude/skills/do/`.

### Verify Installation

Check that the skills were installed:

```bash
ls ~/.claude/skills/do/
```

You should see `SKILL.md` and any additional skill files.

## Quick Start

### First Time Setup

Initialize your workspace:

```
/do:init
```

This sets up the database structure and configuration files.

### In a Project

Scan the project to create a database entry:

```
/do:scan
```

This analyzes your project and creates documentation in the database.

### Start Working

Create and execute a task:

```
/do:task "add user authentication with JWT"
```

The do system will:
1. Refine your task description
2. Challenge unclear requirements (if confidence < 0.9)
3. Ask before clearing context
4. Execute with a single agent
5. Verify the implementation

## Commands

| Command | Description |
|---------|-------------|
| `/do:init` | Initialize workspace and project configuration |
| `/do:scan` | Scan project and create database entry |
| `/do:task` | Create and refine a task with AI assistance |
| `/do:continue` | Resume from last task state |
| `/do:debug` | Structured debugging workflow |

### /do:init

Context-aware setup that detects workspace vs project level:
- **Workspace level**: Creates database structure, canonical AGENTS.md
- **Project level**: Creates `.do/` folder with `config.json` and `tasks/`

### /do:scan

Analyzes your project and creates documentation:
- Detects tech stack from package.json, requirements.txt, etc.
- Maps directory structure
- Identifies key components and patterns
- Creates `project.md` in your database

### /do:task

Full task workflow with flat agent hierarchy:
- Refines task description with AI assistance
- Challenges unclear requirements
- Executes with single implementation agent
- Verifies against plan

### /do:continue

Resumes from last task state by reading YAML frontmatter status.

### /do:debug

Structured debugging workflow using the scientific method:
- Form hypothesis
- Test hypothesis
- Confirm or reject
- Iterate until resolved

## Development

### Local Testing with yalc

Clone the repository:

```bash
git clone https://github.com/globalroo/do.git
cd do
```

Publish to local yalc store:

```bash
yalc publish
```

In a test location, add the package:

```bash
yalc add do-lang
```

After making changes, push updates to all linked locations:

```bash
yalc push
```

### Cleanup

Remove the yalc link when done:

```bash
yalc remove do-lang
```

## Architecture

### Flat Agent Hierarchy

The core architectural principle is **no nested subagents**:

```
Orchestrator
    |
    +-- Refine Agent (one at a time)
    +-- Implementation Agent (one at a time)
    +-- Verify Agent (one at a time)
```

Each phase has exactly one agent. Agents never spawn other agents.

### State Management

All state lives in the project's `.do/` folder:

```
.do/
  config.json    # Project-specific settings
  tasks/
    current.md   # Active task with YAML frontmatter
    completed/   # Archived completed tasks
```

Task files use YAML frontmatter for machine-parseable status:

```yaml
---
id: task-001
status: in-progress
stage: implementation
confidence: 0.95
---

# Task: Add user authentication

## Description
...
```

### Token Efficiency Patterns

1. **Load only what's needed**: Each command reads its own file, no router overhead
2. **Explicit state**: YAML frontmatter instead of inference
3. **Single agent per phase**: No context multiplication from nesting
4. **Progressive disclosure**: SKILL.md body < 500 lines, references as needed

## Configuration

Project configuration in `.do/config.json`:

```json
{
  "council": {
    "enabled": true,
    "threshold": 0.9
  },
  "debug": {
    "verbose": false
  }
}
```

## License

MIT
