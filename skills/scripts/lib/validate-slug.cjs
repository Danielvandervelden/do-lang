#!/usr/bin/env node

/**
 * Shared slug / path validator library for /do:project scripts.
 *
 * Prior art: skills/scripts/task-abandon.cjs L42-56 — rejects `..` segments
 * and absolute paths before touching disk. This module generalises that pattern
 * into a reusable helper so project-state.cjs and project-scaffold.cjs stay DRY.
 *
 * No I/O, no imports beyond Node builtins. Pure validation only.
 *
 * @module validate-slug
 */

const path = require('path');

/**
 * Validate an unprefixed project/phase/wave slug.
 * Rejects: empty string, contains `/`, contains `..`, starts with `.`,
 * starts with `-`, contains path separators, does not match /^[a-z0-9][a-z0-9-]*$/.
 *
 * @param {string} slug - Slug to validate
 * @returns {string} The normalised (trimmed) slug on success
 * @throws {{error: string, reason: string, value: string}} On failure
 */
function validateSlug(slug) {
  if (!slug || typeof slug !== 'string' || slug.trim() === '') {
    throw { error: 'invalidSlug', reason: 'slug must be a non-empty string', value: String(slug) };
  }
  const s = slug.trim();
  if (s.includes('..')) {
    throw { error: 'invalidSlug', reason: 'path traversal (..) not allowed', value: s };
  }
  if (path.isAbsolute(s)) {
    throw { error: 'invalidSlug', reason: 'absolute paths not allowed', value: s };
  }
  if (s.includes('/') || s.includes(path.sep)) {
    throw { error: 'invalidSlug', reason: 'slug must not contain path separators', value: s };
  }
  if (s.startsWith('.')) {
    throw { error: 'invalidSlug', reason: 'slug must not start with a dot', value: s };
  }
  if (s.startsWith('-')) {
    throw { error: 'invalidSlug', reason: 'slug must not start with a hyphen', value: s };
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(s)) {
    throw { error: 'invalidSlug', reason: 'slug must be lowercase alphanumeric + hyphens, starting with alphanumeric', value: s };
  }
  return s;
}

/**
 * Validate a prefixed slug (NN-<slug> form used for phase and wave folder names).
 * Requires exactly two decimal digits followed by a hyphen, then a valid slug body.
 * Rejects: single-digit prefix (`1-foo`), empty body (`01-`), upper-case body (`01-FOO`),
 * unprefixed (`foo`), body starting with hyphen (`01--foo`), non-numeric prefix (`abc-foo`).
 *
 * @param {string} slug - Prefixed slug to validate
 * @returns {string} The normalised slug on success
 * @throws {{error: string, reason: string, value: string}} On failure
 */
function validatePrefixedSlug(slug) {
  if (!slug || typeof slug !== 'string' || slug.trim() === '') {
    throw { error: 'invalidSlug', reason: 'prefixed slug must be a non-empty string', value: String(slug) };
  }
  const s = slug.trim();
  if (s.includes('..')) {
    throw { error: 'invalidSlug', reason: 'path traversal (..) not allowed', value: s };
  }
  if (path.isAbsolute(s)) {
    throw { error: 'invalidSlug', reason: 'absolute paths not allowed', value: s };
  }
  if (s.includes('/') || s.includes(path.sep)) {
    throw { error: 'invalidSlug', reason: 'slug must not contain path separators', value: s };
  }
  if (!/^\d{2}-[a-z0-9][a-z0-9-]*$/.test(s)) {
    throw {
      error: 'invalidSlug',
      reason: 'prefixed slug must match /^\\d{2}-[a-z0-9][a-z0-9-]*$/ (e.g. 01-discovery)',
      value: s
    };
  }
  return s;
}

/**
 * Validate a slash-delimited node path operand.
 * Enforces arity by node type and validates each segment.
 *
 * Arity rules:
 *   - 'project': 1 segment, validated with validateSlug (unprefixed)
 *   - 'phase':   1 segment, validated with validatePrefixedSlug
 *   - 'wave':    2 segments (<NN-phase>/<NN-wave>), both validated with validatePrefixedSlug
 *
 * Any empty segment (e.g. `foo//bar`) is rejected.
 * Any segment containing `..` is rejected.
 *
 * @param {'project'|'phase'|'wave'} nodeType - Node type
 * @param {string} nodePath - Slash-delimited path string
 * @returns {string[]} Array of validated segments on success
 * @throws {{error: string, reason: string, value: string}} On failure
 */
function validateNodePath(nodeType, nodePath) {
  if (!nodePath || typeof nodePath !== 'string' || nodePath.trim() === '') {
    throw { error: 'invalidPath', reason: 'node path must be a non-empty string', value: String(nodePath) };
  }
  const p = nodePath.trim();
  if (path.isAbsolute(p)) {
    throw { error: 'invalidPath', reason: 'absolute paths not allowed', value: p };
  }
  const segments = p.split('/');
  // Check for empty segments (double-slash or leading/trailing slash)
  for (const seg of segments) {
    if (seg === '') {
      throw { error: 'invalidPath', reason: 'path contains empty segment (double-slash or leading/trailing slash)', value: p };
    }
  }
  const arityMap = { project: 1, phase: 1, wave: 2 };
  const expected = arityMap[nodeType];
  if (expected === undefined) {
    throw { error: 'invalidPath', reason: `unknown node type: ${nodeType}`, value: p };
  }
  if (segments.length !== expected) {
    throw {
      error: 'invalidPath',
      reason: `node type '${nodeType}' expects ${expected} path segment(s), got ${segments.length}`,
      value: p
    };
  }
  if (nodeType === 'project') {
    validateSlug(segments[0]);
  } else if (nodeType === 'phase') {
    validatePrefixedSlug(segments[0]);
  } else if (nodeType === 'wave') {
    validatePrefixedSlug(segments[0]);
    validatePrefixedSlug(segments[1]);
  }
  return segments;
}

module.exports = { validateSlug, validatePrefixedSlug, validateNodePath };
