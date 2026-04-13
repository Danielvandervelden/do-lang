---
name: do
description: Token-efficient meta programming language for Claude Code. Provides workspace initialization, project scanning, task refinement, and structured execution with minimal token overhead. Use when the user wants to execute tasks efficiently without nested subagent overhead, or when they mention /do commands.
---

# do

Token-efficient meta programming language for Claude Code and Codex.

This is a placeholder skill. Individual commands will be added in subsequent phases.

## Planned Commands

- `/do:init` - Initialize workspace and project configuration
- `/do:scan` - Scan project and create database entry
- `/do:task` - Create and refine a task with AI assistance
- `/do:continue` - Resume from last task state
- `/do:debug` - Structured debugging workflow

## Architecture

The do system uses a flat agent hierarchy to minimize token usage:
- Single orchestrator coordinates execution
- One agent per phase (no nested subagents)
- State persisted in project `.do/` folder
- YAML frontmatter for machine-parseable status

## Installation

This skill is installed automatically when you run `npm i -g do-lang`.
Skills are copied to `~/.claude/skills/do/`.
