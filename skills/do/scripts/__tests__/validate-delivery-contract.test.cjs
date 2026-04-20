#!/usr/bin/env node

/**
 * Unit tests for validate-delivery-contract.cjs
 *
 * Run: node --test skills/do/scripts/__tests__/validate-delivery-contract.test.cjs
 *
 * Tests:
 * - validateDeliveryContract: valid contracts, required-field errors, enum errors, type errors
 * - applyDefaults: correct default values, partial object merging
 * - parseDeliveryArg: valid JSON, malformed JSON, empty string, shell quoting variants
 * - Unknown keys: produce warnings, not errors
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const {
  validateDeliveryContract,
  applyDefaults,
  parseDeliveryArg,
} = require('../validate-delivery-contract.cjs');

// ============================================================================
// validateDeliveryContract — valid contracts
// ============================================================================

describe('validateDeliveryContract: valid contracts', () => {
  it('accepts a minimal valid contract (branch + commit_prefix only)', () => {
    const result = validateDeliveryContract({
      branch: 'feat/LLDEV-851',
      commit_prefix: 'feat',
    });
    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.errors, []);
  });

  it('accepts a fully explicit valid contract', () => {
    const result = validateDeliveryContract({
      branch: 'feat/LLDEV-851',
      commit_prefix: 'feat',
      push_policy: 'push',
      pr_policy: 'create',
      stop_after_push: true,
      exclude_paths: ['.do/'],
    });
    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.errors, []);
  });

  it('accepts push_policy: no-push', () => {
    const result = validateDeliveryContract({
      branch: 'fix/typo',
      commit_prefix: 'fix',
      push_policy: 'no-push',
    });
    assert.strictEqual(result.valid, true);
  });

  it('accepts pr_policy: skip', () => {
    const result = validateDeliveryContract({
      branch: 'fix/typo',
      commit_prefix: 'fix',
      pr_policy: 'skip',
    });
    assert.strictEqual(result.valid, true);
  });

  it('accepts stop_after_push: false', () => {
    const result = validateDeliveryContract({
      branch: 'feat/X',
      commit_prefix: 'feat',
      stop_after_push: false,
    });
    assert.strictEqual(result.valid, true);
  });

  it('accepts an empty exclude_paths array', () => {
    const result = validateDeliveryContract({
      branch: 'feat/X',
      commit_prefix: 'feat',
      exclude_paths: [],
    });
    assert.strictEqual(result.valid, true);
  });

  it('accepts multiple exclude_paths entries', () => {
    const result = validateDeliveryContract({
      branch: 'feat/X',
      commit_prefix: 'feat',
      exclude_paths: ['.do/', 'secrets/'],
    });
    assert.strictEqual(result.valid, true);
  });
});

// ============================================================================
// validateDeliveryContract — required field errors
// ============================================================================

describe('validateDeliveryContract: missing required fields', () => {
  it('errors when branch is absent', () => {
    const result = validateDeliveryContract({ commit_prefix: 'feat' });
    assert.strictEqual(result.valid, false);
    assert.ok(
      result.errors.some(e => e.includes('branch') && e.includes('required')),
      `expected error about branch being required, got: ${result.errors.join(', ')}`
    );
  });

  it('errors when commit_prefix is absent', () => {
    const result = validateDeliveryContract({ branch: 'feat/X' });
    assert.strictEqual(result.valid, false);
    assert.ok(
      result.errors.some(e => e.includes('commit_prefix') && e.includes('required')),
      `expected error about commit_prefix being required, got: ${result.errors.join(', ')}`
    );
  });

  it('errors when both required fields are absent', () => {
    const result = validateDeliveryContract({});
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.errors.length, 2);
  });

  it('errors when branch is an empty string', () => {
    const result = validateDeliveryContract({ branch: '', commit_prefix: 'feat' });
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('branch')));
  });

  it('errors when commit_prefix is an empty string', () => {
    const result = validateDeliveryContract({ branch: 'feat/X', commit_prefix: '' });
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('commit_prefix')));
  });

  it('errors when branch is a number', () => {
    const result = validateDeliveryContract({ branch: 42, commit_prefix: 'feat' });
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('branch')));
  });

  it('errors when commit_prefix is null', () => {
    const result = validateDeliveryContract({ branch: 'feat/X', commit_prefix: null });
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('commit_prefix') && e.includes('required')));
  });
});

// ============================================================================
// validateDeliveryContract — invalid enum values
// ============================================================================

describe('validateDeliveryContract: invalid enum values', () => {
  it('errors when push_policy is an unsupported value', () => {
    const result = validateDeliveryContract({
      branch: 'feat/X',
      commit_prefix: 'feat',
      push_policy: 'maybe',
    });
    assert.strictEqual(result.valid, false);
    assert.ok(
      result.errors.some(e => e.includes('push_policy')),
      `expected error about push_policy, got: ${result.errors.join(', ')}`
    );
  });

  it('errors when pr_policy is an unsupported value', () => {
    const result = validateDeliveryContract({
      branch: 'feat/X',
      commit_prefix: 'feat',
      pr_policy: 'auto',
    });
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('pr_policy')));
  });

  it('errors when stop_after_push is a string', () => {
    const result = validateDeliveryContract({
      branch: 'feat/X',
      commit_prefix: 'feat',
      stop_after_push: 'yes',
    });
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('stop_after_push')));
  });

  it('errors when stop_after_push is a number', () => {
    const result = validateDeliveryContract({
      branch: 'feat/X',
      commit_prefix: 'feat',
      stop_after_push: 1,
    });
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('stop_after_push')));
  });

  it('errors when exclude_paths is not an array', () => {
    const result = validateDeliveryContract({
      branch: 'feat/X',
      commit_prefix: 'feat',
      exclude_paths: '.do/',
    });
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('exclude_paths')));
  });

  it('errors when exclude_paths contains a non-string element', () => {
    const result = validateDeliveryContract({
      branch: 'feat/X',
      commit_prefix: 'feat',
      exclude_paths: ['.do/', 42],
    });
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('exclude_paths')));
  });
});

// ============================================================================
// validateDeliveryContract — unknown keys (warnings, not errors)
// ============================================================================

describe('validateDeliveryContract: unknown keys produce warnings not errors', () => {
  it('valid: true with warning for unknown key', () => {
    const result = validateDeliveryContract({
      branch: 'feat/X',
      commit_prefix: 'feat',
      future_field: 'some-value',
    });
    assert.strictEqual(result.valid, true, `unexpected errors: ${result.errors.join(', ')}`);
    assert.ok(
      result.warnings.some(w => w.includes('future_field')),
      `expected warning about future_field, got: ${result.warnings.join(', ')}`
    );
  });

  it('accumulates multiple unknown key warnings', () => {
    const result = validateDeliveryContract({
      branch: 'feat/X',
      commit_prefix: 'feat',
      field_a: 1,
      field_b: 2,
    });
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.warnings.length, 2);
  });
});

// ============================================================================
// validateDeliveryContract — non-object input
// ============================================================================

describe('validateDeliveryContract: non-object input', () => {
  it('errors for null input', () => {
    const result = validateDeliveryContract(null);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.length > 0);
  });

  it('errors for array input', () => {
    const result = validateDeliveryContract([]);
    assert.strictEqual(result.valid, false);
  });

  it('errors for string input', () => {
    const result = validateDeliveryContract('{"branch":"x"}');
    assert.strictEqual(result.valid, false);
  });
});

// ============================================================================
// applyDefaults
// ============================================================================

describe('applyDefaults: correct default values', () => {
  it('applies all defaults when only required fields are present', () => {
    const result = applyDefaults({ branch: 'feat/X', commit_prefix: 'feat' });
    assert.strictEqual(result.push_policy, 'push');
    assert.strictEqual(result.pr_policy, 'create');
    assert.strictEqual(result.stop_after_push, true);
    assert.deepStrictEqual(result.exclude_paths, ['.do/']);
  });

  it('preserves caller-supplied optional fields over defaults', () => {
    const result = applyDefaults({
      branch: 'feat/X',
      commit_prefix: 'feat',
      push_policy: 'no-push',
      pr_policy: 'skip',
      stop_after_push: false,
      exclude_paths: [],
    });
    assert.strictEqual(result.push_policy, 'no-push');
    assert.strictEqual(result.pr_policy, 'skip');
    assert.strictEqual(result.stop_after_push, false);
    assert.deepStrictEqual(result.exclude_paths, []);
  });

  it('preserves branch and commit_prefix from input', () => {
    const result = applyDefaults({ branch: 'chore/cleanup', commit_prefix: 'chore' });
    assert.strictEqual(result.branch, 'chore/cleanup');
    assert.strictEqual(result.commit_prefix, 'chore');
  });

  it('does not mutate the input object', () => {
    const input = { branch: 'feat/X', commit_prefix: 'feat' };
    const result = applyDefaults(input);
    assert.strictEqual(input.push_policy, undefined, 'input must not be mutated');
    assert.strictEqual(result.push_policy, 'push');
  });

  it('returns defaults for null/undefined input', () => {
    const result = applyDefaults(null);
    assert.strictEqual(result.push_policy, 'push');
    assert.strictEqual(result.pr_policy, 'create');
    assert.strictEqual(result.stop_after_push, true);
    assert.deepStrictEqual(result.exclude_paths, ['.do/']);
  });
});

// ============================================================================
// parseDeliveryArg
// ============================================================================

describe('parseDeliveryArg: valid JSON', () => {
  it('parses a plain JSON string and returns the flat object', () => {
    const result = parseDeliveryArg('{"branch":"feat/X","commit_prefix":"feat"}');
    assert.ok(!('error' in result), `expected no error, got: ${JSON.stringify(result)}`);
    assert.strictEqual(result.branch, 'feat/X');
    assert.strictEqual(result.commit_prefix, 'feat');
  });

  it('parses a fully explicit JSON string and returns the flat object', () => {
    const result = parseDeliveryArg(
      '{"branch":"feat/LLDEV-851","commit_prefix":"feat","push_policy":"push","pr_policy":"create","stop_after_push":true,"exclude_paths":[".do/"]}'
    );
    assert.ok(!('error' in result));
    assert.strictEqual(result.push_policy, 'push');
    assert.deepStrictEqual(result.exclude_paths, ['.do/']);
  });

  it('strips outer single quotes (shell literal passthrough)', () => {
    const result = parseDeliveryArg(`'{"branch":"feat/X","commit_prefix":"feat"}'`);
    assert.ok(!('error' in result), `expected no error, got: ${JSON.stringify(result)}`);
    assert.strictEqual(result.branch, 'feat/X');
  });

  it('handles single-quote-wrapped JSON (swap quotes fallback)', () => {
    // This simulates: --delivery={'branch':'feat/X','commit_prefix':'feat'}
    const result = parseDeliveryArg(`{'branch':'feat/X','commit_prefix':'feat'}`);
    assert.ok(!('error' in result), `expected no error, got: ${JSON.stringify(result)}`);
    assert.strictEqual(result.branch, 'feat/X');
  });

  it('returns an object directly consumable by validateDeliveryContract', () => {
    const parsed = parseDeliveryArg('{"branch":"feat/X","commit_prefix":"feat"}');
    const validation = validateDeliveryContract(parsed);
    assert.strictEqual(validation.valid, true, `parse -> validate chain should work without unwrapping`);
  });
});

describe('parseDeliveryArg: malformed JSON', () => {
  it('returns error for completely invalid string', () => {
    const result = parseDeliveryArg('not json at all');
    assert.ok('error' in result, `expected error key, got: ${JSON.stringify(result)}`);
    assert.ok(typeof result.error === 'string' && result.error.length > 0);
  });

  it('returns error for truncated JSON', () => {
    const result = parseDeliveryArg('{"branch":"feat/X"');
    assert.ok('error' in result);
  });

  it('returns error for JSON array (not an object)', () => {
    const result = parseDeliveryArg('[1,2,3]');
    assert.ok('error' in result, `arrays should not parse as a contract`);
  });

  it('returns error for JSON primitive (not an object)', () => {
    const result = parseDeliveryArg('"just a string"');
    assert.ok('error' in result);
  });
});

describe('parseDeliveryArg: empty / missing input', () => {
  it('returns error for empty string', () => {
    const result = parseDeliveryArg('');
    assert.ok('error' in result);
  });

  it('returns error for whitespace-only string', () => {
    const result = parseDeliveryArg('   ');
    assert.ok('error' in result);
  });

  it('returns error for non-string input', () => {
    const result = parseDeliveryArg(null);
    assert.ok('error' in result);
  });

  it('returns error for undefined input', () => {
    const result = parseDeliveryArg(undefined);
    assert.ok('error' in result);
  });
});
