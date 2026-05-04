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
  if (!fs.existsSync(source)) {
    console.log(
      "do-lang: skills/do/ not found (dev install?), skipping installation",
    );
    process.exit(0);
  }
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
  fs.cpSync(source, target, {
    recursive: true,
    filter: shouldInstallRuntimeScriptFile,
  });
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
  const skillsTarget = path.join(codexDir, "skills");
  const agentsTarget = path.join(codexDir, "agents");

  // Guard: codexSource must exist — it contains Codex-flavored skill files
  if (!fs.existsSync(codexSource)) {
    console.error(
      `do-lang: skills/codex/ not found at ${codexSource}; Codex installation cannot proceed. The codex source tree must be present in the package. Skipping Codex install.`,
    );
    return;
  }

  fs.mkdirSync(skillsTarget, { recursive: true });
  // Copy Codex-flavored skills (no Agent() calls, codex- agent names, ~/.codex paths)
  fs.cpSync(codexSource, target, { recursive: true });
  // scripts/ lives only in skills/do/ — copy it explicitly so ~/.codex/skills/do/scripts/ is populated
  fs.cpSync(path.join(source, "scripts"), path.join(target, "scripts"), {
    recursive: true,
    filter: shouldInstallRuntimeScriptFile,
  });
  console.log(`do skills installed to ${target}`);

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

function shouldInstallRuntimeScriptFile(src) {
  const relativePath = path.relative(source, src);
  const posixPath = relativePath.split(path.sep).join("/");

  return !posixPath.startsWith("scripts/__tests__/install-");
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
