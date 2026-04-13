---
phase: 3
slug: project-setup
status: ready
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-13
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual + Node.js smoke tests (no test runner) |
| **Config file** | None (no test runner configured) |
| **Quick run command** | `node skills/do/scripts/project-health.cjs .` |
| **Full suite command** | Manual: `yalc publish && cd /tmp/test-project && yalc add do-lang` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node skills/do/scripts/project-health.cjs .`
- **After every plan wave:** Manual test in clean project directory
- **Before `/gsd:verify-work`:** Full suite must pass (TS-03 acceptance criteria)
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | TS-03 | smoke | `test -f skills/do/references/config-template.json && node -e "require('./skills/do/references/config-template.json')"` | Wave 0 | pending |
| 03-01-02 | 01 | 1 | TS-03 | unit | `node skills/do/scripts/project-health.cjs --help` | Wave 0 | pending |
| 03-01-03 | 01 | 1 | TS-03 | smoke | `grep -q "Project-Level Detection" skills/do/SKILL.md` | N/A | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [x] All tasks have `<automated>` verify commands defined in plan
- [x] config-template.json will be created by Task 1
- [x] project-health.cjs will be created by Task 2

*Wave 0 artifacts created by the plan itself, not pre-existing infrastructure.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Interactive setup flow | TS-03 | Requires user input | Run `/do:init` in project without `.do/`, answer prompts, verify files created |
| Health check mode | TS-03 | Requires initialized state | Run `/do:init` in project WITH `.do/`, verify health check output |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 artifacts created by plan tasks (self-contained)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready
