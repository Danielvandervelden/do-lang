---
name: do
description: "Token-efficient task execution for Claude Code. Use this skill when the user wants to work on a coding task, fix a bug, create something, continue previous work, or set up a new project. Triggers on phrases like 'let's work on...', 'I need to build...', 'fix this bug', 'continue where we left off', 'set up this project'. Routes to the appropriate /do:* sub-command based on intent."
allowed-tools:
  - Read
  - Bash
  - AskUserQuestion
---

# /do

Token-efficient task execution — accomplishes coding work with minimal overhead by routing to specialized sub-commands.

## Why this exists

Most coding tasks follow predictable patterns: initialize a project, scan for context, create a task, execute it, verify it works, or debug when things break. Rather than loading heavy workflows upfront, /do routes to lean sub-commands that load only what's needed for each step. This keeps context clean and execution fast.

## Sub-commands

| Command | When to use |
|---------|-------------|
| `/do:init` | Setting up a new project or checking workspace health |
| `/do:scan` | Creating documentation for an existing codebase |
| `/do:task` | Starting a new piece of work — smart router picks fast vs full automatically |
| `/do:project` | Starting a large multi-phase project — new codebase or massive feature |
| `/do:fast` | Mid-tier fast path — skip the router, run fast-path directly (1-3 files, no shared abstractions) |
| `/do:quick` | Tightest tier — mid-conversation follow-ups where context is warm and change is 1-2 files, mechanical; single council review inline |
| `/do:continue` | Resuming work from a previous session |
| `/do:abandon` | Stopping current work to start something else |
| `/do:debug` | Investigating why something isn't working |
| `/do:update` | Check for and install newer versions |
| `/do:optimise` | Checking best practices for a project, file, agent, skill, or script |
| `/do:backlog` | Managing backlog items (list, add, start, done) |

## Routing

When the user invokes `/do` without specifying a sub-command, infer from context:

**Examples:**
- "let's start a new app from scratch" → `/do:project new "my-app"`
- "I want to add user authentication" → `/do:task "add user authentication"`
- "quick fix for the typo in the header" → `/do:fast "fix the typo in the header"`
- "small tweak to the button color" → `/do:fast "update the button color in the theme config"`
- "fast path — add a null check in UserService" → `/do:fast "add null check in UserService.parseToken"`
- "the null check we just discussed in parseToken" → `/do:quick "add the null-check we just discussed in parseToken"`
- "same one-liner fix as before" → `/do:quick "fix the off-by-one in the pagination helper"`
- "wire the guard we sketched" → `/do:quick "wire the permission guard on the Admin reducer we sketched"`
- "let's pick up where we left off" → `/do:continue`
- "this endpoint is returning 500 errors" → `/do:debug`
- "set up this repo for the do workflow" → `/do:init`
- "document what this codebase does" → `/do:scan`
- "never mind, let's work on something else" → `/do:abandon`
- "is there a newer version of do?" → `/do:update`
- "update do-lang" → `/do:update`
- "check best practices for this agent" → `/do:optimise agents/do-verifier.md`
- "optimise this project" → `/do:optimise`
- "audit this script" → `/do:optimise skills/do/scripts/council-invoke.cjs`
- "are there improvements for this skill?" → `/do:optimise skills/do/task.md`
- "deep audit of this project" → `/do:optimise --effort high`
- "quick check this file" → `/do:optimise path/to/file --effort low`
- "show me the backlog" → `/do:backlog`
- "what's on the backlog?" → `/do:backlog`
- "add this to the backlog" → `/do:backlog add "description"`
- "start a backlog item" → `/do:backlog start`

**Routing note:** `/do:task` is the smart default entry point — it assesses the task and auto-routes between `fast` and the full pipeline. Use `/do:fast` or `/do:quick` to skip the router when you already know what tier you want:
- `/do:fast` — explicit mid-tier skip (1-3 files, clearly trivial, no planning needed)
- `/do:quick` — explicit tightest-tier skip (mid-conversation, 1-2 files, already discussed, mechanical)

`/do:quick` is **never auto-recommended** by the router — invoke it directly when you want it. For ambiguous intent, `/do:task` is always safe (its router defaults to full when unsure).

If intent is genuinely ambiguous, show the table above and ask which sub-command they want.

## Conventions

### @scripts/ path shorthand

`@scripts/<name>.cjs` is a documentation shorthand used in prose and file-reference tables (e.g., "Script: @scripts/foo.cjs"). It is **not** a Node.js or shell-resolvable path.

**Rule:** All `node` invocations in shell commands and bash blocks must use the absolute install path:

```bash
node ~/.claude/commands/do/scripts/<name>.cjs
```

This path is guaranteed to exist for every consumer project after `npm install -g @danielvandervelden/do-lang` (the postinstall step copies `skills/do/scripts/` to `~/.claude/commands/do/scripts/`).

Prose references and the "Files / Scripts" tables at the bottom of skill files may continue to use `@scripts/` as a shorthand — those are human-readable markers, not shell commands.
