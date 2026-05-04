#!/usr/bin/env node

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const os = require("os");

const {
  installClaudeCode,
  installCodex,
} = require("../../../../bin/install.cjs");

const codexWrappers = [
  ["do", "do.md"],
  ["do-project", "project.md"],
  ["do-task", "task.md"],
  ["do-fast", "fast.md"],
  ["do-quick", "quick.md"],
  ["do-continue", "continue.md"],
  ["do-debug", "debug.md"],
  ["do-init", "init.md"],
  ["do-scan", "scan.md"],
  ["do-update", "update.md"],
  ["do-optimise", "optimise.md"],
  ["do-backlog", "backlog.md"],
  ["do-abandon", "abandon.md"],
];

describe("installCodex", () => {
  let tempDir;
  let originalHomedir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "install-codex-"));
    originalHomedir = os.homedir;
    os.homedir = () => tempDir;
  });

  afterEach(() => {
    os.homedir = originalHomedir;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("installs the runtime workflow tree, agents, and registered wrapper skills", () => {
    installCodex();

    const codexDir = path.join(tempDir, ".codex");
    const runtimeDir = path.join(codexDir, "skills", "do");

    assert.ok(fs.existsSync(path.join(runtimeDir, "do.md")));
    assert.ok(fs.existsSync(path.join(runtimeDir, "project.md")));
    assert.ok(
      fs.existsSync(path.join(runtimeDir, "references", "stage-execute.md")),
    );
    assert.ok(
      fs.existsSync(path.join(runtimeDir, "scripts", "project-state.cjs")),
    );
    assert.ok(
      !fs.existsSync(
        path.join(runtimeDir, "scripts", "__tests__", "install-codex.test.cjs"),
      ),
    );
    assert.ok(
      fs.existsSync(path.join(codexDir, "agents", "codex-executioner.md")),
    );

    for (const [skillName, workflowFile] of codexWrappers) {
      const wrapperPath = path.join(codexDir, "skills", skillName, "SKILL.md");
      assert.ok(
        fs.existsSync(wrapperPath),
        `${skillName} wrapper should exist`,
      );

      const wrapper = fs.readFileSync(wrapperPath, "utf8");
      assert.match(wrapper, new RegExp(`^name: ${skillName}$`, "m"));
      assert.match(wrapper, new RegExp(`\\$${skillName}\\b`));
      assert.ok(
        wrapper.includes(`~/.codex/skills/do/${workflowFile}`),
        `${skillName} wrapper should reference ${workflowFile}`,
      );
      assert.doesNotMatch(wrapper, /{{|}}|<%|%>|TODO|WORKFLOW_FILE/);
    }
  });

  it("keeps installer-specific tests out of the Claude runtime tree", () => {
    fs.mkdirSync(path.join(tempDir, ".claude"), { recursive: true });

    installClaudeCode();

    const runtimeDir = path.join(tempDir, ".claude", "commands", "do");

    assert.ok(
      fs.existsSync(path.join(runtimeDir, "scripts", "project-state.cjs")),
    );
    assert.ok(
      !fs.existsSync(
        path.join(runtimeDir, "scripts", "__tests__", "install-codex.test.cjs"),
      ),
    );
  });
});
