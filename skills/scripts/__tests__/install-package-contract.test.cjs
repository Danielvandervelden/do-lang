#!/usr/bin/env node

const { describe, it } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "../../..");
const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";

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

function listRegisteredCodexSkills(codexSkillsDir) {
  return fs
    .readdirSync(codexSkillsDir)
    .filter((name) =>
      fs.existsSync(path.join(codexSkillsDir, name, "SKILL.md")),
    )
    .sort();
}

function assertFileExists(filePath) {
  assert.ok(fs.existsSync(filePath), `${filePath} should exist`);
}

describe("package install contract", () => {
  it("packed postinstall creates working Claude commands and Codex registered skills", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "do-pack-install-"));
    const packDir = path.join(tempDir, "pack");
    const extractDir = path.join(tempDir, "extract");
    const homeDir = path.join(tempDir, "home");

    fs.mkdirSync(packDir);
    fs.mkdirSync(extractDir);
    fs.mkdirSync(path.join(homeDir, ".claude"), { recursive: true });
    fs.mkdirSync(path.join(homeDir, ".codex"), { recursive: true });

    try {
      const tarballName = execFileSync(
        npmBin,
        ["pack", "--pack-destination", packDir, "--silent"],
        { cwd: repoRoot, encoding: "utf8" },
      ).trim();
      const tarballPath = path.join(packDir, tarballName);

      execFileSync("tar", ["-xzf", tarballPath, "-C", extractDir], {
        stdio: "pipe",
      });

      const packageDir = path.join(extractDir, "package");
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(packageDir, "package.json"), "utf8"),
      );

      assert.strictEqual(
        packageJson.scripts.postinstall,
        "node bin/install.cjs",
      );
      assertFileExists(path.join(packageDir, "bin", "install.cjs"));
      assertFileExists(path.join(packageDir, "skills", "project.md"));
      assertFileExists(path.join(packageDir, "agents", "executioner.md"));

      execFileSync(process.execPath, ["bin/install.cjs"], {
        cwd: packageDir,
        env: { ...process.env, HOME: homeDir },
        stdio: "pipe",
      });

      const claudeDir = path.join(homeDir, ".claude");
      const codexDir = path.join(homeDir, ".codex");
      const codexSkillsDir = path.join(codexDir, "skills");

      assertFileExists(path.join(claudeDir, "commands", "do", "project.md"));
      assertFileExists(
        path.join(claudeDir, "commands", "do", "scripts", "project-state.cjs"),
      );
      assertFileExists(path.join(claudeDir, "agents", "do-executioner.md"));

      assertFileExists(path.join(codexDir, "skills", "do", "project.md"));
      assertFileExists(
        path.join(codexDir, "skills", "do", "scripts", "project-state.cjs"),
      );
      assertFileExists(path.join(codexDir, "agents", "codex-executioner.md"));

      assert.deepStrictEqual(
        listRegisteredCodexSkills(codexSkillsDir),
        codexWrappers.map(([skillName]) => skillName).sort(),
      );

      for (const [skillName, workflowFile] of codexWrappers) {
        const wrapperPath = path.join(codexSkillsDir, skillName, "SKILL.md");
        assertFileExists(wrapperPath);

        const wrapper = fs.readFileSync(wrapperPath, "utf8");
        assert.match(wrapper, new RegExp(`^name: ${skillName}$`, "m"));
        assert.match(wrapper, new RegExp(`\\$${skillName}\\b`));
        assert.ok(
          wrapper.includes(`~/.codex/skills/do/${workflowFile}`),
          `${skillName} should reference ${workflowFile}`,
        );
        assert.doesNotMatch(wrapper, /{{|}}|<%|%>|TODO|WORKFLOW_FILE/);
      }

      assert.ok(
        !fs.existsSync(
          path.join(
            claudeDir,
            "commands",
            "do",
            "scripts",
            "__tests__",
            "install-codex.test.cjs",
          ),
        ),
      );
      assert.ok(
        !fs.existsSync(
          path.join(
            codexDir,
            "skills",
            "do",
            "scripts",
            "__tests__",
            "install-codex.test.cjs",
          ),
        ),
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
