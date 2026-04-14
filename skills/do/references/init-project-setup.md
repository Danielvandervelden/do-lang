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
Confirm this name or enter a different one:
```

## Step 2: Ask council review preferences

```
Configure AI council reviews:

Planning reviews (review task plans before execution):
- Enable planning reviews? (yes/no, default: yes)

Execution reviews (review implementations after execution):
- Enable execution reviews? (yes/no, default: yes)

Reviewer selection:
- random: Randomly select between available advisors (default)
- codex: Always use Codex (if in Claude runtime)
- gemini: Always use Gemini
- both: Run both advisors in parallel

Enter reviewer preference (random/codex/gemini/both, default: random):
```

## Step 3: Ask grill threshold

```
Grill threshold: When task confidence is below this value, 
the grill-me agent asks clarifying questions.

Suggested default: 0.9 (triggers grilling if confidence < 90%)

Enter threshold (0.0-1.0) or press Enter for 0.9:
```

## Step 4: Check database entry

```
Database entry check:

Does this project have a database entry at:
~/workspace/database/projects/<project-name>/project.md?

If not, you can run /do:scan to create one.
Do you want to mark this project as having a database entry? (yes/no)
```

## Step 5: Create project structure

1. **Create .do folder:**
   ```bash
   mkdir -p .do/tasks
   ```

2. **Create config.json** from @references/config-template.json:
   - `{{PROJECT_NAME}}` → confirmed project name
   - `council_reviews.planning` → user's choice
   - `council_reviews.execution` → user's choice
   - `council_reviews.reviewer` → user's choice
   - `auto_grill_threshold` → user's choice
   - `database_entry` → user's response

## Step 6: Confirm completion

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
- Grill threshold: <threshold>
- Database entry: <yes/no>

Next steps:
- Run /do:scan to create database entry (if not already done)
- Run /do:task "description" to start a task
```
