#!/usr/bin/env node

/**
 * Council Invocation Script
 *
 * Provides council review functionality for the /do:task workflow.
 * Handles advisor selection, runtime detection, process spawning,
 * output capture, and verdict parsing.
 *
 * Usage:
 *   node council-invoke.cjs --type plan|code --task-file <path> [--reviewer <value>] [--workspace <path>] [--project-config-path <path>]
 *
 * Exit codes:
 *   0 - Success
 *   1 - Error
 *
 * @module council-invoke
 */

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

// Constants
const versionDir = path.join(
  os.homedir(),
  ".claude/plugins/cache/openai-codex/codex/",
);
let codexVersion = "1.0.1"; // fallback
try {
  const versions = fs
    .readdirSync(versionDir)
    .filter((d) => /^\d+\.\d+\.\d+$/.test(d))
    .sort((a, b) => {
      const pa = a.split(".").map(Number);
      const pb = b.split(".").map(Number);
      for (let i = 0; i < 3; i++) {
        if (pa[i] !== pb[i]) return pa[i] - pb[i];
      }
      return 0;
    });
  if (versions.length) codexVersion = versions[versions.length - 1];
} catch {
  /* directory doesn't exist, use fallback */
}
const PLUGIN_ROOT = path.join(versionDir, codexVersion);
const CODEX_COMPANION = path.join(PLUGIN_ROOT, "scripts/codex-companion.mjs");
const DEFAULT_TIMEOUT = 240000; // 240 seconds
const GEMINI_MAX_RETRIES = 2;

// Valid verdicts for each review type
const PLAN_VERDICTS = ["LOOKS_GOOD", "CONCERNS", "RETHINK"];
const CODE_VERDICTS = ["APPROVED", "NITPICKS_ONLY", "CHANGES_REQUESTED"];
const ALL_VERDICTS = [...PLAN_VERDICTS, ...CODE_VERDICTS];

// Valid reviewer options (per D-39)
const VALID_REVIEWERS = ["claude", "codex", "gemini", "random", "both"];

// ============================================================================
// Workspace Config Functions (D-49, D-54, D-55, D-56)
// ============================================================================

/**
 * Find workspace config by traversing up from start path
 * Per D-56: supports running from project subdirectories
 * @param {string} startPath - Starting directory
 * @returns {string|null} Path to .do-workspace.json or null
 */
function findWorkspaceConfig(startPath) {
  let current = path.resolve(startPath);
  const root = path.parse(current).root;

  while (current !== root) {
    const configPath = path.join(current, ".do-workspace.json");
    if (fs.existsSync(configPath)) {
      return configPath;
    }
    current = path.dirname(current);
  }
  return null;
}

/**
 * Load workspace config from .do-workspace.json
 * Per D-49: extends existing fields with AI-related fields
 * @param {string} startPath - Starting directory for search
 * @returns {Object|null} Parsed config or null
 */
function loadWorkspaceConfig(startPath = process.cwd()) {
  const configPath = findWorkspaceConfig(startPath);
  if (!configPath) return null;

  try {
    const content = fs.readFileSync(configPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Resolve config with cascade: project -> workspace -> defaults
 * Per D-54: project config overrides workspace config
 * Per D-55: cascading fields: availableTools, defaultReviewer, council_reviews
 * Per D-56: resolution order is project -> workspace -> hardcoded
 * @param {string|null} projectConfigPath - Path to project .do/config.json
 * @param {string} workspaceStartPath - Starting path for workspace search
 * @returns {Object} Resolved config with availableTools, defaultReviewer, council_reviews
 */
function resolveConfig(
  projectConfigPath = null,
  workspaceStartPath = process.cwd(),
) {
  // Hardcoded defaults (per D-56)
  const defaults = {
    availableTools: [],
    defaultReviewer: "random",
    council_reviews: {
      planning: true,
      execution: true,
      reviewer: "random",
    },
  };

  // Load workspace config
  const workspaceConfig = loadWorkspaceConfig(workspaceStartPath) || {};

  // Load project config
  let projectConfig = {};
  if (projectConfigPath && fs.existsSync(projectConfigPath)) {
    try {
      projectConfig = JSON.parse(fs.readFileSync(projectConfigPath, "utf-8"));
    } catch {
      projectConfig = {};
    }
  }

  // Cascade: defaults <- workspace <- project
  // Per D-54: project overrides workspace
  return {
    availableTools:
      projectConfig.availableTools ||
      workspaceConfig.availableTools ||
      defaults.availableTools,
    defaultReviewer:
      projectConfig.council_reviews?.reviewer ||
      workspaceConfig.defaultReviewer ||
      defaults.defaultReviewer,
    council_reviews: {
      planning:
        projectConfig.council_reviews?.planning ??
        workspaceConfig.council_reviews?.planning ??
        defaults.council_reviews.planning,
      execution:
        projectConfig.council_reviews?.execution ??
        workspaceConfig.council_reviews?.execution ??
        defaults.council_reviews.execution,
      reviewer:
        projectConfig.council_reviews?.reviewer ||
        workspaceConfig.defaultReviewer ||
        defaults.council_reviews.reviewer,
    },
  };
}

// ============================================================================
// Runtime Detection
// ============================================================================

/**
 * Detect which runtime we're in (per D-40)
 * @returns {'claude'|'codex'} Current runtime
 */
function detectRuntime() {
  return process.env.CODEX_RUNTIME ? "codex" : "claude";
}

/**
 * Get available reviewers for the current runtime
 * Per D-42: available reviewers depend on runtime (self-review prevention)
 * Per D-55: reads availableTools from workspace config
 * Per council concern #3: accepts pre-resolved config to ensure cascade is properly wired
 * @param {string} currentRuntime - 'claude' or 'codex'
 * @param {Object|null} resolvedConfig - Config from resolveConfig() or null to load fresh
 * @returns {string[]} Available reviewer options
 */
function getAvailableReviewers(currentRuntime, resolvedConfig = null) {
  // Load config if not provided (per concern #3: caller should provide for proper cascade)
  const config = resolvedConfig || resolveConfig(null, process.cwd());
  const configuredTools = config.availableTools || [];

  if (configuredTools.length > 0) {
    // Filter out current runtime to prevent self-review (per D-40)
    return configuredTools.filter((t) => t !== currentRuntime);
  }

  // Fallback to hardcoded if no workspace config
  if (currentRuntime === "claude") {
    return ["codex", "gemini"];
  } else if (currentRuntime === "codex") {
    return ["claude", "gemini"];
  }
  return ["codex", "gemini"];
}

/**
 * Select a random reviewer from available options.
 * @param {string[]} available - Available reviewer options
 * @returns {string|null} Selected reviewer, or null if none available
 */
function selectRandomReviewer(available) {
  if (available.length === 0) {
    return null; // No reviewers available - caller must handle gracefully
  }
  if (available.length === 1) {
    return available[0];
  }

  // Use JS random selection
  const idx = Math.floor(Math.random() * available.length);
  return available[idx];
}

/**
 * Select reviewer based on configuration and runtime (per D-39, D-40, D-41, D-42)
 * @param {string} configured - Configured reviewer value
 * @param {string} currentRuntime - Current runtime ('claude' or 'codex')
 * @param {string[]|null} availableOverride - Optional override for available reviewers (from getAvailableReviewers with config)
 * @returns {string|null} Selected reviewer, or null if none available
 */
function selectReviewer(configured, currentRuntime, availableOverride = null) {
  const available = availableOverride || getAvailableReviewers(currentRuntime);

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
    /###\s*Key Findings\s*\n([\s\S]*?)(?=\n###|\n##|$)/i,
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
 * Parse findings from self-review agent freeform markdown.
 *
 * Handles three known section headers:
 *   - "**Issues found:**"       (do-plan-reviewer CONCERNS)
 *   - "**Fundamental issues:**" (do-plan-reviewer RETHINK)
 *   - "**Issues requiring changes:**" (do-code-reviewer CHANGES_REQUESTED)
 *
 * Section-boundary slicing: captures text from the line after the matched
 * header up to (but NOT including) the next bold subsection header.
 * The boundary pattern matches lines starting with `**SectionName:**`.
 * This prevents Recommendations, Required changes, Why this is blocking,
 * etc. from being captured as findings.
 *
 * Handles both numbered (1. item) and bulleted (- item or * item) list formats.
 *
 * @param {string} markdown - Self-review agent output text
 * @returns {string[]} Extracted finding strings (tags preserved)
 */
function parseSelfReviewFindings(markdown) {
  if (!markdown) return [];

  const FINDINGS_HEADER =
    /\*\*Issues found:\*\*|\*\*Fundamental issues:\*\*|\*\*Issues requiring changes:\*\*/;
  const BOLD_SECTION = /^\*\*[^*]+:\*\*/m;

  // Find the findings header
  const headerMatch = FINDINGS_HEADER.exec(markdown);
  if (!headerMatch) return [];

  // Slice from just after the header line to end of string
  const afterHeader = markdown.slice(headerMatch.index + headerMatch[0].length);

  // Find the next bold section boundary (if any)
  const boundaryMatch = BOLD_SECTION.exec(afterHeader);
  const slice = boundaryMatch
    ? afterHeader.slice(0, boundaryMatch.index)
    : afterHeader;

  // Extract list items (numbered or bulleted)
  const findings = [];
  for (const line of slice.split("\n")) {
    const trimmed = line.trim();
    // Numbered: "1. text", "2. text", etc.
    const numberedMatch = trimmed.match(/^\d+\.\s+(.+)/);
    if (numberedMatch) {
      findings.push(numberedMatch[1].trim());
      continue;
    }
    // Bulleted: "- text" or "* text"
    const bulletedMatch = trimmed.match(/^[-*]\s+(.+)/);
    if (bulletedMatch) {
      findings.push(bulletedMatch[1].trim());
    }
  }

  return findings;
}

/**
 * Parse findings from do-council-reviewer agent's flattened text output.
 *
 * The do-council-reviewer agent (Step 3.5 updated) emits findings as:
 *   Findings:
 *   - <finding 1>
 *   - <finding 2>
 *   Recommendations:
 *   - ...
 *
 * This function extracts bullet lines only from the Findings section.
 * Fallback: if no bullet lines are found (pre-contract legacy format),
 * the entire captured Findings text is returned as a single-element array
 * (untagged, defaults to blocker via classifyFindings — safe degradation).
 *
 * NOTE: Do NOT use parseFindings() for council runner output — parseFindings()
 * parses raw advisor markdown (### Key Findings sections) and will return
 * empty results against the council runner's flattened format.
 *
 * @param {string} agentText - do-council-reviewer agent output text
 * @returns {string[]} Extracted finding strings (tags preserved)
 */
function parseCouncilRunnerOutput(agentText) {
  if (!agentText) return [];

  // Find the Findings: section header.
  // Strategy: locate "^Findings:" in the text, then capture everything after it
  // up to "^Recommendations:" (if present) or end of text.
  // We avoid multiline regex lookaheads with $ because $ matches end-of-line
  // in multiline mode, causing premature capture termination.
  const findingsStart = agentText.match(/^Findings:\s*/m);
  if (!findingsStart) return [];

  const afterFindings = agentText.slice(
    findingsStart.index + findingsStart[0].length,
  );
  const recsIndex = afterFindings.search(/^Recommendations:/m);
  const sectionText =
    recsIndex !== -1 ? afterFindings.slice(0, recsIndex) : afterFindings;

  // Extract bullet lines from the section
  const findings = [];
  for (const line of sectionText.split("\n")) {
    const trimmed = line.trim();
    const bulletMatch = trimmed.match(/^[-*]\s+(.+)/);
    if (bulletMatch) {
      findings.push(bulletMatch[1].trim());
    }
  }

  // Fallback: no bullets found — legacy format, wrap entire text as single finding
  // (untagged, defaults to blocker via classifyFindings — safe degradation)
  if (findings.length === 0) {
    const rawText = sectionText.trim();
    if (rawText) {
      return [rawText];
    }
    return [];
  }

  return findings;
}

/**
 * Classify an array of finding strings into blockers and nitpicks.
 *
 * Classification rules:
 *   - Finding starts with "[blocker]" -> blocker
 *   - Finding starts with "[nitpick]" -> nitpick
 *   - Untagged -> blocker (safe fallback: prevents silent skips)
 *
 * @param {string[]} findings - Array of finding strings from any parser
 * @returns {{ blockers: string[], nitpicks: string[] }} Classified findings
 */
function classifyFindings(findings) {
  const blockers = [];
  const nitpicks = [];

  for (const finding of findings) {
    const trimmed = finding.trim();
    if (trimmed.startsWith("[nitpick]")) {
      nitpicks.push(trimmed);
    } else {
      // [blocker] prefix or untagged — defaults to blocker
      blockers.push(trimmed);
    }
  }

  return { blockers, nitpicks };
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
    /###\s*Recommendations\s*\n([\s\S]*?)(?=\n###|\n##|$)/i,
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
async function invokeCodex(
  briefPath,
  timeout = DEFAULT_TIMEOUT,
  reviewType = "plan",
) {
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

    let settled = false;
    const settle = (value) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    const ac = new AbortController();
    const timer = setTimeout(() => {
      ac.abort();
      settle({ success: false, error: "Timeout", output: "" });
    }, timeout);

    const proc = spawn(
      "node",
      [CODEX_COMPANION, "task", "--wait", "--prompt-file", briefPath],
      { stdio: ["ignore", "pipe", "pipe"], signal: ac.signal },
    );

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d));
    proc.stderr.on("data", (d) => (stderr += d));

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0 && stdout.trim()) {
        settle({
          success: true,
          output: stdout,
          verdict: parseVerdict(stdout, reviewType),
          findings: parseFindings(stdout),
          recommendations: parseRecommendations(stdout),
        });
      } else {
        settle({
          success: false,
          error: stderr || "Empty output",
          output: stdout,
        });
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      // AbortError is expected on timeout -- already settled via timer callback
      if (err.name !== "AbortError") {
        settle({ success: false, error: err.message, output: "" });
      }
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
async function runGeminiOnce(
  briefPath,
  workspace,
  timeout,
  reviewType = "plan",
) {
  return new Promise((resolve) => {
    // Read brief content
    let briefContent;
    try {
      briefContent = fs.readFileSync(briefPath, "utf-8");
    } catch (err) {
      resolve({
        success: false,
        error: `Failed to read brief: ${err.message}`,
        output: "",
      });
      return;
    }

    let settled = false;
    const settle = (value) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    const ac = new AbortController();
    const timer = setTimeout(() => {
      ac.abort();
      settle({ success: false, error: "Timeout", output: "" });
    }, timeout);

    // Spawn gemini with stdin pipe
    const proc = spawn(
      "gemini",
      [
        "--prompt",
        "-",
        "--include-directories",
        workspace,
        "--approval-mode",
        // "plan" mode is intentional for all review types -- Gemini should analyze/propose, never auto-execute
        "plan",
        "-o",
        "text",
      ],
      { stdio: ["pipe", "pipe", "pipe"], signal: ac.signal },
    );

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d));
    proc.stderr.on("data", (d) => (stderr += d));

    // Write brief to stdin (EPIPE guard: child may exit before consuming all input)
    proc.stdin.on("error", () => {}); // suppress uncaught EPIPE
    try {
      proc.stdin.write(briefContent);
      proc.stdin.end();
    } catch (err) {
      settle({ success: false, error: "EPIPE", output: "" });
    }

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0 && stdout.trim()) {
        settle({
          success: true,
          output: stdout,
          verdict: parseVerdict(stdout, reviewType),
          findings: parseFindings(stdout),
          recommendations: parseRecommendations(stdout),
        });
      } else {
        settle({
          success: false,
          error: stderr || "Empty output",
          output: stdout,
        });
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      // AbortError is expected on timeout -- already settled via timer callback
      if (err.name !== "AbortError") {
        settle({ success: false, error: err.message, output: "" });
      }
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
async function invokeGemini(
  briefPath,
  workspace,
  timeout = DEFAULT_TIMEOUT,
  reviewType = "plan",
) {
  for (let attempt = 0; attempt <= GEMINI_MAX_RETRIES; attempt++) {
    const result = await runGeminiOnce(
      briefPath,
      workspace,
      timeout,
      reviewType,
    );
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
async function invokeBoth(
  briefPath,
  workspace,
  timeout = DEFAULT_TIMEOUT,
  reviewType = "plan",
) {
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
      const cautionOrder = [
        "RETHINK",
        "CHANGES_REQUESTED",
        "CONCERNS",
        "NITPICKS_ONLY",
        "LOOKS_GOOD",
        "APPROVED",
      ];
      combinedVerdict = verdicts.sort(
        (a, b) => cautionOrder.indexOf(a) - cautionOrder.indexOf(b),
      )[0];
    }
  } else if (verdicts.length === 1) {
    combinedVerdict = verdicts[0];
  }

  // Combine findings and recommendations
  const allFindings = [...(codex?.findings || []), ...(gemini.findings || [])];
  const allRecs = [
    ...(codex?.recommendations || []),
    ...(gemini.recommendations || []),
  ];

  return {
    success: codex?.success || gemini.success,
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
 * @param {string} options.projectConfigPath - Path to project .do/config.json (optional)
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
    projectConfigPath = null, // NEW: Add optional project config path
  } = options;

  // Validate type
  if (!["plan", "code"].includes(type)) {
    return {
      success: false,
      error: `Invalid review type: ${type}`,
      advisor: null,
    };
  }

  // Validate task file exists
  if (!fs.existsSync(taskFile)) {
    return {
      success: false,
      error: `Task file not found: ${taskFile}`,
      advisor: null,
    };
  }

  // CRITICAL per council concern #3: Resolve config with proper cascade
  // Project config overrides workspace config per D-54
  const resolvedConfig = resolveConfig(projectConfigPath, workspace);

  // Detect runtime and select reviewer
  const currentRuntime = detectRuntime();

  // CRITICAL per council concern #3: Pass resolvedConfig to getAvailableReviewers
  // This ensures the cascade (project -> workspace -> defaults) is properly wired
  const available = getAvailableReviewers(currentRuntime, resolvedConfig);

  // Use reviewer from options, or fall back to config default
  const effectiveReviewer =
    reviewer !== "random" ? reviewer : resolvedConfig.defaultReviewer;
  const selectedReviewer = selectReviewer(
    effectiveReviewer,
    currentRuntime,
    available,
  );

  // Handle case where no reviewers are available (e.g., single-tool setup)
  if (selectedReviewer === null) {
    return {
      success: true,
      skipped: true,
      reason:
        "No external reviewers available for this runtime/config combination",
      advisor: null,
      verdict: null,
    };
  }

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
  try {
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
        process.stderr.write(
          "council: claude reviewer not available, falling back to gemini\n",
        );
        result = await invokeGemini(briefPath, workspace, timeout, type);
        result.advisor = "gemini";
        break;
      case "both":
        result = await invokeBoth(briefPath, workspace, timeout, type);
        break;
      default:
        return {
          success: false,
          error: `Unknown reviewer: ${selectedReviewer}`,
          advisor: null,
        };
    }
  } finally {
    // Clean up temp brief file if we created one
    if (briefPath !== taskFile && fs.existsSync(briefPath)) {
      fs.unlinkSync(briefPath);
    }
  }

  return result;
}

// CLI handling
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Council Invocation

Usage: node council-invoke.cjs --type plan|code --task-file <path> [--project-config-path <path>] [options]

Options:
  --type <plan|code>            Review type (required)
  --task-file <path>            Path to task markdown file (required)
  --reviewer <value>            Reviewer selection (default: random)
                                Values: claude, codex, gemini, random, both
  --workspace <path>            Workspace path for Gemini (default: cwd)
  --files-modified <list>       Comma-separated list of modified files (for code reviews)
  --project-config-path <path>  Path to project .do/config.json (default: auto-detected from cwd)
  --timeout <ms>                Timeout in milliseconds (default: 240000)
  --help, -h                    Show this help message

Examples:
  node council-invoke.cjs --type plan --task-file .do/tasks/my-task.md
  node council-invoke.cjs --type code --task-file .do/tasks/my-task.md --reviewer codex
  node council-invoke.cjs --type code --task-file .do/tasks/my-task.md --files-modified "src/a.js,src/b.js"
  node council-invoke.cjs --type plan --task-file .do/tasks/my-task.md --project-config-path /path/to/.do/config.json
`);
    process.exit(0);
  }

  // Parse arguments
  const getArg = (name) => {
    const idx = args.indexOf(name);
    return idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith("--")
      ? args[idx + 1]
      : null;
  };

  const type = getArg("--type");
  const taskFile = getArg("--task-file");
  const reviewer = getArg("--reviewer") || "random";
  const workspace = getArg("--workspace") || process.cwd();
  const filesModified = getArg("--files-modified");
  const timeout = getArg("--timeout")
    ? parseInt(getArg("--timeout"), 10)
    : DEFAULT_TIMEOUT;

  // Auto-detect .do/config.json from cwd; allow explicit override via --project-config-path
  const defaultProjectConfigPath = path.join(
    process.cwd(),
    ".do",
    "config.json",
  );
  const projectConfigPath =
    getArg("--project-config-path") ||
    (fs.existsSync(defaultProjectConfigPath) ? defaultProjectConfigPath : null);

  if (!type || !taskFile) {
    console.error(
      JSON.stringify({ error: "--type and --task-file are required" }),
    );
    process.exit(1);
  }

  invokeCouncil({
    type,
    taskFile,
    reviewer,
    workspace,
    filesModified,
    timeout,
    projectConfigPath,
  })
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
  // Runtime and reviewer selection
  detectRuntime,
  selectReviewer,
  getAvailableReviewers,
  selectRandomReviewer,
  // Parsing functions
  parseVerdict,
  parseFindings,
  parseRecommendations,
  // Finding extraction and classification helpers (review-findings-classifier)
  parseSelfReviewFindings,
  parseCouncilRunnerOutput,
  classifyFindings,
  // Invocation functions
  invokeCodex,
  invokeGemini,
  invokeBoth,
  invokeCouncil,
  // Config functions (D-49, D-54, D-55, D-56)
  findWorkspaceConfig,
  loadWorkspaceConfig,
  resolveConfig,
  // Constants
  PLUGIN_ROOT,
  CODEX_COMPANION,
  DEFAULT_TIMEOUT,
  GEMINI_MAX_RETRIES,
  VALID_REVIEWERS,
  PLAN_VERDICTS,
  CODE_VERDICTS,
  ALL_VERDICTS,
};
