---
name: delivery-contract
description: "Stable interface specification for the delivery contract. Defines the exact schema for branch, commit, push, and exclude-path rules that travel with every task file. Entry commands (e.g., /jira:start) target this spec to produce a conforming --delivery argument."
---

# Delivery Contract Reference

## Overview

The delivery contract is a self-contained set of rules that travel with every task file. It tells the executioner:

- Which branch to work on
- Which commit prefix to use
- Whether to push after committing
- Whether to open a PR
- Whether to stop and return control after pushing
- Which paths to never stage/commit

The executioner reads **only** the task file for these rules. It does not consult `AGENTS.md`, `CLAUDE.md`, or `project.md` when a delivery contract is present.

---

## Schema

### `delivery.branch`

- **Type:** `string`
- **Required:** yes
- **Description:** The target branch name the executioner must be on before committing.
- **Example:** `"feat/LLDEV-851"`

### `delivery.commit_prefix`

- **Type:** `string`
- **Required:** yes
- **Description:** The conventional commit prefix to use for all commits in this task (e.g., `feat`, `fix`, `chore`, `docs`, `refactor`, `test`). Must be one of the project's allowed prefixes.
- **Example:** `"feat"`

### `delivery.push_policy`

- **Type:** `string`
- **Required:** no
- **Default:** `"push"`
- **Allowed values:** `"push"` | `"no-push"`
- **Description:** Whether the executioner should push commits after making them. `"no-push"` is useful when the user prefers to review locally before pushing.

### `delivery.pr_policy`

- **Type:** `string`
- **Required:** no
- **Default:** `"create"`
- **Allowed values:** `"create"` | `"skip"`
- **Description:** Whether the executioner should open a pull request after pushing. Only applies when `push_policy` is `"push"`.

### `delivery.stop_after_push`

- **Type:** `boolean`
- **Required:** no
- **Default:** `true`
- **Description:** When `true`, the executioner pushes and then returns control to the orchestrator. The user reviews the PR before any further action. When `false`, the orchestrator continues to the next pipeline step immediately.

### `delivery.exclude_paths`

- **Type:** `string[]`
- **Required:** no
- **Default:** `[".do/"]`
- **Description:** Paths the executioner must never stage or commit. Each entry is matched as a prefix against `git status` output. `.do/` is always excluded unless explicitly overridden with an empty array.

---

## Validation Rules

| Field | Required | Type | Allowed Values | Notes |
|-------|----------|------|---------------|-------|
| `branch` | yes | string | any non-empty | Must be non-empty |
| `commit_prefix` | yes | string | any non-empty | Should match project prefixes |
| `push_policy` | no | string | `push`, `no-push` | Defaults to `push` |
| `pr_policy` | no | string | `create`, `skip` | Defaults to `create` |
| `stop_after_push` | no | boolean | `true`, `false` | Defaults to `true` |
| `exclude_paths` | no | string[] | array of strings | Defaults to `[".do/"]` |

**Unknown keys:** Forward-compatible — unknown keys produce a warning in validation output but do not cause validation failure.

**Invalid:** Missing `branch`, missing `commit_prefix`, non-string `branch` or `commit_prefix`, disallowed `push_policy` or `pr_policy` value, non-boolean `stop_after_push`, non-array `exclude_paths`, or non-string elements in `exclude_paths`.

---

## Passing the Contract

Entry commands pass the contract via `$ARGUMENTS` as JSON:

```
/do:task --delivery='{"branch":"feat/LLDEV-851","commit_prefix":"feat","stop_after_push":true}' "description of what to do"
```

**Quoting rule:** Wrap the JSON value in single quotes. The JSON itself must use double quotes. Do not mix quoting styles inside the JSON payload.

**Field ordering:** Fields may appear in any order inside the JSON object.

**Minimal valid contract** (all defaults applied for omitted fields):

```json
{
  "branch": "feat/LLDEV-851",
  "commit_prefix": "feat"
}
```

**Fully explicit contract:**

```json
{
  "branch": "feat/LLDEV-851",
  "commit_prefix": "feat",
  "push_policy": "push",
  "pr_policy": "create",
  "stop_after_push": true,
  "exclude_paths": [".do/"]
}
```

---

## `## Delivery Contract` Section (agent-readable)

When a task file is created with a delivery contract, the orchestrator renders a human-readable `## Delivery Contract` section in the task file (between `## Problem Statement` and `## Clarifications`). Example:

```markdown
## Delivery Contract

- **Branch:** feat/LLDEV-851
- **Commit prefix:** feat
- **Push policy:** push
- **PR policy:** create
- **Stop after push:** true
- **Exclude paths:** .do/
```

The executioner reads this section. The `delivery:` frontmatter fields carry the same data for machine parsing by orchestrator scripts.

---

## Validator

The validator script `skills/do/scripts/validate-delivery-contract.cjs` exports:

- `validateDeliveryContract(obj)` — validates a parsed delivery object, returns `{ valid, errors, warnings }`
- `applyDefaults(obj)` — returns new object with defaults merged for optional fields
- `parseDeliveryArg(argString)` — parses the `--delivery='...'` string, returns the flat delivery object on success or `{ error }` on failure

Entry commands and `/do:task` both use the same validator. Non-conforming contracts fail loudly with a list of validation errors rather than silently degrading.

---

## Onboarding

When `/do:task` is invoked without `--delivery=...` and the project config's `delivery_contract.onboarded` flag is `false`, the onboarding flow triggers. See `skills/do/references/delivery-onboarding.md` for the three-option flow.

---

## Entry Command Integration Checklist

To wire an entry command (e.g., `/jira:start`) to pass the delivery contract:

1. Determine the branch name for the work item (e.g., `feat/LLDEV-<id>`)
2. Determine the correct commit prefix from the project's `project.md` allowed prefixes list
3. Decide `push_policy`, `pr_policy`, `stop_after_push` based on the team's review workflow
4. Build the `--delivery='...'` JSON string
5. Append it before the description argument: `/do:task --delivery='...' "<description>"`
6. Reference `validate-delivery-contract.cjs` to verify the JSON before passing it

After wiring, verify by calling `validateDeliveryContract()` with the constructed object. If it returns `{ valid: false }`, fix the errors before proceeding.
