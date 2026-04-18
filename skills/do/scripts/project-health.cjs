#!/usr/bin/env node

/**
 * Project Health Check Script
 *
 * Performs health checks on projects initialized with .do/ folder.
 * Returns JSON with health status and any issues found.
 *
 * Usage: node project-health.cjs <project-path>
 *
 * @module project-health
 */

const fs = require('fs');
const path = require('path');

/**
 * @typedef {Object} HealthIssue
 * @property {string} type - Issue type identifier
 * @property {'error'|'warning'|'info'} severity - Issue severity
 * @property {string|string[]} details - Issue details
 */

/**
 * @typedef {Object} HealthCheckResult
 * @property {boolean} healthy - Overall health status
 * @property {string|null} version - Detected version from config, or null if not found
 * @property {HealthIssue[]} issues - List of issues found
 */

/**
 * Read file contents safely, returning null if file doesn't exist
 * @param {string} filePath - Path to file
 * @returns {string|null} File contents or null
 */
function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Check if a directory exists
 * @param {string} dirPath - Path to directory
 * @returns {boolean}
 */
function dirExists(dirPath) {
  try {
    return fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Read and parse config.json safely
 * @param {string} configPath - Path to config.json
 * @returns {Object|null} Parsed config or null on error
 */
function readConfigSafe(configPath) {
  const content = readFileSafe(configPath);
  if (!content) return null;
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Perform all health checks on a project's .do/ folder
 * @param {string} projectPath - Path to project root
 * @returns {HealthCheckResult}
 */
function checkProjectHealth(projectPath) {
  const issues = [];

  // Check .do folder exists
  const doFolder = path.join(projectPath, '.do');
  if (!dirExists(doFolder)) {
    return {
      healthy: false,
      version: null,
      issues: [
        { type: 'noDotDoFolder', severity: 'error', details: '.do/ folder not found' }
      ]
    };
  }

  // Check config.json exists and is valid JSON
  const configPath = path.join(doFolder, 'config.json');
  const config = readConfigSafe(configPath);
  if (!config) {
    issues.push({ type: 'noConfig', severity: 'error', details: 'config.json not found or invalid' });
    return { healthy: false, version: null, issues };
  }

  // Check version field exists and is a string
  if (!config.version) {
    issues.push({ type: 'noVersion', severity: 'error', details: 'Missing version field in config.json' });
  } else if (typeof config.version !== 'string') {
    issues.push({ type: 'invalidVersion', severity: 'error', details: `version must be a string, got ${typeof config.version}` });
  }

  // Check project_name exists and is a string
  if (config.project_name === undefined) {
    issues.push({ type: 'missingField', severity: 'warning', details: 'Missing field: project_name' });
  } else if (typeof config.project_name !== 'string') {
    issues.push({ type: 'invalidField', severity: 'error', details: `project_name must be a string, got ${typeof config.project_name}` });
  }

  // Check council_reviews exists and has correct structure
  if (config.council_reviews === undefined) {
    issues.push({ type: 'missingField', severity: 'warning', details: 'Missing field: council_reviews' });
  } else if (typeof config.council_reviews !== 'object' || config.council_reviews === null) {
    issues.push({ type: 'invalidField', severity: 'error', details: `council_reviews must be an object, got ${typeof config.council_reviews}` });
  } else {
    // Validate planning and execution (accept both boolean and legacy object format)
    for (const reviewType of ['planning', 'execution']) {
      const review = config.council_reviews[reviewType];
      if (review !== undefined) {
        if (typeof review !== 'boolean') {
          // Check for legacy object format { enabled: boolean, model: string }
          if (typeof review === 'object' && review !== null) {
            if (review.enabled !== undefined && typeof review.enabled !== 'boolean') {
              issues.push({ type: 'invalidField', severity: 'warning', details: `council_reviews.${reviewType}.enabled must be a boolean` });
            }
            // Note: legacy 'model' field is deprecated but accepted for migration
          } else {
            issues.push({ type: 'invalidField', severity: 'error', details: `council_reviews.${reviewType} must be a boolean, got ${typeof review}` });
          }
        }
      }
    }

    // Validate reviewer field
    const validReviewers = ['codex', 'gemini', 'random', 'both'];
    if (config.council_reviews.reviewer !== undefined) {
      if (typeof config.council_reviews.reviewer !== 'string') {
        issues.push({ type: 'invalidField', severity: 'error', details: `council_reviews.reviewer must be a string, got ${typeof config.council_reviews.reviewer}` });
      } else if (!validReviewers.includes(config.council_reviews.reviewer)) {
        issues.push({ type: 'invalidField', severity: 'warning', details: `council_reviews.reviewer must be one of: ${validReviewers.join(', ')}. Got: ${config.council_reviews.reviewer}` });
      }
    }

    // Validate council_reviews.project (additive; mirrors planning/execution loop pattern)
    if (config.council_reviews.project === undefined) {
      issues.push({ type: 'missingField', severity: 'warning', details: 'Missing field: council_reviews.project' });
    } else if (typeof config.council_reviews.project !== 'object' || config.council_reviews.project === null) {
      issues.push({ type: 'invalidField', severity: 'error', details: `council_reviews.project must be an object, got ${typeof config.council_reviews.project}` });
    } else {
      for (const subKey of ['plan', 'phase_plan', 'wave_plan', 'code']) {
        const val = config.council_reviews.project[subKey];
        if (val !== undefined && typeof val !== 'boolean') {
          issues.push({ type: 'invalidField', severity: 'error', details: `council_reviews.project.${subKey} must be a boolean, got ${typeof val}` });
        }
      }
    }
  }

  // Check auto_grill_threshold exists and is a number between 0 and 1
  if (config.auto_grill_threshold === undefined) {
    issues.push({ type: 'missingField', severity: 'warning', details: 'Missing field: auto_grill_threshold' });
  } else if (typeof config.auto_grill_threshold !== 'number') {
    issues.push({ type: 'invalidField', severity: 'error', details: `auto_grill_threshold must be a number, got ${typeof config.auto_grill_threshold}` });
  } else if (config.auto_grill_threshold < 0 || config.auto_grill_threshold > 1) {
    issues.push({ type: 'invalidField', severity: 'warning', details: `auto_grill_threshold should be between 0 and 1, got ${config.auto_grill_threshold}` });
  }

  // Check tasks folder exists
  const tasksFolder = path.join(doFolder, 'tasks');
  if (!dirExists(tasksFolder)) {
    issues.push({ type: 'noTasksFolder', severity: 'error', details: '.do/tasks/ folder not found' });
  }

  // Check active_task reference if set
  if (config.active_task !== null && config.active_task !== undefined) {
    if (typeof config.active_task !== 'string') {
      issues.push({
        type: 'invalidField',
        severity: 'error',
        details: `active_task must be a string or null, got ${typeof config.active_task}`
      });
    } else if (config.active_task) {
      // Check for path traversal attempts
      if (config.active_task.includes('..') || path.isAbsolute(config.active_task)) {
        issues.push({
          type: 'invalidField',
          severity: 'error',
          details: `active_task contains invalid path: ${config.active_task}`
        });
      } else {
        const taskPath = path.join(tasksFolder, config.active_task);
        if (!fs.existsSync(taskPath)) {
          issues.push({
            type: 'staleActiveTask',
            severity: 'warning',
            details: `active_task points to missing file: ${config.active_task}`
          });
        }
      }
    }
  }

  // Check active_project — mirrors active_task pattern at L164-191
  if (config.active_project !== null && config.active_project !== undefined) {
    if (typeof config.active_project !== 'string') {
      issues.push({
        type: 'invalidField',
        severity: 'error',
        details: `active_project must be a string or null, got ${typeof config.active_project}`
      });
    } else if (config.active_project) {
      // Path-traversal guard (mirrors active_task guard)
      if (config.active_project.includes('..') || path.isAbsolute(config.active_project)) {
        issues.push({
          type: 'invalidField',
          severity: 'error',
          details: `active_project contains invalid path: ${config.active_project}`
        });
      }
    }
  } else if (config.active_project === undefined) {
    issues.push({ type: 'missingField', severity: 'warning', details: 'Missing field: active_project' });
  }

  // Check project_intake_threshold — mirrors auto_grill_threshold at L149-156
  if (config.project_intake_threshold === undefined) {
    issues.push({ type: 'missingField', severity: 'warning', details: 'Missing field: project_intake_threshold' });
  } else if (typeof config.project_intake_threshold !== 'number') {
    issues.push({ type: 'invalidField', severity: 'error', details: `project_intake_threshold must be a number, got ${typeof config.project_intake_threshold}` });
  } else if (config.project_intake_threshold < 0 || config.project_intake_threshold > 1) {
    issues.push({ type: 'invalidField', severity: 'warning', details: `project_intake_threshold should be between 0 and 1, got ${config.project_intake_threshold}` });
  }

  // ---------------------------------------------------------------------------
  // Project-folder checks (§13 — 12 new issue types)
  // Walks .do/projects/ if it exists and checks structural integrity.
  // ---------------------------------------------------------------------------

  /**
   * Check if a project is in terminal-pre-complete state:
   *   active_phase: null AND status: in_progress AND every in-scope phase is completed.
   * When true, activeProjectNoActivePhase should NOT fire (silent state).
   * Per §13: the warning fires only when un-completed in-scope phases remain.
   */
  function isTerminalPreComplete(projectFrontmatter, projectDir) {
    if (!projectFrontmatter) return false;
    if (projectFrontmatter.status !== 'in_progress') return false;
    if (projectFrontmatter.active_phase !== null && projectFrontmatter.active_phase !== undefined) return false;
    // Check all in-scope phases are completed
    const phasesDir = path.join(projectDir, 'phases');
    if (!dirExists(phasesDir)) return true; // no phases = vacuously complete
    try {
      const phaseEntries = fs.readdirSync(phasesDir);
      for (const phaseEntry of phaseEntries) {
        const phaseMdPath = path.join(phasesDir, phaseEntry, 'phase.md');
        const phaseFmContent = readFileSafe(phaseMdPath);
        if (!phaseFmContent) continue;
        const phaseFm = parseFrontmatterSimple(phaseFmContent);
        if (phaseFm && phaseFm.scope !== 'out_of_scope' && phaseFm.status !== 'completed') {
          return false; // un-completed in-scope phase exists → not terminal-pre-complete
        }
      }
    } catch {
      return false;
    }
    return true;
  }

  /**
   * Simple frontmatter parser for health check (avoids gray-matter dependency).
   * Only extracts scalar fields needed for health checks.
   */
  function parseFrontmatterSimple(content) {
    if (!content) return null;
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return null;
    const obj = {};
    for (const line of match[1].split(/\r?\n/)) {
      const m = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/);
      if (m) {
        const key = m[1];
        const val = m[2].trim();
        if (val === 'null' || val === '') obj[key] = null;
        else if (val === 'true') obj[key] = true;
        else if (val === 'false') obj[key] = false;
        else {
          const n = Number(val);
          obj[key] = isNaN(n) ? val : n;
        }
      }
    }
    // Parse arrays (e.g. "modified_files: []")
    for (const line of match[1].split(/\r?\n/)) {
      const m = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*\[\s*\]$/);
      if (m) obj[m[1]] = [];
    }
    return obj;
  }

  const projectsDir = path.join(doFolder, 'projects');
  if (dirExists(projectsDir)) {
    let projectDirs;
    try {
      projectDirs = fs.readdirSync(projectsDir).filter(e => e !== 'completed' && e !== 'archived');
    } catch {
      projectDirs = [];
    }

    const activeProject = config.active_project || null;

    // Check 1: orphanedActiveProject — active_project set but folder missing
    if (activeProject && typeof activeProject === 'string' && !activeProject.includes('..') && !path.isAbsolute(activeProject)) {
      const activeProjDir = path.join(projectsDir, activeProject);
      if (!dirExists(activeProjDir)) {
        issues.push({
          type: 'orphanedActiveProject',
          severity: 'error',
          details: `active_project '${activeProject}' set but .do/projects/${activeProject}/ does not exist`
        });
      }
    }

    // Walk each active project folder
    for (const projectEntry of projectDirs) {
      const projectDir = path.join(projectsDir, projectEntry);
      if (!dirExists(projectDir)) continue;

      const projectMdPath = path.join(projectDir, 'project.md');
      const projectMdContent = readFileSafe(projectMdPath);
      const projectFm = projectMdContent ? parseFrontmatterSimple(projectMdContent) : null;

      // Check 5: orphanProjectFolder — project folder not matching active_project
      if (projectEntry !== activeProject) {
        issues.push({
          type: 'orphanProjectFolder',
          severity: 'warning',
          details: `Folder .do/projects/${projectEntry}/ exists but is not the active project ('${activeProject || 'none'}') — stale scaffold`
        });
      }

      // Check 2: activeProjectNoActivePhase — in_progress + active_phase null + un-completed in-scope phases
      if (projectFm && projectEntry === activeProject) {
        if (projectFm.status === 'in_progress' && (projectFm.active_phase === null || projectFm.active_phase === undefined)) {
          if (!isTerminalPreComplete(projectFm, projectDir)) {
            issues.push({
              type: 'activeProjectNoActivePhase',
              severity: 'warning',
              details: `Active project '${projectEntry}' is in_progress with active_phase: null but has un-completed in-scope phases`
            });
          }
        }
      }

      // Check 8: schemaVersionMismatch — project_schema_version != 1
      if (projectFm && projectFm.project_schema_version !== undefined && projectFm.project_schema_version !== 1) {
        issues.push({
          type: 'schemaVersionMismatch',
          severity: 'error',
          details: `${projectEntry}/project.md project_schema_version is ${projectFm.project_schema_version}, expected 1`
        });
      }

      // Check 3: orphanedActivePhase — active_phase set but folder missing
      if (projectFm && projectFm.active_phase !== null && projectFm.active_phase !== undefined) {
        const activePhasePath = path.join(projectDir, 'phases', String(projectFm.active_phase));
        if (!dirExists(activePhasePath)) {
          issues.push({
            type: 'orphanedActivePhase',
            severity: 'error',
            details: `${projectEntry}/project.md active_phase '${projectFm.active_phase}' set but phases/${projectFm.active_phase}/ does not exist`
          });
        }
      }

      // Walk phases
      const phasesDir = path.join(projectDir, 'phases');
      let phaseEntries = [];
      if (dirExists(phasesDir)) {
        try { phaseEntries = fs.readdirSync(phasesDir); } catch { phaseEntries = []; }
      }

      for (const phaseEntry of phaseEntries) {
        const phaseDir = path.join(phasesDir, phaseEntry);
        if (!dirExists(phaseDir)) continue;

        const phaseMdPath = path.join(phaseDir, 'phase.md');
        const phaseMdContent = readFileSafe(phaseMdPath);
        const phaseFm = phaseMdContent ? parseFrontmatterSimple(phaseMdContent) : null;

        if (!phaseFm) continue;

        // Check 8: schemaVersionMismatch — phase
        if (phaseFm.project_schema_version !== undefined && phaseFm.project_schema_version !== 1) {
          issues.push({
            type: 'schemaVersionMismatch',
            severity: 'error',
            details: `${projectEntry}/phases/${phaseEntry}/phase.md project_schema_version is ${phaseFm.project_schema_version}, expected 1`
          });
        }

        // Check 9: invalidScopeValue — phase
        if (phaseFm.scope !== undefined && phaseFm.scope !== 'in_scope' && phaseFm.scope !== 'out_of_scope') {
          issues.push({
            type: 'invalidScopeValue',
            severity: 'error',
            details: `${projectEntry}/phases/${phaseEntry}/phase.md has invalid scope value: '${phaseFm.scope}'`
          });
        }

        // Check 10: illegalScopeTransition — in_progress + out_of_scope
        if (phaseFm.status === 'in_progress' && phaseFm.scope === 'out_of_scope') {
          issues.push({
            type: 'illegalScopeTransition',
            severity: 'error',
            details: `${projectEntry}/phases/${phaseEntry}/phase.md has status: in_progress and scope: out_of_scope (illegal combination)`
          });
        }

        // Check 6: phaseStatusDrift — project.md phases[].status vs phase.md status
        // (project phases[] is parsed from raw YAML; simplified check against projectMdContent)
        // We parse the phases array from the raw YAML content
        if (projectMdContent && phaseFm.status) {
          const phasesArrayMatch = projectMdContent.match(/phases:\s*\n((?:\s+-[^\n]*\n(?:\s+[^\n]+\n)*)*)/);
          if (phasesArrayMatch) {
            const phasesBlock = phasesArrayMatch[1];
            // Find the entry for this phase slug
            const slugRegex = new RegExp(`slug:\\s*${phaseEntry}\\s*\\n\\s*status:\\s*(\\S+)`);
            const slugMatch = phasesBlock.match(slugRegex);
            if (slugMatch && slugMatch[1] !== phaseFm.status) {
              issues.push({
                type: 'phaseStatusDrift',
                severity: 'warning',
                details: `${projectEntry}/project.md phases[${phaseEntry}].status is '${slugMatch[1]}' but ${phaseEntry}/phase.md status is '${phaseFm.status}'`
              });
            }
          }
        }

        // Check 12: illegalPhaseTransition — phase completed but in-scope waves not all completed
        if (phaseFm.status === 'completed') {
          const wavesDir = path.join(phaseDir, 'waves');
          if (dirExists(wavesDir)) {
            try {
              const waveEntries = fs.readdirSync(wavesDir);
              for (const waveEntry of waveEntries) {
                const waveMdPath = path.join(wavesDir, waveEntry, 'wave.md');
                const waveMdContent = readFileSafe(waveMdPath);
                const waveFm = waveMdContent ? parseFrontmatterSimple(waveMdContent) : null;
                if (waveFm && (waveFm.scope === 'in_scope' || waveFm.scope === undefined) && waveFm.status !== 'completed') {
                  issues.push({
                    type: 'illegalPhaseTransition',
                    severity: 'error',
                    details: `${projectEntry}/phases/${phaseEntry} has status: completed but wave '${waveEntry}' is in-scope with status '${waveFm.status}'`
                  });
                  break; // one issue per phase is sufficient
                }
              }
            } catch { /* skip */ }
          }
        }

        // Check 3b: orphanedActiveWave — active_wave set but folder missing
        if (phaseFm.active_wave !== null && phaseFm.active_wave !== undefined) {
          const activeWavePath = path.join(phaseDir, 'waves', String(phaseFm.active_wave));
          if (!dirExists(activeWavePath)) {
            issues.push({
              type: 'orphanedActiveWave',
              severity: 'error',
              details: `${projectEntry}/phases/${phaseEntry}/phase.md active_wave '${phaseFm.active_wave}' set but waves/${phaseFm.active_wave}/ does not exist`
            });
          }
        }

        // Walk waves
        const wavesDir = path.join(phaseDir, 'waves');
        let waveEntries = [];
        if (dirExists(wavesDir)) {
          try { waveEntries = fs.readdirSync(wavesDir); } catch { waveEntries = []; }
        }

        for (const waveEntry of waveEntries) {
          const waveDir = path.join(wavesDir, waveEntry);
          if (!dirExists(waveDir)) continue;

          const waveMdPath = path.join(waveDir, 'wave.md');
          const waveMdContent = readFileSafe(waveMdPath);
          const waveFm = waveMdContent ? parseFrontmatterSimple(waveMdContent) : null;

          if (!waveFm) continue;

          // Check 8: schemaVersionMismatch — wave
          if (waveFm.project_schema_version !== undefined && waveFm.project_schema_version !== 1) {
            issues.push({
              type: 'schemaVersionMismatch',
              severity: 'error',
              details: `${projectEntry}/phases/${phaseEntry}/waves/${waveEntry}/wave.md project_schema_version is ${waveFm.project_schema_version}, expected 1`
            });
          }

          // Check 9: invalidScopeValue — wave
          if (waveFm.scope !== undefined && waveFm.scope !== 'in_scope' && waveFm.scope !== 'out_of_scope') {
            issues.push({
              type: 'invalidScopeValue',
              severity: 'error',
              details: `${projectEntry}/phases/${phaseEntry}/waves/${waveEntry}/wave.md has invalid scope value: '${waveFm.scope}'`
            });
          }

          // Check 10: illegalScopeTransition — wave in_progress + out_of_scope
          if (waveFm.status === 'in_progress' && waveFm.scope === 'out_of_scope') {
            issues.push({
              type: 'illegalScopeTransition',
              severity: 'error',
              details: `${projectEntry}/phases/${phaseEntry}/waves/${waveEntry}/wave.md has status: in_progress and scope: out_of_scope (illegal combination)`
            });
          }

          // Check 7: waveStatusDrift — phase.md waves[].status vs wave.md status
          if (phaseMdContent && waveFm.status) {
            const wavesArrayMatch = phaseMdContent.match(/waves:\s*\n((?:\s+-[^\n]*\n(?:\s+[^\n]+\n)*)*)/);
            if (wavesArrayMatch) {
              const wavesBlock = wavesArrayMatch[1];
              const slugRegex = new RegExp(`slug:\\s*${waveEntry}\\s*\\n\\s*status:\\s*(\\S+)`);
              const slugMatch = wavesBlock.match(slugRegex);
              if (slugMatch && slugMatch[1] !== waveFm.status) {
                issues.push({
                  type: 'waveStatusDrift',
                  severity: 'warning',
                  details: `${projectEntry}/phases/${phaseEntry}/phase.md waves[${waveEntry}].status is '${slugMatch[1]}' but ${waveEntry}/wave.md status is '${waveFm.status}'`
                });
              }
            }
          }

          // Check 11: missingHandoffFields — completed wave missing required fields
          if (waveFm.status === 'completed') {
            const hasModifiedFiles = Array.isArray(waveFm.modified_files) || waveMdContent.includes('modified_files:');
            const hasUnresolvedConcerns = Array.isArray(waveFm.unresolved_concerns) || waveMdContent.includes('unresolved_concerns:');
            const hasDiscoveredFollowups = Array.isArray(waveFm.discovered_followups) || waveMdContent.includes('discovered_followups:');
            const hasWaveSummary = waveFm.wave_summary !== undefined;
            if (!hasModifiedFiles || !hasUnresolvedConcerns || !hasDiscoveredFollowups || !hasWaveSummary || waveFm.wave_summary === null) {
              issues.push({
                type: 'missingHandoffFields',
                severity: 'warning',
                details: `${projectEntry}/phases/${phaseEntry}/waves/${waveEntry}/wave.md has status: completed but missing handoff fields (modified_files, unresolved_concerns, discovered_followups, or wave_summary)`
              });
            }
          }
        } // end wave loop
      } // end phase loop
    } // end project loop
  }

  // Determine overall health (healthy if no errors, only warnings/info)
  const hasErrors = issues.some(i => i.severity === 'error');

  return {
    healthy: !hasErrors,
    version: config.version || null,
    issues
  };
}

// CLI handling
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Project Health Check

Usage: node project-health.cjs <project-path>

Performs health checks on a project's .do/ folder.
Returns JSON with health status and any issues found.

Options:
  --help, -h    Show this help message
  --pretty      Pretty-print JSON output

Health Check Types:
  noDotDoFolder   - .do/ folder missing (error)
  noConfig        - config.json not found or invalid JSON (error)
  noVersion       - Missing version field in config.json (error)
  missingField    - Required field missing from config (warning)
  noTasksFolder   - .do/tasks/ folder missing (error)
  staleActiveTask - active_task references missing file (warning)

Example:
  node project-health.cjs .
  node project-health.cjs /path/to/project --pretty
`);
    process.exit(0);
  }

  const projectPath = args.find(a => !a.startsWith('-'));
  const pretty = args.includes('--pretty');

  if (!projectPath) {
    console.error('Error: project path required');
    console.error('Usage: node project-health.cjs <project-path>');
    process.exit(1);
  }

  const resolvedPath = path.resolve(projectPath);
  if (!dirExists(resolvedPath)) {
    console.error(`Error: project path does not exist: ${resolvedPath}`);
    process.exit(1);
  }

  const result = checkProjectHealth(resolvedPath);
  console.log(JSON.stringify(result, null, pretty ? 2 : 0));
  process.exit(result.healthy ? 0 : 1);
}

// Export for programmatic use
module.exports = { checkProjectHealth };
