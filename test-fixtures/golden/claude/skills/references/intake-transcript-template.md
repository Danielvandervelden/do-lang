# Intake Transcript — {{PROJECT_SLUG}}

**Session:** {{TIMESTAMP}}
**Pass:** {{PASS_NUMBER}} (Pass 1 = Vision, Pass 2 = Confidence)

---

## Pass 1 — Vision Questions

### Q1: Product Vision
**Q:** In one sentence, what is this project at its core?
**A:** {{VISION_ANSWER}}

### Q2: Primary User / Customer
**Q:** Who is the primary beneficiary of this project? (Persona, role, technical level)
**A:** {{USER_ANSWER}}

### Q3: Core Problem
**Q:** What specific problem does this solve, and why is it painful today?
**A:** {{PROBLEM_ANSWER}}

### Q4: Success Metric
**Q:** How will you know the project succeeded? Give one measurable outcome.
**A:** {{SUCCESS_METRIC_ANSWER}}

### Q5: Non-Goals
**Q:** What is explicitly out of scope for v1? Name at least two things.
**A:** {{NON_GOALS_ANSWER}}

### Q6: Constraints
**Q:** What hard constraints exist? (Timeline, budget, team, tech stack, compatibility)
**A:** {{CONSTRAINTS_ANSWER}}

### Q7: Tech Stack
**Q:** What is the intended tech stack? (Language, framework, infrastructure)
**A:** {{TECH_STACK_ANSWER}}

### Q8: Repo / Codebase
**Q:** Is there an existing codebase? If so, what is its repo path?
**A:** {{REPO_ANSWER}}

### Q9: Top Risk
**Q:** What is the single biggest risk to this project? How would you mitigate it?
**A:** {{RISK_ANSWER}}

### Q10: Phase Count Estimate
**Q:** How many phases do you estimate this project will need? (rough order of magnitude)
**A:** {{PHASE_COUNT_ANSWER}}

---

## Pass 2 — Confidence Assessment

Confidence factors are assessed on a 0..1 scale after Pass 1 questions are answered.

| Factor | Score | Notes |
|--------|-------|-------|
| Context | {{CONTEXT_SCORE}} | How well the project context is understood |
| Scope | {{SCOPE_SCORE}} | How clearly the scope is defined |
| Complexity | {{COMPLEXITY_SCORE}} | How well the technical complexity is understood |
| Familiarity | {{FAMILIARITY_SCORE}} | How familiar the team is with the tech stack |

**Overall Confidence:** {{OVERALL_CONFIDENCE}}
**Threshold:** `project_intake_threshold` from `.do/config.json` (default: 0.85)

{{#if BELOW_THRESHOLD}}
### Pass 2 — Clarifying Questions

Confidence is below threshold. Asking targeted follow-up questions to address gaps.

**Gap identified:** {{GAP_DESCRIPTION}}
**Q:** {{CLARIFYING_QUESTION}}
**A:** {{CLARIFYING_ANSWER}}
{{/if}}

---

## Free-Form Notes

{{FREE_FORM_NOTES}}

<!--
Any additional context captured during the intake session that did not fit the
structured format above. Decisions made, alternatives considered, references consulted.
-->
