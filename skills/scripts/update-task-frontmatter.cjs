#!/usr/bin/env node

/**
 * Task/Target Frontmatter Manipulation Script
 *
 * Replaces inline `node -e "require('gray-matter')..."` snippets in skill/reference
 * files with a dedicated script that resolves gray-matter from the do-lang package's
 * own node_modules — not the target project's.
 *
 * Why: gray-matter is a dev dependency of do-lang, but inline `node -e` snippets
 * execute in the target project's cwd where gray-matter is not installed.
 * This script runs from its own module path, so `require('gray-matter')` resolves
 * from do-lang's node_modules regardless of the cwd.
 *
 * Usage:
 *   node update-task-frontmatter.cjs read <file> [field1] [field2] ...
 *   node update-task-frontmatter.cjs check <file> <expression>
 *   node update-task-frontmatter.cjs set <file> <key=value> [key=value] ...
 *   node update-task-frontmatter.cjs read-body <file>
 *
 * Commands:
 *   read       Read frontmatter fields. Outputs JSON object of requested fields.
 *              If no fields specified, outputs all frontmatter data.
 *   check      Evaluate a dot-path expression against frontmatter and exit with
 *              code 1 if truthy, 0 if falsy. For resume guards and gates.
 *   set        Update frontmatter fields. Supports dot-path keys for nested fields
 *              and JSON values. Uses atomic write (tmp + rename).
 *   read-body  Read the markdown body (content after frontmatter). Outputs raw text.
 *
 * Examples:
 *   # Read specific fields
 *   node update-task-frontmatter.cjs read .do/tasks/task.md stage stages confidence
 *
 *   # Check if council_review_ran.plan is true (exit 1 if true, 0 if false)
 *   node update-task-frontmatter.cjs check .do/tasks/task.md council_review_ran.plan
 *
 *   # Check if fast_path is true
 *   node update-task-frontmatter.cjs check .do/tasks/task.md fast_path
 *
 *   # Update stage and stages.execution
 *   node update-task-frontmatter.cjs set .do/tasks/task.md stage=execution stages.execution=review_pending
 *
 *   # Set a field to a JSON value (for objects/arrays/booleans)
 *   node update-task-frontmatter.cjs set .do/tasks/task.md 'council_review_ran.code=true' 'stage=complete'
 *
 *   # Set abandoned with multiple fields
 *   node update-task-frontmatter.cjs set .do/tasks/task.md abandoned=true pre_abandon_stage=execution fast_path=false
 *
 *   # Clear active_wave in a phase.md (set to null)
 *   node update-task-frontmatter.cjs set .do/projects/x/phases/p/phase.md active_wave=null
 *
 *   # Read body content (for placeholder checks)
 *   node update-task-frontmatter.cjs read-body .do/projects/x/phases/p/phase.md
 *
 * @module update-task-frontmatter
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// gray-matter resolved from do-lang's own node_modules
let matter;
try {
  matter = require('gray-matter');
} catch {
  matter = null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse YAML value from a string.
 */
function parseYamlValue(value) {
  const trimmed = value.trim();
  if (trimmed === 'null' || trimmed === '') return null;
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  // Handle quoted strings
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Simple fallback frontmatter parser (when gray-matter is unavailable).
 * Handles nested objects one level deep.
 */
function parseFrontmatterFallback(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, content };

  const yaml = match[1];
  const data = {};
  const lines = yaml.split(/\r?\n/);
  let currentKey = null;

  for (const line of lines) {
    if (!line.trim()) continue;

    // Check for nested property (indented)
    const nestedMatch = line.match(/^(\s{2,})(\w[\w.-]*):\s*(.*)$/);
    if (nestedMatch && currentKey && typeof data[currentKey] === 'object') {
      const [, , nestedKey, nestedValue] = nestedMatch;
      data[currentKey][nestedKey] = parseYamlValue(nestedValue);
      continue;
    }

    // Top-level property
    const topMatch = line.match(/^(\w[\w.-]*):\s*(.*)$/);
    if (topMatch) {
      const [, key, value] = topMatch;
      if (value === '' || value.trim() === '') {
        data[key] = {};
        currentKey = key;
      } else {
        data[key] = parseYamlValue(value);
        currentKey = null;
      }
    }
  }

  return { data, content: match[2] };
}

/**
 * Parse frontmatter from file content.
 */
function parseFrontmatter(content) {
  if (matter) {
    const parsed = matter(content);
    return { data: parsed.data, content: parsed.content };
  }
  return parseFrontmatterFallback(content);
}

/**
 * Serialize frontmatter + body back to markdown.
 */
function serializeFrontmatter(data, bodyContent) {
  if (matter) {
    return matter.stringify(bodyContent || '', data);
  }
  // Simple fallback
  function formatValue(v) {
    if (v === null) return 'null';
    if (typeof v === 'boolean') return v.toString();
    if (typeof v === 'number') return v.toString();
    if (typeof v === 'string') {
      if (v.includes(':') || v.includes('#') || v.includes(' ') || v.includes('\n') || v.includes('"')) {
        return `"${v.replace(/"/g, '\\"')}"`;
      }
      return v;
    }
    return JSON.stringify(v);
  }
  const lines = [];
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const [nk, nv] of Object.entries(value)) {
        lines.push(`  ${nk}: ${formatValue(nv)}`);
      }
    } else {
      lines.push(`${key}: ${formatValue(value)}`);
    }
  }
  return `---\n${lines.join('\n')}\n---\n${bodyContent || ''}`;
}

/**
 * Get a nested value from an object using a dot path.
 * e.g., getNestedValue(obj, 'council_review_ran.plan') -> obj.council_review_ran?.plan
 */
function getNestedValue(obj, dotPath) {
  const parts = dotPath.split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current[part];
  }
  return current;
}

/**
 * Set a nested value on an object using a dot path.
 * Creates intermediate objects as needed.
 * Uses spread to preserve existing sibling keys (e.g., stages.execution=X preserves stages.refinement).
 */
function setNestedValue(obj, dotPath, value) {
  const parts = dotPath.split('.');
  if (parts.length === 1) {
    obj[parts[0]] = value;
    return;
  }
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] == null || typeof current[part] !== 'object') {
      current[part] = {};
    } else {
      // Spread to avoid mutating gray-matter's cached reference
      current[part] = { ...current[part] };
    }
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
}

/**
 * Parse a CLI value string into the appropriate JS type.
 */
function parseCliValue(valueStr) {
  if (valueStr === 'null') return null;
  if (valueStr === 'true') return true;
  if (valueStr === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(valueStr)) return Number(valueStr);
  // Try JSON parse for complex values
  if (valueStr.startsWith('{') || valueStr.startsWith('[') || valueStr.startsWith('"')) {
    try { return JSON.parse(valueStr); } catch { /* fall through */ }
  }
  return valueStr;
}

/**
 * Atomic write: temp file + rename.
 */
function atomicWrite(targetPath, content) {
  const tmpPath = path.join(os.tmpdir(), `do-fm-${Date.now()}-${path.basename(targetPath)}`);
  fs.writeFileSync(tmpPath, content, 'utf8');
  fs.renameSync(tmpPath, targetPath);
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/**
 * read: Output frontmatter fields as JSON.
 */
function cmdRead(filePath, fields) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const { data } = parseFrontmatter(raw);

  if (fields.length === 0) {
    // Output all frontmatter
    process.stdout.write(JSON.stringify(data) + '\n');
    return;
  }

  const result = {};
  for (const field of fields) {
    result[field] = getNestedValue(data, field);
  }
  process.stdout.write(JSON.stringify(result) + '\n');
}

/**
 * check: Evaluate a dot-path expression. Exit 1 if truthy, 0 if falsy.
 * Matches the convention used by resume guards: exit(1) means "already ran / skip".
 */
function cmdCheck(filePath, expression) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const { data } = parseFrontmatter(raw);

  // Support comparison expressions: field==value or field=value
  const compMatch = expression.match(/^(.+?)==(.+)$/);
  if (compMatch) {
    const actual = getNestedValue(data, compMatch[1]);
    const expected = parseCliValue(compMatch[2]);
    process.exit(actual === expected ? 1 : 0);
    return;
  }

  // Simple truthy check
  const value = getNestedValue(data, expression);
  process.exit(value === true ? 1 : 0);
}

/**
 * set: Update frontmatter fields. Supports dot-path keys.
 */
function cmdSet(filePath, assignments) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const { data: rawData, content: body } = parseFrontmatter(raw);
  // Deep-clone to avoid mutating gray-matter's cached references
  const data = JSON.parse(JSON.stringify(rawData));

  for (const assignment of assignments) {
    const eqIdx = assignment.indexOf('=');
    if (eqIdx === -1) {
      process.stderr.write(`Invalid assignment (missing =): ${assignment}\n`);
      process.exit(1);
    }
    const key = assignment.substring(0, eqIdx);
    const valueStr = assignment.substring(eqIdx + 1);
    const value = parseCliValue(valueStr);
    setNestedValue(data, key, value);
  }

  // Add updated timestamp
  data.updated = new Date().toISOString();

  const output = serializeFrontmatter(data, body);
  atomicWrite(filePath, output);

  process.stdout.write(JSON.stringify({ updated: true, fields: assignments.map(a => a.split('=')[0]) }) + '\n');
}

/**
 * read-body: Output the markdown body (content after frontmatter).
 */
function cmdReadBody(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const { content } = parseFrontmatter(raw);
  process.stdout.write(content);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  const filePath = args[1];

  if (!command || !filePath) {
    process.stderr.write('Usage: node update-task-frontmatter.cjs <read|check|set|read-body> <file> [args...]\n');
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    process.stderr.write(`File not found: ${filePath}\n`);
    process.exit(1);
  }

  try {
    switch (command) {
      case 'read':
        cmdRead(filePath, args.slice(2));
        break;
      case 'check':
        if (!args[2]) {
          process.stderr.write('Usage: node update-task-frontmatter.cjs check <file> <expression>\n');
          process.exit(1);
        }
        cmdCheck(filePath, args[2]);
        break;
      case 'set':
        if (args.length < 3) {
          process.stderr.write('Usage: node update-task-frontmatter.cjs set <file> <key=value> [...]\n');
          process.exit(1);
        }
        cmdSet(filePath, args.slice(2));
        break;
      case 'read-body':
        cmdReadBody(filePath);
        break;
      default:
        process.stderr.write(`Unknown command: ${command}\nUsage: node update-task-frontmatter.cjs <read|check|set|read-body> <file> [args...]\n`);
        process.exit(1);
    }
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(1);
  }
}

module.exports = { cmdRead, cmdCheck, cmdSet, cmdReadBody, parseFrontmatter, serializeFrontmatter, getNestedValue, setNestedValue };
