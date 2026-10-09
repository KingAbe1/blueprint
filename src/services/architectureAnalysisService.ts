import type { ArchitectureAssessment, CodebaseAnalysis, CodebaseSource, CodebaseSuggestion, NextJsOverview } from '../types/codebase';
import { MANIFEST_FILES, normalizedName } from './codebaseAnalysisConstants';

function hasNextJsProjectSignal(paths: string[], manifests: Record<string, string>) {
  const hasNextConfig = paths.some(path => /(^|\/)next\.config\.(?:[cm]?js|[cm]?ts)$/i.test(path.replace(/\\/g, '/')));
  const hasNextDependency = Object.entries(manifests).some(([path, content]) => /(^|\/)package\.json$/i.test(path.replace(/\\/g, '/')) && /["']next["']\s*:/i.test(content));
  return hasNextConfig || hasNextDependency;
}

export function assessNextJsOverview(source: CodebaseSource, paths: string[]): NextJsOverview | undefined {
  if (!hasNextJsProjectSignal(paths, source.manifests)) return undefined;

  const normalizedPaths = paths.map(path => path.replace(/\\/g, '/'));
  const appPagePaths = normalizedPaths.filter(path => {
    const segments = path.toLowerCase().split('/');
    return segments.includes('app') && /\/page\.(?:js|jsx|ts|tsx)$/i.test(path);
  });
  const pagesRoutePaths = normalizedPaths.filter(path => {
    const segments = path.toLowerCase().split('/');
    const pagesIndex = segments.lastIndexOf('pages');
    if (pagesIndex < 0 || /\.(?:d\.ts)$/i.test(path)) return false;
    const routeSegments = segments.slice(pagesIndex + 1);
    const fileName = routeSegments.at(-1) || '';
    return routeSegments.length > 0
      && !routeSegments.includes('api')
      && !/^_(?:app|document|error)\./.test(fileName)
      && /\.(?:js|jsx|ts|tsx)$/.test(fileName);
  });
  const appApiPaths = normalizedPaths.filter(path => path.toLowerCase().split('/').includes('app') && /\/route\.(?:js|ts)$/i.test(path));
  const pagesApiPaths = normalizedPaths.filter(path => {
    const segments = path.toLowerCase().split('/');
    const pagesIndex = segments.lastIndexOf('pages');
    return pagesIndex >= 0 && segments[pagesIndex + 1] === 'api' && /\.(?:js|jsx|ts|tsx)$/.test(path);
  });
  const appRouterPresent = appPagePaths.length > 0 || appApiPaths.length > 0
    || normalizedPaths.some(path => path.toLowerCase().split('/').includes('app') && /\/(?:layout|loading|error|not-found)\.(?:js|jsx|ts|tsx)$/i.test(path));
  const pagesRouterPresent = pagesRoutePaths.length > 0 || pagesApiPaths.length > 0;
  const router: NextJsOverview['router'] = appRouterPresent && pagesRouterPresent ? 'Both routers'
    : appRouterPresent ? 'App Router'
      : pagesRouterPresent ? 'Pages Router' : 'Router not identified';
  const appRoute = (path: string) => {
    const segments = path.split('/');
    const appIndex = segments.map(segment => segment.toLowerCase()).lastIndexOf('app');
    const routeSegments = segments.slice(appIndex + 1, -1).filter(segment => !/^\([^)]*\)$/.test(segment) && !segment.startsWith('@'));
    const route = routeSegments.join('/');
    return `${route ? `/${route}` : '/'} · ${path}`;
  };
  const pagesRoute = (path: string) => {
    const segments = path.split('/');
    const pagesIndex = segments.map(segment => segment.toLowerCase()).lastIndexOf('pages');
    const routeSegments = segments.slice(pagesIndex + 1).join('/').replace(/\.(?:js|jsx|ts|tsx)$/i, '').split('/').filter(segment => segment !== 'index');
    const route = routeSegments.join('/');
    return `${route ? `/${route}` : '/'} · ${path}`;
  };
  const routeExamples = [
    ...appPagePaths.slice(0, 5).map(appRoute),
    ...pagesRoutePaths.slice(0, 5).map(pagesRoute),
  ].slice(0, 6);
  const packageVersions = Object.entries(source.manifests).flatMap(([path, content]) => {
    if (normalizedName(path) !== 'package.json') return [];
    try {
      const parsed = JSON.parse(content) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
      const version = parsed.dependencies?.next || parsed.devDependencies?.next;
      return typeof version === 'string' ? [version] : [];
    } catch {
      return [];
    }
  });
  const configFiles = normalizedPaths.filter(path => /(^|\/)next\.config\.(?:[cm]?js|[cm]?ts)$/i.test(path));
  const requestBoundaryFiles = normalizedPaths.filter(path => /(^|\/)(?:proxy|middleware)\.(?:js|ts)$/i.test(path));
  const declaredMajorVersion = packageVersions.map(version => Number(version.match(/\d+/)?.[0])).find(Number.isFinite);
  const hasLegacyMiddleware = requestBoundaryFiles.some(path => /(^|\/)middleware\.(?:js|ts)$/i.test(path));
  const requestBoundaryNote = declaredMajorVersion && declaredMajorVersion >= 16 && hasLegacyMiddleware
    ? 'Next.js 16 deprecates the middleware filename in favor of proxy; confirm the project version and runtime needs before migrating.'
    : undefined;

  return {
    version: [...new Set(packageVersions)].join(', ') || undefined,
    router,
    appRouteCount: appPagePaths.length,
    pagesRouteCount: pagesRoutePaths.length,
    apiRouteCount: appApiPaths.length + pagesApiPaths.length,
    routeExamples,
    configFiles,
    requestBoundaryFiles,
    requestBoundaryNote,
  };
}

export function configuredTestToolSignals(paths: string[]) {
  const configs: Array<[RegExp, string]> = [
    [/(^|\/)(vitest|jest|playwright|cypress)\.config\.[^/]+$/i, 'Test runner configuration'],
    [/(^|\/)(pytest\.ini|tox\.ini|conftest\.py)$/i, 'Pytest configuration'],
    [/(^|\/)karma\.conf\.[^/]+$/i, 'Karma configuration'],
  ];
  return [...new Set(paths.flatMap(path => configs.filter(([pattern]) => pattern.test(path)).map(([, label]) => label)))];
}

export function assessArchitecture(source: CodebaseSource, paths: string[]): ArchitectureAssessment {
  const manifestPaths = Object.keys(source.manifests).filter(path => MANIFEST_FILES.has(normalizedName(path)));
  const serviceManifests = manifestPaths.filter(path => /^(apps|services|functions)\/[^/]+\//i.test(path));
  const serverlessFiles = paths.filter(path => /(^|\/)(serverless\.ya?ml|sam\.ya?ml|template\.ya?ml|wrangler\.toml|vercel\.json|netlify\.toml)$/i.test(path));
  const packageJson = Object.entries(source.manifests)
    .filter(([path]) => normalizedName(path) === 'package.json')
    .map(([, content]) => {
      try { return JSON.parse(content) as Record<string, any>; } catch { return {}; }
    });
  const hasWorkspace = packageJson.some(pkg => Boolean(pkg.workspaces));
  const evidence: string[] = [];
  let topology = 'Not enough evidence';
  let confidence: ArchitectureAssessment['confidence'] = 'low';
  let summary = 'The scan could not identify a likely deployment shape from the files and manifests it inspected.';

  if (serverlessFiles.length) {
    topology = 'Serverless deployment signals';
    confidence = 'high';
    evidence.push(...serverlessFiles.slice(0, 3).map(path => `Found ${path}`));
    summary = 'Deployment configuration points to functions or serverless hosting. The scan cannot confirm how the application is divided at runtime.';
  } else if (serviceManifests.length >= 2) {
    topology = 'Multiple service units (microservices signal)';
    confidence = 'medium';
    evidence.push(...serviceManifests.slice(0, 4).map(path => `Found service manifest: ${path}`));
    summary = 'Several independently described apps or services appear in the repository. Separate manifests alone do not prove they deploy independently.';
  } else if (hasWorkspace) {
    topology = 'Monorepo';
    confidence = 'high';
    evidence.push('Workspace configuration found in package.json');
    const workspacePackages = manifestPaths.filter(path => /^(apps|packages)\/[^/]+\/package\.json$/i.test(path));
    if (workspacePackages.length) evidence.push(`${workspacePackages.length} app/package manifests found under apps/ or packages/`);
    summary = 'The repository groups multiple packages or apps. Monorepo describes repository organization; it does not by itself determine deployment architecture.';
  } else if (manifestPaths.length > 0) {
    topology = 'Single application (monolith signal)';
    confidence = manifestPaths.length === 1 ? 'medium' : 'low';
    evidence.push(`${manifestPaths.length} project manifest${manifestPaths.length === 1 ? '' : 's'} found`);
    if (paths.some(path => /(^|\/)(src|app|routes|components)\//i.test(path))) evidence.push('Application source directories found');
    summary = 'The scan found one main project manifest and no clear split into separately described services. This is a monolith signal, not proof of deployment topology.';
  }

  const nextjs = assessNextJsOverview(source, paths);
  if (nextjs) {
    evidence.push(`Next.js ${nextjs.version || 'version not resolved'} · ${nextjs.router}`);
    evidence.push(`${nextjs.appRouteCount} App Router pages · ${nextjs.pagesRouteCount} Pages Router pages · ${nextjs.apiRouteCount} API routes detected`);
    if (nextjs.requestBoundaryFiles.length) evidence.push(`Request boundary files: ${nextjs.requestBoundaryFiles.slice(0, 2).join(', ')}`);
    summary += ' Next.js route conventions were inspected from file paths; this does not prove that the app builds or how it is deployed.';
  }

  const manifestText = Object.entries(source.manifests).map(([path, content]) => `${path}\n${content}`).join('\n').toLowerCase();
  const databaseSignals: Array<[RegExp, string]> = [
    [/@prisma\/client|\bprisma\b/, 'Prisma'],
    [/drizzle-orm|drizzle-kit/, 'Drizzle ORM'],
    [/\bpg\b|psycopg|asyncpg|npgsql|postgresql/, 'PostgreSQL'],
    [/mysql2?|pymysql|mysqlclient/, 'MySQL'],
    [/mongodb|mongoose|pymongo/, 'MongoDB'],
    [/better-sqlite3|sqlite3|rusqlite|sqlx.*sqlite/, 'SQLite'],
    [/redis|ioredis/, 'Redis'],
    [/sequelize|typeorm|knex/, 'SQL database client/ORM'],
    [/sqlalchemy/, 'SQLAlchemy (database engine unclear)'],
  ];
  const matchedDatabases = databaseSignals.filter(([signal]) => signal.test(manifestText)).map(([, name]) => name);
  const schemaPaths = paths.filter(path => /(^|\/)(prisma\/schema\.prisma|migrations?\/|schema\.sql$|drizzle\/)/i.test(path));
  let database: ArchitectureAssessment['database'] = { name: 'No database signal detected', confidence: 'low', evidence: ['No recognizable database client, ORM, schema, or migration path found in scanned manifests and filenames.'] };
  if (matchedDatabases.length) {
    database = {
      name: [...new Set(matchedDatabases)].join(', '),
      confidence: matchedDatabases.some(name => ['PostgreSQL', 'MySQL', 'MongoDB', 'SQLite', 'Redis'].includes(name)) ? 'medium' : 'low',
      evidence: [...new Set(matchedDatabases)].slice(0, 3).map(name => `Dependency or manifest signal: ${name}`),
    };
  } else if (schemaPaths.length) {
    database = { name: 'Database schema present; engine unclear', confidence: 'medium', evidence: schemaPaths.slice(0, 3).map(path => `Found ${path}`) };
  }

  return { topology, confidence, summary, evidence, database };
}

export function suggestImprovements(paths: string[], scripts: NonNullable<CodebaseAnalysis['scripts']>, testFilesCount: number, isNextProject: boolean): CodebaseSuggestion[] {
  const suggestions: CodebaseSuggestion[] = [];
  const hasReadme = paths.some(path => /^readme(?:\.[^/]*)?$/i.test(path));
  const scriptNames = new Set(scripts.map(script => script.name.toLowerCase()));
  const hasTestConfig = paths.some(path => /(^|\/)(?:(?:vitest|jest|playwright|cypress)\.config\.[^/]+|pytest\.ini|tox\.ini)$/i.test(path));
  const hasQualityConfig = paths.some(path => /(^|\/)(eslint\.config\.[^/]+|\.eslintrc(?:\.[^/]+)?|biome\.jsonc?|ruff\.toml|\.golangci\.ya?ml)$/i.test(path));

  if (testFilesCount === 0 && !hasTestConfig && ![...scriptNames].some(name => /test|spec/.test(name))) {
    suggestions.push({ title: isNextProject ? 'Add a Next.js route test' : 'Add a first automated test', detail: isNextProject ? 'Cover an important route and one interactive client flow with a framework-appropriate test runner such as Playwright or Cypress.' : 'No test files or test scripts were detected. Start with one test around a core user flow or business rule.', priority: 'high' });
  }
  if (!hasQualityConfig && ![...scriptNames].some(name => ['lint', 'check', 'typecheck', 'type-check'].includes(name))) {
    suggestions.push({ title: isNextProject ? 'Add repeatable Next.js quality checks' : 'Add a repeatable code quality check', detail: isNextProject ? 'Add an ESLint check and a TypeScript no-emit check to the project scripts, then run them with the production build in CI.' : 'No lint or check script was found in the root package scripts. A consistent check helps catch issues before changes are merged.', priority: 'medium' });
  }
  if (!hasReadme) {
    suggestions.push({ title: 'Document how to run the project', detail: 'No README was found in the scanned tree. Add setup, run, and test instructions so a new contributor can get oriented quickly.', priority: 'medium' });
  }
  if (suggestions.length === 0) {
    suggestions.push({ title: 'Trace one end-to-end flow', detail: 'Follow a user action from its entry point through core logic to persistence or an external API. This validates the inferred boundaries and reveals where the design can improve.', priority: 'medium' });
  }
  return suggestions.slice(0, 3);
}
