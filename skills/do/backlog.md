---
name: do:backlog
description: "Backlog management for do-lang projects. Use when the user wants to view, add, start, or complete backlog items. Triggers on phrases like 'show me the backlog', 'add this to the backlog', 'start a backlog item', 'what's on the backlog', 'promote backlog item to task', 'mark backlog item done'."
argument-hint: '"list | add \"description\" | start [id] | done [id]"'
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
  - Agent
---

# /do:backlog

Manage the backlog for this do-lang project. Four sub-commands: list, add, start, done.

## Why this exists

`.do/BACKLOG.md` is created by `/do:init` but has no structured command interface. Without a command, the backlog is invisible — users don't know it exists and manually manage it if they do. `/do:backlog` makes it a first-class workflow step: capture ideas, promote them to tasks pre-seeded with context, and auto-clean them when tasks complete.

## Usage

```
/do:backlog                    # list all items in Ideas section
/do:backlog list               # same as above
/do:backlog add "description"  # add a new idea interactively
/do:backlog start [id]         # promote item to a task file
/do:backlog done [id]          # remove item when task is complete
```

---

## Auto-init Gate

**This is the very first action — before parsing arguments or routing to any sub-command.**

Check whether `.do/BACKLOG.md` exists:

```bash
test -f .do/BACKLOG.md && echo "exists" || echo "missing"
```

If it does **not** exist, create it with this exact content using the Write tool:

```markdown
# Backlog

## Ideas

(Add backlog items below with /do:backlog add)
```

Inform the user: "Initialized `.do/BACKLOG.md` for this project."

Then continue with the requested sub-command normally.

---

## Sub-command Routing

After the auto-init gate, route by first argument:

| Argument | Mode |
|----------|------|
| (none) | List mode |
| `list` | List mode |
| `add` | Add mode |
| `start` | Start mode |
| `done` | Done mode |

---

## List Mode (`/do:backlog` or `/do:backlog list`)

1. Read `.do/BACKLOG.md`
2. Locate the `## Ideas` section (stop at the next `## ` heading or end of file)
3. For each `### <title>` entry within that section, extract the `**id:**` line
4. Display each item as: `<id> -- <title>`
5. Flag any item that has no `**id:**` line:

   > "Item `<title>` has no id. Run `/do:backlog add` to re-add it with a proper id, or manually add `**id:** <slug>` as the first line under the `### <title>` heading."

**Example output:**

```
Backlog — Ideas

  auto-debug-executioner  -- Auto-invoke /do:debug from do-executioner when bugs are encountered
  revise-reexecute-loop   -- Add "revise and re-execute" loop to /do:task workflow
  fast-entry-declaration  -- /do:fast — replace 8-item criteria checklist with a declaration

3 items
```

---

## Add Mode (`/do:backlog add "description"`)

Use `AskUserQuestion` to capture these fields interactively:

1. **id** (required) — A slug: lowercase letters, digits, hyphens only, no spaces.
   - Validate that the slug is unique within the existing `## Ideas` section (check for `**id:** <slug>` matches)
   - If not unique, inform the user and ask for a different slug
2. **title** (required) — A short, descriptive title for the item
3. **problem** (required) — What is the problem or motivation?
4. **fix** (optional) — Proposed solution or approach (can be vague; press Enter to skip)

After collecting all fields, append the following block to the `## Ideas` section in `.do/BACKLOG.md`, immediately before the closing of that section (before the next `## ` heading or at end of file):

```markdown

### <title>
**id:** <slug>
**Problem:** <problem>
**Fix:** <fix>
---
```

If no fix was provided, omit the `**Fix:**` line entirely.

Confirm: "Added `<slug>` to the backlog."

---

## Start Mode (`/do:backlog start [id]`)

### Step S0: Resolve the item

If an id argument was given:
- Read `.do/BACKLOG.md`, scope to `## Ideas` section
- Find the item with `**id:** <provided-id>` — if not found, error: "No backlog item with id `<id>` found in Ideas section."

If no id argument was given:
- Read `.do/BACKLOG.md`, parse all items from `## Ideas` section
- Display a numbered list:
  ```
  1. auto-debug-executioner — Auto-invoke /do:debug from do-executioner when bugs are encountered
  2. revise-reexecute-loop  — Add "revise and re-execute" loop to /do:task workflow
  ```
- Ask the user to pick a number. Use the corresponding item's id.

Read the selected item's `title` and body fields using the following field resolution rules:

**Problem content** — use the first match:
1. If the item has a `**Problem:**` line: use its value as the problem content
2. If no `**Problem:**` line exists: use the full item body text — everything between the `### <title>` heading and the closing `---` separator, excluding the `**id:**` line — as the problem content

**Fix content** — use the first match:
1. If the item has a `**Fix:**` line: use its value as the fix content
2. If no `**Fix:**` line exists: there is no fix content (omit it in the task file)

### Step S1: Duplicate file check

Generate the task filename:

```bash
TASK_DATE=$(date +%y%m%d)
TASK_FILE="${TASK_DATE}-<id>.md"
```

Check whether `.do/tasks/${TASK_FILE}` already exists:

```bash
test -f ".do/tasks/${TASK_FILE}" && echo "exists" || echo "missing"
```

**If it exists:** Read `.do/config.json` and set `active_task` to `${TASK_FILE}`:

```bash
node -e "
const fs = require('fs');
const c = JSON.parse(fs.readFileSync('.do/config.json', 'utf8'));
c.active_task = '${TASK_FILE}';
fs.writeFileSync('.do/config.json', JSON.stringify(c, null, 2));
"
```

Output: "Task file already exists for `<id>` — set as active. Run `/do:task` to continue it."

**Stop. Do NOT overwrite the existing file or continue with steps S2–S5.**

### Step S2: Active task conflict check

Read `.do/config.json`. If `active_task` is non-null:
- Read the task file at `.do/tasks/<active_task>` to get its `description` frontmatter field
- Ask the user:

  ```
  Active task is `<description>`. Replace it with the new backlog task? [Y/n]
  ```

  **Default is no.** If the user presses Enter or answers anything other than `y` or `Y`, abort:

  > "Start cancelled. Active task preserved."

  Make no changes and stop.

### Step S3: Create task file

Create the task file using the Write tool. Read `@references/task-template.md` as the base and apply these pre-fills:

- `id` frontmatter field: `<YYMMDD>-<slug>` (the generated filename without `.md`)
- `created` and `updated`: current ISO timestamp
- `description`: the backlog item's title
- `backlog_item`: `<id>` (the backlog item's slug — not null)
- `stage`: `refinement`
- `stages`: all defaults from template
- `council_review_ran`: `plan: false`, `code: false`
- `confidence`: keep all `{{PLACEHOLDER}}` values as-is — do-planner fills these in
- **Problem Statement section**: pre-fill from the resolved problem content (see Step S0 field resolution rules), followed by:
  - If fix content was resolved: include it as a "Proposed Fix" sub-section
  - If no fix content: leave just the problem content
- All other sections: use their normal template defaults (keep `{{PLACEHOLDER}}` markers)

Write to `.do/tasks/<YYMMDD>-<id>.md`.

**Problem Statement format when fix content was resolved:**

```markdown
## Problem Statement

<problem content>

**Proposed Fix:** <fix content>
```

**Problem Statement format when no fix content:**

```markdown
## Problem Statement

<problem content>
```

### Step S4: Set active task

```bash
node -e "
const fs = require('fs');
const c = JSON.parse(fs.readFileSync('.do/config.json', 'utf8'));
c.active_task = '<YYMMDD>-<id>.md';
fs.writeFileSync('.do/config.json', JSON.stringify(c, null, 2));
"
```

### Step S5: Output and stop

Output:

> "Task file created at `.do/tasks/<filename>` and set as active. Run `/do:task` — it will detect the active task and offer to continue it from the planning stage."

**Stop. Do NOT invoke `/do:task` or `/do:fast` directly — the user must run it themselves so they can choose the appropriate workflow.**

---

## Done Mode (`/do:backlog done [id]`)

### Step D0: Resolve the id

If an id argument was given, use it directly.

If no id argument:
- Read `.do/config.json` to get `active_task`
- If `active_task` is null or missing, error: "No active task found and no id provided."
- Read the active task file's frontmatter to get `backlog_item`
- If `backlog_item` is null or missing, error: "No id provided and no backlog_item found in the active task."
- Use `backlog_item` as the id

### Step D1: Find the item using the boundary algorithm

Read `.do/BACKLOG.md` as an array of lines.

**Step D1.0 — Scope to Ideas section:**
- Find the line matching `## Ideas` — record its index as `ideas_start`
- Find the next line matching `^## ` **after** `ideas_start` — record as `ideas_end`
- If no such line exists, set `ideas_end` to the last line index of the file
- All subsequent steps operate exclusively within lines `ideas_start` through `ideas_end`

**Step D1.1 — Find the id line:**
Within `ideas_start..ideas_end`, find the line matching exactly `**id:** <slug>`. If not found, error: "Backlog item `<id>` not found in Ideas section."

**Step D1.2 — Find block start:**
Walk backward from the id line to find the nearest preceding line matching `^### `. This is the block start (inclusive).

**Step D1.3 — Find block end:**
Walk forward from the id line to find the block end (exclusive). The block end is whichever comes first:
- A line matching `^---$` — **include** this line in the deletion (block end = this line's index + 1)
- A line matching `^### ` — do **NOT** include this line (block end = this line's index)
- A line matching `^## ` — do **NOT** include this line (block end = this line's index)
- `ideas_end` or end of file

**Step D1.4 — Delete the block:**
Remove all lines from block start through block end.

**Step D1.5 — Clean up:**
Collapse any resulting sequences of 3+ blank lines down to a single blank line.

**Step D1.6 — Write back:**
Write the modified content to `.do/BACKLOG.md`.

Confirm: "Removed backlog item `<id>` from BACKLOG.md."

---

## Notes

- The `## Completed` section in BACKLOG.md is historical/read-only. The done command **never** touches it — items are removed entirely, not moved to Completed.
- The add command enforces the canonical format. The list command flags items that deviate.
- If BACKLOG.md was manually edited and format drifts, the list command will surface affected items via the "no id" warning.
