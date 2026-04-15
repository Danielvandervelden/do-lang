#!/usr/bin/env node

/**
 * Task Abandonment Script
 *
 * Provides task abandonment functionality for the /do:task workflow.
 * Handles active task detection and abandonment marking.
 *
 * Usage:
 *   node task-abandon.cjs check [--config <path>]
 *   node task-abandon.cjs abandon <filename> [--config <path>]
 *
 * @module task-abandon
 */

const fs = require("fs");
const path = require("path");

// gray-matter for YAML frontmatter parsing
let matter;
try {
  matter = require("gray-matter");
} catch {
  // Fallback: simple YAML parsing if gray-matter not available
  matter = null;
}

/**
 * Read JSON file safely
 * @param {string} filePath - Path to JSON file
 * @returns {Object|null} Parsed JSON or null
 */
function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

/**
 * Validate filename for path traversal attacks (council requirement)
 * @param {string} filename - Filename to validate
 * @returns {{valid: boolean, error?: string}} Validation result
 */
function validateFilename(filename) {
  if (!filename || typeof filename !== "string") {
    return { valid: false, error: "Invalid filename: must be a non-empty string" };
  }
  if (filename.includes("..")) {
    return { valid: false, error: "Invalid filename: path traversal (..) not allowed" };
  }
  if (path.isAbsolute(filename)) {
    return { valid: false, error: "Invalid filename: absolute paths not allowed" };
  }
  return { valid: true };
}

/**
 * Parse simple YAML value (handles quoted strings, null, booleans)
 * @param {string} value - Raw YAML value string
 * @returns {*} Parsed value
 */
function parseYamlValue(value) {
  const trimmed = value.trim();
  if (trimmed === "null" || trimmed === "") return null;
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  // Handle quoted strings
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Parse YAML frontmatter from markdown
 * @param {string} content - Markdown content
 * @returns {{data: Object, content: string}} Parsed frontmatter and body
 */
function parseFrontmatter(content) {
  if (matter) {
    return matter(content);
  }
  // Simple fallback parser that handles nested objects
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { data: {}, content };
  }

  const yaml = match[1];
  const data = {};
  const lines = yaml.split(/\r?\n/);
  let currentObj = null;
  let currentKey = null;

  for (const line of lines) {
    // Skip empty lines
    if (!line.trim()) continue;

    // Check if this is a nested property (starts with spaces)
    const nestedMatch = line.match(/^(\s{2,})(\w+):\s*(.*)$/);
    if (nestedMatch && currentObj && currentKey) {
      const [, , nestedKey, nestedValue] = nestedMatch;
      data[currentKey][nestedKey] = parseYamlValue(nestedValue);
      continue;
    }

    // Top-level property
    const topMatch = line.match(/^(\w+):\s*(.*)$/);
    if (topMatch) {
      const [, key, value] = topMatch;
      if (value === "" || value.trim() === "") {
        // This might be a nested object - create empty object
        data[key] = {};
        currentObj = data[key];
        currentKey = key;
      } else {
        data[key] = parseYamlValue(value);
        currentObj = null;
        currentKey = null;
      }
    }
  }

  return { data, content: match[2] };
}

/**
 * Format a YAML value for output
 * @param {*} value - Value to format
 * @returns {string} Formatted value
 */
function formatYamlValue(value) {
  if (value === null) return "null";
  if (typeof value === "boolean") return value.toString();
  if (typeof value === "string") {
    // Quote strings that contain special chars or spaces
    if (value.includes(":") || value.includes("#") || value.includes(" ") ||
        value.includes("\n") || value.includes('"')) {
      return `"${value.replace(/"/g, '\\"')}"`;
    }
    return value;
  }
  return String(value);
}

/**
 * Stringify frontmatter back to markdown
 * @param {string} content - Markdown body
 * @param {Object} data - Frontmatter data
 * @returns {string} Complete markdown with frontmatter
 */
function stringifyFrontmatter(content, data) {
  if (matter) {
    return matter.stringify(content, data);
  }
  // Simple fallback - reconstruct with proper nested object handling
  const lines = [];
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const [nk, nv] of Object.entries(value)) {
        lines.push(`  ${nk}: ${formatYamlValue(nv)}`);
      }
    } else {
      lines.push(`${key}: ${formatYamlValue(value)}`);
    }
  }
  return `---\n${lines.join("\n")}\n---\n${content}`;
}

/**
 * Check for active task (per D-55)
 * @param {string} configPath - Path to .do/config.json
 * @returns {Object} Active task status
 */
function checkActiveTask(configPath) {
  const config = readJsonSafe(configPath);
  if (!config || !config.active_task) {
    return { active: false };
  }

  // Validate the active_task filename
  const validation = validateFilename(config.active_task);
  if (!validation.valid) {
    return { active: false, error: validation.error };
  }

  const configDir = path.dirname(configPath);
  const taskPath = path.join(configDir, "tasks", config.active_task);

  if (!fs.existsSync(taskPath)) {
    return { active: false, stale: config.active_task };
  }

  // Parse task file for stage
  const taskContent = fs.readFileSync(taskPath, "utf-8");
  const { data } = parseFrontmatter(taskContent);

  return {
    active: true,
    file: config.active_task,
    stage: data.stage || "unknown",
    description: data.description || "",
  };
}

/**
 * Abandon a task (per D-56, with council requirements)
 * @param {string} configPath - Path to .do/config.json
 * @param {string} taskFilename - Task filename to abandon
 * @returns {Object} Result of abandonment
 */
function abandonTask(configPath, taskFilename) {
  // Validate filename for path traversal (council requirement)
  const validation = validateFilename(taskFilename);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const configDir = path.dirname(configPath);
  const taskPath = path.join(configDir, "tasks", taskFilename);

  if (!fs.existsSync(taskPath)) {
    return { success: false, error: "Task file not found" };
  }

  // Update task frontmatter
  const content = fs.readFileSync(taskPath, "utf-8");
  const { data: rawData, content: body } = parseFrontmatter(content);
  // Deep-clone to avoid mutating gray-matter's internal cache (same content string
  // across tests/calls would return the same cached object reference otherwise)
  const data = JSON.parse(JSON.stringify(rawData));

  // Store current stage for resume capability (council requirement)
  const previousStage = data.stage || "refinement";
  data.pre_abandon_stage = previousStage;

  // Set stage to abandoned
  data.stage = "abandoned";

  // Update stages map (council requirement for consistency)
  if (data.stages) {
    // Mark the previous stage as 'abandoned' in the map
    if (previousStage && data.stages[previousStage] !== undefined) {
      data.stages[previousStage] = "abandoned";
    }
    data.stages.abandoned = true;
  } else {
    data.stages = { abandoned: true };
  }

  data.updated = new Date().toISOString();

  // Write back
  fs.writeFileSync(taskPath, stringifyFrontmatter(body, data));

  // Clear active_task in config
  const config = readJsonSafe(configPath) || {};
  config.active_task = null;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  return { success: true, abandoned: taskFilename, pre_abandon_stage: previousStage };
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  // Find config path
  let configPath = ".do/config.json";
  const configIdx = args.indexOf("--config");
  if (configIdx !== -1 && args[configIdx + 1]) {
    configPath = args[configIdx + 1];
  }

  if (command === "check") {
    const result = checkActiveTask(configPath);
    console.log(JSON.stringify(result));
  } else if (command === "abandon") {
    const filename = args[1];
    if (!filename || filename.startsWith("--")) {
      console.error("Usage: task-abandon.cjs abandon <filename>");
      process.exit(1);
    }
    const result = abandonTask(configPath, filename);
    console.log(JSON.stringify(result));
    process.exit(result.success ? 0 : 1);
  } else {
    console.error("Usage: task-abandon.cjs check|abandon [args]");
    process.exit(1);
  }
}

module.exports = { checkActiveTask, abandonTask };
