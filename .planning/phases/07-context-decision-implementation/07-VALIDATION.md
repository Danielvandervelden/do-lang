---
phase: 7
slug: context-decision-implementation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-13
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (node:test) |
| **Config file** | None - uses `node --test` |
| **Quick run command** | `node --test skills/do/scripts/__tests__/*.test.cjs` |
| **Full suite command** | `node --test skills/do/scripts/__tests__/*.test.cjs` |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- **After every task commit:** Manual verification - run /do:continue through execution flow
- **After every plan wave:** Verify reference file loading works
- **Before `/gsd:verify-work`:** Full manual test: create task -> grill -> execute -> verify log
- **Max feedback latency:** N/A - manual testing

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | TS-08 | manual | N/A - requires human interaction | N/A | pending |
| 07-01-02 | 01 | 1 | TS-09 | manual | N/A - requires /do:continue | N/A | pending |
| 07-01-03 | 01 | 1 | D-19 | manual | grep for @ reference syntax | N/A | pending |

*Status: pending · green · red · flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. No Wave 0 setup needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Context clear prompts user | TS-08 | Requires human interaction with prompt | Run /do:continue after grill-me, verify prompt appears |
| Hybrid fallback works | D-18 | Requires testing both paths | Test AskUserQuestion path, then simulate failure for inline fallback |
| Execution updates log | TS-09 | Requires running full workflow | Execute a task, verify Execution Log section populated |
| Reference file loading | D-19 | Requires stage-specific routing | Run /do:continue at different stages, verify correct file loads |

---

## Validation Sign-Off

- [ ] All tasks have manual verify instructions
- [ ] No automated tests required for skill markdown
- [ ] Reference file routing verified manually
- [ ] Execution log format matches D-20

**Approval:** pending
