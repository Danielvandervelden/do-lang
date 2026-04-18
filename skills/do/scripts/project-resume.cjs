#!/usr/bin/env node

/**
 * project-resume.cjs
 *
 * Computes the "what's the next action" for /do:project resume.
 * Reads active project state from disk (project.md → phase.md → wave.md frontmatter)
 * and returns structured JSON consumed by stage-project-resume.md.
 *
 * This script is READ-ONLY — it does not mutate any file.
 *
 * Algorithm for terminal-phase detection (and terminal-pre-complete detection):
 * - Walk the phases/ folder, read each phase.md leaf file directly.
 * - Sort by NN-prefixed slug (lexical sort reproduces scaffold order).
 * - Filter scope: in_scope.
 * - Check statuses. See inline comments.
 *
 * NOTE: project.md's phases[] array is NOT read for control-flow decisions.
 * It is a scaffold-seeded index not synced by project-state.cjs.
 * β's Authoritative state reads doctrine (skills/do/project.md §Authoritative state reads)
 * prohibits using parent indexes for control-flow. All phase/wave enumeration walks
 * leaf files. This applies to terminal-pre-complete detection here and in stage-phase-exit.md.
 *
 * Output JSON shape:
 * {
 *   action: string,         // routing key consumed by stage-project-resume.md
 *   target_file: string,    // relative path to the relevant .md file
 *   target_type: string,    // "project" | "phase" | "wave"
 *   summary: string,        // human-readable description
 *   preamble_targets: [{    // files to run resume-preamble-project.md on (in order)
 *     path: string,
 *     type: string
 *   }]
 * }
 *
 * Usage:
 *   node project-resume.cjs [<project_slug>]
 *
 * If no slug provided, reads active_project from .do/config.json in cwd.
 *
 * @module project-resume
 */

'use strict';

const fs = require('fs');
const path = require('path');

let matter;
try {
  matter = require('gray-matter');
} catch {
  // gray-matter not available
  matter = null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function errorResult(message) {
  return {
    action: 'error',
    target_file: null,
    target_type: null,
    summary: message,
    preamble_targets: []
  };
}

function parseFile(filePath) {
  if (!matter) {
    process.stderr.write('gray-matter not available; cannot parse frontmatter\n');
    process.exit(1);
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  return matter(raw);
}

/**
 * Walk phases/ folder, read each phase.md leaf file, sort lexically by slug.
 * Returns array of { slug, status, scope }.
 */
function walkPhases(phasesDir) {
  if (!fs.existsSync(phasesDir)) return [];
  return fs
    .readdirSync(phasesDir)
    .filter(d => fs.statSync(path.join(phasesDir, d)).isDirectory())
    .map(slug => {
      const phPath = path.join(phasesDir, slug, 'phase.md');
      if (!fs.existsSync(phPath)) return null;
      const ph = parseFile(phPath);
      return { slug, status: ph.data.status, scope: ph.data.scope };
    })
    .filter(Boolean)
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

/**
 * Walk waves/ folder, read each wave.md leaf file, sort lexically by slug.
 * Returns array of { slug, status, scope, stage, stages }.
 */
function walkWaves(wavesDir) {
  if (!fs.existsSync(wavesDir)) return [];
  return fs
    .readdirSync(wavesDir)
    .filter(d => fs.statSync(path.join(wavesDir, d)).isDirectory())
    .map(slug => {
      const wPath = path.join(wavesDir, slug, 'wave.md');
      if (!fs.existsSync(wPath)) return null;
      const w = parseFile(wPath);
      return {
        slug,
        status: w.data.status,
        scope: w.data.scope,
        stage: w.data.stage || null,
        stages: w.data.stages || {}
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function computeNextAction(projectSlug, projectsBase) {
  const projectDir = path.join(projectsBase, projectSlug);
  const projectMdPath = path.join(projectDir, 'project.md');

  if (!fs.existsSync(projectMdPath)) {
    return errorResult(`project.md not found for slug "${projectSlug}" at ${projectMdPath}`);
  }

  // Step 2: Read project.md frontmatter
  const proj = parseFile(projectMdPath);
  const projectStatus = proj.data.status;
  const activePhase = proj.data.active_phase || null;

  // Step 3: Branch on project status
  if (projectStatus === 'blocked') {
    return {
      action: 'project-blocked',
      target_file: path.join('.do/projects', projectSlug, 'project.md'),
      target_type: 'project',
      summary: 'Project is blocked — resolve the blocker and retry.',
      preamble_targets: [
        { path: path.join('.do/projects', projectSlug, 'project.md'), type: 'project' }
      ]
    };
  }

  if (projectStatus === 'intake') {
    return {
      action: 'stage-project-intake',
      target_file: path.join('.do/projects', projectSlug, 'project.md'),
      target_type: 'project',
      summary: 'Project is in intake — continue the intake interview.',
      preamble_targets: [
        { path: path.join('.do/projects', projectSlug, 'project.md'), type: 'project' }
      ]
    };
  }

  if (projectStatus === 'planning') {
    return {
      action: 'stage-project-plan-review',
      target_file: path.join('.do/projects', projectSlug, 'project.md'),
      target_type: 'project',
      summary: 'Project plan is in review — continue plan review.',
      preamble_targets: [
        { path: path.join('.do/projects', projectSlug, 'project.md'), type: 'project' }
      ]
    };
  }

  if (projectStatus === 'completed') {
    return {
      action: 'already-complete',
      target_file: path.join('.do/projects', projectSlug, 'project.md'),
      target_type: 'project',
      summary: `Project "${projectSlug}" is already completed.`,
      preamble_targets: []
    };
  }

  // NOTE: abandoned branch is intentionally absent.
  // After project-state.cjs abandon, active_project is cleared to null in config.
  // Step 1 (caller) exits with an error before reaching this function when active_project is null.
  // The abandoned branch is dead code — see C-5 in the task spec.

  // project status is in_progress — branch on active_phase
  const phasesDir = path.join(projectDir, 'phases');

  if (!activePhase) {
    // active_phase: null + in_progress — must be terminal-pre-complete OR inconsistent state
    // Terminal-pre-complete detection: walk phases/ leaf files, check all in_scope phases completed.
    // NOTE: We deliberately walk leaf files (not project.md phases[]) for control-flow.
    // phases[] is advisory-only (scaffold-seeded, not synced by project-state.cjs).
    const allPhases = walkPhases(phasesDir);
    const inScopePhases = allPhases.filter(p => p.scope === 'in_scope');
    const allCompleted = inScopePhases.length > 0 && inScopePhases.every(p => p.status === 'completed');

    if (allCompleted) {
      return {
        action: 'terminal-pre-complete',
        target_file: path.join('.do/projects', projectSlug, 'project.md'),
        target_type: 'project',
        summary: 'Project complete pending — all in-scope phases done. Run `/do:project complete` to finalise.',
        preamble_targets: [
          { path: path.join('.do/projects', projectSlug, 'project.md'), type: 'project' }
        ]
      };
    }

    // Inconsistent state: active_phase null but not all in-scope phases are completed
    return {
      action: 'inconsistent-state',
      target_file: path.join('.do/projects', projectSlug, 'project.md'),
      target_type: 'project',
      summary: `Project "${projectSlug}" is in an inconsistent state (active_phase: null but in-scope phases incomplete). Run /do:init for diagnostics.`,
      preamble_targets: []
    };
  }

  // Non-null active_phase — read phase.md
  const phaseMdPath = path.join(phasesDir, activePhase, 'phase.md');
  if (!fs.existsSync(phaseMdPath)) {
    return errorResult(`phase.md not found for active_phase "${activePhase}" at ${phaseMdPath}`);
  }

  const phase = parseFile(phaseMdPath);
  const phaseStatus = phase.data.status;
  const activeWave = phase.data.active_wave || null;

  // Step 5: Branch on phase status
  if (phaseStatus === 'planning') {
    return {
      action: 'stage-phase-plan-review',
      target_file: path.join('.do/projects', projectSlug, 'phases', activePhase, 'phase.md'),
      target_type: 'phase',
      summary: `Phase "${activePhase}" plan is in review — continue plan review.`,
      preamble_targets: [
        { path: path.join('.do/projects', projectSlug, 'project.md'), type: 'project' },
        { path: path.join('.do/projects', projectSlug, 'phases', activePhase, 'phase.md'), type: 'phase' }
      ]
    };
  }

  if (phaseStatus === 'blocked') {
    return {
      action: 'phase-blocked',
      target_file: path.join('.do/projects', projectSlug, 'phases', activePhase, 'phase.md'),
      target_type: 'phase',
      summary: `Phase "${activePhase}" is blocked — resolve the blocker and retry.`,
      preamble_targets: [
        { path: path.join('.do/projects', projectSlug, 'project.md'), type: 'project' },
        { path: path.join('.do/projects', projectSlug, 'phases', activePhase, 'phase.md'), type: 'phase' }
      ]
    };
  }

  // Phase is in_progress — branch on active_wave
  if (!activeWave) {
    return {
      action: 'wave-next-needed',
      target_file: path.join('.do/projects', projectSlug, 'phases', activePhase, 'phase.md'),
      target_type: 'phase',
      summary: `Phase "${activePhase}" has no active wave. Run \`/do:project wave next\` to activate the next wave.`,
      preamble_targets: [
        { path: path.join('.do/projects', projectSlug, 'project.md'), type: 'project' },
        { path: path.join('.do/projects', projectSlug, 'phases', activePhase, 'phase.md'), type: 'phase' }
      ]
    };
  }

  // Step 6: Active wave exists — read wave.md
  const wavesDir = path.join(phasesDir, activePhase, 'waves');
  const waveMdPath = path.join(wavesDir, activeWave, 'wave.md');
  if (!fs.existsSync(waveMdPath)) {
    return errorResult(`wave.md not found for active_wave "${activeWave}" at ${waveMdPath}`);
  }

  const wave = parseFile(waveMdPath);
  const waveStatus = wave.data.status;
  const waveStage = wave.data.stage || null;
  const waveStages = wave.data.stages || {};

  const preamble3 = [
    { path: path.join('.do/projects', projectSlug, 'project.md'), type: 'project' },
    { path: path.join('.do/projects', projectSlug, 'phases', activePhase, 'phase.md'), type: 'phase' },
    { path: path.join('.do/projects', projectSlug, 'phases', activePhase, 'waves', activeWave, 'wave.md'), type: 'wave' }
  ];
  const waveRelPath = path.join('.do/projects', projectSlug, 'phases', activePhase, 'waves', activeWave, 'wave.md');

  if (waveStatus === 'blocked') {
    return {
      action: 'wave-blocked',
      target_file: waveRelPath,
      target_type: 'wave',
      summary: `Wave "${activeWave}" is blocked — resolve the blocker and retry.`,
      preamble_targets: preamble3
    };
  }

  if (waveStatus === 'planning') {
    return {
      action: 'stage-wave-plan-review',
      target_file: waveRelPath,
      target_type: 'wave',
      summary: `Wave "${activeWave}" plan is in review — continue plan review.`,
      preamble_targets: preamble3
    };
  }

  if (waveStatus === 'completed') {
    return {
      action: 'wave-completed-next-needed',
      target_file: waveRelPath,
      target_type: 'wave',
      summary: `Wave "${activeWave}" is completed. Run \`/do:project wave next\` for the next wave.`,
      preamble_targets: preamble3
    };
  }

  // Wave is in_progress — branch on stage
  if (waveStatus === 'in_progress') {
    // Code review states: execution complete or review_pending
    const execStatus = waveStages.execution;
    if (execStatus === 'complete' || execStatus === 'review_pending') {
      return {
        action: 'stage-wave-code-review',
        target_file: waveRelPath,
        target_type: 'wave',
        summary: `Wave "${activeWave}" is in code review.`,
        preamble_targets: preamble3
      };
    }

    if (waveStage === 'verification') {
      return {
        action: 'stage-wave-verify',
        target_file: waveRelPath,
        target_type: 'wave',
        summary: `Wave "${activeWave}" is in verification.`,
        preamble_targets: preamble3
      };
    }

    if (waveStage === 'execution') {
      return {
        action: 'stage-wave-exec',
        target_file: waveRelPath,
        target_type: 'wave',
        summary: `Wave "${activeWave}" is in execution.`,
        preamble_targets: preamble3
      };
    }

    // Fallback for in_progress + unknown stage
    return {
      action: 'stage-wave-plan-review',
      target_file: waveRelPath,
      target_type: 'wave',
      summary: `Wave "${activeWave}" is in progress (stage: ${waveStage || 'unknown'}) — defaulting to plan review.`,
      preamble_targets: preamble3
    };
  }

  // Unknown wave status
  return errorResult(`Unknown wave status "${waveStatus}" for wave "${activeWave}".`);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  let projectSlug = args[0] || null;

  // Base path: resolve relative to cwd
  const cwd = process.cwd();
  const configPath = path.join(cwd, '.do/config.json');
  const projectsBase = path.join(cwd, '.do/projects');

  // Step 1: Read active_project from config if slug not provided
  if (!projectSlug) {
    if (!fs.existsSync(configPath)) {
      console.log(JSON.stringify(errorResult('No .do/config.json found. Run /do:init first.')));
      process.exit(0);
    }
    let config;
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (e) {
      console.log(JSON.stringify(errorResult(`Failed to parse .do/config.json: ${e.message}`)));
      process.exit(0);
    }
    projectSlug = config.active_project || null;
  }

  if (!projectSlug) {
    console.log(JSON.stringify(errorResult('No active project. Run `/do:project new <slug>` to start one.')));
    process.exit(0);
  }

  const result = computeNextAction(projectSlug, projectsBase);
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

main();
