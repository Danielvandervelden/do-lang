# Phase 3: Project Setup - Research

**Researched:** 2026-04-13
**Domain:** Project-level initialization and config management for /do skill system
**Confidence:** HIGH

## Summary

Phase 3 extends the workspace-level `/do:init` implemented in Phase 2 to handle project-level concerns. The phase creates a `.do/` folder with `config.json` (project settings) and `tasks/` folder (task storage). The key technical challenges are: (1) extending existing skill logic without breaking workspace-level behavior, (2) designing a config.json schema that supports future phases (council reviews, task tracking), and (3) implementing project health checks parallel to workspace health checks.

The implementation follows established patterns from Phase 2: detection via marker/folder existence, health check scripts returning JSON, and interactive setup with inline prompts (avoiding AskUserQuestion due to the known bug after skill load).

**Primary recommendation:** Extend `skills/do/SKILL.md` with project-level detection, create `project-health.cjs` following the workspace-health.cjs pattern, and use inline JSON validation (no external deps) for config.json.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Automatic trigger on any `/do:*` command if `.do/` folder missing
- **D-02:** Health check mode for already-initialized projects
- **D-03:** Detection requires BOTH folder existence AND valid config marker (`.do/` + `.do/config.json` with version field)
- **D-04:** Council review toggles use nested object structure with per-type model config
- **D-05:** Per-review-type model configuration (planning/execution each have enabled + model)
- **D-06:** Version marker: `"version": "0.1.0"` in config.json
- **D-07:** Project metadata: `"project_name"`, `"database_entry"` (boolean)
- **D-08:** Active task tracked: `"active_task": "filename.md"` or `null`
- **D-09:** Grill threshold: `"auto_grill_threshold": 0.9`
- **D-10:** No hardcoded defaults; interactive setup asks user preferences
- **D-11:** Interactive setup asks: council preferences, grill threshold, database entry check, project name
- **D-12:** `/do:init` always checks both workspace AND project levels
- **D-13:** Flow: workspace check -> (init or health check) -> if in project: project check -> (init or health check)
- **D-14:** Report combined status showing both workspace and project state

### Claude's Discretion
- Exact wording of interactive setup prompts
- Order of setup questions
- Health check validation details beyond version and folder existence
- Error messages for invalid states

### Deferred Ideas (OUT OF SCOPE)
- **Database scanning** - Phase 4 handles `/do:scan`
- **Task workflow** - Phase 5+ handles task creation/execution
- **Codex CLI support** - Phase 12 handles `/do:*` in Codex
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TS-03 | Project-level initialization: detect missing `.do/`, create `config.json` and `tasks/` | Config schema defined (D-04 through D-09), detection logic established (D-03), folder structure documented |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Always use `/skill-creator`** when creating or modifying skill files - never hand-write skills directly
- **Conventional commits** with allowed prefixes: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`
- **Branch naming:** `feat/<description>`, `fix/<description>`, `chore/<description>`

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | >=16.7.0 | Runtime for health check scripts | Already specified in package.json engines field |
| fs (built-in) | N/A | File system operations | Zero dependencies, available in all Node.js |
| path (built-in) | N/A | Path manipulation | Zero dependencies, cross-platform paths |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| JSON.parse | Built-in | Config file parsing and validation | Always - no external JSON schema library needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline validation | ajv (8.18.0) or zod (4.3.6) | External deps increase package size; inline is sufficient for simple schema |
| CJS scripts | ESM modules | Package is CJS (postinstall script), keep consistent |

**Installation:**
No additional packages needed - all functionality uses Node.js built-ins.

**Version verification:** Node.js >=16.7.0 already specified in package.json; scripts use CommonJS syntax compatible with all supported versions.

## Architecture Patterns

### Recommended Project Structure
```
skills/do/
├── SKILL.md                    # Main skill file (extend for project-level)
├── references/
│   ├── agents-template.md      # (Phase 2)
│   ├── pointer-templates.md    # (Phase 2)
│   └── config-template.json    # NEW: default config.json template
└── scripts/
    ├── workspace-health.cjs    # (Phase 2) - reference pattern
    └── project-health.cjs      # NEW: project health checks
```

### Pattern 1: Detection Flow Extension
**What:** Extend workspace detection to include project-level checks
**When to use:** Every `/do:*` command invocation
**Example:**
```
// Detection flow (from SKILL.md)
1. Check workspace: grep "do init completed" ~/workspace/CLAUDE.md
2. If workspace missing: trigger workspace init, then exit (user runs command again)
3. If workspace exists AND cwd is in a git repo:
   a. Check project: test -d .do && test -f .do/config.json
   b. If project missing: trigger project init
   c. If project exists: run project health check
4. Proceed with command
```

### Pattern 2: Health Check JSON Output
**What:** Standardized JSON output format for all health checks
**When to use:** Both workspace and project health checks
**Example:**
```json
{
  "healthy": true,
  "version": "0.1.0",
  "issues": [
    {
      "type": "missingTasksFolder",
      "severity": "error",
      "details": ".do/tasks/ folder not found"
    }
  ]
}
```
Source: Established in `workspace-health.cjs` (lines 17-30)

### Pattern 3: Interactive Setup with Inline Prompts
**What:** Ask questions via inline text, wait for user response between questions
**When to use:** Initial project setup (due to AskUserQuestion bug after skill load)
**Example:**
```markdown
**Step 1: Display welcome and ask project name**

```
/do:init - Project Setup

I'll set up this project for the do workflow.
This creates:
- .do/config.json (project settings)
- .do/tasks/ (task storage)

Detected project: my-project
Confirm or enter a different name:
```

Wait for user response.
```
Source: Established pattern in SKILL.md (lines 48-76)

### Anti-Patterns to Avoid
- **AskUserQuestion after skill load:** Fails silently - use inline prompts and wait for response
- **Hardcoded defaults without asking:** User explicitly wants interactive setup (D-10)
- **Modifying workspace-level behavior:** Only extend, don't change existing workspace detection

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON schema validation | Full JSON Schema validator | Inline field checks | Simple schema, no external deps needed |
| Config file watching | File watcher system | Read on demand | Skills are stateless, no persistent processes |
| Interactive menus | TUI framework | Inline prompts with plain text | Skill system constraint, AskUserQuestion bug |
| Git repo detection | Custom git parser | `test -d .git` or `git rev-parse` | Standard approach, reliable |

**Key insight:** The do package has zero runtime dependencies by design. Every feature must work with Node.js built-ins only.

## Common Pitfalls

### Pitfall 1: Circular Initialization
**What goes wrong:** Project init triggers workspace check, workspace check triggers project check, infinite loop
**Why it happens:** Both levels call each other without state guards
**How to avoid:** Clear flow with explicit states: workspace_needed -> workspace_init -> project_needed -> project_init
**Warning signs:** Repeated prompts, skill timeout, "Maximum call stack size exceeded"

### Pitfall 2: CWD Not a Project
**What goes wrong:** Running `/do:init` in a directory that's not a git repo
**Why it happens:** User runs command in wrong directory, or directory has no .git
**How to avoid:** Detect "is this a project?" before project-level logic. A project needs either `.git/` directory or `package.json`
**Warning signs:** Creating `.do/` in home directory or workspace root

### Pitfall 3: Config Version Mismatch
**What goes wrong:** Reading config.json from newer/older version, schema differs
**Why it happens:** User upgrades do-lang but has old config, or downgrades
**How to avoid:** Version field in config.json (D-06), health check compares versions
**Warning signs:** Missing required fields, unexpected null values

### Pitfall 4: Interactive Prompt Timing
**What goes wrong:** Output appears but skill continues without waiting for user
**Why it happens:** Not following the "display then STOP" pattern
**How to avoid:** Each setup step ends with explicit wait-for-response instruction
**Warning signs:** Multiple questions appearing at once, config created with empty values

## Code Examples

### config.json Schema
```json
{
  "version": "0.1.0",
  "project_name": "my-project",
  "database_entry": false,
  "active_task": null,
  "auto_grill_threshold": 0.9,
  "council_reviews": {
    "planning": {
      "enabled": true,
      "model": "codex-1"
    },
    "execution": {
      "enabled": false,
      "model": "o3"
    }
  }
}
```
Source: Decisions D-04 through D-09 from CONTEXT.md

### Project Detection Logic
```javascript
// In project-health.cjs

function detectProject(cwd) {
  const hasGit = fs.existsSync(path.join(cwd, '.git'));
  const hasPackageJson = fs.existsSync(path.join(cwd, 'package.json'));
  
  if (!hasGit && !hasPackageJson) {
    return { isProject: false, reason: 'No .git or package.json found' };
  }
  
  const doFolder = path.join(cwd, '.do');
  const configPath = path.join(doFolder, 'config.json');
  
  if (!fs.existsSync(doFolder)) {
    return { isProject: true, initialized: false, reason: 'No .do folder' };
  }
  
  if (!fs.existsSync(configPath)) {
    return { isProject: true, initialized: false, reason: 'No config.json' };
  }
  
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (!config.version) {
      return { isProject: true, initialized: false, reason: 'No version in config' };
    }
    return { isProject: true, initialized: true, version: config.version };
  } catch (e) {
    return { isProject: true, initialized: false, reason: 'Invalid JSON in config' };
  }
}
```
Source: Logic derived from D-03 requirements

### Project Health Check Script Pattern
```javascript
// project-health.cjs (follows workspace-health.cjs pattern)

function checkProjectHealth(projectPath) {
  const issues = [];
  
  // Check .do folder exists
  const doFolder = path.join(projectPath, '.do');
  if (!dirExists(doFolder)) {
    return { healthy: false, version: null, issues: [
      { type: 'noDotDoFolder', severity: 'error', details: '.do/ folder not found' }
    ]};
  }
  
  // Check config.json
  const configPath = path.join(doFolder, 'config.json');
  const config = readConfigSafe(configPath);
  if (!config) {
    issues.push({ type: 'noConfig', severity: 'error', details: 'config.json not found or invalid' });
    return { healthy: false, version: null, issues };
  }
  
  // Check version
  if (!config.version) {
    issues.push({ type: 'noVersion', severity: 'error', details: 'Missing version field' });
  }
  
  // Check required fields
  const requiredFields = ['project_name', 'council_reviews', 'auto_grill_threshold'];
  for (const field of requiredFields) {
    if (config[field] === undefined) {
      issues.push({ type: 'missingField', severity: 'warning', details: `Missing field: ${field}` });
    }
  }
  
  // Check tasks folder
  const tasksFolder = path.join(doFolder, 'tasks');
  if (!dirExists(tasksFolder)) {
    issues.push({ type: 'noTasksFolder', severity: 'error', details: '.do/tasks/ folder not found' });
  }
  
  // Check active_task reference
  if (config.active_task) {
    const taskPath = path.join(tasksFolder, config.active_task);
    if (!fs.existsSync(taskPath)) {
      issues.push({ type: 'staleActiveTask', severity: 'warning', details: `active_task points to missing file: ${config.active_task}` });
    }
  }
  
  // Check database_entry consistency
  if (config.database_entry === true) {
    // Would need workspace config to verify database path
    // For now, flag for future validation
  }
  
  const hasErrors = issues.some(i => i.severity === 'error');
  return { healthy: !hasErrors, version: config.version || null, issues };
}
```
Source: Pattern from workspace-health.cjs (lines 290-335), adapted for project level

### SKILL.md Extension Pattern
```markdown
### Project-Level Detection

After workspace check passes, detect project-level setup:

**Step 1: Check if CWD is a project**

```bash
test -d .git || test -f package.json
```

If neither exists, skip project-level logic (not in a project).

**Step 2: Check project initialization**

```bash
test -d .do && test -f .do/config.json && grep -q '"version"' .do/config.json
```

- **If check fails:** Trigger interactive project setup
- **If check passes:** Run project health check

**Step 3: Project health check**

```bash
node <skill-path>/scripts/project-health.cjs .
```

Parse JSON output and display results.
```
Source: Derived from D-12, D-13, D-14 requirements

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Global config (~/.do/) | Per-project config (.do/) | Project design decision | No global state to manage |
| File existence as state | Explicit version field + validation | D-03 decision | More reliable detection |
| Silent defaults | Interactive setup | D-10 decision | User controls all settings |

**Deprecated/outdated:**
- None - this is new implementation

## Open Questions

1. **Database entry verification**
   - What we know: config.json has `database_entry: boolean` flag
   - What's unclear: How to verify database entry exists without knowing workspace config location
   - Recommendation: Project health check can only warn "database_entry is true but unverified"; full verification needs workspace context passed in

2. **Model options for council reviews**
   - What we know: Schema has per-review-type model field (D-05)
   - What's unclear: What models are valid options? (codex-1, o3, claude-sonnet, etc.)
   - Recommendation: Accept any string for now; validation can be added in Phase 8 (council implementation)

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Health check scripts | Yes | v22.21.1 | None needed (>=16.7.0 required) |
| git | Project detection | Yes | (system) | Use package.json detection |

**Missing dependencies with no fallback:** None

**Missing dependencies with fallback:**
- Git: If git not installed, fall back to package.json presence for project detection

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected - manual testing via npm install flow |
| Config file | None (no test runner configured) |
| Quick run command | `node skills/do/scripts/project-health.cjs .` |
| Full suite command | Manual: yalc publish + install + run commands |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TS-03a | Detect missing .do/ folder | smoke | `test ! -d .do && echo "OK"` | N/A (manual) |
| TS-03b | Create config.json with correct schema | smoke | `node -e "JSON.parse(require('fs').readFileSync('.do/config.json'))"` | N/A (manual) |
| TS-03c | Create tasks/ folder | smoke | `test -d .do/tasks && echo "OK"` | N/A (manual) |
| TS-03d | Health check on existing project | unit | `node skills/do/scripts/project-health.cjs .` | Wave 0 |

### Sampling Rate
- **Per task commit:** Manual smoke test (run /do:init in test project)
- **Per wave merge:** Run health check script against test fixtures
- **Phase gate:** Full manual verification of TS-03 acceptance criteria

### Wave 0 Gaps
- [ ] `skills/do/scripts/project-health.cjs` - project health check implementation (required for TS-03d)
- [ ] Test fixtures: create sample .do/ folders with valid/invalid configs for health check testing

## Sources

### Primary (HIGH confidence)
- `skills/do/SKILL.md` - Current /do:init implementation (workspace-level)
- `skills/do/scripts/workspace-health.cjs` - Health check pattern to follow
- `.planning/phases/03-project-setup/03-CONTEXT.md` - User decisions (D-01 through D-14)
- `.planning/REQUIREMENTS.md` - TS-03 acceptance criteria

### Secondary (MEDIUM confidence)
- `.planning/research/skills-patterns.md` - Skill anatomy, AskUserQuestion workaround
- `.planning/research/state-management.md` - YAML frontmatter patterns (for future task files)

### Tertiary (LOW confidence)
- None - all research based on existing codebase and user decisions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - using Node.js built-ins only, pattern established
- Architecture: HIGH - extending proven Phase 2 patterns
- Pitfalls: MEDIUM - some edge cases (circular init, CWD detection) need implementation-time validation
- Config schema: HIGH - explicitly defined in user decisions

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (30 days - stable domain, user requirements locked)
