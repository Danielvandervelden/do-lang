#!/usr/bin/env node

/**
 * Tests for project-scaffold.cjs
 *
 * Covers:
 * - Prefix allocation (first child, sequential, gap-in-sequence max+1)
 * - Default frontmatter (all fields present with correct defaults)
 * - Confidence shape (null sentinels, full structure present)
 * - Parent-index update (phases[] / waves[])
 * - Changelog append
 * - Slug rejection (at least 4 cases)
 * - Parent-phase-not-found rejection for wave op
 * - Side-effect-free rejection (fixture tree byte-identical before/after)
 * - completed/ and archived/ directories created on project scaffold
 *
 * Uses Node.js built-in test runner + mkdtempSync for isolated fixtures.
 * Run: node --test skills/do/scripts/__tests__/project-scaffold.test.cjs
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  opProject,
  opPhase,
  opWave,
  allocatePrefix,
  projectFrontmatter,
  phaseFrontmatter,
  waveFrontmatter,
  readTemplateBody,
  getReferencesDir,
} = require('../project-scaffold.cjs');

const { parseFrontmatter } = require('../project-state.cjs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mkProjectsDir(baseDir) {
  const projectsDir = path.join(baseDir, '.do', 'projects');
  fs.mkdirSync(path.join(projectsDir, 'completed'), { recursive: true });
  fs.mkdirSync(path.join(projectsDir, 'archived'), { recursive: true });
  return projectsDir;
}

function readFm(filePath) {
  const p = parseFrontmatter(filePath);
  return p ? p.data : null;
}

function captureStdout(fn) {
  let output = '';
  const orig = process.stdout.write.bind(process.stdout);
  process.stdout.write = (s) => { output += s; return true; };
  try { fn(); } finally { process.stdout.write = orig; }
  return output;
}

function captureExitError(fn) {
  let exitCode = null;
  let stderrOut = '';
  const origExit = process.exit;
  const origStderrWrite = process.stderr.write.bind(process.stderr);
  process.exit = (code) => { exitCode = code; throw new Error(`exit(${code})`); };
  process.stderr.write = (s) => { stderrOut += s; return true; };
  try { fn(); } catch (e) { if (!e.message.startsWith('exit(')) throw e; }
  finally {
    process.exit = origExit;
    process.stderr.write = origStderrWrite;
  }
  return { exitCode, stderr: stderrOut };
}

function getFixtureSnapshot(dir) {
  if (!fs.existsSync(dir)) return null;
  const results = {};
  function walk(d) {
    for (const entry of fs.readdirSync(d).sort()) {
      const full = path.join(d, entry);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        results[path.relative(dir, full) + '/'] = 'dir';
        walk(full);
      } else {
        results[path.relative(dir, full)] = fs.readFileSync(full, 'utf-8');
      }
    }
  }
  walk(dir);
  return results;
}

// ---------------------------------------------------------------------------
// Prefix allocation
// ---------------------------------------------------------------------------

describe('allocatePrefix', () => {
  let tempDir;
  beforeEach(() => { tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-prefix-')); });
  afterEach(() => { fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('returns 01 for empty directory', () => {
    assert.strictEqual(allocatePrefix(tempDir), '01');
  });

  it('returns 02 after 01-foo exists', () => {
    fs.mkdirSync(path.join(tempDir, '01-foo'));
    assert.strictEqual(allocatePrefix(tempDir), '02');
  });

  it('returns 04 when 01- and 03- exist (max+1, not gap-fill)', () => {
    fs.mkdirSync(path.join(tempDir, '01-alpha'));
    fs.mkdirSync(path.join(tempDir, '03-gamma'));
    assert.strictEqual(allocatePrefix(tempDir), '04');
  });

  it('returns 01 for non-existent directory', () => {
    const nonExistent = path.join(tempDir, 'not-here');
    assert.strictEqual(allocatePrefix(nonExistent), '01');
  });
});

// ---------------------------------------------------------------------------
// opProject
// ---------------------------------------------------------------------------

describe('opProject', () => {
  let tempDir, projectsDir;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-proj-'));
    projectsDir = mkProjectsDir(tempDir);
  });
  afterEach(() => { fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('creates project folder structure', () => {
    captureStdout(() => opProject(projectsDir, 'my-proj'));
    assert.ok(fs.existsSync(path.join(projectsDir, 'my-proj', 'project.md')));
    assert.ok(fs.existsSync(path.join(projectsDir, 'my-proj', 'intake')));
    assert.ok(fs.existsSync(path.join(projectsDir, 'my-proj', 'phases')));
    assert.ok(fs.existsSync(path.join(projectsDir, 'my-proj', 'changelog.md')));
  });

  it('ensures completed/ and archived/ directories exist', () => {
    captureStdout(() => opProject(projectsDir, 'my-proj'));
    assert.ok(fs.existsSync(path.join(projectsDir, 'completed')));
    assert.ok(fs.existsSync(path.join(projectsDir, 'archived')));
  });

  it('writes correct default frontmatter', () => {
    captureStdout(() => opProject(projectsDir, 'my-proj'));
    const fm = readFm(path.join(projectsDir, 'my-proj', 'project.md'));
    assert.strictEqual(fm.project_schema_version, 1);
    assert.strictEqual(fm.slug, 'my-proj');
    assert.strictEqual(fm.status, 'intake');
    assert.strictEqual(fm.active_phase, null);
    assert.strictEqual(fm.pre_abandon_status, null);
    assert.strictEqual(fm.database_entry, null);
    assert.strictEqual(fm.repo_path, null);
    assert.deepStrictEqual(fm.tech_stack, []);
    assert.deepStrictEqual(fm.phases, []);
  });

  it('project.md has full confidence shape with null sentinels', () => {
    captureStdout(() => opProject(projectsDir, 'my-proj'));
    const fm = readFm(path.join(projectsDir, 'my-proj', 'project.md'));
    assert.ok(fm.confidence, 'confidence field must be present');
    assert.strictEqual(fm.confidence.score, null);
    assert.ok(fm.confidence.factors, 'confidence.factors must be present');
    assert.strictEqual(fm.confidence.factors.context, null);
    assert.strictEqual(fm.confidence.factors.scope, null);
    assert.strictEqual(fm.confidence.factors.complexity, null);
    assert.strictEqual(fm.confidence.factors.familiarity, null);
  });

  it('appends scaffold changelog entry', () => {
    captureStdout(() => opProject(projectsDir, 'my-proj'));
    const changelog = fs.readFileSync(path.join(projectsDir, 'my-proj', 'changelog.md'), 'utf-8');
    assert.ok(changelog.includes('scaffold:project:my-proj'));
  });

  it('rejects invalid slug: ../evil', () => {
    const before = getFixtureSnapshot(projectsDir);
    const { exitCode } = captureExitError(() => opProject(projectsDir, '../evil'));
    assert.strictEqual(exitCode, 1);
    assert.deepStrictEqual(getFixtureSnapshot(projectsDir), before);
  });

  it('rejects invalid slug: /absolute/path', () => {
    const before = getFixtureSnapshot(projectsDir);
    const { exitCode, stderr } = captureExitError(() => opProject(projectsDir, '/absolute/path'));
    assert.strictEqual(exitCode, 1);
    const err = JSON.parse(stderr);
    assert.strictEqual(err.error, 'invalidSlug');
    assert.deepStrictEqual(getFixtureSnapshot(projectsDir), before);
  });

  it('rejects invalid slug: FOO (uppercase)', () => {
    const before = getFixtureSnapshot(projectsDir);
    const { exitCode } = captureExitError(() => opProject(projectsDir, 'FOO'));
    assert.strictEqual(exitCode, 1);
    assert.deepStrictEqual(getFixtureSnapshot(projectsDir), before);
  });

  it('rejects invalid slug: .hidden (dot-leading)', () => {
    const before = getFixtureSnapshot(projectsDir);
    const { exitCode } = captureExitError(() => opProject(projectsDir, '.hidden'));
    assert.strictEqual(exitCode, 1);
    assert.deepStrictEqual(getFixtureSnapshot(projectsDir), before);
  });
});

// ---------------------------------------------------------------------------
// opPhase
// ---------------------------------------------------------------------------

describe('opPhase', () => {
  let tempDir, projectsDir;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-phase-'));
    projectsDir = mkProjectsDir(tempDir);
    captureStdout(() => opProject(projectsDir, 'my-proj'));
  });
  afterEach(() => { fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('creates phase with prefix 01- for first phase', () => {
    captureStdout(() => opPhase(projectsDir, 'my-proj', 'discovery'));
    assert.ok(fs.existsSync(path.join(projectsDir, 'my-proj', 'phases', '01-discovery')));
    assert.ok(fs.existsSync(path.join(projectsDir, 'my-proj', 'phases', '01-discovery', 'phase.md')));
    assert.ok(fs.existsSync(path.join(projectsDir, 'my-proj', 'phases', '01-discovery', 'waves')));
  });

  it('allocates sequential prefix 02- after 01- exists', () => {
    captureStdout(() => opPhase(projectsDir, 'my-proj', 'discovery'));
    captureStdout(() => opPhase(projectsDir, 'my-proj', 'build'));
    assert.ok(fs.existsSync(path.join(projectsDir, 'my-proj', 'phases', '02-build')));
  });

  it('writes correct default frontmatter for phase', () => {
    captureStdout(() => opPhase(projectsDir, 'my-proj', 'discovery'));
    const fm = readFm(path.join(projectsDir, 'my-proj', 'phases', '01-discovery', 'phase.md'));
    assert.strictEqual(fm.project_schema_version, 1);
    assert.strictEqual(fm.project_slug, 'my-proj');
    assert.strictEqual(fm.phase_slug, '01-discovery');
    assert.strictEqual(fm.status, 'planning');
    assert.strictEqual(fm.scope, 'in_scope');
    assert.strictEqual(fm.active_wave, null);
    assert.strictEqual(fm.pre_abandon_status, null);
    assert.strictEqual(fm.exit_summary, null);
  });

  it('phase.md has full confidence shape with null sentinels', () => {
    captureStdout(() => opPhase(projectsDir, 'my-proj', 'discovery'));
    const fm = readFm(path.join(projectsDir, 'my-proj', 'phases', '01-discovery', 'phase.md'));
    assert.ok(fm.confidence, 'confidence field must be present');
    assert.strictEqual(fm.confidence.score, null);
    assert.ok(fm.confidence.factors, 'confidence.factors must be present');
    assert.strictEqual(fm.confidence.factors.context, null);
    assert.strictEqual(fm.confidence.factors.scope, null);
    assert.strictEqual(fm.confidence.factors.complexity, null);
    assert.strictEqual(fm.confidence.factors.familiarity, null);
  });

  it('updates project.md phases[] after phase creation', () => {
    captureStdout(() => opPhase(projectsDir, 'my-proj', 'discovery'));
    const fm = readFm(path.join(projectsDir, 'my-proj', 'project.md'));
    assert.ok(Array.isArray(fm.phases));
    assert.strictEqual(fm.phases.length, 1);
    assert.strictEqual(fm.phases[0].slug, '01-discovery');
    assert.strictEqual(fm.phases[0].status, 'planning');
  });

  it('appends scaffold changelog entry for phase', () => {
    captureStdout(() => opPhase(projectsDir, 'my-proj', 'discovery'));
    const changelog = fs.readFileSync(path.join(projectsDir, 'my-proj', 'changelog.md'), 'utf-8');
    assert.ok(changelog.includes('scaffold:phase:my-proj/01-discovery'));
  });

  it('rejects invalid project slug: ../evil', () => {
    const before = getFixtureSnapshot(projectsDir);
    const { exitCode } = captureExitError(() => opPhase(projectsDir, '../evil', 'discovery'));
    assert.strictEqual(exitCode, 1);
    assert.deepStrictEqual(getFixtureSnapshot(projectsDir), before);
  });

  it('rejects invalid phase slug: /abs-path', () => {
    const before = getFixtureSnapshot(projectsDir);
    const { exitCode, stderr } = captureExitError(() => opPhase(projectsDir, 'my-proj', '/abs-path'));
    assert.strictEqual(exitCode, 1);
    const err = JSON.parse(stderr);
    assert.strictEqual(err.error, 'invalidSlug');
    assert.deepStrictEqual(getFixtureSnapshot(projectsDir), before);
  });

  it('rejects invalid phase slug: .hidden (dot-leading)', () => {
    const before = getFixtureSnapshot(projectsDir);
    const { exitCode } = captureExitError(() => opPhase(projectsDir, 'my-proj', '.hidden'));
    assert.strictEqual(exitCode, 1);
    assert.deepStrictEqual(getFixtureSnapshot(projectsDir), before);
  });
});

// ---------------------------------------------------------------------------
// opWave
// ---------------------------------------------------------------------------

describe('opWave', () => {
  let tempDir, projectsDir;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-wave-'));
    projectsDir = mkProjectsDir(tempDir);
    captureStdout(() => opProject(projectsDir, 'my-proj'));
    captureStdout(() => opPhase(projectsDir, 'my-proj', 'discovery'));
  });
  afterEach(() => { fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('creates wave with prefix 01- for first wave', () => {
    captureStdout(() => opWave(projectsDir, 'my-proj', '01-discovery', 'intake'));
    assert.ok(fs.existsSync(path.join(projectsDir, 'my-proj', 'phases', '01-discovery', 'waves', '01-intake', 'wave.md')));
  });

  it('allocates sequential prefix 02- after 01- exists', () => {
    captureStdout(() => opWave(projectsDir, 'my-proj', '01-discovery', 'intake'));
    captureStdout(() => opWave(projectsDir, 'my-proj', '01-discovery', 'build'));
    assert.ok(fs.existsSync(path.join(projectsDir, 'my-proj', 'phases', '01-discovery', 'waves', '02-build')));
  });

  it('writes correct default frontmatter for wave', () => {
    captureStdout(() => opWave(projectsDir, 'my-proj', '01-discovery', 'intake'));
    const fm = readFm(path.join(projectsDir, 'my-proj', 'phases', '01-discovery', 'waves', '01-intake', 'wave.md'));
    assert.strictEqual(fm.project_schema_version, 1);
    assert.strictEqual(fm.project_slug, 'my-proj');
    assert.strictEqual(fm.phase_slug, '01-discovery');
    assert.strictEqual(fm.wave_slug, '01-intake');
    assert.strictEqual(fm.status, 'planning');
    assert.strictEqual(fm.scope, 'in_scope');
    assert.strictEqual(fm.pre_abandon_status, null);
    assert.strictEqual(fm.parent_project, 'my-proj');
    assert.strictEqual(fm.parent_phase, '01-discovery');
    assert.strictEqual(fm.stage, 'refinement');
    assert.strictEqual(fm.wave_summary, null);
    assert.deepStrictEqual(fm.modified_files, []);
    assert.deepStrictEqual(fm.unresolved_concerns, []);
    assert.deepStrictEqual(fm.discovered_followups, []);
  });

  it('wave.md has full confidence shape with null sentinels', () => {
    captureStdout(() => opWave(projectsDir, 'my-proj', '01-discovery', 'intake'));
    const fm = readFm(path.join(projectsDir, 'my-proj', 'phases', '01-discovery', 'waves', '01-intake', 'wave.md'));
    assert.ok(fm.confidence, 'confidence field must be present');
    assert.strictEqual(fm.confidence.score, null);
    assert.ok(fm.confidence.factors, 'confidence.factors must be present');
    const fkeys = Object.keys(fm.confidence.factors);
    assert.ok(fkeys.includes('context'), 'context factor missing');
    assert.ok(fkeys.includes('scope'), 'scope factor missing');
    assert.ok(fkeys.includes('complexity'), 'complexity factor missing');
    assert.ok(fkeys.includes('familiarity'), 'familiarity factor missing');
    assert.strictEqual(fm.confidence.factors.context, null);
    assert.strictEqual(fm.confidence.factors.scope, null);
    assert.strictEqual(fm.confidence.factors.complexity, null);
    assert.strictEqual(fm.confidence.factors.familiarity, null);
  });

  it('updates phase.md waves[] after wave creation', () => {
    captureStdout(() => opWave(projectsDir, 'my-proj', '01-discovery', 'intake'));
    const fm = readFm(path.join(projectsDir, 'my-proj', 'phases', '01-discovery', 'phase.md'));
    assert.ok(Array.isArray(fm.waves));
    assert.strictEqual(fm.waves.length, 1);
    assert.strictEqual(fm.waves[0].slug, '01-intake');
    assert.strictEqual(fm.waves[0].status, 'planning');
  });

  it('appends scaffold changelog entry for wave', () => {
    captureStdout(() => opWave(projectsDir, 'my-proj', '01-discovery', 'intake'));
    const changelog = fs.readFileSync(path.join(projectsDir, 'my-proj', 'changelog.md'), 'utf-8');
    assert.ok(changelog.includes('scaffold:wave:my-proj/01-discovery/01-intake'));
  });

  it('rejects unprefixed parent phase slug: discovery (no NN-)', () => {
    const before = getFixtureSnapshot(projectsDir);
    const { exitCode, stderr } = captureExitError(() => opWave(projectsDir, 'my-proj', 'discovery', 'intake'));
    assert.strictEqual(exitCode, 1);
    const err = JSON.parse(stderr);
    assert.strictEqual(err.error, 'invalidSlug');
    assert.deepStrictEqual(getFixtureSnapshot(projectsDir), before);
  });

  it('rejects single-digit prefix parent phase: 1-discovery', () => {
    const before = getFixtureSnapshot(projectsDir);
    const { exitCode, stderr } = captureExitError(() => opWave(projectsDir, 'my-proj', '1-discovery', 'intake'));
    assert.strictEqual(exitCode, 1);
    const err = JSON.parse(stderr);
    assert.strictEqual(err.error, 'invalidSlug');
    assert.deepStrictEqual(getFixtureSnapshot(projectsDir), before);
  });

  it('rejects non-existent parent phase: 99-nonexistent', () => {
    const before = getFixtureSnapshot(projectsDir);
    const { exitCode, stderr } = captureExitError(() => opWave(projectsDir, 'my-proj', '99-nonexistent', 'intake'));
    assert.strictEqual(exitCode, 1);
    const err = JSON.parse(stderr);
    assert.strictEqual(err.error, 'parentPhaseNotFound');
    assert.strictEqual(err.project_slug, 'my-proj');
    assert.strictEqual(err.phase_slug, '99-nonexistent');
    assert.deepStrictEqual(getFixtureSnapshot(projectsDir), before);
  });

  it('rejects empty wave slug', () => {
    const before = getFixtureSnapshot(projectsDir);
    const { exitCode } = captureExitError(() => opWave(projectsDir, 'my-proj', '01-discovery', ''));
    assert.strictEqual(exitCode, 1);
    assert.deepStrictEqual(getFixtureSnapshot(projectsDir), before);
  });
});

// ---------------------------------------------------------------------------
// Default frontmatter shapes (pure, no FS)
// ---------------------------------------------------------------------------

describe('default frontmatter shapes', () => {
  it('projectFrontmatter has all required fields', () => {
    const fm = projectFrontmatter('test-proj');
    assert.strictEqual(fm.project_schema_version, 1);
    assert.strictEqual(fm.slug, 'test-proj');
    assert.strictEqual(fm.id, 'test-proj');
    assert.strictEqual(fm.kind, 'greenfield');
    assert.strictEqual(fm.status, 'intake');
    assert.strictEqual(fm.active_phase, null);
    assert.strictEqual(fm.pre_abandon_status, null);
    assert.strictEqual(fm.database_entry, null);
    assert.deepStrictEqual(fm.tech_stack, []);
    assert.strictEqual(fm.repo_path, null);
    assert.strictEqual(fm.confidence.score, null);
    assert.strictEqual(fm.confidence.factors.context, null);
    assert.strictEqual(fm.confidence.factors.scope, null);
    assert.strictEqual(fm.confidence.factors.complexity, null);
    assert.strictEqual(fm.confidence.factors.familiarity, null);
    assert.deepStrictEqual(fm.phases, []);
  });

  it('phaseFrontmatter has all required fields', () => {
    const fm = phaseFrontmatter('test-proj', '01-discovery');
    assert.strictEqual(fm.project_schema_version, 1);
    assert.strictEqual(fm.project_slug, 'test-proj');
    assert.strictEqual(fm.phase_slug, '01-discovery');
    assert.strictEqual(fm.status, 'planning');
    assert.strictEqual(fm.scope, 'in_scope');
    assert.strictEqual(fm.active_wave, null);
    assert.strictEqual(fm.pre_abandon_status, null);
    assert.strictEqual(fm.backlog_item, null);
    assert.strictEqual(fm.exit_summary, null);
    assert.strictEqual(fm.confidence.score, null);
    assert.strictEqual(fm.confidence.factors.familiarity, null);
    assert.deepStrictEqual(fm.waves, []);
  });

  it('waveFrontmatter has all required fields', () => {
    const fm = waveFrontmatter('test-proj', '01-discovery', '01-intake');
    assert.strictEqual(fm.project_schema_version, 1);
    assert.strictEqual(fm.project_slug, 'test-proj');
    assert.strictEqual(fm.phase_slug, '01-discovery');
    assert.strictEqual(fm.wave_slug, '01-intake');
    assert.strictEqual(fm.status, 'planning');
    assert.strictEqual(fm.scope, 'in_scope');
    assert.strictEqual(fm.pre_abandon_status, null);
    assert.strictEqual(fm.backlog_item, null);
    assert.strictEqual(fm.parent_project, 'test-proj');
    assert.strictEqual(fm.parent_phase, '01-discovery');
    assert.strictEqual(fm.stage, 'refinement');
    assert.strictEqual(fm.wave_summary, null);
    assert.deepStrictEqual(fm.modified_files, []);
    assert.deepStrictEqual(fm.unresolved_concerns, []);
    assert.deepStrictEqual(fm.discovered_followups, []);
    assert.strictEqual(fm.confidence.score, null);
    assert.strictEqual(fm.confidence.factors.context, null);
    assert.strictEqual(fm.confidence.factors.scope, null);
    assert.strictEqual(fm.confidence.factors.complexity, null);
    assert.strictEqual(fm.confidence.factors.familiarity, null);
  });
});

// ---------------------------------------------------------------------------
// Issue 6: template body section headings + readTemplateBody throw-on-missing
// ---------------------------------------------------------------------------

describe('template body section headings', () => {
  let tempDir, projectsDir;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-tmpl-'));
    projectsDir = mkProjectsDir(tempDir);
  });
  afterEach(() => { fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('scaffolded project.md contains ## Vision from project-master-template.md', () => {
    captureStdout(() => opProject(projectsDir, 'my-proj'));
    const content = fs.readFileSync(path.join(projectsDir, 'my-proj', 'project.md'), 'utf-8');
    assert.ok(content.includes('## Vision'), 'project.md must contain ## Vision section from template');
  });

  it('scaffolded phase.md contains ## Goal from phase-template.md', () => {
    captureStdout(() => opProject(projectsDir, 'my-proj'));
    captureStdout(() => opPhase(projectsDir, 'my-proj', 'alpha'));
    const phasesDir = path.join(projectsDir, 'my-proj', 'phases');
    const phaseEntry = fs.readdirSync(phasesDir)[0];
    const content = fs.readFileSync(path.join(phasesDir, phaseEntry, 'phase.md'), 'utf-8');
    assert.ok(content.includes('## Goal'), 'phase.md must contain ## Goal section from template');
  });

  it('scaffolded wave.md contains ## Problem Statement from wave-template.md', () => {
    captureStdout(() => opProject(projectsDir, 'my-proj'));
    captureStdout(() => opPhase(projectsDir, 'my-proj', 'alpha'));
    const phasesDir = path.join(projectsDir, 'my-proj', 'phases');
    const phaseEntry = fs.readdirSync(phasesDir)[0];
    captureStdout(() => opWave(projectsDir, 'my-proj', phaseEntry, 'first'));
    const wavesDir = path.join(phasesDir, phaseEntry, 'waves');
    const waveEntry = fs.readdirSync(wavesDir)[0];
    const content = fs.readFileSync(path.join(wavesDir, waveEntry, 'wave.md'), 'utf-8');
    assert.ok(content.includes('## Problem Statement'), 'wave.md must contain ## Problem Statement section from template');
  });

  it('getReferencesDir resolves to skills/do/references/', () => {
    const refsDir = getReferencesDir();
    const projectTemplate = path.join(refsDir, 'project-master-template.md');
    assert.ok(fs.existsSync(projectTemplate), `project-master-template.md must exist at ${projectTemplate}`);
  });

  it('readTemplateBody throws structured error when template is missing', () => {
    let threw = false;
    let errObj = null;
    try {
      readTemplateBody(path.join(tempDir, 'nonexistent-template.md'));
    } catch (e) {
      threw = true;
      errObj = e;
    }
    assert.ok(threw, 'readTemplateBody should throw when template is missing');
    assert.strictEqual(errObj.error, 'templateNotFound');
    assert.ok(errObj.path.includes('nonexistent-template.md'));
  });
});

// ---------------------------------------------------------------------------
// Integration: scaffold then transition via project-state.cjs
// ---------------------------------------------------------------------------

describe('integration: scaffold then transition', () => {
  let tempDir, projectsDir;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-int-'));
    projectsDir = mkProjectsDir(tempDir);
  });
  afterEach(() => { fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('scaffolded project can be transitioned via project-state.cjs updateFrontmatterField', () => {
    const { updateFrontmatterField } = require('../project-state.cjs');
    captureStdout(() => opProject(projectsDir, 'my-proj'));
    const projectMdPath = path.join(projectsDir, 'my-proj', 'project.md');
    // intake -> planning is a legal transition
    updateFrontmatterField(projectMdPath, { status: 'planning' });
    const fm = readFm(projectMdPath);
    assert.strictEqual(fm.status, 'planning');
  });
});

// ---------------------------------------------------------------------------
// Issue 2 (iter-2): CLI pre-validation — no filesystem side effects on invalid slug
//
// AC #4: validate before any mkdirSync.
// This test invokes the CLI via subprocess (spawnSync) on a fresh fixture tree
// where .do/projects/ does NOT exist. It asserts:
//   1. Non-zero exit code on invalid slug.
//   2. .do/projects/ does NOT exist after the invalid invocation.
// ---------------------------------------------------------------------------

describe('CLI: no filesystem side effects on invalid slug (Issue 2 iter-2)', () => {
  const { spawnSync } = require('child_process');
  const scaffoldScript = path.resolve(__dirname, '..', 'project-scaffold.cjs');

  let tempDir;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-cli-nosideeffect-'));
  });
  afterEach(() => { if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('invalid project slug ../escape exits non-zero and .do/projects/ does NOT exist', () => {
    // Fresh tempDir: no .do/ directory at all
    const projectsDir = path.join(tempDir, '.do', 'projects');
    assert.ok(!fs.existsSync(projectsDir), 'precondition: .do/projects/ must not exist');

    const proc = spawnSync('node', [scaffoldScript, 'project', '../escape'], {
      cwd: tempDir,
      encoding: 'utf-8',
    });

    assert.notStrictEqual(proc.status, 0, 'CLI should exit non-zero for invalid slug');
    // .do/projects/ must NOT have been created
    assert.ok(!fs.existsSync(projectsDir), '.do/projects/ must NOT exist after invalid-slug invocation');
  });

  it('invalid project slug /absolute exits non-zero and .do/projects/ does NOT exist', () => {
    const projectsDir = path.join(tempDir, '.do', 'projects');
    assert.ok(!fs.existsSync(projectsDir), 'precondition: .do/projects/ must not exist');

    const proc = spawnSync('node', [scaffoldScript, 'project', '/absolute/path'], {
      cwd: tempDir,
      encoding: 'utf-8',
    });

    assert.notStrictEqual(proc.status, 0, 'CLI should exit non-zero for absolute path slug');
    assert.ok(!fs.existsSync(projectsDir), '.do/projects/ must NOT exist after invalid-slug invocation');
    // stderr should contain structured JSON with invalidSlug error
    const errObj = JSON.parse(proc.stderr.trim());
    assert.strictEqual(errObj.error, 'invalidSlug');
  });
});
