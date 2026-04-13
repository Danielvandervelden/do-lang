#!/usr/bin/env node

/**
 * Tests for AI tool detection
 *
 * Uses Node.js built-in test runner (Node 16.7+)
 * Run: node --test skills/do/scripts/__tests__/detect-tools.test.cjs
 *
 * Test requirements covered:
 * - D-50: Detect three tools: codex, gemini, claude-cli
 * - D-51: Auto-detect via which/where, no user input needed
 * - D-52: Exit 1 if no tools detected (warning case)
 * - Council concern #1: Map CLI binary names to canonical reviewer IDs
 */

const { test, describe, mock, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { execSync, spawnSync } = require("child_process");

// Import the module
const modulePath = path.join(__dirname, "..", "detect-tools.cjs");
let detectTools, TOOLS, TOOL_TO_REVIEWER;

try {
  const mod = require(modulePath);
  detectTools = mod.detectTools;
  TOOLS = mod.TOOLS;
  TOOL_TO_REVIEWER = mod.TOOL_TO_REVIEWER;
} catch (e) {
  // Module not created yet - tests will fail
  const notImplemented = () => {
    throw new Error("Module not implemented");
  };
  detectTools = notImplemented;
  TOOLS = [];
  TOOL_TO_REVIEWER = {};
}

// ============================================================================
// TOOLS constant Tests (D-50)
// ============================================================================

describe("TOOLS constant", () => {
  test("contains exactly codex, gemini, claude-cli", () => {
    assert.deepStrictEqual(TOOLS, ["codex", "gemini", "claude-cli"]);
  });

  test("has length of 3", () => {
    assert.strictEqual(TOOLS.length, 3);
  });
});

// ============================================================================
// TOOL_TO_REVIEWER mapping Tests (Council concern #1)
// ============================================================================

describe("TOOL_TO_REVIEWER mapping", () => {
  test("maps codex to codex", () => {
    assert.strictEqual(TOOL_TO_REVIEWER["codex"], "codex");
  });

  test("maps gemini to gemini", () => {
    assert.strictEqual(TOOL_TO_REVIEWER["gemini"], "gemini");
  });

  test("maps claude-cli to claude (canonical reviewer ID)", () => {
    // CRITICAL: council-invoke.cjs VALID_REVIEWERS only accepts 'claude', not 'claude-cli'
    assert.strictEqual(TOOL_TO_REVIEWER["claude-cli"], "claude");
  });

  test("has all three mappings", () => {
    const keys = Object.keys(TOOL_TO_REVIEWER);
    assert.deepStrictEqual(keys.sort(), ["claude-cli", "codex", "gemini"]);
  });
});

// ============================================================================
// detectTools function Tests (D-51)
// ============================================================================

describe("detectTools", () => {
  test("returns an array", () => {
    const result = detectTools();
    assert.ok(Array.isArray(result), "detectTools should return an array");
  });

  test("returns canonical reviewer IDs not CLI binary names", () => {
    const result = detectTools();
    // If any tools are found, they should be canonical IDs
    for (const tool of result) {
      assert.ok(
        ["codex", "gemini", "claude"].includes(tool),
        `Expected canonical reviewer ID, got: ${tool}`
      );
    }
    // Specifically verify claude-cli is NOT in the output
    assert.ok(
      !result.includes("claude-cli"),
      "Should output 'claude' not 'claude-cli'"
    );
  });

  test("does not return duplicates", () => {
    const result = detectTools();
    const unique = [...new Set(result)];
    assert.deepStrictEqual(result, unique, "Should not contain duplicates");
  });
});

// ============================================================================
// Platform-specific detection (D-51: Windows uses 'where')
// ============================================================================

describe("platform detection", () => {
  test("uses correct which command for platform", () => {
    // Read the source file and verify the pattern exists
    const fs = require("fs");
    const source = fs.readFileSync(modulePath, "utf-8");

    // Check for either single or double quote variants
    const hasPattern =
      source.includes('process.platform === "win32" ? "where" : "which"') ||
      source.includes("process.platform === 'win32' ? 'where' : 'which'");

    assert.ok(hasPattern, "Should use 'where' on Windows, 'which' elsewhere");
  });
});

// ============================================================================
// CLI mode Tests (D-52)
// ============================================================================

describe("CLI mode", () => {
  test("outputs valid JSON with availableTools array", () => {
    const result = spawnSync("node", [modulePath], {
      encoding: "utf-8",
      timeout: 5000,
    });

    // Even if exit code is 1 (no tools), stdout should be valid JSON
    let parsed;
    try {
      parsed = JSON.parse(result.stdout);
    } catch (e) {
      assert.fail(`Invalid JSON output: ${result.stdout}`);
    }

    assert.ok(
      Array.isArray(parsed.availableTools),
      "Output should have availableTools array"
    );
  });

  test("availableTools contains canonical reviewer IDs not CLI names", () => {
    const result = spawnSync("node", [modulePath], {
      encoding: "utf-8",
      timeout: 5000,
    });

    const parsed = JSON.parse(result.stdout);

    // Check each tool is a canonical ID
    for (const tool of parsed.availableTools) {
      assert.ok(
        ["codex", "gemini", "claude"].includes(tool),
        `Expected canonical ID, got: ${tool}`
      );
    }

    // Specifically verify claude-cli is NOT present
    assert.ok(
      !parsed.availableTools.includes("claude-cli"),
      "CLI output should contain 'claude' not 'claude-cli'"
    );
  });

  test("exits 0 when tools are found", () => {
    // This test may skip if no tools installed
    const result = spawnSync("node", [modulePath], {
      encoding: "utf-8",
      timeout: 5000,
    });

    const parsed = JSON.parse(result.stdout);

    if (parsed.availableTools.length > 0) {
      assert.strictEqual(result.status, 0, "Should exit 0 when tools found");
    } else {
      // If no tools found, exit 1 is expected (D-52)
      assert.strictEqual(
        result.status,
        1,
        "Should exit 1 when no tools found (per D-52)"
      );
    }
  });

  test("exits 1 when no tools detected (per D-52)", () => {
    // Simulate no tools by checking behavior
    // Since we can't easily mock execSync in CLI mode, we verify the pattern in source
    const fs = require("fs");
    const source = fs.readFileSync(modulePath, "utf-8");

    assert.ok(
      source.includes("tools.length === 0 ? 1 : 0"),
      "Should exit 1 when no tools, exit 0 when tools found"
    );
  });
});

// ============================================================================
// Module exports Tests
// ============================================================================

describe("module exports", () => {
  test("exports detectTools function", () => {
    assert.strictEqual(typeof detectTools, "function");
  });

  test("exports TOOLS array", () => {
    assert.ok(Array.isArray(TOOLS));
  });

  test("exports TOOL_TO_REVIEWER object", () => {
    assert.strictEqual(typeof TOOL_TO_REVIEWER, "object");
    assert.ok(TOOL_TO_REVIEWER !== null);
  });
});
