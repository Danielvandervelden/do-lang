#!/usr/bin/env node

/**
 * Council Invocation Script
 *
 * Provides council review functionality for the /do:task workflow.
 * Handles advisor selection, runtime detection, process spawning,
 * output capture, and verdict parsing.
 *
 * Usage:
 *   node council-invoke.cjs --type plan|code --task-file <path> [--reviewer <value>] [--workspace <path>]
 *
 * Exit codes:
 *   0 - Success
 *   1 - Error
 *
 * @module council-invoke
 */

const { spawn, execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

// Constants
const PLUGIN_ROOT = path.join(
  process.env.HOME,
  ".claude/plugins/cache/openai-codex/codex/1.0.1"
);
const CODEX_COMPANION = path.join(PLUGIN_ROOT, "scripts/codex-companion.mjs");
const DEFAULT_TIMEOUT = 90000; // 90 seconds per RESEARCH.md
const GEMINI_MAX_RETRIES = 2;

// Valid verdicts for each review type
const PLAN_VERDICTS = ["LOOKS_GOOD", "CONCERNS", "RETHINK"];
const CODE_VERDICTS = ["APPROVED", "NITPICKS_ONLY", "CHANGES_REQUESTED"];
const ALL_VERDICTS = [...PLAN_VERDICTS, ...CODE_VERDICTS];

// Valid reviewer options (per D-39)
const VALID_REVIEWERS = ["claude", "codex", "gemini", "random", "both"];

/**
 * Detect which runtime we're in (per D-40)
 * @returns {'claude'|'codex'} Current runtime
 */
function detectRuntime() {
  return process.env.CODEX_RUNTIME ? "codex" : "claude";
}

/**
 * Get available reviewers for the current runtime (per D-42)
 * @param {string} currentRuntime - 'claude' or 'codex'
 * @returns {string[]} Available reviewer options
 */
function getAvailableReviewers(currentRuntime) {
  if (currentRuntime === "claude") {
    // In Claude runtime: Codex and Gemini available
    return ["codex", "gemini"];
  } else if (currentRuntime === "codex") {
    // In Codex runtime: Claude and Gemini available
    return ["claude", "gemini"];
  }
  // Fallback
  return ["codex", "gemini"];
}

/**
 * Select a random reviewer using Python (per D-41)
 * @param {string[]} available - Available reviewer options
 * @returns {string} Selected reviewer
 */
function selectRandomReviewer(available) {
  if (available.length === 0) {
    return "gemini"; // Fallback
  }
  if (available.length === 1) {
    return available[0];
  }

  try {
    // Per D-41: use Python for random selection
    // Format as Python list with single quotes
    const pyList = "[" + available.map((s) => `'${s}'`).join(",") + "]";
    const pythonCmd = `python3 -c "import random; print(random.choice(${pyList}))"`;
    const result = execSync(pythonCmd, { encoding: "utf-8" }).trim();
    if (available.includes(result)) {
      return result;
    }
  } catch {
    // Python fallback failed, use JS random
  }

  // JavaScript fallback
  const idx = Math.floor(Math.random() * available.length);
  return available[idx];
}

/**
 * Select reviewer based on configuration and runtime (per D-39, D-40, D-41, D-42)
 * @param {string} configured - Configured reviewer value
 * @param {string} currentRuntime - Current runtime ('claude' or 'codex')
 * @returns {string} Selected reviewer
 */
function selectReviewer(configured, currentRuntime) {
  const available = getAvailableReviewers(currentRuntime);

  // 'both' is always valid
  if (configured === "both") {
    return "both";
  }

  // 'random' selects randomly from available
  if (configured === "random") {
    return selectRandomReviewer(available);
  }

  // Self-review prevention (per D-40)
  if (configured === currentRuntime) {
    // Fall back to random since configured reviewer is self
    return selectRandomReviewer(available);
  }

  // Check if configured reviewer is available
  if (available.includes(configured)) {
    return configured;
  }

  // Invalid or unavailable reviewer - fall back to random
  return selectRandomReviewer(available);
}

/**
 * Parse verdict from advisor response (per RESEARCH.md)
 * @param {string} response - Advisor response text
 * @param {string} type - Review type: 'plan' or 'code'
 * @returns {string} Extracted verdict
 */
function parseVerdict(response, type = "plan") {
  if (!response) {
    return type === "code" ? "CHANGES_REQUESTED" : "CONCERNS";
  }

  // Try structured format first: ### Verdict\n<VERDICT>
  const verdictMatch = response.match(/###\s*Verdict\s*\n+(\w+)/i);
  if (verdictMatch) {
    const verdict = verdictMatch[1].toUpperCase();
    if (ALL_VERDICTS.includes(verdict)) {
      return verdict;
    }
  }

  // Sentiment fallback - depends on review type
  const lower = response.toLowerCase();

  if (type === "code") {
    // Code review verdicts: APPROVED, NITPICKS_ONLY, CHANGES_REQUESTED
    if (
      lower.includes("approved") ||
      lower.includes("lgtm") ||
      lower.includes("ship it")
    ) {
      return "APPROVED";
    }
    if (
      lower.includes("nitpick") ||
      lower.includes("minor") ||
      lower.includes("style only")
    ) {
      return "NITPICKS_ONLY";
    }
    // Default to cautious for code reviews
    return "CHANGES_REQUESTED";
  }

  // Plan review verdicts: LOOKS_GOOD, CONCERNS, RETHINK
  if (
    lower.includes("rethink") ||
    lower.includes("fundamentally") ||
    lower.includes("wrong approach")
  ) {
    return "RETHINK";
  }
  if (
    lower.includes("looks good") ||
    lower.includes("solid") ||
    lower.includes("well-structured")
  ) {
    return "LOOKS_GOOD";
  }

  // Default to cautious for plan reviews
  return "CONCERNS";
}

/**
 * Parse findings from advisor response
 * @param {string} response - Advisor response text
 * @returns {string[]} Extracted findings
 */
function parseFindings(response) {
  const findings = [];

  // Try to extract from "### Key Findings" section
  const findingsMatch = response.match(
    /###\s*Key Findings\s*\n([\s\S]*?)(?=\n###|\n##|$)/i
  );
  if (findingsMatch) {
    const lines = findingsMatch[1].split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
        findings.push(trimmed.slice(1).trim());
      }
    }
  }

  return findings;
}

/**
 * Parse recommendations from advisor response
 * @param {string} response - Advisor response text
 * @returns {string[]} Extracted recommendations
 */
function parseRecommendations(response) {
  const recommendations = [];

  // Try to extract from "### Recommendations" section
  const recsMatch = response.match(
    /###\s*Recommendations\s*\n([\s\S]*?)(?=\n###|\n##|$)/i
  );
  if (recsMatch) {
    const lines = recsMatch[1].split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
        recommendations.push(trimmed.slice(1).trim());
      }
    }
  }

  return recommendations;
}

/**
 * Invoke Codex via companion script (per RESEARCH.md)
 * @param {string} briefPath - Path to briefing file
 * @param {number} timeout - Timeout in milliseconds
 * @param {string} reviewType - Review type: 'plan' or 'code'
 * @returns {Promise<Object>} Invocation result
 */
async function invokeCodex(briefPath, timeout = DEFAULT_TIMEOUT, reviewType = "plan") {
  return new Promise((resolve) => {
    // Check if companion script exists
    if (!fs.existsSync(CODEX_COMPANION)) {
      resolve({
        success: false,
        error: `Codex companion script not found at ${CODEX_COMPANION}`,
        output: "",
      });
      return;
    }

    const proc = spawn(
      "node",
      [CODEX_COMPANION, "task", "--wait", "--prompt-file", briefPath],
      { stdio: ["inherit", "pipe", "pipe"] }
    );

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d));
    proc.stderr.on("data", (d) => (stderr += d));

    const timer = setTimeout(() => {
      proc.kill();
      resolve({ success: false, error: "Timeout", output: "" });
    }, timeout);

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0 && stdout.trim()) {
        resolve({
          success: true,
          output: stdout,
          verdict: parseVerdict(stdout, reviewType),
          findings: parseFindings(stdout),
          recommendations: parseRecommendations(stdout),
        });
      } else {
        resolve({
          success: false,
          error: stderr || "Empty output",
          output: stdout,
        });
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      resolve({ success: false, error: err.message, output: "" });
    });
  });
}

/**
 * Run Gemini once (internal helper)
 * @param {string} briefPath - Path to briefing file
 * @param {string} workspace - Workspace path
 * @param {number} timeout - Timeout in milliseconds
 * @param {string} reviewType - Review type: 'plan' or 'code'
 * @returns {Promise<Object>} Invocation result
 */
async function runGeminiOnce(briefPath, workspace, timeout, reviewType = "plan") {
  return new Promise((resolve) => {
    // Read brief content
    let briefContent;
    try {
      briefContent = fs.readFileSync(briefPath, "utf-8");
    } catch (err) {
      resolve({ success: false, error: `Failed to read brief: ${err.message}`, output: "" });
      return;
    }

    // Spawn gemini with stdin pipe
    const proc = spawn(
      "gemini",
      [
        "--prompt",
        "-",
        "--include-directories",
        workspace,
        "--approval-mode",
        "plan",
        "-o",
        "text",
      ],
      { stdio: ["pipe", "pipe", "pipe"] }
    );

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d));
    proc.stderr.on("data", (d) => (stderr += d));

    // Write brief to stdin
    proc.stdin.write(briefContent);
    proc.stdin.end();

    const timer = setTimeout(() => {
      proc.kill();
      resolve({ success: false, error: "Timeout", output: "" });
    }, timeout);

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0 && stdout.trim()) {
        resolve({
          success: true,
          output: stdout,
          verdict: parseVerdict(stdout, reviewType),
          findings: parseFindings(stdout),
          recommendations: parseRecommendations(stdout),
        });
      } else {
        resolve({
          success: false,
          error: stderr || "Empty output",
          output: stdout,
        });
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      resolve({ success: false, error: err.message, output: "" });
    });
  });
}

/**
 * Invoke Gemini with retry (per RESEARCH.md pitfall 3)
 * @param {string} briefPath - Path to briefing file
 * @param {string} workspace - Workspace path
 * @param {number} timeout - Timeout in milliseconds
 * @param {string} reviewType - Review type: 'plan' or 'code'
 * @returns {Promise<Object>} Invocation result
 */
async function invokeGemini(briefPath, workspace, timeout = DEFAULT_TIMEOUT, reviewType = "plan") {
  for (let attempt = 0; attempt <= GEMINI_MAX_RETRIES; attempt++) {
    const result = await runGeminiOnce(briefPath, workspace, timeout, reviewType);
    if (result.success) return result;

    // Check for rate limit
    if (
      result.error.includes("429") ||
      result.error.toLowerCase().includes("rate")
    ) {
      const backoff = 5000 * Math.pow(2, attempt); // 5s, 10s
      await new Promise((r) => setTimeout(r, backoff));
      continue;
    }
    return result; // Non-retryable error
  }
  return { success: false, error: "Max retries exceeded", output: "" };
}

/**
 * Run both available advisors in parallel (per D-43, D-42)
 * Runtime-aware: excludes current runtime from advisors to prevent self-review
 * @param {string} briefPath - Path to briefing file
 * @param {string} workspace - Workspace path
 * @param {number} timeout - Timeout in milliseconds
 * @param {string} reviewType - Review type: 'plan' or 'code'
 * @returns {Promise<Object>} Combined result
 */
async function invokeBoth(briefPath, workspace, timeout = DEFAULT_TIMEOUT, reviewType = "plan") {
  const currentRuntime = detectRuntime();

  // Per D-42: In Claude Code, use Codex + Gemini. In Codex runtime, use Claude + Gemini.
  // Claude-as-reviewer deferred to Phase 12, so for now always use Codex + Gemini
  // but skip Codex if we're in Codex runtime (use Gemini only)
  let advisorPromises;
  let advisorNames;

  if (currentRuntime === "codex") {
    // In Codex runtime: only Gemini available (Claude support deferred to Phase 12)
    advisorPromises = [invokeGemini(briefPath, workspace, timeout, reviewType)];
    advisorNames = ["gemini"];
  } else {
    // In Claude Code runtime: Codex + Gemini
    advisorPromises = [
      invokeCodex(briefPath, timeout, reviewType),
      invokeGemini(briefPath, workspace, timeout, reviewType),
    ];
    advisorNames = ["codex", "gemini"];
  }

  const results = await Promise.allSettled(advisorPromises);

  const codexResult = advisorNames.includes("codex") ? results[0] : null;
  const geminiResult = advisorNames.includes("codex") ? results[1] : results[0];

  const codex = codexResult
    ? codexResult.status === "fulfilled"
      ? codexResult.value
      : { success: false, error: codexResult.reason }
    : null;
  const gemini =
    geminiResult.status === "fulfilled"
      ? geminiResult.value
      : { success: false, error: geminiResult.reason };

  // Synthesize results
  const verdicts = [];
  if (codex && codex.success) verdicts.push(codex.verdict);
  if (gemini.success) verdicts.push(gemini.verdict);

  // Determine combined verdict
  let combinedVerdict = "CONCERNS"; // Default
  if (verdicts.length === 2) {
    if (verdicts[0] === verdicts[1]) {
      // Agreement
      combinedVerdict = verdicts[0];
    } else {
      // Disagreement - use more cautious verdict
      const cautionOrder = ["RETHINK", "CHANGES_REQUESTED", "CONCERNS", "NITPICKS_ONLY", "LOOKS_GOOD", "APPROVED"];
      combinedVerdict = verdicts.sort(
        (a, b) => cautionOrder.indexOf(a) - cautionOrder.indexOf(b)
      )[0];
    }
  } else if (verdicts.length === 1) {
    combinedVerdict = verdicts[0];
  }

  // Combine findings and recommendations
  const allFindings = [...(codex.findings || []), ...(gemini.findings || [])];
  const allRecs = [
    ...(codex.recommendations || []),
    ...(gemini.recommendations || []),
  ];

  return {
    success: codex.success || gemini.success,
    advisor: "both",
    verdict: combinedVerdict,
    findings: allFindings,
    recommendations: allRecs,
    raw: { codex, gemini },
  };
}

/**
 * Main council invocation entry point
 * @param {Object} options - Invocation options
 * @param {string} options.type - Review type ('plan' or 'code')
 * @param {string} options.taskFile - Path to task markdown file
 * @param {string} options.reviewer - Configured reviewer value
 * @param {string} options.workspace - Workspace path
 * @param {number} options.timeout - Timeout in milliseconds
 * @returns {Promise<Object>} Council result
 */
async function invokeCouncil(options) {
  const {
    type,
    taskFile,
    reviewer = "random",
    workspace = process.cwd(),
    filesModified = "",
    timeout = DEFAULT_TIMEOUT,
  } = options;

  // Validate type
  if (!["plan", "code"].includes(type)) {
    return { success: false, error: `Invalid review type: ${type}`, advisor: null };
  }

  // Validate task file exists
  if (!fs.existsSync(taskFile)) {
    return { success: false, error: `Task file not found: ${taskFile}`, advisor: null };
  }

  // Detect runtime and select reviewer
  const currentRuntime = detectRuntime();
  const selectedReviewer = selectReviewer(reviewer, currentRuntime);

  // Select template based on review type
  const templateFile =
    type === "plan"
      ? path.join(__dirname, "../references/council-brief-plan.md")
      : path.join(__dirname, "../references/council-brief-code.md");

  // Create briefing file from template
  let briefPath = taskFile; // Fallback to task file if template not found
  if (fs.existsSync(templateFile)) {
    const template = fs.readFileSync(templateFile, "utf8");
    const taskContent = fs.readFileSync(taskFile, "utf8");

    // Replace placeholders in template
    const brief = template
      .replace(/\{\{TASK_FILE\}\}/g, taskFile)
      .replace(/\{\{TASK_CONTENT\}\}/g, taskContent)
      .replace(/\{\{WORKSPACE\}\}/g, workspace)
      .replace(/\{\{FILES_MODIFIED\}\}/g, filesModified || "Not specified")
      .replace(/\{\{REVIEW_TYPE\}\}/g, type);

    // Write to temp file
    briefPath = path.join(os.tmpdir(), `council-brief-${Date.now()}.md`);
    fs.writeFileSync(briefPath, brief, "utf8");
  }

  // Invoke selected advisor(s)
  let result;
  switch (selectedReviewer) {
    case "codex":
      result = await invokeCodex(briefPath, timeout, type);
      result.advisor = "codex";
      break;
    case "gemini":
      result = await invokeGemini(briefPath, workspace, timeout, type);
      result.advisor = "gemini";
      break;
    case "claude":
      // Claude-as-reviewer only valid in Codex runtime (Phase 12)
      // For now, fall back to gemini
      result = await invokeGemini(briefPath, workspace, timeout, type);
      result.advisor = "gemini";
      break;
    case "both":
      result = await invokeBoth(briefPath, workspace, timeout, type);
      break;
    default:
      return { success: false, error: `Unknown reviewer: ${selectedReviewer}`, advisor: null };
  }

  // Clean up temp brief file if we created one
  if (briefPath !== taskFile && fs.existsSync(briefPath)) {
    fs.unlinkSync(briefPath);
  }

  return result;
}

// CLI handling
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Council Invocation

Usage: node council-invoke.cjs --type plan|code --task-file <path> [options]

Options:
  --type <plan|code>       Review type (required)
  --task-file <path>       Path to task markdown file (required)
  --reviewer <value>       Reviewer selection (default: random)
                           Values: claude, codex, gemini, random, both
  --workspace <path>       Workspace path for Gemini (default: cwd)
  --files-modified <list>  Comma-separated list of modified files (for code reviews)
  --timeout <ms>           Timeout in milliseconds (default: 90000)
  --help, -h               Show this help message

Examples:
  node council-invoke.cjs --type plan --task-file .do/tasks/my-task.md
  node council-invoke.cjs --type code --task-file .do/tasks/my-task.md --reviewer codex
  node council-invoke.cjs --type code --task-file .do/tasks/my-task.md --files-modified "src/a.js,src/b.js"
`);
    process.exit(0);
  }

  // Parse arguments
  const getArg = (name) => {
    const idx = args.indexOf(name);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
  };

  const type = getArg("--type");
  const taskFile = getArg("--task-file");
  const reviewer = getArg("--reviewer") || "random";
  const workspace = getArg("--workspace") || process.cwd();
  const filesModified = getArg("--files-modified");
  const timeout = parseInt(getArg("--timeout") || DEFAULT_TIMEOUT, 10);

  if (!type || !taskFile) {
    console.error(
      JSON.stringify({ error: "--type and --task-file are required" })
    );
    process.exit(1);
  }

  invokeCouncil({ type, taskFile, reviewer, workspace, filesModified, timeout })
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    })
    .catch((err) => {
      console.error(JSON.stringify({ error: err.message }));
      process.exit(1);
    });
}

// Export for programmatic use and testing
module.exports = {
  detectRuntime,
  selectReviewer,
  parseVerdict,
  parseFindings,
  parseRecommendations,
  invokeCodex,
  invokeGemini,
  invokeBoth,
  invokeCouncil,
  getAvailableReviewers,
  selectRandomReviewer,
  PLUGIN_ROOT,
  CODEX_COMPANION,
  DEFAULT_TIMEOUT,
  GEMINI_MAX_RETRIES,
  VALID_REVIEWERS,
  PLAN_VERDICTS,
  CODE_VERDICTS,
  ALL_VERDICTS,
};
