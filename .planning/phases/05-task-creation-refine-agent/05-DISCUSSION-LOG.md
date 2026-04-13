# Phase 5: Task Creation & Refine Agent - Discussion Log

**Date:** 2026-04-13
**Mode:** discuss-phase (interactive)

## Gray Areas Selected

User selected all 4 areas for discussion:
1. Task markdown structure
2. Confidence calculation
3. Context loading strategy
4. Active task handling

---

## Task Markdown Structure

### Q1: How detailed should the problem statement be?
**Options:**
- Brief (2-3 sentences)
- Moderate (1 paragraph)
- Comprehensive (multiple paragraphs)

**Selected:** Comprehensive

**User notes:** "It should be comprehensive, we should have as little ambiguity as possible this is especially important if we have interrupted sessions or clear in between."

### Q2: What should the YAML frontmatter stages track?
**Options:**
- Linear stages
- Status + substage
- Timestamps per stage

**Selected:** Other (custom)

**User notes:** "It should depend on the task. Is it long, big and complex? We can have stages with sub-stages. For example: if we're building a big GDPR email documents feature I imagine the task is that, but we can split it in different 'waves' of implementation."

**Outcome:** Adaptive structure — simple tasks use linear stages, complex tasks use waves.

### Q3: How should the refine agent determine if waves are needed?
**Options:**
- Token estimate threshold
- File count heuristic
- Always ask user (Recommended)

**Selected:** Always ask user

---

## Confidence Calculation

### Q4: What should lower the confidence score?
**Options (multi-select):**
- Missing context (Recommended)
- Ambiguous scope
- Cross-cutting concerns
- No prior art

**Selected:** All four factors

### Q5: Should confidence factors be shown to the user?
**Options:**
- Show breakdown (Recommended)
- Show only score
- Show with recommendations

**Selected:** Show breakdown

---

## Context Loading Strategy

### Q6: What context should the refine agent ALWAYS load?
**Options (multi-select):**
- Database entry (project.md)
- Task description from user
- Recent git history
- Active file list

**Selected:** Database entry, Task description

**User notes:** "As little as possible to do the actual task. If the task requires, for example, changes to the DataGrid, it makes sense to load the internal docs on that subject. Whatever the task is ABOUT, if there's an internal doc on that (or shared docs) we should load that context. Context rot is a real thing, but not having enough context or the user having to repeat things to the agent is also not ideal."

**Outcome:** Targeted context loading — always load project.md + task description; keyword-match task terms to find relevant docs.

### Q7: How should the refine agent find task-relevant docs?
**Options:**
- Keyword matching (Recommended)
- Full index scan
- Ask user

**Selected:** Keyword matching

---

## Active Task Handling

### Q8: When user runs /do:task with an active task, what should happen?
**Options:**
- Block with status (Recommended)
- Prompt to switch
- Allow parallel

**Selected:** Block with status

### Q9: What should /do:abandon do with the abandoned task?
**Options:**
- Mark as abandoned, keep file
- Archive to .do/tasks/archive/
- Delete the file

**Selected:** Mark as abandoned, keep file

---

## Summary

Key decisions captured:
1. Comprehensive problem statements for session continuity
2. Adaptive stage structure (linear vs waves) based on task complexity
3. User always confirms wave breakdown for complex tasks
4. Multi-factor confidence with transparent breakdown
5. Targeted context loading via keyword matching
6. Block on active task with clear status and options
7. Abandoned tasks keep file with `stage: abandoned`

---

*Generated: 2026-04-13*
