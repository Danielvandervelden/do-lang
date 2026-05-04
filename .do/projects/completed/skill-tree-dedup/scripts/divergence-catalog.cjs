#!/usr/bin/env node
"use strict";

/**
 * divergence-catalog.cjs
 *
 * Programmatically diffs ALL 45 divergent file pairs from the skill tree audit.
 * For each pair, classifies every changed line into one of four pattern categories:
 *   - path_substitution
 *   - agent_name_prefix
 *   - agent_spawn_block  (stateful range tracking per executor guidance)
 *   - prose_wording      (catch-all)
 *
 * Executor guidance incorporated:
 * 1. agent_spawn_block uses subagent_type (not agent_name) as Claude-side marker.
 *    Stateful range tracking: Claude side from "Agent({" through closing "})";
 *    Codex side from "Spawn the codex-" through the end of the prompt block.
 *    Lines inside these ranges classify as agent_spawn_block even if they match
 *    other patterns.
 * 2. distinctPaths stored as pairs { claude, codex, variable } in summary.
 * 3. Uses execFileSync("diff", ["-u", fileA, fileB]) for shell safety.
 *
 * Output: .do/projects/skill-tree-dedup/divergence-catalog.json
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

// Repo root: 4 levels up from scripts/
const repoRoot = path.join(__dirname, "..", "..", "..", "..");
const outputDir = path.join(__dirname, "..");

// ---------------------------------------------------------------------------
// Hard-coded list of all 45 divergent pairs from audit-report.md
// ---------------------------------------------------------------------------

const DIVERGENT_PAIRS = [
  // ---- Group: references (25 pairs) ----
  {
    group: "references",
    name: "classify-findings.md",
    fileA: "skills/do/references/classify-findings.md",
    fileB: "skills/codex/references/classify-findings.md",
  },
  {
    group: "references",
    name: "init-health-check.md",
    fileA: "skills/do/references/init-health-check.md",
    fileB: "skills/codex/references/init-health-check.md",
  },
  {
    group: "references",
    name: "init-workspace-setup.md",
    fileA: "skills/do/references/init-workspace-setup.md",
    fileB: "skills/codex/references/init-workspace-setup.md",
  },
  {
    group: "references",
    name: "phase-template.md",
    fileA: "skills/do/references/phase-template.md",
    fileB: "skills/codex/references/phase-template.md",
  },
  {
    group: "references",
    name: "project-master-template.md",
    fileA: "skills/do/references/project-master-template.md",
    fileB: "skills/codex/references/project-master-template.md",
  },
  {
    group: "references",
    name: "resume-preamble-project.md",
    fileA: "skills/do/references/resume-preamble-project.md",
    fileB: "skills/codex/references/resume-preamble-project.md",
  },
  {
    group: "references",
    name: "resume-preamble.md",
    fileA: "skills/do/references/resume-preamble.md",
    fileB: "skills/codex/references/resume-preamble.md",
  },
  {
    group: "references",
    name: "stage-code-review.md",
    fileA: "skills/do/references/stage-code-review.md",
    fileB: "skills/codex/references/stage-code-review.md",
  },
  {
    group: "references",
    name: "stage-execute.md",
    fileA: "skills/do/references/stage-execute.md",
    fileB: "skills/codex/references/stage-execute.md",
  },
  {
    group: "references",
    name: "stage-fast-exec.md",
    fileA: "skills/do/references/stage-fast-exec.md",
    fileB: "skills/codex/references/stage-fast-exec.md",
  },
  {
    group: "references",
    name: "stage-phase-exit.md",
    fileA: "skills/do/references/stage-phase-exit.md",
    fileB: "skills/codex/references/stage-phase-exit.md",
  },
  {
    group: "references",
    name: "stage-phase-plan-review.md",
    fileA: "skills/do/references/stage-phase-plan-review.md",
    fileB: "skills/codex/references/stage-phase-plan-review.md",
  },
  {
    group: "references",
    name: "stage-phase-transition.md",
    fileA: "skills/do/references/stage-phase-transition.md",
    fileB: "skills/codex/references/stage-phase-transition.md",
  },
  {
    group: "references",
    name: "stage-plan-review.md",
    fileA: "skills/do/references/stage-plan-review.md",
    fileB: "skills/codex/references/stage-plan-review.md",
  },
  {
    group: "references",
    name: "stage-project-complete.md",
    fileA: "skills/do/references/stage-project-complete.md",
    fileB: "skills/codex/references/stage-project-complete.md",
  },
  {
    group: "references",
    name: "stage-project-intake.md",
    fileA: "skills/do/references/stage-project-intake.md",
    fileB: "skills/codex/references/stage-project-intake.md",
  },
  {
    group: "references",
    name: "stage-project-plan-review.md",
    fileA: "skills/do/references/stage-project-plan-review.md",
    fileB: "skills/codex/references/stage-project-plan-review.md",
  },
  {
    group: "references",
    name: "stage-project-resume.md",
    fileA: "skills/do/references/stage-project-resume.md",
    fileB: "skills/codex/references/stage-project-resume.md",
  },
  {
    group: "references",
    name: "stage-quick-exec.md",
    fileA: "skills/do/references/stage-quick-exec.md",
    fileB: "skills/codex/references/stage-quick-exec.md",
  },
  {
    group: "references",
    name: "stage-wave-code-review.md",
    fileA: "skills/do/references/stage-wave-code-review.md",
    fileB: "skills/codex/references/stage-wave-code-review.md",
  },
  {
    group: "references",
    name: "stage-wave-exec.md",
    fileA: "skills/do/references/stage-wave-exec.md",
    fileB: "skills/codex/references/stage-wave-exec.md",
  },
  {
    group: "references",
    name: "stage-wave-plan-review.md",
    fileA: "skills/do/references/stage-wave-plan-review.md",
    fileB: "skills/codex/references/stage-wave-plan-review.md",
  },
  {
    group: "references",
    name: "stage-wave-verify.md",
    fileA: "skills/do/references/stage-wave-verify.md",
    fileB: "skills/codex/references/stage-wave-verify.md",
  },
  {
    group: "references",
    name: "task-template.md",
    fileA: "skills/do/references/task-template.md",
    fileB: "skills/codex/references/task-template.md",
  },
  {
    group: "references",
    name: "wave-template.md",
    fileA: "skills/do/references/wave-template.md",
    fileB: "skills/codex/references/wave-template.md",
  },

  // ---- Group: skills (12 pairs) ----
  {
    group: "skills",
    name: "abandon.md",
    fileA: "skills/do/abandon.md",
    fileB: "skills/codex/abandon.md",
  },
  {
    group: "skills",
    name: "backlog.md",
    fileA: "skills/do/backlog.md",
    fileB: "skills/codex/backlog.md",
  },
  {
    group: "skills",
    name: "continue.md",
    fileA: "skills/do/continue.md",
    fileB: "skills/codex/continue.md",
  },
  {
    group: "skills",
    name: "debug.md",
    fileA: "skills/do/debug.md",
    fileB: "skills/codex/debug.md",
  },
  {
    group: "skills",
    name: "do.md",
    fileA: "skills/do/do.md",
    fileB: "skills/codex/do.md",
  },
  {
    group: "skills",
    name: "fast.md",
    fileA: "skills/do/fast.md",
    fileB: "skills/codex/fast.md",
  },
  {
    group: "skills",
    name: "optimise.md",
    fileA: "skills/do/optimise.md",
    fileB: "skills/codex/optimise.md",
  },
  {
    group: "skills",
    name: "project.md",
    fileA: "skills/do/project.md",
    fileB: "skills/codex/project.md",
  },
  {
    group: "skills",
    name: "quick.md",
    fileA: "skills/do/quick.md",
    fileB: "skills/codex/quick.md",
  },
  {
    group: "skills",
    name: "scan.md",
    fileA: "skills/do/scan.md",
    fileB: "skills/codex/scan.md",
  },
  {
    group: "skills",
    name: "task.md",
    fileA: "skills/do/task.md",
    fileB: "skills/codex/task.md",
  },
  {
    group: "skills",
    name: "update.md",
    fileA: "skills/do/update.md",
    fileB: "skills/codex/update.md",
  },

  // ---- Group: agents (8 pairs) ----
  {
    group: "agents",
    name: "code-reviewer.md",
    fileA: "agents/do-code-reviewer.md",
    fileB: "agents/codex-code-reviewer.md",
  },
  {
    group: "agents",
    name: "council-reviewer.md",
    fileA: "agents/do-council-reviewer.md",
    fileB: "agents/codex-council-reviewer.md",
  },
  {
    group: "agents",
    name: "debugger.md",
    fileA: "agents/do-debugger.md",
    fileB: "agents/codex-debugger.md",
  },
  {
    group: "agents",
    name: "executioner.md",
    fileA: "agents/do-executioner.md",
    fileB: "agents/codex-executioner.md",
  },
  {
    group: "agents",
    name: "griller.md",
    fileA: "agents/do-griller.md",
    fileB: "agents/codex-griller.md",
  },
  {
    group: "agents",
    name: "plan-reviewer.md",
    fileA: "agents/do-plan-reviewer.md",
    fileB: "agents/codex-plan-reviewer.md",
  },
  {
    group: "agents",
    name: "planner.md",
    fileA: "agents/do-planner.md",
    fileB: "agents/codex-planner.md",
  },
  {
    group: "agents",
    name: "verifier.md",
    fileA: "agents/do-verifier.md",
    fileB: "agents/codex-verifier.md",
  },
];

// ---------------------------------------------------------------------------
// Pattern classification
// ---------------------------------------------------------------------------

// Known platform-specific paths (order matters: more specific first)
const PATH_PATTERNS = [
  "~/.claude/commands/do/scripts/",
  "~/.codex/skills/do/scripts/",
  "~/.claude/commands/do/",
  "~/.codex/skills/do/",
  "~/.claude/agents/",
  "~/.codex/agents/",
  "skills/do/",
  "skills/codex/",
  // shell-quoted variants
  "${HOME}/.claude/commands/do/",
  "${HOME}/.codex/skills/do/",
  // update.md style
  "/Users/<user>/.claude/commands/do",
  "/Users/<user>/.codex/skills/do",
  "/Users/<user>/.claude/agents",
  "/Users/<user>/.codex/agents",
];

// Known agent base names (without platform prefix)
const AGENT_NAMES = [
  "planner",
  "executioner",
  "griller",
  "verifier",
  "code-reviewer",
  "plan-reviewer",
  "council-reviewer",
  "debugger",
];

// Claude-side agent spawn block markers (stateful range tracking)
// Executor guidance: use subagent_type (not agent_name), plus Agent({, prompt:
const CLAUDE_SPAWN_START_RE = /Agent\(\{/;
const CLAUDE_SPAWN_MARKERS = [
  /Agent\(\{/,
  /subagent_type:/,
  /prompt:/,
];
const CLAUDE_SPAWN_END_RE = /^\+?\s*\}\)/; // closing }) of Agent() call

// Codex-side agent spawn block markers
const CODEX_SPAWN_START_RE = /Spawn the codex-/i;
// Codex spawn blocks end when we reach a blank line or a new section that isn't
// indented continuation. We use a conservative heuristic: the block ends when
// we see a changed line that is NOT the opener line and does NOT start with
// whitespace on the content side (i.e., a new top-level line).
// We track this statefully per pair.

function isPathSubstitution(text) {
  return PATH_PATTERNS.some((p) => text.includes(p));
}

function isAgentNamePrefix(text) {
  return AGENT_NAMES.some(
    (name) => text.includes(`do-${name}`) || text.includes(`codex-${name}`)
  );
}

/**
 * Parse unified diff output into changed lines with side (+ or -) and line number.
 * Returns { changed: [{lineNum, side, text}], hunks: [...raw hunk strings] }
 */
function parseUnifiedDiff(diffOutput) {
  const lines = diffOutput.split("\n");
  const changed = [];
  let currentLineB = 0; // track line number in B file for + lines
  let currentLineA = 0; // track line number in A file for - lines

  for (const line of lines) {
    if (line.startsWith("---") || line.startsWith("+++")) continue;
    if (line.startsWith("@@")) {
      // Parse hunk header: @@ -a,b +c,d @@
      const m = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (m) {
        currentLineA = parseInt(m[1], 10);
        currentLineB = parseInt(m[2], 10);
      }
      continue;
    }
    if (line.startsWith("-")) {
      changed.push({ lineNum: currentLineA, side: "-", text: line.slice(1) });
      currentLineA++;
    } else if (line.startsWith("+")) {
      changed.push({ lineNum: currentLineB, side: "+", text: line.slice(1) });
      currentLineB++;
    } else if (line.startsWith(" ")) {
      currentLineA++;
      currentLineB++;
    }
  }
  return changed;
}

/**
 * Classify changed lines for a pair into pattern buckets.
 * Uses stateful range tracking for agent_spawn_block.
 *
 * @param {{ lineNum: number, side: string, text: string }[]} changedLines
 * @returns {{ path_substitution, agent_name_prefix, agent_spawn_block, prose_wording }}
 */
function classifyLines(changedLines) {
  const patterns = {
    path_substitution: [],
    agent_name_prefix: [],
    agent_spawn_block: [],
    prose_wording: [],
  };

  // Stateful tracking for agent spawn blocks
  let inClaudeSpawnBlock = false;
  let inCodexSpawnBlock = false;
  let claudeSpawnBraceDepth = 0;

  for (const entry of changedLines) {
    const { lineNum, side, text } = entry;

    // ---- Stateful agent_spawn_block range tracking ----

    if (side === "-") {
      // Claude side
      if (!inClaudeSpawnBlock) {
        if (CLAUDE_SPAWN_START_RE.test(text)) {
          inClaudeSpawnBlock = true;
          claudeSpawnBraceDepth = (text.match(/\{/g) || []).length - (text.match(/\}/g) || []).length;
          patterns.agent_spawn_block.push({ lineNum, side, text });
          continue;
        }
      } else {
        // Inside Claude spawn block: track brace depth
        claudeSpawnBraceDepth += (text.match(/\{/g) || []).length;
        claudeSpawnBraceDepth -= (text.match(/\}/g) || []).length;
        patterns.agent_spawn_block.push({ lineNum, side, text });
        if (claudeSpawnBraceDepth <= 0) {
          inClaudeSpawnBlock = false;
        }
        continue;
      }
    } else if (side === "+") {
      // Codex side
      if (!inCodexSpawnBlock) {
        if (CODEX_SPAWN_START_RE.test(text)) {
          inCodexSpawnBlock = true;
          patterns.agent_spawn_block.push({ lineNum, side, text });
          continue;
        }
      } else {
        // Inside Codex spawn block: continue until we see a line that looks like
        // a new top-level instruction (not indented and not part of a prompt body).
        // Heuristic: end if we see a line that starts with a non-space character
        // and doesn't start with ">" (blockquote continuation) or "-" (list item
        // that might be a parameter list).
        // More robustly: end if we see ``` (code block marker) or an empty line
        // followed by text that starts a new section.
        // We use a simple rule: end the block when we see a line starting with
        // a letter/number/symbol that isn't a continuation marker.
        const stripped = text.trimStart();
        const looksLikeNewSection =
          stripped.length > 0 &&
          !stripped.startsWith(">") &&
          !stripped.startsWith("-") &&
          !stripped.startsWith("*") &&
          !stripped.startsWith("|") &&
          !stripped.startsWith("```") &&
          !text.startsWith("  ") && // not indented
          !text.startsWith("\t");

        if (looksLikeNewSection && !CODEX_SPAWN_START_RE.test(text)) {
          inCodexSpawnBlock = false;
          // Fall through to normal classification for this line
        } else {
          patterns.agent_spawn_block.push({ lineNum, side, text });
          continue;
        }
      }
    }

    // ---- Normal classification (not in spawn block) ----

    const matchedPatterns = [];

    if (isPathSubstitution(text)) {
      matchedPatterns.push("path_substitution");
    }
    if (isAgentNamePrefix(text)) {
      matchedPatterns.push("agent_name_prefix");
    }

    if (matchedPatterns.length === 0) {
      matchedPatterns.push("prose_wording");
    }

    for (const pat of matchedPatterns) {
      patterns[pat].push({ lineNum, side, text });
    }
  }

  return patterns;
}

// ---------------------------------------------------------------------------
// Summary accumulation
// ---------------------------------------------------------------------------

function makeSummary() {
  return {
    path_substitution: { pairCount: 0, lineCount: 0, distinctPaths: [] },
    agent_name_prefix: { pairCount: 0, lineCount: 0, distinctPrefixes: [] },
    agent_spawn_block: { pairCount: 0, lineCount: 0 },
    prose_wording: { pairCount: 0, lineCount: 0 },
    unclassified: { pairCount: 0, lineCount: 0 },
  };
}

// Known path pairs for summary (executor guidance: store as pairs not flat list)
const PATH_PAIR_MAP = [
  {
    claude: "~/.claude/commands/do/scripts/",
    codex: "~/.codex/skills/do/scripts/",
    variable: "PLATFORM_PATH",
    note: "scripts subdirectory variant",
  },
  {
    claude: "~/.claude/commands/do/",
    codex: "~/.codex/skills/do/",
    variable: "PLATFORM_PATH",
    note: "base install path",
  },
  {
    claude: "~/.claude/agents/",
    codex: "~/.codex/agents/",
    variable: "PLATFORM_AGENTS_PATH",
    note: "agents install path",
  },
  {
    claude: "skills/do/",
    codex: "skills/codex/",
    variable: "PLATFORM_SKILLS_DIR",
    note: "source skills directory reference",
  },
  {
    claude: "${HOME}/.claude/commands/do/",
    codex: "${HOME}/.codex/skills/do/",
    variable: "PLATFORM_PATH_SHELL",
    note: "shell variable variant — distinct from tilde paths; used in bash heredocs/scripts where ${HOME} is expanded by the shell at runtime, not by the template engine",
  },
  {
    claude: "/Users/<user>/.claude/commands/do",
    codex: "/Users/<user>/.codex/skills/do",
    variable: "PLATFORM_PATH_DISPLAY",
    note: "display path variant (update.md)",
  },
  {
    claude: "/Users/<user>/.claude/agents",
    codex: "/Users/<user>/.codex/agents",
    variable: "PLATFORM_AGENTS_PATH_DISPLAY",
    note: "display agents path variant (update.md)",
  },
];

function extractDistinctPaths(lines) {
  // Return which pairs are present in these lines. Use longest non-overlapping
  // matches so relative paths like "skills/do/" are not counted inside longer
  // install paths like "~/.codex/skills/do/".
  const found = new Set();
  for (const entry of lines) {
    const matches = [];
    for (let i = 0; i < PATH_PAIR_MAP.length; i++) {
      const pair = PATH_PAIR_MAP[i];
      for (const candidate of [pair.claude, pair.codex]) {
        let start = entry.text.indexOf(candidate);
        while (start !== -1) {
          matches.push({
            index: i,
            start,
            end: start + candidate.length,
            length: candidate.length,
          });
          start = entry.text.indexOf(candidate, start + 1);
        }
      }
    }

    matches.sort((a, b) => b.length - a.length || a.start - b.start);
    const accepted = [];
    for (const match of matches) {
      const overlaps = accepted.some(
        (existing) => match.start < existing.end && existing.start < match.end
      );
      if (!overlaps) {
        accepted.push(match);
        found.add(match.index);
      }
    }
  }
  return [...found].map((i) => PATH_PAIR_MAP[i]);
}

function extractDistinctPrefixes(lines) {
  const found = new Set();
  for (const entry of lines) {
    for (const name of AGENT_NAMES) {
      if (entry.text.includes(`do-${name}`) || entry.text.includes(`codex-${name}`)) {
        found.add(`do-${name}/codex-${name}`);
      }
    }
  }
  return [...found];
}

// ---------------------------------------------------------------------------
// Main processing
// ---------------------------------------------------------------------------

function runDiff(fileA, fileB) {
  const absA = path.join(repoRoot, fileA);
  const absB = path.join(repoRoot, fileB);

  try {
    // diff exits 0 if identical, 1 if different, 2 on error
    const result = execFileSync("diff", ["-u", absA, absB], { encoding: "utf8" });
    return result; // identical (exit 0)
  } catch (err) {
    if (err.status === 1) {
      return err.stdout; // files differ — this is expected
    }
    throw new Error(`diff error for ${fileA} vs ${fileB}: ${err.message}`);
  }
}

function processPair(pair) {
  const diffOutput = runDiff(pair.fileA, pair.fileB);
  const changedLines = parseUnifiedDiff(diffOutput);
  const patterns = classifyLines(changedLines);

  return {
    group: pair.group,
    name: pair.name,
    fileA: pair.fileA,
    fileB: pair.fileB,
    patterns,
    totalChangedLines: changedLines.length,
  };
}

console.log(`Processing ${DIVERGENT_PAIRS.length} divergent pairs...`);
const pairs = [];
const summary = makeSummary();

// Accumulate distinct paths/prefixes across all pairs
const allDistinctPathIndices = new Set();
const allDistinctPrefixes = new Set();

for (const pair of DIVERGENT_PAIRS) {
  process.stdout.write(`  ${pair.group}/${pair.name}... `);
  const result = processPair(pair);
  pairs.push(result);

  const hasPathSub = result.patterns.path_substitution.length > 0;
  const hasAgentPrefix = result.patterns.agent_name_prefix.length > 0;
  const hasSpawnBlock = result.patterns.agent_spawn_block.length > 0;
  const hasProseWording = result.patterns.prose_wording.length > 0;

  if (hasPathSub) {
    summary.path_substitution.pairCount++;
    summary.path_substitution.lineCount += result.patterns.path_substitution.length;
    for (const p of extractDistinctPaths(result.patterns.path_substitution)) {
      allDistinctPathIndices.add(JSON.stringify(p));
    }
  }
  if (hasAgentPrefix) {
    summary.agent_name_prefix.pairCount++;
    summary.agent_name_prefix.lineCount += result.patterns.agent_name_prefix.length;
    for (const p of extractDistinctPrefixes(result.patterns.agent_name_prefix)) {
      allDistinctPrefixes.add(p);
    }
  }
  if (hasSpawnBlock) {
    summary.agent_spawn_block.pairCount++;
    summary.agent_spawn_block.lineCount += result.patterns.agent_spawn_block.length;
  }
  if (hasProseWording) {
    summary.prose_wording.pairCount++;
    summary.prose_wording.lineCount += result.patterns.prose_wording.length;
  }

  const totalClassified =
    result.patterns.path_substitution.length +
    result.patterns.agent_name_prefix.length +
    result.patterns.agent_spawn_block.length +
    result.patterns.prose_wording.length;

  // Lines can be double-classified (path_sub + agent_prefix both match)
  // We track unclassified as lines that fell only to prose_wording with no other match
  console.log(
    `${result.totalChangedLines} changed lines ` +
    `(path:${result.patterns.path_substitution.length} ` +
    `prefix:${result.patterns.agent_name_prefix.length} ` +
    `spawn:${result.patterns.agent_spawn_block.length} ` +
    `prose:${result.patterns.prose_wording.length})`
  );
}

// Build distinctPaths as pairs (executor guidance)
summary.path_substitution.distinctPaths = [...allDistinctPathIndices].map((s) => JSON.parse(s));

// Build distinctPrefixes
summary.agent_name_prefix.distinctPrefixes = [...allDistinctPrefixes].sort();

// Write output
const catalog = {
  generated: new Date().toISOString(),
  totalPairs: DIVERGENT_PAIRS.length,
  pairs,
  summary,
};

const outputPath = path.join(outputDir, "divergence-catalog.json");
fs.writeFileSync(outputPath, JSON.stringify(catalog, null, 2) + "\n", "utf8");

console.log(`\nWrote: ${outputPath}`);
console.log(`\nSummary:`);
console.log(`  path_substitution: ${summary.path_substitution.pairCount} pairs, ${summary.path_substitution.lineCount} lines`);
console.log(`  agent_name_prefix: ${summary.agent_name_prefix.pairCount} pairs, ${summary.agent_name_prefix.lineCount} lines`);
console.log(`  agent_spawn_block: ${summary.agent_spawn_block.pairCount} pairs, ${summary.agent_spawn_block.lineCount} lines`);
console.log(`  prose_wording:     ${summary.prose_wording.pairCount} pairs, ${summary.prose_wording.lineCount} lines`);
console.log(`\nDistinct path pairs (${summary.path_substitution.distinctPaths.length}):`);
for (const p of summary.path_substitution.distinctPaths) {
  console.log(`  ${p.claude}  <->  ${p.codex}  [${p.variable}]`);
}
console.log(`\nDistinct agent name prefixes (${summary.agent_name_prefix.distinctPrefixes.length}):`);
for (const p of summary.agent_name_prefix.distinctPrefixes) {
  console.log(`  ${p}`);
}
