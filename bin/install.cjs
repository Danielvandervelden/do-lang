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
const codexDir = path.join(os.homedir(), '.codex');
const codexTarget = path.join(codexDir, 'commands', 'do');

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

// Install to Codex commands (if Codex is installed)
if (fs.existsSync(codexDir)) {
  fs.mkdirSync(path.join(codexDir, 'commands'), { recursive: true });
  fs.mkdirSync(codexTarget, { recursive: true });

  // Copy scripts and references to Codex location
  const scriptsSource = path.join(source, 'scripts');
  const referencesSource = path.join(source, 'references');

  if (fs.existsSync(scriptsSource)) {
    fs.cpSync(scriptsSource, path.join(codexTarget, 'scripts'), { recursive: true });
  }
  if (fs.existsSync(referencesSource)) {
    fs.cpSync(referencesSource, path.join(codexTarget, 'references'), { recursive: true });
  }

  // Copy Codex-specific command files (from codex/ subfolder in package)
  const codexCommands = path.join(packageRoot, 'codex');
  if (fs.existsSync(codexCommands)) {
    for (const file of fs.readdirSync(codexCommands)) {
      if (file.endsWith('.md')) {
        fs.copyFileSync(path.join(codexCommands, file), path.join(codexTarget, file));
      }
    }
  }

  console.log(`do commands installed to ${codexTarget}`);
} else {
  console.log('~/.codex not found, skipping Codex installation');
}
