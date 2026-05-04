#!/usr/bin/env node

/**
 * Tests for check-database-entry.cjs
 *
 * Uses Node.js built-in test runner.
 * Run: node --test skills/do/scripts/__tests__/check-database-entry.test.cjs
 */

const { describe, test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { checkDatabaseEntry } = require("../check-database-entry.cjs");

describe("checkDatabaseEntry", () => {
  let tempDir;
  let projectDir;
  let databaseDir;
  let projectMdPath;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "db-entry-test-"));
    projectDir = path.join(tempDir, "github-projects", "demo");
    databaseDir = path.join(tempDir, "database");
    projectMdPath = path.join(databaseDir, "projects", "demo", "project.md");

    fs.mkdirSync(path.join(projectDir, ".do"), { recursive: true });
    fs.mkdirSync(path.dirname(projectMdPath), { recursive: true });

    fs.writeFileSync(
      path.join(tempDir, ".do-workspace.json"),
      JSON.stringify({ database: databaseDir }),
    );
    fs.writeFileSync(
      path.join(projectDir, ".do", "config.json"),
      JSON.stringify({ project_name: "demo" }),
    );
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test("treats a project.md stub under 100 bytes as empty and missing", () => {
    fs.writeFileSync(projectMdPath, "# demo\n");

    const result = checkDatabaseEntry(projectDir);

    assert.strictEqual(result.exists, false);
    assert.strictEqual(result.empty, true);
    assert.strictEqual(result.project_name, "demo");
    assert.strictEqual(result.expected_path, projectMdPath);
    assert.strictEqual(result.error, null);
  });

  test("treats a project.md with useful content as existing", () => {
    fs.writeFileSync(
      projectMdPath,
      [
        "# demo",
        "",
        "This database entry has enough content to be considered populated.",
        "It documents the project purpose, structure, and conventions.",
      ].join("\n"),
    );

    const result = checkDatabaseEntry(projectDir);

    assert.strictEqual(result.exists, true);
    assert.strictEqual(result.empty, false);
    assert.strictEqual(result.project_name, "demo");
    assert.strictEqual(result.expected_path, projectMdPath);
    assert.strictEqual(result.error, null);
  });
});
