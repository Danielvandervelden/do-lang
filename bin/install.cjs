#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const readline = require("readline");

const { expandTemplate } = require("./expand-templates.cjs");

const packageRoot = path.join(__dirname, "..");
const skillsSource = path.join(packageRoot, "skills");
const refsSource = path.join(skillsSource, "references");
const scriptsSource = path.join(skillsSource, "scripts");
const agentsSource = path.join(packageRoot, "agents");

const codexWrapperSkills = [
  {
    skillName: "do",
    workflowFile: "do.md",
    description:
      "Token-efficient task execution for Codex. Routes to the installed do workflow.",
  },
  {
    skillName: "do-project",
    workflowFile: "project.md",
    description:
      "Multi-phase project orchestration for Codex. Routes to the installed project workflow.",
  },
  {
    skillName: "do-task",
    workflowFile: "task.md",
    description:
      "Full task workflow for Codex. Routes to the installed task workflow.",
  },
  {
    skillName: "do-fast",
    workflowFile: "fast.md",
    description:
      "Fast-path task execution for Codex. Routes to the installed fast workflow.",
  },
  {
    skillName: "do-quick",
    workflowFile: "quick.md",
    description:
      "Quick warm-context edits for Codex. Routes to the installed quick workflow.",
  },
  {
    skillName: "do-continue",
    workflowFile: "continue.md",
    description:
      "Resume active do-lang work in Codex. Routes to the installed continue workflow.",
  },
  {
    skillName: "do-debug",
    workflowFile: "debug.md",
    description:
      "Debug workflow for Codex. Routes to the installed debug workflow.",
  },
  {
    skillName: "do-init",
    workflowFile: "init.md",
    description:
      "Initialize do-lang workspace/project state in Codex. Routes to the installed init workflow.",
  },
  {
    skillName: "do-scan",
    workflowFile: "scan.md",
    description:
      "Scan a project into do-lang database context in Codex. Routes to the installed scan workflow.",
  },
  {
    skillName: "do-update",
    workflowFile: "update.md",
    description:
      "Update do-lang from Codex. Routes to the installed update workflow.",
  },
  {
    skillName: "do-optimise",
    workflowFile: "optimise.md",
    description:
      "Audit do-lang/project practices in Codex. Routes to the installed optimise workflow.",
  },
  {
    skillName: "do-backlog",
    workflowFile: "backlog.md",
    description:
      "Manage do-lang backlog items in Codex. Routes to the installed backlog workflow.",
  },
  {
    skillName: "do-abandon",
    workflowFile: "abandon.md",
    description:
      "Abandon active do-lang work in Codex. Routes to the installed abandon workflow.",
  },
];

// Check if source exists (may not during dev installs before skills/ created)
if (require.main === module) {
  if (!fs.existsSync(skillsSource)) {
    console.log(
      "do-lang: skills/ not found (dev install?), skipping installation",
    );
    process.exit(0);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * List all .md files directly in a directory (non-recursive).
 * Returns absolute paths sorted alphabetically.
 */
function listMdFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => path.join(dir, f));
}

/**
 * Copy scripts/ tree from srcDir to destDir, excluding __tests__/ entirely.
 * This replaces the old shouldInstallRuntimeScriptFile which only excluded
 * install-* prefixed test files.
 */
function copyScripts(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(destDir, { recursive: true });
  fs.cpSync(srcDir, destDir, {
    recursive: true,
    filter: shouldInstallRuntimeScriptFile,
  });
}

/**
 * Filter function for fs.cpSync: exclude the entire __tests__/ directory.
 * The old filter only excluded install-* prefixed files; this widened version
 * excludes all of __tests__/ so new test files (template-regression, expand-templates)
 * are also excluded from the installed runtime tree.
 */
function shouldInstallRuntimeScriptFile(src) {
  // Normalize to forward slashes for consistent matching on all platforms
  const posixSrc = src.split(path.sep).join("/");
  return !posixSrc.includes("/__tests__/") && !posixSrc.endsWith("/__tests__");
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
  fs.mkdirSync(target, { recursive: true });

  // Expand and install top-level skill templates
  for (const srcPath of listMdFiles(skillsSource)) {
    const fileName = path.basename(srcPath);
    const content = fs.readFileSync(srcPath, "utf8");
    const expanded = expandTemplate(content, "claude");
    fs.writeFileSync(path.join(target, fileName), expanded, "utf8");
  }

  // Expand and install reference templates
  const refsTarget = path.join(target, "references");
  fs.mkdirSync(refsTarget, { recursive: true });
  for (const srcPath of listMdFiles(refsSource)) {
    const fileName = path.basename(srcPath);
    const content = fs.readFileSync(srcPath, "utf8");
    const expanded = expandTemplate(content, "claude");
    fs.writeFileSync(path.join(refsTarget, fileName), expanded, "utf8");
  }

  // Copy scripts as-is (no expansion), excluding __tests__/
  copyScripts(scriptsSource, path.join(target, "scripts"));

  console.log(`do commands installed to ${target}`);

  // Expand and install agent templates to ~/.claude/agents/
  if (fs.existsSync(agentsSource)) {
    fs.mkdirSync(agentsTarget, { recursive: true });
    for (const srcPath of listMdFiles(agentsSource)) {
      const roleName = path.basename(srcPath); // e.g. "planner.md"
      // Skip prefixed files (do-*.md, codex-*.md) — only bare role names are templates
      if (
        roleName.startsWith("do-") ||
        roleName.startsWith("codex-")
      ) {
        continue;
      }
      const content = fs.readFileSync(srcPath, "utf8");
      const expanded = expandTemplate(content, "claude");
      // Output filename: do-{role}.md (e.g. do-planner.md)
      const outputName = `do-${roleName}`;
      fs.writeFileSync(path.join(agentsTarget, outputName), expanded, "utf8");
    }
    console.log(`do agents installed to ${agentsTarget}`);
  }
}

function installCodex() {
  const codexDir = path.join(os.homedir(), ".codex");
  const target = path.join(codexDir, "skills", "do");
  const skillsTarget = path.join(codexDir, "skills");
  const agentsTarget = path.join(codexDir, "agents");

  fs.mkdirSync(skillsTarget, { recursive: true });
  fs.mkdirSync(target, { recursive: true });

  // Expand and install top-level skill templates
  for (const srcPath of listMdFiles(skillsSource)) {
    const fileName = path.basename(srcPath);
    const content = fs.readFileSync(srcPath, "utf8");
    const expanded = expandTemplate(content, "codex");
    fs.writeFileSync(path.join(target, fileName), expanded, "utf8");
  }

  // Expand and install reference templates
  const refsTarget = path.join(target, "references");
  fs.mkdirSync(refsTarget, { recursive: true });
  for (const srcPath of listMdFiles(refsSource)) {
    const fileName = path.basename(srcPath);
    const content = fs.readFileSync(srcPath, "utf8");
    const expanded = expandTemplate(content, "codex");
    fs.writeFileSync(path.join(refsTarget, fileName), expanded, "utf8");
  }

  // Copy scripts as-is (no expansion), excluding __tests__/
  copyScripts(scriptsSource, path.join(target, "scripts"));

  console.log(`do skills installed to ${target}`);

  // Generate SKILL.md wrapper entries for Codex skill picker
  for (const wrapper of codexWrapperSkills) {
    const wrapperTarget = path.join(skillsTarget, wrapper.skillName);
    fs.mkdirSync(wrapperTarget, { recursive: true });
    fs.writeFileSync(
      path.join(wrapperTarget, "SKILL.md"),
      renderCodexWrapperSkill(wrapper),
      "utf8",
    );
  }
  console.log(`do Codex wrapper skills installed to ${skillsTarget}`);

  // Expand and install agent templates to ~/.codex/agents/
  if (fs.existsSync(agentsSource)) {
    fs.mkdirSync(agentsTarget, { recursive: true });
    for (const srcPath of listMdFiles(agentsSource)) {
      const roleName = path.basename(srcPath); // e.g. "planner.md"
      // Skip prefixed files (do-*.md, codex-*.md) — only bare role names are templates
      if (
        roleName.startsWith("do-") ||
        roleName.startsWith("codex-")
      ) {
        continue;
      }
      const content = fs.readFileSync(srcPath, "utf8");
      const expanded = expandTemplate(content, "codex");
      // Output filename: codex-{role}.md (e.g. codex-planner.md)
      const outputName = `codex-${roleName}`;
      fs.writeFileSync(path.join(agentsTarget, outputName), expanded, "utf8");
    }
    console.log(`do agents installed to ${agentsTarget}`);
  }
}

function renderCodexWrapperSkill(wrapper) {
  const workflowPath = `~/.codex/skills/do/${wrapper.workflowFile}`;

  return [
    "---",
    `name: ${wrapper.skillName}`,
    `description: "${wrapper.description}"`,
    "---",
    "",
    `# $${wrapper.skillName}`,
    "",
    `Load and follow the workflow file at \`${workflowPath}\`.`,
    "",
    "This wrapper exists so Codex registers the do-lang entry point in the skill picker. The workflow content remains installed in the shared do runtime tree.",
    "",
  ].join("\n");
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

module.exports = { installClaudeCode, installCodex };

if (require.main === module) {
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
}
