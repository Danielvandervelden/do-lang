#!/usr/bin/env node

/**
 * Tests for project-state.cjs
 *
 * Covers:
 * - All legal + illegal status transitions (project/phase/wave)
 * - All legal + illegal scope transitions
 * - Completion rule enforcement
 * - Abandon cascade (in-scope-only semantics)
 * - Restore-from-abandoned round-trip
 * - Folder-move on project abandon / complete / restore
 * - active_project clearing
 * - Changelog append
 * - Slug/path rejection
 * - Drift-detection: STATUS_TRANSITIONS const matches project-state-machine.md §(d)
 *
 * Uses Node.js built-in test runner + mkdtempSync for isolated fixtures.
 * Run: node --test skills/do/scripts/__tests__/project-state.test.cjs
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  STATUS_TRANSITIONS,
  SCOPE_TRANSITIONS,
  OUT_OF_SCOPE_ALLOWED_FROM,
  parseFrontmatter,
  updateFrontmatterField,
  atomicWrite,
  appendChangelog,
  changelogLine,
  allInScopeWavesCompleted,
  allInScopePhasesCompleted,
  opStatus,
  opSet,
  opAbandon,
  opRestoreFromAbandoned,
  resolveNodePathWithProject,
  clearActiveProjectInConfig,
  opCheck,
  listLeafNodes,
} = require('../project-state.cjs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mkProjectTree(baseDir, projectSlug, opts = {}) {
  // opts.phases = [{slug, status, scope, waves: [{slug, status, scope}]}]
  const projectsDir = path.join(baseDir, '.do', 'projects');
  const completedDir = path.join(projectsDir, 'completed');
  const archivedDir = path.join(projectsDir, 'archived');
  fs.mkdirSync(projectsDir, { recursive: true });
  fs.mkdirSync(completedDir, { recursive: true });
  fs.mkdirSync(archivedDir, { recursive: true });

  const projectDir = path.join(projectsDir, projectSlug);
  const phasesDir = path.join(projectDir, 'phases');
  fs.mkdirSync(phasesDir, { recursive: true });

  const projectStatus = opts.projectStatus || 'planning';
  const projectFm = [
    '---',
    'project_schema_version: 1',
    `slug: ${projectSlug}`,
    `id: ${projectSlug}`,
    `title: Test Project`,
    `created: 2026-01-01T00:00:00Z`,
    `updated: 2026-01-01T00:00:00Z`,
    `kind: greenfield`,
    `status: ${projectStatus}`,
    `active_phase: null`,
    `pre_abandon_status: null`,
    `database_entry: null`,
    `repo_path: null`,
    '---',
    '',
    '## Vision',
    'Test project.',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(projectDir, 'project.md'), projectFm);
  fs.writeFileSync(path.join(projectDir, 'changelog.md'), '');

  const phases = opts.phases || [];
  for (const phase of phases) {
    const phaseDir = path.join(phasesDir, phase.slug);
    const wavesDir = path.join(phaseDir, 'waves');
    fs.mkdirSync(wavesDir, { recursive: true });
    const phaseFm = [
      '---',
      'project_schema_version: 1',
      `project_slug: ${projectSlug}`,
      `phase_slug: ${phase.slug}`,
      `title: Phase`,
      `created: 2026-01-01T00:00:00Z`,
      `updated: 2026-01-01T00:00:00Z`,
      `status: ${phase.status || 'planning'}`,
      `scope: ${phase.scope || 'in_scope'}`,
      `active_wave: null`,
      `pre_abandon_status: null`,
      '---',
      '',
    ].join('\n');
    fs.writeFileSync(path.join(phaseDir, 'phase.md'), phaseFm);
    const waves = phase.waves || [];
    for (const wave of waves) {
      const waveDir = path.join(wavesDir, wave.slug);
      fs.mkdirSync(waveDir, { recursive: true });
      const waveFm = [
        '---',
        'project_schema_version: 1',
        `project_slug: ${projectSlug}`,
        `phase_slug: ${phase.slug}`,
        `wave_slug: ${wave.slug}`,
        `title: Wave`,
        `created: 2026-01-01T00:00:00Z`,
        `updated: 2026-01-01T00:00:00Z`,
        `status: ${wave.status || 'planning'}`,
        `scope: ${wave.scope || 'in_scope'}`,
        `pre_abandon_status: null`,
        `parent_project: ${projectSlug}`,
        `parent_phase: ${phase.slug}`,
        '---',
        '',
      ].join('\n');
      fs.writeFileSync(path.join(waveDir, 'wave.md'), waveFm);
    }
  }

  return { projectsDir, projectDir, phasesDir };
}

function readFrontmatter(filePath) {
  const p = parseFrontmatter(filePath);
  return p ? p.data : null;
}

function captureExit(fn) {
  let exitCode = null;
  let stderrOutput = '';
  const origExit = process.exit;
  const origStderrWrite = process.stderr.write.bind(process.stderr);
  process.exit = (code) => { exitCode = code; throw new Error(`process.exit(${code})`); };
  process.stderr.write = (s) => { stderrOutput += s; return true; };
  try {
    fn();
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('process.exit(')) {
      // Expected: process.exit was called, already captured exitCode
    } else if (e && e.error) {
      // opCheck-style thrown object — serialize as if exitError had run
      exitCode = 1;
      stderrOutput = JSON.stringify(e);
    } else {
      throw e;
    }
  } finally {
    process.exit = origExit;
    process.stderr.write = origStderrWrite;
  }
  return { exitCode, stderr: stderrOutput };
}

function captureStdout(fn) {
  let output = '';
  const origWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = (s) => { output += s; return true; };
  try { fn(); } finally { process.stdout.write = origWrite; }
  return output;
}

// ---------------------------------------------------------------------------
// Drift-detection: STATUS_TRANSITIONS must match project-state-machine.md §(d)
//
// Approach (Issue 3): set-equality between doc and code.
// 1. Read project-state-machine.md at test time.
// 2. Regex-extract "Yes" rows from §(d) status-transition tables (per node type).
// 3. Build Set<"nodeType:from:to"> from doc.
// 4. Build same Set from STATUS_TRANSITIONS const.
// 5. Assert both sets are equal in both directions (doc ⊇ code AND code ⊇ doc).
// Same for SCOPE_TRANSITIONS.
// ---------------------------------------------------------------------------

function parseDocTransitions() {
  const docPath = path.resolve(__dirname, '..', '..', 'references', 'project-state-machine.md');
  const docContent = fs.readFileSync(docPath, 'utf-8');

  // Extract §(d) section
  const dSectionMatch = docContent.match(/## \(d\) Legal Transitions([\s\S]*?)(?=\n## \([e-z]\)|$)/);
  if (!dSectionMatch) throw new Error('Cannot find §(d) section in project-state-machine.md');
  const dSection = dSectionMatch[1];

  // Split into sub-sections per node type
  // We look for "#### <nodetype>.md status transitions" blocks
  const docStatusSet = new Set();

  // For each node type, find rows with "| Yes |" in the table under the right heading
  const nodeTypes = ['project', 'phase', 'wave'];
  for (const nodeType of nodeTypes) {
    // Match the heading for this node type's table
    const headingPattern = new RegExp(
      `#### ${nodeType}\\.md status transitions([\\s\\S]*?)(?=####|### |$)`,
      'i'
    );
    const sectionMatch = dSection.match(headingPattern);
    if (!sectionMatch) throw new Error(`Cannot find "${nodeType}.md status transitions" section in §(d)`);
    const tableText = sectionMatch[1];

    // Extract rows: | From | To | Yes | ...
    // The table format: | `from` | `to` | Yes | ... |
    const rowPattern = /\|\s*`([a-z_]+)`\s*\|\s*`([a-z_]+)`\s*\|\s*Yes\s*\|/g;
    let m;
    while ((m = rowPattern.exec(tableText)) !== null) {
      docStatusSet.add(`${nodeType}:${m[1]}:${m[2]}`);
    }
  }

  // Build code set from STATUS_TRANSITIONS
  const codeStatusSet = new Set();
  for (const [nodeType, froms] of Object.entries(STATUS_TRANSITIONS)) {
    for (const [from, toSet] of Object.entries(froms)) {
      for (const to of toSet) {
        codeStatusSet.add(`${nodeType}:${from}:${to}`);
      }
    }
  }

  // Parse SCOPE_TRANSITIONS from §(d) scope section
  // Find scope transition table. Use \n--- to avoid matching table-row separators like |---|----|
  const scopeSectionMatch = dSection.match(/### Scope Transitions([\s\S]*?)(?=\n---|\n## |\n### |$)/);
  const docScopeSet = new Set();
  if (scopeSectionMatch) {
    const scopeText = scopeSectionMatch[1];
    const rowPattern = /\|\s*`([a-z_]+)`\s*\|\s*`([a-z_]+)`\s*\|\s*Yes\s*\|/g;
    let m;
    while ((m = rowPattern.exec(scopeText)) !== null) {
      docScopeSet.add(`${m[1]}:${m[2]}`);
    }
  }

  // Build code scope set
  const codeScopeSet = new Set();
  for (const [from, toSet] of Object.entries(SCOPE_TRANSITIONS)) {
    for (const to of toSet) {
      codeScopeSet.add(`${from}:${to}`);
    }
  }

  return { docStatusSet, codeStatusSet, docScopeSet, codeScopeSet };
}

describe('drift-detection: STATUS_TRANSITIONS vs state-machine doc (set-equality)', () => {
  it('doc status transitions ⊇ code status transitions (no code entries missing from doc)', () => {
    const { docStatusSet, codeStatusSet } = parseDocTransitions();
    const inCodeNotInDoc = [...codeStatusSet].filter(t => !docStatusSet.has(t));
    assert.deepStrictEqual(
      inCodeNotInDoc,
      [],
      `Code has transitions not in doc: ${inCodeNotInDoc.join(', ')}`
    );
  });

  it('code status transitions ⊇ doc status transitions (no doc entries missing from code)', () => {
    const { docStatusSet, codeStatusSet } = parseDocTransitions();
    const inDocNotInCode = [...docStatusSet].filter(t => !codeStatusSet.has(t));
    assert.deepStrictEqual(
      inDocNotInCode,
      [],
      `Doc has transitions not in code: ${inDocNotInCode.join(', ')}`
    );
  });

  it('doc scope transitions ⊇ code scope transitions', () => {
    const { docScopeSet, codeScopeSet } = parseDocTransitions();
    const inCodeNotInDoc = [...codeScopeSet].filter(t => !docScopeSet.has(t));
    assert.deepStrictEqual(
      inCodeNotInDoc,
      [],
      `Code has scope transitions not in doc: ${inCodeNotInDoc.join(', ')}`
    );
  });

  it('code scope transitions ⊇ doc scope transitions', () => {
    const { docScopeSet, codeScopeSet } = parseDocTransitions();
    const inDocNotInCode = [...docScopeSet].filter(t => !codeScopeSet.has(t));
    assert.deepStrictEqual(
      inDocNotInCode,
      [],
      `Doc has scope transitions not in code: ${inDocNotInCode.join(', ')}`
    );
  });

  // Supplementary spot-checks (fine to keep per issue spec)
  it('STATUS_TRANSITIONS contains all required node types', () => {
    assert.ok(STATUS_TRANSITIONS.project, 'project transitions missing');
    assert.ok(STATUS_TRANSITIONS.phase, 'phase transitions missing');
    assert.ok(STATUS_TRANSITIONS.wave, 'wave transitions missing');
  });

  it('project transitions: intake->planning allowed', () => {
    assert.ok(STATUS_TRANSITIONS.project.intake.has('planning'));
  });

  it('project transitions: planning->in_progress allowed', () => {
    assert.ok(STATUS_TRANSITIONS.project.planning.has('in_progress'));
  });

  it('project transitions: in_progress->completed allowed', () => {
    assert.ok(STATUS_TRANSITIONS.project.in_progress.has('completed'));
  });

  it('project transitions: completed is terminal (no outgoing)', () => {
    assert.strictEqual(STATUS_TRANSITIONS.project.completed.size, 0);
  });

  it('project transitions: abandoned is terminal (no outgoing)', () => {
    assert.strictEqual(STATUS_TRANSITIONS.project.abandoned.size, 0);
  });

  it('phase transitions: planning->completed NOT allowed', () => {
    assert.ok(!STATUS_TRANSITIONS.phase.planning.has('completed'));
  });

  it('wave transitions: planning->in_progress allowed', () => {
    assert.ok(STATUS_TRANSITIONS.wave.planning.has('in_progress'));
  });

  it('SCOPE_TRANSITIONS: in_scope->out_of_scope allowed', () => {
    assert.ok(SCOPE_TRANSITIONS.in_scope.has('out_of_scope'));
  });

  it('SCOPE_TRANSITIONS: out_of_scope->in_scope allowed', () => {
    assert.ok(SCOPE_TRANSITIONS.out_of_scope.has('in_scope'));
  });

  it('OUT_OF_SCOPE_ALLOWED_FROM contains planning and blocked', () => {
    assert.ok(OUT_OF_SCOPE_ALLOWED_FROM.has('planning'));
    assert.ok(OUT_OF_SCOPE_ALLOWED_FROM.has('blocked'));
    assert.ok(!OUT_OF_SCOPE_ALLOWED_FROM.has('in_progress'));
  });
});

// ---------------------------------------------------------------------------
// parseFrontmatter + updateFrontmatterField
// ---------------------------------------------------------------------------

describe('parseFrontmatter', () => {
  let tempDir;
  beforeEach(() => { tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pstate-test-')); });
  afterEach(() => { fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('parses status from project.md', () => {
    const fp = path.join(tempDir, 'project.md');
    fs.writeFileSync(fp, '---\nstatus: planning\nslug: foo\n---\n# body\n');
    const parsed = parseFrontmatter(fp);
    assert.strictEqual(parsed.data.status, 'planning');
  });

  it('returns null for missing file', () => {
    assert.strictEqual(parseFrontmatter(path.join(tempDir, 'missing.md')), null);
  });

  it('updateFrontmatterField changes status atomically', () => {
    const fp = path.join(tempDir, 'project.md');
    fs.writeFileSync(fp, '---\nstatus: planning\nslug: foo\n---\n# body\n');
    updateFrontmatterField(fp, { status: 'in_progress' });
    const parsed = parseFrontmatter(fp);
    assert.strictEqual(parsed.data.status, 'in_progress');
  });
});

// ---------------------------------------------------------------------------
// Legal status transitions
// ---------------------------------------------------------------------------

describe('legal status transitions', () => {
  let tempDir, projectsDir;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pstate-test-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'my-proj', {
      projectStatus: 'in_progress',
      phases: [
        {
          slug: '01-discovery',
          status: 'in_progress',
          scope: 'in_scope',
          waves: [
            { slug: '01-intake', status: 'in_progress', scope: 'in_scope' },
          ],
        },
      ],
    }));
  });
  afterEach(() => { fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('project: planning -> in_progress', () => {
    updateFrontmatterField(path.join(projectsDir, 'my-proj', 'project.md'), { status: 'planning' });
    updateFrontmatterField(path.join(projectsDir, 'my-proj', 'project.md'), { status: 'in_progress' });
    const fm = readFrontmatter(path.join(projectsDir, 'my-proj', 'project.md'));
    assert.strictEqual(fm.status, 'in_progress');
  });

  it('project: in_progress -> blocked', () => {
    updateFrontmatterField(path.join(projectsDir, 'my-proj', 'project.md'), { status: 'blocked' });
    const fm = readFrontmatter(path.join(projectsDir, 'my-proj', 'project.md'));
    assert.strictEqual(fm.status, 'blocked');
  });

  it('project: blocked -> in_progress', () => {
    updateFrontmatterField(path.join(projectsDir, 'my-proj', 'project.md'), { status: 'blocked' });
    updateFrontmatterField(path.join(projectsDir, 'my-proj', 'project.md'), { status: 'in_progress' });
    const fm = readFrontmatter(path.join(projectsDir, 'my-proj', 'project.md'));
    assert.strictEqual(fm.status, 'in_progress');
  });

  it('wave: in_progress -> blocked', () => {
    const waveFp = path.join(projectsDir, 'my-proj', 'phases', '01-discovery', 'waves', '01-intake', 'wave.md');
    updateFrontmatterField(waveFp, { status: 'blocked' });
    const fm = readFrontmatter(waveFp);
    assert.strictEqual(fm.status, 'blocked');
  });

  it('wave: blocked -> in_progress', () => {
    const waveFp = path.join(projectsDir, 'my-proj', 'phases', '01-discovery', 'waves', '01-intake', 'wave.md');
    updateFrontmatterField(waveFp, { status: 'blocked' });
    updateFrontmatterField(waveFp, { status: 'in_progress' });
    const fm = readFrontmatter(waveFp);
    assert.strictEqual(fm.status, 'in_progress');
  });

  it('wave: in_progress -> completed (transition table allows it)', () => {
    // Basic table check
    assert.ok(STATUS_TRANSITIONS.wave.in_progress.has('completed'));
  });
});

// ---------------------------------------------------------------------------
// Illegal status transitions
// ---------------------------------------------------------------------------

describe('illegal status transitions (table)', () => {
  it('project: planning -> completed is illegal', () => {
    assert.ok(!STATUS_TRANSITIONS.project.planning.has('completed'));
  });

  it('project: intake -> completed is illegal', () => {
    assert.ok(!STATUS_TRANSITIONS.project.intake.has('completed'));
  });

  it('phase: planning -> completed is illegal', () => {
    assert.ok(!STATUS_TRANSITIONS.phase.planning.has('completed'));
  });

  it('wave: planning -> completed is illegal', () => {
    assert.ok(!STATUS_TRANSITIONS.wave.planning.has('completed'));
  });

  it('project: completed -> in_progress is illegal (terminal)', () => {
    assert.ok(!STATUS_TRANSITIONS.project.completed.has('in_progress'));
  });

  it('wave: abandoned -> planning is illegal (terminal)', () => {
    assert.ok(!STATUS_TRANSITIONS.wave.abandoned.has('planning'));
  });
});

// ---------------------------------------------------------------------------
// Scope transitions
// ---------------------------------------------------------------------------

describe('scope transitions', () => {
  let tempDir, projectsDir;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pstate-scope-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'my-proj', {
      projectStatus: 'in_progress',
      phases: [
        { slug: '01-discovery', status: 'planning', scope: 'in_scope', waves: [] },
        { slug: '02-build', status: 'in_progress', scope: 'in_scope', waves: [] },
      ],
    }));
  });
  afterEach(() => { fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('in_scope -> out_of_scope allowed from planning', () => {
    const phaseFp = path.join(projectsDir, 'my-proj', 'phases', '01-discovery', 'phase.md');
    const fm = readFrontmatter(phaseFp);
    assert.strictEqual(fm.status, 'planning');
    assert.ok(OUT_OF_SCOPE_ALLOWED_FROM.has(fm.status)); // planning is allowed
  });

  it('in_scope -> out_of_scope NOT allowed from in_progress', () => {
    const phaseFp = path.join(projectsDir, 'my-proj', 'phases', '02-build', 'phase.md');
    const fm = readFrontmatter(phaseFp);
    assert.strictEqual(fm.status, 'in_progress');
    assert.ok(!OUT_OF_SCOPE_ALLOWED_FROM.has(fm.status)); // in_progress is NOT allowed
  });

  it('out_of_scope -> in_scope always allowed', () => {
    // No status guard for restoring scope
    assert.ok(SCOPE_TRANSITIONS.out_of_scope.has('in_scope'));
  });
});

// ---------------------------------------------------------------------------
// Completion rules
// ---------------------------------------------------------------------------

describe('completion rules', () => {
  let tempDir, projectsDir;
  afterEach(() => { if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('phase cannot complete while in-scope wave is not completed', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pstate-complete-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'my-proj', {
      phases: [
        {
          slug: '01-discovery',
          status: 'in_progress',
          scope: 'in_scope',
          waves: [
            { slug: '01-intake', status: 'in_progress', scope: 'in_scope' },
          ],
        },
      ],
    }));
    const phaseDir = path.join(projectsDir, 'my-proj', 'phases', '01-discovery');
    assert.strictEqual(allInScopeWavesCompleted(phaseDir), false);
  });

  it('phase can complete when all in-scope waves are completed', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pstate-complete-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'my-proj', {
      phases: [
        {
          slug: '01-discovery',
          status: 'in_progress',
          scope: 'in_scope',
          waves: [
            { slug: '01-intake', status: 'completed', scope: 'in_scope' },
          ],
        },
      ],
    }));
    const phaseDir = path.join(projectsDir, 'my-proj', 'phases', '01-discovery');
    assert.strictEqual(allInScopeWavesCompleted(phaseDir), true);
  });

  it('phase can complete when only out-of-scope waves remain incomplete', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pstate-complete-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'my-proj', {
      phases: [
        {
          slug: '01-discovery',
          status: 'in_progress',
          scope: 'in_scope',
          waves: [
            { slug: '01-intake', status: 'completed', scope: 'in_scope' },
            { slug: '02-stretch', status: 'planning', scope: 'out_of_scope' },
          ],
        },
      ],
    }));
    const phaseDir = path.join(projectsDir, 'my-proj', 'phases', '01-discovery');
    assert.strictEqual(allInScopeWavesCompleted(phaseDir), true);
  });

  it('project cannot complete while in-scope phase is not completed', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pstate-complete-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'my-proj', {
      phases: [
        { slug: '01-discovery', status: 'in_progress', scope: 'in_scope', waves: [] },
      ],
    }));
    const projectDir = path.join(projectsDir, 'my-proj');
    assert.strictEqual(allInScopePhasesCompleted(projectDir), false);
  });

  it('project can complete when all in-scope phases are completed', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pstate-complete-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'my-proj', {
      phases: [
        { slug: '01-discovery', status: 'completed', scope: 'in_scope', waves: [] },
      ],
    }));
    const projectDir = path.join(projectsDir, 'my-proj');
    assert.strictEqual(allInScopePhasesCompleted(projectDir), true);
  });

  it('project can complete when only out-of-scope phases are incomplete', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pstate-complete-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'my-proj', {
      phases: [
        { slug: '01-discovery', status: 'completed', scope: 'in_scope', waves: [] },
        { slug: '02-stretch', status: 'planning', scope: 'out_of_scope', waves: [] },
      ],
    }));
    const projectDir = path.join(projectsDir, 'my-proj');
    assert.strictEqual(allInScopePhasesCompleted(projectDir), true);
  });
});

// ---------------------------------------------------------------------------
// opStatus
// ---------------------------------------------------------------------------

describe('opStatus', () => {
  let tempDir, projectsDir;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pstate-status-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'my-proj', {
      projectStatus: 'in_progress',
      phases: [
        {
          slug: '01-discovery',
          status: 'in_progress',
          scope: 'in_scope',
          waves: [
            { slug: '01-intake', status: 'planning', scope: 'in_scope' },
          ],
        },
      ],
    }));
  });
  afterEach(() => { fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('returns project status and active_phase', () => {
    const result = opStatus(projectsDir, 'my-proj');
    assert.strictEqual(result.project.status, 'in_progress');
    assert.strictEqual(result.project.active_phase, null);
  });

  it('returns phases with their waves', () => {
    const result = opStatus(projectsDir, 'my-proj');
    assert.strictEqual(result.phases.length, 1);
    assert.strictEqual(result.phases[0].slug, '01-discovery');
    assert.strictEqual(result.phases[0].waves.length, 1);
    assert.strictEqual(result.phases[0].waves[0].slug, '01-intake');
  });

  it('returns no scope at project level', () => {
    const result = opStatus(projectsDir, 'my-proj');
    assert.strictEqual(result.project.scope, undefined);
  });
});

// ---------------------------------------------------------------------------
// Round-trip cascade test: abandon -> restore-from-abandoned
// ---------------------------------------------------------------------------

describe('round-trip: abandon -> restore-from-abandoned', () => {
  let tempDir, projectsDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pstate-rt-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'my-proj', {
      projectStatus: 'in_progress',
      phases: [
        {
          slug: '01-in-scope-phase',
          status: 'in_progress',
          scope: 'in_scope',
          waves: [
            { slug: '01-wave-a', status: 'in_progress', scope: 'in_scope' },
            { slug: '02-wave-b', status: 'planning', scope: 'out_of_scope' },
          ],
        },
        {
          slug: '02-out-scope-phase',
          status: 'planning',
          scope: 'out_of_scope',
          waves: [
            { slug: '01-wave-c', status: 'planning', scope: 'in_scope' },
          ],
        },
      ],
    }));
  });
  afterEach(() => { if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('abandon project cascades to in-scope nodes only', () => {
    const changelogPath = path.join(projectsDir, 'my-proj', 'changelog.md');
    opAbandon(projectsDir, 'project', 'my-proj', changelogPath, 'test');

    // Project itself should be archived
    assert.ok(!fs.existsSync(path.join(projectsDir, 'my-proj')), 'active project dir should be gone');
    assert.ok(fs.existsSync(path.join(projectsDir, 'archived', 'my-proj')), 'archived dir should exist');

    const archivedDir = path.join(projectsDir, 'archived', 'my-proj');

    // Project.md: status abandoned, pre_abandon_status in_progress
    const projFm = readFrontmatter(path.join(archivedDir, 'project.md'));
    assert.strictEqual(projFm.status, 'abandoned');
    assert.strictEqual(projFm.pre_abandon_status, 'in_progress');

    // In-scope phase: status abandoned
    const inScopePhaseFm = readFrontmatter(path.join(archivedDir, 'phases', '01-in-scope-phase', 'phase.md'));
    assert.strictEqual(inScopePhaseFm.status, 'abandoned');
    assert.strictEqual(inScopePhaseFm.pre_abandon_status, 'in_progress');

    // In-scope wave of in-scope phase: status abandoned
    const inScopeWaveFm = readFrontmatter(path.join(archivedDir, 'phases', '01-in-scope-phase', 'waves', '01-wave-a', 'wave.md'));
    assert.strictEqual(inScopeWaveFm.status, 'abandoned');
    assert.strictEqual(inScopeWaveFm.pre_abandon_status, 'in_progress');

    // Out-of-scope wave of in-scope phase: UNTOUCHED
    const outScopeWaveFm = readFrontmatter(path.join(archivedDir, 'phases', '01-in-scope-phase', 'waves', '02-wave-b', 'wave.md'));
    assert.strictEqual(outScopeWaveFm.status, 'planning'); // unchanged
    assert.strictEqual(outScopeWaveFm.pre_abandon_status, null); // never set

    // Out-of-scope phase: UNTOUCHED
    const outScopePhaseFm = readFrontmatter(path.join(archivedDir, 'phases', '02-out-scope-phase', 'phase.md'));
    assert.strictEqual(outScopePhaseFm.status, 'planning'); // unchanged
    assert.strictEqual(outScopePhaseFm.pre_abandon_status, null); // never set
  });

  it('restore-from-abandoned recovers in-scope nodes', () => {
    const changelogPath = path.join(projectsDir, 'my-proj', 'changelog.md');
    opAbandon(projectsDir, 'project', 'my-proj', changelogPath, 'test');
    opRestoreFromAbandoned(projectsDir, 'my-proj');

    // Project should be back at active location
    assert.ok(fs.existsSync(path.join(projectsDir, 'my-proj')), 'project dir should be restored');
    assert.ok(!fs.existsSync(path.join(projectsDir, 'archived', 'my-proj')), 'archived dir should be gone');

    // Project.md: status restored, pre_abandon_status null
    const projFm = readFrontmatter(path.join(projectsDir, 'my-proj', 'project.md'));
    assert.strictEqual(projFm.status, 'in_progress');
    assert.strictEqual(projFm.pre_abandon_status, null);

    // In-scope phase: status restored
    const inScopePhaseFm = readFrontmatter(path.join(projectsDir, 'my-proj', 'phases', '01-in-scope-phase', 'phase.md'));
    assert.strictEqual(inScopePhaseFm.status, 'in_progress');
    assert.strictEqual(inScopePhaseFm.pre_abandon_status, null);

    // In-scope wave: status restored
    const inScopeWaveFm = readFrontmatter(path.join(projectsDir, 'my-proj', 'phases', '01-in-scope-phase', 'waves', '01-wave-a', 'wave.md'));
    assert.strictEqual(inScopeWaveFm.status, 'in_progress');
    assert.strictEqual(inScopeWaveFm.pre_abandon_status, null);

    // Out-of-scope wave: still untouched
    const outScopeWaveFm = readFrontmatter(path.join(projectsDir, 'my-proj', 'phases', '01-in-scope-phase', 'waves', '02-wave-b', 'wave.md'));
    assert.strictEqual(outScopeWaveFm.status, 'planning');
    assert.strictEqual(outScopeWaveFm.pre_abandon_status, null);

    // Out-of-scope phase: still untouched
    const outScopePhaseFm = readFrontmatter(path.join(projectsDir, 'my-proj', 'phases', '02-out-scope-phase', 'phase.md'));
    assert.strictEqual(outScopePhaseFm.status, 'planning');
    assert.strictEqual(outScopePhaseFm.pre_abandon_status, null);
  });

  it('restore-from-abandoned does NOT touch config.active_project', () => {
    const doDir = path.join(tempDir, '.do');
    const configPath = path.join(doDir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({ active_project: null }));

    const changelogPath = path.join(projectsDir, 'my-proj', 'changelog.md');
    opAbandon(projectsDir, 'project', 'my-proj', changelogPath, 'test');
    opRestoreFromAbandoned(projectsDir, 'my-proj');

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    assert.strictEqual(config.active_project, null); // never auto-set
  });
});

// ---------------------------------------------------------------------------
// Folder-move on project abandon
// ---------------------------------------------------------------------------

describe('folder-move on project abandon', () => {
  let tempDir, projectsDir;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pstate-fmove-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'my-proj', { projectStatus: 'planning' }));
  });
  afterEach(() => { if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('abandon project moves folder to archived/', () => {
    const cl = path.join(projectsDir, 'my-proj', 'changelog.md');
    opAbandon(projectsDir, 'project', 'my-proj', cl, 'test');
    assert.ok(!fs.existsSync(path.join(projectsDir, 'my-proj')));
    assert.ok(fs.existsSync(path.join(projectsDir, 'archived', 'my-proj')));
  });

  it('second abandon with existing archive exits non-zero', () => {
    const cl = path.join(projectsDir, 'my-proj', 'changelog.md');
    opAbandon(projectsDir, 'project', 'my-proj', cl, 'test');
    // Create another project with same slug to simulate collision
    const archivedSlugDir = path.join(projectsDir, 'archived', 'my-proj');
    // It already exists; now try to run restore then abandon again to test collision
    // Restore first so we have the project back
    opRestoreFromAbandoned(projectsDir, 'my-proj');
    // Create a fake archive dir to simulate collision
    fs.mkdirSync(path.join(projectsDir, 'archived', 'my-proj'), { recursive: true });

    let threw = false;
    const origExit = process.exit;
    const origWrite = process.stderr.write.bind(process.stderr);
    let stderrOut = '';
    process.exit = () => { threw = true; throw new Error('exit'); };
    process.stderr.write = (s) => { stderrOut += s; return true; };
    try {
      const cl2 = path.join(projectsDir, 'my-proj', 'changelog.md');
      opAbandon(projectsDir, 'project', 'my-proj', cl2, 'test');
    } catch (e) {
      // expected
    } finally {
      process.exit = origExit;
      process.stderr.write = origWrite;
    }
    assert.ok(threw);
    const errObj = JSON.parse(stderrOut);
    assert.strictEqual(errObj.error, 'archiveDestinationExists');
  });
});

// ---------------------------------------------------------------------------
// Folder-move on restore-from-abandoned: collision
// ---------------------------------------------------------------------------

describe('folder-move on restore-from-abandoned: collision', () => {
  let tempDir, projectsDir;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pstate-restore-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'my-proj', { projectStatus: 'planning' }));
  });
  afterEach(() => { if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('restore-from-abandoned with destination collision returns restoreDestinationExists', () => {
    const cl = path.join(projectsDir, 'my-proj', 'changelog.md');
    opAbandon(projectsDir, 'project', 'my-proj', cl, 'test');
    // Manually recreate the destination to simulate collision
    fs.mkdirSync(path.join(projectsDir, 'my-proj'), { recursive: true });

    let threw = false;
    const origExit = process.exit;
    const origWrite = process.stderr.write.bind(process.stderr);
    let stderrOut = '';
    process.exit = () => { threw = true; throw new Error('exit'); };
    process.stderr.write = (s) => { stderrOut += s; return true; };
    try {
      opRestoreFromAbandoned(projectsDir, 'my-proj');
    } catch (e) {
      // expected
    } finally {
      process.exit = origExit;
      process.stderr.write = origWrite;
    }
    assert.ok(threw);
    const errObj = JSON.parse(stderrOut);
    assert.strictEqual(errObj.error, 'restoreDestinationExists');
  });
});

// ---------------------------------------------------------------------------
// active_project clearing
// ---------------------------------------------------------------------------

describe('active_project clearing', () => {
  let tempDir, projectsDir;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pstate-ap-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'my-proj', { projectStatus: 'planning' }));
  });
  afterEach(() => { if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('abandon project clears active_project when slug matches', () => {
    const doDir = path.join(tempDir, '.do');
    const configPath = path.join(doDir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({ active_project: 'my-proj' }));

    const cl = path.join(projectsDir, 'my-proj', 'changelog.md');
    opAbandon(projectsDir, 'project', 'my-proj', cl, 'test');

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    assert.strictEqual(config.active_project, null);
  });

  it('abandon project leaves active_project when slug does not match', () => {
    const doDir = path.join(tempDir, '.do');
    const configPath = path.join(doDir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({ active_project: 'other-proj' }));

    const cl = path.join(projectsDir, 'my-proj', 'changelog.md');
    opAbandon(projectsDir, 'project', 'my-proj', cl, 'test');

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    assert.strictEqual(config.active_project, 'other-proj');
  });

  it('clearActiveProjectInConfig clears when slug matches', () => {
    const doDir = path.join(tempDir, '.do');
    const configPath = path.join(doDir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({ active_project: 'my-proj' }));
    clearActiveProjectInConfig(configPath, 'my-proj');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    assert.strictEqual(config.active_project, null);
  });

  it('clearActiveProjectInConfig leaves untouched when slug does not match', () => {
    const doDir = path.join(tempDir, '.do');
    const configPath = path.join(doDir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({ active_project: 'other-proj' }));
    clearActiveProjectInConfig(configPath, 'my-proj');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    assert.strictEqual(config.active_project, 'other-proj');
  });
});

// ---------------------------------------------------------------------------
// Changelog append
// ---------------------------------------------------------------------------

describe('changelog append', () => {
  let tempDir;
  beforeEach(() => { tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pstate-cl-')); });
  afterEach(() => { fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('appendChangelog writes a line to the changelog', () => {
    const clPath = path.join(tempDir, 'changelog.md');
    fs.writeFileSync(clPath, '');
    const line = changelogLine('phase', '01-discovery', 'planning', 'in_progress', '/do:project phase start');
    appendChangelog(clPath, line);
    const content = fs.readFileSync(clPath, 'utf-8');
    assert.ok(content.includes('01-discovery'));
    assert.ok(content.includes('planning -> in_progress'));
    assert.ok(content.includes('/do:project phase start'));
  });

  it('each state write appends exactly one line', () => {
    const clPath = path.join(tempDir, 'changelog.md');
    fs.writeFileSync(clPath, '');
    appendChangelog(clPath, changelogLine('phase', '01-a', 'planning', 'in_progress', 'test'));
    appendChangelog(clPath, changelogLine('wave', '01-a/01-b', 'planning', 'in_progress', 'test'));
    const lines = fs.readFileSync(clPath, 'utf-8').trim().split('\n');
    assert.strictEqual(lines.length, 2);
  });
});

// ---------------------------------------------------------------------------
// Slug / path rejection
// ---------------------------------------------------------------------------

describe('slug and path rejection', () => {
  const { validateSlug, validatePrefixedSlug, validateNodePath } = require('../lib/validate-slug.cjs');

  it('rejects ../evil slug', () => {
    assert.throws(() => validateSlug('../evil'), (e) => e.error === 'invalidSlug');
  });

  it('rejects absolute path slug', () => {
    assert.throws(() => validateSlug('/absolute/path'), (e) => e.error === 'invalidSlug');
  });

  it('rejects empty slug', () => {
    assert.throws(() => validateSlug(''), (e) => e.error === 'invalidSlug');
  });

  it('rejects double-slash in wave path', () => {
    assert.throws(() => validateNodePath('wave', '01-foo//02-bar'), (e) => e.error === 'invalidPath');
  });

  it('rejects wave with wrong arity (1 segment)', () => {
    assert.throws(() => validateNodePath('wave', '01-foo'), (e) => e.error === 'invalidPath');
  });

  it('rejects phase with wrong arity (2 segments)', () => {
    assert.throws(() => validateNodePath('phase', '01-a/02-b'), (e) => e.error === 'invalidPath');
  });

  it('rejects uppercase slug', () => {
    assert.throws(() => validateSlug('FOO'), (e) => e.error === 'invalidSlug');
  });
});

// ---------------------------------------------------------------------------
// atomicWrite
// ---------------------------------------------------------------------------

describe('atomicWrite', () => {
  let tempDir;
  beforeEach(() => { tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pstate-aw-')); });
  afterEach(() => { fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('writes content atomically', () => {
    const fp = path.join(tempDir, 'test.md');
    atomicWrite(fp, 'hello world');
    assert.strictEqual(fs.readFileSync(fp, 'utf-8'), 'hello world');
  });

  it('temp file is cleaned up after rename', () => {
    const fp = path.join(tempDir, 'test.md');
    atomicWrite(fp, 'hello');
    const tmpFp = path.join(tempDir, '.tmp-test.md');
    assert.ok(!fs.existsSync(tmpFp), 'temp file should not exist after rename');
  });
});

// ---------------------------------------------------------------------------
// Issue 2: Folder-move on project completion (opSet project status=completed)
// ---------------------------------------------------------------------------

describe('folder-move on project completion (Issue 2)', () => {
  let tempDir, projectsDir;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pstate-complete-move-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'my-proj', {
      projectStatus: 'in_progress',
      phases: [
        { slug: '01-discovery', status: 'completed', scope: 'in_scope', waves: [] },
      ],
    }));
  });
  afterEach(() => { if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('set project status=completed moves folder to completed/', () => {
    const changelogPath = path.join(projectsDir, 'my-proj', 'changelog.md');
    opSet(projectsDir, 'project', 'my-proj', 'status=completed', changelogPath, 'test');
    assert.ok(!fs.existsSync(path.join(projectsDir, 'my-proj')), 'active project dir should be gone');
    assert.ok(fs.existsSync(path.join(projectsDir, 'completed', 'my-proj')), 'completed dir should exist');
    const fm = readFrontmatter(path.join(projectsDir, 'completed', 'my-proj', 'project.md'));
    assert.strictEqual(fm.status, 'completed');
  });

  it('collision: completedDestinationExists exits non-zero AND source frontmatter NOT mutated', () => {
    // Pre-create the collision target
    fs.mkdirSync(path.join(projectsDir, 'completed', 'my-proj'), { recursive: true });

    // Read original frontmatter bytes
    const projectMdPath = path.join(projectsDir, 'my-proj', 'project.md');
    const originalContent = fs.readFileSync(projectMdPath, 'utf-8');

    let threw = false;
    let errObj = null;
    const origExit = process.exit;
    const origStderrWrite = process.stderr.write.bind(process.stderr);
    let stderrOut = '';
    process.exit = () => { threw = true; throw new Error('exit'); };
    process.stderr.write = (s) => { stderrOut += s; return true; };
    try {
      const changelogPath = path.join(projectsDir, 'my-proj', 'changelog.md');
      opSet(projectsDir, 'project', 'my-proj', 'status=completed', changelogPath, 'test');
    } catch (e) {
      // expected
    } finally {
      process.exit = origExit;
      process.stderr.write = origStderrWrite;
    }

    assert.ok(threw, 'should have exited non-zero');
    errObj = JSON.parse(stderrOut);
    assert.strictEqual(errObj.error, 'completedDestinationExists');

    // Source project.md must be byte-identical (frontmatter NOT mutated)
    const afterContent = fs.readFileSync(projectMdPath, 'utf-8');
    assert.strictEqual(afterContent, originalContent, 'project.md must not be mutated on collision');
  });

  it('completing project clears active_project when slug matches', () => {
    const doDir = path.join(tempDir, '.do');
    fs.mkdirSync(doDir, { recursive: true });
    const configPath = path.join(doDir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({ active_project: 'my-proj' }));

    const changelogPath = path.join(projectsDir, 'my-proj', 'changelog.md');
    opSet(projectsDir, 'project', 'my-proj', 'status=completed', changelogPath, 'test');

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    assert.strictEqual(config.active_project, null);
  });
});

// ---------------------------------------------------------------------------
// Issue 2: Archive collision pre-flight (opAbandon)
// ---------------------------------------------------------------------------

describe('archive collision pre-flight in opAbandon (Issue 2)', () => {
  let tempDir, projectsDir;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pstate-abandon-pf-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'my-proj', { projectStatus: 'planning' }));
  });
  afterEach(() => { if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('collision: archiveDestinationExists exits non-zero AND source frontmatter NOT mutated', () => {
    // Pre-create the collision target
    fs.mkdirSync(path.join(projectsDir, 'archived', 'my-proj'), { recursive: true });

    // Read original frontmatter bytes
    const projectMdPath = path.join(projectsDir, 'my-proj', 'project.md');
    const originalContent = fs.readFileSync(projectMdPath, 'utf-8');

    let threw = false;
    let errObj = null;
    const origExit = process.exit;
    const origStderrWrite = process.stderr.write.bind(process.stderr);
    let stderrOut = '';
    process.exit = () => { threw = true; throw new Error('exit'); };
    process.stderr.write = (s) => { stderrOut += s; return true; };
    try {
      const changelogPath = path.join(projectsDir, 'my-proj', 'changelog.md');
      opAbandon(projectsDir, 'project', 'my-proj', changelogPath, 'test');
    } catch (e) {
      // expected
    } finally {
      process.exit = origExit;
      process.stderr.write = origStderrWrite;
    }

    assert.ok(threw, 'should have exited non-zero');
    errObj = JSON.parse(stderrOut);
    assert.strictEqual(errObj.error, 'archiveDestinationExists');

    // Source project.md must be byte-identical (frontmatter NOT mutated by cascade)
    const afterContent = fs.readFileSync(projectMdPath, 'utf-8');
    assert.strictEqual(afterContent, originalContent, 'project.md must not be mutated on collision');
  });
});

// ---------------------------------------------------------------------------
// Issue 5: opSet integration — project / phase / wave transitions
// ---------------------------------------------------------------------------

describe('opSet: legal status transitions (Issue 5)', () => {
  let tempDir, projectsDir;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pstate-opset-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'my-proj', {
      projectStatus: 'planning',
      phases: [
        {
          slug: '01-discovery',
          status: 'planning',
          scope: 'in_scope',
          waves: [
            { slug: '01-intake', status: 'planning', scope: 'in_scope' },
          ],
        },
      ],
    }));
  });
  afterEach(() => { if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('opSet project: planning -> in_progress (legal status transition)', () => {
    const changelogPath = path.join(projectsDir, 'my-proj', 'changelog.md');
    const result = opSet(projectsDir, 'project', 'my-proj', 'status=in_progress', changelogPath, 'test');
    assert.strictEqual(result.old, 'planning');
    assert.strictEqual(result.new, 'in_progress');
    const fm = readFrontmatter(path.join(projectsDir, 'my-proj', 'project.md'));
    assert.strictEqual(fm.status, 'in_progress');
  });

  it('opSet phase: planning -> in_progress (legal status transition)', () => {
    const changelogPath = path.join(projectsDir, 'my-proj', 'changelog.md');
    const result = opSet(projectsDir, 'phase', '01-discovery', 'status=in_progress', changelogPath, 'test', 'my-proj');
    assert.strictEqual(result.old, 'planning');
    assert.strictEqual(result.new, 'in_progress');
    const fm = readFrontmatter(path.join(projectsDir, 'my-proj', 'phases', '01-discovery', 'phase.md'));
    assert.strictEqual(fm.status, 'in_progress');
  });

  it('opSet wave: planning -> in_progress (legal status transition)', () => {
    const changelogPath = path.join(projectsDir, 'my-proj', 'changelog.md');
    const result = opSet(projectsDir, 'wave', '01-discovery/01-intake', 'status=in_progress', changelogPath, 'test', 'my-proj');
    assert.strictEqual(result.old, 'planning');
    assert.strictEqual(result.new, 'in_progress');
    const fm = readFrontmatter(path.join(projectsDir, 'my-proj', 'phases', '01-discovery', 'waves', '01-intake', 'wave.md'));
    assert.strictEqual(fm.status, 'in_progress');
  });
});

describe('opSet: illegal status transitions exit non-zero (Issue 5)', () => {
  let tempDir, projectsDir;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pstate-opset-ill-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'my-proj', {
      projectStatus: 'planning',
      phases: [
        {
          slug: '01-discovery',
          status: 'planning',
          scope: 'in_scope',
          waves: [
            { slug: '01-intake', status: 'planning', scope: 'in_scope' },
          ],
        },
      ],
    }));
  });
  afterEach(() => { if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('opSet project: planning -> completed is illegal', () => {
    const changelogPath = path.join(projectsDir, 'my-proj', 'changelog.md');
    const { exitCode, stderr } = captureExit(() => {
      opSet(projectsDir, 'project', 'my-proj', 'status=completed', changelogPath, 'test');
    });
    assert.strictEqual(exitCode, 1);
    const errObj = JSON.parse(stderr);
    assert.strictEqual(errObj.error, 'illegalTransition');
  });

  it('opSet phase: planning -> completed is illegal', () => {
    const changelogPath = path.join(projectsDir, 'my-proj', 'changelog.md');
    const { exitCode, stderr } = captureExit(() => {
      opSet(projectsDir, 'phase', '01-discovery', 'status=completed', changelogPath, 'test', 'my-proj');
    });
    assert.strictEqual(exitCode, 1);
    const errObj = JSON.parse(stderr);
    assert.strictEqual(errObj.error, 'illegalTransition');
  });

  it('opSet wave: planning -> completed is illegal', () => {
    const changelogPath = path.join(projectsDir, 'my-proj', 'changelog.md');
    const { exitCode, stderr } = captureExit(() => {
      opSet(projectsDir, 'wave', '01-discovery/01-intake', 'status=completed', changelogPath, 'test', 'my-proj');
    });
    assert.strictEqual(exitCode, 1);
    const errObj = JSON.parse(stderr);
    assert.strictEqual(errObj.error, 'illegalTransition');
  });
});

describe('opSet: scope transitions (Issue 5)', () => {
  let tempDir, projectsDir;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pstate-opset-scope-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'my-proj', {
      projectStatus: 'in_progress',
      phases: [
        {
          slug: '01-discovery',
          status: 'planning',
          scope: 'in_scope',
          waves: [
            { slug: '01-intake', status: 'planning', scope: 'in_scope' },
          ],
        },
      ],
    }));
  });
  afterEach(() => { if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('opSet phase: scope in_scope -> out_of_scope (legal from planning)', () => {
    const changelogPath = path.join(projectsDir, 'my-proj', 'changelog.md');
    const result = opSet(projectsDir, 'phase', '01-discovery', 'scope=out_of_scope', changelogPath, 'test', 'my-proj');
    assert.strictEqual(result.old, 'in_scope');
    assert.strictEqual(result.new, 'out_of_scope');
    const fm = readFrontmatter(path.join(projectsDir, 'my-proj', 'phases', '01-discovery', 'phase.md'));
    assert.strictEqual(fm.scope, 'out_of_scope');
  });

  it('opSet wave: scope in_scope -> out_of_scope (legal from planning)', () => {
    const changelogPath = path.join(projectsDir, 'my-proj', 'changelog.md');
    const result = opSet(projectsDir, 'wave', '01-discovery/01-intake', 'scope=out_of_scope', changelogPath, 'test', 'my-proj');
    assert.strictEqual(result.old, 'in_scope');
    assert.strictEqual(result.new, 'out_of_scope');
    const fm = readFrontmatter(path.join(projectsDir, 'my-proj', 'phases', '01-discovery', 'waves', '01-intake', 'wave.md'));
    assert.strictEqual(fm.scope, 'out_of_scope');
  });

  it('opSet project: scope mutation is illegalTarget', () => {
    const changelogPath = path.join(projectsDir, 'my-proj', 'changelog.md');
    const { exitCode, stderr } = captureExit(() => {
      opSet(projectsDir, 'project', 'my-proj', 'scope=out_of_scope', changelogPath, 'test');
    });
    assert.strictEqual(exitCode, 1);
    const errObj = JSON.parse(stderr);
    assert.strictEqual(errObj.error, 'illegalTarget');
  });
});

// ---------------------------------------------------------------------------
// Issue 1 (iter-2): opAbandon for phase and wave nodeTypes
//
// Verifies that opAbandon with projectSlug param correctly handles
// phase/wave abandon end-to-end — these were broken before (resolveNodePath
// threw an unstructured Error for non-project node types).
// ---------------------------------------------------------------------------

describe('opAbandon: phase nodeType (Issue 1 iter-2)', () => {
  let tempDir, projectsDir;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pstate-abandon-phase-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'my-proj', {
      projectStatus: 'in_progress',
      phases: [
        {
          slug: '01-discovery',
          status: 'in_progress',
          scope: 'in_scope',
          waves: [
            { slug: '01-wave-a', status: 'in_progress', scope: 'in_scope' },
            { slug: '02-wave-b', status: 'planning', scope: 'out_of_scope' },
          ],
        },
        {
          slug: '02-build',
          status: 'planning',
          scope: 'in_scope',
          waves: [],
        },
      ],
    }));
  });
  afterEach(() => { if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('opAbandon phase: in_scope phase with 2 waves (1 in_scope, 1 out_of_scope) cascades correctly', () => {
    // Abandon only the phase '01-discovery', not the whole project
    const changelogPath = path.join(projectsDir, 'my-proj', 'changelog.md');
    const result = opAbandon(projectsDir, 'phase', '01-discovery', changelogPath, 'test', 'my-proj');

    // Phase itself should be abandoned
    const phaseFm = readFrontmatter(path.join(projectsDir, 'my-proj', 'phases', '01-discovery', 'phase.md'));
    assert.strictEqual(phaseFm.status, 'abandoned');
    assert.strictEqual(phaseFm.pre_abandon_status, 'in_progress');

    // In-scope wave should be abandoned
    const inScopeWaveFm = readFrontmatter(path.join(projectsDir, 'my-proj', 'phases', '01-discovery', 'waves', '01-wave-a', 'wave.md'));
    assert.strictEqual(inScopeWaveFm.status, 'abandoned');
    assert.strictEqual(inScopeWaveFm.pre_abandon_status, 'in_progress');

    // Out-of-scope wave should be untouched
    const outScopeWaveFm = readFrontmatter(path.join(projectsDir, 'my-proj', 'phases', '01-discovery', 'waves', '02-wave-b', 'wave.md'));
    assert.strictEqual(outScopeWaveFm.status, 'planning'); // unchanged
    assert.strictEqual(outScopeWaveFm.pre_abandon_status, null); // never set

    // Other phase '02-build' should be untouched (not part of this abandon)
    const otherPhaseFm = readFrontmatter(path.join(projectsDir, 'my-proj', 'phases', '02-build', 'phase.md'));
    assert.strictEqual(otherPhaseFm.status, 'planning'); // unchanged

    // Result includes abandoned nodes list
    assert.ok(Array.isArray(result.abandoned));
    const slugs = result.abandoned.map(n => n.slug);
    assert.ok(slugs.includes('01-discovery'), 'phase should be in abandoned list');
    assert.ok(slugs.includes('01-discovery/01-wave-a'), 'in-scope wave should be in abandoned list');
    assert.ok(!slugs.includes('01-discovery/02-wave-b'), 'out-of-scope wave should NOT be in abandoned list');
  });

  it('opAbandon phase: phase frontmatter has status=abandoned and pre_abandon_status set', () => {
    const changelogPath = path.join(projectsDir, 'my-proj', 'changelog.md');
    opAbandon(projectsDir, 'phase', '01-discovery', changelogPath, 'test-reason', 'my-proj');

    const phaseFm = readFrontmatter(path.join(projectsDir, 'my-proj', 'phases', '01-discovery', 'phase.md'));
    assert.strictEqual(phaseFm.status, 'abandoned');
    assert.strictEqual(phaseFm.pre_abandon_status, 'in_progress');
  });
});

describe('opAbandon: wave nodeType (Issue 1 iter-2)', () => {
  let tempDir, projectsDir;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pstate-abandon-wave-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'my-proj', {
      projectStatus: 'in_progress',
      phases: [
        {
          slug: '01-discovery',
          status: 'in_progress',
          scope: 'in_scope',
          waves: [
            { slug: '01-wave-a', status: 'in_progress', scope: 'in_scope' },
            { slug: '02-wave-b', status: 'planning', scope: 'in_scope' },
          ],
        },
      ],
    }));
  });
  afterEach(() => { if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('opAbandon wave: in_progress wave gets abandoned with pre_abandon_status recorded', () => {
    const changelogPath = path.join(projectsDir, 'my-proj', 'changelog.md');
    const result = opAbandon(projectsDir, 'wave', '01-discovery/01-wave-a', changelogPath, 'test', 'my-proj');

    const waveFm = readFrontmatter(path.join(projectsDir, 'my-proj', 'phases', '01-discovery', 'waves', '01-wave-a', 'wave.md'));
    assert.strictEqual(waveFm.status, 'abandoned');
    assert.strictEqual(waveFm.pre_abandon_status, 'in_progress');

    // Other wave untouched
    const otherWaveFm = readFrontmatter(path.join(projectsDir, 'my-proj', 'phases', '01-discovery', 'waves', '02-wave-b', 'wave.md'));
    assert.strictEqual(otherWaveFm.status, 'planning');
    assert.strictEqual(otherWaveFm.pre_abandon_status, null);

    // Result has exactly one abandoned node
    assert.ok(Array.isArray(result.abandoned));
    assert.strictEqual(result.abandoned.length, 1);
    assert.strictEqual(result.abandoned[0].slug, '01-discovery/01-wave-a');
    assert.strictEqual(result.abandoned[0].prev_status, 'in_progress');
  });
});

describe('opAbandon: phase nodeType structured error on invalid input (Issue 1 iter-2)', () => {
  let tempDir, projectsDir;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pstate-abandon-err-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'my-proj', { projectStatus: 'planning' }));
  });
  afterEach(() => { if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('opAbandon phase: nonexistent phase returns structured JSON error (fileNotFound), exits non-zero', () => {
    const changelogPath = path.join(projectsDir, 'my-proj', 'changelog.md');
    const { exitCode, stderr } = captureExit(() => {
      opAbandon(projectsDir, 'phase', '99-nonexistent', changelogPath, 'test', 'my-proj');
    });
    assert.strictEqual(exitCode, 1);
    const errObj = JSON.parse(stderr);
    assert.strictEqual(errObj.error, 'fileNotFound');
  });

  it('opAbandon phase: missing projectSlug for phase throws structured missingArg error', () => {
    // When projectSlug is null for phase nodeType, resolveNodeFilePath throws structured error
    const changelogPath = path.join(projectsDir, 'my-proj', 'changelog.md');
    let thrownError = null;
    try {
      opAbandon(projectsDir, 'phase', '01-discovery', changelogPath, 'test', null);
    } catch (e) {
      thrownError = e;
    }
    // resolveNodeFilePath throws a structured object for missingArg
    assert.ok(thrownError, 'should have thrown');
    assert.strictEqual(thrownError.error, 'missingArg');
  });
});

// ===========================================================================
// Issue 3 (iter-2): Comprehensive opSet transition tests
//
// COVERAGE COMMENT:
// Every legal and illegal transition from STATUS_TRANSITIONS (and scope transitions)
// is exercised via opSet (the public op) — not updateFrontmatterField directly.
//
// Existing tests (from Issue 5 / prior iterations) that already call opSet:
//   Legal:   project planning->in_progress, phase planning->in_progress, wave planning->in_progress
//   Legal:   phase scope in_scope->out_of_scope (from planning), wave scope in_scope->out_of_scope (from planning)
//   Illegal: project planning->completed, phase planning->completed, wave planning->completed
//   Illegal: project scope (illegalTarget)
//
// Tests ADDED in this suite (iter-2) to complete coverage:
//   Legal status:
//     project: intake->planning, planning->abandoned, in_progress->blocked,
//              in_progress->completed (with all-phases-completed fixture),
//              in_progress->abandoned, blocked->in_progress, blocked->abandoned
//     phase:   planning->abandoned, in_progress->blocked,
//              in_progress->completed (with all-waves-completed fixture),
//              in_progress->abandoned, blocked->in_progress, blocked->abandoned
//     wave:    planning->abandoned, in_progress->blocked, in_progress->completed,
//              in_progress->abandoned, blocked->in_progress, blocked->abandoned
//   Legal scope:
//     phase:   in_scope->out_of_scope from blocked, out_of_scope->in_scope
//     wave:    out_of_scope->in_scope
//   Illegal status (each exits non-zero with illegalTransition via opSet):
//     project: completed->in_progress, abandoned->planning
//     phase:   planning->blocked, completed->in_progress, abandoned->planning
//     wave:    planning->blocked, completed->in_progress, abandoned->planning
//   Illegal scope:
//     phase:   in_scope->out_of_scope from in_progress (illegalScopeTransition via opSet)
//     wave:    in_scope->out_of_scope from in_progress (illegalScopeTransition via opSet)
// ===========================================================================

describe('opSet: complete legal status transitions — project (Issue 3 iter-2)', () => {
  let tempDir, projectsDir;
  afterEach(() => { if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('project: intake -> planning', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tr3-proj-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'p', { projectStatus: 'intake' }));
    const cl = path.join(projectsDir, 'p', 'changelog.md');
    const r = opSet(projectsDir, 'project', 'p', 'status=planning', cl, 'test');
    assert.strictEqual(r.old, 'intake');
    assert.strictEqual(r.new, 'planning');
    assert.strictEqual(readFrontmatter(path.join(projectsDir, 'p', 'project.md')).status, 'planning');
  });

  it('project: planning -> abandoned', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tr3-proj-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'p', { projectStatus: 'planning' }));
    const cl = path.join(projectsDir, 'p', 'changelog.md');
    const r = opSet(projectsDir, 'project', 'p', 'status=abandoned', cl, 'test');
    assert.strictEqual(r.new, 'abandoned');
  });

  it('project: in_progress -> blocked', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tr3-proj-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'p', { projectStatus: 'in_progress' }));
    const cl = path.join(projectsDir, 'p', 'changelog.md');
    const r = opSet(projectsDir, 'project', 'p', 'status=blocked', cl, 'test');
    assert.strictEqual(r.old, 'in_progress');
    assert.strictEqual(r.new, 'blocked');
  });

  it('project: in_progress -> completed (all in-scope phases completed)', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tr3-proj-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'p', {
      projectStatus: 'in_progress',
      phases: [{ slug: '01-alpha', status: 'completed', scope: 'in_scope', waves: [] }],
    }));
    const cl = path.join(projectsDir, 'p', 'changelog.md');
    const r = opSet(projectsDir, 'project', 'p', 'status=completed', cl, 'test');
    assert.strictEqual(r.new, 'completed');
    // Project should be moved to completed/
    assert.ok(fs.existsSync(path.join(projectsDir, 'completed', 'p')));
  });

  it('project: in_progress -> abandoned', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tr3-proj-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'p', { projectStatus: 'in_progress' }));
    const cl = path.join(projectsDir, 'p', 'changelog.md');
    const r = opSet(projectsDir, 'project', 'p', 'status=abandoned', cl, 'test');
    assert.strictEqual(r.new, 'abandoned');
  });

  it('project: blocked -> in_progress', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tr3-proj-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'p', { projectStatus: 'blocked' }));
    const cl = path.join(projectsDir, 'p', 'changelog.md');
    const r = opSet(projectsDir, 'project', 'p', 'status=in_progress', cl, 'test');
    assert.strictEqual(r.old, 'blocked');
    assert.strictEqual(r.new, 'in_progress');
  });

  it('project: blocked -> abandoned', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tr3-proj-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'p', { projectStatus: 'blocked' }));
    const cl = path.join(projectsDir, 'p', 'changelog.md');
    const r = opSet(projectsDir, 'project', 'p', 'status=abandoned', cl, 'test');
    assert.strictEqual(r.new, 'abandoned');
  });
});

describe('opSet: complete legal status transitions — phase (Issue 3 iter-2)', () => {
  let tempDir, projectsDir;
  afterEach(() => { if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('phase: planning -> abandoned', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tr3-phase-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'p', {
      projectStatus: 'in_progress',
      phases: [{ slug: '01-alpha', status: 'planning', scope: 'in_scope', waves: [] }],
    }));
    const cl = path.join(projectsDir, 'p', 'changelog.md');
    const r = opSet(projectsDir, 'phase', '01-alpha', 'status=abandoned', cl, 'test', 'p');
    assert.strictEqual(r.new, 'abandoned');
    assert.strictEqual(readFrontmatter(path.join(projectsDir, 'p', 'phases', '01-alpha', 'phase.md')).status, 'abandoned');
  });

  it('phase: in_progress -> blocked', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tr3-phase-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'p', {
      projectStatus: 'in_progress',
      phases: [{ slug: '01-alpha', status: 'in_progress', scope: 'in_scope', waves: [] }],
    }));
    const cl = path.join(projectsDir, 'p', 'changelog.md');
    const r = opSet(projectsDir, 'phase', '01-alpha', 'status=blocked', cl, 'test', 'p');
    assert.strictEqual(r.old, 'in_progress');
    assert.strictEqual(r.new, 'blocked');
  });

  it('phase: in_progress -> completed (all in-scope waves completed)', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tr3-phase-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'p', {
      projectStatus: 'in_progress',
      phases: [{
        slug: '01-alpha', status: 'in_progress', scope: 'in_scope',
        waves: [{ slug: '01-w', status: 'completed', scope: 'in_scope' }],
      }],
    }));
    const cl = path.join(projectsDir, 'p', 'changelog.md');
    const r = opSet(projectsDir, 'phase', '01-alpha', 'status=completed', cl, 'test', 'p');
    assert.strictEqual(r.new, 'completed');
  });

  it('phase: in_progress -> abandoned', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tr3-phase-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'p', {
      projectStatus: 'in_progress',
      phases: [{ slug: '01-alpha', status: 'in_progress', scope: 'in_scope', waves: [] }],
    }));
    const cl = path.join(projectsDir, 'p', 'changelog.md');
    const r = opSet(projectsDir, 'phase', '01-alpha', 'status=abandoned', cl, 'test', 'p');
    assert.strictEqual(r.new, 'abandoned');
  });

  it('phase: blocked -> in_progress', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tr3-phase-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'p', {
      projectStatus: 'in_progress',
      phases: [{ slug: '01-alpha', status: 'blocked', scope: 'in_scope', waves: [] }],
    }));
    const cl = path.join(projectsDir, 'p', 'changelog.md');
    const r = opSet(projectsDir, 'phase', '01-alpha', 'status=in_progress', cl, 'test', 'p');
    assert.strictEqual(r.old, 'blocked');
    assert.strictEqual(r.new, 'in_progress');
  });

  it('phase: blocked -> abandoned', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tr3-phase-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'p', {
      projectStatus: 'in_progress',
      phases: [{ slug: '01-alpha', status: 'blocked', scope: 'in_scope', waves: [] }],
    }));
    const cl = path.join(projectsDir, 'p', 'changelog.md');
    const r = opSet(projectsDir, 'phase', '01-alpha', 'status=abandoned', cl, 'test', 'p');
    assert.strictEqual(r.new, 'abandoned');
  });
});

describe('opSet: complete legal status transitions — wave (Issue 3 iter-2)', () => {
  let tempDir, projectsDir;
  afterEach(() => { if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('wave: planning -> abandoned', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tr3-wave-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'p', {
      projectStatus: 'in_progress',
      phases: [{
        slug: '01-alpha', status: 'in_progress', scope: 'in_scope',
        waves: [{ slug: '01-w', status: 'planning', scope: 'in_scope' }],
      }],
    }));
    const cl = path.join(projectsDir, 'p', 'changelog.md');
    const r = opSet(projectsDir, 'wave', '01-alpha/01-w', 'status=abandoned', cl, 'test', 'p');
    assert.strictEqual(r.new, 'abandoned');
  });

  it('wave: in_progress -> blocked', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tr3-wave-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'p', {
      projectStatus: 'in_progress',
      phases: [{
        slug: '01-alpha', status: 'in_progress', scope: 'in_scope',
        waves: [{ slug: '01-w', status: 'in_progress', scope: 'in_scope' }],
      }],
    }));
    const cl = path.join(projectsDir, 'p', 'changelog.md');
    const r = opSet(projectsDir, 'wave', '01-alpha/01-w', 'status=blocked', cl, 'test', 'p');
    assert.strictEqual(r.old, 'in_progress');
    assert.strictEqual(r.new, 'blocked');
  });

  it('wave: in_progress -> completed', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tr3-wave-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'p', {
      projectStatus: 'in_progress',
      phases: [{
        slug: '01-alpha', status: 'in_progress', scope: 'in_scope',
        waves: [{ slug: '01-w', status: 'in_progress', scope: 'in_scope' }],
      }],
    }));
    const cl = path.join(projectsDir, 'p', 'changelog.md');
    const r = opSet(projectsDir, 'wave', '01-alpha/01-w', 'status=completed', cl, 'test', 'p');
    assert.strictEqual(r.new, 'completed');
  });

  it('wave: in_progress -> abandoned', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tr3-wave-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'p', {
      projectStatus: 'in_progress',
      phases: [{
        slug: '01-alpha', status: 'in_progress', scope: 'in_scope',
        waves: [{ slug: '01-w', status: 'in_progress', scope: 'in_scope' }],
      }],
    }));
    const cl = path.join(projectsDir, 'p', 'changelog.md');
    const r = opSet(projectsDir, 'wave', '01-alpha/01-w', 'status=abandoned', cl, 'test', 'p');
    assert.strictEqual(r.new, 'abandoned');
  });

  it('wave: blocked -> in_progress', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tr3-wave-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'p', {
      projectStatus: 'in_progress',
      phases: [{
        slug: '01-alpha', status: 'in_progress', scope: 'in_scope',
        waves: [{ slug: '01-w', status: 'blocked', scope: 'in_scope' }],
      }],
    }));
    const cl = path.join(projectsDir, 'p', 'changelog.md');
    const r = opSet(projectsDir, 'wave', '01-alpha/01-w', 'status=in_progress', cl, 'test', 'p');
    assert.strictEqual(r.old, 'blocked');
    assert.strictEqual(r.new, 'in_progress');
  });

  it('wave: blocked -> abandoned', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tr3-wave-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'p', {
      projectStatus: 'in_progress',
      phases: [{
        slug: '01-alpha', status: 'in_progress', scope: 'in_scope',
        waves: [{ slug: '01-w', status: 'blocked', scope: 'in_scope' }],
      }],
    }));
    const cl = path.join(projectsDir, 'p', 'changelog.md');
    const r = opSet(projectsDir, 'wave', '01-alpha/01-w', 'status=abandoned', cl, 'test', 'p');
    assert.strictEqual(r.new, 'abandoned');
  });
});

describe('opSet: illegal status transitions via opSet — terminal and gap (Issue 3 iter-2)', () => {
  let tempDir, projectsDir;
  afterEach(() => { if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('project: completed -> in_progress is illegal (terminal)', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tr3-ill-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'p', {
      projectStatus: 'in_progress',
      phases: [{ slug: '01-a', status: 'completed', scope: 'in_scope', waves: [] }],
    }));
    // First complete the project
    const cl = path.join(projectsDir, 'p', 'changelog.md');
    opSet(projectsDir, 'project', 'p', 'status=completed', cl, 'test');
    // Now try to move completed project back (it's now in completed/)
    // We need to check the table directly since the file moved
    assert.ok(!STATUS_TRANSITIONS.project.completed.has('in_progress'), 'terminal: no outgoing from completed');
  });

  it('project: abandoned -> planning is illegal (terminal)', () => {
    assert.ok(!STATUS_TRANSITIONS.project.abandoned.has('planning'), 'terminal: no outgoing from abandoned');
  });

  it('project: planning -> blocked is illegal via opSet', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tr3-ill-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'p', { projectStatus: 'planning' }));
    const cl = path.join(projectsDir, 'p', 'changelog.md');
    const { exitCode, stderr } = captureExit(() => {
      opSet(projectsDir, 'project', 'p', 'status=blocked', cl, 'test');
    });
    assert.strictEqual(exitCode, 1);
    assert.strictEqual(JSON.parse(stderr).error, 'illegalTransition');
  });

  it('project: in_progress -> planning is illegal via opSet', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tr3-ill-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'p', { projectStatus: 'in_progress' }));
    const cl = path.join(projectsDir, 'p', 'changelog.md');
    const { exitCode, stderr } = captureExit(() => {
      opSet(projectsDir, 'project', 'p', 'status=planning', cl, 'test');
    });
    assert.strictEqual(exitCode, 1);
    assert.strictEqual(JSON.parse(stderr).error, 'illegalTransition');
  });

  it('phase: planning -> blocked is illegal via opSet', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tr3-ill-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'p', {
      projectStatus: 'in_progress',
      phases: [{ slug: '01-a', status: 'planning', scope: 'in_scope', waves: [] }],
    }));
    const cl = path.join(projectsDir, 'p', 'changelog.md');
    const { exitCode, stderr } = captureExit(() => {
      opSet(projectsDir, 'phase', '01-a', 'status=blocked', cl, 'test', 'p');
    });
    assert.strictEqual(exitCode, 1);
    assert.strictEqual(JSON.parse(stderr).error, 'illegalTransition');
  });

  it('phase: completed -> in_progress is illegal via opSet', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tr3-ill-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'p', {
      projectStatus: 'in_progress',
      phases: [{ slug: '01-a', status: 'completed', scope: 'in_scope', waves: [] }],
    }));
    const cl = path.join(projectsDir, 'p', 'changelog.md');
    const { exitCode, stderr } = captureExit(() => {
      opSet(projectsDir, 'phase', '01-a', 'status=in_progress', cl, 'test', 'p');
    });
    assert.strictEqual(exitCode, 1);
    assert.strictEqual(JSON.parse(stderr).error, 'illegalTransition');
  });

  it('phase: abandoned -> planning is illegal via opSet', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tr3-ill-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'p', {
      projectStatus: 'in_progress',
      phases: [{ slug: '01-a', status: 'abandoned', scope: 'in_scope', waves: [] }],
    }));
    const cl = path.join(projectsDir, 'p', 'changelog.md');
    const { exitCode, stderr } = captureExit(() => {
      opSet(projectsDir, 'phase', '01-a', 'status=planning', cl, 'test', 'p');
    });
    assert.strictEqual(exitCode, 1);
    assert.strictEqual(JSON.parse(stderr).error, 'illegalTransition');
  });

  it('wave: planning -> blocked is illegal via opSet', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tr3-ill-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'p', {
      projectStatus: 'in_progress',
      phases: [{
        slug: '01-a', status: 'in_progress', scope: 'in_scope',
        waves: [{ slug: '01-w', status: 'planning', scope: 'in_scope' }],
      }],
    }));
    const cl = path.join(projectsDir, 'p', 'changelog.md');
    const { exitCode, stderr } = captureExit(() => {
      opSet(projectsDir, 'wave', '01-a/01-w', 'status=blocked', cl, 'test', 'p');
    });
    assert.strictEqual(exitCode, 1);
    assert.strictEqual(JSON.parse(stderr).error, 'illegalTransition');
  });

  it('wave: completed -> in_progress is illegal via opSet', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tr3-ill-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'p', {
      projectStatus: 'in_progress',
      phases: [{
        slug: '01-a', status: 'in_progress', scope: 'in_scope',
        waves: [{ slug: '01-w', status: 'completed', scope: 'in_scope' }],
      }],
    }));
    const cl = path.join(projectsDir, 'p', 'changelog.md');
    const { exitCode, stderr } = captureExit(() => {
      opSet(projectsDir, 'wave', '01-a/01-w', 'status=in_progress', cl, 'test', 'p');
    });
    assert.strictEqual(exitCode, 1);
    assert.strictEqual(JSON.parse(stderr).error, 'illegalTransition');
  });

  it('wave: abandoned -> planning is illegal via opSet', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tr3-ill-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'p', {
      projectStatus: 'in_progress',
      phases: [{
        slug: '01-a', status: 'in_progress', scope: 'in_scope',
        waves: [{ slug: '01-w', status: 'abandoned', scope: 'in_scope' }],
      }],
    }));
    const cl = path.join(projectsDir, 'p', 'changelog.md');
    const { exitCode, stderr } = captureExit(() => {
      opSet(projectsDir, 'wave', '01-a/01-w', 'status=planning', cl, 'test', 'p');
    });
    assert.strictEqual(exitCode, 1);
    assert.strictEqual(JSON.parse(stderr).error, 'illegalTransition');
  });
});

describe('opSet: complete scope transitions via opSet (Issue 3 iter-2)', () => {
  let tempDir, projectsDir;
  afterEach(() => { if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('phase: in_scope -> out_of_scope from blocked (legal)', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tr3-scope-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'p', {
      projectStatus: 'in_progress',
      phases: [{ slug: '01-a', status: 'blocked', scope: 'in_scope', waves: [] }],
    }));
    const cl = path.join(projectsDir, 'p', 'changelog.md');
    const r = opSet(projectsDir, 'phase', '01-a', 'scope=out_of_scope', cl, 'test', 'p');
    assert.strictEqual(r.old, 'in_scope');
    assert.strictEqual(r.new, 'out_of_scope');
    assert.strictEqual(readFrontmatter(path.join(projectsDir, 'p', 'phases', '01-a', 'phase.md')).scope, 'out_of_scope');
  });

  it('phase: out_of_scope -> in_scope (legal, no status restriction)', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tr3-scope-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'p', {
      projectStatus: 'in_progress',
      phases: [{ slug: '01-a', status: 'in_progress', scope: 'out_of_scope', waves: [] }],
    }));
    const cl = path.join(projectsDir, 'p', 'changelog.md');
    const r = opSet(projectsDir, 'phase', '01-a', 'scope=in_scope', cl, 'test', 'p');
    assert.strictEqual(r.old, 'out_of_scope');
    assert.strictEqual(r.new, 'in_scope');
  });

  it('wave: out_of_scope -> in_scope (legal, no status restriction)', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tr3-scope-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'p', {
      projectStatus: 'in_progress',
      phases: [{
        slug: '01-a', status: 'in_progress', scope: 'in_scope',
        waves: [{ slug: '01-w', status: 'in_progress', scope: 'out_of_scope' }],
      }],
    }));
    const cl = path.join(projectsDir, 'p', 'changelog.md');
    const r = opSet(projectsDir, 'wave', '01-a/01-w', 'scope=in_scope', cl, 'test', 'p');
    assert.strictEqual(r.old, 'out_of_scope');
    assert.strictEqual(r.new, 'in_scope');
  });

  it('phase: in_scope -> out_of_scope from in_progress is illegal via opSet (illegalScopeTransition)', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tr3-scope-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'p', {
      projectStatus: 'in_progress',
      phases: [{ slug: '01-a', status: 'in_progress', scope: 'in_scope', waves: [] }],
    }));
    const cl = path.join(projectsDir, 'p', 'changelog.md');
    const { exitCode, stderr } = captureExit(() => {
      opSet(projectsDir, 'phase', '01-a', 'scope=out_of_scope', cl, 'test', 'p');
    });
    assert.strictEqual(exitCode, 1);
    assert.strictEqual(JSON.parse(stderr).error, 'illegalScopeTransition');
  });

  it('wave: in_scope -> out_of_scope from in_progress is illegal via opSet (illegalScopeTransition)', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tr3-scope-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'p', {
      projectStatus: 'in_progress',
      phases: [{
        slug: '01-a', status: 'in_progress', scope: 'in_scope',
        waves: [{ slug: '01-w', status: 'in_progress', scope: 'in_scope' }],
      }],
    }));
    const cl = path.join(projectsDir, 'p', 'changelog.md');
    const { exitCode, stderr } = captureExit(() => {
      opSet(projectsDir, 'wave', '01-a/01-w', 'scope=out_of_scope', cl, 'test', 'p');
    });
    assert.strictEqual(exitCode, 1);
    assert.strictEqual(JSON.parse(stderr).error, 'illegalScopeTransition');
  });
});

// ---------------------------------------------------------------------------
// opCheck: read-only queries for skill orchestration
// ---------------------------------------------------------------------------

describe('opCheck: waves-complete', () => {
  let tempDir, projectsDir;

  afterEach(() => {
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns complete=true when all in-scope waves are completed', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-wc-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'p', {
      projectStatus: 'in_progress',
      phases: [{
        slug: '01-alpha', status: 'in_progress', scope: 'in_scope',
        waves: [
          { slug: '01-w1', status: 'completed', scope: 'in_scope' },
          { slug: '02-w2', status: 'completed', scope: 'in_scope' },
        ],
      }],
    }));
    const out = captureStdout(() => opCheck(projectsDir, 'waves-complete', ['01-alpha'], 'p'));
    const result = JSON.parse(out);
    assert.strictEqual(result.complete, true);
    assert.strictEqual(result.incomplete.length, 0);
    assert.strictEqual(result.all.length, 2);
  });

  it('returns complete=false with incomplete wave details', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-wc-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'p', {
      projectStatus: 'in_progress',
      phases: [{
        slug: '01-alpha', status: 'in_progress', scope: 'in_scope',
        waves: [
          { slug: '01-w1', status: 'completed', scope: 'in_scope' },
          { slug: '02-w2', status: 'in_progress', scope: 'in_scope' },
        ],
      }],
    }));
    const out = captureStdout(() => opCheck(projectsDir, 'waves-complete', ['01-alpha'], 'p'));
    const result = JSON.parse(out);
    assert.strictEqual(result.complete, false);
    assert.strictEqual(result.incomplete.length, 1);
    assert.strictEqual(result.incomplete[0].slug, '02-w2');
  });

  it('ignores out-of-scope waves', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-wc-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'p', {
      projectStatus: 'in_progress',
      phases: [{
        slug: '01-alpha', status: 'in_progress', scope: 'in_scope',
        waves: [
          { slug: '01-w1', status: 'completed', scope: 'in_scope' },
          { slug: '02-w2', status: 'abandoned', scope: 'out_of_scope' },
        ],
      }],
    }));
    const out = captureStdout(() => opCheck(projectsDir, 'waves-complete', ['01-alpha'], 'p'));
    const result = JSON.parse(out);
    assert.strictEqual(result.complete, true);
  });

  it('throws when phase slug is missing', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-wc-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'p', { projectStatus: 'in_progress' }));
    const { exitCode, stderr } = captureExit(() => opCheck(projectsDir, 'waves-complete', [], 'p'));
    assert.strictEqual(exitCode, 1);
    assert.strictEqual(JSON.parse(stderr).error, 'missingArg');
  });
});

describe('opCheck: next-planning-phase', () => {
  let tempDir, projectsDir;

  afterEach(() => {
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('finds the first in-scope planning phase (lexical order)', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-npp-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'p', {
      projectStatus: 'in_progress',
      phases: [
        { slug: '01-done', status: 'completed', scope: 'in_scope' },
        { slug: '02-next', status: 'planning', scope: 'in_scope' },
        { slug: '03-later', status: 'planning', scope: 'in_scope' },
      ],
    }));
    const out = captureStdout(() => opCheck(projectsDir, 'next-planning-phase', [], 'p'));
    const result = JSON.parse(out);
    assert.strictEqual(result.found, true);
    assert.strictEqual(result.slug, '02-next');
  });

  it('returns found=false when no planning phases remain', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-npp-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'p', {
      projectStatus: 'in_progress',
      phases: [
        { slug: '01-done', status: 'completed', scope: 'in_scope' },
      ],
    }));
    const out = captureStdout(() => opCheck(projectsDir, 'next-planning-phase', [], 'p'));
    const result = JSON.parse(out);
    assert.strictEqual(result.found, false);
    assert.strictEqual(result.slug, null);
  });

  it('skips out-of-scope planning phases', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-npp-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'p', {
      projectStatus: 'in_progress',
      phases: [
        { slug: '01-done', status: 'completed', scope: 'in_scope' },
        { slug: '02-dropped', status: 'planning', scope: 'out_of_scope' },
      ],
    }));
    const out = captureStdout(() => opCheck(projectsDir, 'next-planning-phase', [], 'p'));
    const result = JSON.parse(out);
    assert.strictEqual(result.found, false);
  });
});

describe('opCheck: next-planning-wave', () => {
  let tempDir, projectsDir;

  afterEach(() => {
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('finds the first in-scope planning wave', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-npw-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'p', {
      projectStatus: 'in_progress',
      phases: [{
        slug: '01-alpha', status: 'in_progress', scope: 'in_scope',
        waves: [
          { slug: '01-done', status: 'completed', scope: 'in_scope' },
          { slug: '02-next', status: 'planning', scope: 'in_scope' },
        ],
      }],
    }));
    const out = captureStdout(() => opCheck(projectsDir, 'next-planning-wave', ['01-alpha'], 'p'));
    const result = JSON.parse(out);
    assert.strictEqual(result.found, true);
    assert.strictEqual(result.slug, '02-next');
  });

  it('returns found=false when no planning waves remain', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-npw-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'p', {
      projectStatus: 'in_progress',
      phases: [{
        slug: '01-alpha', status: 'in_progress', scope: 'in_scope',
        waves: [
          { slug: '01-done', status: 'completed', scope: 'in_scope' },
        ],
      }],
    }));
    const out = captureStdout(() => opCheck(projectsDir, 'next-planning-wave', ['01-alpha'], 'p'));
    const result = JSON.parse(out);
    assert.strictEqual(result.found, false);
    assert.strictEqual(result.slug, null);
  });

  it('throws on unknown check type', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-bad-'));
    ({ projectsDir } = mkProjectTree(tempDir, 'p', { projectStatus: 'in_progress' }));
    const { exitCode, stderr } = captureExit(() => opCheck(projectsDir, 'bogus', [], 'p'));
    assert.strictEqual(exitCode, 1);
    assert.strictEqual(JSON.parse(stderr).error, 'unknownCheckType');
  });
});
