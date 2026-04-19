#!/usr/bin/env node

/**
 * Read .do/config.json fields by key path.
 * Replaces inline `node -e` config-read blocks in skill files.
 *
 * Usage:
 *   node read-config.cjs <preset>
 *
 * Presets:
 *   models          — { default, overrides } (with defaults)
 *   delivery        — { onboarded, dismissed } from delivery_contract
 *   threshold       — auto_grill_threshold (default 0.9)
 *   project-config  — { active_project, models, project_intake_threshold }
 *
 * Output: JSON to stdout.
 */

const fs = require('fs');
const path = require('path');

const configPath = path.join(process.cwd(), '.do/config.json');
const c = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const preset = process.argv[2];

const presets = {
  models() {
    const models = c.models || { default: 'sonnet', overrides: {} };
    return JSON.stringify(models);
  },
  delivery() {
    const dc = c.delivery_contract || {};
    return JSON.stringify({ onboarded: dc.onboarded || false, dismissed: dc.dismissed || false });
  },
  threshold() {
    return JSON.stringify({ threshold: c.auto_grill_threshold || 0.9 });
  },
  'project-config'() {
    const models = c.models || { default: 'sonnet', overrides: {} };
    return JSON.stringify({
      active_project: c.active_project || null,
      models,
      project_intake_threshold: c.project_intake_threshold || c.auto_grill_threshold || 0.85,
    });
  },
};

if (!preset || !presets[preset]) {
  console.error(`Usage: node read-config.cjs <${Object.keys(presets).join('|')}>`);
  process.exit(1);
}

console.log(presets[preset]());
