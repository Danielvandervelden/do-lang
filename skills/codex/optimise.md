---
name: do:optimise
description: "Audit any target (project, file, agent, skill, or script) against current best practices. Multi-source research: ctx7 documentation, peer file comparison, and optional web search. Use this whenever the user wants to improve, audit, or review any file or the project as a whole — including phrases like 'optimise', 'optimize', 'audit', 'best practices check', 'review this file/project/agent/skill', 'are there improvements for', 'what could be better here', 'check best practices', 'how does this compare to best practices', or 'is this up to standard'. Also trigger when the user asks to review code quality, check for anti-patterns, or get suggestions on any specific file."
argument-hint: "[target path or omit for project] [--effort low|medium|high]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - WebSearch
  - AskUserQuestion
---

# /do:optimise

Audit any artefact in the do-lang system (or any file in a managed project) against current best practices. Grounded in three research sources: ctx7 documentation, peer file comparison within the project, and web search (high effort only).

## Why this exists

Existing review stages focus on plan fitness and code correctness for a specific task. None of them systematically check whether an implementation follows current best practices for the specific technology involved. `/do:optimise` fills this gap by providing on-demand, ctx7-backed auditing of any artefact — on demand, standalone, no task pipeline needed.

## Usage

```
/do:optimise [target] [--effort low|medium|high]
```

**Examples:**
- `/do:optimise` — audit the whole project at medium effort
- `/do:optimise agents/codex-verifier.md` — audit a single agent file
- `/do:optimise skills/codex/scan.md --effort high` — deep audit of a skill file
- `/do:optimise skills/do/scripts/council-invoke.cjs` — audit a CJS script
- `/do:optimise --effort low` — quick project summary (ctx7 only, no peer files)
- `/do:optimise path/to/any-file.ts --effort high` — deep audit of any file

**Effort levels:**

| Level | Research | Project scope | Token cost |
|-------|----------|---------------|------------|
| `low` | ctx7 only (max 3 calls). No fallback if ctx7 unavailable. | Summary listing only | Minimal |
| `medium` (default) | ctx7 + peer file comparison (max 5 calls). WebSearch fallback if ctx7 fails. | Up to 10 key files | Moderate |
| `high` | ctx7 + peer files + WebSearch (max 10 calls). WebSearch fallback if ctx7 fails. | Full scan (excludes node_modules, .do, dist, build, coverage) | Extended |

---

## Step 1: Check Prerequisites

Read `.do/config.json` to confirm the project is initialized and to check ctx7 availability:

```bash
node -e "
try {
  const c = require('./.do/config.json');
  const ctx7 = c.web_search?.context7 !== false;
  console.log(JSON.stringify({ initialized: true, ctx7_enabled: ctx7 }));
} catch (e) {
  console.log(JSON.stringify({ initialized: false, ctx7_enabled: false, error: e.message }));
}
"
```

If `initialized: false`, stop and tell the user to run `/do:init` first.

Store `ctx7_enabled` for use in Steps 4 and 6.

## Step 2: Detect Target and Parse Effort

Extract from the user's invocation:
- **Target path**: the path argument if provided, otherwise omit (project mode)
- **Effort**: from `--effort <level>` if present, otherwise omit (defaults to `medium`)

Run the optimise-target script:

```bash
# With target and effort:
node ~/.codex/skills/do/scripts/optimise-target.cjs "<target_path>" --effort <effort>

# Target only (medium effort):
node ~/.codex/skills/do/scripts/optimise-target.cjs "<target_path>"

# Effort only (project mode):
node ~/.codex/skills/do/scripts/optimise-target.cjs --effort <effort>

# No args (project mode, medium effort):
node ~/.codex/skills/do/scripts/optimise-target.cjs
```

Parse the JSON output and store:
- `type` — project | agent | skill | script | reference | file
- `target_path` — relative path to target (or empty string for project)
- `effort` — resolved effort level (low | medium | high)
- `context_files` — files to read in Step 3
- `ctx7_queries` — research queries for Step 4
- `peer_file_patterns` — glob patterns for Step 5
- `web_search_queries` — search queries for Step 6
- `technologies` — detected technology identifiers
- `file_scope` — summary | key-files | full-scan | file
- `file_listing` — (project+low only) summary of all skills/agents/scripts

If `error` field is present in output, stop and report it clearly — common causes are a non-existent target path or an unreadable file.

## Step 3: Read Target and Context Files

Read all files listed in `context_files`. For project mode with `file_scope: summary` (effort=low), do not read any files — display the `file_listing` summary and proceed with analysis using model knowledge and structural observations from the listing alone.

For project mode with `file_scope: key-files` or `file_scope: full-scan`, read each file in `context_files` using the Read tool.

Take note of:
- Structural patterns (frontmatter keys, section headings, naming conventions)
- Tool usage, script references, error handling patterns
- Version-specific APIs or deprecated patterns
- Missing sections that peer files typically include

## Step 4: Research — ctx7 Best Practices

Follow the ctx7 budget policy — per-effort caps: low=3, medium=5, high=10 total calls (library + docs combined). The budget is a ceiling, not a target: follow the research thread if it warrants more calls, stop early when confident.

For each entry in `ctx7_queries` (in order, respecting the budget):

1. Resolve the library ID:
   ```bash
   npx ctx7@latest library <library_name> "<question>"
   ```
2. Pick the best-matching result.
3. Fetch docs:
   ```bash
   npx ctx7@latest docs <libraryId> "<question>"
   ```

Stop when budget is exhausted. Log skipped queries as "skipped (budget exhausted)" in Sources Consulted.

**On ctx7 failure (quota error or unavailable):**

- If `effort = low`: Stop ctx7 research. Note "ctx7 unavailable — run `npx ctx7@latest login` for higher limits" in Sources Consulted. Proceed to Step 6 using model knowledge and file structure analysis only. Do NOT invoke WebSearch.
- If `effort = medium` or `high`: Fall back to WebSearch for the same questions (within the WebSearch budget cap — max 3 WebSearch calls total across Steps 4 and 6). Show "ctx7 unavailable — suggest `npx ctx7@latest login`" in Sources Consulted.

**If `ctx7_enabled` is false in config**: Treat as ctx7 unavailable and apply the same fallback rules.

## Step 5: Research — Peer File Comparison

**Skip entirely if `effort = low`.**

Use the `peer_file_patterns` from the script output to find similar files in the project:

```bash
# For each pattern in peer_file_patterns, use Glob:
Glob("<pattern>", path: "<project_root>")
```

Use the directory containing `.do/config.json` as `<project_root>` — this ensures correct results regardless of CWD.

Read up to 5 peer files. Compare against the target:
- What sections/keys do peers have that the target is missing?
- What naming conventions do peers follow?
- What tool usage or structural patterns appear consistently in peers but are absent from target?

Note deviations as potential findings (severity: suggestion or warning depending on how consistently the pattern appears in peers).

## Step 6: Research — Web Search for Public Examples

**Only run if `effort = high`.**

Use `web_search_queries` from the script output. Cap at 3 WebSearch calls total across this step and any fallback calls from Step 4.

Search for public repos, blog posts, and official examples that demonstrate best practices for the detected technologies. Use findings to supplement or confirm findings from Steps 4 and 5.

## Step 7: Locate Findings with Line Numbers

Use the file content already loaded in Step 3 (the Read tool returns `cat -n` format with line numbers). If the target wasn't read in Step 3 (project+low mode), read it now.

For each potential finding identified in Steps 3–6:

1. Locate the specific line(s) where the issue occurs by searching for the relevant code pattern, identifier, or structural element in the loaded content.
2. Record the exact `file:line` reference.
3. Quote the relevant source line from the file.

If a finding is structural (e.g., "missing section"):
- Reference the line where it should be inserted (e.g., after the last existing section heading).

**Discard any finding that cannot be tied to a specific location.** File-level observations without a line number are only included if they relate to the overall structure (e.g., "file has no frontmatter").

## Step 8: Cross-Reference and Finalise Findings

Compare the target's actual implementation against ALL research sources (ctx7 docs, peer patterns, web examples).

For each finding, confirm and record:
- **Severity**: `critical` (breaks functionality or violates hard requirements), `warning` (likely causes problems or significant deviation from conventions), `suggestion` (improvement opportunity, style, or minor deviation)
- **Location**: exact `file:line` from Step 7
- **Quoted line**: the actual line from the file
- **Fix**: concrete description of what to change and how
- **Source**: ctx7 doc link, peer file path, or web URL that backs the finding

Discard findings that:
- Cannot be tied to a specific location (unless file-level)
- Are contradicted by other research sources
- Are purely stylistic with no documented rationale

## Step 9: Generate Report

Output the following structured report in markdown:

```
## Optimisation Report: <target_path or "project">

**Target type:** <type>
**Technologies:** <technologies joined by ", ">
**Effort level:** <effort>
**Findings:** <total count> (<critical count>C / <warning count>W / <suggestion count>S)

---

### Critical

- [C1] `<file>:<line>` — <issue summary>
  > `<quoted source line from file>`
  **Fix:** <concrete description of what to change>
  **Source:** <ctx7 doc link | peer file path | web URL>

(Repeat for each critical finding, or "None" if no critical findings.)

---

### Warnings

- [W1] `<file>:<line>` — <issue summary>
  > `<quoted source line from file>`
  **Fix:** <concrete description>
  **Source:** <source>

(Repeat, or "None".)

---

### Suggestions

- [S1] `<file>:<line>` — <issue summary>
  > `<quoted source line from file>`
  **Fix:** <concrete description>
  **Source:** <source>

(Repeat, or "None".)

---

### Sources Consulted

- **ctx7:** <list of docs fetched, with library IDs and question used>
- **Peer files:** <list of project files compared, or "none (effort=low)">
- **Web:** <list of URLs consulted, or "none (effort=low/medium)">
- **Skipped:** <any queries skipped due to budget exhaustion or ctx7 unavailability>
```

## Step 10: Save Report (Optional)

Ask the user: "Save this report to `.do/optimise/`? (y/n)"

If yes:
1. Generate a slug from the target path: replace `/` and `.` with `-`, lowercase.
2. Get today's date in YYYYMMDD format.
3. Create the output path: `.do/optimise/<slug>-<date>.md`
4. Write the report using the Write tool.
5. Confirm: "Report saved to `.do/optimise/<slug>-<date>.md`"

---

## Failure Handling

- **Script error** (`optimise-target.cjs` exits non-zero): Show the `error` field from the JSON output to the user. Do not proceed with subsequent steps until the issue is resolved.
- **ctx7 unavailable** (quota error or `ctx7_enabled: false`): Already covered in Step 4 fallback rules — apply those rules and cross-reference Step 4 when reporting to the user. No automatic retry.
- **WebSearch unavailable**: Note all web-sourced findings as "unconfirmed by web sources" in the report. Proceed with ctx7 and peer file findings only.
- **Write failure** (Step 10 save): Report the error to the user. The report content was already displayed in Step 9, so no data is lost — the user can copy it manually.

---

## Files

- **Detection script:** @scripts/optimise-target.cjs
