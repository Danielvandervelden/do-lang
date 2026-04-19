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

Before running grill-me logic, execute Step R0 from resume-preamble.md.

@skills/do/references/resume-preamble.md

---

Run this flow when stage is `refinement` AND (confidence.score < auto_grill_threshold OR stages.grilling: in_progress).

### Step R0: Resume Check (per D-33, D-34, D-35)

Follow @skills/do/references/resume-preamble.md Steps R0.1-R0.5.

**For grill-me stage:**
- Last action = last Q&A pair from Clarifications section (if any)
- If no Clarifications, last action = "Grill-me not started"
- Skip R0.6 (mid-execution progress) - not applicable to grill stage

---

**Step G1: Enter grill-me flow (first time only)**

If `stages.grilling` is `pending`:
- Update task frontmatter: `stages.grilling: in_progress`
- Update `updated` timestamp
- Continue to Step G2

**Step G2: Identify all factors needing clarification (per D-13)**

Read `confidence.factors` from task frontmatter.
Find all factors with significant deductions (any negative value).
Use priority order for presentation: context > scope > complexity > familiarity.

**Step G3: Generate questions for all low factors (per D-14)**

For each factor with a deduction, generate a specific question. Use inline text prompt (NOT AskUserQuestion - documented bug).

| Factor | Question Pattern |
|--------|------------------|
| context | "What existing component/pattern should this use? Any specific files or docs I should reference?" |
| scope | "Which specific files/functions need modification? Are there any areas explicitly OUT of scope?" |
| complexity | "How do these systems interact? Any dependencies or edge cases I should know about?" |
| familiarity | "Has similar work been done before in this codebase? Any reference implementations to follow?" |

**Step G4: Present all questions at once and wait for combined answer**

Display all questions to user in a single numbered list:
```
Confidence: <score> (threshold: <threshold>)

Please answer each question by number.

1. [<factor> (<value>)] <question for factor 1>
2. [<factor> (<value>)] <question for factor 2>
...

Enter your answers (numbered to match), or type "Proceed anyway" to skip:
```

If user types "Proceed anyway" (case-insensitive):
- Add to Clarifications section: `User override at confidence <score>`
- Update task frontmatter:
  - `stages.grilling: complete`
  - `stages.refinement: complete`
- Update `updated` timestamp
- Display: "Proceeding with confidence <score>. Ready for implementation. Run /do:continue to start execution."
- Stop grill-me flow

**Step G5: Process all answers and update all factors (per D-16)**

For each Q&A pair independently, add to Clarifications section:

```markdown
### <Factor> (was: <old_value> -> now: <new_value>)
**Q:** <question asked>
**A:** <user's answer for this question>
```

Calculate confidence boost per Q&A pair independently based on answer specificity:
- Contains file path (e.g., `src/`, `.ts`, `.md`): +0.03
- Contains PascalCase component name: +0.02
- Contains specific term (src, lib, utils, hooks, components, api, endpoint): +0.02
- Base boost for any non-skip answer: +0.03
- Maximum boost per answer: 0.10

Apply boost to each factor independently. Update confidence.factors.<factor> with new value (old + boost, capped at 0.00).
After all factors are updated, recalculate confidence.score = 1.0 + sum(all factors).
Update `updated` timestamp to current ISO-8601.

**Step G6: Check threshold or ask follow-ups (per D-15)**

If confidence.score >= auto_grill_threshold:
- Update task frontmatter:
  - `stages.grilling: complete`
  - `stages.refinement: complete`
- Display:
  ```
  Confidence: <old_score> -> <new_score> (+<delta>)
  All factors improved.
  
  Confidence threshold met. Ready for implementation. Run /do:continue to start execution.
  ```
- Stop grill-me flow

Else:
- Display:
  ```
  Confidence: <old_score> -> <new_score> (+<delta>)
  Still below threshold. Generating follow-up questions.
  ```
- Return to Step G2 to identify remaining gaps and present all follow-up questions at once in the next round

### Files

- **Config:** `.do/config.json` - Read `auto_grill_threshold`
- **Task:** `.do/tasks/<active_task>` - Read/write frontmatter and Clarifications section
