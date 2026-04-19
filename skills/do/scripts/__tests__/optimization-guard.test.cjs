/**
 * Optimization Guard Tests
 *
 * Captures the behavioral contract of every file targeted for optimization.
 * Run before and after optimization to verify no behavioral regression.
 *
 * Tests verify: required sections, critical keywords, cross-reference integrity,
 * step ordering, and agent spawn blocks — NOT exact wording.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const REFS = path.join(ROOT, 'skills', 'do', 'references');
const SCRIPTS = path.join(ROOT, 'skills', 'do', 'scripts');
const AGENTS = path.join(ROOT, 'agents');
const SKILLS = path.join(ROOT, 'skills', 'do');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function assertSectionsExist(content, sections, file) {
  for (const s of sections) {
    assert.ok(
      content.includes(s),
      `${file}: missing required section "${s}"`
    );
  }
}

function assertKeywordsPresent(content, keywords, file) {
  for (const kw of keywords) {
    assert.ok(
      content.includes(kw),
      `${file}: missing critical keyword "${kw}"`
    );
  }
}

function assertStepOrder(content, steps, file) {
  // Match step headings (## or ###) to avoid false positives from cross-references
  // like "skip to Step 5" appearing before the actual "## Step 5" heading
  let lastIndex = -1;
  for (const step of steps) {
    // Try heading match first (## Step X or ### Step X), fall back to first bold match (** Step X)
    const headingPattern = new RegExp(`^#{1,4}\\s+.*${step.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm');
    const boldPattern = new RegExp(`\\*\\*${step.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
    const headingMatch = headingPattern.exec(content);
    const boldMatch = boldPattern.exec(content);

    let idx;
    if (headingMatch) {
      idx = headingMatch.index;
    } else if (boldMatch) {
      idx = boldMatch.index;
    } else {
      idx = content.indexOf(step);
    }

    assert.ok(idx !== -1, `${file}: step "${step}" not found`);
    assert.ok(
      idx > lastIndex,
      `${file}: step "${step}" (at ${idx}) appears before previous step (at ${lastIndex}) — ordering violation`
    );
    lastIndex = idx;
  }
}

function assertFileExists(filePath, label) {
  assert.ok(
    fs.existsSync(filePath),
    `${label}: referenced file does not exist: ${filePath}`
  );
}

// ─── stage-debug.md ────────────────────────────────────────────────

describe('optimization-guard: stage-debug.md', () => {
  const file = 'stage-debug.md';
  const content = read(path.join(REFS, file));

  it('has all required steps D0-D8', () => {
    assertSectionsExist(content, [
      'Step D0', 'Step D1', 'Step D2', 'Step D3', 'Step D4',
      'Step D5', 'Step D6', 'Step D7', 'Step D8'
    ], file);
  });

  it('steps appear in order D0 through D8', () => {
    assertStepOrder(content, [
      'Step D0', 'Step D1', 'Step D2', 'Step D3', 'Step D4',
      'Step D5', 'Step D6', 'Step D7', 'Step D8'
    ], file);
  });

  it('has all three D4 hypothesis branches', () => {
    assertKeywordsPresent(content, [
      'CONFIRMED', 'REJECTED', 'INCONCLUSIVE'
    ], file);
  });

  it('has loop-back contracts', () => {
    for (const target of ['Step D2', 'Step D3']) {
      const loopBackCount = content.split(target).length - 1;
      assert.ok(
        loopBackCount >= 2,
        `${file}: "${target}" should appear multiple times (original + loop-back references)`
      );
    }
  });

  it('has immutability and append-only rules', () => {
    assertKeywordsPresent(content, ['IMMUTABLE', 'APPEND only'], file);
  });

  it('has critical behavioral guards', () => {
    assertKeywordsPresent(content, [
      'DO NOT terminate',
      'hypothesis',
      'disproved',
      'confirmed'
    ], file);
  });

  it('has status routing table entries', () => {
    assertKeywordsPresent(content, [
      'gathering', 'investigating', 'fixing', 'verifying', 'awaiting_human_verify', 'resolved'
    ], file);
  });

  it('references debug-session.cjs', () => {
    assert.ok(content.includes('debug-session.cjs'), `${file}: must reference debug-session.cjs`);
    assertFileExists(path.join(SCRIPTS, 'debug-session.cjs'), file);
  });

  it('references debug-template.md', () => {
    assert.ok(content.includes('debug-template'), `${file}: must reference debug-template`);
    assertFileExists(path.join(REFS, 'debug-template.md'), file);
  });
});

// ─── stage-quick-exec.md ───────────────────────────────────────────

describe('optimization-guard: stage-quick-exec.md', () => {
  const file = 'stage-quick-exec.md';
  const content = read(path.join(REFS, file));

  it('has all required steps QE-0 through QE-20', () => {
    const steps = Array.from({ length: 21 }, (_, i) => `QE-${i}`);
    assertSectionsExist(content, steps, file);
  });

  it('steps appear in order QE-0 through QE-20', () => {
    const steps = Array.from({ length: 21 }, (_, i) => `QE-${i}`);
    assertStepOrder(content, steps, file);
  });

  it('has council reviewer spawn blocks', () => {
    assertKeywordsPresent(content, ['do-council-reviewer', 'council-invoke.cjs'], file);
  });

  it('has transient file lifecycle keywords', () => {
    assertKeywordsPresent(content, [
      '.quick-transient.md',
      'quick_baseline_sha'
    ], file);
  });

  it('has verdict keywords', () => {
    assertKeywordsPresent(content, ['APPROVED', 'NITPICKS_ONLY', 'CHANGES_REQUESTED'], file);
  });

  it('has escalation path keywords', () => {
    assertKeywordsPresent(content, [
      'lazy task-file materialization',
      'fast_path: true',
      'quick_path: true'
    ], file);
  });

  it('has one-iteration budget constraint', () => {
    assert.ok(
      content.includes('one iteration') || content.includes('1 fix iteration'),
      `${file}: must document the one-iteration budget constraint`
    );
  });

  it('references task-template.md', () => {
    assert.ok(content.includes('task-template'), `${file}: must reference task-template`);
    assertFileExists(path.join(REFS, 'task-template.md'), file);
  });
});

// ─── stage-fast-exec.md ────────────────────────────────────────────

describe('optimization-guard: stage-fast-exec.md', () => {
  const file = 'stage-fast-exec.md';
  const content = read(path.join(REFS, file));

  it('has all required steps FE-1 through FE-8', () => {
    assertSectionsExist(content, [
      'FE-1', 'FE-2', 'FE-3', 'FE-4', 'FE-5', 'FE-6', 'FE-7', 'FE-8'
    ], file);
  });

  it('steps appear in order FE-1 through FE-8', () => {
    assertStepOrder(content, [
      'FE-1', 'FE-2', 'FE-3', 'FE-4', 'FE-5', 'FE-6', 'FE-7', 'FE-8'
    ], file);
  });

  it('spawns do-executioner (not inline execution)', () => {
    assertKeywordsPresent(content, [
      'do-executioner',
      'Do NOT make changes to files yourself'
    ], file);
  });

  it('spawns do-code-reviewer (not council)', () => {
    assertKeywordsPresent(content, ['do-code-reviewer'], file);
  });

  it('has fast_path marker', () => {
    assertKeywordsPresent(content, ['fast_path: true'], file);
  });

  it('has delivery contract threading', () => {
    assertKeywordsPresent(content, ['delivery_contract', 'Delivery Contract'], file);
  });

  it('has three terminal states', () => {
    assertKeywordsPresent(content, ['COMPLETE', 'BLOCKED', 'FAILED'], file);
  });

  it('has stage override at FE-4', () => {
    assert.ok(
      content.includes('review_pending'),
      `${file}: FE-4 must set review_pending stage`
    );
  });

  it('has no-retry escalation policy', () => {
    assertKeywordsPresent(content, ['No automatic retries', 'abandoned: true'], file);
  });

  it('references load-task-context.cjs', () => {
    assert.ok(content.includes('load-task-context.cjs'), `${file}: must reference load-task-context.cjs`);
    assertFileExists(path.join(SCRIPTS, 'load-task-context.cjs'), file);
  });

  it('references task-template.md', () => {
    assert.ok(content.includes('task-template'), `${file}: must reference task-template`);
  });
});

// ─── stage-execute.md ──────────────────────────────────────────────

describe('optimization-guard: stage-execute.md', () => {
  const file = 'stage-execute.md';
  const content = read(path.join(REFS, file));

  it('has all required steps', () => {
    assertSectionsExist(content, [
      'Step R0', 'Step E-1', 'Step E0', 'Step E1', 'Step E2',
      'Step E3', 'Step E4'
    ], file);
  });

  it('steps appear in order', () => {
    assertStepOrder(content, [
      'Step R0', 'Step E-1', 'Step E0', 'Step E1', 'Step E2',
      'Step E3', 'Step E4'
    ], file);
  });

  it('has deviation handling', () => {
    assertKeywordsPresent(content, ['deviation', 'STOP and ask'], file);
  });

  it('has council gate keywords', () => {
    assertKeywordsPresent(content, [
      'council_review_ran',
      'council-invoke.cjs'
    ], file);
  });

  it('has plan review verdict keywords', () => {
    assertKeywordsPresent(content, ['LOOKS_GOOD', 'CONCERNS', 'RETHINK'], file);
  });

  it('has code review verdict keywords', () => {
    assertKeywordsPresent(content, ['APPROVED', 'NITPICKS_ONLY', 'CHANGES_REQUESTED'], file);
  });

  it('references resume-preamble.md', () => {
    assert.ok(content.includes('resume-preamble'), `${file}: must reference resume-preamble`);
    assertFileExists(path.join(REFS, 'resume-preamble.md'), file);
  });

  it('E0 context clear requires user consent', () => {
    assertKeywordsPresent(content, ['Do NOT proceed with execution yet'], file);
  });

  it('references council-invoke.cjs', () => {
    assertFileExists(path.join(SCRIPTS, 'council-invoke.cjs'), file);
  });
});

// ─── stage-plan-review.md ──────────────────────────────────────────

describe('optimization-guard: stage-plan-review.md', () => {
  const file = 'stage-plan-review.md';
  const content = read(path.join(REFS, file));

  it('has all required steps PR-0 through PR-5', () => {
    assertSectionsExist(content, [
      'PR-0', 'PR-1', 'PR-2', 'PR-3', 'PR-4', 'PR-5'
    ], file);
  });

  it('steps appear in order', () => {
    assertStepOrder(content, [
      'PR-0', 'PR-1', 'PR-2', 'PR-3', 'PR-4', 'PR-5'
    ], file);
  });

  it('has PR-4.5 Classify Findings step', () => {
    assertKeywordsPresent(content, ['Classify Findings'], file);
    // classifyFindings may be inline or in referenced classify-findings.md
    const classifyRef = read(path.join(REFS, 'classify-findings.md'));
    assert.ok(
      content.includes('classifyFindings') || (content.includes('classify-findings') && classifyRef.includes('classifyFindings')),
      `${file}: classifyFindings must be inline or in referenced classify-findings.md`
    );
  });

  it('has self-review verdict keywords', () => {
    assertKeywordsPresent(content, ['PASS', 'CONCERNS', 'RETHINK'], file);
  });

  it('has combined verdict keywords', () => {
    assertKeywordsPresent(content, ['APPROVED', 'ITERATE', 'ESCALATE'], file);
  });

  it('has INLINE_NITPICKS path', () => {
    assertKeywordsPresent(content, ['INLINE_NITPICKS'], file);
  });

  it('has blocker/nitpick classification', () => {
    assertKeywordsPresent(content, ['blocker', 'nitpick'], file);
  });

  it('references planReviewDecisionMatrix', () => {
    assertKeywordsPresent(content, ['planReviewDecisionMatrix'], file);
  });

  it('references parser functions (inline or via classify-findings.md)', () => {
    const classifyRef = read(path.join(REFS, 'classify-findings.md'));
    const combined = content + classifyRef;
    assertKeywordsPresent(combined, ['parseSelfReviewFindings', 'parseCouncilRunnerOutput'], file);
  });

  it('has iteration cap', () => {
    assertKeywordsPresent(content, ['MAX_ITERATIONS'], file);
  });

  it('spawns reviewers in parallel when council enabled', () => {
    assertKeywordsPresent(content, ['do-plan-reviewer', 'do-council-reviewer'], file);
  });

  it('references stage-decision.cjs', () => {
    assert.ok(content.includes('stage-decision'), `${file}: must reference stage-decision`);
    assertFileExists(path.join(SCRIPTS, 'stage-decision.cjs'), file);
  });

  it('references council-invoke.cjs', () => {
    assert.ok(content.includes('council-invoke.cjs'), `${file}: must reference council-invoke.cjs`);
  });
});

// ─── stage-code-review.md ──────────────────────────────────────────

describe('optimization-guard: stage-code-review.md', () => {
  const file = 'stage-code-review.md';
  const content = read(path.join(REFS, file));

  it('has all required steps CR-0 through CR-5', () => {
    assertSectionsExist(content, [
      'CR-0', 'CR-1', 'CR-2', 'CR-3', 'CR-4', 'CR-5'
    ], file);
  });

  it('steps appear in order', () => {
    assertStepOrder(content, [
      'CR-0', 'CR-1', 'CR-2', 'CR-3', 'CR-4', 'CR-5'
    ], file);
  });

  it('has CR-4.5 Classify Findings step', () => {
    assertKeywordsPresent(content, ['Classify Findings'], file);
    // classifyFindings may be inline or in referenced classify-findings.md
    const classifyRef = read(path.join(REFS, 'classify-findings.md'));
    assert.ok(
      content.includes('classifyFindings') || (content.includes('classify-findings') && classifyRef.includes('classifyFindings')),
      `${file}: classifyFindings must be inline or in referenced classify-findings.md`
    );
  });

  it('has code review verdict keywords', () => {
    assertKeywordsPresent(content, ['APPROVED', 'NITPICKS_ONLY', 'CHANGES_REQUESTED'], file);
  });

  it('has VERIFIED terminal state', () => {
    assertKeywordsPresent(content, ['VERIFIED'], file);
  });

  it('has blocker/nitpick classification', () => {
    assertKeywordsPresent(content, ['blocker', 'nitpick'], file);
  });

  it('has iteration cap', () => {
    assertKeywordsPresent(content, ['MAX_ITERATIONS'], file);
  });

  it('spawns reviewers in parallel when council enabled', () => {
    assertKeywordsPresent(content, ['do-code-reviewer', 'do-council-reviewer'], file);
  });

  it('spawns do-executioner for fixes on ITERATE', () => {
    assertKeywordsPresent(content, ['do-executioner'], file);
  });

  it('sets verification stage on VERIFIED', () => {
    assertKeywordsPresent(content, ['stage: verification'], file);
  });

  it('references council-invoke.cjs', () => {
    assert.ok(content.includes('council-invoke.cjs'), `${file}: must reference council-invoke.cjs`);
  });

  it('references parser functions (inline or via classify-findings.md)', () => {
    const classifyRef = read(path.join(REFS, 'classify-findings.md'));
    const combined = content + classifyRef;
    assertKeywordsPresent(combined, ['parseSelfReviewFindings', 'parseCouncilRunnerOutput'], file);
  });
});

// ─── stage-wave-plan-review.md ─────────────────────────────────────

describe('optimization-guard: stage-wave-plan-review.md', () => {
  const file = 'stage-wave-plan-review.md';
  const content = read(path.join(REFS, file));

  it('has all required steps including unique PR-2b', () => {
    assertSectionsExist(content, [
      'PR-0', 'PR-1', 'PR-2', 'PR-2b', 'PR-3', 'PR-4', 'PR-5'
    ], file);
  });

  it('steps appear in order', () => {
    assertStepOrder(content, [
      'PR-0', 'PR-1', 'PR-2', 'PR-2b', 'PR-3', 'PR-4', 'PR-5'
    ], file);
  });

  it('has plan curation step for scaffold placeholders', () => {
    assert.ok(
      content.includes('scaffold') || content.includes('placeholder') || content.includes('curat'),
      `${file}: PR-2b must reference scaffold placeholders or curation`
    );
  });

  it('has self-review verdict keywords', () => {
    assertKeywordsPresent(content, ['PASS', 'CONCERNS', 'RETHINK'], file);
  });

  it('has combined verdict keywords', () => {
    assertKeywordsPresent(content, ['APPROVED', 'ITERATE', 'ESCALATE'], file);
  });

  it('has iteration cap', () => {
    assertKeywordsPresent(content, ['MAX_ITERATIONS'], file);
  });

  it('spawns do-planner for curation and iteration', () => {
    assertKeywordsPresent(content, ['do-planner'], file);
  });

  it('spawns reviewers', () => {
    assertKeywordsPresent(content, ['do-plan-reviewer'], file);
  });

  it('references wave-specific config key cascade', () => {
    assert.ok(
      content.includes('wave_plan') || content.includes('council_reviews.project'),
      `${file}: must reference wave-specific council config key`
    );
  });

  it('references stage-wave-exec.md as next stage', () => {
    assert.ok(content.includes('wave-exec'), `${file}: must reference stage-wave-exec as next stage`);
  });
});

// ─── stage-wave-code-review.md ─────────────────────────────────────

describe('optimization-guard: stage-wave-code-review.md', () => {
  const file = 'stage-wave-code-review.md';
  const content = read(path.join(REFS, file));

  it('has all required steps CR-0 through CR-5', () => {
    assertSectionsExist(content, [
      'CR-0', 'CR-1', 'CR-2', 'CR-3', 'CR-4', 'CR-5'
    ], file);
  });

  it('steps appear in order', () => {
    assertStepOrder(content, [
      'CR-0', 'CR-1', 'CR-2', 'CR-3', 'CR-4', 'CR-5'
    ], file);
  });

  it('has code review verdict keywords', () => {
    assertKeywordsPresent(content, ['APPROVED', 'NITPICKS_ONLY', 'CHANGES_REQUESTED'], file);
  });

  it('has VERIFIED terminal state', () => {
    assertKeywordsPresent(content, ['VERIFIED'], file);
  });

  it('has iteration cap', () => {
    assertKeywordsPresent(content, ['MAX_ITERATIONS'], file);
  });

  it('spawns do-code-reviewer', () => {
    assertKeywordsPresent(content, ['do-code-reviewer'], file);
  });

  it('spawns do-executioner for fixes', () => {
    assertKeywordsPresent(content, ['do-executioner'], file);
  });

  it('does NOT have Classify Findings step (unlike task pipeline)', () => {
    assert.ok(
      !content.includes('classifyFindings'),
      `${file}: wave code review should NOT use classifyFindings`
    );
  });

  it('references stage-wave-verify.md as next stage', () => {
    assert.ok(content.includes('wave-verify'), `${file}: must reference stage-wave-verify as next stage`);
  });

  it('references wave-specific config key cascade', () => {
    assert.ok(
      content.includes('council_reviews.project.code') || content.includes('council_reviews.execution') || content.includes('project.code execution'),
      `${file}: must reference wave-specific council config key`
    );
  });
});

// ─── stage-verify.md ───────────────────────────────────────────────

describe('optimization-guard: stage-verify.md', () => {
  const file = 'stage-verify.md';
  const content = read(path.join(REFS, file));

  it('has all required steps R0, V0-V6', () => {
    assertSectionsExist(content, [
      'Step R0', 'Step V0', 'Step V1', 'Step V2', 'Step V3',
      'Step V4', 'Step V5', 'Step V6'
    ], file);
  });

  it('steps appear in order', () => {
    assertStepOrder(content, [
      'Step R0', 'Step V0', 'Step V1', 'Step V2', 'Step V3',
      'Step V4', 'Step V5', 'Step V6'
    ], file);
  });

  it('has binary pass/fail determination', () => {
    assertKeywordsPresent(content, ['PASS', 'FAIL'], file);
  });

  it('has UAT flow', () => {
    assertKeywordsPresent(content, ['UAT'], file);
  });

  it('has context threshold branching', () => {
    assertKeywordsPresent(content, ['80%'], file);
  });

  it('has quality check detection patterns', () => {
    assertKeywordsPresent(content, ['lint', 'typecheck'], file);
  });

  it('has stage transitions', () => {
    assertKeywordsPresent(content, [
      'stage: verified',
      'stage: complete'
    ], file);
    assert.ok(
      content.includes('stage: verification') || content.includes('stage is `verification`'),
      `${file}: must reference verification stage`
    );
  });

  it('has timeout limit', () => {
    assert.ok(
      content.includes('timeout') || content.includes('5 minute'),
      `${file}: must document timeout limit for quality checks`
    );
  });

  it('has completion side effects', () => {
    assertKeywordsPresent(content, ['active_task: null'], file);
  });

  it('references resume-preamble.md', () => {
    assert.ok(content.includes('resume-preamble'), `${file}: must reference resume-preamble`);
    assertFileExists(path.join(REFS, 'resume-preamble.md'), file);
  });

  it('has entry condition for verified stage (skip to V5)', () => {
    assert.ok(
      content.includes('verified') && content.includes('V5'),
      `${file}: must document skip-to-V5 for verified stage`
    );
  });
});

// ─── task.md (skill) ───────────────────────────────────────────────

describe('optimization-guard: task.md', () => {
  const file = 'task.md';
  const content = read(path.join(SKILLS, file));

  it('has all required steps -1 through 12', () => {
    assertSectionsExist(content, [
      'Step -1', 'Step 0', 'Step 1', 'Step 2', 'Step 3', 'Step 4',
      'Step 5', 'Step 6', 'Step 7', 'Step 8', 'Step 9', 'Step 10',
      'Step 11', 'Step 12'
    ], file);
  });

  it('steps appear in order', () => {
    assertStepOrder(content, [
      'Step -1', 'Step 0', 'Step 1', 'Step 2', 'Step 3', 'Step 4',
      'Step 5', 'Step 6', 'Step 7', 'Step 8', 'Step 9', 'Step 10',
      'Step 11', 'Step 12'
    ], file);
  });

  it('has delivery contract parsing', () => {
    assertKeywordsPresent(content, [
      'delivery_contract',
      'parseDeliveryArg',
      'validateDeliveryContract',
      'applyDefaults'
    ], file);
  });

  it('has smart routing with fast vs task decision', () => {
    assertKeywordsPresent(content, ['routing_confidence', 'fast', 'Router honesty'], file);
  });

  it('Step 0 never auto-recommends quick', () => {
    const step0Section = content.substring(
      content.indexOf('Step 0'),
      content.indexOf('Step 1')
    );
    assert.ok(
      step0Section.includes('quick') && (step0Section.includes('never') || step0Section.includes('NOT') || step0Section.includes('Do not')),
      `${file}: Step 0 must document that quick is never auto-recommended`
    );
  });

  it('has all four agent spawns', () => {
    assertKeywordsPresent(content, [
      'do-planner', 'do-griller', 'do-executioner', 'do-verifier'
    ], file);
  });

  it('has no-double-task-files invariant', () => {
    assert.ok(
      content.includes('double task') || content.includes('no double'),
      `${file}: must document no-double-task-files invariant`
    );
  });

  it('has iteration/verdict keywords', () => {
    assertKeywordsPresent(content, ['APPROVED', 'ITERATE', 'VERIFIED'], file);
  });

  it('has backlog cleanup', () => {
    assertKeywordsPresent(content, ['backlog_item'], file);
  });

  it('references required scripts', () => {
    for (const script of ['check-database-entry.cjs', 'validate-delivery-contract.cjs']) {
      assert.ok(content.includes(script), `${file}: must reference ${script}`);
      assertFileExists(path.join(SCRIPTS, script), file);
    }
  });

  it('references required stage files', () => {
    for (const ref of ['stage-fast-exec', 'stage-plan-review', 'stage-code-review', 'task-template', 'delivery-onboarding']) {
      assert.ok(content.includes(ref), `${file}: must reference ${ref}`);
    }
  });
});

// ─── project.md (skill) ────────────────────────────────────────────

describe('optimization-guard: project.md', () => {
  const file = 'project.md';
  const content = read(path.join(SKILLS, file));

  it('has config read and dispatch steps', () => {
    assertSectionsExist(content, ['Step 0', 'Step 1'], file);
  });

  it('has all subcommand handlers', () => {
    for (const sub of ['new', 'status', 'complete', 'abandon', 'resume']) {
      assert.ok(
        content.includes(`\`${sub}\``) || content.includes(`"${sub}"`) || content.includes(`### ${sub}`) || content.includes(`\`/do:project ${sub}\``),
        `${file}: must have handler for subcommand "${sub}"`
      );
    }
  });

  it('has phase subcommands', () => {
    assert.ok(content.includes('phase new'), `${file}: must have phase new`);
    assert.ok(content.includes('phase complete'), `${file}: must have phase complete`);
    assert.ok(content.includes('phase abandon'), `${file}: must have phase abandon`);
  });

  it('has wave subcommands', () => {
    assert.ok(content.includes('wave new'), `${file}: must have wave new`);
    assert.ok(content.includes('wave complete'), `${file}: must have wave complete`);
    assert.ok(content.includes('wave abandon'), `${file}: must have wave abandon`);
    assert.ok(content.includes('wave next'), `${file}: must have wave next`);
  });

  it('has leaf-files-only invariant', () => {
    assert.ok(
      content.toLowerCase().includes('leaf file'),
      `${file}: must document leaf-files-only rule`
    );
  });

  it('has single-active guard', () => {
    assert.ok(
      content.includes('single-active') || content.includes('active_project'),
      `${file}: must have single-active guard`
    );
  });

  it('has atomic write pattern', () => {
    assert.ok(
      content.includes('atomic') || content.includes('temp-file'),
      `${file}: must document atomic write pattern`
    );
  });

  it('has --from-backlog support in phase and wave new', () => {
    const matches = content.match(/--from-backlog/g);
    assert.ok(
      matches && matches.length >= 2,
      `${file}: --from-backlog must appear at least twice (phase new + wave new)`
    );
  });

  it('has do-griller spawns for re-grill', () => {
    assertKeywordsPresent(content, ['do-griller'], file);
  });

  it('references required scripts', () => {
    for (const script of ['project-scaffold.cjs', 'project-state.cjs', 'project-health.cjs']) {
      assert.ok(content.includes(script), `${file}: must reference ${script}`);
      assertFileExists(path.join(SCRIPTS, script), file);
    }
  });

  it('references required stage files', () => {
    for (const ref of [
      'stage-project-intake', 'stage-project-plan-review', 'stage-phase-plan-review',
      'stage-wave-plan-review', 'stage-wave-exec', 'stage-wave-code-review',
      'stage-wave-verify', 'stage-project-complete', 'stage-project-resume',
      'stage-phase-exit', 'stage-phase-transition'
    ]) {
      assert.ok(content.includes(ref), `${file}: must reference ${ref}`);
      assertFileExists(path.join(REFS, `${ref}.md`), file);
    }
  });

  it('phase complete preserves planning gate (inline or via stage-phase-transition reference)', () => {
    const phaseCompleteSection = content.substring(
      content.indexOf('phase complete'),
      content.indexOf('wave') > content.indexOf('phase complete')
        ? content.indexOf('wave', content.indexOf('phase complete'))
        : content.length
    );
    const transitionRef = read(path.join(REFS, 'stage-phase-transition.md'));
    assert.ok(
      phaseCompleteSection.includes('NOT') || phaseCompleteSection.includes('single-owner') || phaseCompleteSection.includes('planning gate')
      || (phaseCompleteSection.includes('stage-phase-transition') && transitionRef.includes('planning gate')),
      `${file}: phase complete must document NOT writing active_phase (planning gate) — inline or via stage-phase-transition`
    );
  });
});

// ─── do-verifier.md (agent) ────────────────────────────────────────

describe('optimization-guard: do-verifier.md', () => {
  const file = 'do-verifier.md';
  const content = read(path.join(AGENTS, file));

  it('has all required steps 1-6 with substeps', () => {
    assertSectionsExist(content, [
      'Step 1', 'Step 2', 'Step 3', 'Step 4', 'Step 5', 'Step 6'
    ], file);
  });

  it('steps appear in order', () => {
    assertStepOrder(content, [
      'Step 1', 'Step 2', 'Step 3', 'Step 4', 'Step 5', 'Step 6'
    ], file);
  });

  it('has mandatory initial read rule', () => {
    assert.ok(
      content.includes('Mandatory Initial Read') || content.includes('CRITICAL'),
      `${file}: must have mandatory initial read rule`
    );
  });

  it('has skip-to-step-5 for verified stage', () => {
    assert.ok(
      content.includes('skip') && content.includes('Step 5'),
      `${file}: must have skip-to-Step-5 for verified stage`
    );
  });

  it('has binary pass/fail rule', () => {
    assertKeywordsPresent(content, ['PASS', 'FAIL', 'binary'], file);
  });

  it('has no-code-review disclaimer', () => {
    assert.ok(
      content.includes('Do NOT perform code review') || content.includes('Does NOT perform code review'),
      `${file}: must disclaim code review responsibility`
    );
  });

  it('has frontmatter-presence-gated writes', () => {
    assertKeywordsPresent(content, [
      'unresolved_concerns',
      'discovered_followups',
      'wave_summary'
    ], file);
  });

  it('has context threshold branching', () => {
    assertKeywordsPresent(content, ['80%'], file);
  });

  it('has quality check detection', () => {
    assertKeywordsPresent(content, ['lint', 'typecheck'], file);
  });

  it('has stage transitions', () => {
    assertKeywordsPresent(content, ['stage: verified', 'stage: complete'], file);
  });

  it('has active_task clearing', () => {
    assertKeywordsPresent(content, ['active_task'], file);
  });
});

// ─── do-executioner.md (agent) ─────────────────────────────────────

describe('optimization-guard: do-executioner.md', () => {
  const file = 'do-executioner.md';
  const content = read(path.join(AGENTS, file));

  it('has all required steps 1-5', () => {
    assertSectionsExist(content, [
      'Step 1', 'Step 2', 'Step 3', 'Step 4', 'Step 5'
    ], file);
  });

  it('steps appear in order', () => {
    assertStepOrder(content, [
      'Step 1', 'Step 2', 'Step 3', 'Step 4', 'Step 5'
    ], file);
  });

  it('has delivery contract enforcement', () => {
    assertKeywordsPresent(content, [
      'Delivery Contract',
      'delivery.branch',
      'delivery.commit_prefix',
      'exclude_paths'
    ], file);
  });

  it('has branch mismatch blocking rule', () => {
    assert.ok(
      content.toLowerCase().includes('branch mismatch'),
      `${file}: must document branch mismatch as blocking`
    );
    assert.ok(
      content.includes('auto-switch') || content.includes('auto switch'),
      `${file}: must prohibit auto-switching branches`
    );
  });

  it('has .do/ default exclusion', () => {
    assert.ok(
      content.includes('.do/') && content.includes('excluded'),
      `${file}: must document .do/ default exclusion`
    );
  });

  it('has three-tier deviation handling', () => {
    assertKeywordsPresent(content, [
      'Minor Deviation',
      'Blocking Deviation',
      'Discovered Work'
    ], file);
  });

  it('has three terminal states', () => {
    assertKeywordsPresent(content, [
      'EXECUTION COMPLETE',
      'EXECUTION BLOCKED',
      'EXECUTION FAILED'
    ], file);
  });

  it('has scope creep guard', () => {
    assert.ok(
      content.includes('scope creep') || content.includes("Don't scope creep"),
      `${file}: must have scope creep guard`
    );
  });

  it('has frontmatter-presence-gated writes', () => {
    assertKeywordsPresent(content, ['modified_files', 'discovered_followups'], file);
  });

  it('has self-contained rule (no reading CLAUDE.md etc when contract present)', () => {
    assert.ok(
      content.includes('self-contained') || content.includes('Do NOT read CLAUDE.md'),
      `${file}: must document self-contained rule for delivery contract`
    );
  });

  it('has stage transition on completion', () => {
    assertKeywordsPresent(content, ['stage: verification'], file);
  });
});

// ─── stage-phase-transition.md ────────────────────────────────────

describe('optimization-guard: stage-phase-transition.md', () => {
  const file = 'stage-phase-transition.md';
  const content = read(path.join(REFS, file));

  it('has all required steps PT-1 through PT-4', () => {
    assertSectionsExist(content, ['PT-1', 'PT-2', 'PT-3', 'PT-4'], file);
  });

  it('steps appear in order', () => {
    assertStepOrder(content, ['PT-1', 'PT-2', 'PT-3', 'PT-4'], file);
  });

  it('invokes stage-phase-exit.md for handoff artefact', () => {
    assertKeywordsPresent(content, ['stage-phase-exit'], file);
  });

  it('uses project-state.cjs to find next phase', () => {
    assertKeywordsPresent(content, ['project-state.cjs', 'next-planning-phase'], file);
  });

  it('preserves planning gate (does NOT write active_phase)', () => {
    assertKeywordsPresent(content, ['single-owner', 'planning gate'], file);
  });

  it('has re-grill (Pass 3) with do-griller spawn', () => {
    assertKeywordsPresent(content, ['do-griller', 'Pass 3', 'project_intake_threshold'], file);
  });

  it('routes to stage-phase-plan-review for next phase', () => {
    assertKeywordsPresent(content, ['stage-phase-plan-review'], file);
  });

  it('has terminal vs non-terminal branching', () => {
    assertKeywordsPresent(content, ['Next Phase Entry Prompt', 'Project Completion Hint'], file);
  });
});

// ─── backlog-seed.md ──────────────────────────────────────────────

describe('optimization-guard: backlog-seed.md', () => {
  const file = 'backlog-seed.md';
  const content = read(path.join(REFS, file));

  it('has target_type and target_file parameters', () => {
    assertKeywordsPresent(content, ['target_type', 'target_file'], file);
  });

  it('has phase and wave target-section mappings', () => {
    assertKeywordsPresent(content, ['## Goal', '## Problem Statement'], file);
  });

  it('has backlog_item frontmatter write', () => {
    assertKeywordsPresent(content, ['backlog_item'], file);
  });

  it('has error handling for missing and done entries', () => {
    assertKeywordsPresent(content, ['not found', 'already done'], file);
  });

  it('uses correct backlog path (.do/BACKLOG.md)', () => {
    assert.ok(content.includes('.do/BACKLOG.md'), `${file}: must use .do/BACKLOG.md path`);
  });

  it('has atomic write pattern', () => {
    assert.ok(content.includes('atomic'), `${file}: must use atomic write pattern`);
  });

  it('has changelog entry', () => {
    assert.ok(content.includes('backlog-seed'), `${file}: must append backlog-seed changelog entry`);
  });
});

// ─── read-config.cjs ──────────────────────────────────────────────

describe('optimization-guard: read-config.cjs', () => {
  const file = 'read-config.cjs';
  const scriptPath = path.join(SCRIPTS, file);

  it('script exists', () => {
    assertFileExists(scriptPath, file);
  });

  it('has all four presets', () => {
    const content = read(scriptPath);
    assertKeywordsPresent(content, ['models', 'delivery', 'threshold', 'project-config'], file);
  });

  it('models preset has correct defaults', () => {
    const content = read(scriptPath);
    assert.ok(content.includes("default: 'sonnet'"), `${file}: models preset must default to sonnet`);
  });

  it('delivery preset reads delivery_contract', () => {
    const content = read(scriptPath);
    assert.ok(content.includes('delivery_contract'), `${file}: delivery preset must read delivery_contract`);
  });

  it('threshold preset reads auto_grill_threshold with 0.9 default', () => {
    const content = read(scriptPath);
    assert.ok(content.includes('auto_grill_threshold') && content.includes('0.9'),
      `${file}: threshold preset must use auto_grill_threshold with 0.9 default`);
  });

  it('project-config preset reads active_project, models, and project_intake_threshold', () => {
    const content = read(scriptPath);
    assert.ok(content.includes('active_project') && content.includes('project_intake_threshold'),
      `${file}: project-config preset must read active_project and project_intake_threshold`);
  });

  it('has error handling for unknown presets', () => {
    const content = read(scriptPath);
    assert.ok(content.includes('process.exit(1)'), `${file}: must exit with error on unknown preset`);
  });
});

// ─── council-gate.cjs ─────────────────────────────────────────────

describe('optimization-guard: council-gate.cjs', () => {
  const file = 'council-gate.cjs';
  const scriptPath = path.join(SCRIPTS, file);

  it('script exists', () => {
    assertFileExists(scriptPath, file);
  });

  it('supports dot-notation key paths', () => {
    const content = read(scriptPath);
    assert.ok(content.includes('split') && content.includes('.'),
      `${file}: must support dot-notation key paths`);
  });

  it('supports fallback key', () => {
    const content = read(scriptPath);
    assert.ok(content.includes('fallbackKey') || content.includes('fallback'),
      `${file}: must support fallback key`);
  });

  it('outputs enabled/disabled', () => {
    const content = read(scriptPath);
    assertKeywordsPresent(content, ['enabled', 'disabled'], file);
  });

  it('uses resolveConfig from council-invoke.cjs', () => {
    const content = read(scriptPath);
    assertKeywordsPresent(content, ['resolveConfig', 'council-invoke.cjs'], file);
  });
});

// ─── Cross-reference integrity ─────────────────────────────────────

describe('optimization-guard: cross-reference integrity', () => {
  it('all reference files referenced by skills/agents exist', () => {
    const refFiles = fs.readdirSync(REFS).filter(f => f.endsWith('.md'));
    for (const f of refFiles) {
      assertFileExists(path.join(REFS, f), 'references');
    }
  });

  it('all agent files referenced by the ecosystem exist', () => {
    const requiredAgents = [
      'do-planner.md', 'do-plan-reviewer.md', 'do-code-reviewer.md',
      'do-council-reviewer.md', 'do-executioner.md', 'do-verifier.md',
      'do-griller.md', 'do-debugger.md'
    ];
    for (const a of requiredAgents) {
      assertFileExists(path.join(AGENTS, a), 'agents');
    }
  });

  it('all script files referenced by the ecosystem exist', () => {
    const requiredScripts = [
      'council-invoke.cjs', 'council-gate.cjs', 'read-config.cjs',
      'debug-session.cjs', 'load-task-context.cjs', 'check-database-entry.cjs',
      'validate-delivery-contract.cjs', 'stage-decision.cjs',
      'project-scaffold.cjs', 'project-state.cjs', 'project-health.cjs',
      'project-resume.cjs', 'task-abandon.cjs', 'optimise-target.cjs',
      'scan-project.cjs', 'detect-tools.cjs', 'workspace-health.cjs'
    ];
    for (const s of requiredScripts) {
      assertFileExists(path.join(SCRIPTS, s), 'scripts');
    }
  });

  it('verdict matrices are consistent: plan review uses PASS/CONCERNS/RETHINK', () => {
    for (const file of ['stage-plan-review.md', 'stage-wave-plan-review.md']) {
      const content = read(path.join(REFS, file));
      assertKeywordsPresent(content, ['PASS', 'CONCERNS', 'RETHINK'], file);
    }
  });

  it('verdict matrices are consistent: code review uses APPROVED/NITPICKS_ONLY/CHANGES_REQUESTED', () => {
    for (const file of ['stage-code-review.md', 'stage-wave-code-review.md']) {
      const content = read(path.join(REFS, file));
      assertKeywordsPresent(content, ['APPROVED', 'NITPICKS_ONLY', 'CHANGES_REQUESTED'], file);
    }
  });

  it('all review stages have iteration cap', () => {
    for (const file of [
      'stage-plan-review.md', 'stage-code-review.md',
      'stage-wave-plan-review.md', 'stage-wave-code-review.md'
    ]) {
      const content = read(path.join(REFS, file));
      assertKeywordsPresent(content, ['MAX_ITERATIONS'], file);
    }
  });

  it('classify findings only in task pipeline, not wave pipeline', () => {
    const planReview = read(path.join(REFS, 'stage-plan-review.md'));
    const codeReview = read(path.join(REFS, 'stage-code-review.md'));
    const wavePlan = read(path.join(REFS, 'stage-wave-plan-review.md'));
    const waveCode = read(path.join(REFS, 'stage-wave-code-review.md'));

    // classifyFindings may be inline or referenced via classify-findings.md
    assert.ok(
      planReview.includes('classifyFindings') || planReview.includes('classify-findings'),
      'stage-plan-review must use classifyFindings (inline or via reference)'
    );
    assert.ok(
      codeReview.includes('classifyFindings') || codeReview.includes('classify-findings'),
      'stage-code-review must use classifyFindings (inline or via reference)'
    );
    assert.ok(!wavePlan.includes('classifyFindings') && !wavePlan.includes('classify-findings'),
      'stage-wave-plan-review must NOT use classifyFindings');
    assert.ok(!waveCode.includes('classifyFindings') && !waveCode.includes('classify-findings'),
      'stage-wave-code-review must NOT use classifyFindings');
  });

  it('classify-findings.md shared reference exists and has required content', () => {
    const classifyFile = path.join(REFS, 'classify-findings.md');
    assertFileExists(classifyFile, 'classify-findings.md');
    const content = read(classifyFile);
    assertKeywordsPresent(content, [
      'classifyFindings', 'parseSelfReviewFindings', 'parseCouncilRunnerOutput',
      'council-invoke.cjs', 'classified_findings_json'
    ], 'classify-findings.md');
  });
});
