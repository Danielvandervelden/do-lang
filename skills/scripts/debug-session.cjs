#!/usr/bin/env node

/**
 * Debug Session Management Script
 *
 * Provides session management functions for the /do:debug workflow.
 * Implements scientific method debugging with status transitions,
 * session creation, and active session detection.
 *
 * Usage:
 *   node debug-session.cjs check [config-path]           # Check for active debug session
 *   node debug-session.cjs create "<trigger>" [taskRef]  # Create new debug session
 *   node debug-session.cjs parse <filename>              # Parse debug file
 *   node debug-session.cjs --help                        # Show help
 *
 * Exit codes:
 *   0 - Success
 *   1 - Error
 *
 * @module debug-session
 */

const fs = require("fs");
const path = require("path");

/**
 * Valid status transitions for debug sessions (per D-42)
 *
 * Flow: gathering -> investigating -> fixing -> verifying -> awaiting_human_verify -> resolved
 * With loops: verifying -> investigating (fix didn't work), awaiting_human_verify -> investigating (user reports still broken)
 */
const STATUS_TRANSITIONS = {
  gathering: ["investigating"],
  investigating: ["fixing"],
  fixing: ["verifying"],
  verifying: ["investigating", "awaiting_human_verify"],
  awaiting_human_verify: ["resolved", "investigating"],
  resolved: [], // Terminal state
};

/**
 * Check if a status transition is valid
 * @param {string} from - Current status
 * @param {string} to - Target status
 * @returns {boolean} True if transition is allowed
 */
function canTransition(from, to) {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Generate a slug from the first 5 words of a trigger description
 * @param {string} trigger - Debug trigger description
 * @returns {string} Kebab-case slug
 */
function generateSlug(trigger) {
  if (!trigger || typeof trigger !== "string") {
    return "debug-session";
  }

  // Remove special characters, keep alphanumeric and spaces
  const cleaned = trigger.replace(/[^a-zA-Z0-9\s]/g, "");

  // Split into words and take first 5
  const words = cleaned.split(/\s+/).filter(Boolean).slice(0, 5);

  if (words.length === 0) {
    return "debug-session";
  }

  // Kebab-case
  return words.join("-").toLowerCase();
}

/**
 * Generate filename in YYMMDD-slug.md format
 * @param {string} trigger - Debug trigger description
 * @returns {string} Filename
 */
function generateFilename(trigger) {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");

  const slug = generateSlug(trigger);

  return `${yy}${mm}${dd}-${slug}.md`;
}

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
 * Atomic write: write to temp file, then rename
 * Prevents corruption if write is interrupted
 * @param {string} targetPath - Final file path
 * @param {string} content - Content to write
 */
function safeWriteFile(targetPath, content) {
  const tmpPath = path.join(
    path.dirname(targetPath),
    `.tmp-${path.basename(targetPath)}`,
  );
  fs.writeFileSync(tmpPath, content, "utf8");
  fs.renameSync(tmpPath, targetPath);
}

/**
 * Parse YAML frontmatter from markdown content
 * @param {string} content - Markdown content with YAML frontmatter
 * @returns {Object|null} Parsed frontmatter or null on error
 */
function parseYamlFrontmatter(content) {
  if (!content || typeof content !== "string") {
    return null;
  }

  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    return null;
  }

  const yamlContent = match[1];
  const frontmatter = {};

  // Simple YAML parser for flat key-value pairs
  const lines = yamlContent.split(/\r?\n/);

  // Check for required keys in debug files
  const requiredKeys = ["status", "trigger"];
  let foundKeys = new Set();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const colonIndex = line.indexOf(":");
    // Lines without colons (like "status investigating") are malformed
    if (colonIndex === -1) {
      // Check if this looks like it should be a key-value pair
      if (trimmed.split(/\s+/).length >= 2) {
        // Multiple words without colon - likely malformed YAML
        return null;
      }
      continue;
    }

    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();

    foundKeys.add(key);

    // Check for unclosed quotes (malformed YAML)
    if (
      (value.startsWith('"') && !value.endsWith('"')) ||
      (value.startsWith("'") && !value.endsWith("'"))
    ) {
      // Malformed frontmatter - unclosed quote
      return null;
    }

    // Handle quoted strings
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // Handle null
    if (value === "null" || value === "") {
      value = null;
    }

    frontmatter[key] = value;
  }

  return frontmatter;
}

/**
 * Parse Current Focus section from markdown content
 * @param {string} content - Markdown content
 * @returns {Object} Current Focus fields
 */
function parseCurrentFocus(content) {
  const section = extractSection(content, "Current Focus");
  if (!section) {
    return { hypothesis: null, test: null, expecting: null, next_action: null };
  }

  const fields = {};
  const patterns = ["hypothesis", "test", "expecting", "next_action"];

  for (const pattern of patterns) {
    const regex = new RegExp(`^${pattern}:\\s*(.*)$`, "m");
    const match = section.match(regex);
    fields[pattern] = match ? match[1].trim() || null : null;
  }

  return fields;
}

/**
 * Extract a section from markdown content
 * @param {string} content - Markdown content
 * @param {string} sectionName - Name of section (without ## prefix)
 * @returns {string|null} Section content or null if not found
 */
function extractSection(content, sectionName) {
  const regex = new RegExp(
    `## ${sectionName}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`,
    "i",
  );
  const match = content.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Parse debug file content (can accept content string or file path)
 * @param {string} filePathOrContent - Path to debug file or content string
 * @returns {Object} Parsed debug file with frontmatter and sections
 */
function parseDebugFile(filePathOrContent) {
  // Check if it's a file path or content
  let content = filePathOrContent;
  if (
    !filePathOrContent.includes("\n") &&
    !filePathOrContent.startsWith("---")
  ) {
    // Looks like a path
    content = readFileSafe(filePathOrContent);
    if (!content) {
      return { frontmatter: null, sections: {}, error: "File not found" };
    }
  }

  // Parse frontmatter
  const frontmatter = parseYamlFrontmatter(content);
  if (!frontmatter) {
    return { frontmatter: null, sections: {}, error: "Invalid frontmatter" };
  }

  // Parse sections
  const sections = {
    currentFocus: parseCurrentFocus(content),
    symptoms: extractSection(content, "Symptoms"),
    eliminated: extractSection(content, "Eliminated"),
    evidence: extractSection(content, "Evidence"),
    resolution: extractSection(content, "Resolution"),
  };

  return { frontmatter, sections };
}

/**
 * Find .do/config.json by traversing up from the given path
 * @param {string} startPath - Starting directory path
 * @returns {string|null} Path to config.json or null if not found
 */
function findProjectConfig(startPath) {
  let current = path.resolve(startPath);
  const root = path.parse(current).root;

  while (current !== root) {
    const configPath = path.join(current, ".do", "config.json");
    if (fs.existsSync(configPath)) {
      return configPath;
    }
    current = path.dirname(current);
  }

  return null;
}

/**
 * Check for active debug session (per D-45, D-46)
 * @param {string} configPath - Path to .do/config.json
 * @returns {Object} Active session status
 */
function checkActiveDebug(configPath) {
  const config = readJsonSafe(configPath);
  if (!config) {
    return { active: false };
  }

  if (!config.active_debug) {
    return { active: false };
  }

  // Check if the debug file actually exists
  const configDir = path.dirname(configPath);
  const debugPath = path.join(configDir, "debug", config.active_debug);

  if (!fs.existsSync(debugPath)) {
    // Stale reference
    return { active: false, stale: config.active_debug };
  }

  // Parse the debug file for status and hypothesis
  const { frontmatter } = parseDebugFile(debugPath);
  if (!frontmatter) {
    return { active: false, stale: config.active_debug };
  }

  return {
    active: true,
    file: config.active_debug,
    status: frontmatter.status || "unknown",
    hypothesis: frontmatter.current_hypothesis || null,
  };
}

/**
 * Generate debug file content from template
 * @param {string} trigger - Debug trigger description
 * @param {string|null} taskRef - Optional reference to active task
 * @returns {string} Debug file content
 */
function generateDebugContent(trigger, taskRef = null) {
  const now = new Date().toISOString();

  return `---
status: gathering
trigger: "${trigger.replace(/"/g, '\\"')}"
created: ${now}
updated: ${now}
current_hypothesis: null
task_ref: ${taskRef ? `"${taskRef}"` : "null"}
---

## Current Focus
<!-- OVERWRITE on each update - always reflects NOW -->

hypothesis:
test:
expecting:
next_action: gather symptoms

## Symptoms
<!-- IMMUTABLE after gathering - reference point for what we're fixing -->

expected:
actual:
errors:
reproduction:
started:

## Eliminated
<!-- APPEND only - prevents re-investigating dead ends after /clear -->

## Evidence
<!-- APPEND only - facts discovered during investigation -->

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause:
fix:
verification:
files_changed: []
`;
}

/**
 * Create a new debug session (per D-40)
 * @param {string} trigger - Debug trigger description
 * @param {string|null} taskRef - Optional reference to active task
 * @param {string} configPath - Path to .do/config.json (for finding template and debug dir)
 * @returns {Object} Created session info with filename and optionally path
 */
function createDebugSession(trigger, taskRef = null, configPath = null) {
  // Generate filename
  const filename = generateFilename(trigger);

  // Find config path if not provided
  if (!configPath) {
    configPath = findProjectConfig(process.cwd());
  }

  // If no config path found, just return filename (for testing scenarios)
  if (!configPath) {
    return { filename };
  }

  const configDir = path.dirname(configPath);
  const debugDir = path.join(configDir, "debug");
  const debugPath = path.join(debugDir, filename);

  // Create debug directory if needed
  if (!fs.existsSync(debugDir)) {
    fs.mkdirSync(debugDir, { recursive: true });
  }

  // Generate content
  const content = generateDebugContent(trigger, taskRef);

  // Write using atomic pattern
  safeWriteFile(debugPath, content);

  return {
    filename,
    path: debugPath,
  };
}

/**
 * Update debug session status with validation (per D-42)
 * @param {string} filePath - Path to debug file
 * @param {string} newStatus - Target status
 * @param {Object} updates - Section updates to apply
 * @returns {Object} Update result
 */
function updateDebugStatus(filePath, newStatus, updates = {}) {
  const content = readFileSafe(filePath);
  if (!content) {
    return { error: "Debug file not found" };
  }

  const { frontmatter } = parseDebugFile(content);
  if (!frontmatter) {
    return { error: "Invalid debug file frontmatter" };
  }

  const currentStatus = frontmatter.status;

  // Validate transition
  if (!canTransition(currentStatus, newStatus)) {
    return {
      error: `Invalid transition: ${currentStatus} -> ${newStatus}`,
      allowed: STATUS_TRANSITIONS[currentStatus] || [],
    };
  }

  // Update frontmatter
  let updatedContent = content.replace(
    /^status:\s*.+$/m,
    `status: ${newStatus}`,
  );
  updatedContent = updatedContent.replace(
    /^updated:\s*.+$/m,
    `updated: ${new Date().toISOString()}`,
  );

  // Update current_hypothesis if provided
  if ("current_hypothesis" in updates) {
    const hypValue =
      updates.current_hypothesis === null
        ? "null"
        : `"${updates.current_hypothesis}"`;
    updatedContent = updatedContent.replace(
      /^current_hypothesis:\s*.+$/m,
      `current_hypothesis: ${hypValue}`,
    );
  }

  // Write using atomic pattern
  safeWriteFile(filePath, updatedContent);

  return { success: true, from: currentStatus, to: newStatus };
}

// CLI handling
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h") || args.length === 0) {
    console.log(`
Debug Session Management

Usage: node debug-session.cjs <command> [args]

Commands:
  check [config-path]           Check for active debug session
  create "<trigger>" [taskRef]  Create new debug session
  parse <filename>              Parse debug file

Options:
  --help, -h      Show this help message

Examples:
  node debug-session.cjs check
  node debug-session.cjs check .do/config.json
  node debug-session.cjs create "Login form shows undefined error"
  node debug-session.cjs create "API returns 500" "260413-fix-api.md"
  node debug-session.cjs parse .do/debug/260413-login-form.md
`);
    process.exit(0);
  }

  const command = args[0];

  try {
    switch (command) {
      case "check": {
        const configPath = args[1] || findProjectConfig(process.cwd());
        if (!configPath) {
          console.log(JSON.stringify({ active: false }));
        } else {
          const result = checkActiveDebug(configPath);
          console.log(JSON.stringify(result));
        }
        break;
      }

      case "create": {
        const trigger = args[1];
        const taskRef = args[2] || null;

        if (!trigger) {
          console.error(
            JSON.stringify({ error: "Trigger description required" }),
          );
          process.exit(1);
        }

        const result = createDebugSession(trigger, taskRef);
        console.log(JSON.stringify(result));
        if (result.error) {
          process.exit(1);
        }
        break;
      }

      case "parse": {
        const filePath = args[1];
        if (!filePath) {
          console.error(JSON.stringify({ error: "File path required" }));
          process.exit(1);
        }

        const result = parseDebugFile(filePath);
        console.log(JSON.stringify(result, null, 2));
        break;
      }

      default:
        console.error(JSON.stringify({ error: `Unknown command: ${command}` }));
        process.exit(1);
    }
  } catch (err) {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  }
}

// Export for programmatic use and testing
module.exports = {
  STATUS_TRANSITIONS,
  canTransition,
  createDebugSession,
  parseDebugFile,
  checkActiveDebug,
  updateDebugStatus,
  generateFilename,
  generateSlug,
  safeWriteFile,
};
