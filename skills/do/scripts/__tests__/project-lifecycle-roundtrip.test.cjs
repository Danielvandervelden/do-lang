#!/usr/bin/env node

/**
 * Script-level lifecycle round-trip integration test for /do:project.
 *
 * Composes α's primitives (project-scaffold.cjs + project-state.cjs) in the
 * same order β's /do:project skill and stage references invoke them, then
 * asserts the resulting on-disk state matches what the skill layer promises.
 *
 * Why this test exists: β's orchestration logic lives in markdown skills
 * (skills/do/project.md + stage references) which are not directly
 * executable. The strongest runnable evidence available without an
 * agent-spawning harness is script-level composition: does the documented
 * sequence of α primitive calls actually produce the end-state β's
 * contract claims? This suite answers yes/no for the completion, abandon,
 * and iter-6/iter-7 state-machine-gate findings.
 *
 * Skill-layer integration (real /do:project subcommand invocation with
 * agent spawning, council gates, and user interaction) requires the
 * `agent-behavior-harness` backlog item.
 *
 * Run: node --test skills/do/scripts/__tests__/project-lifecycle-roundtrip.test.cjs
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const matter = require('gray-matter');

const {
  opProject,
  opPhase,
  opWave,
} = require('../project-scaffold.cjs');

const {
  opSet,
  opAbandon,
  parseFrontmatter,
} = require('../project-state.cjs');

function mkDoTree(baseDir) {
  const doDir = path.join(baseDir, '.do');
  const projectsDir = path.join(doDir, 'projects');
  fs.mkdirSync(path.join(projectsDir, 'completed'), { recursive: true });
  fs.mkdirSync(path.join(projectsDir, 'archived'), { recursive: true });
  const configPath = path.join(doDir, 'config.json');
  fs.writeFileSync(configPath, JSON.stringify({ active_project: null }, null, 2));
  return { doDir, projectsDir, configPath };
}

function readFm(filePath) {
  return parseFrontmatter(filePath).data;
}

function setActiveProject(configPath, slug) {
  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  cfg.active_project = slug;
  fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
}

function seedBacklogItem(filePath, backlogId) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const doc = matter(raw);
  doc.data.backlog_item = backlogId;
  fs.writeFileSync(filePath, matter.stringify(doc.content, doc.data));
}

function expectExit(fn) {
  const origExit = process.exit;
  const origStderrWrite = process.stderr.write.bind(process.stderr);
  let stderrOut = '';
  let exited = false;
  process.exit = () => { exited = true; throw new Error('exit'); };
  process.stderr.write = (s) => { stderrOut += s; return true; };
  try { fn(); } catch { /* swallow exit */ } finally {
    process.exit = origExit;
    process.stderr.write = origStderrWrite;
  }
  assert.ok(exited, 'expected process.exit');
  try { return JSON.parse(stderrOut); } catch { return { raw: stderrOut }; }
}

describe('project lifecycle round-trip (completion path)', () => {
  let tmp, projectsDir, configPath;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lifecycle-'));
    const tree = mkDoTree(tmp);
    projectsDir = tree.projectsDir;
    configPath = tree.configPath;
  });

  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('composes scaffold + state to run project → phase → wave → completion', () => {
    // 1. scaffold: project new
    opProject(projectsDir, 'demo-project');
    setActiveProject(configPath, 'demo-project');
    const projectMd = path.join(projectsDir, 'demo-project', 'project.md');
    const projectChangelog = path.join(projectsDir, 'demo-project', 'changelog.md');
    assert.strictEqual(readFm(projectMd).status, 'intake');

    // Intake → planning (stage-project-intake.md PI-7)
    opSet(projectsDir, 'project', 'demo-project', 'status=planning', projectChangelog, 'intake-complete');
    assert.strictEqual(readFm(projectMd).status, 'planning');

    // 2. scaffold: phase new — backlog_item seeding happens at skill layer after scaffold
    opPhase(projectsDir, 'demo-project', 'foundations');
    const phaseMd = path.join(projectsDir, 'demo-project', 'phases', '01-foundations', 'phase.md');
    seedBacklogItem(phaseMd, 'BL-001');
    assert.strictEqual(readFm(phaseMd).backlog_item, 'BL-001');
    assert.strictEqual(readFm(phaseMd).status, 'planning');

    // 3. scaffold: wave new
    opWave(projectsDir, 'demo-project', '01-foundations', 'setup');
    const waveMd = path.join(projectsDir, 'demo-project', 'phases', '01-foundations', 'waves', '01-setup', 'wave.md');
    seedBacklogItem(waveMd, 'BL-002');
    assert.strictEqual(readFm(waveMd).backlog_item, 'BL-002');
    assert.strictEqual(readFm(waveMd).status, 'planning');

    // 4. stage-phase-plan-review APPROVED: idempotent project planning → in_progress
    assert.strictEqual(readFm(projectMd).status, 'planning', 'pre-condition: project at planning before first-phase-approval gate');
    opSet(projectsDir, 'project', 'demo-project', 'status=in_progress', projectChangelog, 'first-phase-approved');
    assert.strictEqual(readFm(projectMd).status, 'in_progress');

    // 5. phase: planning → in_progress (stage-phase-plan-review approved path)
    opSet(projectsDir, 'phase', '01-foundations', 'status=in_progress', projectChangelog, 'plan-approved', 'demo-project');
    assert.strictEqual(readFm(phaseMd).status, 'in_progress');

    // 6. wave: planning → in_progress
    opSet(projectsDir, 'wave', '01-foundations/01-setup', 'status=in_progress', projectChangelog, 'wave-next', 'demo-project');
    assert.strictEqual(readFm(waveMd).status, 'in_progress');

    // 7. wave: in_progress → completed
    opSet(projectsDir, 'wave', '01-foundations/01-setup', 'status=completed', projectChangelog, 'wave-verified', 'demo-project');
    assert.strictEqual(readFm(waveMd).status, 'completed');

    // 8. phase: in_progress → completed
    opSet(projectsDir, 'phase', '01-foundations', 'status=completed', projectChangelog, 'phase-complete', 'demo-project');
    assert.strictEqual(readFm(phaseMd).status, 'completed');

    // 9. project: in_progress → completed (single-owner: validates, renames, clears config)
    opSet(projectsDir, 'project', 'demo-project', 'status=completed', projectChangelog, 'project-complete');

    const archivedProjectMd = path.join(projectsDir, 'completed', 'demo-project', 'project.md');
    assert.ok(fs.existsSync(archivedProjectMd), 'project folder renamed into completed/');
    assert.ok(!fs.existsSync(projectMd), 'original project folder removed');
    assert.strictEqual(readFm(archivedProjectMd).status, 'completed');

    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert.strictEqual(cfg.active_project, null, 'active_project cleared on project completion');
  });

  it('hard-fails project completion if project is still in planning (iter 6 council finding)', () => {
    opProject(projectsDir, 'gated-project');
    setActiveProject(configPath, 'gated-project');
    const cl = path.join(projectsDir, 'gated-project', 'changelog.md');
    opSet(projectsDir, 'project', 'gated-project', 'status=planning', cl, 'intake-complete');

    // Without the first-phase-approval promotion, completion must fail — proving
    // the iter-7 gate in stage-phase-plan-review.md is load-bearing.
    const err = expectExit(() => {
      opSet(projectsDir, 'project', 'gated-project', 'status=completed', cl, 'premature');
    });
    assert.ok(
      err.error === 'illegalTransition' || /illegal|planning/i.test(JSON.stringify(err)),
      `expected illegalTransition, got: ${JSON.stringify(err)}`
    );

    // Project folder must NOT have been moved on failed completion
    assert.ok(fs.existsSync(path.join(projectsDir, 'gated-project', 'project.md')));
    assert.ok(!fs.existsSync(path.join(projectsDir, 'completed', 'gated-project')));
  });

  it('idempotent guard: redundant in_progress→in_progress errors (proves skill-layer guard is load-bearing)', () => {
    opProject(projectsDir, 'idemp-project');
    setActiveProject(configPath, 'idemp-project');
    const cl = path.join(projectsDir, 'idemp-project', 'changelog.md');
    opSet(projectsDir, 'project', 'idemp-project', 'status=planning', cl, 'intake-complete');

    // First-phase-approval gate fires once.
    opSet(projectsDir, 'project', 'idemp-project', 'status=in_progress', cl, 'first-phase-approved');
    const projectMd = path.join(projectsDir, 'idemp-project', 'project.md');
    assert.strictEqual(readFm(projectMd).status, 'in_progress');

    // Second-phase-approval: stage-phase-plan-review step 3 guards on status === 'planning'
    // and skips the promotion call. This test proves what happens if the guard is forgotten:
    // the script-level transition in_progress→in_progress must error, so the skill's
    // guard is the only thing preventing a hard-fail on every subsequent phase approval.
    const err = expectExit(() => {
      opSet(projectsDir, 'project', 'idemp-project', 'status=in_progress', cl, 'redundant');
    });
    assert.ok(
      err.error === 'illegalTransition' || /illegal|in_progress/i.test(JSON.stringify(err)),
      `expected illegalTransition on redundant in_progress→in_progress, got: ${JSON.stringify(err)}`
    );
  });
});

describe('project lifecycle round-trip (abandon path)', () => {
  let tmp, projectsDir, configPath;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lifecycle-abandon-'));
    const tree = mkDoTree(tmp);
    projectsDir = tree.projectsDir;
    configPath = tree.configPath;
  });

  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('abandon project: single-owner script cascades, archives, and clears active_project (iter 7 council finding)', () => {
    opProject(projectsDir, 'doomed-project');
    setActiveProject(configPath, 'doomed-project');
    const cl = path.join(projectsDir, 'doomed-project', 'changelog.md');
    opSet(projectsDir, 'project', 'doomed-project', 'status=planning', cl, 'intake-complete');

    opPhase(projectsDir, 'doomed-project', 'early-phase');
    opWave(projectsDir, 'doomed-project', '01-early-phase', 'abandoned-wave');

    const projectMd = path.join(projectsDir, 'doomed-project', 'project.md');
    const phaseMd = path.join(projectsDir, 'doomed-project', 'phases', '01-early-phase', 'phase.md');
    const waveMd = path.join(projectsDir, 'doomed-project', 'phases', '01-early-phase', 'waves', '01-abandoned-wave', 'wave.md');

    assert.ok(fs.existsSync(projectMd));
    assert.ok(fs.existsSync(phaseMd));
    assert.ok(fs.existsSync(waveMd));

    // The single-owner call — β's /do:project abandon delegates here and
    // does NOT re-implement the rename or config clear.
    opAbandon(projectsDir, 'project', 'doomed-project', cl, 'test-abandon');

    // Script owns rename to archived/
    const archivedProjectMd = path.join(projectsDir, 'archived', 'doomed-project', 'project.md');
    const archivedPhaseMd = path.join(projectsDir, 'archived', 'doomed-project', 'phases', '01-early-phase', 'phase.md');
    const archivedWaveMd = path.join(projectsDir, 'archived', 'doomed-project', 'phases', '01-early-phase', 'waves', '01-abandoned-wave', 'wave.md');

    assert.ok(fs.existsSync(archivedProjectMd), 'project archived');
    assert.ok(!fs.existsSync(projectMd), 'original path removed');

    // Cascade: in-scope phase + wave get status: abandoned
    assert.strictEqual(readFm(archivedProjectMd).status, 'abandoned');
    assert.strictEqual(readFm(archivedPhaseMd).status, 'abandoned');
    assert.strictEqual(readFm(archivedWaveMd).status, 'abandoned');

    // pre_abandon_status recorded for round-trip restore
    assert.strictEqual(readFm(archivedProjectMd).pre_abandon_status, 'planning');

    // active_project cleared by the script (β's handler does NOT clear it again)
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert.strictEqual(cfg.active_project, null);
  });
});
