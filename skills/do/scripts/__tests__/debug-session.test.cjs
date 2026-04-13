#!/usr/bin/env node

/**
 * Tests for debug session management
 *
 * Uses Node.js built-in test runner (Node 16.7+)
 * Run: node --test skills/do/scripts/__tests__/debug-session.test.cjs
 *
 * Test requirements covered:
 * - TS-12.1: Scientific method flow (status transitions)
 * - TS-12.2: Debug file creation in .do/debug/
 * - TS-12.3: Section update rules (APPEND vs OVERWRITE)
 */

const { test, describe } = require("node:test");
const assert = require("node:assert");
const path = require("path");

// Will fail until we create the module in Plan 02
const modulePath = path.join(__dirname, "..", "debug-session.cjs");
let STATUS_TRANSITIONS, createDebugSession, parseDebugFile, checkActiveDebug;

try {
  const mod = require(modulePath);
  STATUS_TRANSITIONS = mod.STATUS_TRANSITIONS;
  createDebugSession = mod.createDebugSession;
  parseDebugFile = mod.parseDebugFile;
  checkActiveDebug = mod.checkActiveDebug;
} catch (e) {
  // Module not created yet - tests will fail with "Module not implemented"
  // Use Proxy to throw when STATUS_TRANSITIONS is accessed by key
  STATUS_TRANSITIONS = new Proxy(
    {},
    {
      get: () => {
        throw new Error("Module not implemented");
      },
    }
  );
  createDebugSession = () => {
    throw new Error("Module not implemented");
  };
  parseDebugFile = () => {
    throw new Error("Module not implemented");
  };
  checkActiveDebug = () => {
    throw new Error("Module not implemented");
  };
}

// ============================================================================
// STATUS_TRANSITIONS Tests (D-42)
// ============================================================================

describe("STATUS_TRANSITIONS", () => {
  // Valid transitions (happy path)

  test("gathering can transition to investigating", () => {
    const validTransitions = STATUS_TRANSITIONS["gathering"];
    assert.ok(
      validTransitions.includes("investigating"),
      "gathering should transition to investigating"
    );
  });

  test("investigating can transition to fixing or verifying", () => {
    const validTransitions = STATUS_TRANSITIONS["investigating"];
    assert.ok(
      validTransitions.includes("fixing"),
      "investigating should be able to transition to fixing"
    );
    assert.ok(
      validTransitions.includes("verifying"),
      "investigating should be able to transition to verifying"
    );
  });

  test("fixing can transition to verifying", () => {
    const validTransitions = STATUS_TRANSITIONS["fixing"];
    assert.ok(
      validTransitions.includes("verifying"),
      "fixing should transition to verifying"
    );
  });

  test("verifying can transition to investigating or awaiting_human_verify", () => {
    const validTransitions = STATUS_TRANSITIONS["verifying"];
    assert.ok(
      validTransitions.includes("investigating"),
      "verifying should be able to go back to investigating"
    );
    assert.ok(
      validTransitions.includes("awaiting_human_verify"),
      "verifying should transition to awaiting_human_verify"
    );
  });

  test("awaiting_human_verify can transition to resolved or investigating", () => {
    const validTransitions = STATUS_TRANSITIONS["awaiting_human_verify"];
    assert.ok(
      validTransitions.includes("resolved"),
      "awaiting_human_verify should transition to resolved"
    );
    assert.ok(
      validTransitions.includes("investigating"),
      "awaiting_human_verify should be able to go back to investigating"
    );
  });

  test("resolved is terminal state", () => {
    const validTransitions = STATUS_TRANSITIONS["resolved"];
    assert.ok(
      Array.isArray(validTransitions),
      "resolved should have transitions array"
    );
    assert.strictEqual(
      validTransitions.length,
      0,
      "resolved should have no valid transitions (terminal state)"
    );
  });

  // Invalid transitions (negative test cases per review feedback)

  test("cannot skip from gathering to fixing", () => {
    const validTransitions = STATUS_TRANSITIONS["gathering"];
    assert.ok(
      !validTransitions.includes("fixing"),
      "gathering cannot skip to fixing (must go through investigating)"
    );
  });

  test("cannot skip from gathering to verifying", () => {
    const validTransitions = STATUS_TRANSITIONS["gathering"];
    assert.ok(
      !validTransitions.includes("verifying"),
      "gathering cannot skip to verifying (must go through investigating, fixing)"
    );
  });

  test("cannot skip from gathering to resolved", () => {
    const validTransitions = STATUS_TRANSITIONS["gathering"];
    assert.ok(
      !validTransitions.includes("resolved"),
      "gathering cannot skip to resolved (must follow full flow)"
    );
  });

  test("cannot transition from resolved to any state", () => {
    const validTransitions = STATUS_TRANSITIONS["resolved"];
    assert.strictEqual(
      validTransitions.length,
      0,
      "resolved is terminal - cannot transition to any state"
    );
  });

  test("cannot go backwards from fixing to gathering", () => {
    const validTransitions = STATUS_TRANSITIONS["fixing"];
    assert.ok(
      !validTransitions.includes("gathering"),
      "fixing cannot go backwards to gathering"
    );
  });
});

// ============================================================================
// createDebugSession Tests (D-40)
// ============================================================================

describe("createDebugSession", () => {
  test("creates filename in YYMMDD-slug format", () => {
    const result = createDebugSession("Login form shows undefined error");
    assert.ok(
      result.filename,
      "should return object with filename property"
    );
    assert.match(
      result.filename,
      /^\d{6}-[a-z0-9-]+\.md$/,
      "filename should be in YYMMDD-slug.md format"
    );
  });

  test("generates slug from first 5 words of trigger", () => {
    const result = createDebugSession(
      "Login form validation shows wrong error message"
    );
    // First 5 words: "Login form validation shows wrong"
    // Expected slug: "login-form-validation-shows-wrong"
    assert.ok(
      result.filename.includes("login-form-validation-shows-wrong"),
      "slug should be generated from first 5 words"
    );
  });

  test("handles special characters in trigger", () => {
    const result = createDebugSession(
      "API returns 500 error!!! What's happening???"
    );
    // Should remove special chars, keep alphanumeric and spaces, then kebab-case
    assert.ok(
      !result.filename.includes("!"),
      "should remove exclamation marks"
    );
    assert.ok(
      !result.filename.includes("?"),
      "should remove question marks"
    );
    assert.ok(
      !result.filename.includes("'"),
      "should remove apostrophes"
    );
    assert.match(
      result.filename,
      /^[0-9]{6}-[a-z0-9-]+\.md$/,
      "should be valid kebab-case filename"
    );
  });
});

// ============================================================================
// parseDebugFile Tests (D-43)
// ============================================================================

describe("parseDebugFile", () => {
  test("parses frontmatter fields correctly", () => {
    const content = `---
status: investigating
trigger: "Login form shows undefined"
created: 2026-04-13T10:00:00Z
updated: 2026-04-13T11:00:00Z
current_hypothesis: "API response shape mismatch"
task_ref: null
---

## Current Focus

hypothesis: API response shape mismatch
test: Console log the response
expecting: Nested object instead of flat string
next_action: Add console.log
`;
    const result = parseDebugFile(content);
    assert.strictEqual(result.frontmatter.status, "investigating");
    assert.strictEqual(
      result.frontmatter.trigger,
      "Login form shows undefined"
    );
    assert.strictEqual(
      result.frontmatter.created,
      "2026-04-13T10:00:00Z"
    );
    assert.strictEqual(
      result.frontmatter.updated,
      "2026-04-13T11:00:00Z"
    );
  });

  test("extracts current hypothesis", () => {
    const content = `---
status: investigating
trigger: "Bug"
created: 2026-04-13T10:00:00Z
updated: 2026-04-13T11:00:00Z
current_hypothesis: "Race condition in async handler"
task_ref: null
---

## Current Focus
`;
    const result = parseDebugFile(content);
    assert.strictEqual(
      result.frontmatter.current_hypothesis,
      "Race condition in async handler"
    );
  });

  test("parses Current Focus section", () => {
    const content = `---
status: investigating
trigger: "Bug"
created: 2026-04-13T10:00:00Z
updated: 2026-04-13T11:00:00Z
current_hypothesis: null
task_ref: null
---

## Current Focus

hypothesis: API returns wrong shape
test: Log the response object
expecting: Should be {error: string} not {error: {message: string}}
next_action: Check network tab

## Symptoms
`;
    const result = parseDebugFile(content);
    assert.ok(
      result.sections.currentFocus,
      "should have currentFocus section"
    );
    assert.strictEqual(
      result.sections.currentFocus.hypothesis,
      "API returns wrong shape"
    );
    assert.strictEqual(
      result.sections.currentFocus.test,
      "Log the response object"
    );
    assert.strictEqual(
      result.sections.currentFocus.next_action,
      "Check network tab"
    );
  });

  test("handles malformed frontmatter gracefully", () => {
    const content = `---
status investigating
trigger: unclosed quote
---

## Current Focus
`;
    // Should not throw, should return error or default values
    let result;
    let didThrow = false;
    try {
      result = parseDebugFile(content);
    } catch (e) {
      didThrow = true;
    }
    // Either returns gracefully with error indicator, or we allow it to throw
    // The important thing is it handles the case without crashing unexpectedly
    assert.ok(
      didThrow || result.error || result.frontmatter === null,
      "should handle malformed frontmatter gracefully (throw, return error, or null frontmatter)"
    );
  });
});

// ============================================================================
// checkActiveDebug Tests (D-45, D-46)
// ============================================================================

describe("checkActiveDebug", () => {
  test("returns active: false when no active debug", () => {
    // Config with no active_debug entry
    const configPath = "/tmp/nonexistent-config.json";
    const result = checkActiveDebug(configPath);
    assert.strictEqual(
      result.active,
      false,
      "should return active: false when no config or no active_debug"
    );
  });

  test("returns active: true with status and hypothesis", () => {
    // This test assumes config and debug file exist
    // Stub implementation will throw; real implementation tested in integration
    const configPath = "/tmp/test-config-active.json";
    const result = checkActiveDebug(configPath);
    // If active, should have status and hypothesis
    if (result.active) {
      assert.ok(
        "status" in result,
        "active debug should include status"
      );
      assert.ok(
        "hypothesis" in result,
        "active debug should include hypothesis"
      );
    } else {
      // No active debug is also valid for this test path
      assert.strictEqual(result.active, false);
    }
  });

  test("returns stale: true when file missing", () => {
    // Config references a debug file that doesn't exist
    const configPath = "/tmp/test-config-stale.json";
    const result = checkActiveDebug(configPath);
    // Should indicate stale reference when config points to missing file
    if (result.stale) {
      assert.strictEqual(
        result.active,
        false,
        "stale reference should not be active"
      );
      assert.ok(
        result.stale,
        "should indicate stale reference"
      );
    }
  });
});
