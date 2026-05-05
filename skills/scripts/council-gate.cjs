#!/usr/bin/env node

/**
 * Council Gate Check
 *
 * Resolves whether a council review is enabled for a given config key.
 * Replaces inline `node -e` blocks in review stage files.
 *
 * Usage:
 *   node council-gate.cjs <key-path> [fallback-key]
 *
 * Examples:
 *   node council-gate.cjs planning                        # cfg.council_reviews.planning
 *   node council-gate.cjs execution                       # cfg.council_reviews.execution
 *   node council-gate.cjs project.wave_plan planning      # try project.wave_plan, fall back to planning
 *   node council-gate.cjs project.code execution          # try project.code, fall back to execution
 *   node council-gate.cjs project.phase_plan planning     # try project.phase_plan, fall back to planning
 *   node council-gate.cjs project.plan planning           # try project.plan, fall back to planning
 *
 * Prints "enabled" or "disabled" to stdout. Exit code is always 0.
 */

const path = require('path');
const fs = require('fs');

const installedPath = path.join(require('os').homedir(), '.claude/commands/do/scripts/council-invoke.cjs');
const devPath = path.join(process.cwd(), 'skills/scripts/council-invoke.cjs');
const scriptPath = fs.existsSync(installedPath) ? installedPath : devPath;

const { resolveConfig } = require(scriptPath);
const cfg = resolveConfig('.do/config.json', process.cwd());

const keyPath = process.argv[2];
const fallbackKey = process.argv[3];

function resolve(key) {
  return key.split('.').reduce((obj, k) => obj?.[k], cfg.council_reviews);
}

const primary = resolve(keyPath);
const value = primary !== undefined ? primary : (fallbackKey ? resolve(fallbackKey) : undefined);
console.log(value === true ? 'enabled' : 'disabled');
