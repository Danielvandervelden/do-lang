"use strict";

/**
 * template-regression.test.cjs
 *
 * Golden regression test: expands every template for both platforms and
 * diffs the output byte-for-byte against the committed golden fixtures.
 *
 * This test is the primary acceptance gate and remains permanent.
 * When templates are intentionally updated, update the golden fixtures
 * in the same commit (the test failure enforces this).
 *
 * To regenerate golden fixtures:
 *   UPDATE_GOLDEN=1 node --test skills/scripts/__tests__/template-regression.test.cjs
 *
 * Run: node --test skills/scripts/__tests__/template-regression.test.cjs
 *
 * Expected behavior at Phase 2 checkpoint:
 *   - If no templates exist in skills/ or agents/, produces a clear
 *     "no template files found" failure. Test IS runnable.
 *   - Once Phase 3 templates exist, all diffs should be zero.
 */

const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..", "..");
const { expandTemplate } = require(path.join(ROOT, "bin", "expand-templates.cjs"));

const GOLDEN_DIR = path.join(ROOT, "test-fixtures", "golden");
const TEMPLATES_SKILLS_DIR = path.join(ROOT, "skills");
const TEMPLATES_AGENTS_DIR = path.join(ROOT, "agents");

const PLATFORMS = ["claude", "codex"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Recursively list .md files relative to `baseDir`.
 * Skips directories that are NOT part of the post-migration template layout:
 *   - scripts/, __tests__/ — runtime files, not templates
 *   - do/, codex/ — old pre-migration platform directories (replaced by
 *     flat template files in Phase 3)
 * @param {string} baseDir
 * @returns {string[]} Relative paths (e.g. "task.md", "references/foo.md")
 */
function listMdRelative(baseDir) {
  if (!fs.existsSync(baseDir)) return [];
  const results = [];
  // Only scan top-level .md files and allowed subdirectories (e.g. references/)
  // in the template source directory.
  const SKIP_DIRS = new Set(["scripts", "__tests__", "do", "codex"]);
  function walk(dir, rel) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const name = entry.name;
      const fullPath = path.join(dir, name);
      const relPath = rel ? `${rel}/${name}` : name;
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(name)) continue;
        walk(fullPath, relPath);
      } else if (name.endsWith(".md")) {
        results.push(relPath);
      }
    }
  }
  walk(baseDir, "");
  return results;
}

/**
 * Extract bare role name from an agent template filename.
 * Template files use bare names: "planner.md", "executioner.md", etc.
 * @param {string} filename  e.g. "planner.md"
 * @returns {string} e.g. "planner.md"
 */
function agentBareRole(filename) {
  return filename; // template files already use bare role names
}

/**
 * Map platform string to golden directory name.
 */
const PLATFORM_TO_GOLDEN = {
  claude: "claude",
  codex: "codex",
};

// ---------------------------------------------------------------------------
// Collect template files
// ---------------------------------------------------------------------------

const skillTemplates = listMdRelative(TEMPLATES_SKILLS_DIR);

// Agent templates use bare role names (e.g. "planner.md").
// Pre-migration agent files are named "do-role.md" / "codex-role.md" — skip those.
const agentTemplates = listMdRelative(TEMPLATES_AGENTS_DIR).filter(
  (rel) => !rel.startsWith("do-") && !rel.startsWith("codex-")
);

// ---------------------------------------------------------------------------
// UPDATE_GOLDEN mode: regenerate golden files instead of comparing
// ---------------------------------------------------------------------------

if (process.env.UPDATE_GOLDEN === "1") {
  console.log("UPDATE_GOLDEN mode: regenerating golden fixtures from templates...");
  let count = 0;

  for (const platform of PLATFORMS) {
    const goldenBase = path.join(GOLDEN_DIR, PLATFORM_TO_GOLDEN[platform]);

    // Skills
    for (const rel of skillTemplates) {
      const srcFile = path.join(TEMPLATES_SKILLS_DIR, rel);
      const content = fs.readFileSync(srcFile, "utf8");
      const expanded = expandTemplate(content, platform);
      const destFile = path.join(goldenBase, "skills", rel);
      fs.mkdirSync(path.dirname(destFile), { recursive: true });
      fs.writeFileSync(destFile, expanded, "utf8");
      count++;
    }

    // Agents
    for (const rel of agentTemplates) {
      const srcFile = path.join(TEMPLATES_AGENTS_DIR, rel);
      const content = fs.readFileSync(srcFile, "utf8");
      const expanded = expandTemplate(content, platform);
      const destFile = path.join(goldenBase, "agents", rel);
      fs.mkdirSync(path.dirname(destFile), { recursive: true });
      fs.writeFileSync(destFile, expanded, "utf8");
      count++;
    }
  }

  console.log(`Golden fixtures updated: ${count} files written.`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Template regression — golden fixture comparison", () => {
  it("template directories exist (Phase 3+ check)", () => {
    // This check explicitly fails if no templates have been created yet,
    // providing a clear "no templates found" signal at Phase 2 checkpoint.
    const hasSkills = skillTemplates.length > 0;
    const hasAgents = agentTemplates.length > 0;

    if (!hasSkills && !hasAgents) {
      assert.fail(
        "No template files found in skills/ or agents/. " +
          "Templates must be created in Phase 3 before this test can pass. " +
          `(skills/ contains ${skillTemplates.length} .md files, ` +
          `agents/ contains ${agentTemplates.length} .md files)`
      );
    }

    // If we get here, at least some templates exist.
    assert.ok(
      hasSkills || hasAgents,
      "At least one template directory must contain .md files"
    );
  });

  for (const platform of PLATFORMS) {
    describe(`Platform: ${platform}`, () => {
      const goldenBase = path.join(GOLDEN_DIR, PLATFORM_TO_GOLDEN[platform]);

      describe("Skill templates", () => {
        if (skillTemplates.length === 0) {
          it("(no skill templates found — Phase 3 pending)", () => {
            assert.fail(
              `No skill templates found in ${TEMPLATES_SKILLS_DIR}. ` +
                "Create templates in Phase 3."
            );
          });
          return;
        }

        for (const rel of skillTemplates) {
          it(`skills/${rel}`, () => {
            const srcFile = path.join(TEMPLATES_SKILLS_DIR, rel);
            const goldenFile = path.join(goldenBase, "skills", rel);

            assert.ok(
              fs.existsSync(srcFile),
              `Template file missing: skills/${rel}`
            );
            assert.ok(
              fs.existsSync(goldenFile),
              `Golden file missing: test-fixtures/golden/${platform}/skills/${rel} — ` +
                "run UPDATE_GOLDEN=1 npm test to regenerate"
            );

            const template = fs.readFileSync(srcFile, "utf8");
            const expected = fs.readFileSync(goldenFile, "utf8");
            const actual = expandTemplate(template, platform);

            assert.strictEqual(
              actual,
              expected,
              `Expansion mismatch for ${platform}/skills/${rel}\n` +
                `Template: ${srcFile}\n` +
                `Golden:   ${goldenFile}`
            );
          });
        }
      });

      describe("Agent templates", () => {
        if (agentTemplates.length === 0) {
          it("(no agent templates found — Phase 3 pending)", () => {
            assert.fail(
              `No agent templates found in ${TEMPLATES_AGENTS_DIR}. ` +
                "Create templates in Phase 3."
            );
          });
          return;
        }

        for (const rel of agentTemplates) {
          it(`agents/${rel}`, () => {
            const srcFile = path.join(TEMPLATES_AGENTS_DIR, rel);
            const goldenFile = path.join(goldenBase, "agents", rel);

            assert.ok(
              fs.existsSync(srcFile),
              `Template file missing: agents/${rel}`
            );
            assert.ok(
              fs.existsSync(goldenFile),
              `Golden file missing: test-fixtures/golden/${platform}/agents/${rel} — ` +
                "run UPDATE_GOLDEN=1 npm test to regenerate"
            );

            const template = fs.readFileSync(srcFile, "utf8");
            const expected = fs.readFileSync(goldenFile, "utf8");
            const actual = expandTemplate(template, platform);

            assert.strictEqual(
              actual,
              expected,
              `Expansion mismatch for ${platform}/agents/${rel}\n` +
                `Template: ${srcFile}\n` +
                `Golden:   ${goldenFile}`
            );
          });
        }
      });
    });
  }
});
