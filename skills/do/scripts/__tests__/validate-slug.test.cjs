#!/usr/bin/env node

/**
 * Tests for the shared slug / path validator library.
 *
 * Uses Node.js built-in test runner.
 * Run: node --test skills/do/scripts/__tests__/validate-slug.test.cjs
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { validateSlug, validatePrefixedSlug, validateNodePath } = require('../lib/validate-slug.cjs');

// Helper: assert a function throws with expected error field
function assertThrows(fn, expectedError) {
  let threw = false;
  try {
    fn();
  } catch (e) {
    threw = true;
    if (expectedError) {
      assert.strictEqual(e.error, expectedError, `Expected error '${expectedError}', got '${e.error}'. Full: ${JSON.stringify(e)}`);
    }
  }
  assert.ok(threw, 'Expected function to throw');
}

describe('validateSlug', () => {
  it('accepts valid slug: valid-slug', () => {
    assert.strictEqual(validateSlug('valid-slug'), 'valid-slug');
  });

  it('accepts valid slug: abc123', () => {
    assert.strictEqual(validateSlug('abc123'), 'abc123');
  });

  it('accepts single char slug: a', () => {
    assert.strictEqual(validateSlug('a'), 'a');
  });

  it('accepts slug with numbers: my-proj-2', () => {
    assert.strictEqual(validateSlug('my-proj-2'), 'my-proj-2');
  });

  it('rejects empty string', () => {
    assertThrows(() => validateSlug(''), 'invalidSlug');
  });

  it('rejects double-dot: ..', () => {
    assertThrows(() => validateSlug('..'), 'invalidSlug');
  });

  it('rejects traversal: ../foo', () => {
    assertThrows(() => validateSlug('../foo'), 'invalidSlug');
  });

  it('rejects absolute path: /foo', () => {
    assertThrows(() => validateSlug('/foo'), 'invalidSlug');
  });

  it('rejects path with slash: foo/bar', () => {
    assertThrows(() => validateSlug('foo/bar'), 'invalidSlug');
  });

  it('rejects hidden file: .hidden', () => {
    assertThrows(() => validateSlug('.hidden'), 'invalidSlug');
  });

  it('rejects leading dash: -leading-dash', () => {
    assertThrows(() => validateSlug('-leading-dash'), 'invalidSlug');
  });

  it('rejects upper case: UPPER-CASE', () => {
    assertThrows(() => validateSlug('UPPER-CASE'), 'invalidSlug');
  });

  it('rejects mixed case: MyProject', () => {
    assertThrows(() => validateSlug('MyProject'), 'invalidSlug');
  });
});

describe('validatePrefixedSlug', () => {
  it('accepts: 01-foo', () => {
    assert.strictEqual(validatePrefixedSlug('01-foo'), '01-foo');
  });

  it('accepts: 99-abc-def', () => {
    assert.strictEqual(validatePrefixedSlug('99-abc-def'), '99-abc-def');
  });

  it('accepts: 10-my-phase', () => {
    assert.strictEqual(validatePrefixedSlug('10-my-phase'), '10-my-phase');
  });

  it('rejects single-digit prefix: 1-foo', () => {
    assertThrows(() => validatePrefixedSlug('1-foo'), 'invalidSlug');
  });

  it('rejects empty body: 01-', () => {
    assertThrows(() => validatePrefixedSlug('01-'), 'invalidSlug');
  });

  it('rejects upper-case body: 01-FOO', () => {
    assertThrows(() => validatePrefixedSlug('01-FOO'), 'invalidSlug');
  });

  it('rejects unprefixed: foo', () => {
    assertThrows(() => validatePrefixedSlug('foo'), 'invalidSlug');
  });

  it('rejects body starting with hyphen: 01--foo', () => {
    assertThrows(() => validatePrefixedSlug('01--foo'), 'invalidSlug');
  });

  it('rejects non-numeric prefix: abc-foo', () => {
    assertThrows(() => validatePrefixedSlug('abc-foo'), 'invalidSlug');
  });

  it('rejects empty string', () => {
    assertThrows(() => validatePrefixedSlug(''), 'invalidSlug');
  });

  it('rejects absolute path: /01-foo', () => {
    assertThrows(() => validatePrefixedSlug('/01-foo'), 'invalidSlug');
  });
});

describe('validateNodePath', () => {
  it('accepts project path: my-proj', () => {
    const segs = validateNodePath('project', 'my-proj');
    assert.deepStrictEqual(segs, ['my-proj']);
  });

  it('accepts phase path: 01-discovery', () => {
    const segs = validateNodePath('phase', '01-discovery');
    assert.deepStrictEqual(segs, ['01-discovery']);
  });

  it('accepts wave path: 01-discovery/02-intake', () => {
    const segs = validateNodePath('wave', '01-discovery/02-intake');
    assert.deepStrictEqual(segs, ['01-discovery', '02-intake']);
  });

  it('rejects wrong arity for phase: 01-a/02-b', () => {
    assertThrows(() => validateNodePath('phase', '01-a/02-b'), 'invalidPath');
  });

  it('rejects wrong arity for wave: 01-a (single segment)', () => {
    assertThrows(() => validateNodePath('wave', '01-a'), 'invalidPath');
  });

  it('rejects traversal in wave path: 01-a/../etc', () => {
    // This is caught because '..' is not valid as a prefixed slug
    assertThrows(() => validateNodePath('wave', '01-a/../etc'));
  });

  it('rejects empty segment in wave path: 01-a//02-b', () => {
    assertThrows(() => validateNodePath('wave', '01-a//02-b'), 'invalidPath');
  });

  it('rejects absolute project path: /abs', () => {
    assertThrows(() => validateNodePath('project', '/abs'), 'invalidPath');
  });

  it('rejects empty string', () => {
    assertThrows(() => validateNodePath('project', ''), 'invalidPath');
  });

  it('rejects wave path with bad phase segment: 1-a/02-b (single-digit prefix)', () => {
    assertThrows(() => validateNodePath('wave', '1-a/02-b'), 'invalidSlug');
  });

  it('rejects wave path with bad wave segment: 01-a/2-b (single-digit prefix)', () => {
    assertThrows(() => validateNodePath('wave', '01-a/2-b'), 'invalidSlug');
  });
});
