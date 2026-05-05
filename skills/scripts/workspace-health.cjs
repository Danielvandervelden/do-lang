#!/usr/bin/env node

/**
 * Workspace Health Check Script
 *
 * Performs health checks on existing workspaces initialized by /do:init.
 * Returns JSON with health status and any issues found.
 *
 * Usage: node workspace-health.cjs <workspace-path>
 *
 * @module workspace-health
 */

const fs = require('fs');
const path = require('path');

/**
 * @typedef {Object} HealthIssue
 * @property {string} type - Issue type identifier
 * @property {'error'|'warning'|'info'} severity - Issue severity
 * @property {string|string[]} details - Issue details
 */

/**
 * @typedef {Object} HealthCheckResult
 * @property {boolean} healthy - Overall health status
 * @property {string|null} version - Detected version from marker, or null if not found
 * @property {HealthIssue[]} issues - List of issues found
 */

/**
 * Read file contents safely, returning null if file doesn't exist
 * @param {string} filePath - Path to file
 * @returns {string|null} File contents or null
 */
function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Check if a directory exists
 * @param {string} dirPath - Path to directory
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
 * Extract version from "do init completed" marker in CLAUDE.md
 * @param {string} content - CLAUDE.md content
 * @returns {string|null} Version string or null
 */
function extractVersionMarker(content) {
  const match = content.match(/do init completed v([\d.]+)/);
  return match ? match[1] : null;
}

/**
 * Check for duplicate entries in __index__.md
 * @param {string} indexPath - Path to __index__.md
 * @returns {HealthIssue|null}
 */
function checkDuplicateIndex(indexPath) {
  const content = readFileSafe(indexPath);
  if (!content) return null;

  const lines = content.split('\n');
  const entries = new Map();
  const duplicates = [];

  for (const line of lines) {
    // Match markdown links or project references
    const linkMatch = line.match(/\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      const [, name, path] = linkMatch;
      const key = `${name}:${path}`;
      if (entries.has(key)) {
        duplicates.push(name);
      } else {
        entries.set(key, true);
      }
    }
  }

  if (duplicates.length > 0) {
    return {
      type: 'duplicateIndex',
      severity: 'warning',
      details: `Duplicate entries: ${duplicates.join(', ')}`
    };
  }
  return null;
}

/**
 * Check for stale project references (project folder deleted but database entry remains)
 * @param {string} databasePath - Path to database folder
 * @param {string} githubProjectsPath - Path to github-projects folder
 * @returns {HealthIssue|null}
 */
function checkStaleProjects(databasePath, githubProjectsPath) {
  const projectsDir = path.join(databasePath, 'projects');
  if (!dirExists(projectsDir)) return null;

  const stale = [];
  try {
    const dbProjects = fs.readdirSync(projectsDir);
    for (const project of dbProjects) {
      if (project.startsWith('.')) continue;
      const dbProjectPath = path.join(projectsDir, project);
      if (!fs.statSync(dbProjectPath).isDirectory()) continue;

      // Check if corresponding repo exists in github-projects (could be nested)
      const directPath = path.join(githubProjectsPath, project);
      let found = dirExists(directPath);

      // Also check subdirectories (org/project pattern)
      if (!found) {
        try {
          const orgs = fs.readdirSync(githubProjectsPath);
          for (const org of orgs) {
            const orgPath = path.join(githubProjectsPath, org);
            if (fs.statSync(orgPath).isDirectory()) {
              const nestedPath = path.join(orgPath, project);
              if (dirExists(nestedPath)) {
                found = true;
                break;
              }
            }
          }
        } catch {
          // Ignore errors reading github-projects
        }
      }

      if (!found) {
        stale.push(project);
      }
    }
  } catch {
    return null;
  }

  if (stale.length > 0) {
    return {
      type: 'staleProjects',
      severity: 'warning',
      details: stale
    };
  }
  return null;
}

/**
 * Check for orphaned database entries (no matching repo)
 * @param {string} databasePath - Path to database folder
 * @param {string} githubProjectsPath - Path to github-projects folder
 * @returns {HealthIssue|null}
 */
function checkOrphanedEntries(databasePath, githubProjectsPath) {
  // This is similar to staleProjects but reported separately for clarity
  // staleProjects: project was deleted
  // orphanedEntries: entry exists but never had a matching repo
  // For now, we combine them in staleProjects
  return null;
}

/**
 * Check for missing required sections in AGENTS.md
 * @param {string} agentsPath - Path to AGENTS.md
 * @returns {HealthIssue|null}
 */
function checkMissingAgentsSections(agentsPath) {
  const content = readFileSafe(agentsPath);
  if (!content) {
    return {
      type: 'missingAgentsSections',
      severity: 'error',
      details: 'AGENTS.md file not found'
    };
  }

  const requiredSections = [
    'Loading context',
    'Writing context',
    'Database folder naming',
    'project.md structure',
    'Git conventions',
    'Reuse before building',
    'API types',
    'Formatting',
    'Database bootstrapping'
  ];

  const missing = [];
  for (const section of requiredSections) {
    if (!content.includes(section)) {
      missing.push(section);
    }
  }

  if (missing.length > 0) {
    return {
      type: 'missingAgentsSections',
      severity: 'warning',
      details: missing
    };
  }
  return null;
}

/**
 * Check pointer file consistency (CLAUDE.md, CURSOR.md, GEMINI.md all reference AGENTS.md)
 * @param {string} workspacePath - Workspace root path
 * @returns {HealthIssue|null}
 */
function checkPointerConsistency(workspacePath) {
  const pointerFiles = ['CLAUDE.md', 'CURSOR.md', 'GEMINI.md'];
  const inconsistent = [];

  for (const file of pointerFiles) {
    const filePath = path.join(workspacePath, file);
    const content = readFileSafe(filePath);
    if (content === null) {
      inconsistent.push(`${file} missing`);
    } else if (!content.includes('AGENTS.md')) {
      inconsistent.push(`${file} does not reference AGENTS.md`);
    }
  }

  if (inconsistent.length > 0) {
    return {
      type: 'pointerConsistency',
      severity: 'error',
      details: inconsistent
    };
  }
  return null;
}

/**
 * Check version marker in CLAUDE.md
 * @param {string} workspacePath - Workspace root path
 * @returns {{version: string|null, issue: HealthIssue|null}}
 */
function checkVersionMarker(workspacePath) {
  const claudePath = path.join(workspacePath, 'CLAUDE.md');
  const content = readFileSafe(claudePath);

  if (!content) {
    return {
      version: null,
      issue: {
        type: 'versionMarker',
        severity: 'error',
        details: 'CLAUDE.md not found - workspace may not be initialized'
      }
    };
  }

  const version = extractVersionMarker(content);
  if (!version) {
    return {
      version: null,
      issue: {
        type: 'versionMarker',
        severity: 'warning',
        details: 'No "do init completed" marker found in CLAUDE.md'
      }
    };
  }

  return { version, issue: null };
}

/**
 * Perform all health checks on a workspace
 * @param {string} workspacePath - Path to workspace root
 * @returns {HealthCheckResult}
 */
function checkWorkspaceHealth(workspacePath) {
  const issues = [];

  // Load workspace config if exists
  const configPath = path.join(workspacePath, '.do-workspace.json');
  let config = null;
  try {
    config = JSON.parse(readFileSafe(configPath) || '{}');
  } catch {
    config = {};
  }

  const databasePath = config.database || path.join(workspacePath, 'database');
  const githubProjectsPath = config.githubProjects || path.join(workspacePath, 'github-projects');

  // Check version marker
  const { version, issue: versionIssue } = checkVersionMarker(workspacePath);
  if (versionIssue) issues.push(versionIssue);

  // Check for duplicate index entries
  const indexPath = path.join(databasePath, '__index__.md');
  const duplicateIssue = checkDuplicateIndex(indexPath);
  if (duplicateIssue) issues.push(duplicateIssue);

  // Check for stale projects
  const staleIssue = checkStaleProjects(databasePath, githubProjectsPath);
  if (staleIssue) issues.push(staleIssue);

  // Check AGENTS.md sections
  const agentsPath = path.join(workspacePath, 'AGENTS.md');
  const agentsIssue = checkMissingAgentsSections(agentsPath);
  if (agentsIssue) issues.push(agentsIssue);

  // Check pointer file consistency
  const pointerIssue = checkPointerConsistency(workspacePath);
  if (pointerIssue) issues.push(pointerIssue);

  // Determine overall health (healthy if no errors, only warnings/info)
  const hasErrors = issues.some(i => i.severity === 'error');

  return {
    healthy: !hasErrors,
    version,
    issues
  };
}

// CLI handling
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Workspace Health Check

Usage: node workspace-health.cjs <workspace-path>

Performs health checks on a workspace initialized by /do:init.
Returns JSON with health status and any issues found.

Options:
  --help, -h    Show this help message
  --pretty      Pretty-print JSON output

Example:
  node workspace-health.cjs ~/workspace
  node workspace-health.cjs ~/workspace --pretty
`);
    process.exit(0);
  }

  const workspacePath = args.find(a => !a.startsWith('-'));
  const pretty = args.includes('--pretty');

  if (!workspacePath) {
    console.error('Error: workspace path required');
    console.error('Usage: node workspace-health.cjs <workspace-path>');
    process.exit(1);
  }

  const resolvedPath = path.resolve(workspacePath);
  if (!dirExists(resolvedPath)) {
    console.error(`Error: workspace path does not exist: ${resolvedPath}`);
    process.exit(1);
  }

  const result = checkWorkspaceHealth(resolvedPath);
  console.log(JSON.stringify(result, null, pretty ? 2 : 0));
  process.exit(result.healthy ? 0 : 1);
}

// Export for programmatic use
module.exports = { checkWorkspaceHealth };
