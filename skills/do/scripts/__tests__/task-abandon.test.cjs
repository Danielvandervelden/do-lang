#!/usr/bin/env node

/**
 * Tests for task abandonment functionality
 *
 * Uses Node.js built-in test runner (Node 16.7+)
 * Run: node --test skills/do/scripts/__tests__/task-abandon.test.cjs
 *
 * Test requirements covered:
 * - D-55: Abandonment prompt triggers on /do:task when active task exists
 * - D-56: Abandoned files keep stage: abandoned in frontmatter
 * - D-57: Abandoned tasks can be resumed via /do:continue --task <file>
 * - Council feedback: pre_abandon_stage preservation, path validation
 */

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const matter = require("gray-matter");

// Import functions after file is created
let checkActiveTask, abandonTask;

describe("task-abandon", () => {
  let tempDir;
  let configPath;
  let tasksDir;

  beforeEach(() => {
    // Create temp directory structure
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "task-abandon-test-"));
    tasksDir = path.join(tempDir, ".do", "tasks");
    fs.mkdirSync(tasksDir, { recursive: true });
    configPath = path.join(tempDir, ".do", "config.json");

    // Import after setup
    const module = require("../task-abandon.cjs");
    checkActiveTask = module.checkActiveTask;
    abandonTask = module.abandonTask;
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe("checkActiveTask", () => {
    it("returns active: false when no active_task in config", () => {
      fs.writeFileSync(configPath, JSON.stringify({ active_task: null }));
      const result = checkActiveTask(configPath);
      assert.strictEqual(result.active, false);
    });

    it("returns active: false when config file does not exist", () => {
      const nonexistentPath = path.join(tempDir, "nonexistent", "config.json");
      const result = checkActiveTask(nonexistentPath);
      assert.strictEqual(result.active, false);
    });

    it("returns stale when active_task points to missing file", () => {
      fs.writeFileSync(
        configPath,
        JSON.stringify({ active_task: "missing.md" })
      );
      const result = checkActiveTask(configPath);
      assert.strictEqual(result.active, false);
      assert.strictEqual(result.stale, "missing.md");
    });

    it("returns active: true with task details when task exists", () => {
      const taskFile = "260413-test-task.md";
      const taskContent = `---
stage: execution
description: "Test task"
---
# Test
`;
      fs.writeFileSync(path.join(tasksDir, taskFile), taskContent);
      fs.writeFileSync(configPath, JSON.stringify({ active_task: taskFile }));

      const result = checkActiveTask(configPath);
      assert.strictEqual(result.active, true);
      assert.strictEqual(result.file, taskFile);
      assert.strictEqual(result.stage, "execution");
    });

    it("returns description when present in task file", () => {
      const taskFile = "260413-test-task.md";
      const taskContent = `---
stage: refinement
description: "Fix login validation errors"
---
# Fix login
`;
      fs.writeFileSync(path.join(tasksDir, taskFile), taskContent);
      fs.writeFileSync(configPath, JSON.stringify({ active_task: taskFile }));

      const result = checkActiveTask(configPath);
      assert.strictEqual(result.active, true);
      assert.strictEqual(result.description, "Fix login validation errors");
    });
  });

  describe("abandonTask", () => {
    it("stores current stage in pre_abandon_stage before abandoning", () => {
      const taskFile = "260413-test-task.md";
      const taskPath = path.join(tasksDir, taskFile);
      const taskContent = `---
stage: execution
stages:
  refinement: complete
  execution: in_progress
  abandoned: false
---
# Test
`;
      fs.writeFileSync(taskPath, taskContent);
      fs.writeFileSync(configPath, JSON.stringify({ active_task: taskFile }));

      const result = abandonTask(configPath, taskFile);

      const updated = fs.readFileSync(taskPath, "utf-8");
      assert.match(updated, /pre_abandon_stage: execution/);
      assert.strictEqual(result.pre_abandon_stage, "execution");
    });

    it("sets stage: abandoned in frontmatter", () => {
      const taskFile = "260413-test-task.md";
      const taskPath = path.join(tasksDir, taskFile);
      const taskContent = `---
stage: execution
stages:
  refinement: complete
  execution: in_progress
  abandoned: false
---
# Test
`;
      fs.writeFileSync(taskPath, taskContent);
      fs.writeFileSync(configPath, JSON.stringify({ active_task: taskFile }));

      abandonTask(configPath, taskFile);

      const updated = fs.readFileSync(taskPath, "utf-8");
      assert.match(updated, /stage: abandoned/);
      assert.match(updated, /abandoned: true/);
    });

    it("sets current stage entry to abandoned in stages map", () => {
      const taskFile = "260413-test-task.md";
      const taskPath = path.join(tasksDir, taskFile);
      const taskContent = `---
stage: execution
stages:
  refinement: complete
  execution: in_progress
  abandoned: false
---
# Test
`;
      fs.writeFileSync(taskPath, taskContent);
      fs.writeFileSync(configPath, JSON.stringify({ active_task: taskFile }));

      abandonTask(configPath, taskFile);

      const updated = fs.readFileSync(taskPath, "utf-8");
      // stages.execution should now be 'abandoned', not 'in_progress'
      assert.match(updated, /execution: abandoned/);
    });

    it("clears active_task in config", () => {
      const taskFile = "260413-test-task.md";
      const taskPath = path.join(tasksDir, taskFile);
      fs.writeFileSync(
        taskPath,
        `---
stage: execution
stages:
  abandoned: false
---
# Test
`
      );
      fs.writeFileSync(configPath, JSON.stringify({ active_task: taskFile }));

      abandonTask(configPath, taskFile);

      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      assert.strictEqual(config.active_task, null);
    });

    it("returns success with abandoned filename and pre_abandon_stage", () => {
      const taskFile = "260413-test-task.md";
      const taskPath = path.join(tasksDir, taskFile);
      fs.writeFileSync(
        taskPath,
        `---
stage: execution
stages:
  abandoned: false
---
# Test
`
      );
      fs.writeFileSync(configPath, JSON.stringify({ active_task: taskFile }));

      const result = abandonTask(configPath, taskFile);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.abandoned, taskFile);
      assert.strictEqual(result.pre_abandon_stage, "execution");
    });

    it("rejects filenames with path traversal (..) characters", () => {
      fs.writeFileSync(configPath, JSON.stringify({ active_task: null }));

      const result = abandonTask(configPath, "../../../etc/passwd");
      assert.strictEqual(result.success, false);
      assert.match(result.error, /path traversal/i);
    });

    it("rejects absolute paths", () => {
      fs.writeFileSync(configPath, JSON.stringify({ active_task: null }));

      const result = abandonTask(configPath, "/etc/passwd");
      assert.strictEqual(result.success, false);
      assert.match(result.error, /absolute path/i);
    });

    it("returns error when task file does not exist", () => {
      fs.writeFileSync(configPath, JSON.stringify({ active_task: null }));

      const result = abandonTask(configPath, "nonexistent-task.md");
      assert.strictEqual(result.success, false);
      assert.match(result.error, /not found/i);
    });

    it("does not mutate previously parsed frontmatter objects across abandon calls", () => {
      const taskFile = "260413-test-task.md";
      const taskPath = path.join(tasksDir, taskFile);
      const taskContent = `---
stage: execution
stages:
  refinement: complete
  execution: in_progress
  abandoned: false
---
# Test
`;
      fs.writeFileSync(taskPath, taskContent);
      fs.writeFileSync(configPath, JSON.stringify({ active_task: taskFile }));

      const parsedOriginal = matter(taskContent);

      const firstResult = abandonTask(configPath, taskFile);
      assert.strictEqual(firstResult.success, true);
      assert.strictEqual(parsedOriginal.data.stage, "execution");
      assert.strictEqual(parsedOriginal.data.stages.execution, "in_progress");
      assert.strictEqual(parsedOriginal.data.stages.abandoned, false);
      assert.strictEqual(parsedOriginal.data.pre_abandon_stage, undefined);

      const abandonedContent = fs.readFileSync(taskPath, "utf-8");
      const parsedAbandoned = matter(abandonedContent);

      const secondResult = abandonTask(configPath, taskFile);
      assert.strictEqual(secondResult.success, true);
      assert.strictEqual(parsedAbandoned.data.stage, "abandoned");
      assert.strictEqual(parsedAbandoned.data.stages.execution, "abandoned");
      assert.strictEqual(parsedAbandoned.data.stages.abandoned, true);
      assert.strictEqual(parsedAbandoned.data.pre_abandon_stage, "execution");
    });
  });
});
