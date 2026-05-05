#!/usr/bin/env node

/**
 * Structural assertion suite for β's new skill + stage-reference markdown files.
 *
 * Skills and stage references are markdown prompts, not executable code. They
 * cannot be unit-tested for runtime behavior, but they CAN be checked for:
 *   - Required section headers present
 *   - Frontmatter shape valid (name, description)
 *   - Absence of stale cross-project literals (`/do:task`, `.do/tasks/` in
 *     files that should be project-scoped only)
 *   - `project-state.cjs` CLI invocations use the documented form
 *     `set <nodeType> <path> status=X|scope=X [--project <slug>]` /
 *     `abandon <nodeType> <path> [--project <slug>]`
 *   - Single-owner claims hold (no duplicate writes to the same config key /
 *     filesystem location across stages)
 *
 * This is the "minimal smoke-test helpers" mitigation from Approach §Concerns
 * (line 207 of the β task file). It is runnable evidence that the skill
 * markdown files haven't drifted into incorrect shapes.
 *
 * Real behavioural testing of skill invocation (agent spawn → skill execution)
 * remains out of β scope per the agent-behavior-harness backlog item.
 *
 * Run: node --test skills/scripts/__tests__/beta-skill-structural.test.cjs
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const PROJECT_SKILL = path.join(ROOT, 'skills', 'project.md');
const STAGE_DIR = path.join(ROOT, 'skills', 'references');

const BETA_STAGE_FILES = [
  'stage-project-intake.md',
  'stage-project-plan-review.md',
  'stage-project-complete.md',
  'stage-phase-plan-review.md',
  'stage-wave-plan-review.md',
  'stage-wave-exec.md',
  'stage-wave-code-review.md',
  'stage-wave-verify.md',
].map(f => path.join(STAGE_DIR, f));

const { expandTemplate } = require(path.join(ROOT, 'bin', 'expand-templates.cjs'));

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

// Read and expand a template file for the claude platform.
function readExpanded(filePath) {
  return expandTemplate(fs.readFileSync(filePath, 'utf8'), 'claude');
}

describe('β skill file: skills/project.md', () => {
  let content;
  before(() => { content = readExpanded(PROJECT_SKILL); });

  it('has valid frontmatter with name and description', () => {
    const fm = matter(content);
    assert.strictEqual(fm.data.name, 'do:project');
    assert.ok(fm.data.description && fm.data.description.length > 20);
  });

  it('declares all top-level + nested subcommand handlers per orchestrator §14 (incl. γ resume stub)', () => {
    const required = ['### `new ', '### `status`', '### `complete`', '### `abandon`', '### `resume`'];
    for (const h of required) {
      assert.ok(content.includes(h), `missing section: ${h}`);
    }
    for (const h of ['### `phase`', '### `wave`']) {
      assert.ok(content.includes(h), `missing section: ${h}`);
    }
    for (const h of ['#### `phase new', '#### `phase complete', '#### `phase abandon']) {
      assert.ok(content.includes(h), `missing handler: ${h}`);
    }
    for (const h of ['#### `wave new', '#### `wave complete', '#### `wave abandon', '#### `wave next']) {
      assert.ok(content.includes(h), `missing handler: ${h}`);
    }
  });

  it('does not reference /do:task or .do/tasks/ as active context', () => {
    // Legitimate mentions: "same single-owner pattern as /do:task step X"
    // Stale mentions would be: active-task reads, task file writes, etc.
    // We accept mentions that are descriptive cross-references but reject
    // operational reads/writes against .do/tasks/.
    const operationalStale = [
      /active_task\s*=/,
      /\.do\/tasks\/<active_task>/,
      /writeFileSync.*\.do\/tasks/,
    ];
    for (const re of operationalStale) {
      assert.ok(!re.test(content), `operational /do:task reference found: ${re}`);
    }
  });

  it('abandon handler delegates fully to project-state.cjs (no duplicate mv/config-clear)', () => {
    const abandonStart = content.indexOf('### `abandon`');
    const abandonEnd = content.indexOf('###', abandonStart + 1);
    const abandonSection = content.slice(abandonStart, abandonEnd);

    // Must invoke the script
    assert.ok(abandonSection.includes('project-state.cjs abandon project'),
      'abandon must invoke project-state.cjs abandon project');
    // Must NOT re-implement the rename or config-clear
    assert.ok(!/mv \.do\/projects\/<active_project>\/.*archived/.test(abandonSection),
      'abandon must not re-mv the folder (script owns rename)');
    assert.ok(!/cfg\.active_project\s*=\s*null/.test(abandonSection),
      'abandon must not re-clear active_project (script owns clear)');
  });

  it('complete handler delegates to stage-project-complete reference', () => {
    const idx = content.indexOf('### `complete`');
    const end = content.indexOf('###', idx + 1);
    const section = content.slice(idx, end);
    assert.ok(section.includes('stage-project-complete.md'),
      'complete must invoke stage-project-complete.md reference');
  });

  it('phase complete step 5 does NOT directly write active_phase (single-owner in stage-phase-plan-review)', () => {
    const idx = content.indexOf('#### `phase complete');
    const end = content.indexOf('####', idx + 1);
    const section = content.slice(idx, end);
    // Step 5 should only read / null-write active_phase, not set it to a slug inline
    assert.ok(!/active_phase:\s*<next_phase_slug>/.test(section) ||
      /do\s*\*\*NOT\*\*\s*write\s*`active_phase`/.test(section),
      'phase complete must not inline-write active_phase to next slug (single-owner)');
  });
});

describe('β stage references: required preamble + invariants', () => {
  for (const stageFile of BETA_STAGE_FILES) {
    const name = path.basename(stageFile);

    describe(name, () => {
      let content;
      before(() => {
        assert.ok(fs.existsSync(stageFile),
          `β stage reference missing: ${name} — all 8 β stage references must exist`);
        content = readExpanded(stageFile);
      });

      it('has frontmatter with name + description', () => {
        const fm = matter(content);
        assert.ok(fm.data.name, `${name} missing frontmatter.name`);
        assert.ok(fm.data.description, `${name} missing frontmatter.description`);
      });

      it('declares caller contract', () => {
        assert.ok(/Caller contract:/i.test(content),
          `${name} must declare a caller contract`);
      });

      it('uses documented CLI form for project-state.cjs invocations', () => {
        const lines = content.split('\n').filter(l => /project-state\.cjs\s+(set|abandon|status|check)/.test(l));
        for (const line of lines) {
          if (!/node.*project-state\.cjs/.test(line)) continue;
          const valid = /project-state\.cjs\s+(set|abandon|status|check)\s+\S+/.test(line);
          assert.ok(valid, `${name} has malformed project-state.cjs invocation: ${line.trim()}`);
        }
      });
    });
  }
});

describe('β stage references: single-owner invariants', () => {
  it('active_project clear is owned exclusively by project-state.cjs (not re-done in markdown)', () => {
    const violations = [];
    for (const stageFile of BETA_STAGE_FILES) {
      if (!fs.existsSync(stageFile)) continue;
      const content = readExpanded(stageFile);
      // Look for inline active_project = null writes that are NOT script invocations
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        if (/cfg\.active_project\s*=\s*null|active_project:\s*null/.test(line) &&
            !/project-state\.cjs|already|script/i.test(line)) {
          // Further filter: if this is inside documentation prose, allow it
          const context = lines.slice(Math.max(0, i - 3), i + 3).join('\n');
          if (!/`project-state\.cjs|script\s+(owns|already|handles)/i.test(context)) {
            violations.push(`${path.basename(stageFile)}:${i + 1}: ${line.trim()}`);
          }
        }
      });
    }
    assert.deepStrictEqual(violations, [], `active_project inline-clear violations:\n${violations.join('\n')}`);
  });

  it('stage-phase-plan-review declares the idempotent project promotion gate (iter 7)', () => {
    const f = path.join(STAGE_DIR, 'stage-phase-plan-review.md');
    const content = readExpanded(f);
    assert.ok(/status\s*===?\s*['"]planning['"]/.test(content) ||
              /project.*planning.*in_progress/i.test(content),
      'stage-phase-plan-review must declare the project planning→in_progress gate');
    assert.ok(/set project <active_project> status=in_progress/.test(content) ||
              /set project.*status=in_progress/.test(content),
      'stage-phase-plan-review must invoke the project promotion CLI');
  });

  it('stage-project-complete delegates to project-state.cjs (not inline mv + clear)', () => {
    const f = path.join(STAGE_DIR, 'stage-project-complete.md');
    const content = readExpanded(f);
    assert.ok(/set project <active_project> status=completed/.test(content) ||
              /set project.*status=completed/.test(content),
      'stage-project-complete must invoke the script as single owner');
    // Should NOT re-document a manual mv of the project folder
    assert.ok(!/mv\s+\.do\/projects\/<active_project>\/\s+\.do\/projects\/completed/.test(content),
      'stage-project-complete must not re-document manual mv (script owns it)');
  });
});

describe('β backlog integration: skill-documented patterns present in project.md', () => {
  let content;
  before(() => { content = readExpanded(PROJECT_SKILL); });

  it('phase new documents --from-backlog flag', () => {
    const idx = content.indexOf('#### `phase new');
    const end = content.indexOf('####', idx + 1);
    const section = content.slice(idx, end);
    assert.ok(/--from-backlog/.test(section),
      'phase new must document --from-backlog flag');
    assert.ok(/backlog_item/.test(section) || /backlog-seed/.test(section),
      'phase new must reference backlog_item field or backlog-seed reference');
  });

  it('wave new documents --from-backlog flag', () => {
    const idx = content.indexOf('#### `wave new');
    const end = content.indexOf('####', idx + 1);
    const section = content.slice(idx, end);
    assert.ok(/--from-backlog/.test(section),
      'wave new must document --from-backlog flag');
    assert.ok(/backlog_item/.test(section) || /backlog-seed/.test(section),
      'wave new must reference backlog_item field or backlog-seed reference');
  });

  it('phase complete documents /do:backlog done cleanup trigger', () => {
    const idx = content.indexOf('#### `phase complete');
    const end = content.indexOf('####', idx + 1);
    const section = content.slice(idx, end);
    assert.ok(/\/do:backlog\s+done/.test(section),
      'phase complete must document /do:backlog done cleanup');
    assert.ok(/backlog_item/.test(section),
      'phase complete must check backlog_item before cleanup');
  });

  it('stage-wave-verify documents /do:backlog done cleanup trigger', () => {
    const f = path.join(STAGE_DIR, 'stage-wave-verify.md');
    assert.ok(fs.existsSync(f), 'stage-wave-verify.md must exist');
    const content = readExpanded(f);
    assert.ok(/\/do:backlog\s+done/.test(content),
      'stage-wave-verify must document /do:backlog done cleanup on success path');
  });
});

// Node --test global helper
function before(fn) { return require('node:test').before(fn); }
