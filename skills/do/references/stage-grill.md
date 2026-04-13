---
name: stage-grill
description: Grill-me flow for confidence improvement. Loaded when stage is refinement and confidence < threshold.
---

# Grill-Me Stage

This reference file is loaded by /do:continue when the task needs confidence improvement.

**Prerequisites:**
- Active task exists in `.do/tasks/`
- Task stage is `refinement`
- Task confidence.score < auto_grill_threshold from config

---

Run this flow when stage is `refinement` AND (confidence.score < auto_grill_threshold OR stages.grilling: in_progress).

**Step G0: Enter grill-me flow (first time only)**

If `stages.grilling` is `pending`:
- Update task frontmatter: `stages.grilling: in_progress`
- Update `updated` timestamp
- Continue to Step G1

**Step G1: Identify weakest factor (per D-13)**

Read `confidence.factors` from task frontmatter.
Find factor with largest deduction (most negative value).
If multiple tied, use priority order: context > scope > complexity > familiarity.

**Step G2: Generate targeted question (per D-14)**

Based on the weakest factor, generate a specific question. Use inline text prompt (NOT AskUserQuestion - documented bug).

| Factor | Question Pattern |
|--------|------------------|
| context | "What existing component/pattern should this use? Any specific files or docs I should reference?" |
| scope | "Which specific files/functions need modification? Are there any areas explicitly OUT of scope?" |
| complexity | "How do these systems interact? Any dependencies or edge cases I should know about?" |
| familiarity | "Has similar work been done before in this codebase? Any reference implementations to follow?" |

Display to user:
```
Confidence: <score> (threshold: <threshold>)
Weakest factor: <factor> (<value>)

<targeted question>

Enter your answer, or type "Proceed anyway" to skip remaining questions:
```

**Step G3: Process user response (per D-15)**

If user types "Proceed anyway" (case-insensitive):
- Add to Clarifications section: `User override at confidence <score>`
- Update task frontmatter:
  - `stages.grilling: complete`
  - `stages.refinement: complete`
- Update `updated` timestamp
- Display: "Proceeding with confidence <score>. Ready for implementation. (Phase 7 - not yet implemented)"
- Stop grill-me flow

Otherwise, process the answer.

**Step G4: Update task markdown (per D-16)**

Add to Clarifications section:

```markdown
### <Factor> (was: <old_value> -> now: <new_value>)
**Q:** <question asked>
**A:** <user's answer>
```

Calculate confidence boost based on answer specificity:
- Contains file path (e.g., `src/`, `.ts`, `.md`): +0.03
- Contains PascalCase component name: +0.02
- Contains specific term (src, lib, utils, hooks, components, api, endpoint): +0.02
- Base boost for any non-skip answer: +0.03
- Maximum boost per answer: 0.10

Update confidence.factors.<factor> with new value (old + boost, capped at 0.00).
Recalculate confidence.score = 1.0 + sum(all factors).
Update `updated` timestamp to current ISO-8601.

**Step G5: Check threshold or loop (per D-15)**

If confidence.score >= auto_grill_threshold:
- Update task frontmatter:
  - `stages.grilling: complete`
  - `stages.refinement: complete`
- Display:
  ```
  Confidence: <old_score> -> <new_score> (+<delta>)
  <factor> improved.
  
  Confidence threshold met. Ready for implementation. (Phase 7 - not yet implemented)
  ```
- Stop grill-me flow

Else:
- Display:
  ```
  Confidence: <old_score> -> <new_score> (+<delta>)
  <factor> improved. Next weakest: <next_factor>
  ```
- Return to Step G1 with the next weakest factor

### Files

- **Config:** `.do/config.json` - Read `auto_grill_threshold`
- **Task:** `.do/tasks/<active_task>` - Read/write frontmatter and Clarifications section
