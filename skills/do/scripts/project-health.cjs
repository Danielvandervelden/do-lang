#!/usr/bin/env node

/**
 * Project Health Check Script
 *
 * Performs health checks on projects initialized with .do/ folder.
 * Returns JSON with health status and any issues found.
 *
 * Usage: node project-health.cjs <project-path>
 *
 * @module project-health
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
 * @property {string|null} version - Detected version from config, or null if not found
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
 * Read and parse config.json safely
 * @param {string} configPath - Path to config.json
 * @returns {Object|null} Parsed config or null on error
 */
function readConfigSafe(configPath) {
  const content = readFileSafe(configPath);
  if (!content) return null;
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Perform all health checks on a project's .do/ folder
 * @param {string} projectPath - Path to project root
 * @returns {HealthCheckResult}
 */
function checkProjectHealth(projectPath) {
  const issues = [];

  // Check .do folder exists
  const doFolder = path.join(projectPath, '.do');
  if (!dirExists(doFolder)) {
    return {
      healthy: false,
      version: null,
      issues: [
        { type: 'noDotDoFolder', severity: 'error', details: '.do/ folder not found' }
      ]
    };
  }

  // Check config.json exists and is valid JSON
  const configPath = path.join(doFolder, 'config.json');
  const config = readConfigSafe(configPath);
  if (!config) {
    issues.push({ type: 'noConfig', severity: 'error', details: 'config.json not found or invalid' });
    return { healthy: false, version: null, issues };
  }

  // Check version field exists and is a string
  if (!config.version) {
    issues.push({ type: 'noVersion', severity: 'error', details: 'Missing version field in config.json' });
  } else if (typeof config.version !== 'string') {
    issues.push({ type: 'invalidVersion', severity: 'error', details: `version must be a string, got ${typeof config.version}` });
  }

  // Check project_name exists and is a string
  if (config.project_name === undefined) {
    issues.push({ type: 'missingField', severity: 'warning', details: 'Missing field: project_name' });
  } else if (typeof config.project_name !== 'string') {
    issues.push({ type: 'invalidField', severity: 'error', details: `project_name must be a string, got ${typeof config.project_name}` });
  }

  // Check council_reviews exists and has correct structure
  if (config.council_reviews === undefined) {
    issues.push({ type: 'missingField', severity: 'warning', details: 'Missing field: council_reviews' });
  } else if (typeof config.council_reviews !== 'object' || config.council_reviews === null) {
    issues.push({ type: 'invalidField', severity: 'error', details: `council_reviews must be an object, got ${typeof config.council_reviews}` });
  } else {
    // Validate planning and execution (accept both boolean and legacy object format)
    for (const reviewType of ['planning', 'execution']) {
      const review = config.council_reviews[reviewType];
      if (review !== undefined) {
        if (typeof review !== 'boolean') {
          // Check for legacy object format { enabled: boolean, model: string }
          if (typeof review === 'object' && review !== null) {
            if (review.enabled !== undefined && typeof review.enabled !== 'boolean') {
              issues.push({ type: 'invalidField', severity: 'warning', details: `council_reviews.${reviewType}.enabled must be a boolean` });
            }
            // Note: legacy 'model' field is deprecated but accepted for migration
          } else {
            issues.push({ type: 'invalidField', severity: 'error', details: `council_reviews.${reviewType} must be a boolean, got ${typeof review}` });
          }
        }
      }
    }

    // Validate reviewer field
    const validReviewers = ['codex', 'gemini', 'random', 'both'];
    if (config.council_reviews.reviewer !== undefined) {
      if (typeof config.council_reviews.reviewer !== 'string') {
        issues.push({ type: 'invalidField', severity: 'error', details: `council_reviews.reviewer must be a string, got ${typeof config.council_reviews.reviewer}` });
      } else if (!validReviewers.includes(config.council_reviews.reviewer)) {
        issues.push({ type: 'invalidField', severity: 'warning', details: `council_reviews.reviewer must be one of: ${validReviewers.join(', ')}. Got: ${config.council_reviews.reviewer}` });
      }
    }
  }

  // Check auto_grill_threshold exists and is a number between 0 and 1
  if (config.auto_grill_threshold === undefined) {
    issues.push({ type: 'missingField', severity: 'warning', details: 'Missing field: auto_grill_threshold' });
  } else if (typeof config.auto_grill_threshold !== 'number') {
    issues.push({ type: 'invalidField', severity: 'error', details: `auto_grill_threshold must be a number, got ${typeof config.auto_grill_threshold}` });
  } else if (config.auto_grill_threshold < 0 || config.auto_grill_threshold > 1) {
    issues.push({ type: 'invalidField', severity: 'warning', details: `auto_grill_threshold should be between 0 and 1, got ${config.auto_grill_threshold}` });
  }

  // Check tasks folder exists
  const tasksFolder = path.join(doFolder, 'tasks');
  if (!dirExists(tasksFolder)) {
    issues.push({ type: 'noTasksFolder', severity: 'error', details: '.do/tasks/ folder not found' });
  }

  // Check active_task reference if set
  if (config.active_task !== null && config.active_task !== undefined) {
    if (typeof config.active_task !== 'string') {
      issues.push({
        type: 'invalidField',
        severity: 'error',
        details: `active_task must be a string or null, got ${typeof config.active_task}`
      });
    } else if (config.active_task) {
      // Check for path traversal attempts
      if (config.active_task.includes('..') || path.isAbsolute(config.active_task)) {
        issues.push({
          type: 'invalidField',
          severity: 'error',
          details: `active_task contains invalid path: ${config.active_task}`
        });
      } else {
        const taskPath = path.join(tasksFolder, config.active_task);
        if (!fs.existsSync(taskPath)) {
          issues.push({
            type: 'staleActiveTask',
            severity: 'warning',
            details: `active_task points to missing file: ${config.active_task}`
          });
        }
      }
    }
  }

  // Determine overall health (healthy if no errors, only warnings/info)
  const hasErrors = issues.some(i => i.severity === 'error');

  return {
    healthy: !hasErrors,
    version: config.version || null,
    issues
  };
}

// CLI handling
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Project Health Check

Usage: node project-health.cjs <project-path>

Performs health checks on a project's .do/ folder.
Returns JSON with health status and any issues found.

Options:
  --help, -h    Show this help message
  --pretty      Pretty-print JSON output

Health Check Types:
  noDotDoFolder   - .do/ folder missing (error)
  noConfig        - config.json not found or invalid JSON (error)
  noVersion       - Missing version field in config.json (error)
  missingField    - Required field missing from config (warning)
  noTasksFolder   - .do/tasks/ folder missing (error)
  staleActiveTask - active_task references missing file (warning)

Example:
  node project-health.cjs .
  node project-health.cjs /path/to/project --pretty
`);
    process.exit(0);
  }

  const projectPath = args.find(a => !a.startsWith('-'));
  const pretty = args.includes('--pretty');

  if (!projectPath) {
    console.error('Error: project path required');
    console.error('Usage: node project-health.cjs <project-path>');
    process.exit(1);
  }

  const resolvedPath = path.resolve(projectPath);
  if (!dirExists(resolvedPath)) {
    console.error(`Error: project path does not exist: ${resolvedPath}`);
    process.exit(1);
  }

  const result = checkProjectHealth(resolvedPath);
  console.log(JSON.stringify(result, null, pretty ? 2 : 0));
  process.exit(result.healthy ? 0 : 1);
}

// Export for programmatic use
module.exports = { checkProjectHealth };
