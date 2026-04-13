---
phase: "04"
plan: "02"
subsystem: scanning
tags:
  - skill-definition
  - database-entry
  - codebase-analysis
dependency_graph:
  requires:
    - scan-project.cjs
    - project-template.md
    - subfolder-readmes
  provides:
    - /do:scan skill
  affects:
    - /do:task (will check database_entry before proceeding)
tech_stack:
  added: []
  patterns:
    - Inline prompts for mode selection (avoids AskUserQuestion bug)
    - Two-mode UX (Auto-scan vs Interview)
    - Template placeholder replacement
    - Barrel import index updates
key_files:
  created: []
  modified:
    - skills/do/SKILL.md
decisions:
  - Use inline prompts per D-09 (consistent with Phase 2/3)
  - Interview mode asks for purpose in addition to name, description, URLs (per D-08)
  - Branch naming uses TODO placeholder (no fabrication per council advisory)
  - Monorepo warning documented but not blocking
metrics:
  duration: 73s
  completed: 2026-04-13
---

# Phase 04 Plan 02: /do:scan Skill Definition Summary

Added /do:scan skill to SKILL.md with Auto-scan and Interview modes for database entry creation.

## One-Liner

Complete /do:scan skill definition with two-mode UX, scan-project.cjs integration, template placeholder replacement, and __index__.md update logic.

## Completed Tasks

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Add /do:scan skill to SKILL.md | 491c526 | 247 lines added, complete workflow for both Auto-scan and Interview modes |

## Key Deliverables

### /do:scan Skill Definition

The skill now documents the complete workflow for creating database entries:

**Mode Selection (per D-08):**
- Auto-scan: Infer everything from codebase, user edits project.md after
- Interview: Walk through questions for name, description, purpose, URLs

**Auto-Scan Mode Steps:**
1. Run scan-project.cjs to detect tech stack
2. Read workspace config for database path
3. Check for existing entry (prompt to overwrite)
4. Create folder structure (components/, tech/, features/)
5. Copy README templates to subfolders
6. Generate project.md from template with placeholder replacement
7. Update __index__.md with project reference
8. Set config.json database_entry to true
9. Display completion summary

**Interview Mode Steps:**
1. Run scan-project.cjs (same as auto-scan)
2. Ask questions: name, description, purpose, prod URL, test URL
3. Merge user input with detected data
4. Steps 4-9 same as auto-scan

**Template Placeholder Mapping:**
- `{{PROJECT_NAME}}` from scan.project_name
- `{{DESCRIPTION}}` from user input or TODO
- `{{REPO_PATH}}` from current working directory
- `{{PROD_URL}}`, `{{TEST_URL}}` from user input or TODO
- `{{DATABASE_PATH}}` from workspace config
- `{{TECH_STACK}}` generated from scan.detected
- `{{KEY_DIRECTORIES}}` generated from scan.key_directories
- `{{CONVENTIONS}}` generated from scan.conventions with TODO placeholders

**File References:**
- @skills/do/scripts/scan-project.cjs (detection script)
- @skills/do/references/project-template.md
- @skills/do/references/component-readme.md
- @skills/do/references/tech-readme.md
- @skills/do/references/features-readme.md

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

All acceptance criteria verified:
- `SKILL.md` contains `## /do:scan` (count: 1)
- `SKILL.md` contains `### Mode Selection` (count: 1)
- `SKILL.md` contains `### Auto-Scan Mode` (count: 1)
- `SKILL.md` contains `### Interview Mode` (count: 1)
- `SKILL.md` contains `@skills/do/scripts/scan-project.cjs` (count: 4)
- `SKILL.md` contains `@skills/do/references/project-template.md` (count: 2)
- `SKILL.md` contains `"database_entry": true` (count: 1)
- `SKILL.md` contains `__index__.md` (count: 8)
- `SKILL.md` contains `TODO: Document branch naming` (count: 2)
- `SKILL.md` Interview Mode asks for "purpose" (count: 1)
- Quick Reference table has `/do:scan` row

## Self-Check: PASSED

**Modified files exist:**
- FOUND: skills/do/SKILL.md

**Commits exist:**
- FOUND: 491c526 (feat(04-02): add /do:scan skill to SKILL.md)
