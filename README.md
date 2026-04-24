# do-lang

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Token-efficient meta programming language for Claude Code.

## What is do?

**do** brings structured, repeatable task execution to Claude Code. Without structure, AI coding assistants produce inconsistent results — great one session, off-track the next. do-lang fixes this by wrapping complex AI workflows — plan, review, implement, verify — in a flat agent hierarchy (one coordinator, no nested chains of sub-agents) that keeps token usage low and quality gates intact.

- **Structured workflows**: Every task follows the same pipeline — no ad-hoc conversations
- **Quality gates**: Parallel plan review + council review (a second AI checks the plan from outside) before execution; code review + verification after
- **State persistence**: Progress saved in `.do/` so sessions can resume at any stage
- **Direct user interaction**: Agents ask questions inline via a structured prompt — no going through an intermediary
- **Installs to Claude Code**: Requires Node.js ≥18 and npm for installation; no separate runtime needed at usage time

## Workspace Architecture

do-lang expects a **workspace** — a root directory that contains your projects and a shared knowledge base (called the "database"). A typical layout:

```
~/workspace/                        ← workspace root
├── .do-workspace.json              ← workspace config (created by /do:init)
├── AGENTS.md                       ← instructions for AI assistants
├── database/                       ← centralized knowledge base
│   ├── __index__.md                ← barrel imports (project registry)
│   ├── projects/
│   │   ├── my-frontend/            ← per-project docs, conventions, tech notes
│   │   └── my-backend/
│   └── shared/                     ← cross-project patterns and standards
└── github-projects/                ← your actual git repos
    ├── my-frontend/
    │   └── .do/                    ← task state for this repo (plans, logs, config)
    └── my-backend/
        └── .do/
```

Each repo has a `.do/` folder for **task state** — active plans, execution logs, debug sessions. This is ephemeral, per-repo working data.

Project **knowledge** lives in the centralized `database/` instead. Why not just store everything in each repo's `.do/` folder?

- **Shared conventions** — Code style, component patterns, naming rules, and architectural decisions often apply across multiple repos. A centralized database avoids duplicating them in every `.do/` folder and keeps them in sync.
- **Cross-repo context** — When working on a frontend repo, the AI can reference the backend's API docs, serializer shapes, or model definitions without switching repos. A centralized database makes this a natural lookup.
- **Multi-repo projects** — Many projects span multiple repos. The database documents the project holistically rather than fragmenting knowledge across repos.
- **Version-controllable workspace** — The workspace root (including the database) can be its own git repository. This means your entire knowledge base — project docs, shared patterns, daily logs — is version-controlled and portable across machines.
- **No repo pollution** — Project repos stay clean. Documentation and AI context don't clutter the codebase or show up in PRs. The `.do/` folder stays small: just config and active task state.
- **Survivable across forks and clones** — Since knowledge isn't embedded in the repo, a fresh clone or a colleague's fork doesn't lose or inherit your AI workflow context.

## Installation

This package is published to **GitHub Packages** under the `@danielvandervelden` scope.

<details>
<summary>🤖 <strong>AI-assisted install</strong> — paste this into your AI coding assistant</summary>

<br>

> Install the `@danielvandervelden/do-lang` npm package globally. It's published to GitHub Packages, not the public npm registry.
>
> 1. Ensure `~/.npmrc` contains the line `@danielvandervelden:registry=https://npm.pkg.github.com` (add it if missing, don't overwrite existing content)
> 2. Run `npm install -g @danielvandervelden/do-lang --registry https://npm.pkg.github.com`
> 3. Verify the install by checking that `~/.claude/commands/do/` and `~/.claude/agents/` were populated by the postinstall script

</details>

**Step 1 — Point the scope to GitHub Packages in `~/.npmrc`:**

```
@danielvandervelden:registry=https://npm.pkg.github.com
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

This sets up the database structure and `.do-workspace.json`. Run again inside a project directory to initialize `.do/config.json` for that project.

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

### Workspace — `.do-workspace.json`

Created at the workspace root by `/do:init`. Tells do-lang where your database and projects live, and which AI tools are available for council reviews.

```json
{
  "version": "0.1.0",
  "workspace": "/absolute/path/to/workspace",
  "database": "/absolute/path/to/workspace/database",
  "githubProjects": "/absolute/path/to/workspace/github-projects",
  "initializedAt": "2026-04-13T20:45:00.000Z",
  "availableTools": ["codex", "gemini"],
  "defaultReviewer": "random",
  "council_reviews": { "planning": true, "execution": true }
}
```

**`availableTools`** — AI CLIs detected during init (used for council reviews). **`defaultReviewer`** — which tool to use: `"codex"`, `"gemini"`, `"both"`, or `"random"`. These serve as workspace-level defaults — project config in `.do/config.json` overrides them.

### Project — `.do/config.json`

Project-level configuration lives in `.do/config.json`. The JSON below shows the user-editable settings:

```json
{
  "version": "0.3.0",
  "project_name": "my-app",
  "council_reviews": {
    "planning": true,
    "execution": true,
    "reviewer": "random",
    "project": {
      "plan": true,
      "phase_plan": true,
      "wave_plan": true,
      "code": true
    }
  },
  "web_search": {
    "context7": true
  },
  "models": {
    "default": "sonnet",
    "overrides": {}
  },
  "auto_grill_threshold": 0.9,
  "project_intake_threshold": 0.85
}
```

**`project_name`** — human-readable name for this project (used in reports and prompts).

**`council_reviews.reviewer`** — which external AI to use for council reviews: `"codex"`, `"gemini"`, `"both"`, or `"random"`. Set `planning` and `execution` to `false` to disable council reviews for those stages. The nested `project` object controls review gates for `/do:project` workflows (plan, phase plan, wave plan, and code review).

**`web_search.context7`** — enables ctx7 documentation lookups during planning (do-planner), debugging (do-debugger), and `/do:optimise` audits. Set to `false` to skip library-doc fetching.

**`auto_grill_threshold`** — confidence score below which `/do:task` spawns `do-griller` for clarifying questions. Default `0.9`.

**`project_intake_threshold`** — confidence score below which `/do:project new` triggers additional grilling before planning. Default `0.85`.

**`models.overrides`** — per-agent model overrides (e.g. `{"planner": "opus", "debugger": "opus"}`). Agents not listed fall back to `models.default`.

**State (managed automatically)** — do-lang writes these fields to `.do/config.json` during normal operation. Do not edit them manually:

- `database_entry` — whether this project has a database entry (`true` / `false`)
- `active_task` — filename of the currently running task (`null` when idle)
- `active_debug` — filename of the active debug session (`null` when idle)
- `active_project` — slug of the active `/do:project` session (`null` when idle)
- `delivery_contract` — delivery settings established during onboarding (`onboarded`, `dismissed`, `entry_commands`)

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
