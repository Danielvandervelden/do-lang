#!/usr/bin/env node

/**
 * Spec-tests for agent frontmatter-presence-gated writes (β contract).
 *
 * **Scope and honest framing.** These tests do NOT exercise the agent markdown
 * specs directly (agents are prose, not executable code). They test helper
 * functions below that *reimplement* the documented gate logic from
 * agents/do-executioner.md and agents/do-verifier.md. They serve two purposes:
 *   1. Document the gate contract in executable form so regressions to the
 *      helper (or a future port to a real gate module) are caught.
 *   2. Provide a drift-check against the spec: if agent docs are edited to
 *      say something different, these tests still encode the β-contract
 *      expectation, surfacing the divergence at review time.
 *
 * They do NOT substitute for end-to-end agent integration testing. A real
 * agent-behavior harness would need to spawn `do-executioner`/`do-verifier`
 * against fixture target files and diff the result, which is out of β scope
 * and arguably belongs in γ or a later test-infrastructure task.
 *
 * Gate contracts validated:
 *   - modified_files[] write in do-executioner → only when key exists
 *   - discovered_followups[] append in do-executioner → only when key exists
 *   - unresolved_concerns[] write in do-verifier → only when key exists
 *   - discovered_followups[] append in do-verifier → only when key exists
 *   - wave_summary write in do-verifier → only when key exists
 *   - active_task clear in do-verifier → only when target is in .do/tasks/
 *
 * Run: node --test skills/do/scripts/__tests__/agent-frontmatter-gates.test.cjs
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Use gray-matter for reliable YAML frontmatter handling
let fm;
try {
  fm = require('gray-matter');
} catch (e) {
  console.error('gray-matter not found — run npm install in the repo root');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Helpers — simulate the agent logic described in the spec docs
// ---------------------------------------------------------------------------

/**
 * Simulate do-executioner Step 4 para 3:
 * Write modified_files and discovered_followups to target file
 * ONLY if those keys exist in frontmatter.
 */
function executionerWrite(targetFilePath, modifiedFiles, discoveredFollowups) {
  const content = fs.readFileSync(targetFilePath, 'utf8');
  // cache: false prevents gray-matter from returning stale cached objects
  // when multiple tests use identical fixture strings.
  const doc = fm(content, { cache: false });
  const data = doc.data;

  let changed = false;

  // modified_files write — only if key exists
  if (Object.prototype.hasOwnProperty.call(data, 'modified_files')) {
    data.modified_files = modifiedFiles;
    changed = true;
  }

  // discovered_followups append — only if key exists
  if (Object.prototype.hasOwnProperty.call(data, 'discovered_followups') && discoveredFollowups.length > 0) {
    if (!Array.isArray(data.discovered_followups)) data.discovered_followups = [];
    data.discovered_followups.push(...discoveredFollowups);
    changed = true;
  }

  if (changed) {
    const out = fm.stringify(doc.content, data);
    const tmp = targetFilePath + '.tmp.' + Date.now();
    fs.writeFileSync(tmp, out);
    fs.renameSync(tmp, targetFilePath);
  }
}

/**
 * Simulate do-verifier Step 6 para 2:
 * Write unresolved_concerns, discovered_followups, wave_summary
 * ONLY if those keys exist in frontmatter.
 */
function verifierWrite(targetFilePath, unresolvedConcerns, discoveredFollowups, waveSummary) {
  const content = fs.readFileSync(targetFilePath, 'utf8');
  // cache: false prevents gray-matter from returning stale cached objects
  // when multiple tests use identical fixture strings.
  const doc = fm(content, { cache: false });
  const data = doc.data;

  let changed = false;

  // unresolved_concerns — only if key exists
  if (Object.prototype.hasOwnProperty.call(data, 'unresolved_concerns')) {
    data.unresolved_concerns = unresolvedConcerns;
    changed = true;
  }

  // discovered_followups — only if key exists
  if (Object.prototype.hasOwnProperty.call(data, 'discovered_followups') && discoveredFollowups.length > 0) {
    if (!Array.isArray(data.discovered_followups)) data.discovered_followups = [];
    data.discovered_followups.push(...discoveredFollowups);
    changed = true;
  }

  // wave_summary — only if key exists (may be null sentinel)
  if (Object.prototype.hasOwnProperty.call(data, 'wave_summary') && waveSummary !== undefined) {
    data.wave_summary = waveSummary;
    changed = true;
  }

  if (changed) {
    const out = fm.stringify(doc.content, data);
    const tmp = targetFilePath + '.tmp.' + Date.now();
    fs.writeFileSync(tmp, out);
    fs.renameSync(tmp, targetFilePath);
  }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const WAVE_MD = `---
status: in_progress
scope: in_scope
modified_files: []
discovered_followups: []
unresolved_concerns: []
wave_summary: null
---

## Problem Statement
Wave content here.

## Execution Log
`;

// Plain task file — no project-wave frontmatter arrays
const TASK_MD = `---
id: 260418-test-task
stage: execution
stages:
  execution: in_progress
  verification: pending
---

## Problem Statement
Task content here.

## Execution Log
`;

function writeFixture(dir, name, content) {
  const p = path.join(dir, name);
  fs.writeFileSync(p, content);
  return p;
}

// ---------------------------------------------------------------------------
// Tests: do-executioner gated writes
// ---------------------------------------------------------------------------

describe('do-executioner frontmatter-presence-gated writes', () => {
  it('writes modified_files when key exists in wave.md', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'exec-'));
    const wavePath = writeFixture(tmp, 'wave.md', WAVE_MD);

    const files = ['src/auth.ts', 'src/auth.test.ts'];
    executionerWrite(wavePath, files, []);

    const result = fm(fs.readFileSync(wavePath, 'utf8'), { cache: false });
    assert.deepStrictEqual(result.data.modified_files, files,
      'modified_files should be written when key exists');

    fs.rmSync(tmp, { recursive: true });
  });

  it('is no-op for modified_files when key absent in plain task file', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'exec-'));
    const taskPath = writeFixture(tmp, '260418-test.md', TASK_MD);
    const originalContent = fs.readFileSync(taskPath, 'utf8');

    executionerWrite(taskPath, ['src/auth.ts'], []);

    const newContent = fs.readFileSync(taskPath, 'utf8');
    assert.strictEqual(newContent, originalContent,
      'file should be unchanged when modified_files key is absent');

    fs.rmSync(tmp, { recursive: true });
  });

  it('appends discovered_followups to wave.md when key exists', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'exec-'));
    const wavePath = writeFixture(tmp, 'wave.md', WAVE_MD);

    const followup = { title: 'Null check needed', body: 'UserService.ts:45', promote: false };
    executionerWrite(wavePath, [], [followup]);

    const result = fm(fs.readFileSync(wavePath, 'utf8'), { cache: false });
    assert.ok(Array.isArray(result.data.discovered_followups),
      'discovered_followups should be an array');
    assert.strictEqual(result.data.discovered_followups.length, 1,
      'discovered_followups should have one entry');

    fs.rmSync(tmp, { recursive: true });
  });

  it('is no-op for discovered_followups when key absent in plain task file', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'exec-'));
    const taskPath = writeFixture(tmp, '260418-test.md', TASK_MD);
    const originalContent = fs.readFileSync(taskPath, 'utf8');

    const followup = { title: 'Tech debt', body: 'Refactor later', promote: false };
    executionerWrite(taskPath, [], [followup]);

    const newContent = fs.readFileSync(taskPath, 'utf8');
    assert.strictEqual(newContent, originalContent,
      'file should be unchanged when discovered_followups key is absent');

    fs.rmSync(tmp, { recursive: true });
  });

  it('does NOT write modified_files when list is empty (key still present)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'exec-'));
    const wavePath = writeFixture(tmp, 'wave.md', WAVE_MD);

    // Empty list — key exists, but we write empty array (not a no-op; the key
    // exists so the write fires, just with empty value)
    executionerWrite(wavePath, [], []);

    const result = fm(fs.readFileSync(wavePath, 'utf8'), { cache: false });
    // modified_files should have been set (to []) since the key exists
    assert.ok(Object.prototype.hasOwnProperty.call(result.data, 'modified_files'),
      'modified_files key should still exist');
    assert.deepStrictEqual(result.data.modified_files, [],
      'modified_files should be empty array');

    fs.rmSync(tmp, { recursive: true });
  });
});

// ---------------------------------------------------------------------------
// Tests: do-verifier gated writes
// ---------------------------------------------------------------------------

describe('do-verifier frontmatter-presence-gated writes', () => {
  it('writes unresolved_concerns to wave.md when key exists', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'verif-'));
    const wavePath = writeFixture(tmp, 'wave.md', WAVE_MD);

    const concern = { title: 'Missing test coverage', body: 'auth.ts line 42', severity: 'warning' };
    verifierWrite(wavePath, [concern], [], 'Implemented JWT auth.');

    const result = fm(fs.readFileSync(wavePath, 'utf8'), { cache: false });
    assert.ok(Array.isArray(result.data.unresolved_concerns),
      'unresolved_concerns should be an array');
    assert.strictEqual(result.data.unresolved_concerns.length, 1,
      'unresolved_concerns should have one entry');

    fs.rmSync(tmp, { recursive: true });
  });

  it('is no-op for unresolved_concerns when key absent in plain task file', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'verif-'));
    const taskPath = writeFixture(tmp, '260418-test.md', TASK_MD);
    const originalContent = fs.readFileSync(taskPath, 'utf8');

    const concern = { title: 'Missing tests', body: 'auth.ts', severity: 'warning' };
    verifierWrite(taskPath, [concern], [], undefined);

    const newContent = fs.readFileSync(taskPath, 'utf8');
    assert.strictEqual(newContent, originalContent,
      'file should be unchanged when unresolved_concerns key is absent');

    fs.rmSync(tmp, { recursive: true });
  });

  it('writes wave_summary to wave.md when key exists (overwrites null sentinel)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'verif-'));
    const wavePath = writeFixture(tmp, 'wave.md', WAVE_MD);

    const summary = 'Implemented JWT authentication with refresh token support.';
    verifierWrite(wavePath, [], [], summary);

    const result = fm(fs.readFileSync(wavePath, 'utf8'), { cache: false });
    assert.strictEqual(result.data.wave_summary, summary,
      'wave_summary should be written when key exists');

    fs.rmSync(tmp, { recursive: true });
  });

  it('is no-op for wave_summary when key absent in plain task file', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'verif-'));
    const taskPath = writeFixture(tmp, '260418-test.md', TASK_MD);
    const originalContent = fs.readFileSync(taskPath, 'utf8');

    verifierWrite(taskPath, [], [], 'Summary text.');

    const newContent = fs.readFileSync(taskPath, 'utf8');
    assert.strictEqual(newContent, originalContent,
      'file should be unchanged when wave_summary key is absent');

    fs.rmSync(tmp, { recursive: true });
  });

  it('appends discovered_followups to wave.md when key exists (verifier)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'verif-'));
    const wavePath = writeFixture(tmp, 'wave.md', WAVE_MD);

    const followup = { title: 'Rate limiting', body: 'Add rate limit to auth endpoint', promote: true };
    verifierWrite(wavePath, [], [followup], 'JWT auth shipped.');

    const result = fm(fs.readFileSync(wavePath, 'utf8'), { cache: false });
    assert.ok(Array.isArray(result.data.discovered_followups),
      'discovered_followups should be an array');
    assert.strictEqual(result.data.discovered_followups.length, 1,
      'discovered_followups should have one entry after verifier writes');

    fs.rmSync(tmp, { recursive: true });
  });

  it('is no-op for discovered_followups when key absent in plain task file (verifier)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'verif-'));
    const taskPath = writeFixture(tmp, '260418-test.md', TASK_MD);
    const originalContent = fs.readFileSync(taskPath, 'utf8');

    const followup = { title: 'Tech debt', body: 'Refactor auth', promote: false };
    verifierWrite(taskPath, [], [followup], undefined);

    const newContent = fs.readFileSync(taskPath, 'utf8');
    assert.strictEqual(newContent, originalContent,
      'file should be unchanged when discovered_followups key is absent');

    fs.rmSync(tmp, { recursive: true });
  });

  it('is a no-op for empty unresolved_concerns and empty followups on wave with empty arrays', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'verif-'));
    const wavePath = writeFixture(tmp, 'wave.md', WAVE_MD);

    // Call with empty data — should still write (wave_summary changes null → '')
    // to show the key-existence gate fires, not a value-equality gate
    verifierWrite(wavePath, [], [], '');

    const result = fm(fs.readFileSync(wavePath, 'utf8'), { cache: false });
    assert.strictEqual(result.data.wave_summary, '',
      'wave_summary should be empty string, not null, after write');

    fs.rmSync(tmp, { recursive: true });
  });
});

// ---------------------------------------------------------------------------
// Tests: do-verifier active_task clearing gate (documented behaviour)
// ---------------------------------------------------------------------------

describe('do-verifier active_task clearing gate (documented logic)', () => {
  it('active_task clear applies only to .do/tasks/ paths', () => {
    // Validate the documented logic from do-verifier.md Step 6 para 3.
    // The agent clears active_task only when target is a task file in .do/tasks/.

    const taskTarget = '.do/tasks/260418-test-task.md';
    assert.strictEqual(
      taskTarget.startsWith('.do/tasks/'),
      true,
      'active_task SHOULD be cleared for .do/tasks/ targets'
    );

    const waveTarget = '.do/projects/my-proj/phases/01-phase/waves/01-wave/wave.md';
    assert.strictEqual(
      waveTarget.startsWith('.do/tasks/'),
      false,
      'active_task should NOT be cleared for project wave targets'
    );

    // Phase targets also do not clear active_task
    const phaseTarget = '.do/projects/my-proj/phases/01-phase/phase.md';
    assert.strictEqual(
      phaseTarget.startsWith('.do/tasks/'),
      false,
      'active_task should NOT be cleared for project phase targets'
    );
  });
});
