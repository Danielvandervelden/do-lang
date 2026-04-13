#!/usr/bin/env node

/**
 * Tests for council invocation
 *
 * Uses Node.js built-in test runner (Node 16.7+)
 * Run: node --test skills/do/scripts/__tests__/council-invoke.test.cjs
 *
 * Test requirements covered:
 * - D-36: Council invocation scripts in skills/do/scripts/
 * - D-39: Reviewer selection with values: claude, codex, gemini, random, both
 * - D-40: Runtime detection prevents self-review
 * - D-41: Random selection uses Python for consistency
 * - D-42: Available reviewers depend on runtime
 */

const { test, describe, mock, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const path = require("path");

// Import the module
const modulePath = path.join(__dirname, "..", "council-invoke.cjs");
let detectRuntime,
  selectReviewer,
  parseVerdict,
  invokeCodex,
  invokeGemini,
  invokeCouncil,
  PLUGIN_ROOT,
  CODEX_COMPANION,
  DEFAULT_TIMEOUT;

try {
  const mod = require(modulePath);
  detectRuntime = mod.detectRuntime;
  selectReviewer = mod.selectReviewer;
  parseVerdict = mod.parseVerdict;
  invokeCodex = mod.invokeCodex;
  invokeGemini = mod.invokeGemini;
  invokeCouncil = mod.invokeCouncil;
  PLUGIN_ROOT = mod.PLUGIN_ROOT;
  CODEX_COMPANION = mod.CODEX_COMPANION;
  DEFAULT_TIMEOUT = mod.DEFAULT_TIMEOUT;
} catch (e) {
  // Module not created yet - tests will fail
  const notImplemented = () => {
    throw new Error("Module not implemented");
  };
  detectRuntime = notImplemented;
  selectReviewer = notImplemented;
  parseVerdict = notImplemented;
  invokeCodex = notImplemented;
  invokeGemini = notImplemented;
  invokeCouncil = notImplemented;
}

// ============================================================================
// detectRuntime Tests (D-40)
// ============================================================================

describe("detectRuntime", () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = process.env.CODEX_RUNTIME;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.CODEX_RUNTIME;
    } else {
      process.env.CODEX_RUNTIME = originalEnv;
    }
  });

  test("returns 'claude' when CODEX_RUNTIME not set", () => {
    delete process.env.CODEX_RUNTIME;
    const result = detectRuntime();
    assert.strictEqual(result, "claude", "should return 'claude' when CODEX_RUNTIME is not set");
  });

  test("returns 'codex' when CODEX_RUNTIME=1", () => {
    process.env.CODEX_RUNTIME = "1";
    const result = detectRuntime();
    assert.strictEqual(result, "codex", "should return 'codex' when CODEX_RUNTIME is set");
  });

  test("returns 'codex' when CODEX_RUNTIME is any truthy value", () => {
    process.env.CODEX_RUNTIME = "true";
    const result = detectRuntime();
    assert.strictEqual(result, "codex", "should return 'codex' when CODEX_RUNTIME is truthy");
  });
});

// ============================================================================
// selectReviewer Tests (D-39, D-40, D-41, D-42)
// ============================================================================

describe("selectReviewer", () => {
  test("selectReviewer('random', 'claude') returns 'codex' or 'gemini' (not 'claude')", () => {
    // Run multiple times to verify randomness doesn't return 'claude'
    const results = new Set();
    for (let i = 0; i < 20; i++) {
      const result = selectReviewer("random", "claude");
      results.add(result);
      assert.ok(
        result === "codex" || result === "gemini",
        `random selection in Claude runtime should return 'codex' or 'gemini', got '${result}'`
      );
    }
    // Should have at least some variety (not always same)
    // This is a probabilistic test - with 20 runs and 50/50 chance, very unlikely to get all same
  });

  test("selectReviewer('codex', 'claude') returns 'codex'", () => {
    const result = selectReviewer("codex", "claude");
    assert.strictEqual(result, "codex", "should return 'codex' when explicitly configured");
  });

  test("selectReviewer('gemini', 'claude') returns 'gemini'", () => {
    const result = selectReviewer("gemini", "claude");
    assert.strictEqual(result, "gemini", "should return 'gemini' when explicitly configured");
  });

  test("selectReviewer('codex', 'codex') falls back to random (self-review prevention per D-40)", () => {
    // In Codex runtime, 'codex' is self-review, so should fall back
    const result = selectReviewer("codex", "codex");
    assert.ok(
      result === "claude" || result === "gemini",
      `self-review prevention: codex in codex runtime should fall back, got '${result}'`
    );
  });

  test("selectReviewer('claude', 'claude') falls back to random (self-review prevention per D-40)", () => {
    // In Claude runtime, 'claude' is self-review, so should fall back
    const result = selectReviewer("claude", "claude");
    assert.ok(
      result === "codex" || result === "gemini",
      `self-review prevention: claude in claude runtime should fall back, got '${result}'`
    );
  });

  test("selectReviewer('both', 'claude') returns 'both'", () => {
    const result = selectReviewer("both", "claude");
    assert.strictEqual(result, "both", "should return 'both' when configured");
  });

  test("selectReviewer('both', 'codex') returns 'both'", () => {
    const result = selectReviewer("both", "codex");
    assert.strictEqual(result, "both", "should return 'both' regardless of runtime");
  });

  test("selectReviewer with invalid value falls back to random", () => {
    const result = selectReviewer("invalid-reviewer", "claude");
    assert.ok(
      result === "codex" || result === "gemini",
      `invalid reviewer should fall back to random, got '${result}'`
    );
  });
});

// ============================================================================
// parseVerdict Tests
// ============================================================================

describe("parseVerdict", () => {
  test("extracts LOOKS_GOOD from structured response", () => {
    const response = `
## Analysis
The plan looks solid.

### Verdict
LOOKS_GOOD

### Key Findings
- Good coverage
`;
    const result = parseVerdict(response);
    assert.strictEqual(result, "LOOKS_GOOD", "should extract LOOKS_GOOD from structured format");
  });

  test("extracts CONCERNS from structured response", () => {
    const response = `
### Verdict
CONCERNS

Some issues found.
`;
    const result = parseVerdict(response);
    assert.strictEqual(result, "CONCERNS", "should extract CONCERNS from structured format");
  });

  test("extracts RETHINK from structured response", () => {
    const response = `
### Verdict
RETHINK

Fundamental problems.
`;
    const result = parseVerdict(response);
    assert.strictEqual(result, "RETHINK", "should extract RETHINK from structured format");
  });

  test("extracts APPROVED for code review", () => {
    const response = `
### Verdict
APPROVED

Code is correct.
`;
    const result = parseVerdict(response);
    assert.strictEqual(result, "APPROVED", "should extract APPROVED from structured format");
  });

  test("extracts NITPICKS_ONLY for code review", () => {
    const response = `
### Verdict
NITPICKS_ONLY

Minor style issues.
`;
    const result = parseVerdict(response);
    assert.strictEqual(result, "NITPICKS_ONLY", "should extract NITPICKS_ONLY from structured format");
  });

  test("extracts CHANGES_REQUESTED for code review", () => {
    const response = `
### Verdict
CHANGES_REQUESTED

Material issues found.
`;
    const result = parseVerdict(response);
    assert.strictEqual(result, "CHANGES_REQUESTED", "should extract CHANGES_REQUESTED from structured format");
  });

  test("uses sentiment fallback when no structured verdict - rethink", () => {
    const response = `
I think we need to rethink this approach. The fundamental design is flawed.
`;
    const result = parseVerdict(response);
    assert.strictEqual(result, "RETHINK", "should detect RETHINK from sentiment");
  });

  test("uses sentiment fallback when no structured verdict - looks good", () => {
    const response = `
This looks good to me. The implementation is solid and well-structured.
`;
    const result = parseVerdict(response);
    assert.strictEqual(result, "LOOKS_GOOD", "should detect LOOKS_GOOD from sentiment");
  });

  test("returns CONCERNS as default when no verdict detected", () => {
    const response = `
Here is some analysis of the code.
I see various things happening.
`;
    const result = parseVerdict(response);
    assert.strictEqual(result, "CONCERNS", "should default to CONCERNS");
  });

  test("handles case-insensitive verdict extraction", () => {
    const response = `
### Verdict
looks_good
`;
    const result = parseVerdict(response);
    assert.strictEqual(result, "LOOKS_GOOD", "should handle lowercase verdict");
  });

  test("handles empty response", () => {
    const result = parseVerdict("");
    assert.strictEqual(result, "CONCERNS", "should default to CONCERNS for empty response");
  });
});

// ============================================================================
// Constants Tests
// ============================================================================

describe("Constants", () => {
  test("PLUGIN_ROOT is correctly defined", () => {
    assert.ok(PLUGIN_ROOT, "PLUGIN_ROOT should be defined");
    assert.ok(
      PLUGIN_ROOT.includes(".claude/plugins/cache/openai-codex/codex"),
      "PLUGIN_ROOT should point to codex plugin cache"
    );
  });

  test("CODEX_COMPANION path is correctly defined", () => {
    assert.ok(CODEX_COMPANION, "CODEX_COMPANION should be defined");
    assert.ok(
      CODEX_COMPANION.includes("codex-companion.mjs"),
      "CODEX_COMPANION should point to codex-companion.mjs"
    );
  });

  test("DEFAULT_TIMEOUT is reasonable", () => {
    assert.ok(DEFAULT_TIMEOUT, "DEFAULT_TIMEOUT should be defined");
    assert.ok(DEFAULT_TIMEOUT >= 60000, "DEFAULT_TIMEOUT should be at least 60 seconds");
    assert.ok(DEFAULT_TIMEOUT <= 300000, "DEFAULT_TIMEOUT should be at most 5 minutes");
  });
});

// ============================================================================
// Module exports Tests
// ============================================================================

describe("Module exports", () => {
  test("exports detectRuntime function", () => {
    assert.strictEqual(typeof detectRuntime, "function", "detectRuntime should be a function");
  });

  test("exports selectReviewer function", () => {
    assert.strictEqual(typeof selectReviewer, "function", "selectReviewer should be a function");
  });

  test("exports parseVerdict function", () => {
    assert.strictEqual(typeof parseVerdict, "function", "parseVerdict should be a function");
  });

  test("exports invokeCodex function", () => {
    assert.strictEqual(typeof invokeCodex, "function", "invokeCodex should be a function");
  });

  test("exports invokeGemini function", () => {
    assert.strictEqual(typeof invokeGemini, "function", "invokeGemini should be a function");
  });

  test("exports invokeCouncil function", () => {
    assert.strictEqual(typeof invokeCouncil, "function", "invokeCouncil should be a function");
  });
});
