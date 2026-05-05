---
name: do:update
description: "Check for and install newer versions of do-lang. Use when the user asks 'is there a newer version?', 'update do-lang', 'upgrade /do', 'check for do updates', or when any /do:* command behaves unexpectedly and an update might fix it. Compares installed vs latest registry version, skips install if already on latest, runs npm install -g (not npm update -g) to ensure postinstall hooks fire."
allowed-tools:
  - Read
  - Bash
  - AskUserQuestion
---

# /do:update

Check whether a newer version of `@danielvandervelden/do-lang` is available and install it if so.

## Why this exists

Updating via `npm install -g` (not `npm update -g`) is required because `npm update -g` does not trigger the postinstall script. The postinstall script is what copies skill files to `~/.claude/commands/do/`. Skipping postinstall means the running skills stay on the old version even though the package itself was updated.

The `@danielvandervelden:registry=https://npm.pkg.github.com` entry in `~/.npmrc` handles registry routing for this scoped package — no `--registry` flag is needed on the install command.

## Step 1: Get installed version

Run the following and parse the JSON output:

```bash
npm ls -g @danielvandervelden/do-lang --json 2>/dev/null
```

Expected output shape:

```json
{
  "dependencies": {
    "@danielvandervelden/do-lang": {
      "version": "1.6.1"
    }
  }
}
```

Extract the version string. If the key is absent (package not installed at all), show:

```
@danielvandervelden/do-lang is not installed globally.
Run: npm install -g @danielvandervelden/do-lang
```

Then stop.

**Fallback** — if `npm ls -g` returns malformed JSON or exits non-zero, use:

```bash
npm root -g
```

Then read `<npm-root>/@danielvandervelden/do-lang/package.json` and extract the `version` field. This is the authoritative installed location.

## Step 2: Pre-flight — verify npmrc config

Before hitting the registry, confirm that `~/.npmrc` contains both required entries:

```bash
grep -q '//npm.pkg.github.com/:_authToken=' ~/.npmrc 2>/dev/null && echo "auth_ok" || echo "auth_missing"
grep -q '@danielvandervelden:registry=https://npm.pkg.github.com' ~/.npmrc 2>/dev/null && echo "scope_ok" || echo "scope_missing"
```

If either check fails, report specifically which entry is missing and provide remediation:

**Missing auth token:**

```
Add to ~/.npmrc:
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_PAT
```

The PAT needs `read:packages` scope.

**Missing scoped registry:**

```
Add to ~/.npmrc:
@danielvandervelden:registry=https://npm.pkg.github.com
```

If either is missing, abort and ask the user to fix their npmrc before retrying.

## Step 3: Get latest version from registry

```bash
npm view @danielvandervelden/do-lang version --registry https://npm.pkg.github.com 2>&1
```

This returns the latest published version as a plain string (e.g. `1.7.0`).

If the command fails:

- Auth error (401/403) → "Registry auth failed. Check that your GitHub PAT in ~/.npmrc has `read:packages` scope and is not expired."
- Network error → "Could not reach https://npm.pkg.github.com. Check your network connection."
- Other → Show raw error output and stop.

## Step 4: Compare versions

- **Installed == latest**: Print "Already on latest (v<version>). No update needed." and stop.
- **Installed older**: Print "Update available: v<installed> → v<latest>" and proceed.

Use simple string equality for the "already on latest" check. npm resolves actual semver during install — no need to implement semver comparison here.

## Step 5: Run the install

```bash
npm install -g @danielvandervelden/do-lang
```

Capture the full output. Check exit code:

- Non-zero exit → Show error output. If output contains `EACCES`, suggest:
  ```
  Permission error. Try:
    sudo npm install -g @danielvandervelden/do-lang
  Or fix npm permissions: https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally
  ```
- Exit 0 → Continue to Step 6.

## Step 6: Verify postinstall ran

The postinstall script (`bin/install.cjs`) logs specific lines when it runs. Check the captured install output from Step 5 for these lines:

```
do commands installed to /Users/<user>/.claude/commands/do
do agents installed to /Users/<user>/.claude/agents
```

If those log lines are present in the output, postinstall ran in this install. Then also verify the concrete files exist:

```bash
test -f ~/.claude/commands/do/update.md && echo "claude_ok" || echo "claude_missing"
ls ~/.claude/agents/do-*.md 2>/dev/null | head -1 | grep -q . && echo "agents_ok" || echo "agents_missing"
```

For agents: if `agents_missing`, downgrade to a warning — the commands directory check is the primary success indicator.

Report results. If any check fails even though install exited 0, warn:

```
Warning: postinstall may not have completed. Check manually:
  ls ~/.claude/commands/do/
```

## Step 7: Report result

Show a summary:

```
Updated @danielvandervelden/do-lang

  v<old> → v<new>

Files installed:
  [ok] ~/.claude/commands/do/update.md
  [ok] ~/.claude/agents/do-*.md
```

If any verification file was missing, replace the corresponding line with a warning.
