#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');

const packageRoot = path.join(__dirname, '..');
const source = path.join(packageRoot, 'skills', 'do');
const agentsSource = path.join(packageRoot, 'agents');
const claudeDir = path.join(os.homedir(), '.claude');
const target = path.join(claudeDir, 'commands', 'do');
const agentsTarget = path.join(claudeDir, 'agents');

// Check if source exists (may not during dev installs before skills/ created)
if (!fs.existsSync(source)) {
  console.log('do-lang: skills/do/ not found (dev install?), skipping installation');
  process.exit(0);
}

// Install to Claude commands (sub-commands like /do:init, /do:scan)
if (fs.existsSync(claudeDir)) {
  // Migrate from old install location (skills/do -> commands/do)
  const oldTarget = path.join(claudeDir, 'skills', 'do');
  if (fs.existsSync(oldTarget)) {
    fs.rmSync(oldTarget, { recursive: true });
    console.log(`Migrated: removed old ${oldTarget}`);
  }

  fs.mkdirSync(path.join(claudeDir, 'commands'), { recursive: true });
  fs.cpSync(source, target, { recursive: true });
  console.log(`do commands installed to ${target}`);

  // Install agents to ~/.claude/agents/
  if (fs.existsSync(agentsSource)) {
    fs.mkdirSync(agentsTarget, { recursive: true });
    for (const file of fs.readdirSync(agentsSource)) {
      if (file.startsWith('do-') && file.endsWith('.md')) {
        fs.copyFileSync(
          path.join(agentsSource, file),
          path.join(agentsTarget, file)
        );
      }
    }
    console.log(`do agents installed to ${agentsTarget}`);
  }
} else {
  console.log('~/.claude not found, skipping Claude installation');
}
