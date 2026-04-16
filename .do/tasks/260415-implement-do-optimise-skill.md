---
id: 260415-implement-do-optimise-skill
created: 2026-04-15T00:00:00.000Z
updated: '2026-04-15T14:00:00.000Z'
description: >-
  Implement /do:optimise — a skill that accepts any target (project, file,
  agent, skill, script) and returns a structured optimisation report backed by
  multi-source research (ctx7, peer files, web search) with configurable effort
  levels.
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
  score: 0.93
  factors:
    context: 0.95
    scope: 0.95
    complexity: 0.75
    familiarity: 0.9
---

# Implement /do:optimise skill

## Problem Statement

**What:** Build `/do:optimise`, a new do-lang skill that accepts any target (project directory, individual file, agent definition, skill file, or CJS script) and produces a structured optimisation report. The report is grounded in current best-practice documentation fetched via ctx7, not just the model's training data.

**Why:** Existing review stages (do-plan-reviewer, do-code-reviewer, do-council-reviewer) focus on plan fitness and code correctness for a specific task. None of them systematically check whether the implementation follows current best practices for the specific technology involved. For example: is a CJS script using deprecated Node.js APIs? Is an agent definition following the latest Claude Code agent-authoring patterns? Is a skill file structured optimally? `/do:optimise` fills this gap by providing on-demand, ctx7-backed auditing of any artefact in the do-lang system or any project managed by it.

**Acceptance Criteria:**
1. `/do:optimise` skill file exists at `skills/do/optimise.md` following established skill patterns (frontmatter, steps, allowed-tools)
2. Skill accepts a target argument (path or "project" for whole project) and correctly detects target type: project, skill, agent, script, or generic file
3. A supporting script `skills/do/scripts/optimise-target.cjs` handles target detection, research query derivation, effort-level parsing, and report structure
4. **Multi-source research:** The skill consults three research sources beyond the model's own knowledge: (a) ctx7 best-practice docs for the detected technologies, (b) peer files within the project (existing agents/skills/scripts using similar patterns), and (c) web search for public examples/repos when effort level permits
5. Report output is structured with: severity levels (critical/warning/suggestion), file:line references where line numbers are derived from reading the target file during analysis, concrete fix descriptions, and source links (ctx7 docs, peer file paths, or web URLs)
6. `/do` router in `do.md` is updated to include the new sub-command
7. **Effort-level CLI contract:** `--effort low|medium|high` flag controls research depth, project-mode file scoping, and research fallback behaviour (see Effort Levels table and Effort-Level Fallback Rules below). Default is `medium`.
8. The skill works as a standalone analytical command — no task pipeline (no planner/reviewer/executioner)
9. **Codex delivery:** A corresponding `codex/optimise.md` file exists, following the Codex skill pattern (same as `codex/debug.md` / `codex/update.md`), providing best-effort parity with defined degradation: at `high` effort, Codex degrades gracefully by skipping web research and noting the limitation in the report. Core functionality (ctx7 + peer files) works identically across runtimes.
10. **ctx7 budget policy:** ctx7 calls follow a deterministic budget (see ctx7 Budget Policy below) — no unbounded querying

### Effort Levels

| Level | Flag | Research sources | Project-mode file scoping | Token budget |
|-------|------|-----------------|--------------------------|--------------|
| `low` | `--effort low` | ctx7 only (1 library + 1 docs call max). **No fallback** — if ctx7 is unavailable, report "ctx7 unavailable" and produce findings from model knowledge + peer file structure only. | Summary only: list files with types, no deep analysis | Minimal |
| `medium` (default) | `--effort medium` or bare | ctx7 + peer file comparison (scan project for similar patterns). WebSearch fallback permitted if ctx7 fails. | Key files: up to 10 files, prioritized by type relevance | Moderate |
| `high` | `--effort high` | ctx7 + peer files + WebSearch for public examples/repos + deeper cross-reference analysis. WebSearch fallback permitted if ctx7 fails. | Full scan with exclude patterns (node_modules, .do, dist, build, coverage) | Extended |

### Effort-Level Fallback Rules

When ctx7 is disabled in `.do/config.json` or a ctx7 call fails with a quota error:

| Effort | Fallback behaviour |
|--------|--------------------|
| `low` | **No fallback.** Report "ctx7 unavailable — run `npx ctx7@latest login` for higher limits" in Sources Consulted. Produce findings using model knowledge and file structure analysis only. Do NOT invoke WebSearch. |
| `medium` | **WebSearch fallback permitted.** Retry the same question(s) via WebSearch (max 2 calls). Show a message suggesting `npx ctx7@latest login`. |
| `high` | **WebSearch fallback permitted.** Retry the same question(s) via WebSearch (folded into the existing web search budget — total WebSearch cap remains 3 calls across fallback + planned queries). Show a message suggesting `npx ctx7@latest login`. |

## Clarifications

- **No `--fix` flag in v1.** The backlog spec mentions a `--fix` flag that auto-applies safe suggestions and spawns `/do:task` for complex ones. This is deferred to a future iteration. v1 is report-only.
- **Skill file creation: executor writes directly, /skill-creator is NOT invoked programmatically.** The executor writes `skills/do/optimise.md` directly (Read/Write/Edit tools). After execution completes, run `/skill-creator` manually to verify and refine the skill file per project conventions. The CLAUDE.md instruction applies to human-initiated edits, not programmatic generation inside a task.
- **Target detection heuristics:** Agent files match `agents/do-*.md` or contain agent frontmatter (`tools:`, `color:`). Skill files match `skills/do/*.md` or contain skill frontmatter (`name: do:*`). Scripts match `*.cjs` or `*.js` in `scripts/`. Everything else is a generic file. "Project" mode triggers when no target is given or target is a directory.

### Scope Clarification (grilling session, 2026-04-15)

**Q:** Which deliverables are in scope for this execution? The task listed 7 sub-tasks including Codex command and database update.

**A:** Core deliverables first — defer Codex command and database update. We will likely remove the Codex implementation entirely.

**In-scope for execution:**
1. `skills/do/scripts/optimise-target.cjs` — target detection and analysis script
2. `skills/do/optimise.md` — skill file (written directly by executor; /skill-creator run after for verification)
3. `skills/do/scripts/__tests__/optimise-target.test.cjs` — tests for the detection script
4. `skills/do/do.md` — router update to include `/do:optimise`

**Deferred / removed:**
- `codex/optimise.md` — deferred; likely removed from scope entirely
- `database/projects/do/project.md` — deferred to a follow-up

**Scope factor:** was 0.80 -> now 0.95 (boundaries now explicit)

## Context Loaded

| Doc | Why |
|-----|-----|
| `.do/BACKLOG.md` | Full spec for `/do:optimise` under Ideas section |
| `database/projects/do/project.md` | Tech stack, agent list, conventions, skill list, release flow |
| `skills/do/do.md` | Router skill — needs update to include `/do:optimise` |
| `skills/do/task.md` | Reference for skill structure and agent spawning patterns |
| `skills/do/debug.md` | Reference for standalone skill pattern (no task pipeline) |
| `skills/do/update.md` | Reference for standalone skill with step-by-step structure |
| `skills/do/scan.md` | Reference for skill that uses a supporting CJS script |
| `agents/do-planner.md` | Agent file structure for target-type detection heuristics |
| `bin/install.cjs` | Install flow — copies all `skills/do/` files, no changes needed |
| `package.json` | Dependencies — gray-matter available for frontmatter parsing |
| `codex/debug.md` | Codex skill pattern reference — standalone workflow without Agent tool |
| `codex/update.md` | Codex skill pattern reference — multi-step standalone workflow |

## Approach

### 1. Create the target detection and analysis script

**File:** `skills/do/scripts/optimise-target.cjs`

This CJS script handles the deterministic parts of the optimisation flow:

- **Argument parsing**: Accept positional target path plus `--effort <low|medium|high>` flag. Default effort to `medium` if omitted.

- **Target type detection**: Accept a path argument, detect type using heuristics:
  - No argument or directory path -> `project`
  - `agents/do-*.md` or file with agent frontmatter (tools/color keys) -> `agent`
  - `skills/do/*.md` or file with skill frontmatter (name: do:*) -> `skill`
  - `*.cjs` or `*.js` in a scripts directory -> `script`
  - `*.md` in references directory -> `reference`
  - Anything else -> `file`

- **Context gathering** (scoped by effort level):
  - `project` at `low`: List skills/agents/scripts with types, no file reading
  - `project` at `medium`: Read config.json, project.md from database, up to 10 key files (prioritized: config > agents > skills > scripts > references)
  - `project` at `high`: Full scan — read all project files excluding `node_modules/`, `.do/`, `dist/`, `build/`, `coverage/`, `__tests__/`
  - `agent`: Read the agent file + all skills/references that mention it (all effort levels)
  - `skill`: Read the skill file + referenced scripts/references (all effort levels)
  - `script`: Read the script + its test file (if exists in `__tests__/`) + all skills that reference it (all effort levels)
  - `file`: Read the file + detect language/framework from content and extension (all effort levels)

- **Research query derivation**: Based on target type and detected technologies, produce structured research instructions:
  - `ctx7_queries`: Array of `{ technology_family, library_name, question }` objects (see ctx7 Budget Policy)
  - `peer_file_patterns`: Glob patterns for finding similar files in the project (e.g., `agents/do-*.md` when target is an agent, `skills/do/scripts/*.cjs` when target is a script)
  - `web_search_queries`: Array of search query strings for public examples (only populated when effort = `high`)

- **Output**: JSON to stdout with `{ type, target_path, effort, context_files, ctx7_queries, peer_file_patterns, web_search_queries, technologies, file_scope }`

**Expected outcome:** Script is executable, handles all target types and effort levels, outputs valid JSON.

### 2. Create the optimise skill file (Claude Code)

**File:** `skills/do/optimise.md`

Use `/skill-creator` to produce the skill. The skill follows the standalone pattern (like `/do:debug` and `/do:update` — no task pipeline, no agent spawning). Structure:

**Frontmatter:**
- `name: do:optimise`
- `description:` triggers on "optimise", "optimize", "audit", "best practices check", "review this file/project/agent/skill"
- `argument-hint: "[target path or 'project'] [--effort low|medium|high]"`
- `allowed-tools: Read, Bash, Glob, Grep, WebSearch`

**Steps:**

- **Step 1: Check prerequisites** — `.do/config.json` exists, ctx7 enabled check
- **Step 2: Detect target and parse effort** — Run `skills/do/scripts/optimise-target.cjs` with the user's argument (including --effort flag if provided), parse JSON output
- **Step 3: Read target and context files** — Read all files listed in `context_files` from script output
- **Step 4: Research — ctx7 best practices** — Follow the ctx7 Budget Policy (below) to fetch documentation. On ctx7 failure: check effort level to determine fallback behaviour (see Effort-Level Fallback Rules). At `low`, stop research and note "ctx7 unavailable" in Sources Consulted. At `medium`/`high`, fall back to WebSearch for the same questions (within the WebSearch budget cap).
- **Step 5: Research — peer file comparison** (skip if effort = `low`) — Use `peer_file_patterns` from script output to find similar files in the project. Read up to 5 peer files. Compare patterns, structure, and conventions between target and peers. Note deviations as potential findings.
- **Step 6: Research — web search for public examples** (only if effort = `high`) — Use `web_search_queries` from script output. Search for public repos, blog posts, and official examples that demonstrate best practices for the detected technologies. Cap at 3 WebSearch calls total (including any fallback calls from Step 4).
- **Step 7: Locate findings with line numbers** — For each potential finding identified in Steps 4-6, read the target file (using Read tool with line numbers) and locate the specific line(s) where the issue occurs. Match findings to exact line numbers by searching for the relevant code pattern, identifier, or structural element. Each finding must have a concrete `file:line` reference before proceeding to the report. If a finding is structural (e.g., "missing section in agent file"), reference the line where it should be inserted (e.g., after the last existing section).
- **Step 8: Cross-reference and finalise findings** — Compare the target's actual implementation against ALL research sources (ctx7 docs, peer patterns, web examples). For each finding, confirm: severity (critical/warning/suggestion), exact location (file:line from Step 7), concrete fix description with the quoted source line, and which source backs the suggestion (ctx7 doc link, peer file path, or web URL). Discard findings that cannot be tied to a specific location.
- **Step 9: Generate report** — Output structured report in markdown:

```
## Optimisation Report: <target>

**Target type:** <type>
**Technologies:** <detected tech>
**Effort level:** <low|medium|high>
**Findings:** <count> (<critical>C / <warning>W / <suggestion>S)

### Critical
- [C1] `<file>:<line>` -- <issue>
  > `<quoted source line from file>`
  **Fix:** <concrete description>
  **Source:** <ctx7 doc link | peer file path | web URL>

### Warnings
...

### Suggestions
...

### Sources Consulted
- **ctx7:** <list of docs fetched with links>
- **Peer files:** <list of project files compared>
- **Web:** <list of URLs consulted> (high effort only)
- **Skipped:** <any sources skipped due to budget or unavailability>
```

- **Step 10: Save report (optional)** — If the user wants to save, write to `.do/optimise/<target-slug>-<date>.md`. Create directory if needed.

**Expected outcome:** Skill file follows do-lang conventions, is self-contained, produces actionable reports grounded in multiple research sources with verifiable file:line citations.

### 3. Create the Codex optimise command

**File:** `codex/optimise.md`

Follow the Codex command pattern established by `codex/debug.md` and `codex/update.md`:
- Frontmatter with `name`, `description`, `argument-hint`, `allowed-tools` (no Agent tool — Codex does not support it)
- `<objective>` and `<process>` blocks
- All script paths use `$HOME/.codex/commands/do/scripts/` prefix
- Same step structure as the Claude Code skill but adapted for Codex runtime:
  - No Agent tool usage
  - Inline ctx7 calls via Bash
  - **No WebSearch available** — at `high` effort, Codex skips web research entirely and notes "WebSearch unavailable in Codex runtime — web research skipped" in the report's Sources Consulted section. This means ctx7 fallback at `medium`/`high` effort is also unavailable; Codex behaves like `low` effort fallback rules (report ctx7 unavailable, proceed with model knowledge + peer files)
  - Report printed to stdout (no interactive save prompt)

**Expected outcome:** Codex users can run the optimise command with best-effort parity. Core functionality (ctx7 + peer files + line-level analysis) works identically. Web research is a known degradation, clearly communicated in the output.

### 4. Update the `/do` router

**File:** `skills/do/do.md`

Add `/do:optimise` to the sub-commands table:

| Command | When to use |
|---------|-------------|
| `/do:optimise` | Checking best practices for a project, file, agent, skill, or script |

Add routing examples:
- "check best practices for this agent" -> `/do:optimise agents/do-verifier.md`
- "optimise this project" -> `/do:optimise`
- "audit this script" -> `/do:optimise skills/do/scripts/council-invoke.cjs`
- "are there improvements for this skill?" -> `/do:optimise skills/do/task.md`
- "deep audit of this project" -> `/do:optimise --effort high`
- "quick check this file" -> `/do:optimise path/to/file --effort low`

**Expected outcome:** `/do` correctly routes optimisation-related requests to `/do:optimise`.

### 5. Update project database entry

**File:** `~/workspace/database/projects/do/project.md`

Add `/do:optimise` to the Features section and update the scripts list in Tech section with `optimise-target.cjs`.

**Expected outcome:** Database entry reflects the new skill for future context loading.

### 6. Write tests for the target detection script

**File:** `skills/do/scripts/__tests__/optimise-target.test.cjs`

Test cases:
- No argument -> returns type `project`
- Agent file path -> returns type `agent` with correct ctx7 queries
- Skill file path -> returns type `skill`
- CJS file path -> returns type `script`
- Generic file path -> returns type `file`
- Non-existent path -> returns error JSON
- Directory path -> returns type `project`
- ctx7 query derivation produces relevant queries for each type
- `--effort low` -> ctx7_queries has max 1 entry, peer_file_patterns empty, web_search_queries empty
- `--effort medium` -> peer_file_patterns populated, web_search_queries empty
- `--effort high` -> all three research arrays populated
- Project mode with `--effort low` -> file_scope is summary-only (no context_files beyond listing)
- Project mode with `--effort medium` -> file_scope caps at 10 files
- Project mode with `--effort high` -> file_scope includes full scan with exclude patterns

**Expected outcome:** All tests pass, script handles edge cases and effort-level variations.

### 7. Add `.do/optimise/` to gitignore pattern

**File:** `.do/` is already gitignored. Verify that `.do/optimise/` is covered by the existing pattern. If `.gitignore` uses `.do/` (with trailing slash), subdirectories are covered automatically. No change expected, but confirm.

**Expected outcome:** Reports saved to `.do/optimise/` are not committed.

## ctx7 Budget Policy

A deterministic budget governs ctx7 usage per invocation to stay within the global 3-call cap:

**Prioritization rule:** Rank candidate queries by relevance to the target type. Group queries by "technology family" (e.g., Node.js core, Claude Code patterns, React, etc.). Only the highest-priority family gets a library lookup.

| Effort | Max `library` calls | Max `docs` calls | Total ctx7 calls | Policy |
|--------|---------------------|-------------------|-------------------|--------|
| `low` | 1 | 1 | 2 | Top-priority technology family only. Single library resolve + single docs fetch. |
| `medium` | 1 | 2 | 3 | Top-priority technology family: 1 library + 1 docs. Second family (if detected): reuse library ID if same org, otherwise 1 docs only. |
| `high` | 1 | 2 | 3 | Same as medium (ctx7 cap is hard). Additional depth comes from peer files and web search, not more ctx7 calls. |

**Skipped queries:** When the budget is exhausted, remaining queries are logged in the report under "Sources Consulted" as "skipped (budget exhausted)" so the user knows what was not checked.

**Fallback:** Governed by effort level (see Effort-Level Fallback Rules in Acceptance Criteria section). At `low`: no fallback, report ctx7 unavailable and stop. At `medium`/`high`: fall back to WebSearch with the same question, within the WebSearch budget cap. Always show a message suggesting `npx ctx7@latest login` for higher limits.

## Concerns

### 1. ctx7 rate limiting / quota (Medium risk)
**Risk:** ctx7 has per-session quotas. Even with the budget policy, repeated invocations in a session could exhaust the quota.
**Mitigation:** Hard cap at 3 ctx7 calls per invocation (aligns with global ctx7 rules and the budget policy table). Show a clear message if a call fails with quota error and suggest `npx ctx7@latest login`. Fallback behaviour is effort-dependent: `low` stops cleanly, `medium`/`high` fall back to WebSearch within their budget cap.

### 2. Project-wide scan scope explosion (Medium risk)
**Risk:** Running `/do:optimise` on a full project could try to analyse dozens of files, burning context and producing an overwhelming report.
**Mitigation:** Effort levels explicitly control project-mode scoping: `low` = summary listing only, `medium` = top 10 files by priority, `high` = full scan with exclude patterns (`node_modules/`, `.do/`, `dist/`, `build/`, `coverage/`). The default `medium` prevents unbounded analysis.

### 3. ctx7 query quality varies by target type (Low risk)
**Risk:** For agent/skill files (which are do-lang specific), ctx7 may not have relevant documentation — Claude Code skill authoring isn't a well-documented library in ctx7.
**Mitigation:** For do-lang-specific targets (agents, skills, references), the peer file comparison (Step 5) is the primary research source — compare against the project's own conventions and patterns (from project.md and existing similar files). ctx7 is most valuable for scripts (Node.js patterns) and generic code files. The multi-source approach ensures findings even when one source has limited coverage.

### 4. Skill creation convention requires /skill-creator (Low risk)
**Risk:** The project convention says "Always use /skill-creator when creating or modifying skill files — never hand-edit directly." The executor needs to honour this.
**Mitigation:** The approach explicitly calls out using /skill-creator in Step 2. The plan provides the content specification; the executor produces the file through the proper tool.

### 5. Report format not standardised across targets (Low risk)
**Risk:** Different target types may produce very different report structures, making the output inconsistent.
**Mitigation:** The report template is fixed (Critical/Warnings/Suggestions with `file:line` + quoted source line + fix + source). The content varies by target, but the structure is consistent. The "Sources Consulted" section is categorized by source type (ctx7/peer/web/skipped) for clarity.

### 6. Codex runtime limitations — defined degradation (Low risk)
**Risk:** Codex CLI does not support the Agent tool or WebSearch. The Codex command file needs to work within these constraints, but "equivalent functionality" was an overstatement.
**Mitigation:** The Codex command (`codex/optimise.md`) uses inline Bash for ctx7 calls (matching `codex/debug.md` pattern). WebSearch is unavailable in Codex — at `high` effort, web research is skipped with a clear note in the report. ctx7 fallback to WebSearch is also unavailable in Codex, so all effort levels degrade to "report ctx7 unavailable" on ctx7 failure. AC9 now specifies "best-effort parity with defined degradation" rather than "equivalent functionality."

### 7. Research thoroughness vs. token cost (Low risk)
**Risk:** At `high` effort, the combination of ctx7 + peer files + web search + full file scan could consume significant tokens in a single invocation.
**Mitigation:** Each research phase has explicit caps (3 ctx7 calls, 5 peer files, 3 web searches). The effort flag makes this an explicit user choice. The default `medium` is designed for a reasonable cost-to-value ratio.

### 8. Line-number accuracy in findings (Medium risk)
**Risk:** The file:line references in the report could be wrong if the analysis step does not actually read the file with line numbers. The CJS script outputs file-level metadata only — it does not locate specific lines within files.
**Mitigation:** A dedicated step (Step 7: "Locate findings with line numbers") requires the skill to read the target file using the Read tool (which returns `cat -n` format with line numbers) and match each finding to a specific line before including it in the report. Findings that cannot be tied to a specific line are discarded or reported as file-level observations only. The report template now includes a quoted source line for each finding to make citations verifiable. Tests assert at least one finding uses `file:line` format.

## Execution Log

### 2026-04-15 00:00 - Execution started
**Status:** In progress
**Steps:** 0/4 complete
**Scope:** optimise-target.cjs, optimise.md, optimise-target.test.cjs, do.md router update

### 2026-04-15 00:01 - Step 1: Create optimise-target.cjs
**Files:**
- `skills/do/scripts/optimise-target.cjs` - Created 400-line CJS module with argument parsing, target type detection (project/agent/skill/script/reference/file), technology detection, context gathering (scoped by effort level), and research query derivation (ctx7_queries, peer_file_patterns, web_search_queries). All target types verified with manual runs.

**Decisions:**
- Used `path.relative(cwd, resolved)` for output paths so JSON remains portable
- Project mode with effort=low returns `file_listing` (summary of skills/agents/scripts) instead of `context_files` to match the plan spec
- `target_path` for project mode set to `""` (cwd itself) rather than an absolute path

**Status:** Complete

### 2026-04-15 00:02 - Step 2: Create optimise.md skill file
**Files:**
- `skills/do/optimise.md` - Created 10-step standalone skill file. Frontmatter includes name, description (trigger phrases), argument-hint, and allowed-tools. Steps cover: prerequisites check, target detection via script, file reading, ctx7 research with budget policy and fallback rules, peer file comparison, web search (high only), line-number location, cross-reference finalisation, structured report generation, and optional save.

**Decisions:**
- Followed standalone pattern (like debug.md / update.md) — no Agent spawning, no task pipeline
- Used `@scripts/optimise-target.cjs` reference in Files section per existing skill convention
- ctx7 budget policy embedded in Step 4 instructions (1 library + max 2 docs = 3 total cap)
- Effort-level fallback rules embedded in Step 4 as specified in the plan

**Status:** Complete

### 2026-04-15 00:03 - Step 3: Create optimise-target.test.cjs
**Files:**
- `skills/do/scripts/__tests__/optimise-target.test.cjs` - Created test file with 47 test cases covering: VALID_EFFORTS constant, EXCLUDE_DIRS constant, parseArgs (5 cases), detectTargetType (10 cases across all types + non-existent), deriveResearchQueries effort contracts (low/medium/high x agent/script), ctx7 query content validation, gatherProjectContext file_scope by effort level, run() end-to-end, and CLI mode (spawnSync). All 47 tests pass.

**Decisions:**
- Used createTempDir helper to isolate file system tests
- removeTempDir cleanup ensures no temp dir leakage
- CLI tests use spawnSync with 10s timeout to account for process startup

**Status:** Complete

### 2026-04-15 00:04 - Step 4: Update do.md router
**Files:**
- `skills/do/do.md` - Added `/do:optimise` to sub-commands table and 6 routing examples (project, agent, script, skill, high effort, low effort)

**Decisions:**
- Added routing examples after the existing `update do-lang` example to maintain list coherence

**Status:** Complete

### 2026-04-15 00:05 - Execution complete
**Status:** Complete
**Summary:**
- Steps completed: 4/4
- Files modified: 5 (optimise-target.cjs created, optimise.md created, optimise-target.test.cjs created, do.md updated, task file updated)
- Deviations: 0 minor, 0 blocking
- .gitignore verified: `.do/` pattern already covers `.do/optimise/` — no change needed
- All 47 tests pass

### 2026-04-15 - Code review fixes applied
**Files:**
- `skills/do/optimise.md` — Added `Write` and `AskUserQuestion` to `allowed-tools` frontmatter (fixes issues 1 and 2)
- `skills/do/scripts/optimise-target.cjs` — Removed unreferenced `TECH_FAMILIES` constant (fix 3); narrowed `child_process` detection from bare string match to `require('child_process')` / `require("child_process")` only (fix 4)

**Decisions:**
- Issue 5 (/skill-creator) confirmed deferred per user — not treated as blocking
- All 47 tests pass after changes (no regressions)

**Deviations:** None

**Status:** Complete

## Council Review

## Verification Results

### Approach Checklist

In-scope deliverables per grilling session clarification (2026-04-15):

- [x] `skills/do/scripts/optimise-target.cjs` — CJS module with argument parsing, target type detection (project/agent/skill/script/reference/file), technology detection, context gathering scoped by effort level, and research query derivation. 400 lines. All functions exported for testing.
- [x] `skills/do/optimise.md` — 10-step standalone skill file. Frontmatter includes name, description (trigger phrases), argument-hint, and allowed-tools (Read, Write, Bash, Glob, Grep, WebSearch, AskUserQuestion). Follows standalone pattern; no agent spawning.
- [x] `skills/do/scripts/__tests__/optimise-target.test.cjs` — 47 test cases covering all target types, effort levels, ctx7 query content, project context scoping, and CLI mode. All 47 tests pass.
- [x] `skills/do/do.md` router update — `/do:optimise` added to sub-commands table with 6 routing examples.
- [x] `.do/optimise/` gitignore coverage — `.do/` pattern in `.gitignore` covers subdirectories; no change needed (verified).

Deferred per scope clarification:
- `codex/optimise.md` — deferred; removed from scope
- `database/projects/do/project.md` — deferred to follow-up

### Quality Checks

No `lint`, `typecheck`, or `test` scripts found in `package.json` (only `postinstall`). Tests run directly via Node built-in test runner:

- **Tests:** PASS (`node --test skills/do/scripts/__tests__/optimise-target.test.cjs`)
  ```
  # tests 47
  # suites 19
  # pass 47
  # fail 0
  # cancelled 0
  # skipped 0
  # duration_ms 172
  ```

### Result: PASS
- Checklist: 5/5 in-scope items complete
- Quality: Tests pass (47/47)
- Blocking issues: None
