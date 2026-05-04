#!/usr/bin/env node
"use strict";

/**
 * baseline-snapshot.cjs
 *
 * Captures frozen baseline snapshots of what installClaudeCode() and installCodex()
 * produce at the current codebase state. The output JSONs serve as regression targets
 * for all future consolidation phases.
 *
 * IMPORTANT: This script stubs os.homedir() before calling install functions so that
 * files are written to a temp directory rather than the real home directory. The stub
 * is restored in a finally block regardless of success or failure. The temp directory
 * is also cleaned up in the finally block.
 *
 * Assumption: installClaudeCode() and installCodex() call os.homedir() at invocation
 * time (inside function bodies), not at module load time. If install.cjs is ever
 * refactored to cache os.homedir() at module scope, this script will silently write
 * to the wrong location. The post-install assertion guards against this.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { execSync } = require("child_process");

// __dirname = .do/projects/skill-tree-dedup/scripts/
// repo root = 4 levels up: scripts/ -> skill-tree-dedup/ -> projects/ -> .do/ -> do/
const repoRoot = path.join(__dirname, "..", "..", "..", "..");
const outputDir = path.join(__dirname, "..");
const frozenClaudeBaseline = path.join(outputDir, "baseline-claude.json");
const frozenCodexBaseline = path.join(outputDir, "baseline-codex.json");
const args = parseArgs(process.argv.slice(2));
const claudeOut = path.resolve(args.claudeOutput || frozenClaudeBaseline);
const codexOut = path.resolve(args.codexOutput || frozenCodexBaseline);

guardFrozenOutput(
  "Claude",
  claudeOut,
  frozenClaudeBaseline,
  args.allowFrozenOverwrite,
);
guardFrozenOutput(
  "Codex",
  codexOut,
  frozenCodexBaseline,
  args.allowFrozenOverwrite,
);

// Load version from package.json
const pkg = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"),
);
const version = pkg.version;

// Capture current git commit
const gitCommit = execSync("git rev-parse HEAD", {
  cwd: repoRoot,
  encoding: "utf8",
}).trim();

console.log(
  `Baseline snapshot: version=${version}, gitCommit=${gitCommit.slice(0, 8)}...`,
);

// Import install functions (safe because install.cjs exports them with require.main guard)
const { installClaudeCode, installCodex } = require(
  path.join(repoRoot, "bin", "install.cjs"),
);

// Create temp directory for captures
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "do-baseline-"));
console.log(`Temp directory: ${tempDir}`);

// Save original os.homedir before stubbing
const originalHomedir = os.homedir;

try {
  // Stub os.homedir to redirect install output to temp directory
  os.homedir = () => tempDir;

  // Create required directory stubs in temp directory
  // installClaudeCode() checks existsSync(claudeDir) and early-returns if absent
  fs.mkdirSync(path.join(tempDir, ".claude"), { recursive: true });
  // installCodex() creates directories with recursive:true, but create for symmetry
  fs.mkdirSync(path.join(tempDir, ".codex"), { recursive: true });

  // ---- Claude Code install ----
  console.log("\nRunning installClaudeCode()...");
  installClaudeCode();

  // Guard: assert Claude files were installed under temp dir, not real home
  const claudeInstallDir = path.join(tempDir, ".claude", "commands", "do");
  if (!fs.existsSync(claudeInstallDir)) {
    throw new Error(
      `installClaudeCode() did not write to temp directory. Expected: ${claudeInstallDir}. ` +
        "os.homedir() stub may not have taken effect — check if install.cjs caches homedir at module scope.",
    );
  }

  // ---- Codex install ----
  console.log("\nRunning installCodex()...");
  installCodex();

  // Guard: assert Codex files were installed under temp dir, not real home
  const codexInstallDir = path.join(tempDir, ".codex", "skills", "do");
  if (!fs.existsSync(codexInstallDir)) {
    throw new Error(
      `installCodex() did not write to temp directory. Expected: ${codexInstallDir}. ` +
        "os.homedir() stub may not have taken effect — check if install.cjs caches homedir at module scope.",
    );
  }

  // ---- Walk and hash Claude file tree ----
  console.log("\nWalking Claude file tree...");
  const claudeFiles = walkAndHash(tempDir, path.join(tempDir, ".claude"));
  console.log(`  Found ${claudeFiles.length} files under .claude/`);

  if (claudeFiles.length === 0) {
    console.error(
      "WARNING: Claude baseline is empty — installClaudeCode() may have silently early-returned.",
    );
  }

  // ---- Walk and hash Codex file tree ----
  console.log("Walking Codex file tree...");
  const codexFiles = walkAndHash(tempDir, path.join(tempDir, ".codex"));
  console.log(`  Found ${codexFiles.length} files under .codex/`);

  if (codexFiles.length === 0) {
    console.error(
      "WARNING: Codex baseline is empty — installCodex() may have silently early-returned.",
    );
  }

  // ---- Write baseline JSONs ----
  const claudeBaseline = { version, gitCommit, files: claudeFiles };
  const codexBaseline = { version, gitCommit, files: codexFiles };

  fs.mkdirSync(path.dirname(claudeOut), { recursive: true });
  fs.mkdirSync(path.dirname(codexOut), { recursive: true });

  fs.writeFileSync(
    claudeOut,
    JSON.stringify(claudeBaseline, null, 2) + "\n",
    "utf8",
  );
  fs.writeFileSync(
    codexOut,
    JSON.stringify(codexBaseline, null, 2) + "\n",
    "utf8",
  );

  console.log(`\nWrote: ${claudeOut}`);
  console.log(`Wrote: ${codexOut}`);
  console.log(`\nBaseline snapshot complete.`);
  console.log(`  Claude files: ${claudeFiles.length}`);
  console.log(`  Codex files:  ${codexFiles.length}`);
} finally {
  // Always restore os.homedir to prevent leaked state
  os.homedir = originalHomedir;

  // Always remove temp directory to prevent leftover files
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
    console.log(`\nCleaned up temp directory: ${tempDir}`);
  } catch (cleanupErr) {
    console.error(
      `Warning: failed to remove temp directory ${tempDir}: ${cleanupErr.message}`,
    );
  }
}

/**
 * Recursively walk a directory and return an array of { path, sha256 } objects.
 * Paths are relative to relativeRoot, normalized to POSIX separators, and sorted
 * alphabetically to ensure deterministic ordering across platforms.
 *
 * @param {string} relativeRoot - The root to compute relative paths from (tempDir)
 * @param {string} dir - The directory to walk
 * @returns {{ path: string, sha256: string }[]}
 */
function walkAndHash(relativeRoot, dir) {
  const results = [];

  function walk(current) {
    if (!fs.existsSync(current)) return;
    const entries = fs.readdirSync(current);
    for (const entry of entries) {
      const full = path.join(current, entry);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else {
        const relativePath = path.relative(relativeRoot, full);
        // Normalize to POSIX separators for cross-platform consistency
        const posixPath = relativePath.split(path.sep).join("/");
        const contents = fs.readFileSync(full);
        const sha256 = crypto
          .createHash("sha256")
          .update(contents)
          .digest("hex");
        results.push({ path: posixPath, sha256 });
      }
    }
  }

  walk(dir);

  // Sort alphabetically by POSIX path for deterministic ordering
  results.sort((a, b) => a.path.localeCompare(b.path));

  return results;
}

function parseArgs(argv) {
  const parsed = {
    claudeOutput: null,
    codexOutput: null,
    allowFrozenOverwrite: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") {
      printUsageAndExit(0);
    }

    if (arg === "--allow-frozen-overwrite") {
      parsed.allowFrozenOverwrite = true;
      continue;
    }

    if (arg === "--claude-output" || arg === "--codex-output") {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${arg} requires a file path argument.`);
      }
      if (arg === "--claude-output") {
        parsed.claudeOutput = value;
      } else {
        parsed.codexOutput = value;
      }
      i += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function guardFrozenOutput(label, outputPath, frozenPath, allowOverwrite) {
  if (path.resolve(outputPath) !== path.resolve(frozenPath) || allowOverwrite) {
    return;
  }

  console.error(
    `${label} output resolves to frozen baseline ${frozenPath}. ` +
      "Pass an explicit alternate output path or --allow-frozen-overwrite.",
  );
  process.exit(1);
}

function printUsageAndExit(exitCode) {
  console.log(`Usage: node .do/projects/skill-tree-dedup/scripts/baseline-snapshot.cjs [options]

Options:
  --claude-output <path>       Write Claude snapshot to this file.
  --codex-output <path>        Write Codex snapshot to this file.
  --allow-frozen-overwrite     Permit writing baseline-claude.json or baseline-codex.json.
  -h, --help                   Show this help.
`);
  process.exit(exitCode);
}
