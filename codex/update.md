---
name: do:update
description: Check for and install newer versions of do-lang. Use when user asks "is there a newer version?", "update do-lang", "upgrade /do", or "check for do updates".
argument-hint: ""
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
---

<objective>
Check whether a newer version of @danielvandervelden/do-lang is available and install it if so. Follows the same workflow as Claude Code /do:update.
</objective>

<process>

## Step 1: Get installed version

```bash
npm ls -g @danielvandervelden/do-lang --json 2>/dev/null
```

Parse JSON output and extract the version from `dependencies["@danielvandervelden/do-lang"].version`.

Fallback if JSON is malformed or key is absent:
```bash
cat "$(npm root -g)/@danielvandervelden/do-lang/package.json" 2>/dev/null | grep '"version"' | head -1
```

If package is not installed, show:
```
@danielvandervelden/do-lang is not installed globally.
Run: npm install -g @danielvandervelden/do-lang --registry https://npm.pkg.github.com
```
Then stop.

## Step 2: Pre-flight — verify npmrc config

```bash
grep -q '//npm.pkg.github.com/:_authToken=' ~/.npmrc 2>/dev/null && echo "auth_ok" || echo "auth_missing"
grep -q '@danielvandervelden:registry=https://npm.pkg.github.com' ~/.npmrc 2>/dev/null && echo "scope_ok" || echo "scope_missing"
```

If auth_missing: instruct user to add `//npm.pkg.github.com/:_authToken=YOUR_GITHUB_PAT` to ~/.npmrc (PAT needs `read:packages` scope).
If scope_missing: instruct user to add `@danielvandervelden:registry=https://npm.pkg.github.com` to ~/.npmrc.

Abort if either is missing.

## Step 3: Get latest version from registry

```bash
npm view @danielvandervelden/do-lang version --registry https://npm.pkg.github.com 2>&1
```

Handle errors: auth failure (401/403), network error, other. Show targeted message and stop on failure.

## Step 4: Compare versions

If installed == latest: "Already on latest (v<version>). No update needed." and stop.
If installed older: "Update available: v<installed> → v<latest>" and proceed.

## Step 5: Run the install

```bash
npm install -g @danielvandervelden/do-lang --registry https://npm.pkg.github.com
```

Capture full output and exit code. On EACCES error, suggest sudo or npm permission fix.

## Step 6: Verify postinstall ran

Check the captured install output from Step 5 for these log lines emitted by `bin/install.cjs`:

```
do commands installed to /Users/<user>/.claude/commands/do
do agents installed to /Users/<user>/.claude/agents
```

If those lines are present, postinstall ran in this install. Then verify the concrete files:

```bash
test -f ~/.claude/commands/do/update.md && echo "claude_ok" || echo "claude_missing"
ls ~/.claude/agents/do-*.md 2>/dev/null | head -1 | grep -q . && echo "agents_ok" || echo "agents_missing"
```

If `~/.codex` exists, also check whether the Codex log line appeared (`do commands installed to` pointing at `~/.codex/commands/do`) and verify:

```bash
test -f ~/.codex/commands/do/update.md && echo "codex_ok" || echo "codex_missing"
```

If `~/.codex` does not exist, skip Codex verification entirely — do not report `codex_missing`.

For agents: if `agents_missing`, downgrade to a warning — the commands directory check is the primary success indicator.

If postinstall log lines are absent or files are missing, warn the user to check manually.

## Step 7: Report result

Show:
```
Updated @danielvandervelden/do-lang
  v<old> → v<new>

Files installed:
  [ok] ~/.claude/commands/do/update.md
  [ok] ~/.claude/agents/ (do-* agents)
  [ok] ~/.codex/commands/do/update.md   (if Codex present)
```

</process>
