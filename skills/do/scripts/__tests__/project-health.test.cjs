#!/usr/bin/env node

/**
 * Tests for project-health.cjs (extended)
 *
 * Covers:
 * - Regression: existing task-pipeline checks still fire (no regression)
 * - New config-schema validation: active_project, project_intake_threshold, council_reviews.project
 * - All 12 new project-folder issue types, one integration test each
 *
 * Uses Node.js built-in test runner + mkdtempSync for isolated fixtures.
 * Run: node --test skills/do/scripts/__tests__/project-health.test.cjs
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { checkProjectHealth } = require('../project-health.cjs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mkBase(baseDir, configOverrides = {}) {
  const doDir = path.join(baseDir, '.do');
  const tasksDir = path.join(doDir, 'tasks');
  fs.mkdirSync(tasksDir, { recursive: true });
  const defaultConfig = {
    version: '0.3.0',
    project_name: 'Test',
    active_task: null,
    active_project: null,
    active_debug: null,
    auto_grill_threshold: 0.9,
    project_intake_threshold: 0.85,
    council_reviews: {
      planning: true,
      execution: true,
      reviewer: 'random',
      project: { plan: true, phase_plan: true, wave_plan: true, code: true },
    },
    web_search: { context7: true },
    models: { default: 'sonnet', overrides: {} },
  };
  const config = Object.assign({}, defaultConfig, configOverrides);
  fs.writeFileSync(path.join(doDir, 'config.json'), JSON.stringify(config, null, 2));
  return doDir;
}

function mkProjectTree(doDir, projectSlug, opts = {}) {
  const projectsDir = path.join(doDir, 'projects');
  const projectDir = path.join(projectsDir, projectSlug);
  const phasesDir = path.join(projectDir, 'phases');
  fs.mkdirSync(phasesDir, { recursive: true });
  fs.mkdirSync(path.join(projectsDir, 'completed'), { recursive: true });
  fs.mkdirSync(path.join(projectsDir, 'archived'), { recursive: true });

  const projectStatus = opts.projectStatus || 'in_progress';
  const activePhase = opts.activePhase !== undefined ? opts.activePhase : null;
  const projectSchemaVersion = opts.projectSchemaVersion !== undefined ? opts.projectSchemaVersion : 1;
  const projectMd = [
    '---',
    `project_schema_version: ${projectSchemaVersion}`,
    `slug: ${projectSlug}`,
    `status: ${projectStatus}`,
    `active_phase: ${activePhase}`,
    'phases:',
  ];
  const phases = opts.phases || [];
  for (const phase of phases) {
    projectMd.push(`  - slug: ${phase.slug}`);
    projectMd.push(`    status: ${phase.status || 'planning'}`);
  }
  projectMd.push('---', '');
  fs.writeFileSync(path.join(projectDir, 'project.md'), projectMd.join('\n'));
  fs.writeFileSync(path.join(projectDir, 'changelog.md'), '');

  for (const phase of phases) {
    const phaseDir = path.join(phasesDir, phase.slug);
    const wavesDir = path.join(phaseDir, 'waves');
    fs.mkdirSync(wavesDir, { recursive: true });
    const phaseSv = phase.schemaVersion !== undefined ? phase.schemaVersion : 1;
    const phaseMd = [
      '---',
      `project_schema_version: ${phaseSv}`,
      `project_slug: ${projectSlug}`,
      `phase_slug: ${phase.slug}`,
      `status: ${phase.status || 'planning'}`,
      `scope: ${phase.scope || 'in_scope'}`,
      `active_wave: ${phase.activeWave || null}`,
      'waves:',
    ];
    const waves = phase.waves || [];
    for (const wave of waves) {
      phaseMd.push(`  - slug: ${wave.slug}`);
      phaseMd.push(`    status: ${wave.status || 'planning'}`);
    }
    phaseMd.push('---', '');
    fs.writeFileSync(path.join(phaseDir, 'phase.md'), phaseMd.join('\n'));

    for (const wave of waves) {
      const waveDir = path.join(wavesDir, wave.slug);
      fs.mkdirSync(waveDir, { recursive: true });
      const waveSv = wave.schemaVersion !== undefined ? wave.schemaVersion : 1;
      const waveMd = [
        '---',
        `project_schema_version: ${waveSv}`,
        `project_slug: ${projectSlug}`,
        `phase_slug: ${phase.slug}`,
        `wave_slug: ${wave.slug}`,
        `status: ${wave.status || 'planning'}`,
        `scope: ${wave.scope || 'in_scope'}`,
        `pre_abandon_status: null`,
        `wave_summary: ${wave.waveSummary !== undefined ? wave.waveSummary : null}`,
        `modified_files: []`,
        `unresolved_concerns: []`,
        `discovered_followups: []`,
      ];
      if (wave.extraFields) {
        for (const [k, v] of Object.entries(wave.extraFields)) {
          waveMd.push(`${k}: ${v}`);
        }
      }
      waveMd.push('---', '');
      fs.writeFileSync(path.join(waveDir, 'wave.md'), waveMd.join('\n'));
    }
  }

  return projectDir;
}

function hasIssueType(issues, type) {
  return issues.some(i => i.type === type);
}

// ---------------------------------------------------------------------------
// Regression: existing task-pipeline checks still fire
// ---------------------------------------------------------------------------

describe('regression: existing task-pipeline checks', () => {
  let tempDir;
  beforeEach(() => { tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'health-regr-')); });
  afterEach(() => { fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('noDotDoFolder fires when .do/ missing', () => {
    const result = checkProjectHealth(tempDir);
    assert.strictEqual(result.healthy, false);
    assert.ok(hasIssueType(result.issues, 'noDotDoFolder'));
  });

  it('noConfig fires when config.json missing', () => {
    const doDir = path.join(tempDir, '.do');
    fs.mkdirSync(path.join(doDir, 'tasks'), { recursive: true });
    const result = checkProjectHealth(tempDir);
    assert.ok(hasIssueType(result.issues, 'noConfig'));
  });

  it('noTasksFolder fires when .do/tasks/ missing', () => {
    const doDir = path.join(tempDir, '.do');
    fs.mkdirSync(doDir);
    fs.writeFileSync(path.join(doDir, 'config.json'), JSON.stringify({
      version: '0.3.0', project_name: 'test', active_task: null, auto_grill_threshold: 0.9,
      council_reviews: { planning: true, execution: true, reviewer: 'random' }
    }));
    const result = checkProjectHealth(tempDir);
    assert.ok(hasIssueType(result.issues, 'noTasksFolder'));
  });

  it('staleActiveTask fires when active_task references missing file', () => {
    mkBase(tempDir, { active_task: 'nonexistent-task.md' });
    const result = checkProjectHealth(tempDir);
    assert.ok(hasIssueType(result.issues, 'staleActiveTask'));
  });

  it('healthy returns true with valid minimal config (no projects)', () => {
    mkBase(tempDir);
    const result = checkProjectHealth(tempDir);
    assert.strictEqual(result.healthy, true);
    assert.deepStrictEqual(result.issues, []);
  });
});

// ---------------------------------------------------------------------------
// New config-schema validation
// ---------------------------------------------------------------------------

describe('active_project config validation', () => {
  let tempDir;
  beforeEach(() => { tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'health-cfg-')); });
  afterEach(() => { fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('missingField warning when active_project absent from config', () => {
    // Manually write config without active_project
    const doDir = path.join(tempDir, '.do');
    fs.mkdirSync(path.join(doDir, 'tasks'), { recursive: true });
    fs.writeFileSync(path.join(doDir, 'config.json'), JSON.stringify({
      version: '0.3.0', project_name: 'x', active_task: null, auto_grill_threshold: 0.9,
      project_intake_threshold: 0.85,
      council_reviews: { planning: true, execution: true, reviewer: 'random', project: { plan: true, phase_plan: true, wave_plan: true, code: true } },
    }));
    const result = checkProjectHealth(tempDir);
    const mf = result.issues.filter(i => i.type === 'missingField' && i.details.includes('active_project'));
    assert.strictEqual(mf.length, 1);
    assert.strictEqual(mf[0].severity, 'warning');
  });

  it('invalidField error when active_project is not a string or null', () => {
    mkBase(tempDir, { active_project: 123 });
    const result = checkProjectHealth(tempDir);
    assert.ok(result.issues.some(i => i.type === 'invalidField' && i.details.includes('active_project')));
  });

  it('invalidField error when active_project contains ..', () => {
    mkBase(tempDir, { active_project: '../evil' });
    const result = checkProjectHealth(tempDir);
    assert.ok(result.issues.some(i => i.type === 'invalidField' && i.details.includes('active_project')));
  });

  it('no issue when active_project is null', () => {
    mkBase(tempDir, { active_project: null });
    const result = checkProjectHealth(tempDir);
    assert.ok(!result.issues.some(i => i.details && i.details.includes('active_project') && i.type === 'invalidField'));
  });
});

describe('project_intake_threshold config validation', () => {
  let tempDir;
  beforeEach(() => { tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'health-pit-')); });
  afterEach(() => { fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('missingField warning when project_intake_threshold absent', () => {
    const doDir = path.join(tempDir, '.do');
    fs.mkdirSync(path.join(doDir, 'tasks'), { recursive: true });
    fs.writeFileSync(path.join(doDir, 'config.json'), JSON.stringify({
      version: '0.3.0', project_name: 'x', active_task: null, active_project: null, auto_grill_threshold: 0.9,
      council_reviews: { planning: true, execution: true, reviewer: 'random', project: { plan: true, phase_plan: true, wave_plan: true, code: true } },
    }));
    const result = checkProjectHealth(tempDir);
    const mf = result.issues.filter(i => i.type === 'missingField' && i.details.includes('project_intake_threshold'));
    assert.strictEqual(mf.length, 1);
  });

  it('invalidField error when project_intake_threshold is not a number', () => {
    mkBase(tempDir, { project_intake_threshold: 'high' });
    const result = checkProjectHealth(tempDir);
    assert.ok(result.issues.some(i => i.type === 'invalidField' && i.details.includes('project_intake_threshold')));
  });

  it('invalidField warning when project_intake_threshold is out of range', () => {
    mkBase(tempDir, { project_intake_threshold: 1.5 });
    const result = checkProjectHealth(tempDir);
    assert.ok(result.issues.some(i => i.details.includes('project_intake_threshold') && i.severity === 'warning'));
  });

  it('no issue when project_intake_threshold is 0.85', () => {
    mkBase(tempDir, { project_intake_threshold: 0.85 });
    const result = checkProjectHealth(tempDir);
    assert.ok(!result.issues.some(i => i.details && i.details.includes('project_intake_threshold')));
  });
});

describe('council_reviews.project config validation', () => {
  let tempDir;
  beforeEach(() => { tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'health-crp-')); });
  afterEach(() => { fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('missingField warning when council_reviews.project absent', () => {
    mkBase(tempDir, {
      council_reviews: { planning: true, execution: true, reviewer: 'random' }
    });
    const result = checkProjectHealth(tempDir);
    assert.ok(result.issues.some(i => i.type === 'missingField' && i.details.includes('council_reviews.project')));
  });

  it('invalidField error when council_reviews.project.plan is not boolean', () => {
    mkBase(tempDir, {
      council_reviews: {
        planning: true, execution: true, reviewer: 'random',
        project: { plan: 'yes', phase_plan: true, wave_plan: true, code: true }
      }
    });
    const result = checkProjectHealth(tempDir);
    assert.ok(result.issues.some(i => i.type === 'invalidField' && i.details.includes('council_reviews.project.plan')));
  });

  it('no issue when council_reviews.project has all valid booleans', () => {
    mkBase(tempDir);
    const result = checkProjectHealth(tempDir);
    const projectIssues = result.issues.filter(i => i.details && i.details.includes('council_reviews.project'));
    assert.strictEqual(projectIssues.length, 0);
  });
});

// ---------------------------------------------------------------------------
// 12 new project-folder issue types
// ---------------------------------------------------------------------------

describe('issue type 1: orphanedActiveProject', () => {
  let tempDir;
  beforeEach(() => { tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'health-oap-')); });
  afterEach(() => { fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('fires when active_project is set but folder does not exist', () => {
    mkBase(tempDir, { active_project: 'nonexistent-proj' });
    // Do NOT create the project folder
    const doDir = path.join(tempDir, '.do');
    fs.mkdirSync(path.join(doDir, 'projects', 'completed'), { recursive: true });
    fs.mkdirSync(path.join(doDir, 'projects', 'archived'), { recursive: true });
    const result = checkProjectHealth(tempDir);
    assert.ok(hasIssueType(result.issues, 'orphanedActiveProject'));
  });

  it('does not fire when active_project folder exists', () => {
    mkBase(tempDir, { active_project: 'my-proj' });
    const doDir = path.join(tempDir, '.do');
    mkProjectTree(doDir, 'my-proj', { projectStatus: 'in_progress', phases: [] });
    const result = checkProjectHealth(tempDir);
    assert.ok(!hasIssueType(result.issues, 'orphanedActiveProject'));
  });
});

describe('issue type 2: activeProjectNoActivePhase', () => {
  let tempDir;
  beforeEach(() => { tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'health-apnap-')); });
  afterEach(() => { fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('fires when in_progress project has active_phase: null and un-completed in-scope phases', () => {
    mkBase(tempDir, { active_project: 'my-proj' });
    const doDir = path.join(tempDir, '.do');
    mkProjectTree(doDir, 'my-proj', {
      projectStatus: 'in_progress',
      activePhase: null,
      phases: [{ slug: '01-discovery', status: 'planning', scope: 'in_scope', waves: [] }],
    });
    const result = checkProjectHealth(tempDir);
    assert.ok(hasIssueType(result.issues, 'activeProjectNoActivePhase'));
  });

  it('does NOT fire when project is terminal-pre-complete (all in-scope phases completed)', () => {
    mkBase(tempDir, { active_project: 'my-proj' });
    const doDir = path.join(tempDir, '.do');
    mkProjectTree(doDir, 'my-proj', {
      projectStatus: 'in_progress',
      activePhase: null,
      phases: [{ slug: '01-discovery', status: 'completed', scope: 'in_scope', waves: [] }],
    });
    const result = checkProjectHealth(tempDir);
    assert.ok(!hasIssueType(result.issues, 'activeProjectNoActivePhase'));
  });
});

describe('issue type 3: orphanedActivePhase', () => {
  let tempDir;
  beforeEach(() => { tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'health-oaph-')); });
  afterEach(() => { fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('fires when active_phase is set but the folder does not exist', () => {
    mkBase(tempDir, { active_project: 'my-proj' });
    const doDir = path.join(tempDir, '.do');
    mkProjectTree(doDir, 'my-proj', {
      projectStatus: 'in_progress',
      activePhase: '01-missing-phase',
      phases: [],
    });
    const result = checkProjectHealth(tempDir);
    assert.ok(hasIssueType(result.issues, 'orphanedActivePhase'));
  });
});

describe('issue type 4: orphanedActiveWave', () => {
  let tempDir;
  beforeEach(() => { tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'health-oaw-')); });
  afterEach(() => { fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('fires when phase.md active_wave is set but the wave folder does not exist', () => {
    mkBase(tempDir, { active_project: 'my-proj' });
    const doDir = path.join(tempDir, '.do');
    mkProjectTree(doDir, 'my-proj', {
      projectStatus: 'in_progress',
      activePhase: '01-discovery',
      phases: [{ slug: '01-discovery', status: 'in_progress', scope: 'in_scope', activeWave: '01-missing-wave', waves: [] }],
    });
    const result = checkProjectHealth(tempDir);
    assert.ok(hasIssueType(result.issues, 'orphanedActiveWave'));
  });
});

describe('issue type 5: orphanProjectFolder', () => {
  let tempDir;
  beforeEach(() => { tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'health-opf-')); });
  afterEach(() => { fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('fires when a project folder exists but is not the active project', () => {
    mkBase(tempDir, { active_project: 'my-proj' });
    const doDir = path.join(tempDir, '.do');
    mkProjectTree(doDir, 'my-proj', { projectStatus: 'in_progress', phases: [] });
    mkProjectTree(doDir, 'stale-proj', { projectStatus: 'planning', phases: [] });
    const result = checkProjectHealth(tempDir);
    assert.ok(hasIssueType(result.issues, 'orphanProjectFolder'));
  });
});

describe('issue type 6: phaseStatusDrift', () => {
  let tempDir;
  beforeEach(() => { tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'health-psd-')); });
  afterEach(() => { fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('fires when project.md phases[].status disagrees with phase.md status', () => {
    mkBase(tempDir, { active_project: 'my-proj' });
    const doDir = path.join(tempDir, '.do');
    // project.md says planning, but phase.md says in_progress
    mkProjectTree(doDir, 'my-proj', {
      projectStatus: 'in_progress',
      phases: [{ slug: '01-discovery', status: 'planning', scope: 'in_scope', waves: [] }],
    });
    // Override phase.md status
    const phaseMdPath = path.join(doDir, 'projects', 'my-proj', 'phases', '01-discovery', 'phase.md');
    const content = fs.readFileSync(phaseMdPath, 'utf-8');
    fs.writeFileSync(phaseMdPath, content.replace('status: planning', 'status: in_progress'));
    const result = checkProjectHealth(tempDir);
    assert.ok(hasIssueType(result.issues, 'phaseStatusDrift'));
  });
});

describe('issue type 7: waveStatusDrift', () => {
  let tempDir;
  beforeEach(() => { tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'health-wsd-')); });
  afterEach(() => { fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('fires when phase.md waves[].status disagrees with wave.md status', () => {
    mkBase(tempDir, { active_project: 'my-proj' });
    const doDir = path.join(tempDir, '.do');
    mkProjectTree(doDir, 'my-proj', {
      projectStatus: 'in_progress',
      phases: [{
        slug: '01-discovery', status: 'in_progress', scope: 'in_scope',
        waves: [{ slug: '01-intake', status: 'planning', scope: 'in_scope' }],
      }],
    });
    // Override wave.md status to cause drift
    const waveMdPath = path.join(doDir, 'projects', 'my-proj', 'phases', '01-discovery', 'waves', '01-intake', 'wave.md');
    const content = fs.readFileSync(waveMdPath, 'utf-8');
    fs.writeFileSync(waveMdPath, content.replace('status: planning', 'status: in_progress'));
    const result = checkProjectHealth(tempDir);
    assert.ok(hasIssueType(result.issues, 'waveStatusDrift'));
  });
});

describe('issue type 8: schemaVersionMismatch', () => {
  let tempDir;
  beforeEach(() => { tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'health-svm-')); });
  afterEach(() => { fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('fires when project.md project_schema_version != 1', () => {
    mkBase(tempDir, { active_project: 'my-proj' });
    const doDir = path.join(tempDir, '.do');
    mkProjectTree(doDir, 'my-proj', { projectStatus: 'planning', projectSchemaVersion: 2, phases: [] });
    const result = checkProjectHealth(tempDir);
    assert.ok(hasIssueType(result.issues, 'schemaVersionMismatch'));
  });

  it('fires when phase.md project_schema_version != 1', () => {
    mkBase(tempDir, { active_project: 'my-proj' });
    const doDir = path.join(tempDir, '.do');
    mkProjectTree(doDir, 'my-proj', {
      projectStatus: 'in_progress',
      phases: [{ slug: '01-discovery', status: 'planning', scope: 'in_scope', schemaVersion: 2, waves: [] }],
    });
    const result = checkProjectHealth(tempDir);
    assert.ok(hasIssueType(result.issues, 'schemaVersionMismatch'));
  });
});

describe('issue type 9: invalidScopeValue', () => {
  let tempDir;
  beforeEach(() => { tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'health-isv-')); });
  afterEach(() => { fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('fires when phase.md scope has invalid value', () => {
    mkBase(tempDir, { active_project: 'my-proj' });
    const doDir = path.join(tempDir, '.do');
    mkProjectTree(doDir, 'my-proj', {
      projectStatus: 'in_progress',
      phases: [{ slug: '01-discovery', status: 'planning', scope: 'invalid-scope', waves: [] }],
    });
    const result = checkProjectHealth(tempDir);
    assert.ok(hasIssueType(result.issues, 'invalidScopeValue'));
  });

  it('fires when wave.md scope has invalid value', () => {
    mkBase(tempDir, { active_project: 'my-proj' });
    const doDir = path.join(tempDir, '.do');
    mkProjectTree(doDir, 'my-proj', {
      projectStatus: 'in_progress',
      phases: [{
        slug: '01-discovery', status: 'in_progress', scope: 'in_scope',
        waves: [{ slug: '01-intake', status: 'planning', scope: 'bad-scope' }],
      }],
    });
    const result = checkProjectHealth(tempDir);
    assert.ok(hasIssueType(result.issues, 'invalidScopeValue'));
  });
});

describe('issue type 10: illegalScopeTransition', () => {
  let tempDir;
  beforeEach(() => { tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'health-ist-')); });
  afterEach(() => { fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('fires when phase has status: in_progress AND scope: out_of_scope', () => {
    mkBase(tempDir, { active_project: 'my-proj' });
    const doDir = path.join(tempDir, '.do');
    mkProjectTree(doDir, 'my-proj', {
      projectStatus: 'in_progress',
      phases: [{ slug: '01-discovery', status: 'in_progress', scope: 'out_of_scope', waves: [] }],
    });
    const result = checkProjectHealth(tempDir);
    assert.ok(hasIssueType(result.issues, 'illegalScopeTransition'));
  });

  it('fires when wave has status: in_progress AND scope: out_of_scope', () => {
    mkBase(tempDir, { active_project: 'my-proj' });
    const doDir = path.join(tempDir, '.do');
    mkProjectTree(doDir, 'my-proj', {
      projectStatus: 'in_progress',
      phases: [{
        slug: '01-discovery', status: 'in_progress', scope: 'in_scope',
        waves: [{ slug: '01-intake', status: 'in_progress', scope: 'out_of_scope' }],
      }],
    });
    const result = checkProjectHealth(tempDir);
    assert.ok(hasIssueType(result.issues, 'illegalScopeTransition'));
  });
});

describe('issue type 11: missingHandoffFields', () => {
  let tempDir;
  beforeEach(() => { tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'health-mhf-')); });
  afterEach(() => { fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('fires when completed wave has null wave_summary', () => {
    mkBase(tempDir, { active_project: 'my-proj' });
    const doDir = path.join(tempDir, '.do');
    mkProjectTree(doDir, 'my-proj', {
      projectStatus: 'in_progress',
      phases: [{
        slug: '01-discovery', status: 'in_progress', scope: 'in_scope',
        waves: [{ slug: '01-intake', status: 'completed', scope: 'in_scope', waveSummary: null }],
      }],
    });
    const result = checkProjectHealth(tempDir);
    assert.ok(hasIssueType(result.issues, 'missingHandoffFields'));
  });

  it('does NOT fire when completed wave has non-null wave_summary', () => {
    mkBase(tempDir, { active_project: 'my-proj' });
    const doDir = path.join(tempDir, '.do');
    mkProjectTree(doDir, 'my-proj', {
      projectStatus: 'in_progress',
      phases: [{
        slug: '01-discovery', status: 'in_progress', scope: 'in_scope',
        waves: [{ slug: '01-intake', status: 'completed', scope: 'in_scope', waveSummary: 'Shipped intake flow.' }],
      }],
    });
    const result = checkProjectHealth(tempDir);
    assert.ok(!hasIssueType(result.issues, 'missingHandoffFields'));
  });
});

describe('issue type 12: illegalPhaseTransition', () => {
  let tempDir;
  beforeEach(() => { tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'health-ipt-')); });
  afterEach(() => { fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('fires when phase is completed but has in-scope wave that is not completed', () => {
    mkBase(tempDir, { active_project: 'my-proj' });
    const doDir = path.join(tempDir, '.do');
    mkProjectTree(doDir, 'my-proj', {
      projectStatus: 'in_progress',
      phases: [{
        slug: '01-discovery', status: 'completed', scope: 'in_scope',
        waves: [{ slug: '01-intake', status: 'planning', scope: 'in_scope', waveSummary: null }],
      }],
    });
    const result = checkProjectHealth(tempDir);
    assert.ok(hasIssueType(result.issues, 'illegalPhaseTransition'));
  });

  it('does NOT fire when phase is completed and all in-scope waves are completed', () => {
    mkBase(tempDir, { active_project: 'my-proj' });
    const doDir = path.join(tempDir, '.do');
    mkProjectTree(doDir, 'my-proj', {
      projectStatus: 'in_progress',
      phases: [{
        slug: '01-discovery', status: 'completed', scope: 'in_scope',
        waves: [{ slug: '01-intake', status: 'completed', scope: 'in_scope', waveSummary: 'Shipped.' }],
      }],
    });
    const result = checkProjectHealth(tempDir);
    assert.ok(!hasIssueType(result.issues, 'illegalPhaseTransition'));
  });
});
