#!/usr/bin/env node

/**
 * Tests for optimise-target.cjs
 *
 * Uses Node.js built-in test runner (Node 16.7+)
 * Run: node --test skills/do/scripts/__tests__/optimise-target.test.cjs
 *
 * Test requirements covered:
 * - No argument → type 'project'
 * - Agent file path → type 'agent' with correct ctx7 queries
 * - Skill file path → type 'skill'
 * - CJS file path → type 'script'
 * - Generic file path → type 'file'
 * - Non-existent path → error JSON
 * - Directory path → type 'project'
 * - ctx7 query derivation per type
 * - --effort low → max 1 ctx7_query, peer_file_patterns empty, web_search_queries empty
 * - --effort medium → peer_file_patterns populated, web_search_queries empty
 * - --effort high → all three research arrays populated
 * - Project mode low → file_scope 'summary', no context_files
 * - Project mode medium → file_scope 'key-files', context_files capped at 10
 * - Project mode high → file_scope 'full-scan', includes exclude patterns
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const modulePath = path.join(__dirname, '..', 'optimise-target.cjs');

// Load module exports
let parseArgs,
  detectTargetType,
  detectTechnologies,
  detectProjectTechnologies,
  gatherProjectContext,
  gatherFileContext,
  deriveResearchQueries,
  run,
  VALID_EFFORTS,
  EXCLUDE_DIRS;

try {
  const mod = require(modulePath);
  parseArgs = mod.parseArgs;
  detectTargetType = mod.detectTargetType;
  detectTechnologies = mod.detectTechnologies;
  detectProjectTechnologies = mod.detectProjectTechnologies;
  gatherProjectContext = mod.gatherProjectContext;
  gatherFileContext = mod.gatherFileContext;
  deriveResearchQueries = mod.deriveResearchQueries;
  run = mod.run;
  VALID_EFFORTS = mod.VALID_EFFORTS;
  EXCLUDE_DIRS = mod.EXCLUDE_DIRS;
} catch (e) {
  const notImplemented = () => { throw new Error('Module not implemented'); };
  parseArgs = notImplemented;
  detectTargetType = notImplemented;
  detectTechnologies = notImplemented;
  detectProjectTechnologies = notImplemented;
  gatherProjectContext = notImplemented;
  gatherFileContext = notImplemented;
  deriveResearchQueries = notImplemented;
  run = notImplemented;
  VALID_EFFORTS = [];
  EXCLUDE_DIRS = [];
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Create a temporary directory with a given file structure.
 * @param {Object} structure - { 'relative/path': 'content' }
 * @returns {string} Temp dir path
 */
function createTempDir(structure) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'optimise-test-'));
  for (const [relPath, content] of Object.entries(structure)) {
    const absPath = path.join(tmpDir, relPath);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, content, 'utf-8');
  }
  return tmpDir;
}

/**
 * Clean up a temporary directory.
 * @param {string} tmpDir
 */
function removeTempDir(tmpDir) {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch { /* ignore */ }
}

// ============================================================================
// VALID_EFFORTS constant
// ============================================================================

describe('VALID_EFFORTS constant', () => {
  test('contains exactly low, medium, high', () => {
    assert.deepStrictEqual(VALID_EFFORTS, ['low', 'medium', 'high']);
  });
});

// ============================================================================
// EXCLUDE_DIRS constant
// ============================================================================

describe('EXCLUDE_DIRS constant', () => {
  test('includes node_modules', () => {
    assert.ok(EXCLUDE_DIRS.includes('node_modules'), 'should exclude node_modules');
  });

  test('includes .do', () => {
    assert.ok(EXCLUDE_DIRS.includes('.do'), 'should exclude .do');
  });

  test('includes build and dist', () => {
    assert.ok(EXCLUDE_DIRS.includes('dist'), 'should exclude dist');
    assert.ok(EXCLUDE_DIRS.includes('build'), 'should exclude build');
  });

  test('includes coverage', () => {
    assert.ok(EXCLUDE_DIRS.includes('coverage'), 'should exclude coverage');
  });
});

// ============================================================================
// parseArgs
// ============================================================================

describe('parseArgs', () => {
  test('no args → targetArg null, effort medium', () => {
    const result = parseArgs(['node', 'script.cjs']);
    assert.strictEqual(result.targetArg, null);
    assert.strictEqual(result.effort, 'medium');
  });

  test('positional arg only → extracted as targetArg', () => {
    const result = parseArgs(['node', 'script.cjs', 'agents/do-planner.md']);
    assert.strictEqual(result.targetArg, 'agents/do-planner.md');
    assert.strictEqual(result.effort, 'medium');
  });

  test('--effort low → effort is low', () => {
    const result = parseArgs(['node', 'script.cjs', '--effort', 'low']);
    assert.strictEqual(result.effort, 'low');
    assert.strictEqual(result.targetArg, null);
  });

  test('--effort high with target → both extracted', () => {
    const result = parseArgs(['node', 'script.cjs', 'skills/do/scan.md', '--effort', 'high']);
    assert.strictEqual(result.targetArg, 'skills/do/scan.md');
    assert.strictEqual(result.effort, 'high');
  });

  test('unknown effort value → falls back to medium', () => {
    const result = parseArgs(['node', 'script.cjs', '--effort', 'extreme']);
    assert.strictEqual(result.effort, 'medium');
  });
});

// ============================================================================
// detectTargetType
// ============================================================================

describe('detectTargetType — no argument', () => {
  test('null argument → type project', () => {
    const result = detectTargetType(null, process.cwd());
    assert.strictEqual(result.type, 'project');
    assert.strictEqual(result.error, null);
  });
});

describe('detectTargetType — directory argument', () => {
  test('existing directory → type project', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'optimise-dir-'));
    try {
      const result = detectTargetType(tmpDir, process.cwd());
      assert.strictEqual(result.type, 'project');
      assert.strictEqual(result.error, null);
    } finally {
      removeTempDir(tmpDir);
    }
  });
});

describe('detectTargetType — agent files', () => {
  test('agents/do-*.md path → type agent', () => {
    const tmpDir = createTempDir({
      'agents/do-planner.md': '---\nname: do-planner\ntools: Read, Bash\ncolor: cyan\n---\n',
    });
    try {
      const result = detectTargetType('agents/do-planner.md', tmpDir);
      assert.strictEqual(result.type, 'agent');
      assert.strictEqual(result.error, null);
    } finally {
      removeTempDir(tmpDir);
    }
  });

  test('md file with agent frontmatter (tools + color) → type agent', () => {
    const tmpDir = createTempDir({
      'custom/my-agent.md': '---\nname: my-agent\ntools: Read\ncolor: blue\n---\n# My Agent\n',
    });
    try {
      const result = detectTargetType('custom/my-agent.md', tmpDir);
      assert.strictEqual(result.type, 'agent');
    } finally {
      removeTempDir(tmpDir);
    }
  });
});

describe('detectTargetType — skill files', () => {
  test('skills/do/*.md path → type skill', () => {
    const tmpDir = createTempDir({
      'skills/do/scan.md': '---\nname: do:scan\ndescription: scan\n---\n',
    });
    try {
      const result = detectTargetType('skills/do/scan.md', tmpDir);
      assert.strictEqual(result.type, 'skill');
    } finally {
      removeTempDir(tmpDir);
    }
  });

  test('md file with skill frontmatter (name: do:*) → type skill', () => {
    const tmpDir = createTempDir({
      'other/my-skill.md': '---\nname: do:custom\ndescription: something\n---\n',
    });
    try {
      const result = detectTargetType('other/my-skill.md', tmpDir);
      assert.strictEqual(result.type, 'skill');
    } finally {
      removeTempDir(tmpDir);
    }
  });
});

describe('detectTargetType — script files', () => {
  test('.cjs file in scripts/ → type script', () => {
    const tmpDir = createTempDir({
      'skills/do/scripts/my-helper.cjs': '#!/usr/bin/env node\nmodule.exports = {};\n',
    });
    try {
      const result = detectTargetType('skills/do/scripts/my-helper.cjs', tmpDir);
      assert.strictEqual(result.type, 'script');
    } finally {
      removeTempDir(tmpDir);
    }
  });

  test('.js file in scripts/ → type script', () => {
    const tmpDir = createTempDir({
      'scripts/helper.js': 'module.exports = {};\n',
    });
    try {
      const result = detectTargetType('scripts/helper.js', tmpDir);
      assert.strictEqual(result.type, 'script');
    } finally {
      removeTempDir(tmpDir);
    }
  });
});

describe('detectTargetType — generic file', () => {
  test('arbitrary file → type file', () => {
    const tmpDir = createTempDir({
      'src/utils.ts': 'export function noop() {}\n',
    });
    try {
      const result = detectTargetType('src/utils.ts', tmpDir);
      assert.strictEqual(result.type, 'file');
    } finally {
      removeTempDir(tmpDir);
    }
  });

  test('.json file → type file', () => {
    const tmpDir = createTempDir({
      'config.json': '{"key": "value"}\n',
    });
    try {
      const result = detectTargetType('config.json', tmpDir);
      assert.strictEqual(result.type, 'file');
    } finally {
      removeTempDir(tmpDir);
    }
  });
});

describe('detectTargetType — non-existent path', () => {
  test('non-existent path → error field set, type unknown', () => {
    const result = detectTargetType('does-not-exist.md', process.cwd());
    assert.strictEqual(result.type, 'unknown');
    assert.ok(result.error, 'error should be set');
    assert.ok(result.error.includes('does-not-exist.md'), 'error should mention the path');
  });
});

// ============================================================================
// deriveResearchQueries — effort level contracts
// ============================================================================

describe('deriveResearchQueries — effort low', () => {
  test('ctx7_queries has at most 1 entry for agent type', () => {
    const { ctx7_queries, peer_file_patterns, web_search_queries } = deriveResearchQueries(
      'agent', ['claude-code'], 'low'
    );
    assert.ok(ctx7_queries.length <= 1, 'max 1 ctx7 query for low effort');
    assert.deepStrictEqual(peer_file_patterns, [], 'no peer patterns for low effort');
    assert.deepStrictEqual(web_search_queries, [], 'no web queries for low effort');
  });

  test('ctx7_queries has at most 1 entry for script type', () => {
    const { ctx7_queries, peer_file_patterns, web_search_queries } = deriveResearchQueries(
      'script', ['nodejs'], 'low'
    );
    assert.ok(ctx7_queries.length <= 1, 'max 1 ctx7 query for low effort');
    assert.deepStrictEqual(peer_file_patterns, [], 'no peer patterns');
    assert.deepStrictEqual(web_search_queries, [], 'no web queries');
  });
});

describe('deriveResearchQueries — effort medium', () => {
  test('peer_file_patterns populated for agent', () => {
    const { peer_file_patterns, web_search_queries } = deriveResearchQueries(
      'agent', ['claude-code'], 'medium'
    );
    assert.ok(peer_file_patterns.length > 0, 'peer patterns should be populated');
    assert.deepStrictEqual(web_search_queries, [], 'no web queries for medium effort');
  });

  test('peer_file_patterns populated for skill', () => {
    const { peer_file_patterns } = deriveResearchQueries('skill', ['claude-code'], 'medium');
    assert.ok(peer_file_patterns.length > 0, 'peer patterns should be populated for skill');
  });

  test('peer_file_patterns populated for script', () => {
    const { peer_file_patterns } = deriveResearchQueries('script', ['nodejs'], 'medium');
    assert.ok(peer_file_patterns.length > 0, 'peer patterns should be populated for script');
  });
});

describe('deriveResearchQueries — effort high', () => {
  test('all three research arrays populated for agent', () => {
    const { ctx7_queries, peer_file_patterns, web_search_queries } = deriveResearchQueries(
      'agent', ['claude-code'], 'high'
    );
    assert.ok(ctx7_queries.length > 0, 'ctx7 queries populated');
    assert.ok(peer_file_patterns.length > 0, 'peer patterns populated');
    assert.ok(web_search_queries.length > 0, 'web queries populated for high effort');
  });

  test('all three research arrays populated for script', () => {
    const { ctx7_queries, peer_file_patterns, web_search_queries } = deriveResearchQueries(
      'script', ['nodejs'], 'high'
    );
    assert.ok(ctx7_queries.length > 0, 'ctx7 queries populated');
    assert.ok(peer_file_patterns.length > 0, 'peer patterns populated');
    assert.ok(web_search_queries.length > 0, 'web queries populated');
  });
});

describe('deriveResearchQueries — ctx7 query content', () => {
  test('agent type → ctx7 query mentions agent authoring', () => {
    const { ctx7_queries } = deriveResearchQueries('agent', ['claude-code'], 'medium');
    const question = ctx7_queries[0]?.question || '';
    assert.ok(
      question.toLowerCase().includes('agent'),
      `ctx7 question should mention agent, got: "${question}"`
    );
  });

  test('skill type → ctx7 query mentions skill', () => {
    const { ctx7_queries } = deriveResearchQueries('skill', ['claude-code'], 'medium');
    const question = ctx7_queries[0]?.question || '';
    assert.ok(
      question.toLowerCase().includes('skill'),
      `ctx7 question should mention skill, got: "${question}"`
    );
  });

  test('script type → ctx7 query mentions Node.js', () => {
    const { ctx7_queries } = deriveResearchQueries('script', ['nodejs'], 'medium');
    const libName = ctx7_queries[0]?.library_name || '';
    assert.ok(
      libName.toLowerCase().includes('node'),
      `ctx7 library_name should mention Node, got: "${libName}"`
    );
  });
});

describe('deriveResearchQueries — secondary Claude Code query for skill/agent', () => {
  test('agent at medium effort gets secondary claude-code ctx7 query', () => {
    const { ctx7_queries } = deriveResearchQueries('agent', ['claude-code'], 'medium');
    const secondary = ctx7_queries.find(q => q.budget_slot === 'secondary-docs');
    assert.ok(secondary, 'should have a secondary-docs query');
    assert.strictEqual(secondary.library_name, 'claude-code');
  });

  test('skill at high effort gets secondary claude-code ctx7 query', () => {
    const { ctx7_queries } = deriveResearchQueries('skill', ['claude-code'], 'high');
    const secondary = ctx7_queries.find(q => q.budget_slot === 'secondary-docs');
    assert.ok(secondary, 'should have a secondary-docs query');
    assert.strictEqual(secondary.library_name, 'claude-code');
  });

  test('agent at low effort does NOT get secondary claude-code ctx7 query', () => {
    const { ctx7_queries } = deriveResearchQueries('agent', ['claude-code'], 'low');
    const secondary = ctx7_queries.find(q => q.budget_slot === 'secondary-docs');
    assert.strictEqual(secondary, undefined, 'no secondary query at low effort');
  });

  test('script type does NOT get secondary claude-code ctx7 query', () => {
    const { ctx7_queries } = deriveResearchQueries('script', ['nodejs'], 'medium');
    const secondary = ctx7_queries.find(q => q.budget_slot === 'secondary-docs' && q.library_name === 'claude-code');
    assert.strictEqual(secondary, undefined, 'script type should not get claude-code secondary');
  });
});

// ============================================================================
// gatherProjectContext — file_scope by effort
// ============================================================================

describe('gatherProjectContext — effort low', () => {
  test('file_scope is summary', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'optimise-proj-'));
    try {
      const result = gatherProjectContext(tmpDir, 'low');
      assert.strictEqual(result.file_scope, 'summary');
    } finally {
      removeTempDir(tmpDir);
    }
  });

  test('context_files is empty (summary only)', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'optimise-proj-'));
    try {
      const result = gatherProjectContext(tmpDir, 'low');
      assert.deepStrictEqual(result.context_files, []);
    } finally {
      removeTempDir(tmpDir);
    }
  });

  test('file_listing present', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'optimise-proj-'));
    try {
      const result = gatherProjectContext(tmpDir, 'low');
      assert.ok('file_listing' in result, 'file_listing should be present for low effort');
    } finally {
      removeTempDir(tmpDir);
    }
  });
});

describe('gatherProjectContext — effort medium', () => {
  test('file_scope is key-files', () => {
    const tmpDir = createTempDir({
      'package.json': '{"name": "test"}',
      '.do/config.json': '{"version": "1"}',
      'agents/do-planner.md': '---\ntools: Read\ncolor: cyan\n---\n',
    });
    try {
      const result = gatherProjectContext(tmpDir, 'medium');
      assert.strictEqual(result.file_scope, 'key-files');
    } finally {
      removeTempDir(tmpDir);
    }
  });

  test('context_files capped at 10', () => {
    // Create a project with many files
    const structure = {};
    for (let i = 1; i <= 15; i++) {
      structure[`agents/do-agent${i}.md`] = `---\ntools: Read\ncolor: cyan\n---\n`;
    }
    const tmpDir = createTempDir(structure);
    try {
      const result = gatherProjectContext(tmpDir, 'medium');
      assert.ok(result.context_files.length <= 10, `should cap at 10, got ${result.context_files.length}`);
    } finally {
      removeTempDir(tmpDir);
    }
  });
});

describe('gatherProjectContext — effort high', () => {
  test('file_scope is full-scan', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'optimise-proj-'));
    try {
      const result = gatherProjectContext(tmpDir, 'high');
      assert.strictEqual(result.file_scope, 'full-scan');
    } finally {
      removeTempDir(tmpDir);
    }
  });

  test('node_modules excluded from full-scan', () => {
    const tmpDir = createTempDir({
      'index.js': 'console.log("hi")',
      'node_modules/lodash/index.js': 'module.exports = {};',
    });
    try {
      const result = gatherProjectContext(tmpDir, 'high');
      const hasNodeModules = result.context_files.some(f => f.includes('node_modules'));
      assert.ok(!hasNodeModules, 'node_modules should be excluded from full-scan');
    } finally {
      removeTempDir(tmpDir);
    }
  });

  test('.do directory excluded from full-scan', () => {
    const tmpDir = createTempDir({
      'index.js': 'console.log("hi")',
      '.do/config.json': '{"version": "1"}',
    });
    try {
      const result = gatherProjectContext(tmpDir, 'high');
      const hasDo = result.context_files.some(f => f.startsWith('.do/'));
      assert.ok(!hasDo, '.do/ should be excluded from full-scan');
    } finally {
      removeTempDir(tmpDir);
    }
  });
});

// ============================================================================
// run() — CLI integration
// ============================================================================

describe('run() — end-to-end', () => {
  test('no args → project type JSON', () => {
    const result = run(['node', 'optimise-target.cjs']);
    assert.strictEqual(result.type, 'project');
    assert.strictEqual(result.effort, 'medium');
    assert.ok(Array.isArray(result.context_files));
    assert.ok(Array.isArray(result.ctx7_queries));
  });

  test('non-existent target → error field set', () => {
    const result = run(['node', 'optimise-target.cjs', 'nonexistent-file-xyz.md']);
    assert.ok(result.error, 'should have error field');
    assert.strictEqual(result.type, 'unknown');
  });

  test('--effort low → no peer_file_patterns', () => {
    const result = run(['node', 'optimise-target.cjs', '--effort', 'low']);
    assert.deepStrictEqual(result.peer_file_patterns, []);
    assert.deepStrictEqual(result.web_search_queries, []);
  });

  test('--effort high → web_search_queries populated (project)', () => {
    const result = run(['node', 'optimise-target.cjs', '--effort', 'high']);
    assert.ok(result.web_search_queries.length > 0, 'high effort should have web queries');
  });
});

// ============================================================================
// CLI mode (spawnSync)
// ============================================================================

describe('CLI mode — valid JSON output', () => {
  test('outputs valid JSON to stdout', () => {
    const proc = spawnSync('node', [modulePath], {
      encoding: 'utf-8',
      timeout: 10000,
    });
    let parsed;
    try {
      parsed = JSON.parse(proc.stdout);
    } catch (e) {
      assert.fail(`Invalid JSON output: ${proc.stdout}`);
    }
    assert.ok(parsed.type, 'JSON should have type field');
    assert.ok(Array.isArray(parsed.context_files), 'JSON should have context_files array');
    assert.ok(Array.isArray(parsed.ctx7_queries), 'JSON should have ctx7_queries array');
  });

  test('exits 0 on success', () => {
    const proc = spawnSync('node', [modulePath], {
      encoding: 'utf-8',
      timeout: 10000,
    });
    assert.strictEqual(proc.status, 0, 'should exit 0 for valid project target');
  });

  test('exits 1 for non-existent target', () => {
    const proc = spawnSync('node', [modulePath, 'nonexistent-xyz.md'], {
      encoding: 'utf-8',
      timeout: 10000,
    });
    assert.strictEqual(proc.status, 1, 'should exit 1 for missing target');
  });

  test('JSON output has all required fields', () => {
    const proc = spawnSync('node', [modulePath], {
      encoding: 'utf-8',
      timeout: 10000,
    });
    const parsed = JSON.parse(proc.stdout);
    const requiredFields = ['type', 'target_path', 'effort', 'context_files', 'ctx7_queries', 'peer_file_patterns', 'web_search_queries', 'technologies', 'file_scope'];
    for (const field of requiredFields) {
      assert.ok(field in parsed, `output should include field: ${field}`);
    }
  });
});
