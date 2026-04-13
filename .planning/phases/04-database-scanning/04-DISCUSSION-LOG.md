# Phase 4: Database Scanning - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-13
**Phase:** 04-database-scanning
**Areas discussed:** Auto-detection scope, project.md structure, Interactive vs. generated, Subfolder creation

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-detection scope | What to detect automatically vs. what to ask about | ✓ |
| project.md structure | Full rich structure vs. minimal starter template | ✓ |
| Interactive vs. generated | How much to ask during scan vs. infer from codebase | ✓ |
| Subfolder creation | Create components/, tech/, features/ upfront or leave for user | ✓ |

**User's choice:** All four areas
**Notes:** User wanted comprehensive discussion of all areas

---

## Auto-detection Scope

### What to auto-detect

| Option | Description | Selected |
|--------|-------------|----------|
| Package deps (Recommended) | Parse package.json/requirements.txt for framework, UI lib, testing, linting tools | ✓ |
| Folder structure | Scan src/ for common patterns (components/, hooks/, routes/, api/) | ✓ |
| Config files | Detect .eslintrc, tsconfig, vite.config, commitlint.config and infer conventions | ✓ |
| Git conventions | Read recent commits to detect commit prefix patterns and branch naming | ✓ |

**User's choice:** All four detection types
**Notes:** None

### Scanning depth

| Option | Description | Selected |
|--------|-------------|----------|
| Top-level only (Recommended) | List src/components/, src/routes/, src/api/ etc. without diving into files | ✓ |
| One level deep | Also list major subdirectories for more context | |
| Full tree | Generate complete directory tree | |

**User's choice:** Top-level only
**Notes:** "Top level should be fine, but it's important to document/scan project's way of working. Important complex things, etc. Documenting very niche things or unexpected things is important, but not a 'Button' component that's super straight forward to use for example."

---

## project.md Structure

### Sections to generate

| Option | Description | Selected |
|--------|-------------|----------|
| Core sections (Recommended) | General info, Tech Stack, Key Directories, Conventions | ✓ |
| Empty barrel imports | Components, Tech, Features headers with placeholder links | ✓ |
| Jira placeholder | Add Jira section with site/board fields to fill in | |
| Inline questions | Ask during scan and include answers | |

**User's choice:** Core sections + Empty barrel imports
**Notes:** "Jira might not be used by every person. Maybe we should have a section in AGENTS.md that says # Do-lang customizations and for each command (scan, task, etc) during /do:init they can specify these customizations like do you use jira, or do you want this or whatever."

### Handling per-user customization

| Option | Description | Selected |
|--------|-------------|----------|
| Defer to later (Recommended) | Phase 4 generates core + barrel imports. Add customization as enhancement after v1 | ✓ |
| Block Phase 4 | First enhance Phase 2 to add customization questions | |
| Inline ask | During /do:scan, ask 'Do you use Jira?' | |

**User's choice:** Defer to later
**Notes:** "Probably defer to later, a .do-workspace.json sounds actually really good. Can we add this as a new phase?"

---

## Interactive vs. Generated

### Interaction model

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal asking (Recommended) | Infer everything possible. Only ask: confirm name, description | |
| Key questions | Ask about: name, description, purpose, key URLs | |
| Full interview | Walk through each section asking what to include | |

**User's choice:** Other — let user choose
**Notes:** "Ask the user, do you want auto scanning, or interview style where you ask questions"

### Confirm interaction model

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, choice at start | Ask auto vs interview when /do:scan runs | ✓ |
| Flags instead | /do:scan (default auto), /do:scan --interview | |
| Always auto first | Auto-scan, then ask 'Want to add more details?' at end | |

**User's choice:** Yes, choice at start
**Notes:** None

---

## Subfolder Creation

| Option | Description | Selected |
|--------|-------------|----------|
| No folders upfront (Recommended) | Just create project.md. Create folders when first doc needed | |
| Empty folders | Create components/, tech/, features/ as empty placeholders | |
| Folders with READMEs | Create folders with README.md explaining what goes there | ✓ |

**User's choice:** Folders with READMEs
**Notes:** None

---

## Claude's Discretion

- Exact wording of auto-scan vs interview prompt
- README.md content for subfolders
- Heuristics for detecting "non-obvious" patterns
- Error handling for malformed files
- Section ordering in project.md

## Deferred Ideas

- **Workspace customization system** — `.do-workspace.json` for per-user command preferences. User wants this as a new phase after v1.
