#!/usr/bin/env node

/**
 * Tests for council invocation
 *
 * Uses Node.js built-in test runner (Node 16.7+)
 * Run: node --test skills/scripts/__tests__/council-invoke.test.cjs
 *
 * Test requirements covered:
 * - D-36: Council invocation scripts in skills/scripts/
 * - D-39: Reviewer selection with values: claude, codex, gemini, random, both
 * - D-40: Runtime detection prevents self-review
 * - D-41: Random selection uses Python for consistency
 * - D-42: Available reviewers depend on runtime
 */

const { test, describe, mock, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const path = require("path");
const os = require("os");
const {
  chmodSync,
  existsSync,
  mkdtempSync,
  writeFileSync,
  rmSync,
  mkdirSync,
} = require("fs");

// Import the module
const modulePath = path.join(__dirname, "..", "council-invoke.cjs");
let detectRuntime,
  selectReviewer,
  parseVerdict,
  invokeCodex,
  invokeGemini,
  invokeClaude,
  invokeBoth,
  invokeCouncil,
  getAvailableReviewers,
  findWorkspaceConfig,
  loadWorkspaceConfig,
  resolveConfig,
  parseSelfReviewFindings,
  parseCouncilRunnerOutput,
  classifyFindings,
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
  invokeClaude = mod.invokeClaude;
  invokeBoth = mod.invokeBoth;
  invokeCouncil = mod.invokeCouncil;
  getAvailableReviewers = mod.getAvailableReviewers;
  findWorkspaceConfig = mod.findWorkspaceConfig;
  loadWorkspaceConfig = mod.loadWorkspaceConfig;
  resolveConfig = mod.resolveConfig;
  parseSelfReviewFindings = mod.parseSelfReviewFindings;
  parseCouncilRunnerOutput = mod.parseCouncilRunnerOutput;
  classifyFindings = mod.classifyFindings;
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
  invokeClaude = notImplemented;
  invokeBoth = notImplemented;
  invokeCouncil = notImplemented;
  getAvailableReviewers = notImplemented;
  findWorkspaceConfig = notImplemented;
  loadWorkspaceConfig = notImplemented;
  resolveConfig = notImplemented;
  parseSelfReviewFindings = notImplemented;
  parseCouncilRunnerOutput = notImplemented;
  classifyFindings = notImplemented;
}

// ============================================================================
// detectRuntime Tests (D-40)
// ============================================================================

describe("detectRuntime", () => {
  let originalEnv;
  const codexMarkers = [
    "CODEX_RUNTIME",
    "CODEX_CI",
    "CODEX_THREAD_ID",
    "CODEX_MANAGED_BY_NPM",
  ];

  beforeEach(() => {
    originalEnv = Object.fromEntries(
      codexMarkers.map((marker) => [marker, process.env[marker]]),
    );
    for (const marker of codexMarkers) {
      delete process.env[marker];
    }
  });

  afterEach(() => {
    for (const marker of codexMarkers) {
      if (originalEnv[marker] === undefined) {
        delete process.env[marker];
      } else {
        process.env[marker] = originalEnv[marker];
      }
    }
  });

  test("returns 'claude' when no Codex markers are set", () => {
    const result = detectRuntime();
    assert.strictEqual(
      result,
      "claude",
      "should return 'claude' when no Codex marker is set",
    );
  });

  for (const marker of codexMarkers) {
    test(`returns 'codex' when ${marker} is set`, () => {
      process.env[marker] = "1";
      const result = detectRuntime();
      assert.strictEqual(
        result,
        "codex",
        `should return 'codex' when ${marker} is set`,
      );
    });
  }
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

  test("explicit available-but-filtered Claude reviewer does not fall back to Gemini", () => {
    const result = selectReviewer("claude", "codex", ["gemini"]);
    assert.strictEqual(
      result,
      null,
      "explicit unavailable Claude reviewer should skip instead of selecting Gemini",
    );
  });

  test('random selects Claude in Codex runtime with availableTools ["codex", "claude"]', () => {
    const available = getAvailableReviewers("codex", {
      availableTools: ["codex", "claude"],
    });
    const result = selectReviewer("random", "codex", available);
    assert.deepStrictEqual(available, ["claude"]);
    assert.strictEqual(result, "claude");
  });

  test('random selects Codex in Claude runtime with availableTools ["codex", "claude"]', () => {
    const available = getAvailableReviewers("claude", {
      availableTools: ["codex", "claude"],
    });
    const result = selectReviewer("random", "claude", available);
    assert.deepStrictEqual(available, ["codex"]);
    assert.strictEqual(result, "codex");
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

  test("exports invokeClaude function", () => {
    assert.strictEqual(
      typeof invokeClaude,
      "function",
      "invokeClaude should be a function",
    );
  });

  test("exports invokeBoth function", () => {
    assert.strictEqual(
      typeof invokeBoth,
      "function",
      "invokeBoth should be a function",
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
// Invocation routing tests
// ============================================================================

describe("invokeCouncil reviewer routing", () => {
  let tempDir;
  let originalPath;
  let originalCodexRuntime;
  let originalCodexCi;
  let originalCodexThreadId;
  let originalCodexManagedByNpm;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), "council-routing-test-"));
    originalPath = process.env.PATH;
    originalCodexRuntime = process.env.CODEX_RUNTIME;
    originalCodexCi = process.env.CODEX_CI;
    originalCodexThreadId = process.env.CODEX_THREAD_ID;
    originalCodexManagedByNpm = process.env.CODEX_MANAGED_BY_NPM;
    delete process.env.CODEX_RUNTIME;
    delete process.env.CODEX_CI;
    delete process.env.CODEX_THREAD_ID;
    delete process.env.CODEX_MANAGED_BY_NPM;
  });

  afterEach(() => {
    process.env.PATH = originalPath;
    if (originalCodexRuntime === undefined) {
      delete process.env.CODEX_RUNTIME;
    } else {
      process.env.CODEX_RUNTIME = originalCodexRuntime;
    }
    if (originalCodexCi === undefined) {
      delete process.env.CODEX_CI;
    } else {
      process.env.CODEX_CI = originalCodexCi;
    }
    if (originalCodexThreadId === undefined) {
      delete process.env.CODEX_THREAD_ID;
    } else {
      process.env.CODEX_THREAD_ID = originalCodexThreadId;
    }
    if (originalCodexManagedByNpm === undefined) {
      delete process.env.CODEX_MANAGED_BY_NPM;
    } else {
      process.env.CODEX_MANAGED_BY_NPM = originalCodexManagedByNpm;
    }
    rmSync(tempDir, { recursive: true, force: true });
  });

  function writeExecutable(name, body) {
    const binDir = path.join(tempDir, "bin");
    mkdirSync(binDir, { recursive: true });
    const filePath = path.join(binDir, name);
    writeFileSync(filePath, body);
    chmodSync(filePath, 0o755);
    process.env.PATH = `${binDir}${path.delimiter}${originalPath}`;
    return filePath;
  }

  function writeTaskAndConfig(config) {
    const doDir = path.join(tempDir, ".do");
    mkdirSync(doDir, { recursive: true });
    const taskFile = path.join(tempDir, "task.md");
    const configPath = path.join(doDir, "config.json");
    writeFileSync(taskFile, "# Test task\n");
    writeFileSync(configPath, JSON.stringify(config));
    return { taskFile, configPath };
  }

  test("reviewer claude invokes Claude CLI directly and never Gemini", async () => {
    process.env.CODEX_CI = "1";
    const geminiMarker = path.join(tempDir, "gemini-called");
    writeExecutable(
      "claude",
      `#!/bin/sh
cat >/dev/null
printf '### Verdict\\nLOOKS_GOOD\\n\\n### Key Findings\\n- claude reviewed\\n'
`,
    );
    writeExecutable(
      "gemini",
      `#!/bin/sh
touch "${geminiMarker}"
exit 42
`,
    );
    const { taskFile, configPath } = writeTaskAndConfig({
      availableTools: ["claude", "gemini"],
      council_reviews: { reviewer: "claude" },
    });

    const result = await invokeCouncil({
      type: "plan",
      taskFile,
      reviewer: "claude",
      workspace: tempDir,
      projectConfigPath: configPath,
      timeout: 5000,
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.advisor, "claude");
    assert.strictEqual(result.verdict, "LOOKS_GOOD");
    assert.strictEqual(
      existsSync(geminiMarker),
      false,
      "Gemini must not be invoked for explicit Claude reviewer",
    );
  });

  test("explicit Claude unavailable skips and never invokes available Gemini", async () => {
    process.env.CODEX_CI = "1";
    const geminiMarker = path.join(tempDir, "gemini-called");
    writeExecutable(
      "gemini",
      `#!/bin/sh
touch "${geminiMarker}"
printf '### Verdict\\nLOOKS_GOOD\\n'
`,
    );
    const { taskFile, configPath } = writeTaskAndConfig({
      availableTools: ["gemini"],
      council_reviews: { reviewer: "claude" },
    });

    const result = await invokeCouncil({
      type: "plan",
      taskFile,
      reviewer: "claude",
      workspace: tempDir,
      projectConfigPath: configPath,
      timeout: 5000,
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.skipped, true);
    assert.notStrictEqual(result.advisor, "gemini");
    assert.match(result.reason, /Configured reviewer 'claude' is not available/);
    assert.strictEqual(
      existsSync(geminiMarker),
      false,
      "Gemini must not be invoked when explicit Claude is unavailable",
    );
  });

  test("both with configured Codex+Claude in Codex runtime invokes Claude only, no Gemini", async () => {
    process.env.CODEX_THREAD_ID = "thread-test";
    const geminiMarker = path.join(tempDir, "gemini-called");
    writeExecutable(
      "claude",
      `#!/bin/sh
cat >/dev/null
printf '### Verdict\\nLOOKS_GOOD\\n\\n### Key Findings\\n- claude reviewed\\n'
`,
    );
    writeExecutable(
      "gemini",
      `#!/bin/sh
touch "${geminiMarker}"
exit 42
`,
    );
    const { taskFile, configPath } = writeTaskAndConfig({
      availableTools: ["codex", "claude"],
      council_reviews: { reviewer: "both" },
    });

    const result = await invokeCouncil({
      type: "plan",
      taskFile,
      reviewer: "both",
      workspace: tempDir,
      projectConfigPath: configPath,
      timeout: 5000,
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.advisor, "both");
    assert.deepStrictEqual(Object.keys(result.raw), ["claude"]);
    assert.strictEqual(result.raw.claude.success, true);
    assert.strictEqual(
      existsSync(geminiMarker),
      false,
      "Gemini must not be invoked when it is not configured",
    );
  });

  test("no-config both in Codex runtime invokes fallback Claude and Gemini advisors", async () => {
    process.env.CODEX_MANAGED_BY_NPM = "1";
    writeExecutable(
      "claude",
      `#!/bin/sh
cat >/dev/null
printf '### Verdict\\nLOOKS_GOOD\\n\\n### Key Findings\\n- claude reviewed\\n'
`,
    );
    writeExecutable(
      "gemini",
      `#!/bin/sh
cat >/dev/null
printf '### Verdict\\nLOOKS_GOOD\\n\\n### Key Findings\\n- gemini reviewed\\n'
`,
    );
    const taskFile = path.join(tempDir, "task.md");
    writeFileSync(taskFile, "# Test task\n");

    const result = await invokeCouncil({
      type: "plan",
      taskFile,
      reviewer: "both",
      workspace: tempDir,
      timeout: 5000,
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.advisor, "both");
    assert.deepStrictEqual(Object.keys(result.raw).sort(), ["claude", "gemini"]);
    assert.strictEqual(result.raw.claude.success, true);
    assert.strictEqual(result.raw.gemini.success, true);
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
// CLI project config auto-detection
// ============================================================================

describe("CLI project config auto-detection", () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), "council-cli-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("auto-detects .do/config.json from cwd when file exists", () => {
    // Create .do/config.json in tempDir
    const doDir = path.join(tempDir, ".do");
    mkdirSync(doDir);
    const projectConfig = {
      council_reviews: { reviewer: "codex" },
    };
    const configPath = path.join(doDir, "config.json");
    writeFileSync(configPath, JSON.stringify(projectConfig));

    // Simulate CLI auto-detection logic
    const { existsSync } = require("fs");
    const defaultProjectConfigPath = path.join(tempDir, ".do", "config.json");
    const resolved = existsSync(defaultProjectConfigPath)
      ? defaultProjectConfigPath
      : null;

    assert.strictEqual(
      resolved,
      configPath,
      "should resolve to .do/config.json in cwd",
    );

    // Verify the resolved config is readable and correct
    const config = resolveConfig(resolved, tempDir);
    assert.strictEqual(config.council_reviews.reviewer, "codex");
  });

  test("returns null when .do/config.json does not exist in cwd", () => {
    // tempDir has no .do/ directory
    const { existsSync } = require("fs");
    const defaultProjectConfigPath = path.join(tempDir, ".do", "config.json");
    const resolved = existsSync(defaultProjectConfigPath)
      ? defaultProjectConfigPath
      : null;

    assert.strictEqual(
      resolved,
      null,
      "should return null when config is absent",
    );
  });

  test("explicit --project-config-path overrides auto-detected path", () => {
    // Create two configs: one in cwd/.do/config.json, one at explicit path
    const doDir = path.join(tempDir, ".do");
    mkdirSync(doDir);
    const cwdConfig = { council_reviews: { reviewer: "gemini" } };
    writeFileSync(path.join(doDir, "config.json"), JSON.stringify(cwdConfig));

    const explicitDir = mkdtempSync(
      path.join(os.tmpdir(), "council-explicit-"),
    );
    const explicitDoDir = path.join(explicitDir, ".do");
    mkdirSync(explicitDoDir);
    const explicitConfig = { council_reviews: { reviewer: "codex" } };
    const explicitConfigPath = path.join(explicitDoDir, "config.json");
    writeFileSync(explicitConfigPath, JSON.stringify(explicitConfig));

    try {
      // When --project-config-path is provided it wins over auto-detected path
      const flagValue = explicitConfigPath; // simulates getArg("--project-config-path")
      const autoDetected = path.join(tempDir, ".do", "config.json");
      const resolved =
        flagValue ||
        (require("fs").existsSync(autoDetected) ? autoDetected : null);

      assert.strictEqual(
        resolved,
        explicitConfigPath,
        "explicit path should win",
      );

      const config = resolveConfig(resolved, tempDir);
      assert.strictEqual(
        config.council_reviews.reviewer,
        "codex",
        "should use explicit config reviewer",
      );
    } finally {
      rmSync(explicitDir, { recursive: true, force: true });
    }
  });

  test("projectConfigPath reviewer override skips when config only contains current runtime", async () => {
    const codexMarkers = [
      "CODEX_RUNTIME",
      "CODEX_CI",
      "CODEX_THREAD_ID",
      "CODEX_MANAGED_BY_NPM",
    ];
    const originalEnv = Object.fromEntries(
      codexMarkers.map((marker) => [marker, process.env[marker]]),
    );
    for (const marker of codexMarkers) {
      delete process.env[marker];
    }

    // Create project config with reviewer: claude and only self available.
    // This reaches config-driven reviewer selection without invoking live CLIs.
    const doDir = path.join(tempDir, ".do");
    mkdirSync(doDir);
    const projectConfig = {
      availableTools: ["claude"],
      council_reviews: { reviewer: "claude" },
    };
    writeFileSync(
      path.join(doDir, "config.json"),
      JSON.stringify(projectConfig),
    );

    // Create a minimal task file
    const taskFilePath = path.join(tempDir, "task.md");
    writeFileSync(taskFilePath, "# Test task\n");

    const projectConfigPath = path.join(doDir, "config.json");

    let result;
    try {
      result = await invokeCouncil({
        type: "plan",
        taskFile: taskFilePath,
        reviewer: "random",
        workspace: tempDir,
        timeout: 5000,
        projectConfigPath,
      });
    } finally {
      for (const marker of codexMarkers) {
        if (originalEnv[marker] === undefined) {
          delete process.env[marker];
        } else {
          process.env[marker] = originalEnv[marker];
        }
      }
    }

    // The result must be a proper object (not undefined/null)
    assert.ok(
      typeof result === "object" && result !== null,
      "result should be an object",
    );
    assert.strictEqual(result.skipped, true);
    assert.strictEqual(result.advisor, null);
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
    assert.deepStrictEqual(
      result,
      [],
      "should return empty when only current runtime is available",
    );
  });

  test("selectReviewer returns null when no reviewers available", () => {
    // Per council code review: selectRandomReviewer should return null, not hardcode 'gemini'
    const available = [];
    const result = selectReviewer("random", "claude", available);
    assert.strictEqual(
      result,
      null,
      "should return null when no reviewers available",
    );
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

// ============================================================================
// classifyFindings Tests
// ============================================================================

describe("classifyFindings", () => {
  test("all [blocker] tagged findings go to blockers, nitpicks empty", () => {
    const findings = [
      "[blocker] scope gap in Step 3",
      "[blocker] missing responsibility",
    ];
    const result = classifyFindings(findings);
    assert.deepStrictEqual(result.blockers, findings);
    assert.deepStrictEqual(result.nitpicks, []);
  });

  test("all [nitpick] tagged findings go to nitpicks, blockers empty", () => {
    const findings = [
      "[nitpick] wording fix in intro",
      "[nitpick] missing example",
    ];
    const result = classifyFindings(findings);
    assert.deepStrictEqual(result.blockers, []);
    assert.deepStrictEqual(result.nitpicks, findings);
  });

  test("mixed tagged findings split correctly", () => {
    const findings = [
      "[blocker] scope gap",
      "[nitpick] typo in Step 2",
      "[blocker] design flaw",
    ];
    const result = classifyFindings(findings);
    assert.deepStrictEqual(result.blockers, [
      "[blocker] scope gap",
      "[blocker] design flaw",
    ]);
    assert.deepStrictEqual(result.nitpicks, ["[nitpick] typo in Step 2"]);
  });

  test("untagged findings default to blockers (safe fallback)", () => {
    const findings = ["some untagged concern without tag"];
    const result = classifyFindings(findings);
    assert.deepStrictEqual(result.blockers, findings);
    assert.deepStrictEqual(result.nitpicks, []);
  });

  test("empty findings array returns both arrays empty", () => {
    const result = classifyFindings([]);
    assert.deepStrictEqual(result.blockers, []);
    assert.deepStrictEqual(result.nitpicks, []);
  });
});

// ============================================================================
// parseSelfReviewFindings Tests
// ============================================================================

describe("parseSelfReviewFindings", () => {
  test("CONCERNS format with numbered items (current do-plan-reviewer template)", () => {
    const markdown = `## PLAN SELF-REVIEW: CONCERNS

**Issues found:**
1. Clarity: Step 3 is ambiguous — "update the file" is underspecified
2. Completeness: Missing edge case for empty input

**Recommendations:**
- Clarify Step 3
- Add edge case handling
`;
    const result = parseSelfReviewFindings(markdown);
    assert.deepStrictEqual(result, [
      'Clarity: Step 3 is ambiguous — "update the file" is underspecified',
      "Completeness: Missing edge case for empty input",
    ]);
  });

  test("CONCERNS format with bulleted items (backward-compatible)", () => {
    const markdown = `## PLAN SELF-REVIEW: CONCERNS

**Issues found:**
- Clarity: vague wording in Step 2
- Risks: no mitigation for network failure

**Recommendations:**
- Fix wording
`;
    const result = parseSelfReviewFindings(markdown);
    assert.deepStrictEqual(result, [
      "Clarity: vague wording in Step 2",
      "Risks: no mitigation for network failure",
    ]);
  });

  test("RETHINK format with numbered items", () => {
    const markdown = `## PLAN SELF-REVIEW: RETHINK

**Fundamental issues:**
1. Feasibility: The referenced API does not exist

**Why this is blocking:**
Cannot proceed without a working API.

**Suggested direction:**
Use the alternative approach.
`;
    const result = parseSelfReviewFindings(markdown);
    assert.deepStrictEqual(result, [
      "Feasibility: The referenced API does not exist",
    ]);
  });

  test("RETHINK format with bulleted items", () => {
    const markdown = `## PLAN SELF-REVIEW: RETHINK

**Fundamental issues:**
- Atomicity: Three steps bundled into one

**Why this is blocking:**
Cannot be addressed incrementally.
`;
    const result = parseSelfReviewFindings(markdown);
    assert.deepStrictEqual(result, ["Atomicity: Three steps bundled into one"]);
  });

  test("CHANGES_REQUESTED format (code reviewer) with numbered items", () => {
    const markdown = `## CODE SELF-REVIEW: CHANGES_REQUESTED

**Issues requiring changes:**
1. [blocker] Correctness: \`council-invoke.cjs:45\` — incorrect return type
2. [nitpick] Quality: \`council-invoke.cjs:12\` — missing JSDoc comment

**Required changes:**
- Fix the return type
`;
    const result = parseSelfReviewFindings(markdown);
    assert.deepStrictEqual(result, [
      "[blocker] Correctness: `council-invoke.cjs:45` — incorrect return type",
      "[nitpick] Quality: `council-invoke.cjs:12` — missing JSDoc comment",
    ]);
  });

  test("PASS format (no findings section) returns empty array", () => {
    const markdown = `## PLAN SELF-REVIEW: PASS

All 5 criteria met.

**Evidence:**
- Clarity: Problem statement is specific
- Completeness: All edge cases addressed
`;
    const result = parseSelfReviewFindings(markdown);
    assert.deepStrictEqual(result, []);
  });

  test("mixed content with non-list lines in findings section", () => {
    const markdown = `## PLAN SELF-REVIEW: CONCERNS

**Issues found:**
Some introductory prose here.
1. Clarity: vague wording
Not a list item.
2. Completeness: missing step

**Recommendations:**
- Fix it
`;
    const result = parseSelfReviewFindings(markdown);
    assert.deepStrictEqual(result, [
      "Clarity: vague wording",
      "Completeness: missing step",
    ]);
  });

  test("mixed list markers within same section: some numbered, some bulleted", () => {
    const markdown = `**Issues found:**
1. Clarity: vague
- Risks: no mitigation
2. Completeness: missing

**Recommendations:**
- Fix
`;
    const result = parseSelfReviewFindings(markdown);
    assert.deepStrictEqual(result, [
      "Clarity: vague",
      "Risks: no mitigation",
      "Completeness: missing",
    ]);
  });

  test("[blocker]/[nitpick] tags are preserved in output (not stripped)", () => {
    const markdown = `**Issues found:**
1. [blocker] Clarity: scope gap in Step 3
2. [nitpick] Risks: wording could be clearer

**Recommendations:**
- Fix scope gap
`;
    const result = parseSelfReviewFindings(markdown);
    assert.ok(
      result[0].startsWith("[blocker]"),
      "blocker tag should be preserved",
    );
    assert.ok(
      result[1].startsWith("[nitpick]"),
      "nitpick tag should be preserved",
    );
  });

  // Section boundary tests (per plan Concern 6)
  test("CONCERNS with Recommendations section following: only findings extracted, recommendations excluded", () => {
    const markdown = `**Issues found:**
1. [blocker] Clarity: Step 3 ambiguous
2. [nitpick] Risks: minor wording

**Recommendations:**
- Rewrite Step 3
- Improve wording
`;
    const result = parseSelfReviewFindings(markdown);
    assert.strictEqual(result.length, 2, "should extract exactly 2 findings");
    assert.ok(result[0].includes("Clarity"), "first finding should be Clarity");
    assert.ok(result[1].includes("Risks"), "second finding should be Risks");
    assert.ok(
      !result.some((f) => f.includes("Rewrite")),
      "Recommendations items must be excluded",
    );
  });

  test("RETHINK with Why-this-is-blocking section following: only finding extracted", () => {
    const markdown = `**Fundamental issues:**
1. [blocker] Feasibility: no working API exists

**Why this is blocking:**
Cannot proceed — the API is required for all steps.
`;
    const result = parseSelfReviewFindings(markdown);
    assert.strictEqual(result.length, 1, "should extract exactly 1 finding");
    assert.ok(
      result[0].includes("Feasibility"),
      "finding should be the Feasibility issue",
    );
    assert.ok(
      !result.some((f) => f.includes("Cannot proceed")),
      "Why-blocking content must be excluded",
    );
  });

  test("CHANGES_REQUESTED with Required-changes section following: only findings extracted", () => {
    const markdown = `**Issues requiring changes:**
1. [blocker] Correctness: wrong return value at line 42
2. [nitpick] Quality: missing comment at line 10

**Required changes:**
- Fix return value
- Add comment
`;
    const result = parseSelfReviewFindings(markdown);
    assert.strictEqual(result.length, 2, "should extract exactly 2 findings");
    assert.ok(
      !result.some((f) => f.includes("Fix return")),
      "Required-changes items must be excluded",
    );
  });

  test("back-to-back bold sections with no findings: empty array", () => {
    const markdown = `**Issues found:**
**Recommendations:**
- Some recommendation
`;
    const result = parseSelfReviewFindings(markdown);
    assert.deepStrictEqual(
      result,
      [],
      "should return empty when no list items between headers",
    );
  });
});

// ============================================================================
// parseCouncilRunnerOutput Tests
// ============================================================================

describe("parseCouncilRunnerOutput", () => {
  test("standard bulleted format (canonical tightened contract)", () => {
    const agentText = `VERDICT: CONCERNS
Advisor: codex
Findings:
- [blocker] scope gap in Step 3
- [nitpick] typo in intro
Recommendations:
- Fix scope gap and typo`;
    const result = parseCouncilRunnerOutput(agentText);
    assert.deepStrictEqual(result, [
      "[blocker] scope gap in Step 3",
      "[nitpick] typo in intro",
    ]);
  });

  test("single finding with commas preserved (no comma-splitting)", () => {
    const agentText = `VERDICT: CONCERNS
Advisor: gemini
Findings:
- [blocker] scope gap in modules A, B, and C
Recommendations:
- Fix the gap`;
    const result = parseCouncilRunnerOutput(agentText);
    assert.deepStrictEqual(result, [
      "[blocker] scope gap in modules A, B, and C",
    ]);
  });

  test("empty findings section returns empty array", () => {
    const agentText = `VERDICT: LOOKS_GOOD
Advisor: codex
Findings:
Recommendations:
- No changes needed`;
    const result = parseCouncilRunnerOutput(agentText);
    assert.deepStrictEqual(result, []);
  });

  test("script-error bulleted format extracted correctly", () => {
    const agentText = `VERDICT: CONCERNS
Advisor: script-error
Findings:
- council-invoke.cjs failed -- timeout
Recommendations:
- Check script path and config, then retry`;
    const result = parseCouncilRunnerOutput(agentText);
    assert.deepStrictEqual(result, ["council-invoke.cjs failed -- timeout"]);
  });

  test("fallback — pre-contract legacy format (no bullets): entire text as single element", () => {
    const agentText = `VERDICT: CONCERNS
Advisor: codex
Findings: [blocker] scope gap, [nitpick] typo
Recommendations: fix both`;
    const result = parseCouncilRunnerOutput(agentText);
    // No bullet lines found — fallback wraps entire captured text
    assert.strictEqual(
      result.length,
      1,
      "should return single-element array for legacy format",
    );
    assert.ok(
      result[0].includes("scope gap"),
      "legacy text should be preserved",
    );
  });

  test("tags are preserved in output (not stripped by parser)", () => {
    const agentText = `VERDICT: CONCERNS
Advisor: gemini
Findings:
- [blocker] design-level issue in approach
- [nitpick] minor clarification needed
Recommendations:
- Fix design issue`;
    const result = parseCouncilRunnerOutput(agentText);
    assert.ok(
      result[0].startsWith("[blocker]"),
      "blocker tag should be preserved",
    );
    assert.ok(
      result[1].startsWith("[nitpick]"),
      "nitpick tag should be preserved",
    );
  });
});
