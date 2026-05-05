#!/usr/bin/env node

/**
 * Structural assertion suite for the delivery contract integration.
 *
 * Verifies that all integration points added in the delivery-contract task are
 * present and correctly wired:
 *   - delivery-contract.md reference file exists and contains schema fields
 *   - validate-delivery-contract.cjs exports the three required functions
 *   - task-template.md contains delivery frontmatter block and ## Delivery Contract section
 *   - wave-template.md contains delivery frontmatter block and ## Delivery Contract section
 *   - config-template.json contains delivery_contract onboarding keys
 *   - do-executioner.md references Delivery Contract
 *   - task.md contains --delivery parsing step
 *   - fast.md contains --delivery parsing step
 *   - stage-fast-exec.md documents delivery_contract in caller contract
 *   - delivery-onboarding.md exists and contains all three options
 *
 * Run: node --test skills/scripts/__tests__/delivery-contract-structural.test.cjs
 */

'use strict';

const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const REFS_DIR = path.join(ROOT, 'skills', 'references');
const SCRIPTS_DIR = path.join(ROOT, 'skills', 'scripts');
const AGENTS_DIR = path.join(ROOT, 'agents');
const SKILLS_DIR = path.join(ROOT, 'skills');

const { expandTemplate } = require(path.join(ROOT, 'bin', 'expand-templates.cjs'));

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

// Read and expand a template file for the claude platform.
function readExpanded(filePath) {
  return expandTemplate(fs.readFileSync(filePath, 'utf8'), 'claude');
}

// ============================================================================
// delivery-contract.md — reference spec file
// ============================================================================

describe('delivery-contract.md: exists and contains schema field definitions', () => {
  const filePath = path.join(REFS_DIR, 'delivery-contract.md');
  let content;

  before(() => {
    assert.ok(fs.existsSync(filePath), 'delivery-contract.md must exist in skills/references/');
    content = readExpanded(filePath);
  });

  it('contains delivery.branch field definition', () => {
    assert.ok(
      content.includes('delivery.branch') || content.includes('`delivery.branch`'),
      'delivery-contract.md must define the branch field'
    );
  });

  it('contains delivery.commit_prefix field definition', () => {
    assert.ok(
      content.includes('delivery.commit_prefix') || content.includes('`delivery.commit_prefix`'),
      'delivery-contract.md must define the commit_prefix field'
    );
  });

  it('contains delivery.push_policy field definition', () => {
    assert.ok(
      content.includes('delivery.push_policy') || content.includes('`delivery.push_policy`'),
      'delivery-contract.md must define the push_policy field'
    );
  });

  it('contains delivery.pr_policy field definition', () => {
    assert.ok(
      content.includes('delivery.pr_policy') || content.includes('`delivery.pr_policy`'),
      'delivery-contract.md must define the pr_policy field'
    );
  });

  it('contains delivery.stop_after_push field definition', () => {
    assert.ok(
      content.includes('delivery.stop_after_push') || content.includes('`delivery.stop_after_push`'),
      'delivery-contract.md must define the stop_after_push field'
    );
  });

  it('contains delivery.exclude_paths field definition', () => {
    assert.ok(
      content.includes('delivery.exclude_paths') || content.includes('`delivery.exclude_paths`'),
      'delivery-contract.md must define the exclude_paths field'
    );
  });

  it('contains --delivery argument format example', () => {
    assert.ok(
      content.includes('--delivery=') || content.includes("--delivery='"),
      'delivery-contract.md must show the --delivery= argument format'
    );
  });
});

// ============================================================================
// validate-delivery-contract.cjs — exports
// ============================================================================

describe('validate-delivery-contract.cjs: exists and exports required functions', () => {
  const filePath = path.join(SCRIPTS_DIR, 'validate-delivery-contract.cjs');
  let mod;

  before(() => {
    assert.ok(fs.existsSync(filePath), 'validate-delivery-contract.cjs must exist in skills/scripts/');
    mod = require(filePath);
  });

  it('exports validateDeliveryContract', () => {
    assert.strictEqual(
      typeof mod.validateDeliveryContract,
      'function',
      'validate-delivery-contract.cjs must export validateDeliveryContract'
    );
  });

  it('exports applyDefaults', () => {
    assert.strictEqual(
      typeof mod.applyDefaults,
      'function',
      'validate-delivery-contract.cjs must export applyDefaults'
    );
  });

  it('exports parseDeliveryArg', () => {
    assert.strictEqual(
      typeof mod.parseDeliveryArg,
      'function',
      'validate-delivery-contract.cjs must export parseDeliveryArg'
    );
  });
});

// ============================================================================
// task-template.md — delivery frontmatter block and ## Delivery Contract section
// ============================================================================

describe('task-template.md: contains delivery: frontmatter block', () => {
  const filePath = path.join(REFS_DIR, 'task-template.md');
  let content;

  before(() => {
    assert.ok(fs.existsSync(filePath), 'task-template.md must exist');
    content = readExpanded(filePath);
  });

  it('contains delivery: frontmatter comment block', () => {
    assert.ok(
      content.includes('delivery:') || content.includes('# delivery:'),
      'task-template.md must contain a delivery: frontmatter block (commented or uncommented)'
    );
  });

  it('contains ## Delivery Contract markdown section', () => {
    assert.ok(
      content.includes('## Delivery Contract'),
      'task-template.md must contain a ## Delivery Contract section'
    );
  });
});

// ============================================================================
// wave-template.md — delivery frontmatter block and ## Delivery Contract section
// ============================================================================

describe('wave-template.md: contains delivery: frontmatter block and ## Delivery Contract section', () => {
  const filePath = path.join(REFS_DIR, 'wave-template.md');
  let content;

  before(() => {
    assert.ok(fs.existsSync(filePath), 'wave-template.md must exist');
    content = readExpanded(filePath);
  });

  it('contains delivery: frontmatter comment block', () => {
    assert.ok(
      content.includes('delivery:') || content.includes('# delivery:'),
      'wave-template.md must contain a delivery: frontmatter block (commented or uncommented)'
    );
  });

  it('contains ## Delivery Contract markdown section', () => {
    assert.ok(
      content.includes('## Delivery Contract'),
      'wave-template.md must contain a ## Delivery Contract section'
    );
  });
});

// ============================================================================
// config-template.md — delivery_contract onboarding keys (JSON fenced block)
// ============================================================================

describe('config-template.md: contains delivery_contract onboarding section', () => {
  const filePath = path.join(REFS_DIR, 'config-template.md');
  let parsed;

  before(() => {
    assert.ok(fs.existsSync(filePath), 'config-template.md must exist (config-template.json was replaced by this .md wrapper)');
    const content = readExpanded(filePath);
    const jsonMatch = content.match(/```json\s*([\s\S]*?)```/);
    assert.ok(jsonMatch, 'config-template.md must contain a ```json...``` fenced block');
    parsed = JSON.parse(jsonMatch[1].trim());
  });

  it('has delivery_contract key', () => {
    assert.ok(
      'delivery_contract' in parsed,
      'config-template.md JSON block must have a delivery_contract key'
    );
  });

  it('delivery_contract.onboarded defaults to false', () => {
    assert.strictEqual(
      parsed.delivery_contract.onboarded,
      false,
      'config-template.md delivery_contract.onboarded must default to false'
    );
  });

  it('delivery_contract.dismissed defaults to false', () => {
    assert.strictEqual(
      parsed.delivery_contract.dismissed,
      false,
      'config-template.md delivery_contract.dismissed must default to false'
    );
  });

  it('delivery_contract.entry_commands defaults to empty array', () => {
    assert.ok(
      Array.isArray(parsed.delivery_contract.entry_commands),
      'config-template.md delivery_contract.entry_commands must be an array'
    );
    assert.strictEqual(parsed.delivery_contract.entry_commands.length, 0);
  });
});

// ============================================================================
// executioner.md — Delivery Contract awareness
// ============================================================================

describe('executioner.md: references Delivery Contract in execution context', () => {
  const filePath = path.join(AGENTS_DIR, 'executioner.md');
  let content;

  before(() => {
    assert.ok(fs.existsSync(filePath), 'executioner.md must exist');
    content = readExpanded(filePath);
  });

  it('Step 1 Load Execution Context mentions Delivery Contract', () => {
    assert.ok(
      content.includes('Delivery Contract'),
      'executioner.md must reference Delivery Contract in Step 1'
    );
  });

  it('contains branch mismatch as a blocking deviation', () => {
    assert.ok(
      content.includes('Branch mismatch') || content.includes('branch') && content.includes('mismatch'),
      'executioner.md must document branch mismatch as a blocking deviation'
    );
  });

  it('contains exclude_paths enforcement', () => {
    assert.ok(
      content.includes('exclude_paths') || content.includes('exclude paths'),
      'executioner.md must reference exclude_paths enforcement'
    );
  });
});

// ============================================================================
// task.md — --delivery parsing step
// ============================================================================

describe('task.md: contains --delivery parsing step', () => {
  const filePath = path.join(SKILLS_DIR, 'task.md');
  let content;

  before(() => {
    assert.ok(fs.existsSync(filePath), 'task.md must exist');
    content = readExpanded(filePath);
  });

  it('mentions --delivery parsing', () => {
    assert.ok(
      content.includes('--delivery'),
      'task.md must contain a --delivery parsing step'
    );
  });

  it('references validate-delivery-contract.cjs', () => {
    assert.ok(
      content.includes('validate-delivery-contract'),
      'task.md must reference validate-delivery-contract.cjs'
    );
  });

  it('references delivery-onboarding.md for cold-start flow', () => {
    assert.ok(
      content.includes('delivery-onboarding'),
      'task.md must reference delivery-onboarding.md for the cold-start onboarding flow'
    );
  });
});

// ============================================================================
// fast.md — --delivery parsing step
// ============================================================================

describe('fast.md: contains --delivery parsing step', () => {
  const filePath = path.join(SKILLS_DIR, 'fast.md');
  let content;

  before(() => {
    assert.ok(fs.existsSync(filePath), 'fast.md must exist');
    content = readExpanded(filePath);
  });

  it('mentions --delivery parsing', () => {
    assert.ok(
      content.includes('--delivery'),
      'fast.md must contain a --delivery parsing step'
    );
  });

  it('references validate-delivery-contract.cjs', () => {
    assert.ok(
      content.includes('validate-delivery-contract'),
      'fast.md must reference validate-delivery-contract.cjs'
    );
  });

  it('references delivery-onboarding.md for cold-start flow', () => {
    assert.ok(
      content.includes('delivery-onboarding'),
      'fast.md must reference delivery-onboarding.md for the cold-start onboarding flow'
    );
  });
});

// ============================================================================
// stage-fast-exec.md — delivery_contract in caller contract
// ============================================================================

describe('stage-fast-exec.md: documents delivery_contract in caller contract preamble', () => {
  const filePath = path.join(REFS_DIR, 'stage-fast-exec.md');
  let content;

  before(() => {
    assert.ok(fs.existsSync(filePath), 'stage-fast-exec.md must exist');
    content = readExpanded(filePath);
  });

  it('caller contract preamble mentions delivery_contract', () => {
    assert.ok(
      content.includes('delivery_contract'),
      'stage-fast-exec.md caller contract preamble must document the delivery_contract in-session variable'
    );
  });
});

// ============================================================================
// delivery-onboarding.md — exists and contains the three options
// ============================================================================

describe('delivery-onboarding.md: exists and contains the three onboarding options', () => {
  const filePath = path.join(REFS_DIR, 'delivery-onboarding.md');
  let content;

  before(() => {
    assert.ok(fs.existsSync(filePath), 'delivery-onboarding.md must exist in skills/references/');
    content = readExpanded(filePath);
  });

  it('describes Option 1: Help me wire it up', () => {
    assert.ok(
      content.includes('wire') && (content.includes('Option 1') || content.includes('wire it up')),
      'delivery-onboarding.md must describe Option 1 (wire it up)'
    );
  });

  it('describes Option 2: Give me a prompt', () => {
    assert.ok(
      content.includes('prompt') && (content.includes('Option 2') || content.includes('Give me a prompt')),
      'delivery-onboarding.md must describe Option 2 (give me a prompt)'
    );
  });

  it("describes Option 3: I'll handle it / don't care", () => {
    assert.ok(
      content.includes("Option 3") || content.includes("don't care") || content.includes("handle it"),
      "delivery-onboarding.md must describe Option 3 (I'll handle it)"
    );
  });

  it('marks onboarded: true after any option', () => {
    assert.ok(
      content.includes('onboarded = true') || content.includes("onboarded: true"),
      'delivery-onboarding.md must mark onboarded: true in all three options'
    );
  });

  it('marks dismissed: true for Option 3', () => {
    assert.ok(
      content.includes('dismissed = true') || content.includes("dismissed: true"),
      'delivery-onboarding.md must mark dismissed: true for Option 3'
    );
  });
});
