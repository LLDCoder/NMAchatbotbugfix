import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const shouldWrite = process.argv.includes('--write');

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.less', '.css']);
const RESOLVE_EXTENSIONS = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.less', '.css', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp'];
const INDEX_FILES = ['index.ts', 'index.tsx', 'index.js', 'index.jsx', 'index.mjs', 'index.cjs', 'index.less', 'index.css'];
const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage']);
const PARTNER_LIST_FILES = new Set([
  'src/pages/CustomerDetails/Commerical/EstablishmentModal.tsx',
  'src/pages/LicenseDatails/components/EstablishmentModal.tsx',
  'src/pages/PermitsDetails/components/EstablishmentModal.tsx',
]);

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function walkSourceFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED_DIRS.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkSourceFiles(fullPath, files);
      continue;
    }

    if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function stripComments(content) {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function extractSpecifiers(content) {
  const cleaned = stripComments(content);
  const patterns = [
    /(?:import|export)\s+(?:[^'"`]+?\s+from\s+)?['"]([^'"`]+)['"]/g,
    /import\(\s*['"]([^'"`]+)['"]\s*\)/g,
    /require\(\s*['"]([^'"`]+)['"]\s*\)/g,
    /@import\s+['"]([^'"`]+)['"]/g,
    /url\(\s*['"]?([^)'"`]+)['"]?\s*\)/g,
  ];

  const specifiers = new Set();
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match = pattern.exec(cleaned);
    while (match) {
      specifiers.add(match[1]);
      match = pattern.exec(cleaned);
    }
  }

  return [...specifiers];
}

function caseWalk(absTarget) {
  const normalized = path.resolve(absTarget);
  const parts = normalized.split(path.sep);
  let current = parts[0] === '' ? path.sep : parts[0];

  for (let index = 1; index < parts.length; index += 1) {
    if (!fs.existsSync(current) || !fs.statSync(current).isDirectory()) {
      return null;
    }

    const segment = parts[index];
    const entries = fs.readdirSync(current);
    const exact = entries.find((entry) => entry === segment);
    if (exact) {
      current = path.join(current, exact);
      continue;
    }

    const insensitive = entries.find((entry) => entry.toLowerCase() === segment.toLowerCase());
    if (!insensitive) {
      return null;
    }

    current = path.join(current, insensitive);
  }

  return current;
}

function buildAliasSpecifier(absTarget) {
  const srcRoot = path.join(rootDir, 'src');
  const relative = toPosix(path.relative(srcRoot, absTarget));
  return `@/${relative}`;
}

function buildRelativeSpecifier(importerPath, absTarget) {
  let relative = toPosix(path.relative(path.dirname(importerPath), absTarget));
  if (!relative.startsWith('.')) {
    relative = `./${relative}`;
  }
  return relative;
}

function buildExactSpecifier(importerPath, originalSpecifier, absTarget) {
  if (originalSpecifier.startsWith('@/')) {
    return buildAliasSpecifier(absTarget);
  }

  if (originalSpecifier.startsWith('./') || originalSpecifier.startsWith('../')) {
    return buildRelativeSpecifier(importerPath, absTarget);
  }

  return originalSpecifier;
}

function resolveFromSpecifier(importerPath, specifier) {
  let basePath = null;
  if (specifier.startsWith('@/')) {
    basePath = path.join(rootDir, 'src', specifier.slice(2));
  } else if (specifier.startsWith('./') || specifier.startsWith('../')) {
    basePath = path.resolve(path.dirname(importerPath), specifier);
  } else {
    return null;
  }

  for (const extension of RESOLVE_EXTENSIONS) {
    const candidatePath = `${basePath}${extension}`;
    const actualPath = caseWalk(candidatePath);
    if (actualPath && fs.existsSync(actualPath) && fs.statSync(actualPath).isFile()) {
      const exact = path.resolve(candidatePath) === actualPath;
      return {
        exact,
        actualPath,
        correctedSpecifier: buildExactSpecifier(importerPath, specifier, actualPath),
      };
    }
  }

  const actualDir = caseWalk(basePath);
  if (actualDir && fs.existsSync(actualDir) && fs.statSync(actualDir).isDirectory()) {
    for (const indexFile of INDEX_FILES) {
      const candidatePath = path.join(basePath, indexFile);
      const actualPath = caseWalk(candidatePath);
      if (actualPath && fs.existsSync(actualPath) && fs.statSync(actualPath).isFile()) {
        const exact = path.resolve(candidatePath) === actualPath;
        return {
          exact,
          actualPath,
          correctedSpecifier: buildExactSpecifier(importerPath, specifier, actualPath),
        };
      }
    }
  }

  return null;
}

function getSpecialFix(fileRelativePath, specifier) {
  if (fileRelativePath === 'src/components/designable/src/common/ResourceWidget/styles.less' && specifier === '../../variables.less') {
    return { status: 'path-fixable', resolvedTo: '@/styles/variables.less' };
  }

  if (fileRelativePath === 'src/components/designable/copy.ts' && specifier === '../../scripts/build-style') {
    return { status: 'unresolved', resolvedTo: null };
  }

  if (PARTNER_LIST_FILES.has(fileRelativePath) && specifier === './PartnerList') {
    return { status: 'path-fixable', resolvedTo: '@/components/BusinessCmps/PartnerList/PartnerList' };
  }

  return null;
}

function classifyProblem(filePath, specifier) {
  const fileRelativePath = toPosix(path.relative(rootDir, filePath));
  const special = getSpecialFix(fileRelativePath, specifier);
  if (special) {
    return {
      file: fileRelativePath,
      specifier,
      status: special.status,
      resolvedTo: special.resolvedTo,
    };
  }

  const resolved = resolveFromSpecifier(filePath, specifier);
  if (!resolved) {
    return {
      file: fileRelativePath,
      specifier,
      status: 'unresolved',
      resolvedTo: null,
    };
  }

  if (resolved.exact) {
    return null;
  }

  return {
    file: fileRelativePath,
    specifier,
    status: 'case-only',
    resolvedTo: resolved.correctedSpecifier,
  };
}

function scanProblems() {
  const files = walkSourceFiles(rootDir).sort();
  const problems = [];

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8');
    const specifiers = extractSpecifiers(content);
    for (const specifier of specifiers) {
      if (!(specifier.startsWith('@/') || specifier.startsWith('./') || specifier.startsWith('../'))) {
        continue;
      }

      const problem = classifyProblem(filePath, specifier);
      if (problem) {
        problems.push(problem);
      }
    }
  }

  problems.sort((left, right) => {
    if (left.file !== right.file) {
      return left.file.localeCompare(right.file);
    }
    return left.specifier.localeCompare(right.specifier);
  });

  return { files, problems };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceSpecifier(content, from, to) {
  const quotedPattern = new RegExp(`(['"])${escapeRegExp(from)}\\1`, 'g');
  const urlPattern = new RegExp(`(url\\(\\s*['"]?)${escapeRegExp(from)}((?:['"]?\\s*\\)))`, 'g');

  return content
    .replace(quotedPattern, (_, quote) => `${quote}${to}${quote}`)
    .replace(urlPattern, (_, prefix, suffix) => `${prefix}${to}${suffix}`);
}

function applyFixes(problems) {
  const grouped = new Map();
  for (const problem of problems) {
    if (problem.status === 'unresolved') {
      continue;
    }
    const fullPath = path.join(rootDir, problem.file);
    const existing = grouped.get(fullPath) ?? [];
    existing.push(problem);
    grouped.set(fullPath, existing);
  }

  let fixedCount = 0;

  for (const [fullPath, fileProblems] of grouped.entries()) {
    const original = fs.readFileSync(fullPath, 'utf8');
    let updated = original;

    for (const problem of fileProblems) {
      updated = replaceSpecifier(updated, problem.specifier, problem.resolvedTo);
    }

    const fileRelativePath = toPosix(path.relative(rootDir, fullPath));
    if (PARTNER_LIST_FILES.has(fileRelativePath)) {
      updated = updated.replace(/<PartnerList\s*\/>/g, '<PartnerList params={[]} />');
    }

    if (updated !== original) {
      fs.writeFileSync(fullPath, updated);
      fixedCount += fileProblems.length;
    }
  }

  return fixedCount;
}

function buildSummary(problems) {
  return problems.reduce((summary, problem) => {
    summary[problem.status] = (summary[problem.status] || 0) + 1;
    return summary;
  }, {});
}

function printReport(title, scannedFileCount, problems) {
  console.log(title);
  console.log(`scannedFiles=${scannedFileCount}`);
  console.log(`problemCount=${problems.length}`);
  console.log(`summary=${JSON.stringify(buildSummary(problems))}`);
  for (const problem of problems) {
    console.log(`file=${problem.file} specifier=${problem.specifier} status=${problem.status} resolvedTo=${problem.resolvedTo ?? '-'}`);
  }
}

const initialScan = scanProblems();
printReport('IMPORT_PATH_CASE_REPORT', initialScan.files.length, initialScan.problems);

if (!shouldWrite) {
  process.exit(initialScan.problems.length === 0 ? 0 : 1);
}

const fixedCount = applyFixes(initialScan.problems);
const finalScan = scanProblems();
printReport('IMPORT_PATH_CASE_REPORT_AFTER_WRITE', finalScan.files.length, finalScan.problems);
console.log(`fixedCount=${fixedCount}`);
console.log(`remainingCount=${finalScan.problems.length}`);
process.exit(finalScan.problems.length === 0 ? 0 : 1);
