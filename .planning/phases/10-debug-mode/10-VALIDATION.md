---
phase: 10
slug: debug-mode
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-13
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (native Node.js test runner) |
| **Config file** | package.json (scripts.test) |
| **Quick run command** | `node --test tests/debug-*.test.js` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test tests/debug-*.test.js`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | TS-12 | unit | `node --test tests/debug-session.test.js` | ❌ W0 | ⬜ pending |
| 10-01-02 | 01 | 1 | TS-12 | unit | `node --test tests/debug-lifecycle.test.js` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending | ✅ green | ❌ red | ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/debug-session.test.js` — session creation, frontmatter, section structure
- [ ] `tests/debug-lifecycle.test.js` — status transitions, active session blocking
- [ ] `skills/do/references/debug-template.md` — template file for debug sessions

*Test stubs should cover: session file creation, frontmatter parsing, APPEND vs OVERWRITE section rules, resume detection.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Resume after /clear | TS-12 | Requires conversation context loss | Run /do:debug, start investigating, /clear, /do:debug — should show resume summary |
| Task integration sync | TS-12 | Requires interactive user confirmation | Link debug to task, resolve, confirm "copy findings?" prompt works |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
