#!/usr/bin/env node

/**
 * Task Context Loader Script
 *
 * Loads relevant context for a task based on keyword extraction from the task description.
 * Searches the project's database folders (components/, tech/, features/) for matching docs.
 *
 * Usage:
 *   node load-task-context.cjs "task description"                 # From cwd
 *   node load-task-context.cjs "task description" <project-path>  # Specific project
 *   node load-task-context.cjs --pretty                           # Pretty-printed JSON
 *   node load-task-context.cjs --help                             # Show help
 *
 * Exit codes:
 *   0 - Success (context loaded)
 *   2 - Error (workspace/project not initialized)
 *
 * @module load-task-context
 */

const fs = require("fs");
const path = require("path");

/**
 * @typedef {Object} TaskContextResult
 * @property {string|null} project_md_path - Path to project.md
 * @property {string[]} matched_docs - Paths to matched documentation files
 * @property {string[]} keywords - Extracted keywords from description
 * @property {string|null} database_path - Path to database folder for this project
 * @property {string|null} error - Error message if something went wrong
 */

/**
 * Common tech terms that indicate relevant documentation exists
 * Per D-09: Keywords for targeted context loading
 */
const TECH_TERMS = new Set([
  "datagrid",
  "table",
  "form",
  "input",
  "select",
  "autocomplete",
  "authentication",
  "auth",
  "login",
  "validation",
  "api",
  "endpoint",
  "upload",
  "download",
  "modal",
  "dialog",
  "route",
  "navigation",
  "state",
  "redux",
  "store",
  "hook",
  "i18n",
  "translation",
  "error",
  "errors",
  "loading",
  "skeleton",
  "pagination",
  "sorting",
  "filtering",
  "search",
  "dropdown",
  "button",
  "card",
  "layout",
  "sidebar",
  "header",
  "footer",
  "menu",
  "toast",
  "notification",
  "theme",
  "icon",
  "image",
  "chart",
  "graph",
  "date",
  "time",
  "calendar",
  "picker",
  "editor",
  "textarea",
  "checkbox",
  "radio",
  "switch",
  "toggle",
  "slider",
  "progress",
  "spinner",
  "tabs",
  "accordion",
  "tooltip",
  "popover",
  "drawer",
  "stepper",
  "wizard",
  "breadcrumb",
  "badge",
  "chip",
  "avatar",
  "list",
  "grid",
  "tree",
  "context",
  "provider",
  "consumer",
  "query",
  "mutation",
  "cache",
  "fetch",
  "request",
  "response",
  "middleware",
  "interceptor",
  "service",
  "repository",
  "controller",
  "model",
  "schema",
  "migrate",
  "migration",
  "seed",
  "seeder",
  "test",
  "spec",
  "mock",
  "stub",
  "fixture",
  "factory",
]);

/**
 * Read file contents safely, returning null if file doesn't exist
 * @param {string} filePath - Path to file
 * @returns {string|null} File contents or null
 */
function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, "utf-8");
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
    const configPath = path.join(current, ".do-workspace.json");
    if (fs.existsSync(configPath)) {
      return configPath;
    }
    current = path.dirname(current);
  }

  return null;
}

/**
 * Find .do/config.json by traversing up from the given path
 * @param {string} startPath - Starting directory path
 * @returns {{configPath: string, projectRoot: string}|null} Config path and project root, or null if not found
 */
function findProjectConfig(startPath) {
  let current = path.resolve(startPath);
  const root = path.parse(current).root;

  while (current !== root) {
    const configPath = path.join(current, ".do", "config.json");
    if (fs.existsSync(configPath)) {
      return { configPath, projectRoot: current };
    }
    current = path.dirname(current);
  }

  return null;
}

/**
 * Common generic words to exclude from keyword matching
 * These are words that often appear in task descriptions but don't
 * indicate specific technical context
 */
const GENERIC_WORDS = new Set([
  "feature",
  "features",
  "implement",
  "implementation",
  "support",
  "create",
  "update",
  "delete",
  "remove",
  "change",
  "modify",
  "screen",
  "screens",
  "button",
  "buttons",
  "component",
  "components",
  "should",
  "would",
  "could",
  "please",
  "thanks",
  "working",
  "broken",
  "issues",
  "problem",
  "problems",
  "system",
  "systems",
  "currently",
  "existing",
  "project",
  "projects",
  "application",
  "function",
  "functions",
  "method",
  "methods",
  "display",
  "showing",
  "happens",
  "happening",
  "whenever",
  "something",
  "anything",
  "everything",
  "nothing",
]);

/**
 * Extract keywords from a task description
 * Per D-09: Keyword matching for targeted context loading
 *
 * Only includes words that are known tech terms (from TECH_TERMS set).
 * Generic words like "feature", "implement", "support" are excluded
 * to prevent noisy matching.
 *
 * @param {string} description - Task description from user
 * @returns {string[]} Array of lowercase, deduplicated keywords
 */
function extractKeywords(description) {
  if (!description || typeof description !== "string") {
    return [];
  }

  // Split on non-word characters and filter
  const words = description
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  const keywords = new Set();

  for (const word of words) {
    // Only include if it's a known tech term AND not a generic word
    if (TECH_TERMS.has(word) && !GENERIC_WORDS.has(word)) {
      keywords.add(word);
    }
  }

  return Array.from(keywords);
}

/**
 * Check if any keyword matches in file name or content
 * @param {string} filePath - Path to .md file
 * @param {string[]} keywords - Keywords to search for
 * @returns {boolean} True if any keyword found
 */
function fileMatchesKeywords(filePath, keywords) {
  const fileName = path.basename(filePath).toLowerCase();

  // Check filename first (faster)
  for (const keyword of keywords) {
    if (fileName.includes(keyword)) {
      return true;
    }
  }

  // Check content
  const content = readFileSafe(filePath);
  if (!content) return false;

  const lowerContent = content.toLowerCase();
  for (const keyword of keywords) {
    if (lowerContent.includes(keyword)) {
      return true;
    }
  }

  return false;
}

/**
 * Get all .md files in a directory (non-recursive)
 * @param {string} dirPath - Directory path
 * @returns {string[]} Array of absolute paths to .md files
 */
function getMdFiles(dirPath) {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => path.join(dirPath, entry.name));
  } catch {
    return [];
  }
}

/**
 * Find matching documentation files in database folders
 * Per D-09: Search components/, tech/, features/ for keyword matches
 *
 * @param {string} databasePath - Path to project's database folder
 * @param {string[]} keywords - Keywords to search for
 * @returns {string[]} Array of absolute paths to matched docs
 */
function findMatchingDocs(databasePath, keywords) {
  if (!databasePath || !fs.existsSync(databasePath)) {
    return [];
  }

  if (!keywords || keywords.length === 0) {
    return [];
  }

  const searchDirs = ["components", "tech", "features"];
  const matched = [];

  for (const dir of searchDirs) {
    const dirPath = path.join(databasePath, dir);
    const mdFiles = getMdFiles(dirPath);

    for (const filePath of mdFiles) {
      if (fileMatchesKeywords(filePath, keywords)) {
        matched.push(filePath);
      }
    }
  }

  return matched;
}

/**
 * Load task context by finding workspace config, project config, and matching docs
 *
 * @param {string} projectPath - Path to start search from (can be nested within project)
 * @param {string} description - Task description for keyword extraction
 * @returns {TaskContextResult}
 */
function loadTaskContext(projectPath, description) {
  const resolvedPath = path.resolve(projectPath);
  const keywords = extractKeywords(description);

  // Step 1: Find workspace config by traversing up
  const workspaceConfigPath = findWorkspaceConfig(resolvedPath);
  if (!workspaceConfigPath) {
    return {
      project_md_path: null,
      matched_docs: [],
      keywords,
      database_path: null,
      error: "Workspace not initialized",
    };
  }

  // Step 2: Read workspace config
  const workspaceConfig = readJsonSafe(workspaceConfigPath);
  if (!workspaceConfig || !workspaceConfig.database) {
    return {
      project_md_path: null,
      matched_docs: [],
      keywords,
      database_path: null,
      error: "Invalid workspace config: missing database path",
    };
  }

  const baseDatabasePath = workspaceConfig.database;

  // Step 3: Find project config by traversing up (supports nested directories)
  const projectResult = findProjectConfig(resolvedPath);
  if (!projectResult) {
    return {
      project_md_path: null,
      matched_docs: [],
      keywords,
      database_path: null,
      error: "Project not initialized",
    };
  }

  // Step 4: Read project config
  const projectConfig = readJsonSafe(projectResult.configPath);
  if (!projectConfig || !projectConfig.project_name) {
    return {
      project_md_path: null,
      matched_docs: [],
      keywords,
      database_path: null,
      error: "Invalid project config: missing project_name",
    };
  }

  const projectName = projectConfig.project_name;

  // Step 5: Build database path for this project
  const databasePath = path.join(baseDatabasePath, "projects", projectName);
  const projectMdPath = path.join(databasePath, "project.md");

  // Step 6: Find matching docs
  const matchedDocs = findMatchingDocs(databasePath, keywords);

  return {
    project_md_path: fs.existsSync(projectMdPath) ? projectMdPath : null,
    matched_docs: matchedDocs,
    keywords,
    database_path: databasePath,
    error: null,
  };
}

// CLI handling
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Task Context Loader

Usage: node load-task-context.cjs "task description" [project-path] [options]

Loads relevant context for a task based on keyword extraction.
Searches the project's database folders (components/, tech/, features/)
for documentation that matches task keywords.

Arguments:
  description     Task description to extract keywords from (required)
  project-path    Path to project (default: current directory)

Options:
  --help, -h      Show this help message
  --pretty        Pretty-print JSON output

Exit codes:
  0 - Success (context loaded)
  2 - Error (workspace/project not initialized)

Examples:
  node load-task-context.cjs "Fix login form validation"
  node load-task-context.cjs "Add DataGrid sorting" /path/to/project
  node load-task-context.cjs "Fix auth bug" --pretty

Output format (JSON):
  {
    "project_md_path": "/path/to/database/projects/my-project/project.md",
    "matched_docs": ["/path/to/components/FormFields.md"],
    "keywords": ["form", "validation", "login"],
    "database_path": "/path/to/database/projects/my-project",
    "error": null
  }
`);
    process.exit(0);
  }

  const pretty = args.includes("--pretty");
  const nonFlagArgs = args.filter((a) => !a.startsWith("-"));

  const description = nonFlagArgs[0];
  const projectPath = nonFlagArgs[1] || ".";

  if (!description) {
    console.error(
      JSON.stringify(
        { error: "No task description provided" },
        null,
        pretty ? 2 : 0,
      ),
    );
    process.exit(2);
  }

  const result = loadTaskContext(projectPath, description);

  console.log(JSON.stringify(result, null, pretty ? 2 : 0));

  // Exit codes: 0 if success, 2 if error
  process.exit(result.error ? 2 : 0);
}

// Export for programmatic use
module.exports = { extractKeywords, findMatchingDocs, loadTaskContext };
