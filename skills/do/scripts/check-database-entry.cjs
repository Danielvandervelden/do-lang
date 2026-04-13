#!/usr/bin/env node

/**
 * Database Entry Check Script
 *
 * Checks if a project has a database entry (project.md) at the expected path.
 * This script is used by /do:task to enforce the database entry gate.
 *
 * Usage:
 *   node check-database-entry.cjs                 # Check from cwd
 *   node check-database-entry.cjs <project-path>  # Check specific project
 *   node check-database-entry.cjs --pretty        # Pretty-printed JSON
 *   node check-database-entry.cjs --message       # Print user-friendly error if missing
 *   node check-database-entry.cjs --help          # Show help
 *
 * Exit codes:
 *   0 - Database entry exists
 *   1 - Database entry missing
 *   2 - Error (workspace not initialized, project not initialized, etc.)
 *
 * @module check-database-entry
 */

const fs = require('fs');
const path = require('path');

/**
 * @typedef {Object} DatabaseEntryResult
 * @property {boolean} exists - Whether the database entry exists
 * @property {string|null} project_name - Project name from config
 * @property {string|null} expected_path - Expected path to project.md
 * @property {string|null} error - Error message if something went wrong
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
 * Read and parse JSON file safely
 * @param {string} filePath - Path to JSON file
 * @returns {Object|null} Parsed JSON or null on error
 */
function readJsonSafe(filePath) {
  const content = readFileSafe(filePath);
  if (!content) return null;
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Find .do-workspace.json by traversing up from the given path
 * @param {string} startPath - Starting directory path
 * @returns {string|null} Path to .do-workspace.json or null if not found
 */
function findWorkspaceConfig(startPath) {
  let current = path.resolve(startPath);
  const root = path.parse(current).root;

  while (current !== root) {
    const configPath = path.join(current, '.do-workspace.json');
    if (fs.existsSync(configPath)) {
      return configPath;
    }
    current = path.dirname(current);
  }

  return null;
}

/**
 * Check if a project has a database entry
 * @param {string} projectPath - Path to project root
 * @returns {DatabaseEntryResult}
 */
function checkDatabaseEntry(projectPath) {
  const resolvedPath = path.resolve(projectPath);

  // Step 1: Find workspace config by traversing up
  const workspaceConfigPath = findWorkspaceConfig(resolvedPath);
  if (!workspaceConfigPath) {
    return {
      exists: false,
      project_name: null,
      expected_path: null,
      error: 'Workspace not initialized'
    };
  }

  // Step 2: Read workspace config
  const workspaceConfig = readJsonSafe(workspaceConfigPath);
  if (!workspaceConfig || !workspaceConfig.database) {
    return {
      exists: false,
      project_name: null,
      expected_path: null,
      error: 'Invalid workspace config: missing database path'
    };
  }

  const databasePath = workspaceConfig.database;

  // Step 3: Find project config
  const projectConfigPath = path.join(resolvedPath, '.do', 'config.json');
  if (!fs.existsSync(projectConfigPath)) {
    return {
      exists: false,
      project_name: null,
      expected_path: null,
      error: 'Project not initialized'
    };
  }

  // Step 4: Read project config
  const projectConfig = readJsonSafe(projectConfigPath);
  if (!projectConfig || !projectConfig.project_name) {
    return {
      exists: false,
      project_name: null,
      expected_path: null,
      error: 'Invalid project config: missing project_name'
    };
  }

  const projectName = projectConfig.project_name;

  // Step 5: Check database entry exists
  // Path per D-16: <database>/projects/<project_name>/project.md
  const expectedPath = path.join(databasePath, 'projects', projectName, 'project.md');
  const exists = fs.existsSync(expectedPath);

  return {
    exists,
    project_name: projectName,
    expected_path: expectedPath,
    error: null
  };
}

/**
 * Format user-friendly error message when database entry is missing
 * Per D-15: Clear message directing to /do:scan
 * @param {DatabaseEntryResult} result
 * @returns {string}
 */
function formatMissingEntryMessage(result) {
  if (result.error) {
    return `Error: ${result.error}`;
  }

  return `This project needs a database entry before running /do:task.

Expected path: ${result.expected_path}

Run /do:scan to create the database entry.`;
}

// CLI handling
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Database Entry Check

Usage: node check-database-entry.cjs [project-path] [options]

Checks if a project has a database entry (project.md) at the expected path.
The database entry is required before /do:task can run.

Arguments:
  project-path    Path to project (default: current directory)

Options:
  --help, -h      Show this help message
  --pretty        Pretty-print JSON output
  --message       Print user-friendly error message if entry missing

Exit codes:
  0 - Database entry exists
  1 - Database entry missing
  2 - Error (workspace/project not initialized)

Examples:
  node check-database-entry.cjs
  node check-database-entry.cjs /path/to/project
  node check-database-entry.cjs --pretty
  node check-database-entry.cjs --message

Output format (JSON):
  {
    "exists": true|false,
    "project_name": "my-project"|null,
    "expected_path": "/path/to/database/projects/my-project/project.md"|null,
    "error": null|"Error message"
  }
`);
    process.exit(0);
  }

  const projectPath = args.find(a => !a.startsWith('-')) || '.';
  const pretty = args.includes('--pretty');
  const message = args.includes('--message');

  const result = checkDatabaseEntry(projectPath);

  // Print user-friendly message if --message flag and entry is missing
  if (message && !result.exists) {
    console.error(formatMissingEntryMessage(result));
  }

  // Always output JSON to stdout (unless only --message was requested)
  if (!message || result.exists) {
    console.log(JSON.stringify(result, null, pretty ? 2 : 0));
  }

  // Exit codes: 0 if exists, 1 if missing, 2 if error
  if (result.error) {
    process.exit(2);
  }
  process.exit(result.exists ? 0 : 1);
}

// Export for programmatic use
module.exports = { checkDatabaseEntry };
