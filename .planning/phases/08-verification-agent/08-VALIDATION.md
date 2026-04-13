---
phase: 8
slug: verification-agent
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-13
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js test runner (node:test) or manual |
| **Config file** | None currently — skill files tested manually |
| **Quick run command** | `node scripts/detect-quality-checks.cjs --test` |
| **Full suite command** | Manual verification via test task |
| **Estimated runtime** | ~30 seconds (manual flow) |

---

## Sampling Rate

- **After every task commit:** Manual verification via test task
- **After every plan wave:** Manual verification via test task
- **Before `/gsd:verify-work`:** Full verification flow on test task must complete
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | TS-10 | manual | Run `/do:continue` on verification stage task | ✅ | ⬜ pending |
| 08-01-02 | 01 | 1 | TS-10 | manual | Verify detection script finds package.json scripts | ❌ W0 | ⬜ pending |
| 08-01-03 | 01 | 1 | TS-10 | manual | Check task file has Verification Results section | ✅ | ⬜ pending |
| 08-01-04 | 01 | 1 | TS-10 | manual | Verify stage transitions and config.json updates | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/detect-quality-checks.cjs` — Optional helper for package.json parsing (can be inlined in stage-verify.md instead)

*If inlined: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Verification compares against full task context | TS-10 | Skill behavior | Create test task, run /do:continue, verify checklist matches Approach |
| Quality checks auto-detected from package.json | TS-10 | Project-specific scripts | Run on project with lint/test scripts, verify detection |
| UAT checklist generated based on implementation | TS-10 | Context-dependent output | Verify checklist items relate to actual changes |
| Handoff prompt generated at 80%+ context | TS-10 | Context state dependent | Hard to trigger programmatically |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
