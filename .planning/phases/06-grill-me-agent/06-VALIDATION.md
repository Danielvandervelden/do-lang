---
phase: 6
slug: grill-me-agent
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-13
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js test runner (native) |
| **Config file** | None required for Phase 6 |
| **Quick run command** | `node --test skills/do/scripts/__tests__/*.test.cjs` |
| **Full suite command** | `node --test skills/do/scripts/__tests__/` |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- **After every task commit:** Manual verification of skill behavior
- **After every plan wave:** Full skill walkthrough with test task
- **Before `/gsd:verify-work`:** Create task with low confidence, verify grill-me triggers and completes
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 0 | TS-07 | wave-0 | N/A — template update | MISSING | ⬜ pending |
| 06-01-02 | 01 | 1 | TS-07-a | manual | N/A — skill behavior | N/A | ⬜ pending |
| 06-01-03 | 01 | 1 | TS-07-b | manual | N/A — skill behavior | N/A | ⬜ pending |
| 06-01-04 | 01 | 1 | TS-07-c | manual | N/A — skill behavior | N/A | ⬜ pending |
| 06-01-05 | 01 | 1 | TS-07-d | unit | `node --test scripts/__tests__/recalc-confidence.test.cjs` | Wave 0 | ⬜ pending |
| 06-01-06 | 01 | 1 | TS-07-e | manual | N/A — skill behavior | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `skills/do/references/task-template.md` — needs Clarifications section placeholder
- [ ] `skills/do/scripts/__tests__/recalc-confidence.test.cjs` — if helper script created

*Wave 0 tasks set up test infrastructure before feature implementation.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Confidence < threshold triggers grill-me | TS-07-a | Interactive skill flow | Create task, set low confidence, run `/do:continue` |
| Targeted questions about weak factors | TS-07-b | Question generation depends on context | Verify question matches weakest factor |
| Task markdown updated with clarifications | TS-07-c | File state after interaction | Check Clarifications section exists with Q&A |
| Loop until threshold or override | TS-07-e | Interactive behavior | Answer questions until confidence meets threshold |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
