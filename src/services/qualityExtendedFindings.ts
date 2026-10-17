import type * as TS from 'typescript';
import { QualityFinding } from '../types/codebase';
import { normalizedName } from './codebaseAnalysisConstants';

type TsModule = typeof import('typescript');

const ENV_TEMPLATE_PATTERN = /(^|\/)\.env\.(?:example|sample|template)(?:\.[^/]+)?$/i;
const ENV_SECRET_FILE_PATTERN = /(^|\/)\.env(?:\.[^/]+)?$/i;

export function collectProjectHygieneFindings(
  normalizedPaths: string[],
  lowerPaths: string[],
  manifests: Record<string, string>,
  sourceContents: Record<string, string>,
): QualityFinding[] {
  const findings: QualityFinding[] = [];

  const envSecretPaths = normalizedPaths.filter(
    path => ENV_SECRET_FILE_PATTERN.test(path) && !ENV_TEMPLATE_PATTERN.test(path),
  );
  if (envSecretPaths.length > 0) {
    findings.push({
      title: 'Environment file present in scanned tree',
      detail:
        'A .env-style file appears in the project tree. Real secrets should not be committed; document required variables in .env.example and keep production values in your secret store or CI.',
      priority: 'high',
      category: 'security',
      evidence: envSecretPaths.slice(0, 6),
    });
  }

  const hasEnvTemplate = lowerPaths.some(path => ENV_TEMPLATE_PATTERN.test(path));
  const manifestText = Object.values(manifests).join('\n');
  const sourceSample = Object.values(sourceContents).slice(0, 200).join('\n');
  const usesEnvVars = /\bprocess\.env\b|import\.meta\.env|dotenv/i.test(`${manifestText}\n${sourceSample}`);
  if (usesEnvVars && !hasEnvTemplate) {
    findings.push({
      title: 'No .env.example template detected',
      detail:
        'The project references environment variables but no .env.example (or similar template) was found. Add one so setup steps stay documented and secrets stay out of git.',
      priority: 'low',
      category: 'documentation',
      evidence: ['process.env or dotenv usage detected', 'No .env.example / .env.sample in scan'],
    });
  }

  const hasRootPackage = manifests['package.json'] !== undefined;
  const hasLockfile = lowerPaths.some(path =>
    /(?:^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?)$/i.test(path),
  );
  if (hasRootPackage && !hasLockfile) {
    findings.push({
      title: 'No npm/yarn/pnpm lockfile detected',
      detail:
        'package.json is present without a lockfile in the scanned tree. Commit a lockfile so installs are reproducible in CI and production.',
      priority: 'medium',
      category: 'delivery',
      evidence: ['package.json without package-lock.json, pnpm-lock.yaml, or yarn.lock'],
    });
  }

  if (manifests['package.json']) {
    try {
      const pkg = JSON.parse(manifests['package.json']) as {
        engines?: { node?: string };
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      if (!pkg.engines?.node) {
        findings.push({
          title: 'No Node.js engine constraint in package.json',
          detail:
            'Adding engines.node documents supported Node versions for contributors, CI, and deployment targets.',
          priority: 'low',
          category: 'delivery',
          evidence: ['package.json has no engines.node'],
        });
      }
      const prod = new Set(Object.keys(pkg.dependencies || {}));
      const overlap = Object.keys(pkg.devDependencies || {}).filter(name => prod.has(name));
      if (overlap.length > 0) {
        findings.push({
          title: 'Packages listed in both dependencies and devDependencies',
          detail:
            'The same package name appears in dependencies and devDependencies. Keep runtime deps in dependencies only to avoid confusion and bloated production installs.',
          priority: 'low',
          category: 'structure',
          evidence: overlap.slice(0, 8).map(name => name),
        });
      }
    } catch {
      // ignore invalid package.json
    }
  }

  const dockerfilePath = normalizedPaths.find(
    path => normalizedName(path) === 'dockerfile' || /(^|\/)dockerfile$/i.test(path),
  );
  const dockerContent = dockerfilePath ? sourceContents[dockerfilePath] : undefined;
  if (dockerContent && !/\bhealthcheck\b/i.test(dockerContent)) {
    findings.push({
      title: 'Dockerfile has no HEALTHCHECK instruction',
      detail:
        'Container orchestrators use health checks to know when the app is ready. Consider adding a HEALTHCHECK that matches your HTTP or process readiness probe.',
      priority: 'low',
      category: 'delivery',
      evidence: [dockerfilePath!],
    });
  }

  return findings;
}

export function collectTestFileFindings(
  contentEntries: Array<[string, string]>,
  isTestFile: (path: string) => boolean,
): QualityFinding[] {
  const findings: QualityFinding[] = [];

  for (const [path, content] of contentEntries) {
    if (!isTestFile(path)) continue;

    const skipMatches = content.match(/\b(?:it|test|describe)\.skip\s*\(/g);
    if (skipMatches && skipMatches.length > 0) {
      findings.push({
        title: 'Skipped tests in test file',
        detail: `${skipMatches.length} skipped test block(s) found. Re-enable or remove them so CI reflects real coverage and regressions are not hidden.`,
        priority: 'medium',
        category: 'testing',
        evidence: [`${path} · ${skipMatches.length} .skip call(s)`],
      });
    }

    const lineCount = content.split(/\r\n|\n|\r/).filter(line => line.trim()).length;
    if (lineCount >= 15 && !/\b(?:expect\s*\(|assert\.|assertionError|should\.|toEqual|toBe|toMatch)/i.test(content)) {
      findings.push({
        title: 'Test file with no obvious assertions',
        detail:
          'This test-like file has substantive content but no common assertion APIs were detected. Confirm it actually verifies behavior or merge it into a real test suite.',
        priority: 'low',
        category: 'testing',
        evidence: [path],
      });
    }
  }

  return findings;
}

function measureControlFlowNesting(ts: TsModule, node: TS.Node): number {
  let max = 0;
  const visit = (current: TS.Node, depth: number) => {
    let nextDepth = depth;
    if (
      ts.isIfStatement(current) ||
      ts.isForStatement(current) ||
      ts.isForOfStatement(current) ||
      ts.isForInStatement(current) ||
      ts.isWhileStatement(current) ||
      ts.isDoStatement(current) ||
      ts.isTryStatement(current) ||
      ts.isSwitchStatement(current) ||
      ts.isCatchClause(current)
    ) {
      nextDepth = depth + 1;
      max = Math.max(max, nextDepth);
    }
    ts.forEachChild(current, child => visit(child, nextDepth));
  };
  visit(node, 0);
  return max;
}

function countModuleExports(sourceFile: TS.SourceFile, ts: typeof TS): number {
  let count = 0;
  const hasExport = (modifiers?: TS.NodeArray<TS.ModifierLike>) =>
    modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false;

  const visit = (node: TS.Node) => {
    if (ts.isExportDeclaration(node) || ts.isExportAssignment(node)) {
      count += 1;
    } else if (
      (ts.isFunctionDeclaration(node) ||
        ts.isClassDeclaration(node) ||
        ts.isInterfaceDeclaration(node) ||
        ts.isTypeAliasDeclaration(node) ||
        ts.isEnumDeclaration(node)) &&
      (hasExport(node.modifiers) || node.modifiers?.some(m => m.kind === ts.SyntaxKind.DefaultKeyword))
    ) {
      count += 1;
    } else if (ts.isVariableStatement(node) && hasExport(node.modifiers)) {
      count += node.declarationList.declarations.length;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return count;
}

export function collectParsedFileFindings(
  ts: TsModule,
  path: string,
  content: string,
  sourceFile: TS.SourceFile,
  isFunctionNode: (node: TS.Node) => node is TS.FunctionLikeDeclaration,
  createSnippet: (content: string, line: number) => QualityFinding['codeSnippet'],
): QualityFinding[] {
  const findings: QualityFinding[] = [];
  const extension = normalizedName(path).split('.').pop() || '';
  const isTyped = ['ts', 'tsx', 'mts', 'cts'].includes(extension);

  if (isTyped) {
    const anyCount = (content.match(/:\s*any\b|<\s*any\s*>|\bas\s+any\b/g) || []).length;
    if (anyCount >= 10) {
      findings.push({
        title: 'Heavy use of explicit any',
        detail: `${anyCount} explicit any usages detected in this file. Prefer proper types or unknown + narrowing so refactors stay safe.`,
        priority: 'medium',
        category: 'maintainability',
        evidence: [`${path} · ${anyCount} any occurrences`],
      });
    }

    const tsExpectError = (content.match(/@ts-expect-error\b/g) || []).length;
    const tsIgnore = (content.match(/@ts-ignore\b/g) || []).length;
    if (tsExpectError + tsIgnore >= 4) {
      findings.push({
        title: 'Many TypeScript error suppressions',
        detail: `${tsExpectError + tsIgnore} @ts-expect-error / @ts-ignore directives in one file. Prefer fixing types or a narrow suppression with a comment explaining why.`,
        priority: 'low',
        category: 'maintainability',
        evidence: [`${path} · ${tsExpectError} expect-error, ${tsIgnore} ignore`],
      });
    }
  }

  const exportCount = countModuleExports(sourceFile, ts);
  if (exportCount > 15) {
    findings.push({
      title: 'Crowded module export surface',
      detail: `${exportCount} exports in one file can make the module hard to navigate. Consider splitting by feature or marking a smaller public API.`,
      priority: 'low',
      category: 'structure',
      evidence: [`${path} · ${exportCount} exports`],
    });
  }

  const visitFunctions = (node: TS.Node) => {
    if (isFunctionNode(node) && node.body) {
      const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
      const nesting = measureControlFlowNesting(ts, node.body);
      const name =
        'name' in node && node.name && ts.isIdentifier(node.name) ? node.name.text : 'anonymous function';
      if (nesting >= 6) {
        findings.push({
          title: 'Deep control-flow nesting',
          detail: `${name} has control-flow nesting depth ${nesting}. Early returns, guard clauses, or extracted helpers usually improve readability and testability.`,
          priority: 'medium',
          category: 'maintainability',
          evidence: [`${path}:${start}`, `Nesting depth: ${nesting}`],
          codeSnippet: createSnippet(content, start),
        });
      }
    }
    ts.forEachChild(node, visitFunctions);
  };
  visitFunctions(sourceFile);

  return findings;
}
