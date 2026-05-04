#!/usr/bin/env node

/**
 * Project Scaffold Script
 *
 * Creates project/phase/wave folder structures with default frontmatter.
 * Scaffold writes frontmatter DIRECTLY for newly-created files — it does NOT
 * go through project-state.cjs. project-state.cjs owns transitions (status
 * mutations on existing files); scaffold owns creates (initial frontmatter write).
 *
 * All ops validate slug inputs via validate-slug.cjs BEFORE any mkdirSync or
 * writeFileSync. Invalid inputs exit non-zero with structured stderr JSON and
 * produce zero side effects.
 *
 * Changelog format: <ISO-timestamp> scaffold:<op>:<full-path-slug>
 * (distinct from project-state.cjs's transition format — the 'scaffold:' prefix
 * is the discriminator; both formats coexist in the same changelog.md)
 *
 * Atomicity: every frontmatter write uses temp-file + rename.
 * On failure mid-op, the caller (β's subcommand handler) is responsible for rollback.
 * This script does NOT silently swallow errors.
 *
 * Usage:
 *   node project-scaffold.cjs project <project_slug>
 *   node project-scaffold.cjs phase <project_slug> <phase_slug>
 *   node project-scaffold.cjs wave <project_slug> <prefixed_phase_slug> <wave_slug>
 *
 * @module project-scaffold
 */

'use strict';

const fs = require('fs');
const path = require('path');

const { validateSlug, validatePrefixedSlug } = require('./lib/validate-slug.cjs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Atomic write: write to .tmp-<basename>, then rename to target.
 */
function atomicWrite(targetPath, content) {
  const tmpPath = path.join(path.dirname(targetPath), `.tmp-${path.basename(targetPath)}`);
  fs.writeFileSync(tmpPath, content, 'utf8');
  fs.renameSync(tmpPath, targetPath);
}

/**
 * Append a scaffold changelog line.
 */
function appendScaffoldChangelog(changelogPath, op, fullPathSlug) {
  const ts = new Date().toISOString();
  const line = `${ts} scaffold:${op}:${fullPathSlug}`;
  fs.appendFileSync(changelogPath, line + '\n', 'utf8');
}

/**
 * Allocate the next NN- prefix in a parent directory.
 * Scans existing child directories for NN- prefix, returns max+1, zero-padded to 2 digits.
 * First child = 01-.
 */
function allocatePrefix(parentDir) {
  let max = 0;
  if (fs.existsSync(parentDir)) {
    const entries = fs.readdirSync(parentDir);
    for (const entry of entries) {
      const m = entry.match(/^(\d{2})-/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > max) max = n;
      }
    }
  }
  return String(max + 1).padStart(2, '0');
}

/**
 * Read frontmatter from a markdown file using gray-matter if available,
 * otherwise a simple regex parser.
 */
let matter;
try {
  matter = require('gray-matter');
} catch {
  matter = null;
}

function parseFrontmatter(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  if (matter) {
    const parsed = matter(content);
    return { data: parsed.data, content: parsed.content, orig: content };
  }
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, content, orig: content };
  return { data: {}, content: match[2], orig: content }; // simplified fallback
}

function serializeFrontmatter(data, bodyContent) {
  if (matter) {
    return matter.stringify(bodyContent || '', data);
  }
  const yaml = Object.entries(data).map(([k, v]) => {
    if (v === null) return `${k}: null`;
    if (typeof v === 'boolean') return `${k}: ${v}`;
    if (typeof v === 'string') return `${k}: ${v}`;
    if (typeof v === 'number') return `${k}: ${v}`;
    if (Array.isArray(v)) return `${k}: []`;
    return `${k}: ${JSON.stringify(v)}`;
  }).join('\n');
  return `---\n${yaml}\n---\n${bodyContent || ''}`;
}

/**
 * Atomically update a parent index file's array field (phases or waves).
 * Appends an entry to the array and bumps the 'updated' timestamp.
 */
function atomicAppendToIndex(indexPath, arrayField, entry) {
  const parsed = parseFrontmatter(indexPath);
  const data = parsed.data || {};
  const existingEntries = Array.isArray(data[arrayField]) ? data[arrayField] : [];
  const newContent = serializeFrontmatter({
    ...data,
    [arrayField]: [...existingEntries, entry],
    updated: new Date().toISOString(),
  }, parsed.content);
  atomicWrite(indexPath, newContent);
}

/**
 * Read template body (strip frontmatter, return body only).
 * Throws a structured error object if the template file is missing.
 * Templates are bundled with the skill; a missing template is an installation error.
 */
function readTemplateBody(templatePath) {
  if (!fs.existsSync(templatePath)) {
    throw { error: 'templateNotFound', path: templatePath };
  }
  const content = fs.readFileSync(templatePath, 'utf-8');
  const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?([\s\S]*)$/);
  return match ? match[1] : content;
}

/**
 * Emit structured error to stderr and exit non-zero.
 */
function exitError(obj) {
  process.stderr.write(JSON.stringify(obj) + '\n');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Resolve templates directory
// ---------------------------------------------------------------------------

function getReferencesDir() {
  // Relative to this script's location: ../references/ (skills/do/references/)
  // Note: __dirname is skills/do/scripts/, so one level up is skills/do/references/
  return path.resolve(__dirname, '..', 'references');
}

// ---------------------------------------------------------------------------
// Default frontmatter generators
// ---------------------------------------------------------------------------

function projectFrontmatter(slug) {
  const now = new Date().toISOString();
  return {
    project_schema_version: 1,
    slug,
    id: slug,
    title: slug,
    created: now,
    updated: now,
    kind: 'greenfield',
    status: 'intake',
    active_phase: null,
    pre_abandon_status: null,
    database_entry: null,
    tech_stack: [],
    repo_path: null,
    confidence: {
      score: null,
      factors: { context: null, scope: null, complexity: null, familiarity: null },
    },
    council_review_ran: {
      project_plan: false,
      phase_plans: {},
      code: {},
    },
    phases: [],
  };
}

function phaseFrontmatter(projectSlug, phaseSlug) {
  const now = new Date().toISOString();
  return {
    project_schema_version: 1,
    project_slug: projectSlug,
    phase_slug: phaseSlug,
    title: phaseSlug,
    created: now,
    updated: now,
    status: 'planning',
    scope: 'in_scope',
    active_wave: null,
    pre_abandon_status: null,
    backlog_item: null,
    council_review_ran: { plan: false },
    confidence: {
      score: null,
      factors: { context: null, scope: null, complexity: null, familiarity: null },
    },
    waves: [],
    entry_context: [{ path: 'project.md' }, { path: 'phase.md' }],
    exit_summary: null,
  };
}

function waveFrontmatter(projectSlug, phaseSlug, waveSlug) {
  const now = new Date().toISOString();
  return {
    project_schema_version: 1,
    project_slug: projectSlug,
    phase_slug: phaseSlug,
    wave_slug: waveSlug,
    title: waveSlug,
    created: now,
    updated: now,
    status: 'planning',
    scope: 'in_scope',
    pre_abandon_status: null,
    backlog_item: null,
    parent_project: projectSlug,
    parent_phase: phaseSlug,
    stage: 'refinement',
    stages: {
      refinement: 'pending',
      grilling: 'pending',
      execution: 'pending',
      verification: 'pending',
      abandoned: false,
    },
    council_review_ran: { plan: false, code: false },
    confidence: {
      score: null,
      factors: { context: null, scope: null, complexity: null, familiarity: null },
    },
    modified_files: [],
    unresolved_concerns: [],
    discovered_followups: [],
    wave_summary: null,
  };
}

// ---------------------------------------------------------------------------
// Op: project
// ---------------------------------------------------------------------------

/**
 * Scaffold a new project folder.
 * Creates: .do/projects/<slug>/{project.md, intake/, phases/, changelog.md}
 * Also ensures .do/projects/completed/ and .do/projects/archived/ exist.
 */
function opProject(projectsDir, projectSlug) {
  try { validateSlug(projectSlug); } catch (e) { exitError(e); }

  const projectDir = path.join(projectsDir, projectSlug);
  if (fs.existsSync(projectDir)) {
    exitError({ error: 'projectAlreadyExists', slug: projectSlug, path: projectDir });
  }

  // Ensure completed/ and archived/ exist
  fs.mkdirSync(path.join(projectsDir, 'completed'), { recursive: true });
  fs.mkdirSync(path.join(projectsDir, 'archived'), { recursive: true });
  fs.mkdirSync(path.join(projectDir, 'intake'), { recursive: true });
  fs.mkdirSync(path.join(projectDir, 'phases'), { recursive: true });

  // Write project.md
  const refsDir = getReferencesDir();
  const templateBody = readTemplateBody(path.join(refsDir, 'project-master-template.md'));
  const fm = projectFrontmatter(projectSlug);
  const content = matter
    ? matter.stringify(templateBody, fm)
    : serializeFrontmatter(fm, templateBody);
  atomicWrite(path.join(projectDir, 'project.md'), content);

  // Create empty changelog.md
  fs.writeFileSync(path.join(projectDir, 'changelog.md'), '');

  // Append scaffold entry
  appendScaffoldChangelog(path.join(projectDir, 'changelog.md'), 'project', projectSlug);

  const result = { op: 'project', slug: projectSlug, path: projectDir };
  process.stdout.write(JSON.stringify(result) + '\n');
  return result;
}

// ---------------------------------------------------------------------------
// Op: phase
// ---------------------------------------------------------------------------

/**
 * Scaffold a new phase under an existing project.
 * project_slug: unprefixed (identifies existing project folder)
 * phase_slug: unprefixed (prefix allocated by script)
 */
function opPhase(projectsDir, projectSlug, phaseSlug) {
  try { validateSlug(projectSlug); } catch (e) { exitError(e); }
  try { validateSlug(phaseSlug); } catch (e) { exitError(e); }

  const projectDir = path.join(projectsDir, projectSlug);
  if (!fs.existsSync(projectDir)) {
    exitError({ error: 'projectNotFound', slug: projectSlug, path: projectDir });
  }

  const phasesDir = path.join(projectDir, 'phases');
  fs.mkdirSync(phasesDir, { recursive: true });

  const prefix = allocatePrefix(phasesDir);
  const prefixedPhaseSlug = `${prefix}-${phaseSlug}`;
  const phaseDir = path.join(phasesDir, prefixedPhaseSlug);
  if (fs.existsSync(phaseDir)) {
    exitError({ error: 'phaseAlreadyExists', slug: prefixedPhaseSlug, path: phaseDir });
  }

  fs.mkdirSync(path.join(phaseDir, 'waves'), { recursive: true });

  // Write phase.md
  const refsDir = getReferencesDir();
  const templateBody = readTemplateBody(path.join(refsDir, 'phase-template.md'));
  const fm = phaseFrontmatter(projectSlug, prefixedPhaseSlug);
  const content = matter
    ? matter.stringify(templateBody, fm)
    : serializeFrontmatter(fm, templateBody);
  atomicWrite(path.join(phaseDir, 'phase.md'), content);

  // Atomically update project.md phases[]
  const projectMdPath = path.join(projectDir, 'project.md');
  atomicAppendToIndex(projectMdPath, 'phases', { slug: prefixedPhaseSlug, status: 'planning' });

  // Append scaffold changelog
  const changelogPath = path.join(projectDir, 'changelog.md');
  if (fs.existsSync(changelogPath)) {
    appendScaffoldChangelog(changelogPath, 'phase', `${projectSlug}/${prefixedPhaseSlug}`);
  }

  const result = { op: 'phase', project_slug: projectSlug, phase_slug: prefixedPhaseSlug, path: phaseDir };
  process.stdout.write(JSON.stringify(result) + '\n');
  return result;
}

// ---------------------------------------------------------------------------
// Op: wave
// ---------------------------------------------------------------------------

/**
 * Scaffold a new wave under an existing phase.
 * project_slug: unprefixed
 * prefixed_phase_slug: FULL NN-<slug> form (identifies existing phase folder)
 * wave_slug: unprefixed (prefix allocated by script)
 */
function opWave(projectsDir, projectSlug, prefixedPhaseSlug, waveSlug) {
  try { validateSlug(projectSlug); } catch (e) { exitError(e); }
  try { validatePrefixedSlug(prefixedPhaseSlug); } catch (e) { exitError(e); }
  try { validateSlug(waveSlug); } catch (e) { exitError(e); }

  const projectDir = path.join(projectsDir, projectSlug);
  if (!fs.existsSync(projectDir)) {
    exitError({ error: 'projectNotFound', slug: projectSlug, path: projectDir });
  }

  const phaseDir = path.join(projectDir, 'phases', prefixedPhaseSlug);
  if (!fs.existsSync(phaseDir)) {
    exitError({ error: 'parentPhaseNotFound', project_slug: projectSlug, phase_slug: prefixedPhaseSlug });
  }

  const wavesDir = path.join(phaseDir, 'waves');
  fs.mkdirSync(wavesDir, { recursive: true });

  const prefix = allocatePrefix(wavesDir);
  const prefixedWaveSlug = `${prefix}-${waveSlug}`;
  const waveDir = path.join(wavesDir, prefixedWaveSlug);
  if (fs.existsSync(waveDir)) {
    exitError({ error: 'waveAlreadyExists', slug: prefixedWaveSlug, path: waveDir });
  }
  fs.mkdirSync(waveDir, { recursive: true });

  // Write wave.md
  const refsDir = getReferencesDir();
  const templateBody = readTemplateBody(path.join(refsDir, 'wave-template.md'));
  const fm = waveFrontmatter(projectSlug, prefixedPhaseSlug, prefixedWaveSlug);
  const content = matter
    ? matter.stringify(templateBody, fm)
    : serializeFrontmatter(fm, templateBody);
  atomicWrite(path.join(waveDir, 'wave.md'), content);

  // Atomically update phase.md waves[]
  const phaseMdPath = path.join(phaseDir, 'phase.md');
  atomicAppendToIndex(phaseMdPath, 'waves', { slug: prefixedWaveSlug, status: 'planning' });

  // Append scaffold changelog
  const changelogPath = path.join(projectDir, 'changelog.md');
  if (fs.existsSync(changelogPath)) {
    appendScaffoldChangelog(changelogPath, 'wave', `${projectSlug}/${prefixedPhaseSlug}/${prefixedWaveSlug}`);
  }

  const result = { op: 'wave', project_slug: projectSlug, phase_slug: prefixedPhaseSlug, wave_slug: prefixedWaveSlug, path: waveDir };
  process.stdout.write(JSON.stringify(result) + '\n');
  return result;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

if (require.main === module) {
  const args = process.argv.slice(2);
  const op = args[0];

  // NOTE: doProjectsDir is resolved here but NOT created eagerly.
  // Each op validates slugs first, THEN creates directories.
  // This ensures invalid invocations produce zero filesystem side effects.
  const doProjectsDir = path.join(process.cwd(), '.do', 'projects');

  if (!op) {
    console.error('Usage: node project-scaffold.cjs <project|phase|wave> ...');
    process.exit(1);
  }

  // Op parsing and slug validation BEFORE any mkdirSync calls.
  // The op functions (opProject / opPhase / opWave) also validate slugs
  // internally — the checks below are the CLI layer's early-exit gates.
  try {
    if (op === 'project') {
      const projectSlug = args[1];
      if (!projectSlug) exitError({ error: 'missingArg', reason: 'project_slug required' });
      // Validate slug BEFORE touching the filesystem
      try { validateSlug(projectSlug); } catch (e) { exitError(e); }
      opProject(doProjectsDir, projectSlug);
    } else if (op === 'phase') {
      const projectSlug = args[1];
      const phaseSlug = args[2];
      if (!projectSlug || !phaseSlug) exitError({ error: 'missingArg', reason: 'phase requires: <project_slug> <phase_slug>' });
      // Validate both slugs BEFORE touching the filesystem
      try { validateSlug(projectSlug); } catch (e) { exitError(e); }
      try { validateSlug(phaseSlug); } catch (e) { exitError(e); }
      opPhase(doProjectsDir, projectSlug, phaseSlug);
    } else if (op === 'wave') {
      const projectSlug = args[1];
      const prefixedPhaseSlug = args[2];
      const waveSlug = args[3];
      if (!projectSlug || !prefixedPhaseSlug || !waveSlug) {
        exitError({ error: 'missingArg', reason: 'wave requires: <project_slug> <prefixed_phase_slug> <wave_slug>' });
      }
      // Validate all slugs BEFORE touching the filesystem
      try { validateSlug(projectSlug); } catch (e) { exitError(e); }
      try { validatePrefixedSlug(prefixedPhaseSlug); } catch (e) { exitError(e); }
      try { validateSlug(waveSlug); } catch (e) { exitError(e); }
      opWave(doProjectsDir, projectSlug, prefixedPhaseSlug, waveSlug);
    } else {
      exitError({ error: 'unknownOp', reason: `Unknown operation: ${op}. Use: project|phase|wave` });
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
  opProject,
  opPhase,
  opWave,
  allocatePrefix,
  atomicAppendToIndex,
  projectFrontmatter,
  phaseFrontmatter,
  waveFrontmatter,
  appendScaffoldChangelog,
  readTemplateBody,
  getReferencesDir,
};
