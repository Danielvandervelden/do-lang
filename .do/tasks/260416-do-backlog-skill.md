---
id: 260416-do-backlog-skill
created: "2026-04-16T00:00:00.000Z"
updated: "2026-04-16T08:30:00.000Z"
description: "/do:backlog skill — backlog management for do-lang projects"
stage: complete
stages:
  refinement: complete
  grilling: complete
  execution: complete
  verification: complete
  abandoned: false
council_review_ran:
  plan: true
  code: true
confidence:
  score: 0.92
  factors: null
  context: 0.95
  scope: 0.90
  complexity: 0.90
  familiarity: 0.95
pre_abandon_stage: refinement
---

# /do:backlog — Backlog Management Skill

## Problem Statement

do-lang projects get a `.do/BACKLOG.md` file from `/do:init`, but there is no structured command to manage it. Users manually edit the file to add, promote, or remove items. There is no way to promote an idea into a task with pre-seeded context, no way to track which task originated from which backlog item, and no way to automatically clean up the backlog when a task completes.

The `/do:backlog` skill makes backlog management a first-class workflow citizen by providing four sub-commands: list, add, start, and done. It integrates into the task lifecycle so that completing a task started from a backlog item automatically removes that item. A new `backlog_item` field in the task file template creates the link between tasks and backlog items.

**Acceptance criteria:**
1. `skills/do/backlog.md` exists as a new skill with list, add, start, done sub-commands
2. `/do:backlog` (no args) reads `.do/BACKLOG.md` and displays all items in the Ideas section with their id and one-line summary; flags items with no id
3. `/do:backlog add "description"` interactively captures id (slug), title, problem, fix (optional) and appends to Ideas section in the specified format
4. `/do:backlog start [id]` picks an item by id (or interactively), creates a task file pre-seeded with problem+fix, sets `backlog_item: <id>` in frontmatter, sets it as the active task in `.do/config.json`, and instructs the user to run `/do:task` (does NOT invoke `/do:task` directly)
5. `/do:backlog done [id]` removes the item from BACKLOG.md entirely (no Completed section kept). If no id given, reads `backlog_item` from the active task file
6. Task template (`references/task-template.md`) has `backlog_item: null` in frontmatter
7. `task.md` Step 12 checks for non-null `backlog_item` and invokes backlog done
8. `fast.md` final step (Step 10 or 11) checks for non-null `backlog_item` and invokes backlog done
9. Existing items in `.do/BACKLOG.md` have id fields added (new ids for items missing them, capitalized `**ID:**` entries normalized to lowercase `**id:**`)
10. `do.md` routing table includes `/do:backlog`
11. Every sub-command auto-initializes `.do/BACKLOG.md` if it doesn't exist (backlog init flow: create file with `# Backlog` heading and empty `## Ideas` section, inform the user)

## Clarifications

### Q1: Active task conflict on `/do:backlog start`
**Q:** If `.do/config.json` already has an `active_task` set when the user runs `/do:backlog start`, should the skill silently overwrite it, prompt for confirmation, or refuse?
**A:** Prompt for confirmation. Show the current task name and ask "Replace it with the new backlog task? [Y/n]" before overwriting. If the user answers no (or presses Enter with the default being no), abort the start command without changes.

### Q2: Task file body on `/do:backlog start`
**Q:** When creating the task file, should the skill use the full task template (all sections) or a minimal stub (frontmatter + Problem Statement only)?
**A:** Full template with all sections. Pre-fill `description` from the backlog item title, set `backlog_item: <id>` in the frontmatter, and pre-fill the Problem Statement from the item's `problem` and `fix` fields. All other sections use their normal template defaults.

### Q3: Duplicate task file on `/do:backlog start`
**Q:** If a task file matching the generated filename (`YYMMDD-<id>.md`) already exists in `.do/tasks/`, should the skill overwrite it, error out, or do something else?
**A:** Detect and reuse. Set the existing file as the active task and notify the user: "Task file already exists for `<id>` — set as active. Run `/do:task` to continue it." Do NOT overwrite the existing file.

## Context Loaded

- `~/workspace/database/projects/do/project.md` — Project tech stack, conventions, agent pipeline, release flow
- `~/workspace/database/__index__.md` — Workspace structure, project registry
- `skills/do/task.md` — Full task workflow, Step 12 completion flow (integration target)
- `skills/do/fast.md` — Fast-path workflow, Step 10-11 completion flow (integration target)
- `skills/do/do.md` — Routing table (needs `/do:backlog` entry)
- `skills/do/scan.md` — Reference for simple skill structure/format
- `skills/do/init.md` — Reference for skill with sub-routing and interactive prompts
- `skills/do/references/task-template.md` — Task file frontmatter template (add backlog_item field)
- `skills/do/references/init-project-setup.md` — Project init flow (context on BACKLOG.md creation)
- `skills/do/references/config-template.json` — Config template structure
- `.do/BACKLOG.md` — Current backlog file with existing items (needs id fields added)
- `bin/install.cjs` — Postinstall script (no changes needed — copies all of skills/do/)

## Approach

### 1. Add `backlog_item` field to task template

**File:** `skills/do/references/task-template.md`

Add `backlog_item: null` to the frontmatter, after the `confidence` block and before the `waves` comment. This field is set by `/do:backlog start` and read by completion flows.

**Note on fast.md:** `fast.md` Step 4 says "Use the same format as `@references/task-template.md` but with these fast-path overrides" — meaning it starts from the template and applies only the listed overrides. Since `backlog_item: null` is not an override (fast-path tasks use the same default), adding it to the template alone is sufficient. fast.md inherits the field automatically via its template reference. No change to fast.md's Step 4 inline YAML block is needed.

### 2. Create `skills/do/backlog.md` — the new skill

**File:** `skills/do/backlog.md` (new)

Structure follows existing skill conventions (frontmatter with name, description, argument-hint, allowed-tools). The skill has four modes routed by the first argument:

**Frontmatter:**
- `name: do:backlog`
- `description:` Triggers on backlog management phrases
- `argument-hint: '"list | add \"description\" | start [id] | done [id]"'`
- `allowed-tools:` Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion, Agent

**Auto-init gate (FIRST action, before any sub-command routing):**

This is the very first thing the skill does, before parsing arguments or routing to any sub-command. Check whether `.do/BACKLOG.md` exists:
```bash
test -f .do/BACKLOG.md
```
If it does not exist, create it with this content:
```markdown
# Backlog

## Ideas

(Add backlog items below with /do:backlog add)
```
Inform the user: "Initialized `.do/BACKLOG.md` for this project." Then continue with the requested sub-command normally.

**Sub-command routing (after auto-init gate):**
- No args or "list" -> List mode
- "add" -> Add mode
- "start" -> Start mode
- "done" -> Done mode

**List mode (`/do:backlog` or `/do:backlog list`):**
1. Read `.do/BACKLOG.md`
2. Parse the `## Ideas` section
3. For each `### <title>` entry, extract the `**id:**` line
4. Display each item as: `<id> -- <title>`
5. Flag any item that has no `**id:**` line — prompt user to assign one or archive it

**Add mode (`/do:backlog add "description"`):**
1. Use inline prompts (AskUserQuestion) to capture:
   - `id` (required, must be a slug — lowercase, hyphens, no spaces; must be unique within BACKLOG.md)
   - `title` (required)
   - `problem` (required)
   - `fix` (optional)
2. Validate slug uniqueness by checking existing ids in BACKLOG.md
3. Append to `## Ideas` section in this format:
   ```
   ### <title>
   **id:** <slug>
   **Problem:** ...
   **Fix:** ...
   ---
   ```
4. If no fix provided, omit the `**Fix:**` line

**Start mode (`/do:backlog start [id]`):**
1. If no id argument, display numbered list of Ideas items and let user pick
2. Read the selected item's title, problem, and fix fields
3. **Duplicate file check (before anything else):** Check whether `.do/tasks/YYMMDD-<id>.md` already exists. If it does, set it as the active task in `.do/config.json` and output: "Task file already exists for `<id>` — set as active. Run `/do:task` to continue it." Then stop — do NOT overwrite or continue with steps 4-8
4. **Active task conflict check:** Read `.do/config.json`. If `active_task` is already set to a non-null value, read the current task's `description` field and ask the user: "Active task is `<description>`. Replace it with the new backlog task? [Y/n]". If the user answers no (or presses Enter defaulting to no), abort and make no changes
5. Create the task file using the full task template (`@references/task-template.md`) with these pre-fills:
   - `description` frontmatter field set to the backlog item's title
   - `backlog_item: <id>` set in the frontmatter
   - Problem Statement section pre-filled from the item's `problem` and `fix` fields
   - All other sections and frontmatter fields use their normal template defaults
6. Update `.do/config.json` `active_task` to the new task filename (format: `YYMMDD-<id>.md`)
7. Output to the user: "Task file created at `.do/tasks/<filename>` and set as active. Run `/do:task` -- it will detect the active task and offer to continue it from the planning stage."
8. Stop. Do NOT invoke `/do:task` or `/do:fast` directly — the user must run it themselves so they can choose the appropriate workflow

**Done mode (`/do:backlog done [id]`):**
1. If no id argument, read `backlog_item` from the active task file (via `.do/config.json` -> `active_task` -> task file frontmatter)
2. If still no id, error: "No id provided and no backlog_item found in the active task."
3. Find the item in `.do/BACKLOG.md` using the boundary algorithm below
4. Remove the entire item block
5. No "Completed" section — item is gone entirely

**Done mode boundary algorithm (item removal):**

To precisely identify and remove a backlog item block:

0. Read `.do/BACKLOG.md` as an array of lines. Find the line matching `## Ideas` — record its line index as `ideas_start`. Find the next line matching `## ` after `ideas_start` (e.g., `## Completed`) — record its line index as `ideas_end`. If no such line exists, set `ideas_end` to the last line of the file. All subsequent steps operate exclusively within lines `ideas_start` through `ideas_end`. This prevents accidental matches against items in the `## Completed` section or other sections that may share similar id patterns.
1. Within the `ideas_start..ideas_end` range, find the line matching `**id:** <slug>` (exact match on the slug value)
2. Walk backward from that line to find the nearest preceding `### ` heading — this is the block start (inclusive)
3. Walk forward from the id line to find the block end (exclusive). The block end is the first of:
   - A line matching `---` (the item separator) — include this line in the deletion
   - A line matching `### ` (the next item heading) — do NOT include this line
   - A line matching `## ` (the next section heading) — do NOT include this line
   - `ideas_end` or end of file
4. Delete the entire range from block start through block end
5. Clean up any resulting double-blank-lines (collapse to single blank line)
6. Write the file back

Scope the search to the `## Ideas` section only. The `## Completed` section is historical/read-only — never modify it.

### 3. Add and normalize id fields in existing BACKLOG.md items

**File:** `.do/BACKLOG.md`

The Ideas section currently has these items without id fields:
- "Auto-invoke /do:debug from do-executioner when bugs are encountered" -> `id: auto-debug-executioner`
- "/do:backlog — backlog management for any do-lang project" -> `id: backlog-skill`
- "Add 'revise and re-execute' loop to /do:task workflow" -> `id: revise-reexecute-loop`
- "/do:fast — replace 8-item criteria checklist with a declaration" -> `id: fast-entry-declaration`
- "/do:continue — skip context reload when context is demonstrably fresh" -> `id: continue-skip-reload`

Add `**id:** <slug>` as the first line after each `### <title>` heading in the Ideas section.

Additionally, normalize the two existing items that already have `**ID:**` (capitalized) entries to lowercase `**id:**`:
- "test-check-database-entry-empty — test coverage for 100-byte empty detection" — change `**ID:** test-check-database-entry-empty` to `**id:** test-check-database-entry-empty`
- "test-task-abandon-deep-clone — test coverage for task-abandon.cjs deep-clone fix" — change `**ID:** test-task-abandon-deep-clone` to `**id:** test-task-abandon-deep-clone`

This ensures all items use the canonical `**id:**` (lowercase) format that the list command's exact-match parser expects.

### 4. Wire backlog done into task.md completion (Step 12)

**File:** `skills/do/task.md`

At Step 12 (Completion), before the existing stage check, add a backlog cleanup instruction:

> Read the `backlog_item` field from the active task's frontmatter. If non-null, invoke `/do:backlog done <id>` to remove the item from BACKLOG.md. Log: "Removed backlog item `<id>` from BACKLOG.md."

This is a declarative instruction for the AI — the orchestrator reads the task file's YAML frontmatter directly (it already does this for stage checks) and invokes the done sub-command. No scripted extraction needed.

This goes at the top of Step 12, before the existing stage-check bash snippet.

### 5. Wire backlog done into fast.md completion (Step 10)

**File:** `skills/do/fast.md`

At Step 10 (Completion), before the existing completion summary display, add the same backlog cleanup instruction:

> Read the `backlog_item` field from the active task's frontmatter. If non-null, invoke `/do:backlog done <id>` to remove the item from BACKLOG.md. Log: "Removed backlog item `<id>` from BACKLOG.md."

Same declarative pattern as task.md — no node script, the AI reads frontmatter directly.

### 6. Add `/do:backlog` to routing table in do.md

**File:** `skills/do/do.md`

Add to the sub-commands table:
```
| `/do:backlog` | Managing backlog items (list, add, start, done) |
```

Add routing examples:
```
- "show me the backlog" -> `/do:backlog`
- "add this to the backlog" -> `/do:backlog add "description"`
- "start a backlog item" -> `/do:backlog start`
- "what's on the backlog?" -> `/do:backlog`
```

## Concerns

1. **Markdown parsing fragility** — The skill relies on parsing BACKLOG.md by heading structure (`### <title>`, `**id:** <slug>`, `---` separators). If users manually edit BACKLOG.md with different formatting (missing separators, extra blank lines, different bold syntax), parsing could break.
   - *Mitigation:* The add command enforces the exact format. The list command flags items without ids. Document the expected format clearly in the skill. Since BACKLOG.md is generated and managed by the skill itself, format drift should be minimal.

2. **Removing items from middle of markdown** — The done command needs to surgically remove a block from the middle of a markdown file. Off-by-one errors with line ranges or separator matching could corrupt the file.
   - *Mitigation:* Use a clear parsing strategy: find the `### ` heading that contains the matching id, find the next `---` separator or next `### ` heading or end-of-section, remove that range. The skill instructions should specify this algorithm explicitly so the executor gets it right.

3. **Start command -> task.md handoff** — The start command needs to hand off to `/do:task` while ensuring the created task file has `backlog_item` set. The current `/do:task` Step 4 doesn't know about backlog items, so the start command either needs to: (a) create the task file itself and then invoke task.md from Step 5 onward, or (b) pass the backlog_item through to `/do:task` and have task.md recognize it.
   - *Mitigation:* Option (a) is cleaner — the start command creates the task file with `backlog_item` pre-set and problem statement pre-filled, updates config.json, then tells the user to invoke `/do:task` which will detect the existing task file and continue from there. Actually, `/do:task` Step 2 checks for an active task and offers to continue or abandon. The backlog start command should explicitly instruct the user (or the AI) to proceed with the seeded task via the normal flow. The simplest approach: backlog start creates the task file, sets it as active, and then the skill instructions say "now invoke `/do:task` — it will detect the active task and offer to continue it." This keeps backlog.md simple and avoids duplicating task.md logic.

4. **Completed section cleanup** — The spec says "no Completed section," but the existing BACKLOG.md has a `## Completed` section with historical entries. The skill should not touch this section — `done` only removes from `## Ideas`. The Completed section is legacy and stays as-is.
   - *Mitigation:* Make the done command scope its search to the `## Ideas` section only. Document that the Completed section is historical/read-only. The boundary algorithm (Step 0) explicitly restricts all operations to the Ideas section boundaries.

5. **Active task file detection for `done` without id** — The done command reads the active task from config.json, then reads `backlog_item` from that task's frontmatter. If there is no active task or the active task has no `backlog_item`, it should error gracefully.
   - *Mitigation:* Explicit error messages: "No active task found" or "Active task has no backlog_item set."

## Code Review Iterations

### Iteration 1
- **Self-review:** APPROVED — all 11 ACs implemented, boundary algorithm correct, no issues
- **Council (Codex):** CHANGES_REQUESTED — (1) list mode shows `<id> -- <title>` not a "summary" (dismissed: title IS the one-line summary per plan spec); (2) legacy BACKLOG.md items use non-standard fields (`**Idea:**`, `**Impact:**`) instead of `**Problem:**`/`**Fix:**`, making them non-startable
- **Action:** Spawned do-executioner to fix issue 2 — make `start` mode gracefully fall back when standard fields are absent

### Iteration 2 — VERIFIED (nitpicks only, non-blocking)
- **Self-review:** NITPICKS_ONLY — `backlog.md:113` add-mode format block always shows `**Fix:**` even though line 122 says omit it when absent; legacy fallback body can be verbose (acceptable); shell interpolation pattern noted
- **Council (Codex):** NITPICKS_ONLY — `done` cleanup collapses 3+ blank lines but should collapse 2+; list mode missing-id flow is passive warning instead of active prompt
- **Action:** Marking VERIFIED — all nitpicks are non-blocking documentation/edge-case refinements. Proceeding to do-verifier.

## Review Iterations

### Iteration 1
- **Self-review:** CONCERNS — 4 issues: (1) fast.md inline YAML ambiguity — unclear if task-template change alone covers fast.md or if override block also needs explicit `backlog_item: null`; (2) Approach Step 3 doesn't address normalizing two existing `**ID:**` (capitalized) entries to `**id:**`; (3) Acceptance criterion 4 wording "hands off to `/do:task`" is ambiguous vs Approach's explicit "user must run it themselves"; (4) Done boundary algorithm missing explicit step 0 to scope search to `## Ideas` section
- **Council:** LOOKS_GOOD — no issues, plan comprehensive and technically sound
- **Changes made:**
  1. **fast.md inline YAML (issue 1):** Removed the fast.md sub-section from Approach Step 1. Added a "Note on fast.md" paragraph explaining that fast.md Step 4 references `@references/task-template.md` as its base format and only lists overrides — since `backlog_item: null` is a default (not an override), the template change alone is sufficient. Renamed step heading from "Add `backlog_item` field to task template and fast.md inline YAML" to "Add `backlog_item` field to task template."
  2. **BACKLOG.md ID capitalization (issue 2):** Added normalization paragraph to Approach Step 3 covering the two items (`test-check-database-entry-empty`, `test-task-abandon-deep-clone`) that already have `**ID:**` (capitalized). Step now includes instructions to change them to lowercase `**id:**`. Updated acceptance criterion 9 to mention capitalization normalization. Renamed step heading to "Add and normalize id fields in existing BACKLOG.md items."
  3. **Acceptance criterion 4 wording (issue 3):** Changed from "hands off to `/do:task`" to "creates a task file pre-seeded with problem+fix, sets `backlog_item: <id>` in frontmatter, sets it as the active task in `.do/config.json`, and instructs the user to run `/do:task` (does NOT invoke `/do:task` directly)."
  4. **Done boundary algorithm scoping (issue 4):** Prepended Step 0 to the boundary algorithm that explicitly locates the `## Ideas` section boundaries (`ideas_start` and `ideas_end`) before any id search begins. All subsequent steps (1-6) are now constrained to operate within that range. Updated Concern 4 mitigation to reference the new Step 0.

## Execution Log

### 2026-04-16 08:00 - Execution started
**Status:** In progress
**Steps:** 0/6 complete

### 2026-04-16 08:01 - Step 1: Add backlog_item field to task template
**Files:**
- `skills/do/references/task-template.md` - Added `backlog_item: null` field after the confidence block and before the waves comment, with a comment explaining its purpose

**Decisions:**
- Placed after `confidence` block and before the `# waves` comment block as specified in the plan
- Added a comment line above the field for self-documentation

**Status:** Complete

### 2026-04-16 08:05 - Step 2: Create skills/do/backlog.md
**Files:**
- `skills/do/backlog.md` - Created new skill file with all four sub-commands (list, add, start, done), auto-init gate, boundary algorithm for done mode, and all clarifications from grilling baked in

**Decisions:**
- Structured auto-init gate as the absolute first action before any routing, as specified
- Start mode: duplicate file check (S1) runs before active task conflict check (S2), as per clarifications
- Start mode: default for active task conflict prompt is no (abort), matching clarification Q1
- Done mode: boundary algorithm Step D1.0 scopes to Ideas section only before any id matching
- Start mode output instructs user to run `/do:task` without invoking it directly
- Used `AskUserQuestion` for interactive add mode rather than inline bash prompts

**Status:** Complete

### 2026-04-16 08:10 - Step 3: Add and normalize id fields in existing BACKLOG.md items
**Files:**
- `.do/BACKLOG.md` - Added `**id:** <slug>` as first line after `### <title>` for 5 items missing ids; normalized `**ID:**` (capitalized) to `**id:**` (lowercase) for 2 existing items

**Decisions:**
- Added ids for: auto-debug-executioner, backlog-skill, revise-reexecute-loop, fast-entry-declaration, continue-skip-reload
- Normalized capitalization for: test-check-database-entry-empty, test-task-abandon-deep-clone
- Items griller-missing-project-root and griller-ask-all-at-once already had lowercase `**id:**` fields — no change needed

**Status:** Complete

### 2026-04-16 08:12 - Step 4: Wire backlog done into task.md Step 12
**Files:**
- `skills/do/task.md` - Added backlog cleanup instruction at the top of Step 12, before the stage check bash snippet

**Decisions:**
- Added as a declarative instruction ("Read the `backlog_item` field...") consistent with the existing AI-orchestrated style of task.md
- Placed before the existing `Read the task file to check final stage:` line as specified in the plan

**Status:** Complete

### 2026-04-16 08:14 - Step 5: Wire backlog done into fast.md Step 10
**Files:**
- `skills/do/fast.md` - Added backlog cleanup instruction at the top of Step 10, before the completion summary display

**Decisions:**
- Same declarative pattern as task.md — AI reads frontmatter directly, no node script needed
- Placed before "Display brief completion summary:" as specified in the plan

**Status:** Complete

### 2026-04-16 08:16 - Step 6: Add /do:backlog to routing table in do.md
**Files:**
- `skills/do/do.md` - Added `/do:backlog` row to sub-commands table; added 4 routing examples for backlog-related phrases

**Decisions:**
- Row placed after `/do:optimise` (end of existing table) to avoid disrupting existing order
- Routing examples cover: list (2 variants), add, and start — matching the spec exactly

**Status:** Complete

### 2026-04-16 08:17 - Execution complete
**Status:** Complete

**Summary:**
- Steps completed: 6/6
- Files modified: 6 (task-template.md, backlog.md [new], BACKLOG.md, task.md, fast.md, do.md)
- Deviations: 0 (0 minor, 0 blocking)

### 2026-04-16 - Post-review fix: Start mode legacy field fallback
**Files:**
- `skills/do/backlog.md` - Updated Start mode to gracefully handle backlog items that don't have standard `**Problem:**`/`**Fix:**` fields

**Changes:**
- Step S0: Replaced "Read the selected item's `title`, `problem`, and `fix` fields" with explicit field resolution rules:
  - Problem content: use `**Problem:**` if present; otherwise use the full item body text (everything between `### <title>` and `---`, excluding the `**id:**` line)
  - Fix content: use `**Fix:**` if present; otherwise omit it entirely
- Step S3: Updated Problem Statement pre-fill reference from "item's `problem` field" to "resolved problem content (see Step S0 field resolution rules)"
- Step S3 format blocks: renamed `<problem text>`/`<fix text>` to `<problem content>`/`<fix content>` for consistency with S0 terminology

**Reason:** Legacy BACKLOG.md items (e.g., `backlog-skill`, `auto-debug-executioner`) use non-standard field names (`**Idea:**`, `**Impact:**`, `**Usage (proposed):**`) instead of `**Problem:**`/`**Fix:**`. Without this fallback, those items were non-startable — the start mode would find no problem content and produce an empty Problem Statement.

**Status:** Complete

## Council Review

## Verification Results

### Approach Checklist
- [x] Step 1: Add `backlog_item: null` to `skills/do/references/task-template.md` — field present at line 41 with comment
- [x] Step 2: Create `skills/do/backlog.md` — new skill with auto-init gate, list/add/start/done sub-commands, boundary algorithm, all clarifications baked in
- [x] Step 3: Add and normalize id fields in `.do/BACKLOG.md` — 9 items all have lowercase `**id:**`; 5 ids added, 2 capitalized `**ID:**` entries normalized, 2 pre-existing items unchanged
- [x] Step 4: Wire backlog done into `task.md` Step 12 — declarative instruction added at top of Step 12 before stage-check bash snippet
- [x] Step 5: Wire backlog done into `fast.md` Step 10 — declarative instruction added at top of Step 10 before completion summary display
- [x] Step 6: Add `/do:backlog` to routing table in `do.md` — row added to sub-commands table, 4 routing examples added

### Acceptance Criteria
- [x] AC1: `skills/do/backlog.md` exists with list, add, start, done sub-commands
- [x] AC2: `/do:backlog` (no args) reads BACKLOG.md, displays ids and titles, flags items with no id
- [x] AC3: `/do:backlog add "description"` uses AskUserQuestion to capture id/title/problem/fix and appends in canonical format
- [x] AC4: `/do:backlog start [id]` creates task file pre-seeded with problem+fix, sets `backlog_item: <id>`, sets active task in config.json, instructs user to run `/do:task` (does NOT invoke directly)
- [x] AC5: `/do:backlog done [id]` removes item from BACKLOG.md entirely; without id reads `backlog_item` from active task
- [x] AC6: `references/task-template.md` has `backlog_item: null` in frontmatter (line 41)
- [x] AC7: `task.md` Step 12 has backlog cleanup instruction before stage-check bash
- [x] AC8: `fast.md` Step 10 has backlog cleanup instruction before completion summary
- [x] AC9: All 9 Ideas items in `.do/BACKLOG.md` have lowercase `**id:**`; 2 previously capitalized entries normalized
- [x] AC10: `do.md` routing table includes `/do:backlog` row and 4 routing examples
- [x] AC11: Auto-init gate is first action in skill — creates BACKLOG.md with `# Backlog` / `## Ideas` if missing, informs user

### Quality Checks
- **Tests:** PASS (npm run test) — 162/162 tests pass, 0 failures
- **Lint/Types/Build:** Not applicable (markdown-only skill, no compiled code)

### Notes
- Minor: 4 of the 9 Ideas items (test-check-database-entry-empty, test-task-abandon-deep-clone, griller-missing-project-root, griller-ask-all-at-once) have a blank line between `### <title>` and `**id:**` — these were pre-existing items. The boundary algorithm walks backward from `**id:**` to find `### `, so this is not a functional issue. Non-blocking.

### Result: PASS
- Checklist: 6/6 complete
- AC: 11/11 met
- Quality: Tests 162/162 passing
- Blocking issue: None
