#!/usr/bin/env node

/**
 * Tests for load-task-context.cjs
 *
 * Uses Node.js built-in test runner (Node 16.7+)
 * Run: node --test skills/scripts/__tests__/load-task-context.test.cjs
 */

const { test, describe } = require("node:test");
const assert = require("node:assert");
const path = require("path");

// Will fail until we create the module
const modulePath = path.join(__dirname, "..", "load-task-context.cjs");
let extractKeywords, findMatchingDocs, loadTaskContext;

try {
  const mod = require(modulePath);
  extractKeywords = mod.extractKeywords;
  findMatchingDocs = mod.findMatchingDocs;
  loadTaskContext = mod.loadTaskContext;
} catch (e) {
  // Module not created yet - tests will fail
  extractKeywords = () => {
    throw new Error("Module not implemented");
  };
  findMatchingDocs = () => {
    throw new Error("Module not implemented");
  };
  loadTaskContext = () => {
    throw new Error("Module not implemented");
  };
}

describe("extractKeywords", () => {
  test("extracts form-related tech terms from login validation task", () => {
    const result = extractKeywords("Fix login form validation errors");
    assert.ok(result.includes("form"), 'should include "form"');
    assert.ok(result.includes("validation"), 'should include "validation"');
    assert.ok(result.includes("login"), 'should include "login"');
    assert.ok(result.includes("errors"), 'should include "errors"');
  });

  test("extracts component terms from DataGrid task", () => {
    const result = extractKeywords("Add DataGrid sorting");
    assert.ok(result.includes("datagrid"), 'should include "datagrid"');
    assert.ok(result.includes("sorting"), 'should include "sorting"');
  });

  test("returns lowercase deduplicated array", () => {
    const result = extractKeywords("Form form validation Validation");
    const unique = [...new Set(result)];
    assert.strictEqual(
      result.length,
      unique.length,
      "should have no duplicates",
    );
    result.forEach((kw) => {
      assert.strictEqual(
        kw,
        kw.toLowerCase(),
        `keyword "${kw}" should be lowercase`,
      );
    });
  });

  test("only includes tech terms, excludes generic words", () => {
    const result = extractKeywords("Implement authentication feature");
    // "authentication" is a tech term, so it should be included
    assert.ok(
      result.includes("authentication"),
      'should include "authentication" (tech term)',
    );
    // "implement" and "feature" are generic words, excluded even though >5 chars
    assert.ok(
      !result.includes("implement"),
      'should exclude "implement" (generic word)',
    );
    assert.ok(
      !result.includes("feature"),
      'should exclude "feature" (generic word)',
    );
  });

  test("excludes short generic words", () => {
    const result = extractKeywords("Fix the bug in the app");
    assert.ok(!result.includes("the"), 'should not include "the"');
    assert.ok(!result.includes("in"), 'should not include "in"');
    assert.ok(
      !result.includes("fix"),
      'should not include "fix" (only 3 chars, not a tech term)',
    );
  });
});

describe("findMatchingDocs", () => {
  test("returns empty array when database path does not exist", () => {
    const result = findMatchingDocs("/nonexistent/path", [
      "form",
      "validation",
    ]);
    assert.ok(Array.isArray(result), "should return an array");
    assert.strictEqual(result.length, 0, "should return empty array");
  });

  test("returns empty array when no matches found", () => {
    // Using a path that exists but has no .md files matching keywords
    const result = findMatchingDocs("/tmp", ["zzz_nonexistent_keyword_xyz"]);
    assert.ok(Array.isArray(result), "should return an array");
    assert.strictEqual(
      result.length,
      0,
      "should return empty array for no matches",
    );
  });
});

describe("loadTaskContext", () => {
  test("returns error when workspace not initialized", () => {
    const result = loadTaskContext("/tmp/nonexistent-workspace", "Fix login");
    assert.strictEqual(result.error, "Workspace not initialized");
    assert.strictEqual(result.project_md_path, null);
    assert.strictEqual(result.database_path, null);
    assert.ok(
      Array.isArray(result.keywords),
      "should always have keywords array",
    );
  });

  test("returns object with expected fields", () => {
    // This test verifies the shape of the return value
    const result = loadTaskContext("/tmp", "Fix login form validation");
    assert.ok("project_md_path" in result, "should have project_md_path");
    assert.ok("matched_docs" in result, "should have matched_docs");
    assert.ok("keywords" in result, "should have keywords");
    assert.ok("database_path" in result, "should have database_path");
  });
});
