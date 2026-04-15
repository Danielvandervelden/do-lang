# do-lang

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Token-efficient meta programming language for Claude Code.

## What is do?

**do** brings structured, repeatable task execution to Claude Code. It wraps complex AI workflows — plan, review, implement, verify — in a flat agent hierarchy that keeps token usage low and quality gates intact.

- **Structured workflows**: Every task follows the same pipeline — no ad-hoc conversations
- **Quality gates**: Parallel plan review + council review before execution; code review + verification after
- **State persistence**: Progress saved in `.do/` so sessions can resume at any stage
- **Claude Code only**: Installs to `~/.claude/` — no other runtime required

## Installation

This package is published to **GitHub Packages** under the `@danielvandervelden` scope. You need a GitHub personal access token with `read:packages` permission.

**Step 1 — Configure `~/.npmrc`:**

```
@danielvandervelden:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

**Step 2 — Install globally:**

```bash
npm install -g @danielvandervelden/do-lang
```

The postinstall script copies files to:
- `~/.claude/commands/do/` — skill files (`/do:*` commands)
- `~/.claude/agents/` — agent definitions

## Quick Start

### Initialize your workspace

Run once at the workspace root:

```
/do:init
```

This sets up the database structure and `.do/config.json`.

### Scan a project

Inside a project, create a database entry:

```
/do:scan
```

### Run a task

```
/do:task "add pagination to the user list"
```

The orchestrator runs the full pipeline: plan → review → grill (if unclear) → user approval → execute → code review → verify.

For trivial changes (1-3 files, no shared abstractions), use the fast path instead:

```
/do:fast "fix the typo in the header component"
```

Skips planning ceremony — entry criteria check, execute, validate, single code review round.

### Resume an interrupted session

```
/do:continue
```

Reads the task file's YAML frontmatter and picks up at the last completed stage.

## Commands

| Command | Description |
|---------|-------------|
| `/do:init` | Initialize workspace or project (database structure, config) |
| `/do:scan` | Scan a project and create a database entry |
| `/do:task` | Full task workflow — plan, review, execute, verify |
| `/do:fast` | Lightweight fast path for trivial changes (1-3 files) — skips planning ceremony |
| `/do:continue` | Resume a task from its last completed stage |
| `/do:abandon` | Pause a task and preserve its state for later |
| `/do:debug` | Scientific method debugging with persistent session state |
| `/do:update` | Check for a newer version and self-update |
| `/do:optimise` | Audit any target (agent, skill, script, project) against best practices |

## Agent Pipeline

`/do:task` coordinates eight specialized agents:

| Agent | Role |
|-------|------|
| `do-planner` | Creates the task plan, loads context, calculates confidence |
| `do-plan-reviewer` | Self-review of the plan — returns PASS / CONCERNS / RETHINK |
| `do-council-reviewer` | External AI council review via `council-invoke.cjs` |
| `do-griller` | Asks clarifying questions when confidence falls below threshold |
| `do-executioner` | Implements the plan step by step with deviation handling |
| `do-code-reviewer` | Self-review of the diff — returns APPROVED / NITPICKS_ONLY / CHANGES_REQUESTED |
| `do-verifier` | Approach checklist, quality checks, UAT sign-off |
| `do-debugger` | Scientific method debugging (hypothesis → test → confirm/reject) |

### Full task flow

```
do-planner → orchestrator spawns in parallel:
               ├── do-plan-reviewer  (PASS / CONCERNS / RETHINK)
               └── do-council-reviewer  (LOOKS_GOOD / CONCERNS / RETHINK)
             Combined verdict → APPROVED / ITERATE / ESCALATE
             (ITERATE: re-plan + re-review, up to 3×)
                     ↓
             do-griller  (if confidence < threshold)
                     ↓
             USER APPROVAL
                     ↓
             do-executioner
                     ↓
             orchestrator spawns in parallel:
               ├── do-code-reviewer  (APPROVED / NITPICKS_ONLY / CHANGES_REQUESTED)
               └── do-council-reviewer  (APPROVED / NITPICKS_ONLY / CHANGES_REQUESTED)
             Combined verdict → VERIFIED / ITERATE
             (ITERATE: fix → re-review, up to 3×)
                     ↓
             do-verifier
                     ↓
                  complete
```

## Configuration

Project configuration lives in `.do/config.json`:

```json
{
  "council_reviews": {
    "planning": true,
    "execution": true,
    "reviewer": "random"
  },
  "models": {
    "default": "sonnet",
    "overrides": {}
  },
  "auto_grill_threshold": 0.9
}
```

**`council_reviews.reviewer`** — which external AI to use for council reviews: `"codex"`, `"gemini"`, `"both"`, or `"random"`. Set `planning` and `execution` to `false` to disable council reviews for those stages.

## Development

### Local testing with yalc

```bash
git clone https://github.com/Danielvandervelden/do-lang.git
cd do-lang
yalc publish
```

In a test project:

```bash
yalc add @danielvandervelden/do-lang
```

After making changes:

```bash
yalc push
```

Clean up when done:

```bash
yalc remove @danielvandervelden/do-lang
```

### Running tests

```bash
node --test skills/do/scripts/__tests__/*.test.cjs
```

## License

MIT
