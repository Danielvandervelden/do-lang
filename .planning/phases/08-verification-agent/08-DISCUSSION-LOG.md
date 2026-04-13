# Phase 8: Verification Agent - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-13
**Phase:** 08-verification-agent
**Areas discussed:** Verification scope, Quality checks, Issue handling, Completion flow

---

## Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Verification scope | What does 'matches requirements' check? Plan adherence, file completeness, concern resolution? | ✓ |
| Quality checks | Which checks run (lint/types/tests)? How to detect what's applicable? Block or document failures? | ✓ |
| Issue handling | What counts as issue vs warning? Auto-fix? Loop back to execution or mark incomplete? | ✓ |
| Completion flow | What happens after pass? Final stage name, clear active_task, next steps? | ✓ |

**User's choice:** All four areas

---

## Verification Scope

### Q1: What should verification compare against?

| Option | Description | Selected |
|--------|-------------|----------|
| Approach section only | Check that each step in Approach was completed. Simple, clear pass/fail. | |
| Approach + Concerns | Verify steps done AND that identified Concerns were addressed or mitigated. | |
| Full task context | Compare against Problem Statement, Approach, Concerns, and Clarifications. Most thorough. | ✓ |

**User's choice:** Full task context

### Q2: How detailed should the comparison be?

| Option | Description | Selected |
|--------|-------------|----------|
| Checklist style | Parse Approach into steps, mark each done/not done. Clear audit trail. | ✓ |
| Narrative review | Read task context holistically, write summary of what was achieved vs expected. | |
| You decide | Claude determines appropriate level based on task complexity. | |

**User's choice:** Checklist style

---

## Quality Checks

### Q3: How should we determine which quality checks to run?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-detect from package.json | Check scripts for lint/typecheck/test commands. Run what exists. | ✓ |
| Project config | Add quality_checks field to .do/config.json specifying which to run. | |
| Always ask | Prompt user each time: 'Run lint? Run types? Run tests?' | |

**User's choice:** Auto-detect from package.json

### Q4: What happens when a quality check fails?

| Option | Description | Selected |
|--------|-------------|----------|
| Block completion | Task cannot be marked complete until all checks pass. User must fix. | ✓ |
| Document and continue | Record failures in verification results but mark task complete anyway. | |
| Ask per failure | For each failure, ask user: fix now, skip, or mark task incomplete. | |

**User's choice:** Block completion
**Notes:** User specified: "We have to block completion. You should then ask the user if you need to spawn a new /do:task to fix the failing quality check or if the user wants to do it themselves"

---

## Issue Handling

### Q5: How should verification report its findings?

| Option | Description | Selected |
|--------|-------------|----------|
| Pass/Fail only | Binary result. Either everything checks out or it doesn't. | ✓ |
| Pass/Warn/Fail | Three levels: Pass (all good), Warn (minor issues, can proceed), Fail (must fix). | |
| Scored rubric | Score each area (approach 90%, concerns 75%, quality 100%). Threshold for pass. | |

**User's choice:** Pass/Fail only

---

## Completion Flow

### Q6: What should the final task state be after passing verification?

| Option | Description | Selected |
|--------|-------------|----------|
| stage: complete | Add 'complete' as final stage. Clear active_task from config. | |
| stage: verified | Keep 'verified' as distinct from 'complete'. Clear active_task. | |
| Keep verification | Stay at stage: verification with stages.verification: complete. Don't clear active_task. | |

**User's choice:** Other (custom)
**Notes:** "If everything passes then it should be stage:verified and then give the user a summary of what was done and ask for approval to put it to completed. We'll need UAT to check whether all is properly implemented or not."

### Q7: How should the UAT approval work?

| Option | Description | Selected |
|--------|-------------|----------|
| Simple confirm | Ask 'Mark task complete?' Yes clears active_task, No keeps verified status. | |
| Checklist prompt | Show key items to manually verify, then ask for approval. | ✓ |
| Defer to user | End at 'verified' status. User runs /do:complete when ready. | |

**User's choice:** Checklist prompt

### Q8: What if user says UAT failed?

| Option | Description | Selected |
|--------|-------------|----------|
| Loop to execution | Transition back to execution stage to fix. Same task continues. | |
| New task | Offer to spawn new /do:task for the fix. Original task stays verified. | |
| Ask each time | Present both options and let user choose. | |

**User's choice:** Other (custom)
**Notes:** "It depends, if context is getting full (>80%) we should make sure to document everything up until now in the task documentation, then give the user a ready prompt to paste into the AI after clearing stating database folder, github projects folder, quick task ID/location/context and that it should start a /do:task"

### Q9: Where does the UAT checklist come from?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-generate from Approach | Parse Approach section into user-verifiable items. | |
| User defines during refinement | Add UAT section to task template. Refine agent prompts user. | |
| Claude generates at verification | Based on what was done, Claude creates relevant UAT checklist. | ✓ |

**User's choice:** Claude generates at verification

---

## Claude's Discretion

- Exact quality check script detection logic
- Format and content of UAT checklist items
- How to detect context usage percentage
- Whether to loop back or spawn new task when context OK but UAT fails

## Deferred Ideas

- Task history/archive — Move completed tasks to `.do/archive/`
- Verification metrics — Track pass/fail rates
- Auto-retry on flaky tests
