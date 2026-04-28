#!/usr/bin/env node

/**
 * Structural regression tests for the three bug fixes from 260428-fix-three-backlog-bug-items.
 *
 * Bug 1 — fast-exec-load-context-arg:
 *   stage-fast-exec.md FE-2 must call load-task-context.cjs with "<description>" argument.
 *
 * Bug 2a — yaml-frontmatter-parsing:
 *   task.md and stage-fast-exec.md must contain the YAML array-literal example for
 *   exclude_paths (outside commented blocks) to prevent LLM from writing the broken
 *   JSON-stringified form.
 *
 * Bug 2b — @scripts/ prefix resolution:
 *   No file in skills/do/ should contain "node @scripts/" (shell invocation). Prose
 *   references without the "node " prefix are allowed.
 *
 * Bug 3 — json-reference-skill:
 *   config-template.md must exist as a .md wrapper; config-template.json must not
 *   exist; init.md and init-project-setup.md must reference config-template.md.
 *
 * Run: node --test skills/do/scripts/__tests__/bug-fix-structural.test.cjs
 */

'use strict';

const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const REFS_DIR = path.join(ROOT, 'skills', 'do', 'references');
const SKILLS_DIR = path.join(ROOT, 'skills', 'do');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

// ============================================================================
// Bug 1 — fast-exec-load-context-arg
// ============================================================================

describe('Bug 1 fix: stage-fast-exec.md FE-2 passes <description> to load-task-context.cjs', () => {
  const filePath = path.join(REFS_DIR, 'stage-fast-exec.md');
  let content;

  before(() => {
    assert.ok(fs.existsSync(filePath), 'stage-fast-exec.md must exist');
    content = read(filePath);
  });

  it('FE-2 calls load-task-context.cjs with "<description>" argument', () => {
    assert.ok(
      content.includes('load-task-context.cjs "<description>"'),
      'stage-fast-exec.md FE-2 must pass "<description>" to load-task-context.cjs'
    );
  });

  it('FE-2 does not invoke load-task-context.cjs as a shell command without arguments', () => {
    // Only check lines that start with "node " (actual shell invocations, not prose mentions)
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('node ') && trimmed.includes('load-task-context.cjs') && !trimmed.includes('load-task-context.cjs "<description>"')) {
        assert.fail(`Found load-task-context.cjs shell invocation without "<description>" argument: ${trimmed}`);
      }
    }
  });
});

// ============================================================================
// Bug 2a — yaml-frontmatter-parsing
// ============================================================================

describe('Bug 2a fix: task.md contains YAML array-literal example for exclude_paths', () => {
  const filePath = path.join(SKILLS_DIR, 'task.md');
  let content;

  before(() => {
    assert.ok(fs.existsSync(filePath), 'task.md must exist');
    content = read(filePath);
  });

  it('contains exclude_paths array-literal example outside commented blocks', () => {
    // The YAML block shows the substitution placeholder with an inline example:
    // `exclude_paths: <delivery_contract.exclude_paths as YAML flow-array, e.g. [".do/"]>`
    // Check for the placeholder prefix (confirms variable substitution) and the array example.
    assert.ok(
      content.includes('exclude_paths: <delivery_contract.exclude_paths'),
      'task.md must show exclude_paths as a variable substitution in the YAML rendering example'
    );
    assert.ok(
      content.includes('e.g. [".do/"]'),
      'task.md must include the array-literal example e.g. [".do/"] for exclude_paths'
    );
  });

  it('contains the no-JSON-stringify guard note', () => {
    assert.ok(
      content.includes('never as a JSON-stringified value'),
      'task.md must contain the guard note about never using JSON-stringified form for exclude_paths'
    );
  });
});

describe('Bug 2a fix: stage-fast-exec.md contains YAML array-literal example for exclude_paths', () => {
  const filePath = path.join(REFS_DIR, 'stage-fast-exec.md');
  let content;

  before(() => {
    assert.ok(fs.existsSync(filePath), 'stage-fast-exec.md must exist');
    content = read(filePath);
  });

  it('contains exclude_paths array-literal example', () => {
    assert.ok(
      content.includes('exclude_paths: <delivery_contract.exclude_paths'),
      'stage-fast-exec.md must show exclude_paths as a variable substitution in the delivery contract threading section'
    );
    assert.ok(
      content.includes('e.g. [".do/"]'),
      'stage-fast-exec.md must include the array-literal example e.g. [".do/"] for exclude_paths'
    );
  });

  it('contains the no-JSON-stringify guard note', () => {
    assert.ok(
      content.includes('never as a JSON-stringified value'),
      'stage-fast-exec.md must contain the guard note about never using JSON-stringified form for exclude_paths'
    );
  });
});

// ============================================================================
// Bug 2b — @scripts/ prefix resolution
// ============================================================================

describe('Bug 2b fix: no "node @scripts/" shell invocations remain in skills/do/', () => {
  it('zero "node @scripts/" occurrences across .md skill files', () => {
    const { execSync } = require('child_process');
    let output;
    try {
      // Only check .md files (not .cjs test files which legitimately reference the pattern as a string)
      output = execSync(`grep -rn "node @scripts/" "${SKILLS_DIR}" --include="*.md"`, { encoding: 'utf8' });
    } catch (err) {
      // grep exits with code 1 when no matches found — that's the success case here
      if (err.status === 1) {
        output = '';
      } else {
        throw err;
      }
    }
    assert.strictEqual(
      output.trim(),
      '',
      `Found "node @scripts/" shell invocations in .md files that must be replaced with absolute paths:\n${output}`
    );
  });
});

// ============================================================================
// Bug 3 — json-reference-skill
// ============================================================================

describe('Bug 3 fix: config-template.md exists as .md wrapper', () => {
  const mdPath = path.join(REFS_DIR, 'config-template.md');
  let content;

  before(() => {
    assert.ok(fs.existsSync(mdPath), 'config-template.md must exist in skills/do/references/');
    content = read(mdPath);
  });

  it('has YAML frontmatter with name field', () => {
    assert.ok(
      content.startsWith('---'),
      'config-template.md must start with YAML frontmatter'
    );
    assert.ok(
      content.includes('name: config-template'),
      'config-template.md frontmatter must have name: config-template'
    );
  });

  it('contains a JSON fenced code block with delivery_contract key', () => {
    assert.ok(
      content.includes('```json'),
      'config-template.md must contain a ```json fenced block'
    );
    assert.ok(
      content.includes('"delivery_contract"'),
      'config-template.md JSON block must contain the delivery_contract key'
    );
  });

  it('the fenced JSON is valid and parseable', () => {
    const jsonMatch = content.match(/```json\s*([\s\S]*?)```/);
    assert.ok(jsonMatch, 'config-template.md must have a ```json...``` block');
    let parsed;
    assert.doesNotThrow(() => {
      parsed = JSON.parse(jsonMatch[1].trim());
    }, 'The JSON block in config-template.md must be valid JSON');
    assert.ok(
      'delivery_contract' in parsed,
      'Parsed JSON must contain delivery_contract key'
    );
    assert.strictEqual(parsed.delivery_contract.onboarded, false);
    assert.strictEqual(parsed.delivery_contract.dismissed, false);
    assert.ok(Array.isArray(parsed.delivery_contract.entry_commands));
  });
});

describe('Bug 3 fix: config-template.json has been deleted', () => {
  it('config-template.json must not exist in skills/do/references/', () => {
    const jsonPath = path.join(REFS_DIR, 'config-template.json');
    assert.ok(
      !fs.existsSync(jsonPath),
      'config-template.json must be deleted; use config-template.md instead'
    );
  });
});

describe('Bug 3 fix: consumer skill files reference config-template.md not .json', () => {
  it('init.md references config-template.md', () => {
    const filePath = path.join(SKILLS_DIR, 'init.md');
    assert.ok(fs.existsSync(filePath), 'init.md must exist');
    const content = read(filePath);
    assert.ok(
      content.includes('config-template.md'),
      'init.md must reference config-template.md (not .json)'
    );
    assert.ok(
      !content.includes('config-template.json'),
      'init.md must not reference config-template.json'
    );
  });

  it('init-project-setup.md references config-template.md', () => {
    const filePath = path.join(REFS_DIR, 'init-project-setup.md');
    assert.ok(fs.existsSync(filePath), 'init-project-setup.md must exist');
    const content = read(filePath);
    assert.ok(
      content.includes('config-template.md'),
      'init-project-setup.md must reference config-template.md (not .json)'
    );
    assert.ok(
      !content.includes('config-template.json'),
      'init-project-setup.md must not reference config-template.json'
    );
  });
});
