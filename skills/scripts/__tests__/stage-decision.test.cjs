#!/usr/bin/env node

/**
 * Tests for stage-decision.cjs — planReviewDecisionMatrix behavior.
 *
 * Uses Node.js built-in test runner (Node 16.7+).
 * Run: node --test skills/scripts/__tests__/stage-decision.test.cjs
 *
 * Leaner pattern (per plan clarification): planReviewDecisionMatrix is a pure
 * function with no I/O, no mocking, no async behavior. Direct require, same
 * describe/test structure as council-invoke.test.cjs, no mock/beforeEach/afterEach.
 *
 * Test requirements covered:
 *   - All-PASS (no findings) -> APPROVED
 *   - All-nitpick, any round -> INLINE_NITPICKS
 *   - All-nitpick at iteration 3 -> INLINE_NITPICKS (nitpick rounds don't count against cap)
 *   - Mixed findings (blocker + nitpick) -> RESPAWN
 *   - All-blocker -> RESPAWN
 *   - All-blocker at iteration 3 -> MAX_ITERATIONS
 *   - Untagged findings (defaults to blocker) -> RESPAWN
 *
 * Note: No code-review decision matrix tests (per plan approach Step 11 / council finding 2
 * iteration 7). Code review uses classifyFindings() for brief prioritization only — there is
 * no codeReviewDecisionMatrix() function.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const modulePath = path.join(__dirname, '..', 'stage-decision.cjs');
const { planReviewDecisionMatrix } = require(modulePath);

// We also need classifyFindings for integration-style test cases
const councilModulePath = path.join(__dirname, '..', 'council-invoke.cjs');
const { classifyFindings } = require(councilModulePath);

// ============================================================================
// planReviewDecisionMatrix Tests
// ============================================================================

describe('planReviewDecisionMatrix', () => {
  test('all-PASS (no findings): returns APPROVED', () => {
    // When combined verdict is APPROVED, the matrix is not entered.
    // But if called with empty findings, it should handle gracefully.
    const classified = classifyFindings([]);
    const result = planReviewDecisionMatrix(classified, 0);
    assert.strictEqual(result.action, 'APPROVED');
  });

  test('all-nitpick, round 1: returns INLINE_NITPICKS with nitpicks array', () => {
    const findings = ['[nitpick] wording fix in intro', '[nitpick] missing example in Step 2'];
    const classified = classifyFindings(findings);
    const result = planReviewDecisionMatrix(classified, 1);
    assert.strictEqual(result.action, 'INLINE_NITPICKS');
    assert.ok(Array.isArray(result.nitpicks), 'nitpicks should be an array');
    assert.strictEqual(result.nitpicks.length, 2);
  });

  test('all-nitpick at iteration 3: returns INLINE_NITPICKS (nitpick rounds ignore iteration cap)', () => {
    const findings = ['[nitpick] typo in Concern 4'];
    const classified = classifyFindings(findings);
    const result = planReviewDecisionMatrix(classified, 3);
    assert.strictEqual(result.action, 'INLINE_NITPICKS',
      'nitpick-only rounds must always inline + PASS regardless of iteration count');
  });

  test('mixed findings (blocker + nitpick), round 1: returns RESPAWN with all findings', () => {
    const findings = ['[blocker] scope gap in Step 3', '[nitpick] typo in intro'];
    const classified = classifyFindings(findings);
    const result = planReviewDecisionMatrix(classified, 1);
    assert.strictEqual(result.action, 'RESPAWN');
    assert.ok(Array.isArray(result.findings), 'findings should be present');
    assert.ok(Array.isArray(result.blockers), 'blockers should be present');
    assert.ok(Array.isArray(result.nitpicks), 'nitpicks should be present');
    assert.strictEqual(result.blockers.length, 1);
    assert.strictEqual(result.nitpicks.length, 1);
    assert.strictEqual(result.findings.length, 2, 'both blockers and nitpicks bundled in findings');
  });

  test('all-blocker, round 1: returns RESPAWN', () => {
    const findings = ['[blocker] design flaw in approach', '[blocker] missing responsibility'];
    const classified = classifyFindings(findings);
    const result = planReviewDecisionMatrix(classified, 1);
    assert.strictEqual(result.action, 'RESPAWN');
    assert.strictEqual(result.blockers.length, 2);
    assert.strictEqual(result.nitpicks.length, 0);
  });

  test('all-blocker at iteration 2 (one below cap): returns RESPAWN', () => {
    // Verifies the off-by-one boundary: reviewIterations=2 is still under the cap (< 3).
    // With pre-increment ordering (counter incremented before calling the matrix):
    //   round 1 -> counter=1, RESPAWN; round 2 -> counter=2, RESPAWN; round 3 -> counter=3, MAX_ITERATIONS.
    const findings = ['[blocker] design flaw still present', '[blocker] scope gap unresolved'];
    const classified = classifyFindings(findings);
    const result = planReviewDecisionMatrix(classified, 2);
    assert.strictEqual(result.action, 'RESPAWN',
      'reviewIterations=2 must return RESPAWN (cap is 3; MAX_ITERATIONS triggers at >=3)');
  });

  test('all-blocker at iteration 3 (MAX_ITERATIONS boundary): returns MAX_ITERATIONS', () => {
    // Verifies the cap: when counter is already 3 (incremented before the matrix call),
    // the third blocker round triggers MAX_ITERATIONS.
    const findings = ['[blocker] design flaw still present', '[blocker] scope gap unresolved'];
    const classified = classifyFindings(findings);
    const result = planReviewDecisionMatrix(classified, 3);
    assert.strictEqual(result.action, 'MAX_ITERATIONS');
  });

  test('untagged findings (safe fallback): defaults to blocker -> RESPAWN', () => {
    const findings = ['some untagged concern without severity tag'];
    const classified = classifyFindings(findings);
    // classifyFindings should default untagged to blocker
    assert.strictEqual(classified.blockers.length, 1, 'untagged should default to blocker');
    assert.strictEqual(classified.nitpicks.length, 0, 'no nitpicks from untagged');
    const result = planReviewDecisionMatrix(classified, 1);
    assert.strictEqual(result.action, 'RESPAWN',
      'untagged findings should degrade to full respawn, not silent skip');
  });

  // ============================================================================
  // Stage snippet contract: verifies the correct input types for PR-5 node -e block
  //
  // The PR-5 bash template in stage-plan-review.md must call:
  //   planReviewDecisionMatrix(JSON.parse('<classified_findings_json>'), <review_iterations>)
  // NOT:
  //   planReviewDecisionMatrix('<classified_findings>', '<review_iterations>')
  //
  // When string inputs are passed (the broken pattern), destructuring { blockers, nitpicks }
  // from a string yields undefined, which falls back to [], causing APPROVED to be returned
  // regardless of actual findings. This test documents and guards that contract.
  // ============================================================================

  test('stage snippet contract: string inputs (broken invocation) cause incorrect APPROVED', () => {
    // Simulate the broken pattern: both args passed as quoted strings (not the correct types)
    // This documents the failure mode so reviewers can recognize it.
    const stringClassifiedFindings = '{"blockers":["[blocker] scope gap"],"nitpicks":[]}';
    const stringReviewIterations = '1';
    // Destructuring a string yields undefined for object keys -> falls back to []
    const { blockers = [], nitpicks = [] } = stringClassifiedFindings;
    assert.deepStrictEqual(blockers, [], 'destructuring a string yields empty blockers — wrong result');
    assert.deepStrictEqual(nitpicks, [], 'destructuring a string yields empty nitpicks — wrong result');
    // This is the incorrect result caused by the broken invocation:
    const brokenResult = planReviewDecisionMatrix(stringClassifiedFindings, stringReviewIterations);
    assert.strictEqual(brokenResult.action, 'APPROVED',
      'broken string-input invocation incorrectly returns APPROVED even with blockers present');
  });

  test('stage snippet contract: correct types (JSON.parse + integer) return expected action', () => {
    // This is the correct invocation pattern as documented in the PR-5 prose comment:
    //   JSON.parse('<classified_findings_json>') -> object, <review_iterations> -> number
    const classifiedFindingsJson = '{"blockers":["[blocker] scope gap"],"nitpicks":[]}';
    const reviewIterations = 1;
    const classifiedFindings = JSON.parse(classifiedFindingsJson); // correct: object, not string
    const result = planReviewDecisionMatrix(classifiedFindings, reviewIterations);
    assert.strictEqual(result.action, 'RESPAWN',
      'correct object input with blockers must return RESPAWN, not APPROVED');
    assert.deepStrictEqual(result.blockers, ['[blocker] scope gap']);
  });

  test('apostrophe in finding text: JSON path handles correctly when parsed as object', () => {
    // Verifies that finding text containing apostrophes (e.g. "it's a scope gap") works correctly
    // when the classified findings arrive as a parsed object (via temp file + JSON.parse in node).
    // This guards against the previously broken pattern where apostrophes in finding text would
    // have broken a single-quoted shell string literal like JSON.parse('{"blockers":["it\'s a gap"]}').
    // With the temp-file approach (PR-4.5 / PR-5 revised prose), the shell never sees the finding
    // text — fs.readFileSync reads it directly, so apostrophes are handled transparently.
    const findingsWithApostrophes = [
      "[blocker] it's a scope gap in the approach",
      "[nitpick] reviewer's comment about example text",
    ];
    const classified = classifyFindings(findingsWithApostrophes);
    assert.strictEqual(classified.blockers.length, 1, 'blocker with apostrophe classified correctly');
    assert.strictEqual(classified.nitpicks.length, 1, 'nitpick with apostrophe classified correctly');

    // Simulate what the orchestrator does: JSON.stringify -> write to file -> JSON.parse (no shell)
    const json = JSON.stringify(classified);
    const reparsed = JSON.parse(json); // no shell involved — apostrophes survive round-trip
    const result = planReviewDecisionMatrix(reparsed, 1);
    assert.strictEqual(result.action, 'RESPAWN',
      'finding text with apostrophes must not corrupt classification — RESPAWN expected with blockers');
    assert.ok(result.blockers[0].includes("it's"), 'apostrophe preserved in blocker text');
    assert.ok(result.nitpicks[0].includes("reviewer's"), 'apostrophe preserved in nitpick text');
  });
});
