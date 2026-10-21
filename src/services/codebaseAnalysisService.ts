import { CodebaseAnalysis, CodebaseSource, DependencyRiskAssessment, PipelineAssessment, QualityAssessment, QualityDimension, QualityFinding, SourceContentMetrics } from '../types/codebase';
import { assessArchitecture, assessNextJsOverview, configuredTestToolSignals, suggestImprovements } from './architectureAnalysisService';
import { IGNORED_DIRECTORIES, MANIFEST_FILES, normalizedName } from './codebaseAnalysisConstants';
import { BrowserDirectoryHandle, isDirectoryHandle, loadDirectoryHandle, saveDirectoryHandle } from './browserDirectoryAccess';
export { getQualityReviewCandidatePaths, readQualityReviewSources } from './qualityReviewSourceService';
export type { QualityReviewSourceFile } from './qualityReviewSourceService';
import { LANGUAGE_SOURCE_RULES, NEXT_SOURCE_RULES, TOOLCHAIN_QUALITY_RULES } from './codeQualityRules';
import { extractNpmDependencyInventory, scanNpmDependencyRisks } from './dependencyRiskService';
import { detectAndAnalyzeFramework } from './frameworks/frameworkRegistry';
import { computeExpoQualityImpact } from './frameworks/expo/expoQualityImpact';
import { computeNextJsQualityImpact } from './frameworks/nextjs/nextJsQualityImpact';
import { computeNodeJsQualityImpact } from './frameworks/nodejs/nodeJsQualityImpact';
import { computeRemixQualityImpact } from './frameworks/remix/remixQualityImpact';
import {
  collectParsedFileFindings,
  collectProjectHygieneFindings,
  collectTestFileFindings,
} from './qualityExtendedFindings';
import {
  analyzeFunctionBodyComplexity,
  evaluateFunctionComplexityFinding,
} from './functionComplexityAnalysis';
import {
  deepProfileNotMatchedMessage,
  deepProfileRulesUnsupportedMessage,
  supportedDeepProfilesSummary,
} from '../constants/supportedAnalysisProfiles';
import type { FrameworkProfile } from '../types/framework';
import {
  findFirstHardcodedCredentialMatch,
  isSecretScanSkippedPath,
} from './secretDetectionHeuristics';

const EXTENSION_LANGUAGES: Record<string, string> = {
  ts: 'TypeScript', tsx: 'TypeScript', mts: 'TypeScript', cts: 'TypeScript',
  js: 'JavaScript', jsx: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript',
  py: 'Python', pyw: 'Python', rs: 'Rust', go: 'Go', java: 'Java', kt: 'Kotlin',
  kts: 'Kotlin', swift: 'Swift', dart: 'Dart', php: 'PHP', rb: 'Ruby',
  cs: 'C#', c: 'C', h: 'C/C++', cc: 'C++', cpp: 'C++', hpp: 'C++',
  css: 'CSS', scss: 'SCSS', html: 'HTML', vue: 'Vue', svelte: 'Svelte',
  sql: 'SQL', sh: 'Shell', bash: 'Shell', yaml: 'YAML', yml: 'YAML',
};

const SOURCE_EXTENSIONS = new Set(Object.keys(EXTENSION_LANGUAGES));
const NEXT_SOURCE_EXTENSIONS = new Set(['js', 'jsx', 'mjs', 'cjs', 'ts', 'tsx', 'mts', 'cts']);
const SOURCE_CONTENT_MAX_FILE_BYTES = 512 * 1024;
const SOURCE_CONTENT_MAX_TOTAL_BYTES = 24 * 1024 * 1024;
const LOCKFILE_MAX_BYTES = 10 * 1024 * 1024;

function createEmptySourceMetrics(): SourceContentMetrics {
  return { analyzedFiles: 0, skippedFiles: 0, linesOfCode: 0, todoMarkers: 0, largeFiles: [] };
}

function addSourceContentMetric(path: string, content: string, metrics: SourceContentMetrics) {
  const lines = content.split(/\r\n|\n|\r/);
  const lineCount = lines.filter(line => line.trim().length > 0).length;
  const todoMarkers = (content.match(/\b(?:TODO|FIXME|XXX|HACK)\b/gi) || []).length;
  metrics.analyzedFiles += 1;
  metrics.linesOfCode += lineCount;
  metrics.todoMarkers += todoMarkers;
  if (lineCount > 500) {
    metrics.largeFiles.push({ path, lines: lineCount, todoMarkers });
    metrics.largeFiles.sort((a, b) => b.lines - a.lines);
    metrics.largeFiles = metrics.largeFiles.slice(0, 20);
  }
}

function sourceLineAt(content: string, index: number) {
  return content.slice(0, index).split(/\r\n|\n|\r/).length;
}

function createSourceSnippet(content: string, focusLine: number, redactSecrets = false) {
  const sourceLines = content.split(/\r\n|\n|\r/);
  const startLine = Math.max(1, focusLine - 2);
  const endLine = Math.min(sourceLines.length, startLine + 4);
  const lines = sourceLines.slice(startLine - 1, endLine).map(line => {
    const visibleLine = redactSecrets ? line.replace(/(['"`])[^'"`\r\n]{8,}\1/g, '$1••••••$1') : line;
    return visibleLine.length > 180 ? `${visibleLine.slice(0, 177)}…` : visibleLine;
  });
  return { startLine, focusLine, lines };
}

function normalizeImportPath(importer: string, specifier: string) {
  const stack = importer.split('/').slice(0, -1);
  for (const part of specifier.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') stack.pop();
    else stack.push(part);
  }
  return stack.join('/');
}

function hasNextJsProjectSignal(paths: string[], manifests: Record<string, string>) {
  const hasNextConfig = paths.some(path => /(^|\/)next\.config\.(?:[cm]?js|[cm]?ts)$/i.test(path.replace(/\\/g, '/')));
  const hasNextDependency = Object.entries(manifests).some(([path, content]) => /(^|\/)package\.json$/i.test(path.replace(/\\/g, '/')) && /["']next["']\s*:/i.test(content));
  return hasNextConfig || hasNextDependency;
}

function hasRemixProjectSignal(paths: string[], manifests: Record<string, string>) {
  const normalized = paths.map(path => path.replace(/\\/g, '/'));
  if (hasNextJsProjectSignal(paths, manifests)) return false;
  const hasRemixConfig = normalized.some(path => /(^|\/)remix\.config\.(?:[cm]?js|[cm]?ts)$/i.test(path));
  const hasRemixDep = Object.entries(manifests).some(
    ([path, content]) =>
      /(^|\/)package\.json$/i.test(path.replace(/\\/g, '/')) &&
      /["']@remix-run\/(?:react|node|dev|cloudflare|deno|express|serve)["']\s*:|["']remix["']\s*:/.test(content),
  );
  return hasRemixConfig || hasRemixDep;
}

function hasExpoProjectSignal(paths: string[], manifests: Record<string, string>) {
  if (hasNextJsProjectSignal(paths, manifests) || hasRemixProjectSignal(paths, manifests)) return false;
  const hasDep = Object.entries(manifests).some(
    ([path, content]) =>
      /(^|\/)package\.json$/i.test(path.replace(/\\/g, '/')) &&
      /["'](?:expo|expo-router|react-native)["']\s*:/.test(content),
  );
  if (hasDep) return true;
  const normalized = paths.map(path => path.replace(/\\/g, '/'));
  return (
    normalized.some(path => /(^|\/)app\.(?:json|config\.(?:js|ts))$/i.test(path)) &&
    normalized.some(path => /(^|\/)app\/_layout\.(?:jsx?|tsx?)$/i.test(path))
  );
}

function hasNodeJsProjectSignal(paths: string[], manifests: Record<string, string>) {
  if (
    hasNextJsProjectSignal(paths, manifests) ||
    hasRemixProjectSignal(paths, manifests) ||
    hasExpoProjectSignal(paths, manifests)
  ) {
    return false;
  }
  const hasServerDep = Object.entries(manifests).some(
    ([path, content]) =>
      /(^|\/)package\.json$/i.test(path.replace(/\\/g, '/')) &&
      /["'](?:express|fastify|koa|hono|@nestjs\/core|restify|polka|@hapi\/hapi|micro)["']\s*:/.test(content),
  );
  if (hasServerDep) return true;
  // Path-only fallback for plain http servers (avoid matching Vite SPA src/main.tsx / index.tsx).
  const normalized = paths.map(path => path.replace(/\\/g, '/'));
  return normalized.some(path => /(^|\/)(?:src\/)?server\.(?:js|ts|mjs|cjs)$/i.test(path));
}

/** Next.js, Remix, Expo, or Node.js — enables JS/TS deep parse and shared risk patterns. */
function hasSupportedJsDeepProfile(paths: string[], manifests: Record<string, string>) {
  return (
    hasNextJsProjectSignal(paths, manifests) ||
    hasRemixProjectSignal(paths, manifests) ||
    hasExpoProjectSignal(paths, manifests) ||
    hasNodeJsProjectSignal(paths, manifests)
  );
}

async function inspectSourceCode(source: CodebaseSource): Promise<{ findings: QualityFinding[]; parsedFiles: number; skippedFiles: number }> {
  const contents = source.sourceContents || {};
  const contentEntries = Object.entries(contents).sort(([left], [right]) => left.localeCompare(right));
  const isNextProject = hasNextJsProjectSignal(source.paths, source.manifests);
  const hasDeepJsProfile = hasSupportedJsDeepProfile(source.paths, source.manifests);
  const findings: QualityFinding[] = [];
  const sourcePathSet = new Set(source.paths.map(path => path.replace(/\\/g, '/').toLowerCase()));
  // Supported deep profiles (see supportedAnalysisProfiles.ts). Keep file-level
  // rules and parsing within JavaScript/TypeScript sources for matched profiles.
  const jsEntries = hasDeepJsProfile
    ? contentEntries.filter(([path]) => NEXT_SOURCE_EXTENSIONS.has(normalizedName(path).split('.').pop() || ''))
    : [];
  const MAX_AST_FILES = 1500;
  const entriesToParse = jsEntries.slice(0, MAX_AST_FILES);
  const skippedFiles = jsEntries.length - entriesToParse.length;
  const textPatterns: Array<{ pattern: RegExp; title: string; detail: string; priority: QualityFinding['priority'] }> = [
    { pattern: /\b(?:eval\s*\(|new\s+Function\s*\()/i, title: 'Dynamic code execution', detail: 'This code appears to execute a string as code. Review whether it can be replaced with an explicit, safer operation.', priority: 'high' },
    { pattern: /\bdangerouslySetInnerHTML\b|\.innerHTML\s*=/i, title: 'Direct HTML injection API', detail: 'This code writes HTML directly into a page. Verify that untrusted input is escaped or sanitized before it reaches this path.', priority: 'medium' },
    { pattern: /\bshell\s*=\s*True\b/i, title: 'Shell execution enabled', detail: 'A process call appears to invoke a shell. Avoid building the command from untrusted input; argument arrays are safer.', priority: 'medium' },
    { pattern: /\bverify\s*=\s*False\b/i, title: 'TLS certificate verification disabled', detail: 'A network request may skip certificate validation. Keep verification enabled outside narrowly controlled local tests.', priority: 'high' },
    { pattern: /\bNEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|TOKEN|KEY|PASSWORD|PRIVATE)[A-Z0-9_]*\b/i, title: 'Sensitive NEXT_PUBLIC variable name', detail: 'NEXT_PUBLIC_* values are exposed to the browser bundle. Do not prefix secrets or private API keys with NEXT_PUBLIC_; use server-only env vars instead.', priority: 'high' },
  ];
  for (const [path, content] of contentEntries) {
    const extension = normalizedName(path).split('.').pop() || '';
    if (!hasDeepJsProfile || !NEXT_SOURCE_EXTENSIONS.has(extension)) continue;

    if (!isSecretScanSkippedPath(path)) {
      const secretHit = findFirstHardcodedCredentialMatch(content);
      if (secretHit) {
        const line = sourceLineAt(content, secretHit.index);
        findings.push({
          title: 'Possible hard-coded credential',
          detail:
            'A high-confidence credential-like literal appears assigned in source (or a known provider secret prefix). Move real secrets to a secret store or environment variable.',
          priority: 'high',
          evidence: [`${path}:${line}`],
          codeSnippet: createSourceSnippet(content, line, true),
        });
      }
    }

    for (const { pattern, title, detail, priority } of textPatterns) {
      pattern.lastIndex = 0;
      const match = pattern.exec(content);
      if (!match) continue;
      const line = sourceLineAt(content, match.index);
      findings.push({ title, detail, priority, evidence: [`${path}:${line}`], codeSnippet: createSourceSnippet(content, line) });
    }
    for (const rule of LANGUAGE_SOURCE_RULES) {
      if (!rule.extensions.includes(extension) || rule.except?.test(content)) continue;
      const match = rule.pattern.exec(content);
      if (!match) continue;
      const line = sourceLineAt(content, match.index);
      findings.push({ title: rule.title, detail: rule.detail, priority: rule.priority, evidence: [`${path}:${line}`], codeSnippet: createSourceSnippet(content, line) });
    }
    if (isNextProject) {
      const normalizedPath = path.replace(/\\/g, '/');
      for (const rule of NEXT_SOURCE_RULES) {
        if (!rule.pathPattern.test(normalizedPath) || rule.except?.test(content)) continue;
        rule.pattern.lastIndex = 0;
        const match = rule.pattern.exec(content);
        if (!match) continue;
        const line = sourceLineAt(content, match.index);
        findings.push({ title: rule.title, detail: rule.detail, priority: rule.priority, evidence: [`${path}:${line}`], codeSnippet: createSourceSnippet(content, line) });
      }
    }
  }

  findings.push(...collectTestFileFindings(contentEntries, isRecognizedTestFile));

  if (!entriesToParse.length) return { findings, parsedFiles: 0, skippedFiles };
  const ts = await import('typescript');
  const duplicateBodies = new Map<string, Array<{ path: string; name: string; line: number }>>();
  const importEdges = new Map<string, string[]>();
  let parsedFiles = 0;
  const isFunctionNode = (node: import('typescript').Node): node is import('typescript').FunctionLikeDeclaration =>
    ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)
    || ts.isMethodDeclaration(node) || ts.isConstructorDeclaration(node)
    || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node);

  for (const [path, content] of entriesToParse) {
    parsedFiles += 1;
    const extension = path.split('.').pop()?.toLowerCase();
    const scriptKind = extension === 'tsx' ? ts.ScriptKind.TSX : extension === 'jsx' ? ts.ScriptKind.JSX
      : ['js', 'mjs', 'cjs', 'mjsx'].includes(extension || '') ? ts.ScriptKind.JS : ts.ScriptKind.TS;
    const file = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true, scriptKind);
    const parseDiagnostics = (file as import('typescript').SourceFile & { parseDiagnostics?: readonly import('typescript').Diagnostic[] }).parseDiagnostics || [];
    for (const diagnostic of parseDiagnostics.slice(0, 2)) {
      const line = diagnostic.start === undefined ? 1 : file.getLineAndCharacterOfPosition(diagnostic.start).line + 1;
      findings.push({ title: 'Source syntax issue', detail: ts.flattenDiagnosticMessageText(diagnostic.messageText, ' '), priority: 'high', evidence: [`${path}:${line}`], codeSnippet: createSourceSnippet(content, line) });
    }

    const imports: string[] = [];
    const visitImports = (node: import('typescript').Node) => {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        const specifier = node.moduleSpecifier;
        if (specifier && ts.isStringLiteral(specifier) && specifier.text.startsWith('.')) imports.push(specifier.text);
      }
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text.startsWith('.')) {
        imports.push(node.arguments[0].text);
      }
      ts.forEachChild(node, visitImports);
    };
    visitImports(file);

    const visitFunctions = (node: import('typescript').Node) => {
      if (isFunctionNode(node) && node.body) {
        const start = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
        const end = file.getLineAndCharacterOfPosition(node.getEnd()).line + 1;
        const name = 'name' in node && node.name && ts.isIdentifier(node.name) ? node.name.text : 'anonymous function';
        const metrics = analyzeFunctionBodyComplexity(ts, file, node.body, isFunctionNode);
        const evaluated = evaluateFunctionComplexityFinding(name, metrics);
        if (evaluated) {
          findings.push({
            title: evaluated.title,
            detail: evaluated.detail,
            priority: evaluated.priority,
            evidence: [`${path}:${start}–${end}`, evaluated.evidenceExtra],
            codeSnippet: createSourceSnippet(content, start),
          });
        }
        const bodyText = node.body.getText(file).replace(/\s+/g, ' ').trim();
        if (bodyText.length >= 160) {
          const locations = duplicateBodies.get(bodyText) || [];
          locations.push({ path, name, line: start });
          duplicateBodies.set(bodyText, locations);
        }
      }
      ts.forEachChild(node, visitFunctions);
    };
    visitFunctions(file);
    findings.push(
      ...collectParsedFileFindings(ts, path, content, file, isFunctionNode, (snippetContent, line) =>
        createSourceSnippet(snippetContent, line),
      ),
    );
    importEdges.set(path.replace(/\\/g, '/').toLowerCase(), imports.map(specifier => normalizeImportPath(path, specifier).toLowerCase()));
  }

  for (const [body, locations] of duplicateBodies) {
    const uniquePaths = [...new Map(locations.map(location => [`${location.path}:${location.line}`, location])).values()];
    if (uniquePaths.length < 2) continue;
    const firstLocation = uniquePaths[0];
    const firstContent = contents[firstLocation.path];
    findings.push({ title: 'Repeated function body', detail: 'The same normalized function body appears in multiple places. Consider sharing the logic or documenting why both copies should evolve independently.', priority: 'low', evidence: uniquePaths.slice(0, 3).map(item => `${item.path}:${item.line}`), codeSnippet: firstContent ? createSourceSnippet(firstContent, firstLocation.line) : undefined });
  }

  for (const [importer, dependencies] of importEdges) {
    const resolvedDependencies: string[] = [];
    for (const dependency of dependencies) {
      const candidates = [dependency, ...['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs', '.json'].map(extension => `${dependency}${extension}`), ...['index.ts', 'index.tsx', 'index.js', 'index.jsx'].map(index => `${dependency}/${index}`)];
      const resolved = candidates.find(candidate => sourcePathSet.has(candidate));
      if (!resolved) {
        const originalPath = contentEntries.find(([path]) => path.toLowerCase() === importer)?.[0] || importer;
        findings.push({ title: 'Local import target not found in scan', detail: 'A relative import did not match any scanned file. It may use a generated file, a configured alias, or an extension the scan does not recognize.', priority: 'low', evidence: [`${originalPath} → ${dependency}`] });
      } else resolvedDependencies.push(resolved);
    }
    importEdges.set(importer, resolvedDependencies);
  }

  const visitedImports = new Set<string>();
  const activeImports: string[] = [];
  const seenCycles = new Set<string>();
  const findImportCycles = (path: string) => {
    if (visitedImports.has(path)) return;
    activeImports.push(path);
    for (const dependency of importEdges.get(path) || []) {
      const cycleStart = activeImports.indexOf(dependency);
      if (cycleStart >= 0) {
        const cycle = activeImports.slice(cycleStart);
        const cycleKey = [...cycle].sort().join('|');
        if (!seenCycles.has(cycleKey)) {
          seenCycles.add(cycleKey);
          const evidence = cycle.slice(0, 4).map(item => contentEntries.find(([candidate]) => candidate.toLowerCase() === item)?.[0] || item);
          findings.push({ title: 'Circular module dependency', detail: 'These files import one another in a cycle. Cycles can make initialization order and module boundaries harder to reason about.', priority: 'medium', evidence });
        }
      } else if (!visitedImports.has(dependency)) findImportCycles(dependency);
    }
    activeImports.pop();
    visitedImports.add(path);
  };
  for (const path of importEdges.keys()) findImportCycles(path);

  return { findings, parsedFiles, skippedFiles };
}
function isRecognizedTestFile(path: string) {
  const lowerPath = path.toLowerCase();
  const fileName = normalizedName(lowerPath);
  return /\.(?:test|spec)\.[^.]+$/.test(lowerPath)
    || /\.(?:cy|feature)\.[^.]+$/.test(lowerPath)
    || /(^|\/)(__tests__|tests?|e2e)\//.test(lowerPath)
    || /(^|\/)cypress\/(?:e2e|integration)\//.test(lowerPath)
    || (/\.py$/.test(lowerPath) && (/^test_[^/]+\.py$/.test(fileName) || /_test\.py$/.test(fileName)))
    || /_test\.go$/.test(fileName)
    || /(?:test|tests|it)\.(?:java|kt|kts)$/.test(fileName)
    || /tests?\.cs$/.test(fileName);
}


function detectPackageManager(source: CodebaseSource, packageData: { packageManager?: string }): string {
  if (typeof packageData.packageManager === 'string') {
    return packageData.packageManager.split('@')[0] || 'npm';
  }
  if (source.paths.some(path => /(^|\/)pnpm-lock\.yaml$/i.test(path))) return 'pnpm';
  if (source.paths.some(path => /(^|\/)yarn\.lock$/i.test(path))) return 'yarn';
  if (source.paths.some(path => /(^|\/)bun\.lockb?$/i.test(path))) return 'bun';
  return 'npm';
}

function scriptCommandToString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value;
  if (value && typeof value === 'object' && typeof (value as { command?: unknown }).command === 'string') {
    const command = (value as { command: string }).command.trim();
    return command || null;
  }
  return null;
}

function extractPackageScripts(source: CodebaseSource) {
  const packageEntries = Object.entries(source.manifests)
    .filter(([path]) => normalizedName(path) === 'package.json')
    .sort(([left], [right]) => {
      const depthDiff = left.split('/').length - right.split('/').length;
      return depthDiff !== 0 ? depthDiff : left.localeCompare(right);
    });
  if (!packageEntries.length) return [];

  const preferredOrder = [
    'dev',
    'start',
    'serve',
    'build',
    'test',
    'lint',
    'typecheck',
    'check',
    'tauri:dev',
    'tauri:build',
    'preview',
  ];
  const preferredRank = (name: string) => {
    const index = preferredOrder.indexOf(name);
    return index === -1 ? preferredOrder.length : index;
  };

  type ParsedPackage = {
    path: string;
    depth: number;
    packageManager: string;
    scripts: Array<{ name: string; command: string }>;
  };

  const parsedPackages: ParsedPackage[] = [];
  for (const [path, content] of packageEntries) {
    try {
      const packageData = JSON.parse(content.replace(/^\uFEFF/, '')) as {
        packageManager?: string;
        scripts?: Record<string, unknown>;
      };
      const scripts = Object.entries(packageData.scripts || {})
        .map(([name, value]) => {
          const command = scriptCommandToString(value);
          return command ? { name, command } : null;
        })
        .filter((entry): entry is { name: string; command: string } => Boolean(entry));
      parsedPackages.push({
        path,
        depth: path.split('/').length,
        packageManager: detectPackageManager(source, packageData),
        scripts,
      });
    } catch {
      // Skip invalid package.json files
    }
  }

  if (!parsedPackages.length) return [];

  // Prefer root / shallowest package.json that actually defines scripts.
  // Workspace roots often have an empty scripts map while apps/* has the real ones.
  const withScripts = parsedPackages.filter(entry => entry.scripts.length > 0);
  const chosen =
    withScripts.find(entry => entry.path === 'package.json' || !entry.path.includes('/')) ||
    withScripts[0] ||
    parsedPackages.find(entry => entry.path === 'package.json' || !entry.path.includes('/')) ||
    parsedPackages[0];

  const runPrefix =
    chosen.packageManager === 'npm'
      ? 'npm run'
      : chosen.packageManager === 'bun'
        ? 'bun run'
        : chosen.packageManager;

  // If the chosen package has scripts, use those. Otherwise merge every package.json
  // (disambiguate duplicate names with the package folder).
  const scriptRows =
    chosen.scripts.length > 0
      ? chosen.scripts.map(script => ({
          name: script.name,
          command: script.command,
          runCommand: `${runPrefix} ${script.name}`,
        }))
      : withScripts.flatMap(entry => {
          const folder = entry.path.includes('/')
            ? entry.path.replace(/\/package\.json$/i, '')
            : '.';
          const prefix =
            entry.packageManager === 'npm'
              ? 'npm run'
              : entry.packageManager === 'bun'
                ? 'bun run'
                : entry.packageManager;
          return entry.scripts.map(script => ({
            name: withScripts.length > 1 ? `${script.name} (${folder})` : script.name,
            command: script.command,
            runCommand: `${prefix} ${script.name}`,
          }));
        });

  return scriptRows.sort((a, b) => {
    const aBase = a.name.split(' ')[0];
    const bBase = b.name.split(' ')[0];
    const rankDiff = preferredRank(aBase) - preferredRank(bBase);
    return rankDiff !== 0 ? rankDiff : a.name.localeCompare(b.name);
  });
}

function detectFrameworks(source: CodebaseSource): string[] {
  const frameworks = new Set<string>();
  const packageText = Object.entries(source.manifests)
    .filter(([path]) => normalizedName(path) === 'package.json')
    .map(([, content]) => content);

  for (const content of packageText) {
    try {
      const packageData = JSON.parse(content);
      const dependencies = {
        ...packageData.dependencies,
        ...packageData.devDependencies,
        ...packageData.peerDependencies,
      } as Record<string, string>;
      const has = (name: string) => Object.hasOwn(dependencies, name);

      const matches: Array<[string, string]> = [
        ['next', 'Next.js'], ['@remix-run/react', 'Remix'], ['remix', 'Remix'],
        ['react', 'React'], ['react-native', 'React Native'],
        ['expo', 'Expo'], ['vue', 'Vue'], ['nuxt', 'Nuxt'], ['svelte', 'Svelte'],
        ['@sveltejs/kit', 'SvelteKit'], ['@angular/core', 'Angular'],
        ['express', 'Express'], ['@nestjs/core', 'NestJS'], ['fastify', 'Fastify'],
        ['vite', 'Vite'], ['tailwindcss', 'Tailwind CSS'], ['prisma', 'Prisma'],
        ['drizzle-orm', 'Drizzle ORM'], ['electron', 'Electron'],
        ['@tauri-apps/api', 'Tauri'], ['vitest', 'Vitest'], ['jest', 'Jest'],
        ['playwright', 'Playwright'], ['@playwright/test', 'Playwright'], ['cypress', 'Cypress'], ['@testing-library/react', 'React Testing Library'],
      ];
      for (const [dependency, label] of matches) if (has(dependency)) frameworks.add(label);
    } catch {
      // A malformed or non-JSON package manifest is still listed as evidence, but not parsed.
    }
  }

  const allManifestText = Object.entries(source.manifests)
    .filter(([path]) => normalizedName(path) !== 'readme.md')
    .map(([, content]) => content.toLowerCase())
    .join('\n');
  const frameworkSignals: Array<[RegExp, string]> = [
    [/\btauri\b/, 'Tauri'], [/\baxum\b/, 'Axum'], [/\bactix-web\b/, 'Actix Web'],
    [/\btokio\b/, 'Tokio'], [/\bfastapi\b/, 'FastAPI'], [/\bdjango\b/, 'Django'],
    [/\bflask\b/, 'Flask'], [/\bpytest\b/, 'Pytest'], [/\bgin-gonic\/gin\b/, 'Gin'],
    [/\bgithub\.com\/labstack\/echo\b/, 'Echo'], [/\bgithub\.com\/gofiber\/fiber\b/, 'Fiber'],
  ];
  for (const [signal, label] of frameworkSignals) if (signal.test(allManifestText)) frameworks.add(label);

  return [...frameworks];
}

function categoryForFinding(title: string): QualityFinding['category'] {
  if (/credential|dynamic code|html injection|shell|tls|certificate|deserialization|pickle|yaml loading|unsafe c\/c\+\+|binaryformatter|sensitive value|sql query|unencrypted http|diagnostic logging/i.test(title)) return 'security';
  if (/test/i.test(title)) return 'testing';
  if (/ci workflow|workflow|build step/i.test(title)) return 'delivery';
  if (/readme|documentation/i.test(title)) return 'documentation';
  if (/folder|project root|circular module|import target/i.test(title)) return 'structure';
  if (/next\.js|server component|router api|router data|route handler|page or layout|syntax issue|parse|error handler|exception handler|exception swallowed|forced error handling|forced optional unwrap|forced null assertion|panic-prone|function result discarded/i.test(title)) return 'correctness';
  if (/large source|todo|complexity|function body|debug logging|typescript checking|nesting|explicit any|error suppression/i.test(title)) return 'maintainability';
  if (/lockfile|engine constraint|dockerfile|environment file|\.env/i.test(title)) return 'delivery';
  if (/skipped test|assertion/i.test(title)) return 'testing';
  return 'tooling';
}

function stableRuleId(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'quality-finding';
}

function normalizeQualityFinding(finding: QualityFinding): QualityFinding {
  const category = finding.category || categoryForFinding(finding.title);
  const ruleId = finding.ruleId || stableRuleId(finding.title);
  const locationEvidence = finding.evidence.find(item => /:\d+(?:[–-]\d+)?$/.test(item));
  const locationMatch = locationEvidence?.match(/^(.*):(\d+)(?:[–-]\d+)?$/);
  let hash = 2166136261;
  for (const character of `${ruleId}|${finding.evidence.join('|')}`) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return {
    ...finding,
    id: finding.id || `${ruleId}-${(hash >>> 0).toString(36)}`,
    ruleId,
    category,
    confidence: finding.confidence || (/syntax issue/i.test(finding.title) ? 'high' : 'medium'),
    source: finding.source || 'blueprint-static',
    location: finding.location || (locationMatch ? { path: locationMatch[1], line: Number(locationMatch[2]) } : undefined),
  };
}

function assessQualityChecks(
  paths: string[],
  scripts: NonNullable<CodebaseAnalysis['scripts']>,
  testFilesCount: number,
  sourceMetrics: SourceContentMetrics,
  manifests: Record<string, string>,
  deepAnalysis: Awaited<ReturnType<typeof inspectSourceCode>>,
  findings: QualityFinding[],
  frameworkCheck?: NonNullable<QualityAssessment['checks']>[number],
): QualityAssessment['checks'] {
  const lowerPaths = paths.map(path => path.toLowerCase());
  const manifestContents = Object.values(manifests).join('\n').toLowerCase();
  const detectedLanguages = new Set(paths.map(path => EXTENSION_LANGUAGES[normalizedName(path).split('.').pop() || '']).filter(Boolean));
  const workflows = Object.entries(manifests).filter(([path]) => path.startsWith('.github/workflows/'));
  const workflowText = workflows.map(([, content]) => content).join('\n').toLowerCase();
  const workflowHasTests = /\b(test|vitest|jest|pytest|cargo test|go test)\b/.test(workflowText);
  const workflowHasBuild = /\b(build|compile|cargo build|npm run build|pnpm build)\b/.test(workflowText);
  const jsPathCount = paths.filter(path => /\.(?:[cm]?[jt]sx?)$/i.test(path)).length;
  const isNextProject = hasNextJsProjectSignal(paths, manifests);
  const isRemixProject = hasRemixProjectSignal(paths, manifests);
  const hasDeepJsProfile = hasSupportedJsDeepProfile(paths, manifests);
  const profileLabel = isNextProject ? 'Next.js' : isRemixProject ? 'Remix' : 'JavaScript/TypeScript';
  const profilePathCount = hasDeepJsProfile ? jsPathCount : 0;
  const profileFilesNotInspected = Math.max(0, profilePathCount - deepAnalysis.parsedFiles - deepAnalysis.skippedFiles);
  const syntaxIssues = findings.filter(finding => finding.title === 'Source syntax issue').length;
  const codeFindings = (category: NonNullable<QualityFinding['category']>) => findings.filter(finding => finding.category === category).length;
  const check = (id: string, name: string, category: NonNullable<QualityFinding['category']>, status: NonNullable<QualityAssessment['checks']>[number]['status'], summary: string) => ({ id, name, category, status, summary, findingCount: codeFindings(category) });

  const checks: NonNullable<QualityAssessment['checks']> = [];
  if (hasDeepJsProfile && profilePathCount > 0) checks.push(
    check('source-parse', `${profileLabel} JavaScript / TypeScript parsing`, 'correctness', deepAnalysis.skippedFiles > 0 || profileFilesNotInspected > 0 ? 'incomplete' : syntaxIssues > 0 ? 'issues' : 'passed', deepAnalysis.skippedFiles > 0 || profileFilesNotInspected > 0 ? `${deepAnalysis.parsedFiles} parsed; ${deepAnalysis.skippedFiles + profileFilesNotInspected} profile files were not inspected.` : syntaxIssues > 0 ? `${syntaxIssues} syntax issue(s) detected. This does not include type-checking.` : `${deepAnalysis.parsedFiles} ${profileLabel} JavaScript/TypeScript file(s) parsed with no syntax issues detected; type-checking was not run.`),
  );
  else checks.push(check('supported-profile', 'Supported language / framework profile', 'correctness', 'unsupported', deepProfileNotMatchedMessage()));
  checks.push(
    check('source-patterns', 'Supported profile risk patterns', 'security', !hasDeepJsProfile || deepAnalysis.parsedFiles === 0 ? 'unsupported' : codeFindings('security') > 0 ? 'issues' : deepAnalysis.skippedFiles > 0 || profileFilesNotInspected > 0 ? 'incomplete' : 'passed', !hasDeepJsProfile || deepAnalysis.parsedFiles === 0 ? deepProfileRulesUnsupportedMessage() : codeFindings('security') > 0 ? `Review the flagged patterns in inspected ${supportedDeepProfilesSummary()} source files; findings are signals, not proof of a vulnerability.` : `No configured risk patterns matched the inspected ${supportedDeepProfilesSummary()} source files; this is not a complete security audit.`),
    check('maintainability', 'Maintainability signals', 'maintainability', sourceMetrics.analyzedFiles === 0 ? 'unsupported' : codeFindings('maintainability') > 0 ? 'issues' : sourceMetrics.skippedFiles > 0 ? 'incomplete' : 'passed', sourceMetrics.analyzedFiles === 0 ? 'Source contents were not available to inspect.' : codeFindings('maintainability') > 0 ? 'Large files, TODO markers, or complex/repeated functions need review.' : 'No configured maintainability thresholds were crossed in inspected files.'),
    check('ci-workflows', 'CI workflows', 'delivery', workflows.length === 0 ? 'not-configured' : !workflowHasTests || !workflowHasBuild ? 'issues' : 'not-run', workflows.length === 0 ? 'No GitHub Actions workflow was found in the scan.' : !workflowHasTests || !workflowHasBuild ? `Workflow found; test step ${workflowHasTests ? 'detected' : 'not detected'}, build step ${workflowHasBuild ? 'detected' : 'not detected'}.` : 'Test and build signals detected in workflow files; blueprint studio did not execute the workflow.'),
    check('folder-structure', 'Folder structure', 'structure', sourceMetrics.analyzedFiles === 0 ? 'unsupported' : codeFindings('structure') > 0 ? 'issues' : 'passed', sourceMetrics.analyzedFiles === 0 ? 'No source files were available to assess.' : codeFindings('structure') > 0 ? 'Review the reported folder or module-boundary signals.' : 'No configured folder-structure concerns were detected.'),
    check('documentation', 'Project documentation', 'documentation', codeFindings('documentation') > 0 ? 'issues' : lowerPaths.some(path => /(^|\/)readme(?:\.[^/]*)?$/.test(path)) ? 'passed' : 'not-configured', lowerPaths.some(path => /(^|\/)readme(?:\.[^/]*)?$/.test(path)) ? 'README detected; documentation content was not evaluated.' : 'No README file was detected.'),
  );

  const workflowAndManifestText = `${manifestContents}\n${workflowText}`;
  TOOLCHAIN_QUALITY_RULES.forEach(rule => {
    if (!rule.languages.some(language => detectedLanguages.has(language))) return;
    const matchedPath = (rule.pathPatterns || []).some(pattern => lowerPaths.some(path => pattern.test(path)));
    const matchedManifest = (rule.manifestPatterns || []).some(pattern => pattern.test(workflowAndManifestText));
    const matchedScript = (rule.scriptPatterns || []).some(pattern => scripts.some(script => pattern.test(`${script.name} ${script.command}`.toLowerCase())));
    const testFiles = rule.category === 'testing' && (rule.testFilePatterns || []).some(pattern => lowerPaths.some(path => pattern.test(path)));
    const configured = matchedPath || matchedManifest || matchedScript;
    checks.push({
      id: `tool-${rule.id}`,
      name: `${rule.name} (${rule.languages.filter(language => detectedLanguages.has(language)).join(', ')})`,
      category: rule.category || 'tooling',
      status: configured ? 'not-run' : testFiles ? 'incomplete' : 'not-configured',
      summary: configured ? `${rule.name} configuration or command detected; blueprint studio did not run it${rule.category === 'testing' ? (testFiles ? ' Test files were also found.' : '') : ''}` : testFiles ? `Test files were found, but no recognized ${rule.name} runner or configuration was detected.` : `No recognized ${rule.name} configuration or command was detected for this language.`,
      findingCount: 0,
    });
  });

  if (![...detectedLanguages].some(language => TOOLCHAIN_QUALITY_RULES.some(rule => rule.category === 'testing' && rule.languages.includes(language)))) {
    checks.push(check('tests', 'Automated tests', 'testing', testFilesCount > 0 ? 'incomplete' : 'not-configured', testFilesCount > 0 ? `${testFilesCount} test-like file(s) found; no language-specific runner profile is available.` : 'No test files or supported test runner configuration were detected.'));
  }

  if (frameworkCheck) {
    const securityIdx = checks.findIndex(entry => entry.id === 'source-patterns');
    if (securityIdx >= 0) checks.splice(securityIdx + 1, 0, frameworkCheck);
    else checks.push(frameworkCheck);
  }

  return checks;
}

function assessCodeQuality(
  paths: string[],
  directories: string[],
  scripts: NonNullable<CodebaseAnalysis['scripts']>,
  testFilesCount: number,
  sourceMetrics: SourceContentMetrics,
  manifests: Record<string, string>,
  sourceContents: Record<string, string>,
  deepAnalysis: Awaited<ReturnType<typeof inspectSourceCode>>,
  dependencyRisk?: DependencyRiskAssessment,
  frameworkProfile?: FrameworkProfile,
): QualityAssessment {
  const normalizedPaths = paths.map(path => path.replace(/\\/g, '/'));
  const lowerPaths = normalizedPaths.map(path => path.toLowerCase());
  const scriptNames = new Set(scripts.map(script => script.name.toLowerCase()));
  const hasTestConfig = lowerPaths.some(path => /(^|\/)(?:(?:vitest|jest|playwright|cypress)\.config\.[^/]+|pytest\.ini|tox\.ini)$/i.test(path));
  const hasTestScript = [...scriptNames].some(name => /test|spec/.test(name));
  const hasWorkflow = Object.keys(manifests).some(path => path.startsWith('.github/workflows/') && /\.ya?ml$/i.test(path));
  const workflowContents = Object.entries(manifests).filter(([path]) => path.startsWith('.github/workflows/')).map(([, content]) => content).join('\n').toLowerCase();
  const workflowHasTests = /\b(test|vitest|jest|pytest|cargo test|go test)\b/.test(workflowContents);
  const workflowHasBuild = /\b(build|compile|cargo build|npm run build|pnpm build)\b/.test(workflowContents);
  const hasReadme = lowerPaths.some(path => /(^|\/)readme(?:\.[^/]*)?$/.test(path));
  const hasDocs = lowerPaths.some(path => /(^|\/)(docs?|documentation)\//.test(path));
  const sourcePaths = normalizedPaths.filter(path => SOURCE_EXTENSIONS.has(normalizedName(path).split('.').pop() || ''));
  const rootLevelSourceFiles = sourcePaths.filter(path => !path.includes('/')).length;
  const rootSourceRatio = sourcePaths.length ? rootLevelSourceFiles / sourcePaths.length : 0;
  const averageSourceDepth = sourcePaths.length
    ? sourcePaths.reduce((total, path) => total + path.split('/').length, 0) / sourcePaths.length
    : 0;

  const nextJsImpact = computeNextJsQualityImpact(frameworkProfile);
  const remixImpact = computeRemixQualityImpact(frameworkProfile);
  const expoImpact = computeExpoQualityImpact(frameworkProfile);
  const nodeJsImpact = computeNodeJsQualityImpact(frameworkProfile);
  const frameworkImpact = nextJsImpact || remixImpact || expoImpact || nodeJsImpact;

  const testingEvidence: NonNullable<QualityDimension['scoreEvidence']> = [];
  let testingScore = 0;
  if (testFilesCount > 0) {
    testingScore += 13;
    testingEvidence.push({ label: 'Test files found', points: 13, detail: `${testFilesCount} test file${testFilesCount === 1 ? '' : 's'} detected.` });
  } else {
    testingEvidence.push({ label: 'No test files', points: 0, detail: 'Add tests around a critical user flow.' });
  }
  if (hasTestConfig) {
    testingScore += 4;
    testingEvidence.push({ label: 'Test config', points: 4, detail: 'Recognized test runner configuration present.' });
  }
  if (hasTestScript) {
    testingScore += 3;
    testingEvidence.push({ label: 'Test script', points: 3, detail: 'package.json exposes a test script.' });
  }

  const maintainabilityEvidence: NonNullable<QualityDimension['scoreEvidence']> = [];
  let maintainabilityScore = sourceMetrics.analyzedFiles > 0 ? 25 : 12;
  if (sourceMetrics.analyzedFiles > 0) {
    maintainabilityEvidence.push({ label: 'Baseline (sources inspected)', points: 25, detail: `${sourceMetrics.analyzedFiles} files · ${sourceMetrics.linesOfCode.toLocaleString()} non-empty lines.` });
  } else {
    maintainabilityEvidence.push({ label: 'Limited source inspection', points: 12, detail: 'Source contents were not fully available.' });
  }
  const largeFilePenalty = Math.min(12, sourceMetrics.largeFiles.length * 4);
  if (largeFilePenalty > 0) {
    maintainabilityScore -= largeFilePenalty;
    maintainabilityEvidence.push({ label: 'Large source files', points: -largeFilePenalty, detail: `${sourceMetrics.largeFiles.length} file${sourceMetrics.largeFiles.length === 1 ? '' : 's'} over 500 non-empty lines (−4 pts each, capped).` });
  }
  const todoPenalty = Math.min(8, Math.ceil(sourceMetrics.todoMarkers / 5));
  if (todoPenalty > 0) {
    maintainabilityScore -= todoPenalty;
    maintainabilityEvidence.push({ label: 'TODO/FIXME markers', points: -todoPenalty, detail: `${sourceMetrics.todoMarkers} markers (−1 pt per 5, capped at 8).` });
  }
  maintainabilityScore = Math.max(0, maintainabilityScore);

  const organizationEvidence: NonNullable<QualityDimension['scoreEvidence']> = [];
  let organizationScore = sourcePaths.length > 0 ? 15 : 9;
  if (sourcePaths.length > 0) {
    organizationEvidence.push({ label: 'Baseline structure', points: 15, detail: `${directories.length} folders · ${rootLevelSourceFiles} root source files.` });
  } else {
    organizationEvidence.push({ label: 'Limited structure signal', points: 9, detail: 'No source files were available to assess organization.' });
  }
  if (sourcePaths.length > 0 && rootSourceRatio > 0.3 && rootLevelSourceFiles >= 5) {
    const rootPenalty = Math.min(10, Math.ceil((rootSourceRatio - 0.3) * 18));
    organizationScore -= rootPenalty;
    organizationEvidence.push({ label: 'Root-heavy layout', points: -rootPenalty, detail: `${Math.round(rootSourceRatio * 100)}% of source files sit at the project root.` });
  }
  if (averageSourceDepth > 5) {
    const depthPenalty = Math.min(6, Math.ceil(averageSourceDepth - 5));
    organizationScore -= depthPenalty;
    organizationEvidence.push({ label: 'Deep nesting', points: -depthPenalty, detail: `Average source path depth ${averageSourceDepth.toFixed(1)}.` });
  }
  if (directories.length === 0 && sourcePaths.length >= 10) {
    organizationScore -= 4;
    organizationEvidence.push({ label: 'No folders detected', points: -4, detail: 'Many source files with no directory grouping.' });
  }
  organizationScore = Math.max(0, organizationScore);

  const automationEvidence: NonNullable<QualityDimension['scoreEvidence']> = [];
  let automationScore = 0;
  if (hasWorkflow) {
    automationScore += 8;
    automationEvidence.push({ label: 'CI workflow present', points: 8, detail: 'GitHub Actions workflow detected.' });
    if (workflowHasTests) {
      automationScore += 4;
      automationEvidence.push({ label: 'CI test step', points: 4, detail: 'Workflow includes a test signal.' });
    } else {
      automationEvidence.push({ label: 'CI test step missing', points: 0, detail: 'No clear test command in workflow files.' });
    }
    if (workflowHasBuild) {
      automationScore += 3;
      automationEvidence.push({ label: 'CI build step', points: 3, detail: 'Workflow includes a build signal.' });
    } else {
      automationEvidence.push({ label: 'CI build step missing', points: 0, detail: 'No clear build command in workflow files.' });
    }
  } else if (scriptNames.has('build') || hasTestScript) {
    automationScore = 3;
    automationEvidence.push({ label: 'Local scripts only', points: 3, detail: 'Build/test scripts exist, but no CI workflow was found.' });
  } else {
    automationEvidence.push({ label: 'No CI workflow', points: 0, detail: 'Add a workflow that runs tests and build.' });
  }

  const documentationEvidence: NonNullable<QualityDimension['scoreEvidence']> = [];
  let documentationScore = 0;
  if (hasReadme) {
    documentationScore += 7;
    documentationEvidence.push({ label: 'README', points: 7, detail: 'README detected.' });
  } else {
    documentationEvidence.push({ label: 'No README', points: 0, detail: 'Add setup and run instructions.' });
  }
  if (hasDocs) {
    documentationScore += 3;
    documentationEvidence.push({ label: 'Docs folder', points: 3, detail: 'Documentation directory detected.' });
  }

  const securityFindings = deepAnalysis.findings.filter(finding => categoryForFinding(finding.title) === 'security');
  const hasDeepJsProfile = hasSupportedJsDeepProfile(normalizedPaths, manifests);
  const correctnessPaths = hasDeepJsProfile ? sourcePaths.filter(path => NEXT_SOURCE_EXTENSIONS.has(normalizedName(path).split('.').pop() || '')) : [];
  const profileFilesNotInspected = Math.max(0, correctnessPaths.length - deepAnalysis.parsedFiles - deepAnalysis.skippedFiles);
  const securityAssessed = hasDeepJsProfile && deepAnalysis.parsedFiles > 0;
  const correctnessPathSet = new Set(correctnessPaths);
  const correctnessFindings = deepAnalysis.findings.filter(finding => categoryForFinding(finding.title) === 'correctness'
    && finding.evidence.some(evidence => [...correctnessPathSet].some(path => evidence.startsWith(`${path}:`))));
  const correctnessAssessed = hasDeepJsProfile && deepAnalysis.parsedFiles > 0 && correctnessPaths.length > 0;
  const correctnessPartial = correctnessAssessed && (deepAnalysis.skippedFiles > 0 || profileFilesNotInspected > 0);

  const securityEvidence: NonNullable<QualityDimension['scoreEvidence']> = [];
  let securityScore = 0;
  if (securityAssessed) {
    securityEvidence.push({ label: 'Baseline (profile reviewed)', points: 10, detail: `${deepAnalysis.parsedFiles} inspected file(s).` });
    let securityPenalty = 0;
    for (const finding of securityFindings.slice(0, 6)) {
      const pts = finding.priority === 'high' ? 3 : finding.priority === 'medium' ? 2 : 1;
      securityPenalty += pts;
      securityEvidence.push({
        label: finding.title.length > 56 ? `${finding.title.slice(0, 53)}…` : finding.title,
        points: -pts,
        detail: finding.evidence[0] || finding.priority,
      });
    }
    if (securityFindings.length > 6) {
      const rest = securityFindings.slice(6);
      const restPts = rest.reduce((n, f) => n + (f.priority === 'high' ? 3 : f.priority === 'medium' ? 2 : 1), 0);
      securityPenalty += restPts;
      securityEvidence.push({ label: `${rest.length} more security signals`, points: -restPts, detail: 'Additional configured risk patterns.' });
    }
    securityScore = Math.max(0, 10 - Math.min(10, securityPenalty));
  }

  const correctnessEvidence: NonNullable<QualityDimension['scoreEvidence']> = [];
  let correctnessScore = 0;
  if (correctnessAssessed) {
    correctnessEvidence.push({ label: 'Baseline (profile reviewed)', points: 5, detail: `${correctnessPaths.length} profile source file(s).` });
    let correctnessPenalty = 0;
    for (const finding of correctnessFindings.slice(0, 5)) {
      const pts = finding.priority === 'high' ? 2 : 1;
      correctnessPenalty += pts;
      correctnessEvidence.push({
        label: finding.title.length > 56 ? `${finding.title.slice(0, 53)}…` : finding.title,
        points: -pts,
        detail: finding.evidence[0] || finding.priority,
      });
    }
    if (correctnessFindings.length > 5) {
      const rest = correctnessFindings.slice(5);
      const restPts = rest.reduce((n, f) => n + (f.priority === 'high' ? 2 : 1), 0);
      correctnessPenalty += restPts;
      correctnessEvidence.push({ label: `${rest.length} more correctness signals`, points: -restPts, detail: 'Additional static correctness findings.' });
    }
    correctnessScore = Math.max(0, 5 - Math.min(5, correctnessPenalty));
  }

  const dimensions: QualityDimension[] = [
    { name: 'Tests', score: testingScore, maxScore: 20, summary: testFilesCount > 0 ? `${testFilesCount} test files${hasTestConfig ? ' and test tooling' : ''} detected.` : hasTestConfig || hasTestScript ? 'Test tooling is configured, but no test files were found.' : 'No test files, test configuration, or test script were detected.', scoreEvidence: testingEvidence },
    { name: 'Code maintainability', score: maintainabilityScore, maxScore: 25, summary: sourceMetrics.analyzedFiles > 0 ? `${sourceMetrics.analyzedFiles} source files inspected · ${sourceMetrics.linesOfCode.toLocaleString()} non-empty lines.` : 'Source contents were not available to inspect.', scoreEvidence: maintainabilityEvidence },
    { name: 'Folder structure', score: organizationScore, maxScore: 15, summary: sourcePaths.length ? `${directories.length} folders · ${rootLevelSourceFiles} source files at the project root.` : 'No source files were available to assess organization.', scoreEvidence: organizationEvidence },
    { name: 'CI checks', score: automationScore, maxScore: 15, summary: hasWorkflow ? `Workflow detected${workflowHasTests ? ' with test signals' : ''}${workflowHasBuild ? ' with build signals' : ''}.` : 'No CI workflow was detected.', scoreEvidence: automationEvidence },
    { name: 'Documentation', score: documentationScore, maxScore: 10, summary: `${hasReadme ? 'README found' : 'No README found'}${hasDocs ? ' · documentation folder found' : ''}.`, scoreEvidence: documentationEvidence },
    { name: 'Security risks', score: securityScore, maxScore: securityAssessed ? 10 : 0, assessmentStatus: securityAssessed ? (deepAnalysis.skippedFiles || profileFilesNotInspected ? 'partial' as const : 'reviewed' as const) : 'not-assessed' as const, summary: securityAssessed ? `${securityFindings.length} configured risk pattern${securityFindings.length === 1 ? '' : 's'} flagged across ${deepAnalysis.parsedFiles} inspected file(s) using the ${supportedDeepProfilesSummary()} profile. A clean result does not guarantee security.` : `No supported language/framework profile matched this repo for deep security rules. ${deepProfileNotMatchedMessage()}`, scoreEvidence: securityAssessed ? securityEvidence : undefined },
    { name: 'Code correctness', score: correctnessScore, maxScore: correctnessAssessed ? 5 : 0, assessmentStatus: !correctnessAssessed ? 'not-assessed' as const : correctnessPartial ? 'partial' as const : 'reviewed' as const, summary: correctnessAssessed ? `${correctnessFindings.length} correctness signal${correctnessFindings.length === 1 ? '' : 's'} flagged across ${correctnessPaths.length} source file(s) (${supportedDeepProfilesSummary()}). ${correctnessPartial ? 'Some files were skipped or fall outside the active profile.' : 'Only configured static rules were checked.'}` : `No supported language/framework profile matched for deep correctness checks. ${deepProfileNotMatchedMessage()}`, scoreEvidence: correctnessAssessed ? correctnessEvidence : undefined },
  ];

  if (frameworkImpact) {
    const securityIdx = dimensions.findIndex(dim => dim.name === 'Security risks');
    if (securityIdx >= 0) dimensions.splice(securityIdx + 1, 0, frameworkImpact.dimension);
    else dimensions.push(frameworkImpact.dimension);
  }

  const findings: QualityFinding[] = [];
  if (!testFilesCount) {
    findings.push({ title: 'No test files detected', detail: hasTestConfig || hasTestScript ? 'Test tooling appears to be configured, but the scan found no test files. Add coverage for a critical user flow or business rule.' : 'No tests, test setup, or test script were detected. Add a small automated test suite around a critical user flow or business rule.', priority: 'high', evidence: [...(hasTestConfig ? ['Test configuration detected'] : []), ...(hasTestScript ? ['Test script detected'] : []), 'Scanned paths contain no common test files'].slice(0, 3) });
  }
  if (!hasWorkflow) findings.push({ title: 'No CI workflow detected', detail: 'There is no GitHub Actions workflow in the scanned files. A CI pipeline can run checks on every change and catch regressions before merge.', priority: 'medium', evidence: ['No .github/workflows/*.yml or *.yaml file found'] });
  else {
    if (!workflowHasTests) findings.push({ title: 'CI workflow has no clear test step', detail: 'The detected workflow files do not contain an obvious test command. Verify tests run in CI so failures are caught before changes are merged.', priority: 'medium', evidence: Object.keys(manifests).filter(path => path.startsWith('.github/workflows/')).slice(0, 2) });
    if (!workflowHasBuild) findings.push({ title: 'CI workflow has no clear build step', detail: 'The detected workflow files do not contain an obvious build command. Consider validating that the application still compiles in CI.', priority: 'low', evidence: Object.keys(manifests).filter(path => path.startsWith('.github/workflows/')).slice(0, 2) });
  }
  if (sourceMetrics.largeFiles.length) findings.push({ title: `${sourceMetrics.largeFiles.length} large source file${sourceMetrics.largeFiles.length === 1 ? '' : 's'} detected`, detail: 'Files over 500 non-empty lines can be harder to review and change safely. Consider splitting responsibilities where the code structure supports it.', priority: 'medium', evidence: sourceMetrics.largeFiles.slice(0, 4).map(file => `${file.path} · ${file.lines} lines`) });
  if (sourceMetrics.todoMarkers > 0) findings.push({ title: `${sourceMetrics.todoMarkers} TODO/FIXME markers found`, detail: 'These comments may be intentional, but reviewing them helps distinguish planned work from forgotten follow-ups.', priority: sourceMetrics.todoMarkers >= 10 ? 'medium' : 'low', evidence: [`${sourceMetrics.todoMarkers} markers across ${sourceMetrics.analyzedFiles} inspected source files`] });
  if (sourcePaths.length >= 5 && rootSourceRatio > 0.3) findings.push({ title: 'Many source files sit at the project root', detail: 'Grouping related files into clear feature or layer folders can make the codebase easier to navigate as it grows.', priority: 'low', evidence: [`${rootLevelSourceFiles} of ${sourcePaths.length} source files (${Math.round(rootSourceRatio * 100)}%) are at the root`] });
  if (!hasReadme) findings.push({ title: 'No README detected', detail: 'Add setup, run, and test instructions so a new contributor can get oriented without guessing.', priority: 'low', evidence: ['No README file found in scanned paths'] });
  findings.push(
    ...collectProjectHygieneFindings(normalizedPaths, lowerPaths, manifests, sourceContents),
  );
  findings.push(...deepAnalysis.findings);
  if (frameworkImpact) findings.push(...frameworkImpact.findings);

  const availableScore = dimensions.reduce((total, dimension) => total + dimension.score, 0);
  const availableMaxScore = dimensions.reduce((total, dimension) => total + dimension.maxScore, 0);
  const score = availableMaxScore ? Math.round((availableScore / availableMaxScore) * 100) : 0;
  const coverageRatio = sourcePaths.length ? sourceMetrics.analyzedFiles / sourcePaths.length : 0;
  const sortedFindings = findings
    .sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority]));
  const MAX_VISIBLE_FINDINGS = 50;
  const allNormalizedFindings = sortedFindings
    .map(normalizeQualityFinding);
  const normalizedFindings = allNormalizedFindings
    .slice(0, MAX_VISIBLE_FINDINGS);
  const initialQuality: QualityAssessment = {
    score,
    confidence: coverageRatio >= 0.8 && !sourceMetrics.skippedFiles && !deepAnalysis.skippedFiles ? 'high' : coverageRatio >= 0.5 ? 'medium' : 'low',
    dimensions,
    findings: normalizedFindings,
    findingsOmitted: Math.max(0, sortedFindings.length - MAX_VISIBLE_FINDINGS),
    checks: assessQualityChecks(
      paths,
      scripts,
      testFilesCount,
      sourceMetrics,
      manifests,
      deepAnalysis,
      allNormalizedFindings,
      frameworkImpact?.check,
    ),
    analyzedSourceFiles: sourceMetrics.analyzedFiles,
    linesOfCode: sourceMetrics.linesOfCode,
    todoMarkers: sourceMetrics.todoMarkers,
    deepAnalysis: {
      parsedJavaScriptFiles: deepAnalysis.parsedFiles,
      skippedJavaScriptFiles: deepAnalysis.skippedFiles,
      sourceFilesAvailable: sourceMetrics.analyzedFiles,
    },
  };

  if (dependencyRisk) {
    return recalculateQualityWithDependencyRisk(initialQuality, dependencyRisk);
  }

  return initialQuality;
}

/**
 * Recalculates the architectural and security health assessment by factoring in
 * dependency CVE advisories scanned from OSV.dev.
 */
export function recalculateQualityWithDependencyRisk(
  quality: QualityAssessment,
  dependencyRisk: DependencyRiskAssessment,
): QualityAssessment {
  const cveAdvisories = dependencyRisk.advisories || [];
  const criticalCves = cveAdvisories.filter(a => a.severity === 'critical');
  const highCves = cveAdvisories.filter(a => a.severity === 'high');
  const mediumCves = cveAdvisories.filter(a => a.severity === 'medium');
  const lowCves = cveAdvisories.filter(a => a.severity === 'low');

  // Calculate CVE dimension penalty out of 15 maxScore
  const cvePenalty = (criticalCves.length * 6) + (highCves.length * 2) + (mediumCves.length * 0.5) + (lowCves.length * 0.1);
  const cveScore = Math.max(0, Math.round(15 - Math.min(15, cvePenalty)));

  const cveEvidence: NonNullable<QualityDimension['scoreEvidence']> = [
    { label: 'Baseline (OSV.dev audit)', points: 15, detail: `${dependencyRisk.packagesChecked.toLocaleString()} locked packages checked.` },
  ];
  if (criticalCves.length > 0) cveEvidence.push({ label: 'Critical CVEs', points: -(criticalCves.length * 6), detail: `${criticalCves.length} critical advisory${criticalCves.length === 1 ? '' : 'ies'} (−6 pts each).` });
  if (highCves.length > 0) cveEvidence.push({ label: 'High CVEs', points: -(highCves.length * 2), detail: `${highCves.length} high advisory${highCves.length === 1 ? '' : 'ies'} (−2 pts each).` });
  if (mediumCves.length + lowCves.length > 0) {
    cveEvidence.push({
      label: 'Medium/low CVEs',
      points: -Math.round(mediumCves.length * 0.5 + lowCves.length * 0.1),
      detail: `${mediumCves.length} medium · ${lowCves.length} low.`,
    });
  }

  const cveDimension: QualityDimension = {
    name: 'Dependency CVEs',
    score: cveScore,
    maxScore: 15,
    assessmentStatus: 'reviewed',
    summary: cveAdvisories.length === 0
      ? `${dependencyRisk.packagesChecked.toLocaleString()} dependencies audited via OSV.dev. No known CVE advisories.`
      : `${criticalCves.length > 0 ? `${criticalCves.length} critical, ` : ''}${highCves.length > 0 ? `${highCves.length} high, ` : ''}${mediumCves.length + lowCves.length} medium/low CVEs flagged across locked packages.`,
    scoreEvidence: cveEvidence,
  };

  // Rebalance dimensions to accommodate the 15-point CVE dimension (total 100 max points)
  const updatedDimensions = quality.dimensions.map(dim => {
    if (dim.name === 'Code maintainability') {
      const scaledScore = Math.min(20, Math.round((dim.score / (dim.maxScore || 25)) * 20));
      return { ...dim, score: scaledScore, maxScore: 20 };
    }
    if (dim.name === 'Folder structure') {
      const scaledScore = Math.min(10, Math.round((dim.score / (dim.maxScore || 15)) * 10));
      return { ...dim, score: scaledScore, maxScore: 10 };
    }
    if (dim.name === 'CI checks') {
      const scaledScore = Math.min(10, Math.round((dim.score / (dim.maxScore || 15)) * 10));
      return { ...dim, score: scaledScore, maxScore: 10 };
    }
    return dim;
  });

  const existingIdx = updatedDimensions.findIndex(d => d.name === 'Dependency CVEs');
  if (existingIdx >= 0) {
    updatedDimensions[existingIdx] = cveDimension;
  } else {
    const secIdx = updatedDimensions.findIndex(d => d.name === 'Security risks');
    if (secIdx >= 0) {
      updatedDimensions.splice(secIdx + 1, 0, cveDimension);
    } else {
      updatedDimensions.push(cveDimension);
    }
  }

  // Calculate base score from all dimensions
  const availableScore = updatedDimensions.reduce((total, dim) => total + dim.score, 0);
  const availableMaxScore = updatedDimensions.reduce((total, dim) => total + dim.maxScore, 0);
  const baseScore = availableMaxScore ? Math.round((availableScore / availableMaxScore) * 100) : 0;

  // Severe exploit risk penalty: if critical zero-days exist in production dependencies, apply an exploit penalty (up to 15 pts)
  const criticalExploitPenalty = Math.min(15, criticalCves.length * 5);
  const finalScore = Math.max(0, baseScore - criticalExploitPenalty);

  // Keep quality.findings strictly for static code analysis (AST violations, structure, syntax, tests)
  // to prevent duplication with the dedicated Dependency Vulnerabilities & CVE Advisories section
  const nonCveFindings = quality.findings.filter(f => !f.ruleId?.startsWith('cve-'));

  const updatedChecks = (quality.checks || []).filter(c => c.id !== 'dependency-cves');
  updatedChecks.push({
    id: 'dependency-cves',
    name: 'Dependency CVE Advisories (OSV.dev)',
    category: 'security',
    status: criticalCves.length > 0 || highCves.length > 0 ? 'issues' : cveAdvisories.length > 0 ? 'incomplete' : 'passed',
    summary: cveAdvisories.length === 0
      ? `${dependencyRisk.packagesChecked.toLocaleString()} locked dependencies audited via OSV.dev. No known vulnerabilities.`
      : `${cveAdvisories.length} CVE advisories (${criticalCves.length} critical, ${highCves.length} high) flagged in locked packages.`,
    findingCount: cveAdvisories.length,
  });

  return {
    ...quality,
    score: finalScore,
    dimensions: updatedDimensions,
    findings: nonCveFindings,
    checks: updatedChecks,
  };
}

/** Ensures OSV.dev CVE audit finished and quality scores include dependency CVEs (used after rescan). */
export async function ensureAnalysisDependencyAudit(analysis: CodebaseAnalysis): Promise<CodebaseAnalysis> {
  const inventory = analysis.dependencyInventory;
  if (!inventory || inventory.packages.length === 0) {
    return analysis;
  }

  try {
    const dependencyRisk =
      analysis.dependencyRisk ?? (await scanNpmDependencyRisks(inventory));
    const qualityIncludesCveDimension = analysis.quality?.dimensions.some(
      dimension => dimension.name === 'Dependency CVEs' && dimension.maxScore > 0,
    );
    if (
      analysis.dependencyRisk === dependencyRisk &&
      qualityIncludesCveDimension
    ) {
      return analysis;
    }

    return {
      ...analysis,
      dependencyRisk,
      quality: analysis.quality
        ? recalculateQualityWithDependencyRisk(analysis.quality, dependencyRisk)
        : analysis.quality,
    };
  } catch {
    return analysis;
  }
}

function assessPipeline(source: CodebaseSource, paths: string[]): PipelineAssessment {
  const workflows = Object.entries(source.manifests)
    .filter(([path]) => path.startsWith('.github/workflows/') && /\.ya?ml$/i.test(path))
    .map(([path, content]) => {
      const name = content.match(/^\s*name:\s*["']?([^\r\n"']+)/m)?.[1]?.trim() || path.split('/').pop() || 'Workflow';
      const triggers: string[] = [];
      const onBlock = content.match(/^on:\s*(?:\r?\n)((?:[ \t]+[^\r\n]*\r?\n?)*)/m)?.[1] || '';
      const inlineOn = content.match(/^on:[ \t]*([^\r\n]+)/m)?.[1]?.trim();
      if (inlineOn && inlineOn !== '{}') triggers.push(inlineOn.replace(/[\[\]'\"]/g, '').trim());
      else for (const match of onBlock.matchAll(/^  ([\w-]+):/gm)) triggers.push(match[1]);
      const jobsSection = content.split(/^jobs:\s*$/m)[1]?.split(/^\S/m)[0] || '';
      const jobs = [...jobsSection.matchAll(/^  ([\w-]+):/gm)].map(match => match[1]).slice(0, 8);
      const deploySignals = [...new Set((content.match(/(?:deploy|publish|release|upload-pages|wrangler deploy|vercel deploy|netlify deploy|aws-actions|azure\/webapps)/gi) || []).map(signal => signal.toLowerCase()))].slice(0, 5);
      return { path, name, triggers: triggers.slice(0, 6), jobs, deploySignals };
    });
  const deploymentTargets = new Set<string>();
  for (const path of paths) {
    const lower = path.toLowerCase();
    if (/(^|\/)(dockerfile|docker-compose\.ya?ml|compose\.ya?ml)$/.test(lower)) deploymentTargets.add('Docker / containers');
    if (/(^|\/)vercel\.json$/.test(lower)) deploymentTargets.add('Vercel');
    if (/(^|\/)netlify\.toml$/.test(lower)) deploymentTargets.add('Netlify');
    if (/(^|\/)wrangler\.toml$/.test(lower)) deploymentTargets.add('Cloudflare Workers');
    if (/(^|\/)fly\.toml$/.test(lower)) deploymentTargets.add('Fly.io');
    if (/(^|\/)(serverless\.ya?ml|sam\.ya?ml)$/.test(lower)) deploymentTargets.add('AWS Serverless');
    if (/(^|\/)(kustomization\.ya?ml)$/.test(lower) || /(^|\/)helm\/[^/]+\/chart\.yaml$/.test(lower)) deploymentTargets.add('Kubernetes');
    if (/(^|\/)terraform\/.*\.tf$/.test(lower) || /(^|\/)main\.tf$/.test(lower)) deploymentTargets.add('Terraform infrastructure');
  }
  for (const workflow of workflows) {
    for (const signal of workflow.deploySignals) {
      if (signal.includes('vercel')) deploymentTargets.add('Vercel');
      if (signal.includes('netlify')) deploymentTargets.add('Netlify');
      if (signal.includes('wrangler')) deploymentTargets.add('Cloudflare Workers');
      if (signal.includes('aws')) deploymentTargets.add('AWS');
      if (signal.includes('azure')) deploymentTargets.add('Azure');
    }
  }
  return { workflows, deploymentTargets: [...deploymentTargets], liveStatus: 'Not checked. Connect GitHub to see recent workflow runs and deployment status.' };
}

export async function analyzeCodebaseSource(source: CodebaseSource): Promise<CodebaseAnalysis> {
  const paths = [...new Set(source.paths)].sort((a, b) => a.localeCompare(b));
  const languageCounts = new Map<string, number>();
  const topLevelCounts = new Map<string, number>();
  const nestedDirectoryCounts = new Map<string, number>();
  const entryPoints = new Set<string>();
  const testSignals = new Set<string>();
  let testFilesCount = 0;

  for (const path of paths) {
    const lowerPath = path.toLowerCase();
    const fileName = normalizedName(path);
    const extension = fileName.includes('.') ? fileName.split('.').pop() || '' : '';
    const language = EXTENSION_LANGUAGES[extension];
    if (language) languageCounts.set(language, (languageCounts.get(language) || 0) + 1);

    const firstSegment = path.split('/')[0];
    if (path.includes('/')) topLevelCounts.set(firstSegment, (topLevelCounts.get(firstSegment) || 0) + 1);

    const pathSegments = path.split('/');
    if (pathSegments.length >= 3) {
      const nestedDirectory = `${pathSegments[0]}/${pathSegments[1]}`;
      nestedDirectoryCounts.set(nestedDirectory, (nestedDirectoryCounts.get(nestedDirectory) || 0) + 1);
    }

    if (/^(src\/)?(main|index)\.(tsx?|jsx?|mjs|cjs|py|rs|go|java|kt|swift|dart)$/.test(lowerPath)
      || /^(app|main)\.(py|go|rs|rb|php)$/.test(lowerPath)
      || /^(src\/)?main\.rs$/.test(lowerPath)
      || /^manage\.py$/.test(lowerPath)
      || /^src\/tauri\/src\/main\.rs$/.test(lowerPath)
      || /^src-tauri\/src\/main\.rs$/.test(lowerPath)
      || /(^|\/)(?:src\/)?app\/(?:page|layout)\.(?:tsx?|jsx?)$/.test(lowerPath)
      || /(^|\/)(?:src\/)?pages\/(?:index|_app)\.(?:tsx?|jsx?)$/.test(lowerPath)
      || /^index\.html$/.test(lowerPath)) {
      entryPoints.add(path);
    }

    if (isRecognizedTestFile(path)) {
      testSignals.add(path);
      testFilesCount += 1;
    }
  }

  configuredTestToolSignals(paths).forEach(signal => testSignals.add(signal));

  const languages = [...languageCounts.entries()]
    .map(([name, files]) => ({ name, files }))
    .sort((a, b) => b.files - a.files || a.name.localeCompare(b.name));
  const scripts = extractPackageScripts(source);
  const testFiles = paths.filter(isRecognizedTestFile);
  const sourceMetrics = source.sourceMetrics || createEmptySourceMetrics();
  const deepAnalysis = await inspectSourceCode(source);
  const deepJsProfile = hasSupportedJsDeepProfile(paths, source.manifests);
  const dependencyInventory = extractNpmDependencyInventory(paths, source.manifests, deepJsProfile);

  let dependencyRisk: DependencyRiskAssessment | undefined;
  const npmInventory = dependencyInventory;
  if (npmInventory !== undefined && npmInventory.packages.length > 0) {
    try {
      dependencyRisk = await scanNpmDependencyRisks(npmInventory);
    } catch {
      // OSV.dev unavailable - score excludes CVEs until a later audit succeeds.
    }
  }

  const frameworkProfile = detectAndAnalyzeFramework(source);

  return {
    rootName: source.rootName,
    rootPath: source.rootPath,
    directoryHandleId: source.directoryHandleId,
    scannedAt: Date.now(),
    filesScanned: paths.length,
    sourceFiles: paths.filter(path => SOURCE_EXTENSIONS.has(normalizedName(path).split('.').pop() || '')).length,
    truncated: Boolean(source.truncated),
    languages,
    frameworks: detectFrameworks(source),
    nextjs: assessNextJsOverview(source, paths),
    frameworkProfile,
    dependencyInventory,
    dependencyRisk,
    entryPoints: [...entryPoints].sort(),
    testSignals: [...testSignals].sort(),
    structurePaths: paths,
    structureDirectories: source.directories || [],
    topLevelDirectories: [...topLevelCounts.entries()]
      .map(([name, files]) => ({ name, files }))
      .sort((a, b) => b.files - a.files || a.name.localeCompare(b.name))
      .slice(0, 12),
    scripts,
    nestedDirectories: [...nestedDirectoryCounts.entries()]
      .map(([path, files]) => {
        const [parent, name] = path.split('/');
        return { parent, name, files };
      })
      .sort((a, b) => a.parent.localeCompare(b.parent) || b.files - a.files || a.name.localeCompare(b.name))
      .slice(0, 24),
    testFilesCount,
    quality: assessCodeQuality(
      paths,
      source.directories || [],
      scripts,
      testFiles.length,
      sourceMetrics,
      source.manifests,
      source.sourceContents || {},
      deepAnalysis,
      dependencyRisk,
      frameworkProfile,
    ),
    architecture: assessArchitecture(source, paths),
    suggestions: suggestImprovements(paths, scripts, testFiles.length, hasNextJsProjectSignal(paths, source.manifests)),
    git: source.git,
    pipeline: assessPipeline(source, paths),
  };
}

async function scanBrowserDirectory(root: BrowserDirectoryHandle, rootPath: string, existingHandleId?: string): Promise<CodebaseSource> {
  const directoryHandleId = existingHandleId || await saveDirectoryHandle(root);
  const paths: string[] = [];
  const directories: string[] = [];
  const manifests: Record<string, string> = {};
  const sourceContents: Record<string, string> = {};
  const sourceMetrics = createEmptySourceMetrics();
  const MAX_FILES = 15000;
  const MAX_ENTRIES = 30000;
  let sourceBytesRead = 0;
  let truncated = false;
  let gitTracked = false;
  let entriesScanned = 0;
  const pending: Array<{ directory: BrowserDirectoryHandle; prefix: string }> = [{ directory: root, prefix: '' }];

  while (pending.length > 0 && !truncated) {
    const { directory, prefix } = pending.pop()!;
    for await (const [name, entry] of directory.entries()) {
      if (!prefix && name === '.git') {
        gitTracked = true;
        continue;
      }
      entriesScanned += 1;
      if (paths.length >= MAX_FILES || entriesScanned >= MAX_ENTRIES) {
        truncated = true;
        break;
      }
      if (isDirectoryHandle(entry)) {
        if (IGNORED_DIRECTORIES.has(name)) continue;
        const directoryPath = prefix ? `${prefix}/${name}` : name;
        directories.push(directoryPath);
        pending.push({ directory: entry, prefix: directoryPath });
        continue;
      }

      const path = prefix ? `${prefix}/${name}` : name;
      paths.push(path);
      const isWorkflow = path.startsWith('.github/workflows/') && /\.ya?ml$/i.test(name);
      const extension = normalizedName(path).split('.').pop() || '';
      const isSourceFile = SOURCE_EXTENSIONS.has(extension);
      if (!MANIFEST_FILES.has(name.toLowerCase()) && !isWorkflow && !isSourceFile) continue;
      try {
        const file = await entry.getFile();
        if (isSourceFile) {
          if (file.size <= SOURCE_CONTENT_MAX_FILE_BYTES && sourceBytesRead + file.size <= SOURCE_CONTENT_MAX_TOTAL_BYTES) {
            const content = await file.text();
            sourceBytesRead += file.size;
            sourceContents[path] = content;
            addSourceContentMetric(path, content, sourceMetrics);
          } else sourceMetrics.skippedFiles += 1;
        }
        const isLockfile = ['package-lock.json', 'npm-shrinkwrap.json'].includes(name.toLowerCase());
        if ((MANIFEST_FILES.has(name.toLowerCase()) || isWorkflow) && file.size <= (isLockfile ? LOCKFILE_MAX_BYTES : 256 * 1024)) manifests[path] = await file.text();
      } catch {
        // Keep the path in the report if a manifest cannot be read.
        if (isSourceFile) sourceMetrics.skippedFiles += 1;
      }
    }
  }

  return { rootName: root.name, rootPath, directoryHandleId, paths, directories, manifests, sourceMetrics, sourceContents, truncated, git: { tracked: gitTracked } };
}

function toScanError(error: unknown): Error {
  if (error instanceof Error && error.message.trim()) return error;
  if (typeof error === 'string' && error.trim()) return new Error(error);
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return new Error(message);
  }
  return new Error('Could not scan this codebase.');
}

export async function chooseAndAnalyzeCodebase(): Promise<CodebaseAnalysis | null> {
  if (window.__TAURI_INTERNALS__) {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const { invoke } = await import('@tauri-apps/api/core');
    const selected = await open({
      directory: true,
      multiple: false,
      title: 'Choose a codebase to analyze',
    });
    if (!selected || Array.isArray(selected)) return null;
    try {
      const source = await invoke<CodebaseSource>('read_codebase', { rootPath: selected });
      return await analyzeCodebaseSource(source);
    } catch (error) {
      throw toScanError(error);
    }
  }

  if (!window.showDirectoryPicker) {
    throw new Error('Folder scanning is not supported in this browser. Use blueprint studio desktop or a Chromium browser.');
  }

  let root: BrowserDirectoryHandle;
  try {
    root = await window.showDirectoryPicker({ mode: 'read' });
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') return null;
    throw error;
  }
  const source = await scanBrowserDirectory(root, root.name);
  return analyzeCodebaseSource(source);
}

export async function reanalyzeCodebase(analysis: CodebaseAnalysis): Promise<CodebaseAnalysis | null> {
  if (window.__TAURI_INTERNALS__) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const source = await invoke<CodebaseSource>('read_codebase', { rootPath: analysis.rootPath });
      return analyzeCodebaseSource(source);
    } catch {
      // The folder may have moved or been removed. Fall through to the folder picker as recovery.
    }
  } else if (analysis.directoryHandleId) {
    const handle = await loadDirectoryHandle(analysis.directoryHandleId);
    if (handle) {
      try {
        let permission = await handle.queryPermission?.({ mode: 'read' });
        if (!permission || permission === 'prompt') permission = await handle.requestPermission?.({ mode: 'read' });
        if (permission === 'granted' || (!permission && !handle.queryPermission && !handle.requestPermission)) {
          return analyzeCodebaseSource(await scanBrowserDirectory(handle, analysis.rootPath, analysis.directoryHandleId));
        }
      } catch {
        // Use the picker below if the browser no longer grants access to the saved handle.
      }
    }
  }

  const replacement = await chooseAndAnalyzeCodebase();
  if (replacement && replacement.rootName !== analysis.rootName) {
    throw new Error(`Selected “${replacement.rootName}”. Choose the original “${analysis.rootName}” folder to re-analyze this project.`);
  }
  return replacement;
}
