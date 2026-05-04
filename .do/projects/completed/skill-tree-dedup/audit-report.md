# Skill Tree Deduplication Audit Report

_Generated: 2026-05-04T14:35:39.113Z_

This report compares all file pairs across `skills/do/`, `skills/codex/`, and `agents/`.
Each pair is classified as **identical**, **divergent**, **unpaired (do-only)**, or **unpaired (codex-only)**.
Divergent pairs include a diff summary and divergence category tags.

## Out-of-Scope Directories

The following subdirectories are excluded from file pairing by design:

| Directory | Reason |
|-----------|--------|
| `skills/do/references/` | Handled separately in the References group below |
| `skills/do/scripts/` | `skills/do/scripts/` has no codex counterpart by design — `install.cjs` handles codex script copying separately |

---

## Group 1: References

_Comparing `skills/do/references/*.md` vs `skills/codex/references/*.md`. Pairs matched by filename._

| File Pair | Classification | Categories | Divergent Lines Summary |
|-----------|---------------|------------|------------------------|
| agents-template.md | identical | - | - |
| backlog-seed.md | identical | - | - |
| changelog-template.md | identical | - | - |
| classify-findings.md | divergent | path substitution, agent name prefix | `- - Installed: `~/.claude/commands/do/scripts/council-invok...`, `+ - Installed: `~/.codex/skills/do/scripts/council-invoke.cjs``, `- 4. Run `parseCouncilRunnerOutput()` on the council agent'...`, `+ 4. Run `parseCouncilRunnerOutput()` on the council agent'...` |
| completion-summary-template.md | identical | - | - |
| component-readme.md | identical | - | - |
| config-template.md | identical | - | - |
| council-brief-code.md | identical | - | - |
| council-brief-plan.md | identical | - | - |
| debug-template.md | identical | - | - |
| delivery-contract.md | identical | - | - |
| delivery-onboarding.md | identical | - | - |
| features-readme.md | identical | - | - |
| handoff-template.md | identical | - | - |
| init-health-check.md | divergent | path substitution | `- node ~/.claude/commands/do/scripts/workspace-health.cjs <...`, `+ node ~/.codex/skills/do/scripts/workspace-health.cjs <wor...`, `- node ~/.claude/commands/do/scripts/project-health.cjs .`, `+ node ~/.codex/skills/do/scripts/project-health.cjs .`, `- node ~/.claude/commands/do/scripts/detect-tools.cjs`, `+ node ~/.codex/skills/do/scripts/detect-tools.cjs` |
| init-project-setup.md | identical | - | - |
| init-workspace-setup.md | divergent | path substitution | `- node ~/.claude/commands/do/scripts/detect-tools.cjs`, `+ node ~/.codex/skills/do/scripts/detect-tools.cjs` |
| intake-transcript-template.md | identical | - | - |
| phase-template.md | divergent | agent name prefix | `- Populated by do-griller during per-phase re-grill when co...`, `+ Populated by codex-griller during per-phase re-grill when...`, `- Populated by do-plan-reviewer and do-council-reviewer dur...`, `+ Populated by codex-plan-reviewer and codex-council-review...` |
| pointer-templates.md | identical | - | - |
| project-master-template.md | divergent | agent name prefix | `- Populated by do-griller during intake (Pass 1 + Pass 2 Q&...`, `+ Populated by codex-griller during intake (Pass 1 + Pass 2...` |
| project-state-machine.md | identical | - | - |
| project-template.md | identical | - | - |
| resume-preamble-project.md | divergent | agent name prefix | `- The `modified_files[]` frontmatter array is authoritative...`, `+ The `modified_files[]` frontmatter array is authoritative...` |
| resume-preamble.md | divergent | path substitution | `- node ~/.claude/commands/do/scripts/load-task-context.cjs ...`, `+ node ~/.codex/skills/do/scripts/load-task-context.cjs "<t...` |
| stage-code-review.md | divergent | agent name prefix, path substitution, Agent() vs prose spawn, prose wording | `- description: Orchestrator code review block. Council gate...`, `+ description: Orchestrator code review block. Council gate...`, `- **Caller contract:** When this stage returns VERIFIED, th...`, `+ **Caller contract:** When this stage returns VERIFIED, th...`, `- node ~/.claude/commands/do/scripts/update-task-frontmatte...`, `+ node ~/.codex/skills/do/scripts/update-task-frontmatter.c...` _(+268 more changed lines)_ |
| stage-debug.md | identical | - | - |
| stage-execute.md | divergent | path substitution, agent name prefix | `- node ~/.claude/commands/do/scripts/update-task-frontmatte...`, `+ node ~/.codex/skills/do/scripts/update-task-frontmatter.c...`, `- node ~/.claude/commands/do/scripts/council-invoke.cjs \`, `+ node ~/.codex/skills/do/scripts/council-invoke.cjs \`, `- > **Note:** This step is an inline code review path. In t...`, `+ > **Note:** This step is an inline code review path. In t...` _(+4 more changed lines)_ |
| stage-fast-exec.md | divergent | agent name prefix, path substitution, Agent() vs prose spawn, prose wording | `- description: Fast-path execution block. Task-file creatio...`, `+ description: Fast-path execution block. Task-file creatio...`, `- **Critical: Write a minimal Approach section (2-4 numbere...`, `+ **Critical: Write a minimal Approach section (2-4 numbere...`, `- node ~/.claude/commands/do/scripts/load-task-context.cjs ...`, `+ node ~/.codex/skills/do/scripts/load-task-context.cjs "<d...` _(+243 more changed lines)_ |
| stage-grill.md | identical | - | - |
| stage-phase-exit.md | divergent | path substitution, agent name prefix | `- This reference file is invoked by `skills/do/project.md` ...`, `+ This reference file is invoked by `skills/codex/project.m...`, `- const fmRead = (f) => JSON.parse(execSync('node ~/.claude...`, `+ const fmRead = (f) => JSON.parse(execSync('node ~/.codex/...`, `- - One line from `wave_summary` frontmatter field (written...`, `+ - One line from `wave_summary` frontmatter field (written...` _(+4 more changed lines)_ |
| stage-phase-plan-review.md | divergent | agent name prefix, path substitution, Agent() vs prose spawn, prose wording | `- description: "Phase plan review block for /do:project. Co...`, `+ description: "Phase plan review block for /do:project. Co...`, `- This reference file is loaded by `skills/do/project.md` w...`, `+ This reference file is loaded by `skills/codex/project.md...`, `- node ~/.claude/commands/do/scripts/update-task-frontmatte...`, `+ node ~/.codex/skills/do/scripts/update-task-frontmatter.c...` _(+387 more changed lines)_ |
| stage-phase-transition.md | divergent | path substitution, agent name prefix, Agent() vs prose spawn, prose wording | `- node ~/.claude/commands/do/scripts/project-state.cjs chec...`, `+ node ~/.codex/skills/do/scripts/project-state.cjs check n...`, `- Read the next phase's `phase.md` confidence score. If bel...`, `+ Read the next phase's `phase.md` confidence score. If bel...`, `- ```javascript`, `+ Spawn the codex-griller subagent with model `<models.over...` _(+26 more changed lines)_ |
| stage-plan-review.md | divergent | agent name prefix, path substitution, Agent() vs prose spawn, prose wording | `- description: Orchestrator plan review block. Council gate...`, `+ description: Orchestrator plan review block. Council gate...`, `- node ~/.claude/commands/do/scripts/update-task-frontmatte...`, `+ node ~/.codex/skills/do/scripts/update-task-frontmatter.c...`, `- node ~/.claude/commands/do/scripts/council-gate.cjs planning`, `+ node ~/.codex/skills/do/scripts/council-gate.cjs planning` _(+328 more changed lines)_ |
| stage-project-complete.md | divergent | path substitution | `- This reference file is loaded by `skills/do/project.md` `...`, `+ This reference file is loaded by `skills/codex/project.md...`, `- node ~/.claude/commands/do/scripts/project-state.cjs stat...`, `+ node ~/.codex/skills/do/scripts/project-state.cjs status ...`, `- const fmRead = (f) => JSON.parse(execSync('node ~/.claude...`, `+ const fmRead = (f) => JSON.parse(execSync('node ~/.codex/...` _(+8 more changed lines)_ |
| stage-project-intake.md | divergent | agent name prefix, path substitution, Agent() vs prose spawn, prose wording | `- description: "Project intake grilling flow for /do:projec...`, `+ description: "Project intake grilling flow for /do:projec...`, `- This reference file is loaded by `skills/do/project.md` `...`, `+ This reference file is loaded by `skills/codex/project.md...`, `- Spawn `do-griller` with the Pass 1 question bank:`, `+ Spawn the codex-griller subagent with model `<models.over...` _(+355 more changed lines)_ |
| stage-project-plan-review.md | divergent | agent name prefix, path substitution, Agent() vs prose spawn, prose wording | `- description: "Project plan review block for /do:project. ...`, `+ description: "Project plan review block for /do:project. ...`, `- This reference file is loaded by `skills/do/project.md` a...`, `+ This reference file is loaded by `skills/codex/project.md...`, `- node ~/.claude/commands/do/scripts/update-task-frontmatte...`, `+ node ~/.codex/skills/do/scripts/update-task-frontmatter.c...` _(+262 more changed lines)_ |
| stage-project-resume.md | divergent | path substitution | `- This reference file is loaded by `skills/do/project.md` `...`, `+ This reference file is loaded by `skills/codex/project.md...`, `- node ~/.claude/commands/do/scripts/project-resume.cjs`, `+ node ~/.codex/skills/do/scripts/project-resume.cjs`, `- PROJ_DATA=$(node ~/.claude/commands/do/scripts/update-tas...`, `+ PROJ_DATA=$(node ~/.codex/skills/do/scripts/update-task-f...` _(+2 more changed lines)_ |
| stage-quick-exec.md | divergent | agent name prefix, Agent() vs prose spawn, prose wording | `- **Orchestrator makes the change directly** using Read/Edi...`, `+ **Orchestrator makes the change directly** using Read/Edi...`, `- Invoke `do-council-reviewer` with `--type code` pointing ...`, `+ Invoke `codex-council-reviewer` with `--type code` pointi...`, `- ```javascript`, `+ Spawn the codex-council-reviewer subagent with model `<mo...` _(+298 more changed lines)_ |
| stage-verify.md | identical | - | - |
| stage-wave-code-review.md | divergent | agent name prefix, path substitution, Agent() vs prose spawn, prose wording | `- description: "Wave code review block for /do:project. Cou...`, `+ description: "Wave code review block for /do:project. Cou...`, `- This reference file is loaded by `skills/do/project.md` `...`, `+ This reference file is loaded by `skills/codex/project.md...`, `- node ~/.claude/commands/do/scripts/update-task-frontmatte...`, `+ node ~/.codex/skills/do/scripts/update-task-frontmatter.c...` _(+207 more changed lines)_ |
| stage-wave-exec.md | divergent | agent name prefix, path substitution, Agent() vs prose spawn, prose wording | `- description: "Wave execution block for /do:project. Spawn...`, `+ description: "Wave execution block for /do:project. Spawn...`, `- This reference file is loaded by `skills/do/project.md` `...`, `+ This reference file is loaded by `skills/codex/project.md...`, `- node ~/.claude/commands/do/scripts/update-task-frontmatte...`, `+ node ~/.codex/skills/do/scripts/update-task-frontmatter.c...` _(+94 more changed lines)_ |
| stage-wave-plan-review.md | divergent | agent name prefix, path substitution, Agent() vs prose spawn, prose wording | `- description: "Wave plan review block for /do:project. Cou...`, `+ description: "Wave plan review block for /do:project. Cou...`, `- This reference file is loaded by `skills/do/project.md` `...`, `+ This reference file is loaded by `skills/codex/project.md...`, `- node ~/.claude/commands/do/scripts/update-task-frontmatte...`, `+ node ~/.codex/skills/do/scripts/update-task-frontmatter.c...` _(+287 more changed lines)_ |
| stage-wave-verify.md | divergent | agent name prefix, path substitution, Agent() vs prose spawn, prose wording | `- description: "Wave verification block for /do:project. Sp...`, `+ description: "Wave verification block for /do:project. Sp...`, `- This reference file is loaded by `skills/do/project.md` `...`, `+ This reference file is loaded by `skills/do/project.md` `...`, `- node ~/.claude/commands/do/scripts/update-task-frontmatte...`, `+ node ~/.codex/skills/do/scripts/update-task-frontmatter.c...` _(+158 more changed lines)_ |
| task-template.md | divergent | agent name prefix | `- # no plan review, no do-verifier).`, `+ # no plan review, no codex-verifier).`, `- # (council + do-code-reviewer in parallel) rather than th...`, `+ # (council + codex-code-reviewer in parallel) rather than...` |
| tech-readme.md | identical | - | - |
| wave-template.md | divergent | agent name prefix | `- Populated during implementation (do-executioner writes he...`, `+ Populated during implementation (codex-executioner writes...`, `- Populated during verification (do-verifier writes here).`, `+ Populated during verification (codex-verifier writes here).`, `- Populated by do-griller during per-wave confidence rescue...`, `+ Populated by codex-griller during per-wave confidence res...` _(+2 more changed lines)_ |

### References Summary

- **Total pairs:** 47 (matches expected 47)
- **Identical:** 22 (matches expected 22)
- **Divergent:** 25 (matches expected 25)
- **Unpaired:** none

---

## Group 2: Skills

_Comparing root-level `skills/do/*.md` vs `skills/codex/*.md`. Subdirectories (`references/`, `scripts/`, `__tests__/`) are excluded. Pairs matched by filename._

| File Pair | Classification | Categories | Divergent Lines Summary |
|-----------|---------------|------------|------------------------|
| abandon.md | divergent | path substitution | `- node ~/.claude/commands/do/scripts/task-abandon.cjs check...`, `+ node ~/.codex/skills/do/scripts/task-abandon.cjs check --...`, `- node ~/.claude/commands/do/scripts/task-abandon.cjs aband...`, `+ node ~/.codex/skills/do/scripts/task-abandon.cjs abandon ...` |
| backlog.md | divergent | agent name prefix, prose wording | `- - Agent`, `+ ---`, `- ---`, `+ # /do:backlog`, `- # /do:backlog`, `+ Manage the backlog for this do-lang project. Four sub-com...` _(+401 more changed lines)_ |
| continue.md | divergent | path substitution, agent name prefix, Agent() vs prose spawn, prose wording | `- - Agent`, `+ - AskUserQuestion`, `- - AskUserQuestion`, `+ ---`, `- ---`, `+ # /do:continue` _(+338 more changed lines)_ |
| debug.md | divergent | agent name prefix, path substitution, Agent() vs prose spawn, prose wording | `- description: "Systematic bug investigation using do-debug...`, `+ description: "Systematic bug investigation using codex-de...`, `- - Agent`, `+ - AskUserQuestion`, `- - AskUserQuestion`, `+ ---` _(+193 more changed lines)_ |
| do.md | divergent | agent name prefix, path substitution, prose wording | `- description: "Token-efficient task execution for Claude C...`, `+ description: "Token-efficient task execution for Codex. U...`, `- - "check best practices for this agent" → `/do:optimise a...`, `+ - "check best practices for this agent" → `/do:optimise a...`, `- - "are there improvements for this skill?" → `/do:optimis...`, `+ - "are there improvements for this skill?" → `/do:optimis...` _(+4 more changed lines)_ |
| fast.md | divergent | path substitution, agent name prefix, prose wording | `- - Agent`, `+ - AskUserQuestion`, `- - AskUserQuestion`, `+ ---`, `- ---`, `+ # /do:fast` _(+173 more changed lines)_ |
| init.md | identical | - | - |
| optimise.md | divergent | agent name prefix, path substitution | `- - `/do:optimise agents/do-verifier.md` — audit a single a...`, `+ - `/do:optimise agents/codex-verifier.md` — audit a singl...`, `- - `/do:optimise skills/do/scan.md --effort high` — deep a...`, `+ - `/do:optimise skills/codex/scan.md --effort high` — dee...`, `- node ~/.claude/commands/do/scripts/optimise-target.cjs "<...`, `+ node ~/.codex/skills/do/scripts/optimise-target.cjs "<tar...` _(+6 more changed lines)_ |
| project.md | divergent | path substitution, agent name prefix, Agent() vs prose spawn, prose wording | `- description: "Multi-phase project orchestration for Claud...`, `+ description: "Multi-phase project orchestration for Codex...`, `- - Agent`, `+ - AskUserQuestion`, `- - AskUserQuestion`, `+ ---` _(+457 more changed lines)_ |
| quick.md | divergent | path substitution, prose wording | `- - Agent`, `+ - AskUserQuestion`, `- - AskUserQuestion`, `+ ---`, `- ---`, `+ # /do:quick` _(+131 more changed lines)_ |
| scan.md | divergent | path substitution | `- node ~/.claude/commands/do/scripts/scan-project.cjs <proj...`, `+ node ~/.codex/skills/do/scripts/scan-project.cjs <project...` |
| task.md | divergent | agent name prefix, path substitution, Agent() vs prose spawn, prose wording | `- description: "Start a new piece of work with agent-based ...`, `+ description: "Start a new piece of work with agent-based ...`, `- - Agent`, `+ - AskUserQuestion`, `- - AskUserQuestion`, `+ ---` _(+568 more changed lines)_ |
| update.md | divergent | path substitution | `- Updating via `npm install -g` (not `npm update -g`) is re...`, `+ Updating via `npm install -g` (not `npm update -g`) is re...`, `- do commands installed to /Users/<user>/.claude/commands/do`, `+ do skills installed to /Users/<user>/.codex/skills/do`, `- do agents installed to /Users/<user>/.claude/agents`, `+ do agents installed to /Users/<user>/.codex/agents` _(+10 more changed lines)_ |

### Skills Summary

- **Total pairs:** 13 (matches expected 13)
- **Identical:** 1 (matches expected 1)
- **Divergent:** 12 (matches expected 12)
- **Unpaired:** none

---

## Group 3: Agents

_Comparing `agents/do-*.md` vs `agents/codex-*.md`. Pairs matched by base name after stripping the `do-`/`codex-` prefix._

| File Pair | Classification | Categories | Divergent Lines Summary |
|-----------|---------------|------------|------------------------|
| do-code-reviewer.md / codex-code-reviewer.md | divergent | agent name prefix | `- name: do-code-reviewer`, `+ name: codex-code-reviewer` |
| do-council-reviewer.md / codex-council-reviewer.md | divergent | agent name prefix, path substitution | `- name: do-council-reviewer`, `+ name: codex-council-reviewer`, `- SCRIPT="${HOME}/.claude/commands/do/scripts/council-invok...`, `+ SCRIPT="${HOME}/.codex/skills/do/scripts/council-invoke.cjs"` |
| do-debugger.md / codex-debugger.md | divergent | agent name prefix | `- name: do-debugger`, `+ name: codex-debugger` |
| do-executioner.md / codex-executioner.md | divergent | agent name prefix | `- name: do-executioner`, `+ name: codex-executioner`, `- Spawned after `do-plan-reviewer` passes and user approves...`, `+ Spawned after `codex-plan-reviewer` passes and user appro...`, `- Also load any clarifications from do-griller if present.`, `+ Also load any clarifications from codex-griller if present.` |
| do-griller.md / codex-griller.md | divergent | agent name prefix | `- name: do-griller`, `+ name: codex-griller` |
| do-plan-reviewer.md / codex-plan-reviewer.md | divergent | agent name prefix | `- name: do-plan-reviewer`, `+ name: codex-plan-reviewer` |
| do-planner.md / codex-planner.md | divergent | agent name prefix, path substitution | `- name: do-planner`, `+ name: codex-planner`, `- Your job: Create a complete, actionable plan that do-exec...`, `+ Your job: Create a complete, actionable plan that codex-e...`, `- node ~/.claude/commands/do/scripts/load-task-context.cjs ...`, `+ node ~/.codex/skills/do/scripts/load-task-context.cjs "<t...` |
| do-verifier.md / codex-verifier.md | divergent | agent name prefix, prose wording | `- name: do-verifier`, `+ name: codex-verifier`, `- description: Verifies executed work via approach checklis...`, `+ description: Verifies executed work via approach checklis...`, `- tools: Read, Write, Edit, Grep, Glob, Agent, Bash, AskUse...`, `+ tools: Read, Write, Edit, Grep, Glob, Bash, AskUserQuestion` _(+4 more changed lines)_ |

### Agents Summary

- **Total pairs:** 8 (matches expected 8)
- **Identical:** 0 (matches expected 0)
- **Divergent:** 8 (matches expected 8)
- **Unpaired:** none

---

## Overall Summary

| Group | Total Pairs | Identical | Divergent | Unpaired |
|-------|------------|-----------|-----------|----------|
| References | 47 | 22 | 25 | 0 |
| Skills | 13 | 1 | 12 | 0 |
| Agents | 8 | 0 | 8 | 0 |
| **Total** | **68** | **23** | **45** | **0** |

### Comparison Against Expected Totals

- **Total pairs:** 68 (matches expected 68)
- **Identical:** 23 (matches expected 23)
- **Divergent:** 45 (matches expected 45)

> All counts match the project-level manual audit expectations. No discrepancies found.
