---
phase: 02-workspace-detection-init
plan: 01
subsystem: workspace-init
tags: [init, workspace, templates, health-check]

dependency_graph:
  requires: []
  provides:
    - "/do:init command implementation"
    - "AGENTS.md template with generic patterns"
    - "Pointer file templates (CLAUDE.md, CURSOR.md, GEMINI.md)"
    - "Workspace health check script"
  affects:
    - "skills/do/SKILL.md"
    - "Future /do:* commands (will use detection logic)"

tech_stack:
  added:
    - "Node.js CommonJS module for health checks"
  patterns:
    - "Placeholder-based templating ({{WORKSPACE_PATH}}, etc.)"
    - "JSON health check output format"
    - "Dual-mode command (setup vs health check)"

key_files:
  created:
    - skills/do/references/agents-template.md
    - skills/do/references/pointer-templates.md
    - skills/do/scripts/workspace-health.cjs
  modified:
    - skills/do/SKILL.md

decisions:
  - "Used CommonJS (.cjs) for health check script for Node.js compatibility"
  - "Health check returns JSON for programmatic parsing by SKILL.md"
  - "Version marker uses HTML comment format for CLAUDE.md"
  - "Placeholder syntax uses double braces {{NAME}} for easy regex replacement"

metrics:
  duration: "128s"
  tasks_completed: 3
  files_created: 3
  files_modified: 1
  completed: "2026-04-13T08:26:15Z"
---

# Phase 02 Plan 01: Workspace Detection & Init Summary

Implemented `/do:init` command with dual-mode behavior: interactive setup for fresh workspaces, health check for existing ones.

## Tasks Completed

| Task | Name | Status | Key Output |
|------|------|--------|------------|
| 1 | Create AGENTS.md template and pointer file templates | Done | agents-template.md (81 lines), pointer-templates.md (51 lines) |
| 2 | Create workspace health check script | Done | workspace-health.cjs (267 lines, exports checkWorkspaceHealth) |
| 3 | Implement /do:init command in SKILL.md | Done | Full command spec with interactive flow, detection logic, health check mode |

## Implementation Details

### agents-template.md
Generic AGENTS.md template containing:
- Workspace Configuration section with path placeholders
- Loading context (database/__index__.md barrel imports)
- Writing context (when to document)
- Database folder naming conventions
- project.md structure requirements
- Git conventions
- Reuse before building
- API types
- Formatting
- Database bootstrapping

Placeholders: `{{WORKSPACE_PATH}}`, `{{DATABASE_PATH}}`, `{{GITHUB_PROJECTS_PATH}}`, `{{VERSION}}`

### pointer-templates.md
Templates for three pointer files:
- CLAUDE.md (includes `<!-- do init completed v{{VERSION}} -->` marker)
- CURSOR.md
- GEMINI.md

All point to AGENTS.md as canonical source.

### workspace-health.cjs
Node.js health check script with:
- CLI interface (`node workspace-health.cjs <path> [--pretty]`)
- Programmatic export (`checkWorkspaceHealth`)
- Six health check types:
  - `duplicateIndex`: Duplicate entries in __index__.md
  - `staleProjects`: Database entries for deleted repos
  - `orphanedEntries`: Database entries with no repo
  - `missingAgentsSections`: Required sections missing from AGENTS.md
  - `pointerConsistency`: Pointer files not referencing AGENTS.md
  - `versionMarker`: Missing or invalid version marker

### SKILL.md /do:init Command
Complete command specification including:
- Detection logic (check for "do init completed" marker)
- Interactive setup mode (5 questions with defaults)
- File creation steps (database structure, AGENTS.md, pointer files, config)
- Health check mode (parse JSON, display report with suggested fixes)
- Health check types table

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all functionality is complete for this plan's scope.

## Verification Results

All success criteria verified:
- agents-template.md: 81 lines with all 3 placeholder types
- pointer-templates.md: 51 lines with all 3 file templates
- workspace-health.cjs: Returns valid JSON, exports function
- SKILL.md: Contains /do:init, detection logic, health check mode, template references

## Self-Check: PASSED

Files verified:
- FOUND: skills/do/references/agents-template.md
- FOUND: skills/do/references/pointer-templates.md
- FOUND: skills/do/scripts/workspace-health.cjs
- FOUND: skills/do/SKILL.md (modified)
