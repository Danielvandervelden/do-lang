#!/usr/bin/env node

/**
 * Delivery contract validator for /do:task and entry commands.
 *
 * Prior art: skills/do/scripts/lib/validate-slug.cjs — pure validation, no I/O,
 * JSDoc, module.exports. This module follows the same pattern for the delivery
 * contract schema defined in skills/do/references/delivery-contract.md.
 *
 * No I/O, no imports beyond Node builtins. Pure validation only.
 *
 * @module validate-delivery-contract
 */

'use strict';

/**
 * Known delivery contract fields and their allowed types/values.
 * Used for unknown-key detection (forward compatibility warning).
 */
const KNOWN_FIELDS = new Set([
  'branch',
  'commit_prefix',
  'push_policy',
  'pr_policy',
  'stop_after_push',
  'exclude_paths',
]);

const VALID_PUSH_POLICIES = new Set(['push', 'no-push']);
const VALID_PR_POLICIES = new Set(['create', 'skip']);

/**
 * Validate a parsed delivery contract object.
 *
 * Required fields: branch, commit_prefix.
 * Optional fields: push_policy, pr_policy, stop_after_push, exclude_paths.
 * Unknown fields produce warnings (not errors) for forward compatibility.
 *
 * @param {object} obj - Parsed delivery object (e.g., from task frontmatter or --delivery JSON)
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
function validateDeliveryContract(obj) {
  const errors = [];
  const warnings = [];

  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    errors.push('delivery contract must be a non-null object');
    return { valid: false, errors, warnings };
  }

  // --- Required: branch ---
  if (obj.branch === undefined || obj.branch === null) {
    errors.push('delivery.branch is required');
  } else if (typeof obj.branch !== 'string' || obj.branch.trim() === '') {
    errors.push('delivery.branch must be a non-empty string');
  }

  // --- Required: commit_prefix ---
  if (obj.commit_prefix === undefined || obj.commit_prefix === null) {
    errors.push('delivery.commit_prefix is required');
  } else if (typeof obj.commit_prefix !== 'string' || obj.commit_prefix.trim() === '') {
    errors.push('delivery.commit_prefix must be a non-empty string');
  }

  // --- Optional: push_policy ---
  if (obj.push_policy !== undefined && obj.push_policy !== null) {
    if (!VALID_PUSH_POLICIES.has(obj.push_policy)) {
      errors.push(
        `delivery.push_policy must be one of: ${[...VALID_PUSH_POLICIES].join(', ')} — got: ${JSON.stringify(obj.push_policy)}`
      );
    }
  }

  // --- Optional: pr_policy ---
  if (obj.pr_policy !== undefined && obj.pr_policy !== null) {
    if (!VALID_PR_POLICIES.has(obj.pr_policy)) {
      errors.push(
        `delivery.pr_policy must be one of: ${[...VALID_PR_POLICIES].join(', ')} — got: ${JSON.stringify(obj.pr_policy)}`
      );
    }
  }

  // --- Optional: stop_after_push ---
  if (obj.stop_after_push !== undefined && obj.stop_after_push !== null) {
    if (typeof obj.stop_after_push !== 'boolean') {
      errors.push(
        `delivery.stop_after_push must be a boolean — got: ${JSON.stringify(obj.stop_after_push)}`
      );
    }
  }

  // --- Optional: exclude_paths ---
  if (obj.exclude_paths !== undefined && obj.exclude_paths !== null) {
    if (!Array.isArray(obj.exclude_paths)) {
      errors.push('delivery.exclude_paths must be an array of strings');
    } else {
      obj.exclude_paths.forEach((entry, i) => {
        if (typeof entry !== 'string') {
          errors.push(`delivery.exclude_paths[${i}] must be a string — got: ${JSON.stringify(entry)}`);
        }
      });
    }
  }

  // --- Unknown keys (forward compatibility warnings) ---
  for (const key of Object.keys(obj)) {
    if (!KNOWN_FIELDS.has(key)) {
      warnings.push(`delivery.${key} is an unknown field — ignored (forward compatibility)`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Apply defaults to an (optionally partial) delivery object.
 * Returns a new object — does not mutate the input.
 * Required fields (branch, commit_prefix) are left as-is; callers must supply them.
 *
 * @param {object} obj - Partial delivery object
 * @returns {object} New object with optional fields filled in from defaults
 */
function applyDefaults(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return {
      push_policy: 'push',
      pr_policy: 'create',
      stop_after_push: true,
      exclude_paths: ['.do/'],
    };
  }
  return {
    push_policy: 'push',
    pr_policy: 'create',
    stop_after_push: true,
    exclude_paths: ['.do/'],
    ...obj,
  };
}

/**
 * Parse the `--delivery='...'` argument string extracted from $ARGUMENTS.
 *
 * Tries the following in order:
 * 1. Direct JSON.parse on the raw value
 * 2. Replace outer single-quotes with nothing (in case shell left them in)
 * 3. Replace single quotes with double quotes (lenient shell-escaping fallback)
 *
 * Returns the flat parsed object on success (with `branch`, `commit_prefix`, etc.
 * at the top level) or `{ error: string }` on failure. This allows direct piping
 * into `validateDeliveryContract()` and `applyDefaults()` without unwrapping.
 *
 * @param {string} argString - The raw value of --delivery=<argString>
 * @returns {object | { error: string }} Flat delivery object on success, { error } on failure
 */
function parseDeliveryArg(argString) {
  if (typeof argString !== 'string' || argString.trim() === '') {
    return { error: 'delivery argument is empty' };
  }

  const raw = argString.trim();

  // Attempt 1: direct JSON.parse
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch (_) {
    // fall through
  }

  // Attempt 2: strip wrapping single quotes (e.g., `'{"branch":"..."}'` passed literally)
  const stripped = raw.replace(/^'(.*)'$/, '$1');
  if (stripped !== raw) {
    try {
      const parsed = JSON.parse(stripped);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch (_) {
      // fall through
    }
  }

  // Attempt 3: replace single quotes with double quotes (lenient shell fallback)
  const swapped = raw.replace(/'/g, '"');
  try {
    const parsed = JSON.parse(swapped);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch (_) {
    // fall through
  }

  return {
    error: `could not parse delivery argument as JSON. Received: ${raw}. Expected: --delivery='{"branch":"...","commit_prefix":"..."}'`,
  };
}

module.exports = { validateDeliveryContract, applyDefaults, parseDeliveryArg };
