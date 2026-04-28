---
id: 260424-readme-audit-v1-18-0
created: "2026-04-24T12:00:00.000Z"
updated: "2026-04-28T06:32:38.330Z"
description: "Review and update entire README.md for accuracy and completeness against v1.18.0 codebase. Fix AI-assisted install prompt (missing registry URL), audit all sections against current state."
related: []
stage: abandoned
stages:
  refinement: complete
  grilling: complete
  execution: complete
  verification: complete
  abandoned: true
council_review_ran:
  plan: true
  code: true
confidence:
  score: 0.95
  factors: null
  context: 0
  scope: -0.05
  complexity: -0.05
  familiarity: 0
  revision: -0.05
backlog_item: null
pre_abandon_stage: complete
---

# README Audit for v1.18.0

## Problem Statement

The README.md is the primary onboarding surface for do-lang. The target audience includes non-technical people (PMs in IT) who need to understand what problem this solves before the "how." As the project has evolved to v1.18.0, several sections have drifted from the actual codebase state. Specific issues:

1. **Non-technical readability** — The README jumps into technical detail without first explaining the problem do-lang solves in plain language. Technical terms (e.g., "flat agent hierarchy," "token usage," "council review") are used without explanation. PMs and other non-technical readers should be able to understand the "What is do?" and opening sections without prior knowledge of AI coding workflows.

2. **AI-assisted install prompt** — The collapsible section includes the `.npmrc` registry line, but the `npm install` command itself does not carry the `--registry` flag. An agent executing step-by-step might fail if `.npmrc` changes don't take effect before the install runs (e.g., wrong home directory resolution). Adding `--registry` to the install command makes it fully self-contained.

3. **Config documentation is incomplete** — The `.do/config.json` example in the README shows only a subset of the actual config template fields. Missing: `project_name`, `database_entry`, `active_task`, `active_debug`, `active_project`, `project_intake_threshold`, `delivery_contract`, and nested `council_reviews.project` settings. Additionally, auto-managed state fields are not clearly separated from user-editable settings.

4. **context7 scope is understated** — README says context7 "enables ctx7 documentation lookups during `/do:optimise`" but it is actually used in three places: do-planner (planning research), do-debugger (error research), and do:optimise (best-practices auditing).

5. **PAT removal verification** — The repo is now public. No PAT/auth references remain in the README. Already clean.

6. **`.do-workspace.json` section** — Already present and structurally accurate against the init-workspace-setup.md reference.

7. **Feature list and Quick Start not verified** — The "What is do?" feature bullets and Quick Start command semantics must be explicitly verified against current skill files, not left to a generic final review pass.

8. **General accuracy audit** — Commands table, agent pipeline, dev workflow all need verification against current skill files and agent definitions.

**Acceptance criteria:**
- Every section in the README matches the v1.18.0 codebase
- Opening sections ("What is do?") explain the problem in plain language before going into the how — understandable by a PM in IT without prior AI coding workflow knowledge
- Technical terms have brief plain-English explanations on first use
- AI-assisted install prompt is fully self-contained (an agent can execute it without prior knowledge)
- Config JSON example shows a practical subset of user-editable fields; auto-managed state fields documented separately as "State (managed automatically)"
- context7 description covers all three verified usage points (do-planner, do-debugger, do:optimise)
- No PAT/auth references remain
- `.do-workspace.json` section is accurate against init-workspace-setup.md
- Feature bullets in "What is do?" verified against current skill descriptions
- Quick Start command semantics verified against current skill behavior

## Delivery Contract

<!-- Empty — user dismissed onboarding flow, executioner uses project defaults. -->

## Clarifications

### Scope (was: -0.05 -> now: 0.00)
**Q:** Which sections should the executioner feel free to rewrite vs. touch-only-if-wrong?
**A:** All sections are fair game for rewrites if it improves accuracy or clarity.

### Complexity (was: -0.05 -> now: 0.00)
**Q:** How far to go with plain-English explanations in "What is do?"
**A:** Keep the existing structure/wording but add brief parentheticals after technical terms — minimal structural changes.

### Revision (was: -0.05 -> now: 0.00)
**Q:** If a discrepancy is found in `.do-workspace.json` section during verification, what should the executioner do?
**A:** Fix it inline and document what changed in the Execution Log.

## Context Loaded

- `~/workspace/database/projects/do/project.md` — Project context, tech stack, agents, conventions, release flow, features list
- `~/workspace/github-projects/do/README.md` — Current README to audit (278 lines)
- `~/workspace/github-projects/do/package.json` — Version confirmation (1.18.0), scripts, dependencies
- `~/workspace/github-projects/do/bin/install.cjs` — Postinstall script (confirms install targets)
- `~/workspace/github-projects/do/skills/do/references/config-template.json` — Actual config template (source of truth for config docs)
- `~/workspace/github-projects/do/skills/do/references/init-workspace-setup.md` — Workspace setup reference (`.do-workspace.json` structure) — **source of truth for workspace config**
- All 13 skill files (name + description headers) — Command table verification
- All 8 agent files (existence) — Agent pipeline verification
- All 20 script files — Script inventory
- All reference files — Feature coverage

## Approach

1. **Audit "What is do?" for non-technical readability** — Rewrite the opening paragraph and feature bullets so a PM in IT can understand what problem do-lang solves before any "how" detail. Specifically:
   - Lead with the problem statement: "AI coding assistants produce inconsistent results without structure."
   - Add a plain-English parenthetical after technical terms on first use (e.g., "flat agent hierarchy" → explain what it means in practice: "one coordinator, no nested chains of sub-agents").
   - Ensure each feature bullet explains the *benefit*, not just the mechanism.
   - File: `README.md`
   - Lines: 8-16
   - Expected outcome: A non-technical reader can understand what do-lang does and why it exists without prior AI coding workflow knowledge

2. **Verify "What is do?" feature bullets against current state** — Cross-reference each bullet against current skill and agent files:
   - "Structured workflows" — verify pipeline still matches agent flow in project.md
   - "Quality gates" — verify parallel plan review + council review + code review are still accurate
   - "State persistence" — verify `.do/` is still the persistence mechanism
   - "Direct user interaction" — verify AskUserQuestion is used in do-griller (8 refs), do-executioner (6 refs), do-verifier (16 refs) as confirmed by grep
   - "Claude Code only" — verify against actual runtime requirements. Note: `package.json` requires Node.js >=18 (`engines.node`), has a `gray-matter` dependency, and uses `npm install -g` with a `postinstall` script. The bullet "no other runtime required" is misleading — reword to clarify that Node.js/npm are needed for installation but no separate runtime is needed beyond Claude Code at usage time.
   - File: `README.md`
   - Lines: 11-15
   - Expected outcome: Each bullet is source-verified accurate; "Claude Code only" reworded to reflect actual install requirements

3. **Verify Quick Start command semantics** — Cross-reference each Quick Start section against current skill behavior:
   - `/do:init` — verify it still sets up "database structure and `.do/config.json`" (check init.md skill and init-workspace-setup.md)
   - `/do:scan` — verify it creates a database entry (check scan.md skill)
   - `/do:task` — verify "auto-routes between fast-path and the full pipeline" and "router only picks between fast and full" (check task.md skill)
   - `/do:fast` — verify "1-3 files, no shared abstractions" and "entry criteria check, execute, validate, single code review round" (check fast.md skill)
   - `/do:quick` — verify "manual-only," "orchestrator executes inline," "single council reviewer," "one iteration allowed," escalation behavior (check quick.md skill)
   - `/do:continue` — verify "reads task file's YAML frontmatter and picks up at the last completed stage" (check continue.md skill)
   - File: `README.md`
   - Lines: 50-104
   - Expected outcome: Every Quick Start description matches the corresponding skill file's actual behavior

4. **Fix AI-assisted install prompt** — In the collapsible `<details>` section (lines 37-48), add `--registry https://npm.pkg.github.com` to the `npm install -g` command in step 2. This makes the prompt fully self-contained even if the `.npmrc` step doesn't take effect. Also evaluate whether the main install command (line 30) should carry `--registry` for consistency — decision: keep the main install without `--registry` because it follows the `.npmrc` setup in Step 1 (the human flow), while the AI prompt needs to be self-contained for agents that may not persist `.npmrc` changes.
   - File: `README.md`
   - Lines: 30, 45
   - Expected outcome: AI prompt step 2 reads `npm install -g @danielvandervelden/do-lang --registry https://npm.pkg.github.com`; main install command stays as-is (intentional asymmetry documented)

5. **Update config.json example and documentation** — Show a practical subset of **user-editable** fields in the JSON example. Separately document auto-managed state fields in prose. Concrete plan:
   - JSON example keeps: `version`, `project_name`, `council_reviews` (including nested `project` sub-object with `plan`, `phase_plan`, `wave_plan`, `code`), `web_search`, `models`, `auto_grill_threshold`, `project_intake_threshold`
   - Below the JSON, add a "State (managed automatically)" prose section listing: `database_entry`, `active_task`, `active_debug`, `active_project`, `delivery_contract` (with `onboarded`, `dismissed`, `entry_commands` sub-fields) — with one-line descriptions and a note that users should not edit these manually
   - Source of truth: `skills/do/references/config-template.json`
   - **Note for executioner:** Steps 5 and 6 both touch lines 211-239 (config section). Apply step 5 first, then step 6 edits the result.
   - File: `README.md`
   - Lines: 211-239
   - Expected outcome: Config section clearly separates user-editable settings from auto-managed state

6. **Fix context7 description with source verification** — Update the `web_search.context7` documentation to mention all three verified usage points. Before editing, verify the three files:
   - `agents/do-planner.md` — confirm ctx7 reference exists (verified: yes)
   - `agents/do-debugger.md` — confirm ctx7 reference exists (verified: yes)
   - `skills/do/optimise.md` — confirm ctx7 reference exists (verified: yes)
   - Then update the prose to read: "enables ctx7 documentation lookups during planning (do-planner), debugging (do-debugger), and `/do:optimise` audits"
   - **Note for executioner:** This step edits the same config section as step 5. Apply after step 5.
   - File: `README.md`
   - Line: ~235 (will shift after step 5 edits)
   - Expected outcome: context7 description covers all three source-verified usage points

7. **Verify `.do-workspace.json` section** — Cross-reference against `skills/do/references/init-workspace-setup.md` (source of truth, not the live `~/.do-workspace.json` file). Verify field list and descriptions match the template in init-workspace-setup.md Step 5 item 6.
   - File: `README.md`
   - Lines: 192-209
   - Expected outcome: Section is accurate against the reference file

8. **Verify PAT/auth removal** — Confirm no PAT, token, or authentication references remain. Already verified clean — no action needed unless something is found during editing.
   - File: `README.md`
   - Expected outcome: Confirmed clean, no changes

9. **Verify commands table** — Cross-reference each entry against skill file names and descriptions. Current table has 12 entries. Actual skill files: do.md (router, not user-facing — correctly excluded), init.md, scan.md, task.md, fast.md, quick.md, continue.md, abandon.md, debug.md, update.md, optimise.md, backlog.md, project.md. That is 12 user-facing commands, matching the table. Verify descriptions match skill descriptions.
   - File: `README.md`
   - Lines: 108-122
   - Expected outcome: Table is accurate (likely no changes needed)

10. **Verify agent pipeline section** — Cross-reference agent table (8 agents) and flow diagram against agent files and project.md. Current README matches project.md's agent table. Verify role descriptions are current.
    - File: `README.md`
    - Lines: 148-188
    - Expected outcome: Pipeline section is accurate (likely no changes needed)

11. **Verify development section** — Check test command, yalc workflow, and clone URL.
    - File: `README.md`
    - Lines: 241-275
    - Expected outcome: Dev section is accurate (test command matches package.json)

12. **Final readability and accuracy pass** — Read the entire updated README top-to-bottom. Specifically check:
    - Non-technical readability: Can the first three sections be understood without prior AI workflow knowledge?
    - Technical accuracy: Do all sections match v1.18.0 codebase?
    - Consistency: No contradictions between sections
    - Grammar and flow
    - File: `README.md`
    - Expected outcome: No remaining inaccuracies or readability gaps

## Concerns

1. **Config example: user-editable vs auto-managed separation** — The config-template.json has 33 fields mixing user settings and internal state. Showing everything in one JSON block overwhelms readers and invites manual edits to auto-managed fields. Mitigation (resolved in step 5): The JSON example shows only user-editable fields. A separate "State (managed automatically)" prose block below lists `database_entry`, `active_task`, `active_debug`, `active_project`, and `delivery_contract` with explicit "do not edit manually" guidance.

2. **AI-assisted install — `.npmrc` vs `--registry` redundancy** — Adding `--registry` to the install command makes step 1 (`.npmrc`) technically redundant for a one-time install. Mitigation: Keep both — `.npmrc` ensures future `npm install` and `npm update` commands also use the right registry, while `--registry` makes the immediate install self-contained. The redundancy is intentional and helpful.

3. **Non-technical tone vs technical precision** — Adding plain-English explanations risks making the README feel patronizing to experienced developers. Mitigation: Use brief parentheticals after technical terms on first use only (e.g., "flat agent hierarchy (one coordinator, no nested chains)") rather than replacing technical language. Developers can skip the parenthetical; PMs get the context they need. Keep deeper sections (Agent Pipeline, Configuration, Development) at their current technical level — non-technical readers only need to understand "What is do?" and the Quick Start.

4. **Steps 5 and 6 overlap on config section** — Both steps edit the config documentation block (lines 211-239). Mitigation: Noted explicitly in both steps. Executioner must apply step 5 first, then step 6 edits the result of step 5.

5. **`.do-workspace.json` source of truth** — The live `~/.do-workspace.json` file may drift from the canonical template. Mitigation: Use `skills/do/references/init-workspace-setup.md` as the source of truth for verification, not the live file.

6. **Workspace vs project config distinction** — The config section rewrite must preserve the existing workspace-config-vs-project-config override explanation so readers understand the cascade. Mitigation: Step 5 explicitly keeps the workspace subsection header and adds a note about the override relationship when documenting project config fields.

## Execution Log

### 2026-04-24 09:00 - Execution started

**Status:** In progress
**Steps:** 0/12 complete

### 2026-04-24 09:05 - Step 1 & 2: "What is do?" — non-technical readability + feature bullet verification

**Files:**

- `README.md` lines 8-15 — rewrote opening paragraph to lead with the problem statement; added parenthetical for "flat agent hierarchy"; updated feature bullets

**Decisions:**

- Added "Without structure, AI coding assistants produce inconsistent results — great one session, off-track the next." as problem statement lead
- Added "(one coordinator, no nested chains of sub-agents)" after "flat agent hierarchy"
- Added "(a second AI checks the plan from outside)" after "council review"
- Rewrote "Direct user interaction" bullet to plain English: "Agents ask questions inline via a structured prompt — no going through an intermediary"
- Rewrote "Claude Code only" to "Installs to Claude Code: Requires Node.js ≥18 and npm for installation; no separate runtime needed at usage time" — addresses misleading claim per Step 2 note; Node.js ≥18 confirmed via package.json engines.node

**Status:** Complete

### 2026-04-24 09:10 - Step 3: Quick Start command semantics verification

**Files:**

- `README.md` line 60 — corrected init description from "sets up the database structure and `.do/config.json`" to "sets up the database structure and `.do-workspace.json`. Run again inside a project directory to initialize `.do/config.json` for that project."

**Decisions:**

- The original text combined workspace-init output (database structure, `.do-workspace.json`) with project-init output (`.do/config.json`) into one sentence, which was inaccurate for the workspace root flow
- `/do:task` description: verified "auto-routes between fast-path and the full pipeline" and "router only picks between fast and full" — confirmed in task.md Step 0
- `/do:fast` description: "1-3 files, no shared abstractions", "entry criteria check, execute, validate, single code review round" — all confirmed against fast.md entry criteria and stage-fast-exec flow
- `/do:quick` description: "1-2 files of mechanical work", "Orchestrator executes inline (no sub-agent spawn)", "single council reviewer", "One iteration allowed", "escalates to `/do:continue`" — all confirmed against quick.md
- `/do:continue` description: "Reads the task file's YAML frontmatter and picks up at the last completed stage" — confirmed against continue.md Step 2
- `/do:scan` description: "create a database entry" — confirmed against scan.md

**Status:** Complete

### 2026-04-24 09:15 - Step 4: Fix AI-assisted install prompt

**Files:**

- `README.md` line 45 — added `--registry https://npm.pkg.github.com` to AI-assisted install step 2

**Decisions:**

- Main install command (line 30) left without `--registry` — intentional asymmetry: human flow sets `.npmrc` first, AI prompt needs to be self-contained
- Both `.npmrc` and `--registry` are kept in the AI prompt; redundancy is intentional (`.npmrc` for future installs, `--registry` for immediate self-contained execution)

**Status:** Complete

### 2026-04-24 09:20 - Step 5: Update config.json example and documentation

**Files:**

- `README.md` config section (formerly lines 211-239) — replaced with expanded user-editable JSON example + separate "State (managed automatically)" prose block

**Decisions:**

- JSON example now includes: `version`, `project_name`, `council_reviews` (with nested `project` sub-object), `web_search`, `models`, `auto_grill_threshold`, `project_intake_threshold`
- Added `project_name` field (from config-template.json: `"{{PROJECT_NAME}}"`)
- Added `council_reviews.project` nested object with `plan`, `phase_plan`, `wave_plan`, `code` fields (verified against config-template.json)
- Added `project_intake_threshold` field (value `0.85` from config-template.json)
- Auto-managed state fields documented separately: `database_entry`, `active_task`, `active_debug`, `active_project`, `delivery_contract` with explicit "do not edit manually" guidance
- Source of truth: `skills/do/references/config-template.json`

**Status:** Complete

### 2026-04-24 09:25 - Step 6: Fix context7 description

**Files:**

- `README.md` `web_search.context7` description — updated to mention all three usage points

**Decisions:**

- Verified ctx7 references in do-planner.md (line 47-60), do-debugger.md (line 107-113), and skills/do/optimise.md (line 41-43) — all three confirmed present
- Updated description from "enables ctx7 documentation lookups during `/do:optimise`" to "enables ctx7 documentation lookups during planning (do-planner), debugging (do-debugger), and `/do:optimise` audits"

**Status:** Complete

### 2026-04-24 09:30 - Step 7: Verify `.do-workspace.json` section

**Files:**

- `README.md` lines 192-209 — no changes needed

**Decisions:**

- Cross-referenced README workspace JSON example against `skills/do/references/init-workspace-setup.md` Step 5 item 6
- All fields match exactly: `version`, `workspace`, `database`, `githubProjects`, `initializedAt`, `availableTools`, `defaultReviewer`, `council_reviews`
- Section is accurate — no changes required

**Status:** Complete (no changes)

### 2026-04-24 09:35 - Step 8: PAT/auth removal verification

**Files:**

- `README.md` — no changes needed

**Decisions:**

- Ran grep for PAT, personal access token, auth, token, password — no relevant hits
- "Token" appears only in the product tagline ("Token-efficient") and "token usage" in the What is do? section — these are not auth references
- README is clean of PAT/auth references

**Status:** Complete (confirmed clean, no changes)

### 2026-04-24 09:40 - Step 9: Commands table verification

**Files:**

- `README.md` lines 108-122 — no changes needed

**Decisions:**

- Verified all 12 entries against skill file descriptions
- do.md (router) correctly excluded from table — not user-facing
- All descriptions match their respective skill file descriptions
- Table is accurate — no changes required

**Status:** Complete (no changes)

### 2026-04-24 09:45 - Step 10: Agent pipeline section verification

**Files:**

- `README.md` lines 148-188 — no changes needed

**Decisions:**

- Verified 8 agent files exist: do-planner, do-plan-reviewer, do-council-reviewer, do-griller, do-executioner, do-code-reviewer, do-verifier, do-debugger — all match
- Verified plan review verdicts: do-plan-reviewer returns PASS/CONCERNS/RETHINK (confirmed), do-council-reviewer returns LOOKS_GOOD/CONCERNS/RETHINK at plan stage (confirmed via stage-plan-review.md)
- Verified code review verdicts: both reviewers return APPROVED/NITPICKS_ONLY/CHANGES_REQUESTED (confirmed via stage-code-review references)
- Flow diagram is accurate — no changes required

**Status:** Complete (no changes)

### 2026-04-24 09:50 - Step 11: Development section verification

**Files:**

- `README.md` lines 241-275 — no changes needed

**Decisions:**

- Test command `node --test skills/do/scripts/__tests__/*.test.cjs` matches package.json scripts.test exactly
- Git clone URL matches package.json repository.url
- Section is accurate — no changes required

**Status:** Complete (no changes)

### 2026-04-24 09:55 - Step 12: Final readability and accuracy pass

**Files:**

- `README.md` — reviewed top-to-bottom

**Decisions:**

- Non-technical readability: "What is do?" section now leads with the problem, explains technical terms inline, and all five bullets explain benefits not just mechanisms
- Technical accuracy: all sections verified against v1.18.0 codebase
- Consistency: no contradictions between sections found
- Grammar and flow: no issues found
- Deeper sections (Agent Pipeline, Configuration, Development) remain at appropriate technical level

**Status:** Complete

### 2026-04-24 10:00 - Execution complete

**Status:** Complete
**Summary:**

- Steps completed: 12/12
- Files modified: 1 (README.md)
- Deviations: 1 minor (auto-fixed): `/do:init` Quick Start description was inaccurate — combined workspace-init and project-init outputs into one sentence; fixed inline

## Council Review

## Verification Results

### Approach Checklist

- [x] Step 1: Audit "What is do?" for non-technical readability — problem statement lead added, parentheticals for "flat agent hierarchy" and "council review" added
- [x] Step 2: Verify "What is do?" feature bullets against current state — all five bullets source-verified; "Claude Code only" reworded to reflect Node.js >=18 install requirement
- [x] Step 3: Verify Quick Start command semantics — `/do:init` description corrected (was conflating workspace-init and project-init); all other commands verified accurate
- [x] Step 4: Fix AI-assisted install prompt — `--registry https://npm.pkg.github.com` added to AI-assisted install step 2; main install unchanged (intentional asymmetry)
- [x] Step 5: Update config.json example and documentation — JSON example updated to user-editable fields only; "State (managed automatically)" prose block added
- [x] Step 6: Fix context7 description — updated to cover all three usage points (do-planner, do-debugger, do:optimise); all three source-verified present
- [x] Step 7: Verify `.do-workspace.json` section — cross-referenced against init-workspace-setup.md; all fields match; no changes needed
- [x] Step 8: PAT/auth removal verification — confirmed clean; no changes
- [x] Step 9: Commands table verification — all 12 entries verified against skill files; no changes
- [x] Step 10: Agent pipeline section verification — 8 agents confirmed; verdicts verified; no changes
- [x] Step 11: Development section verification — test command matches package.json; clone URL matches repository.url; no changes
- [x] Step 12: Final readability and accuracy pass — README reviewed top-to-bottom; no remaining issues found

### Accuracy Spot-Checks

- [x] **Config JSON matches config-template.json** — README user-editable JSON contains `version`, `project_name`, `council_reviews` (with nested `project` object: `plan`, `phase_plan`, `wave_plan`, `code`), `web_search`, `models`, `auto_grill_threshold`, `project_intake_threshold`. All field names and values match config-template.json exactly (`version: "0.3.0"`, `project_intake_threshold: 0.85`, `auto_grill_threshold: 0.9`, `reviewer: "random"`). Auto-managed state fields (`database_entry`, `active_task`, `active_debug`, `active_project`, `delivery_contract`) documented in prose block, not in JSON — matches template.
- [x] **context7 in all 3 agent/skill files** — Verified present: do-planner.md (lines 47-60), do-debugger.md (lines 107-113), skills/do/optimise.md (lines 17, 41-43, 115+). All three confirmed.
- [x] **"Claude Code only" reworded correctly** — README line 15 reads: "Installs to Claude Code: Requires Node.js ≥18 and npm for installation; no separate runtime needed at usage time." Node.js >=18 confirmed via package.json `engines.node: ">=18.0.0"`.
- [x] **AI-assisted install has --registry flag** — README line 45 reads: `npm install -g @danielvandervelden/do-lang --registry https://npm.pkg.github.com`. Confirmed present.

### Quality Checks

Documentation-only task — lint, typecheck, and test scripts not applicable. Skipped per task instructions.

### Result: PASS
- Checklist: 12/12 complete
- Accuracy spot-checks: 4/4 pass
- Quality checks: N/A (documentation-only)
