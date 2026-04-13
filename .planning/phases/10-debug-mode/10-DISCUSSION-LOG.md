# Phase 10: Debug Mode - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-13
**Phase:** 10-debug-mode
**Areas discussed:** Session Structure, Scientific Method Flow, Session Lifecycle, Task Integration

---

## Session Structure

| Option | Description | Selected |
|--------|-------------|----------|
| One file per session | YYMMDD-<slug>.md in .do/debug/ — mirrors task pattern, easy to track multiple sessions | ✓ |
| Single active file | .do/debug/ACTIVE.md — simpler, one debug at a time, archive on completion | |
| Nested by date | .do/debug/2026-04/session-name.md — organized by month | |

**User's choice:** One file per session (Recommended)
**Notes:** Mirrors the established task pattern from Phase 5

---

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal | status, created, hypothesis_count — lean tracking, body has the detail | |
| Task-like stages | stage enum (investigating/testing/resolved), mirrors task workflow | |
| Rich state | status + current_hypothesis + test_results array + linked_files — full machine-parseable state | ✓ |

**User's choice:** Rich state
**Notes:** Full machine-parseable state enables robust resume after /clear

---

## Scientific Method Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Iterative loop | One hypothesis at a time: form → test → confirm/reject → repeat or conclude | |
| Parallel hypotheses | Form multiple hypotheses upfront, test each, rank by likelihood | |
| Tree exploration | Hypotheses branch — rejected hypotheses can spawn sub-hypotheses | |

**User's choice:** Other — "combination of 1 and 3"
**Notes:** User asked about GSD's debug pattern. After reviewing GSD's DEBUG.md template, discovered it's iterative with elimination tracking — one hypothesis at a time, but Eliminated section prevents re-exploring dead ends. User approved adopting this pattern.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, adopt GSD pattern | Same section structure: Current Focus (overwrite) + Eliminated/Evidence (append) + Resolution. Proven to work. | ✓ |
| Simplify it | Fewer sections — just hypotheses list and resolution. Less structure, faster to write. | |
| Adapt with changes | Use GSD pattern but modify something specific | |

**User's choice:** Yes, adopt GSD pattern (Recommended)
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| User confirms fix | After self-verification, prompt user to confirm fix works. Only then mark resolved. | ✓ |
| Self-verification only | Claude verifies fix and marks resolved automatically | |
| Manual close | User explicitly runs /do:debug --close to mark resolved | |

**User's choice:** User confirms fix (Recommended)
**Notes:** Matches GSD's awaiting_human_verify stage

---

## Session Lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| One active at a time | Mirrors /do:task pattern — focus on one bug. Others stay in .do/debug/ but need explicit switch. | ✓ |
| Multiple allowed | Can juggle several bugs at once. More flexible, more complex tracking. | |
| Unlimited but warn | Allow multiple, but show warning when starting 2nd+ session | |

**User's choice:** One active at a time (Recommended)
**Notes:** Consistency with /do:task constraint

---

| Option | Description | Selected |
|--------|-------------|----------|
| Block with status | Show current session status + options: continue it, close it (mark abandoned), or force new. | ✓ |
| Auto-continue | Automatically resume the active session instead of starting new | |
| Ask which | List all sessions in .do/debug/, let user pick which to work on | |

**User's choice:** Block with status (Recommended)
**Notes:** Matches /do:task pattern from D-11

---

| Option | Description | Selected |
|--------|-------------|----------|
| Show resume summary | Display current hypothesis + last evidence + next_action from debug file, then ask to continue. | ✓ |
| Silent resume | Just pick up from Current Focus without preamble | |
| Full context reload | Re-display entire Eliminated and Evidence sections before continuing | |

**User's choice:** Show resume summary (Recommended)
**Notes:** Matches Phase 9 pattern (D-35)

---

## Task Integration

| Option | Description | Selected |
|--------|-------------|----------|
| Optional link field | Debug frontmatter has optional task_ref field. If set, findings can be copied to task context. | ✓ |
| Always independent | Debug is completely separate from tasks | |
| Auto-link if task active | If /do:task is active when /do:debug starts, automatically link them | |

**User's choice:** Optional link field (Recommended)
**Notes:** Independent by default, linking is explicit choice

---

| Option | Description | Selected |
|--------|-------------|----------|
| Offer to append findings | After debug resolves, ask: 'Copy root cause + fix to task context?' User decides. | ✓ |
| Auto-append | Automatically add debug findings to linked task's context section | |
| Link only, no sync | The link is just a reference — user manually reads debug file | |

**User's choice:** Offer to append findings (Recommended)
**Notes:** Preserves task document as source of truth

---

## Claude's Discretion

- Debug slug generation from trigger text
- Exact wording of symptom gathering questions
- How to format resume summary (which evidence entries to show)
- Whether to suggest likely hypotheses based on symptoms

## Deferred Ideas

None — discussion stayed within phase scope
