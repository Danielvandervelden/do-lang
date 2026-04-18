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
const os = require("os");
const { mkdtempSync, writeFileSync, rmSync, mkdirSync } = require("fs");

// Import the module
const modulePath = path.join(__dirname, "..", "council-invoke.cjs");
let detectRuntime,
  selectReviewer,
  parseVerdict,
  invokeCodex,
  invokeGemini,
  invokeCouncil,
  getAvailableReviewers,
  findWorkspaceConfig,
  loadWorkspaceConfig,
  resolveConfig,
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
  getAvailableReviewers = mod.getAvailableReviewers;
  findWorkspaceConfig = mod.findWorkspaceConfig;
  loadWorkspaceConfig = mod.loadWorkspaceConfig;
  resolveConfig = mod.resolveConfig;
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
  getAvailableReviewers = notImplemented;
  findWorkspaceConfig = notImplemented;
  loadWorkspaceConfig = notImplemented;
  resolveConfig = notImplemented;
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
    assert.strictEqual(
      result,
      "claude",
      "should return 'claude' when CODEX_RUNTIME is not set",
    );
  });

  test("returns 'codex' when CODEX_RUNTIME=1", () => {
    process.env.CODEX_RUNTIME = "1";
    const result = detectRuntime();
    assert.strictEqual(
      result,
      "codex",
      "should return 'codex' when CODEX_RUNTIME is set",
    );
  });

  test("returns 'codex' when CODEX_RUNTIME is any truthy value", () => {
    process.env.CODEX_RUNTIME = "true";
    const result = detectRuntime();
    assert.strictEqual(
      result,
      "codex",
      "should return 'codex' when CODEX_RUNTIME is truthy",
    );
  });
});

// ============================================================================
// selectReviewer Tests (D-39, D-40, D-41, D-42)
// ============================================================================

describe("selectReviewer", () => {
  const ALL_REVIEWERS = ["codex", "gemini"];

  test("selectReviewer('random', 'claude') returns 'codex' or 'gemini' (not 'claude')", () => {
    const results = new Set();
    for (let i = 0; i < 20; i++) {
      const result = selectReviewer("random", "claude", ALL_REVIEWERS);
      results.add(result);
      assert.ok(
        result === "codex" || result === "gemini",
        `random selection in Claude runtime should return 'codex' or 'gemini', got '${result}'`,
      );
    }
  });

  test("selectReviewer('codex', 'claude') returns 'codex'", () => {
    const result = selectReviewer("codex", "claude", ALL_REVIEWERS);
    assert.strictEqual(
      result,
      "codex",
      "should return 'codex' when explicitly configured",
    );
  });

  test("selectReviewer('gemini', 'claude') returns 'gemini'", () => {
    const result = selectReviewer("gemini", "claude", ALL_REVIEWERS);
    assert.strictEqual(
      result,
      "gemini",
      "should return 'gemini' when explicitly configured",
    );
  });

  test("selectReviewer('codex', 'codex') falls back to random (self-review prevention per D-40)", () => {
    const result = selectReviewer("codex", "codex", ["claude", "gemini"]);
    assert.ok(
      result === "claude" || result === "gemini",
      `self-review prevention: codex in codex runtime should fall back, got '${result}'`,
    );
  });

  test("selectReviewer('claude', 'claude') falls back to random (self-review prevention per D-40)", () => {
    const result = selectReviewer("claude", "claude", ALL_REVIEWERS);
    assert.ok(
      result === "codex" || result === "gemini",
      `self-review prevention: claude in claude runtime should fall back, got '${result}'`,
    );
  });

  test("selectReviewer('both', 'claude') returns 'both'", () => {
    const result = selectReviewer("both", "claude", ALL_REVIEWERS);
    assert.strictEqual(result, "both", "should return 'both' when configured");
  });

  test("selectReviewer('both', 'codex') returns 'both'", () => {
    const result = selectReviewer("both", "codex", ALL_REVIEWERS);
    assert.strictEqual(
      result,
      "both",
      "should return 'both' regardless of runtime",
    );
  });

  test("selectReviewer with invalid value falls back to random", () => {
    const result = selectReviewer("invalid-reviewer", "claude", ALL_REVIEWERS);
    assert.ok(
      result === "codex" || result === "gemini",
      `invalid reviewer should fall back to random, got '${result}'`,
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
    assert.strictEqual(
      result,
      "LOOKS_GOOD",
      "should extract LOOKS_GOOD from structured format",
    );
  });

  test("extracts CONCERNS from structured response", () => {
    const response = `
### Verdict
CONCERNS

Some issues found.
`;
    const result = parseVerdict(response);
    assert.strictEqual(
      result,
      "CONCERNS",
      "should extract CONCERNS from structured format",
    );
  });

  test("extracts RETHINK from structured response", () => {
    const response = `
### Verdict
RETHINK

Fundamental problems.
`;
    const result = parseVerdict(response);
    assert.strictEqual(
      result,
      "RETHINK",
      "should extract RETHINK from structured format",
    );
  });

  test("extracts APPROVED for code review", () => {
    const response = `
### Verdict
APPROVED

Code is correct.
`;
    const result = parseVerdict(response);
    assert.strictEqual(
      result,
      "APPROVED",
      "should extract APPROVED from structured format",
    );
  });

  test("extracts NITPICKS_ONLY for code review", () => {
    const response = `
### Verdict
NITPICKS_ONLY

Minor style issues.
`;
    const result = parseVerdict(response);
    assert.strictEqual(
      result,
      "NITPICKS_ONLY",
      "should extract NITPICKS_ONLY from structured format",
    );
  });

  test("extracts CHANGES_REQUESTED for code review", () => {
    const response = `
### Verdict
CHANGES_REQUESTED

Material issues found.
`;
    const result = parseVerdict(response);
    assert.strictEqual(
      result,
      "CHANGES_REQUESTED",
      "should extract CHANGES_REQUESTED from structured format",
    );
  });

  test("uses sentiment fallback when no structured verdict - rethink", () => {
    const response = `
I think we need to rethink this approach. The fundamental design is flawed.
`;
    const result = parseVerdict(response);
    assert.strictEqual(
      result,
      "RETHINK",
      "should detect RETHINK from sentiment",
    );
  });

  test("uses sentiment fallback when no structured verdict - looks good", () => {
    const response = `
This looks good to me. The implementation is solid and well-structured.
`;
    const result = parseVerdict(response);
    assert.strictEqual(
      result,
      "LOOKS_GOOD",
      "should detect LOOKS_GOOD from sentiment",
    );
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
    assert.strictEqual(
      result,
      "CONCERNS",
      "should default to CONCERNS for empty response",
    );
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
      "PLUGIN_ROOT should point to codex plugin cache",
    );
  });

  test("CODEX_COMPANION path is correctly defined", () => {
    assert.ok(CODEX_COMPANION, "CODEX_COMPANION should be defined");
    assert.ok(
      CODEX_COMPANION.includes("codex-companion.mjs"),
      "CODEX_COMPANION should point to codex-companion.mjs",
    );
  });

  test("DEFAULT_TIMEOUT is reasonable", () => {
    assert.ok(DEFAULT_TIMEOUT, "DEFAULT_TIMEOUT should be defined");
    assert.ok(
      DEFAULT_TIMEOUT >= 60000,
      "DEFAULT_TIMEOUT should be at least 60 seconds",
    );
    assert.ok(
      DEFAULT_TIMEOUT <= 300000,
      "DEFAULT_TIMEOUT should be at most 5 minutes",
    );
  });
});

// ============================================================================
// Module exports Tests
// ============================================================================

describe("Module exports", () => {
  test("exports detectRuntime function", () => {
    assert.strictEqual(
      typeof detectRuntime,
      "function",
      "detectRuntime should be a function",
    );
  });

  test("exports selectReviewer function", () => {
    assert.strictEqual(
      typeof selectReviewer,
      "function",
      "selectReviewer should be a function",
    );
  });

  test("exports parseVerdict function", () => {
    assert.strictEqual(
      typeof parseVerdict,
      "function",
      "parseVerdict should be a function",
    );
  });

  test("exports invokeCodex function", () => {
    assert.strictEqual(
      typeof invokeCodex,
      "function",
      "invokeCodex should be a function",
    );
  });

  test("exports invokeGemini function", () => {
    assert.strictEqual(
      typeof invokeGemini,
      "function",
      "invokeGemini should be a function",
    );
  });

  test("exports invokeCouncil function", () => {
    assert.strictEqual(
      typeof invokeCouncil,
      "function",
      "invokeCouncil should be a function",
    );
  });

  test("exports config functions (D-49, D-54, D-55, D-56)", () => {
    assert.strictEqual(
      typeof findWorkspaceConfig,
      "function",
      "findWorkspaceConfig should be a function",
    );
    assert.strictEqual(
      typeof loadWorkspaceConfig,
      "function",
      "loadWorkspaceConfig should be a function",
    );
    assert.strictEqual(
      typeof resolveConfig,
      "function",
      "resolveConfig should be a function",
    );
  });
});

// ============================================================================
// loadWorkspaceConfig Tests (D-49) - Per council concern #5: use temp files
// ============================================================================

describe("loadWorkspaceConfig", () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), "council-test-"));
  });

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("returns null when no config found", () => {
    // Use temp dir without .do-workspace.json
    const result = loadWorkspaceConfig(tempDir);
    assert.strictEqual(
      result,
      null,
      "should return null when config not found",
    );
  });

  test("parses valid JSON from .do-workspace.json", () => {
    // Create config file in temp dir
    const config = {
      version: "0.1.0",
      availableTools: ["codex", "gemini"],
      defaultReviewer: "random",
    };
    writeFileSync(
      path.join(tempDir, ".do-workspace.json"),
      JSON.stringify(config),
    );

    const result = loadWorkspaceConfig(tempDir);
    assert.deepStrictEqual(result.availableTools, ["codex", "gemini"]);
    assert.strictEqual(result.defaultReviewer, "random");
  });

  test("traverses up to find workspace config", () => {
    // Create nested structure: tempDir/.do-workspace.json and tempDir/subdir/
    const config = { version: "0.1.0", availableTools: ["gemini"] };
    writeFileSync(
      path.join(tempDir, ".do-workspace.json"),
      JSON.stringify(config),
    );
    const subdir = path.join(tempDir, "subdir");
    mkdirSync(subdir);

    // Search from subdir should find parent's config
    const result = loadWorkspaceConfig(subdir);
    assert.deepStrictEqual(result.availableTools, ["gemini"]);
  });

  test("returns null for invalid JSON", () => {
    // Create invalid JSON config file
    writeFileSync(path.join(tempDir, ".do-workspace.json"), "{ invalid json }");

    const result = loadWorkspaceConfig(tempDir);
    assert.strictEqual(result, null, "should return null for invalid JSON");
  });
});

// ============================================================================
// resolveConfig Tests (D-54, D-55, D-56) - Per council concern #5: use temp files
// ============================================================================

describe("resolveConfig", () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), "council-cascade-test-"));
  });

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("returns defaults when no configs exist", () => {
    // No config files in temp dir
    const result = resolveConfig(null, tempDir);
    assert.strictEqual(
      result.defaultReviewer,
      "random",
      "should default reviewer to 'random'",
    );
    assert.deepStrictEqual(
      result.availableTools,
      [],
      "should default availableTools to empty array",
    );
    assert.strictEqual(
      result.council_reviews.planning,
      true,
      "should default planning to true",
    );
    assert.strictEqual(
      result.council_reviews.execution,
      true,
      "should default execution to true",
    );
  });

  test("workspace config overrides defaults", () => {
    // Create workspace config
    const workspaceConfig = {
      version: "0.1.0",
      availableTools: ["codex"],
      defaultReviewer: "codex",
      council_reviews: { planning: false, execution: true },
    };
    writeFileSync(
      path.join(tempDir, ".do-workspace.json"),
      JSON.stringify(workspaceConfig),
    );

    const result = resolveConfig(null, tempDir);
    assert.deepStrictEqual(result.availableTools, ["codex"]);
    assert.strictEqual(result.defaultReviewer, "codex");
    assert.strictEqual(result.council_reviews.planning, false);
  });

  test("project config overrides workspace config", () => {
    // Create workspace config
    const workspaceConfig = {
      availableTools: ["codex", "gemini"],
      defaultReviewer: "random",
    };
    writeFileSync(
      path.join(tempDir, ".do-workspace.json"),
      JSON.stringify(workspaceConfig),
    );

    // Create project config in .do/ subdir
    const doDir = path.join(tempDir, ".do");
    mkdirSync(doDir);
    const projectConfig = {
      council_reviews: { planning: true, execution: false, reviewer: "gemini" },
    };
    const projectConfigPath = path.join(doDir, "config.json");
    writeFileSync(projectConfigPath, JSON.stringify(projectConfig));

    const result = resolveConfig(projectConfigPath, tempDir);
    // Project reviewer should override workspace defaultReviewer
    assert.strictEqual(result.council_reviews.reviewer, "gemini");
    assert.strictEqual(result.council_reviews.execution, false);
    // availableTools comes from workspace (project didn't override)
    assert.deepStrictEqual(result.availableTools, ["codex", "gemini"]);
  });

  test("handles missing project config path gracefully", () => {
    // Create workspace config
    const workspaceConfig = {
      availableTools: ["claude"],
      defaultReviewer: "claude",
    };
    writeFileSync(
      path.join(tempDir, ".do-workspace.json"),
      JSON.stringify(workspaceConfig),
    );

    // Pass nonexistent project config path
    const result = resolveConfig("/nonexistent/config.json", tempDir);
    // Should use workspace config
    assert.deepStrictEqual(result.availableTools, ["claude"]);
    assert.strictEqual(result.defaultReviewer, "claude");
  });
});

// ============================================================================
// getAvailableReviewers Tests with Config (D-55)
// ============================================================================

describe("getAvailableReviewers with config", () => {
  test("uses availableTools from config when provided", () => {
    const mockConfig = { availableTools: ["gemini", "claude"] };
    const result = getAvailableReviewers("codex", mockConfig);
    // Should return all tools except current runtime
    assert.ok(Array.isArray(result));
    assert.ok(!result.includes("codex"), "should filter out current runtime");
    assert.ok(result.includes("gemini"), "should include gemini from config");
    assert.ok(result.includes("claude"), "should include claude from config");
  });

  test("filters out current runtime from config tools", () => {
    const mockConfig = { availableTools: ["codex", "gemini", "claude"] };
    const result = getAvailableReviewers("codex", mockConfig);
    assert.ok(!result.includes("codex"), "should not include current runtime");
    assert.ok(result.includes("gemini"));
    assert.ok(result.includes("claude"));
  });

  test("falls back to hardcoded when config.availableTools is empty", () => {
    const mockConfig = { availableTools: [] };
    const result = getAvailableReviewers("claude", mockConfig);
    // Should use hardcoded fallback
    assert.ok(result.length > 0, "should have fallback reviewers");
    assert.ok(
      result.includes("codex") || result.includes("gemini"),
      "should include hardcoded reviewers",
    );
  });

  test("falls back to hardcoded when resolvedConfig is null", () => {
    // This tests the auto-load path, but without a workspace config it will use defaults
    const result = getAvailableReviewers("claude", null);
    assert.ok(Array.isArray(result));
    assert.ok(result.length > 0, "should have fallback reviewers");
  });

  test("filters current runtime when it matches a config tool (claude)", () => {
    const mockConfig = { availableTools: ["codex", "gemini", "claude"] };
    const result = getAvailableReviewers("claude", mockConfig);
    assert.ok(!result.includes("claude"), "should not include current runtime");
    assert.ok(result.includes("codex"));
    assert.ok(result.includes("gemini"));
  });

  test("returns empty array when config only contains current runtime", () => {
    // Per council code review: single-tool scenario where availableTools only has current runtime
    const mockConfig = { availableTools: ["claude"] };
    const result = getAvailableReviewers("claude", mockConfig);
    assert.deepStrictEqual(result, [], "should return empty when only current runtime is available");
  });

  test("selectReviewer returns null when no reviewers available", () => {
    // Per council code review: selectRandomReviewer should return null, not hardcode 'gemini'
    const available = [];
    const result = selectReviewer("random", "claude", available);
    assert.strictEqual(result, null, "should return null when no reviewers available");
  });
});

// ============================================================================
// findWorkspaceConfig Tests (D-56)
// ============================================================================

describe("findWorkspaceConfig", () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), "council-find-test-"));
  });

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("returns null when no config in hierarchy", () => {
    const result = findWorkspaceConfig(tempDir);
    assert.strictEqual(result, null, "should return null when no config found");
  });

  test("returns path when config exists in start directory", () => {
    const configPath = path.join(tempDir, ".do-workspace.json");
    writeFileSync(configPath, JSON.stringify({ version: "0.1.0" }));

    const result = findWorkspaceConfig(tempDir);
    assert.strictEqual(result, configPath, "should return path to config");
  });

  test("returns path when config exists in parent directory", () => {
    // Create nested structure
    const configPath = path.join(tempDir, ".do-workspace.json");
    writeFileSync(configPath, JSON.stringify({ version: "0.1.0" }));

    const subdir = path.join(tempDir, "projects", "myproject");
    mkdirSync(subdir, { recursive: true });

    const result = findWorkspaceConfig(subdir);
    assert.strictEqual(result, configPath, "should find config in parent");
  });
});
