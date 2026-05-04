#!/usr/bin/env node
"use strict";

/**
 * audit-pairs.cjs
 *
 * Compares all file pairs across skills/do/, skills/codex/, and agents/.
 * Produces audit-report.md with classification and diff summaries.
 *
 * Usage:
 *   node .do/projects/skill-tree-dedup/scripts/audit-pairs.cjs
 *   node .do/projects/skill-tree-dedup/scripts/audit-pairs.cjs > .do/projects/skill-tree-dedup/audit-report.md
 */

const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const repoRoot = path.join(__dirname, "..", "..", "..", "..");
const doRefsDir = path.join(repoRoot, "skills", "do", "references");
const codexRefsDir = path.join(repoRoot, "skills", "codex", "references");
const doSkillsDir = path.join(repoRoot, "skills", "do");
const codexSkillsDir = path.join(repoRoot, "skills", "codex");
const agentsDir = path.join(repoRoot, "agents");

// Subdirectories to exclude from root-level skill pairing
const SKILLS_EXCLUDED_SUBDIRS = new Set(["references", "scripts", "__tests__"]);

// Expected totals from project-level manual audit
const EXPECTED = {
  references: { identical: 22, divergent: 25, total: 47 },
  skills: { identical: 1, divergent: 12, total: 13 },
  agents: { identical: 0, divergent: 8, total: 8 },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Read .md files from a directory (non-recursive).
 * Returns a Set of filenames.
 */
function listMdFiles(dir) {
  if (!fs.existsSync(dir)) return new Set();
  return new Set(
    fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".md") && fs.statSync(path.join(dir, f)).isFile())
  );
}

/**
 * Read all entries in a directory (non-recursive), returning subdirectory names.
 */
function listSubdirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => fs.statSync(path.join(dir, f)).isDirectory());
}

/**
 * Compare two files by content. Returns true if byte-identical.
 */
function areIdentical(fileA, fileB) {
  if (!fs.existsSync(fileA) || !fs.existsSync(fileB)) return false;
  const a = fs.readFileSync(fileA);
  const b = fs.readFileSync(fileB);
  return a.equals(b);
}

/**
 * Produce a simplified line-level diff between two text files.
 * Returns an array of { type: 'removed'|'added', line } objects (max ~20 entries).
 */
function computeDiff(fileA, fileB) {
  const linesA = fs.readFileSync(fileA, "utf8").split("\n");
  const linesB = fs.readFileSync(fileB, "utf8").split("\n");

  const diffs = [];
  const maxLen = Math.max(linesA.length, linesB.length);

  for (let i = 0; i < maxLen; i++) {
    const a = linesA[i];
    const b = linesB[i];
    if (a !== b) {
      if (a !== undefined && a !== "") diffs.push({ type: "removed", line: a });
      if (b !== undefined && b !== "") diffs.push({ type: "added", line: b });
    }
  }

  return diffs;
}

/**
 * Truncate a string to maxLen characters, appending "..." if truncated.
 */
function truncate(str, maxLen = 80) {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
}

/**
 * Escape pipe characters for markdown tables.
 */
function mdEscape(str) {
  return str.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

/**
 * Categorize divergences based on diff lines.
 * Returns an array of category strings (deduped).
 */
function categorize(diffs) {
  const cats = new Set();
  const pathSubPatterns = [
    /\.claude\b/,
    /\.codex\b/,
    /commands\/do\b/,
    /skills\/do\b/,
    /skills\/codex\b/,
    /commands\/codex\b/,
  ];
  const agentPrefixPatterns = [/\bdo-[a-z]/, /\bcodex-[a-z]/];
  const agentCallPatterns = [/\bAgent\s*\(/, /agent_call\s*\(/i];

  for (const { line } of diffs) {
    if (pathSubPatterns.some((p) => p.test(line))) {
      cats.add("path substitution");
    }
    if (agentPrefixPatterns.some((p) => p.test(line))) {
      cats.add("agent name prefix");
    }
    if (agentCallPatterns.some((p) => p.test(line))) {
      cats.add("Agent() vs prose spawn");
    }
  }

  if (diffs.length > 0 && cats.size === 0) {
    cats.add("prose wording");
  } else if (diffs.length > 0) {
    // Check if any diffs remain uncategorized after path/agent patterns
    const hasUncat = diffs.some(({ line }) => {
      const matchedByKnown =
        pathSubPatterns.some((p) => p.test(line)) ||
        agentPrefixPatterns.some((p) => p.test(line)) ||
        agentCallPatterns.some((p) => p.test(line));
      return !matchedByKnown && line.trim() !== "";
    });
    if (hasUncat) cats.add("prose wording");
  }

  return [...cats];
}

/**
 * Build a compact diff summary string (at most 3 sample lines, each truncated).
 */
function buildDiffSummary(diffs) {
  if (diffs.length === 0) return "";
  const total = diffs.length;
  const sample = diffs.slice(0, 6);
  const lines = sample.map(({ type, line }) => {
    const prefix = type === "removed" ? "-" : "+";
    return `\`${prefix} ${mdEscape(truncate(line.trim(), 60))}\``;
  });
  const summary = lines.join(", ");
  if (total > 6) {
    return `${summary} _(+${total - 6} more changed lines)_`;
  }
  return summary;
}

// ---------------------------------------------------------------------------
// Pair builders
// ---------------------------------------------------------------------------

/**
 * Build reference pairs: files in skills/do/references/ vs skills/codex/references/.
 * Returns array of { name, doPath, codexPath } where either path may be null.
 */
function buildReferencePairs() {
  const doFiles = listMdFiles(doRefsDir);
  const codexFiles = listMdFiles(codexRefsDir);
  const allNames = new Set([...doFiles, ...codexFiles]);
  return [...allNames].sort().map((name) => ({
    name,
    doPath: doFiles.has(name) ? path.join(doRefsDir, name) : null,
    codexPath: codexFiles.has(name) ? path.join(codexRefsDir, name) : null,
  }));
}

/**
 * Build skill pairs: root-level .md files in skills/do/ vs skills/codex/.
 * Excludes subdirectories listed in SKILLS_EXCLUDED_SUBDIRS.
 */
function buildSkillPairs() {
  const doFiles = listMdFiles(doSkillsDir);
  const codexFiles = listMdFiles(codexSkillsDir);
  const allNames = new Set([...doFiles, ...codexFiles]);
  return [...allNames].sort().map((name) => ({
    name,
    doPath: doFiles.has(name) ? path.join(doSkillsDir, name) : null,
    codexPath: codexFiles.has(name) ? path.join(codexSkillsDir, name) : null,
  }));
}

/**
 * Build agent pairs: do-*.md vs codex-*.md in agents/.
 * Pairs by base name after stripping do-/codex- prefix.
 */
function buildAgentPairs() {
  if (!fs.existsSync(agentsDir)) return [];
  const allFiles = fs.readdirSync(agentsDir).filter((f) => f.endsWith(".md"));
  const doMap = new Map();
  const codexMap = new Map();
  for (const f of allFiles) {
    if (f.startsWith("do-")) {
      doMap.set(f.slice(3), f);
    } else if (f.startsWith("codex-")) {
      codexMap.set(f.slice(6), f);
    }
  }
  const allBases = new Set([...doMap.keys(), ...codexMap.keys()]);
  return [...allBases].sort().map((base) => {
    const doFile = doMap.get(base);
    const codexFile = codexMap.get(base);
    return {
      name: base,
      doPath: doFile ? path.join(agentsDir, doFile) : null,
      codexPath: codexFile ? path.join(agentsDir, codexFile) : null,
      doFile,
      codexFile,
    };
  });
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/**
 * Classify a single pair.
 * Returns { classification, categories, diffs, diffSummary }
 */
function classifyPair(doPath, codexPath) {
  if (!doPath) {
    return {
      classification: "unpaired (codex-only)",
      categories: [],
      diffs: [],
      diffSummary: "",
    };
  }
  if (!codexPath) {
    return {
      classification: "unpaired (do-only)",
      categories: [],
      diffs: [],
      diffSummary: "",
    };
  }
  if (areIdentical(doPath, codexPath)) {
    return {
      classification: "identical",
      categories: [],
      diffs: [],
      diffSummary: "",
    };
  }
  const diffs = computeDiff(doPath, codexPath);
  const categories = categorize(diffs);
  const diffSummary = buildDiffSummary(diffs);
  return { classification: "divergent", categories, diffs, diffSummary };
}

// ---------------------------------------------------------------------------
// Table rendering
// ---------------------------------------------------------------------------

function renderTable(pairs, group) {
  const rows = [];
  for (const pair of pairs) {
    const { classification, categories, diffSummary } = classifyPair(
      pair.doPath,
      pair.codexPath
    );
    const filePairLabel =
      group === "agents"
        ? `do-${pair.name} / codex-${pair.name}`
        : `${pair.name}`;
    const catStr = categories.length > 0 ? categories.join(", ") : "-";
    const summaryStr = diffSummary || "-";
    rows.push({
      filePair: filePairLabel,
      classification,
      categories: catStr,
      diffSummary: summaryStr,
    });
  }

  const header =
    "| File Pair | Classification | Categories | Divergent Lines Summary |";
  const sep =
    "|-----------|---------------|------------|------------------------|";
  const lines = [header, sep];
  for (const row of rows) {
    lines.push(
      `| ${mdEscape(row.filePair)} | ${row.classification} | ${row.categories} | ${row.diffSummary} |`
    );
  }
  return { tableLines: lines, rows };
}

// ---------------------------------------------------------------------------
// Summary counts
// ---------------------------------------------------------------------------

function computeCounts(rows) {
  let identical = 0;
  let divergent = 0;
  let unpairedDoOnly = 0;
  let unpairedCodexOnly = 0;
  const unpairedDoNames = [];
  const unpairedCodexNames = [];

  for (const row of rows) {
    if (row.classification === "identical") identical++;
    else if (row.classification === "divergent") divergent++;
    else if (row.classification === "unpaired (do-only)") {
      unpairedDoOnly++;
      unpairedDoNames.push(row.filePair);
    } else if (row.classification === "unpaired (codex-only)") {
      unpairedCodexOnly++;
      unpairedCodexNames.push(row.filePair);
    }
  }

  const paired = identical + divergent;
  const total = paired + unpairedDoOnly + unpairedCodexOnly;
  return {
    total,
    paired,
    identical,
    divergent,
    unpairedDoOnly,
    unpairedCodexOnly,
    unpairedDoNames,
    unpairedCodexNames,
  };
}

function flagDiscrepancy(label, actual, expected) {
  if (actual === expected) return `${actual} (matches expected ${expected})`;
  return `**${actual}** (expected ${expected} -- DISCREPANCY)`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const lines = [];

  lines.push("# Skill Tree Deduplication Audit Report");
  lines.push("");
  lines.push(`_Generated: ${new Date().toISOString()}_`);
  lines.push("");
  lines.push(
    "This report compares all file pairs across `skills/do/`, `skills/codex/`, and `agents/`."
  );
  lines.push(
    "Each pair is classified as **identical**, **divergent**, **unpaired (do-only)**, or **unpaired (codex-only)**."
  );
  lines.push(
    "Divergent pairs include a diff summary and divergence category tags."
  );
  lines.push("");

  // --- Out-of-scope directories ---
  const doSubdirs = listSubdirs(doSkillsDir).filter((d) =>
    SKILLS_EXCLUDED_SUBDIRS.has(d)
  );
  const codexSubdirs = listSubdirs(codexSkillsDir).filter((d) =>
    SKILLS_EXCLUDED_SUBDIRS.has(d)
  );

  lines.push("## Out-of-Scope Directories");
  lines.push("");
  lines.push(
    "The following subdirectories are excluded from file pairing by design:"
  );
  lines.push("");
  lines.push("| Directory | Reason |");
  lines.push("|-----------|--------|");
  for (const d of [...new Set([...doSubdirs, ...codexSubdirs])]) {
    let reason = "";
    if (d === "references") reason = "Handled separately in the References group below";
    else if (d === "scripts") reason = "`skills/do/scripts/` has no codex counterpart by design — `install.cjs` handles codex script copying separately";
    else if (d === "__tests__") reason = "Test-only directory, no codex counterpart";
    else reason = "Structural directory, out of scope for pairing";
    lines.push(`| \`skills/do/${d}/\` | ${reason} |`);
  }
  // check if codex has unique subdirs
  for (const d of codexSubdirs) {
    if (!doSubdirs.includes(d)) {
      lines.push(`| \`skills/codex/${d}/\` | Structural directory in codex tree only |`);
    }
  }
  lines.push("");

  // =========================================================================
  // Group 1: References
  // =========================================================================
  lines.push("---");
  lines.push("");
  lines.push("## Group 1: References");
  lines.push("");
  lines.push(
    "_Comparing `skills/do/references/*.md` vs `skills/codex/references/*.md`. Pairs matched by filename._"
  );
  lines.push("");

  const refPairs = buildReferencePairs();
  const { tableLines: refTable, rows: refRows } = renderTable(refPairs, "references");
  lines.push(...refTable);
  lines.push("");

  const refCounts = computeCounts(refRows);

  lines.push("### References Summary");
  lines.push("");
  lines.push(`- **Total pairs:** ${flagDiscrepancy("pairs", refCounts.paired, EXPECTED.references.total)}`);
  lines.push(`- **Identical:** ${flagDiscrepancy("identical", refCounts.identical, EXPECTED.references.identical)}`);
  lines.push(`- **Divergent:** ${flagDiscrepancy("divergent", refCounts.divergent, EXPECTED.references.divergent)}`);
  if (refCounts.unpairedDoOnly > 0) {
    lines.push(`- **Unpaired (do-only):** ${refCounts.unpairedDoOnly} — ${refCounts.unpairedDoNames.join(", ")}`);
  }
  if (refCounts.unpairedCodexOnly > 0) {
    lines.push(`- **Unpaired (codex-only):** ${refCounts.unpairedCodexOnly} — ${refCounts.unpairedCodexNames.join(", ")}`);
  }
  if (refCounts.unpairedDoOnly === 0 && refCounts.unpairedCodexOnly === 0) {
    lines.push("- **Unpaired:** none");
  }
  lines.push("");

  // =========================================================================
  // Group 2: Skills
  // =========================================================================
  lines.push("---");
  lines.push("");
  lines.push("## Group 2: Skills");
  lines.push("");
  lines.push(
    "_Comparing root-level `skills/do/*.md` vs `skills/codex/*.md`. Subdirectories (`references/`, `scripts/`, `__tests__/`) are excluded. Pairs matched by filename._"
  );
  lines.push("");

  const skillPairs = buildSkillPairs();
  const { tableLines: skillTable, rows: skillRows } = renderTable(skillPairs, "skills");
  lines.push(...skillTable);
  lines.push("");

  const skillCounts = computeCounts(skillRows);

  lines.push("### Skills Summary");
  lines.push("");
  lines.push(`- **Total pairs:** ${flagDiscrepancy("pairs", skillCounts.paired, EXPECTED.skills.total)}`);
  lines.push(`- **Identical:** ${flagDiscrepancy("identical", skillCounts.identical, EXPECTED.skills.identical)}`);
  lines.push(`- **Divergent:** ${flagDiscrepancy("divergent", skillCounts.divergent, EXPECTED.skills.divergent)}`);
  if (skillCounts.unpairedDoOnly > 0) {
    lines.push(`- **Unpaired (do-only):** ${skillCounts.unpairedDoOnly} — ${skillCounts.unpairedDoNames.join(", ")}`);
  }
  if (skillCounts.unpairedCodexOnly > 0) {
    lines.push(`- **Unpaired (codex-only):** ${skillCounts.unpairedCodexOnly} — ${skillCounts.unpairedCodexNames.join(", ")}`);
  }
  if (skillCounts.unpairedDoOnly === 0 && skillCounts.unpairedCodexOnly === 0) {
    lines.push("- **Unpaired:** none");
  }
  lines.push("");

  // =========================================================================
  // Group 3: Agents
  // =========================================================================
  lines.push("---");
  lines.push("");
  lines.push("## Group 3: Agents");
  lines.push("");
  lines.push(
    "_Comparing `agents/do-*.md` vs `agents/codex-*.md`. Pairs matched by base name after stripping the `do-`/`codex-` prefix._"
  );
  lines.push("");

  const agentPairs = buildAgentPairs();
  const { tableLines: agentTable, rows: agentRows } = renderTable(agentPairs, "agents");
  lines.push(...agentTable);
  lines.push("");

  const agentCounts = computeCounts(agentRows);

  lines.push("### Agents Summary");
  lines.push("");
  lines.push(`- **Total pairs:** ${flagDiscrepancy("pairs", agentCounts.paired, EXPECTED.agents.total)}`);
  lines.push(`- **Identical:** ${flagDiscrepancy("identical", agentCounts.identical, EXPECTED.agents.identical)}`);
  lines.push(`- **Divergent:** ${flagDiscrepancy("divergent", agentCounts.divergent, EXPECTED.agents.divergent)}`);
  if (agentCounts.unpairedDoOnly > 0) {
    lines.push(`- **Unpaired (do-only):** ${agentCounts.unpairedDoOnly} — ${agentCounts.unpairedDoNames.join(", ")}`);
  }
  if (agentCounts.unpairedCodexOnly > 0) {
    lines.push(`- **Unpaired (codex-only):** ${agentCounts.unpairedCodexOnly} — ${agentCounts.unpairedCodexNames.join(", ")}`);
  }
  if (agentCounts.unpairedDoOnly === 0 && agentCounts.unpairedCodexOnly === 0) {
    lines.push("- **Unpaired:** none");
  }
  lines.push("");

  // =========================================================================
  // Overall Summary
  // =========================================================================
  lines.push("---");
  lines.push("");
  lines.push("## Overall Summary");
  lines.push("");

  const totalPaired = refCounts.paired + skillCounts.paired + agentCounts.paired;
  const totalIdentical = refCounts.identical + skillCounts.identical + agentCounts.identical;
  const totalDivergent = refCounts.divergent + skillCounts.divergent + agentCounts.divergent;
  const totalUnpaired =
    refCounts.unpairedDoOnly + refCounts.unpairedCodexOnly +
    skillCounts.unpairedDoOnly + skillCounts.unpairedCodexOnly +
    agentCounts.unpairedDoOnly + agentCounts.unpairedCodexOnly;

  const EXPECTED_TOTAL_PAIRS = 68;
  const EXPECTED_TOTAL_IDENTICAL = 23;
  const EXPECTED_TOTAL_DIVERGENT = 45;

  lines.push("| Group | Total Pairs | Identical | Divergent | Unpaired |");
  lines.push("|-------|------------|-----------|-----------|----------|");
  lines.push(`| References | ${refCounts.paired} | ${refCounts.identical} | ${refCounts.divergent} | ${refCounts.unpairedDoOnly + refCounts.unpairedCodexOnly} |`);
  lines.push(`| Skills | ${skillCounts.paired} | ${skillCounts.identical} | ${skillCounts.divergent} | ${skillCounts.unpairedDoOnly + skillCounts.unpairedCodexOnly} |`);
  lines.push(`| Agents | ${agentCounts.paired} | ${agentCounts.identical} | ${agentCounts.divergent} | ${agentCounts.unpairedDoOnly + agentCounts.unpairedCodexOnly} |`);
  lines.push(`| **Total** | **${totalPaired}** | **${totalIdentical}** | **${totalDivergent}** | **${totalUnpaired}** |`);
  lines.push("");

  lines.push("### Comparison Against Expected Totals");
  lines.push("");
  lines.push(`- **Total pairs:** ${flagDiscrepancy("total", totalPaired, EXPECTED_TOTAL_PAIRS)}`);
  lines.push(`- **Identical:** ${flagDiscrepancy("identical", totalIdentical, EXPECTED_TOTAL_IDENTICAL)}`);
  lines.push(`- **Divergent:** ${flagDiscrepancy("divergent", totalDivergent, EXPECTED_TOTAL_DIVERGENT)}`);
  lines.push("");

  const hasDiscrepancies =
    totalPaired !== EXPECTED_TOTAL_PAIRS ||
    totalIdentical !== EXPECTED_TOTAL_IDENTICAL ||
    totalDivergent !== EXPECTED_TOTAL_DIVERGENT ||
    refCounts.paired !== EXPECTED.references.total ||
    skillCounts.paired !== EXPECTED.skills.total ||
    agentCounts.paired !== EXPECTED.agents.total;

  if (hasDiscrepancies) {
    lines.push("> **NOTE:** One or more counts differ from project-level manual audit expectations.");
    lines.push("> The values above are the authoritative source of truth from this automated audit.");
    lines.push("> Review group-level summaries for details.");
  } else {
    lines.push("> All counts match the project-level manual audit expectations. No discrepancies found.");
  }
  lines.push("");

  const output = lines.join("\n");
  process.stdout.write(output + "\n");
}

main();
