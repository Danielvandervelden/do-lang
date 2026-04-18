#!/usr/bin/env node

/**
 * Tests for project-resume.cjs
 *
 * Covers all routing branches:
 * - No active project -> error
 * - Project status: intake -> stage-project-intake
 * - Project status: planning -> stage-project-plan-review
 * - Project status: blocked -> project-blocked
 * - Project status: completed -> already-complete
 * - In-progress + no active phase + all in-scope phases completed -> terminal-pre-complete
 * - In-progress + no active phase + incomplete in-scope phases -> inconsistent-state
 * - In-progress + active phase, phase planning -> stage-phase-plan-review
 * - In-progress + active phase, phase blocked -> phase-blocked
 * - In-progress + active phase, phase in_progress, no active wave -> wave-next-needed
 * - In-progress + active phase + active wave, wave blocked -> wave-blocked
 * - In-progress + active phase + active wave, wave planning -> stage-wave-plan-review
 * - In-progress + active phase + active wave, wave completed -> wave-completed-next-needed
 * - In-progress + active phase + active wave, wave in_progress + execution -> stage-wave-exec
 * - In-progress + active phase + active wave, wave in_progress + verification -> stage-wave-verify
 * - In-progress + active phase + active wave, wave in_progress + execution complete -> stage-wave-code-review
 * - In-progress + active phase + active wave, wave in_progress + review_pending -> stage-wave-code-review
 * - Preamble_targets array correctness for each scope level
 * - Terminal-pre-complete walks phases/ leaf files (NOT project.md phases[] array)
 * - No abandoned branch: status: abandoned is not specially handled (active_project is null after abandon)
 *
 * Uses Node.js built-in test runner + mkdtempSync for isolated fixtures.
 * Run: node --test skills/do/scripts/__tests__/project-resume.test.cjs
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal project tree in a temp directory.
 * Returns { cwd, projectsBase, projectDir } with .do/ structure ready.
 */
function mkProjectTree(opts = {}) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-test-'));
  const doDir = path.join(cwd, '.do');
  const projectsBase = path.join(doDir, 'projects');
  fs.mkdirSync(projectsBase, { recursive: true });

  const slug = opts.slug || 'test-project';
  const projectDir = path.join(projectsBase, slug);
  const phasesDir = path.join(projectDir, 'phases');
  fs.mkdirSync(phasesDir, { recursive: true });

  // Write config.json
  const config = { active_project: opts.active_project !== undefined ? opts.active_project : slug };
  fs.writeFileSync(path.join(doDir, 'config.json'), JSON.stringify(config, null, 2));

  // Write project.md
  const activePhase = opts.active_phase !== undefined ? opts.active_phase : null;
  const projectMd = [
    '---',
    'project_schema_version: 1',
    `slug: ${slug}`,
    `id: ${slug}`,
    'title: Test Project',
    'created: 2026-01-01T00:00:00Z',
    'updated: 2026-01-01T00:00:00Z',
    `status: ${opts.project_status || 'in_progress'}`,
    `active_phase: ${activePhase === null ? 'null' : activePhase}`,
    '---',
    '',
    '## Vision',
    'Test.',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(projectDir, 'project.md'), projectMd);
  fs.writeFileSync(path.join(projectDir, 'changelog.md'), '');

  // Write phases if provided
  for (const ph of (opts.phases || [])) {
    const phaseDir = path.join(phasesDir, ph.slug);
    const wavesDir = path.join(phaseDir, 'waves');
    fs.mkdirSync(wavesDir, { recursive: true });
    const activeWave = ph.active_wave !== undefined ? ph.active_wave : null;
    const phaseMd = [
      '---',
      'project_schema_version: 1',
      `project_slug: ${slug}`,
      `phase_slug: ${ph.slug}`,
      'title: Phase',
      'created: 2026-01-01T00:00:00Z',
      'updated: 2026-01-01T00:00:00Z',
      `status: ${ph.status || 'in_progress'}`,
      `scope: ${ph.scope || 'in_scope'}`,
      `active_wave: ${activeWave === null ? 'null' : activeWave}`,
      '---',
      '',
    ].join('\n');
    fs.writeFileSync(path.join(phaseDir, 'phase.md'), phaseMd);

    // Write waves if provided
    for (const wv of (ph.waves || [])) {
      const waveDir = path.join(wavesDir, wv.slug);
      fs.mkdirSync(waveDir, { recursive: true });
      const waveMd = [
        '---',
        'project_schema_version: 1',
        `project_slug: ${slug}`,
        `phase_slug: ${ph.slug}`,
        `wave_slug: ${wv.slug}`,
        'title: Wave',
        'created: 2026-01-01T00:00:00Z',
        'updated: 2026-01-01T00:00:00Z',
        `status: ${wv.status || 'planning'}`,
        `scope: ${wv.scope || 'in_scope'}`,
        `stage: ${wv.stage || 'execution'}`,
        `stages:`,
        `  execution: ${(wv.stages && wv.stages.execution) || 'pending'}`,
        `  verification: ${(wv.stages && wv.stages.verification) || 'pending'}`,
        '---',
        '',
      ].join('\n');
      fs.writeFileSync(path.join(waveDir, 'wave.md'), waveMd);
    }
  }

  return { cwd, projectsBase, projectDir, phasesDir, slug };
}

/**
 * Invoke computeNextAction by requiring the module with a patched cwd.
 * We monkey-patch process.cwd() temporarily.
 */
function runResume(cwd, slugArg) {
  // We need to call computeNextAction directly.
  // The module uses process.cwd() to find .do/config.json, so we reload it fresh.
  // Clear the require cache for project-resume.cjs each time.
  const modulePath = path.resolve(__dirname, '../project-resume.cjs');
  delete require.cache[modulePath];

  // Temporarily patch cwd
  const origCwd = process.cwd;
  process.cwd = () => cwd;

  let result;
  try {
    // Capture stdout by overriding console.log
    const origLog = console.log;
    let output = null;
    console.log = (msg) => { output = msg; };

    // Temporarily patch process.argv and process.exit
    const origArgv = process.argv;
    const origExit = process.exit;
    process.argv = slugArg ? ['node', 'project-resume.cjs', slugArg] : ['node', 'project-resume.cjs'];
    process.exit = (code) => { throw new Error(`process.exit(${code})`); };

    try {
      require(modulePath);
    } catch (e) {
      if (!e.message.startsWith('process.exit(')) throw e;
    }

    console.log = origLog;
    process.argv = origArgv;
    process.exit = origExit;

    result = output ? JSON.parse(output) : null;
  } finally {
    process.cwd = origCwd;
    delete require.cache[modulePath];
  }

  return result;
}

function rm(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('project-resume.cjs', () => {

  describe('no active project', () => {
    it('returns error when active_project is null in config', () => {
      const { cwd } = mkProjectTree({ active_project: null });
      try {
        const r = runResume(cwd);
        assert.strictEqual(r.action, 'error');
        assert.match(r.summary, /No active project/);
        assert.deepStrictEqual(r.preamble_targets, []);
      } finally {
        rm(cwd);
      }
    });

    it('returns error when .do/config.json missing', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-no-config-'));
      try {
        const r = runResume(tmpDir);
        assert.strictEqual(r.action, 'error');
        assert.match(r.summary, /No \.do\/config\.json/);
      } finally {
        rm(tmpDir);
      }
    });
  });

  describe('project status branches', () => {
    it('intake -> stage-project-intake', () => {
      const { cwd, slug } = mkProjectTree({ project_status: 'intake' });
      try {
        const r = runResume(cwd);
        assert.strictEqual(r.action, 'stage-project-intake');
        assert.strictEqual(r.target_type, 'project');
        assert.strictEqual(r.preamble_targets.length, 1);
        assert.strictEqual(r.preamble_targets[0].type, 'project');
      } finally {
        rm(cwd);
      }
    });

    it('planning -> stage-project-plan-review', () => {
      const { cwd } = mkProjectTree({ project_status: 'planning' });
      try {
        const r = runResume(cwd);
        assert.strictEqual(r.action, 'stage-project-plan-review');
        assert.strictEqual(r.target_type, 'project');
        assert.strictEqual(r.preamble_targets.length, 1);
        assert.strictEqual(r.preamble_targets[0].type, 'project');
      } finally {
        rm(cwd);
      }
    });

    it('blocked -> project-blocked', () => {
      const { cwd } = mkProjectTree({ project_status: 'blocked' });
      try {
        const r = runResume(cwd);
        assert.strictEqual(r.action, 'project-blocked');
        assert.strictEqual(r.target_type, 'project');
        assert.match(r.summary, /blocked/);
        assert.strictEqual(r.preamble_targets.length, 1);
      } finally {
        rm(cwd);
      }
    });

    it('completed -> already-complete', () => {
      const { cwd } = mkProjectTree({ project_status: 'completed' });
      try {
        const r = runResume(cwd);
        assert.strictEqual(r.action, 'already-complete');
        assert.strictEqual(r.target_type, 'project');
        assert.deepStrictEqual(r.preamble_targets, []);
      } finally {
        rm(cwd);
      }
    });

    it('no abandoned branch: status=abandoned is not specially handled (falls through to in_progress branches)', () => {
      // After a project is abandoned, active_project is null in config, so the script
      // never reaches project status checks. The abandoned branch is intentionally absent.
      // Here we verify there is no action='abandoned' routing — any value other than
      // intake/planning/blocked/completed/in_progress falls through to the in_progress logic
      // which then looks at active_phase.
      const { cwd } = mkProjectTree({ project_status: 'abandoned' });
      try {
        const r = runResume(cwd);
        // There should be no 'abandoned' action — it should fall through to
        // inconsistent-state (active_phase is null, no phases folder)
        assert.notStrictEqual(r.action, 'abandoned');
        // With no phases and no active_phase, it hits inconsistent-state
        // (inScopePhases.length === 0, so allCompleted is false)
        assert.strictEqual(r.action, 'inconsistent-state');
      } finally {
        rm(cwd);
      }
    });
  });

  describe('in_progress + no active phase', () => {
    it('terminal-pre-complete: all in-scope phases completed -> walks leaf files', () => {
      const { cwd } = mkProjectTree({
        project_status: 'in_progress',
        active_phase: null,
        phases: [
          { slug: '01-alpha', status: 'completed', scope: 'in_scope' },
          { slug: '02-beta', status: 'completed', scope: 'in_scope' },
          { slug: '03-gamma', status: 'out_of_scope', scope: 'out_of_scope' }
        ]
      });
      try {
        const r = runResume(cwd);
        assert.strictEqual(r.action, 'terminal-pre-complete');
        assert.strictEqual(r.target_type, 'project');
        assert.match(r.summary, /all in-scope phases done/);
        assert.strictEqual(r.preamble_targets.length, 1);
        assert.strictEqual(r.preamble_targets[0].type, 'project');
      } finally {
        rm(cwd);
      }
    });

    it('terminal-pre-complete: does NOT use project.md phases[] for detection (only leaf files)', () => {
      // We construct a project where project.md has NO phases[] but the phases/ folder
      // has leaf phase.md files. Terminal-pre-complete must be detected from the leaf files.
      // If the script relied on project.md phases[], it would incorrectly return inconsistent-state.
      const { cwd, projectDir } = mkProjectTree({
        project_status: 'in_progress',
        active_phase: null,
        phases: [
          { slug: '01-only', status: 'completed', scope: 'in_scope' }
        ]
      });
      try {
        // Overwrite project.md to have no phases[] field at all
        const noPhasesMd = [
          '---',
          'project_schema_version: 1',
          'slug: test-project',
          'id: test-project',
          'title: Test Project',
          'created: 2026-01-01T00:00:00Z',
          'updated: 2026-01-01T00:00:00Z',
          'status: in_progress',
          'active_phase: null',
          '---',
          '',
          '## Vision',
          'Test.',
          '',
        ].join('\n');
        fs.writeFileSync(path.join(projectDir, 'project.md'), noPhasesMd);
        const r = runResume(cwd);
        // Must detect terminal-pre-complete from leaf files even though project.md has no phases[]
        assert.strictEqual(r.action, 'terminal-pre-complete');
      } finally {
        rm(cwd);
      }
    });

    it('inconsistent-state: active_phase null but incomplete in-scope phases exist', () => {
      const { cwd } = mkProjectTree({
        project_status: 'in_progress',
        active_phase: null,
        phases: [
          { slug: '01-alpha', status: 'completed', scope: 'in_scope' },
          { slug: '02-beta', status: 'in_progress', scope: 'in_scope' }
        ]
      });
      try {
        const r = runResume(cwd);
        assert.strictEqual(r.action, 'inconsistent-state');
        assert.strictEqual(r.target_type, 'project');
        assert.match(r.summary, /inconsistent state/);
        assert.deepStrictEqual(r.preamble_targets, []);
      } finally {
        rm(cwd);
      }
    });

    it('inconsistent-state: no phases at all (empty phases dir)', () => {
      const { cwd } = mkProjectTree({
        project_status: 'in_progress',
        active_phase: null,
        phases: []
      });
      try {
        const r = runResume(cwd);
        // inScopePhases.length === 0, so allCompleted is false -> inconsistent-state
        assert.strictEqual(r.action, 'inconsistent-state');
      } finally {
        rm(cwd);
      }
    });
  });

  describe('in_progress + active phase', () => {
    it('phase planning -> stage-phase-plan-review', () => {
      const { cwd } = mkProjectTree({
        project_status: 'in_progress',
        active_phase: '01-alpha',
        phases: [{ slug: '01-alpha', status: 'planning', scope: 'in_scope' }]
      });
      try {
        const r = runResume(cwd);
        assert.strictEqual(r.action, 'stage-phase-plan-review');
        assert.strictEqual(r.target_type, 'phase');
        assert.strictEqual(r.preamble_targets.length, 2);
        assert.strictEqual(r.preamble_targets[0].type, 'project');
        assert.strictEqual(r.preamble_targets[1].type, 'phase');
      } finally {
        rm(cwd);
      }
    });

    it('phase blocked -> phase-blocked', () => {
      const { cwd } = mkProjectTree({
        project_status: 'in_progress',
        active_phase: '01-alpha',
        phases: [{ slug: '01-alpha', status: 'blocked', scope: 'in_scope' }]
      });
      try {
        const r = runResume(cwd);
        assert.strictEqual(r.action, 'phase-blocked');
        assert.strictEqual(r.target_type, 'phase');
        assert.match(r.summary, /blocked/);
        assert.strictEqual(r.preamble_targets.length, 2);
        assert.strictEqual(r.preamble_targets[0].type, 'project');
        assert.strictEqual(r.preamble_targets[1].type, 'phase');
      } finally {
        rm(cwd);
      }
    });

    it('phase in_progress, no active wave -> wave-next-needed', () => {
      const { cwd } = mkProjectTree({
        project_status: 'in_progress',
        active_phase: '01-alpha',
        phases: [{
          slug: '01-alpha',
          status: 'in_progress',
          scope: 'in_scope',
          active_wave: null,
          waves: []
        }]
      });
      try {
        const r = runResume(cwd);
        assert.strictEqual(r.action, 'wave-next-needed');
        assert.strictEqual(r.target_type, 'phase');
        assert.match(r.summary, /wave next/);
        assert.strictEqual(r.preamble_targets.length, 2);
      } finally {
        rm(cwd);
      }
    });
  });

  describe('in_progress + active phase + active wave', () => {
    function mkWaveTree(waveStatus, waveStage, stages) {
      return mkProjectTree({
        project_status: 'in_progress',
        active_phase: '01-alpha',
        phases: [{
          slug: '01-alpha',
          status: 'in_progress',
          scope: 'in_scope',
          active_wave: '01-first',
          waves: [{
            slug: '01-first',
            status: waveStatus,
            scope: 'in_scope',
            stage: waveStage || 'execution',
            stages: stages || { execution: 'pending', verification: 'pending' }
          }]
        }]
      });
    }

    it('wave blocked -> wave-blocked', () => {
      const { cwd } = mkWaveTree('blocked', 'execution');
      try {
        const r = runResume(cwd);
        assert.strictEqual(r.action, 'wave-blocked');
        assert.strictEqual(r.target_type, 'wave');
        assert.match(r.summary, /blocked/);
        assert.strictEqual(r.preamble_targets.length, 3);
        assert.strictEqual(r.preamble_targets[0].type, 'project');
        assert.strictEqual(r.preamble_targets[1].type, 'phase');
        assert.strictEqual(r.preamble_targets[2].type, 'wave');
      } finally {
        rm(cwd);
      }
    });

    it('wave planning -> stage-wave-plan-review', () => {
      const { cwd } = mkWaveTree('planning', 'execution');
      try {
        const r = runResume(cwd);
        assert.strictEqual(r.action, 'stage-wave-plan-review');
        assert.strictEqual(r.target_type, 'wave');
        assert.strictEqual(r.preamble_targets.length, 3);
      } finally {
        rm(cwd);
      }
    });

    it('wave completed -> wave-completed-next-needed', () => {
      const { cwd } = mkWaveTree('completed', 'execution');
      try {
        const r = runResume(cwd);
        assert.strictEqual(r.action, 'wave-completed-next-needed');
        assert.strictEqual(r.target_type, 'wave');
        assert.match(r.summary, /wave next/);
      } finally {
        rm(cwd);
      }
    });

    it('wave in_progress + stage execution -> stage-wave-exec', () => {
      const { cwd } = mkWaveTree('in_progress', 'execution', { execution: 'in_progress', verification: 'pending' });
      try {
        const r = runResume(cwd);
        assert.strictEqual(r.action, 'stage-wave-exec');
        assert.strictEqual(r.target_type, 'wave');
        assert.strictEqual(r.preamble_targets.length, 3);
      } finally {
        rm(cwd);
      }
    });

    it('wave in_progress + stage verification -> stage-wave-verify', () => {
      const { cwd } = mkWaveTree('in_progress', 'verification', { execution: 'pending', verification: 'in_progress' });
      try {
        const r = runResume(cwd);
        assert.strictEqual(r.action, 'stage-wave-verify');
        assert.strictEqual(r.target_type, 'wave');
      } finally {
        rm(cwd);
      }
    });

    it('wave in_progress + stages.execution = complete -> stage-wave-code-review', () => {
      const { cwd } = mkWaveTree('in_progress', 'execution', { execution: 'complete', verification: 'pending' });
      try {
        const r = runResume(cwd);
        assert.strictEqual(r.action, 'stage-wave-code-review');
        assert.strictEqual(r.target_type, 'wave');
      } finally {
        rm(cwd);
      }
    });

    it('wave in_progress + stages.execution = review_pending -> stage-wave-code-review', () => {
      const { cwd } = mkWaveTree('in_progress', 'execution', { execution: 'review_pending', verification: 'pending' });
      try {
        const r = runResume(cwd);
        assert.strictEqual(r.action, 'stage-wave-code-review');
        assert.strictEqual(r.target_type, 'wave');
      } finally {
        rm(cwd);
      }
    });
  });

  describe('preamble_targets correctness', () => {
    it('project-level actions have exactly 1 preamble target of type project', () => {
      for (const status of ['intake', 'planning', 'blocked']) {
        const { cwd } = mkProjectTree({ project_status: status });
        try {
          const r = runResume(cwd);
          assert.strictEqual(r.preamble_targets.length, 1);
          assert.strictEqual(r.preamble_targets[0].type, 'project');
        } finally {
          rm(cwd);
        }
      }
    });

    it('phase-level actions have exactly 2 preamble targets: project + phase', () => {
      for (const status of ['planning', 'blocked']) {
        const { cwd } = mkProjectTree({
          project_status: 'in_progress',
          active_phase: '01-alpha',
          phases: [{ slug: '01-alpha', status, scope: 'in_scope' }]
        });
        try {
          const r = runResume(cwd);
          assert.strictEqual(r.preamble_targets.length, 2);
          assert.strictEqual(r.preamble_targets[0].type, 'project');
          assert.strictEqual(r.preamble_targets[1].type, 'phase');
        } finally {
          rm(cwd);
        }
      }
    });

    it('wave-level actions have exactly 3 preamble targets: project + phase + wave', () => {
      const { cwd } = mkProjectTree({
        project_status: 'in_progress',
        active_phase: '01-alpha',
        phases: [{
          slug: '01-alpha',
          status: 'in_progress',
          scope: 'in_scope',
          active_wave: '01-first',
          waves: [{
            slug: '01-first',
            status: 'in_progress',
            scope: 'in_scope',
            stage: 'execution',
            stages: { execution: 'in_progress', verification: 'pending' }
          }]
        }]
      });
      try {
        const r = runResume(cwd);
        assert.strictEqual(r.preamble_targets.length, 3);
        assert.strictEqual(r.preamble_targets[0].type, 'project');
        assert.strictEqual(r.preamble_targets[1].type, 'phase');
        assert.strictEqual(r.preamble_targets[2].type, 'wave');
      } finally {
        rm(cwd);
      }
    });

    it('terminal-pre-complete has exactly 1 preamble target of type project', () => {
      const { cwd } = mkProjectTree({
        project_status: 'in_progress',
        active_phase: null,
        phases: [{ slug: '01-alpha', status: 'completed', scope: 'in_scope' }]
      });
      try {
        const r = runResume(cwd);
        assert.strictEqual(r.action, 'terminal-pre-complete');
        assert.strictEqual(r.preamble_targets.length, 1);
        assert.strictEqual(r.preamble_targets[0].type, 'project');
      } finally {
        rm(cwd);
      }
    });

    it('inconsistent-state and already-complete have empty preamble_targets', () => {
      // inconsistent-state
      const { cwd: cwd1 } = mkProjectTree({
        project_status: 'in_progress',
        active_phase: null,
        phases: [{ slug: '01-alpha', status: 'in_progress', scope: 'in_scope' }]
      });
      try {
        const r1 = runResume(cwd1);
        assert.strictEqual(r1.action, 'inconsistent-state');
        assert.deepStrictEqual(r1.preamble_targets, []);
      } finally {
        rm(cwd1);
      }

      // already-complete
      const { cwd: cwd2 } = mkProjectTree({ project_status: 'completed' });
      try {
        const r2 = runResume(cwd2);
        assert.strictEqual(r2.action, 'already-complete');
        assert.deepStrictEqual(r2.preamble_targets, []);
      } finally {
        rm(cwd2);
      }
    });
  });

  describe('slug argument override', () => {
    it('accepts explicit slug arg and reads from that project folder', () => {
      // Build a tree with active_project = 'wrong-project' but pass 'test-project' explicitly
      const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-slug-'));
      try {
        const doDir = path.join(cwd, '.do');
        const projectsBase = path.join(doDir, 'projects');
        fs.mkdirSync(projectsBase, { recursive: true });

        // Config points to a different project
        fs.writeFileSync(path.join(doDir, 'config.json'), JSON.stringify({ active_project: 'other-project' }, null, 2));

        // Create 'test-project' folder with completed status
        const testProjDir = path.join(projectsBase, 'test-project');
        fs.mkdirSync(path.join(testProjDir, 'phases'), { recursive: true });
        const projectMd = [
          '---',
          'project_schema_version: 1',
          'slug: test-project',
          'status: completed',
          'active_phase: null',
          '---',
          '',
        ].join('\n');
        fs.writeFileSync(path.join(testProjDir, 'project.md'), projectMd);
        fs.writeFileSync(path.join(testProjDir, 'changelog.md'), '');

        const r = runResume(cwd, 'test-project');
        assert.strictEqual(r.action, 'already-complete');
      } finally {
        rm(cwd);
      }
    });
  });

});
