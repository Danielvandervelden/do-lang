# do-lang

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Token-efficient meta programming language for Claude Code.

## What is do?

**do** brings structured, repeatable task execution to Claude Code. It wraps complex AI workflows — plan, review, implement, verify — in a flat agent hierarchy that keeps token usage low and quality gates intact.

- **Structured workflows**: Every task follows the same pipeline — no ad-hoc conversations
- **Quality gates**: Parallel plan review + council review before execution; code review + verification after
- **State persistence**: Progress saved in `.do/` so sessions can resume at any stage
- **Direct user interaction**: Agents ask questions via AskUserQuestion with inline text fallback — no orchestrator relay
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

do-lang has three execution tiers:

**`/do:task` — smart router (default entry point)**

```
/do:task "add pagination to the user list"
```

The orchestrator assesses the task and auto-routes between fast-path and the full pipeline. Full pipeline: plan → review → grill (if unclear) → user approval → execute → code review → verify. The router only picks between fast and full — `/do:quick` is manual-only.

**`/do:fast` — mid-tier fast path (skip the router)**

```
/do:fast "fix the typo in the header component"
```

For trivial changes (1-3 files, no shared abstractions). Skips planning ceremony — entry criteria check, execute, validate, single code review round.

**`/do:quick` — tightest tier (manual-only)**

```
/do:quick "add the null-check we just discussed in parseToken"
```

For mid-conversation follow-ups where context is already warm and the change is 1-2 files of mechanical work. Orchestrator executes inline (no sub-agent spawn), runs available validation, then a single council reviewer checks the diff in place. One iteration allowed. If council requests changes twice, materializes a task file and escalates to `/do:continue`.

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
| `/do:task` | Smart router — auto-selects fast or full pipeline based on task assessment |
| `/do:fast` | Mid-tier fast path — skip router, run fast-path directly (1-3 files, trivial changes) |
| `/do:quick` | Tightest tier — inline execution + single council review, no task file on happy path |
| `/do:continue` | Resume a task from its last completed stage |
| `/do:abandon` | Pause a task and preserve its state for later |
| `/do:debug` | Scientific method debugging with persistent session state |
| `/do:update` | Check for a newer version and self-update |
| `/do:optimise` | Audit any target (agent, skill, script, project) against best practices |
| `/do:backlog` | Manage the backlog — list, add, start (promote to task), done (remove) |
| `/do:project` | Multi-phase project orchestrator — intake, phases, waves, resume |

### Run a project

For large initiatives that span multiple sessions, phases, and waves of work:

```
/do:project new my-app
```

The orchestrator runs a structured intake interview (two passes of grilling), then plans the project into phases and waves. Each wave goes through the full pipeline: plan → review → execute → code review → verify.

```
/do:project new <slug>              Start a new project (intake → plan review)
/do:project phase new <slug>        Create and plan a new phase
/do:project phase complete          Complete the active phase → handoff → next phase
/do:project wave next               Activate next wave → plan → execute → review → verify
/do:project status                  Read-only status table
/do:project resume                  Cold-start resume from any point
/do:project complete                Render completion summary
/do:project abandon                 Cascade abandon + archive
```

State persists in `.do/projects/` — fully separate from `/do:task`'s `.do/tasks/`. `/do:project resume` reloads context from disk and routes to the exact stage where work left off.

## Agent Pipeline

`/do:task` coordinates eight specialized agents:

| Agent | Role |
|-------|------|
| `do-planner` | Creates the task plan, loads context, calculates confidence |
| `do-plan-reviewer` | Self-review of the plan — returns PASS / CONCERNS / RETHINK |
| `do-council-reviewer` | External AI council review via `council-invoke.cjs` |
| `do-griller` | Asks clarifying questions directly via AskUserQuestion when confidence falls below threshold |
| `do-executioner` | Implements the plan step by step; resolves blocking deviations via AskUserQuestion |
| `do-code-reviewer` | Self-review of the diff — returns APPROVED / NITPICKS_ONLY / CHANGES_REQUESTED |
| `do-verifier` | Approach checklist, quality checks, UAT sign-off via AskUserQuestion |
| `do-debugger` | Scientific method debugging (hypothesis → test → confirm/reject) |

### Full task flow

```
do-planner → orchestrator spawns in parallel:
               ├── do-plan-reviewer  (PASS / CONCERNS / RETHINK)
               └── do-council-reviewer  (LOOKS_GOOD / CONCERNS / RETHINK)
             Combined verdict → APPROVED / ITERATE / ESCALATE
             (ITERATE: classify findings as blocker/nitpick;
              nitpick-only → inline fix + PASS, no re-spawn;
              any blocker → re-plan + re-review, up to 3×)
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
             (ITERATE: classify findings, prioritized brief
              [blockers first, nitpicks second] → fix → re-review, up to 3×)
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
  "web_search": {
    "context7": true
  },
  "models": {
    "default": "sonnet",
    "overrides": {}
  },
  "auto_grill_threshold": 0.9
}
```

**`council_reviews.reviewer`** — which external AI to use for council reviews: `"codex"`, `"gemini"`, `"both"`, or `"random"`. Set `planning` and `execution` to `false` to disable council reviews for those stages.

**`web_search.context7`** — enables ctx7 documentation lookups during `/do:optimise`. Set to `false` to skip library-doc fetching.

**`auto_grill_threshold`** — confidence score below which `/do:task` spawns `do-griller` for clarifying questions. Default `0.9`.

**`models.overrides`** — per-agent model overrides (e.g. `{"planner": "opus", "debugger": "opus"}`). Agents not listed fall back to `models.default`.

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
