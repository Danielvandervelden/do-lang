---
phase: 4
slug: database-scanning
status: planned
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-13
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None currently configured |
| **Config file** | None — Wave 0 must create |
| **Quick run command** | `node skills/do/scripts/scan-project.cjs . --pretty` |
| **Full suite command** | N/A (no test framework yet — manual verification) |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Manual verification — run script, check output
- **After every plan wave:** Full skill test in fresh project
- **Before `/gsd:verify-work`:** All acceptance criteria from REQUIREMENTS.md verified
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | TS-05 | integration | `node scripts/scan-project.cjs . --pretty` | W0 | pending |
| 04-01-02 | 01 | 1 | TS-05 | integration | `test -f project-template.md` | W0 | pending |
| 04-01-03 | 01 | 1 | TS-05 | integration | `test -f component-readme.md` | W0 | pending |
| 04-02-01 | 02 | 2 | TS-05 | manual | Run /do:scan, verify output | W0 | pending |
| 04-03-01 | 03 | 3 | TS-04 | integration | `node scripts/check-database-entry.cjs --help` | W0 | pending |
| 04-03-02 | 03 | 3 | TS-04 | manual | Run /do:task without db entry | W0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `skills/do/scripts/scan-project.cjs` — detection logic script
- [ ] `skills/do/references/project-template.md` — project.md template
- [ ] `skills/do/references/component-readme.md` — README for components/ folder
- [ ] `skills/do/references/tech-readme.md` — README for tech/ folder
- [ ] `skills/do/references/features-readme.md` — README for features/ folder
- [ ] `skills/do/scripts/check-database-entry.cjs` — database entry gate script

*Infrastructure created during plan execution, not pre-existing.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Auto-scan mode generates project.md | TS-05 | Full E2E flow through skill | 1. Run /do:scan in test project 2. Select "Auto-scan" 3. Verify project.md created |
| Interview mode asks questions | TS-05 | Interactive prompts | 1. Run /do:scan 2. Select "Interview" 3. Answer questions 4. Verify answers in project.md |
| Database entry gate blocks /do:task | TS-04 | Requires skill integration | 1. Remove database entry 2. Run /do:task 3. Verify error message |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
