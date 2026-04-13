#!/usr/bin/env node

/**
 * AI Tool Detection Script
 *
 * Detects installed AI CLI tools (codex, gemini, claude-cli).
 * Called during /do:init to populate availableTools in workspace config.
 *
 * Per D-50: Detect three tools: codex, gemini, claude-cli
 * Per D-51: Auto-detect via which/where, no user input needed
 * Per D-52: Exit 1 if no tools detected (warning case)
 *
 * CRITICAL: Outputs CANONICAL REVIEWER IDs (per council concern #1)
 * CLI binary names are mapped to reviewer IDs that council-invoke.cjs accepts:
 *   - 'codex' -> 'codex'
 *   - 'gemini' -> 'gemini'
 *   - 'claude-cli' -> 'claude' (NOT 'claude-cli')
 *
 * Usage: node detect-tools.cjs
 *
 * @module detect-tools
 */

const { execSync } = require("child_process");

// CLI binary names to detect
const TOOLS = ["codex", "gemini", "claude-cli"];

// Map CLI binary names to canonical reviewer IDs (per council concern #1)
// council-invoke.cjs VALID_REVIEWERS only accepts: claude, codex, gemini, random, both
const TOOL_TO_REVIEWER = {
  codex: "codex",
  gemini: "gemini",
  "claude-cli": "claude", // CRITICAL: 'claude-cli' binary maps to 'claude' reviewer ID
};

/**
 * Detect installed AI CLI tools and return canonical reviewer IDs
 * @returns {string[]} Array of canonical reviewer IDs (not CLI binary names)
 */
function detectTools() {
  const whichCmd = process.platform === "win32" ? "where" : "which";
  const available = [];

  for (const tool of TOOLS) {
    try {
      execSync(`${whichCmd} ${tool}`, {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "ignore"],
      });
      // Map to canonical reviewer ID
      const reviewerId = TOOL_TO_REVIEWER[tool];
      if (reviewerId && !available.includes(reviewerId)) {
        available.push(reviewerId);
      }
    } catch {
      // Tool not found, skip
    }
  }

  return available;
}

// CLI entry point
if (require.main === module) {
  const tools = detectTools();
  console.log(JSON.stringify({ availableTools: tools }, null, 2));
  // Per D-52: Exit 1 if no tools (warning case), exit 0 if tools found
  process.exit(tools.length === 0 ? 1 : 0);
}

module.exports = { detectTools, TOOLS, TOOL_TO_REVIEWER };
