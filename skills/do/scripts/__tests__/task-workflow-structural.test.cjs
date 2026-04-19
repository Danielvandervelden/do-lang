#!/usr/bin/env node

/**
 * Structural assertion suite for /do:task workflow skill + stage-reference markdown files.
 *
 * Scoped to the task workflow pipeline (task.md, stage-plan-review.md, stage-code-review.md,
 * reviewer agents, council runner, and the stage-decision.cjs helper). This file is
 * intentionally separate from beta-skill-structural.test.cjs, which is scoped to the
 * /do:project beta pipeline only. Mixing scopes would cause cross-scope coupling.
 *
 * Assertions verify:
 *   - Classification step markers present in stage references
 *   - Severity tags in reviewer output contracts
 *   - Council runner bulleted findings format
 *   - Caller contracts updated to permit inline edits
 *   - council-invoke.cjs exports the classification helpers
 *   - stage-decision.cjs exists and exports planReviewDecisionMatrix
 *
 * Run: node --test skills/do/scripts/__tests__/task-workflow-structural.test.cjs
 */

const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const STAGE_DIR = path.join(ROOT, 'skills', 'do', 'references');
const AGENT_DIR = path.join(ROOT, 'agents');
const SKILL_DIR = path.join(ROOT, 'skills', 'do');
const SCRIPT_DIR = path.join(ROOT, 'skills', 'do', 'scripts');

const TASK_STAGE_FILES = [
  'stage-plan-review.md',
  'stage-code-review.md',
].map(f => path.join(STAGE_DIR, f));

const TASK_AGENT_FILES = [
  'do-plan-reviewer.md',
  'do-code-reviewer.md',
  'do-council-reviewer.md',
].map(f => path.join(AGENT_DIR, f));

const TASK_SKILL_FILES = [
  'task.md',
].map(f => path.join(SKILL_DIR, f));

const TASK_SCRIPT_FILES = [
  'council-invoke.cjs',
  'stage-decision.cjs',
].map(f => path.join(SCRIPT_DIR, f));

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

// ============================================================================
// stage-plan-review.md assertions
// ============================================================================

describe('stage-plan-review.md: classification step', () => {
  let content;
  before(() => {
    assert.ok(fs.existsSync(TASK_STAGE_FILES[0]), 'stage-plan-review.md must exist');
    content = read(TASK_STAGE_FILES[0]);
  });

  it('contains PR-4.5 or "Classify Findings" section', () => {
    assert.ok(
      content.includes('PR-4.5') || content.includes('Classify Findings'),
      'stage-plan-review.md must contain PR-4.5 or "Classify Findings" section'
    );
  });

  it('contains INLINE_NITPICKS (inline-then-PASS path)', () => {
    assert.ok(
      content.includes('INLINE_NITPICKS') || content.includes('nitpicks_only'),
      'stage-plan-review.md must reference INLINE_NITPICKS or nitpicks_only path'
    );
  });

  it('uses parseCouncilRunnerOutput (not parseFindings) for council output', () => {
    // parseCouncilRunnerOutput may be inline or in referenced classify-findings.md
    const classifyPath = path.join(path.dirname(TASK_STAGE_FILES[0]), 'classify-findings.md');
    const combined = fs.existsSync(classifyPath)
      ? content + read(classifyPath)
      : content;
    assert.ok(
      combined.includes('parseCouncilRunnerOutput'),
      'stage-plan-review.md (or its classify-findings.md reference) must use parseCouncilRunnerOutput'
    );
    assert.ok(
      !combined.includes('parseFindings(council_output)') &&
      !combined.includes('parseFindings(council_agent_output)'),
      'must not use parseFindings() on council agent output'
    );
  });

  it('references parseSelfReviewFindings for self-review output', () => {
    const classifyPath = path.join(path.dirname(TASK_STAGE_FILES[0]), 'classify-findings.md');
    const combined = fs.existsSync(classifyPath)
      ? content + read(classifyPath)
      : content;
    assert.ok(
      combined.includes('parseSelfReviewFindings'),
      'stage-plan-review.md (or its classify-findings.md reference) must use parseSelfReviewFindings'
    );
  });
});

// ============================================================================
// stage-code-review.md assertions
// ============================================================================

describe('stage-code-review.md: classification step', () => {
  let content;
  before(() => {
    assert.ok(fs.existsSync(TASK_STAGE_FILES[1]), 'stage-code-review.md must exist');
    content = read(TASK_STAGE_FILES[1]);
  });

  it('contains CR-4.5 or "Classify Findings" section', () => {
    assert.ok(
      content.includes('CR-4.5') || content.includes('Classify Findings'),
      'stage-code-review.md must contain CR-4.5 or "Classify Findings" section'
    );
  });

  it('preserves existing NITPICKS_ONLY -> VERIFIED semantics in CR-4 table', () => {
    assert.ok(
      content.includes('NITPICKS_ONLY') && content.includes('VERIFIED'),
      'stage-code-review.md must preserve NITPICKS_ONLY -> VERIFIED in combination table'
    );
  });
});

// ============================================================================
// do-plan-reviewer.md assertions
// ============================================================================

describe('do-plan-reviewer.md: severity tags in output contract', () => {
  let content;
  before(() => {
    assert.ok(fs.existsSync(TASK_AGENT_FILES[0]), 'do-plan-reviewer.md must exist');
    content = read(TASK_AGENT_FILES[0]);
  });

  it('contains [blocker|nitpick] in CONCERNS output template', () => {
    assert.ok(
      content.includes('[blocker|nitpick]') || content.includes('[blocker]'),
      'do-plan-reviewer.md CONCERNS template must include severity tag placeholder'
    );
  });
});

// ============================================================================
// do-code-reviewer.md assertions
// ============================================================================

describe('do-code-reviewer.md: severity tags in CHANGES_REQUESTED template', () => {
  let content;
  before(() => {
    assert.ok(fs.existsSync(TASK_AGENT_FILES[1]), 'do-code-reviewer.md must exist');
    content = read(TASK_AGENT_FILES[1]);
  });

  it('contains [blocker|nitpick] in CHANGES_REQUESTED output template', () => {
    assert.ok(
      content.includes('[blocker|nitpick]') || content.includes('[blocker]'),
      'do-code-reviewer.md CHANGES_REQUESTED template must include severity tag placeholder'
    );
  });
});

// ============================================================================
// do-council-reviewer.md assertions
// ============================================================================

describe('do-council-reviewer.md: bulleted findings format in Step 4', () => {
  let content;
  before(() => {
    assert.ok(fs.existsSync(TASK_AGENT_FILES[2]), 'do-council-reviewer.md must exist');
    content = read(TASK_AGENT_FILES[2]);
  });

  it('Step 4 response template uses bulleted findings format', () => {
    // Look for the "Findings:\n- " pattern indicating one-per-line bulleted format
    assert.ok(
      content.includes('Findings:\n- ') || content.includes('Findings:\r\n- '),
      'do-council-reviewer.md Step 4 must use bulleted findings format (Findings:\\n- <finding>)'
    );
  });
});

// ============================================================================
// task.md assertions
// ============================================================================

describe('task.md: Step 6 ITERATE bullet permits inline edits by stage reference', () => {
  let content;
  before(() => {
    assert.ok(fs.existsSync(TASK_SKILL_FILES[0]), 'task.md must exist');
    content = read(TASK_SKILL_FILES[0]);
  });

  it('Step 6 ITERATE comment permits inline Edit tool calls', () => {
    assert.ok(
      content.includes('inline Edit') || content.includes('nitpick-only rounds'),
      'task.md Step 6 ITERATE bullet must permit inline Edit tool calls or reference nitpick-only rounds'
    );
  });
});

// ============================================================================
// council-invoke.cjs exports assertions
// ============================================================================

describe('council-invoke.cjs: exports classification helpers (not stageDecisionMatrix)', () => {
  let mod;
  before(() => {
    const scriptPath = TASK_SCRIPT_FILES[0];
    assert.ok(fs.existsSync(scriptPath), 'council-invoke.cjs must exist');
    mod = require(scriptPath);
  });

  it('exports parseSelfReviewFindings', () => {
    assert.strictEqual(typeof mod.parseSelfReviewFindings, 'function',
      'council-invoke.cjs must export parseSelfReviewFindings');
  });

  it('exports parseCouncilRunnerOutput', () => {
    assert.strictEqual(typeof mod.parseCouncilRunnerOutput, 'function',
      'council-invoke.cjs must export parseCouncilRunnerOutput');
  });

  it('exports classifyFindings', () => {
    assert.strictEqual(typeof mod.classifyFindings, 'function',
      'council-invoke.cjs must export classifyFindings');
  });

  it('does NOT export planReviewDecisionMatrix (that lives in stage-decision.cjs)', () => {
    assert.strictEqual(mod.planReviewDecisionMatrix, undefined,
      'council-invoke.cjs must not export planReviewDecisionMatrix — it belongs in stage-decision.cjs');
  });
});

// ============================================================================
// stage-decision.cjs exists and exports planReviewDecisionMatrix
// ============================================================================

describe('stage-decision.cjs: exists and exports planReviewDecisionMatrix', () => {
  let mod;
  before(() => {
    const scriptPath = TASK_SCRIPT_FILES[1];
    assert.ok(fs.existsSync(scriptPath),
      'stage-decision.cjs must exist — it is a first-class installed script');
    mod = require(scriptPath);
  });

  it('exports planReviewDecisionMatrix (plan-review scoped only)', () => {
    assert.strictEqual(typeof mod.planReviewDecisionMatrix, 'function',
      'stage-decision.cjs must export planReviewDecisionMatrix');
  });

  it('does NOT export codeReviewDecisionMatrix (deferred per plan decision)', () => {
    assert.strictEqual(mod.codeReviewDecisionMatrix, undefined,
      'stage-decision.cjs must not export codeReviewDecisionMatrix — deferred to follow-up task');
  });
});
