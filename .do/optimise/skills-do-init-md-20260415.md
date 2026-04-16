## Optimisation Report: `skills/do/init.md`

**Target type:** skill
**Technologies:** claude-code, markdown
**Effort level:** medium
**Findings:** 6 (1C / 3W / 2S)

---

### Critical

- **[C1]** `skills/do/init.md:53` — Project detection check falsely matches workspace root
  > `test -d .git || test -f package.json`

  **Fix:** Replace with `test ! -f .do-workspace.json`. The workspace marker's *presence* means we're at the root (→ health check only); its *absence* means we're in a project directory. The current check uses `.git` which is always true at the workspace root since it's a git repo itself.
  **Source:** Observed failure during live invocation; `.do-workspace.json` is the canonical workspace marker per `init-workspace-setup.md:84`

---

### Warnings

- **[W1]** `skills/do/references/init-project-setup.md:105` — Database path hardcoded to `~/workspace/database/`
  > `~/workspace/database/projects/<project-name>/project.md?`

  **Fix:** Before displaying this prompt, read `database` from the nearest `.do-workspace.json` and substitute the actual configured path. Use: `node -e "console.log(require('<workspace>/.do-workspace.json').database)"`. Users who chose a non-default database location during workspace setup will be shown the wrong path.
  **Source:** `init-workspace-setup.md:88` — workspace config stores `database` as an absolute path

- **[W2]** `skills/do/references/init-health-check.md:13` — `<workspace-path>` placeholder left unresolved
  > `node ~/.claude/commands/do/scripts/workspace-health.cjs <workspace-path>`

  **Fix:** Add a preceding step that reads the workspace path from `.do-workspace.json`: `node -e "console.log(require('./.do-workspace.json').workspace)"` — then substitute into the command. Without this, Claude has no instruction on how to determine the workspace path and may guess or use CWD.
  **Source:** `workspace-health.cjs:361` — requires an explicit path argument; errors if missing

- **[W3]** `skills/do/references/init-health-check.md:30` — No code shown for updating `availableTools` in `.do-workspace.json`
  > `If different: update config and display "AI tools updated: <new-list>"`

  **Fix:** Add the node one-liner showing how to read and write the update:
  ```js
  node -e "
  const fs = require('fs');
  const cfg = JSON.parse(fs.readFileSync('.do-workspace.json','utf8'));
  cfg.availableTools = <new-tools>;
  fs.writeFileSync('.do-workspace.json', JSON.stringify(cfg, null, 2));
  "
  ```
  Without concrete code, Claude will produce inconsistent or incorrect `.do-workspace.json` writes.
  **Source:** Peer pattern from `task.md:103-109` and `fast.md:148-155` — every config write in the codebase uses explicit `fs.readFileSync` + `JSON.parse` + `fs.writeFileSync`

---

### Suggestions

- **[S1]** `skills/do/init.md:7` — `AskUserQuestion` listed in `allowed-tools` but documented as broken post-skill-load
  > `- AskUserQuestion`

  **Fix:** Remove `AskUserQuestion` from `allowed-tools` to match the documented workaround. `init-workspace-setup.md:8` explicitly states: *"Due to AskUserQuestion bug (fails after skill load), use inline prompts."* Listing it in `allowed-tools` creates a misleading affordance — other agents might try to call it.
  **Source:** `skills/do/references/init-workspace-setup.md:8`

- **[S2]** `skills/do/references/init-project-setup.md:119` — `@references/config-template.json` substitution map doesn't mention `version`, `active_task`, or `active_debug`
  > `2. **Create config.json** from @references/config-template.json:`

  **Fix:** Add a note that `version`, `active_task`, and `active_debug` are left as template defaults (`"0.3.0"`, `null`, `null`) and don't need substitution. Omitting them creates ambiguity — Claude may try to prompt the user for values that aren't questions.
  **Source:** `skills/do/references/config-template.json:2-6`

---

### Sources Consulted

- **ctx7:** `/websites/code_claude` — "Claude Code skill file structure conventions, frontmatter keys, and allowed-tools patterns"; "slash command arguments ARGUMENTS variable how to pass args to skills"
- **Peer files:** `task.md`, `fast.md`, `scan.md`, `abandon.md`, `config-template.json`
- **Web:** none (effort=medium)
- **Skipped:** none (budget not exhausted)
