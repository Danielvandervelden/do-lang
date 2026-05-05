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
let extractKeywords,
  findMatchingDocs,
  findMatchingDocsByKeywordConfig,
  getMdFiles,
  keywordMatchesDescription,
  loadTaskContext;

try {
  const mod = require(modulePath);
  extractKeywords = mod.extractKeywords;
  findMatchingDocs = mod.findMatchingDocs;
  findMatchingDocsByKeywordConfig = mod.findMatchingDocsByKeywordConfig;
  getMdFiles = mod.getMdFiles;
  keywordMatchesDescription = mod.keywordMatchesDescription;
  loadTaskContext = mod.loadTaskContext;
} catch (e) {
  // Module not created yet - tests will fail
  extractKeywords = () => {
    throw new Error("Module not implemented");
  };
  findMatchingDocs = () => {
    throw new Error("Module not implemented");
  };
  findMatchingDocsByKeywordConfig = () => {
    throw new Error("Module not implemented");
  };
  getMdFiles = () => {
    throw new Error("Module not implemented");
  };
  keywordMatchesDescription = () => {
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

// ---------------------------------------------------------------------------
// keywordMatchesDescription
// ---------------------------------------------------------------------------

describe("keywordMatchesDescription", () => {
  test("compound/hyphenated terms use phrase match", () => {
    assert.ok(
      keywordMatchesDescription("react-hook-form", "fix the react-hook-form validation"),
      "should match hyphenated term via phrase match",
    );
    assert.ok(
      !keywordMatchesDescription("react-hook-form", "fix the redux form"),
      "should not match when term absent",
    );
  });

  test("simple terms use word-boundary match — no substring false positives", () => {
    assert.ok(
      !keywordMatchesDescription("api", "fix the capital layout"),
      '"api" should not match inside "capital"',
    );
    assert.ok(
      keywordMatchesDescription("api", "fix the api layer"),
      '"api" should match as standalone word',
    );
    assert.ok(
      !keywordMatchesDescription("query", "fix the jQuery component"),
      '"query" should not match inside "jQuery"',
    );
    assert.ok(
      keywordMatchesDescription("query", "add a new query endpoint"),
      '"query" should match as standalone word',
    );
  });

  test("camelCase identifiers use word-boundary match", () => {
    assert.ok(
      keywordMatchesDescription("useSelector", "update the useSelector call in fleet page"),
      "useSelector should match",
    );
    assert.ok(
      keywordMatchesDescription("useForm", "replace useForm with react-hook-form"),
      "useForm should match",
    );
  });

  test("keywords with regex metacharacters are escaped and do not throw", () => {
    assert.doesNotThrow(() => {
      keywordMatchesDescription("c++", "add c++ support");
    }, "should not throw for c++");
    assert.doesNotThrow(() => {
      keywordMatchesDescription("@scope/pkg", "install @scope/pkg");
    }, "should not throw for @scope/pkg");
    assert.doesNotThrow(() => {
      keywordMatchesDescription("*.config", "update *.config files");
    }, "should not throw for *.config");
  });
});

// ---------------------------------------------------------------------------
// getMdFiles — deterministic ordering
// ---------------------------------------------------------------------------

describe("getMdFiles", () => {
  const os = require("os");
  const fs = require("fs");

  test("returns files in sorted order", () => {
    const tmpDir = path.join(os.tmpdir(), `getMdFiles-test-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    // Create files in non-alphabetical order
    fs.writeFileSync(path.join(tmpDir, "zebra.md"), "z");
    fs.writeFileSync(path.join(tmpDir, "alpha.md"), "a");
    fs.writeFileSync(path.join(tmpDir, "mango.md"), "m");
    fs.writeFileSync(path.join(tmpDir, "beta.md"), "b");

    const result = getMdFiles(tmpDir);
    const names = result.map((p) => path.basename(p));
    assert.deepStrictEqual(
      names,
      ["alpha.md", "beta.md", "mango.md", "zebra.md"],
      "files should be sorted alphabetically",
    );

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("returns empty array for non-existent directory", () => {
    const result = getMdFiles("/nonexistent/path/xyz");
    assert.deepStrictEqual(result, []);
  });
});

// ---------------------------------------------------------------------------
// findMatchingDocsByKeywordConfig
// ---------------------------------------------------------------------------

describe("findMatchingDocsByKeywordConfig", () => {
  const os = require("os");
  const fs = require("fs");

  /**
   * Set up a temporary database with tech/ and components/ subdirs
   */
  function setupTempDatabase(fileMap) {
    const dbPath = path.join(os.tmpdir(), `db-test-${Date.now()}`);
    for (const [relPath, content] of Object.entries(fileMap)) {
      const fullPath = path.join(dbPath, relPath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content);
    }
    return dbPath;
  }

  test("matches camelCase keyword to doc stem", () => {
    const dbPath = setupTempDatabase({
      "tech/store-state.md": "Redux store conventions",
    });
    const config = { "store-state": ["useSelector", "useDispatch", "redux"] };
    const result = findMatchingDocsByKeywordConfig(
      dbPath,
      config,
      "update the useSelector call in the fleet page",
    );
    assert.strictEqual(result.length, 1, "should match one doc");
    assert.ok(
      result[0].endsWith("store-state.md"),
      "should match store-state.md",
    );
    fs.rmSync(dbPath, { recursive: true, force: true });
  });

  test("matches compound/hyphenated keyword to doc stem", () => {
    const dbPath = setupTempDatabase({
      "tech/forms.md": "Form conventions",
    });
    const config = {
      forms: ["useForm", "react-hook-form", "validation", "zod"],
    };
    const result = findMatchingDocsByKeywordConfig(
      dbPath,
      config,
      "migrate the login form to react-hook-form",
    );
    assert.strictEqual(result.length, 1, "should match one doc");
    assert.ok(result[0].endsWith("forms.md"), "should match forms.md");
    fs.rmSync(dbPath, { recursive: true, force: true });
  });

  test("does not produce false positives from substring matches for simple terms", () => {
    const dbPath = setupTempDatabase({
      "tech/api-layer.md": "API conventions",
    });
    const config = { "api-layer": ["api", "query", "endpoint"] };
    // "capital" contains "api" as substring — must NOT match
    const result = findMatchingDocsByKeywordConfig(
      dbPath,
      config,
      "update the capital layout component",
    );
    assert.strictEqual(result.length, 0, "should not false-positive on 'capital'");
    fs.rmSync(dbPath, { recursive: true, force: true });
  });

  test("matches simple term as standalone word", () => {
    const dbPath = setupTempDatabase({
      "tech/api-layer.md": "API conventions",
    });
    const config = { "api-layer": ["api", "query", "endpoint"] };
    const result = findMatchingDocsByKeywordConfig(
      dbPath,
      config,
      "fix the api layer timeout",
    );
    assert.strictEqual(result.length, 1, "should match api as standalone word");
    fs.rmSync(dbPath, { recursive: true, force: true });
  });

  test("config keywords produce deterministic results — stems sorted alphabetically", () => {
    const dbPath = setupTempDatabase({
      "tech/store-state.md": "Redux",
      "tech/forms.md": "Forms",
    });
    // Both stems match the description
    const config = {
      "store-state": ["useSelector"],
      forms: ["useForm"],
    };
    const result = findMatchingDocsByKeywordConfig(
      dbPath,
      config,
      "update useSelector and useForm in the fleet page",
    );
    assert.strictEqual(result.length, 2, "should match two docs");
    // Stems are sorted alphabetically: "forms" < "store-state"
    assert.ok(result[0].endsWith("forms.md"), "forms should come first (alphabetical)");
    assert.ok(result[1].endsWith("store-state.md"), "store-state should come second");
    fs.rmSync(dbPath, { recursive: true, force: true });
  });

  test("deduplicates docs when same stem appears in multiple subdirs", () => {
    const dbPath = setupTempDatabase({
      "tech/forms.md": "Tech forms",
      "components/forms.md": "Component forms",
    });
    const config = { forms: ["useForm"] };
    const result = findMatchingDocsByKeywordConfig(
      dbPath,
      config,
      "fix useForm validation",
    );
    // Should include both (both stems match), but no duplicate paths
    const uniquePaths = [...new Set(result)];
    assert.strictEqual(result.length, uniquePaths.length, "no duplicate paths");
    fs.rmSync(dbPath, { recursive: true, force: true });
  });

  test("returns empty array when config has no matching keywords", () => {
    const dbPath = setupTempDatabase({
      "tech/store-state.md": "Redux",
    });
    const config = { "store-state": ["useSelector", "useDispatch"] };
    const result = findMatchingDocsByKeywordConfig(
      dbPath,
      config,
      "fix the login form validation",
    );
    assert.strictEqual(result.length, 0, "should not match unrelated description");
    fs.rmSync(dbPath, { recursive: true, force: true });
  });

  test("returns empty array when contextKeywords is null or empty", () => {
    const dbPath = setupTempDatabase({
      "tech/store-state.md": "Redux",
    });
    assert.deepStrictEqual(
      findMatchingDocsByKeywordConfig(dbPath, null, "update useSelector"),
      [],
      "null config returns empty array",
    );
    assert.deepStrictEqual(
      findMatchingDocsByKeywordConfig(dbPath, {}, "update useSelector"),
      [],
      "empty config returns empty array",
    );
    fs.rmSync(dbPath, { recursive: true, force: true });
  });

  test("keywords with regex metacharacters do not throw", () => {
    const dbPath = setupTempDatabase({
      "tech/cpp.md": "C++ conventions",
    });
    const config = { cpp: ["c++", "@scope/pkg"] };
    assert.doesNotThrow(() => {
      findMatchingDocsByKeywordConfig(dbPath, config, "add c++ support");
    }, "should not throw for keywords with metacharacters");
    fs.rmSync(dbPath, { recursive: true, force: true });
  });
});
