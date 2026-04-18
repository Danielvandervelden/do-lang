---
name: stage-project-intake
description: "Project intake grilling flow for /do:project new. Implements §4 Pass 1 (vision/users/non-goals/success criteria/constraints/risks/integrations/non-functionals — 10 questions) and Pass 2 (phase seed list/dependencies/MVP marker — 3 questions). Writes Q&A to intake transcript. On threshold-met, spawns do-planner to curate project.md body sections."
---

# Project Intake Stage

This reference file is loaded by `skills/do/project.md` `new <slug>` after the project folder is scaffolded and `active_project` is set. It runs Passes 1 and 2 of the grilling flow (§4), saves the Q&A transcript, and on threshold-met routes to `stage-project-plan-review.md`.

**Caller contract:** The caller provides `<active_project>` slug and `<project_path>` = abs path to `project.md`. When this stage completes, `project.md` body sections (Vision, Target Users, Non-Goals, Success Criteria, Constraints, Risks, Phase Plan) are populated and `project.md` status transitions from `intake` → `planning`. Continue to `stage-project-plan-review.md`.

---

## PI-0: Read Config

```bash
node -e "
const c = require('./.do/config.json');
const threshold = c.project_intake_threshold || c.auto_grill_threshold || 0.85;
const models = c.models || { default: 'sonnet', overrides: {} };
console.log(JSON.stringify({ threshold, models }));
"
```

Store `threshold` and `models` for this stage.

---

## PI-1: Load Question Banks

### Pass 1 — Project Vision (10 questions)

Questions target the four confidence factors. Ask one at a time. Write each Q&A to disk immediately after the user responds.

| # | Factor | Question |
|---|--------|----------|
| 1 | context | "Describe the project in one paragraph: what it is, who it's for, and the core problem it solves." |
| 2 | context | "Who are the primary users? What's their technical level and how will they interact with the product?" |
| 3 | scope | "What is explicitly OUT of scope for this project? Name things you consciously will NOT build." |
| 4 | context | "What does success look like? List 3-5 measurable outcomes that define 'done' for the project." |
| 5 | scope | "What hard constraints exist? (Timeline, budget, tech stack, team size, backward-compatibility requirements.)" |
| 6 | complexity | "What are the top risks that could derail this project? How would you mitigate them?" |
| 7 | complexity | "What external systems, APIs, or services will this project integrate with?" |
| 8 | familiarity | "What non-functional requirements matter most? (Performance targets, security requirements, scalability needs, availability SLAs.)" |
| 9 | context | "Is there an existing codebase or greenfield? If existing, describe the tech stack and main architectural patterns." |
| 10 | scope | "Is there a 'minimum viable' milestone? What's the smallest thing you could ship that delivers real value?" |

### Pass 2 — Phase Seed (3 questions — always runs after Pass 1)

Pass 2 runs unconditionally after Pass 1 completes (see PI-4 / PI-5). The threshold in PI-4 gates nothing about Pass 2 execution — it only records whether Pass 1 ended satisfied or via override. Pass 2 questions:

| # | Factor | Question |
|---|--------|----------|
| 11 | scope | "How would you break this project into major phases? List them with a one-line goal for each." |
| 12 | complexity | "Are there dependencies between phases — does any phase require another to complete first?" |
| 13 | scope | "Which phase contains the MVP milestone you described? Mark it so we can prioritise it first." |

---

## PI-2: Run Pass 1 Grilling

Spawn `do-griller` with the Pass 1 question bank:

```javascript
Agent({
  description: "Project intake: Pass 1 grilling (vision + scope)",
  subagent_type: "do-griller",
  model: "<models.overrides.griller || models.default>",
  prompt: `
Run intake grilling for a new project. This is a structured intake, not
confidence-gap grilling — ask all questions in order, not just low-confidence ones.

Target file: <project_path>
Threshold: <threshold>

Pass 1 question bank (ask in order, one at a time):
1. Describe the project in one paragraph: what it is, who it's for, and the core problem it solves.
2. Who are the primary users? What's their technical level and how will they interact with the product?
3. What is explicitly OUT of scope for this project? Name things you consciously will NOT build.
4. What does success look like? List 3-5 measurable outcomes that define "done" for the project.
5. What hard constraints exist? (Timeline, budget, tech stack, team size, backward-compatibility requirements.)
6. What are the top risks that could derail this project? How would you mitigate them?
7. What external systems, APIs, or services will this project integrate with?
8. What non-functional requirements matter most? (Performance targets, security requirements, scalability needs, availability SLAs.)
9. Is there an existing codebase or greenfield? If existing, describe the tech stack and main architectural patterns.
10. Is there a "minimum viable" milestone? What's the smallest thing you could ship that delivers real value?

For each question:
1. Ask the question
2. Wait for user response
3. Log Q&A to the target file's Clarifications section
4. Update confidence score in frontmatter after each answer

Stop and return GRILLING_COMPLETE ONLY when confidence score in the target file's frontmatter is >= <threshold>, OR when all 10 questions have been asked, OR when the user types "proceed anyway". Do NOT stop while confidence is below <threshold> unless one of the other two stop conditions fires. Continue asking questions until one of those three conditions holds.
`
})
```

---

## PI-3: Save Pass 1 Transcript

After Pass 1 completes, write the Q&A transcript to disk:

```bash
# Create intake folder and session transcript
mkdir -p .do/projects/<active_project>/intake
TIMESTAMP=$(node -e "console.log(new Date().toISOString().replace(/[:.]/g,'-').slice(0,19))")
```

Write transcript file `.do/projects/<active_project>/intake/session-${TIMESTAMP}.md` with format from `@references/intake-transcript-template.md`, populating it with the Pass 1 Q&A pairs from `project.md`'s Clarifications section.

---

## PI-4: Check Pass 1 Threshold

```bash
node -e "
const fm = require('gray-matter');
const c = require('./.do/config.json');
const threshold = c.project_intake_threshold || c.auto_grill_threshold || 0.85;
const t = fm(require('fs').readFileSync('<project_path>', 'utf8'));
const score = t.data.confidence?.score;
console.log(JSON.stringify({ score, threshold, above: score >= threshold }));
"
```

**If score >= threshold:** Proceed to PI-5 (Pass 2).
**If score < threshold:** The griller stopped early (user override or context limit). Log override note to transcript. Proceed to PI-5 anyway — Pass 2 is always run.

---

## PI-5: Run Pass 2 Grilling (Phase Seed)

Spawn `do-griller` with the Pass 2 question bank:

```javascript
Agent({
  description: "Project intake: Pass 2 grilling (phase seed)",
  subagent_type: "do-griller",
  model: "<models.overrides.griller || models.default>",
  prompt: `
Continue project intake with phase-seed questions.

Target file: <project_path>
Threshold: <threshold>

Pass 2 question bank (ask in order):
1. How would you break this project into major phases? List them with a one-line goal for each.
2. Are there dependencies between phases — does any phase require another to complete first?
3. Which phase contains the MVP milestone? Mark it so we can prioritise it first.

For each question:
1. Ask the question
2. Wait for user response
3. Append Q&A to the target file's Clarifications section

After all 3 questions, return GRILLING_COMPLETE.
`
})
```

Append Pass 2 Q&A to the session transcript created in PI-3.

---

## PI-6: Curate project.md — Spawn do-planner

Spawn `do-planner` to curate `project.md`'s body sections from the intake transcript:

```javascript
Agent({
  description: "Curate project.md body from intake responses",
  subagent_type: "do-planner",
  model: "<models.overrides.planner || models.default>",
  prompt: `
Curate the project plan document from the intake Q&A captured in this target file.

Target file: <project_path>
Intake transcript: .do/projects/<active_project>/intake/session-<timestamp>.md

Read the Clarifications section of the target file (which contains the Pass 1 + Pass 2
intake Q&A). Synthesise the answers into the project.md body sections:

- ## Vision — one-paragraph vision statement synthesised from Q1 answer
- ## Target Users — user personas from Q2 answer
- ## Non-Goals — explicit out-of-scope list from Q3 answer
- ## Success Criteria — measurable outcomes from Q4 answer (numbered list)
- ## Constraints — hard constraints from Q5 answer
- ## Risks — risk list from Q6 answer in format: Risk / Likelihood / Impact / Mitigation
- ## Phase Plan — phase breakdown from Q11 answer (Pass 2 Q1), with MVP phase marked from Q13 answer

Do NOT overwrite the frontmatter. Use Edit tool to fill in each section's body.
Write the project title to frontmatter field \`title\` based on Q1 answer.
Calculate overall confidence after all answers and write to frontmatter.

Return summary of sections populated.
`
})
```

**Wait for `do-planner` to complete before proceeding.** The `Agent(...)` call is synchronous in the orchestrator — do NOT fire-and-forget. PI-7 (status advance) and PI-8 (handoff to plan review) both depend on `project.md`'s body sections being populated. Advancing to `planning` or handing off to `stage-project-plan-review.md` before the planner has curated the body would put the project into plan review with empty sections, causing the reviewer to reject on missing content.

---

## PI-6b: Verify Planner Output

After the PI-6 spawn returns, confirm the curated sections actually landed. This is a cheap sanity gate that catches silent-failure cases (planner returned summary but didn't Edit the file, or Edit partially failed):

```bash
node -e "
const fm = require('gray-matter'), fs = require('fs');
const doc = fm(fs.readFileSync('<project_path>', 'utf8'));
const required = ['## Vision', '## Target Users', '## Non-Goals', '## Success Criteria', '## Constraints', '## Risks', '## Phase Plan'];
const missing = required.filter(h => !doc.content.includes(h));
if (missing.length > 0) {
  console.error('Planner did not populate: ' + missing.join(', '));
  process.exit(1);
}
if (!doc.data.title) {
  console.error('Planner did not set frontmatter title');
  process.exit(1);
}
console.log('planner-output-ok');
"
```

If this check fails, stop and surface the missing sections to the user. Do NOT proceed to PI-7 — the project must not advance to `planning` with incomplete curation. The user can then: re-spawn the planner, fill sections manually, or abandon.

---

## PI-7: Advance project.md Status

Update `project.md` frontmatter:
```yaml
status: planning
updated: <ISO timestamp>
```

```bash
node ~/.claude/commands/do/scripts/project-state.cjs set project <active_project> status=planning
```

---

## PI-8: Return Control

Intake complete. Return control to caller — invoke `@references/stage-project-plan-review.md`.

Display:
```
Project intake complete.
Vision, users, non-goals, success criteria, constraints, risks, and phase plan captured.
Proceeding to project plan review.
```
