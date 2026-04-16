---
id: backlog-fix-do-update-registry-flag
created: 2026-04-15T00:00:00Z
updated: 2026-04-15T00:00:00Z
description: "Fix do:update skill — remove --registry flag from npm install command"

stage: backlog
stages:
  refinement: pending
  grilling: pending
  execution: pending
  verification: pending
  abandoned: false

council_review_ran:
  plan: false
  code: false
---

# Fix do:update registry flag

## Problem Statement

The `do:update` skill (Step 5) instructs passing `--registry https://npm.pkg.github.com` to `npm install -g`. This breaks dependency resolution — all packages including transitive dependencies (e.g. `gray-matter`) are looked up on GitHub Packages instead of the public npm registry, causing E404 errors.

The `@danielvandervelden:registry` scope is already configured in `~/.npmrc`, so npm automatically routes `@danielvandervelden/*` packages to GitHub Packages without the flag.

## Fix

`skills/do/update.md` Step 5 — remove `--registry https://npm.pkg.github.com` from the install command:

```
# Before
npm install -g @danielvandervelden/do-lang --registry https://npm.pkg.github.com

# After
npm install -g @danielvandervelden/do-lang
```

Also update the "Why this exists" note and Step 3 (which also passes `--registry`) to reflect that the flag is only needed for the registry lookup (view), not the install.

## Candidate for /do:fast

Single-file change, no logic involved.
