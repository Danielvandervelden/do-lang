#!/usr/bin/env node

/**
 * Project State Management Script
 *
 * Authoritative state-machine implementation for /do:project nodes.
 * Implements what project-state-machine.md specifies — any divergence is a bug
 * in this script, not the doc.
 *
 * The inline TRANSITION_TABLE const is the RUNTIME source of truth.
 * project-state-machine.md is the HUMAN-AUTHORITATIVE spec.
 * A drift-detection test in project-state.test.cjs asserts set equality between them.
 *
 * Atomicity: every state-mutating op uses .tmp-<basename> + fs.renameSync per
 * skills/do/scripts/debug-session.cjs L120-131.
 *
 * Changelog: every state write appends to .do/projects/<slug>/changelog.md via
 * fs.appendFileSync (atomic for POSIX writes ≤ PIPE_BUF). The append happens AFTER
 * the frontmatter rename — state is authoritative even if the log is lossy.
 *
 * Confidence is NOT consulted. Transition validation does not read confidence.score.
 * null scores do not block set / abandon / restore-from-abandoned.
 *
 * Usage:
 *   node project-state.cjs status <project_slug>
 *   node project-state.cjs set <node-type> <path> <status=X|scope=X>
 *   node project-state.cjs abandon <node-type> <path>
 *   node project-state.cjs restore-from-abandoned <project_slug>
 *
 * @module project-state
 */

'use strict';

const fs = require('fs');
const path = require('path');

let matter;
try {
  matter = require('gray-matter');
} catch {
  matter = null;
}

const { validateSlug, validatePrefixedSlug, validateNodePath } = require('./lib/validate-slug.cjs');

// ---------------------------------------------------------------------------
// Transition tables
// NOTE: This const is the runtime source of truth (authoritative).
// project-state-machine.md §(d) is the human spec; a drift-detection test
// asserts set equality between them.
//
// Format:
//   STATUS_TRANSITIONS[nodeType][from] = Set<to>
//   SCOPE_TRANSITIONS[from] = Set<to>  (applies to phase + wave only)
// ---------------------------------------------------------------------------

/**
 * Legal status transitions.
 * DRIFT_LOCK: project-state-machine.md §(d) "Status Transitions" is the human spec.
 * The drift-detection test in project-state.test.cjs parses §(d) and asserts equality.
 */
const STATUS_TRANSITIONS = {
  project: {
    intake:      new Set(['planning']),
    planning:    new Set(['in_progress', 'abandoned']),
    in_progress: new Set(['blocked', 'completed', 'abandoned']),
    blocked:     new Set(['in_progress', 'abandoned']),
    completed:   new Set([]),
    abandoned:   new Set([]),
  },
  phase: {
    planning:    new Set(['in_progress', 'abandoned']),
    in_progress: new Set(['blocked', 'completed', 'abandoned']),
    blocked:     new Set(['in_progress', 'abandoned']),
    completed:   new Set([]),
    abandoned:   new Set([]),
  },
  wave: {
    planning:    new Set(['in_progress', 'abandoned']),
    in_progress: new Set(['blocked', 'completed', 'abandoned']),
    blocked:     new Set(['in_progress', 'abandoned']),
    completed:   new Set([]),
    abandoned:   new Set([]),
  },
};

/**
 * Legal scope transitions (phase + wave only; project has no scope field).
 * 'in_scope -> out_of_scope' is gated by status check (only from planning|blocked).
 * DRIFT_LOCK: project-state-machine.md §(d) "Scope Transitions" is the human spec.
 */
const SCOPE_TRANSITIONS = {
  in_scope:     new Set(['out_of_scope']),
  out_of_scope: new Set(['in_scope']),
};

// Statuses that allow in_scope -> out_of_scope transition
const OUT_OF_SCOPE_ALLOWED_FROM = new Set(['planning', 'blocked']);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function readJsonSafe(filePath) {
  const c = readFileSafe(filePath);
  if (!c) return null;
  try { return JSON.parse(c); } catch { return null; }
}

/**
 * Atomic write: write to .tmp-<basename>, then rename to target.
 * Prevents corruption if write is interrupted.
 */
function atomicWrite(targetPath, content) {
  const tmpPath = path.join(path.dirname(targetPath), `.tmp-${path.basename(targetPath)}`);
  fs.writeFileSync(tmpPath, content, 'utf8');
  fs.renameSync(tmpPath, targetPath);
}

/**
 * Parse frontmatter from a markdown file.
 * Uses gray-matter if available, falls back to simple regex parser.
 */
function parseFrontmatter(filePath) {
  const content = readFileSafe(filePath);
  if (!content) return null;
  if (matter) {
    const parsed = matter(content);
    return { data: parsed.data, content: parsed.content, orig: content };
  }
  // Simple fallback parser
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return null;
  const data = parseSimpleYaml(match[1]);
  return { data, content: match[2], orig: content };
}

function parseSimpleYaml(yamlStr) {
  const obj = {};
  const lines = yamlStr.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/);
    if (m) {
      const key = m[1];
      const val = m[2].trim();
      if (val === 'null' || val === '') obj[key] = null;
      else if (val === 'true') obj[key] = true;
      else if (val === 'false') obj[key] = false;
      else obj[key] = val;
    }
  }
  return obj;
}

/**
 * Serialize frontmatter back to markdown.
 * Uses gray-matter if available.
 */
function serializeFrontmatter(data, bodyContent) {
  if (matter) {
    return matter.stringify(bodyContent || '', data);
  }
  // Simple fallback
  const yaml = Object.entries(data).map(([k, v]) => {
    if (v === null) return `${k}: null`;
    if (typeof v === 'boolean') return `${k}: ${v}`;
    if (typeof v === 'string') return `${k}: ${v}`;
    if (typeof v === 'number') return `${k}: ${v}`;
    return `${k}: ${JSON.stringify(v)}`;
  }).join('\n');
  return `---\n${yaml}\n---\n${bodyContent || ''}`;
}

/**
 * Update a single frontmatter field atomically.
 */
function updateFrontmatterField(filePath, updates) {
  const parsed = parseFrontmatter(filePath);
  if (!parsed) throw new Error(`Cannot parse frontmatter: ${filePath}`);
  const newData = Object.assign({}, parsed.data, updates);
  const newContent = serializeFrontmatter(newData, parsed.content);
  atomicWrite(filePath, newContent);
  return { prev: parsed.data, next: newData };
}

/**
 * Append a changelog line.
 * Append happens AFTER frontmatter rename (state is authoritative even if log is lossy).
 */
function appendChangelog(changelogPath, line) {
  fs.appendFileSync(changelogPath, line + '\n', 'utf8');
}

/**
 * Build a changelog transition line.
 */
function changelogLine(nodeType, slug, oldVal, newVal, reason) {
  const ts = new Date().toISOString();
  return `${ts}  ${nodeType}:${slug}  ${oldVal} -> ${newVal}  reason: ${reason}`;
}

/**
 * Check if a phase has all in-scope waves completed.
 */
function allInScopeWavesCompleted(phaseDir) {
  const wavesDir = path.join(phaseDir, 'waves');
  if (!fs.existsSync(wavesDir)) return true;
  const entries = fs.readdirSync(wavesDir);
  for (const entry of entries) {
    const waveMdPath = path.join(wavesDir, entry, 'wave.md');
    if (!fs.existsSync(waveMdPath)) continue;
    const parsed = parseFrontmatter(waveMdPath);
    if (!parsed) continue;
    const { scope, status } = parsed.data;
    if (scope === 'out_of_scope') continue; // ignored
    if (status !== 'completed') return false;
  }
  return true;
}

/**
 * Check if a project has all in-scope phases completed.
 */
function allInScopePhasesCompleted(projectDir) {
  const phasesDir = path.join(projectDir, 'phases');
  if (!fs.existsSync(phasesDir)) return true;
  const entries = fs.readdirSync(phasesDir);
  for (const entry of entries) {
    const phaseMdPath = path.join(phasesDir, entry, 'phase.md');
    if (!fs.existsSync(phaseMdPath)) continue;
    const parsed = parseFrontmatter(phaseMdPath);
    if (!parsed) continue;
    const { scope, status } = parsed.data;
    if (scope === 'out_of_scope') continue; // ignored
    if (status !== 'completed') return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Op: check (read-only queries for skill orchestration)
// ---------------------------------------------------------------------------

function opCheck(projectsDir, checkType, checkArgs, projectSlug) {
  const projectDir = path.join(projectsDir, projectSlug);
  if (!fs.existsSync(projectDir)) {
    throw { error: 'notFound', reason: `Project directory not found: ${projectSlug}` };
  }

  if (checkType === 'waves-complete') {
    const phaseSlug = checkArgs[0];
    if (!phaseSlug) throw { error: 'missingArg', reason: 'waves-complete requires: <phase-slug>' };
    const wavesDir = path.join(projectDir, 'phases', phaseSlug, 'waves');
    const waves = listLeafNodes(wavesDir, 'wave.md');
    const incomplete = waves.filter(w => w.scope === 'in_scope' && w.status !== 'completed');
    const result = { complete: incomplete.length === 0, incomplete, all: waves };
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');

  } else if (checkType === 'next-planning-phase') {
    const phasesDir = path.join(projectDir, 'phases');
    const phases = listLeafNodes(phasesDir, 'phase.md');
    const next = phases.find(p => p.scope === 'in_scope' && p.status === 'planning') || null;
    const result = { found: !!next, slug: next ? next.slug : null, phases };
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');

  } else if (checkType === 'next-planning-wave') {
    const phaseSlug = checkArgs[0];
    if (!phaseSlug) throw { error: 'missingArg', reason: 'next-planning-wave requires: <phase-slug>' };
    const wavesDir = path.join(projectDir, 'phases', phaseSlug, 'waves');
    const waves = listLeafNodes(wavesDir, 'wave.md');
    const next = waves.find(w => w.scope === 'in_scope' && w.status === 'planning') || null;
    const result = { found: !!next, slug: next ? next.slug : null, waves };
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');

  } else {
    throw { error: 'unknownCheckType', reason: `Unknown check type: ${checkType}. Valid: waves-complete, next-planning-phase, next-planning-wave` };
  }
}

function listLeafNodes(dir, filename) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(d => fs.statSync(path.join(dir, d)).isDirectory())
    .map(slug => {
      const filePath = path.join(dir, slug, filename);
      if (!fs.existsSync(filePath)) return null;
      const parsed = parseFrontmatter(filePath);
      if (!parsed) return null;
      return { slug, status: parsed.data.status, scope: parsed.data.scope };
    })
    .filter(Boolean)
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

function findConfigPath(projectPath) {
  return path.join(projectPath, '.do', 'config.json');
}

function clearActiveProjectInConfig(configPath, slug) {
  const config = readJsonSafe(configPath);
  if (!config) return;
  if (config.active_project !== slug) return; // not us, leave alone
  config.active_project = null;
  const tmpPath = path.join(path.dirname(configPath), `.tmp-${path.basename(configPath)}`);
  fs.writeFileSync(tmpPath, JSON.stringify(config, null, 2), 'utf8');
  fs.renameSync(tmpPath, configPath);
}

// ---------------------------------------------------------------------------
// Op: status
// ---------------------------------------------------------------------------

/**
 * Returns a structured JSON snapshot of the project state.
 * Read-only. No writes.
 */
function opStatus(projectsDir, projectSlug) {
  validateSlug(projectSlug);
  const projectDir = path.join(projectsDir, projectSlug);
  const projectMdPath = path.join(projectDir, 'project.md');
  const projectParsed = parseFrontmatter(projectMdPath);
  if (!projectParsed) {
    throw new Error(`project.md not found at ${projectMdPath}`);
  }
  const { status, active_phase } = projectParsed.data;
  const phasesDir = path.join(projectDir, 'phases');
  const phases = [];
  if (fs.existsSync(phasesDir)) {
    const phaseEntries = fs.readdirSync(phasesDir).sort();
    for (const phaseEntry of phaseEntries) {
      const phaseMdPath = path.join(phasesDir, phaseEntry, 'phase.md');
      if (!fs.existsSync(phaseMdPath)) continue;
      const phaseParsed = parseFrontmatter(phaseMdPath);
      if (!phaseParsed) continue;
      const { status: pStatus, scope: pScope, active_wave } = phaseParsed.data;
      const wavesDir = path.join(phasesDir, phaseEntry, 'waves');
      const waves = [];
      if (fs.existsSync(wavesDir)) {
        const waveEntries = fs.readdirSync(wavesDir).sort();
        for (const waveEntry of waveEntries) {
          const waveMdPath = path.join(wavesDir, waveEntry, 'wave.md');
          if (!fs.existsSync(waveMdPath)) continue;
          const waveParsed = parseFrontmatter(waveMdPath);
          if (!waveParsed) continue;
          const { status: wStatus, scope: wScope } = waveParsed.data;
          waves.push({ slug: waveEntry, status: wStatus, scope: wScope });
        }
      }
      phases.push({ slug: phaseEntry, status: pStatus, scope: pScope, active_wave: active_wave || null, waves });
    }
  }
  return { project: { status, active_phase: active_phase || null }, phases };
}

// ---------------------------------------------------------------------------
// Op: set
// ---------------------------------------------------------------------------

/**
 * Resolve a node's markdown file path without throwing for non-project nodes.
 * For phase/wave, requires projectSlug to be provided.
 * @param {string} projectsDir
 * @param {string} nodeType - 'project' | 'phase' | 'wave'
 * @param {string[]} segments - validated path segments
 * @param {string|null} projectSlug - required for phase/wave
 * @returns {string} absolute path to the node's .md file
 */
function resolveNodeFilePath(projectsDir, nodeType, segments, projectSlug) {
  if (nodeType === 'project') {
    return path.join(projectsDir, segments[0], 'project.md');
  }
  if (!projectSlug) {
    throw { error: 'missingArg', reason: 'phase/wave ops require projectSlug context' };
  }
  if (nodeType === 'phase') {
    return path.join(projectsDir, projectSlug, 'phases', segments[0], 'phase.md');
  }
  if (nodeType === 'wave') {
    return path.join(projectsDir, projectSlug, 'phases', segments[0], 'waves', segments[1], 'wave.md');
  }
  throw { error: 'invalidNodeType', reason: `Unknown node type: ${nodeType}` };
}

/**
 * Set status or scope on a node. Validates transition against the state machine.
 * @param {string} projectsDir - absolute path to .do/projects/
 * @param {string} nodeType - 'project' | 'phase' | 'wave'
 * @param {string} nodePath - slug or slash-delimited path
 * @param {string} mutation - 'status=<value>' or 'scope=<value>'
 * @param {string|null} changelogPath - optional changelog file path
 * @param {string|null} reason - optional reason string for changelog
 * @param {string|null} projectSlug - required for phase/wave to resolve the file path
 */
function opSet(projectsDir, nodeType, nodePath, mutation, changelogPath, reason, projectSlug) {
  // Validate path
  let segments;
  if (nodeType === 'project') {
    segments = [validateSlug(nodePath)];
  } else {
    segments = validateNodePath(nodeType, nodePath);
  }

  // Parse mutation (status=X or scope=X)
  const statusMatch = mutation.match(/^status=(.+)$/);
  const scopeMatch = mutation.match(/^scope=(.+)$/);
  if (!statusMatch && !scopeMatch) {
    const err = { error: 'invalidMutation', reason: 'mutation must be status=<value> or scope=<value>', value: mutation };
    process.stderr.write(JSON.stringify(err) + '\n');
    process.exit(1);
  }

  // Resolve the file path using unified helper (no throw for non-project nodes)
  const effectiveProjectSlug = nodeType === 'project' ? segments[0] : projectSlug;
  const filePath = resolveNodeFilePath(projectsDir, nodeType, segments, effectiveProjectSlug);

  if (scopeMatch) {
    // Scope mutation
    if (nodeType === 'project') {
      const err = { error: 'illegalTarget', reason: 'project has no scope field', node_type: nodeType };
      process.stderr.write(JSON.stringify(err) + '\n');
      process.exit(1);
    }
    const newScope = scopeMatch[1];
    const parsed = parseFrontmatter(filePath);
    if (!parsed) { process.stderr.write(JSON.stringify({ error: 'fileNotFound', path: filePath }) + '\n'); process.exit(1); }
    const oldScope = parsed.data.scope || 'in_scope';
    if (oldScope === newScope) {
      const result = { node_type: nodeType, path: nodePath, old: oldScope, new: newScope, changed: false };
      process.stdout.write(JSON.stringify(result) + '\n');
      return result;
    }
    // Validate scope transition
    if (!SCOPE_TRANSITIONS[oldScope] || !SCOPE_TRANSITIONS[oldScope].has(newScope)) {
      const err = { error: 'illegalScopeTransition', from: oldScope, to: newScope, node_type: nodeType, path: nodePath };
      process.stderr.write(JSON.stringify(err) + '\n');
      process.exit(1);
    }
    // Additional guard: in_scope -> out_of_scope only from planning|blocked
    if (oldScope === 'in_scope' && newScope === 'out_of_scope') {
      const currentStatus = parsed.data.status;
      if (!OUT_OF_SCOPE_ALLOWED_FROM.has(currentStatus)) {
        const err = { error: 'illegalScopeTransition', from: oldScope, to: newScope, node_type: nodeType, path: nodePath, reason: `node status is '${currentStatus}'; must be planning or blocked to go out_of_scope` };
        process.stderr.write(JSON.stringify(err) + '\n');
        process.exit(1);
      }
    }
    updateFrontmatterField(filePath, { scope: newScope });
    const cLine = changelogLine(nodeType, segments.join('/'), oldScope, newScope, reason || 'scope change');
    if (changelogPath && fs.existsSync(path.dirname(changelogPath))) {
      appendChangelog(changelogPath, cLine);
    }
    const result = { node_type: nodeType, path: nodePath, field: 'scope', old: oldScope, new: newScope };
    process.stdout.write(JSON.stringify(result) + '\n');
    return result;
  }

  // Status mutation
  const newStatus = statusMatch[1];
  const parsedStatus = parseFrontmatter(filePath);
  if (!parsedStatus) { process.stderr.write(JSON.stringify({ error: 'fileNotFound', path: filePath }) + '\n'); process.exit(1); }
  const oldStatus = parsedStatus.data.status;
  const parsed = parsedStatus;

  // Validate transition
  const transitions = STATUS_TRANSITIONS[nodeType];
  if (!transitions || !transitions[oldStatus] || !transitions[oldStatus].has(newStatus)) {
    const err = { error: 'illegalTransition', from: oldStatus, to: newStatus, node_type: nodeType, path: nodePath };
    process.stderr.write(JSON.stringify(err) + '\n');
    process.exit(1);
  }

  // Additional guards
  if (newStatus === 'in_progress') {
    const scope = parsed.data.scope;
    if (scope === 'out_of_scope') {
      const err = { error: 'illegalTransition', from: oldStatus, to: newStatus, node_type: nodeType, path: nodePath, reason: 'cannot set in_progress on out_of_scope node' };
      process.stderr.write(JSON.stringify(err) + '\n');
      process.exit(1);
    }
  }

  // Completion rule checks
  if (newStatus === 'completed') {
    if (nodeType === 'phase') {
      const phaseDir = path.dirname(filePath);
      if (!allInScopeWavesCompleted(phaseDir)) {
        const err = { error: 'illegalTransition', from: oldStatus, to: newStatus, node_type: nodeType, path: nodePath, reason: 'not all in-scope waves are completed' };
        process.stderr.write(JSON.stringify(err) + '\n');
        process.exit(1);
      }
    }
    if (nodeType === 'project') {
      const projectDir = path.dirname(filePath);
      if (!allInScopePhasesCompleted(projectDir)) {
        const err = { error: 'illegalTransition', from: oldStatus, to: newStatus, node_type: nodeType, path: nodePath, reason: 'not all in-scope phases are completed' };
        process.stderr.write(JSON.stringify(err) + '\n');
        process.exit(1);
      }
    }
  }

  // PRE-FLIGHT: destination-collision guard for project completion (MUST run before any write)
  let completedProjectDir = null;
  let completedDestDir = null;
  if (nodeType === 'project' && newStatus === 'completed') {
    const projectSlug = segments[0];
    completedProjectDir = path.join(projectsDir, projectSlug);
    completedDestDir = path.join(projectsDir, 'completed', projectSlug);
    if (fs.existsSync(completedDestDir)) {
      const err = { error: 'completedDestinationExists', dest: completedDestDir };
      process.stderr.write(JSON.stringify(err) + '\n');
      process.exit(1);
    }
  }

  updateFrontmatterField(filePath, { status: newStatus });
  const cLine = changelogLine(nodeType, segments.join('/'), oldStatus, newStatus, reason || 'set');
  if (changelogPath && fs.existsSync(path.dirname(changelogPath))) {
    appendChangelog(changelogPath, cLine);
  }

  // Project-level completion: move folder to completed/
  if (completedProjectDir && completedDestDir) {
    fs.mkdirSync(path.join(projectsDir, 'completed'), { recursive: true });
    fs.renameSync(completedProjectDir, completedDestDir);
    // Clear active_project if matches
    const configPath = path.join(path.dirname(projectsDir), 'config.json');
    if (fs.existsSync(configPath)) {
      clearActiveProjectInConfig(configPath, segments[0]);
    }
  }

  const result = { node_type: nodeType, path: nodePath, field: 'status', old: oldStatus, new: newStatus };
  process.stdout.write(JSON.stringify(result) + '\n');
  return result;
}

// ---------------------------------------------------------------------------
// Op: abandon
// ---------------------------------------------------------------------------

/**
 * Abandon a node and cascade to all in-scope descendants.
 * Records pre_abandon_status on each node, sets status: abandoned.
 * For project: moves folder to archived/, clears config.active_project.
 * @param {string} projectsDir - absolute path to .do/projects/
 * @param {string} nodeType - 'project' | 'phase' | 'wave'
 * @param {string} nodePath - slug or slash-delimited path
 * @param {string|null} changelogPath - optional changelog file path
 * @param {string|null} reason - optional reason string for changelog
 * @param {string|null} projectSlug - required for phase/wave to resolve the file path
 */
function opAbandon(projectsDir, nodeType, nodePath, changelogPath, reason, projectSlug) {
  let segments;
  if (nodeType === 'project') {
    segments = [validateSlug(nodePath)];
  } else {
    segments = validateNodePath(nodeType, nodePath);
  }

  // Resolve the file path using unified helper (matching opSet's pattern)
  const effectiveProjectSlug = nodeType === 'project' ? segments[0] : projectSlug;
  const filePath = resolveNodeFilePath(projectsDir, nodeType, segments, effectiveProjectSlug);
  const parsed = parseFrontmatter(filePath);
  if (!parsed) { process.stderr.write(JSON.stringify({ error: 'fileNotFound', path: filePath }) + '\n'); process.exit(1); }

  const abandonedNodes = [];

  function abandonNode(fp, ntLabel, slugLabel) {
    const p = parseFrontmatter(fp);
    if (!p) return;
    // Idempotent: skip if pre_abandon_status already set
    if (p.data.pre_abandon_status !== null && p.data.pre_abandon_status !== undefined) return;
    const prevStatus = p.data.status;
    updateFrontmatterField(fp, { pre_abandon_status: prevStatus, status: 'abandoned' });
    const cLine = changelogLine(ntLabel, slugLabel, prevStatus, 'abandoned', reason || 'abandon');
    const cpDir = changelogPath ? path.dirname(changelogPath) : null;
    if (changelogPath && cpDir && fs.existsSync(cpDir)) {
      appendChangelog(changelogPath, cLine);
    }
    abandonedNodes.push({ node_type: ntLabel, slug: slugLabel, prev_status: prevStatus });
  }

  if (nodeType === 'project') {
    const projectSlug = segments[0];
    const projectDir = path.join(projectsDir, projectSlug);
    // PRE-FLIGHT: destination-collision guard for archive move (MUST run before any write)
    const archivedDir = path.join(projectsDir, 'archived', projectSlug);
    if (fs.existsSync(archivedDir)) {
      const err = { error: 'archiveDestinationExists', dest: archivedDir };
      process.stderr.write(JSON.stringify(err) + '\n');
      process.exit(1);
    }
    // Abandon project node itself
    abandonNode(filePath, 'project', projectSlug);
    // Cascade to in-scope phases and their in-scope waves
    const phasesDir = path.join(projectDir, 'phases');
    if (fs.existsSync(phasesDir)) {
      for (const phaseEntry of fs.readdirSync(phasesDir).sort()) {
        const phaseMdPath = path.join(phasesDir, phaseEntry, 'phase.md');
        if (!fs.existsSync(phaseMdPath)) continue;
        const phaseParsed = parseFrontmatter(phaseMdPath);
        if (!phaseParsed) continue;
        if (phaseParsed.data.scope === 'out_of_scope') continue;
        abandonNode(phaseMdPath, 'phase', phaseEntry);
        const wavesDir = path.join(phasesDir, phaseEntry, 'waves');
        if (fs.existsSync(wavesDir)) {
          for (const waveEntry of fs.readdirSync(wavesDir).sort()) {
            const waveMdPath = path.join(wavesDir, waveEntry, 'wave.md');
            if (!fs.existsSync(waveMdPath)) continue;
            const waveParsed = parseFrontmatter(waveMdPath);
            if (!waveParsed) continue;
            if (waveParsed.data.scope === 'out_of_scope') continue;
            abandonNode(waveMdPath, 'wave', `${phaseEntry}/${waveEntry}`);
          }
        }
      }
    }
    // Move folder to archived/
    fs.mkdirSync(path.join(projectsDir, 'archived'), { recursive: true });
    fs.renameSync(projectDir, archivedDir);
    // Clear active_project if matches
    const configPath = path.join(path.dirname(projectsDir), 'config.json');
    if (fs.existsSync(configPath)) {
      clearActiveProjectInConfig(configPath, projectSlug);
    }
  } else if (nodeType === 'phase') {
    // Cascade: phase + in-scope waves
    // filePath is already resolved via resolveNodeFilePath with effectiveProjectSlug
    const phaseDir = path.dirname(filePath);
    if (parsed.data.scope !== 'out_of_scope') {
      abandonNode(filePath, 'phase', segments[0]);
    }
    const wavesDir = path.join(phaseDir, 'waves');
    if (fs.existsSync(wavesDir)) {
      for (const waveEntry of fs.readdirSync(wavesDir).sort()) {
        const waveMdPath = path.join(wavesDir, waveEntry, 'wave.md');
        if (!fs.existsSync(waveMdPath)) continue;
        const waveParsed = parseFrontmatter(waveMdPath);
        if (!waveParsed) continue;
        if (waveParsed.data.scope === 'out_of_scope') continue;
        abandonNode(waveMdPath, 'wave', `${segments[0]}/${waveEntry}`);
      }
    }
  } else if (nodeType === 'wave') {
    abandonNode(filePath, 'wave', segments.join('/'));
  }

  const result = { abandoned: abandonedNodes };
  process.stdout.write(JSON.stringify(result) + '\n');
  return result;
}

// ---------------------------------------------------------------------------
// Op: restore-from-abandoned
// ---------------------------------------------------------------------------

/**
 * Restore a project from abandoned state.
 * Moves archived/<slug>/ back to projects/<slug>/, then restores per-node status.
 * Does NOT re-set config.active_project — caller decides.
 */
function opRestoreFromAbandoned(projectsDir, projectSlug) {
  validateSlug(projectSlug);
  const archivedDir = path.join(projectsDir, 'archived', projectSlug);
  const destDir = path.join(projectsDir, projectSlug);

  // Move folder back BEFORE writing frontmatter
  if (!fs.existsSync(archivedDir)) {
    const err = { error: 'archiveNotFound', slug: projectSlug, expected: archivedDir };
    process.stderr.write(JSON.stringify(err) + '\n');
    process.exit(1);
  }
  if (fs.existsSync(destDir)) {
    const err = { error: 'restoreDestinationExists', dest: destDir };
    process.stderr.write(JSON.stringify(err) + '\n');
    process.exit(1);
  }
  fs.renameSync(archivedDir, destDir);

  const restoredNodes = [];
  const changelogPath = path.join(destDir, 'changelog.md');

  function restoreNode(fp, ntLabel, slugLabel) {
    const p = parseFrontmatter(fp);
    if (!p) return;
    const preAbandoned = p.data.pre_abandon_status;
    if (preAbandoned === null || preAbandoned === undefined) return; // already restored or never abandoned
    updateFrontmatterField(fp, { status: preAbandoned, pre_abandon_status: null });
    const cLine = changelogLine(ntLabel, slugLabel, 'abandoned', preAbandoned, 'restore-from-abandoned');
    if (fs.existsSync(path.dirname(changelogPath))) {
      appendChangelog(changelogPath, cLine);
    }
    restoredNodes.push({ node_type: ntLabel, slug: slugLabel, restored_status: preAbandoned });
  }

  const projectMdPath = path.join(destDir, 'project.md');
  restoreNode(projectMdPath, 'project', projectSlug);

  const phasesDir = path.join(destDir, 'phases');
  if (fs.existsSync(phasesDir)) {
    for (const phaseEntry of fs.readdirSync(phasesDir).sort()) {
      const phaseMdPath = path.join(phasesDir, phaseEntry, 'phase.md');
      if (!fs.existsSync(phaseMdPath)) continue;
      const phaseParsed = parseFrontmatter(phaseMdPath);
      if (!phaseParsed) continue;
      if (phaseParsed.data.scope === 'out_of_scope') continue;
      restoreNode(phaseMdPath, 'phase', phaseEntry);
      const wavesDir = path.join(phasesDir, phaseEntry, 'waves');
      if (fs.existsSync(wavesDir)) {
        for (const waveEntry of fs.readdirSync(wavesDir).sort()) {
          const waveMdPath = path.join(wavesDir, waveEntry, 'wave.md');
          if (!fs.existsSync(waveMdPath)) continue;
          const waveParsed = parseFrontmatter(waveMdPath);
          if (!waveParsed) continue;
          if (waveParsed.data.scope === 'out_of_scope') continue;
          restoreNode(waveMdPath, 'wave', `${phaseEntry}/${waveEntry}`);
        }
      }
    }
  }

  const result = { restored: restoredNodes };
  process.stdout.write(JSON.stringify(result) + '\n');
  return result;
}

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

/**
 * Resolve node path given explicit project slug.
 */
function resolveNodePathWithProject(projectsDir, projectSlug, nodeType, segments) {
  const projectDir = path.join(projectsDir, projectSlug);
  if (nodeType === 'project') {
    return path.join(projectDir, 'project.md');
  }
  if (nodeType === 'phase') {
    return path.join(projectDir, 'phases', segments[0], 'phase.md');
  }
  if (nodeType === 'wave') {
    return path.join(projectDir, 'phases', segments[0], 'waves', segments[1], 'wave.md');
  }
  throw new Error(`Unknown node type: ${nodeType}`);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

/**
 * Emit structured error to stderr and exit non-zero.
 */
function exitError(obj) {
  process.stderr.write(JSON.stringify(obj) + '\n');
  process.exit(1);
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const op = args[0];

  // Resolve .do/projects/ relative to cwd
  const doProjectsDir = path.join(process.cwd(), '.do', 'projects');

  if (!op) {
    console.error('Usage: node project-state.cjs <op> ...');
    process.exit(1);
  }

  try {
    if (op === 'status') {
      const projectSlug = args[1];
      if (!projectSlug) exitError({ error: 'missingArg', reason: 'project_slug required' });
      try { validateSlug(projectSlug); } catch (e) { exitError(e); }
      const result = opStatus(doProjectsDir, projectSlug);
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');

    } else if (op === 'set') {
      // set <node-type> <path> <status=X|scope=X> [--project <slug>]
      // Delegates fully to opSet — single implementation, no duplication.
      const nodeType = args[1];
      const nodePath = args[2];
      const mutation = args[3];
      if (!nodeType || !nodePath || !mutation) {
        exitError({ error: 'missingArg', reason: 'set requires: <node-type> <path> <status=X|scope=X>' });
      }
      if (!['project', 'phase', 'wave'].includes(nodeType)) {
        exitError({ error: 'invalidNodeType', reason: `node-type must be project|phase|wave, got: ${nodeType}` });
      }

      // For phase/wave we need project context (--project flag or active_project in config)
      let cliProjectSlug = null;
      if (nodeType === 'project') {
        try { cliProjectSlug = validateSlug(nodePath); } catch (e) { exitError(e); }
      } else {
        const projFlagIdx = args.indexOf('--project');
        cliProjectSlug = projFlagIdx >= 0 ? args[projFlagIdx + 1] : null;
        if (!cliProjectSlug) {
          const configPath = path.join(process.cwd(), '.do', 'config.json');
          const config = readJsonSafe(configPath);
          cliProjectSlug = config && config.active_project ? config.active_project : null;
        }
        if (!cliProjectSlug) exitError({ error: 'missingArg', reason: 'phase/wave ops require --project <slug> or active_project in config' });
        try { validateSlug(cliProjectSlug); } catch (e) { exitError(e); }
      }

      const cliChangelogPath = path.join(doProjectsDir, cliProjectSlug, 'changelog.md');
      opSet(doProjectsDir, nodeType, nodePath, mutation, cliChangelogPath, 'set', cliProjectSlug);

    } else if (op === 'abandon') {
      const nodeType = args[1];
      const nodePath = args[2];
      if (!nodeType || !nodePath) exitError({ error: 'missingArg', reason: 'abandon requires: <node-type> <path>' });
      if (!['project', 'phase', 'wave'].includes(nodeType)) {
        exitError({ error: 'invalidNodeType', reason: `node-type must be project|phase|wave, got: ${nodeType}` });
      }

      // For phase/wave we need project context (--project flag or active_project in config)
      // Matching the same pattern used for the 'set' CLI handler.
      let cliProjectSlug = null;
      if (nodeType === 'project') {
        try { cliProjectSlug = validateSlug(nodePath); } catch (e) { exitError(e); }
      } else {
        const projFlagIdx = args.indexOf('--project');
        cliProjectSlug = projFlagIdx >= 0 ? args[projFlagIdx + 1] : null;
        if (!cliProjectSlug) {
          const configPath = path.join(process.cwd(), '.do', 'config.json');
          const config = readJsonSafe(configPath);
          cliProjectSlug = config && config.active_project ? config.active_project : null;
        }
        if (!cliProjectSlug) exitError({ error: 'missingArg', reason: 'phase/wave ops require --project <slug> or active_project in config' });
        try { validateSlug(cliProjectSlug); } catch (e) { exitError(e); }
      }

      const cliChangelogPath = path.join(doProjectsDir, cliProjectSlug, 'changelog.md');
      // Delegate fully to opAbandon — single implementation, no duplication.
      opAbandon(doProjectsDir, nodeType, nodePath, cliChangelogPath, 'abandon', cliProjectSlug);

    } else if (op === 'check') {
      const checkType = args[1];
      if (!checkType) exitError({ error: 'missingArg', reason: 'check requires: <check-type>' });
      const projFlagIdx = args.indexOf('--project');
      let cliProjectSlug = projFlagIdx >= 0 ? args[projFlagIdx + 1] : null;
      if (!cliProjectSlug) {
        const configPath = path.join(process.cwd(), '.do', 'config.json');
        const config = readJsonSafe(configPath);
        cliProjectSlug = config && config.active_project ? config.active_project : null;
      }
      if (!cliProjectSlug) exitError({ error: 'missingArg', reason: 'check requires --project <slug> or active_project in config' });
      try { validateSlug(cliProjectSlug); } catch (e) { exitError(e); }
      const checkArgs = args.slice(2).filter(a => a !== '--project' && a !== cliProjectSlug);
      opCheck(doProjectsDir, checkType, checkArgs, cliProjectSlug);

    } else if (op === 'restore-from-abandoned') {
      const projectSlug = args[1];
      if (!projectSlug) exitError({ error: 'missingArg', reason: 'restore-from-abandoned requires: <project_slug>' });
      try { validateSlug(projectSlug); } catch (e) { exitError(e); }
      opRestoreFromAbandoned(doProjectsDir, projectSlug);

    } else {
      exitError({ error: 'unknownOp', reason: `Unknown operation: ${op}` });
    }
  } catch (e) {
    if (e && e.error) {
      exitError(e);
    } else {
      process.stderr.write((e && e.message ? e.message : String(e)) + '\n');
      process.exit(1);
    }
  }
}

// ---------------------------------------------------------------------------
// Exports for testing
// ---------------------------------------------------------------------------

module.exports = {
  STATUS_TRANSITIONS,
  SCOPE_TRANSITIONS,
  OUT_OF_SCOPE_ALLOWED_FROM,
  parseFrontmatter,
  serializeFrontmatter,
  atomicWrite,
  appendChangelog,
  changelogLine,
  allInScopeWavesCompleted,
  allInScopePhasesCompleted,
  opStatus,
  opSet,
  opAbandon,
  opRestoreFromAbandoned,
  resolveNodePathWithProject,
  resolveNodeFilePath,
  updateFrontmatterField,
  clearActiveProjectInConfig,
  opCheck,
  listLeafNodes,
};
