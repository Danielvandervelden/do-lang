#!/usr/bin/env node

/**
 * Project Scanning Script
 *
 * Analyzes a project directory and returns structured JSON with detected
 * tech stack, key directories, and conventions.
 *
 * Usage: node scan-project.cjs <project-path>
 *
 * @module scan-project
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * @typedef {Object} ScanResult
 * @property {string} project_name - Project name from package.json or folder
 * @property {string} project_type - 'javascript' | 'python' | 'unknown'
 * @property {Object} detected - Detected technologies
 * @property {string[]} detected.frameworks - Detected frameworks
 * @property {string[]} detected.ui_libraries - Detected UI libraries
 * @property {string[]} detected.testing - Detected testing tools
 * @property {string[]} detected.linting - Detected linting tools
 * @property {string[]} detected.state_management - Detected state management
 * @property {string[]} detected.routing - Detected routing libraries
 * @property {string[]} detected.forms - Detected form libraries
 * @property {string[]} detected.data - Detected data libraries (Python)
 * @property {string[]} detected.orm - Detected ORM libraries
 * @property {Object<string, string>} key_directories - Non-obvious directories with descriptions
 * @property {Object} conventions - Detected conventions
 * @property {string[]} conventions.commit_prefixes - Detected commit prefixes
 * @property {string|null} conventions.commit_pattern - Pattern type or null
 * @property {Object[]} config_files - Detected config files with implications
 * @property {Object|null} monorepo - Monorepo info if detected
 */

/**
 * Read file contents safely, returning null if file doesn't exist
 * @param {string} filePath - Path to file
 * @returns {string|null} File contents or null
 */
function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Check if a file exists
 * @param {string} filePath - Path to file
 * @returns {boolean}
 */
function fileExists(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

/**
 * Check if a directory exists
 * @param {string} dirPath - Path to directory
 * @returns {boolean}
 */
function dirExists(dirPath) {
  try {
    return fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Read and parse package.json safely
 * @param {string} projectPath - Project root path
 * @returns {Object|null} Parsed package.json or null
 */
function readPackageJson(projectPath) {
  const content = readFileSafe(path.join(projectPath, 'package.json'));
  if (!content) return null;
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Read and parse requirements.txt safely
 * @param {string} projectPath - Project root path
 * @returns {string[]|null} List of package names or null
 */
function readRequirementsTxt(projectPath) {
  const content = readFileSafe(path.join(projectPath, 'requirements.txt'));
  if (!content) return null;

  const packages = [];
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue;
    // Extract package name (before version specifiers)
    const match = trimmed.match(/^([a-zA-Z0-9_-]+)/);
    if (match) {
      packages.push(match[1].toLowerCase());
    }
  }
  return packages.length > 0 ? packages : null;
}

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
 * Detect UI libraries from package.json
 * @param {Object} pkg - Parsed package.json
 * @returns {string[]} List of detected UI libraries
 */
function detectUILibraries(pkg) {
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const ui = [];

  if (deps['@mui/material']) ui.push('@mui/material');
  if (deps['@chakra-ui/react']) ui.push('@chakra-ui/react');
  if (deps.tailwindcss) ui.push('tailwindcss');
  if (deps['@mantine/core']) ui.push('@mantine/core');
  if (deps.antd) ui.push('antd');

  return ui;
}

/**
 * Detect testing tools from package.json
 * @param {Object} pkg - Parsed package.json
 * @returns {string[]} List of detected testing tools
 */
function detectTestingTools(pkg) {
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const testing = [];

  if (deps.vitest) testing.push('vitest');
  if (deps.jest) testing.push('jest');
  if (deps.mocha) testing.push('mocha');
  if (deps['@testing-library/react']) testing.push('@testing-library/react');
  if (deps.cypress) testing.push('cypress');
  if (deps.playwright || deps['@playwright/test']) testing.push('playwright');

  return testing;
}

/**
 * Detect linting tools from package.json
 * @param {Object} pkg - Parsed package.json
 * @returns {string[]} List of detected linting tools
 */
function detectLintingTools(pkg) {
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const linting = [];

  if (deps.eslint) linting.push('eslint');
  if (deps.prettier) linting.push('prettier');
  if (deps.biome || deps['@biomejs/biome']) linting.push('biome');

  return linting;
}

/**
 * Detect state management from package.json
 * @param {Object} pkg - Parsed package.json
 * @returns {string[]} List of detected state management
 */
function detectStateManagement(pkg) {
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const state = [];

  if (deps['@reduxjs/toolkit']) state.push('@reduxjs/toolkit');
  if (deps.zustand) state.push('zustand');
  if (deps.jotai) state.push('jotai');
  if (deps.recoil) state.push('recoil');
  if (deps.mobx) state.push('mobx');

  return state;
}

/**
 * Detect routing libraries from package.json
 * @param {Object} pkg - Parsed package.json
 * @returns {string[]} List of detected routing libraries
 */
function detectRouting(pkg) {
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const routing = [];

  if (deps['@tanstack/react-router']) routing.push('@tanstack/react-router');
  if (deps['react-router'] || deps['react-router-dom']) routing.push('react-router');
  if (deps.next) routing.push('next'); // Next.js has built-in routing

  return routing;
}

/**
 * Detect form libraries from package.json
 * @param {Object} pkg - Parsed package.json
 * @returns {string[]} List of detected form libraries
 */
function detectFormLibraries(pkg) {
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const forms = [];

  if (deps['react-hook-form']) forms.push('react-hook-form');
  if (deps.formik) forms.push('formik');
  if (deps.zod) forms.push('zod');
  if (deps.yup) forms.push('yup');

  return forms;
}

/**
 * Detect Python frameworks from requirements.txt
 * @param {string[]} packages - List of package names
 * @returns {string[]} List of detected frameworks
 */
function detectPythonFrameworks(packages) {
  const frameworks = [];

  if (packages.includes('django')) frameworks.push('django');
  if (packages.includes('flask')) frameworks.push('flask');
  if (packages.includes('fastapi')) frameworks.push('fastapi');
  if (packages.includes('tornado')) frameworks.push('tornado');
  if (packages.includes('pyramid')) frameworks.push('pyramid');

  return frameworks;
}

/**
 * Detect Python testing tools from requirements.txt
 * @param {string[]} packages - List of package names
 * @returns {string[]} List of detected testing tools
 */
function detectPythonTesting(packages) {
  const testing = [];

  if (packages.includes('pytest')) testing.push('pytest');
  if (packages.includes('unittest')) testing.push('unittest');
  if (packages.includes('nose') || packages.includes('nose2')) testing.push('nose');
  if (packages.includes('tox')) testing.push('tox');

  return testing;
}

/**
 * Detect Python linting tools from requirements.txt
 * @param {string[]} packages - List of package names
 * @returns {string[]} List of detected linting tools
 */
function detectPythonLinting(packages) {
  const linting = [];

  if (packages.includes('flake8')) linting.push('flake8');
  if (packages.includes('pylint')) linting.push('pylint');
  if (packages.includes('black')) linting.push('black');
  if (packages.includes('mypy')) linting.push('mypy');
  if (packages.includes('ruff')) linting.push('ruff');

  return linting;
}

/**
 * Detect Python data libraries from requirements.txt
 * @param {string[]} packages - List of package names
 * @returns {string[]} List of detected data libraries
 */
function detectPythonData(packages) {
  const data = [];

  if (packages.includes('pandas')) data.push('pandas');
  if (packages.includes('numpy')) data.push('numpy');
  if (packages.includes('scipy')) data.push('scipy');
  if (packages.includes('polars')) data.push('polars');

  return data;
}

/**
 * Detect Python web libraries from requirements.txt
 * @param {string[]} packages - List of package names
 * @returns {string[]} List of detected web libraries
 */
function detectPythonWeb(packages) {
  const web = [];

  if (packages.includes('requests')) web.push('requests');
  if (packages.includes('httpx')) web.push('httpx');
  if (packages.includes('aiohttp')) web.push('aiohttp');

  return web;
}

/**
 * Detect Python ORM libraries from requirements.txt
 * @param {string[]} packages - List of package names
 * @returns {string[]} List of detected ORM libraries
 */
function detectPythonORM(packages) {
  const orm = [];

  if (packages.includes('sqlalchemy')) orm.push('sqlalchemy');
  if (packages.includes('django')) orm.push('django'); // Django has built-in ORM
  if (packages.includes('peewee')) orm.push('peewee');
  if (packages.includes('tortoise-orm')) orm.push('tortoise-orm');

  return orm;
}

/**
 * Detect monorepo indicators
 * @param {string} projectPath - Project root path
 * @returns {Object|null} Monorepo info or null
 */
function detectMonorepo(projectPath) {
  const indicators = [
    { file: 'lerna.json', type: 'lerna' },
    { file: 'pnpm-workspace.yaml', type: 'pnpm' },
    { file: 'rush.json', type: 'rush' },
    { file: 'nx.json', type: 'nx' },
    { file: 'turbo.json', type: 'turbo' },
  ];

  for (const indicator of indicators) {
    if (fileExists(path.join(projectPath, indicator.file))) {
      return {
        type: indicator.type,
        warning: 'Consider running /do:scan from individual package directories',
      };
    }
  }

  return null;
}

/**
 * Infer directory purpose from name
 * @param {string} name - Directory name
 * @returns {string} Inferred purpose description
 */
function inferDirectoryPurpose(name) {
  const purposeMap = {
    api: 'API layer',
    services: 'API layer',
    hooks: 'Custom hooks',
    store: 'State management',
    redux: 'State management',
    routes: 'Routing',
    i18n: 'Internationalization',
    locales: 'Internationalization',
    common: 'Shared code',
    features: 'Feature modules',
    modules: 'Feature modules',
    context: 'React context providers',
    providers: 'Context providers',
    layouts: 'Layout components',
    middleware: 'Middleware',
    config: 'Configuration',
    schemas: 'Validation schemas',
    queries: 'Query definitions',
    mutations: 'Mutation definitions',
  };

  return purposeMap[name.toLowerCase()] || `${name} module`;
}

/**
 * Scan folder structure for key directories
 * @param {string} projectPath - Project root path
 * @returns {Object<string, string>} Directory descriptions
 */
function scanDirectories(projectPath) {
  const dirs = {};

  // Check both src/ and project root
  const searchPaths = [
    { base: path.join(projectPath, 'src'), prefix: 'src/' },
    { base: projectPath, prefix: '' },
  ];

  // Standard directories to skip (not worth documenting)
  const skipDirs = [
    'components',
    'pages',
    'utils',
    'lib',
    'assets',
    'styles',
    'types',
    'public',
    'dist',
    'build',
    'node_modules',
    '.git',
    '.do',
    '.planning',
    'coverage',
    '__tests__',
    '__mocks__',
  ];

  for (const { base, prefix } of searchPaths) {
    if (!dirExists(base)) continue;

    try {
      const entries = fs.readdirSync(base, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const name = entry.name;
        // Skip hidden directories and standard directories
        if (name.startsWith('.') || skipDirs.includes(name.toLowerCase())) {
          continue;
        }

        // Only add src/ directories or non-obvious root directories
        if (prefix === 'src/' || !['src', 'test', 'tests', 'scripts'].includes(name.toLowerCase())) {
          // Avoid duplicates if scanning both paths
          const key = `${prefix}${name}/`;
          if (!dirs[key] && prefix === 'src/') {
            dirs[key] = inferDirectoryPurpose(name);
          }
        }
      }
    } catch {
      // Ignore read errors
    }
  }

  return dirs;
}

/**
 * Detect config files and their implications
 * @param {string} projectPath - Project root path
 * @returns {Object[]} Config files with implications
 */
function detectConfigFiles(projectPath) {
  const configs = [];

  const configMap = [
    { patterns: ['.eslintrc', '.eslintrc.js', '.eslintrc.json', '.eslintrc.cjs', 'eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs'], implications: 'ESLint code linting' },
    { patterns: ['tsconfig.json'], implications: 'TypeScript project' },
    { patterns: ['vite.config.ts', 'vite.config.js', 'vite.config.mjs'], implications: 'Vite build tool' },
    { patterns: ['webpack.config.js', 'webpack.config.ts'], implications: 'Webpack build tool' },
    { patterns: ['commitlint.config.js', 'commitlint.config.ts', 'commitlint.config.cjs'], implications: 'Conventional commits enforced' },
    { patterns: ['.prettierrc', '.prettierrc.js', '.prettierrc.json', '.prettierrc.cjs', 'prettier.config.js', 'prettier.config.cjs'], implications: 'Prettier code formatting' },
    { patterns: ['pyproject.toml'], implications: 'Python project configuration' },
    { patterns: ['setup.py'], implications: 'Python package setup' },
    { patterns: ['setup.cfg'], implications: 'Python package configuration' },
    { patterns: ['tailwind.config.js', 'tailwind.config.ts', 'tailwind.config.cjs'], implications: 'Tailwind CSS styling' },
    { patterns: ['jest.config.js', 'jest.config.ts', 'jest.config.cjs'], implications: 'Jest testing' },
    { patterns: ['vitest.config.ts', 'vitest.config.js'], implications: 'Vitest testing' },
    { patterns: ['biome.json', 'biome.jsonc'], implications: 'Biome linting & formatting' },
  ];

  for (const { patterns, implications } of configMap) {
    for (const pattern of patterns) {
      if (fileExists(path.join(projectPath, pattern))) {
        configs.push({ file: pattern, implications });
        break; // Only add one per config type
      }
    }
  }

  return configs;
}

/**
 * Detect commit prefixes from recent git history
 * @param {string} projectPath - Project root path
 * @returns {{prefixes: string[], pattern: string|null}}
 */
function detectCommitPrefixes(projectPath) {
  try {
    // Check if git repo
    execSync('git rev-parse --git-dir', {
      cwd: projectPath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Get last 50 commits
    const log = execSync('git log --oneline -50 --format="%s"', {
      cwd: projectPath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
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
        prefixes: Array.from(prefixes).sort(),
        pattern: 'conventional-commits',
      };
    }

    return { prefixes: [], pattern: null };
  } catch {
    return { prefixes: [], pattern: null };
  }
}

/**
 * Scan a project and return structured metadata
 * @param {string} projectPath - Path to project root
 * @returns {ScanResult}
 */
function scanProject(projectPath) {
  const resolvedPath = path.resolve(projectPath);
  const folderName = path.basename(resolvedPath);

  // Check for package.json (JavaScript/TypeScript project)
  const pkg = readPackageJson(resolvedPath);

  // Check for requirements.txt (Python project)
  const pythonPackages = readRequirementsTxt(resolvedPath);

  // Determine project type
  let projectType = 'unknown';
  let projectName = folderName;
  const detected = {
    frameworks: [],
    ui_libraries: [],
    testing: [],
    linting: [],
    state_management: [],
    routing: [],
    forms: [],
    data: [],
    orm: [],
  };

  if (pkg) {
    projectType = 'javascript';
    projectName = pkg.name || folderName;
    detected.frameworks = detectFrameworks(pkg);
    detected.ui_libraries = detectUILibraries(pkg);
    detected.testing = detectTestingTools(pkg);
    detected.linting = detectLintingTools(pkg);
    detected.state_management = detectStateManagement(pkg);
    detected.routing = detectRouting(pkg);
    detected.forms = detectFormLibraries(pkg);
  } else if (pythonPackages) {
    projectType = 'python';
    detected.frameworks = detectPythonFrameworks(pythonPackages);
    detected.testing = detectPythonTesting(pythonPackages);
    detected.linting = detectPythonLinting(pythonPackages);
    detected.data = detectPythonData(pythonPackages);
    detected.orm = detectPythonORM(pythonPackages);
  }

  // Scan directories
  const keyDirectories = scanDirectories(resolvedPath);

  // Detect conventions from git history
  const conventions = detectCommitPrefixes(resolvedPath);

  // Detect config files
  const configFiles = detectConfigFiles(resolvedPath);

  // Detect monorepo
  const monorepo = detectMonorepo(resolvedPath);

  return {
    project_name: projectName,
    project_type: projectType,
    detected,
    key_directories: keyDirectories,
    conventions: {
      commit_prefixes: conventions.prefixes,
      commit_pattern: conventions.pattern,
    },
    config_files: configFiles,
    monorepo,
  };
}

// CLI handling
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Project Scanner

Usage: node scan-project.cjs <project-path>

Analyzes a project directory and returns structured JSON with detected
tech stack, key directories, and conventions.

Options:
  --help, -h    Show this help message
  --pretty      Pretty-print JSON output

Detection:
  JavaScript/TypeScript (package.json):
    - Frameworks: react, vue, next.js, angular, svelte, vite, webpack
    - UI libraries: MUI, Chakra UI, Tailwind, Mantine, Ant Design
    - Testing: vitest, jest, mocha, testing-library, cypress, playwright
    - Linting: eslint, prettier, biome
    - State: Redux Toolkit, Zustand, Jotai, Recoil, MobX
    - Routing: TanStack Router, React Router, Next.js
    - Forms: react-hook-form, formik, zod, yup

  Python (requirements.txt):
    - Frameworks: Django, Flask, FastAPI, Tornado, Pyramid
    - Testing: pytest, unittest, nose, tox
    - Linting: flake8, pylint, black, mypy, ruff
    - Data: pandas, numpy, scipy, polars
    - ORM: SQLAlchemy, Django ORM, Peewee, Tortoise ORM

Monorepo Detection:
  Warns if run from a monorepo root (lerna.json, pnpm-workspace.yaml,
  rush.json, nx.json, turbo.json detected).

Example:
  node scan-project.cjs .
  node scan-project.cjs /path/to/project --pretty
`);
    process.exit(0);
  }

  const projectPath = args.find((a) => !a.startsWith('-'));
  const pretty = args.includes('--pretty');

  if (!projectPath) {
    console.error('Error: project path required');
    console.error('Usage: node scan-project.cjs <project-path>');
    process.exit(1);
  }

  const resolvedPath = path.resolve(projectPath);
  if (!dirExists(resolvedPath)) {
    console.error(`Error: project path does not exist: ${resolvedPath}`);
    process.exit(1);
  }

  const result = scanProject(resolvedPath);
  console.log(JSON.stringify(result, null, pretty ? 2 : 0));
}

// Export for programmatic use
module.exports = { scanProject };
