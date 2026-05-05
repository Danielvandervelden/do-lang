#!/usr/bin/env node

/**
 * Stage Decision Helper
 *
 * Provides stage-orchestration decision logic for the /do:task workflow.
 * Separated from council-invoke.cjs (council adapter) to follow single-responsibility.
 *
 * council-invoke.cjs owns: council transport, reviewer selection, invocation, response parsing.
 * stage-decision.cjs owns: stage branching logic (decision matrices for stage references).
 *
 * Parsing helpers (parseSelfReviewFindings, parseCouncilRunnerOutput, classifyFindings) live
 * in council-invoke.cjs because they reuse the existing parsing infrastructure there.
 * stage-decision.cjs receives pre-classified findings as input — it does not import
 * classifyFindings directly. The stage reference calls classifyFindings() and passes the
 * result to planReviewDecisionMatrix().
 *
 * Scope: plan review only (per plan approach Step 11 / council finding 2 iteration 7).
 * Code review (stage-code-review.md) CR-5 always respawns do-executioner — no decision
 * matrix needed. If a future task adds code-review inline patching, add
 * codeReviewDecisionMatrix() here at that time.
 *
 * @module stage-decision
 */

/**
 * Plan Review Decision Matrix
 *
 * Pure function encoding the PR-4.5 / PR-5 branching logic from stage-plan-review.md.
 * Called after classifyFindings() splits findings into blockers and nitpicks.
 *
 * Return actions:
 *   - APPROVED       — no findings (empty blockers + nitpicks); stage passes
 *   - INLINE_NITPICKS — all findings are nitpicks; stage applies edits inline then converts
 *                       to APPROVED for the caller. INTERNAL action — caller never sees this.
 *                       Nitpick-only rounds do NOT count against the 3-iteration cap.
 *   - RESPAWN        — any blocker present; re-spawn do-planner with all findings
 *   - MAX_ITERATIONS — blockers present and reviewIterations >= 3; escalate to user
 *
 * NOTE: INLINE_NITPICKS is a stage-internal action. The stage reference (PR-5) converts
 * it to APPROVED before returning to the caller. The caller contract only exposes APPROVED.
 *
 * @param {{ blockers: string[], nitpicks: string[] }} classifiedFindings - Output of classifyFindings()
 * @param {number} reviewIterations - Current round number, 1-based post-increment (1 = first round, 2 = second, 3 triggers MAX_ITERATIONS)
 * @returns {{ action: string, findings?: string[], blockers?: string[], nitpicks?: string[] }}
 */
function planReviewDecisionMatrix(classifiedFindings, reviewIterations) {
  const { blockers = [], nitpicks = [] } = classifiedFindings;

  // No findings at all — APPROVED (matrix should not be entered in this case, but handle gracefully)
  if (blockers.length === 0 && nitpicks.length === 0) {
    return { action: 'APPROVED' };
  }

  // All nitpicks — apply inline and convert to APPROVED (no re-spawn, no iteration cap impact)
  if (blockers.length === 0 && nitpicks.length > 0) {
    return { action: 'INLINE_NITPICKS', nitpicks };
  }

  // Any blocker present — check iteration cap
  if (reviewIterations >= 3) {
    return { action: 'MAX_ITERATIONS' };
  }

  // Blockers present, under cap — respawn planner with all findings (blockers + nitpicks bundled)
  return {
    action: 'RESPAWN',
    findings: [...blockers, ...nitpicks],
    blockers,
    nitpicks,
  };
}

module.exports = {
  planReviewDecisionMatrix,
};
