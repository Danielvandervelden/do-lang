---
title: Remove --registry flag from npm install in update.md
stage: complete
stages:
  refinement: skipped
  grilling: skipped
  execution: review_pending
  verification: pending
  abandoned: false
council_review_ran:
  plan: skipped
  code: true
fast_path: true
---

## Problem Statement

The `--registry https://npm.pkg.github.com` flag needs to be removed from the `npm install -g` command in `skills/do/update.md` (Step 5). The flag breaks transitive dependency resolution, but the `.npmrc` scope config (`@danielvandervelden:registry=https://npm.pkg.github.com`) already handles routing for this package correctly.

## Clarifications

None.

## Approach

1. Open `skills/do/update.md` and locate the `npm install -g` command in Step 5.
2. Remove the `--registry https://npm.pkg.github.com` flag from that line (and from any error-recovery snippets that repeat the same command).
3. Verify the file looks correct in context and that the Step 2 pre-flight npmrc check language still aligns with the updated install command.

## Context Loaded

- `skills/do/update.md` — the file to be changed

## Execution Log

1. Read `skills/do/update.md` — confirmed the `--registry https://npm.pkg.github.com` flag appears on the `npm install -g` command in Step 5 (line 105).
2. Removed the `--registry https://npm.pkg.github.com` flag from that line. The `.npmrc` scope config (`@danielvandervelden:registry=https://npm.pkg.github.com`) already handles registry routing for `@danielvandervelden` scoped packages.
3. The `npm view` command in Step 3 (which queries the registry directly, not via scope) retains its `--registry` flag — that is correct behavior.
4. The Step 2 pre-flight npmrc check language still aligns with the updated install command — it validates that the scope config exists, which is now the sole routing mechanism.
