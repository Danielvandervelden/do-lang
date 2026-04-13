# Phase 4: Database Scanning - Research

**Researched:** 2026-04-13
**Domain:** Codebase analysis, project.md generation, database entry management
**Confidence:** HIGH

## Summary

This phase implements `/do:scan` which analyzes a project's codebase and creates a database entry at `~/workspace/database/projects/<project-name>/`. The skill must detect tech stack from dependency files, scan folder structure for key directories, infer conventions from config files and git history, and generate a `project.md` following the established template structure.

The implementation builds on existing patterns from Phase 2/3: inline prompts (due to AskUserQuestion bug), health check script structure, and template-based file generation. The key technical challenge is heuristic detection of "non-obvious patterns" worth documenting versus standard boilerplate to skip.

**Primary recommendation:** Create a Node.js scanning script (`scan-project.cjs`) that returns structured JSON, with the skill orchestrating file creation and user interaction. The script handles detection logic; the skill handles UX and file writing.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Parse package.json/requirements.txt for framework, UI lib, testing, linting tools
- **D-02:** Scan src/ for folder structure at top level -- focus on **non-obvious or surprising patterns**, document the project's way of working, complex things, niche patterns. Skip obvious things (standard Button component, etc.)
- **D-03:** Detect config files (.eslintrc, tsconfig, vite.config, commitlint.config) and infer conventions
- **D-04:** Read recent commits to detect commit prefix patterns and branch naming conventions
- **D-05:** Core sections always generated: General info, Tech Stack, Key Directories, Conventions
- **D-06:** Empty barrel import sections included: Components, Tech, Features with placeholder links (ready for future docs)
- **D-07:** No Jira section by default -- this will be configurable via workspace customization system (deferred)
- **D-08:** Choice at start of `/do:scan`: "Auto-scan or Interview?"
  - **Auto-scan:** Infer everything from codebase, user edits project.md after
  - **Interview:** Walk through questions to fill in details (name, description, purpose, key URLs)
- **D-09:** Use inline prompts (not AskUserQuestion) consistent with Phase 2/3 pattern due to skill load bug
- **D-10:** Create `components/`, `tech/`, `features/` folders in database entry
- **D-11:** Each folder contains README.md explaining what goes there -- provides guidance for user and Claude
- **D-12:** Append project reference to `~/workspace/database/__index__.md`
- **D-13:** Follow existing format: project folder path, database folder path, optional notes
- **D-14:** `/do:task` must check for database entry before proceeding
- **D-15:** If missing, display clear message: "This project needs a database entry. Run `/do:scan` first."
- **D-16:** Check path: `<database>/projects/<project-name>/project.md`

### Claude's Discretion
- Exact wording of auto-scan vs interview prompt
- README.md content for subfolders (explain purpose and examples)
- How to detect "non-obvious" patterns during scan (heuristics)
- Error handling for malformed package.json or missing files
- Order of sections in generated project.md

### Deferred Ideas (OUT OF SCOPE)
- **Workspace Customization System** -- Configure during `/do:init`: "Do you use Jira?", "What sections in project.md?" Commands like `/do:scan` read these prefs and adjust output. Add as new phase (Phase 13?) after v1 ships.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TS-04 | Running `/do:task` without database entry informs user to run `/do:scan` first | Database entry check logic, clear error messaging pattern |
| TS-05 | `/do:scan` creates database entry for a project by analyzing codebase | Scanning script architecture, project.md template, __index__.md update pattern |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Always use `/skill-creator` when creating or modifying skill files** -- Never hand-write skills directly.
- **Conventional commits** with allowed prefixes: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`
- **Branch naming**: `feat/<description>`, `fix/<description>`, `chore/<description>`

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js fs | Built-in | File system operations | Project already uses Node.js for scripts |
| Node.js path | Built-in | Path manipulation | Cross-platform path handling |
| JSON.parse | Built-in | Dependency file parsing | Standard for package.json |

### Supporting

No external dependencies needed. The scanning logic uses built-in Node.js APIs consistent with existing health check scripts (`workspace-health.cjs`, `project-health.cjs`).

### Pattern Consistency

The existing codebase uses CommonJS (`.cjs`) scripts that:
- Return structured JSON output
- Include JSDoc type annotations
- Have CLI with `--help` and `--pretty` flags
- Export main function for programmatic use

**Installation:** No additional packages required.

## Architecture Patterns

### Recommended Project Structure

```
skills/do/
  SKILL.md            # Extend with /do:scan command
  scripts/
    workspace-health.cjs   # Existing
    project-health.cjs     # Existing
    scan-project.cjs       # NEW: Returns detected metadata
  references/
    agents-template.md     # Existing
    config-template.json   # Existing
    project-template.md    # NEW: Template for project.md
    component-readme.md    # NEW: README for components/ folder
    tech-readme.md         # NEW: README for tech/ folder
    features-readme.md     # NEW: README for features/ folder
```

### Pattern 1: Scanning Script Architecture

**What:** Separate detection logic from UX/file generation
**When to use:** When detection is complex and benefits from structured testing

```javascript
// scan-project.cjs returns structured JSON
{
  "project_name": "leaselinq-frontend",
  "detected": {
    "frameworks": ["react", "vite"],
    "ui_libraries": ["@mui/material", "@emotion/react"],
    "testing": ["vitest", "@testing-library/react"],
    "linting": ["eslint", "prettier"],
    "state_management": ["@reduxjs/toolkit"],
    "routing": ["@tanstack/react-router"],
    "forms": ["react-hook-form", "zod"]
  },
  "key_directories": {
    "src/common/api/": "RTK Query API layer",
    "src/common/components/": "Shared components",
    "src/routes/": "File-based routing"
  },
  "conventions": {
    "commit_prefixes": ["feat", "fix", "chore", "docs"],
    "branch_pattern": "<type>/<TICKET-ID>"
  },
  "config_files": [
    { "file": "vite.config.ts", "implications": "Vite build tool" },
    { "file": "commitlint.config.ts", "implications": "Conventional commits enforced" }
  ]
}
```

### Pattern 2: Two-Mode UX Flow

**What:** Auto-scan vs Interview mode with inline prompts
**When to use:** User preference drives scanning depth

Auto-scan flow:
1. Display mode prompt, wait for response
2. Run scan-project.cjs
3. Generate project.md from template + detected data
4. Create subfolders with READMEs
5. Update __index__.md
6. Show summary, invite user to edit

Interview flow:
1. Display mode prompt, wait for response
2. Ask project name, description, purpose
3. Ask production URL, test URL
4. Run scan-project.cjs for tech detection
5. Merge user input + detected data
6. Generate project.md
7. Create subfolders, update __index__.md

### Pattern 3: Database Entry Gate for /do:task

**What:** Check for project.md existence before task execution
**When to use:** TS-04 requirement

```javascript
// In future /do:task skill or pre-check script
const projectName = detectProjectName(); // from package.json or folder
const databasePath = readWorkspaceConfig().database;
const projectMdPath = path.join(databasePath, 'projects', projectName, 'project.md');

if (!fs.existsSync(projectMdPath)) {
  console.log(`
This project needs a database entry. Run /do:scan first.

Expected path: ${projectMdPath}
  `);
  process.exit(1);
}
```

### Anti-Patterns to Avoid

- **Over-detection:** Don't list every dependency. Focus on architectural choices (React vs Vue, Redux vs Zustand).
- **Hardcoded paths:** Use workspace config for database location, not hardcoded `~/workspace/database/`.
- **AskUserQuestion after skill load:** Bug causes silent failure. Use inline prompts and wait for response.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON parsing | Custom parser | `JSON.parse()` | Built-in, handles edge cases |
| Git log parsing | Manual regex | `git log --format` | Git handles encoding, escaping |
| Config detection | Glob + manual check | Direct file existence check | Simpler, known config file names |
| Skill creation | Write SKILL.md directly | `/skill-creator` | Project constraint, ensures consistency |

**Key insight:** The complexity is in heuristics for "what's worth documenting", not in file operations.

## Common Pitfalls

### Pitfall 1: Package.json Parsing Failures

**What goes wrong:** Malformed JSON, missing file, unexpected structure
**Why it happens:** Not all projects have package.json; some have syntax errors during development
**How to avoid:** Graceful fallback - if package.json missing or invalid, detect from folder structure
**Warning signs:** Script crashes instead of returning empty/partial result

### Pitfall 2: Git History Access

**What goes wrong:** Not in a git repo, empty history, permission issues
**Why it happens:** New projects, shallow clones, CI environments
**How to avoid:** Check `git rev-parse --git-dir` first; fallback to "unknown" conventions
**Warning signs:** Commit prefix detection returns empty or errors

### Pitfall 3: Monorepo Confusion

**What goes wrong:** Scanning root instead of package, mixing package.jsons
**Why it happens:** lerna.json, pnpm-workspace.yaml present but user runs from package
**How to avoid:** Detect monorepo markers; warn user if in monorepo root; use nearest package.json
**Warning signs:** Tech stack shows conflicting frameworks

### Pitfall 4: Over-Documentation

**What goes wrong:** project.md becomes bloated with obvious information
**Why it happens:** Temptation to document everything detected
**How to avoid:** Follow D-02 heuristic - "non-obvious or surprising patterns" only
**Warning signs:** Key Directories lists every folder; Tech Stack lists every devDependency

### Pitfall 5: Index.md Corruption

**What goes wrong:** Duplicate entries, malformed markdown, broken links
**Why it happens:** Appending without checking for existing entry
**How to avoid:** Check if entry exists before appending; validate markdown structure
**Warning signs:** Health check reports `duplicateIndex`

## Code Examples

### Detection Heuristics (scan-project.cjs)

```javascript
// Source: Adapted from existing project-health.cjs pattern

/**
 * Detect framework from package.json dependencies
 * @param {Object} pkg - Parsed package.json
 * @returns {string[]} List of detected frameworks
 */
function detectFrameworks(pkg) {
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const frameworks = [];
  
  // Major frameworks
  if (deps.react) frameworks.push('react');
  if (deps.vue) frameworks.push('vue');
  if (deps.next) frameworks.push('next.js');
  if (deps['@angular/core']) frameworks.push('angular');
  if (deps.svelte) frameworks.push('svelte');
  
  // Build tools (count as framework-level decisions)
  if (deps.vite) frameworks.push('vite');
  if (deps.webpack) frameworks.push('webpack');
  
  return frameworks;
}

/**
 * Detect UI libraries
 * @param {Object} pkg - Parsed package.json
 * @returns {string[]} List of detected UI libraries
 */
function detectUILibraries(pkg) {
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const ui = [];
  
  if (deps['@mui/material']) ui.push('mui');
  if (deps['@chakra-ui/react']) ui.push('chakra-ui');
  if (deps.tailwindcss) ui.push('tailwind');
  if (deps['@mantine/core']) ui.push('mantine');
  if (deps['antd']) ui.push('ant-design');
  
  return ui;
}

/**
 * Scan folder structure for key directories
 * @param {string} projectPath - Project root path
 * @returns {Object} Directory descriptions
 */
function scanDirectories(projectPath) {
  const dirs = {};
  const srcPath = path.join(projectPath, 'src');
  
  if (!fs.existsSync(srcPath)) return dirs;
  
  const entries = fs.readdirSync(srcPath, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    
    // Only document non-obvious directories
    const name = entry.name;
    if (['components', 'pages', 'utils', 'lib', 'assets'].includes(name)) {
      continue; // Standard, skip
    }
    
    // Non-obvious directories worth documenting
    dirs[`src/${name}/`] = inferDirectoryPurpose(name, path.join(srcPath, name));
  }
  
  return dirs;
}

/**
 * Infer directory purpose from contents
 * @param {string} name - Directory name
 * @param {string} dirPath - Full path
 * @returns {string} Inferred purpose description
 */
function inferDirectoryPurpose(name, dirPath) {
  // Check for index files that might have exports
  const files = fs.readdirSync(dirPath).slice(0, 10); // Sample first 10
  
  if (name === 'api' || name === 'services') return 'API layer';
  if (name === 'hooks') return 'Custom React hooks';
  if (name === 'store' || name === 'redux') return 'State management';
  if (name === 'routes') return 'Routing configuration';
  if (name === 'i18n' || name === 'locales') return 'Internationalization';
  if (name === 'common') return 'Shared code';
  if (name === 'features') return 'Feature modules';
  
  // Generic fallback
  return `${name} module`;
}
```

### Commit Prefix Detection

```javascript
// Source: git log format parsing

/**
 * Detect commit prefixes from recent git history
 * @param {string} projectPath - Project root path
 * @returns {{prefixes: string[], pattern: string|null}}
 */
function detectCommitPrefixes(projectPath) {
  try {
    // Check if git repo
    const gitCheck = execSync('git rev-parse --git-dir', { 
      cwd: projectPath, 
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Get last 50 commits
    const log = execSync('git log --oneline -50 --format="%s"', {
      cwd: projectPath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    const prefixes = new Set();
    const conventionalPattern = /^(feat|fix|chore|docs|style|refactor|perf|test|build|ci|revert)(\(.+\))?:/;
    
    for (const line of log.split('\n')) {
      const match = line.match(conventionalPattern);
      if (match) {
        prefixes.add(match[1]);
      }
    }
    
    if (prefixes.size > 0) {
      return {
        prefixes: Array.from(prefixes),
        pattern: 'conventional-commits'
      };
    }
    
    return { prefixes: [], pattern: null };
  } catch {
    return { prefixes: [], pattern: null };
  }
}
```

### Index.md Update Pattern

```javascript
// Source: Following __index__.md existing format

/**
 * Append project entry to __index__.md
 * @param {string} indexPath - Path to __index__.md
 * @param {string} projectName - Project name
 * @param {string} projectFolder - Full path to project
 * @param {string} databaseFolder - Full path to database entry
 */
function appendToIndex(indexPath, projectName, projectFolder, databaseFolder) {
  let content = fs.readFileSync(indexPath, 'utf-8');
  
  // Check if entry already exists
  if (content.includes(`## ${projectName}`) || content.includes(`projects/${projectName}`)) {
    console.log(`Entry for ${projectName} already exists in __index__.md`);
    return;
  }
  
  // Find Projects section and append
  const projectsSection = content.indexOf('## Projects') || content.indexOf('# Projects');
  if (projectsSection === -1) {
    // Append new Projects section
    content += `\n# Projects\n\n`;
  }
  
  const entry = `
## ${projectName}

- Project folder: ${projectFolder}
- Database folder: ${databaseFolder}
`;
  
  // Append at end (simple approach)
  content += entry;
  fs.writeFileSync(indexPath, content);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual project.md creation | Automated scanning | This phase | Reduces friction for new projects |
| No database entry gate | Required before /do:task | This phase | Ensures context exists before execution |

**Current patterns in codebase:**
- CommonJS scripts with JSDoc annotations
- JSON output for inter-script communication
- Template files with placeholder replacement
- Inline prompts (not AskUserQuestion) for user interaction

## Open Questions

1. **Monorepo handling**
   - What we know: CONTEXT.md mentions detecting monorepo patterns for "future support"
   - What's unclear: Should /do:scan warn and exit, or scan the package anyway?
   - Recommendation: Warn but proceed if user confirms; document as single package scan

2. **Python project detection**
   - What we know: D-01 mentions requirements.txt parsing
   - What's unclear: Full Python project structure detection (pyproject.toml, setup.py, poetry.lock)
   - Recommendation: Support pyproject.toml as primary, requirements.txt as fallback; detect Django/Flask/FastAPI

3. **Existing database entry handling**
   - What we know: CONTEXT.md doesn't address re-scanning
   - What's unclear: Overwrite? Merge? Ask user?
   - Recommendation: Detect existing entry, ask user "Overwrite or Cancel?"

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None currently configured |
| Config file | None -- Wave 0 must create |
| Quick run command | `node skills/do/scripts/scan-project.cjs . --pretty` (validation via output inspection) |
| Full suite command | N/A (no test framework yet) |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TS-04 | Database entry check blocks /do:task | Integration (manual) | Verify /do:task shows error when project.md missing | Wave 0 |
| TS-05 | /do:scan creates project.md | Integration (manual) | Run /do:scan, verify file exists at expected path | Wave 0 |
| TS-05 | /do:scan updates __index__.md | Integration (manual) | Run /do:scan, grep __index__.md for new entry | Wave 0 |
| TS-05 | /do:scan creates subfolders | Integration (manual) | Run /do:scan, verify components/, tech/, features/ exist | Wave 0 |

### Sampling Rate

- **Per task commit:** Manual verification -- run script, check output
- **Per wave merge:** Full skill test in fresh project
- **Phase gate:** Verify all acceptance criteria from REQUIREMENTS.md

### Wave 0 Gaps

- [ ] `skills/do/scripts/scan-project.cjs` -- detection logic script
- [ ] `skills/do/references/project-template.md` -- project.md template
- [ ] `skills/do/references/component-readme.md` -- README for components/ folder
- [ ] `skills/do/references/tech-readme.md` -- README for tech/ folder
- [ ] `skills/do/references/features-readme.md` -- README for features/ folder

## Sources

### Primary (HIGH confidence)

- Existing codebase: `skills/do/SKILL.md` -- Current skill structure, inline prompt pattern
- Existing codebase: `skills/do/scripts/workspace-health.cjs` -- Script architecture pattern
- Existing codebase: `skills/do/scripts/project-health.cjs` -- JSON output structure
- Reference implementation: `~/workspace/database/projects/leaselinq-frontend/project.md` -- Target output structure
- Reference implementation: `~/workspace/database/__index__.md` -- Index format to follow

### Secondary (MEDIUM confidence)

- `.planning/phases/04-database-scanning/04-CONTEXT.md` -- All locked decisions
- `.planning/research/skills-patterns.md` -- Skill anatomy, AskUserQuestion bug workaround
- `.planning/research/state-management.md` -- YAML frontmatter, state patterns

### Tertiary (LOW confidence)

- None -- all findings derived from existing codebase and locked decisions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Uses same Node.js built-ins as existing scripts
- Architecture: HIGH -- Follows established patterns from Phase 2/3
- Pitfalls: MEDIUM -- Based on common Node.js/git gotchas, not verified in this codebase
- Code examples: HIGH -- Adapted from existing scripts in codebase

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (30 days -- stable domain, established patterns)
