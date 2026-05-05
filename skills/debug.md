---
name: do:debug
description: "Systematic bug investigation using <<DO:AGENT_PREFIX>>-debugger agent. Scientific method with hypothesis tracking, ctx7 research, and persistent sessions."
argument-hint: "\"description of the bug or unexpected behavior\""
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
<<DO:IF CLAUDE>>
  - Agent
<<DO:ENDIF>>
  - AskUserQuestion
---

# /do:debug

Spawn the <<DO:AGENT_PREFIX>>-debugger agent for systematic bug investigation.

<<DO:IF CODEX>>
## Agent Authorization

By invoking this workflow, the user explicitly authorizes spawning the following
internal agents. These agents are integral to the workflow contract and MUST be
spawned as subagents — they are not optional.

| Agent | Role |
|-------|------|
| <<DO:AGENT_PREFIX>>-debugger | Investigates the bug using the scientific method: observe, hypothesize, test, conclude; applies fix and verifies |

**No inline fallback:** If agent spawning is unavailable or blocked, STOP immediately
and report: "Cannot spawn required agents. This workflow requires <<DO:CLAUDE:agent spawning>><<DO:CODEX:subagent spawning>> to
function correctly. Please ensure agent spawning is enabled and retry." Do NOT fall back
to inline debugging — inline debugging burns context and lacks the persistent session
tracking that <<DO:AGENT_PREFIX>>-debugger provides.

<<DO:ENDIF>>
## Why this exists

Ad-hoc debugging burns context and goes in circles. The <<DO:AGENT_PREFIX>>-debugger agent uses the scientific method — observe, hypothesize, test, conclude — with persistent session files that track everything tried. If ctx7 is enabled, it researches errors using up-to-date library docs.

## Usage

```
/do:debug "description of the bug or unexpected behavior"
```

**Examples:**
- `/do:debug "API returns 500 on POST /users"`
- `/do:debug "login works locally but fails in staging"`
- `/do:debug "component re-renders infinitely"`

## Prerequisites

- Project initialized (`.do/config.json` exists)
- `.do/debug/` directory will be created if needed

---

## Step 1: Check for Active Debug Session

```bash
node <<DO:SCRIPTS_PATH>>/debug-session.cjs check
```

If `active: true`, offer options:
- **Continue** — Resume this session (pass session file to agent)
- **Close** — Mark as abandoned, start fresh
- **Force new** — Keep existing, start another

## Step 2: Read Model Config

```bash
node -e "
const c = require('./.do/config.json');
const models = c.models || { default: 'sonnet', overrides: {} };
console.log(JSON.stringify(models));
"
```

<<DO:IF CLAUDE>>
## Step 3: Spawn <<DO:AGENT_PREFIX>>-debugger Agent
<<DO:ENDIF>>
<<DO:IF CODEX>>
## Step 3: Spawn <<DO:AGENT_PREFIX>>-debugger subagent
<<DO:ENDIF>>

**For new session:**

<<DO:IF CLAUDE>>
```javascript
Agent({
  description: "Debug: <short description>",
  subagent_type: "<<DO:AGENT_PREFIX>>-debugger",
  model: "<models.overrides.debugger || models.default>",
  prompt: `
Investigate this bug using the scientific method.

Bug description: <user's description>
Config: .do/config.json
Mode: investigate-and-fix

Create a new debug session file in .do/debug/.
Gather symptoms, form hypotheses, test them.
When root cause is found, apply fix and verify.
Return structured summary.
`
})
```
<<DO:ENDIF>>
<<DO:IF CODEX>>
Spawn the <<DO:AGENT_PREFIX>>-debugger subagent with model `<models.overrides.debugger || models.default>` and the description "Debug: <short description>". Pass the following prompt:

Investigate this bug using the scientific method.

Bug description: <user's description>
Config: .do/config.json
Mode: investigate-and-fix

Create a new debug session file in .do/debug/.
Gather symptoms, form hypotheses, test them.
When root cause is found, apply fix and verify.
Return structured summary.
<<DO:ENDIF>>

**For resuming session:**

<<DO:IF CLAUDE>>
```javascript
Agent({
  description: "Resume debug: <session-id>",
  subagent_type: "<<DO:AGENT_PREFIX>>-debugger",
  model: "<models.overrides.debugger || models.default>",
  prompt: `
Resume this debug session.

Session file: .do/debug/<session-file>
Config: .do/config.json
Mode: investigate-and-fix

Read the session file for prior investigation.
Continue from where it left off.
Return structured summary.
`
})
```
<<DO:ENDIF>>
<<DO:IF CODEX>>
Spawn the <<DO:AGENT_PREFIX>>-debugger subagent with model `<models.overrides.debugger || models.default>` and the description "Resume debug: <session-id>". Pass the following prompt:

Resume this debug session.

Session file: .do/debug/<session-file>
Config: .do/config.json
Mode: investigate-and-fix

Read the session file for prior investigation.
Continue from where it left off.
Return structured summary.
<<DO:ENDIF>>

## Step 4: Handle Result

Parse the agent's return:

**ROOT_CAUSE_FOUND:**
```
## Debug Complete

**Session:** .do/debug/<filename>
**Root Cause:** <summary>
**Location:** <file:line>

### Fix Applied
<what was changed>

### Verification
<how it was verified>
```

**STUCK:**
```
## Debug Paused

**Session:** .do/debug/<filename>
**Hypotheses Tested:** <count>

### What We Know
<confirmed facts>

### What We Ruled Out
<disproven hypotheses>

### Suggested Next Steps
<recommendations>

Run /do:debug to continue investigation.
```

**BLOCKED:**
```
## Debug Blocked

**Session:** .do/debug/<filename>
**Blocked By:** <what's needed>

<agent's explanation of what it needs>

Provide the requested information and run /do:debug again.
```

---

## Files

- **Session script:** @scripts/debug-session.cjs
- **Template:** @references/debug-template.md
