# Roadmap

## Progress

| Phase | Name | Status | Completed |
|-------|------|--------|-----------|
| 1 | Package Foundation | [ ] Pending | — |
| 2 | Workspace Detection & Init | [ ] Pending | — |
| 3 | Project Setup | Complete | 2026-04-13 |
| 4 | Database Scanning | Complete | 2026-04-13 |
| 5 | Task Creation & Refine Agent | Complete | 2026-04-13 |
| 6 | Grill-Me Agent | Complete | 2026-04-13 |
| 7 | Context Decision & Implementation | Complete | 2026-04-13 |
| 8 | 1/1 | Complete   | 2026-04-13 |
| 9 | Task Resume | [ ] Pending | — |
| 10 | Debug Mode | [ ] Pending | — |
| 11 | AI Council Integration | [ ] Pending | — |
| 12 | Codex Adapter | [ ] Pending | — |

---

## Phase 1: Package Foundation

**Goal:** Establish npm package structure with installation and local dev support.

**Requirements:** TS-01

**Plans:** 1 plan

Plans:
- [ ] 01-01-PLAN.md — Create package infrastructure, placeholder skill, and README with yalc verification

**Deliverables:**
- `package.json` with name, version, scripts, files
- `bin/install.cjs` postinstall script
- `skills/do/` directory structure
- `.gitignore`, `README.md`
- yalc workflow verified

**Success Criteria:**
- [ ] `npm pack` creates valid tarball
- [ ] `yalc publish && yalc add do-lang` works locally
- [ ] postinstall copies to `~/.claude/skills/do/`

---

## Phase 2: Workspace Detection & Init

**Goal:** Detect missing workspace setup and create foundation (database, AGENTS.md).

**Requirements:** TS-02

**Plans:** 1 plan

Plans:
- [ ] 02-01-PLAN.md — Implement /do:init with interactive setup, templates, and health check

**Deliverables:**
- `/do:init` skill (workspace level)
- Detection logic for CLAUDE.md marker
- Database folder structure creation
- AGENTS.md, CLAUDE.md, CURSOR.md, GEMINI.md generation

**Success Criteria:**
- [ ] Running `/do:init` in fresh workspace creates all files
- [ ] Running any `/do:*` without setup triggers workspace init
- [ ] CLAUDE.md contains "do init completed" marker

---

## Phase 3: Project Setup

**Goal:** Extend /do:init to handle project-level detection and initialization.

**Requirements:** TS-03

**Plans:** 1/1 plans complete

Plans:
- [x] 03-01-PLAN.md — Create config template, project health check script, and extend SKILL.md with project-level logic

**Deliverables:**
- Project-level detection in `/do:init`
- `.do/config.json` template and creation
- `.do/tasks/` folder creation
- Project health check script
- Config options: council toggles, auto_grill_threshold

**Success Criteria:**
- [ ] Running `/do:*` in project without `.do/` triggers setup
- [ ] `config.json` created with correct defaults
- [ ] `tasks/` folder exists and is empty

---

## Phase 4: Database Scanning

**Goal:** Create /do:scan skill that analyzes projects and generates database entries.

**Requirements:** TS-04, TS-05

**Plans:** 3/3 plans complete

Plans:
- [x] 04-01-PLAN.md — Create scan-project.cjs detection script and template files
- [x] 04-02-PLAN.md — Add /do:scan skill to SKILL.md with Auto-scan and Interview modes
- [x] 04-03-PLAN.md — Create database entry gate check for /do:task

**Deliverables:**
- `/do:scan` skill
- Codebase analysis logic (package.json, folder structure, etc.)
- `project.md` template and generation
- `components/`, `tech/` subfolder creation
- `__index__.md` update

**Success Criteria:**
- [ ] `/do:scan` creates database entry at correct path
- [ ] `project.md` contains detected tech stack
- [ ] `__index__.md` updated with project reference
- [ ] Running `/do:task` without database entry shows clear error

---

## Phase 5: Task Creation & Refine Agent

**Goal:** Create task entry point and refinement agent that documents the task.

**Requirements:** TS-06

**Plans:** 2/2 plans complete

Plans:
- [x] 05-01-PLAN.md — Create load-task-context.cjs script and task-template.md
- [x] 05-02-PLAN.md — Implement /do:task and /do:abandon in SKILL.md

**Deliverables:**
- `/do:task` skill entry point
- Refine agent definition
- Task markdown template (YAML frontmatter + body)
- Active task tracking in `config.json`
- One-task-per-project enforcement

**Success Criteria:**
- [ ] `/do:task "description"` creates task file in `.do/tasks/`
- [ ] Task markdown has proper frontmatter (stages, confidence)
- [ ] Refine agent documents problem, context, approach, concerns
- [ ] Starting second task warns about existing active task

---

## Phase 6: Grill-Me Agent

**Goal:** Implement grill-me logic within /do:continue that forces clarification when confidence is low.

**Requirements:** TS-07

**Plans:** 1 plan

Plans:
- [ ] 06-01-PLAN.md — Add Clarifications section to task-template.md and implement /do:continue with grill-me flow

**Deliverables:**
- Grill-me agent definition
- Confidence threshold check (< 0.9)
- Targeted questioning logic
- Task markdown update with clarifications
- Confidence recalculation

**Success Criteria:**
- [ ] Confidence < 0.9 automatically triggers grill-me
- [ ] Agent asks specific questions about gray areas
- [ ] Task markdown updated with answers
- [ ] Loops until confidence >= threshold or user override

---

## Phase 7: Context Decision & Implementation

**Goal:** Ask about context clear, then execute the task.

**Requirements:** TS-08, TS-09

**Plans:** 1/2 plans executed

Plans:
- [x] 07-01-PLAN.md — Extract grill-me to stage-grill.md, refactor SKILL.md into stage router
- [x] 07-02-PLAN.md — Create stage-execute.md with context clear decision and execution flow

**Deliverables:**
- AskUserQuestion for clear decision
- Implementation agent definition
- Task execution logic
- Execution log in task markdown
- File change documentation

**Success Criteria:**
- [ ] User prompted about clearing context (never implicit)
- [ ] `/do:continue` works after `/clear`
- [ ] Implementation agent executes task following plan
- [ ] Task markdown updated with files changed, decisions made

---

## Phase 8: Verification Agent

**Goal:** Verify implementation matches the task requirements.

**Requirements:** TS-10

**Plans:** 1/1 plans complete

Plans:
- [x] 08-01-PLAN.md — Create stage-verify.md, update task-template.md, and wire routing in SKILL.md

**Deliverables:**
- Verify agent definition
- Implementation vs plan comparison
- Quality check integration (lint, types, tests)
- Verification results in task markdown
- Task completion marking

**Success Criteria:**
- [ ] Verify agent runs after implementation
- [ ] Compares actual changes against planned approach
- [ ] Runs applicable quality checks
- [ ] Marks task complete or flags issues

---

## Phase 9: Task Resume

**Goal:** Resume work from any task state via `/do:continue`.

**Requirements:** TS-11

**Deliverables:**
- `/do:continue` skill
- Active task detection from `config.json`
- Stage routing from YAML frontmatter
- Context reconstruction from task markdown

**Success Criteria:**
- [ ] `/do:continue` finds active task
- [ ] Routes to correct stage (refinement/grilling/execution/verification)
- [ ] Full context available from task markdown
- [ ] Works after `/clear`

---

## Phase 10: Debug Mode

**Goal:** Structured debugging workflow separate from task execution.

**Requirements:** TS-12

**Deliverables:**
- `/do:debug` skill
- Debug session tracking in `.do/debug/`
- Scientific method workflow (hypothesis, test, confirm/reject)
- Debug findings documentation

**Success Criteria:**
- [ ] `/do:debug` creates debug session
- [ ] Follows hypothesis → test → confirm/reject flow
- [ ] Documents steps and findings
- [ ] Can run independently of task workflow

---

## Phase 11: AI Council Integration

**Goal:** Bidirectional council reviews for plans and implementations.

**Requirements:** F-01, F-02

**Deliverables:**
- Council review skill/logic
- Briefing template system
- Plan review integration (after refinement)
- Implementation review integration (after execution)
- Configurable per-project

**Success Criteria:**
- [ ] `config.json` `council_reviews.planning` enables plan review
- [ ] `config.json` `council_reviews.execution` enables impl review
- [ ] Claude reviews Codex executions
- [ ] Codex reviews Claude executions
- [ ] Feedback incorporated before proceeding

---

## Phase 12: Codex Adapter

**Goal:** Full `/do:*` workflow support in Codex CLI.

**Requirements:** F-03, F-04

**Deliverables:**
- Codex command structure (`~/.codex/commands/do/`)
- Cross-runtime adapter pattern
- AGENTS.md support
- Task abandonment handling

**Success Criteria:**
- [ ] `/do:*` commands work in Codex CLI
- [ ] Same workflow behavior in both runtimes
- [ ] Task state portable between runtimes
- [ ] Abandoned tasks can be restarted

---

## Dependencies Graph

```
Phase 1 (Package)
    └── Phase 2 (Workspace Init)
            └── Phase 3 (Project Setup)
                    └── Phase 4 (Database Scan)
                            └── Phase 5 (Task/Refine)
                                    ├── Phase 6 (Grill-Me)
                                    │       └── Phase 7 (Clear/Implement)
                                    │               └── Phase 8 (Verify)
                                    └── Phase 9 (Resume) [parallel with 6-8]
                                    
Phase 10 (Debug) — Independent after Phase 3
Phase 11 (Council) — Requires Phase 5, 8
Phase 12 (Codex) — Requires Phase 1, can parallelize with 2-11
```

### Phase 13: Workspace Customization

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 12
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 13 to break down)

---
*Generated: 2026-04-13*
