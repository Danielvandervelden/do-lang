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
| `/do:task` | Starting a new piece of work (feature, fix, refactor) |
| `/do:continue` | Resuming work from a previous session |
| `/do:abandon` | Stopping current work to start something else |
| `/do:debug` | Investigating why something isn't working |
| `/do:update` | Check for and install newer versions |
| `/do:optimise` | Checking best practices for a project, file, agent, skill, or script |

## Routing

When the user invokes `/do` without specifying a sub-command, infer from context:

**Examples:**
- "I want to add user authentication" → `/do:task "add user authentication"`
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

If intent is genuinely ambiguous, show the table above and ask which sub-command they want.
