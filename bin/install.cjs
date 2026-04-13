#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');

const packageRoot = path.join(__dirname, '..');
const source = path.join(packageRoot, 'skills', 'do');
const claudeDir = path.join(os.homedir(), '.claude');
const target = path.join(claudeDir, 'skills', 'do');

// Check if source exists (may not during dev installs before skills/ created)
if (!fs.existsSync(source)) {
  console.log('do-lang: skills/do/ not found (dev install?), skipping installation');
  process.exit(0);
}

// Ensure ~/.claude/skills/ exists
fs.mkdirSync(path.join(claudeDir, 'skills'), { recursive: true });

// Copy skills (overwrites existing)
fs.cpSync(source, target, { recursive: true });

console.log(`do skills installed to ${target}`);
