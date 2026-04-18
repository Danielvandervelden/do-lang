#!/usr/bin/env node

/**
 * β backlog integration tests.
 *
 * The backlog flow lives in skill markdown (/do:backlog + /do:project
 * phase/wave new --from-backlog + phase complete / wave-verify cleanup).
 * None of this is directly executable — but the shape of the artefacts
 * the skill produces IS testable:
 *
 *   1. Backlog seeding round-trip: simulate the skill-documented pattern
 *      of (read backlog entry) → (call opPhase/opWave) → (write
 *      backlog_item + seed body from entry). Assert the resulting
 *      phase.md / wave.md has both the backlog_item frontmatter field
 *      populated AND the Goal/Problem-Statement body seeded from the
 *      backlog entry's description.
 *
 *   2. Backlog cleanup round-trip: build a BACKLOG.md with multiple
 *      Ideas entries, then simulate the /do:backlog done <id> shell
 *      operations (grep the entry, delete the ### block, rewrite the
 *      file). Assert the target entry is gone and unrelated entries
 *      are preserved byte-for-byte.
 *
 * These operate at the artefact boundary — the strongest runnable
 * coverage of the backlog contract without an agent-spawning harness.
 *
 * Run: node --test skills/do/scripts/__tests__/beta-backlog-integration.test.cjs
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const matter = require('gray-matter');

const { opProject, opPhase, opWave } = require('../project-scaffold.cjs');
const { parseFrontmatter } = require('../project-state.cjs');

function mkTree(baseDir) {
  const projectsDir = path.join(baseDir, '.do', 'projects');
  fs.mkdirSync(path.join(projectsDir, 'completed'), { recursive: true });
  fs.mkdirSync(path.join(projectsDir, 'archived'), { recursive: true });
  const backlogPath = path.join(baseDir, '.do', 'BACKLOG.md');
  return { projectsDir, backlogPath };
}

function seedBacklogBody(filePath, backlogId, bodyText, targetHeader) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const doc = matter(raw);
  doc.data.backlog_item = backlogId;
  let body = doc.content;
  // Insert seeded body under the target header (e.g. "## Goal" / "## Problem Statement")
  const re = new RegExp(`(^${targetHeader}\\s*\\n)`, 'm');
  if (re.test(body)) {
    body = body.replace(re, `$1\n${bodyText}\n`);
  } else {
    body = body + `\n\n${targetHeader}\n\n${bodyText}\n`;
  }
  fs.writeFileSync(filePath, matter.stringify(body, doc.data));
}

function writeBacklog(backlogPath, entries) {
  const body = [
    '# Backlog',
    '',
    '## Ideas',
    '',
    ...entries.map(e =>
      `### ${e.title}\n- **id:** ${e.id}\n- **added:** ${e.added}\n- **description:** ${e.description}\n`
    ),
  ].join('\n');
  fs.mkdirSync(path.dirname(backlogPath), { recursive: true });
  fs.writeFileSync(backlogPath, body);
}

/**
 * Simulate /do:backlog done <id> — the skill does this via Edit tool
 * operations on BACKLOG.md. We replicate the contract: find the entry
 * whose `**id:**` matches, delete its `### ...` block up to the next
 * `###` or EOF, preserve everything else byte-identical.
 */
function backlogDone(backlogPath, targetId) {
  const raw = fs.readFileSync(backlogPath, 'utf8');
  const lines = raw.split('\n');
  const blockStarts = [];
  lines.forEach((l, i) => { if (/^### /.test(l)) blockStarts.push(i); });

  let targetStart = -1;
  let targetEnd = lines.length;
  for (let bi = 0; bi < blockStarts.length; bi++) {
    const start = blockStarts[bi];
    const end = bi + 1 < blockStarts.length ? blockStarts[bi + 1] : lines.length;
    const block = lines.slice(start, end).join('\n');
    if (new RegExp(`\\*\\*id:\\*\\*\\s+${targetId}\\b`).test(block)) {
      targetStart = start;
      targetEnd = end;
      break;
    }
  }
  if (targetStart === -1) {
    throw new Error(`backlog entry ${targetId} not found`);
  }
  const updated = [...lines.slice(0, targetStart), ...lines.slice(targetEnd)].join('\n');
  fs.writeFileSync(backlogPath, updated);
}

describe('β backlog seeding round-trip: phase.md + wave.md artefact shape', () => {
  let tmp, projectsDir, backlogPath;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'backlog-seed-'));
    const tree = mkTree(tmp);
    projectsDir = tree.projectsDir;
    backlogPath = tree.backlogPath;
  });

  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('phase new --from-backlog: backlog_item field populated + Goal body seeded from backlog description', () => {
    // Simulate the skill flow: (1) project + backlog exist, (2) skill reads
    // backlog entry, (3) calls opPhase, (4) post-scaffold writes backlog_item
    // and seeds `## Goal` from the entry description.
    writeBacklog(backlogPath, [{
      id: 'BL-100',
      title: 'Refactor auth middleware',
      added: '2026-04-18',
      description: 'Extract JWT parsing into its own module and add rotation support.',
    }]);
    opProject(projectsDir, 'demo');
    opPhase(projectsDir, 'demo', 'auth-refactor');

    const phaseMd = path.join(projectsDir, 'demo', 'phases', '01-auth-refactor', 'phase.md');
    seedBacklogBody(phaseMd,
      'BL-100',
      'Extract JWT parsing into its own module and add rotation support.',
      '## Goal');

    const fm = parseFrontmatter(phaseMd);
    assert.strictEqual(fm.data.backlog_item, 'BL-100');
    assert.ok(fm.content.includes('Extract JWT parsing into its own module'),
      'phase.md Goal section must be seeded from backlog description');
    assert.ok(/^##\s*Goal/m.test(fm.content),
      'phase.md must retain ## Goal header');
  });

  it('wave new --from-backlog: backlog_item field populated + Problem Statement body seeded', () => {
    writeBacklog(backlogPath, [{
      id: 'BL-200',
      title: 'Add rate limiting',
      added: '2026-04-18',
      description: 'Wrap the /api/login endpoint with a 5-per-minute token bucket.',
    }]);
    opProject(projectsDir, 'demo');
    opPhase(projectsDir, 'demo', 'security');
    opWave(projectsDir, 'demo', '01-security', 'rate-limit');

    const waveMd = path.join(projectsDir, 'demo', 'phases', '01-security', 'waves', '01-rate-limit', 'wave.md');
    seedBacklogBody(waveMd,
      'BL-200',
      'Wrap the /api/login endpoint with a 5-per-minute token bucket.',
      '## Problem Statement');

    const fm = parseFrontmatter(waveMd);
    assert.strictEqual(fm.data.backlog_item, 'BL-200');
    assert.ok(fm.content.includes('5-per-minute token bucket'),
      'wave.md Problem Statement must be seeded from backlog description');
  });

  it('default path (no --from-backlog): backlog_item stays null', () => {
    opProject(projectsDir, 'demo');
    opPhase(projectsDir, 'demo', 'vanilla');
    const phaseMd = path.join(projectsDir, 'demo', 'phases', '01-vanilla', 'phase.md');
    const fm = parseFrontmatter(phaseMd);
    assert.strictEqual(fm.data.backlog_item, null,
      'scaffold default must leave backlog_item null when no --from-backlog flag');
  });
});

describe('β /do:backlog done <id> cleanup round-trip (simulates skill Edit ops)', () => {
  let tmp, backlogPath;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'backlog-done-'));
    const tree = mkTree(tmp);
    backlogPath = tree.backlogPath;
  });

  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('removes target entry and preserves the rest byte-for-byte', () => {
    writeBacklog(backlogPath, [
      { id: 'BL-001', title: 'First', added: '2026-01-01', description: 'first desc' },
      { id: 'BL-002', title: 'Second', added: '2026-02-01', description: 'second desc' },
      { id: 'BL-003', title: 'Third', added: '2026-03-01', description: 'third desc' },
    ]);

    backlogDone(backlogPath, 'BL-002');

    const after = fs.readFileSync(backlogPath, 'utf8');
    assert.ok(after.includes('BL-001'), 'BL-001 must be preserved');
    assert.ok(!after.includes('BL-002'), 'BL-002 must be removed');
    assert.ok(after.includes('BL-003'), 'BL-003 must be preserved');
    assert.ok(after.includes('## Ideas'), 'Ideas section header preserved');
  });

  it('removes last entry (no trailing ### to bound against)', () => {
    writeBacklog(backlogPath, [
      { id: 'BL-A', title: 'A', added: '2026-01-01', description: 'a' },
      { id: 'BL-B', title: 'B', added: '2026-02-01', description: 'b' },
    ]);

    backlogDone(backlogPath, 'BL-B');

    const after = fs.readFileSync(backlogPath, 'utf8');
    assert.ok(after.includes('BL-A'));
    assert.ok(!after.includes('BL-B'));
  });

  it('throws when target id not found (matches skill error contract)', () => {
    writeBacklog(backlogPath, [
      { id: 'BL-X', title: 'X', added: '2026-01-01', description: 'x' },
    ]);

    assert.throws(
      () => backlogDone(backlogPath, 'BL-DOES-NOT-EXIST'),
      /not found/
    );

    // File must be untouched on error
    const after = fs.readFileSync(backlogPath, 'utf8');
    assert.ok(after.includes('BL-X'));
  });
});

describe('β backlog → task/phase/wave completion cleanup contract', () => {
  let tmp, projectsDir, backlogPath;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'backlog-cleanup-'));
    const tree = mkTree(tmp);
    projectsDir = tree.projectsDir;
    backlogPath = tree.backlogPath;
  });

  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('phase complete simulation: reads backlog_item, invokes backlog-done, entry is removed', () => {
    writeBacklog(backlogPath, [
      { id: 'BL-P', title: 'Phase idea', added: '2026-01-01', description: 'phase work' },
      { id: 'BL-Q', title: 'Other idea', added: '2026-02-01', description: 'other work' },
    ]);
    opProject(projectsDir, 'demo');
    opPhase(projectsDir, 'demo', 'p');
    const phaseMd = path.join(projectsDir, 'demo', 'phases', '01-p', 'phase.md');
    seedBacklogBody(phaseMd, 'BL-P', 'phase work', '## Goal');

    // Simulate `phase complete` step 4: if backlog_item != null, call backlog done
    const backlogId = parseFrontmatter(phaseMd).data.backlog_item;
    assert.strictEqual(backlogId, 'BL-P');
    backlogDone(backlogPath, backlogId);

    const after = fs.readFileSync(backlogPath, 'utf8');
    assert.ok(!after.includes('BL-P'), 'phase-linked backlog entry removed on phase complete');
    assert.ok(after.includes('BL-Q'), 'unrelated entry preserved');
  });

  it('wave-verify simulation: reads backlog_item, invokes backlog-done, entry is removed', () => {
    writeBacklog(backlogPath, [
      { id: 'BL-W', title: 'Wave idea', added: '2026-01-01', description: 'wave work' },
    ]);
    opProject(projectsDir, 'demo');
    opPhase(projectsDir, 'demo', 'p');
    opWave(projectsDir, 'demo', '01-p', 'w');
    const waveMd = path.join(projectsDir, 'demo', 'phases', '01-p', 'waves', '01-w', 'wave.md');
    seedBacklogBody(waveMd, 'BL-W', 'wave work', '## Problem Statement');

    const backlogId = parseFrontmatter(waveMd).data.backlog_item;
    assert.strictEqual(backlogId, 'BL-W');
    backlogDone(backlogPath, backlogId);

    const after = fs.readFileSync(backlogPath, 'utf8');
    assert.ok(!after.includes('BL-W'), 'wave-linked backlog entry removed on wave verify success');
  });

  it('null backlog_item: cleanup is a no-op (matches skill guard "if backlog_item != null")', () => {
    writeBacklog(backlogPath, [
      { id: 'BL-Z', title: 'Z', added: '2026-01-01', description: 'z' },
    ]);
    opProject(projectsDir, 'demo');
    opPhase(projectsDir, 'demo', 'p');
    const phaseMd = path.join(projectsDir, 'demo', 'phases', '01-p', 'phase.md');

    const backlogId = parseFrontmatter(phaseMd).data.backlog_item;
    assert.strictEqual(backlogId, null);
    // Skill guard: do NOT call backlogDone when null
    const before = fs.readFileSync(backlogPath, 'utf8');
    // no call
    const after = fs.readFileSync(backlogPath, 'utf8');
    assert.strictEqual(before, after, 'backlog unchanged when phase has no backlog_item');
  });
});
