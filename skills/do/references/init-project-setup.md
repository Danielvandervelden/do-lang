---
name: init-project-setup
description: Detailed project initialization procedure. Loaded by /do:init when .do/ folder is missing.
---

# Project Setup

Interactive setup for project-level configuration. Use inline prompts.

## Step 1: Detect project name

```bash
# From package.json or folder name
node -e "try{console.log(require('./package.json').name)}catch(e){console.log(require('path').basename(process.cwd()))}"
```

Display:
```
/do:init - Project Setup

This project needs initialization for the do workflow.
This creates:
- .do/config.json (project settings)
- .do/tasks/ (task storage)

Detected project name: <name>
[Enter = use detected name, or type a different one]:
```

**Handle empty input:** If user presses Enter without typing, use the detected name.

## Step 2: Ask council review preferences

```
Configure AI council reviews:

Planning reviews (review task plans before execution):
- Enable planning reviews? (yes/no) [Enter = yes]:

Execution reviews (review implementations after execution):
- Enable execution reviews? (yes/no) [Enter = yes]:

Reviewer selection:
- random: Randomly select between available advisors
- codex: Always use Codex (if in Claude runtime)
- gemini: Always use Gemini
- both: Run both advisors in parallel

Enter reviewer preference (random/codex/gemini/both) [Enter = random]:
```

**Handle empty input:** If user presses Enter without typing, use the default shown in brackets.

## Step 3: Ask grill threshold

```
Grill threshold: When task confidence is below this value, 
the grill-me agent asks clarifying questions.

Enter threshold (0.0-1.0) [Enter = 0.9]:
```

**Handle empty input:** If user presses Enter without typing, use 0.9.

## Step 4: Configure agent models

```
Agent model configuration:

Available models:
- sonnet: Fast, cost-effective (recommended)
- opus: Most capable, slower, higher cost
- haiku: Fastest, cheapest, less capable

Default model for all agents (sonnet/opus/haiku) [Enter = sonnet]:
```

**Handle empty input:** If user presses Enter without typing, use sonnet.

Then ask about per-agent overrides:
```
Configure per-agent overrides?

Available agents:
- planner: Creates task plans
- plan_reviewer: Reviews plans
- executioner: Implements code
- code_reviewer: Reviews code (self-review only; orchestrator handles parallel council spawning)
- verifier: Verifies implementation (approach checklist + quality checks + UAT)
- griller: Asks clarifying questions
- debugger: Investigates bugs

Enter overrides as agent:model pairs (e.g., "planner:opus,debugger:opus")
[Enter = no overrides]:
```

**Handle empty input:** If user presses Enter without typing, set `overrides: {}`.

## Step 5: Check database entry

```
Database entry check:

Does this project have a database entry at:
~/workspace/database/projects/<project-name>/project.md?

Mark as having database entry? (yes/no) [Enter = no]:
```

**Handle empty input:** If user presses Enter without typing, use no (can run /do:scan later).

## Step 6: Create project structure

1. **Create .do folder:**
   ```bash
   mkdir -p .do/tasks
   ```

2. **Create config.json** from @references/config-template.json:
   - `{{PROJECT_NAME}}` → confirmed project name
   - `council_reviews.planning` → user's choice
   - `council_reviews.execution` → user's choice
   - `council_reviews.reviewer` → user's choice
   - `models.default` → user's choice (sonnet/opus/haiku)
   - `models.overrides` → user's per-agent overrides (if any)
   - `web_search.context7` → true (default)
   - `auto_grill_threshold` → user's choice
   - `database_entry` → user's response

## Step 7: Confirm completion

```
Project initialized successfully!

Workspace: ~/workspace (healthy)
Project: <project-name>/.do/ (initialized)

Created:
- .do/config.json (project settings)
- .do/tasks/ (task storage)

Configuration:
- Project name: <name>
- Council planning reviews: <enabled/disabled>
- Council execution reviews: <enabled/disabled>
- Council reviewer: <preference>
- Default model: <sonnet/opus/haiku>
- Model overrides: <list or "none">
- Context7 enabled: yes
- Grill threshold: <threshold>
- Database entry: <yes/no>

Next steps:
- Run /do:scan to create database entry (if not already done)
- Run /do:task "description" to start a task
```
