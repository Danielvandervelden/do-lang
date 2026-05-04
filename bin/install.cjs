#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const readline = require("readline");

const packageRoot = path.join(__dirname, "..");
const source = path.join(packageRoot, "skills", "do");
const codexSource = path.join(packageRoot, "skills", "codex");
const agentsSource = path.join(packageRoot, "agents");

// Check if source exists (may not during dev installs before skills/ created)
if (!fs.existsSync(source)) {
  console.log(
    "do-lang: skills/do/ not found (dev install?), skipping installation",
  );
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Install functions
// ---------------------------------------------------------------------------

function installClaudeCode() {
  const claudeDir = path.join(os.homedir(), ".claude");
  const target = path.join(claudeDir, "commands", "do");
  const agentsTarget = path.join(claudeDir, "agents");

  if (!fs.existsSync(claudeDir)) {
    console.log("~/.claude not found, skipping Claude Code installation");
    return;
  }

  // Migrate from old install location (skills/do -> commands/do)
  const oldTarget = path.join(claudeDir, "skills", "do");
  if (fs.existsSync(oldTarget)) {
    fs.rmSync(oldTarget, { recursive: true });
    console.log(`Migrated: removed old ${oldTarget}`);
  }

  fs.mkdirSync(path.join(claudeDir, "commands"), { recursive: true });
  fs.cpSync(source, target, { recursive: true });
  console.log(`do commands installed to ${target}`);

  // Install agents to ~/.claude/agents/
  if (fs.existsSync(agentsSource)) {
    fs.mkdirSync(agentsTarget, { recursive: true });
    for (const file of fs.readdirSync(agentsSource)) {
      if (file.startsWith("do-") && file.endsWith(".md")) {
        fs.copyFileSync(
          path.join(agentsSource, file),
          path.join(agentsTarget, file),
        );
      }
    }
    console.log(`do agents installed to ${agentsTarget}`);
  }
}

function installCodex() {
  const codexDir = path.join(os.homedir(), ".codex");
  const target = path.join(codexDir, "skills", "do");
  const agentsTarget = path.join(codexDir, "agents");

  // Guard: codexSource must exist — it contains Codex-flavored skill files
  if (!fs.existsSync(codexSource)) {
    console.error(
      `do-lang: skills/codex/ not found at ${codexSource}; Codex installation cannot proceed. The codex source tree must be present in the package. Skipping Codex install.`,
    );
    return;
  }

  fs.mkdirSync(path.join(codexDir, "skills"), { recursive: true });
  // Copy Codex-flavored skills (no Agent() calls, codex- agent names, ~/.codex paths)
  fs.cpSync(codexSource, target, { recursive: true });
  // scripts/ lives only in skills/do/ — copy it explicitly so ~/.codex/skills/do/scripts/ is populated
  fs.cpSync(path.join(source, "scripts"), path.join(target, "scripts"), {
    recursive: true,
  });
  console.log(`do skills installed to ${target}`);

  // Install agents to ~/.codex/agents/
  if (fs.existsSync(agentsSource)) {
    fs.mkdirSync(agentsTarget, { recursive: true });
    for (const file of fs.readdirSync(agentsSource)) {
      if (file.startsWith("codex-") && file.endsWith(".md")) {
        fs.copyFileSync(
          path.join(agentsSource, file),
          path.join(agentsTarget, file),
        );
      }
    }
    console.log(`do agents installed to ${agentsTarget}`);
  }
}

// ---------------------------------------------------------------------------
// Interactive prompt / TTY guard
// ---------------------------------------------------------------------------

function runInstall(choice) {
  if (choice === "1") {
    installClaudeCode();
  } else if (choice === "2") {
    installCodex();
  } else {
    // Default: both
    installClaudeCode();
    installCodex();
  }
}

if (!process.stdin.isTTY) {
  console.log(
    "do-lang: non-interactive environment detected — installing for all targets (Claude Code + Codex)",
  );
  runInstall("3");
} else {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question(
    "do-lang: Install for which agent?\n  [1] Claude Code\n  [2] Codex\n  [3] Both (default)\nChoice: ",
    (answer) => {
      rl.close();
      const choice = (answer || "").trim();
      runInstall(choice);
    },
  );
}
