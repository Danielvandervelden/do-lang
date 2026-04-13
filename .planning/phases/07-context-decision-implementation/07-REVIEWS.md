---
date: 2026-04-13
mode: milestone
advisors: [codex]
verdict: CONCERNS
plans:
  - 07-01-PLAN.md
  - 07-02-PLAN.md
---

# Council Review: Phase 7 — Context Decision & Implementation

## Advisors Consulted
- Codex: success
- Gemini: rate-limited (429 errors, model capacity exhausted)

## Codex Assessment

**Verdict:** CONCERNS

**Key Findings:**
- Plan 01 correctly covers the grill-me extraction and router refactor, aligning with SKILL.md lines 914-1049 and D-19's architectural requirement
- Plan 01 introduces a regression risk: routing verification to `@skills/do/references/stage-verify.md` (line 177-193) when that file won't exist until Phase 8. Current behavior is a safe display-only placeholder (SKILL.md lines 945-946)
- Plan 01's verification is internally inconsistent: expects 3+ stage references in SKILL.md but also expects only 1 stage-*.md file to exist
- Plan 02 correctly implements TS-08/TS-09: hybrid context-clear prompt, execution logging, deviation handling, stage transitions
- Plan 02 pulls wave execution into scope (lines 260-263) despite being explicitly deferred in 07-CONTEXT.md line 141
- Plan 02 objective says E0-E4 but tasks only define E0-E3 (minor but shows plan needs tightening)

**Risks Identified:**
- **High**: Verification-stage tasks will break after Plan 01 if they try to load non-existent stage-verify.md
- **Medium**: Plan 01 leaves SKILL.md referencing stage-execute.md before Plan 02 creates it (broken intermediate state)
- **Medium**: Wave execution scope creep without corresponding Phase 7 docs update
- **Low**: Summary files mentioned in output but not in files_modified frontmatter

## Claude Assessment

**Verdict:** CONCERNS

**Additional Observations:**
1. **Verification routing is premature** — The plan correctly identifies D-19's router pattern but over-applies it. For verification stage, the router should keep the existing display-only behavior ("Verification not yet implemented. Phase 8.") rather than reference a non-existent file.

2. **Wave breakdown is scope creep** — Plan 02 Task 1 Step E2 includes wave execution instructions, but 07-CONTEXT.md explicitly lists "Wave-based execution with per-wave logging" under Deferred Ideas. This should be removed or the CONTEXT.md updated first.

3. **Plan dependency timing is correct** — Plan 02 depends on Plan 01 (wave: 2 depends_on: [07-01]), which is architecturally sound. However, Plan 01 should NOT add the stage-execute.md reference until Plan 02 creates the file, OR Plan 01 should leave a TODO comment rather than a live reference.

4. **E0-E4 vs E0-E3 discrepancy** — The objective mentions E0-E4 but only E0-E3 are implemented. This appears to be a documentation error rather than missing functionality, since E3 handles the stage transition which logically completes execution.

5. **Acceptance criteria verification commands are sound** — The grep-based checks are appropriate for validating the refactor.

## Synthesis

### Agreement Zones
Both Codex and Claude agree on:
- Plan 01 correctly extracts grill-me flow to stage-grill.md
- Plan 02 correctly implements D-18 hybrid context clear, D-20 execution logging, D-21 deviation handling, D-22 stage transitions
- The verification routing is premature and creates a regression risk
- The wave execution is out of scope for Phase 7
- Plan 01's file count verification (expects 1 file but references 3) is inconsistent

### Disagreement Zones
None — both assessments aligned on all material concerns.

### Unique Insights

**From Codex:**
- Intermediate broken state risk: after Plan 01, before Plan 02, the repo would reference stage-execute.md which doesn't exist yet. This is a valid concern for atomic execution.

**From Claude:**
- The E0-E4 vs E0-E3 is likely a documentation typo rather than missing functionality, since E3 covers the stage transition which is the logical completion.

## Final Advisory Verdict: CONCERNS

The plans are architecturally sound but have execution ordering issues and scope creep that should be addressed before implementation.

## Recommendations

1. **Fix verification routing (Plan 01)**: Change line 192 from `@skills/do/references/stage-verify.md (Phase 8)` to `Display: "Verification not yet implemented. (Phase 8)"` to preserve current safe behavior.

2. **Fix plan verification inconsistency (Plan 01)**: Update line 228 from `returns 1` to `returns 2` (expecting both stage-grill.md and stage-execute.md after Phase 7 completes), OR clarify that this check runs after Plan 01 only, not after Plan 02.

3. **Remove wave execution from Plan 02**: Delete lines 260-263 ("Wave execution (if task has waves)" block) from stage-execute.md Step E2. If waves are needed, update 07-CONTEXT.md first to move it from Deferred to In-Scope.

4. **Fix E0-E4 objective (Plan 02)**: Change line 42-44 from "Steps E0-E4" to "Steps E0-E3" to match the actual implementation.

5. **Consider atomic execution**: Either merge Plans 01 and 02 into a single execution unit, OR have Plan 01 use a placeholder for stage-execute.md reference (e.g., comment with TODO) until Plan 02 creates the file.
