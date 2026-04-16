---
id: 260416-release-do-backlog-skill-bump-
created: 2026-04-16T00:00:00.000Z
updated: 2026-04-16T00:00:00.000Z
description: >-
  Release do:backlog skill — bump version, update README.md and database
  project.md, commit and publish to GitHub Packages
stage: complete
stages:
  refinement: complete
  grilling: complete
  execution: complete
  verification: complete
  abandoned: false
council_review_ran:
  plan: true
  code: true
confidence:
  score: 0.95
  factors:
    context: 1
    scope: -0.05
    complexity: 0
    familiarity: 0
---

# Release do:backlog skill — bump version, update README.md and database project.md, commit and publish to GitHub Packages

## Problem Statement

The `/do:backlog` skill has been built and evaluated (12/12 score, 100%). It is currently sitting as an untracked file in the working tree along with related modifications to `do.md`, `fast.md`, `task.md`, and `references/task-template.md`. These changes need to be committed, the version bumped, documentation updated, and a new release published to GitHub Packages.

**What needs to happen:**
1. Bump version from 1.9.2 to 1.10.0 (new feature = minor bump)
2. Update README.md Commands table with the `/do:backlog` entry
3. Update `database/projects/do/project.md` with the new feature entry, version number, and "Last updated" line
4. Commit all changes (new skill + modified skills + docs + version bump)
5. Tag, create GitHub release, and publish to GitHub Packages

**Acceptance criteria:**
- `package.json` version is `1.10.0`
- README.md Commands table includes `/do:backlog` with description
- `database/projects/do/project.md` lists `/do:backlog` in Features, shows version 1.10.0, updated "Last updated" line
- All files committed to main with conventional commit message
- Git tag `v1.10.0` created and pushed
- GitHub release `v1.10.0` created with release notes
- Package published to GitHub Packages registry

## Clarifications

None needed. The release flow is well-documented in project.md and has been followed many times (12 prior versions published). All artifacts are already in the working tree.

## Context Loaded

- `~/workspace/database/projects/do/project.md` — Release flow (6-step process), conventions (conventional commits), current version (1.9.2), features list, tech stack
- `~/workspace/github-projects/do/README.md` — Current Commands table (9 commands), Agent Pipeline docs, Configuration section
- `~/workspace/github-projects/do/package.json` — Current version 1.9.2, no yalc artifacts present
- `~/workspace/github-projects/do/skills/do/backlog.md` — The new skill (10.7KB, 4 sub-commands: list/add/start/done)
- `~/workspace/github-projects/do/.do/config.json` — Project config, context7 enabled
- `git status` — Shows: 1 untracked file (backlog.md), 4 modified files (do.md, fast.md, task.md, task-template.md)
- `npm view versions` — Highest published: 1.9.2
- `gh release list` — Highest release: v1.9.2 (versions are in sync)

## Approach

### Step 1: Bump version in package.json
- File: `~/workspace/github-projects/do/package.json`
- Change `"version": "1.9.2"` to `"version": "1.10.0"`
- Verify no yalc artifacts in dependencies (already confirmed clean)

### Step 2: Update README.md Commands table
- File: `~/workspace/github-projects/do/README.md`
- The Commands table (lines 83-93) currently has 9 rows. The last row is `/do:optimise` (line 93). Insert a new row after `/do:optimise` as the 10th and final entry:
  ```
  | `/do:backlog` | Manage the backlog — list, add, start (promote to task), done (remove) |
  ```
- Verified: README.md lines 83-93 confirm `/do:optimise` is the last row in the table. No other commands follow it.

### Step 3: Update database/projects/do/project.md
- File: `~/workspace/database/projects/do/project.md`
- Change `**Current version**: 1.9.2` to `**Current version**: 1.10.0`
- Add `/do:backlog` to the Features list:
  ```
  - `/do:backlog` — Backlog management (list, add, start/promote to task, done/remove)
  ```
- Update the "Last updated" line at the bottom with new date, version, and changelog summary

### Step 4: Stage and present changes for user approval (do-lang repo)
- **4a: Stage files** in `~/workspace/github-projects/do/`:
  - `skills/do/backlog.md` (new)
  - `skills/do/do.md` (modified -- routing table + inference examples)
  - `skills/do/fast.md` (modified -- backlog cleanup on completion)
  - `skills/do/task.md` (modified -- backlog cleanup on completion)
  - `skills/do/references/task-template.md` (modified -- backlog_item field)
  - `package.json` (version bump)
  - `README.md` (new command row)
- **4b: Show diff summary** -- Run `git diff --cached --stat` and display the staged changes summary to the user along with the proposed commit message: `feat: add /do:backlog skill for backlog management`
- **4c: Await user confirmation** -- Do NOT run `git commit` until the user explicitly approves. Present the diff summary and commit message, then ask "Proceed with commit?"
- **4d: Commit** -- Only after user approval, run `git commit` with the message: `feat: add /do:backlog skill for backlog management`
- Note: database project.md lives in the parent workspace repo, not the do-lang repo. It is handled separately in Step 7.

### Step 5: Tag, push, and create GitHub release
Each sub-step depends on the prior one completing successfully. Do not proceed to the next sub-step if the current one fails.

- **5a: Pull and push main** -- Run `git pull origin main` first to ensure the local branch is up to date and prevent rejected pushes. Then run `git push origin main`. Depends on: Step 4d (commit) completed successfully.
- **5b: Create and push tag** -- Run `git tag v1.10.0` then `git push origin v1.10.0`. Depends on: Step 5a (push main) completed successfully.
- **5c: Create GitHub release** -- Run:
  ```
  gh release create v1.10.0 --title "v1.10.0 - /do:backlog skill" --notes "..."
  ```
  Release notes should summarize: new /do:backlog skill (list/add/start/done), backlog cleanup integration in /do:task and /do:fast completion, backlog_item field in task template, routing updates in do.md. Depends on: Step 5b (tag pushed) completed successfully.

### Step 6: Publish to GitHub Packages
- Run: `npm publish`
- Verify: `npm view @danielvandervelden/do-lang version --registry https://npm.pkg.github.com`

### Step 7: Stage and present database project.md changes for user approval (workspace repo)
- The database changes are in `~/workspace/` (the parent workspace repo), not in `~/workspace/github-projects/do/`
- **7a: Stage** `database/projects/do/project.md` in `~/workspace/`
- **7b: Show diff summary** -- Run `git diff --cached --stat` and display the staged changes
- **7c: Await user confirmation** -- Present the proposed commit message `docs(do): update project.md for v1.10.0 /do:backlog release` and ask "Proceed with commit?"
- **7d: Commit** -- Only after user approval, run `git commit`

## Concerns

1. **Two-repo commit** — `database/projects/do/project.md` lives in the workspace repo (`~/workspace/`), not the do-lang repo (`~/workspace/github-projects/do/`). The executioner needs to commit in two separate repositories. **Mitigation:** Steps 4 and 7 are explicitly separated. The do-lang repo commit and publish happen first, then the database update follows.

2. **User preference: no auto-commit** — User's CLAUDE.md states "Never automatically commit files." **Mitigation:** The executioner should stage files and present the commit for user approval rather than auto-committing. Present the diff summary and proposed commit message, then ask before running `git commit`.

3. **npm publish requires auth** — Publishing to GitHub Packages requires a valid auth token in `~/.npmrc`. **Mitigation:** This has worked for all 12 prior releases. If it fails, the error message will indicate the auth issue clearly.

## Execution Log

## Council Review

## Verification Results
