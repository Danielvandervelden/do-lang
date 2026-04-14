---
name: do:debug
description: "Systematic bug investigation using scientific method. Use when something isn't working, behaving unexpectedly, or producing wrong output. Triggers on 'this is broken', 'not working', 'why is this failing', 'debug this', 'figure out why...', error messages, or unexpected behavior. Creates a persistent debug session with hypothesis tracking."
argument-hint: "\"description of the bug or unexpected behavior\""
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

# /do:debug

Systematic bug investigation — form hypotheses, test them, confirm or reject, repeat until the root cause is found.

## Why this exists

Ad-hoc debugging burns context and goes in circles. By treating bugs like experiments — forming hypotheses, designing tests, and recording results — you build a trail of what's been tried and what's been ruled out. This prevents retrying the same things and makes it possible to resume debugging sessions across conversations.

## Usage

```
/do:debug "description of the bug or unexpected behavior"
```

**Examples:**
- `/do:debug "API returns 500 on POST /users"`
- `/do:debug "login works locally but fails in staging"`
- `/do:debug "component re-renders infinitely"`

## How it works

1. **Create session** — A debug file tracks the trigger, hypotheses, tests, and findings
2. **Gather context** — Understand the symptom and where it occurs
3. **Form hypothesis** — State what you think is wrong and why
4. **Design test** — How would you prove or disprove this hypothesis?
5. **Execute test** — Run it and record the result
6. **Evaluate** — Did it confirm, reject, or refine your hypothesis?
7. **Repeat** — Continue until root cause is found and fixed

## Prerequisites

- Project must be initialized (`.do/config.json` exists)
- `.do/debug/` directory will be created if needed

## Active Session Detection

**Step 1: Check for active debug session**

```bash
node <skill-path>/scripts/debug-session.cjs check
```

If `active: true`, show options:
- **Continue** — Resume this session
- **Close** — Mark as abandoned, start fresh
- **Force new** — Keep this session, start another

If `stale: true`, clear the stale reference and proceed.

**Step 2: Create new debug session**

```bash
node <skill-path>/scripts/debug-session.cjs create "<trigger>"
```

If there's an active task, offer to link this debug session to it for context.

Update config.json: `active_debug: <filename>`

**Step 3: Load debug workflow**

@references/stage-debug.md

Follow the steps in stage-debug.md:
- New session: Start at Step D1 (Gathering)
- Resuming: Start at Step D0 (Resume Check)

## Files

- **Session script:** @scripts/debug-session.cjs
- **Workflow:** @references/stage-debug.md
- **Template:** @references/debug-template.md
