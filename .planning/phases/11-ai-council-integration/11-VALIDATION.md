---
phase: 11
slug: ai-council-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-13
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (node:test) |
| **Config file** | None (use node --test) |
| **Quick run command** | `node --test skills/do/scripts/__tests__/council-invoke.test.cjs` |
| **Full suite command** | `node --test skills/do/scripts/__tests__/*.test.cjs` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test skills/do/scripts/__tests__/council-invoke.test.cjs`
- **After every plan wave:** Run `node --test skills/do/scripts/__tests__/*.test.cjs`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | F-01 | unit | `node --test skills/do/scripts/__tests__/council-invoke.test.cjs` | ❌ W0 | ⬜ pending |
| 11-01-02 | 01 | 1 | F-01 | unit | `node --test skills/do/scripts/__tests__/council-invoke.test.cjs` | ❌ W0 | ⬜ pending |
| 11-02-01 | 02 | 2 | F-02 | unit | `node --test skills/do/scripts/__tests__/council-invoke.test.cjs` | ❌ W0 | ⬜ pending |
| 11-02-02 | 02 | 2 | F-02 | integration | Manual verification | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `skills/do/scripts/__tests__/council-invoke.test.cjs` — covers runtime detection, reviewer selection, output parsing
- [ ] Mock Codex/Gemini responses for deterministic testing
- [ ] Create `__tests__/` directory in scripts folder

*Wave 0 must be planned and executed before any feature tasks.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Plan review triggers after refinement | F-01 | Requires full /do:task flow | Run /do:task, check council invocation in output |
| Code review triggers after execution | F-02 | Requires full /do:task flow | Complete task execution, verify council review in task markdown |
| Results written to task markdown | F-02 | File content verification | Check Council Results section in .do/tasks/*.md |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
