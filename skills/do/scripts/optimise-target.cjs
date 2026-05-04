#!/usr/bin/env node

/**
 * Optimise Target Detection and Analysis Script
 *
 * Handles target type detection, context gathering, and research query
 * derivation for the /do:optimise skill.
 *
 * Usage:
 *   node optimise-target.cjs [target-path] [--effort low|medium|high]
 *   node optimise-target.cjs agents/do-planner.md --effort high
 *   node optimise-target.cjs skills/do/scan.md
 *   node optimise-target.cjs --effort low
 *
 * Output: JSON to stdout with detection results and research instructions.
 *
 * @module optimise-target
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ============================================================================
// Constants
// ============================================================================

const VALID_EFFORTS = ['low', 'medium', 'high'];

const EXCLUDE_DIRS = [
  'node_modules',
  '.do',
  'dist',
  'build',
  'coverage',
  '__tests__',
  '.git',
];

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Read file contents safely, returning null if file doesn't exist.
 * @param {string} filePath
 * @returns {string|null}
 */
function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Check whether a path points to an existing file.
 * @param {string} filePath
 * @returns {boolean}
 */
function fileExists(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

/**
 * Check whether a path points to an existing directory.
 * @param {string} dirPath
 * @returns {boolean}
 */
function dirExists(dirPath) {
  try {
    return fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Recursively list all files under a directory, respecting exclude patterns.
 * @param {string} dirPath - Absolute directory path
 * @param {string[]} excludeDirs - Directory names to skip
 * @returns {string[]} Relative file paths
 */
function listFilesRecursive(dirPath, excludeDirs) {
  const results = [];

  function walk(current) {
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (excludeDirs.includes(entry.name)) continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        results.push(path.relative(dirPath, fullPath));
      }
    }
  }

  walk(dirPath);
  return results;
}

// ============================================================================
// Argument Parsing
// ============================================================================

/**
 * Parse process.argv into target path and effort level.
 * @param {string[]} argv - process.argv
 * @returns {{ targetArg: string|null, effort: string }}
 */
function parseArgs(argv) {
  const args = argv.slice(2);
  let targetArg = null;
  let effort = 'medium';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--effort' && args[i + 1]) {
      const raw = args[i + 1].toLowerCase();
      if (VALID_EFFORTS.includes(raw)) {
        effort = raw;
      }
      i++;
    } else if (!args[i].startsWith('--')) {
      targetArg = args[i];
    }
  }

  return { targetArg, effort };
}

// ============================================================================
// Target Type Detection
// ============================================================================

/**
 * Detect the type of a target from its path and content.
 *
 * Type heuristics (evaluated in order):
 *   project  — no argument given, or argument is a directory
 *   agent    — path matches agents/do-*.md or content has agent frontmatter (tools: + color:)
 *   skill    — path matches skills/do/*.md or content has skill frontmatter (name: do:*)
 *   script   — extension is .cjs or .js inside a scripts/ directory
 *   reference— *.md inside a references/ directory
 *   file     — anything else
 *
 * @param {string|null} targetArg - Raw path argument (null = project mode)
 * @param {string} cwd - Working directory for resolution
 * @returns {{ type: string, resolvedPath: string|null, error: string|null }}
 */
function detectTargetType(targetArg, cwd) {
  // No argument → project mode
  if (!targetArg) {
    return { type: 'project', resolvedPath: cwd, error: null };
  }

  const resolved = path.isAbsolute(targetArg)
    ? targetArg
    : path.resolve(cwd, targetArg);

  // Directory argument → project mode
  if (dirExists(resolved)) {
    return { type: 'project', resolvedPath: resolved, error: null };
  }

  // File must exist for all other types
  if (!fileExists(resolved)) {
    return {
      type: 'unknown',
      resolvedPath: resolved,
      error: `Target not found: ${resolved}`,
    };
  }

  const relative = path.relative(cwd, resolved);
  const ext = path.extname(resolved).slice(1).toLowerCase();
  const basename = path.basename(resolved);
  const parts = relative.split(path.sep);

  // Agent heuristic: agents/do-*.md
  if (parts[0] === 'agents' && basename.startsWith('do-') && ext === 'md') {
    return { type: 'agent', resolvedPath: resolved, error: null };
  }

  // Check content for agent frontmatter (tools: and color:)
  if (ext === 'md') {
    const content = readFileSafe(resolved) || '';
    const hasToolsKey = /^tools:/m.test(content);
    const hasColorKey = /^color:/m.test(content);
    if (hasToolsKey && hasColorKey) {
      return { type: 'agent', resolvedPath: resolved, error: null };
    }
  }

  // Skill heuristic: skills/do/*.md or skill frontmatter (name: do:*)
  if (parts[0] === 'skills' && ext === 'md') {
    return { type: 'skill', resolvedPath: resolved, error: null };
  }

  if (ext === 'md') {
    const content = readFileSafe(resolved) || '';
    if (/^name:\s*do:/m.test(content)) {
      return { type: 'skill', resolvedPath: resolved, error: null };
    }
  }

  // Script heuristic: .cjs or .js in a scripts/ directory
  if ((ext === 'cjs' || ext === 'js') && parts.includes('scripts')) {
    return { type: 'script', resolvedPath: resolved, error: null };
  }

  // Reference heuristic: .md in a references/ directory
  if (ext === 'md' && parts.includes('references')) {
    return { type: 'reference', resolvedPath: resolved, error: null };
  }

  // Generic file
  return { type: 'file', resolvedPath: resolved, error: null };
}

// ============================================================================
// Technology Detection
// ============================================================================

/**
 * Detect technologies from file content and extension.
 * @param {string} filePath - Absolute path to file
 * @param {string} type - Target type
 * @returns {string[]} Detected technology identifiers
 */
function detectTechnologies(filePath, type) {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const content = readFileSafe(filePath) || '';
  const technologies = [];

  // Type-based detection
  if (type === 'agent' || type === 'skill') {
    technologies.push('claude-code');
  }

  // Extension-based detection
  if (ext === 'cjs' || ext === 'js') {
    technologies.push('nodejs');
    if (content.includes("require('gray-matter')") || content.includes('require("gray-matter")')) {
      technologies.push('gray-matter');
    }
    if (content.includes("require('child_process')") || content.includes('require("child_process")')) {
      technologies.push('node-child-process');
    }
  }

  if (ext === 'ts' || ext === 'tsx') {
    technologies.push('typescript');
  }

  if (ext === 'json') {
    technologies.push('json');
    if (filePath.includes('package.json')) {
      technologies.push('npm');
    }
  }

  if (ext === 'md') {
    technologies.push('markdown');
  }

  return [...new Set(technologies)];
}

/**
 * Detect technologies for a whole project.
 * @param {string} projectPath - Absolute path to project root
 * @returns {string[]}
 */
function detectProjectTechnologies(projectPath) {
  const technologies = [];
  const pkgPath = path.join(projectPath, 'package.json');

  if (fileExists(pkgPath)) {
    const pkgContent = readFileSafe(pkgPath);
    if (pkgContent) {
      technologies.push('nodejs', 'npm');
      try {
        const pkg = JSON.parse(pkgContent);
        if (pkg.devDependencies?.typescript || pkg.dependencies?.typescript) {
          technologies.push('typescript');
        }
      } catch {
        // ignore parse errors
      }
    }
  }

  // Check for do-lang structure
  if (dirExists(path.join(projectPath, 'skills'))) {
    technologies.push('claude-code');
  }

  return [...new Set(technologies)];
}

// ============================================================================
// Context Gathering
// ============================================================================

/**
 * Gather context files for a project target, scoped by effort level.
 * @param {string} projectPath - Absolute path to project root
 * @param {string} effort - 'low' | 'medium' | 'high'
 * @returns {{ context_files: string[], file_scope: string }}
 */
function gatherProjectContext(projectPath, effort) {
  if (effort === 'low') {
    // Summary only: list skills/agents/scripts with types, no deep file reading
    const skillFiles = [];
    const agentFiles = [];
    const scriptFiles = [];

    const skillsDir = path.join(projectPath, 'skills');
    const agentsDir = path.join(projectPath, 'agents');
    const scriptsDir = path.join(projectPath, 'skills', 'do', 'scripts');

    if (dirExists(skillsDir)) {
      try {
        skillFiles.push(...listFilesRecursive(skillsDir, EXCLUDE_DIRS).map(f => `skills/${f}`));
      } catch { /* ignore */ }
    }

    if (dirExists(agentsDir)) {
      try {
        agentFiles.push(...listFilesRecursive(agentsDir, EXCLUDE_DIRS).map(f => `agents/${f}`));
      } catch { /* ignore */ }
    }

    if (dirExists(scriptsDir)) {
      try {
        scriptFiles.push(...listFilesRecursive(scriptsDir, EXCLUDE_DIRS).map(f => `skills/do/scripts/${f}`));
      } catch { /* ignore */ }
    }

    return {
      context_files: [],
      file_scope: 'summary',
      file_listing: { skills: skillFiles, agents: agentFiles, scripts: scriptFiles },
    };
  }

  if (effort === 'medium') {
    // Up to 10 key files: config > agents > skills > scripts > references
    const candidates = [];

    const configPath = path.join(projectPath, '.do', 'config.json');
    if (fileExists(configPath)) candidates.push('.do/config.json');

    const workspaceConfigPath = path.join(projectPath, '.do-workspace.json');
    if (fileExists(workspaceConfigPath)) candidates.push('.do-workspace.json');

    const pkgPath = path.join(projectPath, 'package.json');
    if (fileExists(pkgPath)) candidates.push('package.json');

    const agentsDir = path.join(projectPath, 'agents');
    if (dirExists(agentsDir)) {
      const agentFiles = listFilesRecursive(agentsDir, EXCLUDE_DIRS)
        .filter(f => f.endsWith('.md'))
        .slice(0, 3)
        .map(f => `agents/${f}`);
      candidates.push(...agentFiles);
    }

    const skillsDir = path.join(projectPath, 'skills', 'do');
    if (dirExists(skillsDir)) {
      const skillFiles = listFilesRecursive(skillsDir, ['scripts', ...EXCLUDE_DIRS])
        .filter(f => f.endsWith('.md'))
        .slice(0, 3)
        .map(f => `skills/do/${f}`);
      candidates.push(...skillFiles);
    }

    const scriptsDir = path.join(projectPath, 'skills', 'do', 'scripts');
    if (dirExists(scriptsDir)) {
      const scriptFiles = listFilesRecursive(scriptsDir, EXCLUDE_DIRS)
        .filter(f => f.endsWith('.cjs') && !f.includes('__tests__'))
        .slice(0, 2)
        .map(f => `skills/do/scripts/${f}`);
      candidates.push(...scriptFiles);
    }

    return {
      context_files: candidates.slice(0, 10),
      file_scope: 'key-files',
    };
  }

  // high: full scan with exclude patterns
  const allFiles = listFilesRecursive(projectPath, EXCLUDE_DIRS)
    .filter(f => !f.startsWith('.git/'));

  return {
    context_files: allFiles,
    file_scope: 'full-scan',
  };
}

/**
 * Gather context files for a specific target file.
 * @param {string} resolvedPath - Absolute path to target file
 * @param {string} type - Target type
 * @param {string} cwd - Working directory
 * @returns {string[]} Context file relative paths
 */
function gatherFileContext(resolvedPath, type, cwd) {
  const contextFiles = [];
  const relative = path.relative(cwd, resolvedPath);
  contextFiles.push(relative);

  const basename = path.basename(resolvedPath, path.extname(resolvedPath));

  if (type === 'script') {
    // Look for companion test file
    const testDir = path.join(path.dirname(resolvedPath), '__tests__');
    const testFile = path.join(testDir, `${basename}.test${path.extname(resolvedPath)}`);
    if (fileExists(testFile)) {
      contextFiles.push(path.relative(cwd, testFile));
    }

    // Look for skills that reference this script
    const skillsDir = path.join(cwd, 'skills');
    if (dirExists(skillsDir)) {
      const skillFiles = listFilesRecursive(skillsDir, EXCLUDE_DIRS).filter(f => f.endsWith('.md'));
      for (const sf of skillFiles) {
        const sfContent = readFileSafe(path.join(skillsDir, sf)) || '';
        if (sfContent.includes(basename)) {
          contextFiles.push(`skills/${sf}`);
        }
      }
    }
  }

  if (type === 'skill') {
    // Read referenced scripts from skill content
    const content = readFileSafe(resolvedPath) || '';
    const scriptRefs = [...content.matchAll(/@scripts\/([\w-]+\.cjs)/g)].map(m => m[1]);
    for (const scriptRef of scriptRefs) {
      const scriptPath = path.join(cwd, 'skills', 'do', 'scripts', scriptRef);
      if (fileExists(scriptPath)) {
        contextFiles.push(`skills/do/scripts/${scriptRef}`);
      }
    }

    // References mentioned in the skill
    const refRefs = [...content.matchAll(/@references\/([\w-]+\.md)/g)].map(m => m[1]);
    for (const refRef of refRefs) {
      const refPath = path.join(cwd, 'skills', 'do', 'references', refRef);
      if (fileExists(refPath)) {
        contextFiles.push(`skills/do/references/${refRef}`);
      }
    }
  }

  if (type === 'agent') {
    // Read all skills that reference this agent
    const skillsDir = path.join(cwd, 'skills');
    if (dirExists(skillsDir)) {
      const agentName = path.basename(resolvedPath, '.md');
      const skillFiles = listFilesRecursive(skillsDir, EXCLUDE_DIRS).filter(f => f.endsWith('.md'));
      for (const sf of skillFiles) {
        const sfContent = readFileSafe(path.join(skillsDir, sf)) || '';
        if (sfContent.includes(agentName)) {
          contextFiles.push(`skills/${sf}`);
        }
      }
    }
  }

  return [...new Set(contextFiles)];
}

// ============================================================================
// Research Query Derivation
// ============================================================================

/**
 * Derive ctx7 queries from target type and detected technologies.
 *
 * Budget policy (ceiling, not target — stop early when confident):
 *   low:    max 3 total calls (library + docs)
 *   medium: max 5 total calls (library + docs)
 *   high:   max 10 total calls (library + docs, depth from peer files + web)
 *
 * @param {string} type - Target type
 * @param {string[]} technologies - Detected technologies
 * @param {string} effort - Effort level
 * @returns {{ ctx7_queries: Object[], peer_file_patterns: string[], web_search_queries: string[] }}
 */
function deriveResearchQueries(type, technologies, effort) {
  const ctx7_queries = [];
  const peer_file_patterns = [];
  const web_search_queries = [];

  // Determine primary technology family
  let primaryFamily = null;
  let primaryLibrary = null;
  let secondaryFamily = null;
  let secondaryLibrary = null;

  if (type === 'agent' || type === 'skill') {
    primaryFamily = 'claude-code';
    primaryLibrary = 'claude-code';
  } else if (technologies.includes('nodejs')) {
    primaryFamily = 'nodejs';
    primaryLibrary = 'Node.js';
  } else if (technologies.includes('typescript')) {
    primaryFamily = 'typescript';
    primaryLibrary = 'TypeScript';
  } else if (technologies.includes('markdown')) {
    primaryFamily = 'markdown';
    primaryLibrary = 'markdown';
  }

  // Secondary family for medium/high effort
  if (effort !== 'low') {
    if (technologies.includes('nodejs') && primaryFamily !== 'nodejs') {
      secondaryFamily = 'nodejs';
      secondaryLibrary = 'Node.js';
    } else if (technologies.includes('npm') && primaryFamily === 'nodejs') {
      secondaryFamily = 'npm';
      secondaryLibrary = 'npm';
    }
  }

  // ctx7 queries based on type
  if (primaryLibrary) {
    if (type === 'agent') {
      ctx7_queries.push({
        technology_family: primaryFamily,
        library_name: primaryLibrary,
        question: 'Claude Code agent file authoring best practices and required frontmatter',
        budget_slot: 'primary-docs',
      });
    } else if (type === 'skill') {
      ctx7_queries.push({
        technology_family: primaryFamily,
        library_name: primaryLibrary,
        question: 'Claude Code skill file structure conventions and allowed-tools patterns',
        budget_slot: 'primary-docs',
      });
    } else if (type === 'script') {
      ctx7_queries.push({
        technology_family: primaryFamily,
        library_name: primaryLibrary,
        question: 'Node.js CJS module best practices, error handling, and CLI argument parsing',
        budget_slot: 'primary-docs',
      });
    } else if (type === 'project') {
      ctx7_queries.push({
        technology_family: primaryFamily,
        library_name: primaryLibrary,
        question: 'project structure and conventions best practices',
        budget_slot: 'primary-docs',
      });
    } else {
      ctx7_queries.push({
        technology_family: primaryFamily,
        library_name: primaryLibrary,
        question: `${primaryLibrary} best practices and patterns`,
        budget_slot: 'primary-docs',
      });
    }
  }

  // Second docs call for medium/high
  if (effort !== 'low' && secondaryLibrary) {
    ctx7_queries.push({
      technology_family: secondaryFamily,
      library_name: secondaryLibrary,
      question: `${secondaryLibrary} usage patterns and security best practices`,
      budget_slot: 'secondary-docs',
    });
  }

  // Secondary ctx7 query for skill/agent targets at medium/high effort
  // (the secondary derivation block above never sets secondaryLibrary for
  // claude-code primary, so this is the only secondary path for these types)
  if (effort !== 'low' && (type === 'agent' || type === 'skill')) {
    ctx7_queries.push({
      technology_family: 'claude-code',
      library_name: 'claude-code',
      question: 'Claude Code agent orchestration, subagent spawning, and parallel dispatch patterns',
      budget_slot: 'secondary-docs',
    });
  }

  // Peer file patterns
  if (effort !== 'low') {
    if (type === 'agent') {
      peer_file_patterns.push('agents/do-*.md');
    } else if (type === 'skill') {
      peer_file_patterns.push('skills/do/*.md');
    } else if (type === 'script') {
      peer_file_patterns.push('skills/do/scripts/*.cjs');
    } else if (type === 'reference') {
      peer_file_patterns.push('skills/do/references/*.md');
    } else if (type === 'project') {
      peer_file_patterns.push('agents/do-*.md', 'skills/do/*.md');
    }
  }

  // Web search queries (only for high effort)
  if (effort === 'high') {
    if (type === 'agent') {
      web_search_queries.push('Claude Code agent definition best practices examples GitHub');
      web_search_queries.push('Claude Code subagent authoring patterns site:anthropic.com OR site:github.com');
    } else if (type === 'skill') {
      web_search_queries.push('Claude Code custom commands best practices examples');
    } else if (type === 'script') {
      web_search_queries.push('Node.js CJS module best practices 2024 error handling');
      web_search_queries.push('Node.js CLI argument parsing spawnSync execSync patterns');
    } else if (type === 'project') {
      web_search_queries.push('do-lang Claude Code meta programming best practices');
    } else {
      web_search_queries.push(`${technologies.join(' ')} best practices examples 2024`);
    }
  }

  return { ctx7_queries, peer_file_patterns, web_search_queries };
}

// ============================================================================
// Main Logic
// ============================================================================

/**
 * Run the optimise target analysis.
 * @param {string[]} argv - process.argv
 * @returns {Object} Analysis result JSON
 */
function run(argv) {
  const cwd = process.cwd();
  const { targetArg, effort } = parseArgs(argv);
  const { type, resolvedPath, error } = detectTargetType(targetArg, cwd);

  if (error) {
    return {
      error,
      type: 'unknown',
      target_path: targetArg,
      effort,
      context_files: [],
      ctx7_queries: [],
      peer_file_patterns: [],
      web_search_queries: [],
      technologies: [],
      file_scope: null,
    };
  }

  // Detect technologies
  let technologies = [];
  let contextFiles = [];
  let fileScope = null;
  let fileListing = undefined;

  if (type === 'project') {
    technologies = detectProjectTechnologies(resolvedPath);
    const projectCtx = gatherProjectContext(resolvedPath, effort);
    contextFiles = projectCtx.context_files;
    fileScope = projectCtx.file_scope;
    if (projectCtx.file_listing) {
      fileListing = projectCtx.file_listing;
    }
  } else {
    technologies = detectTechnologies(resolvedPath, type);
    contextFiles = gatherFileContext(resolvedPath, type, cwd);
    fileScope = 'file';
  }

  const { ctx7_queries, peer_file_patterns, web_search_queries } = deriveResearchQueries(
    type,
    technologies,
    effort
  );

  const targetPath = resolvedPath ? path.relative(cwd, resolvedPath) : cwd;

  const result = {
    type,
    target_path: targetPath,
    effort,
    context_files: contextFiles,
    ctx7_queries,
    peer_file_patterns,
    web_search_queries,
    technologies,
    file_scope: fileScope,
  };

  if (fileListing) {
    result.file_listing = fileListing;
  }

  return result;
}

// ============================================================================
// CLI Entry Point
// ============================================================================

if (require.main === module) {
  const result = run(process.argv);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exit(result.error ? 1 : 0);
}

// ============================================================================
// Module Exports (for testing)
// ============================================================================

module.exports = {
  parseArgs,
  detectTargetType,
  detectTechnologies,
  detectProjectTechnologies,
  gatherProjectContext,
  gatherFileContext,
  deriveResearchQueries,
  run,
  VALID_EFFORTS,
  EXCLUDE_DIRS,
};
